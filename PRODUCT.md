# Product

<!-- impeccable:product-schema 1 -->

> Written unattended from Thomas's brief, PLAN.md and DECISIONS.md (the user was asleep and told the build to proceed). Facts marked *(inferred)* need confirmation.

## Platform

web

## Stack
Delegated: "use the libraries that are needed". Chosen: React 19 + TypeScript + Vite + Tailwind v4 + Radix primitives + Recharts + react-router. This mirrors the dependency set and build conventions of Kissflow's own `@kissflow/create-app` scaffold (relative `base`, `manifest.json` `{Category:"Application",Framework:"React"}`, zip of `dist/`), so the app can be packaged as a Kissflow Custom UI in Phase 6. All data goes through a typed service layer with a mock implementation. There is no network access in this phase.

## Users
A prospect demo for Dutco Construction (UAE contractor). Personas (all fictional, see PLAN.md §2):
- **Executive** (Operations Director): wants DLP cost, SLA and compliance posture at a glance.
- **Helpdesk coordinator / FM manager** (fictional in-house FM operator): triages requests all day, desktop, dense queues.
- **DLP & handover manager** (Dutco): owns defects after handover and recovers cost from subcontractors.
- **Subcontractor supervisor and HVAC technician**: the technician is on a phone, often outdoors or in plant rooms at 45 °C, gloved, one-handed, bright sunlight or dim risers.
- **Resident**: raises a request from a phone, often in Arabic.
- **Compliance officer, HSE officer, plant & fleet manager.**
The presenter (Thomas, Kissflow) drives the demo with a role switcher and guided mode, in front of a mixed exec + ops audience.

## Product Purpose
A CAFM product shaped for a **contractor**. It follows an asset from construction handover into operations, and knows at every request whether the cost is Dutco's liability (DLP / decennial) or chargeable. It routes liability work back-to-back to the installing subcontractor and proves the recovered cost. Success for the POC is a prospect saying "this understands how a contractor actually works", and Kissflow proving it can host a product-grade custom UI.

## Positioning
Contractor-shaped, not FM-shaped. The distinctive features are the liability engine (DLP / chargeable / decennial-review at intake), the diagnosis challenge (repeat-fault and sibling-batch warnings before close-out), batch-defect detection across a subcontractor's installed base, and an append-only activity log that drives the client report. It runs on Kissflow, so Dutco can extend it to permits, plant and site operations.

## Operating Context
Dubai (GST, AED, summer AC peak Jun–Sep). The demo clock is fixed at Tue 18 Aug 2026 14:05 GST. Bilingual English/Arabic with full RTL. Desktop for office roles, phone for technicians and residents, a wall display for compliance *(inferred)*. The guided demo runs 15–18 minutes.

## Capabilities and Constraints
- Mock data only in this phase. No fetch and no real endpoints. The service/adapter interfaces will later be backed by the Kissflow SDK (`kf.app.*`, `kf.api`, `kf.user.AppRoles`).
- AI features are **mocked and labelled "AI preview"**. Kissflow runtime AI is unverified (PLAN §6.1), so they must never be presented as shipped Kissflow capability.
- WhatsApp and inbound email appear only as "integration-ready" tiles.
- Legal references stay generic ("statutory decennial liability") until Q16 is answered.
- Activity log wording is "append-only", never "immutable".

## Brand Commitments
- Neutral product identity with a "Prepared for Dutco Construction" label. **No Dutco logo or colours.**
- Product name: **CAFM** (Thomas, 22 Sep 2026; answers Q2). Set in `app.name` in the i18n dictionaries.
- The fictional FM operator is shown as "Group FM Services (demo)" *(provisional, Q3 open)*.
- Western digits in Arabic *(provisional, Q7 open)*.

## Evidence on Hand
No real Dutco data or assets. All buildings, people, subcontractors, numbers and messages are synthetic and must be labelled DEMO in the app. Facilio's outcome numbers must not appear anywhere.

## Product Principles
1. Liability is the first thing you see: every request shows who pays before anyone acts.
2. Time is visible: SLA clocks start at first contact and are always on screen.
3. The field is the source of truth: the technician's phone flow is as good as the exec dashboard.
4. Show the evidence: every number drills to logged events.
5. Honest about what's real: previews and integrations are labelled as such.

## Accessibility & Inclusion
WCAG 2.2 AA. Full RTL mirroring, Arabic typography that is as good as the English. Large touch targets (≥44 px) and sunlight-readable contrast on technician screens. Status is never conveyed by colour alone (RAG always has a label or icon). Reduced motion is respected.
