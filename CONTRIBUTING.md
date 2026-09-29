# Contributing

SafetyBot is under development. The repository stays private until the owner publishes it.

## Run

```bash
npm install
npm run dev
```

Dev server: http://127.0.0.1:8082

`npm run build` must succeed before you push.

## Rules

1. Do not commit `.env`, `.env.local`, `data/`, `credentials.json`, real reports, or real photos.
2. Screenshots in `docs/screenshots/` use dummy text only.
3. Prefer Admin → Logic for new fields and case types. Change React only when the schema cannot express it.
4. Keep worker capture simple: one primary action (hold to talk). Camera is secondary.
5. There is no CI workflow. Do not add one unless the owner asks.

## Docs that must stay in sync

If you change routes, env vars, or how keys work, update `README.md`, `docs/api.md`, and `docs/self-host.md` in the same change.
