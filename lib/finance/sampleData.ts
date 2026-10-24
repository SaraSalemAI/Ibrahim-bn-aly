import { parseTrialBalance } from "./parse";
import { SAMPLE_TB_CSV } from "./sample";

/**
 * Illustrative subledgers for the fictional sample company (FY2025, EGP). They tie to the sample trial balance
 * except where a finding is deliberate (ETA sales below GL revenue; one inventory shrinkage; one NRV write-down).
 */
export const SAMPLE_PERIOD = { start: "2025-01-01", end: "2025-12-31" };

export const SAMPLE_AR_CSV = `customer_id,customer,invoice,invoice_date,due_date,amount,outstanding,currency
C001,Delta Retail SAE,INV-2025-1101,2025-11-05,2026-01-04,1800000,1800000,EGP
C002,Cairo Foods LLC,INV-2025-1015,2025-10-15,2025-12-14,1500000,1500000,EGP
C003,Alex Distribution,INV-2025-0920,2025-09-20,2025-11-19,1250000,1250000,EGP
C004,Giza Markets,INV-2025-0815,2025-08-15,2025-10-14,900000,900000,EGP
C005,Upper Egypt Trading,INV-2025-0701,2025-07-01,2025-08-30,600000,600000,EGP
C006,Red Sea Hotels,INV-2025-0410,2025-04-10,2025-06-09,450000,450000,EGP
C001,Delta Retail SAE,INV-2025-1210,2025-12-10,2026-02-08,300000,300000,EGP
`;

export const SAMPLE_AP_CSV = `supplier_id,supplier,tax_id,invoice,invoice_date,due_date,amount,wht,net_payable,status
S001,Nile Packaging Co,123456789,P-7781,2025-11-20,2026-01-19,1616161.62,16161.62,1600000,unpaid
S002,Suez Logistics,234567891,P-7790,2025-12-01,2025-12-31,1030927.84,30927.84,1000000,unpaid
S003,Delta Raw Materials,345678912,P-7702,2025-10-10,2025-12-09,1500000,0,1500000,unpaid
S004,Cairo Consulting,456789123,P-7650,2025-06-01,2025-07-01,526315.79,26315.79,500000,paid
S002,Suez Logistics,234567891,P-7511,2025-03-15,2025-04-14,412371.13,12371.13,400000,paid
`;

export const SAMPLE_FAR_CSV = `tag,name,category,acquisition_date,cost,useful_life,accumulated_depreciation,current_year_depreciation,tax_cost_base,accumulated_tax_depreciation,new_manufacturing
FA-001,Head office building,BUILDINGS,2018-01-01,6000000,40,1050000,150000,6000000,2100000,no
FA-002,Production line,MACHINERY,2020-07-01,3000000,10,1050000,300000,3000000,1800000,no
FA-003,Servers and laptops,IT_EQUIPMENT,2023-01-01,800000,4,400000,200000,800000,600000,no
FA-004,Delivery vehicles,VEHICLES,2022-01-01,700000,5,200000,140000,700000,413000,no
FA-005,Packaging machine,MACHINERY,2025-04-01,1500000,10,0,110000,1500000,0,yes
`;

export const SAMPLE_INVENTORY_CSV = `sku,description,category,opening_qty,opening_unit_cost,receipts_qty,receipts_cost,issues_qty,ending_qty,method,nrv
SKU-A,Packaged rice 5kg,Food,6000,240,10000,2500000,8000,8000,FIFO,300
SKU-B,Sunflower oil 1L carton,Food,4000,615,5000,2000000,3950,5000,FIFO,380
SKU-C,Cleaning products pallet,Household,2000,500,2000,1800000,2000,2000,WAC,
`;

export const SAMPLE_PAYROLL_CSV = `employee_id,department,basic,allowances,overtime,gross,employee_si,company_si,income_tax,net
E001,Finance,30000,5000,0,35000,3850,6562.5,4200,26950
E002,Sales,22000,6000,2000,30000,3300,5625,3300,23400
E003,Sales,18000,4000,1000,23000,2530,4312.5,2100,18370
E004,Operations,15000,3000,1500,19500,2145,3656.25,1500,15855
E005,Operations,12000,2500,500,15000,1650,2812.5,900,12450
E006,Administration,14000,2000,0,16000,1760,3000,1000,13240
`;

export const SAMPLE_BANK_CSV = `date,description,amount,balance
2025-12-01,Opening balance,0,4081500
2025-12-11,Customer receipt Delta Retail,1200000,5281500
2025-12-16,Cheque 10452 Nile Packaging,-650000,4631500
2025-12-31,Bank charges December,-2500,4629000
`;

export const SAMPLE_ETA_JSON = JSON.stringify(
  {
    documents: [
      { uuid: "ETA-UUID-0001", internalId: "INV-2025-0001", issuer: { id: "100200300" }, receiver: { id: "123123123", type: "B" }, documentType: "I", dateTimeIssued: "2025-03-31T10:00:00Z", netAmount: 12000000, taxTotals: [{ taxType: "T1", amount: 1680000 }], total: 13680000 },
      { uuid: "ETA-UUID-0002", internalId: "INV-2025-0002", issuer: { id: "100200300" }, receiver: { id: "321321321", type: "B" }, documentType: "I", dateTimeIssued: "2025-06-30T10:00:00Z", netAmount: 9500000, taxTotals: [{ taxType: "T1", amount: 1330000 }], total: 10830000 },
      { uuid: "ETA-UUID-0003", internalId: "INV-2025-0003", issuer: { id: "100200300" }, receiver: { id: "456456456", type: "B" }, documentType: "I", dateTimeIssued: "2025-09-30T10:00:00Z", netAmount: 9000000, taxTotals: [{ taxType: "T1", amount: 1170000 }], total: 10170000 },
      { uuid: "ETA-UUID-0004", internalId: "INV-2025-0004", issuer: { id: "100200300" }, receiver: { id: "98765", type: "B" }, documentType: "I", dateTimeIssued: "2025-12-31T10:00:00Z", netAmount: 7650000, taxTotals: [{ taxType: "T1", amount: 1071000 }], total: 8721000 },
      { uuid: "ETA-UUID-0005", internalId: "CN-2025-0001", issuer: { id: "100200300" }, receiver: { id: "123123123", type: "B" }, documentType: "C", dateTimeIssued: "2025-11-15T10:00:00Z", netAmount: 300000, taxTotals: [{ taxType: "T1", amount: 42000 }], total: 342000 },
    ],
  },
  null,
  1,
);

/**
 * GL for the sample: four dated cash journals plus one summary journal carrying the rest of each account's
 * movement, so GL activity equals the TB movement for every account and every journal balances.
 */
export function buildSampleGlCsv(): string {
  const rows = parseTrialBalance(SAMPLE_TB_CSV).rows;
  const cashJournals: Array<{ id: string; date: string; lines: Array<[string, number]>; memo: string }> = [
    { id: "JE-0630", date: "2025-06-30", memo: "Long-term loan instalment", lines: [["2401", 1000000], ["1101", -1000000]] },
    { id: "JE-1210", date: "2025-12-10", memo: "Receipt Delta Retail", lines: [["1101", 1200000], ["1201", -1200000]] },
    { id: "JE-1215", date: "2025-12-15", memo: "Cheque 10452 Nile Packaging", lines: [["2101", 650000], ["1101", -650000]] },
    { id: "JE-1229", date: "2025-12-29", memo: "Cheque 10460 Suez Logistics", lines: [["2101", 431500], ["1101", -431500]] },
  ];
  const posted = new Map<string, number>();
  for (const j of cashJournals) for (const [code, amt] of j.lines) posted.set(code, (posted.get(code) ?? 0) + amt);
  const out = ["posting_date,journal_id,voucher,account_code,account_name,debit,credit,cost_center,counterparty,memo"];
  const name = (code: string) => rows.find((r) => r.code === code)?.name.replace(/,/g, " ") ?? code;
  const line = (date: string, id: string, code: string, amt: number, memo: string) =>
    out.push(`${date},${id},${id},${code},${name(code)},${amt > 0 ? amt : 0},${amt < 0 ? -amt : 0},HQ,,${memo}`);
  for (const j of cashJournals) for (const [code, amt] of j.lines) line(j.date, j.id, code, amt, j.memo);
  for (const r of rows) {
    const movement = r.currentDebit - r.currentCredit - (r.priorDebit - r.priorCredit) - (posted.get(r.code) ?? 0);
    if (Math.abs(movement) > 0.004) line("2025-12-31", "JE-SUMMARY", r.code, Math.round(movement * 100) / 100, "Summarised period activity");
  }
  return out.join("\n") + "\n";
}
