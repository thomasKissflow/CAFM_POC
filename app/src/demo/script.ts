import type { Bilingual, RoleKey } from "@/domain/types";

export type StoryAction = "raise" | "accept" | "resolve_dlp" | "resolve_chargeable" | "close";

export interface Beat {
  id: string;
  label: string; // short index label, e.g. "−1", "0", "2"
  title: Bilingual;
  role: RoleKey;
  /** route, or a function of the story work-order id */
  route: string | ((storyId?: string) => string);
  note: Bilingual;
  action?: StoryAction;
  actionLabel?: Bilingual;
}

const wo = (fallback: string) => (id?: string) => (id ? `/wo/${id}` : fallback);

export const BEATS: Beat[] = [
  {
    id: "before", label: "−1", role: "helpdesk", route: "/before",
    title: { en: "Before: the group chat", ar: "قبل: مجموعة المحادثة" },
    note: {
      en: "This is how most GCC teams run maintenance today: no timestamps, no SLA clock, no asset, no idea who pays. Then press “Replay it structured”.",
      ar: "هكذا تُدار الصيانة لدى معظم الفرق في الخليج اليوم: لا توقيت، لا ساعة مستوى خدمة، لا أصل، ولا أحد يعرف من يدفع. ثم اضغط «أعد العرض بشكل منظم»."
    }
  },
  {
    id: "open", label: "0", role: "executive", route: "/command",
    title: { en: "Open: the command centre", ar: "البداية: مركز القيادة" },
    note: {
      en: "Liability first: money recovered from subcontractors, the DLP chainage for Qamar Residences, and the SLA clocks closest to breach, all computed from the log.",
      ar: "المسؤولية أولًا: المبالغ المستردة من المقاولين، ومسار فترة المسؤولية لمساكن قمر، وساعات مستوى الخدمة الأقرب إلى التجاوز، وكلها محسوبة من السجل."
    }
  },
  {
    id: "handover", label: "1", role: "dlp_manager", route: "/handover",
    title: { en: "Handover: assets from the handover pack", ar: "التسليم: الأصول من ملف التسليم" },
    note: {
      en: "TOC 1 Mar 2026 starts the DLP clock. The asset register came from the handover pack, and unclosed snags were carried into DLP.",
      ar: "بدأت ساعة فترة المسؤولية مع شهادة الاستلام في 1 مارس 2026. سجل الأصول مستورد من ملف التسليم، والملاحظات غير المغلقة رُحّلت إلى فترة المسؤولية."
    }
  },
  {
    id: "raise", label: "2", role: "resident", route: "/me/voice",
    title: { en: "Raise: resident talks to the voice agent", ar: "البلاغ: الساكنة تتحدث مع المساعد الصوتي" },
    note: {
      en: "Layla just talks, in English or Arabic. Press “Play a demo call” (or “Start talking” with a mic). The agent asks short follow-ups, stops the moment she interrupts, fills the job card live, and logs the work order with the SLA clock started at first contact. Typed form is still under “New request”.",
      ar: "ليلى تتحدث فقط بالعربية أو الإنجليزية. اضغط «تشغيل مكالمة تجريبية» (أو «ابدئي الحديث» مع ميكروفون). يطرح المساعد أسئلة قصيرة، ويتوقف فور مقاطعتها، ويملأ بطاقة الطلب مباشرة، ثم يسجل أمر العمل وتبدأ ساعة مستوى الخدمة عند أول تواصل. النموذج المكتوب ما زال متاحًا."
    },
    action: "raise", actionLabel: { en: "Submit Layla's request", ar: "إرسال طلب ليلى" }
  },
  {
    id: "triage", label: "3", role: "helpdesk", route: "/intake",
    title: { en: "Triage: every channel, one stream", ar: "الفرز: كل القنوات في مسار واحد" },
    note: {
      en: "Layla's app request, a neighbour's QR request and a logged phone call arrive in one stream. Summer rule: AC is P2. Liability engine: DLP, 194 days left.",
      ar: "طلب ليلى من التطبيق، وطلب جار عبر QR، ومكالمة مسجلة تصل في مسار واحد. قاعدة الصيف: التكييف P2. محرك المسؤولية: ضمن الفترة، متبقٍ 194 يومًا."
    },
    action: "raise"
  },
  {
    id: "route", label: "4", role: "helpdesk", route: wo("/queue"),
    title: { en: "Route: back-to-back to the installer", ar: "التحويل: إلى المقاول المُركِّب مباشرة" },
    note: {
      en: "The asset record knows who installed FCU-1402-01, so the job routes to Coolbreeze MEP automatically. Point at the liability banner and the running staff gauges.",
      ar: "سجل الأصل يعرف من ركّب الوحدة FCU-1402-01، لذا يُحوَّل الطلب إلى كول بريز تلقائيًا. أشر إلى شريط المسؤولية ومقياس الوقت."
    },
    action: "raise"
  },
  {
    id: "accept", label: "5", role: "subcon_supervisor", route: wo("/queue"),
    title: { en: "Accept: subcontractor dispatches", ar: "القبول: المقاول يرسل الفني" },
    note: {
      en: "Rashid sees only Coolbreeze jobs. He accepts and dispatches Joel. Response SLA met at 42 minutes.",
      ar: "يرى راشد طلبات كول بريز فقط. يقبل ويرسل جويل. تم الالتزام باستجابة مستوى الخدمة خلال 42 دقيقة."
    },
    action: "accept", actionLabel: { en: "Accept & dispatch Joel", ar: "قبول وإرسال جويل" }
  },
  {
    id: "execute", label: "6", role: "technician", route: "/tech/scan",
    title: { en: "Execute: QR, Asset 360, diagnosis challenge", ar: "التنفيذ: QR وملف الأصل وتحدي التشخيص" },
    note: {
      en: "Joel scans the FCU. Pick “thermostat fault” first: the diagnosis challenge shows the repeat fault and two sibling actuator failures. Re-test, confirm actuator, photo, signature. Alternative: pick “filter clogged” to show reclassification to chargeable.",
      ar: "يمسح جويل الوحدة. اختر «عطل منظم الحرارة» أولًا: يظهر تحدي التشخيص بالعطل المتكرر وعطلين في الدفعة نفسها. أعد الاختبار وأكد المشغل ثم الصورة والتوقيع. بديل: اختر «انسداد الفلتر» لإظهار إعادة التصنيف."
    },
    action: "accept", actionLabel: { en: "Make sure the job is dispatched", ar: "تأكد من إرسال المهمة" }
  },
  {
    id: "close", label: "8", role: "helpdesk", route: wo("/queue"),
    title: { en: "Close: verify, and the back-charge raises itself", ar: "الإغلاق: تحقق، وتُرفع مطالبة الاسترداد تلقائيًا" },
    note: {
      en: "Resolved inside SLA. Verifying and closing raises the AED 2,050 back-charge to Coolbreeze: a flow-to-flow automation in Kissflow.",
      ar: "تم الحل ضمن مستوى الخدمة. التحقق والإغلاق يرفعان مطالبة بقيمة 2,050 درهم على كول بريز: أتمتة بين مسارين في كيسفلو."
    },
    action: "close", actionLabel: { en: "Resolve (if needed) & close", ar: "الحل (عند الحاجة) والإغلاق" }
  },
  {
    id: "cost", label: "9", role: "dlp_manager", route: "/dlp",
    title: { en: "Cost: recovered, back-to-back", ar: "التكلفة: مستردة من المقاول" },
    note: {
      en: "Khalid sees the new back-charge at the top of the register, with parts and labour itemised and linked to the work order.",
      ar: "يرى خالد مطالبة الاسترداد الجديدة أعلى السجل، مع تفصيل القطع والعمالة وربطها بأمر العمل."
    }
  },
  {
    id: "rollup", label: "10", role: "executive", route: "/command",
    title: { en: "Roll-up: the batch pattern appears", ar: "التجميع: يظهر نمط الدفعة" },
    note: {
      en: "Three actuator failures in 30 days in batch B07, floors 12–16, all Coolbreeze. That's insight rather than tracking: raise one batch DLP claim.",
      ar: "ثلاثة أعطال مشغلات خلال 30 يومًا في الدفعة B07 بالطوابق 12–16، جميعها من كول بريز. هذه رؤية وليست مجرد تتبع: ارفع مطالبة جماعية واحدة."
    }
  },
  {
    id: "trust", label: "11", role: "fm_manager", route: "/reports",
    title: { en: "Trust: the log writes the client report", ar: "الثقة: السجل يكتب تقرير العميل" },
    note: {
      en: "The monthly report for Qamar Residences comes only from logged events, so every figure drills back. Draft the executive summary with the AI preview.",
      ar: "التقرير الشهري لمساكن قمر مبني على الأحداث المسجلة فقط، وكل رقم يعود لمصدره. صغ الملخص التنفيذي بمعاينة الذكاء الاصطناعي."
    }
  },
  {
    id: "audit", label: "12", role: "compliance", route: "/compliance",
    title: { en: "Audit: ready on demand", ar: "التدقيق: جاهز عند الطلب" },
    note: {
      en: "The sprinkler AMC certificate at Qamar expires in 21 days (amber). Open the audit pack: certificates, PPM evidence and findings in one export.",
      ar: "شهادة عقد صيانة الرشاشات في قمر تنتهي خلال 21 يومًا (كهرماني). افتح ملف التدقيق: الشهادات وإثباتات الصيانة والملاحظات في ملف واحد."
    }
  },
  {
    id: "portfolio", label: "13", role: "plant_manager", route: "/fleet",
    title: { en: "Portfolio: Dutco's own operations", ar: "المحفظة: عمليات دوتكو الداخلية" },
    note: {
      en: "The same app runs Dutco's plant and fleet: CR-014 crawler crane has an overdue third-party inspection, so it must not lift. Then show the Portfolio page with the site office and labour accommodation.",
      ar: "التطبيق نفسه يدير معدات دوتكو: الرافعة المجنزرة CR-014 تجاوزت موعد الفحص المستقل ويُمنع تشغيلها. ثم اعرض صفحة المحفظة مع مكتب الموقع وسكن العمال."
    }
  }
];
