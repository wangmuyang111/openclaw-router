import json
from pathlib import Path

needle = 'gemini-3-pro-high'
path = Path(r'C:\Users\muyang\.openclaw\openclaw.json')
obj = json.loads(path.read_text(encoding='utf-8'))

hits = []

def walk(x, p=''):
    if isinstance(x, dict):
        for k, v in x.items():
            walk(v, f"{p}.{k}" if p else k)
    elif isinstance(x, list):
        for i, v in enumerate(x):
            walk(v, f"{p}[{i}]")
    elif isinstance(x, str):
        if needle in x:
            hits.append((p, x))

walk(obj)
print('hits', len(hits))
for p, v in hits[:200]:
    print(p, '=', v)
