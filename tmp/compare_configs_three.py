import json
from pathlib import Path

def load(p):
    return json.loads(Path(p).read_text(encoding='utf-8'))

def canon(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',',':'))

def summarize(name, p):
    b=Path(p).read_bytes()
    print(name, 'path', p)
    print(' size', len(b))

paths={
  'cur': r'C:\Users\muyang\.openclaw\openclaw.json',
  'bak': r'C:\Users\muyang\.openclaw\openclaw.json.bak',
  'C':   r'C:\Users\muyang\.openclaw\openclaw.json-C',
  'bak1':r'C:\Users\muyang\.openclaw\openclaw.json.bak.1'
}

for k,p in paths.items():
    if Path(p).exists():
        summarize(k,p)

objs={k:load(p) for k,p in paths.items() if Path(p).exists()}

import hashlib
for k,o in objs.items():
    c=canon(o).encode('utf-8')
    print(k,'canon_size',len(c),'sha256',hashlib.sha256(c).hexdigest())

# compare cur vs C and cur vs bak1

def diff(a,b):
    ka=set(a.keys()); kb=set(b.keys())
    return {'missing':sorted(kb-ka),'extra':sorted(ka-kb)}

if 'cur' in objs and 'C' in objs:
    print('cur vs C keys', diff(objs['cur'], objs['C']))
if 'cur' in objs and 'bak1' in objs:
    print('cur vs bak1 keys', diff(objs['cur'], objs['bak1']))

# check equality
for other in ['C','bak1','bak']:
    if 'cur' in objs and other in objs:
        print('cur ==',other, objs['cur']==objs[other])
