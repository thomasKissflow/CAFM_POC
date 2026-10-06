import { useMemo, useState } from "react";
import { addMonthsGst, monthKeysEndingAt, ms, toGst } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { Ledger, PageHeader, Select, PageLoader } from "@/ui/primitives";
import { cn } from "@/ui/cn";



export default function Ppm() {
  const { t, b, month, num } = useI18n();
  const now = useNow(60000);
  const dir = useDirectory();
  // ten months ending three ahead, so today sits inside the planner whatever the date
  const MONTHS: string[] = useMemo(() => monthKeysEndingAt(ms(addMonthsGst(toGst(now), 3)), 10), [now]);
  const [site, setSite] = useState("");
  const q = useQuery((s) => s.ppm.schedules(site || undefined), [site]);
  const list = q.data ?? [];
  const past = list.flatMap((p) => p.visits.filter((v) => ms(v.due) < now));
  const onTime = past.filter((v) => v.doneAt && ms(v.doneAt) <= ms(v.due) + 86400000).length;
  const late = past.filter((v) => v.doneAt && ms(v.doneAt) > ms(v.due) + 86400000).length;
  const missed = past.filter((v) => !v.doneAt).length;
  const pct = past.length ? Math.round(((onTime + late) / past.length) * 100) : 100;
  const nowMonth = new Date(now + 4 * 3600e3).toISOString().slice(0, 7);

  return (
    <div className="animate-rise">
      <PageHeader title={t.ppm.title} subtitle={t.ppm.subtitle} actions={
        <Select value={site} onChange={(e) => setSite(e.target.value)} className="w-auto" aria-label={t.request.site}>
          <option value="">{t.chrome.sites}</option>
          {dir?.sites.filter((s) => s.kind !== "plant_yard").map((s) => <option key={s.id} value={s.id}>{b(s.name)}</option>)}
        </Select>
      } />
      <section className="sheet mb-4 grid grid-cols-2 gap-6 px-5 py-4 md:grid-cols-4">
        <Ledger size="xl" tone={pct >= 95 ? "ok" : "ink"} value={`${pct}%`} label={t.ppm.completion} />
        <Ledger size="md" tone="ok" value={num(onTime)} label={t.ppm.onTime} />
        <Ledger size="md" tone="risk" value={num(late)} label={t.ppm.late} />
        <Ledger size="md" tone="breach" value={num(missed)} label={t.ppm.missed} />
      </section>
      <section className="sheet overflow-x-auto">
        {q.data === undefined ? <div className="p-4"><PageLoader className="h-72" /></div> : (
          <table className="w-full min-w-[980px] text-[12.5px]">
            <thead className="bg-sheet-2 text-[11.5px] text-ink-3">
              <tr className="seam-b">
                <th className="px-4 py-2 text-start font-medium">{t.ppm.title}</th>
                {MONTHS.map((m) => <th key={m} className={cn("px-1 py-2 text-center font-medium", m === nowMonth && "text-fluoro-ink")}>{month(m).split(" ")[0].slice(0, 3)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-seam">
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{b(p.title)}</div>
                    <div className="text-[11.5px] text-ink-3">{!site && `${dir?.site(p.siteId)?.code} · `}{t.ppm[p.frequency]} · {p.assetCount} {t.ppm.assets}</div>
                  </td>
                  {MONTHS.map((m) => {
                    const v = p.visits.find((x) => x.due.startsWith(m));
                    if (!v) return <td key={m} className={cn("px-1", m === nowMonth && "bg-fluoro-wash/30")} />;
                    const future = ms(v.due) >= now;
                    const state = future ? "upcoming" : !v.doneAt ? "missed" : ms(v.doneAt) > ms(v.due) + 86400000 ? "late" : "onTime";
                    return (
                      <td key={m} className={cn("px-1 text-center", m === nowMonth && "bg-fluoro-wash/30")}>
                        <span
                          title={`${v.due.slice(0, 10)} · ${t.ppm[state as "onTime"]}${v.evidence ? ` · ${v.evidence} ${t.compliance.evidence}` : ""}`}
                          className={cn("mx-auto block h-5 w-5 rounded-sm",
                            state === "onTime" && "bg-ok", state === "late" && "bg-risk-fill", state === "missed" && "hazard-on-red bg-breach",
                            state === "upcoming" && "border border-dashed border-ink-3")}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="seam-t flex flex-wrap gap-4 px-4 py-2 text-[11.5px] text-ink-3">
          {[["bg-ok", t.ppm.onTime], ["bg-risk-fill", t.ppm.late], ["hazard-on-red bg-breach", t.ppm.missed], ["border border-dashed border-ink-3", t.ppm.upcoming]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm", c)} />{l}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
