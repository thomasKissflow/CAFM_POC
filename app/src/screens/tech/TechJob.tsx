import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ImagePlus, MapPin, Receipt, RefreshCcw } from "lucide-react";
import type { Photo, RootCause } from "@/domain/types";
import { DLP_EXCLUDED } from "@/domain/liability";
import { toGst } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery, useServices } from "@/services/context";
import type { DiagnosisHypothesis } from "@/services/types";
import { useDirectory } from "@/app/lookups";
import { componentPhoto } from "@/services/mock/photos";
import { AiTag, Button, Empty, Input, LiabilityChip, PriorityChip, Textarea, PageLoader } from "@/ui/primitives";
import { StaffGauge } from "@/ui/StaffGauge";
import { SignaturePad } from "@/ui/SignaturePad";
import { cn } from "@/ui/cn";
import { woWhere } from "../shared";

const HVAC_CAUSES: RootCause[] = ["actuator_failed", "thermostat_fault", "filter_clogged", "chw_low_flow", "fan_motor_failed", "condensate_blocked", "misuse"];
const GENERAL_CAUSES: RootCause[] = ["workmanship", "pipe_joint_leak", "sealant_failure", "breaker_tripped", "door_operator_fault", "wear_and_tear", "misuse", "tenant_damage", "consumable"];
const DEFAULT_COST: Partial<Record<RootCause, [number, number]>> = {
  actuator_failed: [1450, 600], thermostat_fault: [380, 300], filter_clogged: [90, 180], chw_low_flow: [240, 650], fan_motor_failed: [2200, 600], condensate_blocked: [0, 350]
};

/** Scroll an element into view inside its nearest scrolling ancestor only (never the host page). */
function scrollWithin(el: HTMLElement | null) {
  if (el === null) return;
  let p = el.parentElement;
  while (p && !(p.scrollHeight > p.clientHeight && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
  if (p === null) return;
  const top = el.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - p.clientHeight / 2 + el.clientHeight / 2;
  p.scrollTo({ top, behavior: "smooth" });
}

export default function TechJob() {
  const { id = "" } = useParams();
  const { t, f, b, lang, dateShort, dir: textDir } = useI18n();
  const services = useServices();
  const now = useNow(1000);
  const dir = useDirectory();
  const q = useQuery((s) => s.workOrders.get(id), [id]);
  const wo = q.data;
  const ctxQ = useQuery((s) => (wo?.assetId ? s.assets.diagnosis(wo.assetId, wo.reportedAt) : Promise.resolve(undefined)), [wo?.assetId, wo?.reportedAt]);
  const ctx = ctxQ.data;

  const [cause, setCause] = useState<RootCause | null>(null);
  const [challenge, setChallenge] = useState<"none" | "open" | "kept">("none");
  const [hyp, setHyp] = useState<DiagnosisHypothesis[] | null>(null);
  const [hypBusy, setHypBusy] = useState(false);
  const [parts, setParts] = useState("0");
  const [labour, setLabour] = useState("0");
  const [reading, setReading] = useState("");
  const [note, setNote] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [signature, setSignature] = useState<string | undefined>();
  const [closing, setClosing] = useState(false);
  const [result, setResult] = useState<{ reclassified: boolean; liability: string; reason: string } | null>(null);
  const checklistRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const challengeRef = useRef<HTMLDivElement>(null);
  const Back = textDir === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (challenge === "open") scrollWithin(challengeRef.current);
  }, [challenge]);

  useEffect(() => {
    if (cause && DEFAULT_COST[cause]) {
      setParts(String(DEFAULT_COST[cause]![0]));
      setLabour(String(DEFAULT_COST[cause]![1]));
    }
  }, [cause]);

  if (wo === undefined) return q.loading ? <div className="p-4"><PageLoader className="h-96" /></div> : <Empty title="Job not found" />;

  const isHvac = wo.category === "ac_not_cooling" || wo.category === "ac_noise_leak";
  const causes = isHvac ? HVAC_CAUSES : GENERAL_CAUSES;
  const sibCause = ctx?.siblingFailures[0]?.rootCause;
  const prev = ctx?.previous[0];
  const shouldChallenge = (c: RootCause) =>
    !!ctx && ((ctx.repeatCount >= 3 && prev?.rootCause !== undefined && prev.rootCause === c) || (sibCause !== undefined && sibCause !== c && ctx.siblingFailures.length >= 2) || (ctx.repeatCount >= 3 && c === "thermostat_fault"));

  const pick = (c: RootCause) => {
    setCause(c);
    if (challenge !== "kept" && shouldChallenge(c)) {
      setChallenge("open");
      void services.workOrders.recordChallenge(wo.id, "P-JOEL", `${ctx?.repeatCount ?? 0} faults / ${ctx?.siblingFailures.length ?? 0} batch`);
    } else if (challenge !== "kept") setChallenge("none");
  };

  const addPhoto = async (kind: "before" | "after", file?: File) => {
    const photo: Photo = { id: `PH-${kind}-${Date.now()}`, url: file ? URL.createObjectURL(file) : componentPhoto(kind), kind, takenAt: toGst(now) };
    await services.workOrders.addPhoto(wo.id, photo, "P-JOEL");
  };

  const checklistDone = wo.checklist.every((c) => c.done);
  const hasAfter = wo.photos.some((p) => p.kind === "after");
  const ready = checklistDone && cause !== null && hasAfter && challenge !== "open";
  const sub = dir?.sub(wo.subcontractorId);

  if (result) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <CheckCircle2 size={46} strokeWidth={1.5} className="text-ok" />
        <h1 className="text-[22px] font-semibold text-ink">{t.tech.done}</h1>
        <LiabilityChip liability={result.liability as "DLP"} long />
        <p className="max-w-[32ch] text-[14px] text-ink-2">
          {result.reclassified ? f(t.tech.doneCharge, { reason: result.reason }) : result.liability === "DLP" ? f(t.tech.doneDlp, { sub: sub ? (lang === "ar" ? sub.nameAr : sub.name) : "" }) : result.reason}
        </p>
        <Link to="/tech" className="mt-3 w-full"><Button variant="ink" size="lg" className="w-full">{t.tech.nextJob}</Button></Link>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* header */}
      <div className="bg-sheet px-4 pt-3 pb-4 shadow-[0_1px_0_var(--color-seam)]">
        <Link to="/tech" className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-2"><Back size={15} />{t.nav.myJobs}</Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="reading text-[12px] text-ink-3">{wo.ref}</span>
          <PriorityChip priority={wo.priority} summer={wo.summerUplift} />
          <LiabilityChip liability={wo.liability} />
        </div>
        <h1 className="mt-1.5 text-[21px] leading-tight font-semibold text-ink">{b(wo.title)}</h1>
        <p className="mt-0.5 flex items-center gap-1 text-[13.5px] text-ink-2"><MapPin size={14} aria-hidden />{woWhere(wo, dir, b, lang)}</p>
        <StaffGauge className="mt-3" start={wo.reportedAt} due={wo.resolveDueAt} now={now} size="md" />
        {wo.status === "accepted" && (
          <Button variant="primary" size="lg" className="mt-3 w-full" onClick={() => void services.workOrders.arrive(wo.id, "P-JOEL")}>{t.tech.arrived}</Button>
        )}
      </div>

      <div className="flex flex-col gap-6 px-4 pt-5">
        {/* description as reported */}
        <section>
          <p lang={wo.descriptionLang} dir={wo.descriptionLang === "ar" ? "rtl" : "ltr"} className="rounded-md bg-sheet-2 px-3 py-2.5 text-[14px] leading-relaxed text-ink">{wo.description}</p>
        </section>

        {/* asset history strip */}
        {ctx && ctx.previous.length > 0 && (
          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-ink">{t.tech.history} · <span className="reading font-normal text-ink-2">{ctx.asset.tag}</span></h2>
            <ol className="flex flex-col gap-1.5">
              {ctx.previous.map((p) => (
                <li key={p.workOrderId} className="flex items-center justify-between gap-3 rounded-md border border-seam bg-sheet px-3 py-2 text-[13px]">
                  <span className="reading text-[12px] text-ink-3">{dateShort(p.at)}</span>
                  <span className="flex-1 truncate text-ink">{p.rootCause ? t.rootCause[p.rootCause] : "—"}</span>
                  <LiabilityChip liability={p.liability} />
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* checklist */}
        <section ref={checklistRef}>
          <h2 className="mb-2 text-[13px] font-semibold text-ink">{t.tech.checklist}</h2>
          <ul className="sheet divide-y divide-seam">
            {wo.checklist.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => void services.workOrders.toggleChecklist(wo.id, c.id, "P-JOEL")}
                  className="flex min-h-[52px] w-full items-center gap-3 px-3.5 text-start text-[14px] text-ink active:bg-sheet-2"
                  aria-pressed={c.done}
                >
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border-2", c.done ? "border-ink bg-ink text-sheet" : "border-seam-strong")}>{c.done && <Check size={14} strokeWidth={3} />}</span>
                  <span className={c.done ? "text-ink-2" : ""}>{b(c.label)}</span>
                </button>
              </li>
            ))}
          </ul>
          {isHvac && (
            <label className="mt-2 flex items-center justify-between gap-3 text-[13px] text-ink-2">
              {t.tech.readings}
              <Input inputMode="decimal" value={reading} onChange={(e) => setReading(e.target.value)} className="reading h-11 w-24 text-center" placeholder="—" />
            </label>
          )}
        </section>

        {/* root cause */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ink">{t.tech.rootCause}</h2>
            <button
              onClick={async () => {
                setHypBusy(true);
                setHyp(await services.ai.diagnose(wo.id));
                setHypBusy(false);
              }}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2"
            >
              <AiTag />{hypBusy ? t.ai.thinking : t.ai.diagnose}
            </button>
          </div>
          {hyp && (
            <div className="animate-rise mb-3 rounded-md border border-dashed border-ink-3/60 bg-sheet px-3 py-2.5">
              {hyp.map((h) => (
                <button key={h.rootCause} onClick={() => pick(h.rootCause)} className="block w-full py-1.5 text-start">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-medium text-ink">{t.rootCause[h.rootCause]}</span>
                    <span className="reading text-[11.5px] text-ink-3">{Math.round(h.confidence * 100)}%</span>
                  </div>
                  <div className="mt-1 h-1 w-full bg-sheet-2"><div className="h-full bg-ink" style={{ width: `${Math.round(h.confidence * 100)}%` }} /></div>
                  <p className="mt-1 text-[12px] leading-snug text-ink-3">{b(h.evidence)}</p>
                </button>
              ))}
            </div>
          )}
          <div role="radiogroup" aria-label={t.tech.pickRootCause} className="grid grid-cols-1 gap-1.5">
            {causes.map((c) => (
              <Fragment key={c}>
              <button
                role="radio"
                aria-checked={cause === c}
                onClick={() => pick(c)}
                className={cn("flex min-h-[48px] items-center justify-between gap-2 rounded-md border px-3.5 text-start text-[14px]",
                  cause === c ? "crosshair border-ink bg-sheet font-medium text-ink" : "border-seam bg-sheet/70 text-ink-2")}
              >
                {t.rootCause[c]}
                {DLP_EXCLUDED.has(c) && <span className="shrink-0 rounded-sm bg-chargeable-wash px-1.5 py-0.5 text-[10.5px] text-chargeable">{t.excluded}</span>}
              </button>
              {/* the diagnosis challenge, right under the cause that triggered it */}
          {challenge === "open" && ctx && cause === c && (
            <div ref={challengeRef} role="alertdialog" aria-labelledby="dc-title" className="animate-rise mt-1 mb-2 overflow-hidden rounded-lg border-2 border-ink bg-sheet shadow-[var(--shadow-float)]">
              <div className="hazard h-1.5" aria-hidden />
              <div className="p-4">
                <h3 id="dc-title" className="flex items-center gap-2 text-[16px] font-semibold text-ink"><AlertTriangle size={18} className="text-risk" />{t.tech.challengeTitle}</h3>
                <ul className="mt-2.5 flex flex-col gap-2 text-[13.5px] leading-snug text-ink">
                  <li className="flex gap-2"><span className="reading mt-0.5 shrink-0 rounded-sm bg-ink px-1.5 text-[11px] text-sheet">{ctx.repeatCount}×</span>{f(t.tech.challengeRepeat, { n: ctx.repeatCount, days: ctx.windowDays })}</li>
                  {prev && <li className="text-ink-2">{f(t.tech.challengePrev, { date: dateShort(prev.at), cause: prev.rootCause ? t.rootCause[prev.rootCause] : "—" })}</li>}
                  {ctx.siblingFailures.length > 0 && sibCause && (
                    <li className="rounded-md bg-fluoro-wash px-2.5 py-2 text-ink">
                      {f(t.tech.challengeSiblings, { n: ctx.siblingFailures.length, batch: ctx.batch ?? "", cause: t.rootCause[sibCause] })}
                      <span className="reading mt-1 block text-[11.5px] text-fluoro-ink">{ctx.siblingFailures.map((s) => s.tag).join(" · ")}</span>
                    </li>
                  )}
                </ul>
                <p className="mt-3 text-[13.5px] font-medium text-ink">{f(t.tech.challengeAsk, { cause: t.rootCause[cause] })}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="ink" size="lg" icon={<RefreshCcw size={15} />} onClick={() => { setCause(null); setChallenge("none"); scrollWithin(checklistRef.current); }}>{t.tech.challengeRetest}</Button>
                  <Button variant="secondary" size="lg" onClick={() => setChallenge("kept")}>{t.tech.challengeKeep}</Button>
                </div>
              </div>
            </div>
          )}
              </Fragment>
            ))}
          </div>

        </section>

        {/* photos */}
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-ink">{t.wo.photos}</h2>
          <div className="grid grid-cols-2 gap-2">
            {(["before", "after"] as const).map((kind) => {
              const photo = [...wo.photos].reverse().find((p) => p.kind === kind);
              return (
                <div key={kind} className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-ink-3">{kind === "before" ? t.tech.photosBefore : t.tech.photosAfter}</span>
                  {photo ? (
                    <img src={photo.url} alt={kind} className="aspect-[4/3] w-full rounded-md border border-seam object-cover" />
                  ) : (
                    <button onClick={() => (kind === "before" ? beforeRef : afterRef).current?.click()} className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-ink-3 text-[12px] text-ink-2">
                      <Camera size={22} strokeWidth={1.6} aria-hidden />{t.tech.addPhoto}
                    </button>
                  )}
                  {!photo && <button onClick={() => void addPhoto(kind)} className="flex items-center justify-center gap-1 text-[11.5px] text-ink-3 underline decoration-dotted underline-offset-4"><ImagePlus size={12} aria-hidden />{t.tech.usePlaceholder}</button>}
                </div>
              );
            })}
          </div>
          <input ref={beforeRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && void addPhoto("before", e.target.files[0])} />
          <input ref={afterRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && void addPhoto("after", e.target.files[0])} />
        </section>

        {/* cost */}
        <section className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12.5px] text-ink-2">{t.tech.parts}<Input inputMode="numeric" value={parts} onChange={(e) => setParts(e.target.value.replace(/[^\d]/g, ""))} className="reading h-12" /></label>
          <label className="flex flex-col gap-1 text-[12.5px] text-ink-2">{t.tech.labour}<Input inputMode="numeric" value={labour} onChange={(e) => setLabour(e.target.value.replace(/[^\d]/g, ""))} className="reading h-12" /></label>
        </section>

        {/* note */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ink">{t.wo.description}</h2>
            <button
              disabled={!cause || drafting}
              onClick={async () => {
                if (!cause) return;
                setDrafting(true);
                const d = await services.ai.draftCloseout(wo.id, cause);
                setNote(b(d));
                setDrafting(false);
              }}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 disabled:opacity-40"
            >
              <AiTag />{drafting ? t.ai.thinking : t.ai.draft}
            </button>
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} dir="auto" className="min-h-28" />
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-ink">{t.tech.signature}</h2>
          <SignaturePad onChange={setSignature} />
        </section>
      </div>

      {/* sticky completion bar */}
      <div className="sticky bottom-0 mt-6 border-t border-seam bg-sheet/95 px-4 py-3 backdrop-blur">
        {!ready && <p className="mb-2 text-[12px] text-ink-3">{t.tech.requiredFirst}</p>}
        <Button
          variant="primary" size="lg" className="w-full" disabled={!ready} loading={closing} icon={<Receipt size={16} />}
          onClick={async () => {
            if (!cause) return;
            setClosing(true);
            try {
              const r = await services.workOrders.resolve(wo.id, {
                rootCause: cause, partsAed: Number(parts) || 0, labourAed: Number(labour) || 0, signature,
                note: note || undefined, challengeAcknowledged: challenge === "kept"
              }, "P-JOEL");
              setResult({ reclassified: r.reclassified, liability: r.workOrder.liability, reason: b(r.workOrder.liabilityReason) });
            } finally {
              setClosing(false);
            }
          }}
        >
          {closing ? t.tech.closing : t.tech.closeOut}
        </Button>
      </div>
    </div>
  );
}
