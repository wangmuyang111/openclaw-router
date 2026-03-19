import json
from pathlib import Path
from collections import Counter

def detect(path: Path):
    text = path.read_text(encoding='utf-8')
    dups = Counter()

    def hook(pairs):
        seen = set()
        obj = {}
        for k, v in pairs:
            if k in seen:
                dups[k] += 1
            seen.add(k)
            obj[k] = v
        return obj

    try:
        json.loads(text, object_pairs_hook=hook)
    except Exception as e:
        print('ERROR parsing', path, e)
        return

    total = sum(dups.values())
    print(path.name, 'size', path.stat().st_size, 'duplicate_keys', total)
    if total:
        for k, c in dups.most_common(30):
            print(' ', k, c)

bak = Path(r'C:\Users\muyang\.openclaw\openclaw.json.bak')
cur = Path(r'C:\Users\muyang\.openclaw\openclaw.json')
print('== detect duplicates ==')
detect(bak)
detect(cur)
