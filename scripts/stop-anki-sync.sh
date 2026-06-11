#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/anki-sync-env.sh
source "$SCRIPT_DIR/anki-sync-env.sh"

pid="$(current_pid || true)"
if ! pid_is_running "$pid"; then
  rm -f "$ANKI_SYNC_PID"
  echo "Anki sync server is not running."
  exit 0
fi

echo "Stopping Anki sync server with PID $pid..."
kill "$pid"

for _ in {1..20}; do
  if ! pid_is_running "$pid"; then
    rm -f "$ANKI_SYNC_PID"
    echo "Stopped."
    exit 0
  fi
  sleep 0.5
done

echo "Server did not exit after 10 seconds; sending SIGKILL."
kill -9 "$pid" 2>/dev/null || true
rm -f "$ANKI_SYNC_PID"
echo "Stopped."
