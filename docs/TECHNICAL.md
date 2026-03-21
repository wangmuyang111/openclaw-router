# Technical Notes — OpenClaw Soft Router

## 1. Architecture

### Plugin
- Entry: `plugin/index.ts`
- Runs in OpenClaw hooks (notably `before_agent_start`)
- Uses the keyword-library routing flow to:
  - classify a request into one of the 6 kinds
  - select a model list for that kind
  - optionally return a normalized `modelOverride`

### Runtime rule source
Primary routing source of truth:
- `tools/soft-router-suggest/keyword-library.json`

Supporting config:
- `tools/soft-router-suggest/model-priority.json`
- `tools/soft-router-suggest/keyword-overrides.user.example.json`
- `tools/soft-router-suggest/keyword-overrides.user.schema.json`

### Control UI / tooling
- `tools/soft-router-suggest/ui-menu.ps1`
- `tools/soft-router-suggest/manage-overrides.ps1`
- `tools/soft-router-suggest/add-kind.ps1`
- `tools/soft-router-suggest/set-kind-models.ps1`
- `tools/soft-router-suggest/route-preview.ps1`
- `tools/soft-router-suggest/i18n/`
- `tools/soft-router-suggest/ui.settings.json`

### Optional Router LLM sidecar
- `router-sidecar/daemon/server.mjs`
- HTTP: `http://127.0.0.1:18888`
- `POST /route`
- `GET /health`

---

## 2. Current routing taxonomy

The current simplified taxonomy is:

1. `strategy`
2. `coding`
3. `vision`
4. `support`
5. `general`
6. `chat`

Design notes:
- `strategy` absorbs the old planning / advanced-coding high-tier planning intent
- `support` absorbs daily-support / emergency-fallback behavior
- `quick_response` is no longer a top-level routing kind; its wording/signals were preserved by merging into support / general / chat where appropriate

---

## 3. Routing signal model

Each kind may use:

- positive keyword signals
  - `strong`
  - `weak`
- negative keyword signals
- metadata signals
  - e.g. `hasImage`
  - e.g. `hasCodeBlock`
- thresholds
  - `minScore`
  - `highScore`
  - `minStrongHits`
- priority

Examples:
- `vision` gets a strong metadata boost when `hasImage = true`
- `coding` gets extra weight when `hasCodeBlock = true`

---

## 4. Model selection

Each kind carries a priority list of models.

Representative current defaults:
- `strategy`: stronger general reasoning models first
- `coding`: code-oriented models first, general strong models as fallback
- `vision`: vision model first, general models as fallback
- `support` / `general`: balanced general-purpose models

The actual active lists are stored in:
- `tools/soft-router-suggest/keyword-library.json`
- `tools/soft-router-suggest/model-priority.json`

---

## 5. Safe defaults

The install flow is intentionally conservative.

Default installed state:
- plugin enabled
- `ruleEngineEnabled = true`
- `routerLlmEnabled = false`
- `switchingEnabled = false`
- `switchingAllowChat = false`

This lets the plugin operate in a safe suggest/log-first mode until the operator explicitly enables switching.

Operational mode switching is handled by:
- `scripts/router.ps1`

---

## 6. Local-proxy model override normalization

A key runtime fix in the current codebase is provider-aware normalization of `modelOverride`.

Reason:
- local-proxy may advertise models as provider-qualified keys such as `local-proxy/gpt-5.2`
- but the embedded local runtime may expect the unqualified model id, such as `gpt-5.2`

Therefore the plugin normalizes the override before returning it for local-proxy-backed runs.

This avoids failures such as:
- `502 unknown provider for model local-proxy/gpt-5.2`

---

## 7. Control UI behavior

The current PowerShell control UI is bilingual and file-backed.

Important current behaviors:
- language modes: `zh`, `en`, `both`
- language persisted in `ui.settings.json`
- keyword list view shows **effective merged keywords** (base library + user add/remove overrides)
- keyword deletion is **pick-by-number**, not paste-only
- route test is **single-line input** with Enter-to-submit
- add-kind supports English or Chinese kind ids

---

## 8. Portability design

### No hardcoded user-specific runtime paths
Defaults are derived from OpenClaw home/workspace locations.

### Local catalog refresh
Model catalog can be refreshed locally through the provided scripts and UI tooling.

### Fail-open behavior
- Catalog refresh failures do not break routing
- Sidecar failure/timeouts do not break OpenClaw; rule-based routing remains available
- Safe default install avoids switching until explicitly enabled

---

## 9. Current documentation set

Recommended operator docs:
- `README.md`
- `docs/USAGE_MANUAL.txt`
- `tools/soft-router-suggest/README_SETTINGS.md`
- `tools/soft-router-suggest/KIND_GUIDE.zh-CN.md`

---

## 10. Notes on legacy files

Some legacy references may still appear in historical scripts or older release notes, but the current runtime path should be considered:

- keyword-library based
- 6-kind based
- UI/i18n/settings synchronized with the installed tools directory

If documentation conflicts with runtime behavior, the current `tools/soft-router-suggest/` files are the source of truth.
