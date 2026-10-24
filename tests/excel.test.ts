import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook } from "../lib/finance/excel";
import { computePeriod } from "../lib/finance/engine";
import { parseTrialBalance } from "../lib/finance/parse";
import { SAMPLE_TB_CSV } from "../lib/finance/sample";

describe("Excel export (G-09)", () => {
  it("writes live formulas, not frozen values", async () => {
    const rows = parseTrialBalance(SAMPLE_TB_CSV).rows;
    const buf = await buildWorkbook({ companyName: "Nile", currency: "EGP", framework: "EAS", currentLabel: "FY2025", priorLabel: "FY2024", rows, current: computePeriod(rows, "current"), generatedAt: "2026-01-01T00:00:00Z" });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Cover", "Trial Balance", "Income Statement", "Balance Sheet", "Cash Flow", "Ratios"]);
    const tb = wb.getWorksheet("Trial Balance")!;
    expect((tb.getCell(`D${rows.length + 2}`).value as { formula: string }).formula).toBe(`SUM(D2:D${rows.length + 1})`);
    const pl = wb.getWorksheet("Income Statement")!;
    expect((pl.getCell("B2").value as { formula: string }).formula).toContain('SUMIFS(');
    expect((pl.getCell("B4").value as { formula: string }).formula).toBe("B2-B3");
    const cf = wb.getWorksheet("Cash Flow")!;
    const formulas: string[] = [];
    cf.eachRow((r) => {
      const v = r.getCell(2).value as { formula?: string } | null;
      if (v && typeof v === "object" && v.formula) formulas.push(v.formula);
    });
    expect(formulas.length).toBeGreaterThan(15);
  });
});
