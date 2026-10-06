# 06 · AI and the voice agent

Three AI features, all Gemini, all optional — the demo runs without a key, it just loses the
live call and the summaries.

| Feature | Model | Where |
|---|---|---|
| Live voice agent | `gemini-3.8-live` (v1alpha) | `app/src/voice/live/` |
| Call summary and insights | `gemini-3.8-flash` with a response schema | `app/src/ai/` and `app/server/ai/` |
| Video narration | `gemini-3.1-flash-tts-preview`, 24 kHz mono PCM | `app/scripts/video/narrate.mjs` |

## Two voice engines

The app ships both, and you switch between them in **Admin → AI settings**.

- **Browser demo** — a scripted agent using the browser's own speech synthesis. Free, works
  offline, needs no key, and is deterministic. This is what the automated tests and the video
  use. `app/src/voice/mockBrain.ts`.
- **Live (Gemini)** — a real conversation. Speaks and listens in English or Arabic, can be
  interrupted mid-sentence, and raises the work order at the end. `app/src/voice/live/`.

Use the demo engine when you are testing anything that is not the live call itself. It is
faster, free, and does not depend on a network.

## Where the key lives, and why

Three modes, resolved in `app/src/ai/provider.ts`:

1. **`backend`** — a server holds the key and mints short-lived voice tokens. This is the
   production design, written and working in `app/server/`.
2. **`browser`** — the key is read from a row in the Kissflow **AI Settings** dataform and used
   from the page. **POC only.** This is what runs inside Kissflow today, because the Custom UI
   has no server of its own and the deal has not closed yet.
3. **`off`** — no key, demo engine only.

Force one with `?ai=browser` or `?ai=backend`.

Mode 2 means anyone who can open that dataform as an app admin, or inspect the browser during a
call, can read the key. That is a deliberate, recorded trade-off (**D64**, **Q51**) and the
first item in [`PRODUCTION_TODO.md`](../PRODUCTION_TODO.md). Do not quietly make it worse, and
do not "improve" it by moving the key into the bundle.

`data-model/put-gemini-key.mjs` copies the key from `.env` into Kissflow without printing it.
`--remove` clears it.

## Voice session tokens

Gemini Live is reached from the browser with an **ephemeral token**, single use, short expiry.
Two things were learned the hard way and are easy to re-break:

- A token that carries `tools` is rejected (`field_mask is invalid`). The browser must supply
  the tools itself, alongside the session-resumption handle.
- Locking everything with `lockAdditionalFields` breaks resumption. Lock with
  `lockAdditionalFields: []`, which pins the model, prompt, voice, transcription and
  compression but leaves tools and resumption to the client.

Resumption across fresh single-use tokens is tested and works. If you change the token shape,
test a call that runs past one token's lifetime.

## The system prompt

Editable in **Admin → AI settings** and stored in Kissflow, so it can be tuned without a
redeploy. It tells the agent what it is, which questions to ask, how to confirm, and how to
behave in Arabic. Changing it changes the demo's most-watched moment — read the current one
before you edit it, and run a call afterwards.

## Checking it works

**Admin → AI settings → Run AI self-test** drives the whole chain in the browser: mint a voice
token, open a live session, create a job card, summarise, produce insights, save the
conversation. It writes one `[TEST]` call and deletes nothing.

From the command line:

```bash
cd app
node scripts/e2e-voice.mjs http://localhost:5188 en     # scripted call, end to end
node scripts/e2e-voice.mjs http://localhost:5188 ar
```

Both are in the gate.

## Where calls are kept

Every call is saved to the **AI Conversations** dataform: transcript, summary, key points,
action items, sentiment, token counts, and the work order it produced. **Admin → AI
conversations** reads them back. This is a genuinely good thing to show a prospect — it is the
audit trail a WhatsApp group cannot produce.

## Known constraints

- Microphone access works inside the Kissflow Custom UI iframe; the Custom UI host sets no CSP,
  so both `fetch` and WebSocket to Google's endpoints work.
- Headless browsers have no speech voices, so automated tests mute the agent and pace the call
  from the transcript instead.
- Live audio has only ever been tested by typing, because the test browser blocks microphones.
  A real microphone call on a real laptop is still an open item (**Q50**).
