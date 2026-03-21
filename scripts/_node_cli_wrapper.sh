#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DIST_CLI="$REPO_ROOT/dist/cli/index.js"

ensure_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is required but was not found in PATH." >&2
    exit 1
  fi
}

ensure_build() {
  if [[ -f "$DIST_CLI" ]]; then
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "Error: dist/cli/index.js is missing and npm was not found in PATH." >&2
    exit 1
  fi

  echo "Build missing: running npm run build..."
  (cd "$REPO_ROOT" && npm run build)

  if [[ ! -f "$DIST_CLI" ]]; then
    echo "Error: CLI entry still missing after build: $DIST_CLI" >&2
    exit 1
  fi
}

run_cli() {
  local command="$1"
  shift || true

  ensure_node
  ensure_build

  echo "Repo: $REPO_ROOT"
  echo "Wrapper: forwarding to Node CLI $command"
  echo "CLI: $DIST_CLI"
  echo

  node "$DIST_CLI" "$command" "$@"
}
