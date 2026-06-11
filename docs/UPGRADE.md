# Upgrade Checklist

Use this checklist before upgrading Anki Desktop, the API dependencies, or the phone app.

## Before Upgrading

1. Stop Anki Desktop.
2. Create a fresh private-server backup:

```sh
scripts/backup-anki-private-server.sh
```

3. Confirm the current API tests pass:

```sh
server/.venv/bin/python -m pip install -r server/requirements-dev.txt
server/.venv/bin/python -m pytest server/tests -q
```

4. Confirm the phone PWA still builds:

```sh
npm --prefix frontend run build
```

## Upgrade

1. Upgrade only one layer at a time: Anki Desktop, Python API dependencies, or frontend dependencies.
2. If changing API dependencies, update `server/requirements.txt` with exact pinned versions.
3. Run `/sync/pull` against a copy of the latest desktop collection before reviewing on the phone.

## After Upgrading

1. Run the API tests again.
2. Start the API and check `/health`.
3. Fetch decks from the PWA settings screen or with `curl`.
4. Review one low-risk card through the API working copy.
5. Push a low-risk reviewed card only after closing Anki Desktop, then confirm `/sync/push` creates a backup and the desktop collection reflects the review.
