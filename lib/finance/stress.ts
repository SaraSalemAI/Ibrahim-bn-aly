import { round2, type PeriodFigures } from "./engine";
import type { Category, TBRow } from "./types";

const MONETARY_ASSETS: Category[] = ["CASH", "RECEIVABLES"];
const MONETARY_LIABILITIES: Category[] = ["PAYABLES", "SHORT_TERM_DEBT", "OTHER_CURRENT_LIABILITY", "LONG_TERM_DEBT", "OTHER_NON_CURRENT_LIABILITY"];
const DEBT: Category[] = ["SHORT_TERM_DEBT", "LONG_TERM_DEBT"];

export interface StressInputs {
  foreignCurrency: string;
  /** Rate the TB was translated at (functional currency per 1 foreign unit). Must be entered. */
  baseRate: number | null;
  shockedRate: number | null;
  /** Share of COGS that is imported / priced in the foreign currency. */
  importedCogsShare: number;
  /** Share of an FX cost increase passed on to customers through prices. */
  passThrough: number;
  floatingDebtShare: number;
  /** Policy-rate shock in percentage points, e.g. 0.02 = +200 bp. */
  rateShock: number;
  taxRate: number;
}

export const DEFAULT_STRESS: StressInputs = {
  foreignCurrency: "USD",
  baseRate: null,
  shockedRate: null,
  importedCogsShare: 0,
  passThrough: 0,
  floatingDebtShare: 0,
  rateShock: 0,
  taxRate: 0.225,
};

/** Balances of rows tagged with the foreign currency, in functional currency at the base rate. */
export function fxExposure(rows: TBRow[], ccy: string) {
  let assets = 0;
  let liabilities = 0;
  let debt = 0;
  for (const r of rows) {
    if ((r.currency ?? "").toUpperCase() !== ccy.toUpperCase() || r.category === "") continue;
    const dr = r.currentDebit - r.currentCredit;
    if (MONETARY_ASSETS.includes(r.category)) assets += dr;
    if (MONETARY_LIABILITIES.includes(r.category)) liabilities += -dr;
    if (DEBT.includes(r.category)) debt += -dr;
  }
  return { monetaryAssets: round2(assets), monetaryLiabilities: round2(liabilities), debt: round2(debt), netPosition: round2(assets - liabilities) };
}

export function stressTest(rows: TBRow[], cur: PeriodFigures, s: StressInputs) {
  const exposure = fxExposure(rows, s.foreignCurrency);
  const fxReady = s.baseRate !== null && s.shockedRate !== null && s.baseRate > 0;
  const move = fxReady ? s.shockedRate! / s.baseRate! - 1 : 0;
  const totalDebt = cur.shortTermDebt + cur.longTermDebt;

  const translation = exposure.netPosition * move; // gain if net asset position and currency strengthens
  const fxDebtShare = totalDebt ? exposure.debt / totalDebt : 0;
  const fxInterest = cur.financeCosts * fxDebtShare * move;
  const cogsIncrease = cur.cogs * s.importedCogsShare * move * (1 - s.passThrough);
  const rateInterest = totalDebt * s.floatingDebtShare * s.rateShock;

  const ebtImpact = translation - fxInterest - cogsIncrease - rateInterest;
  const stressedEbt = cur.ebt + ebtImpact;
  const stressedTax = Math.max(0, stressedEbt) * s.taxRate;
  const stressedNet = stressedEbt - stressedTax;
  const stressedEbitda = cur.ebitda - cogsIncrease;
  const stressedFinance = cur.financeCosts + fxInterest + rateInterest;
  const stressedDebt = totalDebt + exposure.debt * move;
  const monthlyCash = (stressedNet + cur.depreciation) / 12;

  return {
    fxReady,
    move: round2(move * 100),
    exposure,
    impacts: {
      translation: round2(translation),
      fxDebtService: round2(-fxInterest),
      importedCogs: round2(-cogsIncrease),
      interestRateShock: round2(-rateInterest),
      ebt: round2(ebtImpact),
    },
    base: { netProfit: cur.netProfit, ebitda: cur.ebitda, debtToEbitda: cur.ebitda > 0 ? round2(totalDebt / cur.ebitda) : null, interestCoverage: cur.financeCosts > 0 ? round2(cur.ebit / cur.financeCosts) : null, equity: cur.totalEquity },
    stressed: {
      netProfit: round2(stressedNet),
      ebitda: round2(stressedEbitda),
      debtToEbitda: stressedEbitda > 0 ? round2(stressedDebt / stressedEbitda) : null,
      interestCoverage: stressedFinance > 0 ? round2((cur.ebit - cogsIncrease + translation) / stressedFinance) : null,
      equity: round2(cur.totalEquity - cur.netProfit + stressedNet),
      cashRunwayMonths: monthlyCash < 0 ? round2(cur.cash / -monthlyCash) : null,
    },
  };
}
