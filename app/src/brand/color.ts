// Turns one brand colour into the set of shades the interface needs, keeping text readable on top of it.
// Works in OKLCH, so lightening and darkening behave the same whatever hue the client's brand is: a navy and a
// yellow both get a usable dark text shade and a pale background tint, which plain HSL cannot promise.

export interface Accent {
  /** The brand colour itself: buttons, markers, the live-call orb. */
  base: string;
  /** Darker shade of the same hue, for text and icons on a light background. */
  ink: string;
  /** Pale tint, for banner and chip backgrounds. */
  wash: string;
  hover: string;
  active: string;
  /** Border for solid buttons, a touch darker than the base. */
  edge: string;
  /** Black or white, whichever is readable on the base colour. */
  on: string;
}

type Rgb = { r: number; g: number; b: number };
type Lch = { l: number; c: number; h: number };

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function parseHex(hex: string): Rgb | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return undefined;
  const v = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return { r: parseInt(v.slice(0, 2), 16) / 255, g: parseInt(v.slice(2, 4), 16) / 255, b: parseInt(v.slice(4, 6), 16) / 255 };
}

const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((n) => Math.round(clamp01(n) * 255).toString(16).padStart(2, "0")).join("")}`;

const toLinear = (n: number) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
const toSrgb = (n: number) => (n <= 0.0031308 ? n * 12.92 : 1.055 * n ** (1 / 2.4) - 0.055);

function rgbToLch({ r, g, b }: Rgb): Lch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(a, bb), h: Math.atan2(bb, a) };
}

function lchToRgb({ l: L, c, h }: Lch): Rgb {
  const a = Math.cos(h) * c;
  const b2 = Math.sin(h) * c;
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b2) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b2) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b2) ** 3;
  return {
    r: toSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: toSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: toSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_)
  };
}

const shift = (lch: Lch, l: number, cScale = 1) => toHex(lchToRgb({ l: clamp01(l), c: lch.c * cScale, h: lch.h }));

/** WCAG relative luminance, used only to choose black or white text on the brand colour. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (rgb === undefined) return 0;
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const INK = "#16191c";

/** The shades for one brand colour. Returns undefined if the hex can't be read. */
export function deriveAccent(hex: string): Accent | undefined {
  const rgb = parseHex(hex);
  if (rgb === undefined) return undefined;
  const base = toHex(rgb);
  const lch = rgbToLch(rgb);
  return {
    base,
    ink: shift(lch, Math.min(lch.l, 0.47), 1.05),           // dark enough to read as text on a sheet
    wash: shift(lch, 0.95, 0.22),                            // pale tint for chips and banners
    hover: shift(lch, Math.min(lch.l + 0.045, 0.97)),
    active: shift(lch, Math.max(lch.l - 0.05, 0.08)),
    edge: shift(lch, Math.max(lch.l - 0.08, 0.06)),
    on: contrast("#ffffff", base) >= contrast(INK, base) ? "#ffffff" : INK
  };
}

/** The variables the interface reads. Applied to the document root, so every screen follows at once. */
export function accentVariables(a: Accent): Record<string, string> {
  return {
    "--color-fluoro": a.base,
    "--color-fluoro-ink": a.ink,
    "--color-fluoro-wash": a.wash,
    "--color-fluoro-hover": a.hover,
    "--color-fluoro-active": a.active,
    "--color-fluoro-edge": a.edge,
    "--color-on-fluoro": a.on
  };
}
