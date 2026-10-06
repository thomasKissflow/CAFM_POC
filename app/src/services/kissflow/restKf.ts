// The Kf facade (same method shapes as the SDK in sdk.ts) implemented over Kissflow REST, with a pluggable transport.
// Used by: the Node adapter checks (transport = data-model/kf-call.mjs) and local dev in the browser
// (transport = the dev-only /api/kf proxy, which holds the key server-side). Inside Kissflow the real SDK is used instead.
import type { Kf, KfRow } from "./sdk";

export type KfTransport = (method: string, path: string, body?: unknown) => Promise<{ status: number; json: any }>;

const APP = "CAFM_POC_A00", Q = `?_application_id=${APP}`;
const WO_COLUMNS = ["Request_Title", "Site", "Category", "Asset", "Channel", "Description", "Reporter_Name", "First_Contact_At", "Summer_Uplift", "Priority_Code", "Liability_Code", "Dispatch_Code", "Installed_By", "_current_step"];

export function restKf(call: KfTransport, user: Kf["user"], accountId = "{acc}"): Kf {
  const ok = (r: { status: number; json: any }, what: string) => { if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); return r.json; };
  const dataform = (id: string) => ({
    async getItems(o: { pageNumber?: number; pageSize?: number } = {}) { const j = ok(await call("POST", `/form/2/{acc}/${id}/allitems/list${Q}&page_size=${o.pageSize ?? 500}&page_number=${o.pageNumber ?? 1}`, {}), `list ${id}`); return { items: j.Data ?? [], total: j.count ?? (j.Data ?? []).length }; },
    async createItem(o: { data: object }) { return ok(await call("POST", `/form/2/{acc}/${id}/batch${Q}`, [{ ...o.data, _is_created: true }]), `create ${id}`)[0] as KfRow; },
    async updateItem(o: { itemId?: string; data: object }) { return ok(await call("POST", `/form/2/{acc}/${id}/batch${Q}`, [{ _id: o.itemId, ...o.data }]), `update ${id}`)[0] as KfRow; }
  });
  const board = (id: string) => ({
    async getItems(o: { pageNumber?: number; pageSize?: number } = {}) { const j = ok(await call("GET", `/case/2/{acc}/${id}/list${Q}&page_size=${o.pageSize ?? 500}&page_number=${o.pageNumber ?? 1}`), `list ${id}`); return { items: j.Data ?? [], total: (j.Data ?? []).length }; },
    async createItem(o: { data: object }) { return ok(await call("POST", `/case/2/{acc}/${id}${Q}`, o.data), `create ${id}`) as KfRow; },
    async updateItem() { throw new Error("not used"); }
  });
  const proc = (id: string) => {
    const list = async (view: string) => { const j = ok(await call("POST", `/process/2/{acc}/${id}/myitems/${view}?apply_preference=false&page_number=1&page_size=500&_application_id=${APP}`, { Columns: WO_COLUMNS.map((c) => ({ Id: c })) }), `list ${id}`); return { items: j.Data ?? [], total: (j.Data ?? []).length }; };
    return {
      getAdminItems: () => list("inprogress"), getMyTasksItems: () => list("inprogress"), getParticipatedItems: () => list("inprogress"), getMyItems: () => list("inprogress"),
      async getItem(o: { instanceId: string; activityInstanceId: string }) { return ok(await call("GET", `/process/2/{acc}/${id}/${o.instanceId}/${o.activityInstanceId}${Q}&_response_type=full`), "get item") as KfRow; },
      async createItem(o: { data: object }) { return ok(await call("POST", `/process/2/{acc}/${id}${Q}`, o.data), "create item"); },
      async updateItem(o: { instanceId: string; activityInstanceId: string; data: object }) { return ok(await call("POST", `/process/2/{acc}/${id}/${o.instanceId}/${o.activityInstanceId}${Q}`, o.data), "update item") as KfRow; },
      async submitItem(o: { instanceId: string; activityInstanceId: string }) { ok(await call("POST", `/process/2/{acc}/${id}/${o.instanceId}/${o.activityInstanceId}/submit${Q}`, {}), "submit"); },
      async rejectItem(o: { instanceId: string; activityInstanceId: string; comment: string }) { ok(await call("POST", `/process/2/{acc}/${id}/${o.instanceId}/${o.activityInstanceId}/reject${Q}`, { Note: o.comment }), "reject"); }
    };
  };
  return {
    app: { getDataform: dataform, getBoard: board, getProcess: proc } as unknown as Kf["app"],
    user,
    account: { _id: accountId },
    async api(url: string, args?: { method?: string; body?: unknown }) {
      const body = args !== undefined && typeof args.body === "string" ? JSON.parse(args.body) : args !== undefined ? args.body : undefined; // mirror the host: JSON string body
      const method = args !== undefined && args.method !== undefined ? args.method : "GET";
      return ok(await call(method, url.replace(/\/2\/[^/]+\//, "/2/{acc}/") + (url.includes("?") ? "&" : "?") + `_application_id=${APP}`, body), `api ${url}`);
    }
  };
}
