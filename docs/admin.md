# Admin

URL: `/admin`.

The page starts at sign-in. Until the password has been changed, the page shows the first-run username and password. After that sign-in it asks for a new password of at least 8 characters. The first-run password then stops working in that browser. Change it before you expose the host. Do not copy that password into docs, issues, or screenshots.

## Logic

Component: `src/AdminLogic.tsx`.

- Classification rules
- Description template
- Extract prompt
- Photo reading prompt (`logic.photo_prompt`), sent with every photo
- Speech key terms, comma separated, sent to speech-to-text
- Case types: label, id, hint, needs-confirm, enable or disable, add a type
- Fields: label, key, type, required, `extract_from` (`speech`, `photo`, `both`, `none`), `show_if`, allowed values, hint for the model, add a field
- Save, Reset to default, Edit JSON

Save writes the browser store and `POST /api/sync` with `replaceLogic: true`. The next worker draft and the next extract call use that schema. Reset restores `defaultLogic()`.

## API

Component: `src/AdminApi.tsx`.

- Provider: Grok, OpenAI, Azure, or another OpenAI-compatible endpoint
- Model name. Blank uses the default (`grok-4.6` for Grok, `gpt-4.1-mini` for OpenAI)
- Base URL, required for Azure and compatible endpoints
- Model key, stored in this browser. Leave it empty for demo mode, or rely on `XAI_API_KEY` / `OPENAI_API_KEY` on the server
- Webhook URL and shared secret. Each submit POSTs the report row
- SafetyBot API key: copy, copy the base URL, copy curl, rotate
- Change the admin password (current password, then a new one of at least 8 characters)

The model key and the SafetyBot API key are different. The model key calls speech and extract. The SafetyBot key is `Authorization: Bearer` for other systems.

## Reports

Component: `src/AdminReports.tsx`.

One row per report. Copy sheet copies the table. Delete asks for a second tap, then removes that row from the browser and the host.

## Access

Component: `src/AdminAccess.tsx`.

Organization:

- Upload a `.csv` or `.json` file, or paste text
- Header row: `id,name,parent_id,type`
- Use list, then Save structure. Clear removes the tree
- The host copy is what `GET /api/organization` returns

Sign-in (optional):

- Require sign-in before a report
- Microsoft Entra: tenant id, application (client) id, redirect `{origin}/api/auth/microsoft/callback`
- Google: client id, redirect `{origin}/api/auth/google/callback`
- Save sign-in writes `PUT /api/auth/sso`

There is no client-secret field. Enabling Microsoft needs both a tenant id and a client id. Enabling Google needs a client id. Leave both off if workers do not need to sign in.
