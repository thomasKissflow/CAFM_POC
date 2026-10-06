import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Lang, RoleKey } from "@/domain/types";

/** Demo persona per role (PLAN.md §2). Phase 6 replaces this with kf.user + kf.user.AppRoles. */
export const ROLE_PERSON: Record<RoleKey, string> = {
  executive: "P-HAMDAN",
  fm_manager: "P-SARAH",
  helpdesk: "P-ARJUN",
  dlp_manager: "P-KHALID",
  subcon_supervisor: "P-RASHID",
  technician: "P-JOEL",
  resident: "P-LAYLA",
  compliance: "P-MARIAM",
  hse: "P-IMRAN",
  plant_manager: "P-VIKTOR",
  admin: "P-ADMIN"
};

export const MOBILE_ROLES: RoleKey[] = ["technician", "resident"];

export const ROLE_HOME: Record<RoleKey, string> = {
  executive: "/command",
  fm_manager: "/queue",
  helpdesk: "/intake",
  dlp_manager: "/dlp",
  subcon_supervisor: "/queue",
  technician: "/tech",
  resident: "/me",
  compliance: "/compliance",
  hse: "/permits",
  plant_manager: "/fleet",
  admin: "/admin/data"
};

interface Session {
  role: RoleKey;
  personId: string;
  lang: Lang;
  setRole: (r: RoleKey) => void;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
}

const Ctx = createContext<Session | null>(null);

function read<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = window.localStorage.getItem(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: session-only */
  }
}

const ROLES = Object.keys(ROLE_PERSON) as RoleKey[];

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<RoleKey>(() => read("cafm.role", "executive", ROLES));
  const [lang, setLangState] = useState<Lang>(() => read("cafm.lang", "en", ["en", "ar"] as const));
  const setRole = useCallback((r: RoleKey) => {
    setRoleState(r);
    write("cafm.role", r);
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    write("cafm.lang", l);
  }, []);
  const value = useMemo<Session>(
    () => ({ role, personId: ROLE_PERSON[role], lang, setRole, setLang, toggleLang: () => setLang(lang === "en" ? "ar" : "en") }),
    [role, lang, setRole, setLang]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (s === null) throw new Error("useSession outside SessionProvider");
  return s;
}
