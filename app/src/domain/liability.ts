import type { Asset, Bilingual, Category, ISODate, Liability, RootCause, Site } from "./types";
import { addMonthsGst, daysBetween, ms, toGst } from "./time";

/** Root causes that a typical DLP clause excludes (ASSUMPTION: contract-specific; configurable). */
export const DLP_EXCLUDED: ReadonlySet<RootCause> = new Set<RootCause>([
  "filter_clogged",
  "consumable",
  "misuse",
  "tenant_damage",
  "wear_and_tear",
  "planned_service"
]);

export interface LiabilityInput {
  site: Site;
  asset?: Asset;
  category: Category;
  reportedAt: ISODate;
  rootCause?: RootCause;
  subcontractorName?: string;
}

export interface LiabilityResult {
  liability: Liability;
  reason: Bilingual;
  /** days of DLP left at the time of the report (DLP results only) */
  dlpDaysRemaining?: number;
  dlpEnd?: ISODate;
}

function siteDlpEnd(site: Site): ISODate | undefined {
  if (!site.tocDate || !site.dlpMonths) return undefined;
  return addMonthsGst(site.tocDate, site.dlpMonths);
}

/** The last moment a building is inside its defects period: handover + DLP months, to the second. */
export function dlpEndOf(site: Site): ISODate | undefined {
  const end = siteDlpEnd(site);
  return end === undefined ? undefined : toGst(ms(end) - 1000);
}

function decennialEnd(site: Site, asset?: Asset): ISODate | undefined {
  if (asset?.decennialEnd) return asset.decennialEnd;
  if (!site.tocDate) return undefined;
  return addMonthsGst(site.tocDate, 120);
}

/**
 * Who pays? Evaluated at intake (no root cause yet) and again at close-out (root cause known),
 * which is what lets the system reclassify a "DLP" job as chargeable when the fault is excluded.
 */
export function classifyLiability(input: LiabilityInput): LiabilityResult {
  const { site, asset, category, reportedAt, rootCause, subcontractorName } = input;

  if (category === "ppm") {
    return { liability: "PPM", reason: { en: "Planned maintenance visit", ar: "زيارة صيانة مخططة" } };
  }
  if (site.ownOperations) {
    return {
      liability: "OWN_OPS",
      reason: { en: "Dutco's own facility: internal cost centre", ar: "منشأة تابعة لدوتكو: مركز تكلفة داخلي" }
    };
  }

  if (category === "structural_crack") {
    const dec = decennialEnd(site, asset);
    if (dec && ms(reportedAt) <= ms(dec)) {
      return {
        liability: "DECENNIAL_REVIEW",
        reason: {
          en: "Possible structural defect: statutory decennial liability review",
          ar: "عيب إنشائي محتمل: مراجعة المسؤولية العشرية القانونية"
        }
      };
    }
  }

  if (rootCause && DLP_EXCLUDED.has(rootCause)) {
    return {
      liability: "CHARGEABLE",
      reason: {
        en: "Root cause is excluded from the defects liability period",
        ar: "سبب العطل مستثنى من فترة المسؤولية عن العيوب"
      }
    };
  }

  const dlpEnd = asset?.dlpEnd ?? siteDlpEnd(site);
  if (dlpEnd && ms(reportedAt) <= ms(dlpEnd)) {
    const days = daysBetween(reportedAt, dlpEnd);
    const by = subcontractorName ? ` · installed by ${subcontractorName}` : "";
    const byAr = subcontractorName ? ` · التركيب: ${subcontractorName}` : "";
    return {
      liability: "DLP",
      dlpDaysRemaining: days,
      dlpEnd,
      reason: {
        en: `Within DLP: contractor liable, ${days} days remaining${by}`,
        ar: `ضمن فترة المسؤولية عن العيوب: المقاول مسؤول، متبقٍ ${days} يومًا${byAr}`
      }
    };
  }

  if (asset?.warrantyEnd && ms(reportedAt) <= ms(asset.warrantyEnd)) {
    return {
      liability: "WARRANTY",
      reason: { en: "Outside DLP, covered by manufacturer warranty", ar: "خارج فترة المسؤولية، مشمول بضمان الشركة المصنعة" }
    };
  }

  return {
    liability: "CHARGEABLE",
    dlpEnd,
    reason: dlpEnd
      ? { en: "DLP has ended: chargeable to owner / FM contract", ar: "انتهت فترة المسؤولية: على حساب المالك أو عقد إدارة المرافق" }
      : { en: "No DLP on record: chargeable", ar: "لا توجد فترة مسؤولية مسجلة: قابل للتحصيل" }
  };
}
