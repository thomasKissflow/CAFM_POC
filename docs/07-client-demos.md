# 07 · Showing it to a new prospect

The demo was built for one contractor and then made re-usable. Two admin screens do it, and
together they take about a minute in front of a client.

## Admin → Branding

Sets who the demo appears to be for.

- **Company name** — replaces the contractor's name everywhere: header, navigation, portfolio,
  DLP screen, the client report, and the Arabic wording too. The substitution is in
  `app/src/i18n/index.tsx`; Arabic is done as whole phrases, because swapping a word inside an
  Arabic construct produces nonsense.
- **Logo** — uploaded, resized to fit the header (max 320×80, PNG, falling back to JPEG on
  white if it is still too large). The client's logo leads the header; a small "Built on
  Kissflow" sits in the sidebar footer.
- **Accent colour** — eight presets, a picker, or paste the client's hex.

Everything previews live as you change it and is only written when you press Save. Saved
branding lives in Kissflow, so it follows you to any machine and anyone opening the app sees
the same.

### The colour is safe by construction

`app/src/brand/color.ts` derives every shade — hover, pressed, border, the pale chip
background, and the text colour on top — from the single hex, in **OKLCH**, so a navy and a
yellow both end up with a readable dark text shade and a usable pale tint. Plain HSL cannot
promise that. `color.test.ts` asserts contrast for navy, bright yellow, near-black and
near-white brands.

**Liability colours never follow the brand.** There are separate `--color-dlp*` tokens, because
a navy brand was turning "contractor liable" chips navy and making them look like the blue
"chargeable" ones. Liability has to keep its signal.

### `?brand=generic`

Strips the client name everywhere and shows neutral wording, whatever is saved. The demo film
records with this flag so it is not tied to one prospect. Keep it working.

## Admin → Properties

Adds the prospect's own building to the estate, live.

Fill in the name, when it was handed over and for how long the contractor carries the defects,
the floor range and apartments per floor, whether every apartment gets a fan coil, and which
plant the building has. It tells you how many records it is about to create, then writes them
to **Kissflow first** — so a building Kissflow refuses never appears on screen — and only then
into memory, with the Kissflow ids registered so a work order can be raised against it
immediately.

A small tower takes a couple of seconds. Rows are created a few at a time, not in one burst.

Apartment numbering follows the estate's convention: `1402` is flat 02 on floor 14.

Each building in the list has a **remove** button, which deletes its apartments and assets from
Kissflow. It refuses to remove a building that has work orders against it, and tells you how
many. That is the clean-up path after a meeting.

## The flow to rehearse

1. **Branding** — type their name, drop in their logo, pick their colour. Save.
2. **Properties** — add one of their towers.
3. **Portfolio** — their tower is on the register with its liability clock already counting
   down.
4. Raise a request against it — it comes back "contractor liable", routed to the installing
   subcontractor.

The point to make out loud: *nothing here was prepared for you this morning.*

## What a newly added building does not have

Apartments and assets, yes. Certificates, PPM schedules and history, no — so Compliance and
Planned maintenance show it as empty. For the "this is your tower" moment that is fine, and the
screens that matter look right. Generating a starter certificate and schedule with it is an
open suggestion (**Q56**).

## If you are preparing for a specific prospect

- Set branding and add their building **before** the meeting, not during, unless adding it live
  is the point you are making.
- Check the summer rule (see [05-demo-data.md](05-demo-data.md)) — between October and May the
  "P2, because summer" beat does not fire.
- Remember the demo world is fictional. Use their **name**, their **logo**, their **colour**
  and their **building**; do not invent their numbers.
