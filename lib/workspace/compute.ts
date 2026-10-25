import { applyAjes, bridgeEntries } from "../finance/adjustments";
import { altmanZ, beneishM, dupont } from "../finance/diagnostics";
import { analyze, type Analysis } from "../finance/engine";
import { triggeredNotes, type NoteContext } from "../finance/disclosures";
import { cashMovements, glVsTb, unbalancedJournals } from "../finance/gl";
import { applyScenario, covenantTest, defaultModelInputs, runModel, sensitivityGrid, type ModelInputs } from "../finance/model";
import { cashFlowDirectDerived, cashFlowIndirect, equityStatement } from "../finance/statements";
import { stressTest } from "../finance/stress";
import { apAnalysis, arAging, bankReconciliation, etaReconciliation, farSummary, inventorySummary, payrollSummary, tieOut } from "../finance/subledgers";
import { taxComputation } from "../finance/tax";
import { compsValuation, dcf, footballField, ufcf, wacc } from "../finance/valuation";
import { scanAnomalies } from "../finance/anomalies";
import { monthlyTrend, trendSummary } from "../finance/trends";
import { budgetStatements, budgetVsActual, revenueVarianceAnalysis } from "../finance/budget";
import type { Company, PeriodStatus } from "./types";

export type Computed = ReturnType<typeof computeCompany>;

export function computeCompany(c: Company) {
  const bridge = bridgeEntries(c.settings.framework, c.bridge, c.period.end);
  const rows = applyAjes(c.rows, [...c.ajes, ...bridge]);
  const analysis: Analysis | null = rows.length ? analyze(rows) : null;
  if (!analysis) return { rows, analysis: null } as const;
  const cur = analysis.current;
  const prior = analysis.prior;

  const equity = equityStatement(cur, prior, c.settings.framework, c.bridge);
  const cashFlow = prior ? cashFlowIndirect(cur, prior) : null;
  const cashFlowDirect = prior ? cashFlowDirectDerived(cur, prior) : null;

  const sl = c.subledgers;
  // Foreign-currency invoices are translated at the analyst's rates so they tie to the functional-currency TB.
  const fn = c.settings.functionalCurrency;
  const fxMissing = new Set<string>();
  const arFn = sl.ar.map((i) => {
    const ccy = (i.currency || fn).toUpperCase();
    if (ccy === fn) return i;
    const rate = c.fxRates[ccy];
    if (!rate) {
      fxMissing.add(ccy);
      return i;
    }
    return { ...i, amount: i.amount * rate, outstanding: i.outstanding * rate };
  });
  const ar = sl.ar.length ? arAging(arFn, c.period.end, c.eclRates) : null;
  const ap = sl.ap.length ? apAnalysis(sl.ap, c.period.end) : null;
  const far = sl.far.length ? farSummary(sl.far, c.period.start, c.period.end, c.tax.rate) : null;
  const inventory = sl.inventory.length ? inventorySummary(sl.inventory, cur.cogs) : null;
  const payroll = sl.payroll.length ? payrollSummary(sl.payroll, Math.max(0, cur.netProfit), c.profitSharePct, c.payrollPeriodsPerYear) : null;
  const eta = sl.eta.length ? etaReconciliation(sl.eta, cur.revenue) : null;
  const cashCodes = new Set(rows.filter((r) => r.category === "CASH").map((r) => r.code));
  const gl = sl.gl.length ? { vsTb: glVsTb(sl.gl, c.rows), unbalanced: unbalancedJournals(sl.gl), lines: sl.gl.length } : null;
  const bank = sl.bank.length ? bankReconciliation(sl.bank, cashMovements(sl.gl, cashCodes), cur.cash) : null;
  const tieOuts = {
    ar: ar ? tieOut(ar.total, cur.receivables) : null,
    ap: ap ? tieOut(ap.openBalance, cur.payables) : null,
    farCost: far ? tieOut(far.rollForward.closingCost, cur.ppeGross) : null,
    farAccumDep: far ? tieOut(far.rollForward.accumulatedDepreciation, -cur.accumulatedDepreciation) : null,
    inventory: inventory ? tieOut(inventory.closingCost, cur.inventory) : null,
    eta: eta ? tieOut(eta.netSales, cur.revenue) : null,
  };

  const dp = dupont(cur);
  const altman = altmanZ(cur);
  const beneish = prior && cashFlow ? beneishM(cur, prior, cashFlow.operating) : null;

  const taxRes = taxComputation(cur, prior, c.tax, far ? { taxDepreciation: far.tax.taxDepreciation, initialAllowance: far.tax.initialAllowance, temporaryDifference: far.deferredTax.temporaryDifference } : null);

  const modelInputs: ModelInputs = c.model ?? defaultModelInputs(cur, prior);
  const perYear = modelInputs.granularity === "monthly" ? 12 : 1;
  const scenarios = Object.fromEntries(
    (["base", "bull", "bear"] as const).map((k) => {
      const periods = runModel(cur, applyScenario(modelInputs, c.scenarios[k]));
      return [k, { periods, covenants: covenantTest(periods, c.covenants, perYear) }];
    }),
  ) as Record<"base" | "bull" | "bear", { periods: ReturnType<typeof runModel>; covenants: ReturnType<typeof covenantTest> }>;
  const model = scenarios.base.periods;
  const sensitivity = sensitivityGrid(cur, modelInputs, c.sensitivity.x, c.sensitivity.y, c.sensitivity.metric, c.sensitivity.stepX, c.sensitivity.stepY);

  // Valuation runs on an annual projection so discounting is in years.
  const annual = modelInputs.granularity === "annual" ? model : runModel(cur, { ...modelInputs, granularity: "annual", periods: 5 });
  const w = wacc(c.valuation);
  const netDebt = cur.shortTermDebt + cur.longTermDebt - cur.cash;
  const flows = ufcf(annual, c.valuation.taxRate, cur);
  const dcfRes = w.available ? dcf(flows, w.wacc, c.valuation.terminalGrowth, c.valuation.exitMultiple, c.valuation.midYear, netDebt) : null;
  const comps = compsValuation(c.valuation.comps, cur, netDebt);
  const field = footballField(flows, c.valuation, w.available ? w.wacc : null, netDebt, comps);

  const stress = stressTest(rows, cur, c.stress);

  const budget = c.budgets.find((b) => b.id === c.activeBudgetId) ?? null;
  const budgetRes = budget ? { version: budget, statements: budgetStatements(budget, cur), bva: budgetVsActual(budget, cur), revenueVariance: revenueVarianceAnalysis(budget.products) } : null;

  const noteCtx: Omit<NoteContext, "fmt"> = {
    cur,
    prior,
    framework: c.settings.framework,
    currency: c.settings.presentationCurrency,
    ecl: ar ? { total: ar.total, ecl: ar.ecl } : null,
    far: far ? far.rollForward : null,
    inventoryWriteDown: inventory ? inventory.nrvWriteDown : null,
    goingConcernFlag: cur.totalEquity <= 0 || altman.zone === "distress",
    taxPayable: taxRes.payable,
    deferredTax: { net: taxRes.deferredTax.net, position: taxRes.deferredTax.position },
  };
  const notes = triggeredNotes({ ...noteCtx, fmt: String });

  // ETA differences are an audit finding, not a reconciliation gate, so they do not block the period.
  const gatingTies = { ar: tieOuts.ar, ap: tieOuts.ap, farCost: tieOuts.farCost, farAccumDep: tieOuts.farAccumDep, inventory: tieOuts.inventory };
  const checks = periodChecks(c, analysis, cashFlow?.tieOutDifference ?? null, gatingTies);

  const anomalies = scanAnomalies({ rows, analysis, period: c.period, gl: sl.gl, ar: arFn, ap: sl.ap, inventory: sl.inventory, payroll: sl.payroll, bankDifference: bank ? bank.difference : null });
  const trend = c.monthly.length ? monthlyTrend(c.monthly, c.monthlyYtd, c.settings.fiscalYearEnd === "06-30" ? 7 : 1) : [];

  return {
    rows,
    analysis,
    bridge,
    equity,
    cashFlow,
    cashFlowDirect,
    subledgers: { ar, ap, far, inventory, payroll, eta, gl, bank },
    tieOuts,
    dupont: dp,
    altman,
    beneish,
    tax: taxRes,
    modelInputs,
    scenarios,
    model,
    sensitivity,
    valuation: { wacc: w, flows, dcf: dcfRes, comps, footballField: field, netDebt },
    stress,
    budget: budgetRes,
    noteCtx,
    notes,
    checks,
    anomalies,
    trend,
    trendSummary: trendSummary(trend),
    fx: { functional: fn, rates: c.fxRates, missing: [...fxMissing] },
  } as const;
}

export interface PeriodCheck {
  key: string;
  ok: boolean;
  requiredFor: PeriodStatus;
}

/** Gates for the period state machine: MAPPED needs confirmed mapping; RECONCILED needs balanced statements and tie-outs. */
export function periodChecks(c: Company, a: Analysis, cfDiff: number | null, ties: Record<string, { ties: boolean } | null>): PeriodCheck[] {
  const balanced = !a.issues.some((i) => i.code === "unbalanced");
  return [
    { key: "tbBalanced", ok: balanced, requiredFor: "MAPPED" },
    { key: "allMapped", ok: c.rows.every((r) => r.category !== ""), requiredFor: "MAPPED" },
    { key: "mappingConfirmed", ok: c.period.mappingConfirmed && !c.rows.some((r) => r.suggested), requiredFor: "MAPPED" },
    { key: "bsTies", ok: Math.abs(a.current.balanceCheck) < 0.01, requiredFor: "RECONCILED" },
    { key: "cashFlowTies", ok: cfDiff === null || Math.abs(cfDiff) < 0.01, requiredFor: "RECONCILED" },
    { key: "subledgersTie", ok: Object.values(ties).every((t) => t === null || t.ties), requiredFor: "RECONCILED" },
  ];
}

export function canAdvance(checks: PeriodCheck[], to: PeriodStatus): boolean {
  const order: PeriodStatus[] = ["DRAFT", "MAPPED", "RECONCILED", "LOCKED"];
  const need = order.slice(1, order.indexOf(to) + 1);
  return checks.filter((ch) => need.includes(ch.requiredFor)).every((ch) => ch.ok);
}
