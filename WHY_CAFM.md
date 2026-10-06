# Why this matters: the CAFM demo in plain words

Written for Thomas to use when showing the demo. Claims are labelled: **FACT (domain)** is from a cited public source (see PLAN.md §11), **DEMO** is fictional data, **ASSUMPTION** is our reading and should be validated with Dutco. There are no invented percentages or savings figures anywhere in this file.

---

## 1. The problem in one paragraph

A contractor's exposure does not end at handover. The Taking-Over Certificate starts a **12-month defects liability period** (FACT, domain: typical under FIDIC), structural exposure runs for **ten years** under the UAE Civil Code (FACT, domain), and the money only comes back if the defect can be pushed to the **subcontractor who installed the thing** (back-to-back, contractual). So for a year after a tower is handed over, every resident complaint is a small financial question: *is this ours to fix for free, is it chargeable to the owner, or is it the subcontractor's?* Most contractors answer that question with phone calls, WhatsApp groups and a spreadsheet, months after the money was spent.

## 2. How it is handled today (ASSUMPTION, to validate with Dutco)

- A resident calls or messages the building team. The request lives in **someone's phone**.
- The team forwards it to whoever is free, usually in a **WhatsApp group**. Photos land there too, and are lost there.
- Whether the job is inside the defects period is decided **from memory**, or by someone opening a folder of handover documents.
- Costs are chased **at the end of the month**, if at all. Evidence of what the technician actually found is thin, so the subcontractor disputes it.
- Compliance (fire certificates, Civil Defence approvals, insurance expiry) sits in **spreadsheets with manual reminders**.
- Reporting to the client is **assembled by hand** for each meeting.

The cost of this is not mainly software. It is: time spent re-asking the same questions, jobs sent to the wrong party, defects paid for twice, recoveries never claimed because nobody could prove them, and a client who sees chaos rather than control.

## 3. What this demo does differently

**1. The liability decision is made at the moment the request arrives, not months later.**
Every request is scored automatically against the building's defects dates, the asset's warranty, the fault cause, and whether the work is Dutco's own operation. The result is visible on the request itself: **DLP (contractor liable)**, **chargeable to owner**, **warranty**, or **structural**. The rules are Kissflow formulas, not a person's memory, so they are consistent at 2am and during the summer AC rush.

**2. The money follows automatically.**
When a job closes inside the defects period with a cause that is the installer's fault, a **back-charge to that subcontractor** follows, with the evidence attached: the photos, the technician's notes, the timestamps. That turns "we think they owe us" into a documented claim.

**3. A resident can just talk.**
The voice agent answers in **English or Arabic**, asks only what is missing, lets the caller interrupt, and logs the work order with the right priority while they are still on the line. It reads back the real reference number the system generated. For the caller, there is no app to learn and no form to fill; for the helpdesk, there is no typing up of a phone call afterwards.

**4. Nothing has to be typed twice.**
The call transcript, the summary, the key points and the actions are written onto the request automatically. A supervisor reading the job an hour later sees what the resident actually said, in a paragraph, not a recording.

**5. The summer rule, the vulnerable occupant, and other things people forget.**
A dropped AC in August with a baby in the flat is not the same as a dripping tap. The demo encodes those judgements once: a summer uplift on AC faults, a flag when someone at home is vulnerable, safety hazards raised immediately. **DEMO/ASSUMPTION**: the exact priority matrix and the summer window are demo values to be agreed with Dutco.

**6. Everyone sees the same thing.**
Executives see liability and recovery in money. FM sees the queue and the clocks. Technicians see their jobs on a phone, with photos and checklists. Compliance sees certificates expiring. The client report writes itself from the same data.

## 4. What the AI actually does (and what it does not)

| Does | Does not |
|---|---|
| Talks to a resident in English or Arabic, and fills in the job card while listening | Decide liability or cost: those are the system's rules, not the model's opinion |
| Writes a summary, key points, actions and open questions for every call | Invent reference numbers, times or prices: it reads back what the system generated |
| Flags sentiment, repeat complaints and issues worth a manager's attention | Replace the helpdesk: anything unclear stays a question for a person |
| Suggests follow-ups from what was said | Take irreversible action on its own |

Every call is stored with its transcript, so anything the AI produced can be checked against what was actually said.

## 5. Why Kissflow, specifically

- **The whole experience is one Kissflow Custom UI app**: the screens are ours, the data and workflow are Kissflow's. A prospect sees a product, not a form builder.
- **The rules live in the platform**, not in code: liability, priority, SLA and escalation are Kissflow formulas and workflow steps, which a Dutco admin can change later without a developer.
- **The work is real workflow**: approvals, step permissions, role-based visibility, an audit trail per item. That is what turns a demo into an operating system for the team.
- **Nothing is locked in a vendor's black box**: the data model is plain (buildings, units, assets, work orders, subcontractors, certificates), exportable and reportable.

## 6. What to show, in five minutes

1. **Command centre**: liability ledger and the clocks closest to breach. "This is the money question, answered continuously."
2. **A resident call** (voice): talk to it, interrupt it, watch the job card fill and the work order appear with the summer rule applied.
3. **The work order**: liability decided, subcontractor dispatched, SLA clocks running, transcript attached.
4. **Technician on a phone**: accept, arrive, photos, root cause, close.
5. **DLP & recovery**: the back-charge raised from that job, with its evidence, and the year-to-date recovery.
6. *(If asked)* **Admin → data browser**: every record is real, in Kissflow, not mocked up.

## 7. Honest limits of the demo (say these before someone finds them)

- All buildings, people, subcontractors and figures are **fictional demo data**. No real Dutco project is used.
- The FM operator in the story is a **fictional in-house operator**, not a named company.
- **Integrations are not switched on yet** (Phase 9): the cross-flow automations exist but are not firing.
- Live voice currently runs with a **demo-only key setup**; production moves it to a server (PRODUCTION_TODO.md).
- The rules encoded (priority matrix, summer window, DLP exclusions) are **our assumptions**, meant to be replaced by Dutco's contract terms.
- Decennial liability wording is based on a single law-firm reading of the 2025 Civil Code changes: **verify before putting it on a slide**.

## 8. The one-line version

**Today** a contractor discovers what a handed-over building cost them at the end of the year.
**Here** they know at the moment the resident speaks, in their own language, with the evidence already attached.
