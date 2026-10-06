// Server-side Kissflow REST helper (access key from process.env; never sent to the browser).
const env = (k: string) => { const v = process.env[k]; return v === undefined || v === "" ? undefined : v; };

export function kfConfigured(): boolean { return env("KF_DOMAIN") !== undefined && env("KF_ACCOUNT_ID") !== undefined && env("KF_ACCESS_KEY_ID") !== undefined && env("KF_ACCESS_KEY_SECRET") !== undefined; }
export const kfAccount = () => env("KF_ACCOUNT_ID") ?? "";

export async function kfRest(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  if (!kfConfigured()) return { status: 500, json: { error: "Kissflow keys are not configured on the server" } };
  const host = (env("KF_DOMAIN") as string).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const url = `https://${host}${path.replaceAll("{acc}", kfAccount())}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, {
      method,
      headers: { "X-Access-Key-Id": env("KF_ACCESS_KEY_ID") as string, "X-Access-Key-Secret": env("KF_ACCESS_KEY_SECRET") as string, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 3000 * (attempt + 1))); continue; }
    const text = await r.text();
    let json: unknown; try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, json };
  }
  return { status: 429, json: { error: "Kissflow rate limit" } };
}
