import { round2, STATUTORY_TAX_RATE, type PeriodFigures } from "./engine";

export interface ProductLine {
  name: string;
  units: number;
  unitPrice: number;
  discountPct: number;
  unitCost: number;
  /** Optional actuals for price/volume/mix analysis. */
  actualUnits?: number | null;
  actualUnitPrice?: number | null;
}

export interface HeadcountLine {
  department: string;
  count: number;
  monthlySalary: number;
  /** Company social insurance share as a fraction of salary (input; check current Social Insurance Law rates). */
  socialInsurancePct: number;
}

export interface CapexLine {
  name: string;
  amount: number;
  usefulLifeYears: number;
  /** 1-12: month the asset comes into use. */
  month: number;
}

export interface BudgetVersion {
  id: string;
  name: string;
  approved: boolean;
  products: ProductLine[];
  headcount: HeadcountLine[];
  rent: number;
  marketingPctRevenue: number;
  otherOpex: number;
  targetDso: number;
  targetDio: number;
  targetDpo: number;
  capex: CapexLine[];
  taxRate: number;
}

export function emptyBudget(id: string, name: string): BudgetVersion {
  return {
    id,
    name,
    approved: false,
    products: [],
    headcount: [],
    rent: 0,
    marketingPctRevenue: 0,
    otherOpex: 0,
    targetDso: 0,
    targetDio: 0,
    targetDpo: 0,
    capex: [],
    taxRate: STATUTORY_TAX_RATE,
  };
}

const netPrice = (p: ProductLine) => p.unitPrice * (1 - p.discountPct);

export function budgetStatements(b: BudgetVersion, actual: PeriodFigures) {
  const revenue = b.products.reduce((a, p) => a + p.units * netPrice(p), 0);
  const cogs = b.products.reduce((a, p) => a + p.units * p.unitCost, 0);
  const payroll = b.headcount.reduce((a, h) => a + h.count * h.monthlySalary * 12 * (1 + h.socialInsurancePct), 0);
  const marketing = revenue * b.marketingPctRevenue;
  const opex = payroll + b.rent + marketing + b.otherOpex;
  const newDep = b.capex.reduce((a, c) => a + (c.usefulLifeYears > 0 ? (c.amount / c.usefulLifeYears) * ((13 - Math.min(12, Math.max(1, c.month))) / 12) : 0), 0);
  const depreciation = actual.depreciation + newDep;
  const ebitda = revenue - cogs - opex;
  const financeCosts = actual.financeCosts;
  const ebt = ebitda - depreciation - financeCosts + actual.otherIncome;
  const tax = Math.max(0, ebt) * b.taxRate;
  const netProfit = ebt - tax;
  const receivables = (revenue * b.targetDso) / 365;
  const inventory = (cogs * b.targetDio) / 365;
  const payables = (cogs * b.targetDpo) / 365;
  const capexTotal = b.capex.reduce((a, c) => a + c.amount, 0);
  const deltaWc = receivables - actual.receivables + (inventory - actual.inventory) - (payables - actual.payables);
  const operatingCash = netProfit + depreciation - deltaWc;
  const endingCash = actual.cash + operatingCash - capexTotal;
  const pl = { revenue, cogs, grossProfit: revenue - cogs, payroll, rent: b.rent, marketing, otherOpex: b.otherOpex, opex, ebitda, depreciation, financeCosts, ebt, tax, netProfit };
  return {
    pl: Object.fromEntries(Object.entries(pl).map(([k, v]) => [k, round2(v)])) as Record<keyof typeof pl, number>,
    workingCapital: { receivables: round2(receivables), inventory: round2(inventory), payables: round2(payables), change: round2(deltaWc) },
    cash: { opening: actual.cash, operating: round2(operatingCash), capex: round2(capexTotal), ending: round2(endingCash) },
  };
}

/** Budget vs actual. Favourable = higher income or lower cost than budget. */
export function budgetVsActual(b: BudgetVersion, actual: PeriodFigures) {
  const bud = budgetStatements(b, actual).pl;
  const lines: Array<{ key: string; budget: number; actual: number; income: boolean }> = [
    { key: "revenue", budget: bud.revenue, actual: actual.revenue, income: true },
    { key: "cogs", budget: bud.cogs, actual: actual.cogs, income: false },
    { key: "grossProfit", budget: bud.grossProfit, actual: actual.grossProfit, income: true },
    { key: "opex", budget: bud.opex, actual: actual.sellingExpenses + actual.adminExpenses, income: false },
    { key: "ebitda", budget: bud.ebitda, actual: actual.ebitda, income: true },
    { key: "depreciation", budget: bud.depreciation, actual: actual.depreciation, income: false },
    { key: "financeCosts", budget: bud.financeCosts, actual: actual.financeCosts, income: false },
    { key: "netProfit", budget: bud.netProfit, actual: actual.netProfit, income: true },
  ];
  return lines.map((l) => {
    const variance = round2(l.actual - l.budget);
    return {
      ...l,
      variance,
      variancePct: l.budget === 0 ? null : round2((variance / Math.abs(l.budget)) * 100),
      favourable: l.income ? variance >= 0 : variance <= 0,
    };
  });
}

/**
 * Revenue variance split into price, mix and quantity effects using net prices:
 * price = Σ (AP − BP)·AQ; mix = Σ (AQᵢ − AQ·BQᵢ/BQ)·BPᵢ; quantity = (AQ − BQ)·(budget revenue / BQ).
 * The three add up to actual − budget revenue across the product lines with actuals.
 */
export function revenueVarianceAnalysis(products: ProductLine[]) {
  const lines = products.filter((p) => p.actualUnits != null && p.actualUnitPrice != null);
  if (!lines.length) return null;
  const BQ = lines.reduce((a, p) => a + p.units, 0);
  const AQ = lines.reduce((a, p) => a + (p.actualUnits ?? 0), 0);
  const budgetRev = lines.reduce((a, p) => a + p.units * netPrice(p), 0);
  const actualRev = lines.reduce((a, p) => a + (p.actualUnits ?? 0) * (p.actualUnitPrice ?? 0) * (1 - p.discountPct), 0);
  const price = lines.reduce((a, p) => a + ((p.actualUnitPrice ?? 0) * (1 - p.discountPct) - netPrice(p)) * (p.actualUnits ?? 0), 0);
  const mix = BQ ? lines.reduce((a, p) => a + ((p.actualUnits ?? 0) - (AQ * p.units) / BQ) * netPrice(p), 0) : 0;
  const quantity = BQ ? (AQ - BQ) * (budgetRev / BQ) : 0;
  return {
    budgetRevenue: round2(budgetRev),
    actualRevenue: round2(actualRev),
    price: round2(price),
    mix: round2(mix),
    quantity: round2(quantity),
    total: round2(actualRev - budgetRev),
  };
}
