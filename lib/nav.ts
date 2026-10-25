export interface NavItem {
  n: number;
  href: string;
  en: string;
  ar: string;
  group: "agent" | "setup" | "close" | "plan" | "insight" | "report";
}

export const NAV: NavItem[] = [
  { n: 0, href: "/agent", en: "AI CFO agent", ar: "وكيل المدير المالي", group: "agent" },
  { n: 1, href: "/company", en: "Workspace & company", ar: "مساحة العمل والشركة", group: "setup" },
  { n: 2, href: "/ingest", en: "Ingestion center", ar: "مركز إدخال البيانات", group: "setup" },
  { n: 3, href: "/mapping", en: "Validation & mapping", ar: "التحقق وربط الحسابات", group: "setup" },
  { n: 4, href: "/trial-balance", en: "Trial balance", ar: "ميزان المراجعة", group: "close" },
  { n: 5, href: "/statements", en: "Financial statements", ar: "القوائم المالية", group: "close" },
  { n: 6, href: "/cash-flow", en: "Cash flows", ar: "التدفقات النقدية", group: "close" },
  { n: 7, href: "/budget", en: "Budgeting & BVA", ar: "الموازنة والمقارنة بالفعلي", group: "plan" },
  { n: 8, href: "/model", en: "3-statement model", ar: "النموذج المالي المتكامل", group: "plan" },
  { n: 9, href: "/analysis", en: "Analysis & diagnostics", ar: "التحليل والتشخيص", group: "insight" },
  { n: 10, href: "/scenarios", en: "Scenarios & sensitivity", ar: "السيناريوهات والحساسية", group: "plan" },
  { n: 11, href: "/tax", en: "Egyptian tax (TCS)", ar: "الضريبة المصرية", group: "close" },
  { n: 12, href: "/disclosures", en: "Disclosure studio", ar: "استوديو الإفصاحات", group: "report" },
  { n: 13, href: "/benchmarking", en: "Benchmarking", ar: "المقارنة المرجعية", group: "insight" },
  { n: 14, href: "/valuation", en: "Valuation lab", ar: "مختبر التقييم", group: "insight" },
  { n: 15, href: "/stress", en: "FX & stress tests", ar: "اختبارات الضغط والعملة", group: "insight" },
  { n: 16, href: "/export", en: "Board pack & export", ar: "حزمة مجلس الإدارة والتصدير", group: "report" },
  { n: 17, href: "/audit", en: "Audit trail & lineage", ar: "سجل التدقيق والتتبع", group: "report" },
  { n: 18, href: "/close-review", en: "Close review", ar: "مراجعة الإقفال", group: "close" },
  { n: 19, href: "/trends", en: "Monthly trends", ar: "الاتجاهات الشهرية", group: "insight" },
  { n: 20, href: "/consolidation", en: "Group consolidation", ar: "القوائم المجمعة", group: "close" },
  { n: 21, href: "/team", en: "Team & sync", ar: "الفريق والمزامنة", group: "setup" },
];

export const GROUPS: Record<NavItem["group"], [string, string]> = {
  agent: ["Agent", "الوكيل"],
  setup: ["Set up", "الإعداد"],
  close: ["Close & report", "الإقفال والتقارير"],
  plan: ["Plan & model", "التخطيط والنمذجة"],
  insight: ["Insight", "التحليل"],
  report: ["Governance", "الحوكمة"],
};
