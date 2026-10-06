# 10 · Gotchas

Everything here cost someone a day. Read it before you touch the thing it describes.

---

## Kissflow: reference fields and autofill

**The worst one.** A lookup field whose AutoFill targets a field that is hidden at the current
step is **silently dropped on create**, and Kissflow stores the lookup's **first row** instead.
No error. Updating the same field afterwards returns `PermissionDeniedToUpdate`.

It bit three times:

- Every new work order came back as "AC not cooling" on the first asset (Category, Asset).
- Then, months later, **every work order was being stored against the first building** — which
  was invisible for as long as there was only one building, because the first row *was* the
  right answer.

Fix: turn AutoFill off on the reference field and have the app write the copy fields itself.
`data-model/fix-create-fields.mjs` does this for Site, Unit, Category and Asset.

**The lesson that generalises:** audit *every* reference field on a flow for AutoFill, not just
the one that broke. A single-row lookup hides the bug completely. If you add a reference field,
check it.

## Kissflow: formulas return null rather than erroring

The engine stamps every expression node with the formula's output type, so mixed-type formulas
fail silently. Verified against a live sandbox:

**Work:** `=`, two-argument `AND`/`OR`, `IF`, `ABS`, `+ - *`, `MONTH`/`YEAR`/`DAY`, `TODAY()`,
`DATEDIFF` on two Date operands (absolute days, no sign).

**Return null:** `>=`, `<=`, `>`, four-argument `OR`, `NOT`, `ISBLANK`, `DATEDIFF` with a
DateTime operand, date string literals, `CONCATENATE`/`TOTEXT` of a number, and **any** Currency
formula (currency values are text like `"3.5 AED"`).

Also:

- A Text formula cannot read a Number field. Keep decisions as **numeric codes** in Number
  fields and map them in the app — that is why `Priority_Code` and `Liability_Code` exist.
- Date ordering without `>=`: use a key of `YEAR*372 + MONTH*31 + DAY`, and
  `IF(ABS(gap) = gap, 1, 0)` for "is it covered".
- Roughly three evaluation passes. A formula chain deeper than three reads stale values —
  **flatten to depth ≤ 3**.
- Date functions evaluate in UTC, so 21:30 Z counts as that UTC day, not the Gulf day.

## Kissflow: the REST API

- **Process items cannot be deleted** with an API key. Reject them instead. And reject the
  activity instance the item is on **now** — `_current_context[0]._context_activity_instance_id`
  — not the one the list hands you, which can be stale.
- Dataform and board rows delete cleanly: `DELETE /form/2/{account}/{form}/{rowId}`.
- DateTime rejects milliseconds. Strip them: `.replace(/\.\d{3}Z$/, "Z")`.
- Dataform create is `POST /form/2/{account}/{id}/batch` with rows carrying `_is_created: true`;
  read is `POST .../allitems/list`.
- List endpoints default to **10 rows**. Always pass `page_size`. The engine's own role lookup
  reads only page 1, which once created a duplicate role on re-apply.
- Parallel member grants return `423` (locked). Issue them sequentially.
- Rate limiting shows up as `429`. Back off.
- The published process draft **is** writable and republishable on this account, despite older
  notes saying otherwise.

## Kissflow: the Custom UI SDK

- `getItems` on a dataform returns full rows; on a **board** it returns only card metadata for
  the Kanban view — no custom fields. Read boards over `kf.api('/case/2/{account}/{board}/list')`
  instead.
- `getAdminItems` on a process returns items in **every** status; filter yourself.
- `getParticipatedItems` errors for an admin user.
- The dataform handle has **no delete**. Go through `kf.api` with `method: "DELETE"`.
- `kf.api()` hands its arguments to the host's fetch, so a JSON body must be a **string** with a
  `Content-Type` header. An object body is silently ignored.
- The Custom UI host sets no CSP: `fetch` and WebSocket to Google's endpoints work, and the
  iframe allows the microphone.

## Browser and layout

- **A hash change does not reload the page.** Anything read once at start-up — the persona, for
  instance — needs an explicit `location.reload()`. This caught the video recorder.
- **`h-full` inside a scroll container clamps the content** and the pane stops scrolling; the
  overflow spills out of the bottom instead. Use `min-h-full`. This is why the sidebar's footer
  used to disappear on a laptop screen.
- A floating menu with no `max-height` becomes unreachable on a short screen. Cap it with
  `--radix-dropdown-menu-content-available-height` and let it scroll.
- Test at **1440×700 and 1280×560**, not just a big monitor. A 13-inch laptop at 100 % zoom is
  what people actually demo on.
- `form_input`-style programmatic value setting does not always fire React's `onChange` for
  number inputs. Click, select all, type — or set the value through the prototype descriptor and
  dispatch the event.

## This app

- **Never pin a screen to one building.** Use `useSiteChoice(dir)` from
  `app/src/app/lookups.ts`. A whole afternoon went on unpinning screens that had quietly
  hardcoded the demo's single building.
- **Never hardcode a month list or a date.** Derive with `monthKeysEndingAt` and the handover
  date. Hardcoded months are why a chart was once empty and a report opened on a stale month.
- **Never hardcode the accent colour.** It is swapped at runtime by branding. Use the `fluoro`
  tokens — and never use them for liability, which has its own.
- **An asset's class comes from Kissflow.** An asset the generator does not know about used to
  be read as a fan coil whatever it actually was.
- The DLP end date convention is **the last second still covered**
  (`toGst(ms(addMonths(...)) - 1000)`), so a job raised on the final day is still the
  contractor's. Match it if you compute a period end anywhere new.

## Secrets

- `.env` is at the **repository root**, not in `app/`. Never `VITE_`-prefix anything in it.
- `data-model/backups/` is gitignored because one dump contains the Gemini key.
- Avoid shell commands that print whole config rows. A command that listed the settings
  dataform once echoed the Gemini key into a terminal.
