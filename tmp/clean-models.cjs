const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/muyang/Desktop/OpenClaw-SoftRouter-GitHub/tools/soft-router-suggest';
const onlyModel = 'openai-codex/gpt-5.2';

function cleanArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return [onlyModel];
}

// 1. model-priority.json
let p = path.join(dir, 'model-priority.json');
if (fs.existsSync(p)) {
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (let k in d.kinds || {}) {
    d.kinds[k] = cleanArray(d.kinds[k]);
  }
  fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
}

// 2. classification-rules.json
p = path.join(dir, 'classification-rules.json');
if (fs.existsSync(p)) {
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (let c of d.categories || []) {
    c.models = cleanArray(c.models);
  }
  fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
}

// 3. keyword-library.json
p = path.join(dir, 'keyword-library.json');
if (fs.existsSync(p)) {
  let d = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (let k in d.kinds || {}) {
    if (d.kinds[k].models && Array.isArray(d.kinds[k].models.list)) {
      d.kinds[k].models.list = cleanArray(d.kinds[k].models.list);
    }
  }
  fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
}

console.log('Cleaned models from json files.');