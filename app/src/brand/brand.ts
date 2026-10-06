// Who the demo is being shown to: the client's name, their logo and their colour.
//
// Kissflow holds the truth (so it follows you to any machine and anyone opening the app sees it), and a copy is
// kept in this browser so the right branding paints on the first frame instead of flashing the default first.
// `?brand=generic` ignores all of it and shows neutral wording — that is what the demo film records with.
import { useSyncExternalStore } from "react";
import type { Services } from "@/services/types";
import { accentVariables, deriveAccent } from "./color";

export interface Brand {
  /** Shown in the header and wherever the contractor is named. Empty means "no client set". */
  clientName?: string;
  /** A small image as a data URL, already resized by the Admin screen. */
  logo?: string;
  /** The client's brand colour as hex; the other shades are derived from it. */
  accent?: string;
}

export const DEFAULT_ACCENT = "#ff5a1f";
export const ACCENT_PRESETS: Array<{ name: string; hex: string }> = [
  { name: "Survey orange", hex: DEFAULT_ACCENT },
  { name: "Contractor blue", hex: "#0b5fff" },
  { name: "Deep navy", hex: "#16366b" },
  { name: "Teal", hex: "#0b7a75" },
  { name: "Forest", hex: "#166534" },
  { name: "Aubergine", hex: "#6b2d78" },
  { name: "Crimson", hex: "#b4232a" },
  { name: "Graphite", hex: "#3f4549" }
];

const KEY = "cafm.brand";
export const BRAND_KEYS = { name: "client_name", logo: "client_logo", accent: "brand_accent" } as const;

export const genericBrand = (): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("brand") === "generic";

function readLocal(): Brand {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? {} : (JSON.parse(raw) as Brand);
  } catch { return {}; }
}
function writeLocal(b: Brand) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* storage blocked: this session only */ }
}

let current: Brand = typeof window === "undefined" ? {} : readLocal();
const listeners = new Set<() => void>();

export const getBrand = (): Brand => (genericBrand() ? {} : current);
function announce() { for (const l of listeners) l(); }

/** Paints the colour on the document root. Call before React renders so nothing flashes the default. */
export function applyAccent(hex?: string) {
  if (typeof document === "undefined") return;
  const accent = deriveAccent(hex ?? DEFAULT_ACCENT) ?? deriveAccent(DEFAULT_ACCENT)!;
  for (const [k, v] of Object.entries(accentVariables(accent))) document.documentElement.style.setProperty(k, v);
}

/** Changes the branding here and now (used for live preview and after a save). */
export function setBrand(next: Brand, remember = true) {
  current = next;
  if (remember) writeLocal(next);
  applyAccent(genericBrand() ? DEFAULT_ACCENT : next.accent);
  announce();
}

export function subscribeBrand(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Re-renders a component whenever the branding changes. */
export const useBrand = (): Brand => useSyncExternalStore(subscribeBrand, getBrand, () => ({}));

/** Reads the branding Kissflow holds and adopts it. Safe to call on every start-up. */
export async function loadBrand(services: Services): Promise<Brand> {
  try {
    const s = await services.aiSettings.read();
    const fromKissflow: Brand = {
      clientName: s.clientName !== undefined && s.clientName.trim() !== "" ? s.clientName.trim() : undefined,
      logo: s.clientLogo !== undefined && s.clientLogo.startsWith("data:") ? s.clientLogo : undefined,
      accent: s.brandAccent !== undefined && s.brandAccent.trim() !== "" ? s.brandAccent.trim() : undefined
    };
    if (JSON.stringify(fromKissflow) !== JSON.stringify(current)) setBrand(fromKissflow);
    return fromKissflow;
  } catch {
    return current; // Kissflow unreachable: carry on with what this browser remembers
  }
}

/** Saves the branding to Kissflow and applies it. */
export async function saveBrand(services: Services, next: Brand, by: string): Promise<void> {
  await services.aiSettings.write(BRAND_KEYS.name, next.clientName ?? "", by);
  await services.aiSettings.write(BRAND_KEYS.logo, next.logo ?? "", by);
  await services.aiSettings.write(BRAND_KEYS.accent, next.accent ?? "", by);
  setBrand(next);
}

// paint the remembered colour before the first render
applyAccent(genericBrand() ? DEFAULT_ACCENT : current.accent);
