# SafetyBot in a Microsoft company

This is the path for a large company that already runs Microsoft Entra, Azure, Teams, and Power Platform, and already has its own safety / EHS system of record.

SafetyBot is the worker interface: hold to talk, photos, typed notes, an admin-editable form. It is not the system of record. The company system keeps the official case.

Do not put real injuries on a public demo host. Run your own instance.

## What stays in SafetyBot vs Microsoft

| Job | Where |
| --- | --- |
| Worker capture (mic, camera, offline queue) | SafetyBot PWA |
| Form fields, case types, extract rules | SafetyBot Admin → Logic |
| Identity | Microsoft Entra |
| Speech + extract models | Azure AI Foundry / Azure OpenAI + Azure Speech |
| Hosting | Azure App Service, Container Apps, or a VM behind Application Gateway |
| Official case file | The company's EHS / Synergi / Intelex / SAP / custom system |
| Office chat in Teams | Optional Copilot Studio agent that calls the SafetyBot API |

Do not rebuild the field screen inside Copilot Studio. Studio is a Teams channel, not a glove-friendly capture app.

```
Phone (SafetyBot)
  → Entra sign-in (optional but recommended)
  → Azure Speech + Foundry chat model
  → Worker checks /draft → Submit
  → POST /api/reports
       ├─ webhook → Power Automate / Logic Apps → EHS API
       └─ EHS job pulls GET /api/reports?since=...
```

## 1. Land the host in Azure

Typical company pattern:

1. App Registration in Entra for the website (single-tenant).
2. App Service or Container Apps in the company subscription, private network if required.
3. HTTPS certificate on the company domain (`safety.contoso.com`). Mic and camera need HTTPS.
4. Persistent disk or Azure Files for `data/safetybot-store.json` and `data/safetybot-reports.jsonl`.
5. Key Vault for the SafetyBot API key rotation is optional; at minimum the keys live in App Settings, not in git.

```bash
npm run build
npm start   # 0.0.0.0:8082 behind the reverse proxy
```

First-run on that host:

- Change the admin password immediately.
- Rotate the SafetyBot API key on Admin → API.
- Do not leave the values that shipped in source.

The host keeps **at most 200 reports**. The EHS connector must copy each case out. SafetyBot is a short buffer, not the archive.

Checklist: [self-host.md](self-host.md).

## 2. Sign-in with Microsoft Entra

Admin → Access → Microsoft Entra / Microsoft 365.

1. In Entra, register a single-tenant web app.
2. Redirect URI: `https://safety.contoso.com/api/auth/microsoft/callback`
3. Paste **Tenant id** and **Application (client) id** into SafetyBot.
4. Turn on **Require sign-in before a report** if only company accounts may file.
5. Save.

Workers then open `/`, sign in, and the report stores `reporter_email`, `reporter_name`, and the organization path when you have uploaded the org list.

App roles: keep `/admin` for the safety team only. Workers never need Admin → Reports on a shared phone.

## 3. Company models (Foundry / Azure OpenAI)

“Copilot models the company already paid for” means a **deployment in Azure AI Foundry**, not the Microsoft 365 Copilot chat box. M365 Copilot cannot be SafetyBot's extract API.

1. In Foundry, deploy the approved chat model (often GPT-4o-mini or GPT-4.1-mini).
2. Copy the **deployment name** and a chat-completions URL:
   `https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=2024-10-21`
3. On the SafetyBot host, Admin → API:
   - Service: Azure
   - Address: that URL
   - Model: the deployment name
   - Key: the tenant key, stored as a server setting when you can. Do not paste it onto every worker phone.

Speech: Azure Speech **batch** (~$0.18/h) or Azure Whisper (~$0.36/h). Avoid Azure Speech real-time ($1/h) at high volume.

Today `/api/ai/transcribe` talks to Grok Voice or OpenAI-style STT. It does **not** call Azure Speech by itself. For a Microsoft-only tenant either:

- keep Grok Voice for STT and Azure for extract, or
- add a small adapter that sends the audio blob to Azure Speech and returns `{ text }`, or
- start with photo + type only until that adapter exists.

Cost order of magnitude at 200,000 cases: see the table in the README.

## 4. Organization list

Admin → Access accepts a tree: `id,name,parent_id,type`. Each new report can be filed against one place. The same list is readable at `GET /api/organization` with the bearer key so the EHS system can map site codes.

## 5. Get the data into the company safety system

Two supported patterns. Use **both** if the webhook can miss a packet: push on submit, pull on a timer to catch up.

### A. Webhook (push)

Admin → API → “Also send each report to”.

- URL: your Power Automate / Logic Apps HTTPS endpoint, or the EHS inbound API.
- Shared secret: a long random string. SafetyBot sends it as `x-safetybot-secret`.
- Timeout: 8 seconds. If the EHS API is slow, land on Logic Apps first, then call EHS.

On each Submit, SafetyBot POSTs the **flattened report row** (JSON). `POST /api/reports` returns `{ webhook: "sent" | "skipped" | "failed" }`.

Power Automate shape:

1. Trigger: When an HTTP request is received (schema = report row).
2. Condition: header `x-safetybot-secret` matches a secret in Key Vault.
3. Parse JSON.
4. HTTP action to the EHS API, or Create a row in Dataverse, then a second flow to EHS.
5. Return 200 quickly.

### B. Pull API (poll)

Store the SafetyBot API key in Key Vault. The integration account calls:

```bash
export ORIGIN=https://safety.contoso.com
export SAFETYBOT_API_KEY='rotated key from Admin → API'

curl -sS "$ORIGIN/api/health"

curl -sS "$ORIGIN/api/schema" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"

curl -sS "$ORIGIN/api/reports?since=2026-09-01T00:00:00.000Z" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

Useful query flags:

| Query | Effect |
| --- | --- |
| `since` | ISO time; rows at or after that stamp |
| `case_type` | Exact id: `injury`, `near_miss`, `good_practice`, `improvement_idea`, `safety_observation` |
| `org_id` | One site from the organization tree |

Wrong key → `401` `{ "error": "Unauthorized" }`.

A typical Logic App recurrence: every 5 minutes, `since` = last successful watermark stored in Dataverse or Blob.

`GET /api/schema` lets the EHS mapper notice new fields after Admin → Logic is saved. Do not hard-code field keys in the flow if the safety team will add columns.

## 6. What a report row looks like

The list endpoint returns flattened rows, not nested `values`. Stable columns plus one column per Logic field:

```json
{
  "id": "r_01J…",
  "created_at": "2026-09-29T12:04:11.000Z",
  "case_type": "safety_observation",
  "case_label": "Observation",
  "confidence": 0.82,
  "language": "en",
  "source": "grok",
  "transcript": "Oil on the scaffold. I wiped it.",
  "first_line": "Oil on the scaffold at level 3.",
  "photo_count": 1,
  "org_id": "site-14",
  "org_name": "North yard",
  "org_path": "Region / North yard",
  "reporter_email": "ada@contoso.com",
  "reporter_name": "Ada Example",
  "description": "Oil on the scaffold at level 3. Wiped immediately.",
  "immediate_action": "Wiped the oil",
  "site": "North yard",
  "area": "Level 3 scaffold",
  "activity": "Housekeeping",
  "hazard": "Slip or trip",
  "who": "Worker"
}
```

Photos are not on the list row (`photo_count` only). Treat SafetyBot as the structured case. If the EHS system needs the JPEG, add that as a later upload path; do not expect the poll payload to carry three data-URL images.

Map `case_type` to the EHS case types. Map `org_id` to the company site code. Injury rows still require the worker confirm step in SafetyBot before Submit.

## 7. Dataverse and Power Platform (optional buffer)

If EHS cannot take the webhook on day one:

1. Dataverse table `safetybot_report` with columns matching the row above.
2. Power Automate: webhook → Create a new row.
3. Second flow: when a row is created → HTTP to EHS, then set `exported_at`.
4. Safety team can read the table in a model-driven app while EHS is catching up.

Copilot Studio is optional on top of that table for office staff (“file a safety report” in Teams). Point its HTTP tool at `POST /api/reports` with the same bearer key, or at the Dataverse table. Do not give Studio the Foundry key in the agent instructions.

## 8. Security baseline for a company tenant

- HTTPS only. HSTS on the gateway.
- Entra sign-in on for workers.
- Admin password unique and not in git.
- SafetyBot API key rotated; only the integration identity knows it.
- Foundry key on the host, not in the public repo and not in every phone.
- Webhook secret checked before any EHS write.
- Do not log transcripts, photos, or `x-ai-*` headers.
- Private network or IP allowlist if the EHS team requires it.
- Retention lives in EHS. Wipe or rotate `data/safetybot-reports.jsonl` after a successful export.
- Intune can pin the PWA on managed phones; the first open must be online so the shell caches.

SafetyBot is not a certified audit trail. The EHS system owns legal retention.

## 9. Rollout

| Stage | What |
| --- | --- |
| 0. Sandbox | Company Azure subscription, dummy sites, dummy photos, Foundry test deployment |
| 1. Field pilot | One site, Entra on, webhook into a Dataverse test table |
| 2. EHS mapping | `GET /api/schema` + sample rows, map fields, Injury confirm tested |
| 3. Production | Watermark pull + webhook, Key Vault, backup of `data/`, spend cap on Foundry |
| 4. Optional | Teams agent for office reporters only |

Pilot success: a worker files from a phone, the draft looks right, the same row appears in EHS within minutes, and Admin → Logic can add a field without a new build.

## 10. What the EHS team needs from IT

- Base URL of the SafetyBot host
- Rotated bearer key (Key Vault)
- Webhook secret if they expose an inbound URL
- `GET /api/schema` dump whenever Logic changes
- Entra group for who may open `/admin`
- Foundry deployment name for extract

They do not need the GitHub repo on the factory floor. They need the three routes: health, schema, reports.

More route detail: [api.md](api.md). Architecture: [architecture.md](architecture.md).
