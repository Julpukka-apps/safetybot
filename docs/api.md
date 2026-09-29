# API

Routes live under `src/app/api`. A wrong bearer key returns `401` and `{ "error": "Unauthorized" }`.

The bearer key is the SafetyBot API key on Admin → API, stored as `apiKey` in `data/safetybot-store.json`. Rotate it in the app before you expose the host. Do not paste the first-run value into docs.

The host keeps at most 200 reports.

## Public

No bearer key.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/health` | `{ ok, version, name }` |
| GET | `/api/auth/session` | `{ user }` or `{ user: null }`. User fields: `name`, `email`, `provider`, `org_id`, `org_path` |
| POST | `/api/auth/signout` | Ends the sign-in session |
| GET | `/api/auth/google` | Starts Google sign-in |
| GET | `/api/auth/google/callback` | Finishes Google sign-in |
| GET | `/api/auth/microsoft` | Starts Microsoft sign-in |
| GET | `/api/auth/microsoft/callback` | Finishes Microsoft sign-in |
| GET | `/api/auth/sso` | Enabled flags and redirect URLs. Full client settings only when the bearer key matches |
| GET | `/api/ai/status` | `{ available }` when `XAI_API_KEY` or `OPENAI_API_KEY` is set on the server |

## Bearer required

Send `Authorization: Bearer <SafetyBot API key>`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/reports` | Report rows. Query: `since` (ISO time, keep rows at or after it), `case_type` (exact id), `org_id` (exact id) |
| POST | `/api/reports` | Stores one report. `201` `{ ok, id, webhook }` or `400`. `webhook` is `sent`, `skipped`, or `failed` |
| GET | `/api/reports/[id]` | One row, or `404` |
| DELETE | `/api/reports/[id]` | Removes one row, or `404` |
| GET | `/api/schema` | Current logic object |
| GET | `/api/organization` | Organization tree |
| PUT | `/api/organization` | Replaces the tree. JSON body, or plain text with header `id,name,parent_id,type` |
| DELETE | `/api/organization` | Clears the tree |
| POST | `/api/sync` | Writes webhook, organization, SSO, and reports. Writes logic only when `replaceLogic` is true and `logic` is present. `rotateTo` must match the app's `sb_live_` key shape |
| PUT | `/api/auth/sso` | Saves sign-in settings |

`POST /api/reports` calls the webhook when a URL is saved. The POST body is the report row. Header `x-safetybot-secret` carries the shared secret. Timeout is 8 seconds. No URL means `skipped`.

## Model routes

These do not use the bearer key. The browser sends `x-ai-provider`, `x-ai-key`, `x-ai-model`, and `x-ai-base`. An empty key falls back to `XAI_API_KEY` for provider `xai` and `OPENAI_API_KEY` for provider `openai`. Azure and compatible calls need the browser key and base URL.

Do not log those headers. They carry the model key.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/ai/extract` | Body: `transcript`, `photos` (max 3), `logic`, `language`. `503` when no key, `502` on model failure. Success: `{ extraction }` |
| POST | `/api/ai/transcribe` | Body: `audioBase64`, `mime`, `language`, `keyterms`. `503` when no key, `502` on failure. Azure has no speech route here. Success: `{ text }` |

## Examples

Health:

```bash
curl -sS http://127.0.0.1:8082/api/health
```

List reports:

```bash
curl -sS "http://127.0.0.1:8082/api/reports?case_type=safety_observation" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

Schema:

```bash
curl -sS http://127.0.0.1:8082/api/schema \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

`$SAFETYBOT_API_KEY` is the key shown on Admin → API after you rotate it.
