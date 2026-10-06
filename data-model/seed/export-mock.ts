// Dumps the frontend's deterministic demo DB to JSON so Kissflow is seeded with exactly what the screens show.
import { writeFileSync } from "node:fs";
import { buildSeedAsDesigned } from "../../app/src/services/mock/seed";
import * as R from "../../app/src/services/mock/reference";
import { en } from "../../app/src/i18n/en";
import { DLP_EXCLUDED } from "../../app/src/domain/liability";
// export the world as designed: the app moves it to today at load time, so the seed never needs re-dating
const db = buildSeedAsDesigned();
writeFileSync(new URL("./mock-db.json", import.meta.url), JSON.stringify({ db, ref: { SITES: R.SITES, SUBCONTRACTORS: R.SUBCONTRACTORS, ASSET_CLASS_META: R.ASSET_CLASS_META, PEOPLE: R.PEOPLE, CATEGORY_TRADE: R.CATEGORY_TRADE, en, DLP_EXCLUDED: [...DLP_EXCLUDED] } }, null, 1));
console.log(Object.fromEntries(Object.entries(db).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v])));
