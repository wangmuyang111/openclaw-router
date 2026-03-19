import json
from pathlib import Path

CFG = Path(r"C:\Users\muyang\.openclaw\openclaw.json")
BAK = Path(r"C:\Users\muyang\.openclaw\openclaw.json.manualbak")

obj = json.loads(CFG.read_text(encoding="utf-8"))
# save manual backup
BAK.write_text(CFG.read_text(encoding="utf-8"), encoding="utf-8")

model_defaults = obj.setdefault('agents', {}).setdefault('defaults', {}).setdefault('model', {})
# ensure primary is pinned
model_defaults['primary'] = 'local-proxy/gpt-5.2'
# remove any gemini fallbacks
fallbacks = model_defaults.get('fallbacks')
if isinstance(fallbacks, list):
    model_defaults['fallbacks'] = [x for x in fallbacks if isinstance(x, str) and ('gemini' not in x)]
else:
    model_defaults['fallbacks'] = []

# also remove the invalid local-proxy provider model id entry if present
providers = obj.get('models', {}).get('providers', {})
lp = providers.get('local-proxy')
if isinstance(lp, dict) and isinstance(lp.get('models'), list):
    lp['models'] = [m for m in lp['models'] if not (isinstance(m, dict) and m.get('id') == 'gemini-3-pro-high')]

CFG.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
print('patched: removed gemini fallbacks and local-proxy gemini-3-pro-high model entry')
print('manual backup:', BAK)
