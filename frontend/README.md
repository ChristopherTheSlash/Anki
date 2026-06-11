# Phone PWA

This folder contains the phone-friendly Progressive Web App for private Anki review.

The static build contains no deck data, API URL, or API token. Configure the private API URL and token from the app's settings screen on each device; those values are stored only in that browser's local storage.

## Local Development

```sh
cd frontend
npm install
npm run dev
```

Open the printed local URL, usually:

```text
http://127.0.0.1:5173
```

Run a production build with:

```sh
npm run build
```

## App Views

- Deck list
- Review queue
- Card front/back
- Answer buttons
- Session stats
- Offline/error state
- Settings

## Private API Requirements

Start the API:

```sh
scripts/start-anki-api.sh
```

The app expects:

- `GET /health`
- `GET /decks`
- `GET /review/next?deck_id=...`
- `POST /review/:card_id/answer`
- `GET /media/:filename`
- `POST /sync/pull`

If `ANKI_API_TOKEN` is set, enter that token in the PWA settings screen.

For local development, include the Vite origin in `.env`:

```sh
ANKI_API_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

For GitHub Pages, add the hosted Pages URL to `ANKI_API_CORS_ORIGINS`.
