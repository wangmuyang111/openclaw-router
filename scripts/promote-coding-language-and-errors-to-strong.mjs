import fs from 'node:fs';

const path = 'tools/soft-router-suggest/keyword-library.json';
const lib = JSON.parse(fs.readFileSync(path, 'utf8'));

const sets = lib.keywordSets;
const positive = lib?.kinds?.coding?.signals?.positive;
if (!sets || !positive) throw new Error('Missing keywordSets or kinds.coding.signals.positive');

const promotions = [
  // 语言名（如 PHP/Python/Rust...）
  { from: 'coding.lang.full', to: 'coding.lang.full.strong' },
  // 脚本/文件后缀特征（.py/.ps1/...）
  { from: 'coding.lang.file_ext', to: 'coding.lang.file_ext.strong' },
  // 报错提示词（npm ERR / Traceback / error[E1234] 等“典型错误行”）
  { from: 'coding.regex.medium', to: 'coding.regex.medium.strong' },
  // 缩写（JS/TS/JVM/.NET/dotnet/CLR…）
  { from: 'coding.lang.abbrev.safe', to: 'coding.lang.abbrev.safe.strong' },
  // 错误码/报错短语（TSxxxx/CSxxxx/SQLSTATE/ORA-/ERROR 1064…）
  { from: 'coding.feature.error_codes', to: 'coding.feature.error_codes.strong' }
];

function ensureSetPromoted(from, to) {
  if (!Array.isArray(sets[from])) throw new Error(`Missing set: ${from}`);
  // “移入强关键词”：确保 strong set 至少包含 from set 的全部项（若已存在则做并集，避免丢词）
  const fromArr = sets[from];
  const toArr = Array.isArray(sets[to]) ? sets[to] : [];
  const merged = [...new Set([...toArr, ...fromArr])];
  sets[to] = merged;
}

function removePositiveRuleBySet(setName) {
  const idx = positive.findIndex((r) => r?.set === setName);
  if (idx === -1) return -1;
  positive.splice(idx, 1);
  return idx;
}

function upsertStrongPositiveRule(setName, insertAt = -1) {
  const existing = positive.find((r) => r?.set === setName);
  if (existing) {
    existing.weight = 3;
    existing.match = existing.match ?? 'contains';
    return;
  }
  const rule = { set: setName, weight: 3, match: 'contains' };
  if (insertAt >= 0 && insertAt <= positive.length) positive.splice(insertAt, 0, rule);
  else positive.push(rule);
}

for (const { from, to } of promotions) {
  ensureSetPromoted(from, to);
  // “移入强关键词”：移除弱 wiring（weight=1），保留/新增强 wiring（weight=3 且 set id 为 *.strong）
  const removedAt = removePositiveRuleBySet(from);
  upsertStrongPositiveRule(to, removedAt);
}

fs.writeFileSync(path, JSON.stringify(lib, null, 2) + '\n');
console.log('[ok] promoted language/abbrev/file-ext/error-prompts into strong (weight=3, *.strong ids)');
