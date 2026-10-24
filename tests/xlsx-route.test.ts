import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { POST } from "../app/api/xlsx/route";
import { parseTrialBalance } from "../lib/finance/parse";

describe("/api/xlsx", () => {
  it("converts the first sheet to CSV that the TB parser reads", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("TB");
    ws.addRow(["code", "name", "current_debit", "current_credit"]);
    ws.addRow(["1101", "النقدية, بالبنوك", 1000, 0]);
    ws.addRow(["3101", "رأس المال", 0, { formula: "500+500", result: 1000 }]);
    const buf = await wb.xlsx.writeBuffer();
    const res = await POST(new Request("http://x/api/xlsx", { method: "POST", body: new Uint8Array(buf as ArrayBuffer) }));
    expect(res.status).toBe(200);
    const { rows, issues } = parseTrialBalance(await res.text());
    expect(issues).toEqual([]);
    expect(rows.map((r) => [r.name, r.currentDebit, r.currentCredit])).toEqual([
      ["النقدية, بالبنوك", 1000, 0],
      ["رأس المال", 0, 1000],
    ]);
  });
  it("rejects a non-workbook", async () => {
    const res = await POST(new Request("http://x/api/xlsx", { method: "POST", body: "not a zip" }));
    expect(res.status).toBe(400);
  });
});
