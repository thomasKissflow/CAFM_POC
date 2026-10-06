import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import type { Liability, Priority, WoStatus, WorkOrder } from "@/domain/types";
import { readSla } from "@/domain/sla";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { ROLE_PERSON, useSession } from "@/app/session";
import { Button, Empty, Input, LiabilityChip, PageHeader, PriorityChip, Segmented, Select, Skeleton } from "@/ui/primitives";
import { StaffGauge } from "@/ui/StaffGauge";
import { cn } from "@/ui/cn";
import { WoRow, woWhere } from "./shared";

export default function Queue() {
  const { t, b, lang, num } = useI18n();
  const now = useNow(1000);
  const dir = useDirectory();
  const { role } = useSession();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "board" ? "board" : "list";
  const [state, setState] = useState<"open" | "closed">("open");
  const [site, setSite] = useState("");
  const [liability, setLiability] = useState<Liability | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [text, setText] = useState("");
  const me = dir?.person(ROLE_PERSON[role]);
  const subScope = role === "subcon_supervisor" ? me?.subcontractorId : undefined;

  const q = useQuery(
    (s) => s.workOrders.list({
      open: view === "board" ? true : state === "open",
      siteId: site || undefined,
      liability: liability || undefined,
      priority: priority || undefined,
      subcontractorId: subScope,
      text: text || undefined,
      limit: state === "closed" ? 80 : undefined
    }),
    [view, state, site, liability, priority, text, subScope]
  );

  const sorted = useMemo(() => {
    const list = q.data ?? [];
    if (state === "closed" && view === "list") return list;
    return [...list].sort((a, b2) => readSla(a.reportedAt, a.resolveDueAt, now).remainingMs - readSla(b2.reportedAt, b2.resolveDueAt, now).remainingMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, state, view]);

  const title = subScope && dir ? `${t.queue.title} · ${lang === "ar" ? dir.sub(subScope)?.nameAr : dir.sub(subScope)?.name}` : t.queue.title;

  return (
    <div className="animate-rise">
      <PageHeader
        title={title}
        actions={
          <>
            <Segmented
              label={t.queue.title}
              value={view}
              onChange={(v) => setParams(v === "board" ? { view: "board" } : {})}
              options={[{ value: "list", label: t.queue.list }, { value: "board", label: t.queue.board }]}
            />
            {(role === "helpdesk" || role === "fm_manager") && (
              <Link to="/request/new"><Button variant="primary" icon={<Plus size={15} aria-hidden />}>{t.nav.newRequest}</Button></Link>
            )}
          </>
        }
      />

      <div className="sheet mb-3 flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.chrome.search} className="ps-9" aria-label={t.chrome.search} />
        </div>
        {view === "list" && (
          <Segmented label="state" value={state} onChange={setState} options={[{ value: "open", label: t.queue.open }, { value: "closed", label: t.queue.closed }]} />
        )}
        <Select value={site} onChange={(e) => setSite(e.target.value)} className="w-auto min-w-40" aria-label={t.request.site}>
          <option value="">{t.chrome.sites}</option>
          {dir?.sites.filter((s) => s.kind !== "plant_yard").map((s) => <option key={s.id} value={s.id}>{b(s.name)}</option>)}
        </Select>
        <Select value={liability} onChange={(e) => setLiability(e.target.value as Liability | "")} className="w-auto min-w-36" aria-label={t.wo.liabilityBanner}>
          <option value="">{t.queue.allLiability}</option>
          {(["DLP", "CHARGEABLE", "DECENNIAL_REVIEW", "OWN_OPS"] as Liability[]).map((l) => <option key={l} value={l}>{t.liabilityShort[l]}</option>)}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} className="w-auto min-w-32" aria-label="Priority">
          <option value="">{t.queue.allPriority}</option>
          {(["P1", "P2", "P3", "P4"] as Priority[]).map((p) => <option key={p} value={p}>{t.priority[p]}</option>)}
        </Select>
      </div>

      {q.data === undefined ? (
        <div className="sheet flex flex-col gap-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="sheet"><Empty title={t.queue.empty} hint={t.queue.emptyHint} /></div>
      ) : view === "list" ? (
        <div className="sheet overflow-hidden">
          <div className="seam-b hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(180px,1fr)] gap-4 bg-sheet-2 px-4 py-2 text-[11.5px] font-medium text-ink-3 lg:grid">
            <span>{t.queue.what}</span><span>{t.queue.who}</span><span>{t.queue.clock}</span>
          </div>
          <div className="divide-y divide-seam">
            {sorted.map((wo) => <WoRow key={wo.id} wo={wo} dir={dir} now={now} />)}
          </div>
          <div className="seam-t px-4 py-2 text-[12px] text-ink-3">{num(sorted.length)}</div>
        </div>
      ) : (
        renderBoard(sorted, now)
      )}
    </div>
  );

  function renderBoard(list: WorkOrder[], at: number) {
    const cols: WoStatus[] = ["assigned", "accepted", "in_progress", "on_hold"];
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cols.map((c) => {
          const items = list.filter((w) => w.status === c || (c === "assigned" && w.status === "new"));
          return (
            <section key={c} className="flex min-w-0 flex-col rounded-md border border-seam bg-ground-2/60">
              <header className="flex items-center justify-between px-3 py-2">
                <h2 className="text-[13px] font-semibold text-ink">{t.status[c]}</h2>
                <span className="reading text-[12px] text-ink-3">{items.length}</span>
              </header>
              <div className="flex flex-col gap-2 px-2 pb-2">
                {items.map((wo) => {
                  const r = readSla(wo.reportedAt, wo.resolveDueAt, at);
                  return (
                    <Link key={wo.id} to={`/wo/${wo.id}`} className={cn("sheet relative block overflow-hidden p-3 transition-shadow hover:shadow-[var(--shadow-lift)]", r.phase === "breached" && "border-breach/50")}>
                      {r.phase === "breached" && <div className="hazard absolute inset-x-0 top-0 h-1" aria-hidden />}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="reading text-[11.5px] text-ink-3">{wo.ref}</span>
                        <PriorityChip priority={wo.priority} summer={wo.summerUplift} />
                        <LiabilityChip liability={wo.liability} />
                      </div>
                      <div className="mt-1.5 text-[13.5px] leading-snug font-medium text-ink">{b(wo.title)}</div>
                      <div className="text-[12px] text-ink-3">{woWhere(wo, dir, b, lang)}</div>
                      <StaffGauge className="mt-2.5" start={wo.reportedAt} due={wo.resolveDueAt} now={at} size="sm" />
                    </Link>
                  );
                })}
                {items.length === 0 && <p className="px-2 py-6 text-center text-[12.5px] text-ink-3">—</p>}
              </div>
            </section>
          );
        })}
      </div>
    );
  }
}
