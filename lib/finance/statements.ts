import { round2, type PeriodFigures } from "./engine";
import type { BridgeInputs, Framework } from "./adjustments";

// ------------------------------------------------------- changes in equity

export interface EquityRow {
  key: string;
  shareCapital: number;
  legalReserve: number;
  retainedEarnings: number;
  otherEquity: number;
  total: number;
}

const row = (key: string, sc: number, lr: number, re: number, oe: number): EquityRow => ({
  key,
  shareCapital: round2(sc),
  legalReserve: round2(lr),
  retainedEarnings: round2(re),
  otherEquity: round2(oe),
  total: round2(sc + lr + re + oe),
});

/**
 * Statement of changes in equity from two pre-closing trial balances.
 * Opening retained earnings = prior RE + prior profit. Movements not explained by the legal reserve
 * transfer or current profit are shown as "dividends and other appropriations (derived)".
 */
export function equityStatement(cur: PeriodFigures, prior: PeriodFigures | null, framework: Framework, bridge: BridgeInputs) {
  const closing = row("closing", cur.shareCapital, cur.legalReserve, cur.retainedEarnings + cur.netProfit, cur.otherEquity);
  const memo =
    framework === "EAS"
      ? {
          employeeProfitShare: round2(bridge.employeeProfitShare),
          boardRemuneration: round2(bridge.boardRemuneration),
          note: "EAS: proposed appropriations of profit, recognised in equity when approved by the general assembly.",
        }
      : { employeeProfitShare: 0, boardRemuneration: 0, note: "IFRS: profit share and board remuneration are expensed in profit or loss (IAS 19 / IAS 24)." };
  if (!prior) return { available: false as const, rows: [closing], memo, legalReserveCheck: null };

  const openingRe = prior.retainedEarnings + prior.netProfit;
  const transferToLegal = cur.legalReserve - prior.legalReserve;
  const reMovement = cur.retainedEarnings - openingRe; // = −transfer − dividends/other
  const dividendsOther = -(reMovement + transferToLegal);
  const rows = [
    row("opening", prior.shareCapital, prior.legalReserve, openingRe, prior.otherEquity),
    row("capitalIncrease", cur.shareCapital - prior.shareCapital, 0, 0, 0),
    row("transferToLegalReserve", 0, transferToLegal, -transferToLegal, 0),
    row("dividendsAndOther", 0, 0, -dividendsOther, 0),
    row("otherEquityMovement", 0, 0, 0, cur.otherEquity - prior.otherEquity),
    row("profitForPeriod", 0, 0, cur.netProfit, 0),
    closing,
  ];
  // Companies law: 5% of net profit to the legal reserve until it reaches 50% of issued capital. Parameter — confirm.
  const required = Math.max(0, Math.min(prior.netProfit * 0.05, prior.shareCapital * 0.5 - prior.legalReserve));
  return {
    available: true as const,
    rows,
    memo,
    legalReserveCheck: { required: round2(required), actual: round2(transferToLegal), shortfall: round2(Math.max(0, required - transferToLegal)) },
  };
}

// ------------------------------------------------------------- cash flow

export interface CashFlowLine {
  key: string;
  section: "operating" | "investing" | "financing";
  amount: number;
  derived?: boolean;
}

/**
 * Indirect-method cash flow from two balance sheets and the current income statement. Every balance-sheet movement
 * is classified, so the statement ties to cash by construction when both trial balances balance.
 * Non-cash and unexplained items are labelled instead of being netted into a plug.
 */
export function cashFlowIndirect(cur: PeriodFigures, prior: PeriodFigures) {
  const d = (k: keyof PeriodFigures) => cur[k] - prior[k];
  const accumDepIncrease = -(cur.accumulatedDepreciation - prior.accumulatedDepreciation); // contra asset is negative
  const disposalsAccumDep = accumDepIncrease - cur.depreciation; // < 0 means accumulated depreciation released on disposals
  const lines: CashFlowLine[] = [
    { key: "netProfit", section: "operating", amount: cur.netProfit },
    { key: "depreciation", section: "operating", amount: cur.depreciation },
    { key: "changeReceivables", section: "operating", amount: -d("receivables") },
    { key: "changeInventory", section: "operating", amount: -d("inventory") },
    { key: "changeOtherCurrentAssets", section: "operating", amount: -d("otherCurrentAssets") },
    { key: "changePayables", section: "operating", amount: d("payables") },
    { key: "changeOtherCurrentLiabilities", section: "operating", amount: d("otherCurrentLiabilities") },
    { key: "changeUnmapped", section: "operating", amount: -d("unmappedHolding"), derived: true },
    { key: "capex", section: "investing", amount: -d("ppeGross") },
    { key: "disposalsAccumulatedDepreciation", section: "investing", amount: disposalsAccumDep, derived: true },
    { key: "changeOtherNonCurrentAssets", section: "investing", amount: -d("otherNonCurrentAssets") },
    { key: "changeShortTermDebt", section: "financing", amount: d("shortTermDebt") },
    { key: "changeLongTermDebt", section: "financing", amount: d("longTermDebt") },
    { key: "changeOtherNonCurrentLiabilities", section: "financing", amount: d("otherNonCurrentLiabilities") },
    { key: "shareCapitalIssued", section: "financing", amount: d("shareCapital") },
    {
      key: "dividendsAndOtherEquity",
      section: "financing",
      // Equity movement other than current profit: Δ(LR + RE + OE) − prior profit (closed to RE during the period).
      amount: d("legalReserve") + d("retainedEarnings") + d("otherEquity") - prior.netProfit,
      derived: true,
    },
  ].map((l) => ({ ...l, amount: round2(l.amount) })) as CashFlowLine[];

  const total = (s: CashFlowLine["section"]) => round2(lines.filter((l) => l.section === s).reduce((a, l) => a + l.amount, 0));
  const operating = total("operating");
  const investing = total("investing");
  const financing = total("financing");
  const netChange = round2(operating + investing + financing);
  const endingPerCf = round2(prior.cash + netChange);
  return {
    lines: lines.filter((l) => l.amount !== 0 || !l.derived),
    operating,
    investing,
    financing,
    netChange,
    beginningCash: prior.cash,
    endingCashPerCashFlow: endingPerCf,
    endingCashPerBalanceSheet: cur.cash,
    tieOutDifference: round2(endingPerCf - cur.cash),
    freeCashFlow: round2(operating + lines.find((l) => l.key === "capex")!.amount),
  };
}

/**
 * Direct method derived from accruals (no transaction-level cash detail). Every line is labelled as derived;
 * operating total equals the indirect method.
 */
export function cashFlowDirectDerived(cur: PeriodFigures, prior: PeriodFigures) {
  const d = (k: keyof PeriodFigures) => cur[k] - prior[k];
  const receipts = cur.revenue - d("receivables") + cur.otherIncome;
  const suppliers = -(cur.cogs + d("inventory") - d("payables"));
  const operatingExpenses = -(cur.sellingExpenses + cur.adminExpenses + d("otherCurrentAssets"));
  const financeAndTax = -(cur.financeCosts + cur.taxExpense) + d("otherCurrentLiabilities");
  const unmapped = -d("unmappedHolding");
  const lines = [
    { key: "receiptsFromCustomers", amount: receipts },
    { key: "paymentsToSuppliers", amount: suppliers },
    { key: "paymentsForOperatingExpenses", amount: operatingExpenses },
    { key: "interestAndTaxPaid", amount: financeAndTax },
    ...(unmapped ? [{ key: "changeUnmapped", amount: unmapped }] : []),
  ].map((l) => ({ ...l, amount: round2(l.amount), derived: true }));
  return { lines, operating: round2(lines.reduce((a, l) => a + l.amount, 0)) };
}
