import ExcelJS from "exceljs";
import { CREDIT_NATURAL, type Category, type TBRow } from "./types";
import type { PeriodFigures } from "./engine";

export interface ExportInput {
  companyName: string;
  currency: string;
  framework: string;
  currentLabel: string;
  priorLabel: string;
  rows: TBRow[];
  /** Values the app computed; written beside the formulas as a cross-check, never instead of them. */
  current: PeriodFigures;
  form41?: Array<{ quarter: string; base: number; wht: number; count: number }>;
  far?: Array<{ tag: string; category: string | null; cost: number; accountingDepreciation: number; carryingAmount: number; taxDepreciation: number; taxBase: number }>;
  sourceHash?: string;
  generatedAt: string;
}

const NUM = "#,##0;[Red](#,##0)";

/** Builds a workbook whose statements are live SUMIFS / arithmetic formulas over the Trial Balance sheet (gate G-09). */
export async function buildWorkbook(x: ExportInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI CFO";
  wb.created = new Date(x.generatedAt);

  const cover = wb.addWorksheet("Cover");
  cover.columns = [{ width: 28 }, { width: 60 }];
  [
    ["Company", x.companyName],
    ["Framework", x.framework],
    ["Currency", x.currency],
    ["Current period", x.currentLabel],
    ["Prior period", x.priorLabel],
    ["Generated", x.generatedAt],
    ["Source TB SHA-256", x.sourceHash ?? "n/a"],
    ["Note", "Statements are live formulas over the 'Trial Balance' sheet. Edit the TB and every statement recalculates."],
  ].forEach((r) => cover.addRow(r));
  cover.getColumn(1).font = { bold: true };

  // ---------------------------------------------------------------- TB
  const tb = wb.addWorksheet("Trial Balance", { views: [{ state: "frozen", ySplit: 1 }] });
  tb.columns = [
    { header: "Code", width: 10 },
    { header: "Account", width: 48 },
    { header: "Category", width: 26 },
    { header: "Current Dr", width: 16, style: { numFmt: NUM } },
    { header: "Current Cr", width: 16, style: { numFmt: NUM } },
    { header: "Prior Dr", width: 16, style: { numFmt: NUM } },
    { header: "Prior Cr", width: 16, style: { numFmt: NUM } },
    { header: "Current net (Dr−Cr)", width: 18, style: { numFmt: NUM } },
    { header: "Prior net (Dr−Cr)", width: 18, style: { numFmt: NUM } },
  ];
  tb.getRow(1).font = { bold: true };
  x.rows.forEach((r, i) => {
    const n = i + 2;
    tb.addRow([r.code, r.name, r.category || "UNMAPPED", r.currentDebit, r.currentCredit, r.priorDebit, r.priorCredit, { formula: `D${n}-E${n}` }, { formula: `F${n}-G${n}` }]);
  });
  const last = x.rows.length + 1;
  const tot = tb.addRow(["", "Totals", "", { formula: `SUM(D2:D${last})` }, { formula: `SUM(E2:E${last})` }, { formula: `SUM(F2:F${last})` }, { formula: `SUM(G2:G${last})` }, { formula: `SUM(H2:H${last})` }, { formula: `SUM(I2:I${last})` }]);
  tot.font = { bold: true };
  const totRow = tot.number;
  tb.addRow(["", "Check (Dr − Cr, must be 0)", "", { formula: `D${totRow}-E${totRow}` }, "", { formula: `F${totRow}-G${totRow}` }]).font = { italic: true };
  const range = (col: string) => `'Trial Balance'!$${col}$2:$${col}$${last}`;
  const cat = (c: Category | "UNMAPPED", col: "H" | "I") => {
    const sign = c !== "UNMAPPED" && CREDIT_NATURAL.has(c as Category) ? "-" : "";
    return `${sign}SUMIFS(${range(col)},${range("C")},"${c}")`;
  };

  // ------------------------------------------------------------ P&L
  const pl = wb.addWorksheet("Income Statement");
  pl.columns = [{ header: "Line", width: 34 }, { header: x.currentLabel, width: 18, style: { numFmt: NUM } }, { header: x.priorLabel, width: 18, style: { numFmt: NUM } }, { header: "App value (check)", width: 18, style: { numFmt: NUM } }];
  pl.getRow(1).font = { bold: true };
  const plRef: Record<string, number> = {};
  const addPl = (key: string, label: string, f: (col: "H" | "I", c: "B" | "C") => string, app: number, bold = false) => {
    const r = pl.addRow([label, { formula: f("H", "B") }, { formula: f("I", "C") }, app]);
    if (bold) r.font = { bold: true };
    plRef[key] = r.number;
  };
  const P = (k: string, c: string) => `${c}${plRef[k]}`;
  const cf = x.current;
  addPl("revenue", "Revenue", (col) => cat("REVENUE", col), cf.revenue);
  addPl("cogs", "Cost of sales", (col) => cat("COGS", col), cf.cogs);
  addPl("gross", "Gross profit", (_, c) => `${P("revenue", c)}-${P("cogs", c)}`, cf.grossProfit, true);
  addPl("selling", "Selling & distribution", (col) => cat("SELLING_EXPENSE", col), cf.sellingExpenses);
  addPl("admin", "General & administrative", (col) => cat("ADMIN_EXPENSE", col), cf.adminExpenses);
  addPl("ebitda", "EBITDA", (_, c) => `${P("gross", c)}-${P("selling", c)}-${P("admin", c)}`, cf.ebitda, true);
  addPl("dep", "Depreciation & amortisation", (col) => cat("DEPRECIATION", col), cf.depreciation);
  addPl("other", "Other income", (col) => cat("OTHER_INCOME", col), cf.otherIncome);
  addPl("ebit", "EBIT", (_, c) => `${P("ebitda", c)}-${P("dep", c)}+${P("other", c)}`, cf.ebit, true);
  addPl("fin", "Finance costs", (col) => cat("FINANCE_COST", col), cf.financeCosts);
  addPl("ebt", "Profit before tax", (_, c) => `${P("ebit", c)}-${P("fin", c)}`, cf.ebt, true);
  addPl("tax", "Income tax", (col) => cat("TAX_EXPENSE", col), cf.taxExpense);
  addPl("np", "Net profit", (_, c) => `${P("ebt", c)}-${P("tax", c)}`, cf.netProfit, true);

  // ------------------------------------------------------------ BS
  const bs = wb.addWorksheet("Balance Sheet");
  bs.columns = [{ header: "Line", width: 34 }, { header: x.currentLabel, width: 18, style: { numFmt: NUM } }, { header: x.priorLabel, width: 18, style: { numFmt: NUM } }, { header: "App value (check)", width: 18, style: { numFmt: NUM } }];
  bs.getRow(1).font = { bold: true };
  const bsRef: Record<string, number> = {};
  const B = (k: string, c: string) => `${c}${bsRef[k]}`;
  const addBs = (key: string, label: string, f: (col: "H" | "I", c: "B" | "C") => string, app: number, bold = false) => {
    const r = bs.addRow([label, { formula: f("H", "B") }, { formula: f("I", "C") }, app]);
    if (bold) r.font = { bold: true };
    bsRef[key] = r.number;
  };
  const simple: Array<[string, string, Category, keyof PeriodFigures]> = [
    ["cash", "Cash & cash equivalents", "CASH", "cash"],
    ["ar", "Trade receivables", "RECEIVABLES", "receivables"],
    ["inv", "Inventory", "INVENTORY", "inventory"],
    ["oca", "Other current assets", "OTHER_CURRENT_ASSET", "otherCurrentAssets"],
  ];
  simple.forEach(([k, l, c, a]) => addBs(k, l, (col) => cat(c, col), cf[a]));
  addBs("ca", "Total current assets", (_, c) => `SUM(${B("cash", c)}:${B("oca", c)})`, cf.currentAssets, true);
  addBs("ppe", "PP&E at cost", (col) => cat("PPE", col), cf.ppeGross);
  addBs("ad", "Accumulated depreciation", (col) => cat("ACCUM_DEPRECIATION", col), cf.accumulatedDepreciation);
  addBs("onca", "Other non-current assets", (col) => cat("OTHER_NON_CURRENT_ASSET", col), cf.otherNonCurrentAssets);
  addBs("nca", "Total non-current assets", (_, c) => `SUM(${B("ppe", c)}:${B("onca", c)})`, cf.nonCurrentAssets, true);
  addBs("unm", "Unmapped holding", (col) => cat("UNMAPPED", col), cf.unmappedHolding);
  addBs("ta", "Total assets", (_, c) => `${B("ca", c)}+${B("nca", c)}+${B("unm", c)}`, cf.totalAssets, true);
  const liab: Array<[string, string, Category, keyof PeriodFigures]> = [
    ["ap", "Trade payables", "PAYABLES", "payables"],
    ["std", "Short-term borrowings", "SHORT_TERM_DEBT", "shortTermDebt"],
    ["ocl", "Other current liabilities", "OTHER_CURRENT_LIABILITY", "otherCurrentLiabilities"],
  ];
  liab.forEach(([k, l, c, a]) => addBs(k, l, (col) => cat(c, col), cf[a]));
  addBs("cl", "Total current liabilities", (_, c) => `SUM(${B("ap", c)}:${B("ocl", c)})`, cf.currentLiabilities, true);
  addBs("ltd", "Long-term borrowings", (col) => cat("LONG_TERM_DEBT", col), cf.longTermDebt);
  addBs("oncl", "Other non-current liabilities", (col) => cat("OTHER_NON_CURRENT_LIABILITY", col), cf.otherNonCurrentLiabilities);
  addBs("tl", "Total liabilities", (_, c) => `${B("cl", c)}+${B("ltd", c)}+${B("oncl", c)}`, cf.totalLiabilities, true);
  const eq: Array<[string, string, Category, keyof PeriodFigures]> = [
    ["sc", "Share capital", "SHARE_CAPITAL", "shareCapital"],
    ["lr", "Legal reserve", "LEGAL_RESERVE", "legalReserve"],
    ["re", "Retained earnings (opening)", "RETAINED_EARNINGS", "retainedEarnings"],
    ["oe", "Other equity", "OTHER_EQUITY", "otherEquity"],
  ];
  eq.forEach(([k, l, c, a]) => addBs(k, l, (col) => cat(c, col), cf[a]));
  addBs("pfp", "Profit for the period", (_, c) => `'Income Statement'!${c}${plRef.np}`, cf.netProfit);
  addBs("te", "Total equity", (_, c) => `SUM(${B("sc", c)}:${B("pfp", c)})`, cf.totalEquity, true);
  addBs("tle", "Total liabilities & equity", (_, c) => `${B("tl", c)}+${B("te", c)}`, cf.totalLiabilitiesAndEquity, true);
  addBs("chk", "Check: assets − (liabilities + equity)", (_, c) => `${B("ta", c)}-${B("tle", c)}`, 0, true);

  // ------------------------------------------------------- cash flow
  const cfs = wb.addWorksheet("Cash Flow");
  cfs.columns = [{ header: "Indirect method", width: 44 }, { header: x.currentLabel, width: 18, style: { numFmt: NUM } }];
  cfs.getRow(1).font = { bold: true };
  const d = (k: string) => `('Balance Sheet'!B${bsRef[k]}-'Balance Sheet'!C${bsRef[k]})`;
  const cfLines: Array<[string, string, boolean?]> = [
    ["Net profit", `'Income Statement'!B${plRef.np}`],
    ["Depreciation", `'Income Statement'!B${plRef.dep}`],
    ["(Increase) in receivables", `-${d("ar")}`],
    ["(Increase) in inventory", `-${d("inv")}`],
    ["(Increase) in other current assets", `-${d("oca")}`],
    ["Increase in payables", d("ap")],
    ["Increase in other current liabilities", d("ocl")],
    ["Change in unmapped holding", `-${d("unm")}`],
  ];
  const cfRef: number[] = [];
  cfLines.forEach(([l, f]) => cfRef.push(cfs.addRow([l, { formula: f }]).number));
  const cfo = cfs.addRow(["Net cash from operating activities", { formula: `SUM(B${cfRef[0]}:B${cfRef[cfRef.length - 1]})` }]);
  cfo.font = { bold: true };
  const inv1 = cfs.addRow(["Capital expenditure (Δ PP&E at cost)", { formula: `-${d("ppe")}` }]).number;
  const inv2 = cfs.addRow(["Accumulated depreciation released (derived)", { formula: `-${d("ad")}-'Income Statement'!B${plRef.dep}` }]).number;
  const inv3 = cfs.addRow(["Change in other non-current assets", { formula: `-${d("onca")}` }]).number;
  const cfi = cfs.addRow(["Net cash from investing activities", { formula: `SUM(B${inv1}:B${inv3})` }]);
  cfi.font = { bold: true };
  const f1 = cfs.addRow(["Change in short-term borrowings", { formula: d("std") }]).number;
  cfs.addRow(["Change in long-term borrowings", { formula: d("ltd") }]);
  cfs.addRow(["Change in other non-current liabilities", { formula: d("oncl") }]);
  cfs.addRow(["Share capital issued", { formula: d("sc") }]);
  const f5 = cfs.addRow(["Dividends and other equity movements (derived)", { formula: `${d("lr")}+${d("re")}+${d("oe")}-'Income Statement'!C${plRef.np}` }]).number;
  const cff = cfs.addRow(["Net cash from financing activities", { formula: `SUM(B${f1}:B${f5})` }]);
  cff.font = { bold: true };
  const net = cfs.addRow(["Net change in cash", { formula: `B${cfo.number}+B${cfi.number}+B${cff.number}` }]).number;
  const beg = cfs.addRow(["Beginning cash", { formula: `'Balance Sheet'!C${bsRef.cash}` }]).number;
  const end = cfs.addRow(["Ending cash per cash flow", { formula: `B${beg}+B${net}` }]).number;
  cfs.addRow(["Check vs balance sheet cash (must be 0)", { formula: `B${end}-'Balance Sheet'!B${bsRef.cash}` }]).font = { italic: true };

  // ---------------------------------------------------------- ratios
  const ra = wb.addWorksheet("Ratios");
  ra.columns = [{ header: "Ratio", width: 30 }, { header: x.currentLabel, width: 14, style: { numFmt: "0.00" } }, { header: "Formula", width: 50 }];
  ra.getRow(1).font = { bold: true };
  const b = (k: string) => `'Balance Sheet'!B${bsRef[k]}`;
  const p = (k: string) => `'Income Statement'!B${plRef[k]}`;
  const ratios: Array<[string, string, string]> = [
    ["Current ratio", `${b("ca")}/${b("cl")}`, "Current assets / current liabilities"],
    ["Quick ratio", `(${b("ca")}-${b("inv")})/${b("cl")}`, "(CA − inventory) / CL"],
    ["Gross margin %", `${p("gross")}/${p("revenue")}*100`, "Gross profit / revenue"],
    ["EBITDA margin %", `${p("ebitda")}/${p("revenue")}*100`, "EBITDA / revenue"],
    ["Net margin %", `${p("np")}/${p("revenue")}*100`, "Net profit / revenue"],
    ["ROE %", `${p("np")}/${b("te")}*100`, "Net profit / closing equity"],
    ["DSO (days)", `${b("ar")}/${p("revenue")}*365`, "Receivables / revenue × 365"],
    ["DIO (days)", `${b("inv")}/${p("cogs")}*365`, "Inventory / COGS × 365"],
    ["DPO (days)", `${b("ap")}/${p("cogs")}*365`, "Payables / COGS × 365"],
    ["Debt / equity", `(${b("std")}+${b("ltd")})/${b("te")}`, "Borrowings / equity"],
    ["Interest coverage", `${p("ebit")}/${p("fin")}`, "EBIT / finance costs"],
  ];
  ratios.forEach(([l, f, desc]) => ra.addRow([l, { formula: `IFERROR(${f},"n/a")` }, desc]));

  if (x.far?.length) {
    const fa = wb.addWorksheet("Fixed Assets");
    fa.columns = ["Tag", "Category", "Cost", "Accounting dep.", "Carrying amount", "Tax dep.", "Tax base", "Temporary difference"].map((h, i) => ({ header: h, width: i < 2 ? 16 : 18, style: i >= 2 ? { numFmt: NUM } : {} }));
    fa.getRow(1).font = { bold: true };
    x.far.forEach((a, i) => fa.addRow([a.tag, a.category ?? "?", a.cost, a.accountingDepreciation, a.carryingAmount, a.taxDepreciation, a.taxBase, { formula: `E${i + 2}-G${i + 2}` }]));
    const n = x.far.length + 1;
    fa.addRow(["Total", "", ...["C", "D", "E", "F", "G", "H"].map((c) => ({ formula: `SUM(${c}2:${c}${n})` }))]).font = { bold: true };
  }
  if (x.form41?.length) {
    const f41 = wb.addWorksheet("Form 41 WHT");
    f41.columns = [{ header: "Quarter", width: 12 }, { header: "Invoices", width: 10 }, { header: "Taxable base", width: 18, style: { numFmt: NUM } }, { header: "WHT deducted", width: 18, style: { numFmt: NUM } }, { header: "Effective %", width: 12, style: { numFmt: "0.00" } }];
    f41.getRow(1).font = { bold: true };
    x.form41.forEach((q, i) => f41.addRow([q.quarter, q.count, q.base, q.wht, { formula: `IFERROR(D${i + 2}/C${i + 2}*100,0)` }]));
    const n = x.form41.length + 1;
    f41.addRow(["Total", { formula: `SUM(B2:B${n})` }, { formula: `SUM(C2:C${n})` }, { formula: `SUM(D2:D${n})` }]).font = { bold: true };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
