// Can this page reach Google's Gemini API (HTTPS + the Live WebSocket) and the microphone? Sends no key and no data:
// a reachable endpoint answers "invalid key"; a page security policy (CSP) blocks the request before it leaves.
export interface ProbeResult { name: string; ok: boolean; detail: string }

export async function probeGoogle(): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  const violations: string[] = [];
  const onViolation = (e: SecurityPolicyViolationEvent) => violations.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
  document.addEventListener("securitypolicyviolation", onViolation);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=probe-invalid");
    out.push({ name: "HTTPS to generativelanguage.googleapis.com", ok: true, detail: `reachable (HTTP ${r.status}, expected 400 for a dummy key)` });
  } catch (e) {
    out.push({ name: "HTTPS to generativelanguage.googleapis.com", ok: false, detail: `blocked: ${e instanceof Error ? e.message : String(e)}` });
  }
  out.push(await new Promise<ProbeResult>((resolve) => {
    const name = "WebSocket to the Gemini Live endpoint";
    let ws: WebSocket;
    try { ws = new WebSocket("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=probe-invalid"); }
    catch (e) { resolve({ name, ok: false, detail: `blocked: ${e instanceof Error ? e.message : String(e)}` }); return; }
    const t = setTimeout(() => { ws.close(); resolve({ name, ok: false, detail: "no answer in 8 s" }); }, 8000);
    ws.onopen = () => { clearTimeout(t); ws.close(); resolve({ name, ok: true, detail: "connection opened" }); };
    ws.onclose = (e) => { clearTimeout(t); resolve({ name, ok: e.code !== 1006 || violations.length === 0, detail: `closed by server, code ${e.code}${e.reason ? ` (${e.reason.slice(0, 80)})` : ""}` }); };
  }));
  try {
    const p = await navigator.permissions.query({ name: "microphone" as PermissionName });
    out.push({ name: "Microphone permission for this frame", ok: p.state !== "denied", detail: p.state });
  } catch (e) { out.push({ name: "Microphone permission for this frame", ok: true, detail: `can't query (${e instanceof Error ? e.message : String(e)}); the frame allows microphone` }); }
  document.removeEventListener("securitypolicyviolation", onViolation);
  if (violations.length > 0) out.push({ name: "Page security policy (CSP)", ok: false, detail: violations.join("; ") });
  else out.push({ name: "Page security policy (CSP)", ok: true, detail: "no violations reported" });
  return out;
}
