# 02 · Setup

## What you need

- **Node 22** or newer (`node -v`). The repo was built on 22.12.
- **npm 10** or newer.
- A **`.env`** at the repository root. Copy `.env.example` and fill it in.
- Optionally **Playwright browsers**, for the end-to-end tests and the video pipeline:
  `npx playwright install chromium` from `app/`.

## First run

```bash
npm --prefix app install
npm --prefix app run dev
```

Open <http://localhost:5188>. You should land on the command centre as Hamdan Al Falasi, with
a green **Live · Kissflow (local)** chip in the header.

If you do not have Kissflow keys yet, the app still runs — open
<http://localhost:5188/?data=mock> and everything works against a generated demo world. You
can build and review screens entirely this way. You only need real keys to write records, run
the backend suite, or deploy.

## The `.env`

It lives at the **repository root**, not in `app/`. `app/vite.config.ts` loads it from the
parent directory and copies the values into the dev server's own process, so they stay
server-side.

| Key | Needed for |
|---|---|
| `KF_DOMAIN`, `KF_ACCOUNT_ID` | Which Kissflow account to talk to |
| `KF_ACCESS_KEY_ID`, `KF_ACCESS_KEY_SECRET` | Everything that reads or writes Kissflow |
| `GEMINI_API_KEY` | Live voice, call summaries, insights, video narration |
| `ANTHROPIC_API_KEY` | Optional. The dev-only scripted voice brain |

**Never prefix any of these `VITE_`.** Vite inlines `VITE_*` into the browser bundle, which
would publish the key to anyone who opens the app. Nothing in this repo does that and nothing
should start.

### Getting Kissflow keys

Ask Thomas for access to the existing demo account, or point the repo at your own: create a
Kissflow account, then from `data-model/` build the app into it (see
[04-kissflow.md](04-kissflow.md)) and seed it. Standing up a fresh account is an afternoon,
not five minutes.

API keys come from Kissflow under Settings → Integrations → API keys. The key needs admin
rights on the app `CAFM_POC_A00`.

## How the app decides where its data comes from

In order:

1. `?data=mock` in the URL → the generated demo world, no network. `?data=kissflow` forces live.
2. Running **inside Kissflow** as a Custom UI → the Kissflow JavaScript SDK, as the signed-in
   user.
3. Running on **localhost with a dev proxy** → `/api/kf`, which the Vite dev server implements
   using the `.env` key. This is why local development can read and write the real app without
   the key ever reaching the browser.
4. Nothing available → it falls back to demo data and says so in the header chip.

`app/src/services/source.tsx` is where this is decided; `#/kf-diag` in the app shows what
happened, call by call, which is the fastest way to diagnose a bad connection.

## When it will not start

**Port 5188 already in use.** Something else is running — probably a dev server you forgot.
`lsof -ti:5188 | xargs kill` or just use the one that is already up.

**Header says "Demo data" when you expected live.** Open `#/kf-diag`. Usual causes: no `.env`,
a typo in the key, or the key lacking rights on the app. The page shows the failing call and
the error Kissflow returned.

**Everything is in Arabic.** `localStorage` remembered it. Click the العربية / English button,
or run `localStorage.setItem("cafm.lang", "en")` in the console and reload.

**You are stuck as the wrong person.** Role lives in `localStorage` under `cafm.role` and only
takes effect on a page load — the avatar menu handles this for you, but if you set it in the
console you must reload.

**`npm run gate` says the dev server is not reachable.** It needs `npm run dev` running in
another terminal. It will not start one for you.

## Editor and agent setup

`.claude/launch.json` already defines the dev server, so a Claude session can start and drive
it in a browser pane without being told how.

There is no linter configured beyond TypeScript. `npm run typecheck` is the fast feedback loop;
`npm test` takes about fifteen seconds and covers the domain rules.
