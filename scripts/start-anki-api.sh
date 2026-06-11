#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ANKI_ENV_FILE:-$PROJECT_DIR/.env}"
VENV_DIR="${ANKI_API_VENV:-$PROJECT_DIR/server/.venv}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export ANKI_PROJECT_DIR="${ANKI_PROJECT_DIR:-$PROJECT_DIR}"
export ANKI_API_HOST="${ANKI_API_HOST:-127.0.0.1}"
export ANKI_API_PORT="${ANKI_API_PORT:-8090}"

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/python" -m pip install --upgrade pip >/dev/null
"$VENV_DIR/bin/python" -m pip install -r "$PROJECT_DIR/server/requirements.txt"

exec "$VENV_DIR/bin/python" -m uvicorn server.app:app \
  --host "$ANKI_API_HOST" \
  --port "$ANKI_API_PORT" \
  --app-dir "$PROJECT_DIR"
