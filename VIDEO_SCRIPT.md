# Demo film · narration script

`CAFM-demo-3min.mp4` · 2 min 50 s · 1920×1080 · H.264 + AAC.

The voice-over was generated with Gemini text-to-speech and the finished film runs at 1.21× so it lands under three minutes. To re-record it in your own voice, read the lines below at the timings shown.

| From | On screen | Narration |
|---|---|---|
| 0:00 | title card · "CAFM for contractors" | This is a facilities management application for a construction contractor, built on Kissflow. Everything you are about to see runs on live Kissflow data. |
| 0:10 | title card · "The problem" | When a building is handed over, the contractor still carries the defects for twelve months, and structural liability for ten years. Every resident complaint is quietly a financial question: is this ours to fix for free, or can we charge it back? |
| 0:26 | A resident just talks. No app to learn, no form to fill. | It starts with a resident. She does not open a form. She talks, in English or Arabic, and the assistant asks only what is missing. |
| 0:36 | The job card fills itself while she speaks | As she speaks, the job card fills in: the problem, the room, since when, whether anyone at home struggles with the heat, and when a technician can come in. |
| 0:47 | Logged with the real reference, priority and liability | She confirms, and the work order is created. The assistant reads back the reference the system generated. Note what the system decided on its own: priority two, because an air conditioning fault in summer is urgent, and the contractor is liable, because this building is still inside its defects period. |
| 1:06 | العربية · the whole app, right to left | The same call works in Arabic. The entire application flips to right to left, including the voice agent. |
| 1:14 | Every job carries its own clock and its own liability | In the work order list, every job already carries a priority, a liability and a running service level clock. Nobody typed those in. |
| 1:23 | Who pays, decided at the moment the request arrives | Open one and the decision is on the record: inside the defects period, the contractor is liable, and the job was routed to the subcontractor who did the original installation. Every step is timestamped underneath. |
| 1:37 | The technician's phone: the same system | The technician sees the job on a phone. Same system, no separate app: checklist, photographs, the true cause of the fault, and a signature. |
| 1:47 | The cost charged back to the subcontractor who caused it | When the cause is the installer's fault, the cost is charged back to them, with the photographs and the timestamps attached. That turns an argument into a claim that can be defended. |
| 1:58 | One batch, one subcontractor, one pattern | The command centre watches for patterns. Here the same valve actuator has failed across one batch of units, all installed by the same subcontractor. That is a claim for the batch, not for one flat. |
| 2:12 | Certificates, evidence and the audit pack | Compliance is on the same record: Civil Defence certificates, planned maintenance with evidence, and an audit pack generated on demand. |
| 2:21 | The monthly client report writes itself | And the monthly client report writes itself from the same work orders, so the numbers in the meeting are the numbers in the system. |
| 2:29 | Real Kissflow records, not a mock-up | None of this is a mock-up. Every record sits in Kissflow: forms, processes and boards, with the workflow, the permissions and the audit trail that come with it. |
| 2:41 | title card · "Built on Kissflow" | Custom interface, real workflow, and artificial intelligence where it earns its place. Built on Kissflow. |

## Rebuilding or editing the film

```bash
cd app
node scripts/video/narrate.mjs                              # voice-over (Gemini TTS)
node scripts/video/record.mjs                               # drives the real app at 1080p
node scripts/video/assemble.mjs --pad 700 --speed 1.21      # cuts, lays the voice over, writes the MP4
```

`--pad` is the quiet tail kept after each line; `--speed` is the overall pace (the voice stays natural up to about 1.25×). Edit `app/scripts/video/storyboard.mjs` to change what is said or shown.

Notes:
- Recorded with `?brand=generic`, so no client name appears on screen.
- The voice call in the film is the **scripted** assistant, because a recorder has no microphone. The live Gemini voice is what you demo in person (Admin → AI settings → Live).
- Each recording raises one real work order through the scripted call; reject it afterwards to keep the demo data tidy.
