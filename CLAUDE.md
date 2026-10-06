# CAFM — a Kissflow demo for UAE construction contractors

You are working on a **prospect demo**, not a production system. It is a React + TypeScript
Custom UI running on a real Kissflow backend. Kissflow sales engineers show it to construction
and facilities-management prospects in the Gulf.

It is bilingual (English / Arabic with full RTL), has desktop screens for executives and
operations and phone screens for technicians and residents, and includes a live AI voice agent
that takes a maintenance call and raises the work order from it.

**New here? Read [`docs/README.md`](docs/README.md) first.** It is a map of the whole
documentation set and tells you which file answers which question.

---

## The one thing that makes this demo land

A UAE contractor hands a finished building over to its owner and then carries a **defects
liability period** — typically 12 months — during which every fault that is their own defect
is theirs to fix, at their cost. Faults caused by use or wear are chargeable to the owner.
Getting that call right, with evidence, is worth real money, and most contractors are tracking
it in WhatsApp and spreadsheets.

So every screen answers one question: **whose cost is this?** If a change you make blurs that,
it is the wrong change. See [`docs/01-orientation.md`](docs/01-orientation.md).

---

## Hard rules

**Secrets.** `.env` at the repo root holds the Kissflow API key and the Gemini key. Never read,
print, log, echo or paste its values, never hardcode them, never prefix anything `VITE_`
(that would bundle it into the frontend), and never commit `.env`. If `.env` is missing, say so
and stop — do not invent a placeholder. `data-model/backups/` is gitignored because one file in
it contains the Gemini key.

**This is someone's live demo environment.** The Kissflow app `CAFM_POC_A00` is shared. Before
you write to it, read [`docs/04-kissflow.md`](docs/04-kissflow.md). Never run
`data-model/wipe-data.mjs` unless you are explicitly asked to. If you create test records while
checking something, delete them afterwards — the recipe is in
[`docs/11-recipes.md`](docs/11-recipes.md).

**Never claim something works until you have run it.** The gate (`npm run gate` in `app/`) is
ten checks over the real app in a real browser. Run it before you say a change is done.

**Demo data is fictional and must stay obviously fictional.** Buildings, people, companies and
figures are invented. Never present an invented number as a market statistic. Domain facts in
`DOMAIN_GUIDE.md` are sourced and labelled; keep that discipline.

---

## Commands

All of these run from `app/` unless stated.

```bash
npm --prefix app install        # first time only
npm --prefix app run dev        # dev server on http://localhost:5188
```

| What | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | Port 5188. With `.env` present it reads **live Kissflow**; add `?data=mock` to the URL for offline demo data |
| Type check | `npm run typecheck` | |
| Unit tests | `npm test` | Vitest, ~15 s |
| **Full gate** | `npm run gate` | 10 checks, ~7 min, needs the dev server running |
| Backend suite | `node tests/kf-suite.mjs` | run from `data-model/`, hits live Kissflow |
| Build + deploy | `npm run zip` then `cd ../data-model && node redeploy-ui.mjs ../app/cafm-poc.zip` | publishes into the existing Kissflow component |

## URL flags

Append to `http://localhost:5188/`, before the `#`:

- `?data=mock` — offline demo data, no Kissflow. `?data=kissflow` forces live.
- `?brand=generic` — strips the client name everywhere. The demo film records with this.
- `?ai=browser` / `?ai=backend` — where the Gemini key comes from.

Persona and language live in `localStorage`: `cafm.role`, `cafm.lang`. Changing the role needs
a page reload to take effect.

---

## Layout

```
CLAUDE.md          you are here
docs/              the guides — start at docs/README.md
app/               the React Custom UI (src/), its dev server and scripts
  src/screens/     one file per screen
  src/services/    the data layer: mock/ (generator) and kissflow/ (adapter)
  src/domain/      the rules — liability, SLA, time. Pure, tested, no UI
  scripts/         e2e tests, the gate, the screenshot sweep, the video pipeline
  server/          the AI backend, for Cloud Run later; also the dev proxy
data-model/        scripts that build, seed, check and fix the Kissflow app
*.md               the working record — see docs/12-reference-docs.md
```

## House style

Match the code already here. Comments explain **why**, never what; the codebase has very few
and they earn their place. No emoji in code, UI or commit messages. Prose in the UI is plain
and specific — read a few screens before writing new copy. Every string that reaches a user
needs its Arabic counterpart.
