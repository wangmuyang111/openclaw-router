import json
from pathlib import Path

cur=Path(r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tmp_openclaw.json')
bak=Path(r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tmp_openclaw.json.bak')
oc=json.loads(cur.read_text(encoding='utf-8'))
ob=json.loads(bak.read_text(encoding='utf-8'))


def summary(x, max_items=8):
    if isinstance(x, dict):
        ks=list(x.keys())
        return {'type':'dict','keys':len(ks),'sample':ks[:max_items]}
    if isinstance(x, list):
        return {'type':'list','len':len(x),'sample':x[:max_items]}
    return {'type':type(x).__name__,'value':x}

for key in oc.keys():
    if oc[key] == ob[key]:
        continue
    print('DIFF', key)
    print(' cur', summary(oc[key]))
    print(' bak', summary(ob[key]))

    if key == 'plugins':
        ce=oc[key].get('entries',{})
        be=ob[key].get('entries',{})
        print('  entries cur',len(ce),'bak',len(be))
        missing=set(be)-set(ce)
        extra=set(ce)-set(be)
        print('  missingEntries',len(missing),'extraEntries',len(extra))
        if missing:
            print('  missing sample', list(sorted(missing))[:20])
        if extra:
            print('  extra sample', list(sorted(extra))[:20])

    if key == 'models':
        cm=oc[key].get('providers',{})
        bm=ob[key].get('providers',{})
        print('  providers cur',len(cm),'bak',len(bm))
        missing=set(bm)-set(cm)
        extra=set(cm)-set(bm)
        print('  missingProviders',len(missing),'extraProviders',len(extra))
        if missing:
            print('  missing sample', list(sorted(missing))[:20])
        if extra:
            print('  extra sample', list(sorted(extra))[:20])
