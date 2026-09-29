# Security

SafetyBot is an early preview (v0.1.7).

## Reporting

Open a GitHub issue for a bug that does not involve a secret. Email secrets and passwords to the Julpukka-apps owner. Do not paste API keys, passwords, report text, or photos in an issue, a pull request, a commit, or a chat log.

## Secrets

- Model keys belong in the browser (Admin → API) or in an uncommitted `.env.local`. The server env names the code reads are `XAI_API_KEY` and `OPENAI_API_KEY`.
- Rotate the admin password and the SafetyBot API key before you expose a host. Change both on first boot. The first-run values stay in `src/schema.ts` so a clone can sign in. Do not print them in docs, issues, or screenshots.
- `data/safetybot-store.json` and `data/safetybot-reports.jsonl` are local. They are gitignored. Do not add them.

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
