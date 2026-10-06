import { readSla, type SlaPhase } from "@/domain/sla";
import { useI18n } from "@/i18n";
import { cn } from "./cn";

/**
 * Level-staff SLA gauge: the allowance is a graduated staff (E-pattern), the reading line
 * moves with the demo clock and crosses into the at-risk band (75%) and the breach overrun.
 */
const SCALE = 1.25; // staff shows 125% of the allowance so the overrun is visible

export function StaffGauge({
  start, due, now, doneAt, size = "md", label = true, className
}: { start: string; due: string; now: number; doneAt?: string; size?: "sm" | "md" | "lg"; label?: boolean; className?: string }) {
  const { t, duration } = useI18n();
  const r = readSla(start, due, now, doneAt);
  const h = size === "sm" ? 10 : size === "md" ? 16 : 26;
  const x = (f: number) => (Math.min(f, SCALE) / SCALE) * 200;
  const fill = phaseFill(r.phase);
  const blocks = [];
  for (let i = 0; i < 25; i++) {
    const f = i * 0.05;
    blocks.push(
      <rect key={i} x={x(f)} y={0} width={x(0.05) - 0.6} height={h * 0.34} fill={i % 2 === 0 ? (f >= 1 ? "var(--color-breach)" : "var(--color-ink)") : "transparent"} opacity={0.85} />
    );
  }
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => (
    <line key={f} x1={x(f)} x2={x(f)} y1={0} y2={h} stroke={f === 1 ? "var(--color-breach)" : "var(--color-ink-3)"} strokeWidth={f === 1 ? 1.4 : 0.7} />
  ));
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <svg
        viewBox={`0 0 200 ${h}`}
        preserveAspectRatio="none"
        className="min-w-16 flex-1 rtl:-scale-x-100"
        style={{ height: h }}
        role="img"
        aria-label={`${t.sla[r.phase]} · ${Math.round(r.fraction * 100)}%`}
      >
        <rect x={0} y={0} width={200} height={h} fill="var(--color-sheet-2)" />
        <rect x={x(0.75)} y={0} width={x(1) - x(0.75)} height={h} fill="var(--color-risk-wash)" />
        <rect x={x(1)} y={0} width={200 - x(1)} height={h} fill="var(--color-breach-wash)" />
        <rect x={0} y={h * 0.42} width={x(r.fraction)} height={h * 0.58} fill={fill} />
        {blocks}
        {ticks}
        {r.phase !== "met" && r.phase !== "missed" && (
          <g>
            <line x1={x(r.fraction)} x2={x(r.fraction)} y1={0} y2={h} stroke="var(--color-fluoro)" strokeWidth={2} />
          </g>
        )}
        <rect x={0.5} y={0.5} width={199} height={h - 1} fill="none" stroke="var(--color-seam-strong)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      </svg>
      {label && (
        <span className={cn("reading shrink-0 text-[12px] whitespace-nowrap", phaseText(r.phase))}>
          {r.phase === "met" || r.phase === "missed"
            ? t.sla[r.phase]
            : r.remainingMs >= 0
              ? `${duration(r.remainingMs)} ${t.sla.left}`
              : `${duration(-r.remainingMs)} ${t.sla.over}`}
        </span>
      )}
    </div>
  );
}

export function phaseFill(p: SlaPhase) {
  if (p === "breached" || p === "missed") return "var(--color-breach)";
  if (p === "at_risk") return "var(--color-risk-fill)";
  if (p === "met") return "var(--color-ok)";
  return "var(--color-ink-2)";
}
export function phaseText(p: SlaPhase) {
  if (p === "breached" || p === "missed") return "text-breach font-medium";
  if (p === "at_risk") return "text-risk font-medium";
  if (p === "met") return "text-ok";
  return "text-ink-2";
}
