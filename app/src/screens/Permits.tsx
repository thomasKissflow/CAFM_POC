import { Flame, HardHat, Plug, Wind } from "lucide-react";
import type { Permit, PermitType } from "@/domain/types";
import { useI18n } from "@/i18n";
import { useQuery, useServices } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { ROLE_PERSON, useSession } from "@/app/session";
import { Button, PageHeader, PageLoader } from "@/ui/primitives";
import { cn } from "@/ui/cn";

const ICON: Record<PermitType, typeof Flame> = { hot_work: Flame, work_at_height: HardHat, electrical_isolation: Plug, confined_space: Wind };
const STATUS: Record<Permit["status"], string> = {
  requested: "border border-dashed border-ink-3 text-ink",
  approved: "bg-sheet-2 text-ink border border-seam-strong",
  active: "bg-fluoro text-on-fluoro",
  closed: "text-ink-3 border border-seam",
  rejected: "bg-breach-wash text-breach"
};

export default function Permits() {
  const { t, b, dateTime } = useI18n();
  const services = useServices();
  const dir = useDirectory();
  const { role } = useSession();
  const q = useQuery((s) => s.permits.list(), []);
  const order: Permit["status"][] = ["requested", "active", "approved", "closed", "rejected"];
  const list = [...(q.data ?? [])].sort((a, c) => order.indexOf(a.status) - order.indexOf(c.status));
  return (
    <div className="animate-rise">
      <PageHeader title={t.permits.title} subtitle={t.permits.subtitle} />
      {q.data === undefined ? <PageLoader className="h-96" /> : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map((p) => {
            const Icon = ICON[p.type];
            return (
              <article key={p.id} className={cn("sheet flex flex-col gap-3 p-4", p.status === "active" && "crosshair")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", p.type === "hot_work" ? "bg-fluoro-wash text-fluoro-ink" : "bg-sheet-2 text-ink")}><Icon size={18} aria-hidden /></span>
                    <div>
                      <div className="text-[14px] font-semibold text-ink">{t.permits[p.type]}</div>
                      <div className="reading text-[11.5px] text-ink-3">{p.ref} · {dir?.site(p.siteId)?.code}</div>
                    </div>
                  </div>
                  <span className={cn("rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium", STATUS[p.status])}>{t.permits[p.status]}</span>
                </div>
                <p className="text-[13.5px] text-ink">{b(p.location)}</p>
                <div className="text-[12px] text-ink-2">{t.permits.validity}: <span className="reading">{dateTime(p.validFrom)} → {dateTime(p.validTo)}</span></div>
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-3">{t.permits.controls}</div>
                  <ul className="flex flex-col gap-1 text-[12.5px] text-ink-2">{p.controls.map((c) => <li key={c.en} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-ink" />{b(c)}</li>)}</ul>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-seam pt-3 text-[12px] text-ink-3">
                  <span>{b(dir?.person(p.requesterId)?.name)}</span>
                  {p.status === "requested" && (role === "hse" || role === "fm_manager") && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" onClick={() => void services.permits.setStatus(p.id, "rejected", ROLE_PERSON[role])}>{t.permits.reject}</Button>
                      <Button size="sm" variant="ink" onClick={() => void services.permits.setStatus(p.id, "approved", ROLE_PERSON[role])}>{t.permits.approve}</Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
