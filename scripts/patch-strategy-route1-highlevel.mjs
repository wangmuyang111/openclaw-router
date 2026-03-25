import fs from 'node:fs';

const PATH = 'tools/soft-router-suggest/keyword-library.json';
const lib = JSON.parse(fs.readFileSync(PATH, 'utf8'));

if (!lib.keywordSets) throw new Error('missing keywordSets');
if (!lib.kinds?.strategy?.signals) throw new Error('missing kinds.strategy');

const normalization = lib.normalization ?? { lowercase: true, trim: true, collapseWhitespace: true };
const norm = (s) => {
  let x = String(s ?? '');
  if (normalization.trim !== false) x = x.trim();
  if (normalization.collapseWhitespace) x = x.replace(/\s+/g, ' ');
  if (normalization.lowercase) x = x.toLowerCase();
  return x;
};

function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const x of list ?? []) {
    const n = norm(x);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(x);
  }
  return out;
}

function removeTokens(list, tokensToRemove) {
  const rm = new Set(tokensToRemove.map(norm));
  return (list ?? []).filter((x) => !rm.has(norm(x)));
}

function addTokens(list, tokensToAdd) {
  const out = [...(list ?? [])];
  const seen = new Set(out.map(norm));
  for (const t of tokensToAdd) {
    const n = norm(t);
    if (!n) continue;
    if (seen.has(n)) continue;
    out.push(t);
    seen.add(n);
  }
  return out;
}

// 1) Tighten strategy.strong: remove low-level technical terms; add high-level strategic architecture/planning terms.
const strongId = 'strategy.strong';
const weakId = 'strategy.weak';
const negId = 'strategy.negative';

const strongRemove = [
  // low-level / implementation-ish (move out of strong)
  '并发',
  'concurrency',
  '分布式',
  'distributed',
  '性能',
  'performance',
  'deadlock',
  '安全',
  'security'
];

const strongAdd = [
  // strategic architecture/design/planning
  '架构设计',
  '系统设计',
  '系统架构',
  '总体架构',
  '目标架构',
  'target architecture',
  'reference architecture',
  '技术路线',
  '技术规划',
  '技术蓝图',
  '架构蓝图',
  'operating model',
  'org design',
  '组织设计',
  '治理',
  'governance',
  '战略',
  'strategy'
];

const beforeStrong = lib.keywordSets[strongId] ?? [];
let afterStrong = removeTokens(beforeStrong, strongRemove);
afterStrong = addTokens(afterStrong, strongAdd);
afterStrong = uniq(afterStrong);
lib.keywordSets[strongId] = afterStrong;

// 2) Keep minStrongHits=1, raise minScore to 4 (strong+weak OR strong+strong)
lib.kinds.strategy.thresholds = {
  ...(lib.kinds.strategy.thresholds ?? {}),
  minScore: 4,
  highScore: lib.kinds.strategy.thresholds?.highScore ?? 7,
  minStrongHits: 1
};

// 3) Regex: remove ambiguous '\brace\b'; keep architecture-focused regex.
// (regex weight>=3 counts as strongHit)
lib.kinds.strategy.signals.regex = [
  { pattern: '\\barchitecture\\b', flags: 'i', weight: 3 },
  { pattern: '\\bsystem\\s+design\\b', flags: 'i', weight: 3 },
  { pattern: '\\b(?:target|reference)\\s+architecture\\b', flags: 'i', weight: 3 }
];

// 4) Negative: remove generic Q/A words that incorrectly penalize strategy concept explainers.
const negRemove = ['解释', '是什么', '定义', '实现'];
const beforeNeg = lib.keywordSets[negId] ?? [];
const afterNeg = uniq(removeTokens(beforeNeg, negRemove));
lib.keywordSets[negId] = afterNeg;

// 5) Weak/Strong overlap control:
// - Allow overlap ONLY for explicit planning nouns (so short prompts like “roadmap” can still trigger strategy with minScore=4 via strong+weak)
// - Avoid overlap for architecture terms (so “架构/architecture” alone does NOT route strategy)
const overlapAllow = new Set(
  [
    // roadmap
    'roadmap',
    '路线图',
    // milestone
    'milestone',
    '里程碑',
    // timeline/schedule
    'timeline',
    '排期',
    'schedule',
    'gantt',
    '甘特图',
    // project plan / wbs
    '项目计划',
    'project plan',
    'wbs',
    '任务拆解',
    // release/rollout
    '发布计划',
    '上线计划',
    'release plan',
    'rollout',
    // okr/kpi/roi/tco
    'okr',
    'kpi',
    'roi',
    'tco'
  ].map(norm)
);

const beforeWeak = lib.keywordSets[weakId] ?? [];
const strongNorm = new Set(afterStrong.map(norm));
let afterWeak = [];
for (const t of beforeWeak) {
  const n = norm(t);
  if (strongNorm.has(n) && !overlapAllow.has(n)) continue; // drop overlap
  afterWeak.push(t);
}
afterWeak = uniq(afterWeak);
lib.keywordSets[weakId] = afterWeak;

fs.writeFileSync(PATH, JSON.stringify(lib, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      ok: true,
      strategy: {
        thresholds: lib.kinds.strategy.thresholds,
        strong: { before: beforeStrong.length, after: afterStrong.length, removed: strongRemove, added: strongAdd },
        weak: { before: beforeWeak.length, after: afterWeak.length },
        negative: { before: beforeNeg.length, after: afterNeg.length, removed: negRemove },
        regex: lib.kinds.strategy.signals.regex
      }
    },
    null,
    2
  )
);
