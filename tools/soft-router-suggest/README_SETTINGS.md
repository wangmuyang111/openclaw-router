# Soft Router Suggest — Settings & Verification Guide

> Current scheme: **6 kinds: strategy / coding / vision / support / general / chat**

This guide reflects the **current** keyword-library based toolchain and the current PowerShell control UI behavior.

## Task mode default + persistence

- Fresh install default: `taskModeEnabled = false`
- Runtime toggle is persisted in: `tools/soft-router-suggest/runtime-routing.json`
- Restart inherits the previous state:
  - if last time it was on, next start is on
  - if last time it was off, next start is off
- Install / repair preserves an existing `runtime-routing.json`, so user task-mode state is not overwritten anymore

## Global command shims

After `install` / `repair`, the repo refreshes global command shims automatically.
After `uninstall`, those shims are removed automatically.

Available companion commands:
- `openclaw-router`
- `openclaw-soft-router`

Implementation note:
- The companion commands now route through repo wrapper scripts first, so GitHub source installs are more resilient.
- If `dist/cli/index.js` is missing later, the wrapper can try rebuilding before forwarding.

Example:

```powershell
openclaw-router status
openclaw-router fast
openclaw-router rules
openclaw-router llm
openclaw-router doctor
openclaw-router install
openclaw-router repair
openclaw-router uninstall

openclaw-soft-router status
```

## Start here first

If you only want the shortest startup commands and a plain-language explanation of the routing logic, read:

- `../../docs/QUICK_START.zh-CN.md`

If you want the full command manual, read:

- `../../docs/USAGE_MANUAL.txt`

This file is mainly for **settings and customization**.

## Keyword weighting explained in plain language

You can think of the router as a score competition between kinds.

For each input:

- `strong` keywords add a big score
- `weak` keywords add a smaller score
- `negative` keywords subtract score or suppress a kind
- metadata can add extra boosts
  - image present → `vision` gains extra weight
  - code block present → `coding` gains extra weight

A useful mental model is:

```text
final score ≈ strong bonus + weak bonus - negative penalty + metadata bonus
```

So when you customize keywords:

- put unmistakable signals into `strong`
- put broad supporting hints into `weak`
- put cross-kind confusion terms into `negative`
- avoid dumping too many generic words into `strong`

## What can be verified here

1. Auto / refresh model catalog
2. Per-kind model selection and priority order
3. Keyword management and user overrides
4. Local route preview / route test (**NO LLM calls**)
5. Current bilingual control UI behavior

---

## 1) Auto-fetch model catalog (cached)

```powershell
cd tools/soft-router-suggest

# Use cache if fresh
.\catalog.ps1

# Force refresh
.\catalog.ps1 -Refresh

# Custom TTL
.\catalog.ps1 -TtlMinutes 60
```

Output includes fields such as:
- `fetchedAt`
- `ttlMinutes`
- `models[]`

---

## 2) Set model list for all kinds (or one kind)

```powershell
cd tools/soft-router-suggest

# Set ALL kinds to a single model
.\set-kind-models.ps1 -ModelId local-proxy/gpt-5.2

# Set one kind only
.\set-kind-models.ps1 -Kind strategy -ModelId local-proxy/gpt-5.4
```

The current effective model lists are also stored in `keyword-library.json` / `model-priority.json`.

---

## 3) Keyword overrides

User overrides file:
- `keyword-overrides.user.json`

Schema:
- `keyword-overrides.user.schema.json`

Example:
- `keyword-overrides.user.example.json`

Command-line management:

```powershell
cd tools/soft-router-suggest

# Add keywords
.\manage-overrides.ps1 add -SetId coding.strong -PastedText "TypeError`nTraceback"

# Remove keywords
.\manage-overrides.ps1 remove -SetId strategy.weak -PastedText "gantt"

# List overrides
.\manage-overrides.ps1 list

# List one set only
.\manage-overrides.ps1 list -SetId strategy.strong

# Clear one set
.\manage-overrides.ps1 clear -SetId coding.strong
```

### Notes
- supported separators include newline, `,`, `，`, `、`, `/`
- plain space is intentionally **not** treated as a separator
- the UI now shows **effective keywords**, not just override diffs

---

## 4) Local route preview (NO LLM calls)

```powershell
cd tools/soft-router-suggest

.\route-preview.ps1 -Text "请帮我修复这个 TypeError"
.\route-preview.ps1 -Text "我有一张截图" -HasImage
```

Output includes routing details such as:
- `decision.kind`
- score / confidence
- matched terms

---

## 5) PowerShell Control UI

Main entry:

```powershell
cd tools/soft-router-suggest
.\ui-menu.ps1
```

Current top-level menu:

1. 模型目录 / Model catalog
2. 类别管理 / Kind admin
3. 查看类别对应模型列表 / Show kind model lists
4. 类别模型的选定与修改 / Select and edit kind models
5. 类别关键词管理 / Kind keyword management
6. 路由测试 / Route test
7. 语言 / Language
0. 退出 / Exit

### Current UI behavior

- language modes: `zh`, `en`, `both`
- language choice persisted in `ui.settings.json`
- add-kind supports English or Chinese kind ids
- after `新增类别 / Add kind`, the UI can continue directly into keyword/model/priority setup
- keyword deletion uses **pick by number**
- keyword list view shows the **effective merged keyword set**
- route test uses **single-line input** and **Enter to submit**
- `ESC` is supported as back/cancel in the main interactive flows

---

## 6) Current kind reference

- `strategy`
- `coding`
- `vision`
- `support`
- `general`
- `chat`

For a detailed guide to the first five major kinds, see:
- `KIND_GUIDE.zh-CN.md`
