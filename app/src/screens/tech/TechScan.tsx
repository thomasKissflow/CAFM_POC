import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CameraOff, History, Search } from "lucide-react";
import type { Asset, WorkOrder } from "@/domain/types";
import { ms } from "@/domain/time";
import { useI18n } from "@/i18n";
import { useNow, useServices } from "@/services/context";
import { useDirectory } from "@/app/lookups";
import { MobileTabBar } from "@/app/Shell";
import { Button, Input, LiabilityChip, StatusChip } from "@/ui/primitives";

interface Detector { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }
declare global {
  interface Window { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }
}

export default function TechScan() {
  const { t, b, lang, date, dateShort } = useI18n();
  const services = useServices();
  const navigate = useNavigate();
  const now = useNow(60000);
  const dir = useDirectory();
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [tag, setTag] = useState("");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [jobs, setJobs] = useState<WorkOrder[]>([]);
  const [notFound, setNotFound] = useState(false);

  const lookup = async (code: string) => {
    const a = await services.assets.byQr(code);
    if (a === undefined) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setAsset(a);
    setJobs(await services.assets.history(a.id));
    if (navigator.vibrate) navigator.vibrate(40);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let timer = 0;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stop || video.current === null) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera("on");
        if (window.BarcodeDetector) {
          const det = new window.BarcodeDetector({ formats: ["qr_code"] });
          const tick = async () => {
            if (stop || video.current === null) return;
            try {
              const found = await det.detect(video.current);
              if (found[0]) {
                await lookup(found[0].rawValue);
                return;
              }
            } catch { /* keep scanning */ }
            timer = window.setTimeout(tick, 350);
          };
          void tick();
        }
      } catch {
        setCamera("off");
      }
    })();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openJob = jobs.find((j) => j.status !== "closed" && j.status !== "resolved" && j.status !== "cancelled");
  const inDlp = asset?.dlpEnd ? ms(asset.dlpEnd) >= now : false;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 pt-4 pb-6">
        <h1 className="text-[22px] font-semibold text-ink">{t.tech.scanTitle}</h1>
        {!asset && (
          <>
            <div className="relative mt-4 aspect-square overflow-hidden rounded-xl bg-ink">
              <video ref={video} muted playsInline className="h-full w-full object-cover" aria-label={t.tech.scanHint} />
              {camera !== "on" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-[13px] text-white/75">
                  {camera === "off" ? <CameraOff size={26} aria-hidden /> : null}
                  {camera === "off" ? t.tech.cameraUnavailable : t.chrome.loading}
                </div>
              )}
              {/* setting-out reticle */}
              <div className="pointer-events-none absolute inset-[18%]" aria-hidden>
                {["top-0 left-0 border-t-4 border-l-4", "top-0 right-0 border-t-4 border-r-4", "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"].map((c) => (
                  <span key={c} className={`absolute h-8 w-8 border-fluoro ${c}`} />
                ))}
                <span className="absolute inset-x-0 top-1/2 h-0.5 bg-fluoro/80" style={{ animation: "scan-line 1.6s ease-in-out infinite alternate" }} />
              </div>
            </div>
            <p className="mt-2 text-center text-[13px] text-ink-2">{t.tech.scanHint}</p>
            <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => void lookup("TSL:QMR:FCU-1402-01")}>{t.tech.simulate}</Button>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookup(tag); }}>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="FCU-1402-01" aria-label={t.tech.enterTag} className="reading h-12" />
              <Button type="submit" size="lg" icon={<Search size={16} />} aria-label={t.tech.find} />
            </form>
            {notFound && <p className="mt-2 text-[13px] text-breach" role="alert">{t.tech.notFound}</p>}
          </>
        )}

        {asset && (
          <div className="animate-rise mt-4">
            <div className="sheet crosshair p-4">
              <div className="reading text-[20px] font-semibold text-ink">{asset.tag}</div>
              <div className="text-[13.5px] text-ink-2">{t.assetClass[asset.assetClass]} · {b(asset.location)}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <LiabilityChip liability={inDlp ? "DLP" : "CHARGEABLE"} long={inDlp} />
                {asset.batch && <span className="reading rounded-sm border border-seam px-1.5 py-0.5 text-[11.5px] text-ink-2">{asset.batch}</span>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
                <div><dt className="text-ink-3">{t.asset.installedBy}</dt><dd className="text-ink">{lang === "ar" ? dir?.sub(asset.installedBy)?.nameAr : dir?.sub(asset.installedBy)?.name}</dd></div>
                <div><dt className="text-ink-3">{t.asset.dlpEnd}</dt><dd className="reading text-ink">{asset.dlpEnd ? date(asset.dlpEnd) : "—"}</dd></div>
              </dl>
            </div>
            {openJob && (
              <Button
                variant="primary" size="lg" className="mt-3 w-full"
                onClick={async () => {
                  if (openJob.status === "accepted") await services.workOrders.arrive(openJob.id, "P-JOEL");
                  navigate(`/tech/job/${openJob.id}`);
                }}
              >
                {t.tech.startJob} · {openJob.ref}
              </Button>
            )}
            <h2 className="mt-5 mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-2"><History size={14} aria-hidden />{t.tech.history}</h2>
            <ul className="sheet divide-y divide-seam">
              {jobs.map((j) => (
                <li key={j.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="reading text-[12px] text-ink-3">{dateShort(j.reportedAt)} · {j.ref}</span>
                    <StatusChip status={j.status} />
                  </div>
                  <div className="text-[14px] text-ink">{b(j.title)}</div>
                  {j.rootCause && <div className="text-[12.5px] text-ink-2">{t.rootCause[j.rootCause]}</div>}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => { setAsset(null); setJobs([]); }}>{t.tech.scanTitle}</Button>
              <Link to={`/assets/${asset.id}`} className="flex-1"><Button variant="ghost" className="w-full">{t.asset.title}</Button></Link>
            </div>
          </div>
        )}
      </div>
      <MobileTabBar />
    </div>
  );
}
