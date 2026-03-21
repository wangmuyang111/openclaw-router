# npm Install / Build / CLI Usage

This repository now supports a standard npm + TypeScript workflow.

---

## 1. Design principle

Plain dependency installation should be safe.

So the project now follows this rule:

- `npm install` → installs dependencies only
- `npm run build` → compiles the TypeScript CLI
- deployment into OpenClaw is explicit and opt-in

This avoids surprising behavior during CI or local dependency setup.

---

## 2. Basic workflow

```bash
npm install
npm run build
```

After that, the compiled CLI will be available at:

```text
dist/cli/index.js
```

---

## 3. npm scripts provided by the repo

### Build scripts

```bash
npm run build
npm run clean
```

### Direct Node CLI lifecycle scripts

```bash
npm run openclaw:doctor
npm run openclaw:install
npm run openclaw:repair
npm run openclaw:uninstall
```

Examples:

```bash
npm run openclaw:doctor
npm run openclaw:install -- --dry-run
npm run openclaw:install
npm run openclaw:repair -- --dry-run
npm run openclaw:uninstall
```

### Windows convenience scripts

```bash
npm run windows:doctor
npm run windows:install
npm run windows:repair
npm run windows:uninstall
```

These call the `.ps1` wrappers and are mainly intended for Windows users.

---

## 4. Direct CLI usage

Because `package.json` defines a `bin` entry, the project is moving toward standard CLI usage:

```bash
node ./dist/cli/index.js doctor
node ./dist/cli/index.js install --dry-run
node ./dist/cli/index.js install
node ./dist/cli/index.js repair
node ./dist/cli/index.js uninstall
node ./dist/cli/index.js uninstall --remove-files
```

Future packaging can expose this more cleanly as:

```bash
openclaw-soft-router doctor
openclaw-soft-router install
```

or through `npx` after publication.

---

## 5. Why `npm install` no longer deploys automatically

Earlier script-first layouts often tied install actions directly to dependency installation.
That is risky because:

- CI may unexpectedly patch local config
- developers may only want dependencies, not deployment
- public npm users expect `npm install` to be non-destructive

So deployment is now intentionally explicit.

---

## 6. Recommended command sets

### For developers

```bash
npm install
npm run build
npm run openclaw:doctor
```

### For Windows operators

```powershell
npm install
npm run build
npm run windows:install
npm run windows:doctor
```

### For Linux operators

```bash
npm install
npm run build
./scripts/install.sh
./scripts/doctor.sh
```

---

## 7. Publish-readiness notes

Before publishing this package to GitHub or npm, finish these items:

1. verify `repository` / `bugs` / `homepage` metadata still matches the real remote
2. verify the `files` whitelist is correct
3. validate install/repair/uninstall on Windows and Linux
4. ensure secrets and local config snapshots are excluded
5. document `npx` usage once package naming is final
