import type { PeriodFigures } from "./engine";
import type { Framework } from "./adjustments";

export const MGMT = "[Management Disclosure Required]";
export const MGMT_AR = "[مطلوب إفصاح من الإدارة]";

export type NoteStatus = "DRAFT" | "REVIEWED" | "SIGNED_OFF";

export interface NoteContext {
  cur: PeriodFigures;
  prior: PeriodFigures | null;
  framework: Framework;
  currency: string;
  fmt: (n: number) => string;
  ecl: { total: number; ecl: number } | null;
  far: { openingCost: number; additions: number; disposals: number; closingCost: number; depreciationCharge: number; carryingAmount: number } | null;
  inventoryWriteDown: number | null;
  goingConcernFlag: boolean;
  taxPayable: number | null;
  deferredTax: { net: number; position: "DTA" | "DTL" } | null;
}

export interface NoteDef {
  id: string;
  title: [string, string];
  standard: string;
  trigger: (c: NoteContext) => boolean;
  body: (c: NoteContext, lang: "en" | "ar") => string;
}

const cmp = (c: NoteContext, k: keyof PeriodFigures, lang: "en" | "ar") => {
  const v = `${c.fmt(c.cur[k])} ${c.currency}`;
  if (!c.prior) return v;
  return lang === "ar" ? `${v} (العام السابق: ${c.fmt(c.prior[k])} ${c.currency})` : `${v} (prior year: ${c.fmt(c.prior[k])} ${c.currency})`;
};
const fw = (c: NoteContext, lang: "en" | "ar") =>
  c.framework === "EAS" ? (lang === "ar" ? "معايير المحاسبة المصرية" : "Egyptian Accounting Standards (EAS)") : lang === "ar" ? "المعايير الدولية للتقارير المالية" : "International Financial Reporting Standards (IFRS)";
const M = (lang: "en" | "ar") => (lang === "ar" ? MGMT_AR : MGMT);

export const NOTES: NoteDef[] = [
  {
    id: "basis",
    title: ["Basis of preparation and accounting policies", "أسس الإعداد والسياسات المحاسبية"],
    standard: "EAS 1 / IAS 1",
    trigger: () => true,
    body: (c, l) =>
      l === "ar"
        ? `أُعدت القوائم المالية وفقًا لـ${fw(c, l)} وعلى أساس التكلفة التاريخية. عملة العرض هي ${c.currency}. السياسات المحاسبية الهامة: ${M(l)}.`
        : `The financial statements have been prepared in accordance with ${fw(c, l)} under the historical cost convention. The presentation currency is ${c.currency}. Significant accounting policies: ${M(l)}.`,
  },
  {
    id: "goingConcern",
    title: ["Going concern", "الاستمرارية"],
    standard: "EAS 1 / IAS 1.25",
    trigger: (c) => c.goingConcernFlag,
    body: (c, l) =>
      l === "ar"
        ? `تشير المؤشرات المحسوبة (حقوق ملكية ${c.fmt(c.cur.totalEquity)} ${c.currency} أو مؤشر Altman في نطاق الخطر) إلى ضرورة تقييم الاستمرارية. تقييم الإدارة وخططها: ${M(l)}.`
        : `Calculated indicators (total equity ${c.fmt(c.cur.totalEquity)} ${c.currency} and/or an Altman score in the distress zone) require a going-concern assessment. Management's assessment and plans: ${M(l)}.`,
  },
  {
    id: "cash",
    title: ["Cash and cash equivalents", "النقدية وما في حكمها"],
    standard: "EAS 4 / IAS 7",
    trigger: (c) => c.cur.cash !== 0,
    body: (c, l) =>
      l === "ar"
        ? `بلغ رصيد النقدية وما في حكمها ${cmp(c, "cash", l)}. التوزيع بين الصندوق والحسابات الجارية والودائع والقيود على استخدام النقدية: ${M(l)}.`
        : `Cash and cash equivalents amounted to ${cmp(c, "cash", l)}. Split between cash on hand, current accounts and deposits, and any restrictions: ${M(l)}.`,
  },
  {
    id: "receivables",
    title: ["Trade receivables and expected credit losses", "العملاء وخسائر الائتمان المتوقعة"],
    standard: "EAS 47 / IFRS 9",
    trigger: (c) => c.cur.receivables !== 0,
    body: (c, l) => {
      const ecl = c.ecl
        ? l === "ar"
          ? ` وفقًا لمصفوفة المخصصات، بلغت خسائر الائتمان المتوقعة ${c.fmt(c.ecl.ecl)} ${c.currency} من إجمالي أرصدة قائمة ${c.fmt(c.ecl.total)} ${c.currency}.`
          : ` Under the provision matrix, expected credit losses are ${c.fmt(c.ecl.ecl)} ${c.currency} on outstanding balances of ${c.fmt(c.ecl.total)} ${c.currency}.`
        : l === "ar"
          ? ` لم يتم تحميل دفتر العملاء التحليلي، لذا لا يمكن حساب خسائر الائتمان المتوقعة.`
          : ` The AR subledger has not been loaded, so expected credit losses are not calculated.`;
      return l === "ar"
        ? `بلغ رصيد العملاء ${cmp(c, "receivables", l)}.${ecl} الافتراضات المستقبلية المستخدمة في نموذج الخسائر: ${M(l)}.`
        : `Trade receivables were ${cmp(c, "receivables", l)}.${ecl} Forward-looking assumptions in the loss model: ${M(l)}.`;
    },
  },
  {
    id: "inventories",
    title: ["Inventories", "المخزون"],
    standard: "EAS 2 / IAS 2",
    trigger: (c) => c.cur.inventory !== 0,
    body: (c, l) => {
      const wd =
        c.inventoryWriteDown === null
          ? l === "ar" ? "لم يتم إجراء اختبار صافي القيمة البيعية (دفتر المخزون غير محمل)." : "No net realisable value test was performed (inventory subledger not loaded)."
          : l === "ar" ? `بلغ تخفيض المخزون إلى صافي القيمة البيعية ${c.fmt(c.inventoryWriteDown)} ${c.currency}.` : `The write-down to net realisable value is ${c.fmt(c.inventoryWriteDown)} ${c.currency}.`;
      return l === "ar"
        ? `يُقاس المخزون بالتكلفة أو صافي القيمة البيعية أيهما أقل، وبلغ ${cmp(c, "inventory", l)}. ${wd} طريقة تحديد التكلفة: ${M(l)}.`
        : `Inventories are measured at the lower of cost and net realisable value and amounted to ${cmp(c, "inventory", l)}. ${wd} Cost formula used: ${M(l)}.`;
    },
  },
  {
    id: "ppe",
    title: ["Property, plant and equipment", "الأصول الثابتة"],
    standard: "EAS 10 / IAS 16",
    trigger: (c) => c.cur.ppeGross !== 0,
    body: (c, l) => {
      const rf = c.far
        ? l === "ar"
          ? ` حركة التكلفة من سجل الأصول: رصيد أول المدة ${c.fmt(c.far.openingCost)}، إضافات ${c.fmt(c.far.additions)}، استبعادات ${c.fmt(c.far.disposals)}، رصيد آخر المدة ${c.fmt(c.far.closingCost)}؛ إهلاك العام ${c.fmt(c.far.depreciationCharge)}.`
          : ` Cost roll-forward from the asset register: opening ${c.fmt(c.far.openingCost)}, additions ${c.fmt(c.far.additions)}, disposals ${c.fmt(c.far.disposals)}, closing ${c.fmt(c.far.closingCost)}; depreciation charge ${c.fmt(c.far.depreciationCharge)}.`
        : "";
      return l === "ar"
        ? `بلغت تكلفة الأصول الثابتة ${cmp(c, "ppeGross", l)} ومجمع الإهلاك ${cmp(c, "accumulatedDepreciation", l)}.${rf} الأعمار الإنتاجية وطرق الإهلاك والأصول المرهونة: ${M(l)}.`
        : `PP&E at cost was ${cmp(c, "ppeGross", l)} with accumulated depreciation of ${cmp(c, "accumulatedDepreciation", l)}.${rf} Useful lives, depreciation methods and assets pledged as security: ${M(l)}.`;
    },
  },
  {
    id: "borrowings",
    title: ["Borrowings", "القروض والتسهيلات"],
    standard: "EAS 25 / IFRS 7",
    trigger: (c) => c.cur.shortTermDebt + c.cur.longTermDebt !== 0,
    body: (c, l) =>
      l === "ar"
        ? `القروض قصيرة الأجل ${cmp(c, "shortTermDebt", l)} والقروض طويلة الأجل ${cmp(c, "longTermDebt", l)}. أسعار الفائدة والضمانات والتعهدات وجداول السداد: ${M(l)}.`
        : `Short-term borrowings were ${cmp(c, "shortTermDebt", l)} and long-term borrowings ${cmp(c, "longTermDebt", l)}. Interest rates, security, covenants and repayment profile: ${M(l)}.`,
  },
  {
    id: "provisions",
    title: ["Provisions and contingent liabilities", "المخصصات والالتزامات المحتملة"],
    standard: "EAS 28 / IAS 37",
    trigger: () => true,
    body: (_c, l) =>
      l === "ar"
        ? `القضايا المتداولة والضمانات الصادرة والالتزامات المحتملة الأخرى: ${M(l)}.`
        : `Pending litigation, guarantees issued and other contingent liabilities: ${M(l)}.`,
  },
  {
    id: "relatedParties",
    title: ["Related party transactions", "المعاملات مع الأطراف ذات العلاقة"],
    standard: "EAS 15 / IAS 24",
    trigger: () => true,
    body: (_c, l) =>
      l === "ar"
        ? `طبيعة المعاملات مع الأطراف ذات العلاقة وأرصدتها ومكافآت الإدارة العليا: ${M(l)}.`
        : `Nature, volume and balances of related party transactions and key management compensation: ${M(l)}.`,
  },
  {
    id: "incomeTax",
    title: ["Income tax", "ضريبة الدخل"],
    standard: "EAS 24 / IAS 12",
    trigger: (c) => c.cur.taxExpense !== 0 || c.cur.ebt !== 0,
    body: (c, l) => {
      const dt = c.deferredTax
        ? l === "ar"
          ? ` صافي الضريبة المؤجلة المحسوب: ${c.deferredTax.position === "DTL" ? "التزام" : "أصل"} ${c.fmt(Math.abs(c.deferredTax.net))} ${c.currency}.`
          : ` Calculated net deferred tax ${c.deferredTax.position === "DTL" ? "liability" : "asset"}: ${c.fmt(Math.abs(c.deferredTax.net))} ${c.currency}.`
        : "";
      return l === "ar"
        ? `مصروف ضريبة الدخل ${cmp(c, "taxExpense", l)} على ربح قبل الضريبة ${cmp(c, "ebt", l)}.${dt} الفحص الضريبي والسنوات المفتوحة: ${M(l)}.`
        : `Income tax expense was ${cmp(c, "taxExpense", l)} on profit before tax of ${cmp(c, "ebt", l)}.${dt} Tax inspection status and open years: ${M(l)}.`;
    },
  },
  {
    id: "equity",
    title: ["Share capital and reserves", "رأس المال والاحتياطيات"],
    standard: "EAS 1 / IAS 1.79",
    trigger: (c) => c.cur.shareCapital !== 0,
    body: (c, l) =>
      l === "ar"
        ? `رأس المال المصدر والمدفوع ${cmp(c, "shareCapital", l)} والاحتياطي القانوني ${cmp(c, "legalReserve", l)}. عدد الأسهم والقيمة الاسمية وهيكل المساهمين: ${M(l)}.`
        : `Issued and paid-up share capital was ${cmp(c, "shareCapital", l)} and the legal reserve ${cmp(c, "legalReserve", l)}. Number of shares, nominal value and shareholder structure: ${M(l)}.`,
  },
  {
    id: "subsequentEvents",
    title: ["Events after the reporting period", "الأحداث اللاحقة"],
    standard: "EAS 7 / IAS 10",
    trigger: () => true,
    body: (_c, l) => (l === "ar" ? `الأحداث الهامة بعد تاريخ القوائم المالية: ${M(l)}.` : `Significant events after the reporting date: ${M(l)}.`),
  },
];

export function triggeredNotes(c: NoteContext) {
  return NOTES.filter((n) => n.trigger(c));
}
