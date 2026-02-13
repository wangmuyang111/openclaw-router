# Security & Privacy (Public GitHub Release)

## Goals

- No personal data in the repo
- No secrets (tokens, cookies, auth profiles, API keys)
- No machine-identifying absolute paths in defaults

## What MUST NOT be committed

- `openclaw.json`
- any `*.jsonl` logs (e.g. `soft-router-suggest.jsonl`)
- breaker state files (runtime logs)
- any `memory/` notes
- any files containing emails / account ids

## Implemented protections

- Plugin defaults derive paths from `%USERPROFILE%` (via `os.homedir()`), not hardcoded usernames.
- Model catalog uses local `openclaw models list --json`.
- Sidecar request payload does not include provider auth secrets.

## Pre-publish checklist

1) Search for personal identifiers:
   - your Windows username (e.g. `C:\\Users\\<you>`) 
   - any email domains (e.g. `@example.com`)

2) Search for machine-specific absolute paths:
   - `C:/Users/`
   - `D:/`
   - `/Users/` (if you edited on macOS)

3) Ensure `.gitignore` excludes:
   - logs
   - backups
   - any runtime state

4) Confirm scripts do not echo secrets.

## Recommended .gitignore

See repo `.gitignore`.
