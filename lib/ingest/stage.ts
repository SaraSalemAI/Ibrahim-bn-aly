import { csvChunks, parseGl, type GlLine } from "../finance/gl";
import { sha256Bytes } from "../finance/hash";
import { parseCsv, parseTrialBalance } from "../finance/parse";
import * as SL from "../finance/subledgers";
import type { DocCategory, Issue, SourceDoc, TBRow } from "../finance/types";
import type { Company } from "../workspace/types";
import { bankLinesToCsv, parseMt940, parseOfx } from "./bankFormats";
import { detectFile, monthFromName, type Detection } from "./detect";
import { normaliseTable, type CsvCategory, type Erp } from "./erp";
import { readXlsx } from "./xlsx";
import { unzipArchive } from "./zip";

export type SubKey = "ar" | "ap" | "far" | "inventory" | "payroll" | "bank";
export type StagedData =
  | { kind: "tb"; rows: TBRow[] }
  | { kind: "gl"; lines: GlLine[] }
  | { kind: "sub"; key: SubKey; records: Array<{ sourceRow: number }> }
  | { kind: "eta"; docs: SL.EtaDocument[] };

export type TbRole = "current" | "prior" | "monthly";

/** One importable unit: a file, or one sheet of a workbook, or one file inside a .zip. */
export interface Unit {
  id: string;
  fileName: string;
  sheet?: string;
  text: string | null;
  bytes: Uint8Array;
  sha256: string;
  encoding: string;
  detection: Detection;
  month: { label: string; end: string } | null;
}

export interface Staged {
  category: DocCategory;
  fileName: string;
  sheet?: string;
  sha256: string;
  encoding: string;
  format: string;
  erp: Erp | null;
  derived: string[];
  skippedTitleRows: number;
  headers: string[];
  rowCount: number;
  issues: Issue[];
  preview: string[][];
  data: StagedData;
  dateRange: { from: string; to: string } | null;
  currencies: string[];
  /** Rows that repeat another row of the same file on the fields that identify them. */
  duplicateKeys: string[];
}

export function decodeText(bytes: Uint8Array): { text: string; encoding: string } {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  // Arabic exports from older Windows ERPs are often Windows-1256 rather than UTF-8.
  if (utf8.includes("�")) return { text: new TextDecoder("windows-1256").decode(bytes), encoding: "windows-1256" };
  return { text: utf8, encoding: "utf-8" };
}

const TEXT_EXT = /\.(csv|txt|tsv|json|xml|sta|mt940|940|ofx|qfx)$/i;
let counter = 0;
const unitId = () => `u${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Expands dropped files into importable units: .zip archives are unpacked and every workbook sheet becomes its own unit. */
export function expandFiles(files: Array<{ name: string; bytes: Uint8Array }>): { units: Unit[]; errors: string[] } {
  const units: Unit[] = [];
  const errors: string[] = [];
  const add = (name: string, bytes: Uint8Array) => {
    try {
      if (/\.zip$/i.test(name)) {
        for (const e of unzipArchive(bytes)) add(e.name, e.bytes);
      } else if (/\.xlsx$/i.test(name)) {
        const sheets = readXlsx(bytes);
        if (!sheets.length) errors.push(`${name}: the workbook has no data`);
        for (const sh of sheets) {
          const sheetName = sheets.length > 1 ? sh.name : undefined;
          const label = sheetName ? `${name} › ${sh.name}` : name;
          units.push({
            id: unitId(),
            fileName: name,
            sheet: sheetName,
            text: sh.csv,
            bytes,
            sha256: sha256Bytes(new TextEncoder().encode(sh.csv)),
            encoding: "xlsx",
            detection: detectFile(sheetName ? `${sh.name} ${name}` : name, sh.csv),
            month: monthFromName(label),
          });
        }
      } else if (/\.xls$/i.test(name)) {
        errors.push(`${name}: old .xls format; save it as .xlsx or CSV`);
      } else {
        const textual = TEXT_EXT.test(name) || !/\.[a-z0-9]{2,5}$/i.test(name);
        const decoded = textual ? decodeText(bytes) : null;
        units.push({
          id: unitId(),
          fileName: name,
          text: decoded?.text ?? null,
          bytes,
          sha256: sha256Bytes(bytes),
          encoding: decoded?.encoding ?? "binary",
          detection: detectFile(name, decoded?.text ?? null),
          month: monthFromName(name),
        });
      }
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  };
  for (const f of files) add(f.name, f.bytes);
  return { units, errors };
}

const PARSERS = {
  AR_SUBLEDGER: [SL.parseAr, "ar"],
  AP_SUBLEDGER: [SL.parseAp, "ap"],
  FIXED_ASSETS: [SL.parseFar, "far"],
  INVENTORY: [SL.parseInventory, "inventory"],
  PAYROLL: [SL.parsePayroll, "payroll"],
  BANK_STATEMENT: [SL.parseBank, "bank"],
} as const;

function range(dates: Array<string | null | undefined>): { from: string; to: string } | null {
  const ds = dates.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d)).sort();
  return ds.length ? { from: ds[0], to: ds[ds.length - 1] } : null;
}

function duplicates<T>(items: T[], key: (t: T) => string): string[] {
  const seen = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k.replace(/\|/g, "")) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

/** Parses one unit as the given category. Bank files in MT940/OFX are converted first; CSV exports get the ERP presets and saved column matches. */
export async function stageUnit(unit: Unit, category: DocCategory, opts: { columnMap?: Record<string, string>; onProgress?: (p: number) => void } = {}): Promise<Staged> {
  if (unit.text === null) throw new Error("This file type needs text recognition (OCR) before it can be imported.");
  let text = unit.text;
  let format = unit.detection.format;
  if (category === "BANK_STATEMENT" && format === "mt940") text = bankLinesToCsv(parseMt940(text).lines);
  if (category === "BANK_STATEMENT" && format === "ofx") text = bankLinesToCsv(parseOfx(text).lines);
  if (format !== "mt940" && format !== "ofx") format = category === "ETA_INVOICE" ? "eta" : "csv";

  const base = { category, fileName: unit.fileName, sheet: unit.sheet, sha256: unit.sha256, encoding: unit.encoding, format };
  if (category === "ETA_INVOICE") {
    const r = SL.parseEta(text);
    return {
      ...base,
      erp: null,
      derived: [],
      skippedTitleRows: 0,
      headers: [],
      rowCount: r.documents.length,
      issues: r.error ? [{ level: "error", code: r.error }] : [],
      preview: [["uuid", "internalId", "type", "date", "netAmount", "vat"], ...r.documents.slice(0, 25).map((d) => [d.uuid, d.internalId, d.type, d.dateIssued, String(d.netAmount), String(d.vat)])],
      data: { kind: "eta", docs: r.documents },
      dateRange: range(r.documents.map((d) => d.dateIssued)),
      currencies: [],
      duplicateKeys: duplicates(r.documents, (d) => d.uuid),
    };
  }

  const norm = normaliseTable(text, category as CsvCategory, opts.columnMap);
  const csv = norm.text;
  const meta = { ...base, erp: norm.erp, derived: norm.derived, skippedTitleRows: norm.skippedTitleRows, headers: norm.originalHeaders };
  const preview = () => [norm.originalHeaders, ...parseCsv(csv.split(/\r?\n/).slice(1, 26).join("\n"))];

  if (category === "TRIAL_BALANCE") {
    const r = parseTrialBalance(csv);
    return {
      ...meta,
      rowCount: r.rows.length,
      issues: r.issues,
      preview: preview(),
      data: { kind: "tb", rows: r.rows },
      dateRange: null,
      currencies: [...new Set(r.rows.map((x) => x.currency).filter((x): x is string => !!x))],
      duplicateKeys: duplicates(r.rows, (x) => x.code),
    };
  }
  if (category === "GENERAL_LEDGER") {
    // Large GL dumps are parsed in 5,000-row chunks, yielding to the browser between chunks.
    const lines: GlLine[] = [];
    const issues: Issue[] = [];
    const total = Math.max(1, csv.split("\n").length - 1);
    let done = 0;
    for (const chunk of csvChunks(csv, 5000)) {
      const r = parseGl(chunk);
      lines.push(...r.records.map((l) => ({ ...l, sourceRow: l.sourceRow + done })));
      issues.push(...r.issues.map((i) => ({ ...i, params: { ...i.params, row: Number(i.params?.row ?? 0) + done } })));
      done += chunk.split("\n").length - 1;
      opts.onProgress?.(Math.min(1, done / total));
      if (total > 5000) await new Promise((res) => setTimeout(res, 0));
    }
    return {
      ...meta,
      rowCount: lines.length,
      issues: issues.slice(0, 50),
      preview: preview(),
      data: { kind: "gl", lines },
      dateRange: range(lines.map((l) => l.postingDate)),
      currencies: [],
      duplicateKeys: duplicates(lines, (l) => [l.journalId, l.accountCode, l.debit, l.credit, l.postingDate, l.memo].join("|")),
    };
  }
  const [parse, key] = PARSERS[category];
  const r = parse(csv);
  const recs = r.records as unknown as Array<Record<string, unknown> & { sourceRow: number }>;
  const dateField = { ar: "invoiceDate", ap: "invoiceDate", bank: "date" }[key as string];
  const dupKey: Record<SubKey, (x: Record<string, unknown>) => string> = {
    ar: (x) => String(x.invoice),
    ap: (x) => `${x.supplier}|${x.invoice}`,
    far: (x) => String(x.tag),
    inventory: (x) => String(x.sku),
    payroll: (x) => String(x.employeeId),
    bank: (x) => `${x.date}|${x.amount}|${x.description}|${x.balance}`,
  };
  return {
    ...meta,
    rowCount: recs.length,
    issues: r.issues,
    preview: r.issues.some((i) => i.code === "missingFields") ? [norm.originalHeaders] : preview(),
    data: { kind: "sub", key, records: recs },
    dateRange: dateField ? range(recs.map((x) => x[dateField] as string)) : null,
    currencies: key === "ar" ? [...new Set(recs.map((x) => String(x.currency ?? "").toUpperCase()).filter(Boolean))] : [],
    duplicateKeys: duplicates(recs, dupKey[key]),
  };
}

/** Prior-period comparatives from a second TB: its closing balances go into the prior columns, matched by account code (or name). */
export function mergePrior(rows: TBRow[], prior: TBRow[]): TBRow[] {
  const key = (r: TBRow) => (r.code || r.name).trim().toLowerCase();
  const byKey = new Map(prior.map((p) => [key(p), p]));
  const out = rows.map((r) => {
    const p = byKey.get(key(r));
    byKey.delete(key(r));
    return { ...r, priorDebit: p ? p.currentDebit : 0, priorCredit: p ? p.currentCredit : 0 };
  });
  for (const p of byKey.values()) out.push({ ...p, priorDebit: p.currentDebit, priorCredit: p.currentCredit, currentDebit: 0, currentCredit: 0, sourceRow: p.sourceRow });
  return out;
}

export function docRecord(s: Staged, id: string, role?: TbRole, month?: string): SourceDoc {
  return {
    id,
    fileName: s.fileName,
    sha256: s.sha256,
    category: s.category,
    rowCount: s.rowCount,
    encoding: s.encoding,
    uploadedAt: new Date().toISOString(),
    ...(role && s.category === "TRIAL_BALANCE" ? { role } : {}),
    ...(month ? { month } : {}),
    ...(s.sheet ? { sheet: s.sheet } : {}),
    ...(s.erp ? { erp: s.erp } : {}),
    format: s.format,
  };
}

/** Loads a staged file into the company. A new current trial balance resets mapping confirmation and the period to draft. */
export function applyStaged(c: Company, s: Staged, docId: string, role: TbRole = "current", month?: { label: string; end: string } | null): Company {
  const doc = docRecord(s, docId, role, role === "monthly" ? month?.label : undefined);
  const sameSlot = (d: SourceDoc) => d.category === s.category && (d.role ?? "current") === (s.category === "TRIAL_BALANCE" ? role : "current") && (role !== "monthly" || d.month === month?.label);
  const docs = [...c.docs.filter((d) => !sameSlot(d)), doc];
  const d = s.data;
  switch (d.kind) {
    case "tb": {
      if (role === "prior") return { ...c, docs, rows: c.rows.length ? mergePrior(c.rows, d.rows.map((r) => ({ ...r, sourceDocId: docId }))) : d.rows.map((r) => ({ ...r, priorDebit: r.currentDebit, priorCredit: r.currentCredit, currentDebit: 0, currentCredit: 0, sourceDocId: docId })) };
      if (role === "monthly") {
        const label = month?.label ?? s.fileName;
        const entry = { id: docId, label, end: month?.end ?? c.period.end, rows: d.rows.map((r) => ({ ...r, sourceDocId: docId })), docId };
        return { ...c, docs, monthly: [...c.monthly.filter((m) => m.label !== label), entry].sort((a, b) => a.label.localeCompare(b.label)) };
      }
      // Comparatives already held (a prior-period file, or balances carried by a roll-forward).
      const priorRows = c.rows.filter((r) => r.priorDebit || r.priorCredit);
      let rows: TBRow[] = d.rows.map((r) => ({ ...r, sourceDocId: docId }));
      // Keep separately loaded comparatives when the new file has none of its own.
      if (priorRows.length && !rows.some((r) => r.priorDebit || r.priorCredit)) rows = mergePrior(rows, priorRows.map((r) => ({ ...r, currentDebit: r.priorDebit, currentCredit: r.priorCredit })));
      return { ...c, docs, rows, period: { ...c.period, mappingConfirmed: false, status: "DRAFT" } };
    }
    case "gl":
      return { ...c, docs, subledgers: { ...c.subledgers, gl: d.lines } };
    case "eta":
      return { ...c, docs, subledgers: { ...c.subledgers, eta: d.docs } };
    case "sub":
      return { ...c, docs, subledgers: { ...c.subledgers, [d.key]: d.records } };
  }
}
