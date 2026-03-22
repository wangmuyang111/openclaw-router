import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function normalizeContent(s) {
  const raw = String(s ?? "");
  return { raw, lower: raw.toLowerCase() };
}

function hasImage(metadata) {
  return metadata?.hasImage === true || String(metadata?.mediaType ?? "").toLowerCase().includes("image");
}

function hasCodeBlock(content) {
  return String(content ?? "").includes("```");
}

function contentContains(content, term) {
  if (!term) return false;
  return content.raw.includes(term) || content.lower.includes(String(term).toLowerCase());
}

function isStrongGroup(group) {
  return group.weight >= 3 || String(group.sourceSet ?? "").endsWith(".strong");
}

function scoreKind(kind, content, metadata) {
  let score = 0;
  let strongHits = 0;
  let hits = 0;
  const matched = { positive: [], negative: [], metadata: [], regex: [] };
  const signals = [];

  for (const m of kind.metadata ?? []) {
    const val =
      m.field === "hasImage" ? hasImage(metadata) : m.field === "hasCodeBlock" ? hasCodeBlock(content.raw) : false;
    if (val === m.equals) {
      if (m.exclude) return { eligible: false, score: 0, strongHits: 0, hits: 0, matched, signals: [] };
      score += m.weight;
      hits += 1;
      matched.metadata.push({ field: m.field, weight: m.weight });
      signals.push(`meta:${m.field}(${m.weight})`);
    }
  }

  for (const r of kind.regex ?? []) {
    if (!r.pattern) continue;
    try {
      const re = new RegExp(r.pattern, r.flags ?? "i");
      if (re.test(content.raw)) {
        score += r.weight;
        hits += 1;
        matched.regex.push({ pattern: r.pattern, weight: r.weight });
        signals.push(`re:${r.pattern}(${r.weight})`);
      }
    } catch {
      // ignore
    }
  }

  for (const group of kind.positive ?? []) {
    for (const term of group.keywords ?? []) {
      if (!term) continue;
      if (contentContains(content, term)) {
        if (group.exclude) return { eligible: false, score: 0, strongHits: 0, hits: 0, matched, signals: [] };
        score += group.weight;
        hits += 1;
        if (isStrongGroup(group)) strongHits += 1;
        matched.positive.push({ set: group.sourceSet, term, weight: group.weight });
        signals.push(`+${group.weight}:${group.sourceSet}`);
      }
    }
  }

  for (const group of kind.negative ?? []) {
    for (const term of group.keywords ?? []) {
      if (!term) continue;
      if (contentContains(content, term)) {
        if (group.exclude) return { eligible: false, score: 0, strongHits: 0, hits: 0, matched, signals: [] };
        score += group.weight;
        hits += 1;
        matched.negative.push({ set: group.sourceSet, term, weight: group.weight });
        signals.push(`${group.weight}:${group.sourceSet}`);
      }
    }
  }

  const minStrongHits = kind.thresholds?.minStrongHits ?? 0;
  const minScore = kind.thresholds?.minScore ?? 2;
  if (strongHits < minStrongHits) return { eligible: false, score, strongHits, hits, matched, signals };
  if (score < minScore) return { eligible: false, score, strongHits, hits, matched, signals };

  return { eligible: true, score, strongHits, hits, matched, signals };
}

function routeByWeightedRules(params) {
  const maxExplainTerms = params.maxExplainTerms ?? 10;
  const contentN = normalizeContent(params.content);

  const fallbackKindId = String(params.rules.defaultFallbackKind ?? "chat").trim() || "chat";

  const enabledKinds = (params.rules.kinds ?? [])
    .filter((k) => k.enabled !== false)
    .filter((k) => k.id !== "chat")
    .filter((k) => k.id !== fallbackKindId);

  let best = null;
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
  const conf = best.scored.score >= thresholds.highScore ? "high" : best.scored.score >= thresholds.minScore ? "medium" : "low";

  const mp = best.scored.matched.positive.slice(0, maxExplainTerms);
  const mn = best.scored.matched.negative.slice(0, maxExplainTerms);

  return {
    kind: best.kind.id,
    confidence: conf,
    score: best.scored.score,
    strongHits: best.scored.strongHits,
    hits: best.scored.hits,
    reason: `Weighted match: kind='${best.kind.id}' score=${best.scored.score} strongHits=${best.scored.strongHits} hits=${best.scored.hits} confidence=${conf}`,
    signals: best.scored.signals.slice(0, 30),
    matched: { positive: mp, negative: mn, metadata: best.scored.matched.metadata, regex: best.scored.matched.regex },
  };
}

function applySetOverlay(base, add, remove) {
  const rm = new Set((remove ?? []).map((x) => String(x).trim()).filter(Boolean));
  const out = [];
  for (const x of base ?? []) {
    const t = String(x).trim();
    if (!t) continue;
    if (rm.has(t)) continue;
    out.push(t);
  }
  for (const x of add ?? []) {
    const t = String(x).trim();
    if (!t) continue;
    out.push(t);
  }
  // dedup
  const seen = new Set();
  const dedup = [];
  for (const x of out) {
    if (seen.has(x)) continue;
    seen.add(x);
    dedup.push(x);
  }
  return dedup;
}

function compileKeywordLibrary(lib, overrides) {
  const warnings = [];

  const finalSets = {};
  for (const [setId, baseList] of Object.entries(lib.keywordSets ?? {})) {
    const overlay = overrides?.sets?.[setId];
    finalSets[setId] = applySetOverlay(baseList ?? [], overlay?.add, overlay?.remove);
  }
  for (const setId of Object.keys(overrides?.sets ?? {})) {
    if (!(setId in (lib.keywordSets ?? {}))) warnings.push(`overrides: unknown set '${setId}' (ignored)`);
  }

  const defaultFallbackKind = String(lib.defaultFallbackKind ?? "chat");

  const compiledKinds = [];
  for (const [kindId, k] of Object.entries(lib.kinds ?? {})) {
    const enabledBase = k.enabled !== false;
    const enabledOverride = overrides?.kinds?.[kindId]?.enabled;
    const enabled = typeof enabledOverride === "boolean" ? enabledOverride : enabledBase;

    const expand = (arr) => {
      const out = [];
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
      positive: expand(k.signals?.positive),
      negative: expand(k.signals?.negative),
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

  compiledKinds.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return {
    compiled: { version: 1, compiledAt: new Date().toISOString(), defaultFallbackKind, kinds: compiledKinds },
    warnings,
  };
}

function mergeKeywordSetsFromCodingLibraryDraft(baseLib, codingDraft) {
  const out = JSON.parse(JSON.stringify(baseLib));
  out.keywordSets = out.keywordSets ?? {};

  // Merge all sets from part2/part3/part4_patch into keywordSets.
  const additions = [];

  const take = (part) => {
    if (!part || !part.keywordSets) return;
    for (const [setId, list] of Object.entries(part.keywordSets)) {
      if (!Array.isArray(list)) continue;
      if (!(setId in out.keywordSets)) {
        out.keywordSets[setId] = list;
        additions.push(setId);
      } else {
        // merge and dedup
        const merged = [...(out.keywordSets[setId] ?? []), ...list].map(String);
        const seen = new Set();
        const dedup = [];
        for (const t of merged) {
          const s = String(t);
          if (!s) continue;
          if (seen.has(s)) continue;
          seen.add(s);
          dedup.push(s);
        }
        out.keywordSets[setId] = dedup;
      }
    }
  };

  take(codingDraft?.part2);
  take(codingDraft?.part3);
  take(codingDraft?.part4_patch);

  return { mergedLib: out, addedSets: additions };
}

function main() {
  const repoRootUrl = new URL("..", import.meta.url);
  const repoRoot = fileURLToPath(repoRootUrl);
  const toolsDir = path.join(repoRoot, "tools", "soft-router-suggest");

  const baseLibPath = path.join(toolsDir, "keyword-library.json");
  const draftPath = path.join(repoRoot, "coding关键词库.txt");
  const samplesPath = path.join(repoRoot, "scripts", "regression-coding-fp.samples.json");

  const baseLib = JSON.parse(fs.readFileSync(baseLibPath, "utf8"));
  const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
  const samples = JSON.parse(fs.readFileSync(samplesPath, "utf8"));

  // (1) Current library run
  const { compiled: compiledCurrent } = compileKeywordLibrary(baseLib, null);

  // (2) Patched run: merge new sets; we DO NOT automatically wire them into kinds.coding here.
  // We only want to estimate *risk surface* from additional tokens existing in library sets.
  // For a conservative worst-case, we temporarily add these sets to coding positive signals.
  const { mergedLib } = mergeKeywordSetsFromCodingLibraryDraft(baseLib, draft);

  // Worst-case wiring: add all new sets to coding positive (weight=1) but keep coding thresholds.
  const codingKind = mergedLib.kinds?.coding;
  if (codingKind?.signals?.positive) {
    const allNewSetIds = Object.keys(mergedLib.keywordSets).filter((id) =>
      id.startsWith("coding.feature.") || id.startsWith("coding.scenario.") || id.startsWith("coding.lang."),
    );
    for (const setId of allNewSetIds) {
      codingKind.signals.positive.push({ set: setId, weight: 1, match: "contains" });
    }
  }

  const { compiled: compiledWorstCase, warnings } = compileKeywordLibrary(mergedLib, null);

  const run = (compiled) => {
    const results = [];
    for (const s of samples) {
      const d = routeByWeightedRules({ rules: compiled, content: s.text, metadata: {} });
      results.push({ id: s.id, kind: d.kind, score: d.score, confidence: d.confidence, reason: d.reason, text: s.text, matched: d.matched });
    }
    return results;
  };

  const cur = run(compiledCurrent);
  const worst = run(compiledWorstCase);

  const summarize = (arr) => {
    const total = arr.length;
    const codingHits = arr.filter((x) => x.kind === "coding");
    const high = codingHits.filter((x) => x.confidence === "high").length;
    const med = codingHits.filter((x) => x.confidence === "medium").length;
    const low = codingHits.filter((x) => x.confidence === "low").length;
    return { total, codingHits: codingHits.length, codingHigh: high, codingMedium: med, codingLow: low };
  };

  const report = {
    generatedAt: new Date().toISOString(),
    warnings,
    summary: {
      current: summarize(cur),
      worstCasePatched: summarize(worst),
    },
    falsePositivesWorstCase: worst
      .filter((x) => x.kind === "coding")
      .map((x) => ({
        id: x.id,
        kind: x.kind,
        score: x.score,
        confidence: x.confidence,
        text: x.text,
        matchedPositive: x.matched.positive.slice(0, 8),
        matchedMetadata: x.matched.metadata,
        matchedRegex: x.matched.regex,
      })),
  };

  const outPath = path.join(repoRoot, "scripts", "regression-coding-fp.report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(outPath);
}

main();
