import fs from "node:fs";

const libPath = new URL("../tools/soft-router-suggest/keyword-library.json", import.meta.url);
const lib = JSON.parse(fs.readFileSync(libPath, "utf8"));

lib.keywordSets = lib.keywordSets || {};

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr ?? []) {
    const s = String(x);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function removeTerms(setId, terms) {
  const arr = lib.keywordSets[setId];
  if (!Array.isArray(arr)) return { setId, removed: 0 };
  const rm = new Set(terms);
  const before = arr.length;
  lib.keywordSets[setId] = arr.filter((t) => !rm.has(t));
  return { setId, removed: before - lib.keywordSets[setId].length };
}

function addTerms(setId, terms) {
  lib.keywordSets[setId] = uniq([...(lib.keywordSets[setId] || []), ...terms]);
  return { setId, added: terms.length };
}

// 1) Remove ambiguous short tokens from contains keyword sets (they caused substring FPs: pipeline->pip, conCIse->CI)
const ambiguous = ["pip", "CI", "pipeline"];
const removals = [removeTerms("coding.strong", ambiguous), removeTerms("coding.weak", ambiguous)];

// 2) Add safer contains variants
const additions = [
  addTerms("coding.strong", ["pip install", "pip3 install", "CI/CD", "GitHub Actions"]),
  addTerms("coding.weak", ["python -m pip", "CI/CD", "GitHub Actions", "GitLab CI", "CI pipeline", "build pipeline"]),
];

// 3) Add regex signals with word boundaries / contextual patterns
lib.kinds = lib.kinds || {};
lib.kinds.coding = lib.kinds.coding || {};
lib.kinds.coding.signals = lib.kinds.coding.signals || { positive: [], negative: [], metadata: [], regex: [] };
lib.kinds.coding.signals.regex = lib.kinds.coding.signals.regex || [];

function ensureRegex(pattern, weight, flags = "i") {
  if (lib.kinds.coding.signals.regex.some((r) => String(r.pattern) === pattern && String(r.flags ?? "i") === flags)) {
    return false;
  }
  lib.kinds.coding.signals.regex.push({ pattern, flags, weight });
  return true;
}

// Ensure regex sets exist for visibility
lib.keywordSets["coding.regex.strong"] = uniq([
  ...(lib.keywordSets["coding.regex.strong"] || []),
  // word-boundary tokens
  String.raw`\\bpip\\b`,
  String.raw`\\bCI\\b`,
  // contextual pipeline only (avoid sales pipeline)
  String.raw`\\b(?:CI\/CD|CI|build|deploy)\\s+pipeline\\b`,
  // common error code signatures
  String.raw`\\bTS\\d{4}\\b`,
  String.raw`\\bCS\\d{4}\\b`,
  String.raw`\\bORA-\\d{4,5}\\b`,
  String.raw`\\bSQLSTATE\\b`,
]);

lib.keywordSets["coding.regex.medium"] = uniq([
  ...(lib.keywordSets["coding.regex.medium"] || []),
  String.raw`^npm\\s+ERR!`,
  String.raw`^Traceback \\(most recent call last\\):`,
  String.raw`\\berror\\[E\\d{4}\\]`,
]);

// Remove overly-broad pipeline boundary if previously added
lib.kinds.coding.signals.regex = lib.kinds.coding.signals.regex.filter((r) => String(r.pattern) !== String.raw`\\bpipeline\\b`);
lib.keywordSets["coding.regex.strong"] = (lib.keywordSets["coding.regex.strong"] || []).filter(
  (x) => String(x) !== String.raw`\\bpipeline\\b`,
);

let addedRegex = 0;
for (const pat of lib.keywordSets["coding.regex.strong"]) {
  if (ensureRegex(pat, 3, "i")) addedRegex += 1;
}
for (const pat of lib.keywordSets["coding.regex.medium"]) {
  if (ensureRegex(pat, 2, "i")) addedRegex += 1;
}

lib.updatedAt = new Date().toISOString();
const patchNote = "[scheme B] move ambiguous short tokens (pip/CI/pipeline) out of contains sets; reintroduce via regex word-boundary/context patterns.";
lib.notes = lib.notes ? String(lib.notes) + "\n" + patchNote : patchNote;

fs.writeFileSync(libPath, JSON.stringify(lib, null, 2) + "\n", "utf8");

console.log(JSON.stringify({ file: libPath.pathname, removals, additions, addedRegex, totalRegex: lib.kinds.coding.signals.regex.length }, null, 2));
