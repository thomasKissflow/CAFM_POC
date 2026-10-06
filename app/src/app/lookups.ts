import { useMemo, useState } from "react";
import type { Person, Site, Subcontractor } from "@/domain/types";
import { useQuery } from "@/services/context";
import { dlpEndOf } from "@/domain/liability";
import { ms } from "@/domain/time";

export interface Directory {
  sites: Site[];
  people: Person[];
  subs: Subcontractor[];
  site: (id?: string) => Site | undefined;
  person: (id?: string) => Person | undefined;
  sub: (id?: string) => Subcontractor | undefined;
}

export function useDirectory(): Directory | undefined {
  const q = useQuery(async (s) => {
    const [sites, people, subs] = await Promise.all([s.directory.sites(), s.directory.people(), s.directory.subcontractors()]);
    return { sites, people, subs };
  }, []);
  return useMemo(() => {
    if (q.data === undefined) return undefined;
    const { sites, people, subs } = q.data;
    return {
      sites, people, subs,
      site: (id) => sites.find((x) => x.id === id),
      person: (id) => people.find((x) => x.id === id),
      sub: (id) => subs.find((x) => x.id === id)
    };
  }, [q.data]);
}

/** The building a screen opens on: the first client building the directory holds, until the user picks another. */
export function useSiteChoice(dir: Directory | undefined): [string, (id: string) => void] {
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const first = dir?.sites.find((s) => !s.ownOperations && s.kind !== "plant_yard") ?? dir?.sites[0];
  return [picked !== undefined ? picked : first !== undefined ? first.id : "", setPicked];
}

/** Buildings still inside their defects-liability period, soonest to expire first. */
export function sitesInDlp(dir: Directory | undefined, now: number): Site[] {
  if (dir === undefined) return [];
  return dir.sites
    .filter((s) => !s.ownOperations && s.tocDate !== undefined && dlpEndOf(s) !== undefined && ms(dlpEndOf(s)!) > now)
    .sort((a, b) => ms(dlpEndOf(a)!) - ms(dlpEndOf(b)!));
}
