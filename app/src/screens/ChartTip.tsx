/** Recharts tooltip in the product's ink style. */
export function ChartTip({ active, payload, label, format }: {
  active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string; format: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md bg-ink px-2.5 py-1.5 text-[12px] text-sheet shadow-[var(--shadow-float)]">
      <div className="text-white/70">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="tnum font-medium">{format(p.value)}</div>
      ))}
    </div>
  );
}
