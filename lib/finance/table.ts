import { parseAmount, parseCsv } from "./parse";
import type { Issue } from "./types";

export type FieldType = "string" | "number" | "date" | "bool";
export interface FieldSpec {
  aliases: string[];
  type: FieldType;
  required?: boolean;
}

export interface TableResult<T> {
  records: T[];
  issues: Issue[];
  preview: string[][];
}

/** Normalises dates written as YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY (Egyptian convention) to ISO. */
export function parseDate(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export function readTable<T>(text: string, spec: Record<keyof T & string, FieldSpec>): TableResult<T> {
  const table = parseCsv(text);
  if (table.length < 2) return { records: [], issues: [{ level: "error", code: "emptyFile" }], preview: [] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col: Record<string, number> = {};
  const missing: string[] = [];
  for (const [field, fs] of Object.entries(spec) as [string, FieldSpec][]) {
    const idx = header.findIndex((h) => fs.aliases.includes(h) || h === field.toLowerCase());
    if (idx >= 0) col[field] = idx;
    else if (fs.required) missing.push(field);
  }
  if (missing.length) {
    return { records: [], issues: [{ level: "error", code: "missingFields", params: { fields: missing.join(", ") } }], preview: table.slice(0, 26) };
  }
  const issues: Issue[] = [];
  const records: T[] = [];
  table.slice(1).forEach((cells, i) => {
    const row = i + 2;
    const rec: Record<string, unknown> = {};
    for (const [field, fs] of Object.entries(spec) as [string, FieldSpec][]) {
      const raw = col[field] === undefined ? undefined : cells[col[field]];
      if (fs.type === "number") {
        const n = parseAmount(raw);
        if (n === null) {
          issues.push({ level: "error", code: "badAmount", params: { row, column: field } });
          return;
        }
        rec[field] = n;
      } else if (fs.type === "date") {
        const d = parseDate(raw);
        if (d === null && (fs.required || (raw ?? "").trim() !== "")) {
          issues.push({ level: "error", code: "badDate", params: { row, column: field } });
          return;
        }
        rec[field] = d;
      } else if (fs.type === "bool") {
        rec[field] = /^(y|yes|true|1|نعم)$/i.test((raw ?? "").trim());
      } else {
        rec[field] = (raw ?? "").trim();
      }
    }
    rec.sourceRow = row;
    records.push(rec as T);
  });
  return { records, issues, preview: table.slice(0, 26) };
}
