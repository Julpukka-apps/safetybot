# Admin user guide

URL: `/admin`.

This page is for the person who owns the SafetyBot host — usually a safety specialist plus IT. Workers stay on `/`. Do not bookmark `/admin` on a shared site phone.

## First sign-in

1. Open `/admin`.
2. The page shows the first-run username and password until you replace them. Sign in with those values.
3. Set a new password of at least 8 characters.
4. The first-run password then stops working in that browser.
5. Open the **API** tab and rotate the SafetyBot API key before anyone else can call `/api/reports`.

Do not copy the first-run password or the demo API key into docs, issues, or screenshots. They live in `src/schema.ts` so a clone can start. Change both on every host you expose.

If you forget the new password, that browser is locked out of `/admin` until you clear the site data for this origin or edit `data/safetybot-store.json` on the host. There is no email reset.

## Daily use

| Tab | You use it to |
| --- | --- |
| Logic | Case types, fields, extract rules, prompts |
| API | Model key, webhook, SafetyBot API key, admin password |
| Reports | See or delete the last cases on this host |
| Access | Organization tree and worker sign-in |

The top-left SafetyBot wordmark always returns to the worker home `/`.

## Logic

This is the form the AI fills. Save here instead of editing React.

1. Set **case types**. Each type has a label, id, hint for the model, and an optional **needs confirm** flag (use that for Injury).
2. Enable or disable a type. Add a type if your EHS system uses different names.
3. Set **fields**. For each field: label, key, type, required, `extract_from` (`speech`, `photo`, `both`, `none`), optional `show_if`, allowed values, hint.
4. Edit the description template and the extract / photo prompts if the drafts are too generic.
5. Speech key terms: comma-separated words sent to speech-to-text (site names, tool names).
6. Press **Save**. That writes the browser store and `POST /api/sync` with `replaceLogic: true`. The next worker draft uses this schema.
7. **Reset to default** restores the seed in `defaultLogic()`. **Edit JSON** is for backup or a bulk paste.

`extract_from` is what the model is allowed to fill from speech versus a photo. `none` means the worker types it on `/draft`.

Component: `src/AdminLogic.tsx`. Field shapes: [schema.md](schema.md).

## API

Two different keys live on this tab.

**Model key** — speech and extract.

1. Choose provider: Grok, OpenAI, Azure, or compatible.
2. Model name. Blank uses `grok-4.6` (Grok) or `gpt-4.1-mini` (OpenAI).
3. Base URL — required for Azure and compatible endpoints.
4. Paste the model key, or leave it empty and set `XAI_API_KEY` / `OPENAI_API_KEY` on the server.
5. Azure and compatible do **not** read those env names. They need the key and base URL on this tab (or a later server change).

`/api/ai/transcribe` talks to Grok Voice or OpenAI-style STT. It does **not** call Azure Speech. A Microsoft-only tenant can still use Azure for extract and keep Grok/OpenAI for speech, or type and use photos until a Speech adapter exists. Details: [microsoft.md](microsoft.md).

Where to get a key:

- xAI / Grok: [console.x.ai](https://console.x.ai)
- OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Azure OpenAI / Foundry: your company portal (deployment name + chat-completions URL)

**Webhook** — each Submit POSTs the flattened report row to this URL. Header `x-safetybot-secret` carries the shared secret. Timeout 8 seconds.

**SafetyBot API key** — `Authorization: Bearer` for `GET /api/reports` and the other owner routes. Copy, copy curl, rotate. Other systems use this key, not the model key.

**Change password** — current password, then a new one of at least 8 characters.

Component: `src/AdminApi.tsx`.

## Reports

The host keeps **at most 200 reports**. Older rows drop off this list when new ones arrive. Copy them out with the webhook or `GET /api/reports` before that happens.

- One row per case.
- Copy sheet copies the table.
- Delete asks for a second tap, then removes the row from the browser and the host.

This list is not the official EHS archive. Photos are not in the table (`photo_count` only on the API row).

Component: `src/AdminReports.tsx`.

## Access

**Organization**

- Upload `.csv` or `.json`, or paste text.
- Header: `id,name,parent_id,type`.
- Use list, then Save structure. Clear removes the tree.
- `GET /api/organization` returns the host copy.

**Sign-in (optional)**

- Require sign-in before a report.
- Microsoft Entra: tenant id, application (client) id, redirect `{origin}/api/auth/microsoft/callback`.
- Google: client id, redirect `{origin}/api/auth/google/callback`.
- Save sign-in writes `PUT /api/auth/sso`.

There is no client-secret field. Leave both providers off if workers should file without an account.

Component: `src/AdminAccess.tsx`. Company Entra path: [microsoft.md](microsoft.md).

## Checklist after you clone

- [ ] New admin password
- [ ] SafetyBot API key rotated
- [ ] Model key only if you want live speech or photo extract
- [ ] Logic saved for *your* case types
- [ ] Webhook or a pull job for `/api/reports`
- [ ] HTTPS before any shared phone uses the mic
