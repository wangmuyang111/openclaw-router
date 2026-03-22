import fs from "node:fs";

const libPath = new URL("../tools/soft-router-suggest/keyword-library.json", import.meta.url);
const lib = JSON.parse(fs.readFileSync(libPath, "utf8"));

const sets = (lib.keywordSets ?? {});

function removeFromSet(setId, terms) {
  const arr = sets[setId];
  if (!Array.isArray(arr)) return { setId, removed: 0 };
  const rm = new Set(terms);
  const before = arr.length;
  sets[setId] = arr.filter((t) => !rm.has(t));
  return { setId, removed: before - sets[setId].length };
}

function addToSet(setId, terms) {
  if (!Array.isArray(sets[setId])) sets[setId] = [];
  const seen = new Set(sets[setId]);
  let added = 0;
  for (const t of terms) {
    if (!seen.has(t)) {
      sets[setId].push(t);
      seen.add(t);
      added += 1;
    }
  }
  return { setId, added };
}

const removals = [
  removeFromSet("coding.strong", ["pip", "CI", "pipeline"]),
  removeFromSet("coding.weak", ["pip", "CI", "pipeline"]),
];

const additions = [
  addToSet("coding.weak", ["pip install", "pip3 install", "CI/CD", "GitHub Actions"]),
];

lib.keywordSets = sets;
lib.updatedAt = new Date().toISOString();

const patchNote = "[patch] remove ambiguous tokens (pip/CI/pipeline) from coding.*; add safer variants (pip install, CI/CD, GitHub Actions).";
lib.notes = lib.notes ? String(lib.notes) + "\n" + patchNote : patchNote;

fs.writeFileSync(libPath, JSON.stringify(lib, null, 2) + "\n", "utf8");

console.log(JSON.stringify({ libPath: libPath.pathname, removals, additions }, null, 2));
