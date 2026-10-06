# Phase 5: tests

Two commands cover everything. Both are safe to re-run. Nothing is ever deleted: wrong test items are rejected and kept with a `[TEST]` title.

| Command | Where | What it checks | Last run (22 Sep) |
|---|---|---|---|
| `npm run gate` | `app/` (needs `npm run dev` on 5188) | typecheck · 20 unit tests · storyline EN/AR × DLP/chargeable · guided demo (14 beats) · voice call EN + AR · all screens × roles × EN/AR × desktop/phone | **10/10** (now includes the Admin screens; browser tests force demo data with `?data=mock`) |
| `node tests/kf-suite.mjs` | `data-model/` | Kissflow backend: structure, access, step permissions, integrations, seed, adapter contract, formulas | **79/79** |
| `node tests/kf-suite.mjs --scenarios` | `data-model/` | The above, plus fresh `[TEST rMMDDhhmm]` items driven through every Work Order route and both boards | **73/75** + 3/3 board runs (before the permission fix; plain suite is now 77/77) |

Results are saved in `data-model/tests/last-run.json`.

## Phase 6: inside Kissflow

| Check | How | Last run (22 Sep) |
|---|---|---|
| **In-app self-test** (real SDK, as the signed-in user) | In the app: click **Live · Kissflow** in the header → **Run self-test**. It raises a [TEST] work order and walks it through raise → routed → accept → arrive → resolve (root cause and labour) → verify and close, then moves a [TEST] snag. | **7/7** inside Kissflow |
| **Connection diagnostics** | Same page: every SDK read, with rows, totals, errors and returned fields | used to find the four SDK issues in D55 and D56 |
| **Adapter check from Node** | `npx vite-node --root . scripts/kf/adapter-check.ts [--write]` in `app/` (REST stand-in for the SDK) | all pass |
| **Load in Kissflow** | Sidebar footer: "Live from Kissflow: 1053 work orders (11 open) · 672 assets · 186 snags · loaded in ~3s" | as stated |

Screens checked inside Kissflow: command centre, work orders, DLP & recovery, subcontractors, compliance wall, portfolio, plant & fleet, handover & snags (DLP manager). Clicks work through Claude in Chrome. Native dropdowns can't be driven from there, so the snag move is covered by the self-test instead.

## Multiple properties (1 Oct)

| Check | Result |
|---|---|
| Unit tests incl. the estate service | **45/45** |
| Add a building from Admin → Properties, against live Kissflow | pass — 1 site, 4 apartments, 8 assets written in under 3 s |
| The rows Kissflow actually holds | site code, Arabic name, district, kind, client, TOC, DLP months and end date; each apartment on its floor; each asset with its own class, its apartment, its installer, its QR code, and warranty from the class (fan coil 24 months, fire pump 12) |
| Read back after a reload | the lift reads as a lift and the fire pump as a fire pump (before the fix every added asset read as a fan coil); district and client survive |
| Raise a request against the new building | WO lands on **that** building in Kissflow, "within DLP, contractor liable", routed to the installing subcontractor |
| Command centre, Portfolio, DLP chainage, Assets, Work orders, Handover, Client report, PPM | all show the new building; none is pinned to Qamar any more |
| Remove the building | its apartments and assets are deleted from Kissflow; a building with work orders against it is refused, with the count in the message |
| Test data | all of it removed afterwards; the estate is back to one building, 24 apartments, 6 assets |

The run also found that **every work order had been stored against Qamar in Kissflow** (D88) — invisible while there was one building. Fixed and re-checked.

## Overnight stabilisation (26 Sep)

| Check | Result |
|---|---|
| Frontend gate | **10/10** |
| Kissflow backend suite | **73/73** |
| Unit tests | **27/27** |
| Adapter contract, AI path (token → live session → summary → insights) | pass |
| **Full storyline against LIVE Kissflow** (`DATA=live node scripts/e2e-story.mjs http://localhost:5188 en dlp`) | **15/15** — raise → triage → dispatch → technician → close → back-charge → batch alert → AI ask → monthly report |
| Screen sweep on live data, EN + AR, desktop + phone (`DATA=live node scripts/qa-shots.mjs <dir>`) | 62 screens, 0 console errors, reviewed by eye |

`DATA=live` runs the sweep and the storyline against the real Kissflow data instead of the demo generator; sweeps pin the temperature so they don't call the weather service 60 times.

## Small demo data (23 Sep)

One building, and the suites check that world: `kf-suite` 71/71 (fewer checks than before only because there are 3 live work orders to run formulas on, not 11), adapter check all pass, gate 10/10. Re-seed from scratch with:

```
node backup-all.mjs && node wipe-data.mjs --yes
node seed/seed.mjs all --minimal && node seed/seed-live-wos.mjs --minimal
```

## Dates and the demo clock (23 Sep)

The app runs on the real clock. The demo world is generated around a fixed design date and moved to today on every load, so it never goes stale and no re-seeding is needed. Checks after the change: unit tests 27/27, gate 10/10, backend suite 79/79, adapter check (a work order raised through the adapter stored `First_Contact_At` = the real time, and its SLA clocks came from Kissflow's own minutes).

## Phase 7: AI voice, summary and insights (as of 22 Sep)

| Check | How | Last run |
|---|---|---|
| Backend routes | `curl http://127.0.0.1:5188/api/ai/health` (with `npm run dev`); also checked: wrong origin → 403, no user → 401, dev proxy refuses non-CAFM paths | pass |
| Token + Live session end to end | `node server/ai/probe-token-session.mjs` in `app/`: mints a token through our backend, connects like the browser, expects the `record_request` call, 24 kHz audio and a resume handle | pass |
| Resume after a drop | `node --experimental-strip-types server/ai/probe-resume.mjs`: second single-use token resumes the call and remembers the room | pass |
| Prompt can't be overridden | browser-sent system prompt ("be a pirate") is ignored | pass |
| Full call in the app | Browser pane, demo data, typed caller (mic blocked there): greeting by name → job card 6/6 → read-back → confirm → WO logged → agent reads the real reference → call ends → saved in AI conversations with transcript and tokens | pass |
| AI Conversations in Kissflow | `npx vite-node --root . scripts/kf/ai-conversation-check.ts` in `app/`: save, update, read back a [TEST] row (Arabic, tokens, lists) | 7/7 |
| Inside Kissflow | Admin → Data browser lists live rows via the SDK; AI settings says "No AI backend reachable" (expected until Cloud Run) | pass |
| Summary endpoint | `curl -X POST .../api/summarize` with a transcript | pass |
| Insights endpoint | `curl -X POST .../api/insights` with a transcript | pass |
| AI parsing unit tests | `npx vitest run src/ai/ai-core.test.ts` in `app/`: bad lists dropped, unknown sentiment → neutral, caller context clipped (no prompt injection through a name), token locks what it should | **7/7** |
| **In-app AI self-test** | Admin → AI settings → **Run AI self-test**: token → live session → job card → summary → insights → saved call | **7/7** with our backend, **7/7** in browser mode (`?ai=browser`) |
| Inside-Kissflow AI path | `npx vite-node --root . scripts/ai/browser-mode-check.ts` in `app/`: reads the key stored in Kissflow (never printed), mints a token, holds a live session, summarises | **7/7** |
| Call → summary, end to end | Browser pane, demo data: typed water-leak call → agent warns about the light fitting → work order P1/DLP → summary written automatically onto the call record | pass |
| Adapter contract | `npx vite-node --root . scripts/kf/adapter-check.ts` | all pass |
| **Real microphone call** | You, on your laptop (below) | **not yet (Q50)** |
| **Self-test inside Kissflow** | You: Kissflow → Admin → AI settings → Run AI self-test (my automation can't click inside the Kissflow frame) | **not yet** |

**Inside Kissflow (no laptop server needed):** the app reads the Gemini key from the Kissflow AI Settings form and calls Gemini from the page. Admin → AI settings shows "Runs on: this page, using the key stored in Kissflow". Replace the key any time in that panel.

**Try the live voice yourself (local):**
1. `cd app && npm run dev`, open http://localhost:5188 (header chip: "Live · Kissflow (local)").
2. Switch role to **Admin (Nadia Farouk)** → **AI settings** → pick **Live (Gemini)**. The backend should show "AI backend ready · gemini-3.8-live".
3. Switch role to **Resident (Layla)** → Talk → **Start talking**, allow the microphone. Speak normally; interrupt it mid-sentence to test barge-in; try Arabic.
4. Confirm the read-back. A real work order is created in Kissflow (it's live data locally), and the call appears under Admin → **AI conversations**. Reject that work order afterwards if you don't want it (D47).
5. The dev terminal shows one `[ai-usage]` line per token (counts only, never content or keys).

## What the backend suite checks

1. **Structure:**
   - all 18 flows are live under their new names
   - all 16 lists carry every value
   - exactly 10 app roles, no duplicates
2. **Access:**
   - all 120 designed grants are present
   - Resident can raise work orders; Executive is view-only
   - **no role is DataAdmin** on any process. This is a regression guard: it caught the Work Order silently turning every role into DataAdmin, which is now restored (Q47).
3. **Step permissions:** every step's field rules are actually linked to the fields (Q42/Q46).
4. **Integrations:** all 7 exist, are field-mapped, and show whether they're on.
5. **Seed:**
   - every demo record is present exactly once: sites, subcontractors, units, assets (keyed on QR code), 1,042 history rows, certificates, PPM, plant
   - the snag status mix matches the demo
   - DLP history rows equal the demo's back-charges (366)
   - the Total Cost formula is computed on every row
6. **Adapter contract:** the 61 fields the Phase 6 Custom UI adapter will read or write exist on Work Order, DLP Cost Recovery, Asset Register and Work Order History.
7. **Formulas:** the 10 runtime cases on the sandbox dataform (summer rule, DLP/warranty/chargeable/own-ops/structural, DLP end-day boundaries, blank dates, excluded cause).
8. **Scenarios** (`--scenarios`): 8 Work Order routes plus a rejection, and 3 board runs, on fresh items.

## Known gaps (honest list)

- **Per-role runtime visibility** (for example, "a resident sees only their own requests") needs real user logins per role. The API key acts only as you. The suite checks the grants that drive visibility, not what each person sees. It's covered in Phase 6, when the Custom UI runs as real users.
- **Integrations firing:** all 7 are off until switched on in the builder (Q44). Then the activity-log and history rows can be asserted.
- **Entering data at steps** (parts, root cause, dispute answer) on Work Order and DLP Cost Recovery is blocked until the step-permission fix is applied (Q46). It's proven on Permit to Work.
- **Dispute branch** of DLP Cost Recovery: the condition compiles correctly, but it can only be exercised once Q46 is applied.
