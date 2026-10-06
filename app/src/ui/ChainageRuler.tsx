import { DAY, ms } from "@/domain/time";
import { useI18n } from "@/i18n";
import { cn } from "./cn";

/**
 * DLP chainage: the defects liability period drawn as a road chainage from the Taking-Over
 * Certificate (CH 0+000) to DLP expiry, with today's survey peg. One chainage metre = one day.
 */
export function ChainageRuler({
  start, end, now, compact = false, className, title
}: { start: string; end: string; now: number; compact?: boolean; className?: string; title?: string }) {
  const { t, f, date, dateShort, month } = useI18n();
  const total = Math.max(1, Math.round((ms(end) - ms(start)) / DAY));
  const elapsed = Math.min(total, Math.max(0, Math.floor((now - ms(start)) / DAY)));
  // days left counts whole days to expiry, matching the liability engine
  const left = Math.max(0, Math.floor((ms(end) - now) / DAY));
  const pct = (elapsed / total) * 100;
  const ch = (d: number) => `CH ${Math.floor(d / 1000)}+${String(d % 1000).padStart(3, "0")}`;
  const months: Array<{ at: number; label: string }> = [];
  const s = new Date(ms(start));
  for (let i = 1; i < 12; i++) {
    const m = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + i, 1, 0, 0) - 4 * 3600e3);
    const d = Math.round((m.getTime() - ms(start)) / DAY);
    if (d > 0 && d < total) months.push({ at: (d / total) * 100, label: month(m.toISOString().slice(0, 7)).split(" ")[0] });
  }
  const done = elapsed >= total;
  return (
    <div className={cn("w-full", className)}>
      {title && <div className="mb-2 text-[12px] font-medium text-ink-2">{title}</div>}
      <div className="relative" style={{ height: compact ? 40 : 64 }}>
        {/* the road */}
        <div className="absolute inset-x-0 top-[18px] h-[10px] border border-seam-strong bg-sheet-2">
          <div className="hazard-soft h-full" style={{ width: `${pct}%`, backgroundColor: "rgb(22 25 28 / 0.08)" }} />
        </div>
        {/* month ticks */}
        {months.map((m) => (
          <div key={m.at} className="absolute top-[14px] h-[18px] w-px bg-ink-3" style={{ insetInlineStart: `${m.at}%` }}>
            {!compact && <span className="absolute top-[20px] hidden -translate-x-1/2 text-[10px] text-ink-3 md:block rtl:translate-x-1/2">{m.label}</span>}
          </div>
        ))}
        {/* ends */}
        <div className="absolute top-[10px] h-[26px] w-[2px] bg-ink" style={{ insetInlineStart: 0 }} />
        <div className="absolute top-[10px] h-[26px] w-[2px] bg-breach" style={{ insetInlineEnd: 0 }} />
        {/* today's peg */}
        {!done && (
          <div className="absolute top-0" style={{ insetInlineStart: `${pct}%` }}>
            <div className="-translate-x-1/2 rtl:translate-x-1/2">
              <div className="mx-auto h-0 w-0 border-x-[6px] border-t-[9px] border-x-transparent border-t-fluoro" />
              <div className="mx-auto h-[26px] w-[2px] bg-fluoro" />
              <div className="animate-peg mx-auto -mt-1 h-2 w-2 rounded-full bg-fluoro" />
            </div>
          </div>
        )}
      </div>
      <div className={cn("mt-1 flex items-baseline justify-between gap-x-4 gap-y-1 text-[11px]", compact ? "flex-wrap" : "max-md:flex-col")}>
        {!compact && (
          <span className="text-ink-2">
            <bdi dir="ltr" className="reading">{ch(0)}</bdi> · {t.command.toc} {date(start)}
          </span>
        )}
        <span className="font-medium text-fluoro-ink">
          <bdi dir="ltr" className="reading">{ch(elapsed)}</bdi> · {done ? t.portfolio.dlpEnded : f("{a}{d} {e} · {b}{d} {r}", { a: elapsed, d: t.units.d, e: t.command.elapsed, b: left, r: t.command.remaining })}
        </span>
        <span className="text-ink-2">
          {t.command.dlpEnd} {compact ? dateShort(end) : date(end)}{!compact && <> · <bdi dir="ltr" className="reading">{ch(total)}</bdi></>}
        </span>
      </div>
    </div>
  );
}
