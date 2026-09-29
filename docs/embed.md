# Put SafetyBot inside a company tool

A technician app does not need to reinvent hold-to-talk. It needs a safety button, then a way for the official EHS system to receive the case.

SafetyBot is a website (`/`, `/draft`, `/done`) plus a small HTTP API. There is no npm widget today. Pick one of the five strategies below. Most companies should start at **1**.

License is [MIT](../LICENSE). Taking the code (strategy 5) is allowed. You then own the fork.

```
Technician tool                  SafetyBot host                 EHS / safety system
┌────────────────┐            ┌────────────────┐           ┌────────────────┐
│ Report safety   │  open / API   │ mic, photo,     │  webhook   │ official case   │
│ (their screens) │ ──────────→ │ draft, submit   │ ───────→ │ file            │
└────────────────┘            └────────────────┘           └────────────────┘
```

The host keeps at most 200 reports. Copy each case out. See [microsoft.md](microsoft.md) and [api.md](api.md).

## Choose a strategy

| # | Strategy | Effort | You change SafetyBot? | Looks like their app? |
| --- | --- | --- | --- | --- |
| 1 | Button opens SafetyBot | Hours | No | No — full SafetyBot screen |
| 2 | Native WebView | Days | Maybe query flags | Almost — their chrome, our mic |
| 3 | iframe on an intranet page | Days | Frame-ancestors later | Panel inside their page |
| 4 | Their UI, SafetyBot APIs | Weeks | Harden AI routes | Yes |
| 5 | Take the code (fork) | Weeks–months | You own the fork | Yes |

Data to EHS is the same in every row: webhook on Submit and/or `GET /api/reports`.

## 1. Button that opens SafetyBot (start here)

Add one control to the technician tool:

```
Report a safety case → https://safety.company.com/
```

Open it in the system browser, a new tab, or an in-app browser. The worker uses hold-to-talk, photos, and `/draft` as usual. Submit already posts the webhook and stores the row.

Optional query string later (not built yet — small change):

```
https://safety.company.com/?org_id=site-12&lang=fi&return=https://tech.company.com/job/441
```

Do this when you want production next week. No embed SDK required.

## 2. WebView in the technician app

Android and many iOS in-app browsers can load the SafetyBot origin full screen.

Need:

- `https://` (mic and camera fail on plain HTTP)
- Native permission prompts for microphone and camera, then forwarded to the WebView
- Cookies enabled if Entra sign-in is on
- First visit online so the service worker can cache the shell ([offline.md](offline.md))

Do not wrap `/admin` in the technician WebView. Point only at `/`.

SSO works here better than in an iframe because the view is top-level.

## 3. iframe on a company page

Possible. Fragile on phones.

```html
<iframe
  src="https://safety.company.com/"
  allow="microphone; camera"
  title="SafetyBot"
></iframe>
```

The parent page must send Permissions-Policy that allows mic and camera for the SafetyBot origin. Add `Content-Security-Policy: frame-ancestors https://tech.company.com` on the SafetyBot host before you expose this (not set today).

Entra login inside a third-party iframe often fails (`SameSite` cookies). Use a popup sign-in, or require sign-in before the iframe opens.

Safari hold-to-talk inside an iframe is the usual failure. Offline IndexedDB belongs to the iframe origin, not the parent app. Prefer strategy 1 or 2 for site phones.

## 4. Keep their screens, call the APIs

Use this when the technician tool already has notes and photos and cannot look like SafetyBot.

Flow:

1. Their app collects text and up to 3 photos (and optional audio).
2. `POST /api/ai/transcribe` if there is audio.
3. `POST /api/ai/extract` with transcript, photos, and the current `GET /api/schema` logic.
4. Show the returned fields in *their* form.
5. `POST /api/reports` with `Authorization: Bearer`.
6. EHS receives the webhook or polls `GET /api/reports?since=…`.

Today the AI routes read `x-ai-provider` / `x-ai-key` from the browser and fall back to server env. On a company host, keep the model key on the server. Do not ship the Foundry key inside the technician binary.

This is not an official SDK. It is HTTP. Schema changes in Admin → Logic still apply if you fetch `/api/schema` instead of hard-coding fields.

## 5. Take the code

MIT. Fork the repo and run your own host, or lift the worker screens into the technician codebase.

### 5a. Fork and host your own SafetyBot

```bash
git clone https://github.com/Julpukka-apps/safetybot.git
cd safetybot
npm install
npm run dev
```

Change admin password, rotate the API key, point Admin → API at the company model, turn on Entra, set the webhook to EHS. The technician tool still uses strategy 1 or 2 against *your* hostname.

This is the clean take-the-code path. You get updates by merging upstream when you want them. You do not copy React files into two apps.

### 5b. Copy worker screens into their React app

The worker UI is:

| File | Role |
| --- | --- |
| `src/Capture.tsx` | Hold to talk, photos, type |
| `src/Draft.tsx` | Check fields, submit |
| `src/Done.tsx` | Confirmation |
| `src/schema.ts` | Case types and fields |
| `src/xai.ts` | `resizeImage`, `transcribeSpeech`, `extractReport` |
| `src/storage.ts` | Local draft and logic |
| `src/outbox.ts` / flush | Offline queue |
| `src/i18n.tsx` + locale packs | Languages |
| `src/app/api/**` | Reports, schema, AI, auth |

Copying only `Capture.tsx` is not enough. You will also pull the API routes or re-point those functions at a hosted SafetyBot. You then own CSS, offline, and schema drift.

Do this only if a single React monorepo is a hard requirement. Prefer 5a.

### 5c. What to change first on a fork

- First-run admin password and demo API key (do not ship the source defaults).
- Company hostname and HTTPS proxy ([self-host.md](self-host.md)).
- Admin → Logic for *their* case types, not the seed construction fields if they differ.
- Admin → API provider (Azure Foundry is the usual Microsoft tenant).
- Webhook URL + secret toward EHS.
- Entra redirect `https://your-host/api/auth/microsoft/callback`.

Keep `/admin` off the technician shell.

## Data out (every strategy)

```bash
export ORIGIN=https://safety.company.com
export SAFETYBOT_API_KEY='rotated key from Admin → API'

curl -sS "$ORIGIN/api/reports?since=2026-09-01T00:00:00.000Z" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

Webhook: Admin → API URL. Each Submit POSTs the flattened row with header `x-safetybot-secret`. Full field list: [api.md](api.md). Microsoft landing: [microsoft.md](microsoft.md).

The technician app does not need to talk to EHS if the webhook or the pull job is on.

## Small SafetyBot changes that help embed

Not built yet. Useful if a company asks:

- `?org_id=` `?lang=` `?return=` on `/`
- `frame-ancestors` allowlist
- `postMessage` on submit: `{ type: "safetybot:submitted", id }` so the parent can close the panel
- Embed chrome: hide the Admin gear on `/` when `?embed=1`

Those are days of work. They are not required to go live with strategy 1.

## Recommendation

1. Company hosts SafetyBot (fork or clone).
2. Technician tool adds **Report safety** → that host.
3. Webhook + `since` pull into EHS.
4. Only then consider iframe, API-only UI, or copying React files.
