import fs from "node:fs";

const libPath = new URL("../tools/soft-router-suggest/keyword-library.json", import.meta.url);
const draftPath = new URL("../coding关键词库.txt", import.meta.url);

const lib = JSON.parse(fs.readFileSync(libPath, "utf8"));
const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));

lib.keywordSets = lib.keywordSets || {};

function dedup(list) {
  const out = [];
  const seen = new Set();
  for (const x of list ?? []) {
    const s = String(x);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function mergeSets(from, label) {
  if (!from || !from.keywordSets) return { label, merged: 0, created: 0 };
  let merged = 0;
  let created = 0;
  for (const [setId, arr] of Object.entries(from.keywordSets)) {
    if (!Array.isArray(arr)) continue;
    if (!lib.keywordSets[setId]) {
      lib.keywordSets[setId] = dedup(arr);
      created += 1;
      continue;
    }
    const before = lib.keywordSets[setId].length;
    lib.keywordSets[setId] = dedup([...(lib.keywordSets[setId] || []), ...arr]);
    if (lib.keywordSets[setId].length !== before) merged += 1;
  }
  return { label, merged, created };
}

const stats = [];
stats.push(mergeSets(draft, "part1_root"));
stats.push(mergeSets(draft.part2, "part2"));
stats.push(mergeSets(draft.part3, "part3"));
stats.push(mergeSets(draft.part4_patch, "part4_patch"));

lib.updatedAt = new Date().toISOString();
const note = "[sync] merged coding keyword draft (coding关键词库.txt part1/2/3/4) keywordSets into keyword-library.json (sets only; not auto-wired).";
lib.notes = lib.notes ? String(lib.notes) + "\n" + note : note;

fs.writeFileSync(libPath, JSON.stringify(lib, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ file: libPath.pathname, stats }, null, 2));
