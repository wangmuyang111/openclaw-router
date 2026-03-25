import fs from 'node:fs';
import { execSync } from 'node:child_process';

const PATH = 'tools/soft-router-suggest/keyword-library.json';
const BEFORE_REV = process.argv[2] ?? '90e6f76'; // parent of promotion commit

function readJsonAtGit(rev, path) {
  const txt = execSync(`git show ${rev}:${path}`, { encoding: 'utf8' });
  return JSON.parse(txt);
}

const before = readJsonAtGit(BEFORE_REV, PATH);
const after = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const promotions = [
  { from: 'coding.lang.full', to: 'coding.lang.full.strong', label: '语言名（全称）' },
  { from: 'coding.lang.abbrev.safe', to: 'coding.lang.abbrev.safe.strong', label: '语言/平台缩写（safe）' },
  { from: 'coding.lang.file_ext', to: 'coding.lang.file_ext.strong', label: '脚本/文件后缀' },
  { from: 'coding.feature.error_codes', to: 'coding.feature.error_codes.strong', label: '错误码/典型报错短语' },
  { from: 'coding.regex.medium', to: 'coding.regex.medium.strong', label: '报错提示 regex（中）' }
];

function setOf(lib, key) {
  const arr = lib.keywordSets?.[key];
  return new Set(Array.isArray(arr) ? arr : []);
}

const details = [];
let sumFrom = 0;
let sumInjected = 0;
const injectedUnion = new Set();

for (const p of promotions) {
  const bFrom = setOf(before, p.from);
  const bTo = setOf(before, p.to);
  const aTo = setOf(after, p.to);

  const injected = [...bFrom].filter((t) => !bTo.has(t));
  injected.forEach((t) => injectedUnion.add(t));

  details.push({
    label: p.label,
    from: p.from,
    to: p.to,
    fromCount: bFrom.size,
    beforeStrongCount: bTo.size,
    afterStrongCount: aTo.size,
    injectedToStrongCount: injected.length,
    netStrongSetGrowth: aTo.size - bTo.size
  });

  sumFrom += bFrom.size;
  sumInjected += injected.length;
}

// wiring changes
const posB = before.kinds?.coding?.signals?.positive ?? [];
const posA = after.kinds?.coding?.signals?.positive ?? [];
const getRule = (arr, set) => arr.find((r) => r?.set === set) ?? null;

const wiring = {
  positiveRulesBefore: posB.length,
  positiveRulesAfter: posA.length,
  removedWeakRuleSets: promotions.map((p) => p.from).filter((s) => getRule(posB, s) && !getRule(posA, s)),
  strongRuleSetsNowPresent: promotions.map((p) => p.to).filter((s) => !!getRule(posA, s)),
  strongRuleWeights: Object.fromEntries(promotions.map((p) => [p.to, { before: getRule(posB, p.to)?.weight ?? null, after: getRule(posA, p.to)?.weight ?? null }]))
};

const report = {
  beforeRev: BEFORE_REV,
  summary: {
    promotedSetCount: promotions.length,
    promotedTokenCount_sumOfFromSets: sumFrom,
    backfillTokenCount_sumInjectedIntoStrongSets: sumInjected,
    backfillTokenCount_uniqueInjectedUnion: injectedUnion.size
  },
  details,
  wiring
};

console.log(JSON.stringify(report, null, 2));
