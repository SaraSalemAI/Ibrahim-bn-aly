import { round2, STATUTORY_TAX_RATE, type PeriodFigures } from "./engine";

/**
 * Egyptian corporate tax computation schedule (book-to-tax) following the build specification
 * (Law 91/2005 as amended, Law 30/2023). The rule parameters below are editable and must be confirmed
 * with a tax adviser; the app does not decide tax positions.
 */
export interface TaxInputs {
  rate: number;
  provisionsFormed: number;
  finesAndPenalties: number;
  unsupportedExpenses: number;
  /** Supported G&A used for the unsupported-expense allowance; null = admin expenses from the TB. */
  supportedGeneralAdmin: number | null;
  unsupportedAllowancePct: number;
  otherAddBacks: number;
  /** Statutory tax depreciation; null = take it from the fixed asset register when loaded. */
  taxDepreciation: number | null;
  realisedBadDebts: number;
  exemptIncome: number;
  otherDeductions: number;
  thinCapRatio: number;
  lossesBroughtForward: number;
  withholdingCredits: number;
  advancePayments: number;
  /** Closing balance of non-deductible provisions, for deferred tax. */
  provisionsBalance: number;
}

export const DEFAULT_TAX_INPUTS: TaxInputs = {
  rate: STATUTORY_TAX_RATE,
  provisionsFormed: 0,
  finesAndPenalties: 0,
  unsupportedExpenses: 0,
  supportedGeneralAdmin: null,
  unsupportedAllowancePct: 0.07,
  otherAddBacks: 0,
  taxDepreciation: null,
  realisedBadDebts: 0,
  exemptIncome: 0,
  otherDeductions: 0,
  thinCapRatio: 4,
  lossesBroughtForward: 0,
  withholdingCredits: 0,
  advancePayments: 0,
  provisionsBalance: 0,
};

export interface TaxLine {
  key: string;
  amount: number;
  kind: "start" | "add" | "deduct" | "subtotal" | "tax" | "credit" | "result";
  note?: string;
}

export function taxComputation(
  cur: PeriodFigures,
  prior: PeriodFigures | null,
  t: TaxInputs,
  far: { taxDepreciation: number; initialAllowance: number; temporaryDifference: number } | null,
) {
  const supportedGa = t.supportedGeneralAdmin ?? cur.adminExpenses;
  const unsupportedAddBack = Math.max(0, t.unsupportedExpenses - supportedGa * t.unsupportedAllowancePct);

  const debt = cur.shortTermDebt + cur.longTermDebt;
  const avgDebt = prior ? (debt + prior.shortTermDebt + prior.longTermDebt) / 2 : debt;
  const avgEquity = prior ? (cur.totalEquity + prior.totalEquity) / 2 : cur.totalEquity;
  const allowedDebt = Math.max(0, avgEquity) * t.thinCapRatio;
  const excessShare = avgDebt > 0 ? Math.max(0, avgDebt - allowedDebt) / avgDebt : 0;
  const disallowedInterest = cur.financeCosts * excessShare;

  const taxDep = t.taxDepreciation ?? (far ? far.taxDepreciation + far.initialAllowance : null);

  const adds: TaxLine[] = [
    { key: "accountingDepreciation", amount: cur.depreciation, kind: "add" },
    { key: "provisionsFormed", amount: t.provisionsFormed, kind: "add" },
    { key: "finesAndPenalties", amount: t.finesAndPenalties, kind: "add" },
    { key: "unsupportedExpenses", amount: unsupportedAddBack, kind: "add", note: `max(0, ${round2(t.unsupportedExpenses)} − ${t.unsupportedAllowancePct * 100}% × ${round2(supportedGa)})` },
    { key: "thinCapitalisationInterest", amount: disallowedInterest, kind: "add", note: `debt ${round2(avgDebt)} vs ${t.thinCapRatio}:1 × equity ${round2(avgEquity)}` },
    { key: "otherAddBacks", amount: t.otherAddBacks, kind: "add" },
  ];
  const deds: TaxLine[] = [
    { key: "taxDepreciation", amount: taxDep ?? 0, kind: "deduct", note: taxDep === null ? "not provided: load the fixed asset register or enter it" : undefined },
    { key: "realisedBadDebts", amount: t.realisedBadDebts, kind: "deduct" },
    { key: "exemptIncome", amount: t.exemptIncome, kind: "deduct" },
    { key: "otherDeductions", amount: t.otherDeductions, kind: "deduct" },
  ];
  const totalAdds = adds.reduce((a, l) => a + l.amount, 0);
  const totalDeds = deds.reduce((a, l) => a + l.amount, 0);
  const adjusted = cur.ebt + totalAdds - totalDeds;
  const lossesUsed = Math.min(Math.max(0, adjusted), t.lossesBroughtForward);
  const taxable = adjusted - lossesUsed;
  const tax = Math.max(0, taxable) * t.rate;
  const payable = tax - t.withholdingCredits - t.advancePayments;

  const rawLines: TaxLine[] = [
    { key: "profitBeforeTax", amount: cur.ebt, kind: "start" },
    ...adds,
    ...deds,
    { key: "adjustedProfit", amount: adjusted, kind: "subtotal" },
    { key: "lossesUsed", amount: lossesUsed, kind: "deduct" },
    { key: "taxableProfit", amount: taxable, kind: "subtotal" },
    { key: "corporateTax", amount: tax, kind: "tax", note: `${round2(t.rate * 100)}%` },
    { key: "withholdingCredits", amount: t.withholdingCredits, kind: "credit" },
    { key: "advancePayments", amount: t.advancePayments, kind: "credit" },
    { key: "taxPayable", amount: payable, kind: "result" },
  ];
  const lines: TaxLine[] = rawLines.map((l) => ({ ...l, amount: round2(l.amount) }));

  const fixedAssetTemp = far?.temporaryDifference ?? 0; // carrying amount − tax base: positive = taxable difference
  const provisionTemp = -t.provisionsBalance; // provisions deductible later: deductible difference
  const net = fixedAssetTemp + provisionTemp;
  return {
    lines,
    taxableProfit: round2(taxable),
    tax: round2(tax),
    payable: round2(payable),
    effectiveRate: cur.ebt > 0 ? round2((tax / cur.ebt) * 100) : null,
    bookedTax: cur.taxExpense,
    lossCarriedForward: round2(Math.max(0, t.lossesBroughtForward - lossesUsed) + Math.max(0, -taxable)),
    thinCap: { avgDebt: round2(avgDebt), avgEquity: round2(avgEquity), ratio: avgEquity > 0 ? round2(avgDebt / avgEquity) : null, disallowedInterest: round2(disallowedInterest) },
    deferredTax: {
      fixedAssets: { temporaryDifference: round2(fixedAssetTemp), amount: round2(fixedAssetTemp * t.rate) },
      provisions: { temporaryDifference: round2(provisionTemp), amount: round2(provisionTemp * t.rate) },
      net: round2(net * t.rate),
      position: net >= 0 ? ("DTL" as const) : ("DTA" as const),
      farAvailable: far !== null,
    },
  };
}
