// Thin, typed wrapper over @kissflow/lowcode-client-sdk for the CAFM adapter.
// Conventions (Thomas, Phase 4/6): account id read from kf.account._id at runtime, kf.api() (never fetch) for REST,
// explicit null guards rather than optional-chaining collapse.

export interface KfRow { _id: string; [field: string]: unknown }
interface Query { items: KfRow[]; total: number }
interface ProcessHandle {
  getAdminItems(o?: object): Promise<Query>;
  getMyItems(o?: object): Promise<Query>;
  getParticipatedItems(o?: object): Promise<Query>;
  getMyTasksItems(o?: object): Promise<Query>;
  getItem(o: { instanceId: string; activityInstanceId: string }): Promise<KfRow>;
  createItem(o: { data: object }): Promise<{ _id: string; _activity_instance_id: string }>;
  updateItem(o: { instanceId: string; activityInstanceId: string; data: object }): Promise<KfRow>;
  submitItem(o: { instanceId: string; activityInstanceId: string; comment?: string }): Promise<void>;
  rejectItem(o: { instanceId: string; activityInstanceId: string; comment: string }): Promise<void>;
}
interface ListHandle {
  getItems(o?: object): Promise<Query>;
  createItem(o: { data: object }): Promise<KfRow>;
  updateItem(o: { itemId?: string; instanceId?: string; data: object }): Promise<KfRow>;
}
export interface Kf {
  app: { getProcess(id: string): ProcessHandle; getDataform(id: string): ListHandle; getBoard(id: string): ListHandle };
  user: { _id: string; Name: string; Email: string; AppRoles: Array<{ _id: string; Name: string }> };
  account: { _id: string };
  api(url: string, args?: object): Promise<unknown>;
}

/** True when this page runs inside the Kissflow host (Custom UI iframe) and mock data isn't forced. */
export function inKissflowHost(): boolean {
  if (typeof window === "undefined") return false;
  const forced = new URLSearchParams(window.location.search).get("data");
  if (forced === "mock") return false;
  if (forced === "kissflow") return true;
  return window.self !== window.top;
}

/** Initialise the SDK, with a timeout so a page opened outside Kissflow falls back to mock data quickly. */
export async function connect(timeoutMs = 8000): Promise<Kf> {
  // loaded only here: the SDK registers a host message listener on import, which the offline demo doesn't need
  const sdk = (await import("@kissflow/lowcode-client-sdk")).default as unknown as { initialize(): Promise<Kf> };
  const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Kissflow SDK did not respond")), timeoutMs));
  const kf = await Promise.race([sdk.initialize(), timer]);
  if (kf === undefined || kf === null || kf.app === undefined || kf.app === null) throw new Error("Kissflow SDK returned no app context");
  return kf;
}

/** One line per SDK read, for the diagnostics page (#/kf-diag). */
export interface DiagEntry { call: string; ok: boolean; keys: string; rows: number; total?: number; ms: number; error?: string; rowKeys?: string }
export const diag: DiagEntry[] = [];
const describe = (e: unknown) => {
  if (e instanceof Error) return e.message;
  if (e !== null && typeof e === "object") { try { return JSON.stringify(e).slice(0, 240); } catch { return "unserialisable error"; } }
  return String(e);
};

/** The host has answered list calls as { items, total }, { Data, count } or a bare array: accept all of them. */
export function rowsOf(r: unknown): KfRow[] {
  if (Array.isArray(r)) return r as KfRow[];
  if (r === null || typeof r !== "object") return [];
  const o = r as Record<string, unknown>;
  for (const k of ["items", "Data", "data", "Items"]) if (Array.isArray(o[k])) return o[k] as KfRow[];
  return [];
}
export function totalOf(r: unknown): number | undefined {
  if (r === null || typeof r !== "object" || Array.isArray(r)) return undefined;
  const o = r as Record<string, unknown>;
  for (const k of ["total", "count", "Total", "TotalCount"]) if (typeof o[k] === "number") return o[k] as number;
  return undefined;
}

async function traced(call: string, fn: () => Promise<unknown>): Promise<unknown> {
  const t = Date.now();
  try {
    const r = await fn();
    const keys = Array.isArray(r) ? "[array]" : r !== null && typeof r === "object" ? Object.keys(r as object).slice(0, 8).join(",") : typeof r;
    const first = rowsOf(r)[0];
    diag.push({ call, ok: true, keys, rows: rowsOf(r).length, total: totalOf(r), ms: Date.now() - t, rowKeys: first !== undefined ? Object.keys(first).join(",") : undefined });
    return r;
  } catch (e) {
    diag.push({ call, ok: false, keys: "", rows: 0, ms: Date.now() - t, error: describe(e) });
    throw e;
  }
}

/** Every item of a dataform or board, paging until the reported total (the host may cap the page size). */
export async function listAll(handle: ListHandle, label: string, pageSize = 100, viewId?: string): Promise<KfRow[]> {
  const byId = new Map<string, KfRow>();
  for (let page = 1; page <= 60; page++) {
    const r = await traced(`${label} p${page}`, () => handle.getItems(viewId !== undefined ? { pageNumber: page, pageSize, viewId } : { pageNumber: page, pageSize }));
    const items = rowsOf(r), total = totalOf(r);
    const before = byId.size;
    for (const it of items) byId.set(it._id, it);
    if (items.length < pageSize || byId.size === before) break;           // last page, or the host ignored paging
    if (total !== undefined && total > items.length && byId.size >= total) break; // trust a total only when it spans pages
  }
  return [...byId.values()];
}

/** kf.api() hands its args to the host's fetch: send JSON as a string with a Content-Type header (an object body is ignored). */
export function apiPost(kf: Kf, url: string, body: unknown): Promise<unknown> {
  return kf.api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

/** Every card of a board, with all its fields. The SDK's board list returns only card metadata (no custom fields) for the
 *  Kanban view, so boards are read over kf.api (REST, as the signed-in user). Verified live 22 Sep. */
export async function listBoard(kf: Kf, boardId: string, label: string, pageSize = 100): Promise<KfRow[]> {
  const byId = new Map<string, KfRow>();
  for (let page = 1; page <= 60; page++) {
    const r = await traced(`${label} p${page}`, () => kf.api(`/case/2/${kf.account._id}/${boardId}/list?page_size=${pageSize}&page_number=${page}`));
    const items = rowsOf(r);
    const before = byId.size;
    for (const it of items) byId.set(it._id, it);
    if (items.length < pageSize || byId.size === before) break;
  }
  return [...byId.values()];
}

/** Process items the current user can see: admin view first, then tasks/participated/mine. */
export async function processItems(p: ProcessHandle, label: string): Promise<KfRow[]> {
  const byId = new Map<string, KfRow>();
  const scopes: Array<[string, (page: number) => Promise<unknown>]> = [
    ["admin", (page) => p.getAdminItems({ pageNumber: page, pageSize: 100 })],
    ["tasks", (page) => p.getMyTasksItems({ pageNumber: page, pageSize: 100 })],
    ["participated", (page) => p.getParticipatedItems({ pageNumber: page, pageSize: 100 })],
    ["mine", (page) => p.getMyItems({ status: "all", pageNumber: page, pageSize: 100 })]
  ];
  for (const [scope, get] of scopes) {
    for (let page = 1; page <= 20; page++) {
      let items: KfRow[] = [], total: number | undefined;
      try { const r = await traced(`${label} ${scope} p${page}`, () => get(page)); items = rowsOf(r); total = totalOf(r); }
      catch { break; } // this scope isn't available to the current user; the next one may be
      // admin rows carry every field but no _current_step; later scopes (tasks) add it: merge, don't skip
      for (const it of items) {
        const prev = byId.get(it._id);
        if (prev === undefined) { byId.set(it._id, it); continue; }
        const merged: KfRow = { ...prev };
        for (const [k, v] of Object.entries(it)) if (merged[k] === undefined || merged[k] === null) merged[k] = v;
        // the tasks scope carries the CURRENT activity instance; the admin row's can be empty or stale
        if (scope === "tasks" && it._activity_instance_id !== undefined && it._activity_instance_id !== null) merged._activity_instance_id = it._activity_instance_id;
        byId.set(it._id, merged);
      }
      if (items.length < 100 || (total !== undefined && page * 100 >= total)) break;
    }
  }
  return [...byId.values()];
}

/** A value from a Kissflow row: references arrive as objects ({ _id, Name, … }). */
export function refId(v: unknown): string | undefined {
  if (v === undefined || v === null || typeof v !== "object") return undefined;
  const id = (v as { _id?: unknown })._id;
  return typeof id === "string" ? id : undefined;
}
export const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
export const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
/** Kissflow Date ("2027-02-28") / DateTime ("…Z") → the app's GST ISO form. */
export function isoDate(v: unknown): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00+04:00`;
  return new Date(s).toISOString();
}
/** App ISO → Kissflow DateTime (no milliseconds; Kissflow rejects them). */
export const kfDateTime = (iso: string) => new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z");
export const kfDate = (iso: string) => iso.slice(0, 10);
