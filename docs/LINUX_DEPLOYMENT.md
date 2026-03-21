# Linux Deployment Guide — OpenClaw Soft Router

This document explains how to build, install, repair, and uninstall the `soft-router-suggest` OpenClaw plugin on Linux.

---

## 1. Scope

Supported deployment style:

- Linux host with OpenClaw already installed
- Node.js 18+ available in `PATH`
- bash available
- OpenClaw configured at least once (`openclaw configure`)

Default paths used by the cross-platform CLI:

- OpenClaw home: `~/.openclaw`
- OpenClaw workspace: `~/.openclaw/workspace`

The Linux shell scripts in `scripts/*.sh` are thin wrappers over the Node CLI.

---

## 2. Prerequisites

Make sure these commands work:

```bash
node -v
npm -v
openclaw --version
```

Recommended:

- Node.js 18 or newer
- OpenClaw already configured once so that `~/.openclaw/openclaw.json` exists

If `openclaw.json` does not exist yet, run:

```bash
openclaw configure
```

---

## 3. Clone and build

```bash
git clone https://github.com/wangmuyang111/openclaw-router.git
cd openclaw-router
npm install
npm run build
```

The repository is designed so that plain `npm install` only installs dependencies.
It does **not** silently modify your OpenClaw environment.

---

## 4. Make shell wrappers executable

Before using the Linux wrappers, mark them executable:

```bash
chmod +x scripts/*.sh
```

This enables:

- `scripts/doctor.sh`
- `scripts/install.sh`
- `scripts/repair.sh`
- `scripts/uninstall.sh`

---

## 5. Linux usage flows

### 5.1 Read-only health check

```bash
./scripts/doctor.sh
```

This checks:

- `~/.openclaw/openclaw.json`
- OpenClaw CLI availability
- plugin source directory in the repo
- installed plugin directory in the workspace
- tools directory and key JSON/UI files
- sidecar `/health` endpoint (warning only unless you use LLM mode)

---

### 5.2 Preview install without changing files

```bash
./scripts/install.sh --dry-run
```

This prints the full cross-platform install plan:

- target directories
- plugin files to copy
- tools directory copy plan
- `keyword-overrides.user.json` preservation behavior
- `openclaw.json` backup plan
- plugin config patch plan

---

### 5.3 Real install

```bash
./scripts/install.sh
```

The install flow will:

1. create workspace plugin/tools directories if needed
2. copy plugin files into:
   - `~/.openclaw/workspace/.openclaw/extensions/soft-router-suggest`
3. copy tool files into:
   - `~/.openclaw/workspace/tools/soft-router-suggest`
4. create `keyword-overrides.user.json` from example if missing
5. back up `~/.openclaw/openclaw.json`
6. enable the plugin in config with safe defaults:
   - `enabled = true`
   - `ruleEngineEnabled = true`
   - `routerLlmEnabled = false`
   - `switchingEnabled = false`
   - `switchingAllowChat = false`
   - `openclawCliPath = "openclaw"`

---

### 5.4 Repair

Dry-run repair:

```bash
./scripts/repair.sh --dry-run
```

Real repair:

```bash
./scripts/repair.sh
```

Current repair behavior is intentionally conservative:

1. run `doctor`
2. re-run `install`

It does **not** delete plugin files first.
That is deliberate, to avoid destructive repair behavior.

---

### 5.5 Uninstall

Disable plugin only:

```bash
./scripts/uninstall.sh
```

Disable plugin and remove copied files:

```bash
./scripts/uninstall.sh --remove-files
```

`--remove-files` removes:

- `~/.openclaw/workspace/.openclaw/extensions/soft-router-suggest`
- `~/.openclaw/workspace/tools/soft-router-suggest`

Use that mode carefully.

---

## 6. Optional: direct Node CLI usage

You can also call the compiled CLI directly:

```bash
node ./dist/cli/index.js doctor
node ./dist/cli/index.js install --dry-run
node ./dist/cli/index.js install
node ./dist/cli/index.js repair
node ./dist/cli/index.js uninstall
node ./dist/cli/index.js uninstall --remove-files
```

The shell wrappers exist mainly for convenience.

---

## 7. Operational notes

### Plugin state after install

After install, the plugin is enabled but switching stays disabled by default.
That means the plugin starts in a safe, suggestion-first mode.

### To change runtime mode

Use the existing router tools after install, for example from Windows docs / project docs.
If you later add Linux-specific router switching documentation, keep it aligned with `scripts/router.ps1` semantics.

### Sidecar health warning

If `doctor` reports sidecar `/health` as not healthy, that is expected unless you are actively using Router LLM mode.

---

## 8. Recommended publish-time checks

Before claiming Linux support in GitHub README/release notes, verify on a real Linux host:

```bash
npm install
npm run build
./scripts/doctor.sh
./scripts/install.sh --dry-run
./scripts/install.sh
./scripts/repair.sh --dry-run
./scripts/uninstall.sh
```

If you want to validate destructive uninstall too:

```bash
./scripts/install.sh
./scripts/uninstall.sh --remove-files
```

Only do that when you are intentionally testing removal.
