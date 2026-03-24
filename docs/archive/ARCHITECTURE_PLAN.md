# Architecture Plan — OpenClaw Soft Router

This document defines the phased migration path from a Windows-first script/plugin repository into a standard, cross-platform npm + TypeScript project.

## Project goals

The finished project should be:

- public-ready on GitHub
- compilable with `npm install` + `npm run build`
- deployable on Windows and Linux
- usable through a Node CLI (`install`, `doctor`, `repair`, `uninstall`)
- still compatible with OpenClaw plugin loading
- safe by default (no implicit mutation of user config during plain dependency installation)

## Non-goals for Step 1

Step 1 intentionally does **not**:

- rewrite the production plugin runtime
- remove existing PowerShell workflows
- introduce breaking deployment behavior
- auto-modify `~/.openclaw/openclaw.json` during plain `npm install`

## Guiding principles

1. **Core logic lives in Node CLI**
   - Cross-platform logic should be implemented once in TypeScript.
   - PowerShell/Bash scripts should become thin wrappers over time.

2. **`npm install` should be safe**
   - Installing dependencies must not silently mutate OpenClaw config.
   - Actual deployment should be opt-in through `npx ... install` or `npm run openclaw:install`.

3. **Phased migration, not a rewrite**
   - Keep current plugin entry and scripts working while scaffolding the new architecture.
   - Migrate in reviewable commits.

4. **Windows and Linux use the same OpenClaw home model**
   - OpenClaw home: `~/.openclaw`
   - Workspace: `~/.openclaw/workspace`

5. **Public release hygiene is mandatory**
   - No secrets, personal logs, private config snapshots, or machine-specific tokens in the repository.

## Phases

### Phase 0 — Safety and scope

- confirm project direction
- identify hard blockers before public release
- define migration sequencing

### Phase 1 — Build skeleton

Deliverables:

- `tsconfig.json`
- `src/cli/` scaffold
- build scripts in `package.json`
- `bin` entry for future CLI usage
- minimal `npm run build` success path

Acceptance criteria:

- `npm install` succeeds without mutating OpenClaw
- `npm run build` succeeds
- existing plugin runtime path remains unchanged

### Phase 2 — Cross-platform CLI implementation

Implement Node CLI commands:

- `install`
- `doctor`
- `repair`
- `uninstall`

Acceptance criteria:

- CLI can resolve OpenClaw home/workspace
- dry-run mode exists where appropriate
- file copy / config backup / config patching are implemented in Node

### Phase 3 — Windows wrapper scripts

Refactor:

- `scripts/install.ps1`
- `scripts/doctor.ps1`
- `scripts/uninstall.ps1`
- add `scripts/repair.ps1`

Acceptance criteria:

- PowerShell scripts remain user-friendly
- wrappers call the Node CLI (or temporarily fall back to legacy behavior during transition)

### Phase 4 — Linux support

Add:

- `scripts/install.sh`
- `scripts/doctor.sh`
- `scripts/repair.sh`
- `scripts/uninstall.sh`
- Linux deployment docs

Acceptance criteria:

- Ubuntu smoke test path works
- no Windows-specific assumptions remain in deployment logic

### Phase 5 — Packaging and UX

Add/complete:

- `openclaw-soft-router` bin command
- `npm run openclaw:*` scripts
- `npx` usage docs
- packaging whitelist (`files`)

Acceptance criteria:

- project is understandable to both developers and operators
- install/build/deploy commands are documented and consistent

### Phase 6 — CI and release quality

Upgrade CI to validate:

- build on Windows + Ubuntu
- smoke tests for CLI
- JSON validity
- secret detection

Acceptance criteria:

- CI green on Windows and Linux
- public release checklist passes

## Current hard blockers before public GitHub release

These must be resolved before final publication:

1. `package.json` still contains placeholder repository metadata (`YOUR_USERNAME`).
2. Local sensitive snapshots such as `tmp_openclaw.json*` must remain ignored and never be committed.
3. Documentation must be aligned with the new npm/CLI workflow once Phase 2+ lands.

## Proposed repository direction

Target structure:

```text
src/
  cli/
    index.ts
    shared.ts
    install.ts
    doctor.ts
    repair.ts
    uninstall.ts
  plugin/
    ...future migrated runtime sources...

plugin/                 # current production plugin entry remains during migration
scripts/                # Windows/Linux wrappers
tools/soft-router-suggest/
router-sidecar/
docs/
```

## Step 1 definition of done

Step 1 is complete when:

- TypeScript build scaffold exists
- a minimal CLI binary compiles
- npm scripts are ready for future migration
- plain `npm install` no longer mutates the user's OpenClaw environment
- current plugin/runtime behavior is not broken
- the path to Phase 2 is documented
