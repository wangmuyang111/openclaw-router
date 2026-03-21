#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_node_cli_wrapper.sh
source "$SCRIPT_DIR/_node_cli_wrapper.sh"

run_cli uninstall "$@"
