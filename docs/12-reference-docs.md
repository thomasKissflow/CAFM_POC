# 12 · The working documents at the root

The `.md` files at the repository root were written as the project was built, phase by phase.
They are the detailed record; `docs/` is the orientation. This page tells you which are still
authoritative and which are history, so you do not act on a stale line.

## Current — trust these

| File | What it is |
|---|---|
| **`DECISIONS.md`** | Every decision, numbered `D1`… with the reason and who agreed it. 88 rows. **The single most useful file in the repository.** Append to it; do not rewrite it |
| **`OPEN_QUESTIONS.md`** | Everything genuinely undecided, numbered `Q1`…, with whose call it is. Check before deciding something on someone's behalf |
| **`BACKEND_CATALOG.md`** | Every Kissflow flow, what it is for, why it is that kind of flow. Current |
| **`TESTING.md`** | What has been checked and what the result was, dated. Append after a significant run |
| **`PRODUCTION_TODO.md`** | What the POC does, why it is not production-safe, and what to do instead. Current and worth reading before promising anything to a prospect |
| **`HAPPY_FLOWS.md`** | The demo flows, click by click. Current — six flows |
| **`DOMAIN_GUIDE.md`** | The regional background: defects liability, Civil Defence, Hassantuk, the market. Sourced and labelled. Verify before putting a legal point on a slide |
| **`WHY_CAFM.md`** | The pitch in plain words, with claims labelled FACT / DEMO / ASSUMPTION. Current |
| **`VIDEO_SCRIPT.md`** | The narration, beat by beat. Matches the shipped film |
| **`DESIGN.md`** | The visual language — survey and setting-out. Still the design brief |
| **`PRODUCT.md`** | Short product context for design tooling |

## Mostly current, with stale headers

| File | Caution |
|---|---|
| **`DATA_MODEL.md`** | The field-level design and the formulas. Its header still says *"proposal, nothing built"* — that was true when written and is not now; the model is live. The content is accurate, the status line is not |
| **`PLAN.md`** | The original seven-phase plan, written before any code. Useful for understanding **why** things are the way they are. Do not treat its schedule or open items as current — they were resolved in `DECISIONS.md` |

## How to use them

Read `DECISIONS.md` when you are about to change something and want to know whether it was
deliberate. Search it for the feature name; most surprises in this codebase are deliberate and
have a row explaining why.

Read `OPEN_QUESTIONS.md` before you resolve an ambiguity. If the question is already there with
an owner, raise it rather than answering it yourself.

Both files are append-only in practice. A row's status changes (`Open` → `Agreed`,
`Superseded`), but rows are not deleted — the history is the point.
