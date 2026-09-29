# Self-host SafetyBot

This is the path for someone who cloned the repo and wants their own instance. The live preview at https://safetybot.julpukka.com is the owner's demo, not your data.

The repository is private. You need access to https://github.com/Julpukka-apps/safetybot before `git clone` works.

## 1. Install

Need Node.js 20 or newer.

```bash
git clone https://github.com/Julpukka-apps/safetybot.git
cd safetybot
npm install
```

## 2. Run in development

```bash
npm run dev
```

Open http://127.0.0.1:8082

- Worker: `/`
- Admin: `/admin`

The microphone and camera work on `http://localhost` and `http://127.0.0.1`. On any other hostname they need HTTPS.

Without a model key you can still type a note and walk the screens. That is demo mode.

## 3. First-run admin

Open `/admin`. The page shows the first-run username and password until you change them. Sign in, then set a new password of at least 8 characters. After that the first-run password stops working in that browser.

Do that before anyone else can open `/admin`.

Also open Admin → API and rotate the SafetyBot API key. The shipped demo key is in source and must not stay on a shared host. Do not copy it into a ticket, a chat, or this file.

## 4. Model key (optional)

Live hold-to-talk and photo extract need a key. Demo mode does not.

Easiest: Admin → API, choose Grok, paste the key, leave the model blank or set `grok-4.6`.

Server fallback, if you do not want the key only in the browser:

```bash
cp .env.example .env.local
```

Set `XAI_API_KEY` for Grok, or `OPENAI_API_KEY` for OpenAI. Leave the values empty in git. Restart after editing `.env.local`.

Azure and other compatible endpoints need the base URL and key in Admin → API. They do not read those env names.

Never commit `.env.local`.

## 5. Production process

```bash
npm run build
npm start
```

`npm start` binds `0.0.0.0:8082`. Put an HTTPS reverse proxy in front so workers get `https://your-domain`.

Keep these on disk across restarts:

- `data/safetybot-store.json`
- `data/safetybot-reports.jsonl`

`data/` is gitignored. Back it up. The app keeps at most 200 reports.

Example Caddy snippet:

```
safetybot.example.com {
  reverse_proxy 127.0.0.1:8082
}
```

## 6. Pull reports from another system

```bash
export ORIGIN=https://safetybot.example.com
export SAFETYBOT_API_KEY='the key from Admin → API'

curl -sS "$ORIGIN/api/health"
curl -sS "$ORIGIN/api/reports" -H "Authorization: Bearer $SAFETYBOT_API_KEY"
curl -sS "$ORIGIN/api/schema" -H "Authorization: Bearer $SAFETYBOT_API_KEY"
```

A wrong bearer key returns `401`.

Optional webhook: set the URL on Admin → API. Each submit POSTs the report row there. The shared secret is the `x-safetybot-secret` header.

## 7. Sign-in (optional)

Admin → Access can require Microsoft Entra or Google before a worker submits. Register these callbacks on that provider:

- `{origin}/api/auth/microsoft/callback`
- `{origin}/api/auth/google/callback`

Microsoft needs a tenant id and an application (client) id. Google needs a client id. Those values are saved from the Access tab, not from `.env.example`. Leave sign-in off if you only need the local admin password.

## 8. Before you expose the host

- [ ] Admin password changed
- [ ] SafetyBot API key rotated
- [ ] HTTPS on
- [ ] `data/` on persistent disk and backed up
- [ ] No real injury reports on a public demo
- [ ] Model key not committed to git
