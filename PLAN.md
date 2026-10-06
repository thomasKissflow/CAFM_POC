# PLAN.md — CAFM demo for Dutco Construction (Phase 1)

> Status: **Phase 1 draft — awaiting review.** No code, no Kissflow changes.
> Owner: Thomas (Kissflow SC/FDE). Prepared: 2026-09-22.
>
> **Labelling convention used throughout**
> - **FACT (Dutco)**: stated on dutcoconstruction.com (see §11 Sources).
> - **FACT (domain)**: from a cited public source. Where the only source is a vendor or blog, it says so.
> - **DEMO**: fictional data invented for the demo.
> - **ASSUMPTION**: our design choice or an unverified belief. Validate before relying on it.
> - Kissflow capability status:
>   - **✅ Confirmed**: documented in the Kissflow App Agents plugin (v1.6.0) references or skills, and marked live-verified or source-derived there.
>   - **🟡 Exists, authoring unproven**: present in the platform metadata model per the plugin. The plugin engine does not (yet) author it, or it has not been verified on *our* account.
>   - **❓ Needs verification**: not found in the plugin docs. Check it read-only once keys are provided, or ask Kissflow product.

---

## 0. Context and framing decisions (from your answers)

| Decision | Choice |
|---|---|
| Who runs the helpdesk in the story | **Dutco Construction** (handover, DLP defects, internal plant) plus a **fictional in-house FM operator** that runs helpdesk and PPM. The operator is clearly labelled DEMO and is not named BKA FM. |
| Audience | **Mixed exec + ops.** Open on the exec command centre, then go into helpdesk, technician mobile and compliance. |
| Branding | **Neutral product styling** plus a "Prepared for Dutco Construction" label. No Dutco logo or colours. |
| Headline Kissflow feature | **Custom UI (React)**. The whole experience is one Kissflow Custom UI app. Other Kissflow features appear as supporting proof points (§6). |

**What we know about Dutco (FACT, Dutco site only):**
- Founded in the 1970s in the UAE. Part of the Dutco Group. The site says Dubai Transport Company (Dutco) formed Mina Jebel Ali Construction in 1976 to build Jebel Ali harbour.
- Two entities: Dutco Construction Co. LLC (buildings) and DBB Contracting LLC (marine, civil, roadworks).
- Six service lines: Roads & Infrastructure; Marine & Civil; Buildings; Piling & Ground Engineering; Scaffolding & Formwork; Plants & Transport.
- Listed projects include Container Terminal 4 (Jebel Ali Port), Sheikh Zayed Road widening, the Dubai Metro–Dubai Mall pedestrian link bridge, Dubai Mall Fashion Avenue expansion, DEWA Headquarters and Expo 2020 Village.
- **We will not reference real Dutco projects as the demo site.** The demo tower is fictional (§4).

**Why a contractor needs CAFM (the pitch angle):** a contractor's exposure does not end at handover. Three things carry on:
- the **12-month DLP** (FACT, domain: typical under FIDIC)
- **10-year decennial liability** for structural defects (FACT, domain)
- the **back-to-back chain to subcontractors**

The demo's core message: *Dutco sees every post-handover defect, knows instantly whether it is Dutco's liability or chargeable, pushes it down to the responsible subcontractor, and proves the cost on one dashboard.*

---

## 1. Domain research summary (UAE/GCC, contractor lens)

| Topic | What matters for the demo | Status |
|---|---|---|
| **Construction → operations handover** | The Taking-Over Certificate (TOC) date starts the DLP clock and is the "delivery" date for decennial liability. The handover pack (as-builts, O&M manuals, warranties, T&C certificates) becomes the seed of the asset register. | FACT (domain). TOC as delivery date per law-firm commentary. |
| **Snagging** | Snags are raised at pre-handover inspection, tracked per unit or area, and closed before or shortly after the TOC. Unclosed snags roll into DLP defects. | Industry practice. ASSUMPTION for exact workflow |
| **DLP vs chargeable** | A DLP (typically **12 months** under FIDIC) covers non-structural defects at the contractor's cost. It does **not** cover wear and tear, consumables (filters, lamps), misuse or tenant damage; those are **chargeable**. | FACT (domain) for 12 months and non-structural scope. Exclusions list is ASSUMPTION (contract-specific) |
| **Decennial liability** | 10-year strict liability for collapse or defects threatening stability or safety. **The UAE's new Civil Code (Federal Decree-Law No. 25 of 2025, effective 1 June 2026) moves this to Arts. 821–824.** Per one law firm, it also excludes the contractor→subcontractor relationship from the statutory regime, so back-to-back recovery becomes contractual. | FACT (domain), single law-firm source. **Verify before showing on screen** |
| **Helpdesk / work orders / SLA** | Priority matrix with response and resolution targets. Summer (Jun–Sep) AC complaints are the #1 residential ticket driver in Dubai. | SLA values are DEMO/ASSUMPTION. Summer AC peak is common knowledge, labelled ASSUMPTION |
| **PPM** | Calendar- or meter-based schedules per asset class (FCUs, pumps, lifts, fire systems, DG sets). SFG20-style task libraries are common in GCC FM. | ASSUMPTION (SFG20 is UK-origin; its use in GCC is common but unverified here) |
| **Fire & life safety compliance** | The UAE Fire and Life Safety Code of Practice sets the requirements. Owners must hold an **AMC with a Civil Defence-approved fire contractor**, keep test records, and **renew the Civil Defence certificate annually**. **Hassantuk** is the Civil Defence 24/7 remote alarm-monitoring programme and is mandatory for buildings in Dubai. | Code and Hassantuk: FACT (DCD site). Annual renewal and AMC detail: vendor-blog sources, **verify** |
| **Vendor / subcontractor management** | Trade licence expiry, DCD approval (fire contractors), insurance (CAR/TPL/WC) expiry, back-to-back DLP obligations, performance scorecards. | ASSUMPTION (industry practice) |
| **Permit to Work & HSE** | Hot work, work at height, electrical isolation (LOTO), confined space. Issued by an authorised issuer, with isolation confirmation and closed on completion. | ASSUMPTION (industry practice). No UAE-specific regulation cited |
| **Internal plant & fleet** | Dutco lists **Plants & Transport** as a service line (FACT). Maintenance is hour-meter or km-based servicing, breakdown repair, availability %, and third-party inspection certificates for lifting equipment. | Service line is FACT (Dutco). Everything else is ASSUMPTION/DEMO |

### 1.1 Field pain-point evidence (competitor source)

Source: Facilio blog "FM ops beyond Excel" (Aug 2026). **This is COMPETITOR MARKETING.** We use its field anecdotes only as pain-point evidence. Its outcome figures are **vendor claims**. They are never shown in the demo and never attributed to Kissflow.

| # | Pain point | Anecdote (as reported by Facilio) |
|---|---|---|
| PP1 | **WhatsApp is the intake layer** | A GCC hotel engineer runs ~50 tickets/day through a staff WhatsApp group. There is no work order, timestamp, assignee record or SLA clock |
| PP2 | **Asset history lives in technicians' heads** | KSA: an AC fault was diagnosed as a compressor failure and the compressor replaced. It was actually a small refrigerant leak needing a weld. A KSA labour-camp operator (10+ camps, ~50 technicians) runs on partial Excel and paper |
| PP3 | **Reports are manual reconstructions** | Monthly client reports are stitched from spreadsheets and supervisor messages, with no trustworthy timestamps. The operator wanted data that "can't be manipulated" |
| PP4 | **Growth breaks the manual model** | A Dubai maintenance firm with 400+ clients runs on Excel. A KSA FM provider (90 technicians, 11 projects) has a supervisor copying WhatsApp chats into a job system for 1–2 h/day |
| PP5 | **Audit prep is an emergency** | PPM records lost on paper or old phones must be rebuilt before audits. One hotel operator had no PPM plan and no asset register |

Vendor claims we note but **do not reuse**: 95% SLA compliance, 97% PPM completion, 80% less data entry, 13% productivity gain.

---

## 2. Personas and roles

All names are **DEMO** (fictional), with an Arabic/English mix typical of the UAE workforce.

| # | Persona (demo name) | Organisation | Role key | Primary device | What they do in the demo |
|---|---|---|---|---|---|
| P1 | **Layla Al Suwaidi**, Resident, Apt 1402 | Tenant | `resident` | Mobile | Raises "AC not cooling" and tracks it |
| P2 | **Arjun Menon**, Helpdesk Coordinator | Fictional FM operator | `helpdesk` | Desktop | Triages, confirms priority, sees DLP flag |
| P3 | **Sarah Whitfield**, Facilities Manager | Fictional FM operator | `fm_manager` | Desktop | Owns the SLA board, PPM and escalations |
| P4 | **Khalid Al Hammadi**, DLP & Handover Manager | Dutco Construction | `dlp_manager` | Desktop | Owns snags and DLP defects, back-charges subcontractors |
| P5 | **Rashid Qureshi**, Supervisor, *Coolbreeze MEP (DEMO subcontractor)* | Subcontractor | `subcon_supervisor` | Desktop/tablet | Accepts DLP jobs and dispatches technicians |
| P6 | **Joel Santos**, HVAC Technician | Subcontractor | `technician` | **Mobile** | QR scan, checklist, photo, close-out |
| P7 | **Mariam Nasser**, Fire & Life Safety / Compliance Officer | Fictional FM operator | `compliance` | Desktop | Compliance wall, certificate renewals |
| P8 | **Imran Siddiqui**, HSE Officer | Dutco Construction | `hse` | Tablet | Approves permits to work |
| P9 | **Viktor Petrov**, Plant & Fleet Manager | Dutco Construction | `plant_manager` | Desktop | Equipment availability and breakdowns |
| P10 | **Hamdan Al Falasi**, Operations Director | Dutco Construction | `executive` | Desktop/iPad | Command centre: SLA, DLP cost, compliance, fleet |
| — | Admin | Kissflow | `admin` | Desktop | Configuration (not demoed) |

ASSUMPTION: residents and subcontractors are **internal Kissflow users/roles in the demo**. In production they would likely be Portal users (see §9, Q-portal).

---

## 3. Module list and scope

Depth tiers: **Hero** means fully clickable in the storyline. **Supporting** means real screens with data and a few interactions. **Glimpse** means one screen for credibility.

| # | Module | Scope in demo | Tier |
|---|---|---|---|
| M1 | **Handover & Snagging** | Project/building handover record (TOC date, DLP end, handover pack checklist). Snag board per unit with open/closed/carried-into-DLP states. | Supporting |
| M2 | **Asset Register** | Hierarchy: Site → Building → Floor → Unit/Space → System → Asset. Each asset carries a QR code, installing subcontractor, handover date, DLP end, warranty end, photos and history. Seeded from the handover. | Hero |
| M3 | **Helpdesk & Work Orders** | Request intake (resident/helpdesk), triage, priority matrix, SLA timers (response + resolution), assignment, mobile execution, verification, closure. | Hero |
| M4 | **DLP & Warranty Engine** | Auto-flag: DLP / Chargeable / Decennial-review. Routes DLP work to Dutco, then back-to-back to the subcontractor. Back-charge record with cost (AED). Reclassification if the technician's root cause is an exclusion. | Hero |
| M5 | **PPM** | Schedules by asset class, calendar view, auto-generated WOs, checklist templates. | Supporting |
| M6 | **Fire & Life Safety Compliance** | Fire system register, AMC contractor, certificate expiry, Hassantuk connection status (data field only, **no integration**), and the RAG compliance wall. | Hero (wall) |
| M7 | **Vendor / Subcontractor Management** | Subcontractor profiles, trade licence, DCD approval, insurance expiry, DLP obligations, scorecard (SLA %, first-time-fix, back-charges). | Supporting |
| M8 | **Permit to Work & HSE** | PTW request → HSE approval → isolation confirmed → active → closed. Linked to WO. | Glimpse |
| M9 | **Plant & Fleet Maintenance** | Dutco equipment register, hour-meter service due, breakdowns, availability %, lifting-equipment inspection expiry. | Supporting |
| M10 | **Executive Command Centre** | KPIs: SLA compliance, open WOs by priority, DLP cost recovered vs exposure (AED), compliance RAG summary, fleet availability, summer AC heatmap. | Hero |
| X1 | **Platform chrome** | EN/AR toggle with full RTL, role switcher, guided demo mode, notifications drawer. | Hero |

**Out of scope for the demo:** procurement/stores inventory, finance invoicing, BIM viewer, IoT/BMS integration, a live Hassantuk feed, tenant billing, native mobile app, and offline mode.

---

## 3A. POC focus: frontend first, differentiators over parity

Your steer: this is a **POC**. Invest in the **frontend** and in features that are **missing from the market or poorly implemented**, not in commodity CAFM parity.

Commodity screens (asset lists, PPM calendar, vendor directory) stay **Supporting/Glimpse**: credible but light. Polish goes to the **differentiators** below.

ASSUMPTION: "differentiator" means a gap we *believe* is common in GCC FM tooling, based on the Facilio pain-point evidence and the contractor lens. We have **not** surveyed competitor products feature by feature, so the demo never claims "no one else does this".

| # | Differentiator | Why it's a gap (evidence) | Where |
|---|---|---|---|
| X-DLP | **Contractor liability engine**: DLP / Chargeable / Decennial-review flag at intake, back-to-back routing to the installing subcontractor, auto back-charge | FM-centric CAFMs start at operations. A contractor's post-handover exposure is the Dutco-specific angle (ASSUMPTION) | S06, S11, S12 |
| X-DIAG | **Diagnosis challenge**: before close-out, the technician sees the repeat-fault count and previous diagnoses on this asset *and* on sibling assets from the same subcontractor batch | PP2 (compressor vs refrigerant-leak misdiagnosis) | S10, S16 |
| X-BATCH | **Batch-defect detection**: the same failure mode across a subcontractor's installed base, raised as a DLP batch claim | Extends PP2 to the contractor lens (ASSUMPTION) | S01, S20 |
| X-TRUST | **Append-only activity log** (stronger wording only after Q23): every WO event (channel, timestamps, SLA clock, reassignment, reclassification) in an append-only timeline. Plus a **one-click monthly client report** built only from logged events | PP3 ("data that can't be manipulated") | S06, S27 |
| X-INTAKE | **Structured intake from every channel**: every channel lands as a timestamped WO with the SLA clock started at *first contact*, not at data entry | PP1, PP4 | S03, S25 |
| X-AUDIT | **Audit-ready pack per building**: PPM history, certificates, evidence photos, open findings, generated on demand | PP5 | S28 |
| X-BIL | **Genuinely bilingual**: full RTL, Arabic resident flow, bilingual PDFs | Common complaint that Arabic is bolted on (ASSUMPTION) | Global |

---

## 3B. Pain points → screens

| Pain point | Demo answer | Screens / features | Kissflow backing (see §6.1) |
|---|---|---|---|
| **PP1 WhatsApp intake** | **Omni-channel intake hub.** Each request, whatever the channel, becomes a WO with channel badge, first-contact timestamp, SLA clock and auto-routing. Channels in the demo: **resident app** (Custom UI), **QR poster/asset tag → public request form**, **helpdesk phone capture** (agent logs the call, with the call-received time as SLA start), **email** and **WhatsApp** shown only as *"integration-ready"* tiles until verified. The "before" moment (Beat −1) is a mock group-chat screen. | S24 Before, S25 Intake hub, S03 New request, S05 queue with channel badges | Custom UI ✅ · Public form 🟡 · Webhook trigger ✅(catalog) · Inbound email ❓ · WhatsApp ❌ not native |
| **PP2 Asset history in heads** | **Asset 360**: full service history, previous diagnoses, parts replaced, cost-to-date, DLP/warranty clock, installing subcontractor. **Diagnosis challenge** on the technician close-out: "3rd AC fault on FCU-1402-01 in 60 days. Last diagnosis: thermostat recalibrated. 2 sibling FCUs (same batch) had actuator failures." The technician must acknowledge before closing. | S16 Asset 360, S09 QR → asset card, S10 close-out warning | Dataform + references ✅. Warning logic lives in the Custom UI, computed from WO history |
| **PP3 Manual reports** | **Activity log** on every WO (who, what, when, channel, SLA state), rendered append-only. **Monthly client report**: one click per building/client, bilingual, printable to PDF, every figure drillable back to logged events. | S06 timeline tab, S27 Monthly report | Item history/audit 🟡 (`Audit` FLOW_TYPE exists) · Process `GeneratePDF` action ✅(catalog) · the demo uses browser print-to-PDF |
| **PP4 Growth / multi-site** | **Portfolio view**: switch between client buildings, Dutco project sites and **Dutco's own operations**. Scenario: a **site office + labour accommodation** at a live Dutco project (DEMO, not a Dutco fact) with its own assets (ACs, gensets, water tanks), running on the same app. Filters by site/project/client. The supervisor's copy-paste work disappears because intake is structured. | S29 Portfolio, S01/S05 site filter, S22 Plant & Fleet | Datasets for sites/projects ✅ · role data-scope (my-site/all) ✅ |
| **PP5 Audit emergencies** | **Audit pack** per building: compliance status, PPM completion history with evidence photos, certificates with expiry, open findings. Generated on demand as a bilingual PDF / zip. | S28 Audit pack, S18/S19 compliance | Custom UI ✅ · PDF via print (demo) · `GeneratePDF` ✅(catalog) |

**Credible answer to "AI helpdesk" (Facilio markets one):** we do **not** claim AI in the demo unless verified (§6.1). Two things instead:
1. **Rule-based smart triage**, visible and explainable. For example: "summer + AC keyword + asset in DLP → P2, route to Coolbreeze MEP". It's deterministic, auditable and implementable today.
2. **Optional:** a clearly labelled *"AI assist (concept)"* toggle in the mock, which suggests category/priority from free text. It's shown only if you approve (Q17) and never presented as a shipped Kissflow feature.

---

## 4. The end-to-end demo storyline

**Setting (DEMO):** *Qamar Residences*, a fictional 32-storey residential tower in **Al Jaddaf, Dubai**, built by Dutco Construction. The **TOC was dated 1 March 2026**, so the **DLP ends 28 February 2027** (12 months, ASSUMPTION per FIDIC norm). HVAC is on district cooling with in-apartment FCUs installed by the fictional *Coolbreeze MEP (DEMO)*. A second fictional building, *Jaddaf Point*, was handed over in 2023, is **out of DLP**, and serves as the contrast case.

**Demo clock:** fixed at **Tue 18 Aug 2026, 14:05 GST, 46 °C outside**, at peak summer. This is a deterministic clock so SLA countdowns always show the same story (ASSUMPTION/DECISION D7).

| Beat | Who | What happens on screen | Proof point |
|---|---|---|---|
| −1. Before | Presenter | **"Before" screen (S24)**: a mock staff group chat, "Qamar Tower Maintenance". "1402 AC not working AGAIN 🥵", "who is going?", "send photo pls", a voice note, "done?" with no reply, and a supervisor pasting chats into Excel at 23:40. Overlay counters show **0 timestamps · 0 SLA clocks · 0 asset links**. The presenter clicks **"Replay it structured"** (product name pending, Q2), and the same message turns into a structured WO. Generic chat styling only, **no WhatsApp logo or trademark**. Illustrative, not real messages. | PP1, PP3, PP4 |
| 0. Open | Executive | Command centre: 94% SLA this month, AED 186k DLP cost recovered YTD, 2 amber / 1 red compliance items, 87% fleet availability. | Custom UI dashboard |
| 1. Handover | DLP Manager | Qamar Residences handover record: TOC 01-Mar-2026, 312 assets imported from the handover pack, 14 snags carried into DLP. | Asset register seeded from handover |
| 2. Raise | Resident (mobile) | Layla taps "AC not cooling" in Apt 1402, adds a photo of the thermostat reading 29 °C, and submits in **Arabic**. The **intake hub (S25)** shows the same WO with a "Resident app" badge. Alongside it, a neighbour's request arrives via the **QR poster in the lift lobby** and a phone call is logged by the helpdesk. All three are timestamped at first contact. | Mobile + RTL, omni-channel (PP1) |
| 3. Triage | Helpdesk | Ticket lands in the queue. The **summer rule** auto-sets **P2 Urgent** (1 h response, 8 h resolution). The asset is resolved to **FCU-1402-01**. Banner: **"DLP: Contractor liable (ends in 194 days)"**. | SLA + DLP engine |
| 4. Route | System | DLP routing assigns to Dutco DLP Manager, then **back-to-back to Coolbreeze MEP** (the installing subcontractor on the asset record). Notifications fire. The SLA response timer is running. | Conditional routing, integration |
| 5. Accept | Subcon Supervisor | Rashid accepts and dispatches Joel. Response SLA is met at 42 minutes. | Role-based queues |
| 6. Execute | Technician (mobile) | Joel scans the **QR** on the FCU, which opens **Asset 360** (history and the job). He runs the checklist and first picks "thermostat fault". The **diagnosis challenge** appears: "3rd AC fault here in 60 days. Last time: thermostat recalibrated (6 weeks ago). 2 sibling FCUs from the same Coolbreeze batch had actuator failures." He re-tests and confirms **"chilled-water control valve actuator failed"**, takes before/after photos and gets the resident's **signature**. | QR, Asset 360, diagnosis challenge (PP2), photo, signature |
| 7. Branch (optional) | Technician | *Alternate path:* the root cause is "filter clogged (consumable)", so the system **reclassifies it as Chargeable**, routes it to the FM operator and shows a cost estimate to the owner. Demonstrates the DLP exclusion logic. | Business rule |
| 8. Close | Helpdesk / Resident | Verification and resident confirmation. Resolved in 5 h 12 m, **within SLA**. | SLA met |
| 9. Cost | DLP Manager | A back-charge record is auto-created: parts AED 1,450 plus labour AED 600 = **AED 2,050 recovered from subcontractor**. | Flow-to-flow automation |
| 10. Roll-up | Executive | The command centre updates: SLA %, DLP recovered +AED 2,050, the AC-fault heatmap lights floor 14, and the **Coolbreeze scorecard** shows 3 actuator failures in 30 days, which prompts a batch-defect warning. | Insight, not just tracking |
| 11. Trust | FM Manager | Opens the WO's **activity log**: every event with its timestamp and channel, append-only. Then clicks **"Monthly client report: Qamar Residences, Aug 2026"**. A bilingual report is generated from logged events only, and any figure drills back to its WOs. | PP3 |
| 12. Audit | Compliance | **Audit pack** for Qamar Residences: compliance wall (sprinkler AMC certificate expiring in 21 days, **amber**), PPM completion with evidence photos, certificates. Exported on demand. | PP5 |
| 13. Portfolio | Executive / Plant | **Portfolio view** switches to Dutco's own operations: a live project's site office and labour accommodation (DEMO) with its AC and genset assets on the same app, then Plant & Fleet (crawler crane with an overdue third-party inspection, **red**), plus a hot-work permit glimpse. | PP4, breadth |

**Demo run-time target:** 15–18 min guided, plus Q&A. The "before" beat and beats 11–13 add ~3 min; beats 12–13 can be skipped for a short run.

---

## 5. Screen inventory and navigation

### 5.1 Screens

| ID | Screen | Roles | Device | Module |
|---|---|---|---|---|
| S01 | Command Centre (exec dashboard) | executive, fm_manager, dlp_manager | Desktop/iPad | M10 |
| S02 | My Work (role-aware landing: queue + KPIs) | all internal | Desktop | X1 |
| S03 | Service Request: new (resident / helpdesk) | resident, helpdesk | Mobile/Desktop | M3 |
| S04 | My Requests (resident tracker) | resident | Mobile | M3 |
| S05 | Helpdesk Queue (list + SLA countdowns, filter by priority/DLP) | helpdesk, fm_manager | Desktop | M3 |
| S06 | Work Order detail (SLA bars, DLP banner, cost, photos, **append-only activity log tab**, channel badge) | internal | Desktop | M3/M4 |
| S07 | SLA Board (kanban by status, breach states) | fm_manager | Desktop | M3 |
| S08 | Technician: My Jobs (today) | technician | **Mobile** | M3 |
| S09 | Technician: QR scan → asset card | technician | **Mobile** | M2 |
| S10 | Technician: Job execution (checklist, root cause, **diagnosis challenge**, photos, parts, signature, close-out) | technician | **Mobile** | M3 |
| S11 | DLP Register (defects by status, liability, cost recovery) | dlp_manager, executive | Desktop | M4 |
| S12 | Back-charge detail | dlp_manager, subcon_supervisor | Desktop | M4 |
| S13 | Handover overview (TOC, DLP clock, handover pack checklist) | dlp_manager | Desktop | M1 |
| S14 | Snag board (kanban) | dlp_manager | Desktop | M1 |
| S15 | Asset Register (tree + table) | fm_manager, dlp_manager | Desktop | M2 |
| S16 | **Asset 360** (QR, DLP/warranty clock, full service history, previous diagnoses, repeat-fault count, sibling-batch failures, cost-to-date, PPM) | internal | Desktop/Mobile | M2 |
| S17 | PPM Calendar | fm_manager | Desktop | M5 |
| S18 | Compliance Wall (RAG grid: building × system) | compliance, executive | Desktop / wall display | M6 |
| S19 | Compliance item detail (certificate, AMC, expiry, evidence) | compliance | Desktop | M6 |
| S20 | Subcontractor directory + scorecard | dlp_manager, fm_manager | Desktop | M7 |
| S21 | Permit to Work (list + detail) | hse, technician | Tablet | M8 |
| S22 | Plant & Fleet (availability, service due, breakdowns) | plant_manager, executive | Desktop | M9 |
| S23 | Guided Demo overlay (step cards, "next beat", auto role switch) | presenter | Desktop | X1 |
| S24 | **"Before" screen**: mock staff group chat, generic styling, illustrative | presenter | Desktop/Mobile | X1 |
| S25 | **Intake hub**: all channels in one stream (resident app, QR/public form, phone capture; email/WhatsApp "integration-ready" tiles), first-contact timestamps | helpdesk, fm_manager | Desktop | M3 |
| S26 | **Public request form** (opened from QR poster/asset tag, no login, bilingual) | anyone | Mobile | M3 |
| S27 | **Monthly client report** (per building/client, bilingual, print-to-PDF, drill-back to WOs) | fm_manager, executive | Desktop | M3/M10 |
| S28 | **Audit pack** per building (compliance, PPM evidence, certificates, findings, export) | compliance, fm_manager | Desktop | M6/M5 |
| S29 | **Portfolio view** (client buildings, Dutco project sites, site offices/labour accommodation) | executive, fm_manager, plant_manager | Desktop | M2/M10 |

### 5.2 Navigation map (per role)

```
Executive        → Command Centre ─┬─ Portfolio ─ Site
                                   ├─ DLP Register ─ Back-charge
                                   ├─ Compliance Wall ─ Item
                                   ├─ Plant & Fleet
                                   └─ Subcontractor scorecards
FM Manager       → My Work ─┬─ Helpdesk Queue ─ Work Order
                            ├─ SLA Board
                            ├─ PPM Calendar
                            ├─ Asset Register ─ Asset 360
                            ├─ Monthly client report
                            ├─ Audit pack
                            └─ Command Centre
Helpdesk         → Intake hub ─ Helpdesk Queue ─┬─ New Request (phone capture)
                                                 └─ Work Order (activity log)
DLP Manager      → My Work ─┬─ Handover ─ Snag board
                            ├─ DLP Register ─ Back-charge
                            ├─ Asset Register
                            └─ Subcontractors
Subcon Supervisor→ My Work (assigned DLP jobs) ─ Work Order ─ Back-charge (read/dispute)
Technician (mob) → My Jobs ─┬─ Job execution
                            └─ Scan QR ─ Asset card ─ Job
Resident (mob)   → My Requests ─ New Request
Public (QR)      → Public request form (no login)
Compliance       → Compliance Wall ─┬─ Item
                                   └─ Audit pack
HSE              → Permits ─ Permit detail
Plant Manager    → Plant & Fleet ─ Equipment ─ Breakdown
Global chrome    : Role switcher · EN/عربي · Notifications · Demo mode ("Before" screen as entry)
```

---

## 6. Kissflow capability mapping

Source: Kissflow App Agents plugin v1.6.0 (`reference/CONCEPTS.md`, `PROCESS-VS-BOARD.md`, `BOARD-AND-KANBAN-PAGE.md`, `INTEGRATION-CATALOG.md`, `APP_METADATA_MODEL.md`, `METADATA_ATTRIBUTES_*.md`, `engine/util.mjs`, `skills/build-kissflow-app`). The final component choice per entity is decided in **Phase 3**, so this table is the working hypothesis.

| Need | Kissflow capability | Status | Note |
|---|---|---|---|
| Whole frontend in Kissflow | **Custom UI**: React app scaffolded by `@kissflow/create-app`, uploaded as zip (`npm run zip`) or dev URL; enabled via app Settings → Custom UI | ✅ | Plugin skill `build-kissflow-app` + `deploy-ui` |
| Data access from the UI | `@kissflow/app-core` SDK: `useKf`, `kf.app.getDataform/getProcess/getBoard`, `kf.client`, `kf.formatter` | ✅ (per skill docs) | **Your convention says `kf.api()`**. See Q-sdk: confirm which API the Custom UI SDK exposes |
| Masters (sites, buildings, floors, units, trades, SLA matrix, root causes) | **Dataset / List**, feeding Select/Reference fields | ✅ | |
| Asset register | **Dataform (Form)** with References to masters | ✅ | Could be a Dataset, decided in Phase 3 |
| Asset photos, location, auto IDs | Field types **Image, Attachment, Geolocation, SequenceNumber, Signature, StarRating** | ✅ | In engine `CANON_FIELD_TYPES` |
| QR scan | Platform has a **Scanner** field type | 🟡 | In platform enum, **not** in the engine canon list. **Plan: scan in the Custom UI via the browser camera**, so no dependency on it |
| Snags | **Board (Case)**: unstructured status columns, Kanban view | ✅ | 7-step live recipe incl. case-member grant |
| Work orders / service requests | **Process**: role-owned steps, conditional branch (DLP vs chargeable), send-back | ✅ | Alternative: Board. Decision in Phase 3 (D10) |
| SLA timers + escalation | Process **Activity SLA** (Value + Unit) with **Notify / Escalate** before/after; Board status `SLADisabled`, `SLABreachResources` | 🟡 | In the metadata model, but the **engine carries `sla` in the IR without emitting SLA entities**. Likely configured manually in the builder, or modelled as due-date fields. **The frontend computes countdowns itself** |
| SLA-breach automation | Process connector trigger **`SlaBreached`** | ✅ (catalog) | Per-account connector availability to check |
| DLP flag | **Computed field (Expression)** comparing request date to asset DLP end, plus category exclusions | 🟡 | Date function availability in the formula builder unverified. Use `not(...)` per your convention |
| WO → back-charge record | **Integration**: Process `ItemCompleted` / `ItemEntersToStep` → `CreateAndSubmitItem` | ✅ draft/publish · ❓ turn-on | Turn-on is 403 with a public key, so **you switch it on in the builder UI** |
| PPM auto-generation | **Scheduler** connector (4 scheduled triggers) → Process `CreateAndSubmitItem` | ✅ (catalog) · ❓ account availability | |
| Email notifications | **Email** connector `SendEmail`; SLA Notify | ✅ (catalog) | |
| Roles & permissions | App roles; step/field permissions (process); status × field `CasePermission` (board) | ✅ | |
| Dashboards | Native Reports (ChartReport Bar/Pie) **or** Custom UI charts from SDK data | ✅ | Demo uses Custom UI charts |
| English/Arabic | App-level `_is_translation_enabled`, `Languages[]` (native). **Custom UI i18n/RTL is our own React code** | ✅ native setting · ❓ host chrome RTL around Custom UI | |
| Resident / subcontractor external access | **Portal** (a FLOW_TYPE parallel to Application) | ❓ | The plugin doesn't author portals. Out of demo scope, flagged for production |
| AI (triage/classification) | FLOW_TYPE `Agent` exists; AI page/integration generation exists in builder | ❓ | Not selected as a showcase. Optional "future" slide only |
| Custom UI on Kissflow mobile app; camera access | — | ❓ | Key risk for the technician flow (R3) |
| Photo upload from Custom UI into an Image/Attachment field | — | ❓ | Verify the SDK upload method in Phase 4/6 |
| Current user identity/role in Custom UI | — | ❓ | Needed to replace the demo role switcher in Phase 6 |

### 6.1 Intake channels and AI: what Kissflow supports (verified against plugin v1.6.0)

Legend: ✅ confirmed in plugin docs · 🟡 exists in platform metadata, authoring/usage unproven · ❓ needs verification (not in plugin docs) · ❌ not supported natively as far as we can find. "Not found" does not prove absence, so every ❓/❌ goes to Kissflow product (Q19–Q22).

| Channel / feature | Finding | Status | Evidence | Demo treatment |
|---|---|---|---|---|
| **In-app / Custom UI request** | Resident or helpdesk creates the item through the Custom UI | ✅ | `skills/build-kissflow-app` (SDK: `kf.app.getProcess`, …) | **Live in demo** |
| **Public form** (no login, e.g. behind a QR poster) | Process flow doc carries `PublicFormSettings {Token, _has_public_form, _public_form_enabled}` | 🟡 | `reference/DELTA_ProfServ_model.md:219` (observed on a real app) | Mock S26. Verify enablement and whether a Custom UI can host it (Q19) |
| **Portal** (external users) | `Portal` is a FLOW_TYPE parallel to Application; the plugin cannot author it | ❓ | `CONCEPTS.md:33`, `METADATA_ATTRIBUTES_model.md:658` | Not shown as live. Production option (Q15) |
| **Inbound webhook / API** | Webhooks connector `WebhookTrigger`; trigger types include `PublicWebhook`, `PrivateWebhook`. Items can also be created via REST (e.g. `POST /case/2/{acc}/{caseId}`) | ✅ (catalog) · availability per account ❓ | `INTEGRATION-CATALOG.md:40`, `METADATA_ATTRIBUTES_page.md:553`, `BOARD-AND-KANBAN-PAGE.md` | The **integration pattern** that any external channel (call-centre, BMS, a WhatsApp provider) would use |
| **Outbound email** | Email connector `SendEmail` action | ✅ (catalog) | `INTEGRATION-CATALOG.md` | Notifications (mocked in Phase 2) |
| **Inbound email → ticket** | No inbound-email trigger found; the Email connector lists no triggers | ❓ | `INTEGRATION-CATALOG.md` (Email: triggers "—") | "Integration-ready" tile only (Q20) |
| **WhatsApp** | No WhatsApp connector or reference anywhere in the plugin | ❌ native · ❓ via third party | grep across plugin: 0 hits | **Not claimed.** Only possible pattern: a WhatsApp Business provider → Kissflow webhook trigger (inbound), HTTP action → provider (outbound). Unverified, and needs a 3rd-party BSP contract. "Integration-ready" tile clearly labelled (Q21) |
| **Phone / call** | No telephony integration; the helpdesk logs the call manually with the call-received time | ✅ (as manual capture) | — | Live in demo (phone-capture form) |
| **AI: builder-time** | Kissflow AI suggests integration skeletons (`/suggest/workflow {AIPrompt}`) and AI page generation (`flow_builder/.../page/create`) | ✅ | `INTEGRATION-CATALOG.md:101`, `APP_METADATA_MODEL.md:148,273` | Mention only as "how fast we built it", not a runtime feature |
| **AI: runtime triage / classification / agents** | FLOW_TYPE `Agent` exists in the platform enum. No documented runtime AI (ticket classification, auto-routing, chatbot) in the plugin | ❓ | `METADATA_ATTRIBUTES_model.md:658` | **Not claimed.** Rule-based smart triage instead. Optional "AI assist (concept)" only if approved (Q17, Q22) |
| **Auto-routing & escalation** | Process conditional branches, role-owned steps, Activity SLA Notify/Escalate, `SlaBreached` trigger | ✅ / 🟡 SLA authoring | §6 table | Live in demo (frontend-computed) |
| **Audit trail (append-only / tamper-evident?)** | FLOW_TYPE `Audit` exists; item activity history not documented in plugin | 🟡 | `METADATA_ATTRIBUTES_model.md` (E15) | Frontend renders append-only log from events. Verify what the backend can guarantee (Q23) |
| **PDF generation** | Process connector `Action_GeneratePDF` | ✅ (catalog) | `INTEGRATION-CATALOG.md` | Demo uses browser print-to-PDF |

---

## 7A. How we position vs Facilio (grounded only in what we verified)

Facilio markets a purpose-built connected CMMS with an AI helpdesk: calls, chat, WhatsApp and email intake, plus skill/location/shift routing, auto-escalation and automated reports. **We have only read their marketing. We have not verified their product and make no claims about what it lacks.**

Our position for Dutco:
1. **Contractor-shaped, not FM-shaped.** The demo leads with what a *contractor* carries after handover: DLP vs chargeable, back-to-back subcontractor recovery, batch defects, decennial awareness. This is built as a Kissflow app around Dutco's process (✅ Process, Board, Dataform, Integration), not a generic FM template.
2. **One platform for Dutco's other operations.** The same app and platform covers PTW/HSE, plant & fleet and site offices / labour accommodation (✅ same primitives). Dutco can extend it themselves (low-code) rather than buying separate point tools.
3. **Owned experience.** A fully custom, bilingual RTL frontend running *inside* Kissflow (✅ Custom UI). The UX is shaped to Dutco's roles, not a vendor's default screens.
4. **Honest on channels and AI.** Intake live today: in-app, public form (🟡), manual phone capture, and API/webhook (✅ catalog). WhatsApp and inbound email are **integration patterns to validate**, not features. Triage is transparent rules. **Do not** position Kissflow as having an AI helpdesk or native WhatsApp unless Q21/Q22 come back confirmed.
5. **Never quote Facilio's numbers** (95% / 97% / 80% / 13%) or imply comparable Kissflow outcomes.

---

## 7. Kissflow features we will showcase

1. **Custom UI** (headline): a fully branded, bilingual, mobile-responsive CAFM product running *inside* Kissflow. ✅
2. **Process workflows with conditional routing**: DLP vs chargeable branch, role-owned steps. ✅
3. **Boards (Case)**: snag Kanban for the handover team. ✅
4. **Flow-to-flow integrations**: WO completion auto-creates the subcontractor back-charge. ✅ (turn-on manual)
5. **Scheduler-driven PPM**: WOs generated on schedule. ✅ catalog / ❓ account
6. **SLA & escalation**: 🟡. Shown via the Custom UI. Native configuration to be verified.
7. **Rich field types**: Image, Signature, Geolocation, SequenceNumber. ✅
8. **Role-based security**: every persona sees a different app. ✅
9. **Multilingual (EN/AR)**: ✅ native setting. The Custom UI's full RTL is ours.

We will **not** claim portals, AI agents, offline mode or IoT in the live demo unless verified. They can appear on a clearly labelled "roadmap / art of the possible" slide if you want.

---

## 8. Demo data plan (all DEMO unless stated)

| Dataset | Volume | Realism notes |
|---|---|---|
| Sites/buildings | 2 buildings: Qamar Residences (in DLP), Jaddaf Point (out of DLP, TOC 2023). Plus 1 Dutco plant yard (Jebel Ali Industrial) | Real Dubai districts, fictional buildings |
| Units | 312 apartments (Qamar), 180 (Jaddaf Point) | Unit numbers `FFUU` (1402 = floor 14, unit 02) |
| Assets | ~400 (FCUs per unit, pumps, lifts, fire pumps, sprinkler zones, FAPs, DG sets, ETS/district-cooling interface) | Tags like `FCU-1402-01`, `FP-B1-01`, `LFT-A-02` |
| Subcontractors | 6 fictional (MEP/HVAC, Lifts, Fire, Electrical, Plumbing, Façade), each with licence, insurance and DCD-approval expiry | Names obviously fictional plus "(DEMO)" |
| Work orders | ~450 over the last 6 months. **July–August AC spike (~3× baseline)**. ~70% DLP at Qamar. Realistic breach rate (~6%) | Drives heatmap and trends |
| SLA matrix | P1 Emergency: 30 min response / 4 h resolve · P2 Urgent: 1 h / 8 h · P3 Routine: 4 h / 3 days · P4 Planned: 1 day / 10 days. Summer rule: AC complaints Jun–Sep auto-uplifted to P2 | **ASSUMPTION**: typical values, not Dutco's |
| DLP back-charges | ~60 records, AED 150–25,000 each, YTD recovered ≈ AED 186k | |
| Compliance items | ~24 (fire alarm, sprinklers, fire pumps, emergency lighting, extinguishers, lifts, water-tank cleaning, Hassantuk status). **~70% green, 20% amber, 10% red** | "Hassantuk" is a data field, no integration |
| PPM schedules | ~40 schedules, next 90 days | |
| Permits | ~15 (hot work, height, LOTO, confined space) | |
| Plant & fleet | ~60 items (crawler/mobile cranes, excavators, tippers, generators, compressors, low-beds) with hour meters and 3rd-party inspection dates | Dutco "Plants & Transport" line is FACT. Items are DEMO |
| People | ~35 users with Arabic, South Asian, Filipino and European names; bilingual display names for key personas | |
| Formats | **AED** (`AED 2,050` / `2,050 د.إ`), GST (UTC+4), dates `18 Aug 2026` / Arabic month names, Mon–Fri week (ASSUMPTION re working week), temperatures °C | Western digits in Arabic by default (Q-digits) |

---

## 9. Risks and open questions

### Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Native SLA/escalation not authorable via the plugin engine | Phase 4 SLA may need manual builder configuration | Frontend computes SLA from due-dates. Verify in Phase 3 and configure manually if needed |
| R2 | Integration turn-on needs builder UI / admin | Back-charge automation not live after Phase 4 | You turn it on manually. Documented in Phase 4 checklist |
| R3 | Custom UI on Kissflow mobile / camera access for QR + photo | Technician hero flow could break inside Kissflow | Demo the mobile flow in a mobile browser or responsive view. Verify early (read-only) |
| R4 | RTL inside the Kissflow host shell | Arabic demo looks half-flipped | Our UI is fully RTL. Check host behaviour when Custom UI is enabled |
| R5 | Legal facts shown on screen (Civil Code article numbers, DCD rules) are wrong | Credibility with a UAE contractor | Show only verified references. Label demo rules as "configurable" |
| R6 | Overscope (10 modules) | Phase 2 time and quality | Tiering (Hero / Supporting / Glimpse). Polish the hero path first |
| R7 | Demo data looks fake | Weakens the pitch | Seeded, internally consistent generator. Summer pattern and DLP ratios as above |
| R8 | Implying BKA FM or real projects | Prospect sensitivity | Fictional FM operator, fictional buildings, "DEMO" labels |
| R9 | Plugin version drift (1.2.4 and 1.6.0 both cached) | Wrong behaviour in Phase 4 | Use 1.6.0. Run `/kf-update` check before Phase 4 |
| R10 | Prospect asks "do you do WhatsApp / AI helpdesk like Facilio?" | Credibility if overclaimed | §7A script: rule-based triage live, webhook pattern shown, WhatsApp/AI as roadmap only if verified |
| R11 | The "before" chat screen resembles WhatsApp trade dress, or uses real-looking messages | Trademark / taste | Generic chat styling, no logo, obviously illustrative content |
| R12 | "Tamper-evident / can't be manipulated" claim outruns backend guarantees | Credibility with an audit-minded buyer | Say "append-only activity log" in the demo. Confirm what Kissflow audit history guarantees (Q23) before using stronger words |
| R13 | Labour-accommodation scenario implies facts about Dutco's operations | Rule 4 | Labelled DEMO. Confirm with you whether Dutco runs site offices / labour camps (Q24) |

### Open questions
See **OPEN_QUESTIONS.md** (the live list). The most important for Phase 2 are Q1 (scaffold approach), Q2 (product name), Q5 (demo date/deadline) and Q6 (SDK: `kf.api()` vs `kf.app.*`).

---

## 10. Proposed Phase 2 approach (for approval, not started)

| Option | Description | Trade-off |
|---|---|---|
| **A (recommended)** | Scaffold with **`@kissflow/create-app`** (Vite + React + TS + `@kissflow/app-core`, shadcn/Tailwind v4). Build all screens against a typed `services/` adapter layer (interfaces + `mock/` implementation). No SDK calls in Phase 2. | Guarantees the zip packaging fits Custom UI. Must restyle hard to avoid a template look (impeccable) |
| B | Plain Vite + React + TS, ported into the scaffold in Phase 6 | Freer, but porting risk later |
| C | The plugin's `kf-prototype-builder` generated prototype | Fastest, but less control over design and RTL, and it tends to generic output |

Phase 2 architecture sketch (for review, not a commitment):
- `src/domain/` for types
- `src/services/` for `WorkOrderService`, `AssetService`, and so on, as interfaces
- `src/services/mock/` for seeded, deterministic mock data plus the demo clock
- `src/i18n/` for EN/AR, logical CSS properties and `dir` switching
- `src/features/<module>/` for screens
- `src/demo/` for the guided-mode script and role switcher

---

## 10A. Phase 7: Gemini voice + AI (in progress)

> **Status 22 Sep.** Built: backend foundation, Admin role (data browser, AI conversations, AI settings), Gemini Live voice (step B). Next: C summarizer → D insights → E Cloud Run. Decisions D57–D63. The original plan below is kept for history; where it differs, D57–D63 win (Gemini Live with an AI Studio key, not the cascaded Vertex design).

| Step | What | Status |
|---|---|---|
| A | Backend (`app/server/`): config, retry, usage log, origin/rate-limit guards, AI Settings in Kissflow, dev Kissflow proxy; Admin screens | Done |
| B | Gemini Live voice: single-use tokens, 16 kHz mic worklet, 24 kHz player with barge-in flush, transcription, resumption + GoAway, record_request tool, call saved to AI Conversations | Done (mic test by Thomas: Q50) |
| B+ | Live voice **inside Kissflow** with the key stored in Kissflow (D65), one provider for both modes (D66) | Done |
| C | Summariser (Flash, structured): summary, key points, actions, open questions — automatic at call end, re-runnable per call | Done |
| D | Insights (Flash, structured): sentiment, intents, topics, issues with severity, follow-ups; schema in `shared/ai-core.ts`, ready for embeddings later | Done |
| E | Cloud Run hosting + `VITE_AI_API_BASE` in the Kissflow build, budget alert | **Moved to production** (PRODUCTION_TODO.md §1), per Thomas: the POC runs inside Kissflow |

### Original plan (22 Sep, before the Phase 7 brief)

> Added 22 Sep at Thomas's request. Phases 4–6 come first. Nothing here is built yet. Every GCP product detail below is **ASSUMPTION (verify in Phase 7)** unless it's marked otherwise. The Google docs will be checked when Phase 7 starts.

**What exists today (Phase 2, verified in the browser).** The resident app has a voice agent at `/me/voice`.
- **Speech:** the browser's Web Speech API (speech-to-text and text-to-speech).
- **Brain:** deterministic by default (`src/voice/mockBrain.ts`). Optionally Claude through a dev-server proxy that holds the key (`app/server/voiceProxy.ts`).
- **Behaviour:** barge-in, end-of-turn detection, streamed sentence-by-sentence speech, and a live job card. A confirmed call becomes a work order (channel "Voice agent") with the transcript attached, and the normal liability and SLA engine routes it.
- **Limits:** browser speech quality varies by device. Chrome/Android STT works, but iOS Safari support is uneven (**ASSUMPTION**). The Claude proxy only exists under `npm run dev`; the Kissflow Custom UI zip has no server.

**Goal for Phase 7:** production-grade, low-latency, bilingual (EN / Gulf Arabic) voice with no secrets in the browser. It swaps implementations behind the interfaces that already exist:

| Today | Phase 7 replacement | Interface kept |
|---|---|---|
| `Listener` (Web Speech STT) | Streaming STT over a WebSocket to our backend | `onInterim` / `onFinal` |
| `Speaker` (speechSynthesis) | Cloud TTS audio chunks played through Web Audio; `cancel()` stops playback instantly for barge-in | `enqueue` / `cancel` / `onIdle` |
| `voiceProxy.ts` on the Vite dev server | The same brain endpoint on Cloud Run | `VoiceBrain.respond()` |
| Mock `workOrders.create` | Kissflow Work Order process via the Phase 6 adapter | `NewRequestInput` (transcript, vulnerable occupant, access window) |

**Two architectures to choose from (decide at the start of Phase 7, see Q37):**
- **A. Cascaded (recommended to evaluate first):** Cloud Speech-to-Text streaming, then a brain (Claude on Vertex AI, or Gemini), then Cloud Text-to-Speech.
  - Pros: each piece is swappable, the transcript is exact, and it reuses today's prompt and tool schema unchanged.
  - Cons: three hops of latency.
  - **ASSUMPTION:** Arabic (`ar-AE` or `ar-XA`) streaming recognition and Arabic neural voices are available. Check the language tables.
- **B. Native speech-to-speech (Gemini Live API):** one bidirectional audio session with built-in voice-activity detection and interruption handling.
  - Pros: lowest latency.
  - Cons: the brain becomes Gemini, not Claude; the transcript and tool-call handling need re-validating; Arabic quality must be tested.
  - **ASSUMPTION:** Live API availability and ephemeral-token support on our account and region.

**Security model (holds for either option):**
- Keys never reach the browser. The browser only ever gets a short-lived, single-purpose session token.
- A small **token broker / voice gateway on Cloud Run** runs as a dedicated service account. It calls Google APIs with that account's identity, so no JSON key file is shipped.
- The gateway authenticates the caller before issuing a token. **ASSUMPTION:** a signed Kissflow session or user check is possible from the Custom UI (verify in Phase 6).
- Tokens expire in minutes and are scoped to one call.
- The Anthropic key (for option A with the Claude API) or the Kissflow keys go in **Secret Manager**, never in env files in the repo.
- **Data residency is an open question (Q36).** **ASSUMPTION:** there is no GCP region inside the UAE; the nearest Middle East regions are Doha and Dammam. Verify which speech and model services exist there.

**Step-by-step: how to set up GCP and create credentials (I'll walk you through this in Phase 7).** The commands are standard `gcloud`. Exact role names are **ASSUMPTION (verify)**.
1. Pick or create a project and enable billing: `gcloud config set project <PROJECT_ID>`.
2. Enable the APIs: Speech-to-Text, Text-to-Speech, Cloud Run, Secret Manager, IAM Credentials, plus Vertex AI (option A with Claude or Gemini, or option B):
   `gcloud services enable speech.googleapis.com texttospeech.googleapis.com run.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com aiplatform.googleapis.com`
3. Create a service account for the gateway:
   `gcloud iam service-accounts create cafm-voice --display-name "CAFM voice gateway"`
4. Grant only what it needs: the Speech client role, Vertex AI user (if used), and Secret Manager accessor on the specific secrets. No Owner or Editor.
5. **Local development:** run `gcloud auth application-default login`, so no key file is needed. If you have to use the access key you already have:
   - keep it outside the repo, referenced by `GOOGLE_APPLICATION_CREDENTIALS` in `CAFM/.env` (chmod 600, git-ignored)
   - rotate it after the POC
   - never paste it into the frontend
6. Store secrets:
   `gcloud secrets create kf-access-secret --data-file=-` (and `anthropic-api-key` if option A uses the Claude API directly).
7. Deploy the gateway:
   `gcloud run deploy cafm-voice --source . --service-account cafm-voice@<PROJECT_ID>.iam.gserviceaccount.com --region <REGION>`
   Require authentication, or check our own session token, and restrict CORS to the Kissflow domain.
8. Point the frontend at the gateway URL (a config value, not a secret).
   **Verify in Phase 6/7:** whether Kissflow Custom UI allows outbound WebSocket and `fetch` to a non-Kissflow origin (CSP). If not, route through a Kissflow integration or HTTP connector.

**Phase 7 exit criteria (proposed):**
- An EN and an AR call on a real phone (Android Chrome and iOS Safari) finish in under 90 seconds.
- Interruptions stop the agent's speech within about 300 ms (**target, ASSUMPTION**).
- The WO lands in Kissflow with the transcript and is routed by the role engine.
- No secret is visible in the browser bundle or the network tab.
- Key rotation is documented.

---

## 10B. Phase 8 (optional): resident portal (plan only)

> Added 22 Sep at Thomas's request. Not scheduled. Until then, residents are the **Resident app role** inside the app, using the Custom UI's resident view (My requests, **Talk** voice agent, New request).

- **What it adds:** a Kissflow **Portal** so residents (and optionally subcontractors) get their own login and a branded site, without internal app user licences. They can raise requests (form or voice), track them, and sign off completed work.
- **Voice bot:** the same `VoiceAgent` screen is hosted on a portal page. **ASSUMPTION (verify):** portal pages can host Custom UI and reach the Phase 7 voice gateway.
- **Backend:** no model change. Work Order already has Resident as initiator. Portal users would map to the Resident role's permissions. **ASSUMPTION (verify):** portal users can initiate process items and see only their own (my-items scope).
- **Open:** portal licensing and availability (Q15), and the subcontractor portal vs app role.

---

## 10C. Phase 9 (at the very end): integrations

> Added 22 Sep at Thomas's request. On hold until then.

- **Built so far (switched off):** 7 integrations, listed in BACKEND_CATALOG "Integrations". The back-charge one has its Control path (Liability Code = 1) and its mappings (Thomas).
- **Blocker:** switching them on fails. Kissflow asks for every connector step to be tested, and the tests error. The app-agents plugin (v1.6.0) has no skill for connector tests or switching integrations on; it creates them off by design.
- **When we pick this up:**
  1. Use Thomas's connection **"Thomas Dev Keys"** for Action and authentication on the Kissflow Process connections.
  2. Test each connector step in the builder.
  3. Switch them on one at a time.
  4. Assert their effects with the suite (activity-log rows, history row on close, back-charge raised on DLP close).
  5. Build the two scheduled ones: monthly PPM work orders and daily certificate-expiry alerts.
- **Open:** the deadline email's recipients and wording.

---

## 11. Sources

- Dutco Construction: [home](https://www.dutcoconstruction.com/), [services](https://www.dutcoconstruction.com/services)
- UAE Fire & Life Safety Code: [Dubai Civil Defence](https://www.dcd.gov.ae/portal/preventive-safety/uae-fire-and-life-safety-code-of-practice.jsp)
- Hassantuk: [DCD: Hassantuk (Commercial)](https://www.dcd.gov.ae/portal/en/item/305.jsp)
- Annual certificate / AMC (secondary, vendor): [wiznet.ae](https://wiznet.ae/fire-safety-regulations-dubai/), [QSERV](https://qservuae.com/blogs/fire-safety-compliance-dubai-2025)
- Decennial liability, new Civil Code Arts. 821–824: [Charles Russell Speechlys (2026)](https://www.charlesrussellspeechlys.com/en/insights/expert-insights/construction-engineering-and-projects/2026/decennial-liability-and-subcontractors-under-the-new-uae-civil-code-articles-821-to-824/)
- DLP ~12 months (FIDIC) & decennial basics: [Kayrouz & Associates](https://www.kayrouzandassociates.com/insights/decennial-liability-uae-contractors-engineers-2026), [ELP Legal](https://elplegal.com/decennial-liability-in-uae-a-guide-for-contractors-and-developers/)
- Kissflow: App Agents plugin v1.6.0 local references (paths in §6)
- Pain-point evidence (**competitor marketing**): [Facilio: FM ops beyond Excel (Aug 2026)](https://facilio.com/blog/fm-ops-beyond-excel/)
