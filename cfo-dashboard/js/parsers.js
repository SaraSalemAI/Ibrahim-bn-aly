/* File parsers: Excel / CSV / PDF -> "tables" -> statement lines.
 * A line is { label, values: { [period]: number } }.
 * Libraries (SheetJS, PapaParse, pdf.js) are loaded as globals by index.html.
 */
(function (CFO) {
  const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9,
                      '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
  const latinDigits = s => String(s).replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]).replace(/٫/g, '.').replace(/٬/g, ',');

  // Set while reading a file that uses European number style (1.234,56), see csvTables().
  let europeanStyle = false;

  /** Parse an accounting-formatted cell. Returns a number or null.
   * "(1,200)" -> -1200, "1,200-" -> -1200, "−1,200" -> -1200, "1.234.567,89" -> 1234567.89, "1 234" -> 1234, "-" -> 0.
   * "1.500" stays 1.5 unless the file as a whole uses European style. */
  function parseNumber(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return isFinite(cell) ? cell : null;
    if (cell instanceof Date) return null;
    let s = latinDigits(cell).trim().replace(/[−‒–—﹣－]/g, '-');
    if (!s) return null;
    if (/^-+$/.test(s)) return 0;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    s = s.replace(/[A-Za-z$€£¥%؀-ۿ\s  '’]/g, '');      // currency words/symbols, spaces
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    // European grouping. Unambiguous anywhere: 1.234.567 / 1.234,56 / 1234,56.
    // Ambiguous ("1.500", "1,5") only in a file detected as European.
    const euro = /^[1-9]\d{0,2}(\.\d{3}){2,}(,\d+)?$/.test(s) || /^[1-9]\d{0,2}(\.\d{3})+,\d+$/.test(s) || /^\d+,\d{2}$/.test(s) && !/^\d{1,3},\d{3}$/.test(s)
      || europeanStyle && (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s) || /^\d+,\d+$/.test(s));
    if (euro) s = s.replace(/\./g, '').replace(',', '.');
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

  const words = s => String(s).trim().split(/\s+/).filter(Boolean).length;
  const filled = c => c != null && String(c).trim() !== '';

  /** Columns of a header row, or null when the row is not a header.
   * A header holds period cells and otherwise only text ("Note", "إيضاح", "EGP '000").
   * Bare numbers count as years only when there are two or more distinct ones close together
   * (or a single one before any header), so a data row such as "Intangible assets | 2,000 | 2,000" is never taken for a header. */
  // Words a header row may carry besides its periods ("Note", "EGP '000", "البيان", "إيضاح").
  const HEADER_WORDS = new Set(('note notes no item items description particulars line account accounts amount amounts in thousands thousand millions million ' +
    'egp usd eur gbp sar aed kwd qar 000 le ج م البند البيان بيان ايضاح ايضاحات رقم بالالف الف بالمليون القيمه المبلغ جنيه مصري').split(' '));
  const headerWordsOnly = c => { const n = CFO.normalize ? CFO.normalize(c) : String(c).toLowerCase(); return !n || n.split(' ').every(w => HEADER_WORDS.has(w)); };
  const isAmount = c => typeof c === 'number' || (parseNumber(c) != null && !/[A-Za-z\u0621-\u064A]/.test(c));

  /** known = periods of the header already in force (null before the first header). */
  function headerOf(row, known = null) {
    const first = !known || !known.length;
    const cells = (row || []).map((c, i) => ({ c, i })).filter(x => filled(x.c));
    // A lone cell is a title ("As at 31 December 2024") unless it is a short period label away from
    // the label column, as in a one-year statement: "| | 2024" (only as the first header).
    if (cells.length < 2 && !(first && cells.length === 1 && cells[0].i > 0 && typeof cells[0].c !== 'number' && words(cells[0].c) <= 3 && parsePeriod(cells[0].c))) return null;
    const per = [], other = [];
    for (const x of cells) {
      const p = (typeof x.c === 'string' && words(x.c) > 7) ? null : parsePeriod(x.c);
      // "2024" typed as text (CSV) is as ambiguous as the number 2024: it could be an amount.
      p ? per.push({ i: x.i, p, bare: typeof x.c === 'number' || /^\s*[\d٠-٩]{4}\s*$/.test(x.c) }) : other.push(x);
    }
    if (!per.length) {
      const rel = cells.map(x => ({ i: x.i, p: relativePeriod(x.c) })).filter(x => x.p);
      return rel.length >= 2 && new Set(rel.map(x => x.p)).size >= 2 ? rel : null;
    }
    // Other amounts on the row make it a data row; a units cell ("EGP '000") is text, not an amount.
    if (other.some(x => isAmount(x.c))) return null;
    // After the first header, a new header needs two or more periods (a lone "31 December 2024" is a subtitle).
    if (per.length < 2 && !first) return null;
    if (per.every(x => x.bare)) {
      const ys = per.map(x => +x.p);
      if (new Set(ys).size !== ys.length || Math.max(...ys) - Math.min(...ys) > 10) return null;
      if (other.some(x => CFO.matchLabel && CFO.matchLabel(x.c))) return null;   // "Revenue | 2023 | 2024" as amounts
      // A later header of bare years must repeat years already in use, and its label position (left of the
      // years) may hold only header words, so a data row such as "Headcount | 2019 | 2021" is not a header.
      // Columns right of the years ("Change %") are free.
      const firstYearCol = Math.min(...per.map(x => x.i));
      if (!first && (!ys.every(y => known.includes(String(y))) || !other.filter(x => x.i < firstYearCol).every(x => headerWordsOnly(x.c)))) return null;
    }
    const seen = new Set();
    return per.filter(x => !seen.has(x.p) && seen.add(x.p)).map(({ i, p }) => ({ i, p }));
  }

  /** Rows (array of arrays) -> { periods, lines }.
   * The header is re-detected for every section, so statements stacked in one sheet
   * with different column layouts each use their own year columns. */
  function rowsToLines(rows) {
    let cols = null;
    const periods = [], lines = [];
    const readRow = (row, cs) => {
      const colSet = new Set(cs.map(c => c.i));
      const label = row.filter((c, i) => !colSet.has(i) && typeof c === 'string' && c.trim() && parseNumber(c) == null)
                       .map(c => c.trim()).join(' ').replace(/\s+/g, ' ').trim();
      if (!label) return;
      const values = {}; let any = false;
      for (const { i, p } of cs) { const v = parseNumber(row[i]); if (v != null) { values[p] = v; any = true; } }
      if (any) lines.push({ label, values });
    };
    for (const row of rows) {
      const h = headerOf(row, cols ? periods : null);
      if (h) { cols = h; h.forEach(c => periods.includes(c.p) || periods.push(c.p)); continue; }
      if (cols) readRow(row || [], cols);
    }
    if (!periods.length) {
      // No period header anywhere: treat every numeric column as an unnamed period.
      const width = Math.max(0, ...rows.map(r => (r || []).length));
      const cs = [];
      for (let i = 0; i < width; i++) if (rows.some(r => r && typeof r[i] !== 'string' && parseNumber(r[i]) != null)) cs.push({ i, p: `P${cs.length + 1}` });
      rows.forEach(r => readRow(r || [], cs));
      cs.forEach(c => periods.push(c.p));
    }
    return { periods, lines };
  }

  /** Text of a CSV file: UTF-8, UTF-16 (Excel "Unicode text"), Windows-1256 (Excel on Arabic Windows) or Windows-1252. */
  function decodeText(buf) {
    const b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^﻿/, ''); }
    catch (e) {
      // Not UTF-8: a legacy Windows code page. Arabic (1256) writes words as runs of high bytes;
      // Western European (1252) has accented letters scattered among ASCII.
      let high = 0, inRuns = 0;
      for (let k = 0; k < b.length; k++) if (b[k] >= 0x80) { high++; if (b[k - 1] >= 0x80 || b[k + 1] >= 0x80) inRuns++; }
      return new TextDecoder(high && inRuns / high > 0.6 ? 'windows-1256' : 'windows-1252').decode(b);
    }
  }

  /** Delimiter used by most of the first lines (comma, semicolon or tab). */
  function sniffDelimiter(text) {
    const sample = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 15);
    let best = ',', bestScore = 0;
    for (const d of [',', ';', '\t']) {
      const counts = sample.map(l => l.replace(/"[^"]*"/g, '').split(d).length - 1);
      const withIt = counts.filter(c => c > 0).length;
      const score = withIt / (sample.length || 1) + (new Set(counts).size === 1 && counts[0] > 0 ? 1 : 0);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  /** CSV bytes -> tables (shared by the browser and the tests). */
  function csvTables(buf, name) {
    const text = decodeText(buf);
    const delimiter = sniffDelimiter(text);
    const res = globalThis.Papa.parse(text, { skipEmptyLines: true, delimiter });
    // Semicolon files and files with 1.234,56 amounts use European number style throughout.
    europeanStyle = delimiter === ';' || /\d\.\d{3},\d/.test(text);
    try { return [{ source: name, ...rowsToLines(res.data) }]; } finally { europeanStyle = false; }
  }

  /** Workbook bytes -> one table per sheet that has line items. */
  function workbookTables(buf, name) {
    const wb = globalThis.XLSX.read(buf, { type: 'array', cellDates: true });
    return wb.SheetNames.map(sheet => {
      const rows = globalThis.XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: '' });
      return { source: wb.SheetNames.length > 1 ? `${name} › ${sheet}` : name, ...rowsToLines(rows) };
    }).filter(t => t.lines.length);
  }

  const parseCSV = async file => csvTables(await file.arrayBuffer(), file.name);
  const parseExcel = async file => workbookTables(await file.arrayBuffer(), file.name);

  /* PDF: rebuild visual lines from positioned text, then assign numbers to the
   * period column whose header sits closest horizontally. The year columns carry over
   * to following pages, since a statement continued on the next page rarely repeats them. */
  const parsePDF = async file => pdfTables(await file.arrayBuffer(), file.name);

  /** PDF bytes -> one table per page that has line items. */
  async function pdfTables(buf, name) {
    const pdfjs = globalThis.pdfjsLib;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const file = { name };
    const tables = [];
    let carry = null;
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
      const t = pdfRowsToLines(rows, carry);
      carry = t.cols;
      if (t.lines.length) tables.push({ source: doc.numPages > 1 ? `${file.name} › p${p}` : file.name, periods: t.periods, lines: t.lines });
    }
    return tables;
  }

  // \b only works next to ASCII letters, so word edges are written as (^|\s) / (\s|$) to cover Arabic too.
  const CONTINUES = /(?:^|\s)(and|of|for|in|the|on|to|و|من|في|على)$|[,&]$/i;
  const FOOTER = /^(page|صفحة|صفحه)(\s|$)|^p\.\s*\d|^\d+\s*(of|\/|من)\s*\d+$/i;

  function pdfRowsToLines(rows, carry = null) {
    let cols = carry, pending = '';
    const lines = [];
    const splitTokens = r => r.items.flatMap(it => {
      // pdf.js may join "2024 2023" or "1,200 (300)" into one item; split on wide spaces.
      const parts = it.s.split(/\s{2,}|\s(?=[(\-−]?[\d٠-٩])/);
      if (parts.length === 1) return [it];
      return parts.map((s, k) => ({ s: s.trim(), x: it.x + k, cx: it.cx + k * 10, y: it.y })).filter(x => x.s);
    });
    for (const r of rows) {
      const toks = splitTokens(r);
      const text = toks.map(t => t.s).join(' ');
      // Period tokens are short ("2024", "FY2024", "Dec 2024"); a grouped amount ("2,024") or a sentence is not one.
      const periodToks = toks.filter(t => words(t.s) <= 3 && parsePeriod(t.s) && !/[,٬]/.test(t.s));
      const otherNums = toks.filter(t => !periodToks.includes(t) && parseNumber(t.s) != null);
      if (periodToks.length >= 2 && otherNums.length <= periodToks.length && words(text) <= 14) {
        cols = periodToks.map(t => ({ p: parsePeriod(t.s), cx: t.cx }));
        pending = '';
        continue;
      }
      if (!cols || FOOTER.test(text)) { pending = ''; continue; }
      const nums = toks.filter(t => parseNumber(t.s) != null);
      let label = toks.filter(t => parseNumber(t.s) == null).map(t => t.s).join(' ').trim();
      if (!nums.length) {
        // A text-only line may be the first half of a wrapped label ("Property, plant and" / "equipment").
        pending = label && words(label) <= 8 ? label : '';
        continue;
      }
      if (pending && label && (CONTINUES.test(pending) || /^[a-z]/.test(label))) label = `${pending} ${label}`;
      pending = '';
      if (!label || words(label) > 14) continue;            // prose that happens to contain numbers
      const values = {};
      for (const n of nums) {
        let best = null, dist = Infinity;
        for (const c of cols) { const d = Math.abs(c.cx - n.cx); if (d < dist) { dist = d; best = c; } }
        // Numbers far from every period column (e.g. note references) are ignored.
        if (best && dist < 60 && values[best.p] == null) values[best.p] = parseNumber(n.s);
      }
      if (Object.keys(values).length) lines.push({ label, values });
    }
    return { periods: cols ? [...new Set(cols.map(c => c.p))] : [], lines, cols };
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
  CFO.headerOf = headerOf;
  CFO.decodeText = decodeText;
  CFO.csvTables = csvTables;
  CFO.workbookTables = workbookTables;
  CFO.pdfTables = pdfTables;
  CFO.sniffDelimiter = sniffDelimiter;
  CFO.relativePeriod = relativePeriod;
  CFO.pdfRowsToLines = pdfRowsToLines;
  CFO.parseFile = parseFile;
})(globalThis.CFO = globalThis.CFO || {});
