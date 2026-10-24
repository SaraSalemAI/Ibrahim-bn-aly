import { round2 } from "./engine";
import { daysBetween, readTable, type FieldSpec } from "./table";

const f = (aliases: string[], type: FieldSpec["type"], required = false): FieldSpec => ({ aliases, type, required });
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));

export interface TieOut {
  subledger: number;
  trialBalance: number;
  difference: number;
  ties: boolean;
}
export function tieOut(subledger: number, trialBalance: number): TieOut {
  const difference = round2(subledger - trialBalance);
  return { subledger: round2(subledger), trialBalance: round2(trialBalance), difference, ties: Math.abs(difference) < 0.01 };
}

// ----------------------------------------------------------- receivables (AR)

export interface ArInvoice {
  customerId: string;
  customer: string;
  invoice: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  outstanding: number;
  currency: string;
  sourceRow: number;
}

export const AR_SPEC = {
  customerId: f(["customer_id", "customer id"], "string"),
  customer: f(["customer", "customer_name", "customer name", "العميل"], "string", true),
  invoice: f(["invoice", "invoice_number", "invoice no", "رقم الفاتورة"], "string", true),
  invoiceDate: f(["invoice_date", "invoice date", "تاريخ الفاتورة"], "date", true),
  dueDate: f(["due_date", "due date", "تاريخ الاستحقاق"], "date", true),
  amount: f(["amount", "original_amount", "amount_original", "القيمة"], "number", true),
  outstanding: f(["outstanding", "outstanding_balance", "amount_outstanding", "الرصيد"], "number", true),
  currency: f(["currency", "العملة"], "string"),
} satisfies Record<keyof Omit<ArInvoice, "sourceRow">, FieldSpec>;

export const parseAr = (text: string) => readTable<ArInvoice>(text, AR_SPEC as never);

export const AGING_BUCKETS = ["current", "1_30", "31_60", "61_90", "91_120", "over_120"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(dueDate: string, asOf: string): AgingBucket {
  const overdue = daysBetween(dueDate, asOf);
  if (overdue <= 0) return "current";
  if (overdue <= 30) return "1_30";
  if (overdue <= 60) return "31_60";
  if (overdue <= 90) return "61_90";
  if (overdue <= 120) return "91_120";
  return "over_120";
}

/** EAS 47 / IFRS 9 simplified approach staging: >30 days overdue = significant increase in credit risk, >90 = credit-impaired. */
export function eclStage(bucket: AgingBucket): 1 | 2 | 3 {
  if (bucket === "current" || bucket === "1_30") return 1;
  if (bucket === "31_60" || bucket === "61_90") return 2;
  return 3;
}

export type EclRates = Record<AgingBucket, number>;
/** Placeholder provision-matrix rates. They are NOT market data: replace them with the entity's own loss-rate study. */
export const PLACEHOLDER_ECL_RATES: EclRates = { current: 0.01, "1_30": 0.03, "31_60": 0.1, "61_90": 0.25, "91_120": 0.5, over_120: 1 };

export function arAging(invoices: ArInvoice[], asOf: string, rates: EclRates) {
  const buckets = Object.fromEntries(AGING_BUCKETS.map((b) => [b, { outstanding: 0, count: 0, rate: rates[b], ecl: 0, stage: eclStage(b) }])) as Record<
    AgingBucket,
    { outstanding: number; count: number; rate: number; ecl: number; stage: 1 | 2 | 3 }
  >;
  const byCustomer = new Map<string, number>();
  for (const inv of invoices) {
    const b = agingBucket(inv.dueDate, asOf);
    buckets[b].outstanding += inv.outstanding;
    buckets[b].count++;
    byCustomer.set(inv.customer, (byCustomer.get(inv.customer) ?? 0) + inv.outstanding);
  }
  for (const b of AGING_BUCKETS) {
    buckets[b].outstanding = round2(buckets[b].outstanding);
    buckets[b].ecl = round2(buckets[b].outstanding * rates[b]);
  }
  const total = sum(invoices.map((i) => i.outstanding));
  const ecl = sum(AGING_BUCKETS.map((b) => buckets[b].ecl));
  const topCustomers = [...byCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount]) => ({ name, amount: round2(amount), share: total ? round2((amount / total) * 100) : 0 }));
  return { buckets, total, ecl, eclCoverage: total ? round2((ecl / total) * 100) : 0, topCustomers };
}

// --------------------------------------------------------------- payables (AP)

export interface ApInvoice {
  supplierId: string;
  supplier: string;
  taxId: string;
  invoice: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  whtDeducted: number;
  netPayable: number;
  status: string;
  sourceRow: number;
}

export const AP_SPEC = {
  supplierId: f(["supplier_id", "supplier id"], "string"),
  supplier: f(["supplier", "supplier_name", "supplier name", "المورد"], "string", true),
  taxId: f(["tax_id", "tax id", "tax_registration", "رقم التسجيل الضريبي"], "string"),
  invoice: f(["invoice", "invoice_number", "رقم الفاتورة"], "string", true),
  invoiceDate: f(["invoice_date", "invoice date", "تاريخ الفاتورة"], "date", true),
  dueDate: f(["due_date", "due date", "تاريخ الاستحقاق"], "date", true),
  amount: f(["amount", "invoice_amount", "القيمة"], "number", true),
  whtDeducted: f(["wht", "wht_deducted", "withholding_tax", "خصم من المنبع"], "number"),
  netPayable: f(["net_payable", "net payable", "الصافي"], "number", true),
  status: f(["status", "payment_status", "الحالة"], "string"),
} satisfies Record<keyof Omit<ApInvoice, "sourceRow">, FieldSpec>;

export const parseAp = (text: string) => readTable<ApInvoice>(text, AP_SPEC as never);

const isPaid = (s: string) => /^(paid|مدفوع|مسدد)/i.test(s.trim());

export function quarterOf(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export function apAnalysis(invoices: ApInvoice[], asOf: string) {
  const open = invoices.filter((i) => !isPaid(i.status));
  const buckets = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
  for (const i of open) buckets[agingBucket(i.dueDate, asOf)] += i.netPayable;
  for (const b of AGING_BUCKETS) buckets[b] = round2(buckets[b]);

  const bySupplier = new Map<string, number>();
  for (const i of invoices) bySupplier.set(i.supplier, (bySupplier.get(i.supplier) ?? 0) + i.amount);
  const totalPurchases = sum(invoices.map((i) => i.amount));
  const shares = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]);
  const hhi = totalPurchases ? Math.round(shares.reduce((a, [, v]) => a + ((v / totalPurchases) * 100) ** 2, 0)) : 0;
  const top5Share = totalPurchases ? round2((shares.slice(0, 5).reduce((a, [, v]) => a + v, 0) / totalPurchases) * 100) : 0;

  // Form 41: withholding tax deducted from suppliers, grouped by quarter of invoice date.
  const form41 = new Map<string, { quarter: string; base: number; wht: number; count: number }>();
  for (const i of invoices) {
    if (!i.whtDeducted) continue;
    const q = quarterOf(i.invoiceDate);
    const e = form41.get(q) ?? { quarter: q, base: 0, wht: 0, count: 0 };
    e.base += i.amount;
    e.wht += i.whtDeducted;
    e.count++;
    form41.set(q, e);
  }
  const missingTaxIds = invoices.filter((i) => i.whtDeducted && !/^\d{9}$/.test(i.taxId.replace(/\D/g, ""))).length;
  const netMismatch = invoices.filter((i) => Math.abs(i.amount - i.whtDeducted - i.netPayable) > 0.01).map((i) => i.sourceRow);

  return {
    openBalance: sum(open.map((i) => i.netPayable)),
    buckets,
    totalPurchases,
    topSuppliers: shares.slice(0, 10).map(([name, v]) => ({ name, amount: round2(v), share: totalPurchases ? round2((v / totalPurchases) * 100) : 0 })),
    hhi,
    top5Share,
    form41: [...form41.values()].sort((a, b) => a.quarter.localeCompare(b.quarter)).map((e) => ({ ...e, base: round2(e.base), wht: round2(e.wht) })),
    missingTaxIds,
    netMismatchRows: netMismatch,
  };
}

// ---------------------------------------------------------- fixed assets (FAR)

export const ASSET_CATEGORIES = ["LAND", "BUILDINGS", "MACHINERY", "IT_EQUIPMENT", "VEHICLES", "FURNITURE", "INTANGIBLES"] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/**
 * Statutory tax depreciation pools as stated in the build specification (Law 91/2005, Articles 25/26).
 * Rates are parameters: confirm them against the current law and executive regulations before relying on them.
 */
export const TAX_POOLS: Record<AssetCategory, { method: "SL" | "DB" | "NONE"; rate: number; label: string }> = {
  LAND: { method: "NONE", rate: 0, label: "Not depreciable" },
  BUILDINGS: { method: "SL", rate: 0.05, label: "Art. 25 — 5% straight-line" },
  INTANGIBLES: { method: "SL", rate: 0.1, label: "Art. 25 — 10% straight-line" },
  IT_EQUIPMENT: { method: "DB", rate: 0.5, label: "Art. 26 — 50% declining balance" },
  MACHINERY: { method: "DB", rate: 0.25, label: "Art. 26 — 25% declining balance" },
  VEHICLES: { method: "DB", rate: 0.25, label: "Art. 26 — 25% declining balance" },
  FURNITURE: { method: "DB", rate: 0.25, label: "Art. 26 — 25% declining balance" },
};
export const INITIAL_INDUSTRIAL_ALLOWANCE = 0.3;

export interface FixedAsset {
  tag: string;
  name: string;
  category: string;
  acquisitionDate: string;
  cost: number;
  usefulLifeYears: number;
  accumulatedDepreciation: number;
  currentYearDepreciation: number;
  taxCostBase: number;
  accumulatedTaxDepreciation: number;
  newManufacturing: boolean;
  disposalDate: string | null;
  sourceRow: number;
}

export const FAR_SPEC = {
  tag: f(["tag", "asset_tag", "asset tag", "رقم الأصل"], "string", true),
  name: f(["name", "asset_name", "description", "اسم الأصل"], "string", true),
  category: f(["category", "asset_category", "الفئة"], "string", true),
  acquisitionDate: f(["acquisition_date", "acquired", "تاريخ الشراء"], "date", true),
  cost: f(["cost", "original_cost", "cost_historical", "التكلفة"], "number", true),
  usefulLifeYears: f(["useful_life", "useful_life_years", "العمر الإنتاجي"], "number", true),
  accumulatedDepreciation: f(["accumulated_depreciation", "accum_dep", "مجمع الإهلاك"], "number"),
  currentYearDepreciation: f(["current_year_depreciation", "depreciation", "إهلاك العام"], "number"),
  taxCostBase: f(["tax_cost_base", "tax_base", "الأساس الضريبي"], "number"),
  accumulatedTaxDepreciation: f(["accumulated_tax_depreciation", "accum_tax_dep", "الإهلاك الضريبي المجمع"], "number"),
  newManufacturing: f(["new_manufacturing", "industrial", "آلات صناعية جديدة"], "bool"),
  disposalDate: f(["disposal_date", "تاريخ الاستبعاد"], "date"),
} satisfies Record<keyof Omit<FixedAsset, "sourceRow">, FieldSpec>;

export const parseFar = (text: string) => readTable<FixedAsset>(text, FAR_SPEC as never);

export function normaliseAssetCategory(c: string): AssetCategory | null {
  const u = c.trim().toUpperCase().replace(/[\s&-]+/g, "_");
  if ((ASSET_CATEGORIES as readonly string[]).includes(u)) return u as AssetCategory;
  if (/IT|COMPUTER|SOFTWARE|حاسب/.test(u)) return "IT_EQUIPMENT";
  if (/MACHIN|PLANT|آلات/.test(u)) return "MACHINERY";
  if (/BUILD|مبان/.test(u)) return "BUILDINGS";
  if (/VEHIC|CAR|سيار/.test(u)) return "VEHICLES";
  if (/FURN|أثاث/.test(u)) return "FURNITURE";
  if (/INTANG|غير ملموس/.test(u)) return "INTANGIBLES";
  if (/LAND|أراض/.test(u)) return "LAND";
  return null;
}

export interface AssetSchedule {
  tag: string;
  category: AssetCategory | null;
  isAddition: boolean;
  disposed: boolean;
  cost: number;
  accountingDepreciation: number;
  accumulatedDepreciation: number;
  carryingAmount: number;
  taxOpeningWdv: number;
  initialAllowance: number;
  taxDepreciation: number;
  taxBase: number;
  temporaryDifference: number;
}

/**
 * Per-asset accounting vs tax schedule for the period [periodStart, periodEnd].
 * Accounting depreciation uses the register's current-year figure when given, else straight-line pro rata by month.
 * Accumulated depreciation in the register is taken as the opening balance.
 */
export function assetSchedule(a: FixedAsset, periodStart: string, periodEnd: string): AssetSchedule {
  const category = normaliseAssetCategory(a.category);
  const isAddition = a.acquisitionDate >= periodStart && a.acquisitionDate <= periodEnd;
  const disposed = a.disposalDate !== null && a.disposalDate <= periodEnd;
  const pool = category ? TAX_POOLS[category] : null;

  let dep = a.currentYearDepreciation;
  if (!dep && category !== "LAND" && a.usefulLifeYears > 0) {
    const start = isAddition ? a.acquisitionDate : periodStart;
    const months = Math.max(0, Math.min(12, Math.ceil(daysBetween(start, periodEnd) / 30.4375)));
    dep = Math.min((a.cost / a.usefulLifeYears) * (months / 12), Math.max(0, a.cost - a.accumulatedDepreciation));
  }
  const accumulated = a.accumulatedDepreciation + dep;

  const taxCost = a.taxCostBase || a.cost;
  const openingWdv = Math.max(0, taxCost - a.accumulatedTaxDepreciation);
  let initial = 0;
  let taxDep = 0;
  if (pool && !disposed) {
    if (a.newManufacturing && isAddition && category === "MACHINERY") initial = taxCost * INITIAL_INDUSTRIAL_ALLOWANCE;
    if (pool.method === "SL") taxDep = Math.min(taxCost * pool.rate, openingWdv);
    else if (pool.method === "DB") taxDep = (openingWdv - initial) * pool.rate;
  }
  const taxBase = Math.max(0, openingWdv - initial - taxDep);
  const carrying = disposed ? 0 : a.cost - accumulated;
  return {
    tag: a.tag,
    category,
    isAddition,
    disposed,
    cost: round2(a.cost),
    accountingDepreciation: round2(dep),
    accumulatedDepreciation: round2(accumulated),
    carryingAmount: round2(carrying),
    taxOpeningWdv: round2(openingWdv),
    initialAllowance: round2(initial),
    taxDepreciation: round2(taxDep),
    taxBase: round2(disposed ? 0 : taxBase),
    temporaryDifference: round2(disposed ? 0 : carrying - taxBase),
  };
}

export function farSummary(assets: FixedAsset[], periodStart: string, periodEnd: string, taxRate = 0.225) {
  const schedules = assets.map((a) => assetSchedule(a, periodStart, periodEnd));
  const active = schedules.filter((s) => !s.disposed);
  const openingCost = sum(active.filter((s) => !s.isAddition).map((s) => s.cost));
  const additions = sum(active.filter((s) => s.isAddition).map((s) => s.cost));
  const temp = sum(active.map((s) => s.temporaryDifference));
  return {
    schedules,
    rollForward: {
      openingCost,
      additions,
      disposals: sum(schedules.filter((s) => s.disposed).map((s) => s.cost)),
      closingCost: round2(openingCost + additions),
      depreciationCharge: sum(active.map((s) => s.accountingDepreciation)),
      accumulatedDepreciation: sum(active.map((s) => s.accumulatedDepreciation)),
      carryingAmount: sum(active.map((s) => s.carryingAmount)),
    },
    tax: {
      initialAllowance: sum(active.map((s) => s.initialAllowance)),
      taxDepreciation: sum(active.map((s) => s.taxDepreciation)),
      taxBase: sum(active.map((s) => s.taxBase)),
    },
    deferredTax: { temporaryDifference: temp, amount: round2(temp * taxRate), type: temp >= 0 ? ("DTL" as const) : ("DTA" as const) },
    unknownCategories: schedules.filter((s) => s.category === null).map((s) => s.tag),
  };
}

// ------------------------------------------------------------------ inventory

export interface InventoryItem {
  sku: string;
  description: string;
  category: string;
  openingQty: number;
  openingUnitCost: number;
  receiptsQty: number;
  receiptsCost: number;
  issuesQty: number;
  endingQty: number;
  method: string;
  nrvPerUnit: number | null;
  sourceRow: number;
}

export const INVENTORY_SPEC = {
  sku: f(["sku", "item_code", "code", "كود الصنف"], "string", true),
  description: f(["description", "item", "name", "الصنف"], "string", true),
  category: f(["category", "الفئة"], "string"),
  openingQty: f(["opening_qty", "opening quantity", "رصيد أول المدة"], "number", true),
  openingUnitCost: f(["opening_unit_cost", "opening cost", "تكلفة الوحدة أول المدة"], "number", true),
  receiptsQty: f(["receipts_qty", "purchases_qty", "الوارد"], "number", true),
  receiptsCost: f(["receipts_cost", "purchases_cost", "تكلفة الوارد"], "number", true),
  issuesQty: f(["issues_qty", "sales_qty", "المنصرف"], "number", true),
  endingQty: f(["ending_qty", "physical_qty", "الجرد الفعلي"], "number", true),
  method: f(["method", "costing_method", "طريقة التسعير"], "string"),
  nrvPerUnit: f(["nrv", "nrv_per_unit", "صافي القيمة البيعية"], "number"),
} satisfies Record<keyof Omit<InventoryItem, "sourceRow">, FieldSpec>;

export const parseInventory = (text: string) => readTable<InventoryItem>(text, INVENTORY_SPEC as never);

export function valueItem(i: InventoryItem) {
  const fifo = /fifo/i.test(i.method);
  const availableQty = i.openingQty + i.receiptsQty;
  const availableCost = i.openingQty * i.openingUnitCost + i.receiptsCost;
  let cost: number;
  if (fifo) {
    const receiptUnit = i.receiptsQty ? i.receiptsCost / i.receiptsQty : i.openingUnitCost;
    cost =
      i.endingQty <= i.receiptsQty
        ? i.endingQty * receiptUnit
        : i.receiptsCost + Math.min(i.endingQty - i.receiptsQty, i.openingQty) * i.openingUnitCost;
  } else {
    cost = availableQty ? (availableCost / availableQty) * i.endingQty : 0;
  }
  const expectedQty = availableQty - i.issuesQty;
  const nrv = i.nrvPerUnit === null || i.nrvPerUnit === 0 ? null : i.nrvPerUnit * i.endingQty;
  const writeDown = nrv === null ? 0 : Math.max(0, cost - nrv);
  return {
    sku: i.sku,
    method: fifo ? ("FIFO" as const) : ("WAC" as const),
    cost: round2(cost),
    nrv: nrv === null ? null : round2(nrv),
    writeDown: round2(writeDown),
    carrying: round2(cost - writeDown),
    quantityVariance: round2(i.endingQty - expectedQty),
  };
}

export function inventorySummary(items: InventoryItem[], cogs: number) {
  const valued = items.map(valueItem);
  const closingCost = sum(valued.map((v) => v.cost));
  const openingCost = sum(items.map((i) => i.openingQty * i.openingUnitCost));
  const avg = (openingCost + closingCost) / 2;
  return {
    valued,
    openingCost,
    closingCost,
    nrvWriteDown: sum(valued.map((v) => v.writeDown)),
    carryingAmount: sum(valued.map((v) => v.carrying)),
    itemsWithShrinkage: valued.filter((v) => v.quantityVariance < 0).length,
    turnover: avg ? round2(cogs / avg) : null,
    noNrvProvided: items.filter((i) => i.nrvPerUnit === null || i.nrvPerUnit === 0).length,
  };
}

// -------------------------------------------------------------------- payroll

export interface PayrollLine {
  employeeId: string;
  department: string;
  basic: number;
  allowances: number;
  overtime: number;
  gross: number;
  employeeSocialInsurance: number;
  companySocialInsurance: number;
  incomeTax: number;
  net: number;
  sourceRow: number;
}

export const PAYROLL_SPEC = {
  employeeId: f(["employee_id", "employee id", "الرقم الوظيفي"], "string", true),
  department: f(["department", "dept", "الإدارة"], "string", true),
  basic: f(["basic", "basic_salary", "الأساسي"], "number", true),
  allowances: f(["allowances", "variable_allowances", "البدلات"], "number"),
  overtime: f(["overtime", "إضافي"], "number"),
  gross: f(["gross", "gross_salary", "الإجمالي"], "number", true),
  employeeSocialInsurance: f(["employee_si", "employee_social_insurance", "تأمينات العامل"], "number"),
  companySocialInsurance: f(["company_si", "company_social_insurance", "حصة الشركة في التأمينات"], "number"),
  incomeTax: f(["income_tax", "tax_withheld", "ضريبة كسب العمل"], "number"),
  net: f(["net", "net_salary", "الصافي"], "number", true),
} satisfies Record<keyof Omit<PayrollLine, "sourceRow">, FieldSpec>;

export const parsePayroll = (text: string) => readTable<PayrollLine>(text, PAYROLL_SPEC as never);

/**
 * Employees' profit share: by default at least 10% of distributable profit, capped at total annual wages
 * (Egyptian companies law). The percentage is a parameter: confirm it against the articles of association.
 */
export function payrollSummary(lines: PayrollLine[], distributableProfit: number, profitSharePct = 0.1, periodsPerYear = 1) {
  const byDept = new Map<string, { department: string; headcount: number; gross: number; companyCost: number }>();
  for (const l of lines) {
    const d = byDept.get(l.department) ?? { department: l.department, headcount: 0, gross: 0, companyCost: 0 };
    d.headcount++;
    d.gross += l.gross;
    d.companyCost += l.gross + l.companySocialInsurance;
    byDept.set(l.department, d);
  }
  const grossMismatch = lines.filter((l) => Math.abs(l.basic + l.allowances + l.overtime - l.gross) > 0.01).map((l) => l.sourceRow);
  const netMismatch = lines.filter((l) => Math.abs(l.gross - l.employeeSocialInsurance - l.incomeTax - l.net) > 0.01).map((l) => l.sourceRow);
  const annualWages = sum(lines.map((l) => l.gross)) * periodsPerYear;
  const share = Math.max(0, Math.min(distributableProfit * profitSharePct, annualWages));
  return {
    headcount: lines.length,
    gross: sum(lines.map((l) => l.gross)),
    net: sum(lines.map((l) => l.net)),
    employeeSocialInsurance: sum(lines.map((l) => l.employeeSocialInsurance)),
    companySocialInsurance: sum(lines.map((l) => l.companySocialInsurance)),
    incomeTax: sum(lines.map((l) => l.incomeTax)),
    companyCost: sum(lines.map((l) => l.gross + l.companySocialInsurance)),
    byDepartment: [...byDept.values()].map((d) => ({ ...d, gross: round2(d.gross), companyCost: round2(d.companyCost) })),
    grossMismatchRows: grossMismatch,
    netMismatchRows: netMismatch,
    profitShare: { pct: profitSharePct, distributableProfit: round2(distributableProfit), annualWagesCap: round2(annualWages), amount: round2(share) },
  };
}

// ------------------------------------------------------------- bank statement

export interface BankLine {
  date: string;
  description: string;
  amount: number;
  debit: number;
  credit: number;
  balance: number | null;
  sourceRow: number;
}

export const BANK_SPEC = {
  date: f(["date", "value_date", "booking date", "التاريخ"], "date", true),
  description: f(["description", "narrative", "details", "البيان"], "string"),
  amount: f(["amount", "المبلغ"], "number"),
  debit: f(["debit", "withdrawal", "مدين", "سحب"], "number"),
  credit: f(["credit", "deposit", "دائن", "إيداع"], "number"),
  balance: f(["balance", "running_balance", "الرصيد"], "number"),
} satisfies Record<keyof Omit<BankLine, "sourceRow">, FieldSpec>;

/** Bank CSV: either a signed amount column (+ deposit) or separate debit/credit columns (bank's perspective: credit = deposit). */
export function parseBank(text: string) {
  const res = readTable<BankLine>(text, BANK_SPEC as never);
  res.records = res.records.map((r) => ({ ...r, amount: r.amount || round2(r.credit - r.debit) }));
  return res;
}

export interface GlCashLine {
  date: string;
  amount: number;
  ref: string;
}

/** Matches bank lines to book cash movements by amount within ±dayWindow days. */
export function bankReconciliation(bank: BankLine[], allBookCash: GlCashLine[], bookBalance: number, dayWindow = 5) {
  // Only book movements inside the statement window can be reconciling items; earlier ones are assumed cleared.
  const dates = bank.map((b) => b.date).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const bookCash = allBookCash.filter((g) => daysBetween(from, g.date) >= -dayWindow && g.date <= to);
  const used = new Set<number>();
  const unmatchedBank: BankLine[] = [];
  for (const b of bank) {
    if (b.amount === 0) continue;
    const idx = bookCash.findIndex(
      (g, i) => !used.has(i) && Math.abs(g.amount - b.amount) < 0.01 && Math.abs(daysBetween(g.date, b.date)) <= dayWindow,
    );
    if (idx >= 0) used.add(idx);
    else unmatchedBank.push(b);
  }
  const unmatchedBook = bookCash.filter((_, i) => !used.has(i));
  const lastWithBalance = [...bank].reverse().find((b) => b.balance !== null);
  const statementBalance = lastWithBalance?.balance ?? sum(bank.map((b) => b.amount));
  const depositsInTransit = sum(unmatchedBook.filter((g) => g.amount > 0).map((g) => g.amount));
  const unpresentedCheques = sum(unmatchedBook.filter((g) => g.amount < 0).map((g) => -g.amount));
  const bankOnly = sum(unmatchedBank.map((b) => b.amount));
  const adjustedBank = round2(statementBalance + depositsInTransit - unpresentedCheques);
  const adjustedBook = round2(bookBalance + bankOnly);
  return {
    statementBalance: round2(statementBalance),
    bookBalance: round2(bookBalance),
    depositsInTransit,
    unpresentedCheques,
    bankItemsNotInBooks: bankOnly,
    adjustedBank,
    adjustedBook,
    difference: round2(adjustedBank - adjustedBook),
    matched: used.size,
    statementPeriod: { from, to },
    unmatchedBank,
    unmatchedBook,
  };
}

// --------------------------------------------------------- ETA e-invoices

export interface EtaDocument {
  uuid: string;
  internalId: string;
  issuerId: string;
  receiverId: string;
  receiverType: string;
  type: "I" | "C" | "D";
  dateIssued: string;
  netAmount: number;
  vat: number;
  wht: number;
  total: number;
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function docType(v: unknown): EtaDocument["type"] {
  const s = String(v ?? "I").toLowerCase();
  if (s.startsWith("c")) return "C";
  if (s.startsWith("d")) return "D";
  return "I";
}

function taxOf(taxTotals: unknown, code: string): number {
  if (!Array.isArray(taxTotals)) return 0;
  return taxTotals.filter((t) => String((t as Record<string, unknown>).taxType).toUpperCase() === code).reduce((a, t) => a + n((t as Record<string, unknown>).amount), 0);
}

function fromObject(o: Record<string, unknown>): EtaDocument {
  const issuer = (o.issuer ?? {}) as Record<string, unknown>;
  const receiver = (o.receiver ?? {}) as Record<string, unknown>;
  return {
    uuid: String(o.uuid ?? ""),
    internalId: String(o.internalId ?? o.internalID ?? ""),
    issuerId: String(o.issuerId ?? issuer.id ?? ""),
    receiverId: String(o.receiverId ?? receiver.id ?? ""),
    receiverType: String(o.receiverType ?? receiver.type ?? ""),
    type: docType(o.documentType ?? o.typeName),
    dateIssued: String(o.dateTimeIssued ?? o.dateTimeReceived ?? "").slice(0, 10),
    netAmount: n(o.netAmount ?? o.totalSales ?? o.totalSalesAmount),
    vat: n(o.vat) || taxOf(o.taxTotals, "T1"),
    wht: n(o.wht) || taxOf(o.taxTotals, "T4"),
    total: n(o.total ?? o.totalAmount),
  };
}

/** Accepts ETA portal JSON (array, {documents}, {result}) or XML exports with one <document> element per invoice. */
export function parseEta(text: string): { documents: EtaDocument[]; error?: string } {
  const src = text.trim();
  if (src.startsWith("{") || src.startsWith("[")) {
    try {
      const data = JSON.parse(src);
      const list = Array.isArray(data) ? data : (data.documents ?? data.result ?? data.data ?? []);
      if (!Array.isArray(list)) return { documents: [], error: "noDocuments" };
      return { documents: list.map((o: Record<string, unknown>) => fromObject(o)) };
    } catch {
      return { documents: [], error: "badJson" };
    }
  }
  if (src.startsWith("<")) {
    const docs = [...src.matchAll(/<document\b[^>]*>([\s\S]*?)<\/document>/gi)].map((m) => {
      const body = m[1];
      const tag = (name: string) => body.match(new RegExp(`<${name}>([^<]*)</${name}>`, "i"))?.[1]?.trim() ?? "";
      const taxes = [...body.matchAll(/<taxTotal>([\s\S]*?)<\/taxTotal>/gi)].map((t) => ({
        taxType: t[1].match(/<taxType>([^<]*)<\/taxType>/i)?.[1],
        amount: t[1].match(/<amount>([^<]*)<\/amount>/i)?.[1],
      }));
      return fromObject({
        uuid: tag("uuid"),
        internalId: tag("internalId") || tag("internalID"),
        issuerId: tag("issuerId"),
        receiverId: tag("receiverId"),
        receiverType: tag("receiverType"),
        documentType: tag("documentType"),
        dateTimeIssued: tag("dateTimeIssued"),
        netAmount: tag("netAmount") || tag("totalSales"),
        total: tag("total") || tag("totalAmount"),
        taxTotals: taxes,
      });
    });
    return docs.length ? { documents: docs } : { documents: [], error: "noDocuments" };
  }
  return { documents: [], error: "unknownFormat" };
}

export const STANDARD_VAT = 0.14;

export function etaReconciliation(docs: EtaDocument[], glRevenue: number) {
  const sign = (d: EtaDocument) => (d.type === "C" ? -1 : 1);
  const netSales = sum(docs.map((d) => sign(d) * d.netAmount));
  const vat = sum(docs.map((d) => sign(d) * d.vat));
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const d of docs) {
    if (d.uuid && seen.has(d.uuid)) duplicates.push(d.uuid);
    seen.add(d.uuid);
  }
  return {
    count: docs.length,
    byType: { I: docs.filter((d) => d.type === "I").length, C: docs.filter((d) => d.type === "C").length, D: docs.filter((d) => d.type === "D").length },
    netSales,
    vat,
    wht: sum(docs.map((d) => sign(d) * d.wht)),
    glRevenue: round2(glRevenue),
    difference: round2(glRevenue - netSales),
    missingUuid: docs.filter((d) => !d.uuid).map((d) => d.internalId || "?"),
    duplicates,
    invalidReceiverTaxId: docs.filter((d) => d.receiverType === "B" && !/^\d{9}$/.test(d.receiverId)).map((d) => d.internalId || d.uuid),
    vatRateExceptions: docs
      .filter((d) => d.netAmount > 0 && d.vat > 0 && Math.abs(d.vat / d.netAmount - STANDARD_VAT) > 0.005)
      .map((d) => ({ id: d.internalId || d.uuid, rate: round2((d.vat / d.netAmount) * 100) })),
    zeroVat: docs.filter((d) => d.netAmount > 0 && d.vat === 0).length,
  };
}
