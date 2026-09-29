# SafetyBot in a Microsoft company

This is the path for a larger company that already lives in Microsoft 365, Entra ID, Azure, and an existing safety / EHS system.

SafetyBot is the **worker interface**. It is not the system of record. The host keeps at most **200 reports**. At company volume you must pull or push every case into your own safety system and treat SafetyBot as a short buffer.

Do not put tenant secrets, admin passwords, or model keys in git.

## What you are assembling

```
Worker phone (SafetyBot PWA)
  Entra sign-in (optional)
  hold / photo / type
       |
       | Azure Speech + Foundry chat model
       v
  /draft  — worker checks the fields
       |
       | POST /api/reports
       v
  SafetyBot host  (buffer, schema, API key)
       |
       | webhook  or  GET /api/reports
       v
  Your safety / EHS system
  (and optionally Dataverse, Power Automate, Copilot Studio)
```

Office staff can use Teams + Copilot Studio as a **second** channel. Do not replace the field PWA with a chat agent. Hold-to-talk, three photos, and the offline queue live in SafetyBot.

## 1. Roles and environments

| Role | Tool |
| --- | --- |
| Worker | SafetyBot `/` on a phone |
| Site supervisor | SafetyBot `/draft` + your EHS inbox |
| Safety admin | SafetyBot `/admin` (Logic, Access) |
| Integration | `GET /api/reports`, webhook, `GET /api/schema` |
| Identity | Microsoft Entra ID |
| Models | Azure AI Foundry / Azure OpenAI |
| Speech | Azure Speech batch or Azure Whisper |
| Host | Azure App Service, Container Apps, or a VM behind Front Door |
| Optional office UI | Power Apps, Copilot Studio, Dataverse |

Use three hosts if you can: **dev**, **test**, **prod**. Each has its own admin password, API key, model deployment, and webhook URL. Do not reuse the public demo.

## 2. Host SafetyBot on Azure

1. Clone the repo on a build agent. Node.js 20+.
2. `npm ci && npm run build && npm start` listens on `0.0.0.0:8082`.
3. Put HTTPS in front (Azure Front Door, Application Gateway, or Container Apps ingress). The microphone and camera need a secure context.
4. Persist `data/` on a disk or Azure Files share:
   - `data/safetybot-store.json` — schema, API key, org tree, SSO
   - `data/safetybot-reports.jsonl` — last 200 submitted reports
5. Restrict inbound traffic: company VPN, Private Link, or Front Door + Entra. Do not leave `/admin` on the open internet with a first-run password.

First boot on that host:

- Change the admin password.
- Rotate the SafetyBot API key on Admin → API.
- Store the model key in App Settings / Key Vault, not in the browser of a shared phone.

Checklist: [self-host.md](self-host.md).

## 3. Company models (Foundry)

“Copilot models the company already paid for” means a **chat-completions deployment** in Azure AI Foundry, not the Microsoft 365 Copilot chat box.

1. In Foundry, deploy the approved vision-capable chat model (often GPT-4o-mini or GPT-4.1-mini).
2. Copy the **deployment name** and the chat completions URL:

   `https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=2024-10-21`

3. In SafetyBot Admin → API:
   - Service: Azure
   - Address: that URL
   - Model: the deployment name
   - Key: from Key Vault / App Settings on the host

4. Speech: Azure Speech **batch** (~$0.18/h) or Azure Whisper (~$0.36/h). Avoid Azure Speech real-time ($1/h) at high volume.

SafetyBot extract still uses Admin → Logic (fields, `extract_from`, case types). The Foundry model only fills that schema. Do not duplicate the field list inside Copilot Studio topics.

Cost order of magnitude: [README What it costs](../README.md#what-it-costs).

## 4. Entra sign-in

Admin → Access → Sign-in.

1. Register an app in the company tenant.
2. Redirect URI: `https://{safetybot-host}/api/auth/microsoft/callback`
3. Paste **tenant id** and **application (client) id** into SafetyBot.
4. Turn on “Require sign-in before a report” when the company wants named reporters.
5. Each submitted row then carries `reporter_email` and `reporter_name`.

Workers need the phone to reach that callback once. Offline capture can continue after a cached session; a worker who never signed in cannot file if the gate is on.

Optional: Intune managed home-screen shortcut to the HTTPS origin. The app is a PWA, not a store binary.

## 5. Organization tree

Admin → Access accepts a list of places (`id,name,parent_id,type`). Each report can be tagged with `org_id`, `org_name`, `org_path`.

You can also replace the tree from an integration:

```bash
curl -sS -X PUT "$ORIGIN/api/organization" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY" \
  -H "Content-Type: text/plain" \
  --data-binary @sites.csv
```

Keep site master data in the company system. Push a copy into SafetyBot so the worker picker stays small.

## 6. Get data into the company safety system

Two patterns. Use **both** if you can: webhook for “just submitted”, poll for “we missed one”.

### A. Webhook (push)

Admin → API → “Also send each report to”.

- URL: your HTTPS listener (Azure Function, Logic App, Power Automate HTTP trigger, or the EHS inbound API).
- Shared secret: sent as header `x-safetybot-secret`.
- Method: `POST`
- Body: one report **row** (flat JSON: meta columns + one key per Logic field).
- Timeout: **8 seconds**. If your EHS call is slower, accept on the Function and enqueue.

`POST /api/reports` response includes `webhook`: `sent`, `skipped`, or `failed`. A failed webhook still stored the report on the SafetyBot host.

### B. Pull API

```bash
export ORIGIN=https://safetybot.example.com
export SAFETYBOT_API_KEY='rotated key from Admin → API'

# health, no auth
curl -sS "$ORIGIN/api/health"

# new rows since last cursor
curl -sS "$ORIGIN/api/reports?since=2026-09-29T00:00:00.000Z" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"

# one case type
curl -sS "$ORIGIN/api/reports?case_type=injury" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"

# one site
curl -sS "$ORIGIN/api/reports?org_id=SITE42" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"

# current field schema (map columns)
curl -sS "$ORIGIN/api/schema" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

Wrong key → `401`. Store the last successful `created_at` as `since` for the next job.

Because the host only keeps 200 rows, the poller must run often enough that nothing ages out before you copy it. For 200,000 cases a year that is many per hour — **prefer the webhook**, use poll as a safety net.

### C. Power Automate / Logic Apps

Typical company flow:

1. HTTP trigger receives the webhook body.
2. Check `x-safetybot-secret`.
3. Map `case_type`, `description`, `org_path`, `reporter_email`, photos.
4. Create a row in Dataverse **or** call the EHS REST API.
5. If photos are data URLs, write them to SharePoint / Blob and store the URL in EHS. Do not keep base64 in Dataverse long term.

Custom connector against `$ORIGIN/api/reports` also works for a scheduled pull.

### D. Copilot Studio (office only)

A Teams agent can ask “file an observation” or “list yesterday’s near misses”.

- Prompts → connect the **same** Foundry chat-completions deployment.
- Action: HTTP POST to your EHS, or to SafetyBot `POST /api/reports` with the bearer key.
- File upload works on Teams and the Studio test pane. Do not rely on Microsoft 365 Copilot chat to pass site photos.
- Do not auto-send Injury from the agent. Keep a human check.

## 7. Report row you will receive

Every integration should treat these meta columns as stable:

| Field | Meaning |
| --- | --- |
| `id` | Stable report id |
| `created_at` | ISO time |
| `case_type` | `injury`, `near_miss`, `good_practice`, `improvement_idea`, `safety_observation` |
| `case_label` | Display label |
| `language` | UI / speech language id |
| `source` | `grok` or `demo` |
| `transcript` | Worker words |
| `first_line` | Short preview |
| `photo_count` | Number of photos |
| `org_id` / `org_name` / `org_path` | Place |
| `reporter_email` / `reporter_name` | Entra profile when sign-in is on |

All other keys come from Admin → Logic (`description`, `hazard`, …). Read `GET /api/schema` when Logic changes so your mapper does not go stale.

Photos may appear as data URLs on the worker device. The JSONL on the host may store a count only. Design the EHS mapping to accept either a URL or “photo held on the phone / not in the API”.

## 8. Security baseline for a company tenant

- HTTPS only. HSTS at the front door.
- Admin password unique to that host. Not the value that shipped in source.
- SafetyBot API key rotated and stored in Key Vault. Used only by the integration identity.
- Model key on the server, not on every worker phone.
- Entra sign-in for named reporting.
- Webhook URL allow-listed; verify `x-safetybot-secret`.
- Do not log transcripts, photos, or `x-ai-*` headers.
- Retention lives in the EHS system. Wipe SafetyBot `data/safetybot-reports.jsonl` on a schedule after a successful copy.
- Public demo hosts must never receive real injuries.

More on the product bar: the README disclaimer and [self-host.md](self-host.md).

## 9. Rollout sequence

1. Stand up a **test** host on Azure. Change admin password and API key.
2. Point Admin → API at the company Foundry deployment. Confirm one typed dummy case.
3. Confirm hold-to-talk + one photo. Check the draft fields against Logic.
4. Turn on Entra in test. File as a test user. Confirm `reporter_email`.
5. Build the webhook Function / Logic App. Map one Observation and one Near miss into the EHS sandbox.
6. Add a poller on `since=` as backup. Prove a missed webhook is recovered.
7. Pilot one site (tens of workers), dummy data only, then live hazards with the safety team’s rule for Injury.
8. Only then open prod, new keys, new webhook, Intune shortcut.

## 10. What the company still owns

- Who may open `/admin`
- How long injury records are kept
- Whether photos are allowed
- Data processing terms with the model vendor
- Backup and restore of `data/`
- Duty to report to regulators — SafetyBot does not do that

SafetyBot classifies and drafts. Your safety reporting system stores, investigates, and closes the case.
