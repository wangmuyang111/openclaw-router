import json, hashlib
from pathlib import Path

def canon(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',',':'))

cur=Path(r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tmp_openclaw.json')
bak=Path(r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tmp_openclaw.json.bak')
oc=json.loads(cur.read_text(encoding='utf-8'))
ob=json.loads(bak.read_text(encoding='utf-8'))

cc=canon(oc).encode('utf-8')
cb=canon(ob).encode('utf-8')
print('canon_size cur',len(cc),'bak',len(cb))
print('sha256 cur',hashlib.sha256(cc).hexdigest())
print('sha256 bak',hashlib.sha256(cb).hexdigest())
