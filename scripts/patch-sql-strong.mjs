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

const setId = "coding.lang.sql.strong";
const terms = ["SQL", "SQL:", "SQL：", "NoSQL", "PostgreSQL", "Postgres", "MySQL", "SQLite"]; // keep short+distinct
lib.keywordSets[setId] = uniq([...(lib.keywordSets[setId] || []), ...terms]);

lib.kinds = lib.kinds || {};
lib.kinds.coding = lib.kinds.coding || {};
lib.kinds.coding.signals = lib.kinds.coding.signals || { positive: [], negative: [], metadata: [], regex: [] };
lib.kinds.coding.signals.positive = lib.kinds.coding.signals.positive || [];

if (!lib.kinds.coding.signals.positive.some((x) => x.set === setId)) {
  lib.kinds.coding.signals.positive.push({ set: setId, weight: 2, match: "contains" });
}

lib.updatedAt = new Date().toISOString();
const note =
  "[sql] wire coding.lang.sql.strong (weight=2) so natural-language prompts that mention 'SQL' (without SELECT/FROM) still hit coding under minStrongHits=1.";
lib.notes = lib.notes ? String(lib.notes) + "\n" + note : note;

fs.writeFileSync(libPath, JSON.stringify(lib, null, 2) + "\n", "utf8");

console.log(JSON.stringify({ setId, size: lib.keywordSets[setId].length }, null, 2));
