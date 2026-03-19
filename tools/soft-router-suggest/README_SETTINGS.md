# Soft Router Suggest — Settings Verification (No plugin enable required)

These commands provide **verifiable** entry points for:
1) Auto/refresh model catalog
2) Per-kind model selection (priority list)
3) Keyword add/remove via paste-only overrides
4) Local route preview (NO LLM calls)

> Current policy: **pin everything to `local-proxy/gpt-5.2`**.

## 1) Auto-fetch model catalog (cached)

```powershell
cd tools/soft-router-suggest

# Use cache if fresh (default TTL 360 min)
.\catalog.ps1

# Force refresh
.\catalog.ps1 -Refresh

# Custom TTL
.\catalog.ps1 -TtlMinutes 60
```

Output is JSON with `fetchedAt`, `ttlMinutes`, and `models[]`.

## 2) Set model list for all kinds (or one kind)

```powershell
cd tools/soft-router-suggest

# Set ALL kinds to a single model (recommended for now)
.\set-kind-models.ps1 -ModelId local-proxy/gpt-5.2

# Set one kind only
.\set-kind-models.ps1 -Kind coding -ModelId local-proxy/gpt-5.2
```

## 3) Keyword add/remove (paste-only)

The overrides file is: `keyword-overrides.user.json`

Use manage tool:

```powershell
cd tools/soft-router-suggest

# Add (paste one term per line; `#` comments allowed)
.\manage-overrides.ps1 add -SetId coding.strong -PastedText "TypeError`nTraceback"

# Remove
.\manage-overrides.ps1 remove -SetId planning.weak -PastedText "gantt"

# List
.\manage-overrides.ps1 list

# Clear a set
.\manage-overrides.ps1 clear -SetId coding.strong
```

## 4) Route preview (NO LLM calls)

```powershell
cd tools/soft-router-suggest

.\route-preview.ps1 -Text "请帮我修复这个 TypeError" 

.\route-preview.ps1 -Text "我有一张截图" -HasImage
```

It prints a JSON object with `decision.kind`, score/confidence, and matched terms.
