import ExcelJS from "exceljs";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/finance/engine";
import { SAMPLE_TB_CSV } from "@/lib/finance/sample";
import * as S from "@/lib/finance/sampleData";
import { batchChecks, type BatchItem } from "@/lib/ingest/checks";
import { bankLinesToCsv, parseMt940, parseOfx } from "@/lib/ingest/bankFormats";
import { detectFile, monthFromName } from "@/lib/ingest/detect";
import { detectErp, normaliseTable } from "@/lib/ingest/erp";
import { applyStaged, expandFiles, stageUnit } from "@/lib/ingest/stage";
import { readXlsx } from "@/lib/ingest/xlsx";
import { newCompany } from "@/lib/workspace/defaults";
import { sampleCompany } from "@/lib/workspace/sampleCompany";

const enc = (s: string) => new TextEncoder().encode(s);

describe("file detection", () => {
  const cases: Array<[string, string, string]> = [
    ["export.csv", SAMPLE_TB_CSV, "TRIAL_BALANCE"],
    ["data.csv", S.buildSampleGlCsv(), "GENERAL_LEDGER"],
    ["file1.csv", S.SAMPLE_AR_CSV, "AR_SUBLEDGER"],
    ["file2.csv", S.SAMPLE_AP_CSV, "AP_SUBLEDGER"],
    ["file3.csv", S.SAMPLE_FAR_CSV, "FIXED_ASSETS"],
    ["file4.csv", S.SAMPLE_INVENTORY_CSV, "INVENTORY"],
    ["file5.csv", S.SAMPLE_PAYROLL_CSV, "PAYROLL"],
    ["file6.csv", S.SAMPLE_BANK_CSV, "BANK_STATEMENT"],
    ["eta.json", S.SAMPLE_ETA_JSON, "ETA_INVOICE"],
  ];
  it.each(cases)("recognises %s as %s from its columns", (name, text, cat) => {
    const d = detectFile(name, text);
    expect(d.category).toBe(cat);
    expect(d.confidence).toBeGreaterThan(40);
  });

  it("flags PDFs and images for OCR and reads months from file names", () => {
    expect(detectFile("statement.pdf", null).format).toBe("pdf");
    expect(detectFile("receipt.jpg", null).format).toBe("image");
    expect(monthFromName("TB 2025-03.csv")).toEqual({ label: "2025-03", end: "2025-03-31" });
    expect(monthFromName("tb_202502.xlsx")?.end).toBe("2025-02-28");
    expect(monthFromName("Trial balance March 2025.csv")?.label).toBe("2025-03");
    expect(monthFromName("ميزان مارس ٢٠٢٥.csv")?.label).toBe("2025-03");
    expect(monthFromName("trial balance.csv")).toBeNull();
  });
});

describe("ERP presets", () => {
  it("reads a QuickBooks trial balance with report titles and combined account column", () => {
    const qb = `Nile Trading\nTrial Balance\nAs of December 31, 2025\n,Debit,Credit\nAccount,Debit,Credit\n1010 · Cash at bank,"5,000.00",\n4000 · Sales revenue,,"5,000.00"\nTOTAL,"5,000.00","5,000.00"\n`;
    const n = normaliseTable(qb, "TRIAL_BALANCE");
    expect(n.skippedTitleRows).toBe(4);
    const d = detectFile("qb.csv", qb);
    expect(d.category).toBe("TRIAL_BALANCE");
    return stageUnit({ id: "u", fileName: "qb.csv", text: qb, bytes: enc(qb), sha256: "x", encoding: "utf-8", detection: d, month: null }, "TRIAL_BALANCE").then((s) => {
      expect(s.issues.filter((i) => i.level === "error")).toEqual([]);
      const rows = s.data.kind === "tb" ? s.data.rows : [];
      expect(rows.map((r) => [r.code, r.name, r.currentDebit, r.currentCredit])).toEqual([
        ["1010", "Cash at bank", 5000, 0],
        ["4000", "Sales revenue", 0, 5000],
      ]);
    });
  });

  it("uses Odoo's end balance rather than period movements", async () => {
    const odoo = `Code,Account,Initial Balance,Debit,Credit,End Balance\n101000,Bank,1000,500,200,1300\n400000,Product Sales,0,0,800,-800\n`;
    expect(detectErp(odoo.split("\n")[0].split(","))).toBe("Odoo");
    const s = await stageUnit({ id: "u", fileName: "odoo.csv", text: odoo, bytes: enc(odoo), sha256: "y", encoding: "utf-8", detection: detectFile("odoo.csv", odoo), month: null }, "TRIAL_BALANCE");
    const rows = s.data.kind === "tb" ? s.data.rows : [];
    expect(rows.map((r) => [r.code, r.currentDebit, r.currentCredit])).toEqual([
      ["101000", 1300, 0],
      ["400000", 0, 800],
    ]);
    expect(s.erp).toBe("Odoo");
  });

  it("splits a QuickBooks signed amount journal and carries the date down", async () => {
    const gl = `Date,Transaction Type,Num,Name,Account,Memo/Description,Amount\n2025-01-05,Invoice,1001,Cairo Foods,1200 · Accounts receivable,Sale,1500\n,,1001,Cairo Foods,4000 · Sales,Sale,-1500\n`;
    const s = await stageUnit({ id: "u", fileName: "gl.csv", text: gl, bytes: enc(gl), sha256: "z", encoding: "utf-8", detection: detectFile("gl.csv", gl), month: null }, "GENERAL_LEDGER");
    expect(s.erp).toBe("QuickBooks");
    const lines = s.data.kind === "gl" ? s.data.lines : [];
    expect(lines.map((l) => [l.postingDate, l.journalId, l.accountCode, l.debit, l.credit, l.counterparty])).toEqual([
      ["2025-01-05", "1001", "1200", 1500, 0, "Cairo Foods"],
      ["2025-01-05", "1001", "4000", 0, 1500, "Cairo Foods"],
    ]);
  });

  it("applies the analyst's saved column matches", async () => {
    const odd = `Ref,Client,Inv date,Pay by,Gross,Left to pay\nA1,Giza Markets,01/03/2025,31/03/2025,100,40\n`;
    const map = { invoice: "Ref", customer: "Client", invoiceDate: "Inv date", dueDate: "Pay by", amount: "Gross", outstanding: "Left to pay" };
    const s = await stageUnit({ id: "u", fileName: "x.csv", text: odd, bytes: enc(odd), sha256: "w", encoding: "utf-8", detection: detectFile("x.csv", odd), month: null }, "AR_SUBLEDGER", { columnMap: map });
    expect(s.issues).toEqual([]);
    expect(s.data.kind === "sub" && s.data.records[0]).toMatchObject({ invoice: "A1", customer: "Giza Markets", invoiceDate: "2025-03-01", outstanding: 40 });
  });
});

describe("bank formats", () => {
  it("parses MT940 with running balances", () => {
    const mt = `:20:STMT1\n:25:EG12345\n:28C:1/1\n:60F:C251201EGP10000,00\n:61:2512020202D1500,00NTRFNONREF//X1\n:86:Supplier payment Nile Packaging\n:61:2512050205C2500,50NTRFNONREF\n:86:Customer receipt Delta\n:62F:C251231EGP11000,50\n-`;
    const r = parseMt940(mt);
    expect(r.lines).toEqual([
      { date: "2025-12-02", description: "Supplier payment Nile Packaging", amount: -1500, balance: 8500 },
      { date: "2025-12-05", description: "Customer receipt Delta", amount: 2500.5, balance: 11000.5 },
    ]);
    expect(detectFile("stmt.sta", mt)).toMatchObject({ category: "BANK_STATEMENT", format: "mt940" });
    expect(bankLinesToCsv(r.lines)).toContain("2025-12-05,Customer receipt Delta,2500.5,11000.5");
  });

  it("parses SGML OFX and back-fills balances from the ledger balance", () => {
    const ofx = `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>EGP<BANKTRANLIST>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20251210<TRNAMT>-300.00<NAME>Rent\n<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20251215<TRNAMT>1000.00<NAME>Deposit\n</BANKTRANLIST><LEDGERBAL><BALAMT>5700.00<DTASOF>20251231</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const r = parseOfx(ofx);
    expect(r.lines.map((l) => [l.date, l.amount, l.balance])).toEqual([
      ["2025-12-10", -300, 4700],
      ["2025-12-15", 1000, 5700],
    ]);
    expect(r.currency).toBe("EGP");
  });
});

describe("workbooks and archives", () => {
  it("reads every sheet of an .xlsx, with dates, and unpacks .zip close packs", async () => {
    const wb = new ExcelJS.Workbook();
    const tb = wb.addWorksheet("Trial balance");
    tb.addRow(["code", "name", "current_debit", "current_credit"]);
    tb.addRow(["1010", "Cash at bank", 5000, 0]);
    tb.addRow(["4000", "Sales, local", 0, 5000]);
    const bank = wb.addWorksheet("Bank");
    bank.addRow(["date", "description", "amount"]);
    bank.addRow([new Date(Date.UTC(2025, 11, 31)), "Receipt", 5000]);
    bank.getCell("A2").numFmt = "dd/mm/yyyy";
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    const sheets = readXlsx(bytes);
    expect(sheets.map((s) => s.name)).toEqual(["Trial balance", "Bank"]);
    expect(sheets[0].csv).toContain('4000,"Sales, local",0,5000');
    expect(sheets[1].csv).toContain("2025-12-31,Receipt,5000");

    const zip = zipSync({ "close/Dec 2025/ar.csv": strToU8(S.SAMPLE_AR_CSV), "close/book.xlsx": bytes, "__MACOSX/._ar.csv": strToU8("x") });
    const { units, errors } = await expandFiles([{ name: "close-pack.zip", bytes: zip }]);
    expect(errors).toEqual([]);
    expect(units.map((u) => [u.sheet ?? u.fileName, u.detection.category])).toEqual([
      ["ar.csv", "AR_SUBLEDGER"],
      ["Trial balance", "TRIAL_BALANCE"],
      ["Bank", "BANK_STATEMENT"],
    ]);
  });
});

describe("batch import", () => {
  it("loads prior-period comparatives and monthly files into their own slots", async () => {
    const cur = `code,name,current_debit,current_credit\n1010,Cash,700,0\n3000,Capital,0,700\n`;
    const pri = `code,name,current_debit,current_credit\n1010,Cash,500,0\n1200,Receivables,100,0\n3000,Capital,0,600\n`;
    const unit = async (name: string, text: string) => (await expandFiles([{ name, bytes: enc(text) }])).units[0];
    let c = newCompany();
    c = applyStaged(c, await stageUnit(await unit("tb.csv", cur), "TRIAL_BALANCE"), "d1", "current");
    c = applyStaged(c, await stageUnit(await unit("tb-prior.csv", pri), "TRIAL_BALANCE"), "d2", "prior");
    const a = analyze(c.rows);
    expect(a.current.cash).toBe(700);
    expect(a.prior?.cash).toBe(500);
    expect(a.prior?.receivables).toBe(100);
    const jan = await unit("TB 2025-01.csv", cur);
    c = applyStaged(c, await stageUnit(jan, "TRIAL_BALANCE"), "d3", "monthly", jan.month);
    expect(c.monthly.map((m) => m.label)).toEqual(["2025-01"]);
    expect(c.docs.map((d) => d.role)).toEqual(["current", "prior", "monthly"]);
  });

  it("reports duplicates, out-of-period entries and missing FX rates before import", async () => {
    const base = sampleCompany();
    const bankText = S.SAMPLE_BANK_CSV + "2026-01-03,Late receipt,100,\n";
    const units = (await expandFiles([
      { name: "ar.csv", bytes: enc(S.SAMPLE_AR_CSV) },
      { name: "ar-copy.csv", bytes: enc(S.SAMPLE_AR_CSV) },
      { name: "bank.csv", bytes: enc(bankText) },
      { name: "usd-ar.csv", bytes: enc("customer,invoice,invoice_date,due_date,amount,outstanding,currency\nGulf Co,X1,2025-12-01,2026-01-01,100,100,USD\n") },
    ])).units;
    const items: BatchItem[] = await Promise.all(units.map(async (u) => ({ id: u.id, staged: await stageUnit(u, u.detection.category!), role: "current" as const, month: null })));
    const r = batchChecks({ ...base, fxRates: {} }, items);
    const codes = r.findings.map((f) => f.code);
    expect(codes).toContain("duplicateFile");
    expect(codes).toContain("sameSlot");
    expect(codes).toContain("outsidePeriod");
    expect(codes).toContain("fxMissing");
    expect(r.currencies).toContain("USD");
    expect(r.tieOuts).not.toBeNull();
  });
});
