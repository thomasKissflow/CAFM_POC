import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Layers, Repeat } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { ChainageRuler } from "@/ui/ChainageRuler";
import { Empty, LiabilityChip, Ledger, Panel, StatusChip, PageLoader } from "@/ui/primitives";
import { cn } from "@/ui/cn";

export default function Asset360() {
  const { id = "" } = useParams();
  const { t, b, lang, date, dateShort, aed, num, dir: textDir } = useI18n();
  const now = useNow(60000);
  const dir = useDirectory();
  const aQ = useQuery((s) => s.assets.get(id), [id]);
  const hQ = useQuery((s) => s.assets.history(id), [id]);
  const dQ = useQuery((s) => s.assets.diagnosis(id), [id]);
  const a = aQ.data;
  const Back = textDir === "rtl" ? ArrowRight : ArrowLeft;
  if (a === undefined) return aQ.loading ? <PageLoader className="h-96" /> : <Empty title="Asset not found" />;
  const history = hQ.data ?? [];
  const cost = history.reduce((s, w) => s + (w.partsAed ?? 0) + (w.labourAed ?? 0), 0);
  const recovered = history.filter((w) => w.liability === "DLP").reduce((s, w) => s + (w.partsAed ?? 0) + (w.labourAed ?? 0), 0);
  const ctx = dQ.data;
  const sub = dir?.sub(a.installedBy);
  const site = dir?.site(a.siteId);

  return (
    <div className="animate-rise">
      <Link to="/assets" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink"><Back size={14} />{t.asset.title}</Link>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="reading text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink">{a.tag}</div>
          <p className="mt-2 text-[14px] text-ink-2">{t.assetClass[a.assetClass]} · {b(a.location)} · {site ? b(site.name) : ""}</p>
          <p className="text-[13px] text-ink-3">{t.asset.make}: {a.make} {a.model} · {t.asset.serial} <span className="reading">{a.serial}</span></p>
        </div>
        <figure className="flex items-center gap-3 rounded-md border border-seam bg-white p-2.5">
          <QRCodeSVG value={a.qrCode} size={72} fgColor="#16191c" />
          <figcaption className="text-[11.5px] leading-tight text-ink-3">{t.asset.qr}<br /><span className="reading text-ink-2">{a.qrCode}</span></figcaption>
        </figure>
      </header>

      {a.handoverDate && a.dlpEnd && (
        <section className="sheet survey-grid mb-4 px-5 pt-4 pb-3">
          <ChainageRuler start={a.handoverDate} end={a.dlpEnd} now={now} title={`${t.asset.handover} → ${t.asset.dlpEnd}`} />
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title={t.asset.history} meta={num(history.length)} bodyClassName="p-0">
          {history.length === 0 ? <Empty title={t.asset.noHistory} /> : (
            <ol className="divide-y divide-seam">
              {history.map((w) => (
                <li key={w.id}>
                  <Link to={`/wo/${w.id}`} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3 hover:bg-sheet-2">
                    <span className="reading pt-0.5 text-[12px] text-ink-3">{dateShort(w.reportedAt)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-ink">{b(w.title)}</span>
                      <span className="block text-[12.5px] text-ink-2">{w.rootCause ? t.rootCause[w.rootCause] : t.status[w.status]}</span>
                      <span className="reading block text-[11.5px] text-ink-3">{w.ref}{w.partsAed !== undefined ? ` · ${aed((w.partsAed ?? 0) + (w.labourAed ?? 0))}` : ""}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1"><LiabilityChip liability={w.liability} /><StatusChip status={w.status} /></span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title={t.asset.installedBy}>
            <div className="text-[15px] font-medium text-ink">{sub ? (lang === "ar" ? sub.nameAr : sub.name) : "—"}</div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
              <div><dt className="text-ink-3">{t.asset.batch}</dt><dd className="reading text-ink">{a.batch ?? "—"}</dd></div>
              <div><dt className="text-ink-3">{t.asset.handover}</dt><dd className="reading text-ink">{a.handoverDate ? date(a.handoverDate) : "—"}</dd></div>
              <div><dt className="text-ink-3">{t.asset.warranty}</dt><dd className="reading text-ink">{a.warrantyEnd ? date(a.warrantyEnd) : "—"}</dd></div>
              <div><dt className="text-ink-3">{t.asset.decennial}</dt><dd className="reading text-ink">{a.decennialEnd ? date(a.decennialEnd) : "—"}</dd></div>
            </dl>
          </Panel>
          <Panel title={t.asset.costToDate}>
            <div className="grid grid-cols-2 gap-4">
              <Ledger size="md" value={aed(cost)} label={t.asset.costToDate} />
              <Ledger size="md" tone="fluoro" value={aed(recovered)} label={t.command.recovered} />
            </div>
          </Panel>
          {ctx && (
            <Panel title={t.asset.repeat}>
              <div className={cn("flex items-center gap-3", ctx.repeatCount - 1 >= 2 && "text-breach")}>
                <Repeat size={18} aria-hidden />
                <span className="tnum text-[26px] font-semibold">{ctx.previous.length}</span>
                <span className="text-[12.5px] text-ink-2">/ {ctx.windowDays} {t.units.days}</span>
              </div>
              {ctx.siblingFailures.length > 0 && (
                <div className="mt-3 rounded-md bg-fluoro-wash px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink"><Layers size={14} aria-hidden />{t.asset.siblings} · <span className="reading">{ctx.batch}</span></div>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {ctx.siblingFailures.map((s) => (
                      <li key={s.ref} className="flex justify-between gap-2 text-[12.5px]">
                        <Link to={`/assets/${s.assetId}`} className="reading text-ink hover:underline">{s.tag}</Link>
                        <span className="text-ink-2">{t.rootCause[s.rootCause]} · {dateShort(s.at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
