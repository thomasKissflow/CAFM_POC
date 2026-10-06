# 09 · Testing and deploying

## The checks that exist

| Check | Where | Command | Takes | Touches Kissflow |
|---|---|---|---|---|
| Type check | `app/` | `npm run typecheck` | 2 s | no |
| Unit tests | `app/` | `npm test` | 15 s | no |
| **The gate** | `app/` | `npm run gate` | ~7 min | no (runs on demo data) |
| Backend suite | `data-model/` | `node tests/kf-suite.mjs` | 2 min | reads |
| Backend suite + scenarios | `data-model/` | `node tests/kf-suite.mjs --scenarios` | 5 min | **writes `[TEST]` items** |
| Adapter contract | `app/` | `npx vite-node scripts/kf/adapter-check.ts` | 1 min | reads; `--write` also raises one labelled job |
| Screenshot sweep | `app/` | `node scripts/qa-shots.mjs <dir>` | 2 min | no |
| Storyline on live data | `app/` | `DATA=live node scripts/e2e-story.mjs http://localhost:5188 en dlp` | 1 min | **writes** |

## The gate is the one that matters

`npm run gate` is ten checks in sequence, and it is what you run before claiming a change
works. It needs `npm run dev` already running on 5188 in another terminal — it will not start
one for you.

1. type check
2. unit tests
3–6. the full storyline, English and Arabic, DLP and chargeable outcomes — raise, triage,
dispatch, technician, close, back-charge
7. the guided demo, all 14 beats
8–9. a voice call, English and Arabic
10. every screen × role × language × desktop and phone, collecting console errors and checking
for horizontal overflow

It prints a tick per step and `all 10 passed` at the end. Anything less is a failure; read the
step's output.

Steps 3–10 drive a real Chromium through Playwright. If you have not installed it:
`npx playwright install chromium`.

## Writing tests

Unit tests sit next to what they test (`liability.ts` → `engines.test.ts`, `brand/color.ts` →
`color.test.ts`). They are Vitest and they cover the **rules**, not the rendering.

Two habits worth keeping:

- **Test the rule, not today's answer.** The summer-rule test asks `isSummer(date)` and expects
  the priority the rule implies, instead of hardcoding P2 — so it is honest in every season.
- **Make a screen testable by giving it a stable hook**, not by exporting internals. The e2e
  scripts find things by visible text and role, in both languages.

## Deploying

The frontend is a zip uploaded into an existing Kissflow Custom UI component.

```bash
cd app && npm run zip
cd ../data-model && node redeploy-ui.mjs ../app/cafm-poc.zip
```

`redeploy-ui.mjs` deliberately **never creates or deletes** a component. It finds the existing
one (`CCEEnppREPBs`), refuses if it is missing, uploads the bytes, triggers processing, polls,
and publishes. You should see `publish 200`.

After deploying, open the app inside Kissflow and check the header chip says **Live · Kissflow**
without `(local)`.

### If a deploy goes wrong

If the trigger returns `423` the upload is still in progress and the published version can come
out blank. Wait two minutes and redeploy once, cleanly. Do not hammer it.

## Keeping the record

Two files are the project's memory and are worth more than any amount of code comments:

- **`DECISIONS.md`** — one row per decision, with the reason and who agreed it. Add a row when
  you decide something a future reader would otherwise have to reverse-engineer from the diff.
- **`OPEN_QUESTIONS.md`** — one row per thing that is genuinely undecided, with whose call it
  is. Add a row rather than guessing on someone's behalf.

`TESTING.md` records what was checked and what the result was, dated. Add to it after a
significant run rather than rewriting it.
