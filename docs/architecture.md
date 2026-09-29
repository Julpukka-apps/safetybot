# Architecture

SafetyBot is a Next.js app. Worker pages and admin pages talk to route handlers under `src/app/api`. The host store is `data/safetybot-store.json` and `data/safetybot-reports.jsonl`.

## Worker

1. `/` — hold to talk, add up to three photos, or type a note.
2. Optional `POST /api/ai/transcribe` when the worker spoke.
3. `POST /api/ai/extract` — classifies the case and fills the current fields.
4. `/draft` — the worker checks the draft.
5. `POST /api/reports` — stores the report. An optional webhook fires here.
6. `/done` — confirmation.

With no model key, typed text still produces a demo draft. Live speech and photo reading need a model key.

## Admin

`/admin` has four tabs: Logic, API, Reports, Access.

Save on Logic calls `POST /api/sync` with `replaceLogic: true`. A normal page open does not replace the saved fields.

## Model calls

Extract and transcribe do not use the SafetyBot bearer key. The browser sends:

- `x-ai-provider` — `xai`, `openai`, `azure`, or `compatible`
- `x-ai-key`
- `x-ai-model`
- `x-ai-base`

An empty key falls back to the server env for `xai` (`XAI_API_KEY`) and `openai` (`OPENAI_API_KEY`). Azure and compatible endpoints need the key and base URL from the browser.

Default models: Grok Voice `grok-voice-transcribe-2.0` for speech, Grok `grok-4.6` for extract.

## Bearer key

`Authorization: Bearer` is required on reports, schema, organization, sync, and `PUT /api/auth/sso`. The key is the SafetyBot API key from Admin → API. A mismatch returns `401`.

## Optional extras

- Webhook: each successful submit POSTs the report row to the URL saved on Admin → API. The shared secret goes out as `x-safetybot-secret`.
- Sign-in: Admin → Access can require Microsoft Entra or Google before a worker submits. Callbacks are `/api/auth/microsoft/callback` and `/api/auth/google/callback`.
