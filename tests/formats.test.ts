import * as CFB from "cfb";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { SAMPLE_TB_CSV } from "@/lib/finance/sample";
import { detectFile } from "@/lib/ingest/detect";
import { headerKey, normaliseTable, resolveHeader } from "@/lib/ingest/erp";
import { fixedWidthToCsv, jsonTable, pipeToCsv, readDbf, readDocxTables, readHtmlTables, readOds, readSpreadsheetMl, readXls, splitTables } from "@/lib/ingest/formats";
import { itemsToLines } from "@/lib/ingest/pdf";
import { expandFiles, stageUnit } from "@/lib/ingest/stage";
import { parseCsv } from "@/lib/finance/parse";

const enc = (s: string) => new TextEncoder().encode(s);

// ---------------------------------------------------------------- BIFF8 fixture

function rec(type: number, body: number[] | Uint8Array): number[] {
  const b = [...body];
  return [type & 0xff, type >> 8, b.length & 0xff, b.length >> 8, ...b];
}
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const f64 = (n: number) => [...new Uint8Array(new Float64Array([n]).buffer)];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** A minimal Excel 97-2003 workbook: shared strings split by a CONTINUE record, numbers, RK values and a date cell. */
function buildXls(): Uint8Array {
  const strings = ["Account Code", "Account Name", "Debit", "Credit", "Cash at bank", "Share capital", "Date"];
  const sstBody: number[] = [...le32(strings.length), ...le32(strings.length)];
  for (const s of strings) sstBody.push(...le16(s.length), 0, ...ascii(s));
  // Split the SST in the middle of "Cash at bank": the continuation restarts with its option byte.
  const cut = sstBody.indexOf("C".charCodeAt(0), 55) + 4;
  expect(cut).toBeGreaterThan(55);
  const sst = [...rec(0x00fc, sstBody.slice(0, cut)), ...rec(0x003c, [0, ...sstBody.slice(cut)])];
  const xfs: number[] = [];
  for (let i = 0; i < 16; i++) xfs.push(...rec(0x00e0, [0, 0, ...le16(i === 15 ? 14 : 0), ...new Array(16).fill(0)]));
  const bof = rec(0x0809, [...le16(0x0600), ...le16(0x0005), ...new Array(12).fill(0)]);
  const sheetName = "Trial balance";
  const boundsheetLen = 4 + 4 + 2 + 2 + sheetName.length;
  const globalsLen = bof.length + xfs.length + boundsheetLen + sst.length + 4;
  const boundsheet = rec(0x0085, [...le32(globalsLen), 0, 0, sheetName.length, 0, ...ascii(sheetName)]);
  const globals = [...bof, ...xfs, ...boundsheet, ...sst, ...rec(0x000a, [])];
  expect(globals.length).toBe(globalsLen);
  const label = (r: number, c: number, i: number) => rec(0x00fd, [...le16(r), ...le16(c), ...le16(0), ...le32(i)]);
  const number = (r: number, c: number, v: number, xf = 0) => rec(0x0203, [...le16(r), ...le16(c), ...le16(xf), ...f64(v)]);
  const rkInt = (r: number, c: number, v: number) => rec(0x027e, [...le16(r), ...le16(c), ...le16(0), ...le32(((v << 2) | 2) >>> 0)]);
  const sheet = [
    ...bof,
    ...label(0, 0, 0), ...label(0, 1, 1), ...label(0, 2, 2), ...label(0, 3, 3), ...label(0, 4, 6),
    ...number(1, 0, 1101), ...label(1, 1, 4), ...number(1, 2, 250000.5), ...rkInt(1, 3, 0), ...number(1, 4, 45658, 15),
    ...number(2, 0, 3101), ...label(2, 1, 5), ...rkInt(2, 2, 0), ...number(2, 3, 250000.5), ...number(2, 4, 45658, 15),
    ...rec(0x000a, []),
  ];
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, "/Workbook", Uint8Array.from([...globals, ...sheet]));
  return Uint8Array.from(CFB.write(cfb, { type: "array" }) as ArrayLike<number>);
}

describe("legacy Excel (.xls)", () => {
  it("reads shared strings across CONTINUE records, numbers, RK values and dates", () => {
    const [s] = readXls(buildXls());
    expect(s.name).toBe("Trial balance");
    const t = parseCsv(s.csv);
    expect(t[0]).toEqual(["Account Code", "Account Name", "Debit", "Credit", "Date"]);
    expect(t[1]).toEqual(["1101", "Cash at bank", "250000.5", "0", "2025-01-01"]);
    expect(t[2][1]).toBe("Share capital");
  });

  it("is recognised by its OLE signature even when named .xls, and imports as a trial balance", async () => {
    const { units, errors } = await expandFiles([{ name: "TB export.xls", bytes: buildXls() }]);
    expect(errors).toEqual([]);
    expect(units[0].detection.category).toBe("TRIAL_BALANCE");
    const st = await stageUnit(units[0], "TRIAL_BALANCE");
    expect(st.rowCount).toBe(2);
  });

  it("rejects files that are not workbooks with a clear message", () => {
    expect(() => readXls(enc("not a workbook"))).toThrow(/could not be opened/);
  });
});

describe("other spreadsheet and document formats", () => {
  it("reads HTML tables saved as .xls by ERPs, including colspan", async () => {
    const html = `<html><meta charset="utf-8"><table><tr><th colspan="2">Report</th></tr><tr><td>Account Code</td><td>Account Name</td><td>Debit</td><td>Credit</td></tr><tr><td>1101</td><td>Cash &amp; banks</td><td>100</td><td>0</td></tr><tr><td>3101</td><td>Capital</td><td>0</td><td>100</td></tr></table></html>`;
    const [s] = readHtmlTables(html);
    expect(parseCsv(s.csv)[0]).toEqual(["Report", "", "", ""]);
    expect(parseCsv(s.csv)[2][1]).toBe("Cash & banks");
    const { units } = await expandFiles([{ name: "odoo_tb.xls", bytes: enc(html) }]);
    expect(units[0].detection.category).toBe("TRIAL_BALANCE");
  });

  it("reads Excel 2003 XML (SpreadsheetML) with Index gaps and dates", () => {
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="AR"><Table><Row><Cell><Data ss:Type="String">Invoice</Data></Cell><Cell ss:Index="3"><Data ss:Type="String">Amount</Data></Cell></Row><Row><Cell><Data ss:Type="String">INV-1</Data></Cell><Cell ss:Index="3"><Data ss:Type="Number">500</Data></Cell><Cell><Data ss:Type="DateTime">2025-03-31T00:00:00</Data></Cell></Row></Table></Worksheet></Workbook>`;
    const [s] = readSpreadsheetMl(xml);
    expect(s.name).toBe("AR");
    expect(parseCsv(s.csv)[1]).toEqual(["INV-1", "", "500", "2025-03-31"]);
  });

  it("reads OpenDocument spreadsheets with repeated cells", () => {
    const content = `<office:document-content><office:body><office:spreadsheet><table:table table:name="TB"><table:table-row><table:table-cell office:value-type="string"><text:p>Code</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Amount</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="float" office:value="1101"><text:p>1,101</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="7.5" table:number-columns-repeated="2"/></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>`;
    const [s] = readOds(zipSync({ "content.xml": strToU8(content) }));
    expect(parseCsv(s.csv)).toEqual([["Code", "Amount", ""], ["1101", "7.5", "7.5"]]);
  });

  it("reads tables out of Word documents", () => {
    const doc = `<w:document><w:body><w:p><w:r><w:t>Aging report</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Customer</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Balance</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Nile </w:t></w:r><w:r><w:t>Foods</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1200</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;
    const [s] = readDocxTables(zipSync({ "word/document.xml": strToU8(doc) }));
    expect(parseCsv(s.csv)).toEqual([["Customer", "Balance"], ["Nile Foods", "1200"]]);
  });

  it("reads dBase files with dates, logicals, deleted records and Arabic text", () => {
    const fields = [["CODE", "C", 6], ["NAME", "C", 20], ["DT", "D", 8], ["OK", "L", 1]] as const;
    const recLen = 1 + fields.reduce((a, f) => a + f[2], 0);
    const headerLen = 32 + fields.length * 32 + 1;
    const head = new Uint8Array(headerLen);
    head[0] = 3;
    head.set(le32(3), 4);
    head.set(le16(headerLen), 8);
    head.set(le16(recLen), 10);
    fields.forEach(([n, t, l], i) => {
      head.set(ascii(n), 32 + i * 32);
      head[32 + i * 32 + 11] = t.charCodeAt(0);
      head[32 + i * 32 + 16] = l;
    });
    head[headerLen - 1] = 0x0d;
    const pad = (b: Uint8Array, n: number) => { const o = new Uint8Array(n).fill(32); o.set(b.subarray(0, n)); return o; };
    const row = (del: boolean, code: string, name: string, dt: string, ok: string) => Uint8Array.from([del ? 0x2a : 0x20, ...pad(enc(code), 6), ...pad(enc(name), 20), ...pad(enc(dt), 8), ...pad(enc(ok), 1)]);
    const bytes = Uint8Array.from([...head, ...row(false, "1101", "النقدية", "20250331", "T"), ...row(true, "9999", "deleted", "20250101", "F"), ...row(false, "3101", "Capital", "", "N")]);
    const [s] = readDbf(bytes, "TB");
    expect(parseCsv(s.csv)).toEqual([["code", "name", "dt", "ok"], ["1101", "النقدية", "2025-03-31", "TRUE"], ["3101", "Capital", "", "FALSE"]]);
  });

  it("turns JSON record arrays, pipe tables and fixed-width reports into tables", () => {
    expect(parseCsv(jsonTable(JSON.stringify({ data: [{ code: "1101", balance: 5, meta: { x: 1 } }, { code: "3101", balance: -5 }] }))!.csv)).toEqual([["code", "balance"], ["1101", "5"], ["3101", "-5"]]);
    expect(jsonTable("[1,2,3]")).toBeNull();
    expect(parseCsv(pipeToCsv("| Code | Debit |\n|---|---|\n| 1101 | 10 |\n| 3101 | 0 |")!)).toEqual([["Code", "Debit"], ["1101", "10"], ["3101", "0"]]);
    const prn = "Account Code   Account Name        Debit      Credit\n1101           Cash at bank        1,000      0\n3101           Share capital       0          1,000\n";
    expect(parseCsv(fixedWidthToCsv(prn)!)[2]).toEqual(["3101", "Share capital", "0", "1,000"]);
    expect(fixedWidthToCsv("a,b\n1,2\n")).toBeNull();
  });

  it("splits several tables stacked on one sheet, keeping titles with their table", () => {
    const csv = ["Trial balance March", "Account Code,Account Name,Debit,Credit", "1101,Cash,10,0", "3101,Capital,0,10", "", "", "AR aging", "Invoice,Customer,Amount,Due", "INV-1,Nile,5,2025-04-01", "INV-2,Delta,6,2025-04-02"].join("\n") + "\n";
    const parts = splitTables({ name: "Pack", csv, rows: 10 });
    expect(parts.map((p) => p.name)).toEqual(["Pack · table 1", "Pack · table 2"]);
    expect(parts[1].csv.startsWith("AR aging\nInvoice")).toBe(true);
    expect(splitTables({ name: "One", csv: "a,b\n1,2\n3,4\n", rows: 3 })).toHaveLength(1);
  });

  it("rebuilds lines and column gaps from PDF text positions", () => {
    const items = [
      { str: "Amount", x: 200, y: 700.5, w: 30 },
      { str: "Code", x: 10, y: 700, w: 20 },
      { str: "1101", x: 10, y: 680, w: 20 },
      { str: "500", x: 200, y: 680, w: 15 },
    ];
    const text = itemsToLines(items).join("\n");
    expect(parseCsv(fixedWidthToCsv(text)!)).toEqual([["Code", "Amount"], ["1101", "500"]]);
  });
});

describe("headers in Arabic, two rows and other ERPs", () => {
  it("normalises Arabic spelling variants and punctuation", () => {
    expect(headerKey("إسم الحساب")).toBe(headerKey("اسم الحساب"));
    expect(headerKey("Account_No.")).toBe("account no");
    expect(headerKey("الرصيد  المدينـــة")).toBe(headerKey("الرصيد المدينه"));
  });

  it("recognises an Arabic trial balance export", () => {
    const csv = "رقم الحساب,اسم الحساب,مدين,دائن\n1101,النقدية بالبنوك,1000,0\n3101,رأس المال,0,1000\n";
    expect(detectFile("ميزان مارس.csv", csv).category).toBe("TRIAL_BALANCE");
  });

  it("merges a two-row header (opening / period / closing over debit / credit)", () => {
    const t = parseCsv("Account,Name,Opening,,Movement,,Closing,\n,,Debit,Credit,Debit,Credit,Debit,Credit\n1101,Cash,5,0,10,3,12,0\n3101,Capital,0,5,0,7,0,12\n");
    const r = resolveHeader(t, "TRIAL_BALANCE");
    expect(r.header).toContain("closing debit");
    const n = normaliseTable("Account,Name,Opening,,Movement,,Closing,\n,,Debit,Credit,Debit,Credit,Debit,Credit\n1101,Cash,5,0,10,3,12,0\n3101,Capital,0,5,0,7,0,12\n", "TRIAL_BALANCE");
    expect(n.derived.join(" ")).toMatch(/two-row header/);
  });

  it("detects the sample trial balance unchanged", () => {
    expect(detectFile("x.csv", SAMPLE_TB_CSV).category).toBe("TRIAL_BALANCE");
  });
});

describe("digital PDFs", () => {
  it("reads a PDF with a text layer as a table instead of sending it to OCR", async () => {
    const lines = ["Account Code   Account Name        Debit      Credit", "1101           Cash at bank        1000       0", "3101           Share capital       0          1000"];
    const stream = `BT /F1 10 Tf 40 760 Td 14 TL ${lines.map((l) => `(${l}) Tj T*`).join(" ")} ET`;
    const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"];
    let pdf = "%PDF-1.4\n";
    const offs: number[] = [];
    objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const { units } = await expandFiles([{ name: "printed tb.pdf", bytes: enc(pdf) }]);
    expect(units[0].detection.format).toBe("csv");
    expect(units[0].detection.category).toBe("TRIAL_BALANCE");
    expect(detectFile("scan.pdf", null).format).toBe("pdf");
  });
});
