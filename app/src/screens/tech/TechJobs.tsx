import { Link } from "react-router-dom";
import { MapPin, ScanLine } from "lucide-react";
import { readSla } from "@/domain/sla";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { MobileTabBar } from "@/app/Shell";
import { Button, Empty, LiabilityChip, PriorityChip, StatusChip } from "@/ui/primitives";
import { StaffGauge } from "@/ui/StaffGauge";
import { cn } from "@/ui/cn";
import { woWhere } from "../shared";

export default function TechJobs() {
  const { t, f, b, lang } = useI18n();
  const now = useNow(1000);
  const dir = useDirectory();
  const q = useQuery((s) => s.workOrders.list({ technicianId: "P-JOEL", open: true }), []);
  const jobs = [...(q.data ?? [])].sort((a, c) => readSla(a.reportedAt, a.resolveDueAt, now).remainingMs - readSla(c.reportedAt, c.resolveDueAt, now).remainingMs);
  const joel = dir?.person("P-JOEL");

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 pt-4 pb-6">
        <div className="flex items-end justify-between">
          <h1 className="text-[24px] font-semibold text-ink">{t.tech.today}</h1>
          <span className="reading text-[13px] text-ink-2">{jobs.length === 1 ? t.tech.jobsOne : f(t.tech.jobs, { count: jobs.length })}</span>
        </div>
        <p className="text-[13px] text-ink-3">{joel ? `${b(joel.name)} · Coolbreeze MEP (demo)` : ""}</p>
        <Link to="/tech/scan" className="mt-4 block">
          <Button variant="ink" size="lg" className="w-full" icon={<ScanLine size={18} aria-hidden />}>{t.tech.scanTitle}</Button>
        </Link>
        <div className="mt-5 flex flex-col gap-3">
          {jobs.length === 0 && q.data !== undefined && <div className="sheet"><Empty title={t.empty.jobs} hint={t.empty.jobsHint} /></div>}
          {jobs.map((wo, i) => {
            const r = readSla(wo.reportedAt, wo.resolveDueAt, now);
            return (
              <Link key={wo.id} to={`/tech/job/${wo.id}`} className={cn("sheet relative block overflow-hidden p-4 active:bg-sheet-2", i === 0 && "crosshair", r.phase === "breached" && "border-breach/60")}>
                {r.phase === "breached" && <div className="hazard absolute inset-x-0 top-0 h-1" aria-hidden />}
                <div className="flex flex-wrap items-center gap-1.5">
                  <PriorityChip priority={wo.priority} summer={wo.summerUplift} />
                  <LiabilityChip liability={wo.liability} />
                  <StatusChip status={wo.status} />
                </div>
                <h2 className="mt-2 text-[18px] leading-snug font-semibold text-ink">{b(wo.title)}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-[13.5px] text-ink-2"><MapPin size={14} aria-hidden />{woWhere(wo, dir, b, lang)}</p>
                <StaffGauge className="mt-3" start={wo.reportedAt} due={wo.resolveDueAt} now={now} size="md" />
              </Link>
            );
          })}
        </div>
      </div>
      <MobileTabBar />
    </div>
  );
}
