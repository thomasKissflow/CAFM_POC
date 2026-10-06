// Admin → Branding: who this demo is being shown to. Name, logo and colour, saved in Kissflow so the whole
// demo environment follows. Changes preview immediately; Save writes them for everyone.
import { useEffect, useRef, useState } from "react";
import { Check, ImageUp, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useServices } from "@/services/context";
import { useDataSource } from "@/services/source";
import { ACCENT_PRESETS, DEFAULT_ACCENT, getBrand, loadBrand, saveBrand, setBrand, type Brand } from "@/brand/brand";
import { deriveAccent } from "@/brand/color";
import { Button, Field, Input, PageHeader, Panel } from "@/ui/primitives";
import { cn } from "@/ui/cn";

/** Logos arrive at any size; the header needs a small one, and Kissflow stores it as text. */
const LOGO = { maxW: 320, maxH: 80, maxBytes: 60_000 };

async function prepareLogo(file: File): Promise<string> {
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("could not read that file"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("that file is not an image"));
    i.src = data;
  });
  const scale = Math.min(LOGO.maxW / img.width, LOGO.maxH / img.height, 1);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return data;
  ctx.drawImage(img, 0, 0, w, h);
  const png = canvas.toDataURL("image/png");
  // a photographic logo can still be large as a PNG; fall back to JPEG on white
  if (png.length <= LOGO.maxBytes) return png;
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function Branding() {
  const { t, lang } = useI18n();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const services = useServices();
  const src = useDataSource();
  // `saved` is what Kissflow holds; `draft` is what you are trying out. Previewing must not look like saving.
  const [saved, setSaved] = useState<Brand>(() => getBrand());
  const [draft, setDraft] = useState<Brand>(() => getBrand());
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadBrand(services).then((b) => { setSaved(b); setDraft(b); }); }, [services]);
  // preview as you go, held in memory only: a reload comes back to what was saved
  useEffect(() => { setBrand(draft, false); }, [draft]);

  const accent = deriveAccent(draft.accent ?? DEFAULT_ACCENT);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const who = src.user !== undefined ? src.user : "Admin";

  const save = async () => {
    setSaving(true);
    try {
      await saveBrand(services, draft, who);
      setSaved(draft);
      toast.success(L("Branding saved. Everyone opening the app sees it.", "تم حفظ الهوية. سيراها كل من يفتح التطبيق."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const reset = async () => {
    const empty: Brand = {};
    setDraft(empty);
    setSaving(true);
    try { await saveBrand(services, empty, who); setSaved(empty); toast.success(L("Back to the default branding.", "تمت العودة إلى الهوية الافتراضية.")); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const pickLogo = async (f: File | undefined) => {
    if (f === undefined) return;
    try {
      const logo = await prepareLogo(f);
      if (logo.length > LOGO.maxBytes * 1.6) { toast.error(L("That logo is too large. Try a simpler PNG or SVG export.", "الشعار كبير جدًا. جرّب ملف PNG أبسط.")); return; }
      setDraft({ ...draft, logo });
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-6">
      <PageHeader
        title={L("Branding", "الهوية")}
        subtitle={L("Show this demo as the client you are meeting: their name, their logo and their colour. Saved in Kissflow, so every screen and everyone else sees the same.", "اعرض هذا النموذج باسم العميل الذي تقابله: اسمه وشعاره ولونه. يُحفظ في Kissflow لتظهر لدى الجميع.")}
        actions={<>
          <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} disabled={saving} onClick={() => void reset()}>{L("Reset to default", "إعادة التعيين")}</Button>
          <Button variant="primary" size="sm" icon={<Save size={14} />} loading={saving} disabled={saving || !dirty} onClick={() => void save()}>{L("Save", "حفظ")}</Button>
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={L("Client", "العميل")}>
          <div className="flex flex-col gap-4">
            <Field label={L("Company name", "اسم الشركة")} htmlFor="brand-name" hint={L("Replaces the contractor's name across every screen, including the client report.", "يحل محل اسم المقاول في كل الشاشات.")}>
              <Input id="brand-name" value={draft.clientName ?? ""} placeholder={L("e.g. Al Naboodah Construction", "مثال: النابودة للإنشاءات")}
                onChange={(e) => setDraft({ ...draft, clientName: e.target.value })} />
            </Field>

            <Field label={L("Logo", "الشعار")} hint={L("PNG or SVG with a transparent background works best. It is resized to fit the header.", "يفضّل ملف PNG أو SVG بخلفية شفافة.")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-44 items-center justify-center rounded-md border border-dashed border-seam-strong bg-sheet px-3">
                  {draft.logo !== undefined
                    ? <img src={draft.logo} alt="" className="max-h-12 max-w-full object-contain" />
                    : <span className="text-[12px] text-ink-3">{L("No logo", "لا يوجد شعار")}</span>}
                </div>
                <input ref={file} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                  onChange={(e) => void pickLogo(e.target.files?.[0])} />
                <Button variant="secondary" size="sm" icon={<ImageUp size={14} />} onClick={() => file.current?.click()}>
                  {draft.logo !== undefined ? L("Replace", "استبدال") : L("Upload", "رفع")}
                </Button>
                {draft.logo !== undefined && (
                  <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDraft({ ...draft, logo: undefined })}>{L("Remove", "إزالة")}</Button>
                )}
              </div>
            </Field>
          </div>
        </Panel>

        <Panel title={L("Colour", "اللون")} meta={draft.accent ?? DEFAULT_ACCENT}>
          <div className="grid grid-cols-4 gap-2">
            {ACCENT_PRESETS.map((p) => {
              const on = (draft.accent ?? DEFAULT_ACCENT).toLowerCase() === p.hex.toLowerCase();
              return (
                <button key={p.hex} onClick={() => setDraft({ ...draft, accent: p.hex })} title={p.name}
                  className={cn("flex h-16 flex-col items-center justify-center gap-1.5 rounded-md border text-[11px]",
                    on ? "border-ink" : "border-seam hover:border-ink-3")}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: p.hex }}>
                    {on && <Check size={13} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="max-w-full truncate px-1 text-ink-2">{p.name}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field label={L("Their brand colour", "لون العلامة")} htmlFor="brand-hex">
              <Input id="brand-hex" value={draft.accent ?? DEFAULT_ACCENT} spellCheck={false} className="w-40 font-mono"
                onChange={(e) => { const v = e.target.value; setDraft({ ...draft, accent: deriveAccent(v) !== undefined ? v : draft.accent }); }} />
            </Field>
            <input type="color" aria-label={L("Pick a colour", "اختر لونًا")} value={accent?.base ?? DEFAULT_ACCENT}
              onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
              className="h-10 w-12 cursor-pointer rounded-md border border-seam-strong bg-sheet p-1" />
          </div>
          {accent !== undefined && (
            <div className="mt-4">
              <div className="text-[11.5px] text-ink-3">{L("How it will look", "شكلها في التطبيق")}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm">{L("Primary action", "إجراء رئيسي")}</Button>
                <span className="rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium" style={{ background: accent.wash, color: accent.ink }}>DLP: {L("contractor liable", "مسؤولية المقاول")}</span>
                <span className="reading rounded-sm px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: accent.base, color: accent.on }}>P2</span>
                <span className="text-[12.5px]" style={{ color: accent.ink }}>{L("Linked text", "نص مرتبط")}</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <p className="mt-4 text-[12px] text-ink-3">
        {L("The demo buildings, people and figures stay fictional: only the contractor's name, logo and colour change. Add ?brand=generic to the address for a neutral version with no client name at all.",
           "تبقى المباني والأشخاص والأرقام تجريبية: يتغير فقط اسم المقاول وشعاره ولونه.")}
        {t.app.builtOn !== undefined ? "" : ""}
      </p>
    </div>
  );
}
