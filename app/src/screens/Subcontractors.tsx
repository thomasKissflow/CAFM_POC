import { ShieldCheck } from "lucide-react";
import { DAY, ms } from "@/domain/time";
import { readSla } from "@/domain/sla";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { PageHeader, RagChip, PageLoader } from "@/ui/primitives";
import type { Rag } from "@/domain/types";

export default function Subcontractors() {
  const { t, lang, date, aed, num } = useI18n();
  const now = useNow(60000);
  const subs = useQuery((s) => s.directory.subcontractors(), []);
  const wos = useQuery((s) => s.workOrders.list({ liability: "DLP" }), []);
  const bcs = useQuery((s) => s.dlp.backCharges(), []);
  const docRag = (iso?: string): Rag => (iso === undefined ? "green" : ms(iso) < now ? "red" : ms(iso) - now < 30 * DAY ? "amber" : "green");

  return (
    <div className="animate-rise">
      <PageHeader title={t.subs.title} subtitle={t.subs.subtitle} />
      {subs.data === undefined ? <PageLoader className="h-96" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {subs.data.map((s) => {
            const jobs = (wos.data ?? []).filter((w) => w.subcontractorId === s.id && w.resolvedAt);
            const met = jobs.filter((w) => readSla(w.reportedAt, w.resolveDueAt, now, w.resolvedAt).phase === "met").length;
            const assets = new Map<string, number>();
            jobs.forEach((w) => w.assetId && assets.set(w.assetId, (assets.get(w.assetId) ?? 0) + 1));
            const repeat = [...assets.values()].filter((c) => c > 1).length;
            const ftf = jobs.length ? Math.round(((jobs.length - repeat) / jobs.length) * 100) : 100;
            const charged = (bcs.data ?? []).filter((b) => b.subcontractorId === s.id).reduce((x, b) => x + b.partsAed + b.labourAed, 0);
            return (
              <article key={s.id} className="sheet p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-semibold text-ink">{lang === "ar" ? s.nameAr : s.name}</h2>
                    <div className="text-[12.5px] text-ink-3">{t.trade[s.trade]} · <span className="reading">{s.tradeLicenceNo}</span></div>
                  </div>
                  {s.civilDefenceApproved && <span className="flex items-center gap-1 rounded-sm bg-ok-wash px-1.5 py-0.5 text-[11.5px] text-ok"><ShieldCheck size={13} />{t.subs.dcd}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <RagChip rag={docRag(s.tradeLicenceExpiry)} label={`${t.subs.licence} · ${date(s.tradeLicenceExpiry)}`} />
                  <RagChip rag={docRag(s.insuranceExpiry)} label={`${t.subs.insurance} · ${date(s.insuranceExpiry)}`} />
                  {s.civilDefenceExpiry && <RagChip rag={docRag(s.civilDefenceExpiry)} label={`${t.subs.dcd} · ${date(s.civilDefenceExpiry)}`} />}
                </div>
                <dl className="mt-4 grid grid-cols-4 gap-3 border-t border-seam pt-3">
                  <div><dt className="text-[11.5px] text-ink-3">{t.subs.dlpJobs}</dt><dd className="tnum text-[19px] font-semibold">{num(jobs.length)}</dd></div>
                  <div><dt className="text-[11.5px] text-ink-3">{t.subs.slaMet}</dt><dd className="tnum text-[19px] font-semibold">{jobs.length ? `${Math.round((met / jobs.length) * 100)}%` : "—"}</dd></div>
                  <div><dt className="text-[11.5px] text-ink-3">{t.subs.firstTimeFix}</dt><dd className="tnum text-[19px] font-semibold">{jobs.length ? `${ftf}%` : "—"}</dd></div>
                  <div><dt className="text-[11.5px] text-ink-3">{t.subs.backCharged}</dt><dd className="tnum text-[15px] font-semibold text-fluoro-ink">{aed(charged)}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
