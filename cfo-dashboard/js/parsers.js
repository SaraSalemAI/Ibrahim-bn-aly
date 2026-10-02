/* File parsers: Excel / CSV / PDF -> "tables" -> statement lines.
 * A line is { label, values: { [period]: number } }.
 * Libraries (SheetJS, PapaParse, pdf.js) are loaded as globals by index.html.
 */
(function (CFO) {
  const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9,
                      '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
  const latinDigits = s => String(s).replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]).replace(/٫/g, '.').replace(/٬/g, ',');

  /** Parse an accounting-formatted cell. Returns a number or null. "(1,200)" -> -1200, "-" -> 0. */
  function parseNumber(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return isFinite(cell) ? cell : null;
    let s = latinDigits(cell).trim();
    if (!s) return null;
    if (/^[-–—]+$/.test(s)) return 0;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    s = s.replace(/[A-Za-z$€£¥%؀-ۿ\s '’]/g, '');      // currency words/symbols, spaces
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    if (!/^\d[\d,]*(\.\d+)?$/.test(s)) return null;
    const v = parseFloat(s.replace(/,/g, ''));
    return isFinite(v) ? (neg ? -v : v) : null;
  }

  /** Period found in a header cell: "2024", "FY2024", "31/12/2024", "2024-12-31", Arabic digits. */
  function parsePeriod(cell) {
    if (cell == null || cell === '') return null;
    if (cell instanceof Date) return isNaN(cell) ? null : String(cell.getUTCFullYear());   // Excel date-formatted header
    if (typeof cell === 'number') return cell >= 1900 && cell <= 2100 && Number.isInteger(cell) ? String(cell) : null;
    const s = latinDigits(cell);
    const m = s.match(/(?:^|[^\d])((?:19|20)\d{2})(?!\d)/);
    if (!m) { const fy = s.match(/\bFY\s?'?(\d{2})\b/i); return fy ? '20' + fy[1] : null; }
    // Quarter / half-year labels keep their qualifier so they do not collide with the full year.
    const q = s.match(/\b(Q[1-4]|H[12])\b/i);
    return q ? `${m[1]} ${q[1].toUpperCase()}` : m[1];
  }

  /** "Current year" / "Prior year" style headers -> a sortable label (see CFO.periodRank). */
  function relativePeriod(cell) {
    if (typeof cell !== 'string') return null;
    const n = CFO.normalize ? CFO.normalize(cell) : cell.toLowerCase();
    if (/\b(current|this)\b.*\b(year|period)\b|\bcy\b|الحالي|الحاليه|الجاري|الجاريه/.test(n)) return 'Current year';
    if (/\b(prior|previous|last|comparative)\b.*\b(year|period)\b|\bpy\b|السابق|السابقه|المقارن|المقارنه/.test(n)) return 'Prior year';
    return null;
  }

  /** Rows (array of arrays) -> { periods, lines }. */
  function rowsToLines(rows) {
    let headerIdx = -1, headerCols = [];
    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const cols = [];
      (rows[r] || []).forEach((c, i) => { const p = parsePeriod(c); if (p) cols.push({ i, p }); });
      // A header row holds periods and little else numeric (a data row may contain a year-like value).
      const nums = (rows[r] || []).filter(c => parseNumber(c) != null).length;
      if (cols.length >= 1 && cols.length >= nums - 1 && cols.length > headerCols.length) { headerIdx = r; headerCols = cols; }
    }
    if (headerIdx < 0) {
      // Headers without years: "Current year / Prior year", "السنة الحالية / السنة السابقة".
      for (let r = 0; r < Math.min(rows.length, 40) && headerIdx < 0; r++) {
        const cols = [];
        (rows[r] || []).forEach((c, i) => { const p = relativePeriod(c); if (p) cols.push({ i, p }); });
        if (cols.length >= 2) { headerIdx = r; headerCols = cols; }
      }
    }
    if (headerIdx < 0) {
      // No period header: treat every numeric column as an unnamed period.
      const width = Math.max(0, ...rows.map(r => (r || []).length));
      for (let i = 0; i < width; i++) if (rows.some(r => r && typeof r[i] !== 'string' && parseNumber(r[i]) != null)) headerCols.push({ i, p: `P${headerCols.length + 1}` });
    }
    // De-duplicate repeated period names (e.g. two "2024" columns: amount + %); keep the first.
    const seen = new Set();
    headerCols = headerCols.filter(c => !seen.has(c.p) && seen.add(c.p));
    const colSet = new Set(headerCols.map(c => c.i));
    const lines = [];
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const label = row.filter((c, i) => !colSet.has(i) && typeof c === 'string' && c.trim() && parseNumber(c) == null)
                       .map(c => c.trim()).join(' ').trim();
      if (!label) continue;
      const values = {}; let any = false;
      for (const { i, p } of headerCols) { const v = parseNumber(row[i]); if (v != null) { values[p] = v; any = true; } }
      if (any) lines.push({ label, values });
    }
    return { periods: headerCols.map(c => c.p), lines };
  }

  async function parseCSV(file) {
    const text = await file.text();
    const res = globalThis.Papa.parse(text.replace(/^﻿/, ''), { skipEmptyLines: true });
    return [{ source: file.name, ...rowsToLines(res.data) }];
  }

  async function parseExcel(file) {
    const wb = globalThis.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    return wb.SheetNames.map(name => {
      const rows = globalThis.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
      return { source: wb.SheetNames.length > 1 ? `${file.name} › ${name}` : file.name, ...rowsToLines(rows) };
    }).filter(t => t.lines.length);
  }

  /* PDF: rebuild visual lines from positioned text, then assign numbers to the
   * period column whose header sits closest horizontally. */
  async function parsePDF(file) {
    const pdfjs = globalThis.pdfjsLib;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const tables = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.filter(it => it.str && it.str.trim())
        .map(it => ({ s: it.str.trim(), x: it.transform[4], cx: it.transform[4] + (it.width || 0) / 2, y: it.transform[5] }));
      const rows = [];
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      for (const it of items) {
        const row = rows.find(r => Math.abs(r.y - it.y) < 3);
        row ? row.items.push(it) : rows.push({ y: it.y, items: [it] });
      }
      rows.forEach(r => r.items.sort((a, b) => a.x - b.x));
      const t = pdfRowsToLines(rows);
      if (t.lines.length) tables.push({ source: doc.numPages > 1 ? `${file.name} › p${p}` : file.name, ...t });
    }
    return tables;
  }

  function pdfRowsToLines(rows) {
    // The header is re-detected per page block: a row with >= 2 period cells sets the columns.
    let cols = null, periods = [];
    const lines = [];
    const splitTokens = r => r.items.flatMap(it => {
      // pdf.js may join "2024 2023" or "1,200 (300)" into one item; split on wide spaces.
      const parts = it.s.split(/\s{2,}|\s(?=[(\-]?[\d٠-٩])/);
      if (parts.length === 1) return [it];
      return parts.map((s, k) => ({ s: s.trim(), x: it.x + k, cx: it.cx + k * 10, y: it.y })).filter(x => x.s);
    });
    for (const r of rows) {
      const toks = splitTokens(r);
      // Period tokens look like "2024", "FY2024", "31 Dec 2024"; a grouped amount ("2,024") is not one.
      const periodToks = toks.filter(t => parsePeriod(t.s) && !/[,٬]/.test(t.s));
      if (periodToks.length >= 2 && periodToks.length >= toks.filter(t => parseNumber(t.s) != null).length - 1) {
        cols = periodToks.map(t => ({ p: parsePeriod(t.s), cx: t.cx }));
        periods = [...new Set(cols.map(c => c.p))];
        continue;
      }
      if (!cols) continue;
      const nums = toks.filter(t => parseNumber(t.s) != null);
      const label = toks.filter(t => parseNumber(t.s) == null).map(t => t.s).join(' ').trim();
      if (!label || !nums.length) continue;
      const values = {};
      for (const n of nums) {
        let best = null, dist = Infinity;
        for (const c of cols) { const d = Math.abs(c.cx - n.cx); if (d < dist) { dist = d; best = c; } }
        // Numbers far from every period column (e.g. note references) are ignored.
        if (best && dist < 60 && values[best.p] == null) values[best.p] = parseNumber(n.s);
      }
      if (Object.keys(values).length) lines.push({ label, values });
    }
    return { periods, lines };
  }

  /** File -> array of tables. Throws a readable error for unsupported types. */
  async function parseFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'csv' || ext === 'txt' || ext === 'tsv') return parseCSV(file);
    if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) return parseExcel(file);
    if (ext === 'pdf') return parsePDF(file);
    throw new Error(`unsupported:${ext}`);
  }

  CFO.parseNumber = parseNumber;
  CFO.parsePeriod = parsePeriod;
  CFO.rowsToLines = rowsToLines;
  CFO.relativePeriod = relativePeriod;
  CFO.pdfRowsToLines = pdfRowsToLines;
  CFO.parseFile = parseFile;
})(globalThis.CFO = globalThis.CFO || {});
