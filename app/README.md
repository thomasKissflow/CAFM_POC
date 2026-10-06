# CAFM demo frontend (Phase 2)

A React + TypeScript frontend for the Dutco Construction CAFM prospect demo. **Mock data only:** there is no network access (the one exception is the optional, dev-only Claude voice brain below), and every building, person and figure is fictional DEMO data.

## Run

```bash
npm install
npm run dev
```

It serves on http://127.0.0.1:5188 (5173 is used by another local project). From the repo root you can also start the `cafm-web` config in `.claude/launch.json`.

| Command | What it does |
|---|---|
| `npm test` | Unit tests: liability engine, SLA engine, seed data, the storyline through the services |
| `npm run typecheck` | TypeScript, strict mode |
| `npm run build` | Production build into `dist/` (writes `manifest.json` for Kissflow Custom UI) |
| `npm run zip` | Build and package `cafm-poc.zip` for Custom UI upload (Phase 6) |
| `node scripts/e2e-story.mjs http://localhost:5188 en dlp` | Runs the storyline through the real UI with Playwright. Change `en` to `ar`, and `dlp` to `chargeable` for the reclassification path |
| `node scripts/e2e-voice.mjs http://localhost:5188 en` | Plays the scripted voice call (`en` or `ar`). Checks barge-in, WO creation and the transcript on the helpdesk side |
| `node scripts/e2e-guided.mjs` | Walks every beat of the guided demo |
| `node scripts/qa-shots.mjs <dir>` | Screenshots every screen × role, EN/AR, desktop and phone. Reports console errors and horizontal overflow |

## Demoing

- **Start guided demo** (top right) opens the storyline panel. It has 14 beats, from the "before" group chat through to Dutco's plant and fleet. Each beat switches role and navigates. "Do it for me" runs that beat's step.
- The **role switcher** (avatar menu) shows each persona. Technician and resident appear in a phone frame on desktop and full-screen on a phone.
- The **EN / العربية** toggle switches the whole UI to right-to-left.
- The **demo clock** starts at Tue 18 Aug 2026 14:05 GST and runs in real time, so SLA gauges visibly tick.
- **Reset demo data** is in the sidebar footer. Reloading the page also resets the data. Role and language persist.
- Anything marked **AI preview** is mocked. It is not a shipped Kissflow capability.

## Voice agent (resident app)

Switch the role to **Resident** and tap **Talk** in the tab bar (route `#/me/voice`).
- **Start talking** uses the browser microphone and speech. Chrome is recommended; iOS Safari is uneven. You can interrupt the assistant at any time and it stops and listens.
- **Play a demo call** runs a scripted caller, including one interruption, so the demo works without a mic. Use the speaker icon to mute the voice.
- The keyboard button is a typed fallback.
- A confirmed call creates a WO with channel **Voice agent**, the full transcript, the vulnerable-occupant flag and the access window. The helpdesk sees the transcript on the WO.
- **Brain:** *Demo (offline)* is deterministic and bilingual. For *Claude*, add `ANTHROPIC_API_KEY=` to `CAFM/.env` (optionally `CAFM_VOICE_MODEL=`, default `claude-opus-5`) and restart `npm run dev`. The key stays in the dev-server proxy (`server/voiceProxy.ts`) and never reaches the browser. The proxy isn't part of the Custom UI zip. Phase 7 moves speech and the brain to Google Cloud (PLAN §10A).

## Architecture

```
src/domain/          types, liability engine (DLP/chargeable/decennial), SLA engine, GST time helpers
src/services/types.ts   service contracts: the only thing screens depend on
src/services/mock/      mock implementation: seeded data, workflow rules, AI-preview mocks
src/services/context.tsx  ServicesProvider, useQuery, useNow
src/i18n/            en.ts / ar.ts dictionaries (typed, full Arabic), formatters (AED, GST dates)
src/voice/           voice agent: speech (STT/TTS/mic meter), session state machine (barge-in, end-of-turn), demo + Claude brains
server/voiceProxy.ts dev-only Claude proxy mounted by vite.config.ts (key stays server-side)
src/ui/              design-system primitives, StaffGauge (SLA), ChainageRuler (DLP), SignaturePad
src/screens/         one file per screen; tech/ holds the technician mobile flow
src/demo/            guided demo script and panel
```

**Swapping in Kissflow (Phase 6):** implement `Services` from `src/services/types.ts` against the Kissflow SDK (`kf.app.getProcess/getDataform/getBoard`, `kf.api` with `kf.account._id`). Replace the demo role switcher with `kf.user.AppRoles`, then pass the new implementation to `<ServicesProvider>` in `src/app/App.tsx`. Screens don't change. The build already follows the `@kissflow/create-app` conventions: relative `base`, a single React copy and `dist/manifest.json`.

## Phase 6: running inside Kissflow

- **Build:** `npm run zip` produces `cafm-poc.zip` (the Vite build plus `manifest.json` for Custom UI).
- **Inside Kissflow** the app detects the host, loads live data through `@kissflow/lowcode-client-sdk` (`src/services/kissflow/`), and shows **Live · Kissflow** in the header. It opens on the signed-in user's app role. Outside Kissflow, or with `?data=mock`, it uses demo data. If Kissflow can't be reached, it opens on demo data and the header chip explains why.
- **Check the adapter before uploading:** `npx vite-node --root . scripts/kf/adapter-check.ts [--write]` runs the real adapter from Node against the live app through a REST stand-in for the SDK. It reads the API key from `../.env`; run it with `set -a; . ../.env; set +a;` in front.
- **Redeploy a new build:** `npm run zip`, then from `data-model/` run `node redeploy-ui.mjs ../app/cafm-poc.zip`. This updates the existing Custom UI component in place.
- **Diagnostics and self-test:** click **Live · Kissflow** in the header.

## Phase 7: AI backend and Gemini Live voice

- **Backend** (`server/`): one request handler (`server/http.ts`), mounted by `npm run dev` and runnable alone (`server/index.ts`, for Cloud Run). Reads `GEMINI_API_KEY` and `KF_*` from `../.env` via process.env only; nothing is `VITE_`-prefixed, so no secret reaches the bundle. Config in `server/ai/config.ts`; prompt default in `server/ai/prompts.ts` (the live prompt is the Kissflow "AI Settings" row).
  - `GET /api/ai/health` · `POST /api/live-token` · `GET|PUT /api/ai/settings` · `POST /api/kf` (dev only: Kissflow proxy for local live data)
- **Data source**: inside Kissflow → SDK; `npm run dev` → live Kissflow through `/api/kf`; `?data=mock` → demo data.
- **Voice** (`src/voice/live/`): `useGeminiLive` (same shape as `useVoiceSession`), `audio.ts` (16 kHz capture worklet in `public/worklets/`, 24 kHz player), `aiApi.ts`. Engine chosen in Admin → AI settings (per browser).
- **Admin** (`src/screens/admin/`): Data browser, AI conversations, AI settings.
- **Inside Kissflow** the Live engine needs `VITE_AI_API_BASE` (the Cloud Run URL) at build time; until then it shows the browser demo.
- Checks: see TESTING.md, "Phase 7".

### Where the AI runs (Phase 7)

`src/ai/provider.ts` picks one of three modes and everything else (voice, summary, insights) goes through it:

| Mode | When | Key |
|---|---|---|
| `backend` | `npm run dev`, later Cloud Run | server-side (`../.env` / Secret Manager) |
| `browser` | inside Kissflow (POC) | the Kissflow "AI Settings" row, read at call time |
| `off` | neither | — demo voice only, no summaries |

`?ai=browser` or `?ai=backend` forces a mode for testing; `?data=mock` forces demo data. Summary and insights run automatically when a call ends and can be re-run in Admin → AI conversations. `data-model/put-gemini-key.mjs` copies the key from `.env` into Kissflow (it never prints the value); `--remove` clears it.

### Weather

The header shows Dubai's current temperature from Open-Meteo (`src/services/weather.ts`). It is fetched **once per browser session** and shared: screen changes and reloads reuse the stored reading, and an unreachable service falls back to the demo value (46°C) with the reason on hover.
