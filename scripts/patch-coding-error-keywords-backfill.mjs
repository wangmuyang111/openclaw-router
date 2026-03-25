import fs from 'node:fs';

const PATH = 'tools/soft-router-suggest/keyword-library.json';
const lib = JSON.parse(fs.readFileSync(PATH, 'utf8'));

if (!lib.keywordSets) throw new Error('missing keywordSets');
if (!lib.kinds?.coding?.signals?.positive) throw new Error('missing kinds.coding.signals.positive');

const normalization = lib.normalization ?? { lowercase: true, trim: true, collapseWhitespace: true };
const norm = (s) => {
  let x = String(s ?? '');
  if (normalization.trim !== false) x = x.trim();
  if (normalization.collapseWhitespace) x = x.replace(/\s+/g, ' ');
  if (normalization.lowercase) x = x.toLowerCase();
  return x;
};

function ensureSet(id) {
  if (!Array.isArray(lib.keywordSets[id])) lib.keywordSets[id] = [];
  return lib.keywordSets[id];
}

function addToSet(id, tokens) {
  const arr = ensureSet(id);
  const seen = new Set(arr.map(norm));
  const added = [];
  for (const t of tokens) {
    const n = norm(t);
    if (!n) continue;
    if (seen.has(n)) continue;
    arr.push(t);
    seen.add(n);
    added.push(t);
  }
  return added;
}

function upsertPositiveRule(setId, weight = 3, match = 'contains') {
  const pos = lib.kinds.coding.signals.positive;
  const r = pos.find((x) => x?.set === setId);
  if (r) {
    r.weight = weight;
    r.match = match;
    return { action: 'updated', rule: r };
  }
  const rule = { set: setId, weight, match };
  pos.push(rule);
  return { action: 'added', rule };
}

// 1) Backfill tokens (missing list we previously reported)
const payload = {
  'coding.feature.build_and_toolchain.strong': [
    // generic/system-ish
    'warning:',
    'warn:',
    'fatal:',
    'critical:',
    'assert failed',
    'assertion failed',
    'segfault',
    'bus error',
    'illegal instruction',
    'floating point exception',
    'stack overflow',
    'heap corruption',
    'double free',
    'use after free',
    'aborted',
    'abort trap',
    'terminated',
    'sigabrt',
    'sigill',
    'sigbus',
    'sigfpe',
    'sigkill',
    'segmentation fault (core dumped)'
  ],
  'coding.feature.js_ts_node.strong': [
    'unhandled promise rejection',
    'unhandledpromiserejectionwarning',
    'deprecationwarning',
    'maxlisteners',
    'unexpected token',
    'cannot read property',
    'cannot read properties of null',
    'cannot read properties of undefined',
    'is not a function',
    'is not defined',
    'cannot resolve',
    'javascript heap out of memory'
  ],
  'coding.feature.python.strong': [
    'exception:',
    'keyerror:',
    'valueerror:',
    'typeerror:',
    'importerror:',
    'attributeerror:',
    'indexerror:',
    'zerodivisionerror',
    'filenotfounderror',
    'nameerror:',
    'oserror',
    'permissionerror',
    'runtimeerror'
  ],
  'coding.feature.java_jvm.strong': ['illegalargumentexception', 'indexoutofboundsexception', 'arithmeticexception'],
  // Add new strong sets for Go/Rust (requested)
  'coding.feature.go.strong': ['runtime error:', 'nil pointer dereference', 'concurrent map read and map write', 'all goroutines are asleep - deadlock!'],
  'coding.feature.rust.strong': ["thread 'main' panicked at", 'cannot move out of', 'unresolved import', 'cannot find crate'],
  'coding.feature.sql.strong': [
    'syntax error at or near',
    'duplicate key value violates unique constraint',
    'violates foreign key constraint',
    'deadlock detected',
    'lock wait timeout exceeded',
    'could not connect to server',
    'connection refused',
    'too many connections'
  ],
  'coding.feature.git.strong': ['error: pathspec', 'conflict (content)', 'rejected', 'non-fast-forward']
};

const addedBySet = {};
let addedTotal = 0;
for (const [setId, tokens] of Object.entries(payload)) {
  const added = addToSet(setId, tokens);
  if (added.length) {
    addedBySet[setId] = added;
    addedTotal += added.length;
  }
}

// 2) Wire new sets (or enforce strong weight)
const wiring = {};
for (const setId of Object.keys(payload)) {
  // For go/rust we are creating new sets; for others they already exist.
  // Convention: .strong sets should be weight=3.
  wiring[setId] = upsertPositiveRule(setId, 3);
}

// 3) Also ensure the existing non-strong feature sets continue to exist (no removal here).

fs.writeFileSync(PATH, JSON.stringify(lib, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      ok: true,
      addedTotal,
      addedBySet,
      wiredSets: Object.keys(payload)
    },
    null,
    2
  )
);
