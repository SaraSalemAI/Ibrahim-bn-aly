import { describe, expect, it } from "vitest";
import { analyze, computePeriod, forecast } from "../lib/finance/engine";
import { parseAmount, parseCsv, parseTrialBalance, toCsv } from "../lib/finance/parse";
import { suggestCategory } from "../lib/finance/classify";
import { SAMPLE_TB_CSV } from "../lib/finance/sample";

const sample = () => parseTrialBalance(SAMPLE_TB_CSV).rows;

describe("parsing", () => {
  it("parses quoted fields, BOM and CRLF", () => {
    expect(parseCsv('﻿a,"b, c","d ""q"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'd "q"'],
      ["1", "2", "3"],
    ]);
  });

  it("parses accounting amounts", () => {
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("(500)")).toBe(-500);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("١٢٣٤")).toBe(1234);
    expect(parseAmount("abc")).toBeNull();
  });

  it("reports bad amounts with the source row", () => {
    const { issues } = parseTrialBalance("name,debit,credit\nCash,12x,0\n");
    expect(issues).toEqual([{ level: "error", code: "badAmount", params: { row: 2, column: "currentDebit" } }]);
  });

  it("requires name, debit and credit columns", () => {
    expect(parseTrialBalance("foo,bar\n1,2\n").issues[0].code).toBe("missingColumns");
  });

  it("round-trips the sample through CSV", () => {
    const rows = sample();
    expect(parseTrialBalance(toCsv(rows)).rows).toEqual(rows);
  });
});

describe("classification", () => {
  it("suggests categories from English and Arabic names", () => {
    expect(suggestCategory("", "Accumulated depreciation - vehicles")).toBe("ACCUM_DEPRECIATION");
    expect(suggestCategory("", "تكلفة المبيعات")).toBe("COGS");
    expect(suggestCategory("", "العملاء")).toBe("RECEIVABLES");
    expect(suggestCategory("", "Selling and distribution")).toBe("SELLING_EXPENSE");
    expect(suggestCategory("4999", "Misc")).toBe("REVENUE");
    expect(suggestCategory("9999", "Suspense")).toBe("");
  });

  it("marks classifier output as suggested", () => {
    const { rows } = parseTrialBalance("code,name,debit,credit\n1101,النقدية بالبنوك,100,0\n");
    expect(rows[0]).toMatchObject({ category: "CASH", suggested: true });
  });
});

describe("statements", () => {
  it("balances the sample trial balance and the balance sheet", () => {
    const a = analyze(sample());
    expect(a.ready).toBe(true);
    for (const f of [a.current, a.prior!]) {
      expect(f.totalDebits).toBe(f.totalCredits);
      expect(f.balanceCheck).toBe(0);
    }
  });

  it("computes the income statement", () => {
    const cur = computePeriod(sample(), "current");
    expect(cur.grossProfit).toBe(11_400_000);
    expect(cur.ebitda).toBe(5_700_000);
    expect(cur.ebit).toBe(4_950_000);
    expect(cur.ebt).toBe(3_700_000);
    expect(cur.netProfit).toBe(2_867_500);
    expect(cur.nonCurrentAssets).toBe(8_400_000);
  });

  it("flags an unbalanced trial balance with the exact difference", () => {
    const rows = sample();
    rows[0].currentDebit += 1000;
    const a = analyze(rows);
    expect(a.ready).toBe(false);
    expect(a.issues).toContainEqual({ level: "error", code: "unbalanced", params: { period: "current", difference: 1000 } });
  });

  it("keeps unmapped accounts in a holding line so totals still tie", () => {
    const rows = sample();
    rows[3].category = "";
    const a = analyze(rows);
    expect(a.current.unmappedHolding).toBe(900_000);
    expect(a.current.balanceCheck).toBe(0);
    expect(a.issues.some((i) => i.code === "unmapped")).toBe(true);
  });
});

describe("variances and ratios", () => {
  it("computes variances and materiality", () => {
    const rev = analyze(sample()).variances.find((v) => v.key === "revenue")!;
    expect(rev.change).toBe(7_000_000);
    expect(rev.changePct).toBe(22.58);
    expect(rev.material).toBe(true);
  });

  it("computes ratios and returns null when the denominator is zero", () => {
    const a = analyze(sample());
    const r = Object.fromEntries(a.ratios.map((x) => [x.key, x.current]));
    expect(r.currentRatio).toBe(2.23); // 17.3m / 7.75m
    expect(r.grossMargin).toBe(30);
    expect(r.dso).toBe(65.32);
    expect(r.interestCoverage).toBe(3.96);
    const noDebt = sample().filter((x) => x.category !== "FINANCE_COST");
    const ic = analyze(noDebt).ratios.find((x) => x.key === "interestCoverage")!;
    expect(ic.current).toBeNull();
  });

  it("reports no prior period when prior columns are empty", () => {
    const rows = sample().map((r) => ({ ...r, priorDebit: 0, priorCredit: 0 }));
    const a = analyze(rows);
    expect(a.prior).toBeNull();
    expect(a.variances.every((v) => v.change === null)).toBe(true);
    expect(a.scenarios.base.drivers.revenueGrowth).toBe(0);
  });
});

describe("scenarios", () => {
  it("projects revenue and applies the tax rate only to positive profit", () => {
    const cur = computePeriod(sample(), "current");
    const years = forecast(cur, { revenueGrowth: 0.1, grossMargin: 0.3, opexPctRevenue: 0.15, financeCostChange: 0, taxRate: 0.225 });
    expect(years[0].revenue).toBe(41_800_000);
    expect(years[2].revenue).toBe(50_578_000);
    expect(years[0].tax).toBeCloseTo(years[0].ebt * 0.225, 2);
    const loss = forecast(cur, { revenueGrowth: -0.9, grossMargin: 0.1, opexPctRevenue: 0.5, financeCostChange: 0, taxRate: 0.225 });
    expect(loss[0].tax).toBe(0);
  });

  it("derives bull and bear around the historical base", () => {
    const { scenarios } = analyze(sample());
    expect(scenarios.base.drivers.revenueGrowth).toBe(0.2258);
    expect(scenarios.bull.drivers.revenueGrowth).toBeGreaterThan(scenarios.base.drivers.revenueGrowth);
    expect(scenarios.bear.years[2].netProfit).toBeLessThan(scenarios.base.years[2].netProfit);
  });
});
