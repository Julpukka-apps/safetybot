# Contributing

SafetyBot is an early preview (v0.1.6). The repository stays private until the owner publishes it.

## Run

```bash
npm install
npm run dev
```

Dev server: http://127.0.0.1:8082

`npm run build` must succeed before you push.

## Rules

1. Do not commit `.env`, `.env.local`, `data/`, credentials, real reports, or real photos.
2. Screenshots in `docs/screenshots/` use dummy text only. No API keys and no named people.
3. Prefer Admin → Logic for new fields and case types. Change React only when the schema cannot express it.
4. Keep worker capture simple: one primary action (hold to talk). Camera is secondary.
5. There is no CI workflow. Do not add one unless the owner asks.

## Docs that must stay in sync

If you change `LANGUAGES`, routes, env vars, admin tabs, or the seed in `defaultLogic()`, update the docs in the same change:

- `README.md`
- `docs/admin.md`
- `docs/api.md`
- `docs/schema.md`
- `docs/self-host.md`
- `docs/languages.md`
- `docs/architecture.md`

The language list is every id in `LANGUAGES` in `src/schema.ts`. Do not shorten it to two languages.
