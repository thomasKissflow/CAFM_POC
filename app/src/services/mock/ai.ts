// "AI preview" features, mocked with deterministic heuristics over the demo data.
// Labelled as preview in the UI: Kissflow runtime AI is unverified (PLAN.md §6.1, Q22).
import { classifyLiability } from "@/domain/liability";
import { priorityFor } from "@/domain/sla";
import { DAY, ms } from "@/domain/time";
import type { Bilingual, Category, ComplianceItem, Rag, RootCause } from "@/domain/types";
import type { AiService, AskAnswer, DiagnosisContext, DiagnosisHypothesis, DlpSummary } from "../types";
import type { Db } from "./seed";
import { ROOT_CAUSES_FOR } from "./reference";

interface Deps {
  getDb: () => Db;
  now: () => number;
  diagnosis: (assetId: string, asOf?: string) => DiagnosisContext | undefined;
  dlpSummary: () => DlpSummary;
  complianceRag: (c: ComplianceItem, at: number) => Rag;
}

const think = (msec = 750) => new Promise((r) => setTimeout(r, msec));

const LEXICON: Array<{ category: Category; words: string[] }> = [
  { category: "ac_noise_leak", words: ["drip", "dripping", "noise", "noisy", "يسرب", "تسريب من المكيف", "صوت"] },
  { category: "ac_not_cooling", words: ["ac", "a/c", "aircon", "air con", "cool", "cooling", "hot", "warm", "temperature", "مكيف", "المكيف", "تبريد", "يبرد", "حار", "حرارة", "الحرارة", "التكييف"] },
  { category: "water_leak", words: ["leak", "leaking", "ceiling", "water", "flood", "تسرب", "ماء", "السقف"] },
  { category: "electrical", words: ["power", "socket", "trip", "tripped", "electric", "light", "كهرباء", "الكهرباء", "مقبس", "انقطاع", "إنارة"] },
  { category: "lift", words: ["lift", "elevator", "مصعد", "المصعد"] },
  { category: "plumbing", words: ["drain", "blocked", "toilet", "flush", "pressure", "صرف", "انسداد", "مرحاض", "ضغط"] },
  { category: "fire_life_safety", words: ["smoke", "fire", "alarm", "detector", "دخان", "حريق", "إنذار"] },
  { category: "doors_hardware", words: ["door", "lock", "hinge", "handle", "باب", "قفل", "مفصلة"] },
  { category: "civil_finishes", words: ["tile", "paint", "wall", "plaster", "بلاط", "طلاء", "جدار"] }
];

const KNOWN_TRANSLATIONS: Array<{ match: string; en: string }> = [
  { match: "المكيف لا يبرد أبدًا", en: "The AC hasn't been cooling at all since the morning; it's 29 degrees inside the flat. I have a small child, please hurry." }
];

function score(text: string) {
  const t = ` ${text.toLowerCase()} `;
  return LEXICON.map((entry) => {
    const hits = entry.words.filter((w) => t.includes(w.length <= 3 ? ` ${w} ` : w));
    return { category: entry.category, hits };
  }).sort((a, b) => b.hits.length - a.hits.length);
}

export function createMockAi(d: Deps): AiService {
  return {
    async triage(text, lang, ctx) {
      await think(900);
      const db = d.getDb();
      const ranked = score(text);
      let top = ranked[0];
      // "AC" + dripping means a leak from the unit, not a cooling fault
      if (top.category === "ac_not_cooling" && ranked.find((r) => r.category === "ac_noise_leak" && r.hits.length > 0)) {
        top = ranked.find((r) => r.category === "ac_noise_leak")!;
      }
      if (/crack|شرخ/.test(text) && /slab|beam|column|balcony|بلاطة|عمود|شرفة/.test(text)) {
        top = { category: "structural_crack", hits: ["crack"] };
      }
      const category: Category = top.hits.length ? top.category : "civil_finishes";
      const confidence = top.hits.length ? Math.min(0.97, 0.62 + top.hits.length * 0.12) : 0.35;
      const { priority, summerUplift } = priorityFor(category, ctx.at);
      const site = db.sites.find((s) => s.id === ctx.siteId)!;
      const asset = ctx.unitId && (category === "ac_not_cooling" || category === "ac_noise_leak")
        ? db.assets.find((a) => a.unitId === ctx.unitId && a.assetClass === "FCU")
        : undefined;
      const sub = asset ? db.subcontractors.find((s) => s.id === asset.installedBy) : undefined;
      const lia = classifyLiability({ site, asset, category, reportedAt: ctx.at, subcontractorName: sub?.name });
      const known = KNOWN_TRANSLATIONS.find((k) => text.includes(k.match));
      const translation: Bilingual | undefined = lang === "ar"
        ? { en: known ? known.en : `Gist: ${category.replace(/_/g, " ")} reported (${top.hits.join(", ") || "no clear keywords"})`, ar: text }
        : undefined;
      return {
        category, confidence, priority, summerUplift, assetId: asset?.id, liability: lia.liability, translation,
        signals: top.hits.slice(0, 5),
        rationale: {
          en: `Matched ${top.hits.length || "no"} cue${top.hits.length === 1 ? "" : "s"}${asset ? `; unit ${asset.tag} is ${lia.liability === "DLP" ? "inside" : "outside"} DLP` : ""}${summerUplift ? "; summer rule applies" : ""}.`,
          ar: `تم رصد ${top.hits.length || "لا"} مؤشرات${asset ? `؛ الوحدة ${asset.tag} ${lia.liability === "DLP" ? "ضمن" : "خارج"} فترة المسؤولية` : ""}${summerUplift ? "؛ تنطبق قاعدة الصيف" : ""}.`
        }
      };
    },

    async diagnose(workOrderId) {
      await think(1100);
      const db = d.getDb();
      const wo = db.workOrders.find((w) => w.id === workOrderId);
      if (wo === undefined) return [];
      const ctx = wo.assetId ? d.diagnosis(wo.assetId, wo.reportedAt) : undefined;
      const out: DiagnosisHypothesis[] = [];
      if (ctx && ctx.siblingFailures.length > 0) {
        out.push({
          rootCause: "actuator_failed", confidence: 0.64,
          evidence: {
            en: `${ctx.siblingFailures.length} sibling units in batch ${ctx.batch} failed with CHW valve actuator faults in the last 45 days.`,
            ar: `${ctx.siblingFailures.length} وحدات من الدفعة ${ctx.batch} تعطلت بسبب مشغل صمام المياه المبردة خلال آخر 45 يومًا.`
          }
        });
      }
      const prevThermo = ctx?.previous.find((p) => p.rootCause === "thermostat_fault");
      if (prevThermo) {
        out.push({
          rootCause: "thermostat_fault", confidence: 0.14,
          evidence: {
            en: `Thermostat was recalibrated on ${prevThermo.at.slice(0, 10)}. Recurrence suggests it was not the root cause.`,
            ar: `تمت معايرة منظم الحرارة في ${prevThermo.at.slice(0, 10)}، وتكرار العطل يشير إلى أنه لم يكن السبب الجذري.`
          }
        });
      }
      const base = ROOT_CAUSES_FOR[wo.category as Exclude<Category, "ppm">] ?? [];
      const total = base.reduce((s, [, w]) => s + w, 0);
      for (const [rc, w] of base) {
        if (out.find((o) => o.rootCause === rc)) continue;
        out.push({ rootCause: rc, confidence: (w / total) * (out.length ? 0.22 : 0.9), evidence: { en: "Typical for this fault type across the portfolio.", ar: "شائع لهذا النوع من الأعطال عبر المحفظة." } });
      }
      return out.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
    },

    async draftCloseout(workOrderId, rootCause: RootCause) {
      await think(800);
      const db = d.getDb();
      const wo = db.workOrders.find((w) => w.id === workOrderId);
      const asset = wo?.assetId ? db.assets.find((a) => a.id === wo.assetId) : undefined;
      const tag = asset?.tag ?? "the unit";
      if (rootCause === "actuator_failed") {
        return {
          en: `Attended ${tag}. Supply air measured 24°C against a 22°C set-point. Thermostat and filter checked OK. CHW control valve actuator gave no stroke on demand; replaced like-for-like. Supply air 13.5°C after 20 minutes. Occupant briefed and signed. Defect falls within DLP; back-charge to installer.`,
          ar: `تمت زيارة ${tag}. حرارة هواء الإمداد 24°م مقابل ضبط 22°م. تم فحص منظم الحرارة والفلتر وهما سليمان. مشغل صمام المياه المبردة لا يستجيب؛ تم استبداله بمثيله. أصبحت حرارة الهواء 13.5°م بعد 20 دقيقة. تم إبلاغ الساكن وتوقيعه. العيب ضمن فترة المسؤولية ويُحمّل على المقاول المُركِّب.`
        };
      }
      if (rootCause === "filter_clogged") {
        return {
          en: `Attended ${tag}. Filter heavily clogged, restricting airflow; cleaned and refitted. Supply air 14°C after 15 minutes. Consumable item: excluded from DLP, chargeable under the FM contract.`,
          ar: `تمت زيارة ${tag}. الفلتر مسدود بشدة ويعيق تدفق الهواء؛ تم تنظيفه وإعادة تركيبه. حرارة هواء الإمداد 14°م بعد 15 دقيقة. بند استهلاكي مستثنى من فترة المسؤولية ويُحتسب ضمن عقد إدارة المرافق.`
        };
      }
      return {
        en: `Attended ${tag}. Root cause: ${rootCause.replace(/_/g, " ")}. Rectified, tested and area left clean. Occupant briefed.`,
        ar: `تمت زيارة ${tag}. السبب الجذري: ${rootCause}. تم الإصلاح والاختبار وترك المكان نظيفًا وإبلاغ الساكن.`
      };
    },

    suggestedQuestions() {
      return [
        { en: "Which subcontractor costs us most in DLP?", ar: "أي مقاول من الباطن يكلفنا أكثر في فترة المسؤولية؟" },
        { en: "What is breaching SLA right now?", ar: "ما الطلبات التي تتجاوز اتفاقية مستوى الخدمة الآن؟" },
        { en: "Which assets keep failing?", ar: "ما الأصول التي تتكرر أعطالها؟" },
        { en: "Which certificates expire in the next 45 days?", ar: "ما الشهادات التي تنتهي خلال 45 يومًا؟" }
      ];
    },

    async ask(question): Promise<AskAnswer> {
      await think(1000);
      const db = d.getDb();
      const q = question.toLowerCase();
      const at = d.now();
      if (/subcon|contractor|dlp|recover|مقاول|المسؤولية/.test(q)) {
        const s = d.dlpSummary();
        const top = s.bySubcontractor.slice(0, 4);
        const first = db.subcontractors.find((x) => x.id === top[0]?.subcontractorId);
        return {
          answer: {
            en: `${first?.name ?? "—"} carries the most DLP cost: ${top[0]?.jobs ?? 0} DLP jobs, AED ${Math.round((top[0]?.recoveredAed ?? 0) + (top[0]?.pendingAed ?? 0)).toLocaleString("en")} back-charged. Most of it is HVAC in summer.`,
            ar: `يتحمل ${first?.nameAr ?? "—"} أعلى تكلفة ضمن فترة المسؤولية: ${top[0]?.jobs ?? 0} طلبًا بقيمة ${Math.round((top[0]?.recoveredAed ?? 0) + (top[0]?.pendingAed ?? 0)).toLocaleString("en")} درهم، معظمها أعمال تكييف صيفية.`
          },
          rows: top.map((r) => ({ label: db.subcontractors.find((x) => x.id === r.subcontractorId)?.name ?? r.subcontractorId, value: `AED ${Math.round(r.recoveredAed + r.pendingAed).toLocaleString("en")}` })),
          link: { to: "/dlp", label: { en: "Open DLP register", ar: "فتح سجل فترة المسؤولية" } },
          sources: ["backCharges", "workOrders"]
        };
      }
      if (/breach|sla|late|overdue|تتجاوز|متأخر|الخدمة/.test(q)) {
        const open = db.workOrders.filter((w) => ["new", "assigned", "accepted", "in_progress", "on_hold"].includes(w.status));
        const breached = open.filter((w) => ms(w.resolveDueAt) < at);
        return {
          answer: {
            en: `${breached.length} open jobs are past their resolution target, and ${open.filter((w) => ms(w.resolveDueAt) >= at && ms(w.resolveDueAt) - at < 2 * 3600e3).length} more will breach within 2 hours.`,
            ar: `${breached.length} طلبات مفتوحة تجاوزت موعد الحل، و${open.filter((w) => ms(w.resolveDueAt) >= at && ms(w.resolveDueAt) - at < 2 * 3600e3).length} أخرى ستتجاوزه خلال ساعتين.`
          },
          rows: breached.slice(0, 5).map((w) => ({ label: `${w.ref} · ${w.title.en}`, value: w.priority })),
          link: { to: "/queue?view=board", label: { en: "Open SLA board", ar: "فتح لوحة مستوى الخدمة" } },
          sources: ["workOrders"]
        };
      }
      if (/repeat|again|keep|recurr|تتكرر|متكرر/.test(q)) {
        const counts = new Map<string, number>();
        db.workOrders.filter((w) => w.assetId && ms(w.reportedAt) > at - 60 * DAY).forEach((w) => counts.set(w.assetId!, (counts.get(w.assetId!) ?? 0) + 1));
        const top = [...counts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return {
          answer: {
            en: `${top.length} assets had repeat faults in the last 60 days. FCU-1402-01 is the one to watch: two visits, two different diagnoses, and siblings in the same batch failing on actuators.`,
            ar: `${top.length} أصول تكررت أعطالها خلال 60 يومًا. الوحدة FCU-1402-01 تستحق المتابعة: زيارتان بتشخيصين مختلفين، ووحدات من الدفعة نفسها تعطلت بسبب المشغلات.`
          },
          rows: top.map(([id, c]) => ({ label: db.assets.find((a) => a.id === id)?.tag ?? id, value: `${c}×` })),
          link: { to: "/assets/A-QMR-FCU-1402-01", label: { en: "Open Asset 360: FCU-1402-01", ar: "فتح ملف الأصل FCU-1402-01" } },
          sources: ["workOrders", "assets"]
        };
      }
      if (/cert|expir|compliance|شهاد|تنتهي|الامتثال/.test(q)) {
        const soon = db.compliance.filter((c) => ms(c.expiresAt) - at < 45 * DAY).sort((a, b) => ms(a.expiresAt) - ms(b.expiresAt));
        return {
          answer: {
            en: `${soon.length} compliance items expire or are already overdue within 45 days. ${soon.filter((c) => d.complianceRag(c, at) === "red").length} are red today.`,
            ar: `${soon.length} بنود امتثال تنتهي أو متأخرة خلال 45 يومًا، منها ${soon.filter((c) => d.complianceRag(c, at) === "red").length} باللون الأحمر اليوم.`
          },
          rows: soon.slice(0, 6).map((c) => ({ label: `${db.sites.find((s) => s.id === c.siteId)?.code} · ${c.system.replace(/_/g, " ")}`, value: c.expiresAt.slice(0, 10) })),
          link: { to: "/compliance", label: { en: "Open compliance wall", ar: "فتح لوحة الامتثال" } },
          sources: ["compliance"]
        };
      }
      if (/fleet|crane|plant|equipment|معدات|رافعة|الأسطول/.test(q)) {
        const down = db.equipment.filter((e) => e.status === "breakdown" || e.status === "service");
        const tpi = db.equipment.filter((e) => e.tpiExpiry && ms(e.tpiExpiry) < at);
        return {
          answer: {
            en: `${down.length} machines are down or in service; ${tpi.length} lifting machines have an overdue third-party inspection and must not lift.`,
            ar: `${down.length} معدات متوقفة أو في الصيانة؛ و${tpi.length} من معدات الرفع تجاوزت موعد الفحص المستقل ويجب عدم تشغيلها.`
          },
          rows: tpi.map((e) => ({ label: `${e.fleetNo} · ${e.model}`, value: e.tpiExpiry!.slice(0, 10) })),
          link: { to: "/fleet", label: { en: "Open plant & fleet", ar: "فتح المعدات والأسطول" } },
          sources: ["equipment"]
        };
      }
      return {
        answer: {
          en: "In this preview I can answer questions about SLA breaches, DLP cost by subcontractor, repeat faults, expiring certificates and fleet status.",
          ar: "في هذه المعاينة يمكنني الإجابة عن تجاوزات مستوى الخدمة، وتكلفة فترة المسؤولية حسب المقاول، والأعطال المتكررة، والشهادات المنتهية، وحالة الأسطول."
        },
        sources: []
      };
    },

    async reportNarrative(r) {
      await think(900);
      const site = d.getDb().sites.find((s) => s.id === r.siteId);
      const top = r.byCategory[0];
      return {
        en: `${site?.name.en} logged ${r.totals.raised} requests in ${r.month}, ${r.totals.closed} closed. ${r.totals.slaPct}% met the resolution target and ${r.totals.responsePct}% the response target. ${top ? `${top.category.replace(/_/g, " ")} led demand (${top.count}), in line with the summer cooling peak.` : ""} ${r.totals.dlpJobs} jobs fell within DLP and were routed to the installing subcontractors at no cost to the owner; AED ${r.totals.recoveredAed.toLocaleString("en")} was recovered. PPM completion was ${r.ppm.pct}%. Every figure above is computed from ${r.eventsLogged.toLocaleString("en")} logged events.`,
        ar: `سجّل ${site?.name.ar} عدد ${r.totals.raised} طلبًا في ${r.month}، أُغلق منها ${r.totals.closed}. حقق ${r.totals.slaPct}% هدف الحل و${r.totals.responsePct}% هدف الاستجابة. ${r.totals.dlpJobs} طلبًا كانت ضمن فترة المسؤولية ووُجّهت إلى المقاولين المُركِّبين دون تكلفة على المالك، واستُرد ${r.totals.recoveredAed.toLocaleString("en")} درهم. بلغت نسبة إنجاز الصيانة المخططة ${r.ppm.pct}%. كل رقم أعلاه محسوب من ${r.eventsLogged.toLocaleString("en")} حدثًا مسجلًا.`
      };
    },

    async extractFromChat() {
      await think(1400);
      return [
        { messageIds: ["c2", "c3", "c9", "c10", "c11"], siteId: "S-QMR", unitLabel: "1402", category: "ac_not_cooling", summary: { en: "Apt 1402: AC not cooling (repeat), resident called twice", ar: "شقة 1402: المكيف لا يبرد (متكرر)، اتصل الساكن مرتين" }, firstContact: "08:40" },
        { messageIds: ["c5"], siteId: "S-QMR", unitLabel: "2207", category: "water_leak", summary: { en: "Apt 2207: water leak from ceiling", ar: "شقة 2207: تسرب ماء من السقف" }, firstContact: "09:52" },
        { messageIds: ["c5"], siteId: "S-QMR", unitLabel: "Lift B", category: "lift", summary: { en: "Lift B: door not closing (again)", ar: "المصعد B: الباب لا يغلق (مرة أخرى)" }, firstContact: "09:52" }
      ];
    }
  };
}
