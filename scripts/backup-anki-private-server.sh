#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/anki-sync-env.sh
source "$SCRIPT_DIR/anki-sync-env.sh"

BACKUP_DIR="${ANKI_BACKUP_DIR:-$ANKI_PROJECT_DIR/backups}"
timestamp="$(date +%Y%m%d-%H%M%S)"
archive="$BACKUP_DIR/anki-private-server-$timestamp.tar.gz"
was_running=0
launchagent_label="local.anki-sync-server"
launchagent_loaded=0
launchagent_domain="gui/$(id -u)"

mkdir -p "$BACKUP_DIR"

if launchctl print "$launchagent_domain/$launchagent_label" >/dev/null 2>&1; then
  launchagent_loaded=1
fi

pid="$(current_pid || true)"
if pid_is_running "$pid"; then
  was_running=1
  if [[ "$launchagent_loaded" -eq 1 ]]; then
    launchctl kill TERM "$launchagent_domain/$launchagent_label" || true
    for _ in {1..20}; do
      if ! pid_is_running "$pid"; then
        break
      fi
      sleep 0.5
    done
  else
    "$SCRIPT_DIR/stop-anki-sync.sh"
  fi
fi

items=()
[[ -d "$SYNC_BASE" ]] && items+=("$SYNC_BASE")
[[ -f "$ANKI_PROJECT_DIR/.env" ]] && items+=("$ANKI_PROJECT_DIR/.env")
[[ -f "$ANKI_PROJECT_DIR/ANKI_PRIVATE_SERVER_PLAN.md" ]] && items+=("$ANKI_PROJECT_DIR/ANKI_PRIVATE_SERVER_PLAN.md")
[[ -d "$ANKI_PROJECT_DIR/docs" ]] && items+=("$ANKI_PROJECT_DIR/docs")
[[ -d "$ANKI_PROJECT_DIR/scripts" ]] && items+=("$ANKI_PROJECT_DIR/scripts")
[[ -d "$ANKI_PROJECT_DIR/launchagents" ]] && items+=("$ANKI_PROJECT_DIR/launchagents")

if [[ "${#items[@]}" -eq 0 ]]; then
  echo "Nothing to back up."
  exit 0
fi

tar -czf "$archive" "${items[@]}"
echo "Created backup:"
echo "$archive"

if [[ "$was_running" -eq 1 ]]; then
  if [[ "$launchagent_loaded" -eq 1 ]]; then
    launchctl kickstart -k "$launchagent_domain/$launchagent_label"
  else
    "$SCRIPT_DIR/start-anki-sync.sh"
  fi
fi
