import '../polyfills';
// Browser-side file ingestion. Produces immutable SourceFile objects; original bytes are hashed (SHA-256)
// so every finding can cite the exact file version it came from.
import Papa from 'papaparse';
import { buildTable } from './classify';
import type { Cell, SourceFile, SourceTable } from './types';
import { sha256 } from './values';

export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    // Common encoding for Arabic exports from legacy ERPs
    return new TextDecoder('windows-1256').decode(buf);
  }
}

export function parseDelimited(textIn: string): Cell[][] {
  const res = Papa.parse<string[]>(textIn, { skipEmptyLines: false });
  return (res.data as unknown as string[][]).map((r) => r.map((c) => (c === undefined ? null : c)));
}

function looksDelimited(t: string): boolean {
  const lines = t.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  if (lines.length < 2) return false;
  return [',', '\t', ';', '|'].some((d) => {
    const counts = lines.map((l) => l.split(d).length - 1);
    return counts[0] >= 2 && counts.every((c) => c === counts[0]);
  });
}

type ExcelCellValue = unknown;
function excelCell(v: ExcelCellValue): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T00:00:00', '').replace('T', ' ');
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return excelCell(o.result as ExcelCellValue);
    if ('richText' in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((x) => x.text).join('');
    if ('text' in o) return String(o.text);
    if ('error' in o) return `#ERROR ${String(o.error)}`;
  }
  return String(v);
}

async function parseXlsx(buf: ArrayBuffer, fileId: string, name: string): Promise<SourceTable[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const tables: SourceTable[] = [];
  wb.worksheets.forEach((ws, idx) => {
    const grid: Cell[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const vals = row.values as ExcelCellValue[];
      grid[rowNumber - 1] = vals.slice(1).map(excelCell);
    });
    for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = [];
    const t = buildTable(fileId, name, ws.name, idx, grid);
    if (t) tables.push(t);
  });
  return tables;
}

/** Text-based PDF → lines grouped by y-coordinate, columns split on large x-gaps. */
async function parsePdf(buf: ArrayBuffer): Promise<{ text: string; grids: { page: number; grid: Cell[][] }[] }> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = '';
  const grids: { page: number; grid: Cell[][] }[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = (tc.items as { str: string; transform: number[]; width: number }[]).filter((i) => i.str?.trim());
    const lines = new Map<number, { x: number; w: number; s: string }[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({ x: it.transform[4], w: it.width, s: it.str.trim() });
    }
    const ys = [...lines.keys()].sort((a, b) => b - a);
    const grid: Cell[][] = [];
    for (const y of ys) {
      const parts = lines.get(y)!.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let last = -Infinity;
      for (const pt of parts) {
        if (pt.x - last > 12 || !cells.length) cells.push(pt.s); else cells[cells.length - 1] += ' ' + pt.s;
        last = pt.x + pt.w;
      }
      grid.push(cells);
      text += cells.join('  ') + '\n';
    }
    grids.push({ page: p, grid });
  }
  return { text, grids };
}

export async function ingestFile(file: File, user: string, periodLabel: string): Promise<SourceFile> {
  const buf = await file.arrayBuffer();
  const hash = await sha256(buf);
  const id = hash.slice(0, 12) + '-' + Date.now().toString(36);
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const base: SourceFile = {
    id, name: file.name, ext, size: file.size, sha256: hash,
    uploadedAt: new Date().toISOString(), uploadedBy: user, periodLabel,
    status: 'parsed', tables: [],
  };
  try {
    if (ext === 'csv' || ext === 'tsv') {
      const t = buildTable(id, file.name, file.name, 0, parseDelimited(decodeText(buf)));
      base.tables = t ? [t] : [];
    } else if (ext === 'xlsx' || ext === 'xlsm') {
      base.tables = await parseXlsx(buf, id, file.name);
    } else if (ext === 'xls') {
      base.status = 'unsupported';
      base.error = 'Legacy .xls (BIFF) is not supported. Re-save as .xlsx or export to CSV.';
    } else if (ext === 'txt') {
      const txt = decodeText(buf);
      if (looksDelimited(txt)) {
        const t = buildTable(id, file.name, file.name, 0, parseDelimited(txt));
        base.tables = t ? [t] : [];
      } else { base.status = 'text-only'; base.text = txt; }
    } else if (ext === 'pdf') {
      const { text, grids } = await parsePdf(buf);
      base.text = text;
      if (!text.trim()) {
        base.status = 'ocr-required';
        base.error = 'No text layer found (scanned PDF). OCR is required — upload the source export or a text-based PDF.';
      } else {
        // Combine pages into one grid; a table is accepted only if it classifies as a known dataset
        const all = grids.flatMap((g) => g.grid);
        const t = buildTable(id, file.name, 'PDF', 0, all);
        if (t && t.datasetType !== 'unknown') base.tables = [t];
        else base.status = 'text-only';
      }
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const r = await mammoth.extractRawText({ arrayBuffer: buf });
      base.status = 'text-only'; base.text = r.value;
    } else {
      base.status = 'unsupported';
      base.error = `Unsupported file type .${ext}`;
    }
    if (base.status === 'parsed' && !base.tables.length) {
      base.status = 'failed';
      base.error = 'No tabular data with a header row was found.';
    }
  } catch (e) {
    base.status = 'failed';
    base.error = e instanceof Error ? e.message : String(e);
  }
  return base;
}
