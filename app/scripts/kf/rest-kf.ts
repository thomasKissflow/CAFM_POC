// Node stand-in for the Kissflow SDK: the shared REST facade over the data-model API key. Test-only: never bundled.
// @ts-expect-error plain ESM helper without types
import { kf as rest } from "../../../data-model/kf-call.mjs";
import type { Kf } from "../../src/services/kissflow/sdk";
import { restKf as shared } from "../../src/services/kissflow/restKf";

export function restKf(): Kf {
  return shared((m, p, b) => rest(m, p, b), { _id: "UsATUIj4RC2p", Name: "Thomas", Email: "", AppRoles: [] }, process.env.KF_ACCOUNT_ID ?? "");
}
