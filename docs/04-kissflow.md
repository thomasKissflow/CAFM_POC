# 04 · The Kissflow backend

The app is **CAFM - POC**, id `CAFM_POC_A00`, on `development-r1100.kissflow.com`. Eighteen
flows: three processes, two boards, thirteen dataforms.

[`BACKEND_CATALOG.md`](../BACKEND_CATALOG.md) at the root lists every one of them with what it
is for and why it is that kind of flow. [`DATA_MODEL.md`](../DATA_MODEL.md) has the field-level
design and the formulas. Read the catalogue before you change anything in Kissflow.

## The flows that matter most

- **Work Order** (process) — every maintenance request, from reported to closed. Its formulas
  compute priority and liability as numeric codes, which the app reads back.
- **DLP Cost Recovery** (process) — charging a subcontractor for a defect that was theirs.
- **Buildings & Facilities**, **Apartments**, **Asset Register** (dataforms) — the estate. The
  liability decision starts at the asset: who installed it, when it was handed over, how long
  its DLP and warranty run.
- **Handover Snags**, **Plant Breakdowns** (boards) — cards moved between statuses.
- **Work Order History** (dataform) — one row per closed job, which is what the dashboards and
  the client report read.

## Talking to it

Two different clients, same shapes:

- **In the browser**, `app/src/services/kissflow/sdk.ts` wraps the Kissflow JavaScript SDK.
  Inside Kissflow it is the real SDK, as the signed-in user. On localhost it is
  `restKf.ts` talking to the dev proxy, which holds the API key server-side.
- **In Node**, `data-model/kf-call.mjs` is a thin signed-request helper used by every script
  in that folder.

Both end up at the same REST endpoints. The shapes are recorded in
[10-gotchas.md](10-gotchas.md) — they are not all guessable.

## The scripts in `data-model/`

Run them from inside `data-model/`. Everything hits the **live shared account**.

| Script | What it does | Safe? |
|---|---|---|
| `backup-all.mjs` | Dumps every flow's rows to `backups/<timestamp>/` | Yes, read-only |
| `seed/seed.mjs all --minimal` | Seeds the small demo world | Writes; idempotent, matches on natural keys |
| `seed/seed-live-wos.mjs --minimal` | Creates the open work orders | Writes; idempotent |
| `tests/kf-suite.mjs` | The backend suite: structure, access, permissions, formulas | Read-only unless you pass `--scenarios` |
| `tests/kf-suite.mjs --scenarios` | The above plus `[TEST]` items driven through every route | Writes test records |
| `redeploy-ui.mjs ../app/cafm-poc.zip` | Publishes a new frontend build into the existing component | Writes; replaces the live UI |
| `put-gemini-key.mjs` | Copies `GEMINI_API_KEY` from `.env` into Kissflow | Writes |
| `fix-create-fields.mjs --publish` | Turns lookup autofill off on the Work Order's reference fields | Changes the process definition |
| `fix-step-perms.mjs <flow> --publish` | Repairs field permissions the builder drops | Changes the flow definition |
| `reject-test-wos.mjs "WO-26-04856"` | Rejects work orders you raised while testing | Writes |
| **`wipe-data.mjs --yes`** | **Deletes every record.** Back up first | **Destructive. Do not run unless asked** |

## Writing to Kissflow safely

The account is shared and someone may be mid-demo. Before you write:

1. **Back up** if the change is structural: `node backup-all.mjs`.
2. **Prefer a test record over editing a real one.** Title it so it is obvious — the convention
   is a `[TEST]` prefix.
3. **Clean up afterwards.** Dataform and board rows delete cleanly:
   `DELETE /form/2/{account}/{form}/{rowId}`. **Process items cannot be deleted** with this API
   key — reject them instead, which drops them out of the app's views.
   `reject-test-wos.mjs` does this correctly, including the awkward part (you have to reject the
   activity instance the item is on *now*, not the one the list hands you).
4. **Say what you did.** Add a row to `DECISIONS.md` for anything a future reader would
   otherwise have to reverse-engineer.

## Changing the data model

A process or dataform definition is a JSON "draft" you fetch, edit and republish:

```
GET  /metadata/2/{account}/process/{id}/draft
PUT  /metadata/2/{account}/process/{id}/draft
POST /metadata/2/{account}/process/{id}/publish
```

A published draft **is** writable and republishable on this account. `fix-create-fields.mjs` is
a good worked example: it backs the draft up to `kf-live/` first, makes a narrow change, and
only publishes when you pass `--publish`.

Follow that pattern. Do not hand-edit a draft blob without backing it up.

## Formulas

Kissflow's formula engine has real limits, and the app depends on getting the same answers as
the screens. Before you write or change one, read the runtime findings in
[10-gotchas.md](10-gotchas.md) — several obvious things (`>=`, `NOT`, currency arithmetic,
chains deeper than three) silently return null rather than erroring.

The rule of thumb that came out of that: keep decisions as **numeric codes** computed in Number
fields, and let the app map codes to meaning. `Priority_Code` and `Liability_Code` work that way.
