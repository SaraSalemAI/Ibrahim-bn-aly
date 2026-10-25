import { medianOf } from "../finance/benchmark";
import { verifyAudit } from "../finance/audit";
import { computeCompany, type Computed } from "../workspace/compute";
import type { Company, Workspace } from "../workspace/types";

export const MODULES = [
  "overview", "company", "ingest", "mapping", "trial-balance", "statements", "cash-flow", "budget", "model",
  "analysis", "scenarios", "tax", "disclosures", "benchmarking", "valuation", "stress", "export", "audit", "close", "trends", "consolidation",
] as const;
export type ModuleId = (typeof MODULES)[number];

type Ready = Extract<Computed, { analysis: NonNullable<Computed["analysis"]> }>;

const pickVar = (v: Ready["analysis"]["variances"][number]) =>
  v.prior === null ? { current: v.current } : { current: v.current, prior: v.prior, change: v.change, changePct: v.changePct, material: v.material };

function core(c: Company, k: Ready) {
  const a = k.analysis;
  return {
    company: c.settings.tradeNameEn || "Not provided",
    currency: c.settings.presentationCurrency,
    framework: c.settings.framework,
    periods: { current: c.period.currentLabel, prior: a.hasPrior ? c.period.priorLabel : "not provided", status: c.period.status },
    validation: a.issues.map((i) => ({ level: i.level, code: i.code, ...i.params })),
    checks: k.checks.map((ch) => ({ check: ch.key, ok: ch.ok })),
    keyFigures: {
      revenue: a.current.revenue,
      grossProfit: a.current.grossProfit,
      ebitda: a.current.ebitda,
      netProfit: a.current.netProfit,
      totalAssets: a.current.totalAssets,
      totalEquity: a.current.totalEquity,
      cash: a.current.cash,
    },
  };
}

/** Facts for one module. Everything here is computed by deterministic code from the submitted workspace. */
export function moduleFacts(module: ModuleId, c: Company, k: Computed, ws?: Pick<Workspace, "companies" | "benchmarks" | "audit">) {
  if (!k.analysis) return { error: "No trial balance loaded" };
  const r = k as Ready;
  const a = r.analysis;
  const base = core(c, r);
  const sl = r.subledgers;
  switch (module) {
    case "ingest":
      return {
        ...base,
        documents: c.docs.map((d) => ({ file: d.fileName, category: d.category, rows: d.rowCount, sha256: d.sha256.slice(0, 16) })),
        tieOuts: r.tieOuts,
        gl: sl.gl ? { lines: sl.gl.lines, exceptions: sl.gl.vsTb.exceptions, unbalancedJournals: sl.gl.unbalanced.length } : "not loaded",
        eta: sl.eta ?? "not loaded",
        bank: sl.bank ? { difference: sl.bank.difference, unpresentedCheques: sl.bank.unpresentedCheques, depositsInTransit: sl.bank.depositsInTransit, bankItemsNotInBooks: sl.bank.bankItemsNotInBooks } : "not loaded",
      };
    case "mapping":
      return {
        ...base,
        unmapped: c.rows.filter((x) => x.category === "").map((x) => `${x.code} ${x.name}`),
        lowConfidence: c.rows.filter((x) => x.suggested && (x.confidence ?? 100) < 60).map((x) => ({ account: `${x.code} ${x.name}`, suggested: x.category, confidence: x.confidence })),
      };
    case "trial-balance": {
      const movers = c.rows
        .map((x) => ({ account: `${x.code} ${x.name}`, movement: Math.round((x.currentDebit - x.currentCredit - (x.priorDebit - x.priorCredit)) * 100) / 100 }))
        .sort((p, q) => Math.abs(q.movement) - Math.abs(p.movement))
        .slice(0, 10);
      return { ...base, totals: { currentDebits: a.current.totalDebits, currentCredits: a.current.totalCredits }, largestMovements: movers, adjustingEntries: c.ajes.map((j) => ({ id: j.id, reason: j.reason, lines: j.lines.length })) };
    }
    case "statements":
      return {
        ...base,
        incomeStatement: Object.fromEntries(a.variances.filter((v) => v.statement === "PL").map((v) => [v.key, pickVar(v)])),
        balanceSheet: Object.fromEntries(a.variances.filter((v) => v.statement === "BS").map((v) => [v.key, pickVar(v)])),
        changesInEquity: r.equity,
        frameworkBridge: r.bridge.map((b) => ({ id: b.id, standard: b.standardRef, reason: b.reason, amount: b.lines[0]?.debit })),
      };
    case "cash-flow":
      return { ...base, cashFlow: r.cashFlow ?? "prior period not provided", directDerived: r.cashFlowDirect ?? "prior period not provided" };
    case "budget":
      return r.budget
        ? { ...base, budgetVersion: r.budget.version.name, approved: r.budget.version.approved, budgetVsActual: r.budget.bva, revenueVariance: r.budget.revenueVariance ?? "no actual units/prices entered", budgetCash: r.budget.statements.cash }
        : { ...base, budget: "no budget version selected" };
    case "model":
      return {
        ...base,
        assumptions: r.modelInputs,
        periods: r.model.map((p) => ({ period: p.period, revenue: p.revenue, ebitda: p.ebitda, netProfit: p.netProfit, cash: p.cash, debt: p.revolver + p.termLoan, balanceCheck: p.balanceCheck, solverIterations: p.iterations, converged: p.converged })),
      };
    case "analysis":
      return {
        ...base,
        ratios: a.ratios.map((x) => ({ ratio: x.key, unit: x.unit, formula: x.formula, current: x.current, prior: a.hasPrior ? x.prior : "not provided" })),
        dupont: r.dupont,
        altmanZDoublePrime: r.altman,
        beneishM: r.beneish ?? "prior period not provided",
      };
    case "scenarios": {
      const last = (k2: "base" | "bull" | "bear") => {
        const ps = r.scenarios[k2].periods;
        const p = ps[ps.length - 1];
        return { assumptionsDelta: c.scenarios[k2], finalPeriod: p.period, revenue: p.revenue, ebitda: p.ebitda, netProfit: p.netProfit, cash: p.cash, covenantBreaches: r.scenarios[k2].covenants.filter((x) => x.leverageBreach || x.coverageBreach).map((x) => x.period) };
      };
      const flat = r.sensitivity.grid.flat();
      return {
        ...base,
        covenants: c.covenants,
        scenarios: { base: last("base"), bull: last("bull"), bear: last("bear") },
        sensitivity: { x: c.sensitivity.x, y: c.sensitivity.y, metric: c.sensitivity.metric, min: Math.min(...flat), max: Math.max(...flat), xs: r.sensitivity.xs, ys: r.sensitivity.ys },
      };
    }
    case "tax":
      return { ...base, inputs: c.tax, schedule: r.tax.lines, thinCap: r.tax.thinCap, deferredTax: r.tax.deferredTax, bookedTax: r.tax.bookedTax, effectiveRate: r.tax.effectiveRate, form41FromAp: sl.ap?.form41 ?? "AP subledger not loaded" };
    case "disclosures":
      return { ...base, notes: r.notes.map((n) => ({ id: n.id, standard: n.standard, status: c.disclosures[n.id]?.status ?? "DRAFT" })) };
    case "benchmarking": {
      const peers = (ws?.companies ?? []).filter((p) => p.id !== c.id);
      const kpis = ["grossMargin", "ebitdaMargin", "netMargin", "roe", "currentRatio", "debtToEquity", "dso"];
      const own = Object.fromEntries(a.ratios.filter((x) => kpis.includes(x.key)).map((x) => [x.key, x.current]));
      const peerRatios = peers.map((p) => computeCompany(p).analysis?.ratios ?? []);
      const peerMedian = Object.fromEntries(kpis.map((key) => [key, medianOf(peerRatios.map((rs) => rs.find((x) => x.key === key)?.current ?? null))]));
      return { ...base, own, peersInWorkspace: peers.length, peerMedian, industryBenchmarks: ws?.benchmarks ?? "not provided" };
    }
    case "valuation":
      return { ...base, inputs: { ...c.valuation, comps: c.valuation.comps.length }, wacc: r.valuation.wacc, unleveredFreeCashFlows: r.valuation.flows, dcf: r.valuation.dcf ?? "market inputs not provided", comps: r.valuation.comps, footballField: r.valuation.footballField, netDebt: r.valuation.netDebt };
    case "stress":
      return { ...base, inputs: c.stress, stress: r.stress };
    case "close":
      return {
        ...base,
        anomalies: r.anomalies.map((x) => ({ id: x.id, area: x.area, severity: x.severity, finding: x.title[0], why: x.detail[0], count: x.count, examples: x.examples.slice(0, 4) })),
        tieOuts: r.tieOuts,
        missingFxRates: r.fx.missing,
        loadedSources: c.docs.map((d) => d.category),
        materialVariances: a.variances.filter((v) => v.material).map((v) => ({ line: v.key, ...pickVar(v) })),
      };
    case "trends":
      return { ...base, ytdFiles: c.monthlyYtd, months: r.trend, summary: r.trendSummary ?? "no monthly trial balances loaded" };
    case "consolidation":
      return { ...base, note: "Consolidation facts are computed on the consolidation page; this is the parent company only." };
    case "audit": {
      const log = ws?.audit ?? [];
      const byAction: Record<string, number> = {};
      for (const e of log.filter((x) => x.companyId === c.id)) byAction[e.action] = (byAction[e.action] ?? 0) + 1;
      return { ...base, chain: verifyAudit(log), entries: log.length, byAction, lockedAt: c.period.lockedAt };
    }
    default:
      return {
        ...base,
        materialVariances: a.variances.filter((v) => v.material).map((v) => ({ line: v.key, ...pickVar(v) })),
        ratios: a.ratios.map((x) => ({ ratio: x.key, current: x.current, prior: a.hasPrior ? x.prior : "not provided" })),
        tieOuts: r.tieOuts,
        altmanZone: r.altman.zone,
        cashFlowTie: r.cashFlow?.tieOutDifference ?? "prior period not provided",
      };
  }
}
