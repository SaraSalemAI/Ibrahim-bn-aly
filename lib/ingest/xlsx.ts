import { strFromU8, unzipSync } from "fflate";

/**
 * Minimal .xlsx reader that runs in the browser and on the server. It reads cell values (shared,
 * inline and plain strings, numbers, booleans) and turns date-formatted serial numbers into
 * YYYY-MM-DD, which is all the importers need. Formulas are read as their cached values.
 */
export interface Sheet {
  name: string;
  csv: string;
  rows: number;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

/** Text of every <t> inside a fragment (rich text runs are concatenated). */
const texts = (xml: string) => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

function dateStyles(stylesXml: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!stylesXml) return out;
  const custom = new Map<number, string>();
  for (const m of stylesXml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(m[0], "numFmtId"));
    custom.set(id, decode(attr(m[0], "formatCode") ?? ""));
  }
  const xfs = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  [...xfs.matchAll(/<xf\b[^>]*\/?>/g)].forEach((m, i) => {
    const id = Number(attr(m[0], "numFmtId") ?? 0);
    const code = custom.get(id);
    // A custom format is a date when it has day/month/year tokens outside quoted text.
    const isDate = BUILTIN_DATE_FORMATS.has(id) || (code !== undefined && /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, "")) && !/0\.0|#/.test(code));
    if (isDate) out.add(i);
  });
  return out;
}

/** Excel serial (1900 date system) to ISO date. */
export function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function readXlsx(bytes: Uint8Array): Sheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name.startsWith("xl/") });
  } catch {
    throw new Error("This file is not a valid .xlsx workbook. Older .xls files must be saved as .xlsx or CSV first.");
  }
  const text = (p: string) => (files[p] ? strFromU8(files[p]) : undefined);
  const workbook = text("xl/workbook.xml");
  if (!workbook) throw new Error("This file is not a valid .xlsx workbook.");
  const rels = text("xl/_rels/workbook.xml.rels") ?? "";
  const target = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    let t = attr(m[0], "Target") ?? "";
    t = t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`;
    if (id) target.set(id, t);
  }
  const shared = [...(text("xl/sharedStrings.xml") ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const dates = dateStyles(text("xl/styles.xml"));

  const sheets: Sheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = decode(attr(m[0], "name") ?? `Sheet${sheets.length + 1}`);
    const rid = attr(m[0], "r:id") ?? m[0].match(/\bid="([^"]*)"/)?.[1];
    const path = (rid && target.get(rid)) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
    const xml = text(path);
    if (!xml) continue;
    const grid: string[][] = [];
    for (const row of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const r = Number(attr(row[1], "r") ?? grid.length + 1) - 1;
      const cells: string[] = [];
      for (const c of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = c[1];
        const body = c[2] ?? "";
        const ref = attr(a, "r");
        const idx = ref ? colIndex(ref) : cells.length;
        const t = attr(a, "t");
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let value = "";
        if (t === "s") value = shared[Number(v)] ?? "";
        else if (t === "inlineStr") value = texts(body);
        else if (t === "b") value = v === "1" ? "TRUE" : "FALSE";
        else if (t === "str" || t === "e") value = decode(v ?? "");
        else if (v !== undefined) {
          const num = Number(v);
          const style = Number(attr(a, "s") ?? -1);
          value = dates.has(style) && Number.isFinite(num) && num > 0 ? serialToIso(num) : v;
        }
        cells[idx] = value;
      }
      grid[r] = Array.from(cells, (x) => x ?? "");
    }
    const width = Math.max(0, ...grid.filter(Boolean).map((r) => r.length));
    const lines = grid
      .filter((r) => r && r.some((x) => x.trim() !== ""))
      .map((r) => Array.from({ length: width }, (_, i) => csvCell(r[i] ?? "")).join(","));
    sheets.push({ name, csv: lines.join("\n") + "\n", rows: lines.length });
  }
  return sheets.filter((s) => s.rows > 0);
}
