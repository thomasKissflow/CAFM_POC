# 05 · The demo world

## Two sources, one shape

The app can run on either, and screens cannot tell the difference:

- **Generated** — `app/src/services/mock/seed.ts` builds the whole world deterministically from
  a fixed seed. No network. This is what `?data=mock` gives you.
- **Kissflow** — `app/src/services/kissflow/hydrate.ts` reads the live rows and turns them into
  the same shapes.

Kissflow was itself seeded from the generator, so the two agree. The generator still supplies
what Kissflow does not store: Arabic text, photographs, checklists, history timelines and the
WhatsApp chat. They are matched on natural keys — building code, QR code, work order reference.

## What is in it

One building, on purpose. A small world is easier to narrate and easier to debug.

| | |
|---|---|
| Qamar Residences (`QMR`) | Residential tower, handed over 1 March, 12-month DLP, 24 apartments modelled |
| Assets | 6 — fan coils in specific apartments, plus plant |
| Subcontractors | 5, one per trade. Coolbreeze MEP is the HVAC one and carries the story |
| Work orders | A few open, a dozen closed, chosen to cover recovered / pending / disputed back-charges |
| Snags | 4, one per board column |
| Certificates, PPM, plant | 2 of each, 1 breakdown |

Reference lists are complete, not minimal: 11 request types, 17 fault causes, 4 SLA targets,
13 asset classes. The voice agent looks records up in them, so a gap there breaks a call.

### The story asset

`A-QMR-FCU-1402-01` — the fan coil in Layla's apartment — has deliberate history: three
failures, the last two with different causes, and siblings from the same batch failing the same
way. That is what makes the diagnosis challenge and the batch-defect alert fire. If you reseed,
keep it.

## Reseeding

From `data-model/`:

```bash
node backup-all.mjs
node seed/seed.mjs all --minimal
node seed/seed-live-wos.mjs --minimal
```

Both seeders are idempotent: they match on natural keys and create only what is missing.
Nothing is updated or deleted.

To start completely clean you would run `wipe-data.mjs --yes` first — **back up before you do,
and do not do it without being asked.** It cannot delete process items; it rejects them.

The generator's own output can be exported with `data-model/seed/export-mock.ts`, which is what
produced `seed/mock-db.json`.

## Time: the thing that surprises people

The demo world is written around a **fixed design date** and **translated to today** every time
it loads. A job that was designed to be two hours from breaching its SLA is still two hours from
breaching, whenever you open it. That is why the demo never goes stale and never needs
reseeding.

- `app/src/domain/demoTime.ts` does the translation — `shiftDemoDates`, `shiftDemoRows`.
- Records written **since** the demo started using the real clock are left exactly as Kissflow
  stored them. A ticket you raise now is stamped now.
- Dates that used to be hardcoded (DLP end dates, month lists, the PPM window) are all derived
  now. If you add a screen with a month range, derive it with `monthKeysEndingAt` — do not type
  a list of months.

### One live consequence

The **summer rule** lifts AC faults from P3 to P2 between June and September, because an AC
failure in a Dubai July is a different thing. It is date-driven and honest, which means it does
not fire from October to May, and the "P2, because summer" beat disappears from the demo in
those months. Tests follow the rule rather than asserting P2, so they stay green either way.
This is logged as **Q54** and is an open decision: widen the window, add a demo switch, or
leave it. Changing it means changing the Kissflow `Summer Flag` formula too, so the records and
the screens keep agreeing.

## Weather

The header temperature is real Dubai weather from Open-Meteo. **One call per browser session** —
the first screen that asks starts it, everything else shares the promise, and the answer is
cached in `sessionStorage`. If the service is unreachable it falls back to a demo value and says
so on hover. `app/src/services/weather.ts`.

Screenshot sweeps and the video recorder pin the temperature so runs stay comparable and do not
hammer the service.
