import { useEffect, useState, type ReactNode } from "react";
import { KissflowMark } from "@/ui/KissflowLogo";
import { useDataSource } from "@/services/source";
import { diag } from "@/services/kissflow/sdk";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity, Boxes, Building, ChevronDown, ClipboardCheck, FileBarChart2, Flame, Gauge, HardHat, Inbox,
  KeyRound, ListChecks, Menu, MessagesSquare, Mic, Play, RotateCcw, ScanLine, Truck, Users, Wrench, X, Smartphone, Plus, Home,
  Database, Palette, Sparkles, Building2
} from "lucide-react";
import { toast } from "sonner";
import type { RoleKey } from "@/domain/types";
import { genericBrand, useI18n } from "@/i18n";
import { useBrand } from "@/brand/brand";
import { useNow, useServices } from "@/services/context";
import { useDirectory } from "./lookups";
import { MOBILE_ROLES, ROLE_HOME, ROLE_PERSON, useSession } from "./session";
import { Avatar, Button, DemoTag } from "@/ui/primitives";
import { cn } from "@/ui/cn";
import { useWeather } from "@/services/weather";
import { DemoPanel } from "@/demo/DemoPanel";
import { useDemo } from "@/demo/DemoContext";

type NavKey = keyof ReturnType<typeof useI18n>["t"]["nav"];
interface NavItem { to: string; key: NavKey; icon: typeof Gauge; group: "ops" | "liability" | "assurance" | "dutco" | "admin" }

const ITEMS: Record<string, NavItem> = {
  command: { to: "/command", key: "command", icon: Gauge, group: "ops" },
  portfolio: { to: "/portfolio", key: "portfolio", icon: Building, group: "dutco" },
  intake: { to: "/intake", key: "intake", icon: Inbox, group: "ops" },
  queue: { to: "/queue", key: "queue", icon: ListChecks, group: "ops" },
  assets: { to: "/assets", key: "assets", icon: Boxes, group: "ops" },
  dlp: { to: "/dlp", key: "dlp", icon: KeyRound, group: "liability" },
  handover: { to: "/handover", key: "handover", icon: ClipboardCheck, group: "liability" },
  subcontractors: { to: "/subcontractors", key: "subcontractors", icon: Users, group: "liability" },
  ppm: { to: "/ppm", key: "ppm", icon: Activity, group: "assurance" },
  compliance: { to: "/compliance", key: "compliance", icon: Flame, group: "assurance" },
  reports: { to: "/reports", key: "reports", icon: FileBarChart2, group: "assurance" },
  permits: { to: "/permits", key: "permits", icon: HardHat, group: "assurance" },
  fleet: { to: "/fleet", key: "fleet", icon: Truck, group: "dutco" },
  data: { to: "/admin/data", key: "dataBrowser", icon: Database, group: "admin" },
  conversations: { to: "/admin/conversations", key: "aiConversations", icon: MessagesSquare, group: "admin" },
  aiSettings: { to: "/admin/ai", key: "aiSettings", icon: Sparkles, group: "admin" },
  branding: { to: "/admin/brand", key: "branding", icon: Palette, group: "admin" },
  properties: { to: "/admin/properties", key: "properties", icon: Building2, group: "admin" }
};

const ROLE_NAV: Record<RoleKey, string[]> = {
  executive: ["command", "queue", "dlp", "subcontractors", "compliance", "reports", "portfolio", "fleet"],
  fm_manager: ["queue", "intake", "command", "assets", "ppm", "compliance", "reports", "permits", "portfolio"],
  helpdesk: ["intake", "queue", "assets", "reports"],
  dlp_manager: ["dlp", "handover", "queue", "assets", "subcontractors", "command"],
  subcon_supervisor: ["queue", "dlp", "assets"],
  technician: [],
  resident: [],
  compliance: ["compliance", "ppm", "reports", "assets", "permits"],
  hse: ["permits", "queue", "compliance"],
  plant_manager: ["fleet", "portfolio", "command"],
  admin: ["properties", "data", "conversations", "aiSettings", "branding", "command", "queue", "assets", "dlp", "compliance"]
};

/** Where the data comes from: live Kissflow, or the offline demo (with the reason if Kissflow was unreachable). */
function SourceChip() {
  const src = useDataSource();
  if (src.kind === "kissflow") return <a href="#/kf-diag" className="ms-1 hidden rounded-sm border border-ok/40 bg-ok-wash px-1.5 py-0.5 text-[11px] font-medium text-ok md:inline-flex" title={src.user !== undefined ? `Signed in as ${src.user} · connection details` : "Connection details"}>{src.via === "dev-proxy" && !genericBrand() ? "Live · Kissflow (local)" : "Live · Kissflow"}</a>;
  return <DemoTag className="ms-1 hidden md:inline-flex" {...(src.note !== undefined ? { title: `Kissflow unavailable: ${src.note}` } : {})} />;
}

/** Sidebar footer: in Kissflow, what was loaded (readable at a glance, and from a screenshot when debugging). */
function SourceFooter({ demoText }: { demoText: string }) {
  const src = useDataSource();
  if (src.kind !== "kissflow" || src.counts === undefined) return <p className="text-[11px] leading-snug text-ink-3">{demoText}{src.note !== undefined ? ` Kissflow unavailable: ${src.note}` : ""}</p>;
  const c = src.counts;
  return (
    <p className="text-[11px] leading-snug text-ink-3">
      Live from Kissflow{src.user !== undefined ? ` as ${src.user}` : ""}: {c.workOrders} work orders ({c.open} open) · {c.assets} assets · {c.snags} snags
      {src.loadMs !== undefined ? ` · loaded in ${(src.loadMs / 1000).toFixed(1)}s` : ""}. Demo records (fictional).
      {diag.filter((d) => (!d.ok && !/participated|tasks|mine/.test(d.call)) || (d.rows === 0 && / p1$/.test(d.call) && !/participated|tasks|mine/.test(d.call))).map((d, i) => (
        <span key={i} className="mt-1 block break-all text-breach">{d.call}: {d.ok ? `0 rows [${d.keys}]` : `failed ${d.error ?? ""}`}</span>
      ))}
    </p>
  );
}

function DemoClock() {
  const now = useNow(1000);
  const { lang } = useI18n();
  const weather = useWeather();
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {
    timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
  const heat = weather.source === "live"
    ? `Dubai now, from Open-Meteo${weather.measuredAt !== undefined ? ` (measured ${weather.measuredAt.replace("T", " ")} UTC)` : ""}`
    : "Demo value: the live weather service could not be reached";
  return (
    <div className="hidden items-center gap-2 lg:flex" title="Clock (GST)">
      <span className="reading text-[12px] text-ink-2">{fmt.format(new Date(now))} GST</span>
      <span className="reading rounded-sm bg-ink px-1.5 py-0.5 text-[11px] text-sheet" title={heat}>{Math.round(weather.temperatureC)}°C</span>
    </div>
  );
}

function RoleSwitcher() {
  const { role, setRole } = useSession();
  const { t, b } = useI18n();
  const dir = useDirectory();
  const navigate = useNavigate();
  const me = dir?.person(ROLE_PERSON[role]);
  const groups: Array<{ label: string; roles: RoleKey[] }> = [
    { label: "Dutco Construction", roles: ["executive", "dlp_manager", "hse", "plant_manager"] },
    { label: t.app.fmOperator, roles: ["fm_manager", "helpdesk", "compliance"] },
    { label: "Coolbreeze MEP (demo)", roles: ["subcon_supervisor", "technician"] },
    { label: t.roles.resident, roles: ["resident"] },
    { label: t.nav.groupAdmin, roles: ["admin"] }
  ];
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="flex h-10 items-center gap-2 rounded-md border border-seam-strong bg-sheet px-2 hover:border-ink-3" aria-label={t.chrome.switchRole}>
          <Avatar name={me ? me.name.en : "?"} size={26} tone={role === "technician" || role === "resident" ? "fluoro" : "ink"} />
          <span className="hidden text-start leading-tight md:block">
            <span className="block text-[12.5px] font-medium text-ink">{me ? b(me.name) : "…"}</span>
            <span className="block text-[11px] text-ink-3">{t.roles[role]}</span>
          </span>
          <ChevronDown size={14} className="text-ink-3" aria-hidden />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end" sideOffset={6} collisionPadding={10}
          className="z-50 flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-80 flex-col overflow-y-auto overscroll-contain rounded-md border border-seam-strong bg-sheet p-1 shadow-[var(--shadow-float)]"
        >
          <div className="px-2.5 pt-2 pb-1 text-[11.5px] text-ink-3">{t.chrome.switchRole}</div>
          {groups.map((g) => (
            <Dropdown.Group key={g.label} className="py-1">
              <Dropdown.Label className="px-2.5 py-1 text-[11px] font-medium text-ink-3">{g.label}</Dropdown.Label>
              {g.roles.map((r) => {
                const p = dir?.person(ROLE_PERSON[r]);
                return (
                  <Dropdown.Item
                    key={r}
                    onSelect={() => {
                      setRole(r);
                      navigate(ROLE_HOME[r]);
                    }}
                    className={cn("flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-1.5 outline-none data-[highlighted]:bg-sheet-2", r === role && "crosshair bg-sheet-2")}
                  >
                    <Avatar name={p ? p.name.en : r} size={24} tone={MOBILE_ROLES.includes(r) ? "fluoro" : "ink"} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] text-ink">{p ? b(p.name) : r}</span>
                      <span className="block truncate text-[11.5px] text-ink-3">{t.roles[r]}{p ? ` · ${b(p.title)}` : ""}</span>
                    </span>
                    {MOBILE_ROLES.includes(r) && <Smartphone size={14} className="text-ink-3" aria-hidden />}
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Group>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function TitleStrip({ onMenu }: { onMenu?: () => void }) {
  const { t, lang } = useI18n();
  const brand = useBrand();
  const { toggleLang } = useSession();
  const demo = useDemo();
  return (
    <header className="no-print sticky top-0 z-20 bg-sheet">
      <div className="flex h-14 items-center gap-3 px-3 md:px-5">
        {onMenu && (
          <button onClick={onMenu} className="rounded-md p-2 text-ink-2 hover:bg-ink/5 lg:hidden" aria-label={t.nav.more}>
            <Menu size={18} />
          </button>
        )}
        <div className="flex min-w-0 items-center gap-2.5">
          {brand.logo !== undefined
            ? <img src={brand.logo} alt={brand.clientName ?? ""} className="h-8 max-w-[150px] shrink-0 object-contain" />
            : <KissflowMark size={30} title="Kissflow" />}
          <div className="min-w-0 leading-tight">
            <div className="flex items-baseline gap-2">
              <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{t.app.name}</span>
              <span className="hidden text-[12px] text-ink-3 sm:inline">{t.app.tagline}</span>
            </div>
            <div className="hidden truncate text-[11px] text-ink-3 sm:block">{t.app.preparedFor}</div>
          </div>
          <SourceChip />
        </div>
        <div className="flex-1" />
        <DemoClock />
        <button
          onClick={toggleLang}
          className="flex h-10 items-center gap-1.5 rounded-md border border-seam-strong bg-sheet px-2.5 text-[13px] text-ink hover:border-ink-3"
          aria-label={lang === "en" ? "التبديل إلى العربية" : "Switch to English"}
        >
          <span className={lang === "en" ? "font-[500]" : ""}>{t.chrome.language}</span>
        </button>
        <RoleSwitcher />
        {!demo.active && (
          <Button variant="primary" onClick={demo.start} icon={<Play size={14} aria-hidden />} className="hidden sm:inline-flex">
            {t.chrome.startDemo}
          </Button>
        )}
      </div>
      <div aria-hidden className="h-px bg-seam-strong" />
    </header>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useSession();
  const { t } = useI18n();
  const services = useServices();
  const items = ROLE_NAV[role].map((k) => ITEMS[k]);
  const groups: Array<{ key: NavItem["group"]; label: string }> = [
    { key: "ops", label: t.nav.groupOps },
    { key: "liability", label: t.nav.groupLiability },
    { key: "assurance", label: t.nav.groupAssurance },
    { key: "dutco", label: t.nav.groupDutco },
    { key: "admin", label: t.nav.groupAdmin }
  ];
  return (
    <nav className="flex min-h-full flex-col gap-5 px-3 py-5" aria-label="Main">
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key}>
            <div className="px-2 pb-1.5 text-[11px] font-medium text-ink-3">{g.label}</div>
            <ul className="flex flex-col gap-0.5">
              {list.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group flex h-9 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors",
                        isActive ? "crosshair bg-sheet font-medium text-ink shadow-[var(--shadow-lift)]" : "text-ink-2 hover:bg-sheet/60 hover:text-ink"
                      )
                    }
                  >
                    <i.icon size={16} strokeWidth={1.9} aria-hidden />
                    {t.nav[i.key]}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div className="mt-auto flex flex-col gap-2 border-t border-seam px-2 pt-4">
        <NavLink to="/before" onClick={onNavigate} className="flex items-center gap-2 text-[12.5px] text-ink-2 hover:text-ink">
          <MessagesSquare size={14} aria-hidden /> {t.nav.before}
        </NavLink>
        <button
          onClick={() => {
            services.demo.reset();
            toast(t.chrome.resetDone);
          }}
          className="flex items-center gap-2 text-start text-[12.5px] text-ink-2 hover:text-ink"
        >
          <RotateCcw size={14} aria-hidden /> {t.chrome.resetDemo}
        </button>
        <SourceFooter demoText={t.app.demoDataLong} />
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-3"><KissflowMark size={14} title="Kissflow" />{t.app.builtOn}</div>
      </div>
    </nav>
  );
}

/** Technician & resident screens: a phone frame on desktop, full-bleed on a real phone. */
function PhoneStage({ children }: { children: ReactNode }) {
  const { role } = useSession();
  const { t, b } = useI18n();
  const dir = useDirectory();
  const me = dir?.person(ROLE_PERSON[role]);
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 900px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  if (!wide) return <div className="h-[calc(100dvh-var(--chrome))] overflow-y-auto">{children}</div>;
  return (
    <div className="flex min-h-[calc(100dvh-var(--chrome))] items-start justify-center gap-12 bg-ground-2/40 px-8 py-8">
      <aside className="sticky top-8 hidden w-64 pt-10 xl:block">
        {me && (
          <div>
            <div className="text-[18px] font-semibold text-ink">{b(me.name)}</div>
            <div className="text-[13px] text-ink-2">{b(me.title)}</div>
          </div>
        )}
        <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-snug text-ink-3"><Smartphone size={16} className="mt-0.5 shrink-0" aria-hidden />{t.chrome.phoneFrameNote}</p>
      </aside>
      <div className="relative w-[390px] shrink-0 rounded-[44px] border border-ink/20 bg-ink p-[10px] shadow-[var(--shadow-float)]">
        <div className="relative h-[800px] overflow-hidden rounded-[34px] bg-ground">
          {/* status bar: content never scrolls under the camera island */}
          <div className="relative z-10 flex h-11 items-center justify-between bg-ground px-7 text-[12px] font-semibold text-ink" aria-hidden>
            <span className="reading">14:05</span>
            <span className="absolute top-[10px] left-1/2 h-[22px] w-[96px] -translate-x-1/2 rounded-full bg-ink" />
            <span className="reading text-[11px]">5G</span>
          </div>
          <div className="h-[calc(100%-44px)] overflow-y-auto" id="phone-scroll">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function MobileTabBar() {
  const { role } = useSession();
  const { t } = useI18n();
  const items = role === "technician"
    ? [{ to: "/tech", label: t.nav.myJobs, icon: Wrench }, { to: "/tech/scan", label: t.nav.scan, icon: ScanLine }]
    : [{ to: "/me", label: t.nav.myRequests, icon: Home }, { to: "/me/voice", label: t.nav.talk, icon: Mic }, { to: "/me/new", label: t.nav.newRequest, icon: Plus }];
  return (
    <nav className={cn("sticky bottom-0 z-10 grid border-t border-seam bg-sheet/95 pb-[env(safe-area-inset-bottom)] backdrop-blur", items.length === 3 ? "grid-cols-3" : "grid-cols-2")} aria-label="Tabs">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end className={({ isActive }) => cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]", isActive ? "text-ink" : "text-ink-3")}>
          {({ isActive }) => (
            <>
              <i.icon size={20} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden />
              <span className={isActive ? "font-medium" : ""}>{i.label}</span>
              <span className={cn("h-0.5 w-6", isActive ? "bg-fluoro" : "bg-transparent")} aria-hidden />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { role } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const mobileRole = MOBILE_ROLES.includes(role);
  const isPublic = location.pathname.startsWith("/public");
  const isBefore = location.pathname.startsWith("/before");
  const phoneView = (mobileRole && !isBefore) || isPublic;

  return (
    <div className="min-h-dvh">
      <TitleStrip onMenu={phoneView ? undefined : () => setOpen(true)} />
      {phoneView ? (
        <PhoneStage>{children}</PhoneStage>
      ) : (
        <div className="flex">
          <aside className="no-print sticky top-[var(--chrome)] hidden h-[calc(100dvh-var(--chrome))] w-[228px] shrink-0 overflow-y-auto border-e border-seam bg-ground-2 lg:block">
            <SideNav />
          </aside>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 lg:hidden" />
              <Dialog.Content className="fixed inset-y-0 start-0 z-50 w-[270px] overflow-y-auto bg-ground-2 shadow-[var(--shadow-float)] lg:hidden">
                <Dialog.Title className="sr-only">Menu</Dialog.Title>
                <button onClick={() => setOpen(false)} className="absolute end-2 top-2 rounded-md p-2 text-ink-2" aria-label="Close menu"><X size={18} /></button>
                <SideNav onNavigate={() => setOpen(false)} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <main className="min-w-0 flex-1 px-4 py-5 md:px-7 md:py-6">
            <div className="mx-auto max-w-[1440px]">{children}</div>
          </main>
        </div>
      )}
      <DemoPanel />
    </div>
  );
}

