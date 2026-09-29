# Self-host SafetyBot

This is the path for someone who cloned the repo and wants their own instance. The live preview at https://safetybot.julpukka.com is the owner's demo, not your data.

## 1. Install

Need Node.js 20+.

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

## 3. First-run admin

`/admin` shows the first-run username and password once. Sign in, then set a new password of at least 8 characters. After that the first-run password stops working in that browser.

If you publish this host on the internet, do that password change before anyone else can open `/admin`.

Also open Admin → API and rotate the SafetyBot API key. The shipped demo key is in source (`DEFAULT_API_KEY` in `src/schema.ts`) and must not stay on a public host.

## 4. Model key (optional)

Without a model key you can still type a report and walk the screens. Live hold-to-talk and photo extract need a key.

Easiest: Admin → API → provider `xai` → paste the xAI key → model `grok-4.6`.

Server fallback, if you do not want the key only in the browser:

```bash
cp .env.example .env.local
# set XAI_API_KEY=...   or OPENAI_API_KEY=...
```

Restart `npm run dev` after editing `.env.local`.

Never commit `.env.local`.

## 5. Production process

```bash
npm run build
npm start
```

`npm start` binds `0.0.0.0:8082`. Put a reverse proxy in front (Caddy, nginx, or your host's HTTPS) so workers get `https://your-domain`.

Keep these on disk across restarts:

- `data/safetybot-store.json`
- `data/safetybot-reports.jsonl`

If you run in Docker or on a PaaS, mount a volume on `/app/data` (or whatever working directory you use).

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

Optional webhook: set the URL on Admin → API. Each submit POSTs the report JSON there.

## 7. SSO (optional)

Admin → Access can enable Google or Microsoft sign-in. Callbacks are:

- `{origin}/api/auth/google/callback`
- `{origin}/api/auth/microsoft/callback`

Client ids and secrets are stored through that tab / `/api/auth/sso`, not in `.env.example`. Leave SSO off if you only need the local admin password.

## 8. Before you expose the host

- [ ] Admin password changed
- [ ] SafetyBot API key rotated
- [ ] HTTPS on
- [ ] `data/` on persistent disk
- [ ] No real injury reports on a public demo
- [ ] Model key not committed to git
