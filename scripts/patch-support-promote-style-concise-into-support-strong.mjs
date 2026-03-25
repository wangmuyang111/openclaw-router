import fs from 'node:fs';

const PATH = 'tools/soft-router-suggest/keyword-library.json';
const lib = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const normalization = lib.normalization ?? { lowercase: true, trim: true, collapseWhitespace: true };
const norm = (s) => {
  let x = String(s ?? '');
  if (normalization.trim !== false) x = x.trim();
  if (normalization.collapseWhitespace) x = x.replace(/\s+/g, ' ');
  if (normalization.lowercase) x = x.toLowerCase();
  return x;
};

function mergeUnique(into, from) {
  const out = Array.isArray(into) ? [...into] : [];
  const seen = new Set(out.map(norm));
  const added = [];
  for (const t of Array.isArray(from) ? from : []) {
    const n = norm(t);
    if (!n || seen.has(n)) continue;
    out.push(t);
    seen.add(n);
    added.push(t);
  }
  return { out, added };
}

const strongId = 'support.strong';
const conciseId = 'style.concise';

const beforeStrong = Array.isArray(lib.keywordSets?.[strongId]) ? lib.keywordSets[strongId] : [];
const concise = Array.isArray(lib.keywordSets?.[conciseId]) ? lib.keywordSets[conciseId] : [];

const merged = mergeUnique(beforeStrong, concise);
lib.keywordSets[strongId] = merged.out;

fs.writeFileSync(PATH, JSON.stringify(lib, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      ok: true,
      action: 'promote style.concise into support.strong',
      supportStrong: {
        before: beforeStrong.length,
        concise: concise.length,
        addedFromConcise: merged.added.length,
        after: merged.out.length
      },
      note: 'Per request: A类(支持执行动作) + C类(总结/概括) must be strong keywords; others left unchanged.'
    },
    null,
    2
  )
);
