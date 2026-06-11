#!/usr/bin/env bash
set -euo pipefail

LABEL="local.anki-sync-server"
TARGET="$HOME/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)" "$TARGET" >/dev/null 2>&1 || true
rm -f "$TARGET"

echo "Uninstalled $LABEL."
