import fs from "node:fs";

const p = "tools/soft-router-suggest/keyword-library.json";
const lib = JSON.parse(fs.readFileSync(p, "utf8"));

lib.kinds = lib.kinds || {};
lib.keywordSets = lib.keywordSets || {};

const coding = lib.kinds.coding;
if (!coding) throw new Error("missing kinds.coding");
coding.signals = coding.signals || { positive: [], negative: [], metadata: [], regex: [] };

// Wire *all* coding.* keyword sets into coding positive signals with strong weight.
const allCodingSetIds = Object.keys(lib.keywordSets)
  .filter((id) => id.startsWith("coding."))
  // keep negative sets out of positive wiring
  .filter((id) => id !== "coding.negative")
  .sort();

coding.signals.positive = allCodingSetIds.map((set) => ({ set, weight: 3, match: "contains" }));

// Keep existing negative/metadata/regex as-is.

lib.updatedAt = new Date().toISOString();
lib.notes = (lib.notes || "") + `\n[wiring] wire ALL coding.* keywordSets into kinds.coding positive (weight=3).`;

fs.writeFileSync(p, JSON.stringify(lib, null, 2) + "\n", "utf8");

console.log(
  JSON.stringify(
    {
      codingPositiveCount: coding.signals.positive.length,
      sample: coding.signals.positive.slice(0, 10).map((x) => x.set),
    },
    null,
    2,
  ),
);
