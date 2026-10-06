# 01 · Orientation

## What this is

A working demo of **CAFM** — computer-aided facilities management — built on Kissflow and shown
to construction and facilities-management prospects in the Gulf. It was built for a specific
prospect (Dutco Construction, a large Dubai contractor) and is now re-usable for any of them:
the client's name, logo and brand colour are editable in the app, and so is the estate of
buildings. See [07-client-demos.md](07-client-demos.md).

It is a demo, so it is allowed to be beautiful and narrow. It is not a product. Everything it
shows, though, is real: real Kissflow forms, processes and boards underneath, real records, a
real AI voice call. Nothing on screen is faked for the camera.

## The argument it makes

A UAE contractor finishes a tower and hands it over. From that moment they carry a **defects
liability period** (DLP), usually 12 months, sometimes 18 or 24. During it:

- a fault that is **their own defect** is theirs to fix, at their cost
- a fault caused by **use, misuse or wear** is **chargeable** to the building owner
- some structural matters sit under a much longer **decennial** liability

The money is in telling those apart, quickly, with evidence, before the period ends. Most
contractors do it with WhatsApp groups, a site engineer's memory and a spreadsheet. When the
period closes, unrecovered costs are simply absorbed.

So the demo's spine is: **a fault is reported → the system decides whose cost it is → the work
is done with evidence attached → the cost is recovered from whoever owes it.** Every screen
serves that. The sidebar link "Before: the group chat" shows the WhatsApp mess it replaces —
that contrast is the pitch.

Read [`WHY_CAFM.md`](../WHY_CAFM.md) for the version you can say out loud, and
[`DOMAIN_GUIDE.md`](../DOMAIN_GUIDE.md) for the regional background with sources.

## The cast

Switch persona from the avatar menu, top right. Each lands somewhere different.

**The contractor (Dutco, or whoever you have re-branded to)**

| Person | Role | Lands on |
|---|---|---|
| Hamdan Al Falasi | Operations director | Command centre |
| Khalid Al Hammadi | DLP and handover manager | DLP & recovery |
| Imran Siddiqui | HSE officer | Permits to work |
| Viktor Petrov | Plant and fleet manager | Plant & fleet |

**The FM operator (a separate company running the building)**

| Person | Role | Lands on |
|---|---|---|
| Sarah Whitfield | Facilities manager | Work orders |
| Arjun Menon | Helpdesk coordinator | Intake |
| Mariam Nasser | Fire and life-safety officer | Compliance |

**The subcontractor** — Rashid Qureshi supervises; Joel Santos is the HVAC technician and gets
a phone screen.

**The resident** — Layla Al Suwaidi, apartment 1402. Phone screen, and the person who makes the
voice call.

**Admin** — Nadia Farouk. Gets the data browser, AI settings, branding and properties.

Technician and resident screens render inside a phone frame when the window is wide, so you can
show them in the same browser without resizing.

## What is in the demo world

Deliberately small, so anyone can hold it in their head: **one building** (Qamar Residences,
handed over in March, inside its 12-month DLP), 24 apartments, 6 assets, 5 subcontractors, a
handful of open and closed work orders chosen to cover every liability outcome, plus snags,
certificates, PPM schedules and a couple of plant items.

The reference lists behind it are complete — 11 request types, 17 fault causes, 4 SLA targets,
13 asset classes — because the app and the voice agent look things up in them.

Details in [05-demo-data.md](05-demo-data.md).

## The moments worth showing

In rough order of how much they land:

1. **The voice call.** A resident rings in, in English or Arabic, interrupts the agent
   mid-sentence, and a correctly triaged work order exists at the end of it.
2. **Liability decided automatically.** A fan coil fault inside the DLP comes back "contractor
   liable", routed to the subcontractor who installed it, with the reason shown.
3. **The challenge.** When a technician tries to close a job with a cause that would move the
   cost, the app shows them that this asset has failed three times and asks them to confirm.
4. **The batch defect.** The same actuator failing across one batch of units, all installed by
   one subcontractor — visible on the command centre, which is the recovery case.
5. **Arabic.** One button, the whole app flips, including the voice agent.
6. **Add their own building, live.** See [07-client-demos.md](07-client-demos.md).

[`HAPPY_FLOWS.md`](../HAPPY_FLOWS.md) has the click-by-click version of each.

## What it deliberately does not do

No integrations are switched on (email, ERP, BMS). No real portal for residents — the resident
is a role in the app. No per-user Kissflow logins in the demo; the Custom UI runs as whoever
opened it. Those are production concerns and are listed in
[`PRODUCTION_TODO.md`](../PRODUCTION_TODO.md).
