import { Link } from "react-router-dom";
import { Building2, Factory, HardHat, Home } from "lucide-react";
import type { Site } from "@/domain/types";
import { dlpEndOf } from "@/domain/liability";
import { ms } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { ChainageRuler } from "@/ui/ChainageRuler";
import { LiabilityChip, PageHeader, PageLoader } from "@/ui/primitives";

const KIND_ICON = { residential_tower: Building2, site_office: HardHat, labour_accommodation: Home, plant_yard: Factory };

export default function Portfolio() {
  const { t, b, num } = useI18n();
  const now = useNow(60000);
  const sites = useQuery((s) => s.directory.sites(), []);
  const wos = useQuery((s) => s.workOrders.list({ open: true }), []);
  const assets = useQuery((s) => s.assets.list(), []);
  const open = (id: string) => (wos.data ?? []).filter((w) => w.siteId === id).length;
  const assetCount = (id: string) => (assets.data ?? []).filter((a) => a.siteId === id).length;
  const client = (sites.data ?? []).filter((s) => !s.ownOperations);
  const own = (sites.data ?? []).filter((s) => s.ownOperations);

  const card = (s: Site) => {
    const Icon = KIND_ICON[s.kind];
    const dlpEnd = dlpEndOf(s);
    return (
      <article key={s.id} className="sheet flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-ink-3"><Icon size={14} aria-hidden />{t.portfolio[s.kind]} · {b(s.district)}</div>
            <h3 className="mt-1 text-[19px] font-semibold text-ink">{b(s.name)}</h3>
            <p className="text-[12.5px] text-ink-2">{b(s.client)}</p>
          </div>
          {s.ownOperations ? <LiabilityChip liability="OWN_OPS" long /> : dlpEnd && ms(dlpEnd) > now ? <LiabilityChip liability="DLP" long /> : <LiabilityChip liability="CHARGEABLE" />}
        </div>
        <dl className="grid grid-cols-3 gap-3 border-t border-seam pt-3">
          <div><dt className="text-[11.5px] text-ink-3">{s.beds ? t.portfolio.beds : t.portfolio.units}</dt><dd className="tnum text-[18px] font-semibold">{s.beds ? num(s.beds) : s.unitCount ? num(s.unitCount) : "—"}</dd></div>
          <div><dt className="text-[11.5px] text-ink-3">{t.nav.assets}</dt><dd className="tnum text-[18px] font-semibold">{num(assetCount(s.id))}</dd></div>
          <div><dt className="text-[11.5px] text-ink-3">{t.portfolio.openJobs}</dt><dd className="tnum text-[18px] font-semibold"><Link to="/queue" className="hover:text-fluoro-ink">{num(open(s.id))}</Link></dd></div>
        </dl>
        {s.tocDate && dlpEnd && <ChainageRuler start={s.tocDate} end={dlpEnd} now={now} compact />}
        {s.ownOperations && <p className="text-[12px] text-ink-3">{t.portfolio.internal}</p>}
      </article>
    );
  };

  return (
    <div className="animate-rise">
      <PageHeader title={t.portfolio.title} subtitle={t.portfolio.subtitle} />
      {sites.data === undefined ? <PageLoader className="h-96" /> : (
        <>
          <h2 className="mb-3 text-[14px] font-semibold text-ink">{t.portfolio.clientBuildings}</h2>
          <div className="mb-8 grid gap-4 lg:grid-cols-2">{client.map(card)}</div>
          <h2 className="text-[14px] font-semibold text-ink">{t.portfolio.ownOps}</h2>
          <p className="mb-3 text-[12.5px] text-ink-3">{t.portfolio.ownOpsNote}</p>
          <div className="grid gap-4 lg:grid-cols-3">{own.map(card)}</div>
        </>
      )}
    </div>
  );
}
