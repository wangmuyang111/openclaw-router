# src/plugin

This directory is reserved for the future TypeScript migration of the production plugin runtime.

## Current status

- The active runtime plugin entry remains under `plugin/`.
- Step 1 intentionally does **not** migrate the production plugin into `src/plugin/` yet.
- The goal is to first establish a safe npm + TypeScript build skeleton before refactoring runtime code.

## Planned next steps

In later phases, we will:

1. move plugin sources into `src/plugin/`
2. compile them into `dist/plugin/`
3. update installation/deployment logic to use built artifacts where appropriate
4. preserve compatibility with OpenClaw plugin loading
