import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";

/** Finger/stylus signature capture. Emits a PNG data URL when the stroke ends. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | undefined) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current;
    if (c === null) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d");
    if (ctx === null) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#16191c";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div>
      <div className="relative rounded-md border border-seam-strong bg-white">
        <canvas
          ref={ref}
          className="block h-32 w-full touch-none"
          aria-label={t.tech.signature}
          onPointerDown={(e) => {
            const ctx = e.currentTarget.getContext("2d");
            if (ctx === null) return;
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d");
            if (ctx === null) return;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }}
          onPointerUp={(e) => {
            drawing.current = false;
            setEmpty(false);
            onChange(e.currentTarget.toDataURL("image/png"));
          }}
        />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-ink-3">{t.tech.sign}</span>}
        <span className="pointer-events-none absolute inset-x-4 bottom-6 border-b border-dashed border-seam-strong" aria-hidden />
      </div>
      <button
        type="button"
        className="mt-1.5 text-[12.5px] text-ink-2 underline underline-offset-4"
        onClick={() => {
          const c = ref.current;
          const ctx = c?.getContext("2d");
          if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
          setEmpty(true);
          onChange(undefined);
        }}
      >
        {t.tech.clear}
      </button>
    </div>
  );
}
