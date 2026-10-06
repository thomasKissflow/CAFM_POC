import { useState } from "react";
import { Link } from "react-router-dom";
import type { BackCharge } from "@/domain/types";
import { useI18n } from "@/i18n";
import { useNow, useQuery, useServices } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { ROLE_PERSON, useSession } from "@/app/session";
import { ChainageRuler } from "@/ui/ChainageRuler";
import { Button, Ledger, PageHeader, Panel, Segmented, Skeleton } from "@/ui/primitives";
import { cn } from "@/ui/cn";
import { dlpEndOf } from "@/domain/liability";
import { ms } from "@/domain/time";

const statusStyle: Record<BackCharge["status"], string> = {
  issued: "border border-seam-strong text-ink-2",
  accepted: "bg-sheet-2 text-ink border border-seam-strong",
  disputed: "bg-risk-wash text-risk border border-risk/40",
  recovered: "bg-ok-wash text-ok border border-ok/30"
};

export default function Dlp() {
  const { t, b, lang, aed, num, dateShort } = useI18n();
  const services = useServices();
  const now = useNow(60000);
  const dir = useDirectory();
  const { role } = useSession();
  const me = dir?.person(ROLE_PERSON[role]);
  const subScope = role === "subcon_supervisor" ? me?.subcontractorId : undefined;
  const [status, setStatus] = useState<BackCharge["status"] | "all">("all");
  const sQ = useQuery((s) => s.dlp.summary(), []);
  const bQ = useQuery((s) => s.dlp.backCharges({ subcontractorId: subScope, status: status === "all" ? undefined : status }), [subScope, status]);
  const wQ = useQuery((s) => s.workOrders.list({ liability: "DLP" }), []);
  const s = sQ.data;
  const list = (bQ.data ?? []).slice(0, 60);
  const maxSub = Math.max(1, ...(s?.bySubcontractor.map((x) => x.recoveredAed + x.pendingAed) ?? [1]));
  const woRef = (id: string) => wQ.data?.find((w) => w.id === id);
  // every handed-over building, the one expiring soonest first; expired ones keep their place at the end
  const handed = (dir?.sites ?? [])
    .filter((x) => !x.ownOperations && x.tocDate !== undefined && dlpEndOf(x) !== undefined)
    .sort((a, b) => {
      const [ea, eb] = [ms(dlpEndOf(a)!), ms(dlpEndOf(b)!)];
      const [la, lb] = [ea > now ? 0 : 1, eb > now ? 0 : 1];
      return la !== lb ? la - lb : ea - eb;
    })
    .slice(0, 5);
  const subName = (id: string) => (lang === "ar" ? dir?.sub(id)?.nameAr : dir?.sub(id)?.name) ?? id;

  return (
    <div className="animate-rise">
      <PageHeader title={t.dlp.title} subtitle={t.dlp.subtitle} />

      <section className="sheet mb-4 grid gap-6 px-5 py-4 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        {s ? (
          <>
            <Ledger size="xl" tone="fluoro" value={aed(s.recoveredYtdAed)} label={t.command.recovered} sub={t.command.recoveredYtd} />
            <Ledger size="md" value={aed(s.pendingRecoveryAed)} label={t.command.pending} />
            <Ledger size="md" tone="risk" value={aed(s.disputedAed)} label={t.command.disputed} />
            <Ledger size="md" value={num(s.openDlpJobs)} label={t.command.openDlp} />
          </>
        ) : <Skeleton className="h-16 md:col-span-4" />}
      </section>

      <Panel className="mb-4" title={t.dlp.chainage}>
        <div className="flex flex-col gap-6">
          {handed.length === 0
            ? <p className="text-[12.5px] text-ink-3">{t.dlp.noneHandedOver}</p>
            : handed.map((x) => <ChainageRuler key={x.id} title={b(x.name)} start={x.tocDate!} end={dlpEndOf(x)!} now={now} compact />)}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel title={t.dlp.bySub}>
          <ul className="flex flex-col gap-3.5">
            {s?.bySubcontractor.map((r) => (
              <li key={r.subcontractorId}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium text-ink">{subName(r.subcontractorId)}</span>
                  <span className="tnum text-ink-2">{aed(r.recoveredAed + r.pendingAed)}</span>
                </div>
                <div className="mt-1.5 flex h-2 gap-[2px]" role="img" aria-label={`${aed(r.recoveredAed)} recovered, ${aed(r.pendingAed)} pending`}>
                  <div className="rounded-s-[2px] bg-fluoro" style={{ width: `${(r.recoveredAed / maxSub) * 100}%` }} />
                  <div className="rounded-e-[2px] bg-ink-3/40" style={{ width: `${(r.pendingAed / maxSub) * 100}%` }} />
                </div>
                <div className="mt-1 text-[11.5px] text-ink-3">{num(r.jobs)} {t.dlp.jobs}</div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-4 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 bg-fluoro" />{t.dlp.status_recovered}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 bg-ink-3/40" />{t.command.pending}</span>
          </div>
        </Panel>

        <Panel
          title={t.dlp.register}
          bodyClassName="p-0"
          actions={
            <Segmented<BackCharge["status"] | "all">
              label={t.dlp.register}
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: t.chrome.all },
                { value: "issued", label: t.dlp.status_issued },
                { value: "disputed", label: t.dlp.status_disputed },
                { value: "recovered", label: t.dlp.status_recovered }
              ]}
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-sheet-2 text-[11.5px] text-ink-3">
                <tr className="seam-b">
                  {["Ref", t.dlp.workOrder, t.dlp.subcontractor, t.dlp.rootCause, t.dlp.amount, t.dlp.issued, ""].map((h, i) => <th key={i} className="px-4 py-2 text-start font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-seam">
                {list.map((bc, i) => {
                  const wo = woRef(bc.workOrderId);
                  const fresh = i === 0 && wo?.story;
                  return (
                    <tr key={bc.id} className={cn("hover:bg-sheet-2", fresh && "crosshair bg-dlp-wash/50")}>
                      <td className="reading px-4 py-2.5 text-[12px] text-ink">{bc.ref}</td>
                      <td className="px-4 py-2.5">
                        {wo ? <Link to={`/wo/${wo.id}`} className="hover:underline"><span className="reading text-[12px] text-ink-3">{wo.ref}</span> <span className="text-ink">{b(wo.title)}</span></Link> : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{subName(bc.subcontractorId)}</td>
                      <td className="px-4 py-2.5 text-ink-2">{t.rootCause[bc.rootCause]}</td>
                      <td className="tnum px-4 py-2.5 text-end font-medium text-ink">{aed(bc.partsAed + bc.labourAed)}</td>
                      <td className="reading px-4 py-2.5 text-[12px] text-ink-3">{dateShort(bc.issuedAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn("rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap", statusStyle[bc.status])}>{t.dlp[`status_${bc.status}`]}</span>
                          {role === "dlp_manager" && (bc.status === "accepted" || bc.status === "issued") && (
                            <Button size="sm" variant="ghost" onClick={() => void services.dlp.setBackChargeStatus(bc.id, "recovered", ROLE_PERSON[role])}>{t.dlp.markRecovered}</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
