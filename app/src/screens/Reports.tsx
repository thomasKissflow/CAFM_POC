import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import type { Bilingual } from "@/domain/types";
import { useI18n } from "@/i18n";
import { monthKeysEndingAt } from "@/domain/time";
import { useNow, useQuery, useServices } from "@/services/context";
import { useDirectory, useSiteChoice } from "@/app/lookups";
import { AiTag, Button, Ledger, PageHeader, RagChip, Select, PageLoader } from "@/ui/primitives";



export default function Reports() {
  const { t, b, lang, month, aed, num, dateShort } = useI18n();
  const services = useServices();
  const now = useNow(60000);
  const dir = useDirectory();
  const [site, setSite] = useSiteChoice(dir);
  // the six months up to this one, newest first: the demo world moves with today
  const MONTHS: string[] = useMemo(() => monthKeysEndingAt(now, 6).reverse(), [now]);
  const [m, setM] = useState(MONTHS[0]);
  const q = useQuery((s) => s.reports.monthly(site, m), [site, m]);
  const [summary, setSummary] = useState<Bilingual | null>(null);
  const [busy, setBusy] = useState(false);
  const r = q.data;
  const maxCat = Math.max(1, ...(r?.byCategory.map((c) => c.count) ?? [1]));
  const siteObj = dir?.site(site);

  return (
    <div className="animate-rise">
      <PageHeader
        title={t.report.title}
        subtitle={t.report.subtitle}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Select value={site} onChange={(e) => { setSite(e.target.value); setSummary(null); }} className="w-auto" aria-label={t.report.building}>
              {dir?.sites.filter((s) => s.kind !== "plant_yard").map((s) => <option key={s.id} value={s.id}>{b(s.name)}</option>)}
            </Select>
            <Select value={m} onChange={(e) => { setM(e.target.value); setSummary(null); }} className="w-auto" aria-label={t.report.month}>
              {MONTHS.map((x) => <option key={x} value={x}>{month(x)}</option>)}
            </Select>
            <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>{t.chrome.print}</Button>
          </div>
        }
      />

      <article className="sheet print-sheet mx-auto max-w-[960px] px-8 py-8">
        {/* report title block, drawing-sheet style */}
        <header className="grid grid-cols-[1fr_auto] gap-6 border-b-2 border-ink pb-4">
          <div>
            <div className="text-[12px] text-ink-3">{t.app.fmOperator} · {t.app.preparedFor}</div>
            <h2 className="mt-1 text-[24px] font-semibold text-ink">{siteObj ? b(siteObj.name) : ""}</h2>
            <div className="text-[14px] text-ink-2">{t.report.title} · {month(m)}</div>
          </div>
          <table className="self-end text-[11.5px]">
            <tbody className="reading">
              <tr><td className="pe-3 text-ink-3">REF</td><td className="text-ink">RPT-{site.slice(2)}-{m}</td></tr>
              <tr><td className="pe-3 text-ink-3">{t.audit.generated}</td><td className="text-ink">{dateShort(now)}</td></tr>
              <tr><td className="pe-3 text-ink-3">LOG</td><td className="text-ink">{r ? `${num(r.eventsLogged)} ${t.report.eventsLogged}` : "…"}</td></tr>
            </tbody>
          </table>
        </header>

        {r === undefined ? <PageLoader className="mt-6 h-96" /> : (
          <>
            <section className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink">{t.report.summary}</h3>
                <div className="no-print flex items-center gap-2">
                  <AiTag />
                  <Button size="sm" variant="secondary" loading={busy} onClick={async () => { setBusy(true); setSummary(await services.ai.reportNarrative(r)); setBusy(false); }}>{t.ai.narrative}</Button>
                </div>
              </div>
              {summary ? (
                <p className="animate-rise max-w-[75ch] text-[14.5px] leading-relaxed text-ink">{b(summary)}</p>
              ) : (
                <p className="text-[13px] text-ink-3">—</p>
              )}
            </section>

            <section className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-seam py-5 md:grid-cols-4">
              <Ledger size="lg" value={num(r.totals.raised)} label={t.report.raised} sub={`${num(r.totals.closed)} ${t.report.closed.toLowerCase()}`} />
              <Ledger size="lg" tone={r.totals.slaPct >= 95 ? "ok" : "ink"} value={`${num(r.totals.slaPct, 1)}%`} label={t.report.slaRes} sub={`${t.report.slaResp} ${num(r.totals.responsePct, 1)}%`} />
              <Ledger size="lg" tone="fluoro" value={num(r.totals.dlpJobs)} label={t.report.dlpJobs} sub={`${num(r.totals.chargeableJobs)} ${t.report.chargeable.toLowerCase()}`} />
              <Ledger size="lg" value={`${r.ppm.pct}%`} label={t.report.ppm} sub={`${r.ppm.done}/${r.ppm.due}`} />
            </section>

            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <section>
                <h3 className="mb-3 text-[14px] font-semibold text-ink">{t.report.byCategory}</h3>
                <ul className="flex flex-col gap-2">
                  {r.byCategory.slice(0, 8).map((c) => (
                    <li key={c.category} className="grid grid-cols-[130px_1fr_32px] items-center gap-3 text-[12.5px]">
                      <span className="truncate text-ink-2">{t.category[c.category]}</span>
                      <span className="h-2.5 bg-sheet-2"><span className="block h-full rounded-e-[2px] bg-ink" style={{ width: `${(c.count / maxCat) * 100}%` }} /></span>
                      <span className="tnum text-end text-ink">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="mb-3 text-[14px] font-semibold text-ink">{t.report.byChannel}</h3>
                <ul className="flex flex-col gap-2">
                  {r.byChannel.map((c) => (
                    <li key={c.channel} className="flex justify-between border-b border-seam pb-1.5 text-[12.5px]"><span className="text-ink-2">{t.channel[c.channel]}</span><span className="tnum text-ink">{c.count}</span></li>
                  ))}
                </ul>
                <div className="mt-4 text-[12.5px] text-ink-2">{t.report.recovered}: <span className="tnum font-semibold text-fluoro-ink">{aed(r.totals.recoveredAed)}</span></div>
              </section>
            </div>

            <section className="mt-8">
              <h3 className="mb-3 text-[14px] font-semibold text-ink">{t.report.compliance}</h3>
              <div className="flex flex-wrap gap-2">
                {r.compliance.map((c) => <RagChip key={c.id} rag={services.compliance.rag(c, now)} label={t.compliance[c.system]} />)}
              </div>
            </section>

            <section className="mt-8">
              <h3 className="mb-3 text-[14px] font-semibold text-ink">{t.report.breaches} <span className="tnum font-normal text-ink-3">({r.breaches.length})</span></h3>
              <table className="w-full text-[12.5px]">
                <tbody className="divide-y divide-seam">
                  {r.breaches.slice(0, 12).map((w) => (
                    <tr key={w.id}>
                      <td className="reading py-1.5 pe-3 text-[11.5px]"><Link to={`/wo/${w.id}`} className="text-ink hover:underline">{w.ref}</Link></td>
                      <td className="py-1.5 pe-3 text-ink">{b(w.title)}</td>
                      <td className="py-1.5 pe-3 text-ink-3">{t.priority[w.priority]}</td>
                      <td className="reading py-1.5 text-end text-[11.5px] text-ink-3">{dateShort(w.reportedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <p className="mt-8 border-t border-seam pt-3 text-[11px] text-ink-3">{t.app.demoDataLong} {lang === "ar" ? "كل رقم يعود إلى أوامر العمل المسجلة." : "Every figure traces to logged work orders."}</p>
          </>
        )}
      </article>
    </div>
  );
}
