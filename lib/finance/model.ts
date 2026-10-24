import { round2, STATUTORY_TAX_RATE, type PeriodFigures } from "./engine";

export interface ModelInputs {
  granularity: "annual" | "monthly";
  /** Number of periods: years for annual, months for monthly. */
  periods: number;
  revenueGrowth: number; // annual rate
  grossMargin: number;
  opexPctRevenue: number;
  capexPctRevenue: number;
  depreciationRate: number; // annual, on opening gross PP&E
  dso: number;
  dio: number;
  dpo: number;
  taxRate: number;
  debtInterestRate: number; // annual
  cashInterestRate: number; // annual
  termLoanRepayment: number; // per year
  minimumCash: number;
  cashSweep: boolean;
  dividendPayout: number;
  circularity: "iterative" | "beginning";
}

export function defaultModelInputs(cur: PeriodFigures, prior: PeriodFigures | null): ModelInputs {
  const r = (n: number) => Math.round(n * 10000) / 10000;
  const debt = cur.shortTermDebt + cur.longTermDebt;
  const avgDebt = prior ? (debt + prior.shortTermDebt + prior.longTermDebt) / 2 : debt;
  const days = (num: number, den: number) => (den ? Math.round((num / den) * 365) : 0);
  return {
    granularity: "annual",
    periods: 3,
    revenueGrowth: prior && prior.revenue ? r((cur.revenue - prior.revenue) / prior.revenue) : 0,
    grossMargin: cur.revenue ? r(cur.grossProfit / cur.revenue) : 0,
    opexPctRevenue: cur.revenue ? r((cur.sellingExpenses + cur.adminExpenses) / cur.revenue) : 0,
    capexPctRevenue: prior && cur.revenue ? r(Math.max(0, cur.ppeGross - prior.ppeGross) / cur.revenue) : 0,
    depreciationRate: cur.ppeGross ? r(cur.depreciation / cur.ppeGross) : 0,
    dso: days(cur.receivables, cur.revenue),
    dio: days(cur.inventory, cur.cogs),
    dpo: days(cur.payables, cur.cogs),
    taxRate: STATUTORY_TAX_RATE,
    debtInterestRate: avgDebt ? r(cur.financeCosts / avgDebt) : 0,
    cashInterestRate: 0,
    termLoanRepayment: 0,
    minimumCash: 0,
    cashSweep: false,
    dividendPayout: 0,
    circularity: "iterative",
  };
}

export interface ModelPeriod {
  period: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interestExpense: number;
  interestIncome: number;
  otherIncome: number;
  ebt: number;
  tax: number;
  netProfit: number;
  dividends: number;
  // balance sheet (closing)
  cash: number;
  receivables: number;
  inventory: number;
  otherCurrentAssets: number;
  ppeGross: number;
  accumulatedDepreciation: number;
  otherNonCurrentAssets: number;
  totalAssets: number;
  payables: number;
  otherCurrentLiabilities: number;
  revolver: number;
  termLoan: number;
  otherNonCurrentLiabilities: number;
  equity: number;
  totalLiabilitiesAndEquity: number;
  balanceCheck: number;
  // cash flow
  cfo: number;
  capex: number;
  revolverDraw: number;
  debtRepayment: number;
  cff: number;
  netCashFlow: number;
  // solver
  iterations: number;
  converged: boolean;
}

const EPSILON = 0.01;
const MAX_ITER = 10;

/**
 * Integrated 3-statement projection from the latest actual balance sheet.
 * Interest on average debt creates a circular reference; it is resolved with a bounded Gauss-Seidel loop
 * (max 10 iterations, convergence when interest moves by less than 0.01), or avoided by using opening balances.
 */
export function runModel(cur: PeriodFigures, m: ModelInputs): ModelPeriod[] {
  const perYear = m.granularity === "monthly" ? 12 : 1;
  const days = 365 / perYear;
  const g = (1 + m.revenueGrowth) ** (1 / perYear) - 1;
  const out: ModelPeriod[] = [];

  let o = {
    revenue: cur.revenue / perYear,
    cash: cur.cash,
    receivables: cur.receivables,
    inventory: cur.inventory,
    ppeGross: cur.ppeGross,
    accumDep: -cur.accumulatedDepreciation, // positive magnitude
    payables: cur.payables,
    revolver: cur.shortTermDebt,
    termLoan: cur.longTermDebt,
    equity: cur.totalEquity,
  };
  const fixed = {
    otherCurrentAssets: cur.otherCurrentAssets + cur.unmappedHolding,
    otherNonCurrentAssets: cur.otherNonCurrentAssets,
    otherCurrentLiabilities: cur.otherCurrentLiabilities,
    otherNonCurrentLiabilities: cur.otherNonCurrentLiabilities,
  };

  for (let p = 1; p <= m.periods; p++) {
    const revenue = o.revenue * (1 + g);
    const cogs = revenue * (1 - m.grossMargin);
    const opex = revenue * m.opexPctRevenue;
    const ebitda = revenue - cogs - opex;
    const depreciation = Math.min((o.ppeGross * m.depreciationRate) / perYear, Math.max(0, o.ppeGross - o.accumDep));
    const capex = revenue * m.capexPctRevenue;
    const receivables = (revenue * m.dso) / days;
    const inventory = (cogs * m.dio) / days;
    const payables = (cogs * m.dpo) / days;
    const otherIncome = cur.otherIncome / perYear;
    const scheduledRepayment = Math.min(o.termLoan, m.termLoanRepayment / perYear);

    // Unknowns that depend on interest: closing cash, revolver and term loan.
    let closing = { cash: o.cash, revolver: o.revolver, termLoan: o.termLoan - scheduledRepayment };
    let interestExpense = 0;
    let interestIncome = 0;
    let iterations = 0;
    let converged = m.circularity === "beginning";
    let result!: Omit<ModelPeriod, "period" | "iterations" | "converged">;

    for (let it = 0; it < (m.circularity === "beginning" ? 1 : MAX_ITER); it++) {
      iterations = it + 1;
      const debtBase = m.circularity === "beginning" ? o.revolver + o.termLoan : (o.revolver + o.termLoan + closing.revolver + closing.termLoan) / 2;
      const cashBase = m.circularity === "beginning" ? o.cash : (o.cash + closing.cash) / 2;
      const newInterest = (debtBase * m.debtInterestRate) / perYear;
      const newIncome = (Math.max(0, cashBase) * m.cashInterestRate) / perYear;

      const ebit = ebitda - depreciation + otherIncome;
      const ebt = ebit - newInterest + newIncome;
      const tax = Math.max(0, ebt) * m.taxRate;
      const netProfit = ebt - tax;
      const dividends = Math.max(0, netProfit) * m.dividendPayout;
      const cfo = netProfit + depreciation - (receivables - o.receivables) - (inventory - o.inventory) + (payables - o.payables);
      let cash = o.cash + cfo - capex - scheduledRepayment - dividends;
      let revolver = o.revolver;
      let termLoan = o.termLoan - scheduledRepayment;
      let revolverDraw = 0;
      let extraRepayment = 0;
      if (cash < m.minimumCash) {
        revolverDraw = m.minimumCash - cash;
      } else if (m.cashSweep) {
        const excess = cash - m.minimumCash;
        const toRevolver = Math.min(excess, revolver);
        revolverDraw = -toRevolver;
        extraRepayment = Math.min(excess - toRevolver, termLoan);
      }
      revolver += revolverDraw;
      termLoan -= extraRepayment;
      cash += revolverDraw - extraRepayment;

      const ppeGross = o.ppeGross + capex;
      const accumDep = o.accumDep + depreciation;
      const equity = o.equity + netProfit - dividends;
      const totalAssets = cash + receivables + inventory + fixed.otherCurrentAssets + ppeGross - accumDep + fixed.otherNonCurrentAssets;
      const tle = payables + fixed.otherCurrentLiabilities + revolver + termLoan + fixed.otherNonCurrentLiabilities + equity;
      result = {
        revenue, cogs, grossProfit: revenue - cogs, opex, ebitda, depreciation, ebit,
        interestExpense: newInterest, interestIncome: newIncome, otherIncome, ebt, tax, netProfit, dividends,
        cash, receivables, inventory, otherCurrentAssets: fixed.otherCurrentAssets, ppeGross, accumulatedDepreciation: -accumDep,
        otherNonCurrentAssets: fixed.otherNonCurrentAssets, totalAssets, payables, otherCurrentLiabilities: fixed.otherCurrentLiabilities,
        revolver, termLoan, otherNonCurrentLiabilities: fixed.otherNonCurrentLiabilities, equity, totalLiabilitiesAndEquity: tle,
        balanceCheck: totalAssets - tle, cfo, capex: -capex, revolverDraw, debtRepayment: -(scheduledRepayment + extraRepayment),
        cff: revolverDraw - scheduledRepayment - extraRepayment - dividends, netCashFlow: cash - o.cash,
      };
      const delta = Math.abs(newInterest - interestExpense) + Math.abs(newIncome - interestIncome);
      interestExpense = newInterest;
      interestIncome = newIncome;
      closing = { cash, revolver, termLoan };
      if (it > 0 && delta < EPSILON) {
        converged = true;
        break;
      }
    }

    const rounded = Object.fromEntries(Object.entries(result).map(([k, v]) => [k, round2(v as number)])) as typeof result;
    out.push({ period: p, ...rounded, iterations, converged });
    o = {
      revenue,
      cash: result.cash,
      receivables,
      inventory,
      ppeGross: result.ppeGross,
      accumDep: -result.accumulatedDepreciation,
      payables,
      revolver: result.revolver,
      termLoan: result.termLoan,
      equity: result.equity,
    };
  }
  return out;
}

export type ScenarioKey = "base" | "bull" | "bear";
export interface ScenarioOverride {
  revenueGrowthDelta: number;
  grossMarginDelta: number;
  opexPctDelta: number;
  interestRateDelta: number;
}
export const DEFAULT_SCENARIOS: Record<ScenarioKey, ScenarioOverride> = {
  base: { revenueGrowthDelta: 0, grossMarginDelta: 0, opexPctDelta: 0, interestRateDelta: 0 },
  bull: { revenueGrowthDelta: 0.05, grossMarginDelta: 0.01, opexPctDelta: -0.005, interestRateDelta: 0 },
  bear: { revenueGrowthDelta: -0.1, grossMarginDelta: -0.02, opexPctDelta: 0.01, interestRateDelta: 0.03 },
};

export function applyScenario(m: ModelInputs, s: ScenarioOverride): ModelInputs {
  return {
    ...m,
    revenueGrowth: m.revenueGrowth + s.revenueGrowthDelta,
    grossMargin: m.grossMargin + s.grossMarginDelta,
    opexPctRevenue: m.opexPctRevenue + s.opexPctDelta,
    debtInterestRate: Math.max(0, m.debtInterestRate + s.interestRateDelta),
  };
}

export const SENSITIVITY_DRIVERS = ["revenueGrowth", "grossMargin", "opexPctRevenue", "debtInterestRate", "capexPctRevenue"] as const;
export type SensitivityDriver = (typeof SENSITIVITY_DRIVERS)[number];
export const SENSITIVITY_METRICS = ["ebitda", "netProfit", "cash", "cfo"] as const;
export type SensitivityMetric = (typeof SENSITIVITY_METRICS)[number];

/** 5×5 grid: each axis moves its driver by −2, −1, 0, +1, +2 steps from the model value; metric is read in the final period. */
export function sensitivityGrid(cur: PeriodFigures, m: ModelInputs, x: SensitivityDriver, y: SensitivityDriver, metric: SensitivityMetric, stepX: number, stepY: number) {
  const steps = [-2, -1, 0, 1, 2];
  const xs = steps.map((s) => m[x] + s * stepX);
  const ys = steps.map((s) => m[y] + s * stepY);
  const grid = ys.map((yv) =>
    xs.map((xv) => {
      const periods = runModel(cur, { ...m, [x]: xv, [y]: yv });
      return periods[periods.length - 1][metric];
    }),
  );
  return { xs, ys, grid };
}

export interface Covenants {
  maxDebtToEbitda: number | null;
  minInterestCoverage: number | null;
}

export function covenantTest(periods: ModelPeriod[], c: Covenants, perYear = 1) {
  return periods.map((p) => {
    const debt = p.revolver + p.termLoan;
    const debtToEbitda = p.ebitda > 0 ? round2(debt / (p.ebitda * perYear)) : null;
    const coverage = p.interestExpense > 0 ? round2(p.ebit / p.interestExpense) : null;
    const leverageBreach = c.maxDebtToEbitda !== null && (debtToEbitda === null ? debt > 0 : debtToEbitda > c.maxDebtToEbitda);
    const coverageBreach = c.minInterestCoverage !== null && coverage !== null && coverage < c.minInterestCoverage;
    return { period: p.period, debtToEbitda, coverage, leverageBreach, coverageBreach };
  });
}
