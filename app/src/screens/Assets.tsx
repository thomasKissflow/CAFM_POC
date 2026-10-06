import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import type { AssetClass } from "@/domain/types";
import { ms } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { Input, LiabilityChip, PageHeader, Select, PageLoader } from "@/ui/primitives";

export default function Assets() {
  const { t, f, b, lang, date, num } = useI18n();
  const now = useNow(60000);
  const dir = useDirectory();
  const [site, setSite] = useState("");
  const [cls, setCls] = useState<AssetClass | "">("");
  const [text, setText] = useState("");
  const q = useQuery((s) => s.assets.list({ siteId: site || undefined, assetClass: cls || undefined, text: text || undefined }), [site, cls, text]);
  const list = q.data ?? [];
  const shown = list.slice(0, 150);

  return (
    <div className="animate-rise">
      <PageHeader title={t.asset.title} subtitle={f(t.asset.count, { count: num(list.length) })} />
      <div className="sheet mb-3 flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.asset.search} className="ps-9" aria-label={t.asset.search} />
        </div>
        <Select value={site} onChange={(e) => setSite(e.target.value)} className="w-auto min-w-44" aria-label={t.request.site}>
          <option value="">{t.chrome.sites}</option>
          {dir?.sites.filter((s) => s.kind !== "plant_yard").map((s) => <option key={s.id} value={s.id}>{b(s.name)}</option>)}
        </Select>
        <Select value={cls} onChange={(e) => setCls(e.target.value as AssetClass | "")} className="w-auto min-w-44" aria-label={t.asset.class}>
          <option value="">{t.chrome.all}</option>
          {(Object.keys(t.assetClass) as AssetClass[]).map((c) => <option key={c} value={c}>{t.assetClass[c]}</option>)}
        </Select>
      </div>
      <div className="sheet overflow-x-auto">
        {q.data === undefined ? <div className="p-4"><PageLoader className="h-64" /></div> : (
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="bg-sheet-2 text-start text-[11.5px] text-ink-3">
              <tr className="seam-b">
                {[t.asset.tag, t.asset.class, t.asset.location, t.asset.installedBy, t.asset.batch, t.asset.dlpEnd].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-seam">
              {shown.map((a) => {
                const inDlp = a.dlpEnd ? ms(a.dlpEnd) >= now : false;
                return (
                  <tr key={a.id} className="hover:bg-sheet-2">
                    <td className="px-4 py-2.5"><Link to={`/assets/${a.id}`} className="reading font-medium text-ink hover:underline hover:decoration-fluoro">{a.tag}</Link></td>
                    <td className="px-4 py-2.5 text-ink-2">{t.assetClass[a.assetClass]}</td>
                    <td className="px-4 py-2.5 text-ink-2">{b(a.location)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{lang === "ar" ? dir?.sub(a.installedBy)?.nameAr : dir?.sub(a.installedBy)?.name}</td>
                    <td className="reading px-4 py-2.5 text-[12px] text-ink-3">{a.batch ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {a.dlpEnd ? <span className="flex items-center gap-2"><LiabilityChip liability={inDlp ? "DLP" : "CHARGEABLE"} /><span className="reading text-[12px] text-ink-3">{date(a.dlpEnd)}</span></span> : <LiabilityChip liability="OWN_OPS" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {list.length > shown.length && <p className="seam-t px-4 py-2 text-[12px] text-ink-3">{num(shown.length)} / {num(list.length)}</p>}
      </div>
    </div>
  );
}
