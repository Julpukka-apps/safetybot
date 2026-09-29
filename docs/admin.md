# Admin

URL: `/admin` on the running app. Live preview: https://safetybot.julpukka.com/admin

The page is `src/app/admin/page.tsx`. It starts at sign-in. After a first-run sign-in it asks for a new password of at least 8 characters. The first-run password then stops working in that browser.

## Tabs

| Tab | Component | What it edits |
| --- | --- | --- |
| Logic | `src/AdminLogic.tsx` | Classification rules, description template, extract prompt, photo reading prompt, speech terms, case types, fields |
| API | `src/AdminApi.tsx` | Model provider, key, and model name saved in this browser. Also the bearer key for the report API |
| Reports | `src/AdminReports.tsx` | Reports stored in this browser and synced to the host |
| Access | `src/AdminAccess.tsx` | Organization tree and Microsoft / Google sign-in |

Save on Logic writes `localStorage` and calls `pushConfig()` in `src/remote.ts`, which `POST`s `/api/sync`.

The photo reading prompt is the text sent with a photo. It is `logic.photo_prompt`. Edit it on the Logic tab and press Save. The next photo read uses that text.
