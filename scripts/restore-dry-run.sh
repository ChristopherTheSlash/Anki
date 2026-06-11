#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/anki-sync-env.sh
source "$SCRIPT_DIR/anki-sync-env.sh"

archive="${1:-}"
if [[ -z "$archive" ]]; then
  echo "Usage: scripts/restore-dry-run.sh /path/to/backup.tar.gz" >&2
  echo
  echo "Available backups:"
  ls -1t "$ANKI_PROJECT_DIR"/backups/*.tar.gz 2>/dev/null || true
  exit 2
fi

if [[ ! -f "$archive" ]]; then
  echo "Backup archive not found: $archive" >&2
  exit 3
fi

echo "Dry run only. This archive contains:"
tar -tzf "$archive"

cat <<EOF

To restore for real:
  1. Stop the sync server.
  2. Move the current data/config aside.
  3. Extract this archive from /.
  4. Start the sync server and verify Anki can sync.

This script intentionally does not overwrite anything.
EOF
