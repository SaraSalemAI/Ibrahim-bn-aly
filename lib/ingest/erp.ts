import { GL_SPEC } from "../finance/gl";
import { HEADER_ALIASES, parseAmount, parseCsv } from "../finance/parse";
import * as SL from "../finance/subledgers";
import type { FieldSpec } from "../finance/table";
import type { DocCategory } from "../finance/types";

/**
 * ERP export presets. Exports from Odoo, SAP Business One, QuickBooks and Dynamics 365 use their own
 * column names, put report titles above the header, and sometimes give one signed balance or amount
 * instead of debit/credit. This module finds the header row, renames columns to the importer's names
 * and derives the missing columns, so the same parsers read every export.
 */
export type Erp = "Odoo" | "SAP Business One" | "QuickBooks" | "Dynamics 365";
export type CsvCategory = Exclude<DocCategory, "ETA_INVOICE">;

const TB_CANON: Record<string, string> = {
  code: "code",
  name: "name",
  category: "category",
  currentDebit: "current_debit",
  currentCredit: "current_credit",
  priorDebit: "prior_debit",
  priorCredit: "prior_credit",
  currency: "currency",
};

const SPECS: Record<Exclude<CsvCategory, "TRIAL_BALANCE">, Record<string, FieldSpec>> = {
  GENERAL_LEDGER: GL_SPEC,
  AR_SUBLEDGER: SL.AR_SPEC,
  AP_SUBLEDGER: SL.AP_SPEC,
  FIXED_ASSETS: SL.FAR_SPEC,
  INVENTORY: SL.INVENTORY_SPEC,
  PAYROLL: SL.PAYROLL_SPEC,
  BANK_STATEMENT: SL.BANK_SPEC,
};

/** Extra column names seen in ERP exports, by importer field. Keys starting with "__" are working columns that get derived. */
const SYNONYMS: Record<CsvCategory, Record<string, string[]>> = {
  TRIAL_BALANCE: {
    code: ["account code", "acct code", "acct. code", "account number", "account no", "account no.", "main account", "g/l account", "gl account", "gl code", "ledger account", "رمز الحساب", "كود الحساب"],
    name: ["account name", "acct name", "account description", "main account name", "g/l account name", "الحساب"],
    current_debit: ["closing debit", "debit balance", "end debit", "ending debit", "balance debit", "مدين ختامي", "رصيد مدين"],
    current_credit: ["closing credit", "credit balance", "end credit", "ending credit", "balance credit", "دائن ختامي", "رصيد دائن"],
    __balance: ["end balance", "ending balance", "closing balance", "balance", "net balance", "الرصيد الختامي", "الرصيد"],
    __account: ["account"],
  },
  GENERAL_LEDGER: {
    postingDate: ["accounting date", "posting date", "doc. date", "document date", "entry date", "transaction date", "تاريخ القيد"],
    journalId: ["journal entry", "journal number", "journal no", "entry number", "move", "trans. no.", "transaction no", "transaction number", "num", "document number", "doc. no.", "voucher"],
    accountCode: ["account code", "acct code", "g/l account", "gl account", "main account", "ledger account", "account number", "account no"],
    accountName: ["account name", "g/l account name", "main account name"],
    debit: ["debit amount", "debit (lc)", "debit amount (lc)", "debit in accounting currency"],
    credit: ["credit amount", "credit (lc)", "credit amount (lc)", "credit in accounting currency"],
    counterparty: ["partner", "bp name", "bp code", "customer/vendor", "customer", "vendor", "supplier"],
    memo: ["label", "memo/description", "line description", "text", "remarks", "details"],
    costCenter: ["analytic account", "cost centre", "cost center", "dimension", "profit center", "department"],
    __amount: ["amount", "amount (lc)", "amount in accounting currency"],
    __account: ["account", "الحساب"],
  },
  AR_SUBLEDGER: {
    customer: ["partner", "customer name", "bp name", "client", "name"],
    customerId: ["customer code", "customer account", "bp code", "account"],
    invoice: ["number", "invoice no", "doc. no.", "document number", "num", "reference"],
    invoiceDate: ["date", "posting date", "doc. date", "document date"],
    dueDate: ["invoice date due", "payment due date", "due"],
    amount: ["total", "invoice amount", "document total", "total amount", "amount (lc)"],
    outstanding: ["amount due", "open balance", "balance due", "amount residual", "residual", "remaining", "open amount", "balance"],
  },
  AP_SUBLEDGER: {
    supplier: ["partner", "vendor", "vendor name", "bp name", "name"],
    supplierId: ["vendor code", "vendor account", "bp code", "supplier code"],
    taxId: ["vat", "tax registration number", "federal tax id", "الرقم الضريبي"],
    invoice: ["number", "bill number", "vendor invoice", "bill no", "doc. no.", "document number", "num", "reference"],
    invoiceDate: ["bill date", "date", "posting date", "doc. date"],
    amount: ["total", "bill amount", "invoice amount", "document total"],
    netPayable: ["amount due", "open balance", "balance due", "amount residual", "balance", "outstanding"],
    status: ["payment state", "payment status"],
  },
  FIXED_ASSETS: {
    tag: ["asset number", "asset no", "asset id", "asset code", "fixed asset number"],
    name: ["asset name", "asset description"],
    category: ["asset class", "asset group", "asset type", "asset category"],
    acquisitionDate: ["acquisition date", "capitalization date", "in service date", "purchase date", "تاريخ الاقتناء"],
    cost: ["acquisition cost", "acquisition value", "gross value", "original value"],
    usefulLifeYears: ["useful life (years)", "life", "lifetime"],
    accumulatedDepreciation: ["accumulated depreciation", "depreciated amount", "acc. depreciation"],
  },
  INVENTORY: {
    sku: ["item code", "item no", "item number", "product code", "internal reference", "default code"],
    description: ["item name", "item description", "product", "product name"],
    endingQty: ["quantity on hand", "on hand", "in stock", "closing qty", "counted quantity"],
    openingQty: ["opening quantity", "beginning qty"],
  },
  PAYROLL: {
    employeeId: ["employee code", "employee number", "emp no", "staff id"],
    department: ["department name", "cost center"],
    basic: ["basic pay", "base salary"],
    gross: ["gross pay", "total earnings"],
    net: ["net pay", "take home"],
  },
  BANK_STATEMENT: {
    date: ["transaction date", "posting date", "value date", "booking date", "trans date"],
    description: ["transaction details", "particulars", "memo", "reference", "remarks"],
    debit: ["withdrawals", "debit amount", "money out", "payments"],
    credit: ["deposits", "credit amount", "money in", "receipts"],
    balance: ["closing balance", "available balance", "ledger balance"],
  },
};

const SIGNATURES: Array<[Erp, RegExp, number]> = [
  ["Odoo", /\b(journal entry|analytic account|amount residual|invoice date due|initial balance|end balance|internal reference|label)\b/g, 1],
  ["SAP Business One", /(acct code|bp code|bp name|trans\. no\.|doc\. no\.|g\/l acct|series)/g, 1],
  ["QuickBooks", /(transaction type|memo\/description|\bsplit\b|open balance|\bnum\b)/g, 1],
  ["Dynamics 365", /(main account|ledger account|journal number|accounting date|financial dimensions|\bvoucher\b)/g, 2],
];

export function detectErp(headers: string[]): Erp | null {
  const joined = headers.map((h) => h.trim().toLowerCase()).join(" | ");
  let best: Erp | null = null;
  let bestHits = 0;
  for (const [erp, re, min] of SIGNATURES) {
    const hits = new Set(joined.match(re) ?? []).size;
    if (hits >= min && hits > bestHits) {
      best = erp;
      bestHits = hits;
    }
  }
  return best;
}

/** Every header name the importer accepts for each field of a category: the parser's own aliases plus ERP synonyms. */
export function fieldAliases(category: CsvCategory): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (category === "TRIAL_BALANCE") {
    for (const [k, aliases] of Object.entries(HEADER_ALIASES)) out[TB_CANON[k]] = [TB_CANON[k], ...aliases];
  } else {
    for (const [k, s] of Object.entries(SPECS[category])) out[k] = [k.toLowerCase(), ...s.aliases];
  }
  for (const [k, syn] of Object.entries(SYNONYMS[category])) out[k] = [...(out[k] ?? []), ...syn];
  return out;
}

function baseAliases(category: CsvCategory): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (category === "TRIAL_BALANCE") for (const [k, aliases] of Object.entries(HEADER_ALIASES)) out[TB_CANON[k]] = aliases;
  else for (const [k, s] of Object.entries(SPECS[category])) out[k] = s.aliases;
  return out;
}

/** Importer fields a file must have; the column-matching form asks for these when they are missing. */
export function requiredFields(category: CsvCategory): string[] {
  if (category === "TRIAL_BALANCE") return ["name", "current_debit", "current_credit"];
  return Object.entries(SPECS[category])
    .filter(([, s]) => s.required)
    .map(([k]) => k);
}

export function allFields(category: CsvCategory): string[] {
  if (category === "TRIAL_BALANCE") return Object.values(TB_CANON);
  return Object.keys(SPECS[category]);
}

const norm = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase();

/** Index of the header row: the row in the first 15 that names the most known columns. Report titles above it are dropped. */
export function findHeaderRow(table: string[][], category: CsvCategory): number {
  const known = new Set(Object.values(fieldAliases(category)).flat());
  let best = 0;
  let bestScore = -1;
  table.slice(0, 15).forEach((row, i) => {
    const score = row.filter((c) => known.has(norm(c))).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

export interface Normalised {
  text: string;
  headers: string[];
  originalHeaders: string[];
  erp: Erp | null;
  skippedTitleRows: number;
  derived: string[];
}

const cell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const splitAccount = (v: string): [string, string] => {
  const m = v.trim().match(/^([0-9][0-9.\-/]*)\s*[·:\-–—]?\s*(.*)$/);
  return m ? [m[1], m[2] || m[1]] : ["", v.trim()];
};

/**
 * Renames columns to the importer's field names (applying the analyst's saved column matches first)
 * and derives debit/credit, code/name where an export only has a combined or signed column.
 */
export function normaliseTable(text: string, category: CsvCategory, columnMap: Record<string, string> = {}): Normalised {
  const table = parseCsv(text);
  if (!table.length) return { text, headers: [], originalHeaders: [], erp: null, skippedTitleRows: 0, derived: [] };
  const h0 = findHeaderRow(table, category);
  const original = table[h0].map((h) => h.replace(/^﻿/, "").trim());
  const body = table.slice(h0 + 1).filter((r) => r.some((c) => c.trim() !== ""));
  const erp = detectErp(original);
  const headers = original.map(norm);
  const base = baseAliases(category);
  const present = (field: string) => headers.some((h) => h === field.toLowerCase() || base[field]?.includes(h));

  // 1. Analyst's saved matches: field -> source header.
  for (const [field, source] of Object.entries(columnMap)) {
    const i = headers.indexOf(norm(source));
    if (i >= 0 && source) headers[i] = field.toLowerCase();
  }
  // 2. ERP synonyms, only where the parser would not already find the field.
  for (const [field, syns] of Object.entries(SYNONYMS[category])) {
    if (!field.startsWith("__") && present(field)) continue;
    for (const s of syns) {
      const i = headers.indexOf(s);
      if (i >= 0) {
        headers[i] = field.toLowerCase();
        break;
      }
    }
  }

  const derived: string[] = [];
  let rows = body.map((r) => headers.map((_, i) => (r[i] ?? "").trim()));
  const idx = (k: string) => headers.indexOf(k.toLowerCase());
  /** Column the parser will read for a field: renamed to the field name, or one of the parser's own aliases. */
  const colFor = (field: string) => {
    const i = idx(field);
    return i >= 0 ? i : headers.findIndex((h) => base[field]?.includes(h));
  };

  // QuickBooks journals put the customer or supplier in "Name" next to a separate "Account" column.
  if (category === "GENERAL_LEDGER" && erp === "QuickBooks" && idx("name") >= 0 && idx("__account") >= 0 && idx("counterparty") < 0) headers[idx("name")] = "counterparty";

  // Combined "1010 · Cash at bank" account column.
  const acc = idx("__account");
  if (acc >= 0) {
    const [codeKey, nameKey] = category === "TRIAL_BALANCE" ? ["code", "name"] : ["accountCode", "accountName"];
    const needCode = colFor(codeKey) < 0;
    const needName = colFor(nameKey) < 0;
    if (needCode) {
      headers.push(codeKey.toLowerCase(), ...(needName ? [nameKey.toLowerCase()] : []));
      rows = rows.map((r) => {
        const [c, n] = splitAccount(r[acc]);
        return [...r, c, ...(needName ? [n] : [])];
      });
      derived.push("account code/name split");
    } else if (needName) headers[acc] = nameKey.toLowerCase();
  }

  // Signed closing balance instead of closing debit/credit (Odoo "End balance", QuickBooks/Dynamics "Balance").
  const bal = idx("__balance");
  if (category === "TRIAL_BALANCE" && bal >= 0 && !(SYNONYMS.TRIAL_BALANCE.current_debit.some((s) => original.map(norm).includes(s)))) {
    const dr = colFor("current_debit");
    const cr = colFor("current_credit");
    if (dr >= 0) headers[dr] = "period_debit";
    if (cr >= 0) headers[cr] = "period_credit";
    headers.push("current_debit", "current_credit");
    rows = rows.map((r) => {
      const v = parseAmount(r[bal]) ?? 0;
      return [...r, v > 0 ? String(v) : "0", v < 0 ? String(-v) : "0"];
    });
    derived.push(dr >= 0 ? "closing debit/credit from the end balance (debit/credit columns are period movements)" : "closing debit/credit from the signed balance");
  }

  // Signed amount instead of debit/credit (QuickBooks "Amount").
  const amt = idx("__amount");
  if (category === "GENERAL_LEDGER" && amt >= 0 && colFor("debit") < 0 && colFor("credit") < 0) {
    headers.push("debit", "credit");
    rows = rows.map((r) => {
      const v = parseAmount(r[amt]) ?? 0;
      return [...r, v > 0 ? String(v) : "0", v < 0 ? String(-v) : "0"];
    });
    derived.push("debit/credit from the signed amount");
  }

  // QuickBooks and Dynamics journals repeat the date/entry only on the first line of each entry.
  if (category === "GENERAL_LEDGER") {
    for (const k of ["postingDate", "journalId"]) {
      const i = colFor(k);
      if (i < 0) continue;
      let last = "";
      let filled = 0;
      rows = rows.map((r) => {
        if (r[i]) last = r[i];
        else if (last) {
          filled++;
          return r.map((x, j) => (j === i ? last : x));
        }
        return r;
      });
      if (filled) derived.push(`${k === "postingDate" ? "date" : "entry number"} carried down to ${filled} lines`);
    }
    // Totals and account sub-total lines have neither an account nor amounts.
    const code = colFor("accountCode");
    if (code >= 0) rows = rows.filter((r) => r[code] !== "" || !/total/i.test(r.join(" ")));
  }
  if (category === "TRIAL_BALANCE") {
    const name = colFor("name");
    rows = rows.filter((r) => !(name >= 0 && /^(total|الإجمالي|المجموع)\b/i.test(r[name])));
  }

  const out = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n") + "\n";
  return { text: out, headers, originalHeaders: original, erp, skippedTitleRows: h0, derived };
}
