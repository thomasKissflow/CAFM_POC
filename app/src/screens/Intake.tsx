import { Link } from "react-router-dom";
import { ArrowUpRight, PhoneIncoming } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Channel } from "@/domain/types";
import { HOUR, ms } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { AiTag, Button, Hint, LiabilityChip, PageHeader, Panel, PriorityChip, channelIcon, PageLoader } from "@/ui/primitives";
import { StaffGauge } from "@/ui/StaffGauge";
import { cn } from "@/ui/cn";
import { woWhere } from "./shared";

const LIVE: Channel[] = ["resident_app", "voice_agent", "qr_public", "phone", "helpdesk"];
const READY: Channel[] = ["email", "whatsapp", "bms"];

export default function Intake() {
  const { t, b, lang, time, num } = useI18n();
  const now = useNow(1000);
  const dir = useDirectory();
  const q = useQuery((s) => s.workOrders.list({ limit: 400 }), []);
  // the poster shows an asset that is really in the register, so scanning it opens a form that knows the flat
  const assetsQ = useQuery((s) => s.assets.list({}), []);
  const posterAsset = (assetsQ.data ?? []).find((a) => a.unitId !== undefined && a.assetClass === "FCU") ?? (assetsQ.data ?? [])[0];
  const posterSite = posterAsset !== undefined && dir !== undefined ? dir.site(posterAsset.siteId) : undefined;
  const recent = (q.data ?? []).filter((w) => ms(w.reportedAt) > now - 24 * HOUR && ms(w.reportedAt) <= now).sort((a, b2) => ms(b2.reportedAt) - ms(a.reportedAt));
  const count = (c: Channel) => recent.filter((w) => w.channel === c).length;

  return (
    <div className="animate-rise">
      <PageHeader
        title={t.intake.title}
        subtitle={t.intake.subtitle}
        actions={<Link to="/request/new?channel=phone"><Button variant="primary" icon={<PhoneIncoming size={15} aria-hidden />}>{t.intake.logCall}</Button></Link>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {LIVE.map((c) => {
          const Icon = channelIcon[c];
          return (
            <div key={c} className="sheet flex flex-col gap-2 px-3.5 py-3">
              <div className="flex items-center justify-between">
                <Icon size={17} strokeWidth={1.8} className="text-ink" aria-hidden />
                <span className="flex items-center gap-1 text-[10.5px] font-medium text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" />{t.intake.live}</span>
              </div>
              <div>
                <div className="tnum text-[24px] leading-none font-semibold text-ink">{num(count(c))}</div>
                <div className="mt-1 text-[12.5px] text-ink-2">{t.channel[c]}</div>
              </div>
            </div>
          );
        })}
        {READY.map((c) => {
          const Icon = channelIcon[c];
          return (
            <Hint key={c} text={t.intake.readyNote}>
              <div tabIndex={0} className="preview-outline flex flex-col gap-2 rounded-md px-3.5 py-3 text-ink-3">
                <div className="flex items-center justify-between">
                  <Icon size={17} strokeWidth={1.8} aria-hidden />
                  <span className="text-[10.5px] font-medium">{t.intake.ready}</span>
                </div>
                <div>
                  <div className="tnum text-[24px] leading-none font-semibold">—</div>
                  <div className="mt-1 text-[12.5px]">{t.channel[c]}</div>
                </div>
              </div>
            </Hint>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title={t.intake.stream} meta={num(recent.length)} bodyClassName="p-0">
          {q.data === undefined ? (
            <div className="p-4"><PageLoader className="h-64" /></div>
          ) : (
            <ol className="divide-y divide-seam">
              {recent.map((wo) => {
                const Icon = channelIcon[wo.channel];
                const ai = wo.events.some((e) => e.type === "ai_triage");
                return (
                  <li key={wo.id}>
                    <Link to={`/wo/${wo.id}`} className={cn("grid grid-cols-[70px_minmax(0,1fr)] gap-4 px-4 py-3 hover:bg-sheet-2 md:grid-cols-[70px_minmax(0,1fr)_220px]", wo.story && "crosshair bg-fluoro-wash/40")}>
                      <div>
                        <div className="reading text-[17px] leading-none font-medium text-ink">{time(wo.reportedAt)}</div>
                        <div className="mt-1 text-[10.5px] text-ink-3">{t.intake.firstContact}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[12px] text-ink-2"><Icon size={13} aria-hidden />{t.channel[wo.channel]}</span>
                          <PriorityChip priority={wo.priority} summer={wo.summerUplift} />
                          <LiabilityChip liability={wo.liability} />
                          {ai && <AiTag />}
                        </div>
                        <div className="mt-1 truncate text-[14px] font-medium text-ink">{b(wo.title)}</div>
                        <div className="truncate text-[12.5px] text-ink-3">{woWhere(wo, dir, b, lang)}{wo.reporterName ? ` · ${wo.reporterName}` : ""}</div>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <StaffGauge start={wo.reportedAt} due={wo.responseDueAt} now={now} doneAt={wo.respondedAt} size="sm" />
                        <div className="mt-1 text-[11px] text-ink-3">{t.sla.response}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel title={t.channel.qr_public}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-md border border-seam bg-white p-3">
              <QRCodeSVG value={posterAsset !== undefined ? posterAsset.qrCode : "TSL:QMR:FCU-1402-01"} size={140} fgColor="#16191c" level="M" />
            </div>
            <div className="reading text-[12px] text-ink-2">{posterAsset !== undefined ? `${posterSite !== undefined ? posterSite.code : ""} · ${posterAsset.tag}` : "—"}</div>
            <p className="text-[12.5px] text-ink-3">{t.intake.qrNote}</p>
            <Link to={`/public/${posterAsset !== undefined ? posterAsset.tag : "FCU-1402-01"}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-fluoro-ink hover:underline">
              {t.intake.openPublicForm}<ArrowUpRight size={13} className="rtl:-scale-x-100" />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
