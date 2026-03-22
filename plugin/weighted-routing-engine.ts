import type { CompiledRoutingRules, CompiledKindRule } from "./keyword-library.ts";

export type RoutingConfidence = "low" | "medium" | "high";

export type RoutingDecision = {
  kind: string;
  confidence: RoutingConfidence;
  score: number;
  strongHits: number;
  hits: number;
  reason: string;
  signals: string[];
  matched: {
    positive: Array<{ set: string; term: string; weight: number }>;
    negative: Array<{ set: string; term: string; weight: number }>;
    metadata: Array<{ field: string; weight: number }>;
    regex: Array<{ pattern: string; weight: number }>;
  };
};

function normalizeContent(s: string): { raw: string; lower: string } {
  const raw = String(s ?? "");
  return { raw, lower: raw.toLowerCase() };
}

function hasImage(metadata?: Record<string, unknown>): boolean {
  return metadata?.hasImage === true || String(metadata?.mediaType ?? "").toLowerCase().includes("image");
}

function hasCodeBlock(content: string): boolean {
  return String(content ?? "").includes("```");
}

function contentContains(content: { raw: string; lower: string }, term: string): boolean {
  if (!term) return false;
  // We keep matching simple: contains on both raw and lowercased.
  // This preserves CN/EN behavior with minimal surprises.
  return content.raw.includes(term) || content.lower.includes(term.toLowerCase());
}

function topN<T>(arr: T[], n: number): T[] {
  return arr.length <= n ? arr : arr.slice(0, n);
}

function computeConfidence(score: number, thresholds: { minScore: number; highScore: number }): RoutingConfidence {
  if (score >= thresholds.highScore) return "high";
  if (score >= thresholds.minScore) return "medium";
  return "low";
}

function isStrongGroup(group: { weight: number; sourceSet: string }): boolean {
  // Convention: strong groups use weight >= 3 OR set name ends with '.strong'
  return group.weight >= 3 || group.sourceSet.endsWith(".strong");
}

function scoreKind(kind: CompiledKindRule, content: { raw: string; lower: string }, metadata?: Record<string, unknown>): {
  eligible: boolean;
  score: number;
  strongHits: number;
  hits: number;
  matched: RoutingDecision["matched"];
  signals: string[];
} {
  let score = 0;
  let strongHits = 0;
  let hits = 0;

  const matched: RoutingDecision["matched"] = {
    positive: [],
    negative: [],
    metadata: [],
    regex: [],
  };

  const signals: string[] = [];

  // Metadata signals
  for (const m of kind.metadata ?? []) {
    const val = m.field === "hasImage" ? hasImage(metadata) : m.field === "hasCodeBlock" ? hasCodeBlock(content.raw) : false;
    if (val === m.equals) {
      if (m.exclude) return { eligible: false, score: 0, strongHits: 0, hits: 0, matched, signals: [] };
      score += m.weight;
      hits += 1;
      matched.metadata.push({ field: m.field, weight: m.weight });
      signals.push(`meta:${m.field}(${m.weight})`);
    }
  }

  // Regex signals
  // Convention: weight>=3 counts as a "strong" hit (similar to strong keyword groups)
  for (const r of kind.regex ?? []) {
    if (!r.pattern) continue;
    try {
      const re = new RegExp(r.pattern, r.flags ?? "i");
      if (re.test(content.raw)) {
        score += r.weight;
        hits += 1;
        if (r.weight >= 3) strongHits += 1;
        matched.regex.push({ pattern: r.pattern, weight: r.weight });
        signals.push(`re:${r.pattern}(${r.weight})`);
      }
    } catch {
      // ignore invalid regex
    }
  }

  // Positive keyword groups
  for (const group of kind.positive ?? []) {
    for (const term of group.keywords ?? []) {
      if (!term) continue;
      if (contentContains(content, term)) {
        if (group.exclude) return { eligible: false, score: 0, strongHits: 0, hits: 0, matched, signals: [] };
        score += group.weight;
        hits += 1;
        if (isStrongGroup(group)) strongHits += 1;
        matched.positive.push({ set: group.sourceSet, term, weight: group.weight });
        // avoid flooding signals: keep a compact record
        signals.push(`+${group.weight}:${group.sourceSet}`);
        // Do NOT break: allow multiple terms to accumulate.
      }
    }
  }

  // Negative keyword groups (penalty by default)
  for (const group of kind.negative ?? []) {
    for (const term of group.keywords ?? []) {
      if (!term) continue;
      if (contentContains(content, term)) {
        if (group.exclude) return { eligible: false, score: 0, strongHits: 0, hits: 0, matched, signals: [] };
        score += group.weight; // negative weight
        hits += 1;
        matched.negative.push({ set: group.sourceSet, term, weight: group.weight });
        signals.push(`${group.weight}:${group.sourceSet}`);
      }
    }
  }

  // Threshold gating
  const minStrongHits = kind.thresholds?.minStrongHits ?? 0;
  const minScore = kind.thresholds?.minScore ?? 2;
  if (strongHits < minStrongHits) return { eligible: false, score, strongHits, hits, matched, signals };
  if (score < minScore) return { eligible: false, score, strongHits, hits, matched, signals };

  return { eligible: true, score, strongHits, hits, matched, signals };
}

export function routeByWeightedRules(params: {
  rules: CompiledRoutingRules;
  content: string;
  metadata?: Record<string, unknown>;
  maxExplainTerms?: number;
}): RoutingDecision {
  const maxExplainTerms = params.maxExplainTerms ?? 10;
  const contentN = normalizeContent(params.content);

  const fallbackKindId = String(params.rules.defaultFallbackKind ?? "chat").trim() || "chat";

  // Mechanism-level guarantee:
  // - 'chat' never participates in weighted matching.
  // - the configured defaultFallbackKind is used only when NO other kind met thresholds.
  // This prevents a fallback kind with minScore=0 (like chat) from always winning "by default".
  const enabledKinds = (params.rules.kinds ?? [])
    .filter((k) => k.enabled !== false)
    .filter((k) => k.id !== "chat")
    .filter((k) => k.id !== fallbackKindId);

  let best: { kind: CompiledKindRule; scored: ReturnType<typeof scoreKind> } | null = null;

  for (const k of enabledKinds) {
    const scored = scoreKind(k, contentN, params.metadata);
    if (!scored.eligible) continue;
    if (!best) {
      best = { kind: k, scored };
      continue;
    }
    if (scored.score > best.scored.score) {
      best = { kind: k, scored };
      continue;
    }
    if (scored.score === best.scored.score && (k.priority ?? 0) > (best.kind.priority ?? 0)) {
      best = { kind: k, scored };
    }
  }

  if (!best) {
    return {
      kind: fallbackKindId,
      confidence: "low",
      score: 0,
      strongHits: 0,
      hits: 0,
      reason: "No non-fallback kind met thresholds; using fallback.",
      signals: ["fallback:no_match"],
      matched: { positive: [], negative: [], metadata: [], regex: [] },
    };
  }

  const t = best.kind.thresholds;
  const thresholds = {
    minScore: t?.minScore ?? 2,
    highScore: t?.highScore ?? 6,
  };
  const conf = computeConfidence(best.scored.score, thresholds);

  const mp = topN(best.scored.matched.positive, maxExplainTerms);
  const mn = topN(best.scored.matched.negative, maxExplainTerms);
  const reason = `Weighted match: kind='${best.kind.id}' score=${best.scored.score} strongHits=${best.scored.strongHits} hits=${best.scored.hits} confidence=${conf}`;

  return {
    kind: best.kind.id,
    confidence: conf,
    score: best.scored.score,
    strongHits: best.scored.strongHits,
    hits: best.scored.hits,
    reason,
    signals: topN(best.scored.signals, 30),
    matched: {
      positive: mp,
      negative: mn,
      metadata: best.scored.matched.metadata,
      regex: best.scored.matched.regex,
    },
  };
}
