# 08 · The demo film

`CAFM-demo-3min.mp4` at the repository root — 2 min 50 s, 1920×1080, H.264 + AAC. It plays
anywhere: Keynote, PowerPoint, Teams, LinkedIn. The narration script is in
[`VIDEO_SCRIPT.md`](../VIDEO_SCRIPT.md).

It is not a screen recording someone made by hand. It is **generated from the real app** by a
four-stage pipeline, so it can be rebuilt whenever the app changes, and re-cut without
re-recording.

## The pipeline

All four run from `app/`. The dev server must be running on 5188.

```bash
node scripts/video/narrate.mjs            # 1. voice-over  (needs GEMINI_API_KEY)
node scripts/video/record.mjs             # 2. screen capture
node scripts/video/assemble.mjs --pad 700 --speed 1.21   # 3+4. cut and mux
```

| Stage | File | What it does |
|---|---|---|
| Storyboard | `storyboard.mjs` | The film as data: 15 beats, each with what is said, what is shown, which persona, which language, and any action to perform. **This is the file you edit.** |
| Narrate | `narrate.mjs` | One WAV per beat via Gemini text-to-speech, plus a manifest of durations. `--force` regenerates; otherwise it reuses what is there |
| Record | `record.mjs` | Drives the real app in a 1080p Playwright browser, burning captions and Kissflow title cards into a layer **above** the app, so nothing about the product is altered. Each beat is held for exactly as long as its narration |
| Assemble | `assemble.mjs` | Cuts each beat out of the recording (dropping the page loads between them), lays the voice-over over it, and writes the MP4 |

Intermediate files land in `app/scripts/video/build/` — about 100 MB, and gitignored. Delete
the folder to start clean.

## Editing it

**To change what is said**, edit the beat's text in `storyboard.mjs`, then re-run
`narrate.mjs --force`, `record.mjs` and `assemble.mjs`.

**To change the pace without re-recording**, re-run `assemble.mjs` alone with different flags:

- `--pad <ms>` — quiet tail held after each line before the cut. 700 is current.
- `--speed <n>` — overall speed-up, picture and voice together so they stay in step. 1.21 is
  current; the voice stays natural up to about 1.25.
- `--name <x>` — output filename.

**To change what is shown**, edit the beat's `goto`, `role`, `lang` or `action`. The actions
available are at the top of `record.mjs` — playing a demo call, opening a work order, and so
on.

## Things that will catch you

- **The film records with `?brand=generic`**, so it carries no client name. Keep it that way
  unless you are making a film for one prospect.
- **A hash change does not reload the page.** When a beat switches persona, the recorder calls
  `page.reload()` explicitly. Forget that and the film shows the previous person's screens.
- **Phone screens need no special viewport.** The app already draws mobile roles inside a phone
  frame at desktop width — record at 1080p and leave it alone.
- **Arabic beats need Arabic selectors.** A button matched by its English label will not be
  found.
- **The weather and the signed-in role are pinned** by an init script, so runs are comparable.
- Gemini TTS costs money per run. `narrate.mjs` reuses existing WAVs unless you pass `--force`.

## If you want a different film

The pipeline is generic. A shorter cut for LinkedIn, a longer one for a workshop, or a
single-feature clip are all just a different beat list and a different `--speed`. Copy
`storyboard.mjs`, point `narrate` and `record` at the copy, and give `assemble` a new `--name`.
