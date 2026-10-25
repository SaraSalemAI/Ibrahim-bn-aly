import { parseCsv } from "../finance/parse";
import type { DocCategory } from "../finance/types";
import { isMt940, isOfx } from "./bankFormats";
import { fieldAliases, headerKey, requiredFields, resolveHeader, type CsvCategory } from "./erp";

export interface Detection {
  category: DocCategory | null;
  /** 0-100 */
  confidence: number;
  reason: string;
  /** Other plausible categories, best first. */
  alternatives: Array<{ category: DocCategory; confidence: number }>;
  format: "csv" | "eta" | "mt940" | "ofx" | "pdf" | "image" | "unknown";
}

const CSV_CATEGORIES: CsvCategory[] = ["TRIAL_BALANCE", "GENERAL_LEDGER", "AR_SUBLEDGER", "AP_SUBLEDGER", "FIXED_ASSETS", "INVENTORY", "PAYROLL", "BANK_STATEMENT"];

const NAME_HINTS: Record<CsvCategory, RegExp> = {
  TRIAL_BALANCE: /(^|[^a-z])(tb|trial[ _-]?balance|ميزان)/i,
  GENERAL_LEDGER: /(^|[^a-z])(gl|general[ _-]?ledger|journal|ledger|أستاذ|يومية|قيود)/i,
  AR_SUBLEDGER: /(^|[^a-z])(ar|receivable|aging|ageing|customer|debtors|عملاء|مدينون)/i,
  AP_SUBLEDGER: /(^|[^a-z])(ap|payable|supplier|vendor|creditors|bills|موردين|دائنون)/i,
  FIXED_ASSETS: /(^|[^a-z])(far|fixed[ _-]?asset|asset[ _-]?register|assets|أصول)/i,
  INVENTORY: /(inventory|stock|items|مخزون|أصناف)/i,
  PAYROLL: /(payroll|salar|wages|رواتب|أجور|مرتبات)/i,
  BANK_STATEMENT: /(bank|statement|كشف|بنك)/i,
};

/** Columns that tell look-alike files apart (a GL has dates and entry numbers; a TB does not). */
const DISCRIMINATORS: Partial<Record<CsvCategory, { needs?: string[]; penalisedBy?: string[] }>> = {
  TRIAL_BALANCE: { penalisedBy: ["postingDate", "journalId", "invoice", "date"] },
  GENERAL_LEDGER: { needs: ["journalId"] },
  BANK_STATEMENT: { penalisedBy: ["journalId", "accountCode"] },
};

function headerScore(headers: string[], category: CsvCategory): number {
  const aliases = fieldAliases(category);
  const set = new Set(headers);
  const has = (field: string) => (aliases[field] ?? [field.toLowerCase()]).some((a) => set.has(headerKey(a)));
  const req = requiredFields(category);
  const optional = Object.keys(aliases).filter((k) => !req.includes(k) && !k.startsWith("__"));
  const reqHit = req.filter(has).length / Math.max(1, req.length);
  const optHit = optional.filter(has).length / Math.max(1, optional.length);
  let score = reqHit * 0.75 + optHit * 0.25;
  const d = DISCRIMINATORS[category];
  if (d?.needs && !d.needs.every(has)) score *= 0.5;
  if (d?.penalisedBy) {
    const all = CSV_CATEGORIES.flatMap((c) => Object.entries(fieldAliases(c)));
    const other = (field: string) => all.filter(([k]) => k === field).some(([, al]) => al.some((a) => set.has(headerKey(a))));
    if (d.penalisedBy.some(other)) score *= 0.6;
  }
  return score;
}

/**
 * Works out what a file is from its format, column headers and name. CSV categories are scored on
 * how many of their required and optional columns the header row names; the file name breaks ties.
 */
export function detectFile(fileName: string, text: string | null): Detection {
  const lower = fileName.toLowerCase();
  if (text === null && /\.pdf$/.test(lower)) return { category: null, confidence: 0, reason: "PDF: needs text recognition (OCR)", alternatives: [], format: "pdf" };
  if (text === null && /\.(png|jpe?g|webp|gif|heic)$/.test(lower)) return { category: null, confidence: 0, reason: "Image: needs text recognition (OCR)", alternatives: [], format: "image" };
  if (text === null) return { category: null, confidence: 0, reason: "Unsupported file type", alternatives: [], format: "unknown" };
  const src = text.replace(/^﻿/, "").trimStart();
  if (isMt940(src)) return { category: "BANK_STATEMENT", confidence: 98, reason: "SWIFT MT940 statement", alternatives: [], format: "mt940" };
  if (isOfx(src)) return { category: "BANK_STATEMENT", confidence: 98, reason: "OFX bank statement", alternatives: [], format: "ofx" };
  if (/\.(json|xml)$/.test(lower) || src.startsWith("{") || src.startsWith("[") || src.startsWith("<")) {
    const eta = /uuid|internalId|dateTimeIssued|taxTotals|<document/i.test(src.slice(0, 20000));
    return { category: eta ? "ETA_INVOICE" : null, confidence: eta ? 95 : 0, reason: eta ? "ETA e-invoice export" : "JSON/XML without ETA document fields", alternatives: [], format: eta ? "eta" : "unknown" };
  }

  const table = parseCsv(src.split(/\r?\n/).slice(0, 40).join("\n"));
  if (!table.length) return { category: null, confidence: 0, reason: "Empty file", alternatives: [], format: "csv" };
  const scored = CSV_CATEGORIES.map((c) => {
    const headers = resolveHeader(table, c).header;
    const name = NAME_HINTS[c].test(lower.replace(/\.[a-z0-9]+$/, "")) ? 0.2 : 0;
    return { category: c as DocCategory, raw: headerScore(headers, c) + name };
  }).sort((a, b) => b.raw - a.raw);
  const best = scored[0];
  const second = scored[1];
  const margin = best.raw - (second?.raw ?? 0);
  const confidence = Math.round(Math.min(99, Math.max(0, best.raw * 80 + margin * 40)));
  if (best.raw < 0.35) return { category: null, confidence, reason: "Columns not recognised: match them by hand", alternatives: scored.slice(0, 3).map((s) => ({ category: s.category, confidence: Math.round(s.raw * 80) })), format: "csv" };
  return {
    category: best.category,
    confidence,
    reason: NAME_HINTS[best.category as CsvCategory].test(lower) ? "Column headers and file name" : "Column headers",
    alternatives: scored.slice(1, 3).filter((s) => s.raw > 0.3).map((s) => ({ category: s.category, confidence: Math.round(s.raw * 80) })),
    format: "csv",
  };
}

const MONTHS: Array<[RegExp, number]> = [
  [/jan(uary)?|يناير/i, 1], [/feb(ruary)?|فبراير/i, 2], [/mar(ch)?|مارس/i, 3], [/apr(il)?|أبريل|ابريل/i, 4], [/may|مايو/i, 5], [/jun(e)?|يونيو/i, 6],
  [/jul(y)?|يوليو/i, 7], [/aug(ust)?|أغسطس|اغسطس/i, 8], [/sep(t(ember)?)?|سبتمبر/i, 9], [/oct(ober)?|أكتوبر|اكتوبر/i, 10], [/nov(ember)?|نوفمبر/i, 11], [/dec(ember)?|ديسمبر/i, 12],
];

/** Month a file is for, from names like "TB 2025-03.csv", "tb_202503", "TB March 2025" or "ميزان مارس ٢٠٢٥". */
export function monthFromName(fileName: string): { label: string; end: string } | null {
  const s = fileName.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  let y: number | null = null;
  let m: number | null = null;
  const iso = s.match(/(20\d{2})[-_. ]?(0[1-9]|1[0-2])(?!\d)/);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
  } else {
    const yr = s.match(/20\d{2}/);
    const mon = MONTHS.find(([re]) => re.test(s.replace(/\.[a-z0-9]+$/i, "")));
    if (yr && mon) {
      y = Number(yr[0]);
      m = mon[1];
    }
  }
  if (!y || !m) return null;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { label: `${y}-${String(m).padStart(2, "0")}`, end };
}
