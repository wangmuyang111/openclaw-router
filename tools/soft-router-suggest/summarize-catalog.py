import json, sys
from datetime import datetime, timezone

path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub\tools\soft-router-suggest\model-catalog.cache.json"

with open(path, 'r', encoding='utf-8') as f:
    cat = json.load(f)

fetched_at = cat.get('fetchedAt')
try:
    t = datetime.fromisoformat(fetched_at.replace('Z', '+00:00'))
    age_min = int((datetime.now(timezone.utc) - t).total_seconds() / 60)
except Exception:
    age_min = None

models = (cat.get('models') or {}).get('models') or []
count = (cat.get('models') or {}).get('count', len(models))

avail = [m for m in models if m.get('available') is True]
unavail = [m for m in models if m.get('available') is not True]

# group by input
from collections import defaultdict
by_input = defaultdict(list)
for m in avail:
    by_input[m.get('input') or 'unknown'].append(m)

print(f"Catalog fetchedAt={fetched_at} ageMin={age_min} count={count}")
print(f"Available={len(avail)}  Unavailable={len(unavail)}")

print()
for input_kind in sorted(by_input.keys()):
    group = sorted(by_input[input_kind], key=lambda x: x.get('key',''))
    print(f"AVAILABLE input={input_kind} ({len(group)})")
    for m in group:
        key = m.get('key','')
        ctx = m.get('contextWindow','')
        tags = ' '.join(m.get('tags') or [])
        local = m.get('local', None)
        print(f"- {key}  ctx={ctx}  local={local}  tags=[{tags}]")
    print()

if unavail:
    print(f"UNAVAILABLE ({len(unavail)})")
    for m in sorted(unavail, key=lambda x: x.get('key','')):
        key = m.get('key','')
        tags = ' '.join(m.get('tags') or [])
        print(f"- {key}  available={m.get('available')}  tags=[{tags}]")
