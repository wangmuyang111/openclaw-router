import fs from 'node:fs';

const PATH = 'tools/soft-router-suggest/keyword-library.json';
const lib = JSON.parse(fs.readFileSync(PATH, 'utf8'));

if (!lib.keywordSets) throw new Error('missing keywordSets');
if (!lib.kinds?.support) throw new Error('missing kinds.support');

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

// Style/format/urgency tokens should be WEAK (they're cross-domain preferences, not "tech support" domain signals)
function isStyleOrUrgencyToken(t) {
  const s = norm(t);
  if (!s) return false;

  // answer-format preferences
  if (
    s.includes('tldr') ||
    s.includes('tl;dr') ||
    s.includes('just answer') ||
    s.includes('answer only') ||
    s.includes('no explanation') ||
    s.includes('short answer') ||
    s.includes('straight to the point') ||
    s.includes('bottom line') ||
    s.includes('in a nutshell') ||
    s.includes('bullet points') ||
    s.includes('bullets only')
  )
    return true;

  // chinese answer-format preferences
  if (
    s.includes('只要答案') ||
    s.includes('只要结果') ||
    s.includes('直接给') ||
    s.includes('直给') ||
    s.includes('不要解释') ||
    s.includes('不用解释') ||
    s.includes('不需要解释') ||
    s.includes('不要过程') ||
    s.includes('省略过程') ||
    s.includes('说重点') ||
    s.includes('只列要点') ||
    s.includes('要点即可') ||
    s.includes('一句话总结') ||
    s.includes('一句总结') ||
    s.includes('别展开') ||
    s.includes('不要展开') ||
    s.includes('别废话') ||
    s.includes('少废话') ||
    s.includes('不要废话')
  )
    return true;

  // brevity tokens
  if (
    ['short', 'brief', 'concise', '简短', '简要', '简明', '精简', '简单说', '一句话', '一两句', '两句话', '1-2句', '三句话', '三句', '三点', '三条', '三行以内', '3行内'].includes(s)
  )
    return true;

  // urgency tokens (cross-domain)
  if (
    ['quick', '快速', '马上', '立刻', '立马', '赶紧', '快点', 'asap', '立即', 'immediate', 'in a rush', 'rush', 'urgent'].includes(s)
  )
    return true;

  return false;
}

const strongId = 'support.strong';
const weakId = 'support.weak';
const oldStrong = Array.isArray(lib.keywordSets[strongId]) ? lib.keywordSets[strongId] : [];
const oldWeak = Array.isArray(lib.keywordSets[weakId]) ? lib.keywordSets[weakId] : [];

const styleFromWeak = oldWeak.filter(isStyleOrUrgencyToken);
const techFromWeak = oldWeak.filter((t) => !isStyleOrUrgencyToken(t));

// Swap the *meaning*: concrete support nouns -> strong; generic/style -> weak.
let newStrong = uniq([
  ...techFromWeak,
  // rename keywords requested (CN+EN)
  '技术支持',
  '简单技术支持',
  'tech support',
  'technical support',
  'simple tech support'
]);

let newWeak = uniq([...oldStrong, ...styleFromWeak]);

lib.keywordSets[strongId] = newStrong;
lib.keywordSets[weakId] = newWeak;

// Rename kind (CN+EN)
lib.kinds.support.name = '简单技术支持 / simple tech support';

// Optional but sensible: raise minScore so style-only single hits don't route to support.
lib.kinds.support.thresholds = {
  ...(lib.kinds.support.thresholds ?? {}),
  minScore: 2
};

fs.writeFileSync(PATH, JSON.stringify(lib, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      ok: true,
      support: {
        name: lib.kinds.support.name,
        thresholds: lib.kinds.support.thresholds,
        sets: {
          strong: { before: oldStrong.length, after: newStrong.length },
          weak: { before: oldWeak.length, after: newWeak.length },
          movedFromWeakToStrong: techFromWeak.length,
          movedFromWeakToWeak_style: styleFromWeak.length,
          oldStrongMovedToWeak: oldStrong.length
        }
      }
    },
    null,
    2
  )
);
