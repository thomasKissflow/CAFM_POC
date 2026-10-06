// Standalone AI backend (for Cloud Run). Reads GEMINI_API_KEY and KF_* from the environment (Secret Manager on Cloud Run).
// The Kissflow dev proxy is OFF here: inside Kissflow the app uses the SDK.
import { createServer } from "node:http";
import { createApiHandler } from "./http";

const handle = createApiHandler({ devKfProxy: false });
const port = Number(process.env.PORT ?? 8080);
createServer((req, res) => { void handle(req, res); }).listen(port, () => console.info(`[ai] CAFM AI backend listening on :${port}`));
