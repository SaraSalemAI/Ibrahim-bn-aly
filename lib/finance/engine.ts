import { CREDIT_NATURAL, type Category, type Drivers, type Issue, type ScenarioDrivers, type ScenarioName, type TBRow } from "./types";

export const STATUTORY_TAX_RATE = 0.225; // Egyptian corporate income tax, Law 91/2005 as amended
const TOLERANCE = 0.005;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Period = "current" | "prior";

function net(row: TBRow, period: Period): number {
  return period === "current" ? row.currentDebit - row.currentCredit : row.priorDebit - row.priorCredit;
}

/** Category balance in its natural sign (assets/expenses Dr−Cr, liabilities/equity/income Cr−Dr). */
function categoryTotals(rows: TBRow[], period: Period): Record<Category, number> & { UNMAPPED: number } {
  const totals = {} as Record<Category, number> & { UNMAPPED: number };
  totals.UNMAPPED = 0;
  for (const row of rows) {
    const n = net(row, period);
    if (row.category === "") {
      totals.UNMAPPED += n; // kept as Dr−Cr so the holding class keeps the TB balanced
      continue;
    }
    const v = CREDIT_NATURAL.has(row.category) ? -n : n;
    totals[row.category] = (totals[row.category] ?? 0) + v;
  }
  return totals;
}

export interface PeriodFigures {
  // Balance sheet
  cash: number;
  receivables: number;
  inventory: number;
  otherCurrentAssets: number;
  currentAssets: number;
  ppeGross: number;
  accumulatedDepreciation: number;
  otherNonCurrentAssets: number;
  nonCurrentAssets: number;
  unmappedHolding: number;
  totalAssets: number;
  payables: number;
  shortTermDebt: number;
  otherCurrentLiabilities: number;
  currentLiabilities: number;
  longTermDebt: number;
  otherNonCurrentLiabilities: number;
  nonCurrentLiabilities: number;
  totalLiabilities: number;
  shareCapital: number;
  legalReserve: number;
  retainedEarnings: number;
  otherEquity: number;
  currentPeriodProfit: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanceCheck: number;
  // Income statement
  revenue: number;
  cogs: number;
  grossProfit: number;
  sellingExpenses: number;
  adminExpenses: number;
  ebitda: number;
  depreciation: number;
  otherIncome: number;
  ebit: number;
  financeCosts: number;
  ebt: number;
  taxExpense: number;
  netProfit: number;
  // Trial balance totals
  totalDebits: number;
  totalCredits: number;
}

export function computePeriod(rows: TBRow[], period: Period): PeriodFigures {
  const t = categoryTotals(rows, period);
  const g = (c: Category) => t[c] ?? 0;

  const revenue = g("REVENUE");
  const cogs = g("COGS");
  const grossProfit = revenue - cogs;
  const sellingExpenses = g("SELLING_EXPENSE");
  const adminExpenses = g("ADMIN_EXPENSE");
  const ebitda = grossProfit - sellingExpenses - adminExpenses;
  const depreciation = g("DEPRECIATION");
  const otherIncome = g("OTHER_INCOME");
  const ebit = ebitda - depreciation + otherIncome;
  const financeCosts = g("FINANCE_COST");
  const ebt = ebit - financeCosts;
  const taxExpense = g("TAX_EXPENSE");
  const netProfit = ebt - taxExpense;

  const cash = g("CASH");
  const receivables = g("RECEIVABLES");
  const inventory = g("INVENTORY");
  const otherCurrentAssets = g("OTHER_CURRENT_ASSET");
  const currentAssets = cash + receivables + inventory + otherCurrentAssets;
  const ppeGross = g("PPE");
  const accumulatedDepreciation = g("ACCUM_DEPRECIATION"); // negative: contra-asset
  const otherNonCurrentAssets = g("OTHER_NON_CURRENT_ASSET");
  const nonCurrentAssets = ppeGross + accumulatedDepreciation + otherNonCurrentAssets;
  const unmappedHolding = t.UNMAPPED;
  const totalAssets = currentAssets + nonCurrentAssets + unmappedHolding;

  const payables = g("PAYABLES");
  const shortTermDebt = g("SHORT_TERM_DEBT");
  const otherCurrentLiabilities = g("OTHER_CURRENT_LIABILITY");
  const currentLiabilities = payables + shortTermDebt + otherCurrentLiabilities;
  const longTermDebt = g("LONG_TERM_DEBT");
  const otherNonCurrentLiabilities = g("OTHER_NON_CURRENT_LIABILITY");
  const nonCurrentLiabilities = longTermDebt + otherNonCurrentLiabilities;
  const totalLiabilities = currentLiabilities + nonCurrentLiabilities;

  const shareCapital = g("SHARE_CAPITAL");
  const legalReserve = g("LEGAL_RESERVE");
  const retainedEarnings = g("RETAINED_EARNINGS");
  const otherEquity = g("OTHER_EQUITY");
  // Pre-closing TB: the period's profit has not been closed to equity yet, so it is added here.
  const totalEquity = shareCapital + legalReserve + retainedEarnings + otherEquity + netProfit;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  let totalDebits = 0;
  let totalCredits = 0;
  for (const r of rows) {
    totalDebits += period === "current" ? r.currentDebit : r.priorDebit;
    totalCredits += period === "current" ? r.currentCredit : r.priorCredit;
  }

  const figures: PeriodFigures = {
    cash, receivables, inventory, otherCurrentAssets, currentAssets,
    ppeGross, accumulatedDepreciation, otherNonCurrentAssets, nonCurrentAssets, unmappedHolding, totalAssets,
    payables, shortTermDebt, otherCurrentLiabilities, currentLiabilities,
    longTermDebt, otherNonCurrentLiabilities, nonCurrentLiabilities, totalLiabilities,
    shareCapital, legalReserve, retainedEarnings, otherEquity, currentPeriodProfit: netProfit, totalEquity,
    totalLiabilitiesAndEquity, balanceCheck: totalAssets - totalLiabilitiesAndEquity,
    revenue, cogs, grossProfit, sellingExpenses, adminExpenses, ebitda, depreciation, otherIncome, ebit,
    financeCosts, ebt, taxExpense, netProfit, totalDebits, totalCredits,
  };
  for (const k of Object.keys(figures) as (keyof PeriodFigures)[]) figures[k] = round2(figures[k]);
  return figures;
}

// ---------------------------------------------------------------- validation

export function hasPriorPeriod(rows: TBRow[]): boolean {
  return rows.some((r) => r.priorDebit !== 0 || r.priorCredit !== 0);
}

export function validate(rows: TBRow[], current: PeriodFigures, prior: PeriodFigures | null): Issue[] {
  const issues: Issue[] = [];
  if (rows.length === 0) return [{ level: "error", code: "noRows" }];
  const diffCur = round2(current.totalDebits - current.totalCredits);
  if (Math.abs(diffCur) > TOLERANCE) {
    issues.push({ level: "error", code: "unbalanced", params: { period: "current", difference: diffCur } });
  }
  if (prior) {
    const diffPrior = round2(prior.totalDebits - prior.totalCredits);
    if (Math.abs(diffPrior) > TOLERANCE) {
      issues.push({ level: "error", code: "unbalanced", params: { period: "prior", difference: diffPrior } });
    }
  }
  const unmapped = rows.filter((r) => r.category === "").length;
  if (unmapped > 0) issues.push({ level: "warning", code: "unmapped", params: { count: unmapped } });
  const suggested = rows.filter((r) => r.suggested).length;
  if (suggested > 0) issues.push({ level: "warning", code: "suggestedMappings", params: { count: suggested } });
  const negatives = rows.filter((r) => [r.currentDebit, r.currentCredit, r.priorDebit, r.priorCredit].some((v) => v < 0));
  if (negatives.length > 0) issues.push({ level: "warning", code: "negativeAmounts", params: { count: negatives.length } });
  if (current.revenue <= 0) issues.push({ level: "warning", code: "noRevenue" });
  if (!prior) issues.push({ level: "warning", code: "noPrior" });
  return issues;
}

// ----------------------------------------------------------------- variances

export const STATEMENT_LINES: Array<{ key: keyof PeriodFigures; statement: "BS" | "PL"; total?: boolean }> = [
  { key: "revenue", statement: "PL" },
  { key: "cogs", statement: "PL" },
  { key: "grossProfit", statement: "PL", total: true },
  { key: "sellingExpenses", statement: "PL" },
  { key: "adminExpenses", statement: "PL" },
  { key: "ebitda", statement: "PL", total: true },
  { key: "depreciation", statement: "PL" },
  { key: "otherIncome", statement: "PL" },
  { key: "ebit", statement: "PL", total: true },
  { key: "financeCosts", statement: "PL" },
  { key: "ebt", statement: "PL", total: true },
  { key: "taxExpense", statement: "PL" },
  { key: "netProfit", statement: "PL", total: true },
  { key: "cash", statement: "BS" },
  { key: "receivables", statement: "BS" },
  { key: "inventory", statement: "BS" },
  { key: "otherCurrentAssets", statement: "BS" },
  { key: "currentAssets", statement: "BS", total: true },
  { key: "ppeGross", statement: "BS" },
  { key: "accumulatedDepreciation", statement: "BS" },
  { key: "otherNonCurrentAssets", statement: "BS" },
  { key: "nonCurrentAssets", statement: "BS", total: true },
  { key: "unmappedHolding", statement: "BS" },
  { key: "totalAssets", statement: "BS", total: true },
  { key: "payables", statement: "BS" },
  { key: "shortTermDebt", statement: "BS" },
  { key: "otherCurrentLiabilities", statement: "BS" },
  { key: "currentLiabilities", statement: "BS", total: true },
  { key: "longTermDebt", statement: "BS" },
  { key: "otherNonCurrentLiabilities", statement: "BS" },
  { key: "nonCurrentLiabilities", statement: "BS", total: true },
  { key: "totalLiabilities", statement: "BS", total: true },
  { key: "shareCapital", statement: "BS" },
  { key: "legalReserve", statement: "BS" },
  { key: "retainedEarnings", statement: "BS" },
  { key: "otherEquity", statement: "BS" },
  { key: "currentPeriodProfit", statement: "BS" },
  { key: "totalEquity", statement: "BS", total: true },
  { key: "totalLiabilitiesAndEquity", statement: "BS", total: true },
];

export interface Variance {
  key: keyof PeriodFigures;
  statement: "BS" | "PL";
  current: number;
  prior: number | null;
  change: number | null;
  /** Null when the prior value is zero (percentage undefined) or not provided. */
  changePct: number | null;
  material: boolean;
}

/** Materiality: 1% of revenue for P&L lines, 1% of total assets for balance sheet lines, plus a 10% relative move. */
export function computeVariances(current: PeriodFigures, prior: PeriodFigures | null): Variance[] {
  const plThreshold = Math.abs(current.revenue) * 0.01;
  const bsThreshold = Math.abs(current.totalAssets) * 0.01;
  return STATEMENT_LINES.map(({ key, statement }) => {
    const cur = current[key];
    if (!prior) return { key, statement, current: cur, prior: null, change: null, changePct: null, material: false };
    const pri = prior[key];
    const change = round2(cur - pri);
    const changePct = pri === 0 ? null : round2((change / Math.abs(pri)) * 100);
    const threshold = statement === "PL" ? plThreshold : bsThreshold;
    const material = Math.abs(change) >= threshold && (changePct === null ? change !== 0 : Math.abs(changePct) >= 10);
    return { key, statement, current: cur, prior: pri, change, changePct, material };
  });
}

// -------------------------------------------------------------------- ratios

export interface Ratio {
  key: string;
  group: "liquidity" | "profitability" | "efficiency" | "leverage";
  unit: "x" | "%" | "days";
  formula: string;
  current: number | null;
  prior: number | null;
}

function div(a: number, b: number): number | null {
  return b === 0 ? null : a / b;
}

function ratioSet(f: PeriodFigures, days: number) {
  const totalDebt = f.shortTermDebt + f.longTermDebt;
  const pct = (v: number | null) => (v === null ? null : round2(v * 100));
  const x = (v: number | null) => (v === null ? null : round2(v));
  const d = (v: number | null) => (v === null ? null : round2(v * days));
  return {
    currentRatio: x(div(f.currentAssets, f.currentLiabilities)),
    quickRatio: x(div(f.currentAssets - f.inventory, f.currentLiabilities)),
    cashRatio: x(div(f.cash, f.currentLiabilities)),
    grossMargin: pct(div(f.grossProfit, f.revenue)),
    ebitdaMargin: pct(div(f.ebitda, f.revenue)),
    netMargin: pct(div(f.netProfit, f.revenue)),
    roa: pct(div(f.netProfit, f.totalAssets)),
    roe: pct(div(f.netProfit, f.totalEquity)),
    dso: d(div(f.receivables, f.revenue)),
    dio: d(div(f.inventory, f.cogs)),
    dpo: d(div(f.payables, f.cogs)),
    debtToEquity: x(div(totalDebt, f.totalEquity)),
    debtToEbitda: x(div(totalDebt, f.ebitda)),
    interestCoverage: x(div(f.ebit, f.financeCosts)),
  };
}

const RATIO_META: Array<Omit<Ratio, "current" | "prior">> = [
  { key: "currentRatio", group: "liquidity", unit: "x", formula: "Current assets / Current liabilities" },
  { key: "quickRatio", group: "liquidity", unit: "x", formula: "(Current assets − Inventory) / Current liabilities" },
  { key: "cashRatio", group: "liquidity", unit: "x", formula: "Cash / Current liabilities" },
  { key: "grossMargin", group: "profitability", unit: "%", formula: "Gross profit / Revenue" },
  { key: "ebitdaMargin", group: "profitability", unit: "%", formula: "EBITDA / Revenue" },
  { key: "netMargin", group: "profitability", unit: "%", formula: "Net profit / Revenue" },
  { key: "roa", group: "profitability", unit: "%", formula: "Net profit / Total assets (closing)" },
  { key: "roe", group: "profitability", unit: "%", formula: "Net profit / Total equity (closing)" },
  { key: "dso", group: "efficiency", unit: "days", formula: "Receivables / Revenue × days" },
  { key: "dio", group: "efficiency", unit: "days", formula: "Inventory / COGS × days" },
  { key: "dpo", group: "efficiency", unit: "days", formula: "Payables / COGS × days" },
  { key: "cashConversionCycle", group: "efficiency", unit: "days", formula: "DSO + DIO − DPO" },
  { key: "debtToEquity", group: "leverage", unit: "x", formula: "(Short-term + Long-term debt) / Total equity" },
  { key: "debtToEbitda", group: "leverage", unit: "x", formula: "(Short-term + Long-term debt) / EBITDA" },
  { key: "interestCoverage", group: "leverage", unit: "x", formula: "EBIT / Finance costs" },
];

export function computeRatios(current: PeriodFigures, prior: PeriodFigures | null, days = 365): Ratio[] {
  const withCcc = (f: PeriodFigures) => {
    const r: Record<string, number | null> = ratioSet(f, days);
    r.cashConversionCycle =
      r.dso === null || r.dio === null || r.dpo === null ? null : round2(r.dso + r.dio - r.dpo);
    return r;
  };
  const cur = withCcc(current);
  const pri = prior ? withCcc(prior) : null;
  return RATIO_META.map((m) => ({ ...m, current: cur[m.key] ?? null, prior: pri ? (pri[m.key] ?? null) : null }));
}

// ----------------------------------------------------------------- scenarios

export interface ForecastYear {
  year: number;
  revenue: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  depreciation: number;
  financeCosts: number;
  ebt: number;
  tax: number;
  netProfit: number;
}

/** Defaults are explicit assumptions derived from the analyst's own figures; every one is editable in the UI. */
export function defaultDrivers(current: PeriodFigures, prior: PeriodFigures | null): ScenarioDrivers {
  const histGrowth = prior && prior.revenue > 0 ? (current.revenue - prior.revenue) / prior.revenue : 0;
  const gm = current.revenue > 0 ? current.grossProfit / current.revenue : 0;
  const opex = current.revenue > 0 ? (current.sellingExpenses + current.adminExpenses) / current.revenue : 0;
  const r4 = (n: number) => Math.round(n * 10000) / 10000;
  const base: Drivers = {
    revenueGrowth: r4(histGrowth),
    grossMargin: r4(gm),
    opexPctRevenue: r4(opex),
    financeCostChange: 0,
    taxRate: STATUTORY_TAX_RATE,
  };
  return {
    base,
    bull: { ...base, revenueGrowth: r4(base.revenueGrowth + 0.05), grossMargin: r4(base.grossMargin + 0.01) },
    bear: {
      ...base,
      revenueGrowth: r4(base.revenueGrowth - 0.1),
      grossMargin: r4(base.grossMargin - 0.02),
      financeCostChange: 0.2,
    },
  };
}

/** Driver-based P&L projection. Depreciation is held at the latest actual; finance costs move by the driver each year. */
export function forecast(current: PeriodFigures, drivers: Drivers, years = 3): ForecastYear[] {
  const out: ForecastYear[] = [];
  let revenue = current.revenue;
  let financeCosts = current.financeCosts;
  for (let y = 1; y <= years; y++) {
    revenue = revenue * (1 + drivers.revenueGrowth);
    financeCosts = financeCosts * (1 + drivers.financeCostChange);
    const grossProfit = revenue * drivers.grossMargin;
    const opex = revenue * drivers.opexPctRevenue;
    const ebitda = grossProfit - opex;
    const depreciation = current.depreciation;
    const ebt = ebitda - depreciation + current.otherIncome - financeCosts;
    const tax = Math.max(0, ebt) * drivers.taxRate;
    out.push({
      year: y,
      revenue: round2(revenue),
      grossProfit: round2(grossProfit),
      opex: round2(opex),
      ebitda: round2(ebitda),
      depreciation: round2(depreciation),
      financeCosts: round2(financeCosts),
      ebt: round2(ebt),
      tax: round2(tax),
      netProfit: round2(ebt - tax),
    });
  }
  return out;
}

// ------------------------------------------------------------------ analysis

export interface Analysis {
  hasPrior: boolean;
  current: PeriodFigures;
  prior: PeriodFigures | null;
  issues: Issue[];
  variances: Variance[];
  ratios: Ratio[];
  scenarios: Record<ScenarioName, { drivers: Drivers; years: ForecastYear[] }>;
  indicativeTax: { rate: number; taxableBase: number; tax: number; booked: number };
  ready: boolean;
}

export function analyze(rows: TBRow[], drivers?: ScenarioDrivers, days = 365): Analysis {
  const hasPrior = hasPriorPeriod(rows);
  const current = computePeriod(rows, "current");
  const prior = hasPrior ? computePeriod(rows, "prior") : null;
  const issues = validate(rows, current, prior);
  const d = drivers ?? defaultDrivers(current, prior);
  const scenarios = Object.fromEntries(
    (["base", "bull", "bear"] as const).map((s) => [s, { drivers: d[s], years: forecast(current, d[s]) }]),
  ) as Analysis["scenarios"];
  const taxableBase = Math.max(0, current.ebt);
  return {
    hasPrior,
    current,
    prior,
    issues,
    variances: computeVariances(current, prior),
    ratios: computeRatios(current, prior, days),
    scenarios,
    indicativeTax: {
      rate: STATUTORY_TAX_RATE,
      taxableBase: round2(taxableBase),
      tax: round2(taxableBase * STATUTORY_TAX_RATE),
      booked: current.taxExpense,
    },
    ready: !issues.some((i) => i.level === "error"),
  };
}
