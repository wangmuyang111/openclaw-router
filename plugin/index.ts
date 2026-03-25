import type {
  OpenClawPluginApi,
  PluginHookBeforeAgentStartEvent,
  PluginHookBeforeAgentStartResult,
  PluginHookMessageReceivedEvent,
  PluginHookMessageSendingEvent,
  PluginHookMessageSendingResult,
  PluginHookMessageContext,
} from "../../../../src/plugins/types.js";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// NOTE: Gateway runs plugins in Node; console.log() becomes gateway log output.

// Configuration-driven classification
// Legacy classification engine removed: we fully converge on the weighted keyword-library engine.
// (Files remain in repo for reference/compat but are no longer loaded at runtime.)

// NEW: keyword library + weighted routing (for user-custom keyword add/remove)
import { loadAndCompileRoutingRules } from "./keyword-library.ts";
import { routeByWeightedRules } from "./weighted-routing-engine.ts";
import {
  resolveRouteSessionIdentity,
  resolveRouteSessionKey,
} from "../src/route-session-key.ts";
import {
  resolveRuntimeRouteSessionIdentity,
  resolveRuntimeRouteSessionKey,
} from "../src/routing-session-key.runtime.ts";
import {
  RoutingSessionStore,
  type Confidence,
  type RouteDecision,
  type TaskSessionState,
} from "../src/routing-session-store.ts";
import { getRouteTrustDecision } from "../src/routing-trust-policy.ts";
import {
  computeRuntimeMessageHash,
  computeShortHash,
} from "../src/runtime-message-hash.ts";

type PluginConfig = {
  enabled?: boolean;
  logDir?: string;
  logFile?: string;
  previewChars?: number;
  maxBytes?: number;
  rotateCount?: number;

  availabilityEnabled?: boolean;
  availabilityMode?: "static" | "cli";
  availabilityTtlMs?: number;
  availabilityCmdTimeoutMs?: number;

  availabilityAsyncEnabled?: boolean;
  availabilityMaxStaleMs?: number;

  echoEnabled?: boolean;
  echoWhen?: "always" | "on_expired" | "never";
  echoMaxChars?: number;

  ruleEngineEnabled?: boolean;
  switchingEnabled?: boolean;
  switchingMinConfidence?: "low" | "medium" | "high";
  switchingAllowChat?: boolean;

  modelTagsPath?: string;
  modelPriorityPath?: string;
  keywordLibraryPath?: string;
  keywordOverridesPath?: string;
  routingRulesCompiledPath?: string;
  keywordCustomEnabled?: boolean;
  catalogTtlMs?: number;
  catalogCmdTimeoutMs?: number;
  setupPromptEnabled?: boolean;
  setupPromptMaxModels?: number;

  taskModeEnabled?: boolean;
  taskModePrimaryKind?: string;
  taskModeKinds?: string[];
  taskModeMinConfidence?: "low" | "medium" | "high";
  taskModeReturnToPrimary?: boolean;
  taskModeReturnModel?: string;
  taskModeAllowAutoDowngrade?: boolean;
  freeSwitchWhenTaskModeOff?: boolean;
};

// Runtime path resolution helpers
function getOpenClawHome(): string {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getWorkspaceDir(): string {
  return process.env.OPENCLAW_WORKSPACE ?? path.join(getOpenClawHome(), "workspace");
}

function getDefaultLogDir(): string {
  return path.join(getOpenClawHome(), "logs");
}

function getDefaultToolsDir(): string {
  return path.join(getWorkspaceDir(), "tools", "soft-router-suggest");
}

const DEFAULTS = {
  enabled: true,
  get logDir() { return getDefaultLogDir(); },
  logFile: "soft-router-suggest.jsonl",
  previewChars: 200,
  maxBytes: 5 * 1024 * 1024,
  rotateCount: 3,

  availabilityEnabled: false,
  availabilityMode: "static" as const,
  availabilityTtlMs: 60_000,
  availabilityCmdTimeoutMs: 500,
  availabilityAsyncEnabled: false,
  availabilityMaxStaleMs: 3_600_000,

  echoEnabled: false,
  echoWhen: "on_expired" as const,
  echoMaxChars: 280,

  ruleEngineEnabled: false,
  switchingEnabled: false,
  switchingMinConfidence: "medium" as const,
  switchingAllowChat: false,

  get modelTagsPath() { return path.join(getDefaultToolsDir(), "model-tags.json"); },
  get modelPriorityPath() { return path.join(getDefaultToolsDir(), "model-priority.json"); },
  get keywordLibraryPath() { return path.join(getDefaultToolsDir(), "keyword-library.json"); },
  get keywordOverridesPath() { return path.join(getDefaultToolsDir(), "keyword-overrides.user.json"); },
  get routingRulesCompiledPath() { return path.join(getDefaultToolsDir(), "routing-rules.compiled.json"); },
  keywordCustomEnabled: true,
  catalogTtlMs: 600_000,
  catalogCmdTimeoutMs: 20_000,
  setupPromptEnabled: true,
  setupPromptMaxModels: 3,

  taskModeEnabled: false,
  taskModePrimaryKind: "coding",
  taskModeKinds: ["coding"],
  taskModeMinConfidence: "medium" as const,
  taskModeReturnToPrimary: true,
  taskModeReturnModel: "",
  taskModeAllowAutoDowngrade: false,
  freeSwitchWhenTaskModeOff: true,
} as const;

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function getRawConfig(api: OpenClawPluginApi): {
  source: "pluginConfig" | "config.plugins.entries" | "none";
  cfg: PluginConfig;
  keys: string[];
} {
  const a = api as any;

  // Primary: validated pluginConfig from openclaw.json -> plugins.entries.<id>.config
  if (a?.pluginConfig && typeof a.pluginConfig === "object" && !Array.isArray(a.pluginConfig)) {
    const raw = a.pluginConfig as PluginConfig;
    const keys = Object.keys(raw as any).sort();
    return { source: "pluginConfig", cfg: raw, keys };
  }

  // Fallback: try to read from the global config tree directly.
  const entryCfg = a?.config?.plugins?.entries?.[a?.id]?.config;
  if (entryCfg && typeof entryCfg === "object" && !Array.isArray(entryCfg)) {
    const raw = entryCfg as PluginConfig;
    const keys = Object.keys(raw as any).sort();
    return { source: "config.plugins.entries", cfg: raw, keys };
  }

  return { source: "none", cfg: {}, keys: [] };
}

function resolveConfig(api: OpenClawPluginApi): Required<typeof DEFAULTS> {
  const { cfg } = getRawConfig(api);
  const enabled = typeof cfg.enabled === "boolean" ? cfg.enabled : DEFAULTS.enabled;
  const logDir = typeof cfg.logDir === "string" && cfg.logDir.trim() ? cfg.logDir : DEFAULTS.logDir;
  const logFile =
    typeof cfg.logFile === "string" && cfg.logFile.trim() ? cfg.logFile : DEFAULTS.logFile;
  const previewChars = clampInt(cfg.previewChars, 0, 2000, DEFAULTS.previewChars);
  const maxBytes = clampInt(cfg.maxBytes, 0, 1_000_000_000, DEFAULTS.maxBytes);
  const rotateCount = clampInt(cfg.rotateCount, 0, 20, DEFAULTS.rotateCount);

  const availabilityEnabled =
    typeof cfg.availabilityEnabled === "boolean"
      ? cfg.availabilityEnabled
      : DEFAULTS.availabilityEnabled;
  const availabilityMode = cfg.availabilityMode === "cli" ? "cli" : DEFAULTS.availabilityMode;
  const availabilityTtlMs = clampInt(cfg.availabilityTtlMs, 1000, 3_600_000, DEFAULTS.availabilityTtlMs);
  const availabilityCmdTimeoutMs = clampInt(
    cfg.availabilityCmdTimeoutMs,
    50,
    20000,
    DEFAULTS.availabilityCmdTimeoutMs,
  );

  const availabilityAsyncEnabled =
    typeof cfg.availabilityAsyncEnabled === "boolean"
      ? cfg.availabilityAsyncEnabled
      : DEFAULTS.availabilityAsyncEnabled;
  const availabilityMaxStaleMs = clampInt(
    cfg.availabilityMaxStaleMs,
    0,
    86_400_000,
    DEFAULTS.availabilityMaxStaleMs,
  );

  const echoEnabled = typeof cfg.echoEnabled === "boolean" ? cfg.echoEnabled : DEFAULTS.echoEnabled;
  const echoWhen = cfg.echoWhen === "always" || cfg.echoWhen === "never" ? cfg.echoWhen : DEFAULTS.echoWhen;
  const echoMaxChars = clampInt(cfg.echoMaxChars, 40, 2000, DEFAULTS.echoMaxChars);

  const ruleEngineEnabled =
    typeof cfg.ruleEngineEnabled === "boolean" ? cfg.ruleEngineEnabled : DEFAULTS.ruleEngineEnabled;
  const switchingEnabled =
    typeof cfg.switchingEnabled === "boolean" ? cfg.switchingEnabled : DEFAULTS.switchingEnabled;
  const switchingMinConfidence =
    cfg.switchingMinConfidence === "low" ||
    cfg.switchingMinConfidence === "medium" ||
    cfg.switchingMinConfidence === "high"
      ? cfg.switchingMinConfidence
      : DEFAULTS.switchingMinConfidence;
  const switchingAllowChat =
    typeof cfg.switchingAllowChat === "boolean" ? cfg.switchingAllowChat : DEFAULTS.switchingAllowChat;

  const modelTagsPath =
    typeof cfg.modelTagsPath === "string" && cfg.modelTagsPath.trim()
      ? cfg.modelTagsPath
      : DEFAULTS.modelTagsPath;
  const modelPriorityPath =
    typeof cfg.modelPriorityPath === "string" && cfg.modelPriorityPath.trim()
      ? cfg.modelPriorityPath
      : DEFAULTS.modelPriorityPath;
  const keywordLibraryPath =
    typeof cfg.keywordLibraryPath === "string" && cfg.keywordLibraryPath.trim()
      ? cfg.keywordLibraryPath
      : DEFAULTS.keywordLibraryPath;
  const keywordOverridesPath =
    typeof cfg.keywordOverridesPath === "string" && cfg.keywordOverridesPath.trim()
      ? cfg.keywordOverridesPath
      : DEFAULTS.keywordOverridesPath;
  const routingRulesCompiledPath =
    typeof cfg.routingRulesCompiledPath === "string" && cfg.routingRulesCompiledPath.trim()
      ? cfg.routingRulesCompiledPath
      : DEFAULTS.routingRulesCompiledPath;
  const keywordCustomEnabled =
    typeof cfg.keywordCustomEnabled === "boolean" ? cfg.keywordCustomEnabled : DEFAULTS.keywordCustomEnabled;

  const catalogTtlMs = clampInt(cfg.catalogTtlMs, 10_000, 86_400_000, DEFAULTS.catalogTtlMs);
  const catalogCmdTimeoutMs = clampInt(
    cfg.catalogCmdTimeoutMs,
    1_000,
    60_000,
    DEFAULTS.catalogCmdTimeoutMs,
  );
  const setupPromptEnabled =
    typeof cfg.setupPromptEnabled === "boolean"
      ? cfg.setupPromptEnabled
      : DEFAULTS.setupPromptEnabled;
  const setupPromptMaxModels = clampInt(
    cfg.setupPromptMaxModels,
    1,
    20,
    DEFAULTS.setupPromptMaxModels,
  );

  const taskModeEnabled =
    typeof cfg.taskModeEnabled === "boolean" ? cfg.taskModeEnabled : DEFAULTS.taskModeEnabled;
  const taskModePrimaryKind =
    typeof cfg.taskModePrimaryKind === "string" && cfg.taskModePrimaryKind.trim()
      ? cfg.taskModePrimaryKind.trim()
      : DEFAULTS.taskModePrimaryKind;
  const taskModeKinds = Array.isArray(cfg.taskModeKinds)
    ? Array.from(
        new Set(
          cfg.taskModeKinds
            .map((value) => String(value ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      )
    : DEFAULTS.taskModeKinds;
  const taskModeMinConfidence =
    cfg.taskModeMinConfidence === "low" ||
    cfg.taskModeMinConfidence === "medium" ||
    cfg.taskModeMinConfidence === "high"
      ? cfg.taskModeMinConfidence
      : DEFAULTS.taskModeMinConfidence;
  const taskModeReturnToPrimary =
    typeof cfg.taskModeReturnToPrimary === "boolean"
      ? cfg.taskModeReturnToPrimary
      : DEFAULTS.taskModeReturnToPrimary;
  const taskModeReturnModel =
    typeof cfg.taskModeReturnModel === "string" && cfg.taskModeReturnModel.trim()
      ? cfg.taskModeReturnModel.trim()
      : DEFAULTS.taskModeReturnModel;
  const taskModeAllowAutoDowngrade =
    typeof cfg.taskModeAllowAutoDowngrade === "boolean"
      ? cfg.taskModeAllowAutoDowngrade
      : DEFAULTS.taskModeAllowAutoDowngrade;
  const freeSwitchWhenTaskModeOff =
    typeof cfg.freeSwitchWhenTaskModeOff === "boolean"
      ? cfg.freeSwitchWhenTaskModeOff
      : DEFAULTS.freeSwitchWhenTaskModeOff;

  return {
    enabled,
    logDir,
    logFile,
    previewChars,
    maxBytes,
    rotateCount,
    availabilityEnabled,
    availabilityMode,
    availabilityTtlMs,
    availabilityCmdTimeoutMs,
    availabilityAsyncEnabled,
    availabilityMaxStaleMs,
    echoEnabled,
    echoWhen,
    echoMaxChars,
    ruleEngineEnabled,
    switchingEnabled,
    switchingMinConfidence,
    switchingAllowChat,
    modelTagsPath,
    modelPriorityPath,
    keywordLibraryPath,
    keywordOverridesPath,
    routingRulesCompiledPath,
    keywordCustomEnabled,
    catalogTtlMs,
    catalogCmdTimeoutMs,
    setupPromptEnabled,
    setupPromptMaxModels,
    taskModeEnabled,
    taskModePrimaryKind,
    taskModeKinds,
    taskModeMinConfidence,
    taskModeReturnToPrimary,
    taskModeReturnModel,
    taskModeAllowAutoDowngrade,
    freeSwitchWhenTaskModeOff,
  };
}

let rotating = false;
async function maybeRotate(logPath: string, maxBytes: number, rotateCount: number) {
  if (maxBytes <= 0 || rotateCount <= 0) return;
  if (rotating) return;
  rotating = true;
  try {
    const stat = await fs.stat(logPath).catch(() => null);
    if (!stat || stat.size <= maxBytes) return;

    // Shift old logs: .(N-1) -> .N
    for (let i = rotateCount - 1; i >= 1; i--) {
      const src = `${logPath}.${i}`;
      const dst = `${logPath}.${i + 1}`;
      try {
        await fs.rename(src, dst);
      } catch {
        // ignore missing
      }
    }

    // Current -> .1
    try {
      await fs.rename(logPath, `${logPath}.1`);
    } catch {
      // ignore
    }

    // Best-effort: if rotateCount==0 we'd delete, but we guard above.
  } finally {
    rotating = false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

const execFileAsync = promisify(execFile);

function providerFromModel(model: string): string {
  const m = (model ?? "").trim();
  const idx = m.indexOf("/");
  return idx > 0 ? m.slice(0, idx) : m;
}

/**
 * Embedded runner + OpenAI-compatible gateways (like our local-proxy) expect the HTTP `model` field
 * to be a *providerless* model id (e.g. "gpt-5.2"), not an OpenClaw catalog key like
 * "local-proxy/gpt-5.2".
 *
 * When we return modelOverride from before_agent_start, OpenClaw may pass it through to the provider.
 * To avoid 502 loops ("unknown provider for model local-proxy/...") we normalize here.
 *
 * Note: this intentionally reduces cross-provider switching for embedded runs; it's a safety fix.
 */
function normalizeModelOverrideForProvider(modelKey: string): { override: string; normalizedFrom?: string } {
  const m = String(modelKey ?? "").trim();
  const idx = m.indexOf("/");
  if (idx > 0) {
    return { override: m.slice(idx + 1), normalizedFrom: m };
  }
  return { override: m };
}

type AuthSnapshot = {
  providers: Record<string, { auth: "ok" | "expired" | "unknown"; remainingMs?: number }>;
  checkedAt: string;
};

let authCache: { value: AuthSnapshot; expiresAtMs: number; lastOkAtMs?: number } | null = null;
let authProbeInFlight: Promise<AuthSnapshot> | null = null;

// Echo support: keep the last suggestion per conversation so we can annotate outgoing replies.
const lastSuggestionByConversation = new Map<string, Suggestion>();

// ---------------------------------------------------------------------------
// Semi-auto rule engine (catalog + tags + rules)
// ---------------------------------------------------------------------------

type ModelCatalogEntry = {
  key: string;
  name?: string;
  input?: string;
  contextWindow?: number | null;
  available?: boolean | null;
  tags?: string[];
  missing?: boolean;
};

type ModelCatalog = {
  fetchedAtMs: number;
  models: ModelCatalogEntry[];
};

type ModelTagsFile = {
  $schema?: string;
  updatedAt?: string;
  notes?: string;
  models?: Record<string, { tags?: string[]; comment?: string }>;
};

type RouterRules = {
  version: number;
  prefer_non_expired?: boolean;
  kinds?: Record<
    string,
    { require_any?: string[]; prefer?: string[]; avoid?: string[] }
  >;
  scoring?: { prefer_weight?: number; require_weight?: number; avoid_weight?: number };
  fallback?: Record<string, string>;
};

type ModelPriorityFile = {
  version: number;
  updatedAt?: string;
  notes?: string;
  kinds?: Record<string, string[]>;
};

let catalogCache: { value: ModelCatalog; expiresAtMs: number } | null = null;
let catalogRefreshInFlight: Promise<ModelCatalog> | null = null;
let lastSetupPromptAtMs = 0;

// Classification config cache
// legacy classification config removed

function inferTagsFromCatalog(entry: ModelCatalogEntry): string[] {
  const tags: string[] = [];
  const key = (entry.key ?? "").toLowerCase();
  const name = (entry.name ?? "").toLowerCase();
  const input = (entry.input ?? "").toLowerCase();
  const ctx = entry.contextWindow ?? null;

  if (input.includes("image")) tags.push("vision", "multimodal");
  if (key.includes("codex") || name.includes("codex") || key.includes("coder")) tags.push("coding");
  if (key.includes("flash") || name.includes("flash") || key.includes("mini")) tags.push("fast");
  if (ctx && ctx >= 200_000) tags.push("long_context");
  if (key.includes("thinking") || name.includes("thinking")) tags.push("reasoning");

  // Defaults
  if (!tags.includes("coding") && !tags.includes("vision")) tags.push("chat", "general");

  return Array.from(new Set(tags));
}

async function loadJsonFile<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function resolveOpenClawMjs(): Promise<{ mjsPath: string; cwd: string }> {
  const env = process.env as Record<string, string | undefined>;

  const candidates = [
    env.OPENCLAW_MJS,
    env.OPENCLAW_HOME ? path.join(env.OPENCLAW_HOME, "openclaw.mjs") : undefined,
    path.join(process.cwd(), "openclaw.mjs"),
    "D:/openclaw/openclaw.mjs", // legacy fallback
  ].filter((v): v is string => Boolean(v && v.trim()));

  for (const p of candidates) {
    try {
      await fs.stat(p);
      return { mjsPath: p, cwd: path.dirname(p) };
    } catch {
      // continue
    }
  }

  throw new Error(
    `openclaw.mjs not found. Tried: ${candidates.join(" | ")}. ` +
      `Set OPENCLAW_MJS or OPENCLAW_HOME to make path portable.`,
  );
}

async function fetchModelCatalogCli(api: OpenClawPluginApi, timeoutMs: number): Promise<ModelCatalog> {
  const execFileAsync = promisify(execFile);
  const now = Date.now();

  // Prefer openclaw on PATH (we installed shim), but keep the node fallback for robustness.
  try {
    const { stdout } = await execFileAsync(
      "openclaw",
      ["models", "list", "--json"],
      { timeout: timeoutMs, windowsHide: true },
    );
    const parsed = JSON.parse(String(stdout ?? "{}"));
    const models = Array.isArray(parsed?.models) ? (parsed.models as ModelCatalogEntry[]) : [];
    return { fetchedAtMs: now, models };
  } catch {
    // Fallback: use "node" from PATH and auto-detect openclaw.mjs path
    const { mjsPath, cwd } = await resolveOpenClawMjs();
    const { stdout } = await execFileAsync(
      "node",
      [mjsPath, "models", "list", "--json"],
      { timeout: timeoutMs, windowsHide: true, cwd },
    );
    const parsed = JSON.parse(String(stdout ?? "{}"));
    const models = Array.isArray(parsed?.models) ? (parsed.models as ModelCatalogEntry[]) : [];
    return { fetchedAtMs: now, models };
  }
}

async function getModelCatalog(api: OpenClawPluginApi, cfg: ReturnType<typeof resolveConfig>): Promise<ModelCatalog> {
  const now = Date.now();
  if (catalogCache && catalogCache.expiresAtMs > now) return catalogCache.value;

  // Non-blocking behavior: if refresh is in-flight, use stale cache if present.
  if (catalogRefreshInFlight) {
    if (catalogCache) return catalogCache.value;
    return await catalogRefreshInFlight;
  }

  const refresh = (async () => {
    try {
      const value = await fetchModelCatalogCli(api, cfg.catalogCmdTimeoutMs);
      catalogCache = { value, expiresAtMs: now + cfg.catalogTtlMs };
      return value;
    } finally {
      catalogRefreshInFlight = null;
    }
  })();

  catalogRefreshInFlight = refresh;
  if (catalogCache) return catalogCache.value;
  return await refresh;
}

function buildProviderAuthMapFromSnapshot(snapshot: AuthSnapshot | null): Record<
  string,
  "ok" | "expired" | "unknown"
> {
  const out: Record<string, "ok" | "expired" | "unknown"> = {};
  if (!snapshot) return out;
  const providers = snapshot.providers ?? {};
  for (const [providerId, v] of Object.entries(providers)) {
    const auth = (v as any)?.auth;
    if (auth === "ok" || auth === "expired" || auth === "unknown") {
      out[String(providerId)] = auth;
    } else {
      out[String(providerId)] = "unknown";
    }
  }
  return out;
}

function pickByPriority(params: {
  kind: string;
  catalog: ModelCatalog;
  priorityFile: ModelPriorityFile | null;
  // classificationConfig removed (keyword-library only)
  providerAuth: Record<string, "ok" | "expired" | "unknown">;
}): { picked?: string; note: string } {
  const { kind, catalog, priorityFile, classificationConfig, providerAuth } = params;
  const present = new Set(
    (catalog.models ?? [])
      .filter((m) => !m.missing && m.available !== false)
      .map((m) => m.key),
  );

  const listFromPriorityFile =
    priorityFile?.kinds?.[kind] ?? priorityFile?.kinds?.["default"] ?? [];

  const listFromClassificationConfig = (() => {
    const categories = classificationConfig?.categories ?? [];
    const cat = categories.find((c: any) => c?.id === kind && c?.enabled !== false);
    if (cat && Array.isArray((cat as any).models)) {
      return (cat as any).models as string[];
    }
    const fallbackId = classificationConfig?.defaultFallback ?? "fallback";
    const fb = categories.find((c: any) => c?.id === fallbackId && c?.enabled !== false);
    return Array.isArray((fb as any)?.models) ? ((fb as any).models as string[]) : [];
  })();

  const list = listFromClassificationConfig.length > 0 ? listFromClassificationConfig : listFromPriorityFile;

  for (const modelId of list) {
    if (!present.has(modelId)) continue;
    const provider = String(modelId).split("/")[0];
    const auth = providerAuth[provider] ?? "unknown";
    if (auth === "expired") continue; // user-confirmed behavior
    return { picked: modelId, note: `priority_pick kind=${kind} picked=${modelId} auth=${auth}` };
  }

  return { picked: undefined, note: `priority_pick kind=${kind} no-match` };
}

function listMissingManualTags(params: {
  catalog: ModelCatalog;
  tagsFile: ModelTagsFile | null;
}): Array<{ key: string; inferred: string[] }> {
  const known = new Set(Object.keys(params.tagsFile?.models ?? {}));
  const out: Array<{ key: string; inferred: string[] }> = [];
  for (const m of params.catalog.models ?? []) {
    if (!m.key) continue;
    if (m.missing) continue;
    if (known.has(m.key)) continue;
    out.push({ key: m.key, inferred: inferTagsFromCatalog(m) });
  }
  return out;
}

async function runOpenClawModelsStatusJson(timeoutMs: number): Promise<{ stdout: string; elapsedMs: number }> {
  const start = Date.now();
  // Attempt 1: rely on PATH resolution.
  try {
    const { stdout } = await execFileAsync(
      "openclaw",
      ["models", "status", "--json"],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    return { stdout: String(stdout ?? ""), elapsedMs: Date.now() - start };
  } catch {
    // Attempt 2 (fallback): use "node" from PATH and auto-detect openclaw.mjs path
    const { mjsPath, cwd } = await resolveOpenClawMjs();
    const { stdout } = await execFileAsync(
      "node",
      [mjsPath, "models", "status", "--json"],
      {
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
        cwd,
      },
    );
    return { stdout: String(stdout ?? ""), elapsedMs: Date.now() - start };
  }
}

async function probeAuthStatusCli(timeoutMs: number): Promise<AuthSnapshot> {
  const checkedAt = nowIso();
  const { stdout } = await runOpenClawModelsStatusJson(timeoutMs);

  const parsed = JSON.parse(String(stdout ?? "{}")) as any;
  const providers: AuthSnapshot["providers"] = {};

  // Current OpenClaw output shape (observed): auth.oauth.providers is an array of
  // { provider, remainingMs, status, ... }
  const oauthProviders = parsed?.auth?.oauth?.providers;
  if (Array.isArray(oauthProviders)) {
    for (const entry of oauthProviders) {
      const pid = entry?.provider;
      if (!pid) continue;
      const rem = typeof entry?.remainingMs === "number" ? entry.remainingMs : undefined;
      const auth: "ok" | "expired" | "unknown" =
        typeof rem === "number" ? (rem > 0 ? "ok" : "expired") : "unknown";
      providers[String(pid)] = { auth, remainingMs: rem };
    }
    return { providers, checkedAt };
  }

  // Fallback parsing: { providers: { <id>: { remainingMs }}} or a flat array.
  const rawProviders = parsed?.providers;
  if (rawProviders && typeof rawProviders === "object" && !Array.isArray(rawProviders)) {
    for (const [pid, v] of Object.entries(rawProviders as Record<string, any>)) {
      const rem = typeof v?.remainingMs === "number" ? v.remainingMs : undefined;
      const auth: "ok" | "expired" | "unknown" =
        typeof rem === "number" ? (rem > 0 ? "ok" : "expired") : "unknown";
      providers[String(pid)] = { auth, remainingMs: rem };
    }
    return { providers, checkedAt };
  }

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const pid = entry?.provider ?? entry?.id;
      if (!pid) continue;
      const rem = typeof entry?.remainingMs === "number" ? entry.remainingMs : undefined;
      const auth: "ok" | "expired" | "unknown" =
        typeof rem === "number" ? (rem > 0 ? "ok" : "expired") : "unknown";
      providers[String(pid)] = { auth, remainingMs: rem };
    }
  }

  return { providers, checkedAt };
}

async function runAuthProbeAndUpdateCache(params: {
  api: OpenClawPluginApi;
  ttlMs: number;
  timeoutMs: number;
}) {
  const snap = await probeAuthStatusCli(params.timeoutMs);
  authCache = {
    value: snap,
    expiresAtMs: Date.now() + params.ttlMs,
    lastOkAtMs: Date.now(),
  };
  return snap;
}

type AuthSnapshotResult = {
  snapshot: AuthSnapshot;
  source: "cache" | "probe";
  stale: boolean;
  cacheAgeMs?: number;
};

async function getAuthSnapshot(params: {
  api: OpenClawPluginApi;
  ttlMs: number;
  timeoutMs: number;
  asyncEnabled: boolean;
  maxStaleMs: number;
}): Promise<AuthSnapshotResult> {
  const now = Date.now();

  const cache = authCache;
  const cacheValid = Boolean(cache && cache.expiresAtMs > now);
  const cacheAgeMs = cache?.value?.checkedAt ? now - Date.parse(cache.value.checkedAt) : undefined;

  const ensureRefreshScheduled = () => {
    if (authProbeInFlight) {
      // observability: already refreshing
      (async () => {
        try {
          await appendJsonl(params.api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "availability_refresh_skip",
            reason: "in_flight",
          });
        } catch {
          // ignore
        }
      })();
      return;
    }

    (async () => {
      try {
        await appendJsonl(params.api, {
          ts: nowIso(),
          type: "soft_router_suggest",
          event: "availability_refresh_scheduled",
          ttlMs: params.ttlMs,
        });
      } catch {
        // ignore
      }
    })();

    authProbeInFlight = (async () => {
      const startMs = Date.now();
      try {
        await appendJsonl(params.api, {
          ts: nowIso(),
          type: "soft_router_suggest",
          event: "availability_refresh_start",
        });
      } catch {
        // ignore
      }

      try {
        const snap = await runAuthProbeAndUpdateCache({
          api: params.api,
          ttlMs: params.ttlMs,
          timeoutMs: params.timeoutMs,
        });
        try {
          await appendJsonl(params.api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "availability_refresh_ok",
            elapsedMs: Date.now() - startMs,
            providers: Object.keys(snap.providers ?? {}).length,
          });
        } catch {
          // ignore
        }
        return snap;
      } catch (err: any) {
        // Fail-open: keep old cache; just log error.
        try {
          await appendJsonl(params.api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "availability_probe_error",
            message: err instanceof Error ? err.message : String(err),
            code: err?.code,
            killed: err?.killed,
            signal: err?.signal,
            stderr: typeof err?.stderr === "string" ? err.stderr.slice(0, 500) : undefined,
          });
        } catch {
          // ignore
        }
        return authCache?.value ?? { providers: {}, checkedAt: nowIso() };
      } finally {
        authProbeInFlight = null;
      }
    })();
  };

  if (cacheValid) {
    return { snapshot: cache!.value, source: "cache", stale: false, cacheAgeMs };
  }

  if (params.asyncEnabled) {
    // Non-blocking: schedule refresh and immediately return cached/unknown snapshot.
    ensureRefreshScheduled();

    // If cache exists and is not too stale, return it with stale=true.
    if (cache) {
      const ageOk = params.maxStaleMs <= 0 ? false : now - cache.expiresAtMs <= params.maxStaleMs;
      if (ageOk) {
        return { snapshot: cache.value, source: "cache", stale: true, cacheAgeMs };
      }
    }

    return { snapshot: { providers: {}, checkedAt: nowIso() }, source: "cache", stale: true };
  }

  // Blocking mode (legacy): wait for probe.
  ensureRefreshScheduled();
  try {
    const snap = await authProbeInFlight;
    return { snapshot: snap, source: "probe", stale: false };
  } catch {
    const snap: AuthSnapshot = authCache?.value ?? { providers: {}, checkedAt: nowIso() };
    return { snapshot: snap, source: "cache", stale: true, cacheAgeMs };
  }
}

// Legacy classification config loader removed (fully converged to keyword-library routing).

/**
 * Classification (async)
 *
 * Fully converged routing:
 * - Weighted keyword library only (keyword-library.json + optional keyword-overrides.user.json)
 */
async function classifyDynamic(
  api: OpenClawPluginApi,
  content: string,
  metadata?: Record<string, unknown>
): Promise<Suggestion> {
  try {
    // NEW: weighted routing based on keyword library + user paste overrides.
    // Fail-open: any error falls back to the legacy classifier.
    // Note: resolveConfig is stable; we call it here to access keyword library paths.
    const cfgAny = resolveConfig(api);
    if (cfgAny.keywordCustomEnabled) {
      try {
        const { compiled, warnings } = await loadAndCompileRoutingRules({
          libraryPath: cfgAny.keywordLibraryPath,
          overridesPath: cfgAny.keywordOverridesPath,
        });

        const decision = routeByWeightedRules({
          rules: compiled,
          content,
          metadata,
          maxExplainTerms: 10,
        });

        // Per requirement: do NOT switch models lightly. Keep execution on gpt-5.2 by default.
        // The router still computes kind/confidence/explanations; model switching (if ever) is handled separately.
        const model = "local-proxy/gpt-5.2";

        const signals = [
          "weighted_keyword_library",
          ...decision.signals,
          ...(warnings.length ? ["keyword_library_warnings"] : []),
        ];

        return {
          kind: decision.kind,
          model,
          reason: decision.reason + (warnings.length ? ` (warnings=${warnings.length})` : ""),
          signals,
          confidence: decision.confidence,
        };
      } catch (err) {
        // Fully converged: do not fall back to legacy classifier.
        return {
          kind: "fallback",
          model: "local-proxy/gpt-5.2",
          reason: `Keyword-library classification error: ${err instanceof Error ? err.message : String(err)}`,
          signals: ["error_fallback", "weighted_keyword_library"],
          confidence: "low",
        };
      }
    }

    // Fully converged: keyword routing is required; if disabled, we still do not load legacy rules.
    return {
      kind: "fallback",
      model: "local-proxy/gpt-5.2",
      reason: "Keyword-library routing disabled (keywordCustomEnabled=false); using fallback.",
      signals: ["fallback:keyword_routing_disabled"],
      confidence: "low",
    };
  } catch (err) {
    return {
      kind: "fallback",
      model: "local-proxy/gpt-5.2",
      reason: `Classification error: ${err instanceof Error ? err.message : String(err)}`,
      signals: ["error_fallback"],
      confidence: "low",
    };
  }
}

function pickFallbackModel(kind: Suggestion["kind"]) {
  // Keep it simple and reliable: always use gpt-5.2 as the hard fallback.
  return "local-proxy/gpt-5.2";
}

async function computeAvailability(params: {
  api: OpenClawPluginApi;
  suggestion: Suggestion;
  cfg: ReturnType<typeof resolveConfig>;
}): Promise<Availability> {
  const checkedAt = nowIso();
  const provider = providerFromModel(params.suggestion.model);

  if (params.cfg.availabilityMode === "cli") {
    const { snapshot, source, stale, cacheAgeMs } = await getAuthSnapshot({
      api: params.api,
      ttlMs: params.cfg.availabilityTtlMs,
      timeoutMs: params.cfg.availabilityCmdTimeoutMs,
      asyncEnabled: params.cfg.availabilityAsyncEnabled,
      maxStaleMs: params.cfg.availabilityMaxStaleMs,
    });
    const providerInfo = snapshot.providers[provider];
    const auth = providerInfo?.auth ?? "unknown";
    const status = auth === "expired" ? "degraded" : auth === "ok" ? "ok" : "unknown";
    const note =
      auth === "expired"
        ? `Auth appears expired for provider "${provider}"; suggested model may fail. Consider fallback.`
        : undefined;
    return {
      status,
      auth,
      source,
      checkedAt,
      ttlMs: params.cfg.availabilityTtlMs,
      stale,
      cacheAgeMs,
      note,
    };
  }

  // static mode: no CLI. Only emit cautious hints.
  let note: string | undefined;
  let status: Availability["status"] = "unknown";

  if (provider === "openai-codex") {
    status = "ok";
  }
  if (provider === "qwen-portal") {
    note = `Provider "${provider}" may require valid auth; availability not probed (static mode).`;
  }

  return {
    status,
    auth: "unknown",
    source: "static",
    checkedAt,
    ttlMs: params.cfg.availabilityTtlMs,
    note,
  };
}

function preview(text: string, n: number) {
  const t = (text ?? "").replace(/\r\n/g, "\n");
  if (t.length <= n) return t;
  return t.slice(0, n) + `... (+${t.length - n} chars)`;
}

type Availability = {
  status: "ok" | "degraded" | "unknown";
  auth?: "ok" | "expired" | "unknown";
  source: "static" | "cache" | "probe";
  checkedAt: string;
  ttlMs: number;
  stale?: boolean;
  cacheAgeMs?: number;
  note?: string;
};

type FallbackSuggestion = {
  model: string;
  reason: string;
};

type Suggestion = {
  kind: string; // 9 kinds from keyword-library.json
  model: string;
  reason: string;
  signals: string[];
  confidence: Confidence;
  availability?: Availability;
  fallback?: FallbackSuggestion;
};

type RuntimeRoutingConfig = {
  taskModeEnabled: boolean;
  taskModePrimaryKind: string;
  taskModeKinds: string[];
  taskModeDisabledKinds: string[];
  taskModeMinConfidence: Confidence;
  taskModeReturnToPrimary: boolean;
  taskModeReturnModel: string;
  taskModeAllowAutoDowngrade: boolean;
  freeSwitchWhenTaskModeOff: boolean;
};

async function appendJsonl(api: OpenClawPluginApi, obj: unknown) {
  const cfg = resolveConfig(api);
  if (!cfg.enabled) return;

  const logDir = cfg.logDir;
  const logPath = path.join(logDir, cfg.logFile);

  await fs.mkdir(logDir, { recursive: true });

  // Rotate before appending (best-effort).
  try {
    await maybeRotate(logPath, cfg.maxBytes, cfg.rotateCount);
  } catch {
    // ignore
  }

  // Final sink-level dedup: suppress near-duplicate model_override writes regardless of source path.
  try {
    const cur: any = obj as any;
    if (cur?.type === "soft_router_suggest" && cur?.event === "model_override") {
      const tailBuf = await fs.readFile(logPath, "utf8").catch(() => "");
      if (tailBuf) {
        const lines = tailBuf.trimEnd().split(/\r?\n/);
        const lastLine = lines.length ? lines[lines.length - 1] : "";
        if (lastLine) {
          const prev: any = JSON.parse(lastLine);
          if (prev?.type === "soft_router_suggest" && prev?.event === "model_override") {
            const sameSession = String(prev?.sessionKey ?? "") === String(cur?.sessionKey ?? "");
            const samePicked = String(prev?.picked ?? "") === String(cur?.picked ?? "");
            const t1 = Date.parse(String(prev?.ts ?? ""));
            const t2 = Date.parse(String(cur?.ts ?? ""));
            const close = Number.isFinite(t1) && Number.isFinite(t2) ? Math.abs(t2 - t1) < 1500 : false;
            if (sameSession && samePicked && close) return;
          }
        }
      }
    }
  } catch {
    // fail-open
  }

  await fs.appendFile(logPath, JSON.stringify(obj) + "\n", "utf8");
}

// Dedup map (in-memory, per process).
const recentOverrides = new Map<string, number>();
const routingSessionStore = new RoutingSessionStore();
const ROUTE_DECISION_TTL_MS = 90_000;
const RUNTIME_ROUTING_TTL_MS = 5_000;
const LONG_TASK_KINDS = new Set(["strategy", "coding", "vision"]);
let runtimeRoutingCache: { value: RuntimeRoutingConfig; expiresAtMs: number } | null = null;

async function shouldLogModelOverride(
  cfg: { logDir: string },
  sessionKey: string,
  pickedModel: string,
) {
  const memKey = `${sessionKey}:${pickedModel}`;
  const now = Date.now();

  // In-process check
  const last = recentOverrides.get(memKey);
  if (last && now - last < 1000) return false;

  // Cross-process atomic lock (1-second bucket)
  try {
    const baseDir = cfg.logDir && cfg.logDir.trim() ? cfg.logDir : os.tmpdir();
    const dedupDir = path.join(baseDir, ".dedup");
    await fs.mkdir(dedupDir, { recursive: true });

    const secondBucket = Math.floor(now / 1000);
    const hash = crypto.createHash("sha1").update(memKey).digest("hex");
    const marker = path.join(dedupDir, `soft-router-model-override-${hash}-${secondBucket}.lock`);

    try {
      await fs.writeFile(marker, String(now), { encoding: "utf8", flag: "wx" });
    } catch (e: any) {
      if (String((e as any)?.code) === "EEXIST") return false;
    }
  } catch {
    // fail-open
  }

  recentOverrides.set(memKey, now);
  return true;
}

function getRuntimeRoutingPath(): string {
  return path.join(getDefaultToolsDir(), "runtime-routing.json");
}

function getDefaultRuntimeRoutingConfig(cfg: ReturnType<typeof resolveConfig>): RuntimeRoutingConfig {
  const taskKinds = Array.from(
    new Set([cfg.taskModePrimaryKind, ...(cfg.taskModeKinds ?? [])].filter((value) => String(value ?? "").trim())),
  );
  return {
    taskModeEnabled: cfg.taskModeEnabled,
    taskModePrimaryKind: cfg.taskModePrimaryKind,
    taskModeKinds: taskKinds.length > 0 ? taskKinds : [DEFAULTS.taskModePrimaryKind],
    taskModeDisabledKinds: [],
    taskModeMinConfidence: cfg.taskModeMinConfidence,
    taskModeReturnToPrimary: cfg.taskModeReturnToPrimary,
    taskModeReturnModel: cfg.taskModeReturnModel,
    taskModeAllowAutoDowngrade: cfg.taskModeAllowAutoDowngrade,
    freeSwitchWhenTaskModeOff: cfg.freeSwitchWhenTaskModeOff,
  };
}

async function getRuntimeRoutingConfig(api: OpenClawPluginApi): Promise<RuntimeRoutingConfig> {
  const now = Date.now();
  if (runtimeRoutingCache && runtimeRoutingCache.expiresAtMs > now) {
    return runtimeRoutingCache.value;
  }

  const cfg = resolveConfig(api);
  const defaults = getDefaultRuntimeRoutingConfig(cfg);
  const runtimePath = getRuntimeRoutingPath();
  const raw = await loadJsonFile<Record<string, unknown>>(runtimePath);

  const taskModePrimaryKind =
    typeof raw?.taskModePrimaryKind === "string" && raw.taskModePrimaryKind.trim()
      ? raw.taskModePrimaryKind.trim().toLowerCase() === "chat"
        ? defaults.taskModePrimaryKind
        : raw.taskModePrimaryKind.trim()
      : defaults.taskModePrimaryKind;
  const taskModeKinds = Array.isArray(raw?.taskModeKinds)
    ? Array.from(
        new Set(
          raw.taskModeKinds
            .map((value) => String(value ?? "").trim().toLowerCase())
            .filter((value) => value.length > 0 && value !== "chat"),
        ),
      )
    : defaults.taskModeKinds;
  const taskModeReturnModel =
    typeof raw?.taskModeReturnModel === "string" && raw.taskModeReturnModel.trim()
      ? raw.taskModeReturnModel.trim()
      : defaults.taskModeReturnModel;
  const taskModeDisabledKinds = Array.isArray(raw?.taskModeDisabledKinds)
    ? Array.from(
        new Set(
          raw.taskModeDisabledKinds
            .map((value) => String(value ?? "").trim().toLowerCase())
            .filter((value) => value.length > 0 && value !== "chat"),
        ),
      )
    : defaults.taskModeDisabledKinds;

  const value: RuntimeRoutingConfig = {
    taskModeEnabled:
      typeof raw?.taskModeEnabled === "boolean" ? raw.taskModeEnabled : defaults.taskModeEnabled,
    taskModePrimaryKind,
    taskModeKinds:
      taskModeKinds.length > 0
        ? Array.from(new Set([taskModePrimaryKind, ...taskModeKinds]))
        : defaults.taskModeKinds,
    taskModeDisabledKinds: taskModeDisabledKinds.filter((kind) => kind !== taskModePrimaryKind),
    taskModeMinConfidence: getEffectiveTaskModeMinConfidence(
      raw?.taskModeMinConfidence === "low" ||
      raw?.taskModeMinConfidence === "medium" ||
      raw?.taskModeMinConfidence === "high"
        ? raw.taskModeMinConfidence
        : defaults.taskModeMinConfidence,
    ),
    taskModeReturnToPrimary: true,
    taskModeReturnModel,
    taskModeAllowAutoDowngrade:
      typeof raw?.taskModeAllowAutoDowngrade === "boolean"
        ? raw.taskModeAllowAutoDowngrade
        : defaults.taskModeAllowAutoDowngrade,
    freeSwitchWhenTaskModeOff:
      typeof raw?.freeSwitchWhenTaskModeOff === "boolean"
        ? raw.freeSwitchWhenTaskModeOff
        : defaults.freeSwitchWhenTaskModeOff,
  };

  runtimeRoutingCache = { value, expiresAtMs: now + RUNTIME_ROUTING_TTL_MS };
  return value;
}

function pruneExpiredRouteDecisions(now = Date.now()) {
  routingSessionStore.pruneExpiredRouteDecisions(now);
}

function confidenceRank(c: string): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

function resolveRouteSessionKeyFromMessageContext(
  ctx: PluginHookMessageContext,
  event: PluginHookMessageReceivedEvent,
): string {
  return resolveRouteSessionKey(ctx as any, event as any);
}

function resolveRouteSessionIdentityFromMessageContext(
  ctx: PluginHookMessageContext,
  event: PluginHookMessageReceivedEvent,
) {
  return resolveRouteSessionIdentity(ctx as any, event as any);
}

function getRuntimeRouteSessionAliasesForMessageContext(
  ctx: PluginHookMessageContext,
  event: PluginHookMessageReceivedEvent,
  routeSessionKey: string,
): string[] {
  const aliases = new Set<string>();
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const provider = String(metadata.provider ?? ctx.channelId ?? "").trim();
  const surface = String(metadata.surface ?? "").trim();

  // webchat direct + main agent: runtime side sessionKey is typically "agent:main:main".
  // Keep this bridge very narrow: only when message-side identity already degraded to fallback:webchat:*.
  // We intentionally do NOT require surface to match; some webchat events omit it or use other labels.
  if (routeSessionKey.startsWith("fallback:webchat:") && provider === "webchat") {
    aliases.add("agent:main:main");
  }

  return Array.from(aliases);
}

function canonicalModelForms(model: string): string[] {
  const raw = String(model ?? "").trim();
  if (!raw) return [];
  const normalized = normalizeModelOverrideForProvider(raw).override;
  return Array.from(new Set([raw.toLowerCase(), normalized.toLowerCase()]));
}

function areModelsEquivalent(a: string, b: string): boolean {
  const left = canonicalModelForms(a);
  const right = new Set(canonicalModelForms(b));
  return left.some((value) => right.has(value));
}

async function buildRuntimeRouteDecision(params: {
  api: OpenClawPluginApi;
  prompt: string;
  sessionKey: string;
  conversationId?: string;
  channelId?: string;
  messageHash: string;
  source: RouteDecision['source'];
}): Promise<RouteDecision> {
  const suggestion = await classifyDynamic(params.api, params.prompt, undefined);
  const now = Date.now();
  return {
    sessionKey: params.sessionKey,
    conversationId: params.conversationId,
    channelId: params.channelId,
    messageId: undefined,
    messageHash: params.messageHash,
    contentPreview: preview(params.prompt, 120),
    kind: suggestion.kind,
    confidence: suggestion.confidence,
    candidateModel: suggestion.model,
    reason: suggestion.reason,
    signals: Array.isArray(suggestion.signals) ? suggestion.signals : [],
    createdAtMs: now,
    expiresAtMs: now + ROUTE_DECISION_TTL_MS,
    source: params.source,
  };
}

function getPriorityListForKind(priorityFile: ModelPriorityFile | null, kind: string): string[] {
  if (!priorityFile?.kinds) return [];
  const direct = Array.isArray(priorityFile.kinds[kind]) ? priorityFile.kinds[kind] : [];
  const fallback = Array.isArray(priorityFile.kinds.default) ? priorityFile.kinds.default : [];
  return direct.length > 0 ? direct : fallback;
}

function getPriorityRankForKind(
  priorityFile: ModelPriorityFile | null,
  kind: string,
  model: string,
): number | null {
  const list = getPriorityListForKind(priorityFile, kind);
  if (list.length <= 0) return null;
  const idx = list.findIndex((entry) => areModelsEquivalent(entry, model));
  return idx >= 0 ? idx : null;
}

async function resolvePreferredModelForKind(params: {
  api: OpenClawPluginApi;
  cfg: ReturnType<typeof resolveConfig>;
  kind: string;
  fallbackModel: string;
}): Promise<{ model: string; note: string; source: "priority" | "fallback" }> {
  try {
    const priorityFile = await loadJsonFile<ModelPriorityFile>(params.cfg.modelPriorityPath);
    const catalog = await getModelCatalog(params.api, params.cfg);
    const providerAuth = buildProviderAuthMapFromSnapshot(authCache?.value ?? null);
    const picked = pickByPriority({
      kind: params.kind,
      catalog,
      priorityFile,
      classificationConfig: null as any,
      providerAuth,
    } as any);

    if (picked.picked) {
      return { model: picked.picked, note: picked.note, source: "priority" };
    }
  } catch {
    // fail-open to fallback model below
  }

  return {
    model: params.fallbackModel,
    note: `fallback_primary kind=${params.kind} model=${params.fallbackModel}`,
    source: "fallback",
  };
}

function isConservativeLikelyDowngradeCandidate(model: string): boolean {
  const normalized = normalizeModelOverrideForProvider(model).override.toLowerCase();
  return normalized.includes("gpt-5.2");
}

async function shouldPreventAutomaticDowngrade(params: {
  api: OpenClawPluginApi;
  cfg: ReturnType<typeof resolveConfig>;
  kind: string;
  primaryModel: string;
  candidateModel: string;
  allowAutoDowngrade: boolean;
}): Promise<boolean> {
  if (params.allowAutoDowngrade) return false;
  if (areModelsEquivalent(params.primaryModel, params.candidateModel)) return false;

  try {
    const priorityFile = await loadJsonFile<ModelPriorityFile>(params.cfg.modelPriorityPath);
    const primaryRank = getPriorityRankForKind(priorityFile, params.kind, params.primaryModel);
    const candidateRank = getPriorityRankForKind(priorityFile, params.kind, params.candidateModel);
    if (primaryRank !== null && candidateRank !== null) {
      return candidateRank > primaryRank;
    }
  } catch {
    // fall through to conservative guard
  }

  return isConservativeLikelyDowngradeCandidate(params.candidateModel);
}

function isLongTaskKind(kind: string): boolean {
  return LONG_TASK_KINDS.has(String(kind ?? "").trim().toLowerCase());
}

function getEffectiveTaskModeMinConfidence(
  confidence: RuntimeRoutingConfig["taskModeMinConfidence"],
): RuntimeRoutingConfig["taskModeMinConfidence"] {
  return confidence === "high" ? "high" : "medium";
}

function isTaskModeKind(kind: string, runtimeCfg: RuntimeRoutingConfig): boolean {
  const normalized = String(kind ?? "").trim().toLowerCase();
  if (!normalized || normalized === "chat") return false;
  const enabled = runtimeCfg.taskModeKinds.some((value) => value.toLowerCase() === normalized);
  const disabled = runtimeCfg.taskModeDisabledKinds.some((value) => value.toLowerCase() === normalized);
  return enabled && !disabled;
}

async function getTaskPrimaryModelForSession(
  api: OpenClawPluginApi,
  cfg: ReturnType<typeof resolveConfig>,
  runtimeCfg: RuntimeRoutingConfig,
  decision: RouteDecision,
  existing?: TaskSessionState,
): Promise<{ primaryKind: string; primaryModel: string; note: string; source: "priority" | "fallback" | "existing" }> {
  if (existing?.primaryKind && existing?.primaryModel) {
    const resolved = await resolvePreferredModelForKind({
      api,
      cfg,
      kind: existing.primaryKind,
      fallbackModel: existing.primaryModel,
    });
    return {
      primaryKind: existing.primaryKind,
      primaryModel: resolved.model,
      note: resolved.note,
      source: resolved.source === "priority" && !areModelsEquivalent(resolved.model, existing.primaryModel)
        ? "priority"
        : "existing",
    };
  }

  const primaryKind = isTaskModeKind(decision.kind, runtimeCfg)
    ? decision.kind
    : runtimeCfg.taskModePrimaryKind;
  const resolved = await resolvePreferredModelForKind({
    api,
    cfg,
    kind: primaryKind,
    fallbackModel: decision.candidateModel,
  });
  return {
    primaryKind,
    primaryModel: resolved.model,
    note: resolved.note,
    source: resolved.source,
  };
}

export default function register(api: OpenClawPluginApi) {
  // Immediate marker: proves the plugin was loaded and register() ran.
  // (Does not rely on any hooks being fired.)
  (async () => {
    try {
      await appendJsonl(api, {
        ts: nowIso(),
        type: "soft_router_suggest",
        event: "plugin_register",
        pluginId: api.id,
        version: api.version ?? "unknown",
      });

      const raw = getRawConfig(api);
      await appendJsonl(api, {
        ts: nowIso(),
        type: "soft_router_suggest",
        event: "config_snapshot",
        pluginId: api.id,
        version: api.version ?? "unknown",
        configSource: raw.source,
        configKeys: raw.keys,
        hasPluginConfig: Boolean((api as any).pluginConfig),
        note: "For safety this logs keys only (no values).",
      });
    } catch {
      // fail-open
    }
  })();

  // Startup marker (hook-based; may depend on the gateway calling this hook)
  api.on("gateway_start", async () => {
    try {
      await appendJsonl(api, {
        ts: nowIso(),
        type: "soft_router_suggest",
        event: "gateway_start",
        pluginId: api.id,
        version: api.version ?? "unknown",
      });
    } catch {
      // fail-open
    }
  });

  api.on(
    "before_agent_start",
    async (
      event: PluginHookBeforeAgentStartEvent,
      ctx,
    ): Promise<PluginHookBeforeAgentStartResult | void> => {
      try {
        const cfg = resolveConfig(api);
        if (!cfg.enabled || !cfg.ruleEngineEnabled || !cfg.switchingEnabled) return;

        pruneExpiredRouteDecisions();

        const promptText = String(event.prompt ?? "");
        const ctxAny = ctx as any;
        const runtimeIdentity = resolveRuntimeRouteSessionIdentity({
          sessionKey: ctxAny?.sessionKey,
          sessionId: ctxAny?.sessionId,
          threadId: ctxAny?.threadId,
          thread_id: ctxAny?.thread_id,
          conversationId: ctxAny?.conversationId ?? ctx.conversationId,
          chatId: ctxAny?.chatId,
          chat_id: ctxAny?.chat_id,
          channelId: ctx.channelId,
          accountId: ctx.accountId,
          messageProvider: ctxAny?.messageProvider,
        });
        const sessionKey = runtimeIdentity.key;
        const runtimeMessageHash = computeRuntimeMessageHash({
          prompt: promptText,
          messages: event.messages,
        });
        const promptHash = runtimeMessageHash.hash;
        const agentId = ctxAny?.agentId;
        const runtimeCfg = await getRuntimeRoutingConfig(api);

        const attemptedConversationId =
          String(ctxAny?.conversationId ?? ctx.conversationId ?? "").trim() || undefined;
        const match = routingSessionStore.findRouteDecisionMatch({
          sessionKey,
          conversationId: attemptedConversationId,
          messageHash: promptHash,
        });
        let decision = match.decision;
        let trust = getRouteTrustDecision({
          matchSource: match.source,
          runtimeIdentitySource: runtimeIdentity.source,
          decision,
        });
        const taskModeActive = Boolean(runtimeCfg.taskModeEnabled);

        if (!decision && taskModeActive) {
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_cache_miss",
            pid: process.pid,
            dryRun: true,
            sessionKey,
            attemptedConversationId,
            attemptedMessageHash: promptHash,
            attemptedMessageHashSource: runtimeMessageHash.source,
            agentId,
            matchSource: match.source,
            runtimeIdentitySource: runtimeIdentity.source,
            trustLevel: trust.level,
            trustReason: trust.reason,
            taskModeEnabled: runtimeCfg.taskModeEnabled,
          });

          decision = await buildRuntimeRouteDecision({
            api,
            prompt: promptText,
            sessionKey,
            conversationId: attemptedConversationId,
            channelId: ctx.channelId,
            messageHash: promptHash,
            source: "before_agent_start",
          });
          trust = { trusted: true, level: "direct", reason: "task_mode_runtime_classification" };

          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_runtime_classified",
            pid: process.pid,
            dryRun: true,
            sessionKey,
            attemptedConversationId,
            attemptedMessageHash: promptHash,
            attemptedMessageHashSource: runtimeMessageHash.source,
            agentId,
            kind: decision.kind,
            confidence: decision.confidence,
            candidateModel: decision.candidateModel,
            taskModeEnabled: runtimeCfg.taskModeEnabled,
          });
        }

        if (!decision) {
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_cache_miss",
            pid: process.pid,
            dryRun: true,
            sessionKey,
            attemptedConversationId,
            attemptedMessageHash: promptHash,
            attemptedMessageHashSource: runtimeMessageHash.source,
            agentId,
            matchSource: match.source,
            runtimeIdentitySource: runtimeIdentity.source,
            trustLevel: trust.level,
            trustReason: trust.reason,
            taskModeEnabled: runtimeCfg.taskModeEnabled,
          });
          return;
        }

        if (decision.expiresAtMs <= Date.now()) {
          routingSessionStore.clearRouteDecision(decision.sessionKey);
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_cache_expired",
            pid: process.pid,
            dryRun: true,
            sessionKey,
            matchedSessionKey: match.matchedSessionKey,
            attemptedConversationId,
            attemptedMessageHash: promptHash,
            attemptedMessageHashSource: runtimeMessageHash.source,
            agentId,
            matchSource: match.source,
            runtimeIdentitySource: runtimeIdentity.source,
            trustLevel: trust.level,
            trustReason: trust.reason,
            messageHash: decision.messageHash,
          });
          return;
        }

        if (!trust.trusted) {
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_cache_untrusted",
            pid: process.pid,
            dryRun: true,
            sessionKey,
            matchedSessionKey: match.matchedSessionKey,
            attemptedConversationId,
            attemptedMessageHash: promptHash,
            attemptedMessageHashSource: runtimeMessageHash.source,
            agentId,
            matchSource: match.source,
            runtimeIdentitySource: runtimeIdentity.source,
            trustLevel: trust.level,
            trustReason: trust.reason,
            kind: decision.kind,
            confidence: decision.confidence,
            candidateModel: decision.candidateModel,
            messageHash: decision.messageHash,
          });
          return;
        }

        const effectiveSessionKey = match.matchedSessionKey ?? decision.sessionKey ?? sessionKey;

        await appendJsonl(api, {
          ts: nowIso(),
          type: "soft_router_suggest",
          event: "route_cache_hit",
          pid: process.pid,
          dryRun: true,
          sessionKey: effectiveSessionKey,
          runtimeSessionKey: sessionKey,
          matchedSessionKey: match.matchedSessionKey,
          attemptedConversationId,
          attemptedMessageHash: promptHash,
          attemptedMessageHashSource: runtimeMessageHash.source,
          agentId,
          matchSource: match.source,
          runtimeIdentitySource: runtimeIdentity.source,
          trustLevel: trust.level,
          trustReason: trust.reason,
          kind: decision.kind,
          confidence: decision.confidence,
          candidateModel: decision.candidateModel,
          messageHash: decision.messageHash,
        });

        let targetModel = decision.candidateModel;
        let targetKind = decision.kind;
        let logEvent = "route_override_applied";
        let logNote = decision.reason;
        const existingTaskState = routingSessionStore.getTaskState(effectiveSessionKey);

        if (runtimeCfg.taskModeEnabled) {
          const primary = await getTaskPrimaryModelForSession(api, cfg, runtimeCfg, decision, existingTaskState);
          let nextTaskState: TaskSessionState = existingTaskState ?? {
            sessionKey,
            primaryKind: primary.primaryKind,
            primaryModel: primary.primaryModel,
            lastTaskAt: Date.now(),
            lastRouteAt: Date.now(),
          };

          const primaryChanged =
            !existingTaskState ||
            existingTaskState.primaryKind !== primary.primaryKind ||
            !areModelsEquivalent(existingTaskState.primaryModel, primary.primaryModel);

          nextTaskState = {
            ...nextTaskState,
            primaryKind: primary.primaryKind,
            primaryModel: primary.primaryModel,
          };
          routingSessionStore.setTaskState(effectiveSessionKey, nextTaskState);

          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: primaryChanged
              ? existingTaskState
                ? "task_mode_primary_refreshed"
                : "task_mode_primary_resolved"
              : "task_mode_primary_kept",
            dryRun: true,
            sessionKey: effectiveSessionKey,
            runtimeSessionKey: sessionKey,
            matchSource: match.source,
            agentId,
            primaryKind: nextTaskState.primaryKind,
            primaryModel: nextTaskState.primaryModel,
            sourceKind: decision.kind,
            sourceModel: decision.candidateModel,
            note: primary.note,
          });

          const qualifiesAsTask =
            isTaskModeKind(decision.kind, runtimeCfg) &&
            confidenceRank(decision.confidence) >=
              confidenceRank(getEffectiveTaskModeMinConfidence(runtimeCfg.taskModeMinConfidence));

          if (qualifiesAsTask) {
            const wantsTemporary = decision.kind !== nextTaskState.primaryKind;
            if (
              wantsTemporary &&
              (await shouldPreventAutomaticDowngrade({
                api,
                cfg,
                kind: nextTaskState.primaryKind,
                primaryModel: nextTaskState.primaryModel,
                candidateModel: decision.candidateModel,
                allowAutoDowngrade: runtimeCfg.taskModeAllowAutoDowngrade,
              }))
            ) {
              routingSessionStore.clearRouteDecision(effectiveSessionKey);
              routingSessionStore.setTaskState(effectiveSessionKey, {
                ...nextTaskState,
                temporaryKind: undefined,
                temporaryModel: undefined,
                lastRouteAt: Date.now(),
              });
              await appendJsonl(api, {
                ts: nowIso(),
                type: "soft_router_suggest",
                event: "task_mode_downgrade_blocked",
                pid: process.pid,
                dryRun: true,
                sessionKey: effectiveSessionKey,
                runtimeSessionKey: sessionKey,
                matchSource: match.source,
                agentId,
                promptHash,
                kind: decision.kind,
                confidence: decision.confidence,
                candidateModel: decision.candidateModel,
                primaryModel: nextTaskState.primaryModel,
                primaryKind: nextTaskState.primaryKind,
              });
              return;
            }

            nextTaskState = {
              ...nextTaskState,
              temporaryKind: wantsTemporary ? decision.kind : undefined,
              temporaryModel: wantsTemporary ? decision.candidateModel : undefined,
              lastTaskAt: Date.now(),
              lastRouteAt: Date.now(),
            };

            if (nextTaskState.temporaryModel && !areModelsEquivalent(nextTaskState.temporaryModel, nextTaskState.primaryModel)) {
              targetModel = nextTaskState.temporaryModel;
              targetKind = nextTaskState.temporaryKind ?? decision.kind;
              if (String(targetKind ?? "").trim().toLowerCase() === "chat") {
                targetKind = nextTaskState.primaryKind;
                targetModel = nextTaskState.primaryModel;
                nextTaskState = {
                  ...nextTaskState,
                  temporaryKind: undefined,
                  temporaryModel: undefined,
                  lastRouteAt: Date.now(),
                };
                logEvent = "task_mode_primary_kept";
                logNote = `task mode blocked chat fallback and kept primary ${nextTaskState.primaryKind}(${nextTaskState.primaryModel})`;
              } else {
                logEvent = "task_mode_temp_override_applied";
                logNote = `task mode temporary override from ${nextTaskState.primaryKind}(${nextTaskState.primaryModel}) to ${targetKind}(${targetModel})`;
              }
            } else {
              targetModel = nextTaskState.primaryModel;
              targetKind = nextTaskState.primaryKind;
              logEvent = "task_mode_primary_kept";
              logNote = `task mode keep primary ${nextTaskState.primaryKind}(${nextTaskState.primaryModel})`;
            }

            routingSessionStore.setTaskState(effectiveSessionKey, nextTaskState);
          } else {
            const hadTemporaryModel = Boolean(existingTaskState?.temporaryModel);
            const explicitReturnModel = runtimeCfg.taskModeReturnModel.trim();
            const returnModel = explicitReturnModel || nextTaskState.primaryModel;
            if (returnModel) {
              targetModel = returnModel;
              targetKind = nextTaskState.primaryKind;
              logEvent = hadTemporaryModel ? "task_mode_return_to_primary" : "task_mode_primary_kept";
              logNote = hadTemporaryModel
                ? `task mode return to ${returnModel} for ${nextTaskState.primaryKind}; min=${getEffectiveTaskModeMinConfidence(runtimeCfg.taskModeMinConfidence)} no_chat_fallback=on`
                : `task mode keep return model ${returnModel} for ${nextTaskState.primaryKind}; min=${getEffectiveTaskModeMinConfidence(runtimeCfg.taskModeMinConfidence)} no_chat_fallback=on`;
              routingSessionStore.setTaskState(effectiveSessionKey, {
                ...nextTaskState,
                temporaryKind: undefined,
                temporaryModel: undefined,
                lastRouteAt: Date.now(),
              });
            } else {
              routingSessionStore.clearRouteDecision(effectiveSessionKey);
              await appendJsonl(api, {
                ts: nowIso(),
                type: "soft_router_suggest",
                event: "route_override_skipped_non_long_task",
                pid: process.pid,
                dryRun: true,
                sessionKey: effectiveSessionKey,
                runtimeSessionKey: sessionKey,
                matchSource: match.source,
                agentId,
                promptHash,
                kind: decision.kind,
                confidence: decision.confidence,
                candidateModel: decision.candidateModel,
              });
              return;
            }
          }
        } else {
          if (!isLongTaskKind(decision.kind)) {
            routingSessionStore.clearRouteDecision(effectiveSessionKey);
            await appendJsonl(api, {
              ts: nowIso(),
              type: "soft_router_suggest",
              event: "route_override_skipped_non_long_task",
              pid: process.pid,
              dryRun: true,
              sessionKey: effectiveSessionKey,
              runtimeSessionKey: sessionKey,
              matchSource: match.source,
              agentId,
              promptHash,
              kind: decision.kind,
              confidence: decision.confidence,
              candidateModel: decision.candidateModel,
            });
            return;
          }

          if (confidenceRank(decision.confidence) < confidenceRank("medium")) {
            routingSessionStore.clearRouteDecision(effectiveSessionKey);
            await appendJsonl(api, {
              ts: nowIso(),
              type: "soft_router_suggest",
              event: "route_override_skipped_low_confidence",
              pid: process.pid,
              dryRun: true,
              sessionKey: effectiveSessionKey,
              runtimeSessionKey: sessionKey,
              matchSource: match.source,
              agentId,
              promptHash,
              kind: decision.kind,
              confidence: decision.confidence,
              candidateModel: decision.candidateModel,
              minConfidence: "medium",
            });
            return;
          }

          if (isConservativeLikelyDowngradeCandidate(decision.candidateModel)) {
            routingSessionStore.clearRouteDecision(effectiveSessionKey);
            await appendJsonl(api, {
              ts: nowIso(),
              type: "soft_router_suggest",
              event: "route_override_skipped_downgrade_guard",
              pid: process.pid,
              dryRun: true,
              sessionKey: effectiveSessionKey,
              runtimeSessionKey: sessionKey,
              matchSource: match.source,
              agentId,
              promptHash,
              kind: decision.kind,
              confidence: decision.confidence,
              candidateModel: decision.candidateModel,
            });
            return;
          }
        }

        const okToLog = await shouldLogModelOverride({ logDir: cfg.logDir }, effectiveSessionKey, targetModel);
        const norm = normalizeModelOverrideForProvider(targetModel);

        if (okToLog) {
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: logEvent,
            pid: process.pid,
            dryRun: false,
            sessionKey: effectiveSessionKey,
            runtimeSessionKey: sessionKey,
            matchSource: match.source,
            agentId,
            promptHash,
            messageHash: decision.messageHash,
            kind: targetKind,
            confidence: decision.confidence,
            picked: targetModel,
            normalizedPicked: norm.override,
            note: logNote,
          });
        }

        routingSessionStore.clearRouteDecision(effectiveSessionKey);

        try {
          if (norm.normalizedFrom) {
            console.log(
              `[soft-router-suggest] route_override_normalized from=${norm.normalizedFrom} to=${norm.override} sessionKey=${effectiveSessionKey} runtimeSessionKey=${sessionKey} matchSource=${match.source}`,
            );
          }
          console.log(
            `[soft-router-suggest] route_override sessionKey=${effectiveSessionKey} runtimeSessionKey=${sessionKey} matchSource=${match.source} agentId=${String(
              agentId ?? "",
            )} kind=${targetKind} confidence=${decision.confidence} picked=${targetModel} promptHash=${promptHash}`,
          );
        } catch {
          // ignore
        }

        return { modelOverride: norm.override };
      } catch {
        return;
      }
    },
  );

  api.on(
    "message_received",
    async (event: PluginHookMessageReceivedEvent, ctx: PluginHookMessageContext) => {
      try {
        pruneExpiredRouteDecisions();

        const suggestion = await classifyDynamic(api, event.content, event.metadata);
        const cfg = resolveConfig(api);
        const messageIdentity = resolveRouteSessionIdentityFromMessageContext(ctx, event);
        const routeSessionKey = messageIdentity.key;
        const runtimeCfg = await getRuntimeRoutingConfig(api);
        // Message-driven routing cache is still useful for manual chats.
        // Task-mode-only special handling applies to auto tasks (cache miss path in before_agent_start).
        const messageMetadata = (event.metadata ?? {}) as Record<string, unknown>;
        const rawMessageId = messageMetadata.messageId ?? messageMetadata.message_id ?? messageMetadata.id;
        const messageId = typeof rawMessageId === "string" ? rawMessageId : undefined;
        const messageHash = computeShortHash(String(event.content ?? "").trim());
        const runtimeSessionAliases = routeSessionKey
          ? getRuntimeRouteSessionAliasesForMessageContext(ctx, event, routeSessionKey)
          : [];

        if (routeSessionKey) {
          const now = Date.now();
          const baseDecision = {
            conversationId: ctx.conversationId,
            channelId: ctx.channelId,
            messageId,
            messageHash,
            contentPreview: preview(event.content, 120),
            kind: suggestion.kind,
            confidence: suggestion.confidence,
            candidateModel: suggestion.model,
            reason: suggestion.reason,
            signals: Array.isArray(suggestion.signals) ? suggestion.signals : [],
            createdAtMs: now,
            expiresAtMs: now + ROUTE_DECISION_TTL_MS,
            source: "message_received" as const,
          };

          routingSessionStore.setRouteDecision(routeSessionKey, {
            sessionKey: routeSessionKey,
            ...baseDecision,
          });

          for (const alias of runtimeSessionAliases) {
            routingSessionStore.setRouteDecision(alias, {
              sessionKey: alias,
              ...baseDecision,
            });
          }

          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_decision_cached",
            dryRun: true,
            sessionKey: routeSessionKey,
            runtimeSessionAliases,
            channelId: ctx.channelId,
            accountId: ctx.accountId,
            conversationId: ctx.conversationId,
            messageId,
            messageHash,
            kind: suggestion.kind,
            confidence: suggestion.confidence,
            candidateModel: suggestion.model,
            expiresInMs: ROUTE_DECISION_TTL_MS,
            messageIdentitySource: messageIdentity.source,
            taskModeEnabled: runtimeCfg.taskModeEnabled,
            taskModePrimaryKind: runtimeCfg.taskModePrimaryKind,
            taskModeKinds: runtimeCfg.taskModeKinds,
            taskModeDisabledKinds: runtimeCfg.taskModeDisabledKinds,
            taskModeMinConfidence: runtimeCfg.taskModeMinConfidence,
            stage: "pre_enrichment",
          });
        }

        // Optional: rule engine overrides suggestion.model by scoring catalog + tags + rules.
        if (cfg.ruleEngineEnabled) {
          try {
            const tagsFile = await loadJsonFile<ModelTagsFile>(cfg.modelTagsPath);
            // Fully converged: do not load legacy classification config.
            const priorityFile = await loadJsonFile<ModelPriorityFile>(cfg.modelPriorityPath);
            const catalog = await getModelCatalog(api, cfg);

            // Build provider auth map from cached auth snapshot if available (async availability refresh keeps it warm).
            const providerAuth = buildProviderAuthMapFromSnapshot(authCache?.value ?? null);

            const picked = pickByPriority({
              kind: suggestion.kind,
              catalog,
              priorityFile,
              classificationConfig: null,
              providerAuth,
            });

            if (picked.picked && picked.picked !== suggestion.model) {
              suggestion.model = picked.picked;
              suggestion.reason = `Rule-engine (priority) pick. ${picked.note}`;
            } else {
              suggestion.reason = `Rule-engine (priority) no override. ${picked.note}`;
            }
            // Ensure signals array exists before spreading
            const currentSignals = Array.isArray(suggestion.signals) ? suggestion.signals : [];
            suggestion.signals = Array.from(new Set([...currentSignals, "rule_engine_priority"]));

            // Best-effort: log missing tags once in a while.
            if (cfg.setupPromptEnabled) {
              const missingTags = listMissingManualTags({ catalog, tagsFile });
              if (missingTags.length > 0) {
                const now = Date.now();
                if (now - lastSetupPromptAtMs > 60_000) {
                  lastSetupPromptAtMs = now;
                  await appendJsonl(api, {
                    ts: nowIso(),
                    type: "soft_router_suggest",
                    event: "model_tags_missing",
                    count: missingTags.length,
                    sample: missingTags.slice(0, cfg.setupPromptMaxModels),
                    note: "Some models in catalog have no manual tags; add tags via ops.ps1 tags-set to improve rule-engine recommendations.",
                  });
                }
              }
            }
          } catch {
            // fail-open
          }
        }

        const contentPreview =
          cfg.previewChars > 0 ? preview(event.content, cfg.previewChars) : undefined;

        if (cfg.availabilityEnabled) {
          try {
            suggestion.availability = await computeAvailability({ api, suggestion, cfg });

            // If auth looks expired for the suggested provider, emit a clear fallback suggestion.
            if (suggestion.availability.auth === "expired") {
              const fallbackModel = pickFallbackModel(suggestion.kind);
              if (fallbackModel && fallbackModel !== suggestion.model) {
                suggestion.fallback = {
                  model: fallbackModel,
                  reason:
                    "Suggested provider auth appears expired; this is a safer fallback suggestion (still dry-run).",
                };
              }
            }
          } catch {
            // fail-open
          }
        }

        // Store last suggestion for this conversation (after availability/fallback filled).
        if (ctx.conversationId) {
          lastSuggestionByConversation.set(ctx.conversationId, suggestion);
        }

        if (routeSessionKey) {
          const now = Date.now();
          const baseDecision = {
            conversationId: ctx.conversationId,
            channelId: ctx.channelId,
            messageId,
            messageHash,
            contentPreview: preview(event.content, 120),
            kind: suggestion.kind,
            confidence: suggestion.confidence,
            candidateModel: suggestion.model,
            reason: suggestion.reason,
            signals: Array.isArray(suggestion.signals) ? suggestion.signals : [],
            createdAtMs: now,
            expiresAtMs: now + ROUTE_DECISION_TTL_MS,
            source: "message_received" as const,
          };

          routingSessionStore.setRouteDecision(routeSessionKey, {
            sessionKey: routeSessionKey,
            ...baseDecision,
          });

          for (const alias of runtimeSessionAliases) {
            routingSessionStore.setRouteDecision(alias, {
              sessionKey: alias,
              ...baseDecision,
            });
          }

          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_decision_cached",
            dryRun: true,
            sessionKey: routeSessionKey,
            runtimeSessionAliases,
            channelId: ctx.channelId,
            accountId: ctx.accountId,
            conversationId: ctx.conversationId,
            messageId,
            messageHash,
            kind: suggestion.kind,
            confidence: suggestion.confidence,
            candidateModel: suggestion.model,
            expiresInMs: ROUTE_DECISION_TTL_MS,
            messageIdentitySource: messageIdentity.source,
            taskModeEnabled: runtimeCfg.taskModeEnabled,
            taskModePrimaryKind: runtimeCfg.taskModePrimaryKind,
            taskModeKinds: runtimeCfg.taskModeKinds,
            taskModeDisabledKinds: runtimeCfg.taskModeDisabledKinds,
            taskModeMinConfidence: runtimeCfg.taskModeMinConfidence,
            stage: "post_enrichment",
          });
        }

        await appendJsonl(api, {
          ts: nowIso(),
          type: "soft_router_suggest",
          event: "message_received",
          dryRun: true,
          channelId: ctx.channelId,
          accountId: ctx.accountId,
          conversationId: ctx.conversationId,
          from: event.from,
          contentPreview,
          contentLength: (event.content ?? "").length,
          suggestion,
        });
      } catch (err) {
        // fail-open: never break message handling
        try {
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "error",
            dryRun: true,
            message: err instanceof Error ? err.message : String(err),
          });
        } catch {
          // ignore
        }
      }
    },
  );

  api.on(
    "message_sending",
    async (
      event: PluginHookMessageSendingEvent,
      ctx: PluginHookMessageContext,
    ): Promise<PluginHookMessageSendingResult | void> => {
      try {
        const cfg = resolveConfig(api);
        if (!cfg.enabled || !cfg.echoEnabled) return;
        if (cfg.echoWhen === "never") return;
        if (!ctx.conversationId) return;

        const suggestion = lastSuggestionByConversation.get(ctx.conversationId);
        if (!suggestion) return;

        const auth = suggestion.availability?.auth;
        if (cfg.echoWhen === "on_expired" && auth !== "expired") return;

        const parts: string[] = [];
        parts.push("\n\n---\n");
        parts.push(
          `[router] kind=${suggestion.kind} confidence=${suggestion.confidence} suggested=${suggestion.model}`,
        );
        if (suggestion.availability) {
          parts.push(
            `availability=${suggestion.availability.status}/${suggestion.availability.auth ?? "unknown"} source=${suggestion.availability.source} stale=${suggestion.availability.stale ?? false}`,
          );
        }
        if (suggestion.fallback?.model) {
          parts.push(`fallback=${suggestion.fallback.model}`);
        }
        if (suggestion.reason) {
          parts.push(`reason=${suggestion.reason}`);
        }

        // Optional setup prompt: show a short hint when there are catalog models missing manual tags.
        if (cfg.setupPromptEnabled && cfg.ruleEngineEnabled) {
          try {
            const now = Date.now();
            // throttle to avoid spamming every reply
            if (now - lastSetupPromptAtMs > 10 * 60_000) {
              const tagsFile = await loadJsonFile<ModelTagsFile>(cfg.modelTagsPath);
              const catalog = await getModelCatalog(api, cfg);
              const known = new Set(Object.keys(tagsFile?.models ?? {}));
              const missing = catalog.models
                .map((m) => m.key)
                .filter((k) => k && !known.has(k))
                .slice(0, cfg.setupPromptMaxModels);
              if (missing.length > 0) {
                lastSetupPromptAtMs = now;
                parts.push("setup: detected models without tags 鈫?add via ops.ps1 tags-set");
                for (const m of missing) {
                  const entry = catalog.models.find((x) => x.key === m);
                  const inferred = entry ? inferTagsFromCatalog(entry) : [];
                  parts.push(
                    `- ${m}  tags? (suggest: ${inferred.slice(0, 6).join(",")})  cmd: ops.ps1 tags-set "${m}" "${inferred.join(",")}"`,
                  );
                }
              }
            }
          } catch {
            // ignore
          }
        }

        let footer = parts.join("\n");
        if (footer.length > cfg.echoMaxChars) {
          footer = footer.slice(0, cfg.echoMaxChars) + "…";
        }

        // Avoid double-echo.
        if (typeof event.content === "string" && event.content.includes("[router]")) {
          return;
        }

        return { content: String(event.content ?? "") + footer };
      } catch {
        return;
      }
    },
  );
}
