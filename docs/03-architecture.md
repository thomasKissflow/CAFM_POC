# 03 · Architecture

## The shape of it

```
                 screens (27 of them)
                        │  useQuery / useServices
                        ▼
                 Services  ← one interface, in app/src/services/types.ts
                   ╱           ╲
        mock implementation     Kissflow implementation
        (generated world)       (hydrate from Kissflow, write back through it)
                   ╲           ╱
                    domain/  ← the rules. pure, tested, no UI, no network
```

The point of the middle layer is that **no screen knows whether it is talking to Kissflow**.
Everything a screen can do is a method on `Services`. Swap the implementation and every screen
keeps working, which is why the same code runs offline for design work and live for a demo.

## Where things live

| Path | What |
|---|---|
| `app/src/screens/` | One file per screen. `admin/` holds the four admin screens, `tech/` the technician's phone screens |
| `app/src/app/` | The shell: `Shell.tsx` (header, sidebar, phone frame), `App.tsx` (routes), `session.tsx` (who you are), `lookups.ts` (directory helpers) |
| `app/src/domain/` | `liability.ts` — whose cost is this. `sla.ts` — response and resolve clocks. `time.ts` — Gulf time arithmetic. `types.ts` — the vocabulary. `demoTime.ts` — moving the demo world to today |
| `app/src/services/types.ts` | **The contract.** Read this before anything else in `services/` |
| `app/src/services/mock/` | The generated world: `seed.ts` builds it, `reference.ts` holds the fixed reference data, `workflow.ts` the state machine |
| `app/src/services/kissflow/` | The adapter: `hydrate.ts` (Kissflow → the app's shapes), `index.ts` (writes back), `ids.ts` (every Kissflow id and value map), `sdk.ts` (a typed wrapper over Kissflow's SDK) |
| `app/src/i18n/` | `en.ts`, `ar.ts`, and `index.tsx` which also does the client-name substitution |
| `app/src/brand/` | Client branding: `color.ts` derives a whole palette from one hex, `brand.ts` stores it |
| `app/src/ui/primitives.tsx` | Buttons, chips, panels, fields. Use these; do not invent new ones casually |
| `app/src/voice/` | The voice agent — `live/` is Gemini Live, `mockBrain.ts` is the scripted demo call |
| `app/src/ai/` | Which AI provider is in play and the self-test |
| `app/server/` | The AI backend written for Cloud Run. In development, Vite mounts it as middleware |
| `app/scripts/` | Tests that drive a real browser, the gate, the screenshot sweep, the video pipeline |
| `data-model/` | Node scripts that build, seed, check and repair the Kissflow app. Separate from the frontend on purpose |

## Rules that keep it coherent

**The domain layer is the authority.** Whether a fault is the contractor's cost is decided in
`domain/liability.ts` and nowhere else. Kissflow computes the same answer in its own formulas
so the records agree with the screens — if you change one, change both, and say so in
`DECISIONS.md`.

**Screens do not fetch.** They call `useQuery((s) => s.something.list())`. The hook re-runs
whenever the services layer announces a change, so a write anywhere refreshes every screen that
is watching.

**The adapter writes to Kissflow and to memory.** Most writes go to the mock implementation
first (so the screen updates instantly) and then sync to Kissflow; if Kissflow refuses, the user
is told. Adding a building is the exception — it writes to Kissflow first, so a building
Kissflow rejects never appears on screen. See `app/src/services/kissflow/index.ts`.

**Nothing is pinned to one building.** The demo world happens to have one, but screens read the
estate from the directory. If you find yourself typing `"S-QMR"` into a screen, stop — use
`useSiteChoice(dir)` from `app/src/app/lookups.ts`.

**Both languages, always.** Every user-facing string has an English and an Arabic form. Screens
built later use a local `L("English", "عربي")` helper; earlier screens use the `t.` dictionary.
Either is fine; a missing Arabic string is not.

## Styling

Tailwind v4, configured in `app/src/styles/index.css` — there is no `tailwind.config.js`. Colour,
spacing and shadow tokens are CSS custom properties in that file. The accent colour is swapped
at runtime by the branding feature, so **never hardcode the accent**; use the `fluoro` tokens.

Liability colours (`--color-dlp*`) are deliberately separate from the accent, so a client's
brand colour can never make "contractor liable" look like "chargeable".

The visual language is survey and setting-out: graduated staffs, chainage rulers, hairline
seams, a fair-faced-concrete ground with white sheets on it. `DESIGN.md` at the root is the
full description. It is not a generic admin template and should not drift into one.

## Routing

HashRouter — `#/command`, `#/queue`, `#/wo/WO-26-04832`. Hash routing is required because the
app is served from Kissflow's static host, which does not do SPA rewrites. A consequence worth
knowing: navigating between hash routes does **not** reload the page, so anything read once at
start-up (the persona, for instance) needs an explicit reload.
