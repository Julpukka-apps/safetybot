# SafetyBot

**Status:** early preview (v0.1.6). The product is still moving. This repository is private until the owner publishes it.

Live preview: [safetybot.julpukka.com](https://safetybot.julpukka.com)

SafetyBot is a small web app for field safety reports. A worker holds one button and speaks, adds up to three photos, or types a note. The app classifies the case, writes a short description, and fills only the fields the current schema asks for. An administrator can change those fields — and what the model should take from speech versus a photo — without shipping a new build.

It is a reporting interface. It is not a medical, legal, or certified incident system.

## Screenshots

Live UI. Dummy hazard copy only.

**Worker**

![Capture](docs/screenshots/capture.jpg)

![Draft](docs/screenshots/draft.jpg)

![Languages](docs/screenshots/languages.jpg)

**Admin**

![Admin login](docs/screenshots/admin-login.jpg)

![Admin logic](docs/screenshots/admin-logic.jpg)

![Admin API](docs/screenshots/admin-api.jpg)

![Admin reports](docs/screenshots/admin-reports.jpg)

![Admin access](docs/screenshots/admin-access.jpg)

![Admin sign-in](docs/screenshots/admin-sso.jpg)

## What you get

| Path | Who | What |
| --- | --- | --- |
| `/` | worker | Hold to talk, add up to 3 photos, or type |
| `/draft` | worker | Check the generated report, then submit |
| `/done` | worker | Confirmation |
| `/admin` | owner | Logic, API, Reports, Access |

Default case types: Injury, Near miss, Good practice, Idea, Observation.

AI is optional. The default speech model is Grok Voice (`grok-voice-transcribe-2.0`). The default extract model is Grok (`grok-4.6`). Admin → API can also use OpenAI, Azure, or another OpenAI-compatible chat endpoint. With no model key the UI still runs. Type a note and the app builds a demo draft.

## Requirements

- Node.js 20 or newer
- npm (comes with Node)
- A modern Chromium or Safari browser
- HTTPS in production (the microphone and camera need a secure context; `localhost` and `127.0.0.1` are allowed)
- Optional: a model key for live speech and photo extract

## Quick start

```bash
git clone https://github.com/Julpukka-apps/safetybot.git
cd safetybot
npm install
npm run dev
```

Open [http://127.0.0.1:8082](http://127.0.0.1:8082).

1. On `/`, type a dummy note such as `Oil on the scaffold. I wiped it.` and send it. You should land on a draft with no model key.
2. Open `/admin`. The page shows the first-run username and password until you replace them. Sign in, then set a new password of at least 8 characters. The first-run password then stops working in that browser. Change it before anyone else can open `/admin`.
3. Admin → API: paste a model key if you want live speech and photo reading. The key stays in this browser unless you also set a server fallback in `.env.local`.
4. Admin → Logic: press Save. The next worker draft uses that form. Opening the worker page does not put the old fields back.

Production on the same machine:

```bash
npm run build
npm start
```

`npm start` listens on `0.0.0.0:8082`.

## Two keys

| Key | Where | Used for |
| --- | --- | --- |
| Model key | Admin → API, or `XAI_API_KEY` / `OPENAI_API_KEY` | Speech-to-text and extract |
| SafetyBot API key | Admin → API | Other systems calling `GET /api/reports` with `Authorization: Bearer` |

A fresh install starts with a demo SafetyBot API key. Rotate it on Admin → API before you expose the host. Do not copy that demo value into docs or issues.

Copy `.env.example` to `.env.local` only if you want a server-side model key. Most people paste the model key in Admin → API instead. Do not commit `.env`, `.env.local`, or `data/`.

## Where data lives

| Store | Path | Notes |
| --- | --- | --- |
| Browser | `localStorage` | Draft, logic cache, language, model key in this browser |
| Host | `data/safetybot-store.json` | Schema, API key, organization, sign-in settings |
| Host | `data/safetybot-reports.jsonl` | Submitted reports |

`data/` is gitignored. In production, keep that directory on a persistent disk.

## Offline

A worker with no signal can still hold to talk, add up to 3 photos, or type. The phone saves that capture. It does not write the draft until the app is open and online.

The first visit must be online so the app shell is cached. After that, `/` can open with no network.

When you have signal, open SafetyBot and leave it in front. The phone writes the draft and opens it. You still check it and tap Submit. An injury still asks you to confirm.

The queue lives on the phone, not on the server. Nothing is sent until you submit. A hidden phone does not write the draft. Reopen the app once you have signal.

## Change the form

Admin → Logic is the product configuration. Save writes the browser store and `POST /api/sync`. The next extract call uses that schema. Prefer adding a field here instead of editing React.

Details: [docs/admin.md](docs/admin.md), [docs/schema.md](docs/schema.md).

## Languages

The default UI language is English. The picker includes Auto-detect plus every row below. UI chrome is translated. Speech-to-text and the generated description follow the selected language. Arabic and Persian (`ar`, `fa`) use right-to-left layout.

| id | label | speech |
| --- | --- | --- |
| auto | Auto-detect | (empty) |
| en | English | en-US |
| fi | Suomi | fi-FI |
| ar | العربية | ar |
| cs | Čeština | cs-CZ |
| da | Dansk | da-DK |
| nl | Nederlands | nl-NL |
| fil | Filipino | fil-PH |
| fr | Français | fr-FR |
| de | Deutsch | de-DE |
| hi | हिन्दी | hi-IN |
| id | Bahasa Indonesia | id-ID |
| it | Italiano | it-IT |
| ja | 日本語 | ja-JP |
| ko | 한국어 | ko-KR |
| mk | Македонски | mk-MK |
| ms | Bahasa Melayu | ms-MY |
| fa | فارسی | fa-IR |
| pl | Polski | pl-PL |
| pt | Português | pt-PT |
| ro | Română | ro-RO |
| ru | Русский | ru-RU |
| es | Español | es-ES |
| sv | Svenska | sv-SE |
| th | ไทย | th-TH |
| tr | Türkçe | tr-TR |
| vi | Tiếng Việt | vi-VN |

UI packs live in `src/i18n.tsx`, `src/locale-rest.ts`, and `src/locale-more.ts`. The choice is stored in the browser. Full notes: [docs/languages.md](docs/languages.md).

## API

Health check (no auth):

```bash
curl -sS http://127.0.0.1:8082/api/health
```

List reports (bearer key from Admin → API):

```bash
curl -sS http://127.0.0.1:8082/api/reports \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

Full route list: [docs/api.md](docs/api.md). How the pages call those routes: [docs/architecture.md](docs/architecture.md).

## Self-host

Step-by-step for a VPS, HTTPS, and persistent `data/`: [docs/self-host.md](docs/self-host.md).

## License

[MIT](LICENSE). Copyright 2026 Julpukka-apps.

## Disclaimer

SafetyBot does not store a certified audit trail. Self-hosters own retention, access control, backups of `data/`, and any duty to report injuries. Do not put real names, injuries, or API keys in issues or screenshots.
