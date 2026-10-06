// Dubai's current temperature, from Open-Meteo (no key, no sign-up).
//
// One call per browser session, not per page load: the first component to ask starts the request, everything else
// shares that same promise, and the answer is kept in sessionStorage so moving around the app — or reloading the
// tab — reuses it. A failed or blocked call falls back to a seasonal demo value, so a screen never shows a gap.
import { useEffect, useState } from "react";

const URL_DUBAI = "https://api.open-meteo.com/v1/forecast?latitude=25.276987&longitude=55.296249&current=temperature_2m";
const STORE_KEY = "cafm.weather";
/** Used when the service can't be reached: a typical Dubai afternoon, and the screens say it's the demo value. */
const FALLBACK: Weather = { temperatureC: 46, source: "demo" };

export interface Weather {
  temperatureC: number;
  /** When Open-Meteo measured it (its own timestamp), when the reading is live. */
  measuredAt?: string;
  source: "live" | "demo";
}

interface Stored extends Weather { fetchedAt: number }

function readStored(): Weather | undefined {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw === null) return undefined;
    const s = JSON.parse(raw) as Partial<Stored>;
    return typeof s.temperatureC === "number" && (s.source === "live" || s.source === "demo")
      ? { temperatureC: s.temperatureC, measuredAt: typeof s.measuredAt === "string" ? s.measuredAt : undefined, source: s.source }
      : undefined;
  } catch { return undefined; } // private window, or storage blocked
}

function store(w: Weather) {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ ...w, fetchedAt: Date.now() } satisfies Stored)); } catch { /* fine: it stays in memory for this page */ }
}

let inFlight: Promise<Weather> | undefined;

/** The reading for this session. The network is touched at most once; everyone after that gets the same answer. */
export function getWeather(): Promise<Weather> {
  const cached = readStored();
  if (cached !== undefined) return Promise.resolve(cached);
  if (inFlight !== undefined) return inFlight;
  inFlight = (async () => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(URL_DUBAI, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`weather service returned ${r.status}`);
      const j = (await r.json()) as { current?: { temperature_2m?: unknown; time?: unknown } };
      const t = j.current !== undefined ? j.current.temperature_2m : undefined;
      if (typeof t !== "number" || !Number.isFinite(t)) throw new Error("no temperature in the answer");
      const w: Weather = { temperatureC: t, measuredAt: j.current !== undefined && typeof j.current.time === "string" ? j.current.time : undefined, source: "live" };
      store(w);
      return w;
    } catch (e) {
      console.warn("[CAFM] live weather unavailable, showing the demo value:", e instanceof Error ? e.message : e);
      store(FALLBACK); // don't retry on every screen change; a reload in a new session tries again
      return FALLBACK;
    } finally {
      inFlight = undefined;
    }
  })();
  return inFlight;
}

/** Current temperature for a component. Starts as the demo value and swaps to the live one when it arrives. */
export function useWeather(): Weather {
  const [weather, setWeather] = useState<Weather>(() => readStored() ?? FALLBACK);
  useEffect(() => {
    let alive = true;
    void getWeather().then((w) => { if (alive) setWeather(w); });
    return () => { alive = false; };
  }, []);
  return weather;
}
