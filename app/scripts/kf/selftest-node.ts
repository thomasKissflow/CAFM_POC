// Runs the in-app self-test (src/services/kissflow/selftest.ts) from Node through the REST stand-in.
import { restKf } from "./rest-kf";
import { createKissflowServices } from "../../src/services/kissflow";
import { runSelfTest } from "../../src/services/kissflow/selftest";
const conn = await createKissflowServices(restKf());
const steps = await runSelfTest(conn, (s) => console.log(`${s.ok ? "PASS" : "FAIL"} · ${s.name} — ${s.detail}`));
console.log(`${steps.filter((s) => s.ok).length}/${steps.length} passed`);
