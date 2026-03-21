# Contributing to OpenClaw Soft Router

Thanks for contributing.

This project is currently centered on the **keyword-library based 6-kind router** and the matching PowerShell control UI.

## Current routing scope

The active routing taxonomy is:
- `strategy`
- `coding`
- `vision`
- `support`
- `general`
- `chat`

Please avoid reintroducing old category assumptions into new work unless the change is intentional and documented.

## How to contribute

### Reporting bugs
Please include:
- a clear title
- reproduction steps
- expected vs actual behavior
- environment details (Windows / PowerShell / OpenClaw version)
- sanitized logs if relevant

### Suggesting features
Please explain:
- the use case
- expected behavior
- why it is broadly useful

### Pull requests
1. Fork the repository
2. Create a branch
3. Make focused changes
4. Update docs when behavior changes
5. Run validation / sanity checks
6. Open a clear PR

## Development guidelines

### Keep source-of-truth aligned
If you change user-visible behavior, update the matching docs/scripts too:
- `README.md`
- `docs/TECHNICAL.md`
- `docs/USAGE_MANUAL.txt`
- `tools/soft-router-suggest/README_SETTINGS.md`
- `CHANGELOG.md`

If you change tool installation behavior, make sure:
- `scripts/install.ps1`
- `scripts/uninstall.ps1`
- `scripts/doctor.ps1`

stay aligned.

### Current toolchain assumptions
Primary runtime source:
- `tools/soft-router-suggest/keyword-library.json`

Important supporting files:
- `tools/soft-router-suggest/model-priority.json`
- `tools/soft-router-suggest/ui-menu.ps1`
- `tools/soft-router-suggest/manage-overrides.ps1`
- `tools/soft-router-suggest/i18n/`
- `tools/soft-router-suggest/ui.settings.json`

### Security
Never commit:
- personal absolute paths with usernames
- API keys / tokens / credentials
- private logs
- full personal `openclaw.json`

### Testing checklist
Before submitting a PR, verify:
- [ ] `./scripts/doctor.ps1` passes
- [ ] installation still works
- [ ] mode switching still works (`fast` / `rules` / `llm`)
- [ ] UI changes are reflected in docs
- [ ] no hardcoded secrets or personal paths were introduced
- [ ] `CHANGELOG.md` updated if appropriate

## Project structure

```text
plugin/                      # Plugin source
scripts/                     # Install / doctor / mode control
tools/soft-router-suggest/   # Runtime tools, UI, schemas, docs
router-sidecar/              # Optional Router LLM sidecar
docs/                        # Technical and usage docs
```

## License
By contributing, you agree your contributions are provided under the MIT License.
