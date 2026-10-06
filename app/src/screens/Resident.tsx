import { Link } from "react-router-dom";
import { Check, Mic, Plus } from "lucide-react";
import type { WorkOrder } from "@/domain/types";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { MobileTabBar } from "@/app/Shell";
import { Button, LiabilityChip, StatusChip } from "@/ui/primitives";
import { StaffGauge } from "@/ui/StaffGauge";
import { cn } from "@/ui/cn";

const STEPS: Array<{ key: string; done: (w: WorkOrder) => boolean }> = [
  { key: "received", done: () => true },
  { key: "assigned", done: (w) => !!w.subcontractorId || w.assigneeOrg !== "subcon" },
  { key: "accepted", done: (w) => !!w.respondedAt },
  { key: "resolved", done: (w) => !!w.resolvedAt },
  { key: "closed", done: (w) => w.status === "closed" }
];

export default function Resident() {
  const { t, f, b, dateTime, time, lang } = useI18n();
  const now = useNow(1000);
  const dir = useDirectory();
  const q = useQuery((s) => s.workOrders.list({ reportedBy: "P-LAYLA" }), []);
  const all = q.data ?? [];
  const active = all.filter((w) => w.status !== "closed" && w.status !== "cancelled");
  const past = all.filter((w) => w.status === "closed");
  const layla = dir?.person("P-LAYLA");
  const stepLabel: Record<string, string> = lang === "ar"
    ? { received: "تم الاستلام", assigned: "أُسند للفريق", accepted: "الفني في الطريق", resolved: "تم الإصلاح", closed: "مغلق" }
    : { received: "Received", assigned: "Team assigned", accepted: "Technician on the way", resolved: "Fixed", closed: "Closed" };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 pt-4 pb-6">
        <h1 className="text-[24px] font-semibold text-ink">{f(t.resident.greeting, { name: layla ? b(layla.name).split(" ")[0] : "" })}</h1>
        <p className="text-[13px] text-ink-3">{t.resident.home}</p>

        <Link to="/me/voice" className="mt-5 flex items-center gap-4 rounded-xl bg-ink p-4 text-sheet active:opacity-90">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fluoro text-on-fluoro"><Mic size={22} aria-hidden /></span>
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold">{lang === "ar" ? "تحدّث معنا" : "Talk to us"}</span>
            <span className="block text-[12.5px] text-white/70">{lang === "ar" ? "صف المشكلة بصوتك، ونحن نتولى الباقي" : "Describe the problem out loud. We'll take it from there."}</span>
          </span>
        </Link>

        <h2 className="mt-6 mb-2 text-[13px] font-medium text-ink-2">{t.resident.active}</h2>
        {active.length === 0 ? (
          <div className="rounded-lg border border-dashed border-seam-strong bg-sheet/60 px-4 py-8 text-center">
            <p className="text-[14px] text-ink-2">{t.resident.none}</p>
            <Link to="/me/new" className="mt-3 inline-block"><Button variant="primary" icon={<Plus size={15} />}>{t.nav.newRequest}</Button></Link>
          </div>
        ) : active.map((w) => {
          const tech = dir?.person(w.technicianId);
          return (
            <article key={w.id} className="sheet mb-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="reading text-[12px] text-ink-3">{w.ref}</span>
                <StatusChip status={w.status} />
              </div>
              <h3 className="mt-1 text-[17px] font-semibold text-ink">{b(w.title)}</h3>
              <div className="mt-1.5"><LiabilityChip liability={w.liability} long /></div>
              <ol className="mt-4 flex flex-col gap-0">
                {STEPS.map((s, i) => {
                  const done = s.done(w);
                  return (
                    <li key={s.key} className="grid grid-cols-[22px_1fr] gap-2.5">
                      <span className="flex flex-col items-center">
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border-2", done ? "border-ink bg-ink text-sheet" : "border-seam-strong bg-sheet")}>{done && <Check size={11} strokeWidth={3} />}</span>
                        {i < STEPS.length - 1 && <span className={cn("h-5 w-0.5", done ? "bg-ink" : "bg-seam")} />}
                      </span>
                      <span className={cn("pt-0.5 text-[13.5px]", done ? "text-ink" : "text-ink-3")}>
                        {stepLabel[s.key]}
                        {s.key === "received" && <span className="reading ms-2 text-[11.5px] text-ink-3">{time(w.reportedAt)}</span>}
                        {s.key === "accepted" && tech && done && <span className="ms-2 text-[12px] text-ink-2">· {b(tech.name)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 border-t border-seam pt-3">
                <div className="mb-1.5 text-[12px] text-ink-3">{t.resident.eta} <span className="reading">{dateTime(w.resolveDueAt)}</span></div>
                <StaffGauge start={w.reportedAt} due={w.resolveDueAt} now={now} doneAt={w.resolvedAt} size="sm" />
              </div>
            </article>
          );
        })}

        {past.length > 0 && <h2 className="mt-6 mb-2 text-[13px] font-medium text-ink-2">{t.resident.past}</h2>}
        <ul className="sheet divide-y divide-seam">
          {past.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] text-ink">{b(w.title)}</div>
                <div className="reading text-[11.5px] text-ink-3">{w.ref} · {dateTime(w.reportedAt)}</div>
              </div>
              <StatusChip status={w.status} />
            </li>
          ))}
        </ul>
      </div>
      <MobileTabBar />
    </div>
  );
}
