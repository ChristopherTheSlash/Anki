# Phone and Private Network Validation

Use this checklist after the Mac-side sync server, private API, and GitHub Pages app are working on desktop.

## 1. Create macOS Shortcuts

Create these in the macOS Shortcuts app with the `Run Shell Script` action.

Shortcut name:

```text
Start Anki Server
```

Shell:

```sh
/Users/christopherwang/Documents/Anki/scripts/start-anki-sync.sh
```

Shortcut name:

```text
Stop Anki Server
```

Shell:

```sh
/Users/christopherwang/Documents/Anki/scripts/stop-anki-sync.sh
```

Optional status shortcut:

```text
Anki Server Status
```

Shell:

```sh
/Users/christopherwang/Documents/Anki/scripts/status-anki-sync.sh
```

If macOS asks for permission, allow Shortcuts to run shell scripts and access this project folder.

## 2. Choose the Phone API URL

For the hosted GitHub Pages PWA, the browser origin is HTTPS, so the private API must also be reachable over HTTPS. The preferred path is Tailscale HTTPS.

On the Mac:

```sh
tailscale status
tailscale serve --https=8091 http://127.0.0.1:8090
tailscale serve status
```

Start the private API locally:

```sh
/Users/christopherwang/Documents/Anki/scripts/start-anki-api.sh
```

Use the HTTPS URL printed by `tailscale serve status` as the API URL in the PWA settings screen. It normally looks like:

```text
https://<mac-tailnet-name>.<tailnet>.ts.net
```

If you use a non-Tailscale reverse proxy instead, keep the upstream API bound to `127.0.0.1:8090`, terminate HTTPS at the proxy, and only expose the proxy URL to the phone.

## 3. Configure API CORS

Make sure `.env` includes the hosted Pages origin:

```sh
ANKI_API_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://christophertheslash.github.io
```

Restart the API after changing `.env`.

## 4. Desktop Smoke Test

From the Mac:

```sh
source /Users/christopherwang/Documents/Anki/.env
curl -fsS http://127.0.0.1:8090/health
curl -fsS -H "Authorization: Bearer $ANKI_API_TOKEN" http://127.0.0.1:8090/decks
```

If using Tailscale HTTPS, also test the served URL:

```sh
curl -fsS https://<mac-tailnet-name>.<tailnet>.ts.net/health
```

## 5. Phone Browser Test

On the phone:

1. Connect to the same Tailnet or trusted private network as the Mac.
2. Open `https://christophertheslash.github.io/Anki/`.
3. Open settings.
4. Set the API URL to the Tailscale HTTPS or private HTTPS URL.
5. Set the API token from `ANKI_API_TOKEN`.
6. Save settings and confirm health/decks load.
7. Open a low-risk deck and answer one review card.
8. Add the page to the home screen and reopen it as a PWA.

Do not use the plain `http://127.0.0.1:8090` URL on the phone. On a phone, `127.0.0.1` means the phone itself, not the Mac.

## 6. Completion Criteria

The phone path is complete when:

- The hosted GitHub Pages app opens on the phone.
- The settings screen reaches `/health` through HTTPS.
- The deck list loads through the private API.
- A card can be reviewed from the phone.
- Reopening from the home screen still keeps the configured API URL and token.
