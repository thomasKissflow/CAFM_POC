import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Image as ImageIcon, Mic, Users } from "lucide-react";
import { useI18n } from "@/i18n";
import { useQuery, useServices } from "@/services/context";
import type { ExtractedRequest } from "@/services/types";
import { AiTag, Button, LiabilityChip } from "@/ui/primitives";
import { cn } from "@/ui/cn";

export default function Before() {
  const { t, b, lang } = useI18n();
  const services = useServices();
  const chat = useQuery((s) => s.demo.chat(), []);
  const [extracted, setExtracted] = useState<ExtractedRequest[] | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="animate-rise grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
      {/* the generic chat, deliberately not styled as any real messaging brand */}
      <section aria-label={t.before.group} className="overflow-hidden rounded-xl border border-seam-strong bg-[#ecebe6] shadow-[var(--shadow-lift)]">
        <header className="flex items-center gap-3 bg-[#4b5257] px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Users size={17} /></span>
          <div>
            <div className="text-[14px] font-medium">{t.before.group}</div>
            <div className="text-[11.5px] text-white/70">{t.before.members}</div>
          </div>
        </header>
        <ol className="flex max-h-[620px] flex-col gap-2 overflow-y-auto px-3 py-4" dir="ltr">
          {chat.data?.map((m) => {
            const mine = m.author.startsWith("Arjun");
            return (
              <li key={m.id} className={cn("max-w-[82%] rounded-lg px-3 py-2 text-[13px] shadow-sm", mine ? "self-end bg-[#dfe9dc]" : "self-start bg-white", extracted?.some((e) => e.messageIds.includes(m.id)) && "outline outline-2 outline-offset-1 outline-fluoro")}>
                {!mine && <div className="mb-0.5 text-[11.5px] font-medium text-[#5b6f86]">{m.author}</div>}
                {m.kind === "voice" ? (
                  <span className="flex items-center gap-2 text-ink-2"><Mic size={15} /><span className="h-1 w-28 rounded bg-ink/20" /><span className="reading text-[11px]">0:{m.seconds}</span></span>
                ) : m.kind === "photo" ? (
                  <span className="flex items-center gap-2 text-ink-2"><ImageIcon size={15} />{m.text}</span>
                ) : <span className="text-ink">{m.text}</span>}
                <div className="reading mt-0.5 text-end text-[10px] text-ink-3">{m.at}</div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col justify-center gap-6">
        <div>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] text-ink">{t.before.title}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{t.before.subtitle}</p>
          <p className="mt-1 text-[12px] text-ink-3">{t.before.illustrative}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 border-y border-seam py-5">
          {[t.before.zeroTimestamps, t.before.zeroClocks, t.before.zeroAssets].map((l) => (
            <div key={l}>
              <div className="tnum text-[52px] leading-none font-semibold text-breach">0</div>
              <div className="mt-1 text-[13px] text-ink-2">{l}</div>
            </div>
          ))}
        </div>
        <p className="max-w-[48ch] text-[16px] leading-relaxed text-ink">{t.before.lost}</p>

        {extracted === null ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" loading={busy} onClick={async () => { setBusy(true); setExtracted(await services.ai.extractFromChat(chat.data ?? [])); setBusy(false); }}>
              {t.before.replay}
            </Button>
            <span className="text-[12.5px] text-ink-3">{t.before.replayNote}</span>
          </div>
        ) : (
          <div className="animate-rise sheet p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold text-ink">{t.before.extracted}</h2><AiTag /></div>
            <ul className="flex flex-col divide-y divide-seam">
              {extracted.map((e) => (
                <li key={e.summary.en} className="flex items-center gap-4 py-2.5">
                  <span className="reading w-12 text-[15px] font-medium text-ink">{e.firstContact}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-ink">{b(e.summary)}</span>
                    <span className="text-[12px] text-ink-3">{t.category[e.category]} · {t.intake.firstContact} {e.firstContact}</span>
                  </span>
                  {e.category === "ac_not_cooling" && <LiabilityChip liability="DLP" />}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link to="/intake"><Button variant="ink" icon={<ArrowRight size={15} className="rtl:-scale-x-100" />}>{t.nav.intake}</Button></Link>
              <span className="text-[12px] text-ink-3">{lang === "ar" ? "في النظام الفعلي تصل هذه الطلبات عبر قنوات منظمة، لا عبر المحادثة." : "In the live system these arrive through structured channels, not the chat."}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
