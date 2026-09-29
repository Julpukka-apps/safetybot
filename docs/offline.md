# Offline capture

A worker with no signal can still hold to talk, add up to three photos, or type. The phone stores that raw capture. It does not write the draft until SafetyBot is open and online.

Product rule: offline saves the capture. Online, the model writes the draft. The worker still taps Submit.

There is no on-device model. A hidden phone does not write the draft. iOS will not flush in the background. Reopen the app, or bring it to the front, once there is signal.

## What the worker sees

Offline, the home page does not stay on “Writing the report…”. It does not open Draft.

- Title: Saved on this phone
- Sub: Will write the report when you have signal.
- Button: New report

If anything is waiting, the home page shows `{n} waiting for signal`. Tap that badge. The list shows the time, a photo thumb if there is one, the first words, and the status.

- Write now — write that item if the app is online
- Retry — shown when a write failed
- Delete saved report — one confirm, then that item only

The list is not in Admin. There is no bulk delete.

The phone keeps at most 20 waiting items. A full phone says “Send the saved reports first” and does not drop an older item.

## What is stored

IndexedDB database `safetybot`, store `safetybot_outbox_v1`. Code: `src/outbox.ts`.

Each item has an id, the time, the selected language, typed text, any live speech from the phone, the best text so far, up to three resized photos, the recording blob, and a status: `queued`, `writing`, `drafted`, or `failed`.

Photos are already JPEG data URLs from `resizeImage` (max edge 1024, quality 0.72). Originals are not stored.

The recording is kept. If the phone refuses the write because it is full, the words and photos stay and the recording is dropped. The list then says the recording did not fit.

This queue is not in `data/` on the server, and it is not in git. The server receives a report only when the worker taps Submit on Draft.

The active draft still uses `sessionStorage` (`safetybot_capture`). That slot is one draft, not the queue.

## When the phone treats the link as down

`src/online.ts` treats the phone as offline when any of these is true:

- `navigator.onLine` is false
- `GET /api/health` fails or does not answer within 2 seconds
- speech or extract throws a network error (`TypeError`, failed to fetch, or the browser’s load-failed error)

An HTTP response means the server was reached. `401` and `502` are not offline. Those keep today’s behavior: a reachable extract failure still opens a demo draft for the worker to fix.

## What is saved

Hold to talk, photo, and type all use the same queue.

- Hold: the recording is kept even if the phone’s speech API already produced words. A release with no words, no usable recording, and no photo is not queued.
- Photo: up to three photos. Extract is not called while offline.
- Type: the typed note is stored. Photos already on the page go with it.

If sign-in is required and this browser has no cached session, the sign-in gate stays. A session already cached in this browser can still save a capture. The model key is not copied into IndexedDB.

## When the draft is written

`src/outbox-flush.ts` writes one item at a time. It runs only while the page is visible. It does not run on `/admin`. It does not run in a hidden tab.

It starts when:

- the app becomes visible
- the browser fires `online`
- the worker home mounts
- the worker taps Write now

It will not overwrite a draft that is already open. That item stays queued until Draft is empty.

For each item:

1. Load the last saved logic from this browser. A network pull is not required.
2. If there is a recording larger than 800 bytes, send it to `POST /api/ai/transcribe`. A transcript from that call wins over the phone’s live words.
3. Send the text and photos to `POST /api/ai/extract`.
4. Save the result as the active draft and remove the item from the queue.
5. Open `/draft`.

A network failure during that write sets the item to `failed` and keeps the photos and recording. Retry does not delete them.

If extract returns an HTTP error from a server that answered, the worker still gets a draft, marked as a demo fill. That is not an offline save.

## App shell

`public/sw.js` is registered only in production, from `src/OutboxSync.tsx`. `npm run dev` does not register it, so a stale shell does not stick to local development.

The first online visit caches `/`, `/draft`, `/done`, the manifest, and the icons. Later visits can open those pages with no network. Requests to `/api/*` are not cached. Speech, extract, and report submit always need a live server.

After a new deploy, reload once while online so the new shell replaces the old cache.

## What does not change

- Submit is still the button on Draft. The queue never calls `POST /api/reports`.
- Injury still needs the confirm control on Draft.
- The mic stays the primary action. Camera is secondary. Type is tertiary.
- There is no offline-mode setting. It runs when the health check fails.
