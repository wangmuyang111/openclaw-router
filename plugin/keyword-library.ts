import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export type KeywordLibrary = {
  version: number;
  updatedAt?: string;
  notes?: string;
  defaultFallbackKind?: string;
  normalization?: { lowercase?: boolean; trim?: boolean; collapseWhitespace?: boolean };
  keywordSets: Record<string, string[]>;
  kinds: Record<
    string,
    {
      id: string;
      name?: string;
      priority: number;
      enabled?: boolean;
      signals: {
        positive: Array<{ set: string; weight: number; match?: "contains"; exclude?: boolean }>;
        negative: Array<{ set: string; weight: number; match?: "contains"; exclude?: boolean }>;
        metadata: Array<{ field: "hasImage" | "hasCodeBlock"; equals: boolean; weight: number; exclude?: boolean }>;
        regex: Array<{ pattern: string; flags?: string; weight: number }>;
      };
      thresholds: { minScore?: number; highScore?: number; minStrongHits?: number };
      models: { strategy: "priority_list"; list: string[] };
    }
  >;
};

export type KeywordOverrides = {
  version: number;
  updatedAt?: string;
  notes?: string;
  sets?: Record<string, { add?: string[]; remove?: string[] }>;
  kinds?: Record<string, { enabled?: boolean }>;
};

export type CompiledRoutingRules = {
  version: number;
  compiledAt: string;
  defaultFallbackKind: string;
  kinds: CompiledKindRule[];
};

export type CompiledKindRule = {
  id: string;
  name?: string;
  priority: number;
  enabled: boolean;
  positive: Array<{ keywords: string[]; weight: number; match: "contains"; exclude: boolean; sourceSet: string }>;
  negative: Array<{ keywords: string[]; weight: number; match: "contains"; exclude: boolean; sourceSet: string }>;
  metadata: Array<{ field: "hasImage" | "hasCodeBlock"; equals: boolean; weight: number; exclude: boolean }>;
  regex: Array<{ pattern: string; flags: string; weight: number }>;
  thresholds: { minScore: number; highScore: number; minStrongHits: number };
  models: { strategy: "priority_list"; list: string[] };
};

function getOpenClawHome(): string {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}
function getWorkspaceDir(): string {
  return process.env.OPENCLAW_WORKSPACE ?? path.join(getOpenClawHome(), "workspace");
}
function getDefaultToolsDir(): string {
  return path.join(getWorkspaceDir(), "tools", "soft-router-suggest");
}

export function defaultKeywordLibraryPath(): string {
  return path.join(getDefaultToolsDir(), "keyword-library.json");
}
export function defaultKeywordOverridesPath(): string {
  return path.join(getDefaultToolsDir(), "keyword-overrides.user.json");
}

async function readJsonFile<T>(p: string): Promise<T> {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as T;
}

type KeywordNormalization = NonNullable<KeywordLibrary["normalization"]>;

function normalizeKeywordToken(token: unknown, normalization?: KeywordNormalization): string {
  let s = String(token ?? "");
  const trimEnabled = normalization?.trim !== false;
  if (trimEnabled) s = s.trim();
  if (normalization?.collapseWhitespace) s = s.replace(/\s+/g, " ");
  if (normalization?.lowercase) s = s.toLowerCase();
  return s;
}

function normalizeTokens(list: string[], normalization?: KeywordNormalization): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list ?? []) {
    const t = normalizeKeywordToken(raw, normalization);
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function applySetOverlay(
  base: string[],
  add: string[] | undefined,
  remove: string[] | undefined,
  normalization?: KeywordNormalization,
): string[] {
  const rm = new Set((remove ?? []).map((x) => normalizeKeywordToken(x, normalization)).filter(Boolean));
  const out: string[] = [];
  for (const x of base ?? []) {
    const t = normalizeKeywordToken(x, normalization);
    if (!t) continue;
    if (rm.has(t)) continue;
    out.push(t);
  }
  for (const x of add ?? []) {
    const t = normalizeKeywordToken(x, normalization);
    if (!t) continue;
    out.push(t);
  }
  return normalizeTokens(out, normalization);
}

export async function loadAndCompileRoutingRules(params?: {
  libraryPath?: string;
  overridesPath?: string;
}): Promise<{ compiled: CompiledRoutingRules; warnings: string[] }> {
  const warnings: string[] = [];
  const libraryPath = params?.libraryPath ?? defaultKeywordLibraryPath();
  const overridesPath = params?.overridesPath ?? defaultKeywordOverridesPath();

  const lib = await readJsonFile<KeywordLibrary>(libraryPath);

  let ov: KeywordOverrides | null = null;
  try {
    ov = await readJsonFile<KeywordOverrides>(overridesPath);
  } catch {
    ov = null;
  }

  const normalization = lib.normalization ?? {};

  // Build final keywordSets with overlays applied.
  const finalSets: Record<string, string[]> = {};
  for (const [setId, baseList] of Object.entries(lib.keywordSets ?? {})) {
    const overlay = ov?.sets?.[setId];
    finalSets[setId] = applySetOverlay(baseList ?? [], overlay?.add, overlay?.remove, normalization);
  }

  // If overrides mention unknown sets, warn.
  for (const setId of Object.keys(ov?.sets ?? {})) {
    if (!(setId in (lib.keywordSets ?? {}))) {
      warnings.push(`overrides: unknown set '${setId}' (ignored)`);
    }
  }

  const defaultFallbackKind = String(lib.defaultFallbackKind ?? "chat");

  const compiledKinds: CompiledKindRule[] = [];
  for (const [kindId, k] of Object.entries(lib.kinds ?? {})) {
    const enabledBase = k.enabled !== false;
    const enabledOverride = ov?.kinds?.[kindId]?.enabled;
    const enabled = typeof enabledOverride === "boolean" ? enabledOverride : enabledBase;

    const expand = (
      arr: Array<{ set: string; weight: number; match?: "contains"; exclude?: boolean }> | undefined,
      kind: "positive" | "negative",
    ) => {
      const out: Array<{ keywords: string[]; weight: number; match: "contains"; exclude: boolean; sourceSet: string }> = [];
      for (const s of arr ?? []) {
        const setId = String(s.set ?? "");
        if (!setId) continue;
        const kw = finalSets[setId];
        if (!kw) {
          warnings.push(`kind '${kindId}': missing keyword set '${setId}'`);
          continue;
        }
        out.push({
          keywords: kw,
          weight: Number(s.weight ?? 0),
          match: "contains",
          exclude: Boolean(s.exclude),
          sourceSet: setId,
        });
      }
      return out;
    };

    const thresholds = {
      minScore: Number(k.thresholds?.minScore ?? 2),
      highScore: Number(k.thresholds?.highScore ?? 6),
      minStrongHits: Math.max(0, Math.trunc(Number(k.thresholds?.minStrongHits ?? 0))),
    };

    compiledKinds.push({
      id: String(k.id ?? kindId),
      name: k.name ?? kindId,
      priority: Math.trunc(Number(k.priority ?? 0)),
      enabled,
      positive: expand(k.signals?.positive, "positive"),
      negative: expand(k.signals?.negative, "negative"),
      metadata: (k.signals?.metadata ?? []).map((m) => ({
        field: m.field,
        equals: Boolean(m.equals),
        weight: Number(m.weight ?? 0),
        exclude: Boolean(m.exclude),
      })),
      regex: (k.signals?.regex ?? []).map((r) => ({
        pattern: String(r.pattern ?? ""),
        flags: String(r.flags ?? "i"),
        weight: Number(r.weight ?? 0),
      })),
      thresholds,
      models: { strategy: "priority_list", list: Array.isArray(k.models?.list) ? k.models.list : [] },
    });
  }

  // Sort kinds by priority desc
  compiledKinds.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const compiled: CompiledRoutingRules = {
    version: 1,
    compiledAt: new Date().toISOString(),
    defaultFallbackKind,
    kinds: compiledKinds,
  };

  return { compiled, warnings };
}

export function parsePasteLines(input: string): string[] {
  // UI paste format: one term per line. Allow comments starting with '#'.
  // Also allow accidental comma-separated lines by splitting further.
  const lines = String(input ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const out: string[] = [];
  for (const line of lines) {
    const parts = line
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;
    out.push(...parts);
  }
  return normalizeTokens(out);
}
