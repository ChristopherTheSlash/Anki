#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/anki-sync-env.sh
source "$SCRIPT_DIR/anki-sync-env.sh"

require_sync_user
require_anki_bin
ensure_runtime_dirs

echo "Starting Anki sync server on ${SYNC_HOST}:${SYNC_PORT}"
echo "SYNC_BASE=${SYNC_BASE}"

"$ANKI_BIN" --syncserver &
child_pid="$!"
echo "$child_pid" > "$ANKI_SYNC_PID"

cleanup() {
  kill "$child_pid" 2>/dev/null || true
  rm -f "$ANKI_SYNC_PID"
}
trap cleanup EXIT INT TERM

wait "$child_pid"
