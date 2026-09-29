# API

Routes live under `src/app/api`. The health check is public. Report, schema, organization, and sync routes use `authorize()` in `src/server/http.server.ts`: `Authorization: Bearer <key>`. A mismatch returns `401` and `{ "error": "Unauthorized" }`.

The bearer key is the `apiKey` in `data/safetybot-store.json`, shown on Admin → API. A fresh store starts from `DEFAULT_API_KEY` in `src/schema.ts`. Rotate it in the app.

## Public

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/health` | `{ ok, version, name }` from `src/app/api/health/route.ts` |
| GET | `/api/auth/session` | Current SSO user, or `user: null` |
| POST | `/api/auth/signout` | Ends the SSO session |
| GET | `/api/auth/google` | Starts Google sign-in |
| GET | `/api/auth/google/callback` | Finishes Google sign-in |
| GET | `/api/auth/microsoft` | Starts Microsoft sign-in |
| GET | `/api/auth/microsoft/callback` | Finishes Microsoft sign-in |
| GET | `/api/auth/sso` | Enabled flags. Full client settings only if the bearer key matches |
| GET | `/api/ai/status` | `{ available }` if `XAI_API_KEY` or `OPENAI_API_KEY` is set on the server |

## Bearer required

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/reports` | Query `since`, `case_type`, `org_id`. Returns report rows |
| POST | `/api/reports` | Stores one report. Returns `{ ok, id, webhook }` with status 201, or 400 |
| GET | `/api/reports/[id]` | One row, or 404 |
| DELETE | `/api/reports/[id]` | Removes one row, or 404 |
| GET | `/api/schema` | Current logic object |
| GET | `/api/organization` | Organization tree |
| PUT | `/api/organization` | Replaces the tree from JSON or plain text |
| DELETE | `/api/organization` | Clears the tree |
| POST | `/api/sync` | Writes logic, reports, webhook, organization, and SSO sent by Admin |
| PUT | `/api/auth/sso` | Saves SSO settings |

`POST /api/reports` also calls `postWebhook`. The result is `sent`, `skipped`, or `failed`.

## Model routes

These do not use the bearer key. The browser sends `x-ai-provider`, `x-ai-key`, `x-ai-model`, and `x-ai-base` from the Admin API settings in that browser. If the header key is empty, the server falls back to `XAI_API_KEY` or `OPENAI_API_KEY`.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/ai/extract` | Body `transcript`, `photos` (max 3), `logic`, `language`. Status 503 when no key, 502 on model failure |
| POST | `/api/ai/transcribe` | Body `audioBase64`, `mime`, `language`, `keyterms` |

Do not log those headers. They carry the model key.
