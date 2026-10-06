// Local development only: the Kf facade over the dev server's /api/kf proxy, so `npm run dev` on a laptop
// reads and writes the live Kissflow app. The Kissflow key stays in the dev server (never in the bundle).
// Inside Kissflow the real SDK is used; the built zip has no proxy and never takes this path.
import type { Kf } from "./sdk";
import { restKf } from "./restKf";

const transport = async (method: string, path: string, body?: unknown) => {
  const r = await fetch("/api/kf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, path, body }) });
  let json: unknown; try { json = await r.json(); } catch { json = null; }
  return { status: r.status, json };
};

/** Resolves when the dev proxy is up and holds Kissflow keys; undefined otherwise (then the app uses demo data). */
export async function proxyKf(timeoutMs = 2500): Promise<Kf | undefined> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch("/api/ai/health", { signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) return undefined;
    const h = (await r.json()) as { kissflow?: boolean; devKfProxy?: boolean };
    if (h.kissflow !== true || h.devKfProxy !== true) return undefined;
    return restKf(transport, { _id: "dev-proxy", Name: "Local dev (API key)", Email: "", AppRoles: [] });
  } catch { return undefined; }
}
