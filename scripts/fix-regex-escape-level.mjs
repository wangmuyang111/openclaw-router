import fs from "node:fs";

const libPath = new URL("../tools/soft-router-suggest/keyword-library.json", import.meta.url);
const lib = JSON.parse(fs.readFileSync(libPath, "utf8"));

function fixPattern(s) {
  // Reduce double-escaped backslashes: "\\\\b" -> "\\b"
  // In JS string terms: "\\b" should be one backslash + 'b' (regex word boundary),
  // but we currently have two backslashes.
  let out = String(s);
  // Apply repeatedly in case of deeper escaping.
  for (let i = 0; i < 4; i++) {
    const next = out.replaceAll("\\\\", "\\");
    if (next === out) break;
    out = next;
  }
  return out;
}

let changed = 0;

// Fix regex keywordSets
for (const setId of ["coding.regex.strong", "coding.regex.medium"]) {
  const arr = lib.keywordSets?.[setId];
  if (!Array.isArray(arr)) continue;
  const fixed = arr.map(fixPattern);
  const same = fixed.every((v, i) => v === arr[i]);
  if (!same) {
    lib.keywordSets[setId] = fixed;
    changed += 1;
  }
}

// Fix coding kind regex signals
const rx = lib.kinds?.coding?.signals?.regex;
if (Array.isArray(rx)) {
  for (const r of rx) {
    const before = String(r.pattern ?? "");
    const after = fixPattern(before);
    if (after !== before) {
      r.pattern = after;
      changed += 1;
    }
  }
}

lib.updatedAt = new Date().toISOString();
lib.notes = (lib.notes || "") + "\n[fix] normalize regex pattern escape level (\\\\ -> \\\) so RegExp() receives real regex escapes.";

fs.writeFileSync(libPath, JSON.stringify(lib, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ file: libPath.pathname, changed }, null, 2));
