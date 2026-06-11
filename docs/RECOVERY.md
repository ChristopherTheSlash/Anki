# Backup and Recovery

## Create a Backup

```sh
scripts/backup-anki-private-server.sh
```

The backup script stops the sync server if it is running, archives the sync data and local config, then restarts the server.

Backups are stored under:

```text
backups/
```

If the LaunchAgent runtime is active, backups are stored under:

```text
~/Library/Application Support/AnkiPrivateServer/backups/
```

These archives may contain private deck data and `.env` credentials. Keep them private.

## Inspect a Backup

```sh
scripts/restore-dry-run.sh backups/anki-private-server-YYYYMMDD-HHMMSS.tar.gz
```

The dry run lists archive contents and intentionally does not overwrite files.

## Restore Manually

1. Stop the sync server:

```sh
scripts/stop-anki-sync.sh
```

2. Move current data/config aside:

```sh
mv data/syncserver data/syncserver.before-restore
cp .env .env.before-restore
```

3. Extract the chosen backup from `/`:

```sh
sudo tar -xzf /Users/christopherwang/Documents/Anki/backups/anki-private-server-YYYYMMDD-HHMMSS.tar.gz -C /
```

4. Start and verify:

```sh
scripts/start-anki-sync.sh
scripts/status-anki-sync.sh
```

Open Anki Desktop and run a sync check after restore.
