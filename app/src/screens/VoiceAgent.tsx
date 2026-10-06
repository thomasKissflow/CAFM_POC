import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Keyboard, Mic, MicOff, PhoneOff, Play, Send, Volume2, VolumeX, CheckCircle2, ListCollapse } from "lucide-react";
import type { Category, Lang, WorkOrder } from "@/domain/types";
import { useI18n } from "@/i18n";
import { useServices } from "@/services/context";
import { createDemoBrain, slotLabel } from "@/voice/mockBrain";
import { claudeAvailable, createClaudeBrain } from "@/voice/claudeBrain";
import { speechSupport } from "@/voice/speech";
import { useVoiceSession, type SessionLine, type SimLine, type VoiceStatus } from "@/voice/useVoiceSession";
import { useGeminiLive, type LiveCallRecord } from "@/voice/live/useGeminiLive";
import { getVoiceEngine } from "@/voice/live/aiApi";
import { enrichConversation, getAiProvider, type AiProvider } from "@/ai/provider";
import { useDataSource } from "@/services/source";
import type { VoiceContext, VoiceSlots } from "@/voice/types";
import { AiTag, Button, Input, LiabilityChip, PriorityChip } from "@/ui/primitives";
import { cn } from "@/ui/cn";

const SIM_EN: SimLine[] = [
  { text: "My AC is not working at all." },
  { text: "Sorry, it's the living room, blowing warm air since this morning.", interruptAfterMs: 1300 },
  { text: "Yes, I have a small baby at home." },
  { text: "Now is fine, I'm home." },
  { text: "Yes please." }
];
const SIM_AR: SimLine[] = [
  { text: "المكيف ما يبرد أبدًا." },
  { text: "عفوًا، في الصالة، يطلع هواء حار من الصباح.", interruptAfterMs: 1300 },
  { text: "نعم، عندي طفل رضيع." },
  { text: "الحين، أنا موجودة في البيت." },
  { text: "نعم، من فضلك." }
];

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const TITLES: Record<string, { en: string; ar: string }> = {
  ac_not_cooling: { en: "AC not cooling", ar: "المكيف لا يبرد" }, ac_noise_leak: { en: "AC dripping water", ar: "المكيف يسرب ماء" },
  water_leak: { en: "Water leak", ar: "تسرب مياه" }, electrical: { en: "Electrical fault", ar: "عطل كهربائي" }, lift: { en: "Lift fault", ar: "عطل في المصعد" },
  plumbing: { en: "Plumbing issue", ar: "مشكلة سباكة" }, fire_life_safety: { en: "Fire alarm fault", ar: "عطل في إنذار الحريق" },
  civil_finishes: { en: "Finishes defect", ar: "عيب في التشطيبات" }, doors_hardware: { en: "Door / lock issue", ar: "مشكلة باب / قفل" }, structural_crack: { en: "Crack in structure", ar: "شرخ في الهيكل" }
};

export default function VoiceAgent() {
  const { t, lang, time, dir } = useI18n();
  const services = useServices();
  const navigate = useNavigate();
  const [brainId, setBrainId] = useState<"demo" | "claude">("demo");
  const [claude, setClaude] = useState<{ ok: boolean; model?: string }>({ ok: false });
  const [soundOn, setSoundOn] = useState(true);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [created, setCreated] = useState<WorkOrder | null>(null);
  const support = useMemo(() => speechSupport(), []);
  const source = useDataSource();
  // Voice engine (Admin → AI settings): "demo" = scripted/browser speech, "live" = Gemini Live via our backend.
  const [engineChoice, setEngineChoice] = useState(getVoiceEngine);
  const [ai, setAi] = useState<AiProvider | undefined>(undefined);
  useEffect(() => {
    const onChange = () => setEngineChoice(getVoiceEngine());
    window.addEventListener("cafm-voice-engine", onChange);
    void getAiProvider(services).then(setAi);
    return () => window.removeEventListener("cafm-voice-engine", onChange);
  }, [services]);
  const liveReady = ai !== undefined && ai.mode !== "off";
  const engine: "demo" | "live" = engineChoice === "live" && liveReady ? "live" : "demo";
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    void claudeAvailable().then(setClaude);
  }, []);

  const context: VoiceContext = useMemo(() => ({ residentName: lang === "ar" ? "ليلى السويدي" : "Layla Al Suwaidi", unitLabel: "Apt 1402", siteName: lang === "ar" ? "مساكن قمر" : "Qamar Residences", inDlp: true, lang }), [lang]);
  const demoBrain = useMemo(() => createDemoBrain(), []);
  const brain = useMemo(() => (brainId === "claude" ? createClaudeBrain(demoBrain.greet) : demoBrain), [brainId, demoBrain]);

  const logRequest = async (slots: VoiceSlots, lines: SessionLine[], callLang: Lang): Promise<{ say: string; workOrderId: string; ref: string }> => {
      const category: Category = slots.category ?? "civil_finishes";
      const isAc = category === "ac_not_cooling" || category === "ac_noise_leak";
      const wo = await services.workOrders.create({
        siteId: "S-QMR", unitId: "U-QMR-1402", assetId: isAc ? "A-QMR-FCU-1402-01" : undefined,
        category, title: TITLES[category] ?? TITLES.civil_finishes,
        description: slots.summary ?? lines.filter((l) => l.role === "caller").map((l) => l.text).join(" "),
        descriptionLang: callLang, channel: "voice_agent", reportedBy: "P-LAYLA",
        reporterName: callLang === "ar" ? "ليلى السويدي" : "Layla Al Suwaidi",
        aiTriage: { category, confidence: 0.93 },
        transcript: lines.map((l) => ({ role: l.role, text: l.text, at: l.at, interrupted: l.interrupted })),
        vulnerableOccupant: slots.vulnerableOccupant, accessWindow: slots.access
      }, "P-LAYLA");
      if (isAc) await services.demo.runStoryStep("raise"); // neighbours on other channels (demo)
      setCreated(wo);
      const subs = await services.directory.subcontractors();
      const sub = subs.find((s) => s.id === wo.subcontractorId);
      const team = wo.assigneeOrg === "subcon" && sub ? (callLang === "ar" ? sub.nameAr.replace(" (تجريبي)", "") : sub.name.replace(" (demo)", "")) : callLang === "ar" ? "فريق إدارة المرافق" : "the facilities team";
      const refSpoken = wo.ref.replace("WO-", "").split("-").join(" ");
      const tResp = new Intl.DateTimeFormat(callLang === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dubai" });
      const who = slots.vulnerableOccupant ? (/رضيع|طفل|baby|infant|newborn|child|kid/i.test(lines.map((l) => l.text).join(" ")) ? (callLang === "ar" ? "طفل صغير" : "a little one") : callLang === "ar" ? "أحد يحتاج رعاية" : "someone who needs extra care") : undefined;
      const done = (say: string) => ({ say, workOrderId: wo.id, ref: wo.ref });
      // Inside the defects period the installing subcontractor pays, whatever the trade was (not only AC).
      const dlpEn = isAc ? "They installed your AC, so there's nothing to pay" : "They did the original installation, so there's nothing to pay";
      const dlpAr = isAc ? "، نفس الشركة اللي ركّبت المكيف، وما عليك أي تكلفة" : "، نفس الشركة اللي نفّذت التركيب الأصلي، وما عليك أي تكلفة";
      if (callLang === "ar") {
        return done(`تم. رقم طلبك ${refSpoken}. وصل الطلب إلى ${team}${wo.liability === "DLP" ? dlpAr : ""}. راح يتواصلون معك قبل ${tResp.format(new Date(wo.responseDueAt))}، والهدف يصلحونه قبل ${tResp.format(new Date(wo.resolveDueAt))}.${who ? ` وبلّغتهم إن عندك ${who} بالبيت.` : ""} تقدرين تتابعين كل شي هنا في التطبيق.`);
      }
      return done(`All done. Your reference is ${refSpoken}. ${cap(team)} ${wo.liability === "DLP" ? `have it. ${dlpEn}` : "have it"}. They'll be in touch by ${tResp.format(new Date(wo.responseDueAt))}, and they're aiming to have it fixed by ${tResp.format(new Date(wo.resolveDueAt))}.${who ? ` I've told them there's ${who} at home.` : ""} You can follow it right here in the app.`);
  };

  /** Every call is kept in Kissflow "AI Conversations" (in memory on demo data); the summarizer fills in the rest. */
  const saveCall = (rec: LiveCallRecord, voiceEngine: string) => {
    const secs = Math.max(0, Math.round((Date.parse(rec.endedAt) - Date.parse(rec.startedAt)) / 1000));
    void services.conversations.save({
      sessionId: rec.sessionId, startedAt: rec.startedAt, endedAt: rec.endedAt, durationSeconds: secs, lang: rec.lang,
      callerName: context.residentName, callerRole: "Resident", voiceEngine, model: rec.model !== "" ? rec.model : undefined,
      workOrderRef: rec.submitted !== undefined ? rec.submitted.ref : undefined, workOrderId: rec.submitted !== undefined ? rec.submitted.workOrderId : undefined,
      transcript: rec.lines.map((l) => `[${l.at.slice(11, 19)}] ${l.role === "agent" ? "CAFM" : "Caller"}: ${l.text}${l.interrupted === true ? " (interrupted)" : ""}`).join("\n"),
      inputTokens: rec.usage.input, outputTokens: rec.usage.output, totalTokens: rec.usage.total
    }).then(async (saved) => {
      // summary + insights run as soon as the call ends (Admin → AI conversations can also re-run them)
      if (ai === undefined || ai.mode === "off") return;
      try { await enrichConversation(ai, services, saved); }
      catch (e) { console.error("[CAFM] summary/insights failed", e); }
    }).catch((e: unknown) => console.error("[CAFM] could not save the AI conversation", e));
  };

  const demoSession = useVoiceSession({
    brain,
    context,
    soundOn,
    now: () => services.clock.now(),
    onSubmit: async (slots, lines, callLang) => (await logRequest(slots, lines, callLang)).say
  });
  const liveSession = useGeminiLive({
    liveToken: async (req) => (ai !== undefined ? ai.liveToken(req) : Promise.reject(new Error("The AI service isn't available"))),
    context, soundOn, now: () => services.clock.now(),
    userId: source.user !== undefined ? source.user : "P-LAYLA",
    onSubmit: logRequest,
    onEnd: (rec) => saveCall(rec, "Gemini Live")
  });
  const session = engine === "live" ? liveSession : demoSession;
  useEffect(() => { if (engine === "live" && liveSession.textOnly) setTyping(true); }, [engine, liveSession.textOnly]);

  const live = session.status !== "idle";
  const lastAgent = [...session.lines].reverse().find((l) => l.role === "agent");
  const lastCaller = [...session.lines].reverse().find((l) => l.role === "caller");
  const tx = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tx.current?.scrollTo({ top: tx.current.scrollHeight });
  }, [session.lines, showTranscript]);

  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const statusLabel: Record<VoiceStatus, string> = {
    idle: "", listening: L("Listening…", "أستمع إليك…"), hearing: L("Hearing you…", "أسمعك…"), thinking: L("Thinking…", "لحظة…"),
    speaking: L("Speaking · talk to interrupt", "أتحدث · تكلّمي لتقاطعيني"), submitting: L("Logging your request…", "جارٍ تسجيل طلبك…"),
    done: L("Request logged", "تم تسجيل الطلب"), error: L("Something went wrong", "حدث خطأ")
  };

  if (!live) {
    return (
      <div className="flex min-h-full flex-col px-5 pt-4 pb-6">
        <Link to="/me" className="inline-flex items-center gap-1 text-[13px] text-ink-2"><Back size={15} />{t.nav.myRequests}</Link>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <VoiceOrb status="idle" level={0} />
          <h1 className="mt-6 text-[24px] leading-tight font-semibold text-ink">{L("Just tell us what's wrong", "أخبرينا بالمشكلة فقط")}</h1>
          <p className="mt-2 max-w-[30ch] text-[14.5px] text-ink-2">{L("Talk like you would on the phone. We'll ask a couple of questions and send the right team.", "تحدثي كما في مكالمة هاتفية. سنسأل سؤالين ونرسل الفريق المناسب.")}</p>
          <Button variant="primary" size="lg" className="mt-7 w-full max-w-72" icon={<Mic size={18} />} disabled={engine === "demo" && !support.stt} onClick={() => void session.start()}>
            {L("Start talking", "ابدئي الحديث")}
          </Button>
          {engine === "demo" && !support.stt && <p className="mt-2 max-w-[32ch] text-[12.5px] text-ink-3">{L("Voice isn't available in this browser. Use the scripted demo or type instead.", "الصوت غير متاح في هذا المتصفح. استخدمي العرض التجريبي أو الكتابة.")}</p>}
          {engine === "demo" && <Button variant="secondary" size="md" className="mt-3 w-full max-w-72" icon={<Play size={15} />} onClick={() => void demoSession.start(lang === "ar" ? SIM_AR : SIM_EN)}>
            {L("Play a demo call", "تشغيل مكالمة تجريبية")}
          </Button>}
          {engine === "live" && <p className="mt-3 max-w-[32ch] text-[12.5px] text-ink-3">{L("Live AI voice: your microphone streams to Google Gemini for this call. You can interrupt at any time.", "صوت ذكي مباشر: يُرسل الميكروفون إلى Google Gemini أثناء المكالمة. يمكنك المقاطعة في أي وقت.")}</p>}
        </div>
        {engine === "live" ? (
        <div className="mt-6 flex flex-col gap-1 rounded-lg border border-seam bg-sheet p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-ink-2">{L("Voice engine", "محرك الصوت")}</span>
            <AiTag />
          </div>
          <span className="reading text-[12.5px] text-ink">Gemini Live · {ai !== undefined ? ai.liveModel : ""}</span>
          <p className="text-[11.5px] leading-snug text-ink-3">{L("Switch between the demo voice and live Gemini in Admin → AI settings.", "بدّلي بين الصوت التجريبي وGemini المباشر من الإدارة ← إعدادات الذكاء الاصطناعي.")}</p>
        </div>
        ) : (
        <div className="mt-6 flex flex-col gap-2 rounded-lg border border-seam bg-sheet p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-ink-2">{claude.ok ? L("Assistant brain", "محرك المساعد") : L("Demo assistant", "المساعد التجريبي")}</span>
            <AiTag />
          </div>
          {claude.ok && <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
            {([["demo", L("Demo (offline)", "تجريبي (دون اتصال)")], ["claude", claude.ok ? `Claude · ${claude.model ?? ""}` : L("Claude (not configured)", "Claude (غير مهيأ)")]] as const).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={brainId === id} disabled={id === "claude" && !claude.ok} onClick={() => setBrainId(id)}
                className={cn("min-h-11 rounded-md border px-2 text-[12.5px] disabled:opacity-40", brainId === id ? "crosshair border-ink bg-sheet font-medium text-ink" : "border-seam text-ink-2")}>
                {label}
              </button>
            ))}
          </div>}
          <p className="text-[11.5px] leading-snug text-ink-3">{claude.ok
            ? L("Speech uses your browser. Live Gemini voice can be switched on in Admin → AI settings.", "يعمل الصوت عبر المتصفح. يمكن تفعيل صوت Gemini المباشر من الإدارة ← إعدادات الذكاء الاصطناعي.")
            : L("Demo voice: a scripted assistant using your browser's speech. Live Gemini voice can be switched on in Admin → AI settings.", "الصوت التجريبي: مساعد مُعدّ مسبقًا بصوت المتصفح. يمكن تفعيل صوت Gemini المباشر من الإدارة ← إعدادات الذكاء الاصطناعي.")}</p>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[640px] flex-col bg-ground">
      {/* header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <button onClick={() => { session.stop(); navigate("/me"); }} className="rounded-md p-2 text-ink-2" aria-label={t.chrome.back}><Back size={18} /></button>
        <div className="text-center leading-tight">
          <div className="text-[14px] font-semibold text-ink">CAFM Assist</div>
          <div className="text-[11px] text-ink-3">{engine === "live"
            ? (liveSession.conn === "connecting" ? L("Connecting…", "جارٍ الاتصال…") : liveSession.conn === "reconnecting" ? L("Reconnecting…", "إعادة الاتصال…") : `Gemini Live${liveSession.model !== undefined ? ` · ${liveSession.model}` : ""}`)
            : brainId === "claude" ? `Claude · ${claude.model ?? ""}` : L("Demo brain", "محرك تجريبي")}</div>
        </div>
        <button onClick={() => setSoundOn(!soundOn)} className="rounded-md p-2 text-ink-2" aria-label={soundOn ? "Mute voice" : "Unmute voice"} aria-pressed={!soundOn}>
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-hidden px-5">
        <div className="mt-1"><VoiceOrb status={session.status} level={session.level} /></div>
        <p className={cn("mt-1 text-[12.5px] font-medium", session.status === "hearing" ? "text-fluoro-ink" : "text-ink-3")} aria-live="polite">{statusLabel[session.status]}</p>

        {/* live captions */}
        <div className="mt-3 w-full min-h-[92px] text-center" aria-live="polite">
          {lastAgent && (
            <p dir="auto" className={cn("line-clamp-4 text-[18px] leading-snug font-medium text-ink", lastAgent.text.length > 140 && "text-[15.5px]", lastAgent.interrupted && "text-ink-3 line-through decoration-fluoro/60")}>{lastAgent.text || "…"}</p>
          )}
          {(session.interim || (lastCaller && session.status !== "speaking")) && (
            <p dir="auto" className="mt-2 text-[14.5px] text-ink-2">
              <span className="me-1 text-[11px] font-medium text-fluoro-ink">{L("You", "أنتِ")}</span>
              {session.interim || lastCaller?.text}
            </p>
          )}
        </div>

        {/* job card building up */}
        <JobCard slots={session.slots} lang={lang} created={created} />

        {showTranscript && (
          <div ref={tx} className="mt-2 max-h-40 w-full overflow-y-auto rounded-md border border-seam bg-sheet p-2.5">
            {session.lines.filter((l) => l.text !== "").map((l) => (
              <p key={l.id} dir="auto" className={cn("py-0.5 text-[12.5px]", l.role === "agent" ? "text-ink" : "text-ink-2")}>
                <span className="me-1 reading text-[10.5px] text-ink-3">{time(l.at)}</span>
                <span className="font-medium">{l.role === "agent" ? "CAFM" : L("You", "أنتِ")}:</span> {l.text}
                {l.interrupted && <span className="ms-1 text-[10.5px] text-fluoro-ink">({L("interrupted", "قوطِع")})</span>}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* result */}
      {session.status === "done" && created && (
        <div className="animate-rise mx-4 mb-2 rounded-lg border border-ok/40 bg-ok-wash p-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ok"><CheckCircle2 size={17} />{L("Request logged", "تم تسجيل الطلب")} · <span className="reading">{created.ref}</span></div>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><PriorityChip priority={created.priority} summer={created.summerUplift} /><LiabilityChip liability={created.liability} long /></div>
          <Link to="/me" className="mt-2.5 block"><Button variant="ink" className="w-full">{t.request.track}</Button></Link>
        </div>
      )}

      {/* controls */}
      {typing && session.status !== "done" && (
        <form className="flex gap-2 px-4 pb-2" onSubmit={(e) => { e.preventDefault(); session.sendText(typed); setTyped(""); }}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} dir="auto" placeholder={L("Type instead…", "اكتبي بدلًا من ذلك…")} aria-label={L("Type a message", "اكتبي رسالة")} autoFocus />
          <Button type="submit" variant="ink" icon={<Send size={15} className="rtl:-scale-x-100" />} aria-label="Send" />
        </form>
      )}
      <div className="flex items-center justify-around border-t border-seam bg-sheet/95 px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <RoundButton label={L("Keyboard", "لوحة المفاتيح")} onClick={() => setTyping(!typing)} active={typing}><Keyboard size={20} /></RoundButton>
        <RoundButton label={L("Transcript", "المحادثة")} onClick={() => setShowTranscript(!showTranscript)} active={showTranscript}><ListCollapse size={20} /></RoundButton>
        {session.status === "done" ? (
          <RoundButton label={L("Close", "إغلاق")} onClick={() => { session.stop(); navigate("/me"); }} big><Check size={24} /></RoundButton>
        ) : (
          <RoundButton label={L("End call", "إنهاء المكالمة")} onClick={() => session.stop()} big danger><PhoneOff size={22} /></RoundButton>
        )}
        <RoundButton label={session.muted ? L("Unmute mic", "تشغيل الميكروفون") : L("Mute mic", "كتم الميكروفون")} onClick={session.toggleMute} active={session.muted}>{session.muted ? <MicOff size={20} /> : <Mic size={20} />}</RoundButton>
      </div>
      {session.error && <p className="bg-breach-wash px-4 py-1.5 text-center text-[12px] text-breach" role="alert">{session.error}</p>}
    </div>
  );
}

function RoundButton({ children, label, onClick, big = false, danger = false, active = false }: { children: React.ReactNode; label: string; onClick: () => void; big?: boolean; danger?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active || undefined} title={label}
      className={cn("flex items-center justify-center rounded-full transition-colors",
        big ? "h-16 w-16" : "h-12 w-12",
        danger ? "bg-breach text-white active:bg-[#a01217]" : big ? "bg-ink text-sheet" : active ? "bg-ink text-sheet" : "bg-sheet-2 text-ink-2 hover:bg-seam")}>
      {children}
    </button>
  );
}

function JobCard({ slots, lang, created }: { slots: VoiceSlots; lang: Lang; created: WorkOrder | null }) {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const cat = slots.category ? TITLES[slots.category]?.[lang] : undefined;
  const rows: Array<[string, string | undefined]> = [
    [L("Problem", "المشكلة"), cat],
    [L("Detail", "التفاصيل"), slotLabel("symptom", slots.symptom, lang)],
    [L("Room", "الغرفة"), slotLabel("room", slots.room, lang)],
    [L("Since", "منذ"), slotLabel("since", slots.since, lang)],
    [L("At home", "في المنزل"), slots.vulnerableOccupant === undefined ? undefined : slots.vulnerableOccupant ? L("Vulnerable at home", "شخص حساس للحر") : L("No one vulnerable", "لا يوجد")],
    [L("Access", "الدخول"), slotLabel("access", slots.access, lang)]
  ];
  const filled = rows.filter(([, v]) => v).length;
  const isAc = slots.category === "ac_not_cooling" || slots.category === "ac_noise_leak";
  return (
    <div className="mt-3 w-full rounded-lg border border-seam bg-sheet px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-ink-3">{L("Your request", "طلبك")}</span>
        <span className="reading text-[11px] text-ink-3">{filled}/{rows.length}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <li key={k} className="flex min-w-0 items-center gap-1.5 text-[12px]">
            <span className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full", v ? "bg-ink text-sheet" : "border border-seam-strong")}>{v && <Check size={9} strokeWidth={3.5} />}</span>
            <span className={cn("truncate", v ? "text-ink" : "text-ink-3")}>{v ?? k}</span>
          </li>
        ))}
      </ul>
      {isAc && !created && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-seam pt-2">
          <PriorityChip priority="P2" summer />
          <LiabilityChip liability="DLP" />
          <span className="text-[11px] text-ink-3">{L("Summer rule · no cost to you", "قاعدة الصيف · بدون تكلفة")}</span>
        </div>
      )}
    </div>
  );
}

/** Theodolite-style reticle: rings follow the caller's voice, the dial turns while thinking,
 *  and staff graduations pulse while the agent speaks. */
function VoiceOrb({ status, level }: { status: VoiceStatus; level: number }) {
  const listening = status === "listening" || status === "hearing";
  const speaking = status === "speaking";
  const thinking = status === "thinking" || status === "submitting";
  const scale = listening ? 1 + Math.min(level, 1) * 0.28 + (status === "hearing" ? 0.06 : 0) : 1;
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <div className="relative h-[196px] w-[196px]" aria-hidden>
      <svg viewBox="-100 -100 200 200" className={cn("absolute inset-0 h-full w-full", thinking && "motion-safe:animate-[spin_6s_linear_infinite]")}>
        {ticks.map((i) => {
          const a = (i / 72) * Math.PI * 2;
          const long = i % 6 === 0;
          const r1 = 96, r2 = long ? 86 : 91;
          return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} stroke={long ? "var(--color-ink-2)" : "var(--color-seam-strong)"} strokeWidth={long ? 1.4 : 0.8} />;
        })}
        <circle r="80" fill="none" stroke="var(--color-seam)" strokeDasharray={thinking ? "4 6" : "none"} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn("flex h-[118px] w-[118px] items-center justify-center rounded-full transition-[transform,background-color] duration-150 ease-out",
            speaking ? "bg-fluoro" : listening ? "bg-ink" : status === "done" ? "bg-ok" : status === "error" ? "bg-breach" : "bg-ink")}
          style={{ transform: `scale(${scale})`, boxShadow: listening ? `0 0 0 ${6 + level * 18}px rgb(255 90 31 / ${0.10 + level * 0.25})` : undefined }}
        >
          {speaking ? (
            <div className="flex h-12 items-center gap-[4px]">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span key={i} className="w-[5px] rounded-[1px] bg-ink motion-safe:animate-[staff_0.9s_ease-in-out_infinite]" style={{ animationDelay: `${(i % 4) * 0.12}s`, height: `${[40, 70, 55, 90, 60, 75, 45][i]}%` }} />
              ))}
            </div>
          ) : thinking ? (
            <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-sheet motion-safe:animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
          ) : status === "done" ? (
            <Check size={40} className="text-white" strokeWidth={2.5} />
          ) : (
            <Mic size={34} className="text-sheet" strokeWidth={1.8} />
          )}
        </div>
      </div>
      {/* crosshair */}
      <span className="absolute top-1/2 left-2 h-px w-4 -translate-y-1/2 bg-fluoro" />
      <span className="absolute top-1/2 right-2 h-px w-4 -translate-y-1/2 bg-fluoro" />
      <span className="absolute top-2 left-1/2 h-4 w-px -translate-x-1/2 bg-fluoro" />
      <span className="absolute bottom-2 left-1/2 h-4 w-px -translate-x-1/2 bg-fluoro" />
    </div>
  );
}
