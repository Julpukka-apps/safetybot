# SafetyBot

**Status:** early preview (v0.1.4). The product is still moving. This repository is private until the owner publishes it.

Live preview: [safetybot.julpukka.com](https://safetybot.julpukka.com)

SafetyBot is a small web app for field safety reports. A worker holds one button and speaks, takes up to three photos, or types a note. The app classifies the case, writes a short description, and fills only the fields the current schema asks for. An administrator can change those fields — and what the model should take from speech versus a photo — without shipping a new build.

It is a reporting interface. It is not a medical, legal, or official incident system.

## Screenshots

Dummy copy only. Not live injury reports.

Worker capture — hold to talk, add a photo, or type:

![Capture](docs/screenshots/capture.jpg)

Draft after a photo — case type chips and generated description:

![Draft](docs/screenshots/draft.jpg)

Admin sign-in:

![Admin login](docs/screenshots/admin-login.jpg)

Admin → Logic — classification rules, extract prompt, photo reading prompt:

![Admin logic](docs/screenshots/admin-logic.jpg)

Admin → API — Grok / OpenAI / Azure model key (not the SafetyBot API key):

![Admin API](docs/screenshots/admin-api.jpg)

Admin → Reports:

![Admin reports](docs/screenshots/admin-reports.jpg)

Admin → Access — organization list:

![Admin access](docs/screenshots/admin-access.jpg)

Admin → Access — optional Microsoft / Google sign-in:

![Admin sign-in settings](docs/screenshots/admin-sso.jpg)

Language list (English, Finnish, and the other UI languages):

![Languages](docs/screenshots/languages.jpg)

## What you get

| Path | Who | What |
| --- | --- | --- |
| `/` | worker | Hold to talk, add photos, or type |
| `/draft` | worker | Check the generated report, then submit |
| `/done` | worker | Confirmation |
| `/admin` | owner | Logic, API keys, reports, access |

Default case types: Injury, Near miss, Good practice, Idea, Observation.

AI (optional): Grok Voice speech-to-text (`grok-voice-transcribe-2.0`) and Grok extract (`grok-4.6`). OpenAI-compatible and Azure chat endpoints also work from Admin → API. With no model key the UI still runs and can build a draft from typed text (demo extract).

## Requirements

- Node.js 20 or newer
- npm (comes with Node)
- A modern Chromium or Safari browser
- HTTPS in production (the microphone and camera APIs require a secure context; `localhost` is allowed)
- Optional: an [xAI](https://console.x.ai/) or OpenAI key for live speech and photo extract

## Quick start

```bash
git clone https://github.com/Julpukka-apps/safetybot.git
cd safetybot
npm install
npm run dev
```

Open [http://127.0.0.1:8082](http://127.0.0.1:8082).

1. On `/`, type a dummy note such as `Oil on the scaffold. I wiped it.` and send it. You should land on a draft with no model key.
2. Open `/admin`. First-run sign-in is printed on that page. Change the password immediately (8+ characters). The first-run password then stops working in that browser.
3. Admin → API: paste an xAI or OpenAI key if you want live speech and photo reading. The key stays in this browser session unless you also put it in `.env.local`.
4. Admin → Logic: Save at least once so the host has a schema. Then try hold-to-talk or a photo.

Production on the same machine:

```bash
npm run build
npm start
```

`npm start` listens on `0.0.0.0:8082`.

## Environment

Copy `.env.example` to `.env.local` only if you want a **server-side** fallback key. Most people paste the model key in Admin → API instead.

| Name | Required | Used for |
| --- | --- | --- |
| `XAI_API_KEY` | no | Server fallback for Grok Voice + Grok extract |
| `OPENAI_API_KEY` | no | Server fallback when the provider is OpenAI |

Do not commit `.env`, `.env.local`, or `data/`.

There are two different keys:

| Key | Where | Used for |
| --- | --- | --- |
| Model key (xAI / OpenAI / Azure) | Admin → API, or the env vars above | Speech-to-text and extract |
| SafetyBot API key | Admin → API | Other systems calling `GET /api/reports` |

A fresh install uses a demo SafetyBot API key shipped in `src/schema.ts`. Rotate it on Admin → API before you expose the host.

## Where data lives

| Store | Path | Notes |
| --- | --- | --- |
| Browser | `localStorage` | Draft UI, logic cache, model key in this browser |
| Host | `data/safetybot-store.json` | Schema, API key, organization, SSO settings |
| Host | `data/safetybot-reports.jsonl` | Submitted reports |

`data/` is gitignored. In production, keep that directory on a persistent disk.

## Customize the form

Admin → Logic is the product configuration.

- Case types, fields, required flags
- `extract_from`: `speech` / `photo` / `both` / `none`
- Classification rules, description template, extract prompt, photo reading prompt
- Speech keyterms sent to Grok Voice

Save writes the browser store and `POST /api/sync`. The next worker draft and the next extract call both use that schema. Prefer adding a field here instead of editing React.

Details: [docs/admin.md](docs/admin.md), [docs/schema.md](docs/schema.md).

## API

Health check (no auth):

```bash
curl -sS http://127.0.0.1:8082/api/health
```

List reports (bearer key from Admin → API):

```bash
curl -sS http://127.0.0.1:8082/api/reports?limit=20 \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

Full route list: [docs/api.md](docs/api.md).

## Self-host

Step-by-step for a VPS, HTTPS, and persistent `data/`: [docs/self-host.md](docs/self-host.md).

## Languages

UI chrome starts in English. The language control follows Grok Voice STT languages plus Finnish. Speech and the generated description follow the selected language.

## License

[MIT](LICENSE). Copyright 2026 julpukka / Julpukka-apps.

## Disclaimer

SafetyBot does not store a certified audit trail. Self-hosters own retention, access control, backups of `data/`, and any duty to report injuries. Do not put real names, injuries, or API keys in issues or screenshots.
