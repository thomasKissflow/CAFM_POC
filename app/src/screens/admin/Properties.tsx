// Admin → Properties: add a building to the demo estate. The building, its apartments and its assets are written
// to Kissflow, then every screen follows — portfolio, work orders, DLP, the client report.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Check, Factory, HardHat, Home, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AssetClass, Site, SiteKind } from "@/domain/types";
import type { AddedProperty, NewAssetInput, NewUnitInput } from "@/services/types";
import { dlpEndOf } from "@/domain/liability";
import { addMonthsGst, ms, toGst } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useQuery, useServices } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { getBrand } from "@/brand/brand";
import { ASSET_CLASS_META } from "@/services/mock/reference";
import { Button, Field, Input, LiabilityChip, PageHeader, Panel, Select } from "@/ui/primitives";
import { cn } from "@/ui/cn";

const KIND_ICON: Record<SiteKind, typeof Building2> = { residential_tower: Building2, site_office: HardHat, labour_accommodation: Home, plant_yard: Factory };
/** The plant a handed-over tower comes with. One asset each; the fan coils come from the apartments. */
const PLANT: AssetClass[] = ["LIFT", "FIRE_PUMP", "FIRE_ALARM_PANEL", "SPRINKLER_ZONE", "WATER_TANK", "BOOSTER_PUMP", "LV_PANEL", "DG_SET", "CHW_PUMP", "ETS"];
const DEFAULT_PLANT: AssetClass[] = ["LIFT", "FIRE_PUMP", "FIRE_ALARM_PANEL", "WATER_TANK"];
/** Enough for any tower anyone will show in a meeting, and short enough to finish while they watch. */
const MAX_ROWS = 300;

/** "1402" is apartment 02 on floor 14 — the convention the whole demo estate uses. */
const unitNumber = (floor: number, index: number) => `${floor}${String(index + 1).padStart(2, "0")}`;

export default function Properties() {
  const { t, b, lang, date, num } = useI18n();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const services = useServices();
  const now = useNow(60000);
  const dir = useDirectory();
  const assetsQ = useQuery((s) => s.assets.list(), []);
  const unitsSoFar = useQuery(async (s) => {
    const sites = await s.directory.sites();
    const lists = await Promise.all(sites.map((x) => s.directory.units(x.id)));
    return new Map(sites.map((x, i) => [x.id, lists[i].length]));
  }, []);

  const today = toGst(now).slice(0, 10);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [code, setCode] = useState("");
  const [district, setDistrict] = useState("");
  const [kind, setKind] = useState<SiteKind>("residential_tower");
  const [client, setClient] = useState(() => getBrand().clientName ?? "");
  const [ownOps, setOwnOps] = useState(false);
  const [toc, setToc] = useState(today);
  const [dlpMonths, setDlpMonths] = useState(12);
  const [fromFloor, setFromFloor] = useState(1);
  const [toFloor, setToFloor] = useState(8);
  const [perFloor, setPerFloor] = useState(4);
  const [fcu, setFcu] = useState(true);
  const [plant, setPlant] = useState<AssetClass[]>(DEFAULT_PLANT);
  const [installedBy, setInstalledBy] = useState("");
  const [busy, setBusy] = useState<{ done: number; total: number } | undefined>(undefined);
  const [added, setAdded] = useState<AddedProperty | undefined>(undefined);
  const [removing, setRemoving] = useState<string | undefined>(undefined);
  const [confirm, setConfirm] = useState<string | undefined>(undefined);

  // the code is the key the estate joins on; it follows the name until you type one of your own
  const autoCode = nameEn.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  const siteCode = (code !== "" ? code : autoCode).toUpperCase();

  const units: NewUnitInput[] = useMemo(() => {
    if (ownOps || kind !== "residential_tower") return [];
    const out: NewUnitInput[] = [];
    for (let floor = Math.max(1, fromFloor); floor <= Math.max(fromFloor, toFloor); floor++) {
      for (let i = 0; i < Math.max(0, perFloor); i++) out.push({ number: unitNumber(floor, i), floor });
    }
    return out;
  }, [fromFloor, toFloor, perFloor, ownOps, kind]);

  const assets: NewAssetInput[] = useMemo(() => {
    const handoverDate = ownOps ? undefined : `${toc}T00:00:00+04:00`;
    const out: NewAssetInput[] = [];
    if (fcu) {
      for (const u of units) {
        out.push({
          tag: `FCU-${u.number}-01`, assetClass: "FCU", floor: u.floor, unitNumber: u.number,
          location: { en: `Apartment ${u.number}`, ar: `شقة ${u.number}` },
          ...(installedBy !== "" ? { installedBy } : {}), ...(handoverDate !== undefined ? { handoverDate } : {})
        });
      }
    }
    for (const cls of plant) {
      out.push({
        tag: `${cls.replace(/_/g, "-")}-01`, assetClass: cls, floor: 0,
        location: ASSET_CLASS_META[cls].label,
        ...(installedBy !== "" ? { installedBy } : {}), ...(handoverDate !== undefined ? { handoverDate } : {})
      });
    }
    return out;
  }, [units, fcu, plant, installedBy, toc, ownOps]);

  const rows = 1 + units.length + assets.length;
  const codeTaken = (dir?.sites ?? []).some((s) => s.code === siteCode);
  const problem = nameEn.trim() === "" ? L("Give the building a name.", "أدخل اسم المبنى.")
    : siteCode.length < 2 ? L("The code needs at least two letters.", "يحتاج الرمز إلى حرفين على الأقل.")
    : codeTaken ? L(`${siteCode} is already a building here.`, `الرمز ${siteCode} مستخدم بالفعل.`)
    : rows > MAX_ROWS ? L(`That is ${num(rows)} records. Keep it under ${num(MAX_ROWS)}.`, `هذا ${num(rows)} سجل. اجعله أقل من ${num(MAX_ROWS)}.`)
    : undefined;

  const create = async () => {
    setBusy({ done: 0, total: rows });
    try {
      const result = await services.estate.addProperty({
        site: {
          code: siteCode, name: { en: nameEn.trim(), ar: nameAr.trim() !== "" ? nameAr.trim() : nameEn.trim() },
          district: { en: district.trim(), ar: district.trim() }, kind, client: { en: client.trim(), ar: client.trim() },
          ownOperations: ownOps,
          ...(ownOps ? {} : { tocDate: `${toc}T00:00:00+04:00`, dlpMonths }),
          ...(units.length > 0 ? { floors: Math.max(fromFloor, toFloor), unitCount: units.length } : {})
        },
        units, assets
      }, (done, total) => setBusy({ done, total }));
      setAdded(result);
      toast.success(L(`${result.site.name.en} is in the estate.`, `تمت إضافة ${result.site.name.en}.`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setBusy(undefined); }
  };

  const reset = () => {
    setAdded(undefined); setNameEn(""); setNameAr(""); setCode(""); setDistrict("");
  };

  const remove = async (s: Site) => {
    setRemoving(s.id);
    try {
      await services.estate.removeProperty(s.id);
      toast.success(L(`${s.name.en} removed.`, `تمت إزالة ${s.name.en}.`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setRemoving(undefined); setConfirm(undefined); }
  };

  const card = (s: Site) => {
    const Icon = KIND_ICON[s.kind];
    const end = dlpEndOf(s);
    const assetCount = (assetsQ.data ?? []).filter((a) => a.siteId === s.id).length;
    const unitCount = unitsSoFar.data?.get(s.id) ?? 0;
    return (
      <li key={s.id} className="flex items-start gap-3 py-3">
        <Icon size={17} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium text-ink">{b(s.name)}</span>
            <span className="reading rounded-sm border border-seam-strong px-1 text-[11px] text-ink-2">{s.code}</span>
            {s.ownOperations ? <LiabilityChip liability="OWN_OPS" /> : end !== undefined && ms(end) > now ? <LiabilityChip liability="DLP" /> : <LiabilityChip liability="CHARGEABLE" />}
          </div>
          <div className="text-[11.5px] text-ink-3">
            {t.portfolio[s.kind]}
            {unitCount > 0 ? ` · ${num(unitCount)} ${L("apartments", "شقة")}` : ""}
            {assetCount > 0 ? ` · ${num(assetCount)} ${L("assets", "أصل")}` : ""}
            {end !== undefined ? ` · ${L("DLP to", "المسؤولية حتى")} ${date(end)}` : ""}
          </div>
          {confirm === s.id && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-ink-2">{L("Remove it and everything under it?", "إزالة المبنى وكل ما تحته؟")}</span>
              <Button variant="danger" size="sm" loading={removing === s.id} onClick={() => void remove(s)}>{L("Remove", "إزالة")}</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(undefined)}>{L("Keep it", "الاحتفاظ به")}</Button>
            </div>
          )}
        </div>
        {confirm !== s.id && (
          <button onClick={() => setConfirm(s.id)} className="shrink-0 rounded-sm p-1 text-ink-3 hover:bg-ink/5 hover:text-breach" aria-label={L(`Remove ${s.name.en}`, `إزالة ${s.name.en}`)}>
            <Trash2 size={14} aria-hidden />
          </button>
        )}
      </li>
    );
  };

  if (added !== undefined) {
    const end = dlpEndOf(added.site);
    return (
      <div className="mx-auto max-w-[760px] px-4 py-5 md:px-6">
        <PageHeader title={L("Property added", "تمت إضافة المبنى")} subtitle={L("It is in Kissflow, and every screen is already showing it.", "تمت الإضافة إلى Kissflow وتظهر في كل الشاشات.")} />
        <Panel title={b(added.site.name)} meta={added.site.code}>
          <dl className="grid grid-cols-3 gap-4 border-b border-seam pb-4">
            <div><dt className="text-[11.5px] text-ink-3">{t.portfolio.units}</dt><dd className="tnum text-[20px] font-semibold">{num(added.units.length)}</dd></div>
            <div><dt className="text-[11.5px] text-ink-3">{t.nav.assets}</dt><dd className="tnum text-[20px] font-semibold">{num(added.assets.length)}</dd></div>
            <div><dt className="text-[11.5px] text-ink-3">{L("Defects liability", "فترة المسؤولية")}</dt><dd className="text-[14px] font-medium">{end !== undefined ? date(end) : "—"}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/portfolio"><Button variant="secondary" size="sm">{t.nav.portfolio}</Button></Link>
            <Link to="/assets"><Button variant="secondary" size="sm">{t.nav.assets}</Button></Link>
            <Link to="/intake"><Button variant="secondary" size="sm">{t.request.helpdeskTitle}</Button></Link>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={reset}>{L("Add another", "إضافة مبنى آخر")}</Button>
          </div>
          <p className="mt-4 text-[12px] text-ink-3">
            {L("The handover pack starts empty for a new building: that is the contractor's documents still outstanding, and it is what the Handover screen chases.",
               "يبدأ ملف التسليم فارغًا للمبنى الجديد: هذه مستندات المقاول المتبقية، وهي ما تتابعه شاشة التسليم.")}
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-6">
      <PageHeader
        title={L("Properties", "المباني")}
        subtitle={L("Add the building you are talking about. It is written to Kissflow, so the portfolio, work orders, liability and the client report all follow.",
                    "أضف المبنى الذي تتحدث عنه. يُكتب في Kissflow لتتبعه كل الشاشات.")}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <Panel title={L("New building", "مبنى جديد")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={L("Name", "الاسم")} htmlFor="p-name">
              <Input id="p-name" value={nameEn} placeholder={L("e.g. Marsa Heights", "مثال: مرسى هايتس")} onChange={(e) => setNameEn(e.target.value)} />
            </Field>
            <Field label={L("Name in Arabic", "الاسم بالعربية")} htmlFor="p-name-ar" hint={L("Optional; the English name is used if blank.", "اختياري.")}>
              <Input id="p-name-ar" value={nameAr} dir="rtl" onChange={(e) => setNameAr(e.target.value)} />
            </Field>
            <Field label={L("Code", "الرمز")} htmlFor="p-code" hint={L("Short key the asset tags and QR codes use.", "مفتاح قصير تستخدمه الأصول ورموز QR.")}>
              <Input id="p-code" value={siteCode} className="reading w-32 uppercase" maxLength={5} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} />
            </Field>
            <Field label={L("District", "المنطقة")} htmlFor="p-district">
              <Input id="p-district" value={district} placeholder={L("e.g. Dubai Marina", "مثال: دبي مارينا")} onChange={(e) => setDistrict(e.target.value)} />
            </Field>
            <Field label={L("Kind", "النوع")} htmlFor="p-kind">
              <Select id="p-kind" value={kind} onChange={(e) => setKind(e.target.value as SiteKind)}>
                {(Object.keys(KIND_ICON) as SiteKind[]).map((k) => <option key={k} value={k}>{t.portfolio[k]}</option>)}
              </Select>
            </Field>
            <Field label={L("Client", "العميل")} htmlFor="p-client" hint={L("Who owns it. Defaults to the client in Branding.", "المالك. يأخذ العميل من شاشة الهوية.")}>
              <Input id="p-client" value={client} onChange={(e) => setClient(e.target.value)} />
            </Field>
          </div>

          <label className="mt-4 flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={ownOps} onChange={(e) => setOwnOps(e.target.checked)} />
            {L("Our own facility (site office, camp, yard) — never under defects liability", "منشأة خاصة بنا (مكتب موقع، سكن عمال، ساحة) — خارج فترة المسؤولية")}
          </label>

          {!ownOps && (
            <div className="mt-4 grid gap-4 border-t border-seam pt-4 md:grid-cols-2">
              <Field label={L("Handed over on", "تاريخ التسليم")} htmlFor="p-toc" hint={L("The taking-over certificate. This starts the liability clock.", "شهادة الاستلام، وهي بداية فترة المسؤولية.")}>
                <Input id="p-toc" type="date" value={toc} className="reading" onChange={(e) => setToc(e.target.value)} />
              </Field>
              <Field label={L("Defects liability", "مدة المسؤولية")} htmlFor="p-dlp" hint={toc !== "" ? `${L("Ends", "تنتهي")} ${date(addMonthsGst(`${toc}T00:00:00+04:00`, dlpMonths))}` : undefined}>
                <Select id="p-dlp" value={String(dlpMonths)} onChange={(e) => setDlpMonths(Number(e.target.value))} className="w-40">
                  {[6, 12, 18, 24, 36].map((m) => <option key={m} value={m}>{num(m)} {L("months", "شهرًا")}</option>)}
                </Select>
              </Field>
            </div>
          )}
        </Panel>

        <Panel title={L("Buildings you have", "المباني الحالية")} meta={num((dir?.sites ?? []).length)}>
          <ul className="flex flex-col divide-y divide-seam">{(dir?.sites ?? []).map(card)}</ul>
          <p className="mt-3 text-[11.5px] text-ink-3">
            {L("Removing a building deletes its apartments and assets from Kissflow. A building with work orders against it cannot be removed.",
               "إزالة المبنى تحذف شققه وأصوله من Kissflow. لا يمكن إزالة مبنى عليه أوامر عمل.")}
          </p>
        </Panel>
      </div>

      {kind === "residential_tower" && !ownOps && (
        <Panel className="mt-4" title={L("Apartments and assets", "الشقق والأصول")}>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label={L("Lowest floor", "أدنى طابق")} htmlFor="p-from">
              <Input id="p-from" type="number" min={1} max={120} value={fromFloor} className="reading" onChange={(e) => setFromFloor(Number(e.target.value))} />
            </Field>
            <Field label={L("Highest floor", "أعلى طابق")} htmlFor="p-to">
              <Input id="p-to" type="number" min={1} max={120} value={toFloor} className="reading" onChange={(e) => setToFloor(Number(e.target.value))} />
            </Field>
            <Field label={L("Apartments per floor", "شقق في كل طابق")} htmlFor="p-per">
              <Input id="p-per" type="number" min={0} max={12} value={perFloor} className="reading" onChange={(e) => setPerFloor(Number(e.target.value))} />
            </Field>
            <Field label={L("Installed by", "نفّذها")} htmlFor="p-sub" hint={L("Drives the back-charge when a fault is their defect.", "تحدد المقاول عند تحميل تكلفة العيب.")}>
              <Select id="p-sub" value={installedBy} onChange={(e) => setInstalledBy(e.target.value)}>
                <option value="">—</option>
                {(dir?.subs ?? []).map((s) => <option key={s.id} value={s.id}>{lang === "ar" ? s.nameAr : s.name}</option>)}
              </Select>
            </Field>
          </div>

          <label className="mt-4 flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={fcu} onChange={(e) => setFcu(e.target.checked)} />
            {L("Fit every apartment with a fan coil unit", "تركيب وحدة ملف مروحة في كل شقة")}
          </label>

          <div className="mt-4">
            <div className="text-[11.5px] text-ink-3">{L("Plant in the building", "معدات المبنى")}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLANT.map((cls) => {
                const on = plant.includes(cls);
                return (
                  <button
                    key={cls}
                    onClick={() => setPlant(on ? plant.filter((x) => x !== cls) : [...plant, cls])}
                    className={cn("flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[12px]",
                      on ? "border-fluoro-edge bg-fluoro-wash text-fluoro-ink" : "border-seam-strong text-ink-2 hover:border-ink-3")}
                  >
                    {on && <Check size={12} strokeWidth={3} aria-hidden />}
                    {b(ASSET_CLASS_META[cls].label)}
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>
      )}

      <div className="sheet mt-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="text-[13px] text-ink-2">
          {busy !== undefined
            ? <span className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" aria-hidden />{L(`Writing to Kissflow — ${num(busy.done)} of ${num(busy.total)}`, `جارٍ الكتابة في Kissflow — ${num(busy.done)} من ${num(busy.total)}`)}</span>
            : problem !== undefined
              ? <span className="text-breach">{problem}</span>
              : L(`Creates 1 building, ${num(units.length)} apartments and ${num(assets.length)} assets.`,
                  `سيُنشئ مبنى واحدًا و${num(units.length)} شقة و${num(assets.length)} أصلًا.`)}
          {!services.estate.persists && busy === undefined && (
            <span className="ms-2 text-ink-3">{L("· Demo data: this one lasts until you reload.", "· بيانات تجريبية: تبقى حتى إعادة التحميل.")}</span>
          )}
        </div>
        <Button variant="primary" icon={<Plus size={15} />} loading={busy !== undefined} disabled={busy !== undefined || problem !== undefined} onClick={() => void create()}>
          {L("Add property", "إضافة المبنى")}
        </Button>
      </div>
    </div>
  );
}
