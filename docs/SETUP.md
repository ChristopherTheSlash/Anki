# Private Anki Server Setup

## 1. Install Anki

```sh
brew install --cask anki
```

The scripts auto-detect Anki's launcher-managed runtime and current/older packaged app paths:

```text
~/Library/Application Support/AnkiProgramFiles/.venv/bin/anki
/Applications/Anki.app/Contents/MacOS/launcher
/Applications/Anki.app/Contents/MacOS/anki
```

If your app lives somewhere else, set `ANKI_BIN` in `.env`.

On Anki 25.09, launching Anki once or running this command prepares the managed runtime:

```sh
cd "$HOME/Library/Application Support/AnkiProgramFiles"
/Applications/Anki.app/Contents/MacOS/uv sync
```

## 2. Configure Local Secrets

```sh
cp .env.example .env
```

Edit `.env` and set:

```sh
SYNC_USER1=username:long-random-password
```

Keep `SYNC_HOST=127.0.0.1` for local testing. Change it only when you are ready to sync from another device over LAN or Tailscale.

## 3. Start and Check the Sync Server

```sh
scripts/start-anki-sync.sh
scripts/status-anki-sync.sh
```

Stop it with:

```sh
scripts/stop-anki-sync.sh
```

Logs are written to `logs/anki-sync-server.log`.

When the LaunchAgent runtime is installed, the active runtime files live under:

```text
~/Library/Application Support/AnkiPrivateServer
```

In that mode, use `scripts/status-anki-sync.sh` from this project to see the active data, PID, and log paths.

## 4. Configure Anki Desktop

In Anki Desktop:

1. Open Settings or Preferences.
2. Open the Syncing section.
3. Choose the self-hosted sync server option.
4. For local testing, enter:

```text
http://127.0.0.1:8080
```

When Anki prompts for credentials, use the username and password from `SYNC_USER1`. The prompt may still say AnkiWeb; that is cosmetic.

The first sync to an empty private server should be an upload from this Mac.

## 5. Optional LaunchAgent

After `.env` exists:

```sh
scripts/install-launch-agent.sh
```

The installer copies the runtime scripts and `.env` into:

```text
~/Library/Application Support/AnkiPrivateServer
```

This avoids macOS background privacy restrictions that can prevent LaunchAgents from reading files under `~/Documents`.
After installation, active sync data, logs, PID files, and backups are created inside that runtime directory unless overridden in `.env`.

Manual LaunchAgent commands:

```sh
launchctl kickstart -k gui/$(id -u)/local.anki-sync-server
launchctl kill TERM gui/$(id -u)/local.anki-sync-server
launchctl print gui/$(id -u)/local.anki-sync-server
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/local.anki-sync-server.plist
```

Use `kill TERM` to stop the loaded service without uninstalling it. Use `bootout` when you want to unload it.

Uninstall:

```sh
scripts/uninstall-launch-agent.sh
```

## 6. Phone or LAN Access

Prefer Tailscale. Set `SYNC_HOST` to a Tailscale or LAN-reachable address only when you intentionally want other devices to connect.

Do not expose the plain sync server directly to the public internet.

For the phone PWA, follow the validation checklist in `docs/PHONE_VALIDATION.md`. The hosted GitHub Pages app needs the private API to be reachable over HTTPS; Tailscale HTTPS is the recommended first setup.

## 7. Private Review API

The API uses FastAPI and Anki's official Python package. It copies the configured desktop collection into a private API workdir before opening it.

```sh
scripts/start-anki-api.sh
```

Default API URL:

```text
http://127.0.0.1:8090
```

Useful smoke checks:

```sh
curl http://127.0.0.1:8090/health
curl -X POST -H "Authorization: Bearer $ANKI_API_TOKEN" http://127.0.0.1:8090/sync/pull
curl -H "Authorization: Bearer $ANKI_API_TOKEN" http://127.0.0.1:8090/decks
```

Close Anki Desktop before `/sync/pull` when possible, so the copied SQLite file reflects the latest clean state.

## 8. Phone PWA

The phone app lives in `frontend/`. It is a static Vite/React PWA and does not bundle private deck data, API URLs, or API tokens.

Local run:

```sh
cd frontend
npm install
npm run dev
```

Production build:

```sh
cd frontend
npm run build
```

In the app settings screen, enter the private API URL and `ANKI_API_TOKEN`. For a phone, the API URL must be reachable from the phone, usually over Tailscale or trusted LAN.

For local browser testing, set:

```sh
ANKI_API_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

For GitHub Pages, add the final Pages origin to `ANKI_API_CORS_ORIGINS`:

```sh
ANKI_API_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://christophertheslash.github.io
```

The API also supports:

```sh
ANKI_API_RATE_LIMIT_PER_MINUTE=120
ANKI_API_LOG_LEVEL=INFO
```

## 9. GitHub Pages Deployment

The workflow at `.github/workflows/deploy-frontend.yml` builds `frontend/` and deploys `frontend/dist` to GitHub Pages.

After creating the GitHub repository:

1. Push this project to the repository's `main` branch.
2. In GitHub, open Settings -> Pages.
3. Set the source to GitHub Actions.
4. Run the `Deploy frontend to GitHub Pages` workflow, or push a frontend change.

If this is a project Pages site, the workflow sets `VITE_BASE_PATH` to `/<repository-name>/`. If this is a user or organization Pages site such as `username.github.io`, change `VITE_BASE_PATH` in the workflow to `/`.

The hosted app still calls your private API directly from the phone browser. Use HTTPS for that API endpoint. Tailscale HTTPS is the recommended first path.

See `docs/PHONE_VALIDATION.md` for the phone checklist, Tailscale HTTPS commands, and macOS Shortcuts recipes.

## 10. Optional Daily Backups

The template at `launchagents/local.anki-private-backup.plist.template` runs `scripts/backup-anki-private-server.sh` every day at 04:15.

Install it manually after replacing `__PROJECT_DIR__` with this project path:

```sh
sed "s#__PROJECT_DIR__#$(pwd)#g" launchagents/local.anki-private-backup.plist.template > ~/Library/LaunchAgents/local.anki-private-backup.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.anki-private-backup.plist
launchctl print gui/$(id -u)/local.anki-private-backup
```

Unload it with:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/local.anki-private-backup.plist
```
