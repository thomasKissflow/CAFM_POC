import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Download, FileCheck2, Image as ImageIcon } from "lucide-react";
import { ms } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery, useServices } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { Button, PageHeader, RagChip, PageLoader } from "@/ui/primitives";
import { cn } from "@/ui/cn";

export default function AuditPack() {
  const { siteId = "S-QMR" } = useParams();
  const { t, f, b, lang, date, dateTime, num } = useI18n();
  const services = useServices();
  const now = useNow(60000);
  const dir = useDirectory();
  const comp = useQuery((s) => s.compliance.items(siteId), [siteId]);
  const ppm = useQuery((s) => s.ppm.schedules(siteId), [siteId]);
  const site = dir?.site(siteId);
  const Back = lang === "ar" ? ArrowRight : ArrowLeft;
  const findings = (comp.data ?? []).filter((c) => c.openFindings > 0);
  const visits = (ppm.data ?? []).flatMap((p) => p.visits.filter((v) => ms(v.due) < now).map((v) => ({ ...v, p })));
  const evidence = visits.reduce((s, v) => s + v.evidence, 0) + (comp.data ?? []).reduce((s, c) => s + c.evidenceCount, 0);

  return (
    <div className="animate-rise">
      <Link to="/compliance" className="no-print mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink"><Back size={14} />{t.compliance.title}</Link>
      <PageHeader
        title={t.audit.title}
        subtitle={f(t.audit.subtitle, { site: site ? b(site.name) : "" })}
        actions={<Button variant="primary" className="no-print" icon={<Download size={15} />} onClick={() => window.print()}>{t.audit.export}</Button>}
      />
      <article className="sheet print-sheet mx-auto max-w-[980px] px-8 py-7">
        <header className="grid grid-cols-[1fr_auto] gap-6 border-b-2 border-ink pb-4">
          <div>
            <div className="text-[12px] text-ink-3">{t.app.preparedFor}</div>
            <h2 className="mt-1 text-[22px] font-semibold text-ink">{site ? b(site.name) : ""}</h2>
            <div className="text-[13px] text-ink-2">{site ? b(site.district) : ""}</div>
          </div>
          <dl className="reading self-end text-[11.5px]">
            <div className="flex gap-3"><dt className="text-ink-3">{t.audit.generated}</dt><dd>{dateTime(now)}</dd></div>
            <div className="flex gap-3"><dt className="text-ink-3">FILES</dt><dd>{num(evidence)}</dd></div>
          </dl>
        </header>

        <section className="mt-5">
          <h3 className="mb-2 text-[13.5px] font-semibold text-ink">{t.audit.contents}</h3>
          <ol className="grid gap-1 text-[13px] text-ink-2 md:grid-cols-3">
            <li>1 · {t.audit.certs} ({num(comp.data?.length ?? 0)})</li>
            <li>2 · {t.audit.ppmHistory} ({num(visits.length)})</li>
            <li>3 · {t.audit.findings} ({num(findings.length)})</li>
          </ol>
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-[13.5px] font-semibold text-ink">1 · {t.audit.certs}</h3>
          {comp.data === undefined ? <PageLoader className="h-40" /> : (
            <table className="w-full text-[12.5px]">
              <thead className="text-[11px] text-ink-3"><tr className="seam-b"><th className="py-1.5 text-start font-medium">{t.compliance.certificate}</th><th className="text-start font-medium" /><th className="text-start font-medium">{t.compliance.contractor}</th><th className="text-start font-medium">{t.compliance.expires}</th><th className="text-end font-medium">{t.compliance.evidence}</th></tr></thead>
              <tbody className="divide-y divide-seam">
                {comp.data.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pe-3 text-ink">{t.compliance[c.system]}<div className="reading text-[11px] text-ink-3">{c.certificateNo}</div></td>
                    <td className="pe-3"><RagChip rag={services.compliance.rag(c, now)} /></td>
                    <td className="pe-3 text-ink-2">{c.contractorId ? (lang === "ar" ? dir?.sub(c.contractorId)?.nameAr : dir?.sub(c.contractorId)?.name) : "—"}</td>
                    <td className="reading pe-3 text-[11.5px]">{date(c.expiresAt)}</td>
                    <td className="tnum text-end"><span className="inline-flex items-center gap-1"><FileCheck2 size={12} className="text-ink-3" />{c.evidenceCount}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-7">
          <h3 className="mb-2 text-[13.5px] font-semibold text-ink">2 · {t.audit.ppmHistory}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {(ppm.data ?? []).map((p) => {
              const past = p.visits.filter((v) => ms(v.due) < now);
              return (
                <div key={p.id} className="rounded-md border border-seam p-3">
                  <div className="text-[13px] font-medium text-ink">{b(p.title)}</div>
                  <div className="text-[11.5px] text-ink-3">{t.ppm[p.frequency]} · {p.assetCount} {t.ppm.assets}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {past.map((v) => {
                      const late = v.doneAt && ms(v.doneAt) > ms(v.due) + 86400000;
                      return (
                        <span key={v.due} title={`${date(v.due)}${v.doneAt ? ` → ${date(v.doneAt)}` : ""} · ${v.evidence} files`} className={cn("reading inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[10.5px]", !v.doneAt ? "bg-breach text-white" : late ? "bg-risk-wash text-risk" : "bg-ok-wash text-ok")}>
                          {v.due.slice(5, 10)}{v.evidence > 0 && <><ImageIcon size={10} />{v.evidence}</>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-7">
          <h3 className="mb-2 text-[13.5px] font-semibold text-ink">3 · {t.audit.findings}</h3>
          {findings.length === 0 ? <p className="text-[13px] text-ink-3">—</p> : (
            <ul className="flex flex-col gap-2">
              {findings.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-md bg-breach-wash px-3 py-2 text-[13px]">
                  <span className="text-ink">{t.compliance[c.system]}</span>
                  <span className="tnum font-semibold text-breach">{c.openFindings} {t.compliance.findings}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="mt-8 border-t border-seam pt-3 text-[11px] text-ink-3">{t.app.demoDataLong}</p>
      </article>
    </div>
  );
}
