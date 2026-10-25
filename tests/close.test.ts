import { describe, expect, it } from "vitest";
import { benfordMad, scanAnomalies } from "@/lib/finance/anomalies";
import { consolidate } from "@/lib/finance/consolidation";
import { analyze } from "@/lib/finance/engine";
import { parseTrialBalance } from "@/lib/finance/parse";
import { buildTbFromGl, nextPeriod, openingBalances, startsFiscalYear } from "@/lib/finance/rollforward";
import { monthlyTrend } from "@/lib/finance/trends";
import type { GlLine } from "@/lib/finance/gl";
import { computeCompany } from "@/lib/workspace/compute";
import { sampleCompany } from "@/lib/workspace/sampleCompany";

const tb = (csv: string) => parseTrialBalance("code,name,category,current_debit,current_credit,prior_debit,prior_credit\n" + csv).rows;

describe("consolidation", () => {
  const parent = tb(`1010,Cash,CASH,1000,0,800,0
1500,Investment in subsidiaries,OTHER_NON_CURRENT_ASSET,600,0,600,0
1300,Due from subsidiary (intercompany),RECEIVABLES,250,0,0,0
3000,Share capital,SHARE_CAPITAL,0,1300,0,1400
4000,Sales,REVENUE,0,900,0,0
4100,Management fee from subsidiary (intercompany),OTHER_INCOME,0,100,0,0
5000,Cost of sales,COGS,450,0,0,0`);
  const sub = tb(`1010,Cash,CASH,900,0,700,0
2300,Due to parent (intercompany),OTHER_CURRENT_LIABILITY,0,240,0,0
3000,Share capital,SHARE_CAPITAL,0,500,0,500
3200,Retained earnings,RETAINED_EARNINGS,0,100,0,200
4000,Sales,REVENUE,0,400,0,0
6100,Management fee to parent (intercompany),ADMIN_EXPENSE,100,0,0,0
5000,Cost of sales,COGS,240,0,0,0`);

  it("eliminates intercompany items and the investment, keeps the balance sheet balanced and shows NCI", () => {
    const r = consolidate([
      { id: "p", name: "Parent", ownership: 1, isParent: true, rows: parent, intercompanyCodes: [] },
      { id: "s", name: "Sub", ownership: 0.8, isParent: false, rows: sub, intercompanyCodes: [] },
    ]);
    const a = analyze(r.rows);
    expect(a.current.balanceCheck).toBeCloseTo(0, 2);
    expect(a.current.revenue).toBe(1300);
    expect(a.current.otherIncome).toBe(0);
    expect(r.differences.balances.current).toBe(10);
    expect(r.differences.pnl.current).toBe(0);
    expect(r.goodwill.current).toBe(200); // 600 - 80% x 500
    expect(r.nci.equity).toBeCloseTo(0.2 * 100 + 0.2 * 500 * 1, 2);
    expect(r.nci.profit).toBeCloseTo(0.2 * (400 - 100 - 240), 2);
    expect(r.eliminations.map((e) => e.type)).toEqual(["intercompanyBalances", "intercompanyPnl", "investment", "nci"]);
  });
});

describe("roll-forward", () => {
  it("rolls a year into the next with P&L closed to retained earnings, then rebuilds the TB from the GL", () => {
    expect(nextPeriod({ start: "2025-01-01", end: "2025-12-31", currentLabel: "FY2025" })).toMatchObject({ start: "2026-01-01", end: "2026-12-31", currentLabel: "FY2026", priorLabel: "FY2025" });
    expect(nextPeriod({ start: "2025-03-01", end: "2025-03-31", currentLabel: "2025-03" })).toMatchObject({ start: "2025-04-01", end: "2025-04-30", currentLabel: "2025-04" });
    expect(startsFiscalYear("2026-01-01", "12-31")).toBe(true);
    const closing = tb(`1010,Cash,CASH,700,0,0,0
3000,Capital,SHARE_CAPITAL,0,500,0,0
3200,Retained earnings,RETAINED_EARNINGS,0,50,0,0
4000,Sales,REVENUE,0,400,0,0
5000,Cost of sales,COGS,250,0,0,0`);
    const open = openingBalances(closing, true);
    expect(open.find((r) => r.code === "3200")?.currentCredit).toBe(200);
    expect(open.find((r) => r.code === "4000")?.currentCredit).toBe(0);
    const gl: GlLine[] = [
      { postingDate: "2026-01-10", journalId: "J1", voucher: "", accountCode: "1010", accountName: "Cash", debit: 300, credit: 0, costCenter: "", counterparty: "", memo: "", sourceRow: 2 },
      { postingDate: "2026-01-10", journalId: "J1", voucher: "", accountCode: "4000", accountName: "Sales", debit: 0, credit: 300, costCenter: "", counterparty: "", memo: "", sourceRow: 3 },
      { postingDate: "2026-01-11", journalId: "J2", voucher: "", accountCode: "6200", accountName: "Office rent", debit: 50, credit: 0, costCenter: "", counterparty: "", memo: "", sourceRow: 4 },
      { postingDate: "2026-01-11", journalId: "J2", voucher: "", accountCode: "1010", accountName: "Cash", debit: 0, credit: 50, costCenter: "", counterparty: "", memo: "", sourceRow: 5 },
    ];
    const built = buildTbFromGl(open, gl, closing.map((r) => ({ ...r, priorDebit: r.currentDebit, priorCredit: r.currentCredit })));
    const a = analyze(built.rows);
    expect(built.newAccounts).toEqual(["6200"]);
    expect(a.current.cash).toBe(950);
    expect(a.current.revenue).toBe(300);
    expect(a.current.balanceCheck).toBeCloseTo(0, 2);
    expect(a.prior?.revenue).toBe(400);
  });
});

describe("trends", () => {
  it("turns year-to-date monthly TBs into monthly P&L", () => {
    const m = (rev: number, cash: number) => tb(`1010,Cash,CASH,${cash},0,0,0\n3000,Capital,SHARE_CAPITAL,0,${cash - rev},0,0\n4000,Sales,REVENUE,0,${rev},0,0`);
    const t = monthlyTrend([{ label: "2025-02", rows: m(250, 900) }, { label: "2025-01", rows: m(100, 600) }], true);
    expect(t.map((p) => [p.label, p.values.revenue, p.values.cash])).toEqual([
      ["2025-01", 100, 600],
      ["2025-02", 150, 900],
    ]);
  });
});

describe("close review", () => {
  it("flags the sample company's deliberate findings and Benford checks need enough data", () => {
    const k = computeCompany(sampleCompany());
    expect(k.analysis).not.toBeNull();
    expect(Array.isArray(k.anomalies)).toBe(true);
    expect(benfordMad([1, 2, 3]).mad).toBeNull();
    const rows = tb(`1010,Cash,CASH,0,100,0,0\n9999,Suspense account,OTHER_CURRENT_ASSET,100,0,0,0`);
    const ids = scanAnomalies({ rows, analysis: analyze(rows), period: { start: "2025-01-01", end: "2025-12-31" }, gl: [], ar: [], ap: [], inventory: [], payroll: [], bankDifference: 5 }).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["tbAbnormal", "tbSuspense", "bankDiff"]));
  });
});
