import { fixedWidthToCsv } from "./formats";

/**
 * Text extraction from digital PDFs (exported reports, e-statements) in the browser with pdf.js.
 * Text items are regrouped into lines by their position and columns are separated by wide gaps, so
 * a printed trial balance or bank statement becomes a table. Scanned PDFs have no text layer and
 * need AI text recognition instead.
 */
export interface PdfText {
  pages: number;
  text: string;
  csv: string | null;
  hasText: boolean;
}

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
}

/** Rebuilds lines from positioned text: same baseline (±2pt) → one line; a gap wider than ~2 characters → column break. */
export function itemsToLines(items: Item[]): string[] {
  const rows: Item[][] = [];
  for (const it of [...items].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0].y - it.y) <= 2);
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => {
    const sorted = r.sort((a, b) => a.x - b.x);
    let line = "";
    let end = -Infinity;
    for (const it of sorted) {
      const charW = it.w / Math.max(1, it.str.length);
      const gap = it.x - end;
      line += line ? (gap > charW * 2 ? "   " : gap > charW * 0.3 ? " " : "") : "";
      line += it.str.trim();
      end = it.x + it.w;
    }
    return line;
  });
}

export async function extractPdfText(bytes: Uint8Array, maxPages = 200): Promise<PdfText> {
  // Loading the worker module registers it on globalThis, so pdf.js runs in this thread: no separate
  // worker file is needed (which also keeps the single-file HTML build self-contained).
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str?: string; transform?: number[]; width?: number }>)
      .filter((i) => typeof i.str === "string" && i.transform)
      .map((i) => ({ str: i.str!, x: i.transform![4], y: i.transform![5], w: i.width ?? 0 }));
    lines.push(...itemsToLines(items), "");
  }
  await doc.destroy();
  const text = lines.join("\n");
  const hasText = text.replace(/\s/g, "").length > 20;
  return { pages: doc.numPages, text, csv: hasText ? fixedWidthToCsv(text) : null, hasText };
}
