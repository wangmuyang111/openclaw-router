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

  for (const m of kind.metadata ?? []) {
    if (m.field === "hasCodeBlock") {
      const val = hasCodeBlock(content.raw);
      if (val === m.equals) {
        score += m.weight;
        hits += 1;
        matched.metadata.push({ field: m.field, weight: m.weight });
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
    }
  }

  for (const group of kind.positive ?? []) {
    for (const term of group.keywords ?? []) {
      if (contentContains(content, term)) {
        score += group.weight;
        hits += 1;
        if (group.weight >= 3 || String(group.sourceSet).endsWith(".strong")) strongHits += 1;
        matched.positive.push({ set: group.sourceSet, term, weight: group.weight });
      }
    }
  }

  for (const group of kind.negative ?? []) {
    for (const term of group.keywords ?? []) {
      if (contentContains(content, term)) {
        score += group.weight;
        hits += 1;
        matched.negative.push({ set: group.sourceSet, term, weight: group.weight });
      }
    }
  }

  const minStrongHits = kind.thresholds?.minStrongHits ?? 0;
  const minScore = kind.thresholds?.minScore ?? 2;
  const eligible = strongHits >= minStrongHits && score >= minScore;

  return { eligible, score, strongHits, hits, matched };
}

function compileCoding(lib) {
  const sets = lib.keywordSets ?? {};
  const k = lib.kinds.coding;

  const expand = (arr) =>
    (arr ?? []).map((s) => ({
      sourceSet: s.set,
      keywords: sets[s.set] ?? [],
      weight: Number(s.weight ?? 0),
    }));

  return {
    metadata: k.signals?.metadata ?? [],
    regex: k.signals?.regex ?? [],
    positive: expand(k.signals?.positive),
    negative: expand(k.signals?.negative),
    thresholds: k.thresholds ?? { minScore: 2, minStrongHits: 1, highScore: 6 },
  };
}

const text = process.argv.slice(2).join(" ") || "给我一个 SQL：从 orders(user_id, amount, created_at) 里查最近 7 天每个 user 的总金额、订单数，按总金额降序";
const coding = compileCoding(lib);
const res = scoreKind(coding, normalizeContent(text));
console.log(JSON.stringify({ text, thresholds: coding.thresholds, ...res }, null, 2));
