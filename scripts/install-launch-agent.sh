#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="local.anki-sync-server"
TARGET="$HOME/Library/LaunchAgents/${LABEL}.plist"
TEMPLATE="$PROJECT_DIR/launchagents/${LABEL}.plist.template"
RUNTIME_DIR="${ANKI_LAUNCHAGENT_RUNTIME_DIR:-$HOME/Library/Application Support/AnkiPrivateServer}"

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  cat >&2 <<EOF
Create $PROJECT_DIR/.env before installing the LaunchAgent:
  cp .env.example .env
  edit .env
EOF
  exit 2
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$RUNTIME_DIR/scripts" "$RUNTIME_DIR/data/syncserver" "$RUNTIME_DIR/logs" "$RUNTIME_DIR/run"

for script in "$PROJECT_DIR"/scripts/*.sh; do
  install -m 755 "$script" "$RUNTIME_DIR/scripts/$(basename "$script")"
done

awk -F= '
  /^[[:space:]]*#/ || /^[[:space:]]*$/ { print; next }
  {
    key=$1
    sub(/^[[:space:]]+/, "", key)
    sub(/[[:space:]]+$/, "", key)
    if (key != "ANKI_PROJECT_DIR" && key != "SYNC_BASE" && key != "ANKI_SYNC_LOG" && key != "ANKI_SYNC_PID") {
      print
    }
  }
' "$PROJECT_DIR/.env" > "$RUNTIME_DIR/.env"
{
  printf 'ANKI_PROJECT_DIR=%q\n' "$RUNTIME_DIR"
  printf 'SYNC_BASE=%q\n' "$RUNTIME_DIR/data/syncserver"
  printf 'ANKI_SYNC_LOG=%q\n' "$RUNTIME_DIR/logs/anki-sync-server.log"
  printf 'ANKI_SYNC_PID=%q\n' "$RUNTIME_DIR/run/anki-sync-server.pid"
} >> "$RUNTIME_DIR/.env"
chmod 600 "$RUNTIME_DIR/.env"

sed "s#__PROJECT_DIR__#$RUNTIME_DIR#g" "$TEMPLATE" > "$TARGET"

launchctl bootout "gui/$(id -u)" "$TARGET" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$TARGET"
launchctl enable "gui/$(id -u)/$LABEL"

echo "Installed and loaded $TARGET"
echo "Runtime: $RUNTIME_DIR"
echo "Start:  launchctl kickstart -k gui/$(id -u)/$LABEL"
echo "Stop:   launchctl bootout gui/$(id -u) $TARGET"
echo "Status: launchctl print gui/$(id -u)/$LABEL"
