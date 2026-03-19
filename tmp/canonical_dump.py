import json
from pathlib import Path

def dump(src, dst):
    obj=json.loads(Path(src).read_text(encoding='utf-8'))
    Path(dst).write_text(json.dumps(obj, sort_keys=True, ensure_ascii=False, indent=2), encoding='utf-8')

base=r'C:\Users\muyang\.openclaw'
dump(base+'\\openclaw.json', r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\\tmp\\canon_cur.json')
dump(base+'\\openclaw.json-C', r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\\tmp\\canon_C.json')
dump(base+'\\openclaw.json.bak.1', r'C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\\tmp\\canon_bak1.json')
print('dumped')
