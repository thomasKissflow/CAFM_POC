import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Camera, CheckCircle2, Droplets, Lightbulb, MoveVertical, Snowflake, Wrench, Hammer, ImagePlus } from "lucide-react";
import type { Category, Channel, Photo, WorkOrder } from "@/domain/types";
import { MINUTE, toGst } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery, useServices } from "@/services/context";
import type { TriageSuggestion } from "@/services/types";
import { useDirectory, useSiteChoice } from "@/app/lookups";
import { ROLE_PERSON, useSession } from "@/app/session";
import { MobileTabBar } from "@/app/Shell";
import { thermostatPhoto } from "@/services/mock/photos";
import { AiTag, Button, Field, Input, LiabilityChip, PageHeader, Panel, PriorityChip, Select, Textarea } from "@/ui/primitives";
import { cn } from "@/ui/cn";

const TILES: Array<{ cat: Category; icon: typeof Snowflake }> = [
  { cat: "ac_not_cooling", icon: Snowflake },
  { cat: "water_leak", icon: Droplets },
  { cat: "electrical", icon: Lightbulb },
  { cat: "plumbing", icon: Wrench },
  { cat: "lift", icon: MoveVertical },
  { cat: "civil_finishes", icon: Hammer }
];
const STORY_TEXT = "المكيف لا يبرد أبدًا منذ الصباح، والحرارة داخل الشقة ٢٩ درجة. عندي طفل صغير، أرجو الإسراع.";

/** Debounced AI-preview triage of the free text. */
function useTriage(text: string, lang: "en" | "ar", siteId: string, unitId: string | undefined, at: number) {
  const services = useServices();
  const [s, setS] = useState<TriageSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (text.trim().length < 8) {
      setS(null);
      return;
    }
    let live = true;
    const id = window.setTimeout(() => {
      setBusy(true);
      services.ai.triage(text, lang, { siteId, unitId, at: toGst(at) }).then((r) => {
        if (live) {
          setS(r);
          setBusy(false);
        }
      });
    }, 500);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang, siteId, unitId]);
  return { suggestion: s, busy };
}

export default function NewRequest({ resident = false }: { resident?: boolean }) {
  return resident ? <ResidentForm /> : <HelpdeskForm />;
}

function detectLang(text: string): "en" | "ar" {
  return /[؀-ۿ]/.test(text) ? "ar" : "en";
}

function ResidentForm() {
  const { t, f, b, lang, time } = useI18n();
  const services = useServices();
  const now = useNow(5000);
  const [cat, setCat] = useState<Category | null>(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<WorkOrder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textLang = detectLang(text || (lang === "ar" ? "ع" : "a"));
  const { suggestion, busy } = useTriage(text, textLang, "S-QMR", "U-QMR-1402", now);
  const category = cat ?? suggestion?.category ?? null;

  const addFile = (file: File) => {
    setPhotos((p) => [...p, { id: `PH-${Date.now()}`, url: URL.createObjectURL(file), kind: "report", takenAt: toGst(now) }]);
  };

  const submit = async () => {
    if (!category) return;
    setSending(true);
    try {
      const title = { en: tEn(category), ar: tAr(category) };
      const wo = await services.workOrders.create({
        siteId: "S-QMR", unitId: "U-QMR-1402",
        assetId: category === "ac_not_cooling" || category === "ac_noise_leak" ? "A-QMR-FCU-1402-01" : undefined,
        category, title,
        description: text || b(title), descriptionLang: textLang, channel: "resident_app",
        reportedBy: "P-LAYLA", reporterName: lang === "ar" ? "ليلى السويدي" : "Layla Al Suwaidi",
        photos, aiTriage: suggestion ? { category: suggestion.category, confidence: suggestion.confidence } : undefined
      }, "P-LAYLA");
      await services.demo.runStoryStep("raise"); // neighbours arrive on other channels (demo)
      setDone(wo);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <CheckCircle2 size={44} className="text-ok" strokeWidth={1.6} />
          <h1 className="text-[22px] font-semibold text-ink">{t.request.sent}</h1>
          <p className="text-[14px] text-ink-2">{f(t.request.sentBody, { ref: done.ref, time: time(done.reportedAt) })}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5"><PriorityChip priority={done.priority} summer={done.summerUplift} /><LiabilityChip liability={done.liability} long /></div>
          <Link to="/me" className="mt-4"><Button variant="ink" size="lg">{t.request.track}</Button></Link>
        </div>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 pt-4 pb-6">
        <h1 className="text-[24px] leading-tight font-semibold text-ink">{t.request.title}</h1>
        <p className="mt-1 text-[14px] text-ink-2">{t.resident.home} · {t.request.subtitle}</p>

        <h2 className="mt-6 mb-2 text-[13px] font-medium text-ink-2">{t.request.whatsWrong}</h2>
        <div className="grid grid-cols-3 gap-2">
          {TILES.map(({ cat: c, icon: Icon }) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={category === c}
              className={cn("flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-lg border px-1.5 text-center text-[12.5px] leading-tight transition-colors",
                category === c ? "crosshair border-ink bg-sheet font-medium text-ink shadow-[var(--shadow-lift)]" : "border-seam bg-sheet/70 text-ink-2")}
            >
              <Icon size={22} strokeWidth={1.7} aria-hidden />
              {t.category[c]}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <Field label={t.request.describe} htmlFor="desc">
            <Textarea id="desc" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.request.describePh} dir="auto" className="min-h-28 text-[15px]" />
          </Field>
          {!text && (
            <button onClick={() => setText(STORY_TEXT)} className="mt-1.5 text-[12px] text-ink-3 underline decoration-dotted underline-offset-4">
              {lang === "ar" ? "استخدم نص العرض" : "Use demo text (Arabic)"}
            </button>
          )}
        </div>

        {(busy || suggestion) && (
          <div className="animate-rise mt-3 rounded-lg border border-dashed border-ink-3/60 bg-sheet px-3.5 py-3" aria-live="polite">
            <div className="flex items-center justify-between"><AiTag />{suggestion && <span className="reading text-[11px] text-ink-3">{Math.round(suggestion.confidence * 100)}% {t.ai.confidence}</span>}</div>
            {busy && !suggestion ? (
              <p className="mt-2 text-[13px] text-ink-3">{t.ai.thinking}</p>
            ) : suggestion && (
              <div className="mt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] font-medium text-ink">{t.category[suggestion.category]}</span>
                  <PriorityChip priority={suggestion.priority} summer={suggestion.summerUplift} />
                  {suggestion.liability && <LiabilityChip liability={suggestion.liability} />}
                </div>
                {suggestion.liability === "DLP" && (
                  <p className="mt-1.5 text-[12.5px] text-ink-2">{lang === "ar" ? "يبدو أن الوحدة ضمن فترة ضمان المقاول: سيتم الإصلاح دون تكلفة عليك." : "Your unit looks covered by the contractor's defects period: this should be fixed at no cost to you."}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5">
          <div className="mb-1.5 text-[12.5px] font-medium text-ink-2">{t.request.photo}</div>
          <div className="flex gap-2">
            {photos.map((p) => <img key={p.id} src={p.url} alt="" className="h-20 w-20 rounded-md border border-seam object-cover" />)}
            <button onClick={() => fileRef.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-ink-3 text-[11px] text-ink-2">
              <Camera size={20} strokeWidth={1.7} aria-hidden />{t.tech.addPhoto}
            </button>
            {photos.length === 0 && (
              <button onClick={() => setPhotos([{ id: "PH-demo", url: thermostatPhoto(29), kind: "report", takenAt: toGst(now), caption: "Thermostat 29°C" }])} className="flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-seam-strong px-2 text-[11px] text-ink-3">
                <ImagePlus size={18} strokeWidth={1.7} aria-hidden />{t.tech.usePlaceholder}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && addFile(e.target.files[0])} />
          <p className="mt-1 text-[12px] text-ink-3">{t.request.photoHint}</p>
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-seam bg-sheet/95 px-4 py-3 backdrop-blur">
        <Button variant="primary" size="lg" className="w-full" disabled={!category} loading={sending} onClick={() => void submit()}>
          {sending ? t.request.submitting : t.request.submit}
        </Button>
      </div>
    </div>
  );
}

const EN_TITLES: Record<Category, string> = {
  ac_not_cooling: "AC not cooling", ac_noise_leak: "AC dripping water", water_leak: "Water leak", electrical: "Electrical fault", lift: "Lift fault",
  plumbing: "Plumbing issue", fire_life_safety: "Fire alarm fault", civil_finishes: "Finishes defect", doors_hardware: "Door / lock issue", structural_crack: "Crack in structure", ppm: "Planned maintenance"
};
const AR_TITLES: Record<Category, string> = {
  ac_not_cooling: "المكيف لا يبرد", ac_noise_leak: "المكيف يسرب ماء", water_leak: "تسرب مياه", electrical: "عطل كهربائي", lift: "عطل في المصعد",
  plumbing: "مشكلة سباكة", fire_life_safety: "عطل في إنذار الحريق", civil_finishes: "عيب في التشطيبات", doors_hardware: "مشكلة باب / قفل", structural_crack: "شرخ في الهيكل", ppm: "صيانة مخططة"
};
const tEn = (c: Category) => EN_TITLES[c];
const tAr = (c: Category) => AR_TITLES[c];

function HelpdeskForm() {
  const { t, b, lang } = useI18n();
  const services = useServices();
  const navigate = useNavigate();
  const now = useNow(30000);
  const dir = useDirectory();
  const { role } = useSession();
  const [params] = useSearchParams();
  const [siteId, setSiteId] = useSiteChoice(dir);
  const [unitId, setUnitId] = useState("");
  const [category, setCategory] = useState<Category>("ac_not_cooling");
  const [channel, setChannel] = useState<Channel>(params.get("channel") === "phone" ? "phone" : "helpdesk");
  const [reporter, setReporter] = useState("");
  const [text, setText] = useState("");
  const [callAt, setCallAt] = useState(() => {
    const d = new Date(now - 2 * MINUTE + 4 * 3600e3);
    return d.toISOString().slice(11, 16);
  });
  const [sending, setSending] = useState(false);
  const units = useQuery((s) => s.directory.units(siteId), [siteId]);
  const textLang = detectLang(text || "a");
  const { suggestion, busy } = useTriage(text, textLang, siteId, unitId || undefined, now);
  const assets = useQuery((s) => (unitId ? s.assets.list({ siteId }).then((l) => l.filter((a) => a.unitId === unitId)) : Promise.resolve([])), [unitId, siteId]);
  const firstContact = useMemo(() => {
    const today = toGst(now).slice(0, 10);
    return `${today}T${callAt}:00+04:00`;
  }, [callAt, now]);

  const submit = async () => {
    setSending(true);
    try {
      const assetId = (category === "ac_not_cooling" || category === "ac_noise_leak") ? assets.data?.[0]?.id : undefined;
      const wo = await services.workOrders.create({
        siteId, unitId: unitId || undefined, assetId, category, title: { en: tEn(category), ar: tAr(category) },
        description: text || tEn(category), descriptionLang: textLang, channel, reporterName: reporter || undefined,
        firstContactAt: channel === "phone" ? firstContact : undefined,
        aiTriage: suggestion && suggestion.category === category ? { category, confidence: suggestion.confidence } : undefined
      }, ROLE_PERSON[role]);
      navigate(`/wo/${wo.id}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-rise mx-auto max-w-4xl">
      <PageHeader title={t.request.helpdeskTitle} subtitle={t.intake.subtitle} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t.wo.channel} htmlFor="ch">
              <Select id="ch" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                {(["phone", "helpdesk", "resident_app", "qr_public"] as Channel[]).map((c) => <option key={c} value={c}>{t.channel[c]}</option>)}
              </Select>
            </Field>
            {channel === "phone" ? (
              <Field label={t.request.callTime} htmlFor="callAt" hint={t.sla.clockStarted}>
                <Input id="callAt" type="time" value={callAt} onChange={(e) => setCallAt(e.target.value)} className="reading" />
              </Field>
            ) : <div />}
            <Field label={t.request.site} htmlFor="site">
              <Select id="site" value={siteId} onChange={(e) => { setSiteId(e.target.value); setUnitId(""); }}>
                {dir?.sites.filter((s) => s.kind !== "plant_yard").map((s) => <option key={s.id} value={s.id}>{b(s.name)}</option>)}
              </Select>
            </Field>
            <Field label={t.request.unit} htmlFor="unit">
              <Select id="unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">—</option>
                {units.data?.map((u) => <option key={u.id} value={u.id}>{u.number}</option>)}
              </Select>
            </Field>
            <Field label={t.request.reporter} htmlFor="rep">
              <Input id="rep" value={reporter} onChange={(e) => setReporter(e.target.value)} />
            </Field>
            <Field label={t.request.category} htmlFor="cat">
              <Select id="cat" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {(Object.keys(t.category) as Category[]).filter((c) => c !== "ppm").map((c) => <option key={c} value={c}>{t.category[c]}</option>)}
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label={t.request.describe} htmlFor="d">
                <Textarea id="d" dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.request.describePh} />
              </Field>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button variant="primary" size="lg" loading={sending} onClick={() => void submit()}>{t.request.submit}</Button>
          </div>
        </Panel>
        <Panel title={t.request.aiSuggest} actions={<AiTag />}>
          {suggestion ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[14px] font-medium">{t.category[suggestion.category]}</span>
                <PriorityChip priority={suggestion.priority} summer={suggestion.summerUplift} />
                {suggestion.liability && <LiabilityChip liability={suggestion.liability} />}
              </div>
              <p className="text-[12.5px] text-ink-2">{b(suggestion.rationale)}</p>
              {suggestion.translation && lang === "en" && <p className="rounded-md bg-sheet-2 p-2 text-[12.5px] text-ink-2">{suggestion.translation.en}</p>}
              <Button size="sm" variant="secondary" onClick={() => setCategory(suggestion.category)} disabled={category === suggestion.category}>
                {category === suggestion.category ? t.ai.applied : t.ai.apply}
              </Button>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-3">{busy ? t.ai.thinking : t.request.describePh}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
