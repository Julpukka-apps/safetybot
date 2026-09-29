# Admin user guide

URL: `/admin`. This page is for the person who owns the SafetyBot host — usually one safety lead plus one IT contact. Workers stay on `/`.

Do not put the first-run password, the SafetyBot API key, or a model key in issues or screenshots.

## First boot

1. Open `/admin`. Until you change it, the page shows the first-run username and password.
2. Sign in.
3. Set a new password of at least 8 characters. The first-run password then stops working in that browser.
4. Open the **API** tab and rotate the SafetyBot API key before anyone else can call `/api/reports`.
5. Only then expose the host.

If you forget the new password, you must clear the admin session on that browser or restore `data/safetybot-store.json` from a backup you control. There is no email reset.

## What each tab is for

| Tab | You use it to |
| --- | --- |
| **Logic** | Case types, fields, what the model reads from speech vs a photo |
| **API** | Model provider and key, webhook, SafetyBot API key, admin password |
| **Reports** | Last cases on this host (at most 200) |
| **Access** | Site list and optional Microsoft / Google sign-in |

Save on the tab you edited. Logic Save and Access Save are separate.

## Logic — the form the AI fills

This is the product configuration. You should not need to edit React to add a field.

**Prompts**

- Classification rules — how to pick injury vs near miss vs observation vs good practice vs idea
- Description template — shape of the written narrative
- Extract prompt — system instructions for the model
- Photo reading prompt — sent with every picture
- Speech key terms — comma-separated words that help speech-to-text (scaffold, excavation, …)

**Case types**

- Label people see, stable `id` the API stores (`injury`, `near_miss`, …)
- Hint for the model
- **Needs confirm** — turn on for injury so the worker must tap an extra confirm
- Enable or disable a type without deleting it
- Add a type if your EHS system has another category. Keep `id` stable; the EHS mapper keys off it

**Fields**

- Label, key, type (`text`, `textarea`, `enum`, `boolean`, `datetime`, `number`)
- Required
- `extract_from`: `speech`, `photo`, `both`, or `none` (none = worker or default only)
- `show_if` — show the field only when another field or `case_type` matches
- Allowed values for enums
- Hint for the model

**Save** writes the browser and `POST /api/sync` with `replaceLogic: true`. The next worker draft uses that schema. **Reset to default** restores the seed form. **Edit JSON** is for backup or a full paste; prefer the form unless you know the schema.

After Save, file one dummy case and confirm the new field appears on `/draft` and on `GET /api/reports`.

Details of keys and `show_if`: [schema.md](schema.md).

## API — models and the pipe out

Two different keys live here:

| Key | Purpose |
| --- | --- |
| Model key | Speech-to-text and extract. xAI, OpenAI, or Azure |
| SafetyBot API key | Other systems calling `GET /api/reports` with `Authorization: Bearer` |

**Provider**

- Grok — default. Speech: `grok-voice-transcribe-2.0`. Extract: `grok-4.6` if the model box is blank.
- OpenAI — speech and extract through OpenAI.
- Azure or compatible — you must paste a **chat-completions** base URL and the deployment name. Azure Speech is **not** wired to `/api/ai/transcribe` yet. A Microsoft-only tenant can use Azure for extract and Grok/OpenAI for speech, or start with type + photo.

Where to get a key (create on the vendor site, paste here, never commit):

- xAI: [https://console.x.ai](https://console.x.ai)
- OpenAI: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Azure OpenAI / Foundry: your company portal — deployment name + key + chat-completions URL. See [microsoft.md](microsoft.md).

Leave the model key empty to stay in demo mode (typed notes still draft).

**Webhook**

- “Also send each report to” — HTTPS URL of Power Automate, Logic Apps, or the EHS inbound API
- Shared secret — SafetyBot sends it as `x-safetybot-secret`
- Timeout 8 seconds. If the far end is slow, land on a queue first

**SafetyBot API key** — copy, copy curl, rotate. Rotate on first boot and when someone leaves the integration team.

**Change admin password** — current password, then a new one of at least 8 characters.

Get a model key: [troubleshooting.md](troubleshooting.md). Company landing: [microsoft.md](microsoft.md). Routes: [api.md](api.md).

## Reports

The host keeps **at most 200** rows. This tab is a short buffer, not the archive. Copy sheet copies the table. Delete asks for a second tap, then removes that row from the browser and the host.

Point a webhook or a pull job at `/api/reports` before you rely on this in production. List rows include field columns and `photo_count`. They do **not** include the JPEG bytes.

## Access — sites and sign-in

**Organization**

Paste or upload:

```
id,name,parent_id,type
eu,Europe,,region
fi,Finland,eu,country
hel-01,Helsinki yard,fi,site
```

Save structure. Workers can then file against a place. `GET /api/organization` returns the same tree. Clear removes it.

**Sign-in (optional)**

- Require sign-in before a report — only company accounts can submit
- Microsoft: tenant id + application (client) id. Redirect `{origin}/api/auth/microsoft/callback`
- Google: client id. Redirect `{origin}/api/auth/google/callback`
- There is no client-secret field on this screen
- Save sign-in writes `PUT /api/auth/sso`

Leave both providers off if the local admin password is enough.

## Daily habits

- Workers use `/`. You use `/admin`.
- After a Logic change, file one dummy case.
- After a webhook change, submit one dummy case and confirm it arrived.
- Do not store real injuries on a public demo host.
- Back up `data/` if this host matters.

Stuck? [troubleshooting.md](troubleshooting.md).
