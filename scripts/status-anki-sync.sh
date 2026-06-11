#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/anki-sync-env.sh
source "$SCRIPT_DIR/anki-sync-env.sh"

pid="$(current_pid || true)"
if pid_is_running "$pid"; then
  echo "Anki sync server: running"
  echo "PID: $pid"
else
  echo "Anki sync server: stopped"
  [[ -n "$pid" ]] && rm -f "$ANKI_SYNC_PID"
fi

echo "Host: $SYNC_HOST"
echo "Port: $SYNC_PORT"
echo "Data: $SYNC_BASE"
echo "Log: $ANKI_SYNC_LOG"

if command -v lsof >/dev/null 2>&1; then
  listener="$(lsof -nP -iTCP:"$SYNC_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$listener" ]]; then
    echo "Port $SYNC_PORT: listening"
    if ! pid_is_running "$pid"; then
      echo
      echo "$listener"
    fi
  else
    echo "Port $SYNC_PORT: not listening"
  fi
fi
