import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, FileArchive, Maximize2, Minimize2, XOctagon } from "lucide-react";
import type { ComplianceItem, ComplianceSystem, Rag } from "@/domain/types";
import { DAY, ms } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery, useServices } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { Button, PageHeader, Panel, RagChip, PageLoader } from "@/ui/primitives";
import { cn } from "@/ui/cn";

const SYSTEMS: ComplianceSystem[] = [
  "civil_defence_certificate", "fire_alarm", "sprinklers", "fire_pumps", "emergency_lighting", "extinguishers", "hassantuk", "lifts", "water_tank_cleaning", "lifting_equipment"
];
const RAG_ICON: Record<Rag, typeof CheckCircle2> = { green: CheckCircle2, amber: Clock, red: XOctagon };

export default function Compliance() {
  const { t, b, lang, date, num } = useI18n();
  const services = useServices();
  const now = useNow(60000);
  const dir = useDirectory();
  const q = useQuery((s) => s.compliance.items(), []);
  const [sel, setSel] = useState<ComplianceItem | null>(null);
  const [wall, setWall] = useState(false);
  const items = q.data ?? [];
  const sites = dir?.sites ?? [];
  const cell = (siteId: string, sys: ComplianceSystem) => items.find((i) => i.siteId === siteId && i.system === sys);
  const days = (i: ComplianceItem) => Math.floor((ms(i.expiresAt) - now) / DAY);
  const soonest = [...items].sort((a, b) => ms(a.expiresAt) - ms(b.expiresAt))[0];
  const selected = sel ?? (soonest !== undefined ? soonest : null);

  const grid = (
    <div className="overflow-x-auto">
      <table className={cn("w-full min-w-[1040px] table-fixed border-separate", wall ? "border-spacing-2" : "border-spacing-1")}>
        <thead>
          <tr>
            <th className="w-48" />
            {SYSTEMS.map((s) => <th key={s} className={cn("px-1 pb-1 text-start align-bottom font-medium", wall ? "text-[13px] text-white/70" : "text-[11.5px] text-ink-3")}>{t.compliance[s]}</th>)}
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.id}>
              <th scope="row" className={cn("pe-2 text-start align-middle font-medium", wall ? "text-[15px] text-white" : "text-[13px] text-ink")}>
                {b(site.name)}
                <Link to={`/compliance/audit/${site.id}`} className={cn("mt-0.5 flex items-center gap-1 text-[11.5px] font-normal", wall ? "text-white/60" : "text-ink-3 hover:text-fluoro-ink")}><FileArchive size={12} />{t.compliance.auditPack}</Link>
              </th>
              {SYSTEMS.map((sys) => {
                const it = cell(site.id, sys);
                if (it === undefined) return <td key={sys} className={cn("rounded-sm text-center text-[11px]", wall ? "bg-white/5 text-white/30" : "bg-sheet-2/60 text-ink-3")}>{t.compliance.notApplicable}</td>;
                const rag = services.compliance.rag(it, now);
                const Icon = RAG_ICON[rag];
                const d = days(it);
                return (
                  <td key={sys} className="p-0">
                    <button
                      onClick={() => setSel(it)}
                      className={cn(
                        "flex w-full flex-col items-start gap-1 rounded-sm px-2.5 text-start transition-transform hover:-translate-y-px",
                        wall ? "min-h-24 py-2.5" : "min-h-[68px] py-2",
                        rag === "green" && "bg-ok-wash text-ok",
                        rag === "amber" && "bg-risk-fill/90 text-ink",
                        rag === "red" && "hazard-on-red bg-breach text-white",
                        selected?.id === it.id && !wall && "crosshair"
                      )}
                      aria-label={`${b(site.name)} · ${t.compliance[sys]} · ${t.compliance[rag]}`}
                    >
                      <Icon size={wall ? 20 : 15} strokeWidth={2.2} aria-hidden className={cn("shrink-0", rag === "red" && "rounded-full bg-breach")} />
                      <span className={cn("reading leading-none font-semibold", wall ? "text-[20px]" : "text-[14px]", rag === "red" && "rounded-sm bg-breach px-0.5")}>
                        {d < 0 ? `${-d}${t.units.d}` : `${d}${t.units.d}`}
                      </span>
                      <span className={cn("text-[10.5px] leading-tight", rag === "red" && "rounded-sm bg-breach px-0.5")}>{d < 0 ? t.compliance.daysOver : t.compliance.daysLeft}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (wall) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-ink p-8 text-white">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[26px] font-semibold">{t.compliance.title}</h1>
          <Button variant="secondary" icon={<Minimize2 size={15} />} onClick={() => setWall(false)}>{t.chrome.close}</Button>
        </div>
        {grid}
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title={t.compliance.title}
        subtitle={t.compliance.subtitle}
        actions={<Button variant="secondary" icon={<Maximize2 size={15} />} onClick={() => setWall(true)}>{t.compliance.wallMode}</Button>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {(["green", "amber", "red"] as Rag[]).map((r) => <RagChip key={r} rag={r} label={`${num(items.filter((i) => services.compliance.rag(i, now) === r).length)} · ${t.compliance[r]}`} />)}
      </div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="sheet p-3">{q.data === undefined ? <PageLoader className="h-72" /> : grid}</section>
        {selected && (
          <Panel title={`${b(dir?.site(selected.siteId)?.name)} · ${t.compliance[selected.system]}`} actions={<RagChip rag={services.compliance.rag(selected, now)} />}>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <div><dt className="text-[12px] text-ink-3">{t.compliance.certificate}</dt><dd className="reading text-ink">{selected.certificateNo}</dd></div>
              <div><dt className="text-[12px] text-ink-3">{t.compliance.expires}</dt><dd className="reading text-ink">{date(selected.expiresAt)}</dd></div>
              <div><dt className="text-[12px] text-ink-3">{t.compliance.lastInspection}</dt><dd className="reading text-ink">{date(selected.lastInspection)}</dd></div>
              <div><dt className="text-[12px] text-ink-3">{t.compliance.contractor}</dt><dd className="text-ink">{selected.contractorId ? (lang === "ar" ? dir?.sub(selected.contractorId)?.nameAr : dir?.sub(selected.contractorId)?.name) : "—"}</dd></div>
              <div><dt className="text-[12px] text-ink-3">{t.compliance.evidence}</dt><dd className="tnum text-ink">{selected.evidenceCount}</dd></div>
              <div><dt className="text-[12px] text-ink-3">{t.compliance.findings}</dt><dd className={cn("tnum", selected.openFindings ? "font-semibold text-breach" : "text-ink")}>{selected.openFindings}</dd></div>
            </dl>
            {selected.system === "hassantuk" && <p className="mt-3 flex gap-2 rounded-md bg-sheet-2 p-2.5 text-[12px] text-ink-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{t.compliance.hassantukNote}</p>}
            <Link to={`/compliance/audit/${selected.siteId}`} className="mt-4 block"><Button variant="ink" className="w-full" icon={<FileArchive size={15} />}>{t.compliance.auditPack}</Button></Link>
          </Panel>
        )}
      </div>
    </div>
  );
}
