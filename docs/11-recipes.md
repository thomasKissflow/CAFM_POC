# 11 · Recipes

Step-by-step for the things people actually ask for. Each assumes `npm run dev` is up on 5188.

---

## Add a screen

1. Create `app/src/screens/MyScreen.tsx`. Read two or three neighbours first — the house style
   is specific and it is easier to match than to describe.
2. Build it from `app/src/ui/primitives.tsx`: `PageHeader`, `Panel`, `Field`, `Input`, `Select`,
   `Button`, the chips. Do not invent new primitives casually.
3. Get data with `useQuery((s) => s.something.list())`. If the data does not exist yet, add it to
   the `Services` interface in `app/src/services/types.ts` and implement it in **both**
   `services/mock/` and `services/kissflow/`.
4. Add the route in `app/src/app/App.tsx` (lazy, like its neighbours).
5. Add the nav entry in `app/src/app/Shell.tsx`: a line in `ITEMS`, then the key in `ROLE_NAV`
   for every role that should see it.
6. Add the label to **both** `app/src/i18n/en.ts` and `ar.ts`.
7. If it needs a building, use `useSiteChoice(dir)` — never a literal site id.
8. Add it to the sweep list at the top of `app/scripts/qa-shots.mjs`.
9. `npm run typecheck`, then look at it in the browser at 1440×700, then `npm run gate`.

## Add a field to work orders

This is a change in two places that must agree.

1. **Kissflow**: add the field to the Work Order process. If it should be writable at the first
   step, check its step permissions — the builder drops the back-references and
   `data-model/fix-step-perms.mjs` repairs them.
2. **The adapter**: read it in `app/src/services/kissflow/hydrate.ts`, write it in the `create`
   or `step` call in `app/src/services/kissflow/index.ts`.
3. **The shape**: add it to `WorkOrder` in `app/src/domain/types.ts`.
4. **The generator**: give it a value in `app/src/services/mock/seed.ts`, or the demo world and
   the live world will disagree.
5. If it is a **reference** field, read the autofill warning in
   [10-gotchas.md](10-gotchas.md) before you do anything else.

## Change a business rule

Liability, SLA and priority live in `app/src/domain/`. They are pure functions with tests.

1. Change the function and its test together.
2. **Change the Kissflow formula to match**, or the records and the screens will disagree. The
   formulas are in `DATA_MODEL.md`; the constraints are in [10-gotchas.md](10-gotchas.md).
3. Add a row to `DECISIONS.md` saying what changed and why.

## Re-brand for a prospect

Admin → Branding, in the app. No code. See [07-client-demos.md](07-client-demos.md).

## Add a building

Admin → Properties, in the app. No code. Remove it afterwards with the bin icon on its row.

## Clean up test records you created

Dataform and board rows: delete them.

```js
// from data-model/, adapt the form and the match
import { kf } from "./kf-call.mjs";
const Q = "?_application_id=CAFM_POC_A00";
await kf("DELETE", `/form/2/{acc}/CAFM_Site_A00/${rowId}${Q}`);
```

Work orders and other process items **cannot be deleted** — reject them:

```bash
cd data-model
node reject-test-wos.mjs "WO-26-04856"
```

Then confirm the environment is back where it started: one building, 24 apartments, 6 assets.

## Rebuild the demo film

See [08-video.md](08-video.md). Short version, from `app/`:

```bash
node scripts/video/narrate.mjs && node scripts/video/record.mjs && node scripts/video/assemble.mjs --pad 700 --speed 1.21
```

To re-cut without re-recording, run `assemble.mjs` alone with different `--pad` / `--speed`.

## Add a language

The dictionaries are `app/src/i18n/en.ts` and `ar.ts`, same shape. A third language means a
third file, a case in `app/src/i18n/index.tsx`, and a decision about direction. Arabic is RTL
and the layout already handles it with logical properties (`ms-`, `ps-`, `start-`) — keep using
those rather than `ml-`/`pl-`/`left-`.

## Point the repo at a different Kissflow account

1. New `.env` with that account's domain, id and API key.
2. From `data-model/`, build the app into it. `app-spec.json` is the machine-readable model and
   `build_ir.py` generates it; the apply path is `apply-stage.mjs`.
3. Seed it: `node seed/seed.mjs all --minimal` then `node seed/seed-live-wos.mjs --minimal`.
4. Run the backend suite: `node tests/kf-suite.mjs`.
5. Update the component id in `redeploy-ui.mjs` to the Custom UI component in the new account.

Budget an afternoon, not an hour.

## Debug "why is this record wrong"

1. `#/kf-diag` in the app — every SDK call made, with row counts and errors.
2. **Admin → Data browser** — every Kissflow form, process and board as a read-only table. This
   is also the single best answer to "is this real?" from a prospect.
3. From `data-model/`, query the API directly with `kf-call.mjs`.
4. If a field is wrong on create rather than on read, suspect autofill
   ([10-gotchas.md](10-gotchas.md)).
