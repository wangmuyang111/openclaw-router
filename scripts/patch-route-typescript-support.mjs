import fs from "node:fs";

const p = "tools/soft-router-suggest/keyword-library.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));

// 1) Add coding regex for TypeScript/debounce (strong signals, weight>=3)
j.kinds = j.kinds || {};
j.kinds.coding = j.kinds.coding || {};
j.kinds.coding.signals = j.kinds.coding.signals || {};
const rx = (j.kinds.coding.signals.regex = j.kinds.coding.signals.regex || []);

function addRegex(pattern, flags, weight) {
  if (rx.some((r) => r.pattern === pattern && String(r.flags || "") === String(flags || "") && Number(r.weight) === Number(weight))) {
    return false;
  }
  rx.push({ pattern, flags, weight });
  return true;
}

const added = [];
if (addRegex("\\bTypeScript\\b", "i", 3)) added.push("TypeScript");
if (addRegex("\\bdebounce\\b", "i", 3)) added.push("debounce");

// 2) Remove ambiguous '支持' from support.weak contains set (it appears in coding requirements like '支持 cancel()')
j.keywordSets = j.keywordSets || {};
if (Array.isArray(j.keywordSets["support.weak"])) {
  const before = j.keywordSets["support.weak"].length;
  j.keywordSets["support.weak"] = j.keywordSets["support.weak"].filter((t) => t !== "支持");
  const after = j.keywordSets["support.weak"].length;
  if (before !== after) {
    added.push("remove:support.weak:支持");
  }
}

j.updatedAt = new Date().toISOString();
if (added.length) {
  j.notes = (j.notes || "") + `\n[route-fix] ${added.join(", ")}`;
}

fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");

console.log("patched", { added, codingRegexCount: rx.length, hasSupportZhiChi: (j.keywordSets["support.weak"] || []).includes("支持") });
