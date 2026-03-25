import fs from 'node:fs';

const PATH = 'tools/soft-router-suggest/keyword-library.json';
const lib = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const normalization = lib.normalization ?? {};
function normalizeToken(x) {
  let s = String(x ?? '');
  if (normalization.trim !== false) s = s.trim();
  if (normalization.collapseWhitespace) s = s.replace(/\s+/g, ' ');
  if (normalization.lowercase) s = s.toLowerCase();
  return s;
}

const weakSetId = 'coding.weak';
const weak = Array.isArray(lib.keywordSets?.[weakSetId]) ? lib.keywordSets[weakSetId] : [];

// These were “moved into strong”; remove their tokens from coding.weak to avoid overlap/double-counting.
const promotedSourceSets = [
  'coding.lang.full',
  'coding.lang.abbrev.safe',
  'coding.lang.file_ext',
  'coding.feature.error_codes'
  // NOTE: coding.regex.medium is regex patterns; not meaningful to remove from coding.weak
];

const promotedTokensNorm = new Set();
for (const setId of promotedSourceSets) {
  const arr = lib.keywordSets?.[setId];
  if (!Array.isArray(arr)) continue;
  for (const t of arr) {
    const n = normalizeToken(t);
    if (n) promotedTokensNorm.add(n);
  }
}

const beforeCount = weak.length;
const removed = [];
const kept = [];
for (const t of weak) {
  const n = normalizeToken(t);
  if (promotedTokensNorm.has(n)) {
    removed.push(t);
  } else {
    kept.push(t);
  }
}

lib.keywordSets[weakSetId] = kept;
fs.writeFileSync(PATH, JSON.stringify(lib, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      ok: true,
      weakSetId,
      beforeCount,
      removedCount: removed.length,
      afterCount: kept.length,
      removedSample: removed.slice(0, 50)
    },
    null,
    2
  )
);
