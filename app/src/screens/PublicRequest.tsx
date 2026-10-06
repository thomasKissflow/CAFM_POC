import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, QrCode } from "lucide-react";
import type { Category, WorkOrder } from "@/domain/types";
import { useI18n } from "@/i18n";
import { useQuery, useServices } from "@/services/context";
import { Button, Field, Input, Select, Textarea } from "@/ui/primitives";

/** Public request form reached from a QR poster / asset tag. No login. */
export default function PublicRequest() {
  const { tag = "" } = useParams();
  const { t, f, b, time, lang } = useI18n();
  const services = useServices();
  const assetQ = useQuery((s) => (tag ? s.assets.byQr(tag) : Promise.resolve(undefined)), [tag]);
  const asset = assetQ.data;
  const [category, setCategory] = useState<Category>("ac_noise_leak");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<WorkOrder | null>(null);

  if (done) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <CheckCircle2 size={44} className="text-ok" strokeWidth={1.6} />
        <h1 className="text-[22px] font-semibold">{t.request.sent}</h1>
        <p className="text-[14px] text-ink-2">{f(t.request.sentBody, { ref: done.ref, time: time(done.reportedAt) })}</p>
      </div>
    );
  }
  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="text-[22px] font-semibold text-ink">{t.request.title}</h1>
      <div className="flex items-center gap-2 text-[12.5px] text-ink-3"><QrCode size={15} />{t.channel.qr_public}</div>
      {asset !== undefined
        ? <p className="reading mt-1 text-[13px] text-ink-2">{asset.tag} · {b(asset.location)}</p>
        : !assetQ.loading && <p className="mt-2 rounded-md bg-risk-wash px-3 py-2 text-[13px] text-ink">{t.request.tagNotFound}</p>}
      <div className="mt-5 flex flex-col gap-4">
        <Field label={t.request.category} htmlFor="pc">
          <Select id="pc" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {(["ac_not_cooling", "ac_noise_leak", "water_leak", "electrical", "plumbing", "civil_finishes"] as Category[]).map((c) => <option key={c} value={c}>{t.category[c]}</option>)}
          </Select>
        </Field>
        <Field label={t.request.reporter} htmlFor="pn"><Input id="pn" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        <Field label={t.request.describe} htmlFor="pd"><Textarea id="pd" dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.request.describePh} /></Field>
        <Button
          variant="primary" size="lg" loading={sending} disabled={!asset}
          onClick={async () => {
            if (!asset) return;
            setSending(true);
            const wo = await services.workOrders.create({
              siteId: asset.siteId, unitId: asset.unitId, assetId: asset.id, category,
              title: { en: t.category[category], ar: t.category[category] }, description: text || t.category[category],
              descriptionLang: /[؀-ۿ]/.test(text) ? "ar" : lang, channel: "qr_public", reporterName: name || undefined
            }, "public");
            setSending(false);
            setDone(wo);
          }}
        >
          {t.request.submit}
        </Button>
      </div>
    </div>
  );
}
