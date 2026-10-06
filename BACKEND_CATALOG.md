# CAFM backend in Kissflow: what's built and why

App **CAFM - POC** (`CAFM_POC_A00`) on development-r1100. Built 22 Sep 2026 (Phase 4). Every flow below is live.

**How to read this.** The flows were **renamed on 22 Sep** to the plain names in the second column; that's what you'll see in Kissflow now. The first column is the original name, which lives on in the IDs (`CAFM_Work_Order_A00` …) and the model files. Lists keep the `CAFM` prefix. The Custom UI never shows these names, but the Kissflow builder, reports and notifications do.

## At a glance

The one thing the whole backend does: **a request comes in → it's triaged → liability decides who fixes it → it's fixed → if a subcontractor was liable, the cost is recovered.** Everything else is reference data that makes that decision automatic, or history that makes it reportable.

| # | Original name (ID) | Name in Kissflow now | Kind | What it's for, in one line |
|---|---|---|---|---|
| 1 | CAFM Work Order | **Work Order** | Process | Every maintenance request, from report to closed job. The heart of the app. |
| 2 | CAFM Back-charge | **DLP Cost Recovery** | Process | Charges a subcontractor for fixing a defect they're liable for (inside the defects liability period). |
| 3 | CAFM Permit To Work | **Permit to Work** | Process | HSE sign-off before risky work (hot work, heights, isolation, confined space). |
| 4 | CAFM Snag | **Handover Snags** | Board | Defects found at handover, moved card by card until closed or carried into DLP. |
| 5 | CAFM Breakdown | **Plant Breakdowns** | Board | Cranes and plant that break down, tracked until back in service. |
| 6 | CAFM Site | **Buildings & Facilities** | Dataform | Every building or own facility, with its handover (TOC) and DLP end dates. |
| 7 | CAFM Unit | **Apartments** | Dataform | Units inside a building, with the resident. |
| 8 | CAFM Asset | **Asset Register** | Dataform | Every maintainable thing (AC unit, lift, pump) with installer, batch, DLP and warranty dates. The liability decision starts here. |
| 9 | CAFM Asset Class | **Asset Types** | Dataform | Types of asset (fan coil unit, lift…) with default warranty months and a PPM checklist. |
| 10 | CAFM Request Category | **Request Types** | Dataform | What residents report (AC not cooling, water leak…) with base priority and the summer-AC rule. |
| 11 | CAFM Root Cause | **Fault Causes** | Dataform | Why it failed. Some causes (like occupant misuse) exclude DLP, so the owner pays. |
| 12 | CAFM Subcontractor | **Subcontractors** | Dataform | Installing subcontractors, licences, insurance, Civil Defence approval, technicians. |
| 13 | CAFM SLA Policy | **SLA Targets** | Dataform | Response/fix times per priority (P1 30 min/4 h … P4 1 day/10 days), for reference and reports. |
| 14 | CAFM PPM Schedule | **Planned Maintenance** | Dataform | Recurring maintenance per asset type and site. It will generate work orders. |
| 15 | CAFM Compliance Certificate | **Compliance Certificates** | Dataform | Civil Defence / Hassantuk / lift / fire certificates with expiry countdown. |
| 16 | CAFM Equipment | **Plant & Fleet** | Dataform | Dutco's cranes, excavators and trucks: hour meter, service due, TPI expiry. |
| 17 | CAFM WO Event | **Work Order Activity Log** | Dataform | One row per thing that happened to a work order (created, step changed, SLA breach…). Filled automatically. |
| 18 | CAFM WO Register | **Work Order History** | Dataform | One row per closed work order, for dashboards and 6-month history. Filled automatically on close. |
| – | CAFM zz Formula Sandbox (1 and 2) | *(test only)* | Dataform | Throwaway forms used to prove the formulas before publishing. **Delete when you're happy (Q40).** |

Why Process vs Board vs Dataform:

- **Process** = fixed steps, a person at each step, conditions, deadlines. This fits work orders, cost recovery and permits.
- **Board** = cards moved freely between statuses. Snag lists and breakdowns work like that.
- **Dataform** = a table of records with no workflow. Masters (sites, assets) and logs work like that.

Child tables (lists inside a record), 8 in total:

| Parent | Child table | Holds |
|---|---|---|
| Work Order | WO Checklist, WO Photos, WO Parts | Technician's checklist, before/after photos, parts used (Qty × Unit Cost AED = Line Total AED; total goes to Parts AED) |
| Permit to Work | Permit Controls | Isolation / fire-watch controls ticked off |
| Site | Handover Pack | Handover documents per building |
| Subcontractor | Subcontractor Technicians | Their technicians |
| Asset Class | Checklist Template | Default checklist copied into PPM work orders |

Lists: 16, all `CAFM …` (Priority, Channel, Trade, Liability, Event Type…). Roles: 10 (Executive, FM Manager, Helpdesk, DLP Manager, Subcontractor Supervisor, Technician, Resident, Compliance Officer, HSE Officer, Plant Manager).

---

## 1. Work Order (process)

**Used by:** residents (raise), Helpdesk (triage), Subcontractor Supervisor / FM Manager / DLP Manager (dispatch), Technician (fix), Helpdesk (verify).

| Step | Who | Runs when | What happens |
|---|---|---|---|
| Request raised | Initiator (Resident / Helpdesk / QR) | always | What, where, when first reported. |
| Triage | Helpdesk | always | Confirms category and asset. The formulas decide priority, liability and route. |
| Subcontractor dispatch | Subcontractor Supervisor | `Dispatch_Code = 1` (DLP or warranty) | The installer sends a technician, at no cost to the owner. |
| FM dispatch | FM Manager | `Dispatch_Code = 2` (chargeable or own operations) | The in-house FM team dispatches. |
| Engineering review | DLP Manager | `Dispatch_Code = 3` (possible structural defect) | Decennial-liability review before any work. |
| Work in progress | Technician | always | Root cause, parts, labour, close-out note, signature. |
| Verify and close | Helpdesk | always | Checks the fix with the resident. |
| Closed | – | – | End. |

**The decision (all computed, nobody types it):**
- **Priority Code** 1–4 = P1–P4 from the request type. AC faults move from P3 to P2 in June–September (summer rule).
- **Response / Resolve Minutes** come from the priority: P1 30/240 · P2 60/480 · P3 240/4320 · P4 1440/14400.
- **Liability Code:** 5 Own operations → 3 Structural (decennial review) → 2 Chargeable if the fault cause is excluded → 1 **DLP** if first contact ≤ DLP end → 4 **Warranty** if ≤ warranty end → otherwise 2 Chargeable.
- **Dispatch Code:** 1 subcontractor (DLP/warranty) · 2 FM (chargeable/own ops) · 3 engineering (structural).
- These are numbers rather than words because Kissflow text formulas can't read numbers (DATA_MODEL §16). The Custom UI turns 1 into "DLP", and so on.

**Tested live (22 Sep):**

| Test | Scenario | Result |
|---|---|---|
| W1 | Summer AC inside DLP (Qamar) | ✓ P2 · 60 min · DLP → Subcontractor dispatch → … → **Closed** |
| W2 | Lift at Jaddaf Point, outside DLP, inside warranty | ✓ Warranty → Subcontractor dispatch (Subcontractor Supervisor) |
| W3 | AC at Jaddaf Point, outside DLP and warranty | ✓ Chargeable → FM dispatch → … → **Closed** |
| W4 | Site office AC (Dutco's own operations) | ✓ Own ops → FM dispatch (FM Manager) |
| W5 | Crack in podium slab | ✓ Structural → **Engineering review** (DLP Manager) → Work in progress → Verify |
| W6 | AC damaged by occupant (excluded cause) | ✓ Chargeable → FM dispatch |
| W7 | AC in January | ✓ No summer uplift: P3 · 240 min · DLP → Subcontractor dispatch → **Closed** |
| W8 | Water leak via voice agent | ✓ P1 · 30 min · DLP → Subcontractor dispatch |
| W9 | Duplicate report | ✓ **Rejected** at Triage |
| W10 | Debug probe | ✓ **Rejected** at Triage |

## 2. DLP Cost Recovery / Back-charge (process)

**Used by:** DLP Manager (raise, review, confirm), Subcontractor Supervisor (accept or dispute).

| Step | Who | Runs when |
|---|---|---|
| Back-charge raised | DLP Manager | always. Parts + Labour = **Total AED** (computed) |
| Subcontractor response | Subcontractor Supervisor | always: Accept or Dispute |
| Dispute review | DLP Manager | `Subcontractor_Response = "Dispute"` |
| Recovery confirmation | DLP Manager | always: Agreed AED, Recovered On |
| Recovered | – | end |

**Tested:**
- ✓ B1 accepted: Total AED 800 computed; skipped Dispute review; **Recovered**.
- ✓ B3 (a warranty job wrongly back-charged) **rejected** at raise.
- ⚠ The dispute branch **could not be exercised over the API**. Kissflow refuses field edits at user steps for the API key (see Q42), so "Dispute" could never be saved. B2 and B4 were rejected as bad test data. The condition compiles correctly; it needs one check by a real user in Kissflow.

## 3. Permit to Work (process)

Permit requested (Technician) → HSE approval (HSE Officer) → Work active (Technician) → HSE close-out (HSE Officer) → Permit closed.

**Tested:**
- ✓ P1 hot work, full path → **Closed**.
- ✓ P2 confined space **rejected** at HSE approval (no gas test).

## 4. Handover Snags (board)

Open → In progress → Ready for inspection → Closed, or → **Carried into DLP** (unfinished at handover, becomes a DLP item). The engine also added "Reopened".

**Tested:** ✓ S1 moved to Closed · ✓ S2 moved to Carried into DLP.

## 5. Plant Breakdowns (board)

Reported → Diagnosing → Awaiting parts → Under repair → Back in service (+ Reopened).

**Tested:** ✓ BD1 crane CR-014 moved through all five statuses.

**Board quirk:** both boards got the item prefix `CAF`, so both show `CAF-0001`. Proposed: `SNG` and `BRK` (Q43).

---

## Integrations (automations)

All 7 are **created, field-mapped and published, but OFF**. Kissflow only lets the builder switch integrations on; the API key gets 403. They are one trigger → one action each.

| # | Trigger | Action | Status / what you need to do |
|---|---|---|---|
| A1 | Work Order created | Add "Created" row to the Activity Log | Ready: switch on |
| A2 | Work Order moves to the next step | Add "Step changed" row (with the step name) | Ready: switch on |
| A3a | Work Order misses its deadline | Add "SLA breach" row | Ready: switch on (fires once step SLAs are set, §14) |
| A3b | Work Order misses its deadline | Email the FM manager | **Set To / Subject / Body in the builder**, then switch on |
| A4 | Work Order completes | Create a Back-charge for the installing subcontractor | **Add a condition first: Liability Code = 1 (DLP)**. Without it, every closed job would raise a back-charge. Kissflow's "Control → execute first matching path" step does this; I couldn't build it over the API. |
| A5 | Work Order completes | Add a row to Work Order History | Ready: switch on |
| A6 | Back-charge completes | Add "Back-charge recovered" row | Ready: switch on |

Not built (need a multi-step integration the engine can't author; about 10 minutes each in the builder, steps in DATA_MODEL §9):

- **Monthly planned maintenance:** Scheduler → fetch PPM schedules → create work orders in bulk.
- **Daily certificate expiry alert:** Scheduler → fetch certificates expiring in 30 days → in-app notification.

Changed from the original plan: A1/A2/A5 **add log rows** rather than update one Register row per work order. Updating a row would need a search step to find it first. The History row is now written once, on close.

---

## Which form is the public (QR) form?

**The Work Order process's own public form.** A QR poster in a lobby or on an asset links to it. Anyone can report without logging in. The item starts at *Request raised* with Channel = "QR poster" and then follows exactly the same triage and routing as every other request.

- Turned on in the builder: Work Order → Settings → Public form (not on yet; checked live).
- Only the **Request** section should be visible on it (Site, Unit, Category, Asset, title, description, photos). The Liability/Triage sections are hidden at *Request raised* already.
- One caveat to check when it's switched on: the public form is a native Kissflow form, so the asset/category **autofill may work there** (it doesn't through the API). If it doesn't, Helpdesk fills the copy fields at Triage.
- Alternative if you want tighter control (spam, fewer fields): a separate small "Public request" dataform, plus an integration that creates the Work Order. I recommend the Work Order public form for the POC because it's one less moving part.

## Resident portal

**Now:** residents are the **Resident app role** inside the app. The Custom UI's resident view (My requests, **Talk** voice agent, New request) is what they'll use. Kissflow already lets the Resident role raise work orders.

**Later, optional Phase 8:** a real Kissflow **Portal** for residents (and possibly subcontractors). They'd get their own login and a branded site, without internal app licences. The voice bot would move into the portal page. This is in PLAN.md §10B; portal licensing is Q15.

---

## Test items left in the app (none deleted)

| Flow | Item | State |
|---|---|---|
| Work Order | W1 `PkEEkOVZ2cn0`, W3 `PkEEkvq2QghZ`, W7 `PkEEkwImXTIB` | Completed (W1/W7 closed without parts data, see Q42) |
| Work Order | W2 `PkEEkvMVKKK0`, W8 `PkEEkwPh70v2` | Subcontractor dispatch |
| Work Order | W4 `PkEEkvvquBya`, W6 `PkEEkwD520nl` | FM dispatch |
| Work Order | W5 `PkEEkw15LIdw` | Verify and close |
| Work Order | W9 `PkEEkwVCUUdk`, W10 `PkEEkxAavFnq` | Rejected |
| Back-charge | B1 `PkEEl2NMHIZm` | Recovered |
| Back-charge | B2 `PkEEl2kY1Jx5`, B3 `PkEEl2wijWmw`, B4 `PkEEl4zid2a8` | Rejected |
| Permit to Work | P1 `PkEEkylSB8XA` / P2 `PkEEl3ZSEfKh` | Closed / Rejected |
| Snags | S1 `CAF-0001` / S2 `CAF-0002` | Closed / Carried into DLP |
| Breakdowns | BD1 `CAF-0001` | Back in service |

All titles start with **[TEST]**. Master data added for testing is real demo data (3 sites, 3 subcontractors, 10 request types, 3 asset types, 4 assets, 2 fault causes, 1 crane) and stays for the seed.

## Renames (Q43: done 22 Sep)

Renaming changes only the display name. Flow IDs (`CAFM_Work_Order_A00` …) stay the same, so nothing breaks. I'd:

1. Drop the `CAFM` prefix from the **flows** and keep it on the **lists**, where collisions are the real risk.
2. Use the plain names in the table at the top.
3. Set the board prefixes to `SNG` / `BRK`.

**Done:** all 18 flows renamed via `PUT /flow/2/{acc}/{type}/{id} {Name}` and verified by reading back. The board prefixes were **not** changed: Kissflow kept `CAF`, most likely because items already exist; you can change it in the board settings if you want. The duplicate Technician role is deleted (Q39).
