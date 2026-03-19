import json
from pathlib import Path
p=Path(r'C:\Users\muyang\.openclaw\openclaw.json')
o=json.loads(p.read_text(encoding='utf-8'))
print(json.dumps(o.get('agents',{}).get('defaults',{}), ensure_ascii=False, indent=2))
