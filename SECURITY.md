# Security

This repository is private. The app is an early preview (v0.1.5).

## Reporting

Tell the owner directly. Do not open a public issue. Do not put API keys, passwords, report text, or photos in a commit, issue, or chat log.

## Secrets

- Model keys belong in the browser (Admin → API) or in an uncommitted `.env.local`. The server env names the code reads are `XAI_API_KEY` and `OPENAI_API_KEY`.
- The SafetyBot API key is the bearer token for reports, schema, organization, and sync. Rotate it on Admin → API before you expose a host.
- `data/safetybot-store.json` and `data/safetybot-reports.jsonl` are local. They are gitignored. Do not add them.
- The first-run admin password and the demo API key are in `src/schema.ts` so a first run can sign in. Change both in the running app. Do not print them in docs. History was not rewritten.

## Auth

These routes require `Authorization: Bearer` with the SafetyBot API key:

- `/api/reports` and `/api/reports/[id]`
- `/api/schema`
- `/api/organization`
- `/api/sync`
- `PUT /api/auth/sso`

A wrong key gets `401`.

`GET /api/health`, the sign-in start and callback routes, and the model routes do not use that bearer key. The model routes accept the model key in headers. Do not log those headers.

Microsoft and Google sign-in are off until an admin saves a tenant id and client id, or a Google client id, on Admin → Access.
