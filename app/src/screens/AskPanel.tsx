import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CornerDownLeft } from "lucide-react";
import { useI18n } from "@/i18n";
import { useServices } from "@/services/context";
import type { AskAnswer } from "@/services/types";
import { AiTag, Button, Input, Panel } from "@/ui/primitives";

/** "Ask the portfolio": natural-language questions over the demo data (AI preview, mocked). */
export function AskPanel() {
  const { t, b } = useI18n();
  const services = useServices();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ q: string; a: AskAnswer } | null>(null);
  const ask = async (text: string) => {
    if (!text.trim()) return;
    setQ(text);
    setBusy(true);
    try {
      setAnswer({ q: text, a: await services.ai.ask(text) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title={t.ai.askTitle} actions={<AiTag />}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.ai.askPlaceholder} aria-label={t.ai.askTitle} />
        <Button type="submit" variant="ink" loading={busy} icon={<CornerDownLeft size={14} className="rtl:-scale-x-100" aria-hidden />}>{t.ai.ask}</Button>
      </form>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {services.ai.suggestedQuestions().map((s) => (
          <button key={s.en} onClick={() => void ask(b(s))} className="rounded-full border border-seam-strong bg-sheet px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink">
            {b(s)}
          </button>
        ))}
      </div>
      {busy && <p className="mt-4 text-[13px] text-ink-3" aria-live="polite">{t.ai.thinking}</p>}
      {answer && !busy && (
        <div className="animate-rise mt-4 grid gap-4 border-t border-seam pt-4 md:grid-cols-[1fr_minmax(240px,0.8fr)]" aria-live="polite">
          <div>
            <p className="text-[12px] text-ink-3">“{answer.q}”</p>
            <p className="mt-1.5 max-w-[70ch] text-[14.5px] leading-relaxed text-ink">{b(answer.a.answer)}</p>
            {answer.a.link && (
              <Link to={answer.a.link.to} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-fluoro-ink hover:underline">
                {b(answer.a.link.label)} <ArrowUpRight size={13} className="rtl:-scale-x-100" />
              </Link>
            )}
          </div>
          {answer.a.rows && answer.a.rows.length > 0 && (
            <table className="w-full self-start text-[12.5px]">
              <tbody>
                {answer.a.rows.map((r) => (
                  <tr key={r.label} className="border-b border-seam last:border-0">
                    <td className="py-1.5 pe-3 text-ink-2">{r.label}</td>
                    <td className="reading py-1.5 text-end text-ink">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Panel>
  );
}
