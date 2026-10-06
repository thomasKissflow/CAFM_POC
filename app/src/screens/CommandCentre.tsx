import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Layers } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { useDirectory, sitesInDlp } from "@/app/lookups";
import { addMonthsGst, ms, toGst } from "@/domain/time";
import { ChainageRuler } from "@/ui/ChainageRuler";
import { Button, PageHeader, Panel, RagChip, Segmented, Skeleton, PageLoader } from "@/ui/primitives";
import { cn } from "@/ui/cn";
import { WoRow } from "./shared";
import { AskPanel } from "./AskPanel";
import { ChartTip } from "./ChartTip";

/** "all", "own" (Dutco's own offices, camps and yards), or one building's id. */
type Scope = string;
const SLA_TARGET = 95; // DEMO target

export default function CommandCentre() {
  const { t, f, b, aed, num, month, lang } = useI18n();
  const now = useNow(1000);
  const dir = useDirectory();
  const [scope, setScope] = useState<Scope>("all");
  const client = (dir?.sites ?? []).filter((s) => !s.ownOperations);
  const own = (dir?.sites ?? []).filter((s) => s.ownOperations);
  const siteIds = scope === "all" ? undefined : scope === "own" ? own.map((s) => s.id) : [scope];
  const q = useQuery((s) => s.reports.commandCentre(siteIds), [scope, dir !== undefined]);
  const cc = q.data;
  // the chainage follows the scope: the building you picked, else whichever is closest to leaving its DLP
  const inDlp = sitesInDlp(dir, now);
  const chained = scope !== "all" && scope !== "own" ? dir?.site(scope) : inDlp[0];

  return (
    <div className="animate-rise">
      <PageHeader
        title={t.command.title}
        subtitle={t.command.subtitle}
        actions={
          <Segmented<Scope>
            label={t.chrome.sites}
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: t.chrome.all },
              // one button per client building, so a building added today is here too; four fit, the rest live on the portfolio
              ...client.slice(0, 4).map((s) => ({ value: s.id, label: b(s.name) })),
              ...(own.length > 0 ? [{ value: "own", label: t.portfolio.ownOps }] : [])
            ]}
          />
        }
      />

      {/* The building in scope, or whichever leaves its DLP next: chainage from TOC to expiry */}
      <section className="sheet survey-grid mb-4 px-5 pt-4 pb-3">
        {chained?.tocDate !== undefined
          ? <ChainageRuler title={`${t.command.dlpChainage} · ${b(chained.name)}`} start={chained.tocDate} end={toGst(ms(addMonthsGst(chained.tocDate, chained.dlpMonths ?? 12)) - 1000)} now={now} />
          : dir === undefined ? <Skeleton className="h-16" /> : <p className="text-[12.5px] text-ink-3">{t.dlp.noneHandedOver}</p>}
      </section>

      <div className="grid grid-cols-12 gap-4">
        {/* Liability ledger: a ruled field-book, readings right-aligned */}
        <Panel className="col-span-12 xl:col-span-7" title={t.command.ledger}
          actions={<Link to="/dlp" className="flex items-center gap-1 text-[12.5px] text-ink-2 hover:text-ink">{t.chrome.viewAll}<ArrowUpRight size={13} className="rtl:-scale-x-100" /></Link>}>
          {cc ? (
            <>
              <div className="flex flex-col">
                  <LedgerRow label={t.command.recovered} sub={t.command.recoveredYtd} value={aed(cc.dlp.recoveredYtdAed)} tone="fluoro" lead />
                  <LedgerRow label={t.command.pending} value={aed(cc.dlp.pendingRecoveryAed)} />
                  <LedgerRow label={t.command.disputed} value={aed(cc.dlp.disputedAed)} tone={cc.dlp.disputedAed > 0 ? "risk" : undefined} />
                  <LedgerRow label={t.command.exposure} sub={`${t.command.openDlp}: ${num(cc.dlp.openDlpJobs)}`} value={aed(cc.dlp.openDlpEstimateAed)} />
              </div>
              <div className="mt-5 h-[140px]" aria-label={t.command.recoveryTrend}>
                <div className="mb-1 text-[12px] text-ink-3">{t.command.recoveryTrend}</div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cc.dlp.byMonth.map((m) => ({ ...m, label: month(m.month).split(" ")[0] }))} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke="var(--color-seam)" strokeDasharray="2 4" />
                    <XAxis dataKey="label" interval={0} tickLine={false} axisLine={{ stroke: "var(--color-seam-strong)" }} tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} reversed={lang === "ar"} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: "rgb(22 25 28 / 0.04)" }} content={<ChartTip format={(v) => aed(v)} />} />
                    <Bar dataKey="recoveredAed" name={t.command.recovered} fill="var(--color-fluoro)" radius={[4, 4, 0, 0]} maxBarSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {cc.batchAlerts.map((a) => {
                const sub = dir?.sub(a.subcontractorId);
                return (
                  <div key={a.batch} className="mt-5 grid grid-cols-[6px_1fr] gap-4 rounded-md border border-fluoro/50 bg-fluoro-wash/60">
                    <div className="rounded-s-md bg-fluoro" aria-hidden />
                    <div className="py-3 pe-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Layers size={15} className="text-fluoro-ink" aria-hidden />
                        <span className="text-[13.5px] font-semibold text-ink">{t.command.batchAlert}</span>
                        <span className="reading text-[12px] text-fluoro-ink">{a.batch}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-ink-2">
                        {f(t.command.batchAlertBody, { count: a.count, cause: t.rootCause[a.rootCause], days: a.windowDays, batch: a.batch, from: a.floors[0], to: a.floors[1], sub: sub ? (lang === "ar" ? sub.nameAr : sub.name) : "" })}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {a.assetTags.map((tag) => (
                          <Link key={tag} to={`/assets/A-QMR-${tag}`} className="reading rounded-sm border border-seam-strong bg-sheet px-1.5 py-0.5 text-[11.5px] text-ink hover:border-fluoro">{tag}</Link>
                        ))}
                      </div>
                      <Button size="sm" variant="ink" className="mt-2.5" onClick={() => toast.success(t.command.batchRaised)}>{t.command.raiseBatch}</Button>
                    </div>
                  </div>
                );
              })}
              <div className="mt-6 border-t border-seam pt-4">
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2"><h3 className="text-[13.5px] font-semibold text-ink">{t.command.acHeat}</h3><span className="text-[12px] text-ink-3">{t.command.acHeatNote}</span></div>
                <AcHeat rows={cc.acHeat} />
              </div>
            </>
          ) : <PageLoader className="h-64" />}
        </Panel>

        {/* Clocks closest to breach + where the heat is */}
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-5">
          <Panel title={t.command.clocksAtRisk} meta={cc ? `${num(cc.openTotal)} ${t.command.openJobs.toLowerCase()}` : undefined} bodyClassName="p-0"
            actions={<Link to="/queue?view=board" className="flex items-center gap-1 text-[12.5px] text-ink-2 hover:text-ink">{t.queue.board}<ArrowUpRight size={13} className="rtl:-scale-x-100" /></Link>}>
            {cc ? <div className="divide-y divide-seam">{cc.atRisk.slice(0, 7).map((wo) => <WoRow key={wo.id} wo={wo} dir={dir} now={now} compact />)}</div> : <div className="p-4"><PageLoader className="h-64" /></div>}
          </Panel>
        </div>

        {/* Assurance strip: ruled sections on one sheet, not a card row */}
        <section className="sheet col-span-12 grid md:grid-cols-[1.4fr_1fr_0.8fr] md:divide-x md:divide-seam md:rtl:divide-x-reverse">
          <div className="p-5">
            <SectionHead title={t.command.slaMonth} />
            {cc ? (
              <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col">
                  <ReadingRow label={t.sla.resolution} value={cc.sla.pct} target={SLA_TARGET} suffix="%" />
                  <ReadingRow label={t.sla.response} value={cc.sla.responseMetPct} target={SLA_TARGET} suffix="%" />
                  <div className="pt-2 text-[12px] text-ink-3"><span className="reading">{num(cc.sla.met)} / {num(cc.sla.total)}</span> · {t.sla.met}</div>
                </div>
                <StaffReadings data={cc.slaTrend.map((m) => ({ label: lang === "ar" ? month(m.month).split(" ")[0] : month(m.month).split(" ")[0].slice(0, 3), value: m.pct }))} target={SLA_TARGET} targetLabel={t.command.target} />
              </div>
            ) : <Skeleton className="h-24" />}
          </div>
          <div className="border-t border-seam p-5 md:border-t-0">
            <SectionHead title={t.command.compliancePosture} link={<Link to="/compliance" className="text-[12.5px] text-ink-2 hover:text-ink">{t.chrome.open}</Link>} />
            {cc ? (
              <>
                <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-sm" role="img" aria-label={`${cc.complianceRag.green} / ${cc.complianceRag.amber} / ${cc.complianceRag.red}`}>
                  <div className="bg-ok" style={{ flex: cc.complianceRag.green }} />
                  <div className="bg-risk-fill" style={{ flex: cc.complianceRag.amber }} />
                  <div className="hazard-on-red bg-breach" style={{ flex: cc.complianceRag.red }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <RagChip rag="green" label={`${cc.complianceRag.green} ${t.compliance.green}`} />
                  <RagChip rag="amber" label={`${cc.complianceRag.amber} ${t.compliance.amber}`} />
                  <RagChip rag="red" label={`${cc.complianceRag.red} ${t.compliance.red}`} />
                </div>
              </>
            ) : <Skeleton className="h-16" />}
          </div>
          <div className="border-t border-seam p-5 md:border-t-0">
            <SectionHead title={t.command.fleet} link={<Link to="/fleet" className="text-[12.5px] text-ink-2 hover:text-ink">{t.chrome.open}</Link>} />
            {cc ? (
              <>
                <ReadingRow label={t.fleet.availability} value={cc.fleetAvailabilityPct} target={85} suffix="%" />
                <div className="flex items-baseline justify-between gap-3 border-b border-seam py-2 last:border-b-0">
                  <span className="text-[13px] text-ink-2">{t.command.fleetDown.charAt(0).toUpperCase() + t.command.fleetDown.slice(1)}</span>
                  <span className="reading text-[16px] font-medium text-ink">{cc.fleetDown}</span>
                </div>
              </>
            ) : <Skeleton className="h-16" />}
          </div>
        </section>

        <div className="col-span-12"><AskPanel /></div>
      </div>
    </div>
  );
}

/** A field-book reading: value, target and signed variance. */
function ReadingRow({ label, value, target, suffix = "" }: { label: string; value: number; target: number; suffix?: string }) {
  const { t, num } = useI18n();
  const v = Math.round((value - target) * 10) / 10;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-seam py-2 last:border-b-0">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className={cn("reading text-end text-[20px] font-semibold", v >= 0 ? "text-ok" : "text-ink")}><bdi dir="ltr">{num(value, 1)}{suffix}</bdi></span>
      <span className={cn("col-span-2 text-end text-[11.5px] whitespace-nowrap", v >= 0 ? "text-ok" : "text-breach")}>
        <bdi dir="ltr" className="reading">{v >= 0 ? "+" : "−"}{num(Math.abs(v), 1)}</bdi> · {t.command.target} <bdi dir="ltr" className="reading">{target}{suffix}</bdi>
      </span>
    </div>
  );
}

function SectionHead({ title, link }: { title: string; link?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13.5px] font-semibold text-ink">{title}</h2>
      {link}
    </div>
  );
}

function LedgerRow({ label, sub, value, tone, lead = false }: { label: string; sub?: string; value: string; tone?: "fluoro" | "risk"; lead?: boolean }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 border-b border-seam py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
      <div className="min-w-0">
        <span className={cn("block text-ink", lead ? "text-[14.5px] font-medium" : "text-[13.5px]")}>{label}</span>
        {sub && <span className="block text-[12px] text-ink-3">{sub}</span>}
      </div>
      <div className={cn("reading whitespace-nowrap sm:text-end", lead ? "text-[32px] leading-none font-semibold tracking-[-0.03em]" : "text-[17px] font-medium",
        tone === "fluoro" ? "text-fluoro-ink" : tone === "risk" ? "text-risk" : "text-ink")}>{value}</div>
    </div>
  );
}

/** Monthly SLA as vertical level-staff readings against the target line (scale 80–100%). */
function StaffReadings({ data, target, targetLabel }: { data: Array<{ label: string; value: number }>; target: number; targetLabel: string }) {
  const H = 72;
  const y = (v: number) => H - ((Math.max(80, Math.min(100, v)) - 80) / 20) * H;
  return (
    <div className="flex min-w-0 flex-1 items-end gap-3" role="img" aria-label={data.map((d) => `${d.label} ${d.value}%`).join(", ")}>
      <div className="relative flex flex-1 items-end justify-between gap-2" style={{ height: H + 38 }}>
        <div className="absolute inset-x-0 border-t border-dashed border-fluoro" style={{ top: y(target) + 18 }} aria-hidden />
        <span className="reading absolute -bottom-4 end-0 flex items-center gap-1 text-[10px] text-fluoro-ink"><span className="w-3 border-t border-dashed border-fluoro" />{targetLabel} {target}%</span>
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center" title={`${d.label}: ${d.value}%`}>
            <span className={cn("reading mb-1 text-[10.5px]", d.value >= target ? "text-ok" : "text-ink-2")}>{Math.round(d.value)}</span>
            <div className="relative w-2.5 border border-seam-strong bg-sheet-2" style={{ height: H }}>
              {[0.25, 0.5, 0.75].map((f) => <span key={f} className="absolute inset-x-0 h-px bg-ink-3/40" style={{ top: `${f * 100}%` }} />)}
              <div className={cn("absolute inset-x-0 bottom-0", d.value >= target ? "bg-ok" : "bg-ink")} style={{ height: H - y(d.value) }} />
            </div>
            <span className="mt-1 text-[10.5px] text-ink-3">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AcHeat({ rows }: { rows: Array<{ floor: number; weeks: number[] }> }) {
  const { t } = useI18n();
  const shade = (n: number) => (n === 0 ? "var(--color-sheet-2)" : n === 1 ? "#ffd6c4" : n === 2 ? "#ffa47f" : "var(--color-fluoro)");
  return (
    <div className="flex gap-3">
      <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: "28px repeat(8, 1fr)" }}>
        {rows.map((r) => (
          <div key={r.floor} className="contents">
            <div className={`reading text-end text-[9.5px] leading-[8px] ${r.floor === 14 ? "font-bold text-fluoro-ink" : "text-ink-3"}`}>{r.floor % 2 === 0 ? r.floor : ""}</div>
            {r.weeks.map((n, i) => (
              <div key={i} title={`${t.command.floor} ${r.floor} · ${t.command.week} ${i + 1}: ${n}`} className="h-[8px] rounded-[1px]" style={{ background: shade(n), outline: r.floor >= 12 && r.floor <= 16 && n > 0 ? "1px solid rgb(22 25 28 / 0.25)" : undefined }} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-end gap-1 text-[10.5px] text-ink-3">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-[1px]" style={{ background: shade(n) }} />{n === 3 ? "3+" : n}</div>
        ))}
      </div>
    </div>
  );
}
