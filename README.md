# OpenClaw Soft Router (soft-router-suggest)

Cross-platform OpenClaw plugin project for **soft-router-suggest**, with a TypeScript Node CLI, Windows/Linux wrappers, and an optional local Router LLM sidecar.

## Current status

This repo is now aligned around the **simplified 6-kind scheme**:

- `strategy`
- `coding`
- `vision`
- `support`
- `general`
- `chat`

The default installation is **safe by default**:

- plugin installed and enabled
- keyword rule engine enabled
- router LLM sidecar disabled
- automatic model switching **disabled** by default

That means the plugin can observe / suggest safely first, without disrupting normal usage.

## What this repo provides

- Keyword-library based routing (`keyword-library.json`)
- Simplified 6-kind model routing
- Bilingual PowerShell control UI (`zh` / `en` / `both`)
- Per-kind model priority configuration
- Per-kind keyword management with user overrides
- Local route preview / route test (**no LLM call**)
- Optional local Router LLM sidecar (`127.0.0.1:18888`)
- FAST / RULES / LLM operational mode switching
- Fail-open behavior for routing and sidecar failures

## Start here first

If you are new to this repo, read these in order:

1. `docs/QUICK_START.zh-CN.md` — shortest commands + plain-language routing explanation
2. `docs/USAGE_MANUAL.txt` — full command manual
3. `tools/soft-router-suggest/README_SETTINGS.md` — customization guide

## Quick start

### Windows (shortest path)

```powershell
npm install
npm run build
npm run windows:install
npm run windows:doctor
```

### Linux (shortest path)

```bash
npm install
npm run build
chmod +x scripts/*.sh
./scripts/install.sh
./scripts/doctor.sh
```

### Cross-platform Node CLI

```bash
npm install
npm run build
npm run openclaw:install -- --dry-run
npm run openclaw:install
npm run openclaw:doctor
```

### Check / switch modes

```powershell
.\scripts\router.ps1 status
.\scripts\router.ps1 fast
.\scripts\router.ps1 rules
.\scripts\router.ps1 llm
```

### Mode meaning

- `fast`:
  - disables the plugin
  - uses the normal default model chain
- `rules`:
  - enables plugin + rule engine + switching
  - keeps Router LLM sidecar off
- `llm`:
  - enables plugin + rule engine + Router LLM sidecar + switching

## Keyword weighting explained in plain language

The router is not magic.
It is basically a scoring system:

- every kind starts with a score
- `strong` keywords add a lot
- `weak` keywords add a little
- `negative` keywords subtract or suppress score
- metadata can add extra boosts
  - image present → `vision` gets a boost
  - code block present → `coding` gets a boost

A simple mental model is:

```text
final score ≈ strong bonus + weak bonus - negative penalty + metadata bonus
```

Then the router checks:

- which kind scored highest
- which kind passed its thresholds
- whether the evidence is strong enough to route confidently

### Practical customization tips

- put unmistakable signals in `strong`
- put helpful but broader hints in `weak`
- put cross-kind confusion terms in `negative`
- avoid stuffing very broad words into `strong`
- change a few terms at a time, then test with route preview / route test

Example intuition:

- `coding.strong`: `TypeError`, `stack trace`, `bug`
- `coding.weak`: `debug`, `refactor`
- `coding.negative`: travel / booking / itinerary terms

If you want the user-friendly Chinese explanation and the shortest startup commands, read:
- `docs/QUICK_START.zh-CN.md`

## Control UI

Main PowerShell UI entry:

```powershell
cd .\tools\soft-router-suggest
.\ui-menu.ps1
```

Current UI highlights:

- bilingual display (`zh` / `en` / `both`)
- kind admin integrated into the menu
- keyword list view shows **effective keywords**, not only overrides
- keyword removal supports **pick by number**
- route test uses **single-line input, Enter to submit**

## Main config files

Under `tools/soft-router-suggest/`:

- `keyword-library.json` — source of truth for kinds, keyword sets, thresholds, and per-kind model lists
- `model-priority.json` — simplified per-kind model priority configuration
- `keyword-overrides.user.example.json` — example user override structure
- `keyword-overrides.user.schema.json` — override schema
- `ui-menu.ps1` — control UI
- `i18n/zh-CN.json` / `i18n/en-US.json` — UI translations
- `ui.settings.json` — UI language mode persistence
- `README_SETTINGS.md` — settings / tool usage guide
- `KIND_GUIDE.zh-CN.md` — detailed Chinese guide for the major kinds

## Docs

### Start here

- `docs/QUICK_START.zh-CN.md` — shortest commands + plain-language keyword weighting explanation
- `docs/USAGE_MANUAL.txt` — full command manual
- `tools/soft-router-suggest/README_SETTINGS.md` — customization guide

### Reference docs

- `docs/TECHNICAL.md`
- `docs/SECURITY.md`
- `docs/WINDOWS_INSTALL_REPAIR_UNINSTALL.zh-CN.md`
- `docs/LINUX_DEPLOYMENT.md`
- `docs/NPM_INSTALL.md`
- `docs/ARCHITECTURE_PLAN.md`
- `tools/soft-router-suggest/KIND_GUIDE.zh-CN.md`

## npm / wrapper commands

### npm scripts

```bash
npm run build
npm run openclaw:doctor
npm run openclaw:install -- --dry-run
npm run openclaw:repair
npm run openclaw:uninstall
```

### Windows wrapper scripts

```powershell
.\scripts\doctor.ps1
.\scripts\install.ps1
.\scripts\repair.ps1
.\scripts\uninstall.ps1
```

### Linux wrapper scripts

```bash
./scripts/doctor.sh
./scripts/install.sh
./scripts/repair.sh
./scripts/uninstall.sh
```

## Public release safety

This repo intentionally:

- avoids hardcoded personal absolute paths in runtime defaults
- does **not** include logs, tokens, emails, or `openclaw.json`
- keeps the plugin fail-open where possible
- keeps switching disabled by default on install
- keeps plain `npm install` non-destructive

See `docs/SECURITY.md` for the pre-publish checklist.
