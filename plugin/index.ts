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

// Configuration-driven classification
import {
  loadClassificationRules,
  type ClassificationRulesConfig,
} from "./classification-loader.ts";
import {
  classifyContent,
  type ClassificationResult,
} from "./classification-engine.ts";

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
  routerRulesPath?: string;
  modelPriorityPath?: string;
  catalogTtlMs?: number;
  catalogCmdTimeoutMs?: number;
  setupPromptEnabled?: boolean;
  setupPromptMaxModels?: number;
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
  switchingMinConfidence: "high" as const,
  switchingAllowChat: false,

  get modelTagsPath() { return path.join(getDefaultToolsDir(), "model-tags.json"); },
  get routerRulesPath() { return path.join(getDefaultToolsDir(), "router-rules.json"); },
  get modelPriorityPath() { return path.join(getDefaultToolsDir(), "model-priority.json"); },
  catalogTtlMs: 600_000,
  catalogCmdTimeoutMs: 20_000,
  setupPromptEnabled: true,
  setupPromptMaxModels: 3,
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
  const routerRulesPath =
    typeof cfg.routerRulesPath === "string" && cfg.routerRulesPath.trim()
      ? cfg.routerRulesPath
      : DEFAULTS.routerRulesPath;
  const modelPriorityPath =
    typeof cfg.modelPriorityPath === "string" && cfg.modelPriorityPath.trim()
      ? cfg.modelPriorityPath
      : DEFAULTS.modelPriorityPath;
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
    routerRulesPath,
    modelPriorityPath,
    catalogTtlMs,
    catalogCmdTimeoutMs,
    setupPromptEnabled,
    setupPromptMaxModels,
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
let classificationConfig: ClassificationRulesConfig | null = null;

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
  classificationConfig?: ClassificationRulesConfig | null;
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

async function getClassificationConfig(): Promise<ClassificationRulesConfig> {
  if (classificationConfig) {
    return classificationConfig;
  }

  try {
    const configPath = path.join(getDefaultToolsDir(), "classification-rules.json");
    classificationConfig = await loadClassificationRules(configPath);
    return classificationConfig;
  } catch (err) {
    // Fallback: return minimal config with just fallback category
    return {
      version: 1,
      categories: [
        {
          id: "fallback",
          name: "Fallback",
          priority: 0,
          enabled: true,
          rules: {},
          confidence: {},
          models: ["google-antigravity/claude-sonnet-4-5-thinking"],
        },
      ],
    };
  }
}

/**
 * NEW: Configuration-driven classification (async)
 */
async function classifyDynamic(
  content: string,
  metadata?: Record<string, unknown>
): Promise<Suggestion> {
  try {
    const config = await getClassificationConfig();
    const result = classifyContent(content, metadata, config);

    // Convert ClassificationResult to Suggestion format
    return {
      kind: result.categoryId,
      model: result.models[0] ?? "google-antigravity/claude-sonnet-4-5-thinking",
      reason: result.reason,
      signals: result.signals,
      confidence: result.confidence,
    };
  } catch (err) {
    // Fallback on error
    return {
      kind: "fallback",
      model: "google-antigravity/claude-sonnet-4-5-thinking",
      reason: `Classification error: ${err instanceof Error ? err.message : String(err)}`,
      signals: ["error_fallback"],
      confidence: "low",
    };
  }
}

function pickFallbackModel(kind: Suggestion["kind"]) {
  // Keep it simple and reliable: prefer OpenAI Codex when available.
  // We intentionally do NOT attempt to validate model allowlists here; this is suggest-only.
  if (kind === "coding") return "openai-codex/gpt-5.3-codex";
  if (kind === "vision") return "qwen-portal/vision-model";
  if (kind === "complex_planning") return "google-antigravity/claude-sonnet-4-5-thinking";
  if (kind === "text_writing") return "google-antigravity/claude-sonnet-4-5";
  if (kind === "quick_simple") return "google-antigravity/gemini-3-flash";
  return "google-antigravity/claude-sonnet-4-5-thinking"; // fallback
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
  if (provider === "qwen-portal" || provider === "google-antigravity") {
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
  kind: string; // Dynamic - loaded from classification-rules.json
  model: string;
  reason: string;
  signals: string[];
  confidence: Confidence;
  availability?: Availability;
  fallback?: FallbackSuggestion;
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

        const promptText = String(event.prompt ?? "");
        const suggestion = await classifyDynamic(promptText, undefined);

        // Policy gates (user-confirmed):
        // - only confidence>=min
        // - do not switch for simple chat unless explicitly allowed
        const confRank = (c: string) => (c === "high" ? 3 : c === "medium" ? 2 : 1);
        if (confRank(suggestion.confidence) < confRank(cfg.switchingMinConfidence)) return;
        if (!cfg.switchingAllowChat && (suggestion.kind === "quick_simple" || suggestion.kind === "fallback")) return;

        const classificationCfg = await getClassificationConfig();
        const priorityFile = await loadJsonFile<ModelPriorityFile>(cfg.modelPriorityPath);
        const catalog = await getModelCatalog(api, cfg);
        const providerAuth = buildProviderAuthMapFromSnapshot(authCache?.value ?? null);

        const picked = pickByPriority({
          kind: suggestion.kind,
          catalog,
          priorityFile,
          classificationConfig: classificationCfg,
          providerAuth,
        });

        if (!picked.picked) return;

        const sessionKey = String((ctx as any)?.sessionKey ?? "unknown");
        const promptHash = crypto.createHash("sha1").update(promptText).digest("hex").slice(0, 16);

        const okToLog = await shouldLogModelOverride({ logDir: cfg.logDir }, sessionKey, picked.picked);
        if (!okToLog) {
          // Debug: log dedup skip to prove this path is being hit.
          try {
            await appendJsonl(api, {
              ts: nowIso(),
              type: "soft_router_suggest",
              event: "model_override_dedup_skip",
              pid: process.pid,
              sessionKey,
              agentId: (ctx as any)?.agentId,
              picked: picked.picked,
              promptHash,
            });
          } catch {
            // ignore
          }
          return { modelOverride: picked.picked };
        }

        // Actually switch this run's model.
        await appendJsonl(api, {
          ts: nowIso(),
          type: "soft_router_suggest",
          event: "model_override",
          pid: process.pid,
          dryRun: false,
          sessionKey: (ctx as any)?.sessionKey,
          agentId: (ctx as any)?.agentId,
          kind: suggestion.kind,
          confidence: suggestion.confidence,
          picked: picked.picked,
          note: picked.note,
          promptHash,
        });

        return { modelOverride: picked.picked };
      } catch {
        return;
      }
    },
  );

  api.on(
    "message_received",
    async (event: PluginHookMessageReceivedEvent, ctx: PluginHookMessageContext) => {
      try {
        const suggestion = await classifyDynamic(event.content, event.metadata);
        const cfg = resolveConfig(api);

        // Optional: rule engine overrides suggestion.model by scoring catalog + tags + rules.
        if (cfg.ruleEngineEnabled) {
          try {
            const tagsFile = await loadJsonFile<ModelTagsFile>(cfg.modelTagsPath);
            const classificationCfg = await getClassificationConfig();
            const priorityFile = await loadJsonFile<ModelPriorityFile>(cfg.modelPriorityPath);
            const catalog = await getModelCatalog(api, cfg);

            // Build provider auth map from cached auth snapshot if available (async availability refresh keeps it warm).
            const providerAuth = buildProviderAuthMapFromSnapshot(authCache?.value ?? null);

            const picked = pickByPriority({
              kind: suggestion.kind,
              catalog,
              priorityFile,
              classificationConfig: classificationCfg,
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
