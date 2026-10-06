# CAFM: things to do for production (if the Dutco deal goes through)

The POC takes shortcuts that are fine when only Thomas uses it for showcasing. Each one below lists what the POC does, why that's not OK in production, and what to do instead. Decision references point to DECISIONS.md.

## 1. Move the AI backend to Cloud Run (the most important item)

| | POC (now) | Production |
|---|---|---|
| Where the Gemini key lives | Inside Kissflow, for the POC only (D64, once agreed). The Custom UI reads it at run time and calls Gemini directly from the browser | **Only on a server.** Cloud Run runs `app/server/index.ts` (already written); the key sits in Secret Manager, never in Kissflow or the browser |
| Voice session tokens | The browser mints its own single-use token | The server mints them (`POST /api/live-token`, already built): 1 use, 60 s to start, 30 min max; model, prompt and voice locked |
| Who may call | Whoever can open the app and read the key row | Origin allowlist + per-user rate limit (built) **plus real caller verification** (Q49): check the Kissflow user, not just what the app says |
| Summaries / insights | Called from the browser | `POST /api/summarize`, `POST /api/insights` on the server |

Steps:
1. GCP project 987227170626 (or a Dutco-owned project): enable Cloud Run, Secret Manager, Artifact Registry.
2. Put `GEMINI_API_KEY` and the Kissflow `KF_*` keys in **Secret Manager**; give the Cloud Run service account access to just those secrets.
3. Deploy `app/server/index.ts` (container or `gcloud run deploy --source`), region nearest the UAE (data residency, Q36).
4. Set `AI_ALLOWED_ORIGINS` to the Kissflow Custom UI origin only; turn the dev Kissflow proxy off (it's already off in `index.ts`).
5. Build the Custom UI with `VITE_AI_API_BASE=<Cloud Run URL>`, redeploy, and **delete the Gemini key row from Kissflow AI Settings**.
6. Use a **new Gemini key for production**, not the shared POC key "[Do Not Delete] - POC API Keys", and restrict it to the Generative Language API.
7. Add a **budget alert** on the project, and a per-user daily cap on the server.

## 2. Security and access

- **Caller verification (Q49):** verify the Kissflow user on each backend call, e.g. a short-lived signed token issued by a Kissflow integration or a shared secret per tenant. Today the backend trusts the user id and "admin" flag the app sends.
- **Admin role:** today the app's built-in Kissflow Admin role (full privileges) is the Admin persona (D61). In production, create a dedicated read-only "CAFM Admin" role and keep Kissflow's Admin for builders only.
- **Remove the API-key user from all roles** (Q41) and use a service user for integrations.
- **Data residency (Q36):** confirm with Dutco whether voice audio and transcripts may be processed outside the UAE; pick the region and the Gemini data-use terms accordingly (paid tier; no training on data).
- **Retention:** decide how long AI Conversations (transcripts) are kept, and who can read them. Today: Admin / Helpdesk / Executive / FM / DLP read, Resident sees own.
- **Consent line** at the start of each call ("this call is handled by an AI assistant and recorded").

## 3. Kissflow app

- Switch on and test the **integrations** (Phase 9 / Q44), with Thomas's "Thomas Dev Keys" replaced by a service connection.
- Replace demo data: real sites, assets, subcontractors, residents; remove all `[TEST]` items (they're rejected, never deleted, during the POC).
- Real **Portal** for residents (Phase 8) instead of the Resident app role.
- Board prefixes `SNG` / `BRK` (Q43), dataform title fields (Q48) if native Kissflow screens are used.
- Watch the Work Order role access (Q47) and role membership resets (Q45).
- **Admin → Properties** writes the Site, Unit and Asset rows straight from the browser as the signed-in user, which suits a demo where one person owns the estate. In production, adding or removing a building is a controlled act: put it behind an approval (a Kissflow process), restrict who may do it, and keep the removal out of the app entirely — a real building is archived, not deleted.
- The Work Order's reference fields have **AutoFill off** (D88), so the app copies Own Operations, DLP End Date and the priority fields itself. Anyone creating a work order inside native Kissflow rather than the app would not get those copies — either re-enable autofill with targets the form actually holds, or keep creation in the app.

## 4. AI quality and cost

- Test Arabic (Gulf) voice quality with real residents; tune the prompt in Admin → AI settings.
- Phone support check (Q35): iOS Safari and Android Chrome, inside the Kissflow mobile app if used.
- Watch cost: about US$0.04 per two-minute call including summary and insights (Sep 2026 prices; Flash prices double from 1 Jan 2027).
- Model versions: pin and review `gemini-3.8-live` / `gemini-3.8-flash` before go-live; ephemeral tokens are marked experimental by Google.
- Embeddings and search across calls (designed for, not built).

## 5. Operations

- Error monitoring for the backend (Cloud Logging alerts on 5xx and 429).
- Usage report from the `[ai-usage]` log lines (counts only, never content).
- A runbook: rotating the key, what to do if Gemini is down (the app falls back to the browser demo voice / typed requests).
