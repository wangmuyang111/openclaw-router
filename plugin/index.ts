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

  taskModeEnabled: true,
  taskModePrimaryKind: "coding",
  taskModeKinds: ["coding"],
  taskModeMinConfidence: "medium" as const,
  taskModeReturnToPrimary: true,
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

type Confidence = "low" | "medium" | "high";

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

type RouteDecision = {
  sessionKey: string;
  conversationId?: string;
  channelId?: string;
  messageId?: string;
  messageHash: string;
  contentPreview?: string;
  kind: string;
  confidence: Confidence;
  candidateModel: string;
  reason: string;
  signals: string[];
  createdAtMs: number;
  expiresAtMs: number;
  source: "message_received";
};

type RuntimeRoutingConfig = {
  taskModeEnabled: boolean;
  taskModePrimaryKind: string;
  taskModeKinds: string[];
  taskModeMinConfidence: Confidence;
  taskModeReturnToPrimary: boolean;
  taskModeAllowAutoDowngrade: boolean;
  freeSwitchWhenTaskModeOff: boolean;
};

type TaskSessionState = {
  sessionKey: string;
  primaryKind: string;
  primaryModel: string;
  temporaryKind?: string;
  temporaryModel?: string;
  lastTaskAt: number;
  lastRouteAt: number;
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
const routeDecisionBySession = new Map<string, RouteDecision>();
const taskSessionStateBySession = new Map<string, TaskSessionState>();
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
    taskModeMinConfidence: cfg.taskModeMinConfidence,
    taskModeReturnToPrimary: cfg.taskModeReturnToPrimary,
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
      ? raw.taskModePrimaryKind.trim()
      : defaults.taskModePrimaryKind;
  const taskModeKinds = Array.isArray(raw?.taskModeKinds)
    ? Array.from(
        new Set(
          raw.taskModeKinds
            .map((value) => String(value ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      )
    : defaults.taskModeKinds;

  const value: RuntimeRoutingConfig = {
    taskModeEnabled:
      typeof raw?.taskModeEnabled === "boolean" ? raw.taskModeEnabled : defaults.taskModeEnabled,
    taskModePrimaryKind,
    taskModeKinds:
      taskModeKinds.length > 0
        ? Array.from(new Set([taskModePrimaryKind, ...taskModeKinds]))
        : defaults.taskModeKinds,
    taskModeMinConfidence:
      raw?.taskModeMinConfidence === "low" ||
      raw?.taskModeMinConfidence === "medium" ||
      raw?.taskModeMinConfidence === "high"
        ? raw.taskModeMinConfidence
        : defaults.taskModeMinConfidence,
    taskModeReturnToPrimary:
      typeof raw?.taskModeReturnToPrimary === "boolean"
        ? raw.taskModeReturnToPrimary
        : defaults.taskModeReturnToPrimary,
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
  for (const [key, value] of routeDecisionBySession.entries()) {
    if (!value || value.expiresAtMs <= now) {
      routeDecisionBySession.delete(key);
    }
  }
}

function confidenceRank(c: string): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

function resolveRouteSessionKeyFromMessageContext(
  ctx: PluginHookMessageContext,
  event: PluginHookMessageReceivedEvent,
): string | null {
  const ctxAny = ctx as any;
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const candidates = [
    ctxAny?.sessionKey,
    metadata.sessionKey,
    metadata.session_key,
    metadata.threadId,
    metadata.thread_id,
    metadata.conversationId,
    metadata.conversation_id,
    ctx.conversationId,
    metadata.chatId,
    metadata.chat_id,
  ];

  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  const provider = String(metadata.provider ?? ctx.channelId ?? "unknown").trim() || "unknown";
  const accountId = String(ctx.accountId ?? metadata.accountId ?? metadata.account_id ?? "unknown").trim() || "unknown";
  const from = String(event.from ?? metadata.from ?? "unknown").trim() || "unknown";
  return `fallback:${provider}:${accountId}:${from}`;
}

function shouldPreventAutomaticDowngrade(candidateModel: string, allowAutoDowngrade: boolean): boolean {
  if (allowAutoDowngrade) return false;
  const normalized = normalizeModelOverrideForProvider(candidateModel).override.toLowerCase();
  return normalized.includes("gpt-5.2");
}

function isLongTaskKind(kind: string): boolean {
  return LONG_TASK_KINDS.has(String(kind ?? "").trim().toLowerCase());
}

function isTaskModeKind(kind: string, runtimeCfg: RuntimeRoutingConfig): boolean {
  const normalized = String(kind ?? "").trim().toLowerCase();
  return runtimeCfg.taskModeKinds.some((value) => value.toLowerCase() === normalized);
}

function getTaskPrimaryModelForSession(
  runtimeCfg: RuntimeRoutingConfig,
  decision: RouteDecision,
  existing?: TaskSessionState,
): { primaryKind: string; primaryModel: string } {
  if (existing?.primaryKind && existing?.primaryModel) {
    return { primaryKind: existing.primaryKind, primaryModel: existing.primaryModel };
  }

  if (isTaskModeKind(decision.kind, runtimeCfg) && decision.candidateModel) {
    return { primaryKind: decision.kind, primaryModel: decision.candidateModel };
  }

  return {
    primaryKind: runtimeCfg.taskModePrimaryKind,
    primaryModel: decision.candidateModel,
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
        const sessionKey = String((ctx as any)?.sessionKey ?? "unknown");
        const promptHash = crypto.createHash("sha1").update(promptText).digest("hex").slice(0, 16);
        const agentId = (ctx as any)?.agentId;
        const runtimeCfg = await getRuntimeRoutingConfig(api);

        const decision = routeDecisionBySession.get(sessionKey);
        if (!decision) {
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_cache_miss",
            pid: process.pid,
            dryRun: true,
            sessionKey,
            agentId,
            promptHash,
          });
          return;
        }

        if (decision.expiresAtMs <= Date.now()) {
          routeDecisionBySession.delete(sessionKey);
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_cache_expired",
            pid: process.pid,
            dryRun: true,
            sessionKey,
            agentId,
            promptHash,
            messageHash: decision.messageHash,
          });
          return;
        }

        await appendJsonl(api, {
          ts: nowIso(),
          type: "soft_router_suggest",
          event: "route_cache_hit",
          pid: process.pid,
          dryRun: true,
          sessionKey,
          agentId,
          promptHash,
          kind: decision.kind,
          confidence: decision.confidence,
          candidateModel: decision.candidateModel,
          messageHash: decision.messageHash,
        });

        let targetModel = decision.candidateModel;
        let targetKind = decision.kind;
        let logEvent = "route_override_applied";
        let logNote = decision.reason;
        const existingTaskState = taskSessionStateBySession.get(sessionKey);

        if (runtimeCfg.taskModeEnabled) {
          const primary = getTaskPrimaryModelForSession(runtimeCfg, decision, existingTaskState);
          let nextTaskState: TaskSessionState = existingTaskState ?? {
            sessionKey,
            primaryKind: primary.primaryKind,
            primaryModel: primary.primaryModel,
            lastTaskAt: Date.now(),
            lastRouteAt: Date.now(),
          };

          if (!existingTaskState) {
            taskSessionStateBySession.set(sessionKey, nextTaskState);
            await appendJsonl(api, {
              ts: nowIso(),
              type: "soft_router_suggest",
              event: "task_mode_primary_set",
              dryRun: true,
              sessionKey,
              agentId,
              primaryKind: nextTaskState.primaryKind,
              primaryModel: nextTaskState.primaryModel,
              sourceKind: decision.kind,
              sourceModel: decision.candidateModel,
            });
          }

          const qualifiesAsTask =
            isTaskModeKind(decision.kind, runtimeCfg) &&
            confidenceRank(decision.confidence) >= confidenceRank(runtimeCfg.taskModeMinConfidence);

          if (qualifiesAsTask) {
            nextTaskState = {
              ...nextTaskState,
              primaryKind: nextTaskState.primaryKind || decision.kind,
              primaryModel: nextTaskState.primaryModel || decision.candidateModel,
              temporaryKind: decision.kind !== nextTaskState.primaryKind ? decision.kind : undefined,
              temporaryModel: decision.kind !== nextTaskState.primaryKind ? decision.candidateModel : undefined,
              lastTaskAt: Date.now(),
              lastRouteAt: Date.now(),
            };

            if (
              shouldPreventAutomaticDowngrade(
                decision.candidateModel,
                runtimeCfg.taskModeAllowAutoDowngrade,
              )
            ) {
              routeDecisionBySession.delete(sessionKey);
              taskSessionStateBySession.set(sessionKey, nextTaskState);
              await appendJsonl(api, {
                ts: nowIso(),
                type: "soft_router_suggest",
                event: "task_mode_downgrade_blocked",
                pid: process.pid,
                dryRun: true,
                sessionKey,
                agentId,
                promptHash,
                kind: decision.kind,
                confidence: decision.confidence,
                candidateModel: decision.candidateModel,
                primaryModel: nextTaskState.primaryModel,
              });
              return;
            }

            if (nextTaskState.temporaryModel && nextTaskState.temporaryModel !== nextTaskState.primaryModel) {
              targetModel = nextTaskState.temporaryModel;
              targetKind = nextTaskState.temporaryKind ?? decision.kind;
              logEvent = "task_mode_temp_override_applied";
              logNote = `task mode temporary override from ${nextTaskState.primaryKind} to ${targetKind}`;
            } else {
              targetModel = nextTaskState.primaryModel;
              targetKind = nextTaskState.primaryKind;
              logEvent = "route_override_applied";
              logNote = decision.reason;
            }

            taskSessionStateBySession.set(sessionKey, nextTaskState);
          } else {
            const hasTemporaryModel = Boolean(existingTaskState?.temporaryModel);
            if (runtimeCfg.taskModeReturnToPrimary && existingTaskState?.primaryModel) {
              targetModel = existingTaskState.primaryModel;
              targetKind = existingTaskState.primaryKind;
              logEvent = hasTemporaryModel ? "task_mode_return_to_primary" : "route_override_applied";
              logNote = hasTemporaryModel
                ? `task mode return to primary ${existingTaskState.primaryKind}`
                : `task mode keep primary ${existingTaskState.primaryKind}`;
              taskSessionStateBySession.set(sessionKey, {
                ...existingTaskState,
                temporaryKind: undefined,
                temporaryModel: undefined,
                lastRouteAt: Date.now(),
              });
            } else if (!runtimeCfg.freeSwitchWhenTaskModeOff) {
              routeDecisionBySession.delete(sessionKey);
              await appendJsonl(api, {
                ts: nowIso(),
                type: "soft_router_suggest",
                event: "route_override_skipped_non_long_task",
                pid: process.pid,
                dryRun: true,
                sessionKey,
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
            routeDecisionBySession.delete(sessionKey);
            await appendJsonl(api, {
              ts: nowIso(),
              type: "soft_router_suggest",
              event: "route_override_skipped_non_long_task",
              pid: process.pid,
              dryRun: true,
              sessionKey,
              agentId,
              promptHash,
              kind: decision.kind,
              confidence: decision.confidence,
              candidateModel: decision.candidateModel,
            });
            return;
          }

          if (confidenceRank(decision.confidence) < confidenceRank("medium")) {
            routeDecisionBySession.delete(sessionKey);
            await appendJsonl(api, {
              ts: nowIso(),
              type: "soft_router_suggest",
              event: "route_override_skipped_low_confidence",
              pid: process.pid,
              dryRun: true,
              sessionKey,
              agentId,
              promptHash,
              kind: decision.kind,
              confidence: decision.confidence,
              candidateModel: decision.candidateModel,
              minConfidence: "medium",
            });
            return;
          }

          if (shouldPreventAutomaticDowngrade(decision.candidateModel, false)) {
            routeDecisionBySession.delete(sessionKey);
            await appendJsonl(api, {
              ts: nowIso(),
              type: "soft_router_suggest",
              event: "route_override_skipped_downgrade_guard",
              pid: process.pid,
              dryRun: true,
              sessionKey,
              agentId,
              promptHash,
              kind: decision.kind,
              confidence: decision.confidence,
              candidateModel: decision.candidateModel,
            });
            return;
          }
        }

        const okToLog = await shouldLogModelOverride({ logDir: cfg.logDir }, sessionKey, targetModel);
        const norm = normalizeModelOverrideForProvider(targetModel);

        if (okToLog) {
          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: logEvent,
            pid: process.pid,
            dryRun: false,
            sessionKey,
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

        routeDecisionBySession.delete(sessionKey);

        try {
          if (norm.normalizedFrom) {
            console.log(
              `[soft-router-suggest] route_override_normalized from=${norm.normalizedFrom} to=${norm.override} sessionKey=${sessionKey}`,
            );
          }
          console.log(
            `[soft-router-suggest] route_override sessionKey=${sessionKey} agentId=${String(
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

        const routeSessionKey = resolveRouteSessionKeyFromMessageContext(ctx, event);
        const runtimeCfg = await getRuntimeRoutingConfig(api);
        const messageMetadata = (event.metadata ?? {}) as Record<string, unknown>;
        const rawMessageId = messageMetadata.messageId ?? messageMetadata.message_id ?? messageMetadata.id;
        const messageId = typeof rawMessageId === "string" ? rawMessageId : undefined;
        const messageHash = crypto
          .createHash("sha1")
          .update(String(event.content ?? ""))
          .digest("hex")
          .slice(0, 16);

        if (routeSessionKey) {
          const now = Date.now();
          routeDecisionBySession.set(routeSessionKey, {
            sessionKey: routeSessionKey,
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
            source: "message_received",
          });

          await appendJsonl(api, {
            ts: nowIso(),
            type: "soft_router_suggest",
            event: "route_decision_cached",
            dryRun: true,
            sessionKey: routeSessionKey,
            channelId: ctx.channelId,
            accountId: ctx.accountId,
            conversationId: ctx.conversationId,
            messageId,
            messageHash,
            kind: suggestion.kind,
            confidence: suggestion.confidence,
            candidateModel: suggestion.model,
            expiresInMs: ROUTE_DECISION_TTL_MS,
            taskModeEnabled: runtimeCfg.taskModeEnabled,
            taskModePrimaryKind: runtimeCfg.taskModePrimaryKind,
            taskModeKinds: runtimeCfg.taskModeKinds,
            taskModeMinConfidence: runtimeCfg.taskModeMinConfidence,
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
