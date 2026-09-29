# Troubleshooting

## Microphone or camera does nothing

- Use `https://` in production. `http://localhost` and `http://127.0.0.1` are allowed. Any other hostname needs HTTPS.
- The browser must grant microphone / camera. If you tapped Block, clear the permission for this site and reload.
- An iframe needs `allow="microphone; camera"` on the parent page. Prefer opening SafetyBot as a full page. See [embed.md](embed.md).

## Hold to talk saves nothing useful

- No model key: the app still runs. Type a note. Speech and photo extract return 503 until a key is set (Admin → API, or `XAI_API_KEY` / `OPENAI_API_KEY` on the server).
- Azure as the extract provider does **not** give you Azure Speech. `/api/ai/transcribe` is Grok Voice or OpenAI-style STT only.
- 429 / rate limit: wait and retry, or switch to a cheaper model on Admin → API. Put a spend cap on the vendor console.

## Draft looks like dummy text

That is demo mode. Paste a model key on Admin → API and send the same note again.

## Admin sign-in fails

- First-run values work only until you set a new password in that browser.
- After a password change, the old password is dead on that origin.
- There is no email reset. Clear site data for this origin, or edit `data/safetybot-store.json` on the host.

## `GET /api/reports` returns 401

Wrong or missing `Authorization: Bearer` key. Use the **rotated** SafetyBot API key from Admin → API, not the model key and not the demo value from source.

## Reports disappeared

The host keeps at most **200** rows. Copy out with the webhook or a `since=` pull. SafetyBot is a buffer, not the archive.

## Offline item never becomes a draft

Open SafetyBot in the foreground while you have signal. A hidden or killed tab does not flush. Injury still needs the confirm button on `/draft`. See [offline.md](offline.md).

## Worker still sees old fields

Admin → Logic → Save. Opening `/` does not reload an unsaved editor. A second browser that never saved Logic still has the old cache until it loads schema from the host.

## Webhook shows `failed`

The target must answer within 8 seconds. Land on Logic Apps / a queue first if the EHS API is slow. Check `x-safetybot-secret`.

## Photos missing from the API

`GET /api/reports` has `photo_count`, not the JPEG. Treat SafetyBot as the structured case. Add a later upload path if EHS needs the image file.
