import fs from "node:fs";

const p = "tools/soft-router-suggest/keyword-library.json";
const lib = JSON.parse(fs.readFileSync(p, "utf8"));

if (!lib.kinds?.coding) throw new Error("missing kinds.coding");
lib.keywordSets = lib.keywordSets || {};

const allCodingSetIds = Object.keys(lib.keywordSets)
  .filter((id) => id.startsWith("coding."))
  .filter((id) => id !== "coding.negative")
  .filter((id) => id !== "coding.abbrev.risky_reference_only") // reference-only (too ambiguous)
  .sort();

// Weight policy:
// - keep true strong sets strong: *.strong and coding.strong -> weight 3
// - everything else participates but is weak: weight 1 (won't satisfy minStrongHits)
function weightFor(setId) {
  if (setId === "coding.strong") return 3;
  if (setId.endsWith(".strong")) return 3;
  return 1;
}

lib.kinds.coding.signals = lib.kinds.coding.signals || { positive: [], negative: [], metadata: [], regex: [] };
lib.kinds.coding.signals.positive = allCodingSetIds.map((set) => ({
  set,
  weight: weightFor(set),
  match: "contains",
}));

lib.updatedAt = new Date().toISOString();
lib.notes = (lib.notes || "") +
  "\n[tighten] keep ALL coding.* sets wired, but down-weight non-strong sets to 1; keep *.strong and coding.strong at 3. Exclude coding.abbrev.risky_reference_only from positive.";

fs.writeFileSync(p, JSON.stringify(lib, null, 2) + "\n", "utf8");

const stats = { totalWired: lib.kinds.coding.signals.positive.length, strong: 0, weak: 0 };
for (const x of lib.kinds.coding.signals.positive) {
  if (x.weight >= 3 || String(x.set).endsWith(".strong") || x.set === "coding.strong") stats.strong += 1;
  else stats.weak += 1;
}
console.log(JSON.stringify(stats, null, 2));
