import { DATASETS, DATASET_BY_TYPE } from './schema';
import type { Cell, DatasetType, SourceRow, SourceTable } from './types';
import { norm } from './values';

/** Locate the header row: the first row (within the first 20) with the most non-empty text cells. */
export function detectHeaderRow(grid: Cell[][]): number {
  let best = 0, bestScore = -1;
  const limit = Math.min(grid.length, 20);
  for (let i = 0; i < limit; i++) {
    const row = grid[i] ?? [];
    const texts = row.filter((c) => typeof c === 'string' && c.trim() && Number.isNaN(Number(c))).length;
    const filled = row.filter((c) => c !== null && c !== '').length;
    const score = texts * 2 + filled * 0.1;
    if (texts >= 2 && score > bestScore) { best = i; bestScore = score; }
  }
  return best;
}

function synonymScore(header: string, syn: string): number {
  const h = norm(header), s = norm(syn);
  if (!h || !s) return 0;
  if (h === s) return 3;
  if (h.split(' ').join('') === s.split(' ').join('')) return 3;
  // whole-word containment for multi-word synonyms
  if (s.length > 3 && (` ${h} `).includes(` ${s} `)) return 2;
  return 0;
}

/** Map headers to canonical fields of a dataset type. Each header is used at most once; best matches win. */
export function mapFields(type: DatasetType, headers: string[]): Record<string, string> {
  return mapFieldsScored(type, headers).mapping;
}

/** Mapping plus the summed match quality (exact matches score higher than containment matches). */
export function mapFieldsScored(type: DatasetType, headers: string[]): { mapping: Record<string, string>; quality: number } {
  const def = DATASET_BY_TYPE[type];
  if (!def) return { mapping: {}, quality: 0 };
  const cands: { field: string; header: string; score: number; order: number }[] = [];
  def.fields.forEach((fd, fi) => {
    for (const h of headers) {
      let best = 0;
      fd.syn.forEach((s, si) => {
        const sc = synonymScore(h, s);
        // earlier synonyms are more specific
        if (sc) best = Math.max(best, sc + (fd.syn.length - si) / (fd.syn.length * 10));
      });
      if (best) cands.push({ field: fd.key, header: h, score: best, order: fi });
    }
  });
  cands.sort((a, b) => b.score - a.score || a.order - b.order);
  const used = new Set<string>(), out: Record<string, string> = {};
  let quality = 0;
  for (const c of cands) {
    if (out[c.field] || used.has(c.header)) continue;
    out[c.field] = c.header; used.add(c.header); quality += Math.floor(c.score);
  }
  return { mapping: out, quality };
}

const NAME_HINTS: [RegExp, DatasetType][] = [
  [/\b(gl|general ledger|journal|ledger)\b|دفتر الاستاذ|القيود/i, 'gl'],
  [/\b(tb|trial balance)\b|ميزان المراجعة/i, 'tb'],
  [/\b(ap|payable|payables|invoices? register)\b|الدائن/i, 'ap'],
  [/\b(ar|receivable|receivables)\b|المدين/i, 'ar'],
  [/\b(bank|statement)\b|بنك/i, 'bank'],
  [/\b(fixed asset|far|asset register|assets)\b|الاصول/i, 'fa'],
  [/\b(inventory|stock)\b|المخزون/i, 'inventory'],
  [/\b(procurement|purchase orders?|po register|pos)\b|المشتريات/i, 'procurement'],
  [/\b(payroll|salar)/i, 'payroll'],
  [/\b(budget)\b|الموازنة/i, 'budget'],
  [/\b(tax|vat|wht)\b|الضرائب/i, 'tax'],
  [/\b(loan|borrowing|debt)\b|القروض/i, 'loans'],
  [/\b(contract)/i, 'contracts'],
  [/\b(related part)/i, 'related'],
  [/\b(vendor master|supplier master|vendors|suppliers)\b|الموردين/i, 'vendors'],
  [/\b(chart of accounts|coa)\b|دليل الحسابات/i, 'coa'],
  [/\b(company master|entities|cost centers)\b/i, 'company'],
];

/** Classify a table by how many required/recommended fields its headers map to, plus file/sheet name hints. */
export function classify(headers: string[], hintText: string): { type: DatasetType; score: number; mapping: Record<string, string> } {
  let best: { type: DatasetType; score: number; mapping: Record<string, string> } = { type: 'unknown', score: 0, mapping: {} };
  const hint = norm(hintText);
  for (const def of DATASETS) {
    const { mapping, quality } = mapFieldsScored(def.type, headers);
    const reqHit = def.required.filter((r) => mapping[r]).length;
    const allReq = reqHit === def.required.length;
    const coverage = Object.keys(mapping).length / def.fields.length;
    let score = reqHit / def.required.length * 0.5 + coverage * 0.2 + quality * 0.02 + (allReq ? 0.2 : 0);
    if (NAME_HINTS.some(([re, t]) => t === def.type && re.test(hint))) score += 0.35;
    if (!allReq) score *= 0.5;
    if (score > best.score) best = { type: def.type, score, mapping };
  }
  if (best.score < 0.3) return { type: 'unknown', score: best.score, mapping: {} };
  return best;
}

function cellValue(c: Cell): Cell {
  if (typeof c === 'string') { const s = c.trim(); return s === '' ? null : s; }
  return c;
}

/** Build an immutable source table from a raw grid (array of rows). */
export function buildTable(fileId: string, fileName: string, sheet: string, sheetIndex: number, grid: Cell[][]): SourceTable | null {
  if (!grid.length) return null;
  const hr = detectHeaderRow(grid);
  const rawHeaders = (grid[hr] ?? []).map((c, i) => (c === null || c === '' ? `Column ${i + 1}` : String(c).trim()));
  // De-duplicate header names so each column stays addressable
  const seen: Record<string, number> = {};
  const headers = rawHeaders.map((h) => { seen[h] = (seen[h] ?? 0) + 1; return seen[h] > 1 ? `${h} (${seen[h]})` : h; });
  if (headers.length < 2) return null;
  const short = fileId.slice(0, 6).toUpperCase();
  const rows: SourceRow[] = [];
  for (let i = hr + 1; i < grid.length; i++) {
    const g = grid[i] ?? [];
    if (!g.some((c) => c !== null && c !== '' && c !== undefined)) continue;
    const values: Record<string, Cell> = {};
    headers.forEach((h, j) => { values[h] = cellValue(g[j] ?? null); });
    const rowNumber = i + 1;
    rows.push(Object.freeze({ recordId: `${short}-S${sheetIndex + 1}-R${rowNumber}`, rowNumber, values: Object.freeze(values) }));
  }
  const c = classify(headers, `${fileName} ${sheet}`);
  return {
    id: `${fileId}:${sheetIndex}`,
    fileId, fileName, sheet, sheetIndex,
    headerRow: hr + 1,
    headers,
    rows: Object.freeze(rows),
    datasetType: c.type,
    suggestedType: c.type,
    classificationScore: Math.round(c.score * 100) / 100,
    mapping: { ...c.mapping },
    suggestedMapping: { ...c.mapping },
  };
}

/** Re-map a table after the auditor changes its classification. */
export function reclassify(t: SourceTable, type: DatasetType): SourceTable {
  return { ...t, datasetType: type, mapping: mapFields(type, t.headers) };
}
