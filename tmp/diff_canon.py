import json
from pathlib import Path
from difflib import unified_diff

def canon(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, indent=2)

cur=Path(r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tmp_openclaw.json')
bak=Path(r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tmp_openclaw.json.bak')
oc=json.loads(cur.read_text(encoding='utf-8'))
ob=json.loads(bak.read_text(encoding='utf-8'))

cc=canon(oc).splitlines(True)
cb=canon(ob).splitlines(True)
for line in unified_diff(cb, cc, fromfile='bak', tofile='cur'):
    print(line, end='')
