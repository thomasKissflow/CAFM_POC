import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bot, Cpu, User } from "lucide-react";
import type { WoEvent, WorkOrder } from "@/domain/types";
import { readSla } from "@/domain/sla";
import { useI18n } from "@/i18n";
import type { Directory } from "@/app/lookups";
import { ChannelChip, LiabilityChip, PriorityChip, StatusChip } from "@/ui/primitives";
import { StaffGauge } from "@/ui/StaffGauge";
import { cn } from "@/ui/cn";

export function woWhere(wo: WorkOrder, dir: Directory | undefined, b: (v: { en: string; ar: string } | undefined) => string, lang: "en" | "ar") {
  const site = dir?.site(wo.siteId);
  const unit = wo.unitId ? wo.unitId.split("-").pop() : undefined;
  const unitLabel = unit ? (lang === "ar" ? `شقة ${unit}` : `Apt ${unit}`) : undefined;
  return [site ? b(site.name) : wo.siteId, unitLabel].filter(Boolean).join(" · ");
}

export function assigneeName(wo: WorkOrder, dir: Directory | undefined, b: (v: { en: string; ar: string } | undefined) => string, lang: "en" | "ar") {
  const tech = dir?.person(wo.technicianId);
  if (tech) return b(tech.name);
  const sub = dir?.sub(wo.subcontractorId);
  if (sub) return lang === "ar" ? sub.nameAr : sub.name;
  if (wo.assigneeOrg === "fm") return lang === "ar" ? "مشغل المرافق" : "FM operator";
  if (wo.assigneeOrg === "dutco") return lang === "ar" ? "دوتكو" : "Dutco";
  return "—";
}

/** One work order as a row in a list, with its resolution staff gauge. */
export function WoRow({ wo, dir, now, compact = false, selected = false }: { wo: WorkOrder; dir: Directory | undefined; now: number; compact?: boolean; selected?: boolean }) {
  const { b, lang, dateTime, t } = useI18n();
  const r = readSla(wo.reportedAt, wo.resolveDueAt, now, wo.resolvedAt);
  return (
    <Link
      to={`/wo/${wo.id}`}
      className={cn(
        "group grid items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-sheet-2 focus-visible:bg-sheet-2",
        compact ? "grid-cols-[1fr]" : "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(180px,1fr)] max-lg:grid-cols-1",
        r.phase === "breached" && "bg-[linear-gradient(to_right,rgb(200_22_29/0.05),transparent_40%)] rtl:bg-[linear-gradient(to_left,rgb(200_22_29/0.05),transparent_40%)]",
        selected && "crosshair bg-sheet-2"
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="reading text-[12px] text-ink-3">{wo.ref}</span>
          <PriorityChip priority={wo.priority} summer={wo.summerUplift} />
          <LiabilityChip liability={wo.liability} />
          {!compact && <StatusChip status={wo.status} />}
        </div>
        <div className="mt-1 truncate text-[14px] font-medium text-ink group-hover:underline group-hover:decoration-fluoro group-hover:underline-offset-4">{b(wo.title)}</div>
        <div className="truncate text-[12.5px] text-ink-3">{woWhere(wo, dir, b, lang)}</div>
      </div>
      {!compact && (
        <div className="min-w-0 text-[12.5px] text-ink-2">
          <div className="truncate">{assigneeName(wo, dir, b, lang)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-ink-3">
            <ChannelChip channel={wo.channel} />
            <span className="reading text-[11.5px]">{dateTime(wo.reportedAt)}</span>
          </div>
        </div>
      )}
      <div className="min-w-0">
        <StaffGauge start={wo.reportedAt} due={wo.resolveDueAt} now={now} doneAt={wo.resolvedAt} size={compact ? "sm" : "md"} />
        {!compact && <div className="mt-1 text-[11px] text-ink-3">{t.sla.resolution} · {dateTime(wo.resolveDueAt)}</div>}
      </div>
    </Link>
  );
}

/** Human sentence for one activity-log event. */
export function useEventText() {
  const { t, f, b, num } = useI18n();
  return (e: WoEvent): string => {
    const d = e.data ?? {};
    switch (e.type) {
      case "created": return f(t.ev.created, { channel: t.channel[d.channel as keyof typeof t.channel] ?? String(d.channel) });
      case "ai_triage": return f(t.ev.ai_triage, { category: t.category[d.category as keyof typeof t.category], confidence: Math.round(Number(d.confidence) * 100) });
      case "priority_set": return f(t.ev.priority_set, { priority: t.priority[d.priority as keyof typeof t.priority] }) + (d.summerUplift ? ` · ${t.sla.summerRule}` : "");
      case "liability_flagged": return f(t.ev.liability_flagged, { liability: t.liability[d.liability as keyof typeof t.liability] }) + (e.text ? ` · ${b(e.text)}` : "");
      case "assigned": return f(t.ev.assigned, { org: t.ev[`org_${d.org}` as "org_fm"] ?? String(d.org) });
      case "checklist": return f(t.ev.checklist, { item: String(d.item) });
      case "photo": return f(t.ev.photo, { kind: String(d.kind) });
      case "diagnosis_challenge": return f(t.ev.diagnosis_challenge, { shown: String(d.shown) });
      case "root_cause": return f(t.ev.root_cause, { rootCause: t.rootCause[d.rootCause as keyof typeof t.rootCause] }) + (e.text ? ` · “${b(e.text)}”` : "");
      case "reclassified": return f(t.ev.reclassified, { from: t.liabilityShort[d.from as keyof typeof t.liabilityShort], to: t.liabilityShort[d.to as keyof typeof t.liabilityShort] }) + (e.text ? ` · ${b(e.text)}` : "");
      case "backcharge_created": return f(t.ev.backcharge_created, { ref: String(d.ref), amount: num(Number(d.amount)) });
      case "comment": return e.text ? b(e.text) : t.ev.comment;
      default: return t.ev[e.type as keyof typeof t.ev] ?? e.type;
    }
  };
}

export function ActorIcon({ actor }: { actor: string }) {
  if (actor === "system") return <Cpu size={13} aria-hidden />;
  if (actor === "ai") return <Bot size={13} aria-hidden />;
  return <User size={13} aria-hidden />;
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="text-[13.5px] font-semibold text-ink">{children}</h2>
      {aside && <div className="text-[12px] text-ink-3">{aside}</div>}
    </div>
  );
}
