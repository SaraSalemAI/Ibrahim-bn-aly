import type { Category } from "./finance/types";

export const CHECK_LABELS: Record<string, [string, string]> = {
  tbBalanced: ["Trial balance balances", "ميزان المراجعة متوازن"],
  allMapped: ["All accounts mapped", "كل الحسابات مصنفة"],
  mappingConfirmed: ["Mapping confirmed", "تم تأكيد الربط"],
  bsTies: ["Balance sheet ties", "قائمة المركز المالي متوازنة"],
  cashFlowTies: ["Cash flow ties to cash", "التدفقات النقدية تطابق النقدية"],
  subledgersTie: ["Subledgers tie to TB", "الدفاتر التحليلية تطابق الميزان"],
};

export const DOC_LABELS: Record<string, [string, string]> = {
  TRIAL_BALANCE: ["Trial balance", "ميزان المراجعة"],
  GENERAL_LEDGER: ["General ledger", "دفتر الأستاذ العام"],
  AR_SUBLEDGER: ["Receivables (AR) aging", "أعمار العملاء"],
  AP_SUBLEDGER: ["Payables (AP) ledger", "دفتر الموردين"],
  FIXED_ASSETS: ["Fixed asset register", "سجل الأصول الثابتة"],
  INVENTORY: ["Inventory movement", "حركة المخزون"],
  PAYROLL: ["Payroll register", "كشف المرتبات"],
  BANK_STATEMENT: ["Bank statement", "كشف الحساب البنكي"],
  ETA_INVOICE: ["ETA e-invoices", "الفواتير الإلكترونية"],
};

export const TIE_LABELS: Record<string, [string, string]> = {
  ar: ["AR aging vs trade receivables", "أعمار العملاء مقابل رصيد العملاء"],
  ap: ["Open AP vs trade payables", "الموردون المفتوحون مقابل رصيد الموردين"],
  farCost: ["Asset register cost vs PP&E", "تكلفة سجل الأصول مقابل الأصول الثابتة"],
  farAccumDep: ["Register accumulated dep. vs TB", "مجمع إهلاك السجل مقابل الميزان"],
  inventory: ["Inventory valuation vs TB", "تقييم المخزون مقابل الميزان"],
  eta: ["ETA net sales vs GL revenue", "مبيعات منظومة الفاتورة مقابل الإيرادات"],
};


/** Which TB categories make up each statement line, for drill-down. Subtotals have none. */
export const LINE_CATEGORIES: Record<string, Category[]> = {
  revenue: ["REVENUE"],
  cogs: ["COGS"],
  sellingExpenses: ["SELLING_EXPENSE"],
  adminExpenses: ["ADMIN_EXPENSE"],
  depreciation: ["DEPRECIATION"],
  otherIncome: ["OTHER_INCOME"],
  financeCosts: ["FINANCE_COST"],
  taxExpense: ["TAX_EXPENSE"],
  cash: ["CASH"],
  receivables: ["RECEIVABLES"],
  inventory: ["INVENTORY"],
  otherCurrentAssets: ["OTHER_CURRENT_ASSET"],
  ppeGross: ["PPE"],
  accumulatedDepreciation: ["ACCUM_DEPRECIATION"],
  otherNonCurrentAssets: ["OTHER_NON_CURRENT_ASSET"],
  payables: ["PAYABLES"],
  shortTermDebt: ["SHORT_TERM_DEBT"],
  otherCurrentLiabilities: ["OTHER_CURRENT_LIABILITY"],
  longTermDebt: ["LONG_TERM_DEBT"],
  otherNonCurrentLiabilities: ["OTHER_NON_CURRENT_LIABILITY"],
  shareCapital: ["SHARE_CAPITAL"],
  legalReserve: ["LEGAL_RESERVE"],
  retainedEarnings: ["RETAINED_EARNINGS"],
  otherEquity: ["OTHER_EQUITY"],
};

export const TOTAL_LINES = new Set([
  "grossProfit", "ebitda", "ebit", "ebt", "netProfit", "currentAssets", "nonCurrentAssets", "totalAssets", "currentLiabilities",
  "nonCurrentLiabilities", "totalLiabilities", "totalEquity", "totalLiabilitiesAndEquity",
]);

export const EQUITY_ROWS: Record<string, [string, string]> = {
  opening: ["Opening balance", "الرصيد أول المدة"],
  capitalIncrease: ["Capital increase", "زيادة رأس المال"],
  transferToLegalReserve: ["Transfer to legal reserve", "المحول للاحتياطي القانوني"],
  dividendsAndOther: ["Dividends and other appropriations (derived)", "توزيعات وتخصيصات أخرى (مشتقة)"],
  otherEquityMovement: ["Other equity movements", "حركات حقوق ملكية أخرى"],
  profitForPeriod: ["Profit for the period", "أرباح الفترة"],
  closing: ["Closing balance", "الرصيد آخر المدة"],
};

export const CF_LABELS: Record<string, [string, string]> = {
  netProfit: ["Net profit", "صافي الربح"],
  depreciation: ["Depreciation & amortisation", "الإهلاك والاستهلاك"],
  changeReceivables: ["(Increase)/decrease in receivables", "(الزيادة)/النقص في العملاء"],
  changeInventory: ["(Increase)/decrease in inventory", "(الزيادة)/النقص في المخزون"],
  changeOtherCurrentAssets: ["(Increase)/decrease in other current assets", "(الزيادة)/النقص في الأصول المتداولة الأخرى"],
  changePayables: ["Increase/(decrease) in payables", "الزيادة/(النقص) في الموردين"],
  changeOtherCurrentLiabilities: ["Increase/(decrease) in other current liabilities", "الزيادة/(النقص) في الالتزامات المتداولة الأخرى"],
  changeUnmapped: ["Movement in unmapped accounts", "حركة الحسابات غير المصنفة"],
  capex: ["Capital expenditure", "الإنفاق الرأسمالي"],
  disposalsAccumulatedDepreciation: ["Accumulated depreciation on disposals (derived)", "مجمع إهلاك المستبعد (مشتق)"],
  changeOtherNonCurrentAssets: ["Other non-current assets", "أصول غير متداولة أخرى"],
  changeShortTermDebt: ["Short-term borrowings, net", "صافي القروض قصيرة الأجل"],
  changeLongTermDebt: ["Long-term borrowings, net", "صافي القروض طويلة الأجل"],
  changeOtherNonCurrentLiabilities: ["Other non-current liabilities", "التزامات غير متداولة أخرى"],
  shareCapitalIssued: ["Share capital issued", "زيادة رأس المال"],
  dividendsAndOtherEquity: ["Dividends and other equity movements (derived)", "توزيعات وحركات حقوق ملكية (مشتقة)"],
  receiptsFromCustomers: ["Receipts from customers (incl. other income)", "المتحصلات من العملاء (شاملة الإيرادات الأخرى)"],
  paymentsToSuppliers: ["Payments to suppliers", "المدفوعات للموردين"],
  paymentsForOperatingExpenses: ["Payments for operating expenses", "المدفوعات للمصروفات التشغيلية"],
  interestAndTaxPaid: ["Interest and tax paid, net of accruals", "الفوائد والضرائب المدفوعة"],
};
