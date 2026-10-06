// Chooses the data source at start-up. Kissflow is always the backend (Thomas, Phase 7):
//   inside the Kissflow host → the SDK; local dev (npm run dev) → the dev server's /api/kf proxy; ?data=mock → demo data.
// If Kissflow can't be reached, the app still opens on demo data and says so.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Services } from "./types";
import { createMockServices } from "./mock";
import { inKissflowHost, type Kf } from "./kissflow/sdk";
import { ROLE_FROM_KF } from "./kissflow/ids";
import type { RoleKey } from "@/domain/types";

export interface DataSource { kind: "mock" | "kissflow"; via?: "sdk" | "dev-proxy"; note?: string; user?: string; counts?: Record<string, number>; loadMs?: number; conn?: import("./kissflow").KissflowConnection }
const Ctx = createContext<DataSource>({ kind: "mock" });
export const useDataSource = () => useContext(Ctx);

const forcedMock = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("data") === "mock";

type Boot = { state: "loading" } | { state: "ready"; services: Services; source: DataSource };

export function DataBoot({ children, onRoles, fallback }: { children: (services: Services) => ReactNode; onRoles?: (roles: RoleKey[]) => void; fallback?: ReactNode }) {
  const [boot, setBoot] = useState<Boot>(() => (forcedMock() ? { state: "ready", services: createMockServices(), source: { kind: "mock", note: "demo data forced (?data=mock)" } } : { state: "loading" }));
  useEffect(() => {
    if (boot.state !== "loading") return;
    let alive = true;
    (async () => {
      try {
        const { connect } = await import("./kissflow/sdk");
        const { createKissflowServices } = await import("./kissflow");
        const t0 = Date.now();
        let via: "sdk" | "dev-proxy" = "sdk";
        let kf: Kf;
        if (inKissflowHost()) kf = await connect();
        else {
          const { proxyKf } = await import("./kissflow/proxyKf");
          const p = await proxyKf();
          if (p === undefined) { if (alive) setBoot({ state: "ready", services: createMockServices(), source: { kind: "mock", note: "outside Kissflow and no local backend: demo data" } }); return; }
          kf = p; via = "dev-proxy";
        }
        const conn = await createKissflowServices(kf);
        const roles = (kf.user !== undefined && kf.user !== null && Array.isArray(kf.user.AppRoles) ? kf.user.AppRoles : [])
          .map((r) => ROLE_FROM_KF[r.Name]).filter((r): r is string => r !== undefined) as RoleKey[];
        if (onRoles !== undefined && roles.length > 0) onRoles(roles);
        if (alive) setBoot({ state: "ready", services: conn.services, source: { kind: "kissflow", via, user: kf.user !== undefined && kf.user !== null ? kf.user.Name : undefined, counts: conn.hydrated.counts, loadMs: Date.now() - t0, conn } });
      } catch (e) {
        const note = e instanceof Error ? e.message : String(e);
        console.error("[CAFM] Kissflow unavailable, using demo data:", note);
        if (alive) setBoot({ state: "ready", services: createMockServices(), source: { kind: "mock", note } });
      }
    })();
    return () => { alive = false; };
  }, [boot.state, onRoles]);

  if (boot.state === "loading") return <>{fallback}</>;
  return <Ctx.Provider value={boot.source}>{children(boot.services)}</Ctx.Provider>;
}
