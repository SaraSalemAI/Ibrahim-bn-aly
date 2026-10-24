import { CATEGORIES, type Category, type Issue, type TBRow } from "./types";
import { suggestCategory } from "./classify";

/** RFC 4180-style CSV parser: quoted fields, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const delimiter = detectDelimiter(src);

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function detectDelimiter(src: string): string {
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}

/** Accepts "1,234.50", "(1,234.50)", "-1234.5", Arabic-Indic digits and blanks. */
export function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined) return 0;
  let s = raw.trim();
  if (s === "" || s === "-") return 0;
  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(/٫/g, ".").replace(/[٬\s]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/,/g, "").replace(/EGP|ج\.م|LE/gi, "");
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

const HEADER_ALIASES: Record<string, string[]> = {
  code: ["code", "account code", "account_code", "acct", "رقم الحساب", "كود"],
  name: ["name", "account name", "account_name", "description", "اسم الحساب", "البيان"],
  category: ["category", "mapping", "class", "التصنيف"],
  currentDebit: ["current_debit", "current debit", "debit", "dr", "مدين"],
  currentCredit: ["current_credit", "current credit", "credit", "cr", "دائن"],
  priorDebit: ["prior_debit", "prior debit", "previous debit", "مدين سابق"],
  priorCredit: ["prior_credit", "prior credit", "previous credit", "دائن سابق"],
};

export const TEMPLATE_HEADER = "code,name,category,current_debit,current_credit,prior_debit,prior_credit";

export interface ParseResult {
  rows: TBRow[];
  issues: Issue[];
}

export function parseTrialBalance(text: string): ParseResult {
  const issues: Issue[] = [];
  const table = parseCsv(text);
  if (table.length < 2) {
    return { rows: [], issues: [{ level: "error", code: "emptyFile" }] };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx >= 0) col[key as keyof typeof HEADER_ALIASES] = idx;
  }
  if (col.name === undefined || col.currentDebit === undefined || col.currentCredit === undefined) {
    return { rows: [], issues: [{ level: "error", code: "missingColumns" }] };
  }

  const rows: TBRow[] = [];
  table.slice(1).forEach((cells, i) => {
    const sourceRow = i + 2;
    const get = (k: keyof typeof HEADER_ALIASES) => (col[k] === undefined ? undefined : cells[col[k]!]);
    const amounts = {
      currentDebit: parseAmount(get("currentDebit")),
      currentCredit: parseAmount(get("currentCredit")),
      priorDebit: parseAmount(get("priorDebit")),
      priorCredit: parseAmount(get("priorCredit")),
    };
    const bad = Object.entries(amounts).find(([, v]) => v === null);
    if (bad) {
      issues.push({ level: "error", code: "badAmount", params: { row: sourceRow, column: bad[0] } });
      return;
    }
    const name = (get("name") ?? "").trim();
    const code = (get("code") ?? "").trim();
    const rawCategory = (get("category") ?? "").trim().toUpperCase();
    let category: Category | "" = "";
    let suggested = false;
    if ((CATEGORIES as readonly string[]).includes(rawCategory)) {
      category = rawCategory as Category;
    } else {
      if (rawCategory !== "") {
        issues.push({ level: "warning", code: "unknownCategory", params: { row: sourceRow, value: rawCategory } });
      }
      category = suggestCategory(code, name);
      suggested = category !== "";
    }
    rows.push({
      code,
      name,
      category,
      suggested,
      currentDebit: amounts.currentDebit!,
      currentCredit: amounts.currentCredit!,
      priorDebit: amounts.priorDebit!,
      priorCredit: amounts.priorCredit!,
      sourceRow,
    });
  });

  return { rows, issues };
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: TBRow[]): string {
  const lines = rows.map((r) =>
    [r.code, r.name, r.category, r.currentDebit, r.currentCredit, r.priorDebit, r.priorCredit].map(csvCell).join(","),
  );
  return [TEMPLATE_HEADER, ...lines].join("\n") + "\n";
}
