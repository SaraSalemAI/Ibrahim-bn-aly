import * as CFB from "cfb";
import { strFromU8, unzipSync } from "fflate";
import { BUILTIN_DATE_FORMATS, csvCell, gridToSheet, isDateFormatCode, serialToIso, type Sheet } from "./xlsx";

/**
 * Readers for every spreadsheet-like format finance teams export, all running in the browser:
 * legacy Excel 97-2003 (.xls, BIFF8), OpenDocument (.ods), Excel 2003 XML (SpreadsheetML),
 * HTML tables saved as .xls (common in ERP exports), Word tables (.docx), dBase (.dbf), JSON
 * record arrays and fixed-width text reports. Each returns sheets as CSV text for the importers.
 */

const decodeXml = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name.replace(":", "\\:")}="([^"]*)"`))?.[1];

// ------------------------------------------------------------- Excel 97-2003 (BIFF8)

class Records {
  constructor(private data: Uint8Array) {}
  *[Symbol.iterator](): Generator<{ type: number; body: Uint8Array; offset: number }> {
    let p = 0;
    while (p + 4 <= this.data.length) {
      const type = this.data[p] | (this.data[p + 1] << 8);
      const len = this.data[p + 2] | (this.data[p + 3] << 8);
      yield { type, body: this.data.subarray(p + 4, p + 4 + len), offset: p };
      p += 4 + len;
    }
  }
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const f64 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset + o, 8).getFloat64(0, true);

function rk(v: number): number {
  const div = v & 1;
  let n: number;
  if (v & 2) n = (v | 0) >> 2;
  else {
    const buf = new DataView(new ArrayBuffer(8));
    buf.setUint32(4, v & 0xfffffffc, true);
    buf.setUint32(0, 0, true);
    n = buf.getFloat64(0, true);
  }
  return div ? n / 100 : n;
}

/** Reads strings that may be split across CONTINUE records, where each continuation restarts with an option byte. */
class StringReader {
  pos = 0;
  constructor(
    private data: Uint8Array,
    private bounds: number[],
  ) {}
  private atBound() {
    return this.bounds.includes(this.pos);
  }
  u8() {
    return this.data[this.pos++];
  }
  u16() {
    const v = u16(this.data, this.pos);
    this.pos += 2;
    return v;
  }
  u32() {
    const v = u32(this.data, this.pos);
    this.pos += 4;
    return v;
  }
  unicode(cch: number, flags: number): string {
    let high = flags & 1;
    let out = "";
    for (let i = 0; i < cch; i++) {
      if (this.atBound()) high = this.u8() & 1;
      if (high) {
        out += String.fromCharCode(u16(this.data, this.pos));
        this.pos += 2;
      } else out += String.fromCharCode(this.data[this.pos++]);
    }
    return out;
  }
  /** XLUnicodeRichExtendedString (SST entries). */
  rich(): string {
    const cch = this.u16();
    const flags = this.u8();
    const runs = flags & 8 ? this.u16() : 0;
    const ext = flags & 4 ? this.u32() : 0;
    const s = this.unicode(cch, flags);
    this.pos += runs * 4 + ext;
    return s;
  }
}

function xlUnicode(b: Uint8Array, o: number, short = false): string {
  const cch = short ? b[o] : u16(b, o);
  const flags = b[o + (short ? 1 : 2)];
  let p = o + (short ? 2 : 3);
  let s = "";
  for (let i = 0; i < cch; i++) {
    if (flags & 1) {
      s += String.fromCharCode(u16(b, p));
      p += 2;
    } else s += String.fromCharCode(b[p++]);
  }
  return s;
}

export function readXls(bytes: Uint8Array): Sheet[] {
  let container: CFB.CFB$Container;
  try {
    container = CFB.read(bytes, { type: "array" });
  } catch {
    throw new Error("This .xls file could not be opened. Save it as .xlsx or CSV and try again.");
  }
  const entry = CFB.find(container, "Workbook") ?? CFB.find(container, "Book");
  if (!entry?.content) throw new Error("No workbook stream found in this .xls file.");
  const data = entry.content instanceof Uint8Array ? entry.content : Uint8Array.from(entry.content as ArrayLike<number>);
  if (!CFB.find(container, "Workbook")) throw new Error("This .xls uses the Excel 5/95 format. Save it as .xlsx or CSV and try again.");

  const sst: string[] = [];
  const xfFormat: number[] = [];
  const formats = new Map<number, string>();
  const sheets: Array<{ name: string; pos: number }> = [];
  let date1904 = false;

  // Workbook globals: shared strings (with CONTINUE records), cell formats, sheet directory.
  const recs = [...new Records(data)];
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (r.type === 0x000a) break;
    if (r.type === 0x0085) {
      if (r.body[5] === 0) sheets.push({ name: xlUnicode(r.body, 6, true), pos: u32(r.body, 0) });
    } else if (r.type === 0x00e0) xfFormat.push(u16(r.body, 2));
    else if (r.type === 0x041e) formats.set(u16(r.body, 0), xlUnicode(r.body, 2));
    else if (r.type === 0x0022) date1904 = u16(r.body, 0) === 1;
    else if (r.type === 0x00fc) {
      const parts = [r.body];
      while (recs[i + 1]?.type === 0x003c) parts.push(recs[++i].body);
      const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
      const bounds: number[] = [];
      let off = 0;
      parts.forEach((p, k) => {
        if (k) bounds.push(off);
        all.set(p, off);
        off += p.length;
      });
      const sr = new StringReader(all, bounds);
      sr.pos = 8;
      const unique = u32(all, 4);
      for (let k = 0; k < unique && sr.pos < all.length; k++) sst.push(sr.rich());
    }
  }

  const isDate = (ixfe: number) => {
    const f = xfFormat[ixfe];
    return f !== undefined && (BUILTIN_DATE_FORMATS.has(f) || (formats.has(f) && isDateFormatCode(formats.get(f)!)));
  };
  const num = (v: number, ixfe: number) => (isDate(ixfe) && v > 0 ? serialToIso(date1904 ? v + 1462 : v) : String(Math.round(v * 1e6) / 1e6));

  return sheets
    .map(({ name, pos }) => {
      const grid: string[][] = [];
      const set = (row: number, col: number, v: string) => {
        (grid[row] ??= [])[col] = v;
      };
      let pendingFormula: [number, number] | null = null;
      for (const r of new Records(data.subarray(pos))) {
        const b = r.body;
        if (r.type === 0x000a) break;
        switch (r.type) {
          case 0x00fd:
            set(u16(b, 0), u16(b, 2), sst[u32(b, 6)] ?? "");
            break;
          case 0x0203:
            set(u16(b, 0), u16(b, 2), num(f64(b, 6), u16(b, 4)));
            break;
          case 0x027e:
            set(u16(b, 0), u16(b, 2), num(rk(u32(b, 6)), u16(b, 4)));
            break;
          case 0x00bd: {
            const row = u16(b, 0);
            const first = u16(b, 2);
            const n = (b.length - 6) / 6;
            for (let k = 0; k < n; k++) set(row, first + k, num(rk(u32(b, 4 + k * 6 + 2)), u16(b, 4 + k * 6)));
            break;
          }
          case 0x0204:
            set(u16(b, 0), u16(b, 2), xlUnicode(b, 6));
            break;
          case 0x0205:
            set(u16(b, 0), u16(b, 2), b[7] ? "" : b[6] ? "TRUE" : "FALSE");
            break;
          case 0x0006: {
            const row = u16(b, 0);
            const col = u16(b, 2);
            if (b[12] === 0xff && b[13] === 0xff) {
              if (b[6] === 0) pendingFormula = [row, col];
              else if (b[6] === 1) set(row, col, b[8] ? "TRUE" : "FALSE");
            } else set(row, col, num(f64(b, 6), u16(b, 4)));
            break;
          }
          case 0x0207:
            if (pendingFormula) set(pendingFormula[0], pendingFormula[1], xlUnicode(b, 0));
            pendingFormula = null;
            break;
        }
      }
      return gridToSheet(name, grid);
    })
    .filter((s) => s.rows > 0);
}

// ------------------------------------------------------------------ OpenDocument

export function readOds(bytes: Uint8Array): Sheet[] {
  let xml: string;
  try {
    xml = strFromU8(unzipSync(bytes, { filter: (f) => f.name === "content.xml" })["content.xml"]);
  } catch {
    throw new Error("This .ods file could not be opened.");
  }
  const sheets: Sheet[] = [];
  for (const t of xml.matchAll(/<table:table\b([^>]*)>([\s\S]*?)<\/table:table>/g)) {
    const grid: string[][] = [];
    for (const row of t[2].matchAll(/<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g)) {
      const cells: string[] = [];
      for (const c of (row[2] ?? "").matchAll(/<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g)) {
        const a = c[1];
        const type = attr(a, "office:value-type");
        let v = type === "date" ? (attr(a, "office:date-value") ?? "").slice(0, 10) : type && type !== "string" ? (attr(a, "office:value") ?? attr(a, "office:boolean-value") ?? "") : "";
        if (!v) v = [...(c[2] ?? "").matchAll(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g)].map((m) => decodeXml(m[1])).join(" ");
        const rep = Math.min(Number(attr(a, "table:number-columns-repeated") ?? 1), v ? 1000 : 1);
        for (let k = 0; k < rep; k++) cells.push(v);
      }
      const rep = Math.min(Number(attr(row[1], "table:number-rows-repeated") ?? 1), cells.some(Boolean) ? 1000 : 1);
      for (let k = 0; k < rep; k++) grid.push(cells);
    }
    sheets.push(gridToSheet(decodeXml(attr(t[1], "table:name") ?? `Sheet${sheets.length + 1}`), grid));
  }
  return sheets.filter((s) => s.rows > 0);
}

// -------------------------------------------------------- Excel 2003 XML (SpreadsheetML)

export const isSpreadsheetMl = (text: string) => /urn:schemas-microsoft-com:office:spreadsheet/.test(text.slice(0, 3000));

export function readSpreadsheetMl(text: string): Sheet[] {
  const sheets: Sheet[] = [];
  for (const ws of text.matchAll(/<(?:ss:)?Worksheet\b([^>]*)>([\s\S]*?)<\/(?:ss:)?Worksheet>/g)) {
    const grid: string[][] = [];
    let r = 0;
    for (const row of ws[2].matchAll(/<(?:ss:)?Row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Row>)/g)) {
      const ri = attr(row[1], "ss:Index");
      if (ri) r = Number(ri) - 1;
      const cells: string[] = [];
      let c = 0;
      for (const cell of (row[2] ?? "").matchAll(/<(?:ss:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Cell>)/g)) {
        const ci = attr(cell[1], "ss:Index");
        if (ci) c = Number(ci) - 1;
        const data = (cell[2] ?? "").match(/<(?:ss:)?Data\b([^>]*)>([\s\S]*?)<\/(?:ss:)?Data>/);
        const type = data ? attr(data[1], "ss:Type") : undefined;
        const v = data ? decodeXml(data[2]) : "";
        cells[c] = type === "DateTime" ? v.slice(0, 10) : v;
        c += 1 + Number(attr(cell[1], "ss:MergeAcross") ?? 0);
      }
      grid[r++] = Array.from(cells, (x) => x ?? "");
    }
    sheets.push(gridToSheet(decodeXml(attr(ws[1], "ss:Name") ?? `Sheet${sheets.length + 1}`), grid));
  }
  return sheets.filter((s) => s.rows > 0);
}

// ----------------------------------------------------------------- HTML tables

export const isHtmlTable = (text: string) => /<table\b/i.test(text.slice(0, 200000)) && /<(html|table|meta)\b/i.test(text.slice(0, 5000));

/** HTML tables: what many ERPs actually write into files they name .xls. */
export function readHtmlTables(text: string): Sheet[] {
  return [...text.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((t, i) => {
      const grid = [...t[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((tr) => {
        const row: string[] = [];
        for (const td of tr[1].matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
          row.push(decodeXml(td[3]));
          const span = Number(td[2].match(/colspan\s*=\s*"?(\d+)/i)?.[1] ?? 1);
          for (let k = 1; k < Math.min(span, 50); k++) row.push("");
        }
        return row;
      });
      return gridToSheet(`Table ${i + 1}`, grid);
    })
    .filter((s) => s.rows > 1);
}

// ------------------------------------------------------------------ Word tables

export function readDocxTables(bytes: Uint8Array): Sheet[] {
  let xml: string;
  try {
    xml = strFromU8(unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" })["word/document.xml"]);
  } catch {
    throw new Error("This .docx file could not be opened.");
  }
  return [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)]
    .map((t, i) => {
      const grid = [...t[1].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)].map((tr) =>
        [...tr[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((tc) => [...tc[1].matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("").trim()),
      );
      return gridToSheet(`Table ${i + 1}`, grid);
    })
    .filter((s) => s.rows > 1);
}

// --------------------------------------------------------------------- dBase

/** dBase III/IV/FoxPro .dbf, still produced by older Egyptian accounting packages. Text is UTF-8 or Windows-1256. */
export function readDbf(bytes: Uint8Array, name = "Table"): Sheet[] {
  if (bytes.length < 33) throw new Error("This .dbf file is empty.");
  const records = u32(bytes, 4);
  const headerLen = u16(bytes, 8);
  const recordLen = u16(bytes, 10);
  const fields: Array<{ name: string; type: string; len: number }> = [];
  for (let p = 32; p + 32 <= headerLen && bytes[p] !== 0x0d; p += 32) {
    const raw = bytes.subarray(p, p + 11);
    fields.push({ name: new TextDecoder("latin1").decode(raw.subarray(0, raw.indexOf(0) >= 0 ? raw.indexOf(0) : 11)).trim(), type: String.fromCharCode(bytes[p + 11]), len: bytes[p + 16] });
  }
  if (!fields.length) throw new Error("No fields found in this .dbf file.");
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  const ar = new TextDecoder("windows-1256");
  const text = (b: Uint8Array) => {
    try {
      return utf8.decode(b);
    } catch {
      return ar.decode(b);
    }
  };
  const grid: string[][] = [fields.map((f) => f.name.toLowerCase())];
  for (let r = 0; r < records; r++) {
    const start = headerLen + r * recordLen;
    if (start + recordLen > bytes.length) break;
    if (bytes[start] === 0x2a) continue;
    let p = start + 1;
    grid.push(
      fields.map((f) => {
        const v = text(bytes.subarray(p, p + f.len)).trim();
        p += f.len;
        if (f.type === "D" && /^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
        if (f.type === "L") return /^[YyTt]/.test(v) ? "TRUE" : /^[NnFf]/.test(v) ? "FALSE" : "";
        return v;
      }),
    );
  }
  return [gridToSheet(name, grid)];
}

// ------------------------------------------------------------- JSON and text

/** An array of flat records (directly, or under data/rows/records/items) becomes a table. */
export function jsonTable(text: string): Sheet | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const obj = data as Record<string, unknown>;
  const list = Array.isArray(data) ? data : (["data", "rows", "records", "items", "result", "value"].map((k) => obj?.[k]).find(Array.isArray) as unknown[] | undefined);
  if (!list?.length || typeof list[0] !== "object" || list[0] === null) return null;
  const keys = [...new Set(list.flatMap((r) => Object.keys(r as object)))].filter((k) => list.some((r) => { const v = (r as Record<string, unknown>)[k]; return v === null || (v !== undefined && typeof v !== "object"); }));
  const grid = [keys, ...list.map((r) => keys.map((k) => { const v = (r as Record<string, unknown>)[k]; return v === null || v === undefined || typeof v === "object" ? "" : String(v); }))];
  return gridToSheet("Records", grid);
}

/**
 * Fixed-width text reports (printed trial balances, .prn files, text pulled out of PDFs): columns are
 * separated by runs of two or more spaces. Returns null when the text already has a delimiter.
 */
export function fixedWidthToCsv(text: string): string | null {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const sample = lines.filter((l) => l.trim()).slice(0, 30);
  if (!sample.length) return null;
  // Delimited text has the same number of separators on most lines; thousands separators ("1,000") do not.
  const delimited = [",", ";", "\t", "|"].some((d) => {
    const counts = sample.map((l) => l.split(d).length - 1);
    const top = counts.filter((n) => n > 0).sort((a, b) => counts.filter((x) => x === b).length - counts.filter((x) => x === a).length)[0];
    return top !== undefined && counts.filter((n) => n === top).length / sample.length >= 0.8;
  });
  const spaced = sample.filter((l) => /\S\s{2,}\S/.test(l)).length / sample.length;
  if (delimited || spaced < 0.5) return null;
  return lines.map((l) => (l.trim() ? l.trim().split(/\s{2,}/).map(csvCell).join(",") : "")).join("\n") + "\n";
}

/** Pipe-separated text (some ERPs and most Markdown tables). */
export function pipeToCsv(text: string): string | null {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  if (sample.length < 2 || sample.filter((l) => (l.match(/\|/g) ?? []).length >= 2).length / sample.length < 0.7) return null;
  return (
    text
      .split(/\r?\n/)
      .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l))
      .map((l) => (l.trim() ? l.trim().replace(/^\||\|$/g, "").split("|").map((c) => csvCell(c.trim())).join(",") : ""))
      .join("\n") + "\n"
  );
}

// ---------------------------------------------------------------- multi-table

/**
 * Splits a sheet holding several tables (separated by blank rows) into one sheet per table, so a
 * workbook with "Trial balance" and "Aging" stacked on one sheet imports as two files. Title blocks
 * of a single row stay attached to the table below them.
 */
export function splitTables(sheet: Sheet): Sheet[] {
  const lines = sheet.csv.split("\n");
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (l.replace(/[,"\s]/g, "") === "") {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) blocks.push(cur);
  // Attach one- or two-line title blocks to the next block.
  const merged: string[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].length <= 2 && i + 1 < blocks.length) blocks[i + 1] = [...blocks[i], ...blocks[i + 1]];
    else merged.push(blocks[i]);
  }
  const tables = merged.filter((b) => b.length >= 3);
  if (tables.length <= 1) return [sheet];
  return tables.map((b, i) => ({ name: `${sheet.name} · table ${i + 1}`, csv: b.join("\n") + "\n", rows: b.length }));
}
