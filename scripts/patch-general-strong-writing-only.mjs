import fs from 'node:fs';

const PATH = 'tools/soft-router-suggest/keyword-library.json';
const lib = JSON.parse(fs.readFileSync(PATH, 'utf8'));

if (!lib.keywordSets) throw new Error('missing keywordSets');
if (!lib.kinds?.general?.signals) throw new Error('missing kinds.general');

const normalization = lib.normalization ?? { lowercase: true, trim: true, collapseWhitespace: true };
const norm = (s) => {
  let x = String(s ?? '');
  if (normalization.trim !== false) x = x.trim();
  if (normalization.collapseWhitespace) x = x.replace(/\s+/g, ' ');
  if (normalization.lowercase) x = x.toLowerCase();
  return x;
};

function uniq(list) {
  const out = [];
  const seen = new Set();
  for (const t of list ?? []) {
    const n = norm(t);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(t);
  }
  return out;
}

// User-approved minimal general keywords: writing / research / long-form structure tokens.
const GENERAL_STRONG = uniq([
  '写作', 'writing', '写文章', '写一篇', '写长文', '长文', '长篇', '文章', '博客', 'blog', '专栏', '公众号', '文案', 'copy',
  '公告', 'announcement', '新闻稿', 'press release', '演讲稿', '讲稿', '播客稿', '视频脚本', '脚本',
  '读书笔记', '书评', '影评', '评论', '社论',
  '报告', 'report', '研究', 'research', '调研', '调研报告', '研究报告', '行业报告', '白皮书',
  '综述', '文献综述', '论文', 'paper', '引用', 'cite', '参考文献', 'bibliography',
  '方法论', 'methodology', '讨论', 'discussion', '局限性', 'limitations', '结论与展望',
  '深入', '深度', '系统性', '全面', '详尽', '严谨', '专业', '学术', '批判性',
  '结构', '框架', '大纲', '提纲', '目录',
  '论证', '论点', '论据', '论述', '反驳',
  '观点', '立场', '主张', '假设', '证据链'
]);

// 1) Replace general sets: keep ONLY general.strong.
const beforeKeys = Object.keys(lib.keywordSets).filter((k) => k.startsWith('general.')).sort();
const before = {
  strong: (lib.keywordSets['general.strong'] ?? []).length,
  weak: (lib.keywordSets['general.weak'] ?? []).length,
  negative: (lib.keywordSets['general.negative'] ?? []).length,
};

lib.keywordSets['general.strong'] = GENERAL_STRONG;
delete lib.keywordSets['general.weak'];
delete lib.keywordSets['general.negative'];

// 2) Update general signals: use strong only; drop negative.
lib.kinds.general.signals.positive = [
  {
    set: 'general.strong',
    weight: 3,
    match: 'contains',
  },
];
lib.kinds.general.signals.negative = [];

// Keep regex/metadata as-is but ensure arrays exist.
if (!Array.isArray(lib.kinds.general.signals.regex)) lib.kinds.general.signals.regex = [];
if (!Array.isArray(lib.kinds.general.signals.metadata)) lib.kinds.general.signals.metadata = [];

const afterKeys = Object.keys(lib.keywordSets).filter((k) => k.startsWith('general.')).sort();

fs.writeFileSync(PATH, JSON.stringify(lib, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      ok: true,
      general: {
        keptSetKeys: afterKeys,
        removedSetKeys: beforeKeys.filter((k) => !afterKeys.includes(k)),
        countsBefore: before,
        countStrongNow: GENERAL_STRONG.length,
      },
    },
    null,
    2
  )
);
