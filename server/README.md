# Private Review API

This folder contains the private phone-review API.

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
- `GET /decks` returns each deck with total, due, new, learning, and review counts from Anki's scheduler.
- `GET /review/next?deck_id=...`
- `POST /review/:card_id/answer`
- `GET /media/:filename`
- `POST /sync/pull` copies the configured source collection into the API workdir.
- `POST /sync/push` copies the API working collection back to the configured desktop collection after creating a backup. It returns `409` if Anki Desktop still has the source collection open.

## Current Limits

- Review answers update the API working copy until `/sync/push` is called.
- Close Anki Desktop before `/sync/pull` and `/sync/push` when possible, so copied SQLite files reflect a clean state.
- This is a local/private API. Keep it on `127.0.0.1` until Tailscale/HTTPS/auth hardening is finished.
