import fs from 'node:fs';

const lib = JSON.parse(fs.readFileSync('tools/soft-router-suggest/keyword-library.json', 'utf8'));
const sets = lib.keywordSets;
const norm = (s) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');

const all = new Set();
for (const [k, arr] of Object.entries(sets)) {
  if (!k.startsWith('coding.')) continue;
  if (!Array.isArray(arr)) continue;
  for (const t of arr) all.add(norm(t));
}

const candidates = {
  generic: [
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
    'segmentation fault (core dumped)',
    'out of memory',
    'oom',
    'killed'
  ],
  node_js: [
    'unhandled promise rejection',
    'unhandledpromiserejectionwarning',
    'deprecationwarning',
    'experimentalwarning',
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
  python: [
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
  java: ['noclassdeffounderror', 'illegalargumentexception', 'indexoutofboundsexception', 'arithmeticexception'],
  go: ['runtime error:', 'nil pointer dereference', 'concurrent map read and map write', 'all goroutines are asleep - deadlock!'],
  rust: ["thread 'main' panicked at", 'cannot move out of', 'unresolved import', 'cannot find crate', 'undefined reference to'],
  sql: [
    'syntax error at or near',
    'duplicate key value violates unique constraint',
    'violates foreign key constraint',
    'deadlock detected',
    'lock wait timeout exceeded',
    'could not connect to server',
    'connection refused',
    'too many connections'
  ],
  git: ['error: pathspec', 'conflict (content)', 'rejected', 'non-fast-forward']
};

const missingByCat = {};
for (const [cat, list] of Object.entries(candidates)) {
  missingByCat[cat] = list.filter((x) => !all.has(norm(x)));
}

console.log(JSON.stringify({ totalExisting: all.size, missingByCat }, null, 2));
