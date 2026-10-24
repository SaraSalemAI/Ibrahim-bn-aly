import { round2, type PeriodFigures } from "./engine";
import type { ModelPeriod } from "./model";

/** All market inputs come from the analyst; null means not provided and blocks the dependent calculation. */
export interface ValuationInputs {
  riskFreeRate: number | null;
  beta: number | null;
  equityRiskPremium: number | null;
  countryRiskPremium: number | null;
  preTaxCostOfDebt: number | null;
  targetDebtWeight: number | null;
  taxRate: number;
  terminalGrowth: number | null;
  exitMultiple: number | null;
  midYear: boolean;
  comps: Array<{ name: string; evRevenue: number | null; evEbitda: number | null; pe: number | null }>;
}

export const DEFAULT_VALUATION: ValuationInputs = {
  riskFreeRate: null,
  beta: null,
  equityRiskPremium: null,
  countryRiskPremium: null,
  preTaxCostOfDebt: null,
  targetDebtWeight: null,
  taxRate: 0.225,
  terminalGrowth: null,
  exitMultiple: null,
  midYear: false,
  comps: [],
};

export function wacc(v: ValuationInputs) {
  const missing = (["riskFreeRate", "beta", "equityRiskPremium", "countryRiskPremium", "preTaxCostOfDebt", "targetDebtWeight"] as const).filter((k) => v[k] === null);
  if (missing.length) return { available: false as const, missing };
  const ke = v.riskFreeRate! + v.beta! * v.equityRiskPremium! + v.countryRiskPremium!;
  const kd = v.preTaxCostOfDebt! * (1 - v.taxRate);
  const wd = v.targetDebtWeight!;
  return { available: true as const, missing, costOfEquity: ke, afterTaxCostOfDebt: kd, debtWeight: wd, equityWeight: 1 - wd, wacc: ke * (1 - wd) + kd * wd };
}

export function ufcf(periods: ModelPeriod[], taxRate: number, opening: PeriodFigures) {
  let prevNwc = opening.receivables + opening.inventory - opening.payables;
  return periods.map((p) => {
    const nwc = p.receivables + p.inventory - p.payables;
    const changeNwc = nwc - prevNwc;
    prevNwc = nwc;
    // capex is negative in the model output (cash outflow)
    const value = p.ebit * (1 - taxRate) + p.depreciation + p.capex - changeNwc;
    return { period: p.period, nopat: round2(p.ebit * (1 - taxRate)), depreciation: p.depreciation, capex: p.capex, changeNwc: round2(changeNwc), ufcf: round2(value), ebitda: p.ebitda };
  });
}

export function dcf(flows: { ufcf: number; ebitda: number }[], rate: number, g: number | null, exitMultiple: number | null, midYear: boolean, netDebt: number) {
  const pv = flows.map((f, i) => f.ufcf / (1 + rate) ** (i + (midYear ? 0.5 : 1)));
  const pvFlows = pv.reduce((a, b) => a + b, 0);
  const n = flows.length;
  const last = flows[n - 1];
  const discountN = (1 + rate) ** n;
  const gordon = g !== null && rate > g ? (last.ufcf * (1 + g)) / (rate - g) : null;
  const exit = exitMultiple !== null ? last.ebitda * exitMultiple : null;
  const mk = (tv: number | null) => {
    if (tv === null) return null;
    const pvTv = tv / discountN;
    const ev = pvFlows + pvTv;
    return { terminalValue: round2(tv), pvTerminal: round2(pvTv), enterpriseValue: round2(ev), equityValue: round2(ev - netDebt), tvShare: ev ? round2((pvTv / ev) * 100) : null };
  };
  return { pvFlows: round2(pvFlows), gordon: mk(gordon), exit: mk(exit), gordonInvalid: g !== null && rate <= g };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function compsValuation(comps: ValuationInputs["comps"], cur: PeriodFigures, netDebt: number) {
  const metric = { evRevenue: cur.revenue, evEbitda: cur.ebitda, pe: cur.netProfit };
  return (["evRevenue", "evEbitda", "pe"] as const).map((k) => {
    const xs = comps.map((c) => c[k]).filter((x): x is number => x !== null && Number.isFinite(x));
    if (!xs.length || metric[k] <= 0) return { multiple: k, count: xs.length, low: null, median: null, high: null };
    const toEquity = (mult: number) => (k === "pe" ? mult * metric[k] : mult * metric[k] - netDebt);
    return { multiple: k, count: xs.length, low: round2(toEquity(Math.min(...xs))), median: round2(toEquity(median(xs))), high: round2(toEquity(Math.max(...xs))) };
  });
}

/** Football field: equity value ranges from DCF (±1pp WACC, ±0.5pp g, ±1× exit multiple) and trading multiples. */
export function footballField(flows: { ufcf: number; ebitda: number }[], v: ValuationInputs, w: number | null, netDebt: number, comps: ReturnType<typeof compsValuation>) {
  const bars: { label: string; low: number; high: number; mid: number }[] = [];
  if (w !== null && v.terminalGrowth !== null) {
    const vals = [w - 0.01, w, w + 0.01].flatMap((r) => [v.terminalGrowth! - 0.005, v.terminalGrowth! + 0.005].map((g) => dcf(flows, r, g, null, v.midYear, netDebt).gordon?.equityValue ?? null));
    const ok = vals.filter((x): x is number => x !== null);
    const mid = dcf(flows, w, v.terminalGrowth, null, v.midYear, netDebt).gordon?.equityValue;
    if (ok.length && mid != null) bars.push({ label: "DCF — Gordon growth", low: Math.min(...ok), high: Math.max(...ok), mid });
  }
  if (w !== null && v.exitMultiple !== null) {
    const vals = [w - 0.01, w + 0.01].flatMap((r) => [v.exitMultiple! - 1, v.exitMultiple! + 1].map((x) => dcf(flows, r, null, x, v.midYear, netDebt).exit!.equityValue));
    const mid = dcf(flows, w, null, v.exitMultiple, v.midYear, netDebt).exit!.equityValue;
    bars.push({ label: "DCF — exit multiple", low: Math.min(...vals), high: Math.max(...vals), mid });
  }
  for (const c of comps) if (c.low !== null) bars.push({ label: `Comps — ${{ evRevenue: "EV/Revenue", evEbitda: "EV/EBITDA", pe: "P/E" }[c.multiple]}`, low: c.low, high: c.high!, mid: c.median! });
  return bars;
}
