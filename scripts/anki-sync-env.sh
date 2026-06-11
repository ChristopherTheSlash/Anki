#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ANKI_ENV_FILE:-$PROJECT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export ANKI_PROJECT_DIR="${ANKI_PROJECT_DIR:-$PROJECT_DIR}"
export SYNC_HOST="${SYNC_HOST:-127.0.0.1}"
export SYNC_PORT="${SYNC_PORT:-8080}"
export SYNC_BASE="${SYNC_BASE:-$ANKI_PROJECT_DIR/data/syncserver}"
if [[ -z "${ANKI_BIN:-}" ]]; then
  if [[ -x "$HOME/Library/Application Support/AnkiProgramFiles/.venv/bin/anki" ]]; then
    ANKI_BIN="$HOME/Library/Application Support/AnkiProgramFiles/.venv/bin/anki"
  elif [[ -x "/Applications/Anki.app/Contents/MacOS/launcher" ]]; then
    ANKI_BIN="/Applications/Anki.app/Contents/MacOS/launcher"
  else
    ANKI_BIN="/Applications/Anki.app/Contents/MacOS/anki"
  fi
fi
export ANKI_BIN
export ANKI_SYNC_LOG="${ANKI_SYNC_LOG:-$ANKI_PROJECT_DIR/logs/anki-sync-server.log}"
export ANKI_SYNC_PID="${ANKI_SYNC_PID:-$ANKI_PROJECT_DIR/run/anki-sync-server.pid}"

require_sync_user() {
  if [[ -z "${SYNC_USER1:-}" ]]; then
    cat >&2 <<EOF
SYNC_USER1 is not set.

Copy .env.example to .env and set:
  SYNC_USER1=username:long-random-password
EOF
    exit 2
  fi
}

require_anki_bin() {
  if [[ ! -x "$ANKI_BIN" ]]; then
    cat >&2 <<EOF
Anki executable was not found at:
  $ANKI_BIN

Install Anki with:
  brew install --cask anki

Or set ANKI_BIN in .env to the correct path.

Common paths:
  ~/Library/Application Support/AnkiProgramFiles/.venv/bin/anki
  /Applications/Anki.app/Contents/MacOS/launcher
  /Applications/Anki.app/Contents/MacOS/anki
EOF
    exit 3
  fi
}

pid_is_running() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

current_pid() {
  if [[ -f "$ANKI_SYNC_PID" ]]; then
    tr -d '[:space:]' < "$ANKI_SYNC_PID"
  fi
}

ensure_runtime_dirs() {
  mkdir -p "$SYNC_BASE" "$(dirname "$ANKI_SYNC_LOG")" "$(dirname "$ANKI_SYNC_PID")"
}

port_is_listening() {
  if ! command -v lsof >/dev/null 2>&1; then
    return 1
  fi
  lsof -nP -iTCP:"$SYNC_PORT" -sTCP:LISTEN >/dev/null 2>&1
}
