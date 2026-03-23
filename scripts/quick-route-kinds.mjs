import fs from "node:fs";

const lib = JSON.parse(fs.readFileSync(new URL("../tools/soft-router-suggest/keyword-library.json", import.meta.url), "utf8"));

function normalizeContent(s) {
  const raw = String(s ?? "");
  return { raw, lower: raw.toLowerCase() };
}

function contentContains(content, term) {
  if (!term) return false;
  return content.raw.includes(term) || content.lower.includes(String(term).toLowerCase());
}

function hasCodeBlock(content) {
  return String(content ?? "").includes("```");
}

function scoreKind(kind, content) {
  let score = 0;
  let strongHits = 0;
  let hits = 0;
  const matched = { positive: [], negative: [], metadata: [], regex: [] };
  const signals = [];

  for (const m of kind.metadata ?? []) {
    if (m.field === "hasCodeBlock") {
      const val = hasCodeBlock(content.raw);
      if (val === m.equals) {
        score += m.weight;
        hits += 1;
        matched.metadata.push({ field: m.field, weight: m.weight });
        signals.push(`meta:${m.field}(${m.weight})`);
      }
    }
  }

  for (const r of kind.regex ?? []) {
    const re = new RegExp(r.pattern, r.flags ?? "i");
    if (re.test(content.raw)) {
      score += r.weight;
      hits += 1;
      if (r.weight >= 3) strongHits += 1;
      matched.regex.push({ pattern: r.pattern, weight: r.weight });
      signals.push(`re:${r.pattern}(${r.weight})`);
    }
  }

  for (const group of kind.positive ?? []) {
    for (const term of group.keywords ?? []) {
      if (contentContains(content, term)) {
        score += group.weight;
        hits += 1;
        if (group.weight >= 3 || String(group.sourceSet).endsWith(".strong")) strongHits += 1;
        matched.positive.push({ set: group.sourceSet, term, weight: group.weight });
        signals.push(`+${group.weight}:${group.sourceSet}`);
      }
    }
  }

  for (const group of kind.negative ?? []) {
    for (const term of group.keywords ?? []) {
      if (contentContains(content, term)) {
        score += group.weight;
        hits += 1;
        matched.negative.push({ set: group.sourceSet, term, weight: group.weight });
        signals.push(`${group.weight}:${group.sourceSet}`);
      }
    }
  }

  const minStrongHits = kind.thresholds?.minStrongHits ?? 0;
  const minScore = kind.thresholds?.minScore ?? 2;
  const eligible = strongHits >= minStrongHits && score >= minScore;
  return { eligible, score, strongHits, hits, matched, signals };
}

function compileKind(kindId) {
  const sets = lib.keywordSets ?? {};
  const k = lib.kinds[kindId];
  if (!k) throw new Error(`missing kind ${kindId}`);

  const expand = (arr) =>
    (arr ?? []).map((s) => ({
      sourceSet: s.set,
      keywords: sets[s.set] ?? [],
      weight: Number(s.weight ?? 0),
      match: s.match ?? "contains",
      exclude: Boolean(s.exclude),
    }));

  return {
    id: kindId,
    priority: k.priority,
    metadata: k.signals?.metadata ?? [],
    regex: k.signals?.regex ?? [],
    positive: expand(k.signals?.positive),
    negative: expand(k.signals?.negative),
    thresholds: k.thresholds ?? { minScore: 2, minStrongHits: 1, highScore: 6 },
  };
}

const text = process.argv.slice(2).join(" ") || "给我一些优化建议，怎么把这个流程做得更顺？";
const content = normalizeContent(text);

const kindIds = ["coding", "support", "general", "strategy"];
const scored = kindIds.map((id) => ({ id, ...scoreKind(compileKind(id), content) }));
scored.sort((a, b) => b.score - a.score || b.strongHits - a.strongHits);

console.log(
  JSON.stringify(
    {
      text,
      scored: scored.map((s) => ({
        id: s.id,
        eligible: s.eligible,
        score: s.score,
        strongHits: s.strongHits,
        hits: s.hits,
        signals: s.signals.slice(0, 12),
        matched: {
          positive: s.matched.positive.slice(0, 8),
          regex: s.matched.regex.slice(0, 4),
          negative: s.matched.negative.slice(0, 4),
          metadata: s.matched.metadata,
        },
      })),
    },
    null,
    2,
  ),
);
