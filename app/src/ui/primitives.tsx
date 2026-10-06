import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { KissflowMark } from "./KissflowLogo";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Building2, Mail, MessageCircle, Mic, Phone, QrCode, Radio, Smartphone, Sparkles, CalendarClock, Headset
} from "lucide-react";
import type { Channel, Liability, Priority, Rag, WoStatus } from "@/domain/types";
import type { SlaPhase } from "@/domain/sla";
import { useI18n } from "@/i18n";
import { cn } from "./cn";

// ---- Buttons ------------------------------------------------------------------------------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "ink";
const variants: Record<Variant, string> = {
  primary: "bg-fluoro text-on-fluoro hover:bg-fluoro-hover active:bg-fluoro-active font-semibold border border-fluoro-edge",
  ink: "bg-ink text-sheet hover:bg-ink-2 font-medium border border-ink",
  secondary: "bg-sheet text-ink border border-seam-strong hover:bg-sheet-2 hover:border-ink-3",
  ghost: "text-ink-2 hover:bg-ink/5 hover:text-ink border border-transparent",
  danger: "bg-sheet text-breach border border-breach/60 hover:bg-breach-wash"
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; icon?: ReactNode; loading?: boolean }>(
  function Button({ variant = "secondary", size = "md", icon, loading, className, children, disabled, ...rest }, ref) {
    const sizes = { sm: "h-8 px-2.5 text-[13px] gap-1.5", md: "h-9 px-3.5 text-[13.5px] gap-2", lg: "h-12 px-5 text-[15px] gap-2.5" };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md whitespace-nowrap transition-[background-color,border-color,transform] duration-150 select-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
          variants[variant], sizes[size], className
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <KissflowSpinner /> : icon}
        {children}
      </button>
    );
  }
);

// ---- Chips ----------------------------------------------------------------------------------
function Chip({ className, children, title }: { className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-[11.5px] leading-none font-medium whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

const liabilityStyle: Record<Liability, string> = {
  DLP: "bg-dlp-wash text-dlp-ink border border-dlp/50",
  CHARGEABLE: "bg-chargeable-wash text-chargeable border border-chargeable/30",
  DECENNIAL_REVIEW: "bg-decennial-wash text-decennial border border-decennial/30",
  WARRANTY: "bg-ok-wash text-ok border border-ok/30",
  OWN_OPS: "bg-ownops-wash text-ownops border border-ownops/30",
  PPM: "bg-sheet-2 text-ink-2 border border-seam"
};
const liabilityMark: Record<Liability, string> = {
  DLP: "bg-dlp", CHARGEABLE: "bg-chargeable", DECENNIAL_REVIEW: "bg-decennial", WARRANTY: "bg-ok", OWN_OPS: "bg-ownops", PPM: "bg-ink-3"
};

/** Survey-peg mark + label. Liability is always named, never colour alone. */
export function LiabilityChip({ liability, long = false, className }: { liability: Liability; long?: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <Chip className={cn(liabilityStyle[liability], className)}>
      <span className={cn("h-2.5 w-1 rotate-12", liabilityMark[liability])} aria-hidden />
      {long ? t.liability[liability] : t.liabilityShort[liability]}
    </Chip>
  );
}

export function PriorityChip({ priority, summer }: { priority: Priority; summer?: boolean }) {
  const { t } = useI18n();
  const style: Record<Priority, string> = {
    P1: "bg-breach text-white",
    P2: "bg-ink text-sheet",
    P3: "bg-sheet-2 text-ink-2 border border-seam",
    P4: "text-ink-3 border border-seam"
  };
  return (
    <Chip className={style[priority]} title={summer ? t.sla.summerRule : t.priority[priority]}>
      <span className="reading">{priority}</span>
      {summer && <span aria-label={t.sla.summerRule} className="h-1.5 w-1.5 rounded-full bg-fluoro" />}
    </Chip>
  );
}

export function StatusChip({ status }: { status: WoStatus }) {
  const { t } = useI18n();
  const style: Partial<Record<WoStatus, string>> = {
    new: "text-ink border border-ink-3 border-dashed",
    assigned: "text-ink-2 border border-seam-strong",
    accepted: "text-ink bg-sheet-2 border border-seam-strong",
    in_progress: "text-ink bg-risk-wash border border-risk/30",
    on_hold: "text-ink-2 bg-sheet-2 border border-seam hazard-soft",
    resolved: "text-ok bg-ok-wash border border-ok/30",
    closed: "text-ink-3 border border-seam",
    cancelled: "text-ink-3 line-through"
  };
  return <Chip className={style[status]}>{t.status[status]}</Chip>;
}

export function SlaChip({ phase }: { phase: SlaPhase }) {
  const { t } = useI18n();
  const style: Record<SlaPhase, string> = {
    on_track: "text-ink-2 border border-seam",
    at_risk: "bg-risk-wash text-risk border border-risk/40",
    breached: "bg-breach text-white",
    met: "bg-ok-wash text-ok",
    missed: "bg-breach-wash text-breach"
  };
  return <Chip className={style[phase]}>{t.sla[phase]}</Chip>;
}

export const channelIcon: Record<Channel, typeof Phone> = {
  resident_app: Smartphone, voice_agent: Mic, qr_public: QrCode, phone: Phone, helpdesk: Headset, ppm: CalendarClock, email: Mail, whatsapp: MessageCircle, bms: Radio
};
export function ChannelChip({ channel }: { channel: Channel }) {
  const { t } = useI18n();
  const Icon = channelIcon[channel];
  return (
    <Chip className="border border-seam text-ink-2">
      <Icon size={12} strokeWidth={2} aria-hidden />
      {t.channel[channel]}
    </Chip>
  );
}

export function RagChip({ rag, label }: { rag: Rag; label?: string }) {
  const { t } = useI18n();
  const style: Record<Rag, string> = {
    green: "bg-ok-wash text-ok border border-ok/30",
    amber: "bg-risk-wash text-risk border border-risk/40",
    red: "bg-breach text-white"
  };
  return (
    <Chip className={style[rag]}>
      <span className={cn("h-2 w-2", rag === "green" ? "rounded-full bg-ok" : rag === "amber" ? "rotate-45 bg-risk-fill" : "bg-white")} aria-hidden />
      {label ?? t.compliance[rag]}
    </Chip>
  );
}

export function DemoTag({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span title={t.app.demoDataLong} className={cn("inline-flex items-center rounded-sm border border-ink-3/40 px-1.5 text-[11px] text-ink-3", className)}>
      {t.app.demoData}
    </span>
  );
}

// ---- AI preview label ------------------------------------------------------------------------
export function AiTag({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Hint text={t.ai.previewNote}>
      <span tabIndex={0} className={cn("preview-outline inline-flex h-[20px] items-center gap-1 rounded-sm px-1.5 text-[11px] font-medium text-ink-2", className)}>
        <Sparkles size={11} strokeWidth={2.2} aria-hidden />
        {t.ai.preview}
      </span>
    </Hint>
  );
}

// ---- Tooltip ----------------------------------------------------------------------------------
export function Hint({ text, children, side = "top" }: { text: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip.Root delayDuration={250}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={6} className="z-50 max-w-72 rounded-md bg-ink px-2.5 py-1.5 text-[12px] leading-snug text-sheet shadow-[var(--shadow-float)]">
          {text}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// ---- Layout pieces ------------------------------------------------------------------------------
export function PageHeader({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-balance text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[70ch] text-[13.5px] text-ink-2">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, meta, actions, children, className, bodyClassName, id }: {
  title?: ReactNode; meta?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string;
}) {
  return (
    <section id={id} className={cn("sheet flex min-w-0 flex-col", className)}>
      {(title || actions) && (
        <div className="seam-b flex min-h-11 items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            {title && <h2 className="text-[13.5px] font-semibold text-ink">{title}</h2>}
            {meta && <span className="text-[12px] text-ink-3">{meta}</span>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cn("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-2">{label}</label>
      {children}
      {hint && <p className="text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

const control = "w-full rounded-md border border-seam-strong bg-sheet px-3 text-[14px] text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-fluoro disabled:opacity-50";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(control, "h-10 appearance-none bg-[length:12px] bg-[position:right_12px_center] bg-no-repeat pe-8 rtl:bg-[position:left_12px_center]", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%235c636a' stroke-width='1.6'/%3E%3C/svg%3E\")" }}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-md border border-seam-strong bg-sheet p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-7 rounded-[3px] px-2.5 text-[12.5px] whitespace-nowrap transition-colors", value === o.value ? "bg-ink text-sheet" : "text-ink-2 hover:bg-ink/5")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KissflowSpinner() {
  return <KissflowMark size={16} className="kf-loader shrink-0" />;
}

/** Section/page-level loading state: the Kissflow petals, sized to the block it replaces. */
export function PageLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)} role="status" aria-live="polite">
      <KissflowMark size={36} className="kf-loader" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function Empty({ title, hint, icon }: { title: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ?? <Building2 className="text-ink-3" size={22} strokeWidth={1.6} aria-hidden />}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {hint && <p className="max-w-[46ch] text-[13px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, size = 28, tone = "ink" }: { name: string; size?: number; tone?: "ink" | "fluoro" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("");
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", tone === "ink" ? "bg-ink text-sheet" : "bg-fluoro text-on-fluoro")}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

/** A large ledger figure with its label: hierarchy carried by type size, not boxes. */
export function Ledger({ value, label, sub, tone = "ink", size = "lg" }: { value: ReactNode; label: ReactNode; sub?: ReactNode; tone?: "ink" | "fluoro" | "breach" | "ok" | "risk"; size?: "xl" | "lg" | "md" }) {
  const toneCls = { ink: "text-ink", fluoro: "text-fluoro-ink", breach: "text-breach", ok: "text-ok", risk: "text-risk" }[tone];
  const sizeCls = { xl: "text-[40px] leading-[1.02] whitespace-nowrap", lg: "text-[30px] leading-[1.05] whitespace-nowrap", md: "text-[21px] leading-tight whitespace-nowrap" }[size];
  return (
    <div className="min-w-0">
      <div className={cn("tnum font-semibold tracking-[-0.02em]", toneCls, sizeCls)}>{value}</div>
      <div className="mt-1 text-[12.5px] text-ink-2">{label}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

export function LinkLike({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("underline decoration-seam-strong underline-offset-4 hover:decoration-fluoro", className)}>{children}</span>;
}

