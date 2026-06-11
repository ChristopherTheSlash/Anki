# Private Review API

This folder contains the first private phone-review API prototype.

It uses FastAPI plus Anki's official Python package. The API opens a private working copy of your desktop collection under `data/api/collection.anki2`; it does not directly mutate the live Anki Desktop profile.

## Run

Close Anki Desktop, or make sure it is idle, before pulling a fresh copy of the collection.

```sh
scripts/start-anki-api.sh
```

Default URL:

```text
http://127.0.0.1:8090
```

If `ANKI_API_TOKEN` is set in `.env`, protected endpoints require:

```text
Authorization: Bearer <token>
```

## Endpoints

- `GET /health`
- `GET /decks`
- `GET /review/next?deck_id=...`
- `POST /review/:card_id/answer`
- `GET /media/:filename`
- `POST /sync/pull` copies the configured source collection into the API workdir.
- `POST /sync/push` currently returns `501` by design.

## Current Limits

- Review answers update only the API working copy.
- Writeback to the desktop collection is disabled until conflict-safe syncing is designed.
- The cleanest pull path is to close Anki Desktop before calling `/sync/pull`.
- This is a local/private API. Keep it on `127.0.0.1` until Tailscale/HTTPS/auth hardening is finished.
