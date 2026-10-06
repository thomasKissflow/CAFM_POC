// Admin → AI settings: which voice engine the resident app uses (per browser), where the AI runs, the Gemini key
// for the POC (stored in Kissflow), and the voice agent's instructions.
import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, KeyRound, PlayCircle, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useDirectory } from "@/app/lookups";
import { ROLE_PERSON, useSession } from "@/app/session";
import { useServices } from "@/services/context";
import { useDataSource } from "@/services/source";
import { getVoiceEngine, setVoiceEngine, type VoiceEngine } from "@/voice/live/aiApi";
import { forgetAiProvider, getAiProvider, type AiProvider } from "@/ai/provider";
import { runAiSelfTest, type AiStep } from "@/ai/selftest";
import { Button, Input, PageHeader, PageLoader, Panel, Segmented, Textarea } from "@/ui/primitives";

export default function AiSettings() {
  const { lang, b } = useI18n();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const { role } = useSession();
  const dir = useDirectory();
  const src = useDataSource();
  const services = useServices();
  const [ai, setAi] = useState<AiProvider | undefined>(undefined);
  const [engine, setEngine] = useState<VoiceEngine>(getVoiceEngine);
  const [saved, setSaved] = useState<{ prompt: string; updatedBy?: string; updatedAt?: string } | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [steps, setSteps] = useState<AiStep[] | null>(null);
  const [testing, setTesting] = useState(false);

  const load = (force = false) => {
    if (force) forgetAiProvider();
    void getAiProvider(services, force).then(async (p) => {
      setAi(p);
      try { const s = await p.prompt(); setSaved({ prompt: s.voiceSystemPrompt, updatedBy: s.updatedBy, updatedAt: s.updatedAt }); setDraft(s.voiceSystemPrompt); }
      catch (e) { setLoadError(e instanceof Error ? e.message : String(e)); }
    });
  };
  useEffect(load, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = dir !== undefined ? dir.person(ROLE_PERSON[role]) : undefined;
  const who = src.user !== undefined ? src.user : me !== undefined ? b(me.name) : "Admin";
  const liveOk = ai !== undefined && ai.mode !== "off";
  const dirty = saved !== undefined && draft !== saved.prompt;

  const pickEngine = (e: VoiceEngine) => {
    setEngine(e);
    setVoiceEngine(e);
    toast.success(e === "live" ? L("Resident voice now uses live Gemini", "صوت الساكن يستخدم Gemini المباشر الآن") : L("Resident voice now uses the browser demo", "صوت الساكن يستخدم العرض التجريبي الآن"));
  };
  const savePrompt = async () => {
    if (ai === undefined) return;
    setSaving(true);
    try { await ai.savePrompt(draft, who); setSaved({ prompt: draft, updatedBy: who, updatedAt: new Date().toISOString() }); toast.success(L("Saved in Kissflow. New calls use it straight away.", "تم الحفظ في Kissflow. المكالمات الجديدة تستخدمه فورًا.")); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  const saveKey = async () => {
    const value = keyInput.trim();
    if (value.length < 20) { toast.error(L("That doesn't look like a key.", "لا يبدو هذا مفتاحًا صحيحًا.")); return; }
    setSaving(true);
    try {
      await services.aiSettings.write("gemini_api_key", value, who);
      setKeyInput("");
      toast.success(L("Key stored in Kissflow. Live voice is ready.", "تم حفظ المفتاح في Kissflow. الصوت المباشر جاهز."));
      load(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const where = ai === undefined ? "" : ai.mode === "backend"
    ? L("Our AI service (the key stays on the server)", "خدمة الذكاء الاصطناعي لدينا (المفتاح على الخادم)")
    : ai.mode === "browser"
      ? L("This page, using the key stored in Kissflow (POC only)", "هذه الصفحة بالمفتاح المحفوظ في Kissflow (للعرض فقط)")
      : L("Not available", "غير متاح");

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-6">
      <PageHeader title={L("AI settings", "إعدادات الذكاء الاصطناعي")} subtitle={L("Choose the resident voice engine and edit what the voice agent is told. Data always comes from Kissflow.", "اختر محرك صوت الساكن وعدّل تعليمات المساعد الصوتي. البيانات دائمًا من Kissflow.")} />
      <div className="grid gap-4">
        <Panel title={L("Voice engine", "محرك الصوت")} meta={L("this browser", "هذا المتصفح")}>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label={L("Voice engine", "محرك الصوت")} value={engine} onChange={pickEngine}
              options={[{ value: "demo", label: L("Browser demo", "عرض المتصفح") }, { value: "live", label: L("Live (Gemini)", "مباشر (Gemini)") }]} />
            {ai === undefined ? <span className="text-[12.5px] text-ink-3">{L("Checking…", "جارٍ الفحص…")}</span>
              : liveOk ? <span className="flex items-center gap-1.5 text-[12.5px] text-ok"><CheckCircle2 size={15} aria-hidden />{L("Ready", "جاهز")} · <span className="reading">{ai.liveModel}</span></span>
                : <span className="flex items-center gap-1.5 text-[12.5px] text-breach"><CircleAlert size={15} aria-hidden />{ai.reason}</span>}
          </div>
          {ai !== undefined && <p className="mt-2 text-[12.5px] text-ink-2">{L("Runs on:", "يعمل عبر:")} {where}</p>}
          <ul className="mt-3 grid gap-1 text-[12.5px] text-ink-2">
            <li><b className="font-medium text-ink">{L("Browser demo", "عرض المتصفح")}</b>: {L("scripted agent with your browser's speech. Free, works offline; best for rehearsals and tests.", "مساعد مُعدّ مسبقًا بصوت المتصفح. مجاني ويعمل دون اتصال؛ مناسب للتجارب والاختبارات.")}</li>
            <li><b className="font-medium text-ink">{L("Live (Gemini)", "مباشر (Gemini)")}</b>: {L("a real conversation with Gemini Live, in English or Arabic, with interruptions. About US$0.04 per two-minute call, including the summary.", "محادثة حقيقية مع Gemini Live بالعربية أو الإنجليزية مع المقاطعة. حوالي 0.04 دولار لكل مكالمة من دقيقتين.")}</li>
          </ul>
        </Panel>

        <Panel title={L("Check it works", "تحقق من التشغيل")} meta={L("writes one [TEST] call, deletes nothing", "ينشئ مكالمة اختبار واحدة ولا يحذف شيئًا")}>
          <Button variant="ink" size="md" icon={<PlayCircle size={15} />} loading={testing} disabled={testing || ai === undefined || ai.mode === "off"}
            onClick={() => { setTesting(true); setSteps([]); void runAiSelfTest(ai!, services, (st) => setSteps((prev) => [...(prev ?? []), st])).finally(() => setTesting(false)); }}>
            {L("Run AI self-test", "تشغيل الاختبار الذاتي")}
          </Button>
          <span className="ms-3 text-[12.5px] text-ink-3">{L("Voice token → live session → job card → summary → insights → saved call.", "رمز الصوت ← جلسة مباشرة ← بطاقة الطلب ← الملخص ← الرؤى ← حفظ المكالمة.")}</span>
          {steps !== null && (
            <ol className="mt-2 grid gap-0.5 text-[13px]">
              {steps.length === 0 && <li className="text-ink-3">{L("Running…", "جارٍ التشغيل…")}</li>}
              {steps.map((st, i) => <li key={i} className={st.ok ? "text-ok" : "text-breach"}>{st.ok ? "PASS" : "FAIL"} · {st.name} — <span className="text-ink-2">{st.detail}</span></li>)}
              {!testing && steps.length > 0 && <li className="mt-1 font-semibold text-ink">{steps.filter((x) => x.ok).length}/{steps.length} {L("passed", "ناجح")}</li>}
            </ol>
          )}
        </Panel>

        <Panel title={L("Gemini key (demo)", "مفتاح Gemini (عرض)")} meta={ai !== undefined && ai.mode === "browser" ? L("stored in Kissflow", "محفوظ في Kissflow") : ai !== undefined && ai.mode === "backend" ? L("not needed: the server has one", "غير مطلوب: الخادم لديه مفتاح") : ""}>
          {ai !== undefined && ai.mode === "backend" ? (
            <p className="text-[13px] text-ink-2">{L("This app is talking to our AI service, which holds the key. Nothing to do here.", "يتصل التطبيق بخدمة الذكاء الاصطناعي لدينا التي تحتفظ بالمفتاح. لا حاجة لأي إجراء هنا.")}</p>
          ) : (
            <>
              <p className="text-[13px] text-ink-2">{ai !== undefined && ai.hasStoredKey === true
                ? L("A key is stored in Kissflow and is used for live calls. Paste a new one to replace it.", "يوجد مفتاح محفوظ في Kissflow ويُستخدم للمكالمات المباشرة. الصق مفتاحًا جديدًا لاستبداله.")
                : L("Paste a Google AI Studio key to turn on live voice inside Kissflow. It is stored in the Kissflow AI Settings form, which only app admins can open.", "الصق مفتاح Google AI Studio لتشغيل الصوت المباشر داخل Kissflow. يُحفظ في نموذج إعدادات الذكاء الاصطناعي الذي لا يفتحه سوى مسؤولي التطبيق.")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="AI Studio API key" aria-label={L("Gemini API key", "مفتاح Gemini")} className="max-w-96 flex-1" autoComplete="off" />
                <Button variant="primary" size="md" icon={<KeyRound size={15} />} disabled={saving || keyInput.trim().length < 20} onClick={() => void saveKey()}>{L("Store in Kissflow", "حفظ في Kissflow")}</Button>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">{L("Demo shortcut: the key reaches this page while a call runs. For production it moves to a server — see PRODUCTION_TODO.md.", "اختصار للعرض فقط: يصل المفتاح إلى هذه الصفحة أثناء المكالمة. في الإنتاج ينتقل إلى الخادم.")}</p>
            </>
          )}
        </Panel>

        <Panel title={L("Voice agent instructions", "تعليمات المساعد الصوتي")}
          meta={saved !== undefined && saved.updatedAt !== undefined ? `${L("Last saved", "آخر حفظ")} ${saved.updatedAt.slice(0, 16).replace("T", " ")}${saved.updatedBy !== undefined ? ` · ${saved.updatedBy}` : ""}` : L("Default", "الافتراضي")}>
          {ai === undefined || saved === undefined ? <PageLoader className="h-40" /> : loadError !== null ? <p className="text-[13px] text-breach" role="alert">{loadError}</p> : (
            <>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} dir="auto" rows={18} aria-label={L("System prompt", "تعليمات النظام")} className="reading text-[12.5px]" />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" size="sm" icon={<Undo2 size={14} />} disabled={!dirty || saving} onClick={() => setDraft(saved.prompt)}>{L("Discard", "تجاهل")}</Button>
                <Button variant="primary" size="sm" icon={<Save size={14} />} disabled={!dirty || saving || draft.trim().length < 20 || ai.mode === "off"} loading={saving} onClick={() => void savePrompt()}>{L("Save to Kissflow", "حفظ في Kissflow")}</Button>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">{L("The caller's name, apartment and defects-period status are added automatically for each call. The tool the agent uses to fill the job card (record_request) stays the same whatever you write here.", "يُضاف اسم المتصل وشقته وحالة فترة المسؤولية تلقائيًا لكل مكالمة.")}</p>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
