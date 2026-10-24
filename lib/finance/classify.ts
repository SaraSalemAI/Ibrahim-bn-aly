import type { Category } from "./types";

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

/** Egyptian unified chart-of-accounts style prefixes as a last resort: 1 assets, 2 liabilities, 3 equity, 4 revenue, 5+ expenses. */
export function suggestCategory(code: string, name: string): Category | "" {
  for (const [category, re] of RULES) {
    if (re.test(name)) return category;
  }
  const first = code.trim()[0];
  if (first === "4") return "REVENUE";
  if (first === "3") return "OTHER_EQUITY";
  return "";
}
