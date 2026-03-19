import json
from pathlib import Path
cur=Path(r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tmp_openclaw.json')
bak=Path(r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tmp_openclaw.json.bak')
oc=json.loads(cur.read_text(encoding='utf-8'))
ob=json.loads(bak.read_text(encoding='utf-8'))
print('cur_len', cur.stat().st_size, 'bak_len', bak.stat().st_size)
print('cur_keys', sorted(oc.keys()))
print('bak_keys', sorted(ob.keys()))
for k in sorted(set(ob.keys())-set(oc.keys())):
    print('missing', k)
for k in sorted(set(oc.keys())-set(ob.keys())):
    print('extra', k)

# deep compare for keys sizes if dict
for k in sorted(oc.keys()):
    if isinstance(oc.get(k), dict) and isinstance(ob.get(k), dict):
        print(k, 'cur_subkeys', len(oc[k].keys()), 'bak_subkeys', len(ob[k].keys()))
