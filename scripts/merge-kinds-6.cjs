const fs = require('fs');
const path = require('path');

const repo = 'C:/Users/muyang/Desktop/OpenClaw-SoftRouter-GitHub';
const libraryPath = path.join(repo, 'tools/soft-router-suggest/keyword-library.json');
const overridesExamplePath = path.join(repo, 'tools/soft-router-suggest/keyword-overrides.user.example.json');
const modelPriorityPath = path.join(repo, 'tools/soft-router-suggest/model-priority.json');
const readmePath = path.join(repo, 'tools/soft-router-suggest/README_SETTINGS.md');
const technicalPath = path.join(repo, 'docs/TECHNICAL.md');
const changelogPath = path.join(repo, 'CHANGELOG.md');
const releaseSummaryPath = path.join(repo, 'RELEASE_SUMMARY.md');

function readJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const x of list || []) {
    const s = String(x ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function mergeSet(lib, target, sources) {
  const all = [];
  for (const s of sources) {
    const arr = lib.keywordSets?.[s];
    if (Array.isArray(arr)) all.push(...arr);
  }
  lib.keywordSets[target] = dedupe(all);
}

function mergeKindSignalSets(kind, bucket) {
  const arr = [];
  for (const x of kind?.signals?.[bucket] || []) arr.push(x);
  return arr;
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

const lib = readJson(libraryPath);
const oldKinds = lib.kinds || {};

const strategy = clone(oldKinds.planning || { id: 'strategy', name: 'strategy', priority: 100, enabled: true, signals: { positive: [], negative: [], metadata: [], regex: [] }, thresholds: { minScore: 2, highScore: 7, minStrongHits: 1 }, models: { strategy: 'priority_list', list: [] } });
strategy.id = 'strategy';
strategy.name = 'strategy';
strategy.priority = 100;
strategy.enabled = true;
strategy.signals = strategy.signals || { positive: [], negative: [], metadata: [], regex: [] };
strategy.signals.positive = dedupe([
  ...(strategy.signals.positive || []).map(JSON.stringify),
  ...((oldKinds.advanced_coding?.signals?.positive || []).map(JSON.stringify)),
]).map(JSON.parse);
strategy.signals.negative = dedupe([
  ...(strategy.signals.negative || []).map(JSON.stringify),
  ...((oldKinds.advanced_coding?.signals?.negative || []).map(JSON.stringify)),
]).map(JSON.parse);
strategy.signals.metadata = dedupe([
  ...(strategy.signals.metadata || []).map(JSON.stringify),
  ...((oldKinds.advanced_coding?.signals?.metadata || []).map(JSON.stringify)),
]).map(JSON.parse);
strategy.signals.regex = dedupe([
  ...(strategy.signals.regex || []).map(JSON.stringify),
  ...((oldKinds.advanced_coding?.signals?.regex || []).map(JSON.stringify)),
]).map(JSON.parse);
strategy.thresholds = { minScore: 2, highScore: 7, minStrongHits: 1 };
strategy.models = { strategy: 'priority_list', list: dedupe([...(oldKinds.planning?.models?.list || []), ...(oldKinds.advanced_coding?.models?.list || [])]) };

const coding = clone(oldKinds.coding || { id: 'coding', name: 'coding', priority: 90, enabled: true, signals: { positive: [], negative: [], metadata: [], regex: [] }, thresholds: { minScore: 2, highScore: 6, minStrongHits: 1 }, models: { strategy: 'priority_list', list: [] } });
coding.id = 'coding'; coding.name = 'coding'; coding.priority = 90;

const vision = clone(oldKinds.vision || { id: 'vision', name: 'vision', priority: 80, enabled: true, signals: { positive: [], negative: [], metadata: [], regex: [] }, thresholds: { minScore: 3, highScore: 10, minStrongHits: 0 }, models: { strategy: 'priority_list', list: [] } });
vision.id = 'vision'; vision.name = 'vision'; vision.priority = 80;

const support = clone(oldKinds.daily_support || { id: 'support', name: 'support', priority: 70, enabled: true, signals: { positive: [], negative: [], metadata: [], regex: [] }, thresholds: { minScore: 1, highScore: 5, minStrongHits: 0 }, models: { strategy: 'priority_list', list: [] } });
support.id = 'support'; support.name = 'support'; support.priority = 70; support.enabled = true;
support.signals = support.signals || { positive: [], negative: [], metadata: [], regex: [] };
support.signals.positive = dedupe([
  ...(support.signals.positive || []).map(JSON.stringify),
  ...((oldKinds.emergency_fallback?.signals?.positive || []).map(JSON.stringify)),
  ...((oldKinds.quick_response?.signals?.positive || []).map(JSON.stringify)),
]).map(JSON.parse);
support.signals.negative = dedupe([
  ...(support.signals.negative || []).map(JSON.stringify),
  ...((oldKinds.emergency_fallback?.signals?.negative || []).map(JSON.stringify)),
  ...((oldKinds.quick_response?.signals?.negative || []).map(JSON.stringify)),
]).map(JSON.parse);
support.signals.metadata = dedupe([
  ...(support.signals.metadata || []).map(JSON.stringify),
  ...((oldKinds.emergency_fallback?.signals?.metadata || []).map(JSON.stringify)),
  ...((oldKinds.quick_response?.signals?.metadata || []).map(JSON.stringify)),
]).map(JSON.parse);
support.signals.regex = dedupe([
  ...(support.signals.regex || []).map(JSON.stringify),
  ...((oldKinds.emergency_fallback?.signals?.regex || []).map(JSON.stringify)),
  ...((oldKinds.quick_response?.signals?.regex || []).map(JSON.stringify)),
]).map(JSON.parse);
support.thresholds = { minScore: 1, highScore: 5, minStrongHits: 0 };
support.models = { strategy: 'priority_list', list: dedupe([...(oldKinds.daily_support?.models?.list || []), ...(oldKinds.emergency_fallback?.models?.list || []), ...(oldKinds.quick_response?.models?.list || [])]) };

const general = clone(oldKinds.general || { id: 'general', name: 'general', priority: 30, enabled: true, signals: { positive: [], negative: [], metadata: [], regex: [] }, thresholds: { minScore: 2, highScore: 6, minStrongHits: 0 }, models: { strategy: 'priority_list', list: [] } });
general.id = 'general'; general.name = 'general'; general.priority = 30;
// absorb quick_response here too so wording like “简短/直接给答案” doesn't get lost
for (const p of oldKinds.quick_response?.signals?.positive || []) {
  if (!general.signals.positive.some(x => JSON.stringify(x) === JSON.stringify(p))) general.signals.positive.push(p);
}
for (const n of oldKinds.quick_response?.signals?.negative || []) {
  if (!general.signals.negative.some(x => JSON.stringify(x) === JSON.stringify(n))) general.signals.negative.push(n);
}
for (const r of oldKinds.quick_response?.signals?.regex || []) {
  if (!general.signals.regex.some(x => JSON.stringify(x) === JSON.stringify(r))) general.signals.regex.push(r);
}
if (oldKinds.quick_response?.models?.list) {
  general.models.list = dedupe([...(general.models?.list || []), ...oldKinds.quick_response.models.list]);
}

const chat = clone(oldKinds.chat || { id: 'chat', name: 'chat', priority: 0, enabled: true, signals: { positive: [], negative: [], metadata: [], regex: [] }, thresholds: { minScore: 0, highScore: 0, minStrongHits: 0 }, models: { strategy: 'priority_list', list: [] } });
chat.id = 'chat'; chat.name = 'chat'; chat.priority = 0;
// absorb quick_response weak terms into chat too, to preserve chatty/short-answer phrasing

mergeSet(lib, 'strategy.strong', ['planning.strong', 'advanced_coding.strong']);
mergeSet(lib, 'strategy.weak', ['planning.weak', 'advanced_coding.weak']);
mergeSet(lib, 'strategy.negative', ['planning.negative']);
mergeSet(lib, 'coding.strong', ['coding.strong']);
mergeSet(lib, 'coding.weak', ['coding.weak']);
mergeSet(lib, 'coding.negative', ['coding.negative']);
mergeSet(lib, 'vision.weak', ['vision.weak']);
mergeSet(lib, 'support.strong', ['quick_response.strong']);
mergeSet(lib, 'support.weak', ['daily_support.weak', 'emergency_fallback.weak', 'quick_response.weak']);
mergeSet(lib, 'support.negative', ['quick_response.negative']);
mergeSet(lib, 'general.weak', ['general.weak', 'quick_response.weak']);
mergeSet(lib, 'general.negative', ['general.negative', 'quick_response.negative']);
mergeSet(lib, 'chat.weak', ['chat.weak', 'quick_response.weak']);

// Clean old sets
for (const k of Object.keys(lib.keywordSets || {})) {
  if (/^(planning|advanced_coding|daily_support|quick_response|emergency_fallback)\./.test(k)) delete lib.keywordSets[k];
}

strategy.signals.positive = [
  { set: 'strategy.strong', weight: 3, match: 'contains' },
  { set: 'strategy.weak', weight: 1, match: 'contains' },
];
strategy.signals.negative = lib.keywordSets['strategy.negative']?.length ? [{ set: 'strategy.negative', weight: -4, match: 'contains', exclude: false }] : [];
strategy.signals.metadata = dedupe([...(strategy.signals.metadata || []).map(JSON.stringify)]).map(JSON.parse);
strategy.signals.regex = dedupe([...(strategy.signals.regex || []).map(JSON.stringify)]).map(JSON.parse);

coding.signals.positive = [
  { set: 'coding.strong', weight: 3, match: 'contains' },
  { set: 'coding.weak', weight: 1, match: 'contains' },
];
coding.signals.negative = lib.keywordSets['coding.negative']?.length ? [{ set: 'coding.negative', weight: -4, match: 'contains', exclude: false }] : [];

vision.signals.positive = [
  { set: 'vision.weak', weight: 1, match: 'contains' },
];
vision.signals.negative = [];
vision.signals.metadata = [{ field: 'hasImage', equals: true, weight: 10, exclude: false }];

support.signals.positive = [];
if (lib.keywordSets['support.strong']?.length) support.signals.positive.push({ set: 'support.strong', weight: 3, match: 'contains' });
if (lib.keywordSets['support.weak']?.length) support.signals.positive.push({ set: 'support.weak', weight: 1, match: 'contains' });
support.signals.negative = lib.keywordSets['support.negative']?.length ? [{ set: 'support.negative', weight: -4, match: 'contains', exclude: false }] : [];

// general keeps its own writing/research semantics, but absorbs quick-response wording
const generalPositive = [];
if (lib.keywordSets['general.weak']?.length) generalPositive.push({ set: 'general.weak', weight: 1, match: 'contains' });
general.signals.positive = generalPositive;
general.signals.negative = lib.keywordSets['general.negative']?.length ? [{ set: 'general.negative', weight: -4, match: 'contains', exclude: false }] : [];

const chatPositive = [];
if (lib.keywordSets['chat.weak']?.length) chatPositive.push({ set: 'chat.weak', weight: 1, match: 'contains' });
chat.signals.positive = chatPositive;
chat.signals.negative = [];
chat.thresholds = { minScore: 0, highScore: 0, minStrongHits: 0 };

lib.kinds = {
  strategy,
  coding,
  vision,
  support,
  general,
  chat,
};
lib.defaultFallbackKind = 'chat';
lib.notes = 'Simplified to 6 categories: strategy, coding, vision, support, general, chat. strategy merges planning + advanced_coding; support merges daily_support + emergency_fallback; quick_response keywords were fully preserved by merging into support/general/chat.';

writeJson(libraryPath, lib);

if (fs.existsSync(overridesExamplePath)) {
  const ov = readJson(overridesExamplePath);
  const newSets = {};
  for (const [k,v] of Object.entries(ov.sets || {})) {
    if (/^planning\./.test(k)) {
      const nk = k.replace(/^planning\./, 'strategy.');
      newSets[nk] = { ...(newSets[nk] || {}), ...v };
      continue;
    }
    if (/^advanced_coding\./.test(k)) {
      const nk = k.replace(/^advanced_coding\./, 'strategy.');
      newSets[nk] = { ...(newSets[nk] || {}), ...v };
      continue;
    }
    if (/^(daily_support|emergency_fallback)\./.test(k)) {
      const nk = k.replace(/^(daily_support|emergency_fallback)\./, 'support.');
      const cur = newSets[nk] || {};
      newSets[nk] = {
        add: dedupe([...(cur.add || []), ...((v && v.add) || [])]),
        remove: dedupe([...(cur.remove || []), ...((v && v.remove) || [])]),
      };
      continue;
    }
    if (/^quick_response\./.test(k)) {
      const suffix = k.replace(/^quick_response\./, '');
      for (const target of ['support.' + suffix, 'general.' + suffix, 'chat.' + suffix]) {
        const cur = newSets[target] || {};
        newSets[target] = {
          add: dedupe([...(cur.add || []), ...((v && v.add) || [])]),
          remove: dedupe([...(cur.remove || []), ...((v && v.remove) || [])]),
        };
      }
      continue;
    }
    newSets[k] = v;
  }
  ov.sets = newSets;
  const newKinds = {};
  for (const [k,v] of Object.entries(ov.kinds || {})) {
    if (k === 'planning' || k === 'advanced_coding') { newKinds.strategy = { ...(newKinds.strategy || {}), ...v }; continue; }
    if (k === 'daily_support' || k === 'emergency_fallback' || k === 'quick_response') { newKinds.support = { ...(newKinds.support || {}), ...v }; continue; }
    newKinds[k] = v;
  }
  ov.kinds = newKinds;
  writeJson(overridesExamplePath, ov);
}

if (fs.existsSync(modelPriorityPath)) {
  const mp = readJson(modelPriorityPath);
  const old = mp.kinds || {};
  mp.kinds = {
    strategy: dedupe([...(old.complex_planning || []), ...(old.planning || []), ...(old.advanced_coding || []), 'local-proxy/gpt-5.4', 'local-proxy/gpt-5.2']).filter((v, i, a) => a.indexOf(v) === i),
    coding: dedupe([...(old.coding || []), 'local-proxy/gpt-5.3-codex', 'local-proxy/gpt-5.2-codex', 'local-proxy/gpt-5.4']),
    vision: dedupe([...(old.vision || []), 'local-proxy/vision-model', 'local-proxy/gpt-5.4']),
    support: dedupe([...(old.daily_support || []), ...(old.emergency_fallback || []), ...(old.quick_response || []), ...(old.fallback || []), 'local-proxy/gpt-5.2', 'local-proxy/gpt-5.4']),
    general: dedupe([...(old.text_writing || []), ...(old.general || []), ...(old.quick_simple || []), 'local-proxy/gpt-5.2', 'local-proxy/gpt-5.4']),
    chat: dedupe([...(old.quick_simple || []), ...(old.fallback || []), ...(old.chat || []), 'local-proxy/gpt-5.2']),
  };
  mp.notes = 'Simplified 6-kind priorities. strategy receives higher-grade models.';
  writeJson(modelPriorityPath, mp);
}

function replaceInFile(p, edits) {
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, 'utf8');
  for (const [from, to] of edits) s = s.replace(from, to);
  fs.writeFileSync(p, s, 'utf8');
}

replaceInFile(readmePath, [
  ['Current policy: **pin everything to `local-proxy/gpt-5.2`**.', 'Current scheme: **6 kinds: strategy / coding / vision / support / general / chat**.'],
  ['.\\set-kind-models.ps1 -Kind coding -ModelId local-proxy/gpt-5.2', '.\\set-kind-models.ps1 -Kind strategy -ModelId local-proxy/gpt-5.4'],
  ['planning.strong', 'strategy.strong'],
  ['planning.weak', 'strategy.weak'],
]);
replaceInFile(technicalPath, [
  ['`quick_response` intent override wins when explicit “answer-only” constraints appear', '`quick_response` was removed as a top-level kind; its keywords are merged into support/general/chat as style signals'],
  ['`planning` and `coding` are protected by gating to reduce weak-keyword hijacks', '`strategy` (merged from planning + advanced_coding) and `coding` are protected by gating to reduce weak-keyword hijacks'],
  ['coding/planning/quick', 'coding/strategy/chat'],
]);
replaceInFile(changelogPath, [
  ['- planning, coding, vision, daily_support\n- quick_response, emergency_fallback, advanced_coding', '- strategy, coding, vision, support, general, chat'],
]);
replaceInFile(releaseSummaryPath, [
  ['9 ����ϵͳ', '6 类系统'],
  ['planning/coding/vision/chat', 'strategy/coding/vision/support/general/chat'],
]);

console.log(JSON.stringify({
  ok: true,
  kinds: Object.keys(lib.kinds),
  keywordSets: Object.keys(lib.keywordSets),
  strategyModels: lib.kinds.strategy.models.list,
  supportModels: lib.kinds.support.models.list,
}, null, 2));
