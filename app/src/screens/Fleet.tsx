import { useState } from "react";
import { AlertOctagon, Wrench } from "lucide-react";
import type { Equipment, EquipmentType } from "@/domain/types";
import { DAY, ms } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { Ledger, PageHeader, Panel, Segmented, Skeleton } from "@/ui/primitives";
import { cn } from "@/ui/cn";

const statusStyle: Record<Equipment["status"], string> = {
  working: "bg-ok-wash text-ok border border-ok/30",
  idle: "border border-seam-strong text-ink-2",
  breakdown: "bg-breach text-white",
  service: "bg-risk-wash text-risk border border-risk/40"
};

export default function Fleet() {
  const { t, b, date, num, dateTime } = useI18n();
  const now = useNow(60000);
  const eq = useQuery((s) => s.fleet.equipment(), []);
  const bd = useQuery((s) => s.fleet.breakdowns(), []);
  const [filter, setFilter] = useState<"all" | "attention">("attention");
  const list = eq.data ?? [];
  const tpiOverdue = (e: Equipment) => !!e.tpiExpiry && ms(e.tpiExpiry) < now;
  const serviceOver = (e: Equipment) => e.hours >= e.nextServiceHours;
  const attention = (e: Equipment) => tpiOverdue(e) || serviceOver(e) || e.status === "breakdown" || (!!e.tpiExpiry && ms(e.tpiExpiry) - now < 30 * DAY);
  const shown = (filter === "attention" ? list.filter(attention) : list).sort((a, c) => Number(tpiOverdue(c)) - Number(tpiOverdue(a)) || Number(c.status === "breakdown") - Number(a.status === "breakdown"));
  const avail = list.length ? Math.round((list.filter((e) => e.status === "working" || e.status === "idle").length / list.length) * 100) : 0;
  const count = (s: Equipment["status"]) => list.filter((e) => e.status === s).length;

  return (
    <div className="animate-rise">
      <PageHeader title={t.fleet.title} subtitle={t.fleet.subtitle} />
      <section className="sheet mb-4 grid grid-cols-2 gap-6 px-5 py-4 md:grid-cols-5">
        {eq.data === undefined ? <Skeleton className="col-span-5 h-16" /> : (
          <>
            <Ledger size="xl" value={`${avail}%`} label={t.fleet.availability} sub={`${num(list.length)}`} />
            <Ledger size="md" tone="ok" value={num(count("working"))} label={t.fleet.working} />
            <Ledger size="md" value={num(count("idle"))} label={t.fleet.idle} />
            <Ledger size="md" tone="breach" value={num(count("breakdown"))} label={t.fleet.breakdown} />
            <Ledger size="md" tone="risk" value={num(count("service"))} label={t.fleet.service} />
          </>
        )}
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={t.fleet.title} bodyClassName="p-0" actions={<Segmented label="filter" value={filter} onChange={setFilter} options={[{ value: "attention", label: t.fleet.attention }, { value: "all", label: t.chrome.all }]} />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="bg-sheet-2 text-[11.5px] text-ink-3"><tr className="seam-b">{["Fleet no.", "", t.fleet.serviceDue, t.fleet.tpi, ""].map((h, i) => <th key={i} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-seam">
                {shown.map((e) => {
                  const toService = e.nextServiceHours - e.hours;
                  return (
                    <tr key={e.id} className={cn(tpiOverdue(e) && "bg-breach-wash/60")}>
                      <td className="px-4 py-2.5"><div className="reading font-semibold text-ink">{e.fleetNo}</div><div className="text-[11.5px] text-ink-3">{t.fleet[e.type as EquipmentType]}</div></td>
                      <td className="px-4 py-2.5"><div className="text-ink">{e.model}</div><div className="text-[11.5px] text-ink-3">{b(e.projectLabel)} · {e.year}</div></td>
                      <td className="px-4 py-2.5">
                        <div className={cn("reading", toService < 0 ? "font-semibold text-breach" : toService < 50 ? "text-risk" : "text-ink-2")}>{toService < 0 ? `${num(-toService)} h ${t.fleet.overdue}` : `${num(toService)} ${t.fleet.hoursToService}`}</div>
                        <div className="reading text-[11px] text-ink-3">{num(e.hours)} h</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {e.tpiExpiry ? (
                          tpiOverdue(e) ? <span className="inline-flex items-center gap-1 rounded-sm bg-breach px-1.5 py-0.5 text-[11.5px] font-medium text-white"><AlertOctagon size={12} />{t.fleet.tpiOverdue}</span>
                            : <span className="reading text-[12px] text-ink-2">{date(e.tpiExpiry)}</span>
                        ) : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-end"><span className={cn("rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium", statusStyle[e.status])}>{t.fleet[e.status]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title={t.fleet.breakdowns}>
          <ul className="flex flex-col gap-3">
            {(bd.data ?? []).map((x) => {
              const e = list.find((q) => q.id === x.equipmentId);
              return (
                <li key={x.id} className="flex gap-3">
                  <Wrench size={16} className="mt-0.5 shrink-0 text-breach" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink"><span className="reading">{e?.fleetNo}</span> · {e?.model}</div>
                    <div className="text-[12.5px] text-ink-2">{b(x.description)}</div>
                    <div className="reading text-[11.5px] text-ink-3">{dateTime(x.reportedAt)} · {x.downtimeHours} h {t.fleet.downtime}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
