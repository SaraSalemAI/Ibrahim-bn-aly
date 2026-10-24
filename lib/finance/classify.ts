import type { Category, TBRow } from "./types";

/**
 * Keyword rules in English and Arabic. Order matters: more specific rules first
 * (e.g. "accumulated depreciation" before "depreciation", "cost of sales" before "sales").
 */
const RULES: Array<[Category, RegExp]> = [
  ["ACCUM_DEPRECIATION", /accumulated depreciation|accum\.? dep|مجمع (ال)?إهلاك|مجمع (ال)?اهلاك/i],
  ["COGS", /cost of (sales|goods|revenue)|cogs|تكلفة (ال)?مبيعات|تكلفة (ال)?إيراد/i],
  ["TAX_EXPENSE", /income tax expense|tax expense|ضريبة (ال)?دخل|ضرائب الدخل/i],
  ["DEPRECIATION", /depreciation|amortization|إهلاك|اهلاك|استهلاك/i],
  ["FINANCE_COST", /finance cost|interest expense|bank charges|مصروفات تمويلية|فوائد مدينة|فوائد/i],
  ["OTHER_INCOME", /other income|interest income|إيرادات أخرى|ايرادات اخرى|إيرادات متنوعة/i],
  ["REVENUE", /revenue|sales|turnover|المبيعات|الإيرادات|ايرادات/i],
  ["SELLING_EXPENSE", /selling|distribution|marketing|بيع|توزيع|تسويق/i],
  ["ADMIN_EXPENSE", /general|administrative|g&a|salaries|rent|عمومية|إدارية|ادارية|أجور|مرتبات|إيجار/i],
  ["CASH", /cash|bank|treasury|نقدية|النقدية|بنوك|البنوك|الصندوق|خزينة/i],
  ["RECEIVABLES", /receivable|debtors|customers|عملاء|العملاء|مدينون|أوراق قبض/i],
  ["INVENTORY", /inventory|stock|مخزون|المخزون|بضاعة/i],
  ["PPE", /property|plant|equipment|fixed assets|machinery|vehicles|أصول ثابتة|الأصول الثابتة|آلات|سيارات|مباني/i],
  ["PAYABLES", /payable|creditors|suppliers|موردون|الموردون|موردين|دائنون|أوراق دفع/i],
  ["SHORT_TERM_DEBT", /overdraft|short[- ]term (loan|bank|facilit)|تسهيلات بنكية|بنوك سحب على المكشوف|قروض قصيرة/i],
  ["LONG_TERM_DEBT", /long[- ]term (loan|debt|borrow)|term loan|قروض طويلة/i],
  ["SHARE_CAPITAL", /share capital|paid[- ]in capital|رأس المال|راس المال/i],
  ["LEGAL_RESERVE", /legal reserve|statutory reserve|احتياطي قانوني|الاحتياطي القانوني/i],
  ["RETAINED_EARNINGS", /retained earnings|accumulated (profit|loss)|أرباح مرحلة|الأرباح المرحلة|ارباح مرحلة/i],
  ["OTHER_CURRENT_LIABILITY", /accrued|accrual|tax payable|vat payable|مستحقة|مصروفات مستحقة|أرصدة دائنة/i],
  ["OTHER_CURRENT_ASSET", /prepaid|prepayment|advance|مدفوعة مقدما|مقدمة|أرصدة مدينة/i],
];

/** Egyptian unified chart-of-accounts style first digit: 1 assets, 2 liabilities, 3 equity, 4 revenue, 5-8 expenses. */
const CLASS_BY_DIGIT: Record<string, "A" | "L" | "E" | "R" | "X"> = { "1": "A", "2": "L", "3": "E", "4": "R", "5": "X", "6": "X", "7": "X", "8": "X" };

export function categoryClass(c: Category): "A" | "L" | "E" | "R" | "X" {
  if (["CASH", "RECEIVABLES", "INVENTORY", "OTHER_CURRENT_ASSET", "PPE", "ACCUM_DEPRECIATION", "OTHER_NON_CURRENT_ASSET"].includes(c)) return "A";
  if (["PAYABLES", "SHORT_TERM_DEBT", "OTHER_CURRENT_LIABILITY", "LONG_TERM_DEBT", "OTHER_NON_CURRENT_LIABILITY"].includes(c)) return "L";
  if (["SHARE_CAPITAL", "LEGAL_RESERVE", "RETAINED_EARNINGS", "OTHER_EQUITY"].includes(c)) return "E";
  if (["REVENUE", "OTHER_INCOME"].includes(c)) return "R";
  return "X";
}

export interface Suggestion {
  category: Category | "";
  /** 0-100. High > 90, medium 60-90, low < 60. */
  confidence: number;
  rule: string;
}

export function suggestMapping(code: string, name: string): Suggestion {
  const digitClass = CLASS_BY_DIGIT[code.trim()[0] ?? ""];
  for (const [category, re] of RULES) {
    if (re.test(name)) {
      const agrees = digitClass === categoryClass(category);
      return { category, confidence: agrees ? 95 : digitClass ? 65 : 85, rule: `keyword:${re.source.split("|")[0]}` };
    }
  }
  if (digitClass === "R") return { category: "REVENUE", confidence: 50, rule: "code-prefix:4" };
  if (digitClass === "E") return { category: "OTHER_EQUITY", confidence: 45, rule: "code-prefix:3" };
  return { category: "", confidence: 0, rule: "none" };
}

export function suggestCategory(code: string, name: string): Category | "" {
  return suggestMapping(code, name).category;
}

export function confidenceBand(c: number | undefined): "high" | "medium" | "low" {
  if (c === undefined || c > 90) return "high";
  return c >= 60 ? "medium" : "low";
}

/** Bulk mapping rule, e.g. prefix "110" → CASH. Returns the updated rows and how many changed. */
export function applyPrefixRule(rows: TBRow[], prefix: string, category: Category | ""): { rows: TBRow[]; changed: number } {
  let changed = 0;
  const p = prefix.replace(/\*$/, "").trim();
  if (!p) return { rows, changed };
  const out = rows.map((r) => {
    if (!r.code.startsWith(p)) return r;
    changed++;
    return { ...r, category, suggested: false, confidence: 100, mappingRule: `bulk:${p}*` };
  });
  return { rows: out, changed };
}
