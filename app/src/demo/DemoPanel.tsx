import { useState } from "react";
import { ChevronLeft, ChevronRight, Minimize2, Maximize2, Wand2, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/primitives";
import { cn } from "@/ui/cn";
import { BEATS } from "./script";
import { useDemo } from "./DemoContext";

export function DemoPanel() {
  const demo = useDemo();
  const { t, f, b, dir } = useI18n();
  const [min, setMin] = useState(false);
  if (!demo.active) return null;
  const beat = demo.beat;
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <aside
      aria-label={t.demo.title}
      className={cn(
        "no-print animate-rise fixed end-4 bottom-4 z-40 w-[min(400px,calc(100vw-32px))] rounded-lg border border-ink bg-ink text-sheet shadow-[var(--shadow-float)]"
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2">
        <span className="reading rounded-sm bg-fluoro px-1.5 py-0.5 text-[11px] font-semibold text-on-fluoro">{beat.label}</span>
        <span className="text-[12px] text-white/70">{f(t.demo.step, { n: demo.index + 1, total: BEATS.length })}</span>
        <div className="flex-1" />
        <button onClick={() => setMin(!min)} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white" aria-label={min ? "Expand" : "Minimise"}>
          {min ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
        <button onClick={demo.exit} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white" aria-label={t.demo.exit}>
          <X size={15} />
        </button>
      </div>
      {!min && (
        <div className="px-3.5 pt-3 pb-3.5">
          <h2 className="text-[15px] leading-snug font-semibold text-white">{b(beat.title)}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">{b(beat.note)}</p>
          {/* beat rail: a graduated staff of the story */}
          <div className="mt-3 flex items-end gap-[3px]" role="tablist" aria-label={t.demo.title}>
            {BEATS.map((x, i) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={i === demo.index}
                aria-label={`${x.label} · ${b(x.title)}`}
                title={b(x.title)}
                onClick={() => demo.goTo(i)}
                className={cn(
                  "flex-1 rounded-[1px] transition-all",
                  i === demo.index ? "h-4 bg-fluoro" : i < demo.index ? "h-2.5 bg-white/70 hover:bg-white" : "h-2.5 bg-white/20 hover:bg-white/40"
                )}
              />
            ))}
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={() => demo.goTo(demo.index - 1)} disabled={demo.index === 0} icon={<Prev size={14} />}>
              {t.demo.prev}
            </Button>
            <div className="flex-1" />
            {beat.action && (
              <Button size="sm" variant="ghost" className="border-white/25 text-white hover:bg-white/10" onClick={() => void demo.runAction()} loading={demo.running} icon={<Wand2 size={14} />}>
                {beat.actionLabel ? b(beat.actionLabel) : t.demo.run}
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => demo.goTo(demo.index + 1)} disabled={demo.index === BEATS.length - 1}>
              {t.demo.next}
              <Next size={14} aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
