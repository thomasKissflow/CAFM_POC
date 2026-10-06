// Static reference data for the demo. EVERYTHING here is fictional (DEMO) unless noted.
import type { ISODate, Person, Site, Subcontractor, AssetClass, Trade, Bilingual, RootCause, Category } from "@/domain/types";
import { toGst } from "@/domain/time";

// The demo data is generated around DEMO_DESIGN_NOW and then moved to today (see domain/demoTime.ts),
// so a demo always reads as "now" while the figures stay deterministic.
export { DEMO_DESIGN_NOW } from "@/domain/time";
export const DEMO_NOW: ISODate = toGst(Date.now());
export const FM_OPERATOR: Bilingual = { en: "Group FM Services (demo)", ar: "خدمات إدارة المرافق للمجموعة (تجريبي)" };

export const SITES: Site[] = [
  {
    id: "S-QMR", code: "QMR",
    name: { en: "Qamar Residences", ar: "مساكن قمر" },
    district: { en: "Al Jaddaf, Dubai", ar: "الجداف، دبي" },
    kind: "residential_tower",
    client: { en: "Qamar Residences Owners Association (demo)", ar: "جمعية ملاك مساكن قمر (تجريبي)" },
    ownOperations: false, tocDate: "2026-03-01T00:00:00+04:00", dlpMonths: 12, floors: 32, unitCount: 312
  },
  {
    id: "S-JDP", code: "JDP",
    name: { en: "Jaddaf Point", ar: "جداف بوينت" },
    district: { en: "Al Jaddaf, Dubai", ar: "الجداف، دبي" },
    kind: "residential_tower",
    client: { en: "Jaddaf Point Holdings (demo)", ar: "جداف بوينت القابضة (تجريبي)" },
    ownOperations: false, tocDate: "2023-05-15T00:00:00+04:00", dlpMonths: 12, floors: 20, unitCount: 180
  },
  {
    id: "S-DSO", code: "DSO",
    name: { en: "Project 4471 site office", ar: "مكتب موقع المشروع 4471" },
    district: { en: "Dubai South", ar: "دبي الجنوب" },
    kind: "site_office",
    client: { en: "Dutco Construction: own operations (demo)", ar: "دوتكو للإنشاءات: عمليات داخلية (تجريبي)" },
    ownOperations: true
  },
  {
    id: "S-LAC", code: "LAC",
    name: { en: "Project 4471 labour accommodation", ar: "سكن العمال للمشروع 4471" },
    district: { en: "Dubai South", ar: "دبي الجنوب" },
    kind: "labour_accommodation",
    client: { en: "Dutco Construction: own operations (demo)", ar: "دوتكو للإنشاءات: عمليات داخلية (تجريبي)" },
    ownOperations: true, beds: 640
  },
  {
    id: "S-YRD", code: "YRD",
    name: { en: "Plant & transport yard", ar: "ساحة المعدات والنقل" },
    district: { en: "Jebel Ali Industrial", ar: "جبل علي الصناعية" },
    kind: "plant_yard",
    client: { en: "Dutco Construction: own operations (demo)", ar: "دوتكو للإنشاءات: عمليات داخلية (تجريبي)" },
    ownOperations: true
  }
];

export const SUBCONTRACTORS: Subcontractor[] = [
  { id: "SC-CB", name: "Coolbreeze MEP (demo)", nameAr: "كول بريز للأعمال الكهروميكانيكية (تجريبي)", trade: "hvac", tradeLicenceNo: "TL-771204", tradeLicenceExpiry: "2027-04-12T00:00:00+04:00", insuranceExpiry: "2027-01-31T00:00:00+04:00", civilDefenceApproved: false, supervisorId: "P-RASHID" },
  { id: "SC-VL", name: "Verticon Lifts (demo)", nameAr: "فيرتيكون للمصاعد (تجريبي)", trade: "lifts", tradeLicenceNo: "TL-640981", tradeLicenceExpiry: "2027-02-20T00:00:00+04:00", insuranceExpiry: "2026-12-15T00:00:00+04:00", civilDefenceApproved: false, supervisorId: "P-TARIQ" },
  { id: "SC-RF", name: "Redline Fire Protection (demo)", nameAr: "ريدلاين للحماية من الحريق (تجريبي)", trade: "fire", tradeLicenceNo: "TL-588310", tradeLicenceExpiry: "2027-06-01T00:00:00+04:00", insuranceExpiry: "2027-03-01T00:00:00+04:00", civilDefenceApproved: true, civilDefenceExpiry: "2026-11-30T00:00:00+04:00", supervisorId: "P-GEORGE" },
  { id: "SC-VE", name: "Voltline Electrical (demo)", nameAr: "فولتلاين للكهرباء (تجريبي)", trade: "electrical", tradeLicenceNo: "TL-702266", tradeLicenceExpiry: "2026-09-05T00:00:00+04:00", insuranceExpiry: "2027-05-10T00:00:00+04:00", civilDefenceApproved: false, supervisorId: "P-DEEPAK" },
  { id: "SC-AQ", name: "Aquaflow Plumbing (demo)", nameAr: "أكوافلو للسباكة (تجريبي)", trade: "plumbing", tradeLicenceNo: "TL-655420", tradeLicenceExpiry: "2027-01-18T00:00:00+04:00", insuranceExpiry: "2026-10-20T00:00:00+04:00", civilDefenceApproved: false, supervisorId: "P-YOUSEF" },
  { id: "SC-FW", name: "Facadeworks Glazing (demo)", nameAr: "فاساد ووركس للزجاج (تجريبي)", trade: "facade", tradeLicenceNo: "TL-612087", tradeLicenceExpiry: "2027-03-03T00:00:00+04:00", insuranceExpiry: "2026-08-01T00:00:00+04:00", civilDefenceApproved: false },
  { id: "SC-FC", name: "Finecraft Interiors (demo)", nameAr: "فاين كرافت للتشطيبات (تجريبي)", trade: "finishes", tradeLicenceNo: "TL-690551", tradeLicenceExpiry: "2026-12-22T00:00:00+04:00", insuranceExpiry: "2027-02-14T00:00:00+04:00", civilDefenceApproved: false }
];

export const SUBCON_FOR_TRADE: Record<Trade, string> = {
  hvac: "SC-CB", lifts: "SC-VL", fire: "SC-RF", electrical: "SC-VE", plumbing: "SC-AQ", facade: "SC-FW", finishes: "SC-FC"
};

const p = (id: string, en: string, ar: string, role: Person["role"], org: Person["org"], title: Bilingual, extra: Partial<Person> = {}): Person => ({
  id, name: { en, ar }, role, org, title, siteIds: ["S-QMR", "S-JDP", "S-DSO", "S-LAC", "S-YRD"], ...extra
});

export const PEOPLE: Person[] = [
  p("P-HAMDAN", "Hamdan Al Falasi", "حمدان الفلاسي", "executive", "dutco", { en: "Operations Director", ar: "مدير العمليات" }),
  p("P-SARAH", "Sarah Whitfield", "سارة ويتفيلد", "fm_manager", "fm", { en: "Facilities Manager", ar: "مديرة المرافق" }),
  p("P-ARJUN", "Arjun Menon", "أرجون مينون", "helpdesk", "fm", { en: "Helpdesk Coordinator", ar: "منسق مكتب المساعدة" }),
  p("P-KHALID", "Khalid Al Hammadi", "خالد الحمادي", "dlp_manager", "dutco", { en: "DLP & Handover Manager", ar: "مدير التسليم وفترة المسؤولية" }),
  p("P-RASHID", "Rashid Qureshi", "راشد قريشي", "subcon_supervisor", "subcon", { en: "HVAC Supervisor", ar: "مشرف التكييف" }, { subcontractorId: "SC-CB" }),
  p("P-JOEL", "Joel Santos", "جويل سانتوس", "technician", "subcon", { en: "HVAC Technician", ar: "فني تكييف" }, { subcontractorId: "SC-CB" }),
  p("P-LAYLA", "Layla Al Suwaidi", "ليلى السويدي", "resident", "tenant", { en: "Resident, Apt 1402", ar: "ساكنة، شقة 1402" }, { unitId: "U-QMR-1402", siteIds: ["S-QMR"] }),
  p("P-MARIAM", "Mariam Nasser", "مريم ناصر", "compliance", "fm", { en: "Fire & Life Safety Officer", ar: "مسؤولة السلامة من الحريق" }),
  p("P-IMRAN", "Imran Siddiqui", "عمران صديقي", "hse", "dutco", { en: "HSE Officer", ar: "مسؤول الصحة والسلامة والبيئة" }),
  p("P-VIKTOR", "Viktor Petrov", "فيكتور بيتروف", "plant_manager", "dutco", { en: "Plant & Fleet Manager", ar: "مدير المعدات والأسطول" }),
  p("P-ADMIN", "Nadia Farouk", "نادية فاروق", "admin", "dutco", { en: "CAFM System Administrator", ar: "مسؤولة نظام إدارة المرافق" }),
  // supporting cast
  p("P-RAMESH", "Ramesh Pillai", "راميش بيلاي", "technician", "subcon", { en: "HVAC Technician", ar: "فني تكييف" }, { subcontractorId: "SC-CB" }),
  p("P-NOEL", "Noel Garcia", "نويل غارسيا", "technician", "subcon", { en: "Lift Technician", ar: "فني مصاعد" }, { subcontractorId: "SC-VL" }),
  p("P-BILAL", "Bilal Ahmed", "بلال أحمد", "technician", "subcon", { en: "Plumber", ar: "سباك" }, { subcontractorId: "SC-AQ" }),
  p("P-SURESH", "Suresh Kumar", "سوريش كومار", "technician", "subcon", { en: "Electrician", ar: "كهربائي" }, { subcontractorId: "SC-VE" }),
  p("P-ANIL", "Anil Thomas", "أنيل توماس", "technician", "subcon", { en: "Fire Systems Technician", ar: "فني أنظمة الحريق" }, { subcontractorId: "SC-RF" }),
  p("P-KAREEM", "Kareem Mansour", "كريم منصور", "technician", "subcon", { en: "Finishing Foreman", ar: "رئيس عمال التشطيبات" }, { subcontractorId: "SC-FC" }),
  p("P-MARK", "Mark Dela Cruz", "مارك ديلا كروز", "technician", "fm", { en: "Multi-skilled Technician", ar: "فني متعدد المهارات" }),
  p("P-FAISAL", "Faisal Rahman", "فيصل رحمن", "technician", "fm", { en: "HVAC Technician", ar: "فني تكييف" }),
  p("P-SANJAY", "Sanjay Nair", "سانجاي ناير", "technician", "dutco", { en: "Camp Maintenance Technician", ar: "فني صيانة السكن" }),
  p("P-TARIQ", "Tariq Aziz", "طارق عزيز", "subcon_supervisor", "subcon", { en: "Lift Supervisor", ar: "مشرف المصاعد" }, { subcontractorId: "SC-VL" }),
  p("P-GEORGE", "George Mathew", "جورج ماثيو", "subcon_supervisor", "subcon", { en: "Fire Supervisor", ar: "مشرف أنظمة الحريق" }, { subcontractorId: "SC-RF" }),
  p("P-DEEPAK", "Deepak Rao", "ديباك راو", "subcon_supervisor", "subcon", { en: "Electrical Supervisor", ar: "مشرف الكهرباء" }, { subcontractorId: "SC-VE" }),
  p("P-YOUSEF", "Yousef Haddad", "يوسف حداد", "subcon_supervisor", "subcon", { en: "Plumbing Supervisor", ar: "مشرف السباكة" }, { subcontractorId: "SC-AQ" })
];

export const RESIDENT_NAMES: Bilingual[] = [
  { en: "Ahmed Al Mazrouei", ar: "أحمد المزروعي" }, { en: "Priya Sharma", ar: "بريا شارما" },
  { en: "Omar Khalil", ar: "عمر خليل" }, { en: "Elena Popescu", ar: "إيلينا بوبيسكو" },
  { en: "Hassan Al Amiri", ar: "حسن العامري" }, { en: "Nadia Farouk", ar: "نادية فاروق" },
  { en: "James Okafor", ar: "جيمس أوكافور" }, { en: "Aisha Al Nuaimi", ar: "عائشة النعيمي" },
  { en: "Rohan Mehta", ar: "روهان ميهتا" }, { en: "Sara Haddad", ar: "سارة حداد" },
  { en: "Mohammed Al Shamsi", ar: "محمد الشامسي" }, { en: "Grace Lim", ar: "غريس ليم" }
];

export const ASSET_CLASS_META: Record<AssetClass, { trade: Trade; label: Bilingual; make: string; model: string; warrantyMonths: number }> = {
  FCU: { trade: "hvac", label: { en: "Fan coil unit", ar: "وحدة ملف المروحة" }, make: "Carrier", model: "42N-FC 06", warrantyMonths: 24 },
  SPLIT_AC: { trade: "hvac", label: { en: "Split AC", ar: "مكيف منفصل" }, make: "Gree", model: "GWC24 2.0TR", warrantyMonths: 12 },
  CHW_PUMP: { trade: "hvac", label: { en: "Chilled-water pump", ar: "مضخة المياه المبردة" }, make: "Grundfos", model: "NKE 100-250", warrantyMonths: 24 },
  ETS: { trade: "hvac", label: { en: "District cooling ETS", ar: "محطة نقل طاقة التبريد" }, make: "Alfa Laval", model: "T20-MFG", warrantyMonths: 24 },
  LIFT: { trade: "lifts", label: { en: "Passenger lift", ar: "مصعد ركاب" }, make: "KONE", model: "MonoSpace 700", warrantyMonths: 24 },
  FIRE_PUMP: { trade: "fire", label: { en: "Fire pump set", ar: "مجموعة مضخات الحريق" }, make: "Pentair Aurora", model: "481 UL/FM", warrantyMonths: 12 },
  SPRINKLER_ZONE: { trade: "fire", label: { en: "Sprinkler zone valve", ar: "صمام منطقة الرشاشات" }, make: "Viking", model: "ZCV-100", warrantyMonths: 12 },
  FIRE_ALARM_PANEL: { trade: "fire", label: { en: "Fire alarm panel", ar: "لوحة إنذار الحريق" }, make: "Notifier", model: "NFS2-3030", warrantyMonths: 24 },
  EMERGENCY_LIGHTING: { trade: "electrical", label: { en: "Emergency lighting circuit", ar: "دائرة إنارة الطوارئ" }, make: "Cooper", model: "CGLine+", warrantyMonths: 12 },
  DG_SET: { trade: "electrical", label: { en: "Diesel generator", ar: "مولد ديزل" }, make: "Cummins", model: "C550 D5", warrantyMonths: 24 },
  WATER_TANK: { trade: "plumbing", label: { en: "Water storage tank", ar: "خزان مياه" }, make: "Balmoral", model: "GRP 60m³", warrantyMonths: 12 },
  BOOSTER_PUMP: { trade: "plumbing", label: { en: "Booster pump set", ar: "مضخات تعزيز الضغط" }, make: "Wilo", model: "SiBoost Smart 3", warrantyMonths: 24 },
  LV_PANEL: { trade: "electrical", label: { en: "LV distribution panel", ar: "لوحة توزيع الجهد المنخفض" }, make: "Schneider", model: "Prisma P", warrantyMonths: 24 }
};

export const ROOT_CAUSE_COST: Record<RootCause, [number, number]> = {
  actuator_failed: [1450, 600],
  thermostat_fault: [380, 300],
  filter_clogged: [90, 180],
  condensate_blocked: [0, 350],
  refrigerant_leak: [650, 700],
  chw_low_flow: [240, 650],
  fan_motor_failed: [2200, 600],
  pipe_joint_leak: [320, 480],
  breaker_tripped: [150, 250],
  door_operator_fault: [3800, 900],
  sealant_failure: [260, 520],
  workmanship: [400, 750],
  misuse: [150, 300],
  tenant_damage: [600, 500],
  wear_and_tear: [300, 400],
  consumable: [80, 150],
  planned_service: [0, 450]
};

export const CATEGORY_WEIGHTS: Array<[Category, number]> = [
  ["ac_not_cooling", 18], ["ac_noise_leak", 8], ["water_leak", 7], ["electrical", 11], ["lift", 4],
  ["plumbing", 13], ["fire_life_safety", 3], ["civil_finishes", 15], ["doors_hardware", 11], ["structural_crack", 1]
];

export const ROOT_CAUSES_FOR: Record<Exclude<Category, "ppm">, Array<[RootCause, number]>> = {
  ac_not_cooling: [["actuator_failed", 6], ["thermostat_fault", 14], ["filter_clogged", 16], ["chw_low_flow", 10], ["fan_motor_failed", 6], ["misuse", 4]],
  ac_noise_leak: [["condensate_blocked", 20], ["fan_motor_failed", 6], ["filter_clogged", 6], ["workmanship", 6]],
  water_leak: [["pipe_joint_leak", 14], ["sealant_failure", 10], ["workmanship", 8], ["tenant_damage", 4]],
  electrical: [["breaker_tripped", 14], ["workmanship", 6], ["misuse", 6], ["wear_and_tear", 3]],
  lift: [["door_operator_fault", 12], ["wear_and_tear", 4], ["misuse", 4]],
  plumbing: [["pipe_joint_leak", 10], ["workmanship", 8], ["consumable", 8], ["misuse", 6]],
  fire_life_safety: [["workmanship", 6], ["wear_and_tear", 4]],
  civil_finishes: [["workmanship", 16], ["sealant_failure", 6], ["tenant_damage", 6], ["wear_and_tear", 4]],
  doors_hardware: [["workmanship", 10], ["wear_and_tear", 6], ["misuse", 6]],
  structural_crack: [["workmanship", 2]]
};

export const CATEGORY_TRADE: Record<Category, Trade> = {
  ac_not_cooling: "hvac", ac_noise_leak: "hvac", water_leak: "plumbing", electrical: "electrical", lift: "lifts",
  plumbing: "plumbing", fire_life_safety: "fire", civil_finishes: "finishes", doors_hardware: "finishes",
  structural_crack: "finishes", ppm: "hvac"
};

export const CATEGORY_TITLES: Record<Category, Bilingual[]> = {
  ac_not_cooling: [{ en: "AC not cooling", ar: "المكيف لا يبرد" }, { en: "Weak cooling in bedroom", ar: "تبريد ضعيف في غرفة النوم" }, { en: "Room temperature not dropping", ar: "حرارة الغرفة لا تنخفض" }],
  ac_noise_leak: [{ en: "AC dripping water", ar: "المكيف يسرب ماء" }, { en: "Noisy fan coil", ar: "صوت مرتفع من وحدة التكييف" }],
  water_leak: [{ en: "Water leak from ceiling", ar: "تسرب ماء من السقف" }, { en: "Leak under kitchen sink", ar: "تسرب تحت مغسلة المطبخ" }],
  electrical: [{ en: "Power trip in kitchen", ar: "انقطاع الكهرباء في المطبخ" }, { en: "Socket not working", ar: "مقبس كهربائي لا يعمل" }],
  lift: [{ en: "Lift door not closing", ar: "باب المصعد لا يغلق" }, { en: "Lift out of service", ar: "المصعد متوقف" }],
  plumbing: [{ en: "Blocked drain", ar: "انسداد في الصرف" }, { en: "Low water pressure", ar: "ضغط ماء منخفض" }],
  fire_life_safety: [{ en: "Smoke detector fault", ar: "عطل في كاشف الدخان" }, { en: "Fire alarm trouble signal", ar: "إشارة عطل في إنذار الحريق" }],
  civil_finishes: [{ en: "Cracked floor tile", ar: "بلاط أرضية مكسور" }, { en: "Paint peeling in bathroom", ar: "تقشر الطلاء في الحمام" }],
  doors_hardware: [{ en: "Door lock jammed", ar: "قفل الباب عالق" }, { en: "Wardrobe hinge broken", ar: "مفصلة الخزانة مكسورة" }],
  structural_crack: [{ en: "Crack in balcony slab soffit", ar: "شرخ في سقف بلاطة الشرفة" }],
  ppm: [{ en: "Planned maintenance", ar: "صيانة مخططة" }]
};

/** What residents / callers actually say (DEMO). One is picked per request, in the reporter's language. */
export const CATEGORY_DESCRIPTIONS: Record<Category, Bilingual[]> = {
  ac_not_cooling: [
    { en: "AC running all day but the living room is still 28°C. Fan is on high.", ar: "المكيف يعمل طوال اليوم لكن حرارة الصالة ما زالت 28 درجة، والمروحة على السرعة القصوى." },
    { en: "Air coming out is warm since this morning. Thermostat set to 21.", ar: "الهواء الخارج دافئ منذ الصباح، ومنظم الحرارة مضبوط على 21." },
    { en: "Bedroom AC not cooling at night, kids can't sleep.", ar: "مكيف غرفة النوم لا يبرد ليلًا والأطفال لا يستطيعون النوم." }
  ],
  ac_noise_leak: [
    { en: "Water dripping from the AC grille onto the floor.", ar: "ماء يتقطر من فتحة المكيف على الأرض." },
    { en: "Loud rattling from the fan coil above the kitchen.", ar: "صوت قرقعة مرتفع من وحدة التكييف فوق المطبخ." }
  ],
  water_leak: [
    { en: "Water stain spreading on the ceiling, dripping near the light.", ar: "بقعة ماء تتسع في السقف وتقطر قرب الإنارة." },
    { en: "Leak under the kitchen sink, cabinet base is wet.", ar: "تسرب تحت مغسلة المطبخ وقاعدة الخزانة مبللة." }
  ],
  electrical: [
    { en: "Kitchen sockets trip every time the kettle is on.", ar: "مقابس المطبخ تفصل كلما شغلت الغلاية." },
    { en: "Two sockets in the bedroom have no power.", ar: "مقبسان في غرفة النوم بلا كهرباء." }
  ],
  lift: [
    { en: "Lift door reopens again and again before closing.", ar: "باب المصعد يعيد الفتح مرارًا قبل أن يغلق." },
    { en: "Lift stuck on level 9, showing out of service.", ar: "المصعد متوقف في الطابق 9 ويظهر خارج الخدمة." }
  ],
  plumbing: [
    { en: "Shower drain very slow, water pooling.", ar: "تصريف الدش بطيء جدًا والماء يتجمع." },
    { en: "Very low water pressure in the bathroom taps.", ar: "ضغط الماء ضعيف جدًا في صنابير الحمام." }
  ],
  fire_life_safety: [
    { en: "Smoke detector chirping in the corridor.", ar: "كاشف الدخان في الممر يصدر صفيرًا متقطعًا." },
    { en: "Fire panel showing a trouble signal on zone 4.", ar: "لوحة الحريق تظهر إشارة عطل في المنطقة 4." }
  ],
  civil_finishes: [
    { en: "Floor tile cracked near the balcony door.", ar: "بلاطة مكسورة قرب باب الشرفة." },
    { en: "Paint bubbling and peeling on the bathroom ceiling.", ar: "الطلاء منتفخ ويتقشر في سقف الحمام." }
  ],
  doors_hardware: [
    { en: "Main door lock is jammed, key won't turn.", ar: "قفل الباب الرئيسي عالق والمفتاح لا يدور." },
    { en: "Wardrobe door hinge broke, door hanging.", ar: "مفصلة باب الخزانة مكسورة والباب متدلٍ." }
  ],
  structural_crack: [
    { en: "Diagonal crack in the balcony slab soffit, getting longer.", ar: "شرخ مائل في سقف بلاطة الشرفة ويزداد طولًا." }
  ],
  ppm: [{ en: "Planned maintenance visit.", ar: "زيارة صيانة مخططة." }]
};
