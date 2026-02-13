# Technical Notes — OpenClaw Soft Router

## Architecture

- OpenClaw plugin: `plugin/index.ts`
  - Runs in hooks (notably `before_agent_start`)
  - Classifies message into a **kind** (8 categories + protected chat)
  - Picks a model using `tools/soft-router-suggest/model-priority.json`
  - Optionally consults Router LLM sidecar (fail-open)

- Rule configs:
  - `tools/soft-router-suggest/router-rules.json`
  - `tools/soft-router-suggest/model-priority.json`

- Router LLM sidecar:
  - `router-sidecar/daemon/server.mjs`
  - HTTP: `http://127.0.0.1:18888`
  - `POST /route` and `GET /health`

## Portability design

### No absolute paths

Defaults are derived from:

- `%USERPROFILE%\.openclaw\logs`
- `%USERPROFILE%\.openclaw\workspace\tools\soft-router-suggest\...`

### Local model catalog

Model list is fetched locally via:

- `openclaw models list --json`

If `openclaw` is not on PATH, set plugin config:

- `openclawCliPath: "C:/path/to/openclaw.exe"`

### Manual catalog refresh

Create the flag file:

- `%USERPROFILE%\.openclaw\workspace\tools\soft-router-suggest\.force-refresh-catalog`

The plugin consumes it on next request, invalidates the in-memory cache, and refreshes.

## Routing logic overview

- `quick_response` intent override wins when explicit “answer-only” constraints appear
- `planning` and `coding` are protected by gating to reduce weak-keyword hijacks
- `general` is tuned for deep writing/research and includes negative gating to avoid swallowing coding/planning/quick

## Fail-open guarantees

- Catalog refresh failures never break routing; stale cache is reused briefly.
- Router LLM failures/timeouts never break OpenClaw; rule-engine remains the fallback.

## Known operational constraints

- Provider cooldown/429 and variable latency can cause router-agent timeouts.
- Sidecar has circuit breaker logic to avoid repeated timeouts.
