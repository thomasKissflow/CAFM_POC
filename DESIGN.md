---
name: CAFM
description: Contractor-side CAFM drawn as survey setting-out. Every obligation is read off a graduated staff or chainage.
colors:
  fluoro: "#ff5a1f"
  fluoro-ink: "#b23b09"
  fluoro-wash: "#ffe8dd"
  breach: "#c8161d"
  breach-wash: "#fde4e2"
  risk: "#a26400"
  risk-fill: "#f5b41c"
  risk-wash: "#fdf1d2"
  ok: "#1d7249"
  ok-wash: "#dcefe3"
  chargeable: "#2349a8"
  chargeable-wash: "#e2e9f8"
  decennial: "#6a3d9e"
  decennial-wash: "#eee7f7"
  ownops: "#475552"
  ownops-wash: "#e3e8e6"
  ground: "#e4e7e4"
  ground-2: "#d8dcd9"
  sheet: "#fbfbfa"
  sheet-2: "#f2f3f1"
  ink: "#16191c"
  ink-2: "#3c4248"
  ink-3: "#5c636a"
  seam: "#cbcfcc"
  seam-strong: "#a3a9a6"
typography:
  headline:
    fontFamily: "Readex Pro Variable, Readex Pro, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Readex Pro Variable, Readex Pro, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Readex Pro Variable, Readex Pro, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Readex Pro Variable, Readex Pro, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
  chip:
    fontFamily: "Readex Pro Variable, Readex Pro, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1
  reading-lead:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\" 1"
  reading:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  page: "28px"
components:
  button-primary:
    backgroundColor: "{colors.fluoro}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "#ff6b36"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.sheet-2}"
  button-danger:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.breach}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  chip-liability-dlp:
    backgroundColor: "{colors.fluoro-wash}"
    textColor: "{colors.fluoro-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "22px"
  chip-liability-chargeable:
    backgroundColor: "{colors.chargeable-wash}"
    textColor: "{colors.chargeable}"
    typography: "{typography.chip}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "22px"
  chip-sla-breached:
    backgroundColor: "{colors.breach}"
    textColor: "{colors.sheet}"
    typography: "{typography.chip}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "22px"
  panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  nav-item-active:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "36px"
  segmented-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "28px"
---

# Design System: CAFM

## Overview

**Creative North Star: "The Setting-Out Sheet"**

CAFM is laid out the way a site engineer sets out a building: every asset is located, and every obligation is measured against a graduated instrument. The ground is fair-faced concrete, a cool pale grey. Work sits on it as white sheets joined by hairline seams. Ink is near-black. Colour appears only as a survey mark: fluorescent orange where the contractor is liable or where the primary action lives, level-staff red for a breach, survey blue for work that can be charged back. The UI is read in the same order as a field book. Who pays and how much time is left come first, and the label comes second.

The screens are dense and ruled. Hierarchy comes from type size and ruled rows, not from boxes inside boxes. The command centre, for example, is one sheet divided by seams rather than a row of KPI tiles. Numbers that are readings (IDs, chainage, clocks, money, percentages) are set in a monospaced face, so they line up like instrument output. Everything else uses one bilingual humanist sans that carries English and Arabic at equal weight. The layout mirrors fully for RTL through logical properties. Latin readings stay left-to-right inside `bdi`.

The world rejects the card-grid admin dashboard: a dark sidebar, a row of KPI tiles and drop-shadowed cards.

**Key Characteristics:**
- Cool concrete ground, white sheets, 1px seams. Flat at rest.
- Colour is a survey mark with a fixed meaning, and it is always paired with a word.
- Two faces: Readex Pro for language, JetBrains Mono for readings.
- 4px corners. Sheets and chips have square-ish, drafted edges.
- Signature instruments: the level-staff SLA gauge, vertical staff readings and the DLP chainage ruler.
- Setting-out crosshair corners mark the selected record. A hazard diagonal marks only blocked or breached states.
- Full RTL parity. Arabic body text gets a looser line height (1.65).

## Colors

The palette is a neutral concrete-and-paper field with a small set of survey marks. Each mark means one thing.

### Primary
- **Survey Fluoro** (`fluoro`): marks contractor (DLP) liability and the single primary action on a screen, such as "Start guided demo". It is also used for today's peg on the chainage, the SLA reading line, the focus ring, the caret, text selection, the active mobile-tab underline and crosshair corners. It fills the recovered-money bar chart, because recovered money is liability money.
- **Fluoro Ink** (`fluoro-ink`): the text-safe darker orange for liability figures and labels on sheet or wash, such as the recovered AED ledger lead and the DLP chip text. Use it wherever fluoro would be text.
- **Fluoro Wash** (`fluoro-wash`): the ground for DLP chips and the liability banner on a work order.

### Secondary (state phases)
- **Level-Staff Red** (`breach`, wash `breach-wash`): breach, missed, expired, P1. The staff graduations past 100% are red, and the solid red chip is reserved for breached SLAs, P1 and the red compliance RAG.
- **Survey Amber** (`risk` text, `risk-fill` graphic, `risk-wash` ground): the at-risk band (75 to 100% of allowance), in-progress status and amber RAG. `risk-fill` is never used for text.
- **Benchmark Green** (`ok`, `ok-wash`): met, resolved, valid, at or above target.

### Tertiary (liability classes)
- **Survey Blue** (`chargeable`, `chargeable-wash`): chargeable work that can be recovered from the client or a third party.
- **Decennial Violet** (`decennial`, `decennial-wash`): decennial-liability review.
- **Own-Ops Slate** (`ownops`, `ownops-wash`): the contractor's own operations.

### Neutral
- **Fair-Faced Concrete** (`ground`): the page ground behind every sheet. `ground-2` is the darker concrete used for the side rail and the mobile drawer.
- **Drawing Sheet** (`sheet`): panels, inputs, the title strip and secondary buttons. `sheet-2` is the recessed sheet used for hover, the unfilled staff and skeletons.
- **Drafting Ink** (`ink`): primary text, the ink button, the P2 chip, the selected segment, tooltips and the demo panel. `ink-2` is for secondary text and labels. `ink-3` is for tertiary meta, placeholders and the dashed AI-preview outline.
- **Hairline Seam** (`seam`): all 1px dividers and sheet borders. `seam-strong` is for control borders, instrument outlines and the title-strip rule.

### Named Rules
**The Survey Mark Rule.** Each chromatic colour has one meaning: fluoro means liability or the primary action, red means breach, blue means chargeable. Never use a mark decoratively, and never let colour be the only signal. Every liability chip carries its name next to a small rotated peg mark.

**The One Fluoro Action Rule.** A screen has at most one fluoro button. Secondary and inline actions use ink, secondary or ghost buttons. The batch "Raise batch DLP claim" button is ink, not fluoro.

**The Text-Safe Mark Rule.** Fluoro and amber are graphic colours. When they carry text on a light ground, switch to `fluoro-ink` or `risk`.

## Typography

**Body Font:** Readex Pro Variable (with system-ui, Segoe UI, sans-serif)
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, SFMono-Regular, monospace)

**Character:** Readex Pro is a single bilingual sans, even and a little rounded, and it carries Arabic and Latin at the same optical weight. JetBrains Mono is the instrument readout. It sits beside the sans the way a total-station display sits beside handwritten notes.

### Hierarchy
- **Headline** (600, 22px, 1.25, -0.01em): the page title in the page header. Use one per screen.
- **Reading Lead** (mono 600, 32px, 1, -0.03em, tabular): the lead figure in the liability ledger. Smaller ledger values use 17 to 20px mono at weight 500 to 600.
- **Title** (600, 13.5px): panel and section titles in the panel header strip, with meta in 12px `ink-3` beside them.
- **Body** (400, 14px, 1.5; 1.65 in RTL): running text and controls. Subtitles are 13.5px `ink-2`, capped at 70ch.
- **Label** (500, 12.5px, `ink-2`): field labels, row labels and nav meta. Side-rail group labels are 11px, weight 500, `ink-3` and sentence case.
- **Chip** (500, 11.5px, leading 1): chips and tags.
- **Reading** (mono 400, 12px, -0.01em, tabular): work-order IDs, asset tags, chainage (`CH 0+170`), clocks and durations ("4h 32min left"), times in the activity log, and variance and target figures.

### Named Rules
**The Readings-Are-Mono Rule.** Monospace is reserved for measured values: IDs, tags, chainage, clocks, durations, money and percentages in ledgers. Words are never set in mono. A Latin reading inside Arabic text is wrapped in `<bdi dir="ltr">`.

**The Size-Not-Boxes Rule.** Executive hierarchy comes from type size inside ruled rows. A bigger number does not get a bigger box.

## Layout

The desktop shell has a 56px sheet-coloured title strip closed by a 1px `seam-strong` rule. It holds the product mark, the demo clock, the language toggle, the role switcher and the one fluoro action. Below it, a 228px concrete side rail (`ground-2`) is sticky, grouped and separated from content by a seam. The main area is padded 28px across and 24px vertically at md and above (16px and 20px on small screens), capped at 1440px, and built on a 12-column grid with 16px gaps.

Spacing uses a 4px base. Panel bodies have 16px padding, panel header strips have a 44px minimum height with 16px inline padding, and ruled rows have 8 to 10px vertical padding. Related sections share one sheet and are divided by vertical seams rather than split into separate cards, as in the command centre's assurance strip.

Technician and resident roles render inside a 390 by 800px phone frame on desktop screens 900px and wider, and full-bleed on a phone. They use a 56px sticky bottom tab bar whose active tab has a 2px fluoro underline. Page headers wrap their actions under the title. Ledger rows collapse from two columns (label | reading) to stacked rows below sm.

RTL uses logical properties throughout (`inset-inline-*`, `ms`/`me`, `ps`/`pe`, `border-e`). Directional glyphs and SVG instruments mirror with `-scale-x-100`.

## Elevation & Depth

The system is flat. Depth comes from the tone step between concrete ground and white sheet, and from 1px seams. Sheets never carry a resting shadow. Two shadows exist, and each one is triggered by state or overlay.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 2px rgb(22 25 28 / 0.06), 0 8px 24px -12px rgb(22 25 28 / 0.18)`): a selected item raised off the concrete (the active side-rail item, the selected category tile) or a hover response on a board card.
- **Float** (`box-shadow: 0 2px 4px rgb(22 25 28 / 0.08), 0 20px 48px -16px rgb(22 25 28 / 0.32)`): true overlays only. Examples are tooltips, dropdowns, the mobile drawer, the demo panel, the phone frame and the in-flow challenge dialog.

### Named Rules
**The Flat Sheet Rule.** Sheets and panels are flat at rest: a border in `seam`, no shadow. Lift answers selection or hover. Float belongs to things that sit above the page.

## Shapes

Corners are drafted, not soft. Sheets, controls and buttons use a 4px radius. Chips, tags and segmented thumbs use 3px. Floating panels (the demo panel and dialogs) use 6px. Round shapes are reserved for avatars, the peg head and the summer-rule dot. Borders are always 1px. The only heavier strokes are the 2px ink rule under a printed report header and the 2px setting-out marks.

### Named Rules
**The Crosshair Rule.** A selected or current record is marked by two 10px fluoro corner ticks, top-start and bottom-end, which mirror in RTL. Use this for the active nav item, the current role and the selected category. Do not use a filled accent background.

**The Hazard Rule.** The -45 degree diagonal stripe (red at 5px on and 5px off, or a darker overlay on red) means blocked or breached only. Examples are breached work-order cards (a 4px top band), missed PPM cells, the expired compliance segment, the on-hold status (soft variant) and the elapsed stretch of the chainage (soft variant). Do not use it for emphasis.

**The Preview Outline Rule.** Anything produced by AI carries a 1px dashed `ink-3` outline and the "AI preview" tag. Only AI content and future or upcoming states use dashed borders.

## Components

### Buttons
Buttons are tactile and plain, like marker paint on a sheet.
- **Shape:** 4px corners. Heights are 32px (sm), 36px (md) and 48px (lg). Pressing nudges the button down 1px.
- **Primary (Fluoro):** fluoro fill, ink text at weight 600, a 1px `#e24a10` edge. Hover `#ff6b36`, active `#f04d12`. Use one per screen.
- **Ink:** ink fill, sheet text. Use it for confirmed in-context actions such as "Raise batch DLP claim" and "Ask".
- **Secondary:** sheet fill, `seam-strong` border. On hover the fill moves to `sheet-2` and the border to `ink-3`.
- **Ghost:** transparent. On hover it gets a 5% ink tint.
- **Danger:** sheet fill with red text and a 60% red border. It is kept apart from other actions.
- **Focus:** a 2px fluoro outline with a 2px offset, used globally.

### Chips
- **Style:** 22px tall, 3px corners, 11.5px at weight 500, with a 1px border tinted from the mark colour (30 to 50%) over its wash.
- **Liability chip:** a 2.5 by 1px peg mark rotated 12 degrees, followed by the liability name. It is never shown as colour alone.
- **Priority:** P1 is solid red, P2 solid ink, P3 recessed sheet and P4 outline. The ID is set in mono.
- **Status:** new is a dashed outline, in-progress uses amber wash, on-hold uses the soft hazard stripe, resolved uses green wash and cancelled is struck through.
- **RAG:** each state has a distinct shape as well as a colour: a green dot, an amber diamond and a white square on red.

### Cards / Containers (Sheets)
- **Corner Style:** 4px.
- **Background:** `sheet` on the `ground`.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** 1px `seam`. A breached card's border shifts to 50% red and gets the hazard top band.
- **Internal Padding:** a 44px header strip ruled by a seam, then a 16px body. Data-heavy lists use 0 padding with seam-divided rows.

### Inputs / Fields
- **Style:** 40px tall, sheet fill, 1px `seam-strong`, 4px corners, 14px text, `ink-3` placeholder, fluoro caret.
- **Focus:** the border shifts to ink and a 2px fluoro focus-visible outline appears. On hover the border moves to `ink-3`.
- **Labels:** 12.5px at weight 500 in `ink-2` above the field, with a 12px `ink-3` hint below.
- **Segmented control:** a sheet track with a `seam-strong` border. The selected segment is solid ink.

### Navigation
- **Side rail:** concrete `ground-2` with grouped 36px items (13.5px text, 16px icon at stroke 1.9) in `ink-2`. Hover gives a 60% sheet tint. The active item is a sheet chip with Lift and crosshair corners.
- **Title strip:** see Layout. The demo clock is mono, followed by a solid-ink temperature reading.
- **Mobile:** a bottom tab bar in 95% sheet with a blur behind it. The active tab uses ink text, a heavier icon stroke and a 2px fluoro underline.

### Level-Staff SLA Gauge (signature)
The SLA allowance is drawn as a horizontal E-pattern level staff scaled to 125%, so an overrun stays visible. It has alternating ink blocks at 5% steps, which turn red past 100%, and ticks at 25, 50, 75 and 100%, with the 100% tick in red. The track grounds are `sheet-2`, then `risk-wash` from 75%, then `breach-wash` from 100%. The elapsed bar fills in the phase colour, and a 2px fluoro reading line moves with the clock. A mono label after the gauge reads "3d 19h over" or "4h 32min left" in the phase colour. Heights are 10, 16 and 26px. The gauge mirrors in RTL.

### Vertical Staff Readings (signature)
Monthly SLA values appear as narrow 10px vertical staffs on an 80 to 100% scale, with quarter graduations. Each staff has an ink fill, or a green fill when it meets target, and a mono value above it. A dashed fluoro target line runs across all of them.

### DLP Chainage Ruler (signature)
The defects-liability period is drawn as a road chainage from the Taking-Over Certificate (`CH 0+000`, a 2px ink end post) to expiry (a 2px red end post). The road is a 10px `sheet-2` bar, with the elapsed stretch in soft hazard, month ticks and today's peg (a fluoro triangle, stem and pulsing head). Below it sit three mono-anchored readouts: start, the current chainage in `fluoro-ink` with elapsed and remaining days, and the end.

### Field-Book Ledger Row (signature)
A ledger row is a ruled row with the label on the start side and a mono reading on the end side. In variance form, a third line shows a signed variance against target (`+2.9 · target 95%`) in green or red. The lead row of the liability ledger scales its reading to the 32px Reading Lead.

### AI Preview Tag
A 20px chip with a dashed `ink-3` outline, a sparkle icon and the words "AI preview". Its tooltip explains that the content is a preview. It sits beside every AI-derived value, suggestion or translation, and the translated block itself also takes the dashed outline.

## Do's and Don'ts

### Do:
- **Do** place every surface as a `sheet` (#fbfbfa, 1px `seam`, 4px) on the concrete `ground`, and divide related content with seams inside one sheet.
- **Do** name the liability, SLA phase or RAG state in words beside every colour mark.
- **Do** set IDs, tags, chainage, clocks, durations and ledger money in JetBrains Mono with tabular numerals, and wrap Latin readings in `<bdi dir="ltr">` in Arabic contexts.
- **Do** show time against an allowance with the level-staff gauge, and the DLP period with the chainage ruler.
- **Do** mark the selected record with fluoro crosshair corners.
- **Do** tag every AI-derived element with the dashed "AI preview" outline.
- **Do** use logical properties for every inline offset, so RTL mirrors without overrides.

### Don't:
- **Don't** build a card-grid admin dashboard with a dark sidebar and KPI tiles. Put figures in ruled ledger rows at the size their importance deserves.
- **Don't** give sheets or panels a resting drop shadow. Lift is for selection or hover, and Float is for overlays.
- **Don't** use the hazard diagonal for anything other than blocked or breached states.
- **Don't** put more than one fluoro button on a screen, or use fluoro or amber as text colour on a light ground.
- **Don't** set words, labels or headings in monospace.
- **Don't** introduce corners above 6px on in-app surfaces.
