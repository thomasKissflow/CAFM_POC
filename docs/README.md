# Documentation map

Written for a Claude session that has just been handed this repository, and for the human
sitting next to it. Each file below is self-contained; read the ones your task needs.

If you only read two things: [`01-orientation.md`](01-orientation.md) so you understand what
the demo is arguing, and [`10-gotchas.md`](10-gotchas.md) so you do not lose a day to a trap
someone has already hit.

## Read in this order the first time

| | File | Answers |
|---|---|---|
| 01 | [orientation.md](01-orientation.md) | What is this, who is it for, what is it arguing, who is in it |
| 02 | [setup.md](02-setup.md) | Getting it running on your machine, and what to do when it will not |
| 03 | [architecture.md](03-architecture.md) | How the code is put together and where to make a change |

## Reach for these when the task needs them

| | File | Answers |
|---|---|---|
| 04 | [kissflow.md](04-kissflow.md) | The Kissflow app behind it: flows, the API, the adapter, writing safely |
| 05 | [demo-data.md](05-demo-data.md) | The demo world, how it is generated and seeded, and why dates move |
| 06 | [ai-and-voice.md](06-ai-and-voice.md) | The Gemini voice agent, summaries, insights, and where the key lives |
| 07 | [client-demos.md](07-client-demos.md) | Re-branding for a prospect and adding their buildings |
| 08 | [video.md](08-video.md) | Rebuilding or editing the demo film |
| 09 | [testing-and-deploy.md](09-testing-and-deploy.md) | Every check that exists, and how to publish |
| 10 | [gotchas.md](10-gotchas.md) | **The traps.** Kissflow quirks, browser quirks, things that look fine and are not |
| 11 | [recipes.md](11-recipes.md) | Step-by-step for the changes people actually ask for |
| 12 | [reference-docs.md](12-reference-docs.md) | The working documents at the repo root: what each is, and whether it is still true |

## Conventions these docs follow

- Paths are from the repository root. `app/src/...` means exactly that.
- Commands say which directory to run them in.
- Anything described as **live** touches the shared Kissflow account and is not a dry run.
- Where a document records a decision, it cites `DECISIONS.md` as `D12`, and an unresolved
  question in `OPEN_QUESTIONS.md` as `Q34`. Those two files are the project's memory — when you
  make a decision that a future reader would otherwise have to reverse-engineer, add a row.
