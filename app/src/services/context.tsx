import { createContext, useCallback, useContext, useEffect, useRef, useState, type DependencyList, type ReactNode } from "react";
import type { Services } from "./types";

const Ctx = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

export function useServices(): Services {
  const s = useContext(Ctx);
  if (s === null) throw new Error("useServices must be used inside <ServicesProvider>");
  return s;
}

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  reload: () => void;
}

/** Runs an async read against the services and re-runs it whenever the data changes. */
export function useQuery<T>(fn: (s: Services) => Promise<T>, deps: DependencyList): QueryState<T> {
  const services = useServices();
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | undefined }>({ data: undefined, loading: true, error: undefined });
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    fnRef.current(services).then(
      (data) => {
        if (mine === seq.current) setState({ data, loading: false, error: undefined });
      },
      (error: unknown) => {
        if (mine === seq.current) setState((s) => ({ ...s, loading: false, error: error instanceof Error ? error : new Error(String(error)) }));
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, ...deps]);

  useEffect(() => {
    run();
    return services.subscribe(run);
  }, [run, services]);

  return { ...state, reload: run };
}

/** Demo-clock "now", re-rendering every `everyMs`. */
export function useNow(everyMs = 1000): number {
  const services = useServices();
  const [now, setNow] = useState(() => services.clock.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(services.clock.now()), everyMs);
    const unsub = services.subscribe(() => setNow(services.clock.now()));
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [services, everyMs]);
  return now;
}
