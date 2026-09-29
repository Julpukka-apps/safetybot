# Embed SafetyBot in a company tool

How a company can put SafetyBot inside a technician app, a work-order system, or a portal — and still send cases to their own safety reporting system.

SafetyBot is a small website (`/`, `/draft`, `/done`) plus an HTTP API. It is not an npm widget today. Pick a strategy by how much of *their* UI they want to keep.

The data path is the same in every strategy. See [api.md](api.md) and [microsoft.md](microsoft.md).

```
Technician tool  --opens or hosts-->  SafetyBot UI or API
                                          |
                                          |→ webhook POST  → EHS
                                          |→ GET /api/reports?since=…
```

The SafetyBot host keeps at most 200 reports. The company system must copy each case out.

## Choose a strategy

| # | Strategy | Effort | When to use |
| --- | --- | --- | --- |
| 1 | Button that opens SafetyBot | Hours | Default. Almost every technician app |
| 2 | In-app browser / WebView | Days | Native Android / iOS field tool |
| 3 | iframe on an intranet page | Days–a week | Desk portal, typing and photos |
| 4 | Their screens, SafetyBot API | Weeks | Strong existing design system |
| 5 | Take the code (fork) | Weeks–ongoing | They must own pixels, data residency, or the backlog |

Start at 1 unless there is a hard rule that the mic must sit inside their layout.

---

## 1. Button that opens SafetyBot

The company hosts one SafetyBot instance. The technician tool adds one action.

```
Report a safety case → https://safety.example.com/
```

Optional query string (add these flags in a later small change if you need them): site / `org_id`, language, a return URL after `/done`.

What they configure on SafetyBot:

- Entra sign-in if only company accounts may file
- Admin → API webhook to the EHS inbound URL
- Rotated SafetyBot API key for the pull job

The technician app never sees the draft JSON. Submit already fires the webhook. A scheduled `GET /api/reports?since=` catches missed posts.

This is the strategy to ship first.

---

## 2. WebView in a native technician app

Same hosted SafetyBot, shown inside the existing Android or iOS shell.

Needs:

- `https://` (mic and camera will not start on plain HTTP)
- Native permission prompts for microphone and camera, forwarded to the WebView
- Cookies enabled so Entra sign-in can complete (top-level WebView, not a locked iframe)
- First open while online so the PWA shell caches; offline queue then works on that origin

iOS WKWebView is stricter than Chrome Custom Tabs. If hold-to-talk fails, fall back to strategy 1 (system browser) for the report step only.

On submit, the WebView can stay open on `/done`, or the native app can close the sheet when the URL becomes `/done`.

---

## 3. iframe on a company page

Possible. Fragile on phones.

The app does not set `X-Frame-Options` today, so a same-company iframe of `/` can render. Still required:

- Parent page is HTTPS
- Parent sends `Permissions-Policy` that allows `microphone` and `camera` for the SafetyBot origin
- Allowlist the parent with `Content-Security-Policy: frame-ancestors https://tools.example.com` (add this before production embed)
- Do **not** expect Entra login inside the iframe. Microsoft sign-in pages block framing. Sign in in a popup or top-level window, then reload the frame
- Offline IndexedDB belongs to the iframe origin. It does not share a queue with the standalone PWA on the same phone

Use iframe for a desktop work-order screen where people mostly type or attach a photo. Do not promise glove-friendly hold-to-talk inside a third-party iframe on iPhone.

A later small feature: `postMessage` on submit `{ type: "safetybot:submitted", id }` so the parent can close the panel.

---

## 4. Their UI, SafetyBot as the engine

The technician tool already has notes, photos, and job context. They skip our screens.

1. Collect text and up to 3 photos (and optional audio) in *their* app.
2. Call the company SafetyBot host:
   - `POST /api/ai/transcribe` if they have audio
   - `POST /api/ai/extract` with transcript, photos, language, and current logic from `GET /api/schema`
   - `POST /api/reports` with the filled row and `Authorization: Bearer`
3. Show the returned fields in their form. Worker confirms. Then POST.
4. Webhook or pull into EHS as usual.

Today the model routes also accept `x-ai-*` headers from the browser. On a company host put the model key on the **server** and do not ship Foundry keys inside the technician binary.

This strategy is field-mapping work, not pixel embedding.

---

## 5. Take the code

License is [MIT](../LICENSE). A company may clone, fork, rename, restyle, and run their own host. That is the “just take the code” path.

### What they get

| Path | Role |
| --- | --- |
| `src/Capture.tsx` | Hold to talk, photos, type |
| `src/Draft.tsx` | Check and submit |
| `src/Done.tsx` | Confirmation |
| `src/Admin*.tsx` | Logic, API, Reports, Access |
| `src/schema.ts` | Case types, fields, `reportToRow` |
| `src/i18n.tsx` + locale packs | UI languages |
| `src/outbox.ts` | Offline queue |
| `src/app/api/**` | Health, reports, schema, auth, AI |
| `src/server/**` | Store, webhook, bearer check |

Stack: Next.js 16, React 19, Node 20, port 8082.

### How to take it

```bash
git clone https://github.com/Julpukka-apps/safetybot.git
cd safetybot
npm install
cp .env.example .env.local
# set server model keys if used; never commit this file
npm run dev
```

Then either:

**A. Fork and host as-is**  
Change the wordmark, colors in `src/app/globals.css`, and the Entra redirect. Keep Admin → Logic as the form editor. This is still strategy 1, with their branding.

**B. Vendor the worker screens into their React app**  
Copy `Capture.tsx`, `Draft.tsx`, `schema.ts`, `storage.ts`, `xai.ts`, `outbox.ts`, and the i18n files. They must also copy or re-implement the `/api/*` routes. The offline database name is `safetybot_outbox_v1` — change it if two apps share an origin. This is a fork. They own merges from upstream.

**C. Keep our host, restyle only**  
If they only need a logo and primary color, stay on A. Do not copy files into a second repo unless they will staff it.

### Rules when they take the code

- Rotate admin password and the SafetyBot API key before the host is reachable.
- Do not commit `.env.local`, `data/`, or model keys.
- Point webhook + pull at the EHS system on day one. 200-row buffer.
- Keep Injury confirm. Do not auto-POST from their wrapper.
- If they merge upstream later, treat `src/schema.ts` defaults and Admin Logic as product config, not as their EHS schema. Map in the integration layer.
- MIT requires keeping the copyright notice. They may rebrand the UI.

### What taking the code does not remove

They still need a Node host, HTTPS, a model key or demo mode, and an EHS connector. Copying `Capture.tsx` into a Java or .NET technician client is not a port. Use strategy 2 or 4 for those stacks.

---

## Data out (all strategies)

```bash
export ORIGIN=https://safety.example.com
export SAFETYBOT_API_KEY='rotated key from Admin → API'

curl -sS "$ORIGIN/api/health"
curl -sS "$ORIGIN/api/schema" -H "Authorization: Bearer $SAFETYBOT_API_KEY"
curl -sS "$ORIGIN/api/reports?since=2026-09-01T00:00:00.000Z" \
  -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

Webhook: Admin → API URL + shared secret. SafetyBot POSTs one flattened row, header `x-safetybot-secret`, 8 second timeout.

List rows include `id`, `case_type`, field columns, `reporter_email`, `org_id`. They include `photo_count`, not the JPEG bytes.

---

## Small upgrades if a company asks for embed next

These are not built yet. They are the right next patches if strategy 2 or 3 becomes common:

1. `?org_id=` and `?lang=` on `/`
2. `?return=` after `/done`
3. `?embed=1` hides the Admin gear and tightens padding
4. `frame-ancestors` allowlist
5. `postMessage` on successful submit

Until those exist, strategy 1 plus the API is enough to go live inside a company tool.
