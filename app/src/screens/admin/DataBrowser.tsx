// Admin → Data browser: every Kissflow dataform, process and board as a read-only table, straight from Kissflow.
import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCw, Search } from "lucide-react";
import { useI18n } from "@/i18n";
import { useDataSource } from "@/services/source";
import { CATALOG, type FlowInfo } from "@/services/kissflow/catalog";
import { listAll, listBoard, processItems, type Kf, type KfRow } from "@/services/kissflow/sdk";
import { Button, Empty, Input, PageHeader, PageLoader } from "@/ui/primitives";
import { cn } from "@/ui/cn";

const PAGE = 50;
type Load = { state: "loading" } | { state: "ready"; rows: KfRow[]; at: number } | { state: "error"; message: string };

async function load(kf: Kf, f: FlowInfo): Promise<KfRow[]> {
  if (f.kind === "dataform") return listAll(kf.app.getDataform(f.id), `Data browser: ${f.name}`, 200);
  if (f.kind === "board") return listBoard(kf, f.id, `Data browser: ${f.name}`, 200);
  return processItems(kf.app.getProcess(f.id), `Data browser: ${f.name}`);
}

/** A readable cell: lookups show their name, lists their count, long text is clipped (full value in the tooltip). */
function cell(v: unknown): { text: string; full: string } {
  if (v === undefined || v === null || v === "") return { text: "", full: "" };
  if (typeof v === "boolean") return { text: v ? "Yes" : "No", full: String(v) };
  if (typeof v === "number" || typeof v === "string") { const s = String(v); return { text: s.length > 80 ? `${s.slice(0, 80)}…` : s, full: s }; }
  if (Array.isArray(v)) return { text: v.length === 0 ? "" : `${v.length} item${v.length === 1 ? "" : "s"}`, full: JSON.stringify(v).slice(0, 2000) };
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // lookups: Kissflow's own Name is generic ("… from Thomas"), so prefer the record's name/code field
    const own = Object.entries(o).find(([k, x]) => !k.startsWith("_") && k !== "Name" && typeof x === "string" && x !== "" && /Name|Code|Title|Tag|Number|Ref/.test(k))
      ?? Object.entries(o).find(([k, x]) => !k.startsWith("_") && k !== "Name" && typeof x === "string" && x !== "");
    const name = own !== undefined ? String(own[1]) : typeof o.Name === "string" ? o.Name : typeof o._id === "string" ? o._id : undefined;
    return { text: name !== undefined ? name : "", full: JSON.stringify(v).slice(0, 2000) };
  }
  return { text: String(v), full: String(v) };
}

export default function DataBrowser() {
  const { lang } = useI18n();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const src = useDataSource();
  const kf = src.kind === "kissflow" && src.conn !== undefined ? src.conn.kf : undefined;
  const [flowId, setFlowId] = useState(CATALOG[0].id);
  const flow = CATALOG.find((f) => f.id === flowId) ?? CATALOG[0];
  const [cache, setCache] = useState<Record<string, Load>>({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [system, setSystem] = useState(false);

  const fetchFlow = (f: FlowInfo) => {
    if (kf === undefined) return;
    setCache((c) => ({ ...c, [f.id]: { state: "loading" } }));
    load(kf, f).then(
      (rows) => setCache((c) => ({ ...c, [f.id]: { state: "ready", rows, at: Date.now() } })),
      (e: unknown) => setCache((c) => ({ ...c, [f.id]: { state: "error", message: e instanceof Error ? e.message : String(e) } }))
    );
  };
  useEffect(() => { if (cache[flow.id] === undefined) fetchFlow(flow); setPage(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [flow.id, kf]);

  const cur = cache[flow.id];
  const rows = cur !== undefined && cur.state === "ready" ? cur.rows : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === "" ? rows : rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, query]);
  const columns = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows.slice(0, 300)) for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined && v !== "") seen.set(k, (seen.get(k) ?? 0) + 1);
    const keys = [...seen.keys()].filter((k) => system || !k.startsWith("_") || k === "_id");
    return keys.sort((a, b) => (a === "_id" ? -1 : b === "_id" ? 1 : a.startsWith("_") === b.startsWith("_") ? 0 : a.startsWith("_") ? 1 : -1));
  }, [rows, system]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const groups = [...new Set(CATALOG.map((f) => f.group))];

  if (kf === undefined) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
        <PageHeader title={L("Data browser", "مستعرض البيانات")} subtitle={L("Every Kissflow dataform, process and board, read-only.", "كل نماذج البيانات والعمليات واللوحات في Kissflow، للقراءة فقط.")} />
        <div className="sheet"><Empty icon={<Database className="text-ink-3" size={22} aria-hidden />} title={L("Not connected to Kissflow", "غير متصل بـ Kissflow")}
          hint={src.note !== undefined ? src.note : L("Open the app inside Kissflow, or run it locally with the dev server (npm run dev), to browse live data.", "افتح التطبيق داخل Kissflow أو شغّله محليًا لاستعراض البيانات الحية.")} /></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-6">
      <PageHeader title={L("Data browser", "مستعرض البيانات")} subtitle={L("Every Kissflow dataform, process and board, read-only, as the signed-in user sees it.", "كل نماذج البيانات والعمليات واللوحات في Kissflow، للقراءة فقط.")} />
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={L("Kissflow flows", "تدفقات Kissflow")} className="sheet h-fit p-2">
          {groups.map((g) => (
            <div key={g} className="py-1">
              <div className="px-2 py-1 text-[11px] font-medium text-ink-3">{g}</div>
              {CATALOG.filter((f) => f.group === g).map((f) => {
                const c = cache[f.id];
                return (
                  <button key={f.id} onClick={() => { setFlowId(f.id); setQuery(""); }} aria-current={f.id === flow.id ? "page" : undefined}
                    className={cn("flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-start text-[13px]", f.id === flow.id ? "crosshair bg-sheet-2 font-medium text-ink" : "text-ink-2 hover:bg-sheet-2")}>
                    <span className="truncate">{f.name}</span>
                    <span className="reading shrink-0 text-[11px] text-ink-3">{c !== undefined && c.state === "ready" ? c.rows.length : f.kind === "process" ? "P" : f.kind === "board" ? "B" : ""}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <section className="sheet min-w-0">
          <div className="seam-b flex flex-wrap items-center gap-2 px-4 py-2.5">
            <div className="me-auto min-w-0">
              <h2 className="text-[14px] font-semibold text-ink">{flow.name}</h2>
              <p className="reading text-[11.5px] text-ink-3">{flow.id} · {flow.kind}{cur !== undefined && cur.state === "ready" ? ` · ${rows.length} rows` : ""}</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder={L("Search this table", "ابحث في هذا الجدول")} aria-label={L("Search this table", "ابحث في هذا الجدول")} className="ps-9" />
            </div>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2"><input type="checkbox" checked={system} onChange={(e) => setSystem(e.target.checked)} />{L("System fields", "حقول النظام")}</label>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => fetchFlow(flow)}>{L("Reload", "تحديث")}</Button>
          </div>
          {cur === undefined || cur.state === "loading" ? <PageLoader className="h-72" /> : cur.state === "error" ? (
            <p className="p-4 text-[13px] break-all text-breach" role="alert">{L("Kissflow refused this read: ", "رفض Kissflow القراءة: ")}{cur.message}</p>
          ) : filtered.length === 0 ? <Empty title={rows.length === 0 ? L("No rows", "لا توجد صفوف") : L("Nothing matches", "لا توجد نتائج")} /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-sheet-2 text-[11.5px] text-ink-3">
                    <tr className="seam-b">{columns.map((c) => <th key={c} scope="col" className="px-3 py-2 text-start font-medium whitespace-nowrap">{c.replace(/_/g, " ").trim()}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-seam">
                    {shown.map((r) => (
                      <tr key={r._id} className="hover:bg-sheet-2/60">
                        {columns.map((c) => { const v = cell(r[c]); return <td key={c} title={v.full} dir="auto" className={cn("max-w-[280px] truncate px-3 py-2 text-ink", c === "_id" && "reading text-ink-3")}>{v.text}</td>; })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="seam-t flex items-center justify-between px-4 py-2 text-[12px] text-ink-3">
                <span className="reading">{page * PAGE + 1}–{Math.min(filtered.length, (page + 1) * PAGE)} / {filtered.length}</span>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{L("Previous", "السابق")}</Button>
                  <Button variant="secondary" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{L("Next", "التالي")}</Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
