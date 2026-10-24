import { describe, expect, it } from "vitest";
import { applyAjes, bridgeEntries, effectiveRows } from "../lib/finance/adjustments";
import { appendAudit, verifyAudit } from "../lib/finance/audit";
import { budgetStatements, budgetVsActual, emptyBudget, revenueVarianceAnalysis } from "../lib/finance/budget";
import { applyPrefixRule, suggestMapping } from "../lib/finance/classify";
import { altmanZ, beneishM, dupont } from "../lib/finance/diagnostics";
import { computePeriod } from "../lib/finance/engine";
import { glVsTb, parseGl, unbalancedJournals, csvChunks } from "../lib/finance/gl";
import { sha256 } from "../lib/finance/hash";
import { covenantTest, defaultModelInputs, runModel, sensitivityGrid } from "../lib/finance/model";
import { parseTrialBalance } from "../lib/finance/parse";
import { SAMPLE_TB_CSV } from "../lib/finance/sample";
import * as S from "../lib/finance/sampleData";
import { cashFlowDirectDerived, cashFlowIndirect, equityStatement } from "../lib/finance/statements";
import { stressTest } from "../lib/finance/stress";
import * as SL from "../lib/finance/subledgers";
import { DEFAULT_TAX_INPUTS, taxComputation } from "../lib/finance/tax";
import { compsValuation, dcf, ufcf, wacc, DEFAULT_VALUATION } from "../lib/finance/valuation";
import { parseDate } from "../lib/finance/table";

const rows = () => parseTrialBalance(SAMPLE_TB_CSV).rows;
const cur = () => computePeriod(rows(), "current");
const prior = () => computePeriod(rows(), "prior");

describe("hash and audit chain", () => {
  it("matches known SHA-256 vectors", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("a".repeat(1000))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });

  it("detects tampering", () => {
    let log = appendAudit([], { userId: "u", role: "CFO", companyId: "c", action: "upload", entity: "source_documents" });
    log = appendAudit(log, { userId: "u", role: "CFO", companyId: "c", action: "lock", entity: "financial_periods" });
    expect(verifyAudit(log).valid).toBe(true);
    const tampered = log.map((e, i) => (i === 0 ? { ...e, action: "delete" } : e));
    expect(verifyAudit(tampered)).toEqual({ valid: false, brokenAt: 1 });
  });
});

describe("mapping", () => {
  it("scores confidence higher when the code prefix agrees", () => {
    expect(suggestMapping("1101", "النقدية بالبنوك").confidence).toBe(95);
    expect(suggestMapping("9101", "Cash at bank").confidence).toBe(85);
    expect(suggestMapping("2101", "Cash at bank").confidence).toBe(65);
  });
  it("applies a bulk prefix rule", () => {
    const { rows: out, changed } = applyPrefixRule(rows(), "11*", "CASH");
    expect(changed).toBe(1);
    expect(out[0].mappingRule).toBe("bulk:11*");
  });
  it("parses Egyptian date formats", () => {
    expect(parseDate("31/12/2025")).toBe("2025-12-31");
    expect(parseDate("2025-02-30")).toBeNull();
  });
});

describe("AJEs and the EAS/IFRS bridge (G-05)", () => {
  it("IFRS moves employee profit share into P&L; EAS leaves profit unchanged", () => {
    const bridge = { employeeProfitShare: 300000, boardRemuneration: 100000 };
    const eas = computePeriod(effectiveRows(rows(), [], "EAS", bridge, "2025-12-31"), "current");
    const ifrs = computePeriod(effectiveRows(rows(), [], "IFRS", bridge, "2025-12-31"), "current");
    expect(eas.netProfit).toBe(cur().netProfit);
    expect(ifrs.adminExpenses - eas.adminExpenses).toBe(400000);
    expect(ifrs.balanceCheck).toBe(0);
    expect(bridgeEntries("EAS", bridge, "x")).toHaveLength(0);
    const st = equityStatement(eas, prior(), "EAS", bridge);
    expect(st.memo.employeeProfitShare).toBe(300000);
  });
  it("applies a balanced AJE and ignores an unbalanced one", () => {
    const aje = { id: "AJE-1", date: "2025-12-31", reason: "accrual", author: "u", kind: "AJE" as const, lines: [
      { code: "6201", name: "", category: "ADMIN_EXPENSE" as const, debit: 50000, credit: 0 },
      { code: "2301", name: "", category: "OTHER_CURRENT_LIABILITY" as const, debit: 0, credit: 50000 },
    ] };
    const out = applyAjes(rows(), [aje, { ...aje, id: "AJE-2", lines: [aje.lines[0]] }]);
    const f = computePeriod(out, "current");
    expect(f.adminExpenses).toBe(2_710_000);
    expect(f.totalDebits).toBe(f.totalCredits);
  });
});

describe("equity and cash flow (G-03)", () => {
  it("rolls equity forward", () => {
    const st = equityStatement(cur(), prior(), "EAS", { employeeProfitShare: 0, boardRemuneration: 0 });
    const opening = st.rows[0];
    const closing = st.rows[st.rows.length - 1];
    const movements = st.rows.slice(1, -1).reduce((a, r) => a + r.total, 0);
    expect(Math.round(opening.total + movements)).toBe(Math.round(closing.total));
    expect(closing.total).toBe(cur().totalEquity);
    expect(st.legalReserveCheck!.actual).toBe(150000);
  });
  it("ties ending cash with zero plug", () => {
    const cf = cashFlowIndirect(cur(), prior());
    expect(cf.tieOutDifference).toBe(0);
    expect(cf.endingCashPerCashFlow).toBe(4_200_000);
    expect(cashFlowDirectDerived(cur(), prior()).operating).toBe(cf.operating);
  });
});

describe("diagnostics", () => {
  it("DuPont 3- and 5-step agree with ROE", () => {
    const d = dupont(cur());
    const roe = cur().netProfit / cur().totalEquity;
    expect(d.threeStep.roe).toBeCloseTo(roe, 3);
    expect(d.fiveStep.roe).toBeCloseTo(roe, 3);
  });
  it("computes Altman Z'' and Beneish M", () => {
    const z = altmanZ(cur());
    expect(z.available).toBe(true);
    expect(["safe", "grey", "distress"]).toContain(z.zone);
    const m = beneishM(cur(), prior(), cashFlowIndirect(cur(), prior()).operating);
    expect(m.available).toBe(true);
    expect(m.vars.SGI).toBeCloseTo(38 / 31, 3);
  });
});

describe("subledgers (G-04)", () => {
  it("AR aging ties to receivables and stages ECL", () => {
    const { records, issues } = SL.parseAr(S.SAMPLE_AR_CSV);
    expect(issues).toEqual([]);
    const a = SL.arAging(records, "2025-12-31", SL.PLACEHOLDER_ECL_RATES);
    expect(SL.tieOut(a.total, cur().receivables).ties).toBe(true);
    expect(a.buckets.current.outstanding).toBe(2_100_000);
    expect(a.buckets.over_120.stage).toBe(3);
  });
  it("AP ties, reports Form 41 by quarter and concentration", () => {
    const a = SL.apAnalysis(SL.parseAp(S.SAMPLE_AP_CSV).records, "2025-12-31");
    expect(a.openBalance).toBe(4_100_000);
    expect(a.form41.map((q) => q.quarter)).toEqual(["2025-Q1", "2025-Q2", "2025-Q4"]);
    expect(a.netMismatchRows).toEqual([]);
  });
  it("FAR rolls forward to the TB and computes tax pools", () => {
    const s = SL.farSummary(SL.parseFar(S.SAMPLE_FAR_CSV).records, S.SAMPLE_PERIOD.start, S.SAMPLE_PERIOD.end);
    expect(s.rollForward.closingCost).toBe(cur().ppeGross);
    expect(s.rollForward.accumulatedDepreciation).toBe(-cur().accumulatedDepreciation);
    expect(s.tax.initialAllowance).toBe(450000);
    const it = s.schedules.find((x) => x.tag === "FA-003")!;
    expect(it.taxDepreciation).toBe(100000); // 50% DB on WDV 200,000
  });
  it("values inventory and tests NRV", () => {
    const inv = SL.inventorySummary(SL.parseInventory(S.SAMPLE_INVENTORY_CSV).records, cur().cogs);
    expect(inv.closingCost).toBe(5_400_000);
    expect(inv.openingCost).toBe(4_900_000);
    expect(inv.nrvWriteDown).toBe(100000);
    expect(inv.itemsWithShrinkage).toBe(1);
  });
  it("checks payroll arithmetic and caps profit share", () => {
    const p = SL.payrollSummary(SL.parsePayroll(S.SAMPLE_PAYROLL_CSV).records, 2_867_500, 0.1, 12);
    expect(p.grossMismatchRows).toEqual([]);
    expect(p.netMismatchRows).toEqual([]);
    expect(p.profitShare.amount).toBe(286750);
  });
  it("reconciles the bank to the book with zero difference", () => {
    const gl = parseGl(S.buildSampleGlCsv()).records;
    const cash = gl.filter((l) => l.accountCode === "1101").map((l) => ({ date: l.postingDate, amount: l.debit - l.credit, ref: l.journalId }));
    const rec = SL.bankReconciliation(SL.parseBank(S.SAMPLE_BANK_CSV).records, cash, 4_200_000);
    expect(rec.unpresentedCheques).toBe(431500);
    expect(rec.bankItemsNotInBooks).toBe(-2500);
    expect(rec.difference).toBe(0);
  });
  it("reconciles ETA e-invoices against revenue and flags exceptions", () => {
    const { documents } = SL.parseEta(S.SAMPLE_ETA_JSON);
    const r = SL.etaReconciliation(documents, 38_000_000);
    expect(r.netSales).toBe(37_850_000);
    expect(r.difference).toBe(150000);
    expect(r.invalidReceiverTaxId).toEqual(["INV-2025-0004"]);
    expect(r.vatRateExceptions.map((v) => v.id)).toEqual(["INV-2025-0003"]);
    const xml = `<documents><document><uuid>X1</uuid><documentType>I</documentType><netAmount>100</netAmount><taxTotal><taxType>T1</taxType><amount>14</amount></taxTotal></document></documents>`;
    expect(SL.parseEta(xml).documents[0]).toMatchObject({ uuid: "X1", netAmount: 100, vat: 14 });
  });
});

describe("general ledger", () => {
  it("GL activity equals TB movement and journals balance", () => {
    const gl = parseGl(S.buildSampleGlCsv()).records;
    expect(unbalancedJournals(gl)).toEqual([]);
    expect(glVsTb(gl, rows()).exceptions).toBe(0);
    const chunks = [...csvChunks(S.buildSampleGlCsv(), 5)];
    expect(chunks.reduce((a, c) => a + parseGl(c).records.length, 0)).toBe(gl.length);
  });
});

describe("tax computation (G-06)", () => {
  it("adds back accounting depreciation, applies pools and thin cap", () => {
    const far = SL.farSummary(SL.parseFar(S.SAMPLE_FAR_CSV).records, S.SAMPLE_PERIOD.start, S.SAMPLE_PERIOD.end);
    const t = taxComputation(cur(), prior(), { ...DEFAULT_TAX_INPUTS, unsupportedExpenses: 300000 }, { taxDepreciation: far.tax.taxDepreciation, initialAllowance: far.tax.initialAllowance, temporaryDifference: far.deferredTax.temporaryDifference });
    const get = (k: string) => t.lines.find((l) => l.key === k)!.amount;
    expect(get("accountingDepreciation")).toBe(900000);
    expect(get("unsupportedExpenses")).toBeCloseTo(300000 - 2_660_000 * 0.07, 2);
    expect(get("thinCapitalisationInterest")).toBe(0);
    expect(t.tax).toBeCloseTo(Math.max(0, t.taxableProfit) * 0.225, 2);
  });
  it("disallows interest above 4:1 debt to equity", () => {
    const c = { ...cur(), longTermDebt: 80_000_000, totalEquity: 10_000_000 };
    const t = taxComputation(c, null, DEFAULT_TAX_INPUTS, null);
    expect(t.thinCap.disallowedInterest).toBeGreaterThan(0);
  });
});

describe("3-statement model (G-08)", () => {
  it("balances every period and converges within 10 iterations", () => {
    const m = { ...defaultModelInputs(cur(), prior()), minimumCash: 3_000_000, cashSweep: true, dividendPayout: 0.3, termLoanRepayment: 1_000_000 };
    for (const g of ["annual", "monthly"] as const) {
      const out = runModel(cur(), { ...m, granularity: g, periods: g === "annual" ? 3 : 12 });
      for (const p of out) {
        expect(Math.abs(p.balanceCheck)).toBeLessThan(0.05);
        expect(p.iterations).toBeLessThanOrEqual(10);
      }
      expect(out.every((p) => p.converged)).toBe(true);
    }
    const begin = runModel(cur(), { ...m, circularity: "beginning" });
    expect(begin[0].iterations).toBe(1);
  });
  it("draws the revolver when cash falls below the minimum", () => {
    const m = { ...defaultModelInputs(cur(), prior()), minimumCash: 50_000_000 };
    const out = runModel(cur(), m);
    expect(out[0].revolverDraw).toBeGreaterThan(0);
    expect(out[0].cash).toBeCloseTo(50_000_000, 0);
  });
  it("builds a 5×5 sensitivity grid and tests covenants", () => {
    const m = defaultModelInputs(cur(), prior());
    const s = sensitivityGrid(cur(), m, "revenueGrowth", "grossMargin", "ebitda", 0.02, 0.01);
    expect(s.grid).toHaveLength(5);
    expect(s.grid[4][4]).toBeGreaterThan(s.grid[0][0]);
    const cov = covenantTest(runModel(cur(), m), { maxDebtToEbitda: 0.5, minInterestCoverage: 100 });
    expect(cov.every((c) => c.leverageBreach && c.coverageBreach)).toBe(true);
  });
});

describe("budget", () => {
  it("builds budget statements, BVA and a price/mix/quantity split that adds up", () => {
    const b = { ...emptyBudget("b1", "FY26"), products: [
      { name: "A", units: 1000, unitPrice: 100, discountPct: 0, unitCost: 60, actualUnits: 1100, actualUnitPrice: 95 },
      { name: "B", units: 500, unitPrice: 200, discountPct: 0.1, unitCost: 120, actualUnits: 450, actualUnitPrice: 210 },
    ], headcount: [{ department: "Sales", count: 2, monthlySalary: 10000, socialInsurancePct: 0.1875 }], targetDso: 60 };
    const st = budgetStatements(b, cur());
    expect(st.pl.revenue).toBe(190000);
    expect(st.pl.payroll).toBe(285000);
    const v = revenueVarianceAnalysis(b.products)!;
    expect(v.price + v.mix + v.quantity).toBeCloseTo(v.total, 2);
    expect(budgetVsActual(b, cur())[0].favourable).toBe(true);
  });
});

describe("valuation", () => {
  it("needs market inputs, then values with Gordon and exit multiple", () => {
    expect(wacc(DEFAULT_VALUATION).available).toBe(false);
    const v = { ...DEFAULT_VALUATION, riskFreeRate: 0.2, beta: 1, equityRiskPremium: 0.06, countryRiskPremium: 0.05, preTaxCostOfDebt: 0.22, targetDebtWeight: 0.3, terminalGrowth: 0.05, exitMultiple: 6 };
    const w = wacc(v);
    expect(w.available && w.wacc).toBeCloseTo(0.31 * 0.7 + 0.22 * 0.775 * 0.3, 6);
    const flows = ufcf(runModel(cur(), defaultModelInputs(cur(), prior())), 0.225, cur());
    const d = dcf(flows, (w as { wacc: number }).wacc, 0.05, 6, false, 3_300_000);
    expect(d.gordon!.enterpriseValue).toBeCloseTo(d.pvFlows + d.gordon!.pvTerminal, 1);
    expect(dcf(flows, 0.04, 0.05, null, false, 0).gordonInvalid).toBe(true);
    const comps = compsValuation([{ name: "P1", evRevenue: null, evEbitda: 5, pe: 8 }, { name: "P2", evRevenue: null, evEbitda: 7, pe: 10 }], cur(), 3_300_000);
    expect(comps[1].median).toBe(6 * 5_700_000 - 3_300_000);
    expect(comps[0].median).toBeNull();
  });
});

describe("stress test", () => {
  it("translates the net USD position and shocks floating debt", () => {
    const r = rows().map((x) => (x.code === "1101" || x.code === "2401" ? { ...x, currency: "USD" } : x));
    const s = stressTest(r, cur(), { foreignCurrency: "USD", baseRate: 50, shockedRate: 65, importedCogsShare: 0.4, passThrough: 0.5, floatingDebtShare: 1, rateShock: 0.02, taxRate: 0.225 });
    expect(s.exposure.netPosition).toBe(4_200_000 - 5_000_000);
    expect(s.impacts.translation).toBe(-800_000 * 0.3);
    expect(s.impacts.importedCogs).toBe(-(26_600_000 * 0.4 * 0.3 * 0.5));
    expect(s.impacts.interestRateShock).toBe(-(7_500_000 * 0.02));
    expect(stressTest(rows(), cur(), { foreignCurrency: "USD", baseRate: null, shockedRate: null, importedCogsShare: 0, passThrough: 0, floatingDebtShare: 0, rateShock: 0, taxRate: 0.225 }).fxReady).toBe(false);
  });
});
