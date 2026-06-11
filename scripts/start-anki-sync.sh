#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/anki-sync-env.sh
source "$SCRIPT_DIR/anki-sync-env.sh"

require_sync_user
require_anki_bin
ensure_runtime_dirs

existing_pid="$(current_pid || true)"
if pid_is_running "$existing_pid"; then
  echo "Anki sync server is already running with PID $existing_pid."
  exit 0
fi

if [[ -n "$existing_pid" ]]; then
  rm -f "$ANKI_SYNC_PID"
fi

echo "Starting Anki sync server on ${SYNC_HOST}:${SYNC_PORT}"
echo "Logs: $ANKI_SYNC_LOG"

nohup "$SCRIPT_DIR/run-anki-sync-foreground.sh" >>"$ANKI_SYNC_LOG" 2>&1 &
pid="$!"
echo "$pid" > "$ANKI_SYNC_PID"

for _ in {1..20}; do
  if ! pid_is_running "$pid"; then
    echo "Anki sync server exited during startup. Recent logs:" >&2
    tail -40 "$ANKI_SYNC_LOG" >&2 || true
    rm -f "$ANKI_SYNC_PID"
    exit 1
  fi
  if port_is_listening; then
    echo "Started Anki sync server with PID $pid."
    exit 0
  fi
  sleep 0.5
done

if pid_is_running "$pid"; then
  echo "Started Anki sync server with PID $pid, but port $SYNC_PORT is not listening yet."
  echo "Run scripts/status-anki-sync.sh in a few seconds if Anki cannot connect."
else
  echo "Anki sync server exited during startup. Recent logs:" >&2
  tail -40 "$ANKI_SYNC_LOG" >&2 || true
  rm -f "$ANKI_SYNC_PID"
  exit 1
fi
