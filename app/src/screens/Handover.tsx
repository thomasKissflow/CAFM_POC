import { useState } from "react";
import { CheckCircle2, CircleDashed, GripVertical } from "lucide-react";
import type { SnagStatus } from "@/domain/types";
import { useI18n } from "@/i18n";
import { useNow, useQuery, useServices } from "@/services/context";
import { useDirectory, useSiteChoice } from "@/app/lookups";
import { ChainageRuler } from "@/ui/ChainageRuler";
import { PageHeader, Panel, PageLoader, Select } from "@/ui/primitives";
import { cn } from "@/ui/cn";
import { dlpEndOf } from "@/domain/liability";

const COLS: SnagStatus[] = ["open", "in_progress", "ready_for_inspection", "carried_to_dlp"];

export default function Handover() {
  const { t, f, b, lang, date, num } = useI18n();
  const services = useServices();
  const now = useNow(60000);
  const dir = useDirectory();
  const [siteId, setSiteId] = useSiteChoice(dir);
  const pack = useQuery((s) => s.handover.pack(siteId), [siteId]);
  const snags = useQuery((s) => s.handover.snags(siteId), [siteId]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<SnagStatus | null>(null);
  const site = dir?.site(siteId);
  const closed = (snags.data ?? []).filter((s) => s.status === "closed").length;
  // "assets imported" reads from the register itself, so the pack line can never contradict the asset list
  const registerAssets = useQuery((s) => s.assets.list({ siteId }), [siteId]);
  const importedCount = (registerAssets.data ?? []).length;

  return (
    <div className="animate-rise">
      <PageHeader
        title={t.handover.title}
        subtitle={site?.tocDate ? f(t.handover.subtitle, { toc: date(site.tocDate) }) : ""}
        actions={
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-auto" aria-label={t.report.building}>
            {(dir?.sites ?? []).filter((s) => !s.ownOperations).map((s) => <option key={s.id} value={s.id}>{b(s.name)}</option>)}
          </Select>
        }
      />
      {site?.tocDate && (
        <section className="sheet survey-grid mb-4 px-5 pt-4 pb-3">
          {dlpEndOf(site) !== undefined && <ChainageRuler start={site.tocDate} end={dlpEndOf(site)!} now={now} />}
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title={t.handover.pack} meta={importedCount > 0 ? `${num(importedCount)} ${t.handover.assetsImported}` : undefined}>
          {pack.data === undefined ? <PageLoader className="h-64" /> : (
            <ul className="flex flex-col divide-y divide-seam">
              {pack.data.map((p) => {
                // the asset-register line counts the register, not a figure from the demo script
                const count = p.id === "HP-5" ? importedCount : p.count;
                return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  {p.received ? <CheckCircle2 size={17} className="shrink-0 text-ok" aria-label={t.handover.received} /> : <CircleDashed size={17} className="shrink-0 text-risk" aria-label={t.handover.missing} />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] text-ink">{b(p.label)}</span>
                    <span className="block text-[11.5px] text-ink-3">{p.received ? `${t.handover.received}${p.receivedAt ? ` · ${date(p.receivedAt)}` : ""}` : t.handover.missing}</span>
                  </span>
                  {count !== undefined && count > 0 && <span className="reading text-[12.5px] text-ink-2">{num(count)}</span>}
                </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t.handover.snags} meta={`${num(closed)} ${t.handover.closed.toLowerCase()}`} bodyClassName="p-3">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {COLS.map((col) => {
              const items = (snags.data ?? []).filter((s) => s.status === col);
              return (
                <section
                  key={col}
                  onDragOver={(e) => { e.preventDefault(); setOver(col); }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    setOver(null);
                    setDragging(null);
                    if (id) void services.handover.moveSnag(id, col);
                  }}
                  className={cn("flex min-h-40 flex-col rounded-md border bg-ground-2/50 transition-colors", over === col ? "border-fluoro bg-fluoro-wash/40" : "border-seam", col === "carried_to_dlp" && "bg-dlp-wash/30")}
                  aria-label={t.handover[col]}
                >
                  <header className="flex items-center justify-between px-3 py-2">
                    <h3 className="text-[12.5px] font-semibold text-ink">{t.handover[col]}</h3>
                    <span className="reading text-[12px] text-ink-3">{items.length}</span>
                  </header>
                  <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto px-2 pb-2">
                    {items.map((s) => (
                      <article
                        key={s.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", s.id); setDragging(s.id); }}
                        onDragEnd={() => setDragging(null)}
                        className={cn("sheet group cursor-grab p-2.5 active:cursor-grabbing", dragging === s.id && "opacity-40")}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical size={14} className="mt-0.5 shrink-0 text-ink-3 opacity-50 group-hover:opacity-100" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] leading-snug text-ink">{b(s.title)}</div>
                            <div className="mt-0.5 text-[11.5px] text-ink-3">{b(s.location)} · {t.trade[s.trade]}</div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className="reading text-[11px] text-ink-3">{s.ref}</span>
                              <select
                                aria-label="Move"
                                value={s.status}
                                onChange={(e) => void services.handover.moveSnag(s.id, e.target.value as SnagStatus)}
                                className="max-w-28 truncate rounded-sm border border-seam bg-sheet px-1 text-[11px] text-ink-2"
                              >
                                {[...COLS, "closed" as SnagStatus].map((c) => <option key={c} value={c}>{t.handover[c]}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[11.5px] text-ink-3">{lang === "ar" ? "اسحب البطاقات بين الأعمدة: لوحة Kissflow (Case) بحالات حرة." : "Drag cards between columns: a Kissflow Board (Case flow) with free-moving statuses."}</p>
        </Panel>
      </div>
    </div>
  );
}
