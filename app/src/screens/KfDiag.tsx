// Diagnostics for the Kissflow connection (#/kf-diag): what the SDK returned for every read, plus sync errors.
// Big, plain text on purpose, so it can be read from a screenshot of the Kissflow-hosted frame.
import { useEffect, useState } from "react";
import { useDataSource } from "@/services/source";
import { diag, type DiagEntry } from "@/services/kissflow/sdk";
import { runSelfTest, type Step } from "@/services/kissflow/selftest";
import { probeGoogle, type ProbeResult } from "@/services/kissflow/netprobe";

export default function KfDiag() {
  const src = useDataSource();
  const [rows, setRows] = useState<DiagEntry[]>([...diag]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [net, setNet] = useState<ProbeResult[] | null>(null);
  const run = async () => {
    if (src.conn === undefined) return;
    setRunning(true); setSteps([]);
    await runSelfTest(src.conn, (st) => setSteps((prev) => [...prev, st]));
    setRunning(false);
  };
  useEffect(() => { const t = setInterval(() => setRows([...diag]), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="p-4 text-[15px] leading-relaxed text-ink">
      <h1 className="text-[22px] font-semibold">Kissflow connection</h1>
      <p>Source: <b>{src.kind}</b>{src.user !== undefined ? ` · user ${src.user}` : ""}{src.note !== undefined ? ` · note: ${src.note}` : ""}</p>
      <p className="reading">Loaded: {src.counts !== undefined ? Object.entries(src.counts).map(([k, v]) => `${k} ${v}`).join(" · ") : "–"}</p>
      <div className="mt-3 rounded border border-seam bg-sheet p-3">
        <button onClick={() => { setNet([]); void probeGoogle().then(setNet); }} className="rounded bg-ink px-4 py-2 text-[16px] font-semibold text-sheet">Test Google connection</button>
        <span className="ms-3 text-[13px] text-ink-3">Checks whether this page may reach the Gemini API and the microphone. Sends no key and no data.</span>
        {net !== null && <ol className="mt-2 text-[16px]">{net.length === 0 ? <li>Testing…</li> : net.map((n, i) => <li key={i} className={n.ok ? "text-ok" : "text-breach"}>{n.ok ? "PASS" : "FAIL"} · {n.name}: {n.detail}</li>)}</ol>}
      </div>
      {src.conn !== undefined && (
        <div className="mt-3 rounded border border-seam bg-sheet p-3">
          <button onClick={() => void run()} disabled={running} className="rounded bg-fluoro px-4 py-2 text-[16px] font-semibold text-on-fluoro disabled:opacity-50">{running ? "Running self-test…" : "Run self-test"}</button>
          <span className="ms-3 text-[13px] text-ink-3">Raises one [TEST] work order and walks it to closed through the SDK; moves a [TEST] snag. Nothing is deleted.</span>
          <ol className="mt-2 text-[18px]">{steps.map((st, i) => <li key={i} className={st.ok ? "text-ok" : "text-breach"}>{st.ok ? "PASS" : "FAIL"} · {st.name} — {st.detail}</li>)}</ol>
          {!running && steps.length > 0 && <p className="mt-1 text-[18px] font-semibold">{steps.filter((x) => x.ok).length}/{steps.length} passed</p>}
          {!running && steps.length > 0 && <p className="text-[13px] text-ink-3">The test job stays on screen until you reload the app (Kissflow keeps it as a completed [TEST] item, which the app ignores).</p>}
        </div>
      )}
      <table className="mt-3 w-full border-collapse text-[14px]">
        <thead><tr className="border-b border-seam text-start"><th className="p-1 text-start">call</th><th className="p-1 text-start">ok</th><th className="p-1 text-start">rows</th><th className="p-1 text-start">total</th><th className="p-1 text-start">keys</th><th className="p-1 text-start">ms</th><th className="p-1 text-start">error</th><th className="p-1 text-start">row fields</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-b border-seam align-top"><td className="p-1">{r.call}</td><td className="p-1">{r.ok ? "yes" : "NO"}</td><td className="p-1 reading">{r.rows}</td><td className="p-1 reading">{r.total ?? "–"}</td><td className="p-1 reading">{r.keys}</td><td className="p-1 reading">{r.ms}</td><td className="p-1 break-all text-breach">{r.error ?? ""}</td><td className="p-1 break-all text-[11px] text-ink-3">{r.rowKeys ?? ""}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
