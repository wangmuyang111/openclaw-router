# OpenClaw Soft Router (A‑Tier Router Runner)

Windows + PowerShell distribution for the **soft-router-suggest** plugin + optional local Router LLM sidecar.

## What this repo provides

- Keyword rule engine routing (8 categories + protected chat)
- Optional Router LLM via local sidecar (`127.0.0.1:18888`)
- Cross-provider fallback chains and fail-open behavior
- Operational mode toggles: **FAST / RULES / LLM**
- Manual catalog refresh trigger (without changing TTLs)

## Quick start

### 1) Install (defaults to RULES mode)

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\install.ps1
```

### 2) Doctor (sanity checks)

```powershell
.\scripts\doctor.ps1
```

### 3) Switch modes

```powershell
.\scripts\router.ps1 status
.\scripts\router.ps1 rules
.\scripts\router.ps1 fast
.\scripts\router.ps1 llm
```

### 3) Sidecar (LLM mode)

```powershell
.\scripts\router.ps1 sidecar-start
# check: http://127.0.0.1:18888/health
.\scripts\router.ps1 sidecar-stop
```

### 4) Manual model catalog refresh

```powershell
.\scripts\router.ps1 catalog-refresh
```

> Note: refresh is consumed on the next routed request.

## Docs

- `docs/TECHNICAL.md`
- `docs/SECURITY.md`
- `docs/USAGE_MANUAL.txt`
- `docs/WINDOWS_MIGRATION_GUIDE.md` (迁移踩坑复盘与规避)

## Public release safety

This repo intentionally:
- avoids absolute paths like `C:\Users\<name>` in defaults
- does **not** include logs, tokens, emails, or `openclaw.json`

See `docs/SECURITY.md` for a pre-publish checklist.
