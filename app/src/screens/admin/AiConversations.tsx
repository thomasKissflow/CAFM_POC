// Admin → AI conversations: every voice call (Kissflow "AI Conversations"), with its transcript.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessagesSquare, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { enrichConversation, getAiProvider, type AiProvider } from "@/ai/provider";
import { useI18n } from "@/i18n";
import { useServices } from "@/services/context";
import type { AiConversation } from "@/services/types";
import { Button, Empty, PageHeader, PageLoader } from "@/ui/primitives";
import { cn } from "@/ui/cn";

const gst = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export default function AiConversations() {
  const { lang } = useI18n();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const services = useServices();
  const [list, setList] = useState<AiConversation[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [ai, setAi] = useState<AiProvider | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { void getAiProvider(services).then(setAi); }, [services]);
  const reload = () => { setList(undefined); setError(null); services.conversations.list().then(setList, (e: unknown) => setError(e instanceof Error ? e.message : String(e))); };
  useEffect(reload, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = list !== undefined ? list.find((c) => c.id === open) : undefined;
  /** Re-run summary + insights for one call (they also run automatically when a call ends). */
  const analyse = async (id: string) => {
    if (ai === undefined || list === undefined) return;
    const c = list.find((x) => x.id === id);
    if (c === undefined) return;
    setBusy(id);
    try { await enrichConversation(ai, services, c); toast.success(L("Summary and insights updated", "تم تحديث الملخص والرؤى")); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const Lines = ({ title, items }: { title: string; items: string[] | undefined }) => (
    items === undefined || items.length === 0 ? null : (
      <div className="mt-3">
        <h3 className="text-[11.5px] font-medium text-ink-3">{title}</h3>
        <ul className="mt-1 list-disc ps-4 text-[12.5px] text-ink">{items.map((x, i) => <li key={i} dir="auto" className="py-0.5">{x}</li>)}</ul>
      </div>
    )
  );
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
      <PageHeader title={L("AI conversations", "محادثات الذكاء الاصطناعي")} subtitle={L("Every call with the voice agent, saved in Kissflow with its transcript.", "كل مكالمة مع المساعد الصوتي، محفوظة في Kissflow مع نصها.")}
        actions={<Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={reload}>{L("Reload", "تحديث")}</Button>} />
      {error !== null ? <p className="sheet p-4 text-[13px] text-breach" role="alert">{error}</p> : list === undefined ? <PageLoader className="h-72" /> : list.length === 0 ? (
        <div className="sheet"><Empty icon={<MessagesSquare className="text-ink-3" size={22} aria-hidden />} title={L("No calls yet", "لا توجد مكالمات بعد")} hint={L("Calls made with the live Gemini voice appear here when they end.", "تظهر هنا مكالمات صوت Gemini المباشر عند انتهائها.")} /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="sheet overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead className="bg-sheet-2 text-[11.5px] text-ink-3">
                <tr className="seam-b">
                  {[L("Started", "البداية"), L("Caller", "المتصل"), L("Language", "اللغة"), L("Engine", "المحرك"), L("Length", "المدة"), L("Work order", "أمر العمل"), L("Summary", "الملخص")].map((h) => <th key={h} scope="col" className="px-3 py-2 text-start font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-seam">
                {list.map((c) => (
                  <tr key={c.id} onClick={() => setOpen(c.id)} className={cn("cursor-pointer hover:bg-sheet-2/60", c.id === open && "bg-sheet-2")}>
                    <td className="reading px-3 py-2 whitespace-nowrap text-ink-2">{gst.format(new Date(c.startedAt))}</td>
                    <td className="px-3 py-2 text-ink" dir="auto">{c.callerName ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-2">{c.lang === "ar" ? "العربية" : "English"}</td>
                    <td className="px-3 py-2 text-ink-2">{c.voiceEngine}</td>
                    <td className="reading px-3 py-2 text-ink-2">{c.durationSeconds !== undefined ? `${Math.floor(c.durationSeconds / 60)}:${String(c.durationSeconds % 60).padStart(2, "0")}` : "—"}</td>
                    <td className="reading px-3 py-2">{c.workOrderRef !== undefined ? (c.workOrderId !== undefined ? <Link onClick={(e) => e.stopPropagation()} to={`/wo/${c.workOrderId}`} className="text-ink underline decoration-seam-strong underline-offset-2">{c.workOrderRef}</Link> : c.workOrderRef) : <span className="text-ink-3">—</span>}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-ink-2" dir="auto">{c.summary ?? <span className="text-ink-3">{L("not summarised yet", "لم يُلخَّص بعد")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <aside className="sheet h-fit p-4">
            {sel === undefined ? <p className="text-[13px] text-ink-3">{L("Pick a call to read its transcript.", "اختر مكالمة لقراءة نصها.")}</p> : (
              <>
                <h2 className="text-[14px] font-semibold text-ink">{sel.workOrderRef ?? L("No work order", "بدون أمر عمل")}</h2>
                <p className="reading mt-0.5 text-[11.5px] text-ink-3">{sel.sessionId}{sel.model !== undefined ? ` · ${sel.model}` : ""}{sel.totalTokens !== undefined ? ` · ${sel.totalTokens} tokens` : ""}</p>
                {ai !== undefined && ai.mode !== "off" && (
                  <Button variant="secondary" size="sm" className="mt-2" icon={<Sparkles size={14} />} loading={busy === sel.id} disabled={busy !== null}
                    onClick={() => void analyse(sel.id)}>{sel.summary === undefined ? L("Summarise this call", "لخّص هذه المكالمة") : L("Run again", "إعادة التحليل")}</Button>
                )}
                {sel.summary !== undefined && <p dir="auto" className="mt-3 text-[13px] leading-relaxed text-ink">{sel.summary}</p>}
                <Lines title={L("Key points", "النقاط الرئيسية")} items={sel.keyPoints} />
                <Lines title={L("Action items", "الإجراءات")} items={sel.actionItems} />
                <Lines title={L("Open questions", "أسئلة مفتوحة")} items={sel.openQuestions} />
                {sel.sentiment !== undefined && <p className="mt-3 text-[12.5px] text-ink-2"><span className="text-[11.5px] font-medium text-ink-3">{L("Sentiment", "الانطباع")}: </span>{sel.sentiment}</p>}
                <Lines title={L("Issues raised", "المشكلات المطروحة")} items={sel.issuesRaised} />
                <Lines title={L("Suggested follow-ups", "متابعات مقترحة")} items={sel.suggestedFollowUps} />
                <Lines title={L("Intents and topics", "النوايا والمواضيع")} items={sel.intents} />
                <h3 className="mt-4 text-[11.5px] font-medium text-ink-3">{L("Transcript", "النص")}</h3>
                <pre dir="auto" className="mt-1 max-h-[40vh] overflow-y-auto text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink">{sel.transcript}</pre>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
