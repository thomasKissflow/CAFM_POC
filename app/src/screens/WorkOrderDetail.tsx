import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Boxes, CheckCheck, Languages, Lock, Receipt, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { readSla } from "@/domain/sla";
import { useI18n } from "@/i18n";
import { useNow, useQuery, useServices } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { ROLE_PERSON, useSession } from "@/app/session";
import {
  AiTag, Button, ChannelChip, Empty, LiabilityChip, Panel, PriorityChip, Select, SlaChip, StatusChip, Textarea, PageLoader } from "@/ui/primitives";
import { StaffGauge } from "@/ui/StaffGauge";
import { ChainageRuler } from "@/ui/ChainageRuler";
import { cn } from "@/ui/cn";
import { ActorIcon, assigneeName, useEventText, woWhere } from "./shared";

export default function WorkOrderDetail() {
  const { id = "" } = useParams();
  const { t, b, lang, dateTime, dateShort, time, aed, dir: textDir } = useI18n();
  const services = useServices();
  const now = useNow(1000);
  const dir = useDirectory();
  const { role } = useSession();
  const actor = ROLE_PERSON[role];
  const q = useQuery((s) => s.workOrders.get(id), [id]);
  const wo = q.data;
  const assetQ = useQuery((s) => (wo?.assetId ? s.assets.get(wo.assetId) : Promise.resolve(undefined)), [wo?.assetId]);
  const translation = useQuery(
    (s) => (wo && wo.descriptionLang !== lang ? s.ai.triage(wo.description, wo.descriptionLang, { siteId: wo.siteId, unitId: wo.unitId, at: wo.reportedAt }) : Promise.resolve(undefined)),
    [wo?.id, lang]
  );
  const bcQ = useQuery((s) => (wo?.backChargeId ? s.dlp.backCharge(wo.backChargeId) : Promise.resolve(undefined)), [wo?.backChargeId]);
  const eventText = useEventText();
  const [tech, setTech] = useState("P-JOEL");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const Back = textDir === "rtl" ? ArrowRight : ArrowLeft;

  if (q.data === undefined && q.loading) return <PageLoader className="h-96" />;
  if (wo === undefined) return <Empty title="Work order not found" />;

  const asset = assetQ.data;
  const sub = dir?.sub(wo.subcontractorId);
  const subName = sub ? (lang === "ar" ? sub.nameAr : sub.name) : undefined;
  const resp = readSla(wo.reportedAt, wo.responseDueAt, now, wo.respondedAt);
  const res = readSla(wo.reportedAt, wo.resolveDueAt, now, wo.resolvedAt);
  const reclassified = wo.events.some((e) => e.type === "reclassified");
  const subTechs = dir?.people.filter((p) => p.role === "technician" && p.subcontractorId === wo.subcontractorId) ?? [];
  const canAccept = (role === "subcon_supervisor" || role === "fm_manager" || role === "helpdesk") && (wo.status === "assigned" || wo.status === "new");
  const canClose = (role === "helpdesk" || role === "fm_manager") && wo.status === "resolved";

  const bannerTone = {
    DLP: "border-dlp/60 bg-dlp-wash", CHARGEABLE: "border-chargeable/40 bg-chargeable-wash", DECENNIAL_REVIEW: "border-decennial/40 bg-decennial-wash",
    WARRANTY: "border-ok/40 bg-ok-wash", OWN_OPS: "border-ownops/40 bg-ownops-wash", PPM: "border-seam bg-sheet-2"
  }[wo.liability];

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (msg) toast.success(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-rise">
      <Link to="/queue" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink"><Back size={14} />{t.nav.queue}</Link>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="reading text-[13px] text-ink-2">{wo.ref}</span>
            <PriorityChip priority={wo.priority} summer={wo.summerUplift} />
            <StatusChip status={wo.status} />
            <ChannelChip channel={wo.channel} />
          </div>
          <h1 className="mt-1.5 text-[24px] leading-tight font-semibold tracking-[-0.01em] text-ink">{b(wo.title)}</h1>
          <p className="text-[13.5px] text-ink-2">{woWhere(wo, dir, b, lang)}{wo.reporterName ? ` · ${t.wo.reportedBy} ${wo.reporterName}` : ""}</p>
        </div>
        {wo.summerUplift && <span className="rounded-sm bg-ink px-2 py-1 text-[12px] text-sheet">{t.sla.summerRule}</span>}
      </header>

      {/* Liability banner */}
      <section className={cn("mb-4 rounded-md border px-5 py-4", bannerTone)} aria-label={t.wo.liabilityBanner}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-ink-2">{t.wo.liabilityBanner}</span>
              <LiabilityChip liability={wo.liability} long />
              {reclassified && <span className="rounded-sm border border-ink px-1.5 text-[11px] font-medium text-ink">{t.wo.reclassified}</span>}
            </div>
            <p className="mt-1.5 text-[15px] leading-snug font-medium text-ink">{b(wo.liabilityReason)}</p>
            <p className="mt-1 text-[13px] text-ink-2">
              {t.wo.routedTo}: <span className="font-medium text-ink">{wo.assigneeOrg === "subcon" && subName ? `${subName} · ${t.ev.installer}` : assigneeName(wo, dir, b, lang)}</span>
            </p>
            {wo.liability === "DECENNIAL_REVIEW" && <p className="mt-2 max-w-[70ch] text-[12.5px] text-decennial">{t.wo.decennialNote}</p>}
          </div>
          {asset?.dlpEnd && asset.handoverDate && (
            <ChainageRuler start={asset.handoverDate} end={asset.dlpEnd} now={now} compact />
          )}
        </div>
      </section>

      {/* SLA staffs */}
      <section className="sheet mb-4 grid gap-5 px-5 py-4 md:grid-cols-2">
        {[{ label: t.sla.response, r: resp, due: wo.responseDueAt, done: wo.respondedAt }, { label: t.sla.resolution, r: res, due: wo.resolveDueAt, done: wo.resolvedAt }].map((x) => (
          <div key={x.label}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">{x.label}</span>
              <span className="flex items-center gap-2 text-[12px] text-ink-3">
                <span className="reading">{time(wo.reportedAt)} → {time(x.due)}</span>
                <SlaChip phase={x.r.phase} />
              </span>
            </div>
            <StaffGauge start={wo.reportedAt} due={x.due} now={now} doneAt={x.done} size="lg" label={!x.done} />
          </div>
        ))}
        <p className="text-[11.5px] text-ink-3 md:col-span-2">{t.sla.clockStarted}: <span className="reading">{dateTime(wo.reportedAt)}</span></p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={t.wo.description}>
            <p lang={wo.descriptionLang} dir={wo.descriptionLang === "ar" ? "rtl" : "ltr"} className="max-w-[70ch] text-[15px] leading-relaxed text-ink">{wo.description}</p>
            {wo.descriptionLang !== lang && (
              <div className="mt-3 rounded-md border border-dashed border-ink-3/60 bg-sheet-2 px-3 py-2.5">
                <div className="mb-1 flex items-center gap-2 text-[12px] text-ink-3"><Languages size={13} aria-hidden />{t.wo.translationFor}<AiTag /></div>
                <p className="text-[14px] leading-relaxed text-ink-2">
                  {translation.data?.translation ? (lang === "en" ? translation.data.translation.en : wo.title.ar) : t.ai.thinking}
                </p>
              </div>
            )}
            {wo.photos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {wo.photos.map((p) => (
                  <figure key={p.id} className="w-40">
                    <img src={p.url} alt={p.caption ?? p.kind} className="aspect-[4/3] w-full rounded-md border border-seam object-cover" />
                    <figcaption className="mt-1 text-[11.5px] text-ink-3">{p.kind} · {time(p.takenAt)}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Panel>

          {wo.transcript && wo.transcript.length > 0 && (
            <Panel title={lang === "ar" ? "محادثة المساعد الصوتي" : "Voice call transcript"} meta={`${wo.transcript.length}`} actions={<AiTag />}>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {wo.vulnerableOccupant && <span className="rounded-sm bg-breach-wash px-1.5 py-0.5 text-[11.5px] font-medium text-breach">{lang === "ar" ? "شخص حساس للحر في المنزل" : "Vulnerable occupant at home"}</span>}
                {wo.accessWindow && <span className="rounded-sm bg-sheet-2 px-1.5 py-0.5 text-[11.5px] text-ink-2">{lang === "ar" ? "الدخول" : "Access"}: {wo.accessWindow}</span>}
              </div>
              <ol className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {wo.transcript.map((l, i) => (
                  <li key={i} dir="auto" className={cn("rounded-md px-2.5 py-1.5 text-[13px]", l.role === "agent" ? "bg-sheet-2 text-ink-2" : "bg-fluoro-wash/60 text-ink")}>
                    <span className="reading me-1.5 text-[10.5px] text-ink-3">{time(l.at)}</span>
                    <span className="font-medium">{l.role === "agent" ? "CAFM" : wo.reporterName ?? "Caller"}:</span> {l.text}
                    {l.interrupted && <span className="ms-1 text-[10.5px] text-fluoro-ink">({lang === "ar" ? "قاطعه المتصل" : "caller interrupted"})</span>}
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          <Panel title={t.wo.asset} actions={asset && <Link to={`/assets/${asset.id}`} className="text-[12.5px] text-ink-2 hover:text-ink">{t.chrome.open}</Link>}>
            {asset ? (
              <Link to={`/assets/${asset.id}`} className="group flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-sheet-2 text-ink-2"><Boxes size={22} strokeWidth={1.6} /></span>
                <span className="min-w-0">
                  <span className="reading block text-[14px] font-medium text-ink group-hover:underline">{asset.tag}</span>
                  <span className="block text-[12.5px] text-ink-2">{t.assetClass[asset.assetClass]} · {asset.make} {asset.model}</span>
                  <span className="block text-[12.5px] text-ink-3">{t.asset.installedBy}: {dir?.sub(asset.installedBy)?.[lang === "ar" ? "nameAr" : "name"]}{asset.batch ? ` · ${t.asset.batch} ${asset.batch}` : ""}</span>
                </span>
              </Link>
            ) : <p className="text-[13px] text-ink-3">{t.wo.noAsset}</p>}
          </Panel>

          {(wo.partsAed !== undefined || bcQ.data) && (
            <Panel title={t.wo.cost} actions={bcQ.data && <Link to="/dlp" className="flex items-center gap-1 text-[12.5px] text-fluoro-ink hover:underline"><Receipt size={13} />{bcQ.data.ref}</Link>}>
              <dl className="grid grid-cols-3 gap-4">
                <div><dt className="text-[12px] text-ink-3">{t.wo.parts}</dt><dd className="tnum text-[17px] font-medium">{aed(wo.partsAed ?? 0)}</dd></div>
                <div><dt className="text-[12px] text-ink-3">{t.wo.labour}</dt><dd className="tnum text-[17px] font-medium">{aed(wo.labourAed ?? 0)}</dd></div>
                <div><dt className="text-[12px] text-ink-3">{t.wo.total}</dt><dd className="tnum text-[17px] font-semibold">{aed((wo.partsAed ?? 0) + (wo.labourAed ?? 0))}</dd></div>
              </dl>
              {bcQ.data && (
                <p className="mt-3 text-[13px] text-ink-2">
                  {t.wo.backCharge} <span className="reading">{bcQ.data.ref}</span> → {subName} · {t.dlp[`status_${bcQ.data.status}` as "status_issued"]}
                </p>
              )}
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {(canAccept || canClose || wo.status === "accepted" || wo.status === "in_progress") && (
            <Panel title={t.nav.myWork} className="border-ink">
              {canAccept && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-[12.5px] text-ink-2">
                    {t.wo.assignTech}
                    <Select value={tech} onChange={(e) => setTech(e.target.value)}>
                      {(subTechs.length ? subTechs : dir?.people.filter((p) => p.role === "technician") ?? []).map((p) => <option key={p.id} value={p.id}>{b(p.name)}</option>)}
                    </Select>
                  </label>
                  <Button variant="primary" loading={busy} icon={<Send size={14} className="rtl:-scale-x-100" />} onClick={() => act(() => services.workOrders.accept(wo.id, actor, tech), t.status.accepted)}>{t.wo.accept}</Button>
                </div>
              )}
              {(wo.status === "accepted" || wo.status === "in_progress") && (
                <p className="flex items-center gap-2 text-[13px] text-ink-2">
                  <Smartphone size={15} aria-hidden />{b(dir?.person(wo.technicianId)?.name)} · {t.status[wo.status]}
                </p>
              )}
              {canClose && (
                <Button variant="primary" loading={busy} icon={<CheckCheck size={15} />} onClick={() => act(() => services.workOrders.verifyAndClose(wo.id, actor), t.status.closed)}>{t.wo.verifyClose}</Button>
              )}
            </Panel>
          )}

          <Panel title={t.wo.activity} meta={`${wo.events.length}`} actions={<Lock size={13} className="text-ink-3" aria-label={t.wo.activityNote} />}>
            <p className="mb-3 text-[12px] text-ink-3">{t.wo.activityNote}</p>
            <ol className="relative flex flex-col">
              {wo.events.map((e, i) => {
                const newDay = i === 0 || e.at.slice(0, 10) !== wo.events[i - 1].at.slice(0, 10);
                return (
                <li key={e.id} className="grid grid-cols-[64px_18px_1fr] gap-2 pb-3 last:pb-0">
                  <span className="reading pt-0.5 text-end text-[11.5px] leading-tight text-ink-3">
                    {newDay && <span className="block font-semibold text-ink-2">{dateShort(e.at)}</span>}
                    {time(e.at)}
                  </span>
                  <span className="relative flex justify-center">
                    <span className={cn("z-10 mt-1.5 h-2 w-2 rotate-45", e.type === "reclassified" || e.type === "backcharge_created" ? "bg-fluoro" : e.actor === "ai" ? "border border-ink-3 bg-sheet" : "bg-ink")} />
                    {i < wo.events.length - 1 && <span className="absolute top-3 bottom-[-12px] w-px bg-seam-strong" aria-hidden />}
                  </span>
                  <span className="min-w-0 text-[13px] leading-snug text-ink">
                    {eventText(e)}
                    <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-3">
                      {e.actor === "ai" ? <AiTag className="h-[16px] text-[10px]" /> : (
                        <><ActorIcon actor={e.actor} />{e.actor === "system" ? t.ev.system : b(dir?.person(e.actor)?.name) || e.actor}</>
                      )}
                    </span>
                  </span>
                </li>
                );
              })}
            </ol>
            <form
              className="mt-4 flex flex-col gap-2 border-t border-seam pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                void act(() => services.workOrders.comment(wo.id, note.trim(), actor)).then(() => setNote(""));
              }}
            >
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.wo.addComment} className="min-h-16" aria-label={t.wo.addComment} />
              <Button type="submit" size="sm" variant="secondary" className="self-end" disabled={!note.trim()}>{t.wo.post}</Button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
