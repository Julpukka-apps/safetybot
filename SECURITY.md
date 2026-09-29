# Security

This repository is private and the app is under development.

## Reporting

Tell the owner directly. Do not put API keys, report text, or photos in a commit, issue, or chat log.

## Secrets

- Model keys belong in the browser session (Admin → API) or in an uncommitted `.env.local`. The only server env names the code reads are `XAI_API_KEY` and `OPENAI_API_KEY`.
- `data/safetybot-store.json` and `data/safetybot-reports.jsonl` are local. They are gitignored. Do not add them.
- The first-run admin password and the demo API key are still in `src/schema.ts` and in git history, because the app checks them on first run. Change both in the running app. History was not rewritten.

## Auth

`/api/reports`, `/api/schema`, `/api/organization`, `/api/sync`, and `PUT /api/auth/sso` require `Authorization: Bearer` with the key from Admin → API. A wrong key gets `401`.
