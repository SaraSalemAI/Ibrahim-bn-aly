/* SUMED P2P — ingestion: parse → classify → map → normalise. OCR/text extraction with field confidence.
 * Optional parsers are lazy-loaded from public CDNs; if unavailable the file is registered as
 * "Parser unavailable" — nothing is guessed. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const I = (S.ingest = {});

  // Parsers: vendored copies (vendor/, works offline and on file://) first, public CDN as fallback.
  I.CDN = {
    xlsx: ['vendor/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'],
    pdf: ['vendor/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'],
    pdfWorker: ['vendor/pdf.worker.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'],
    tesseract: ['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js'],
    jszip: ['vendor/jszip.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'],
    mammoth: ['vendor/mammoth.browser.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'],
  };

  const ext = (name) => (String(name).split('.').pop() || '').toLowerCase();
  const kindOf = (name, mime) => {
    const e = ext(name);
    if (['csv', 'txt', 'tsv'].includes(e)) return 'csv';
    if (['xlsx', 'xls', 'xlsm'].includes(e)) return 'xlsx';
    if (e === 'json') return 'json';
    if (e === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'webp'].includes(e) || /^image\//.test(mime || '')) return 'image';
    if (['docx', 'doc'].includes(e)) return 'docx';
    if (e === 'zip') return 'zip';
    return 'other';
  };

  /** Find the header row: first row (within first 15) with ≥ 3 non-empty text cells. */
  I.findHeaderRow = (rows) => {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const cells = rows[i].filter((c) => !U.isBlank(c));
      if (cells.length >= 3 && cells.filter((c) => isNaN(U.parseNum(c))).length >= Math.ceil(cells.length * 0.6)) return i;
    }
    return 0;
  };

  /** Turn a 2-D sheet into a classified, mapped "sheet source" (not yet committed). */
  I.sheetFromRows = (fileName, sheetName, rows) => {
    const hr = I.findHeaderRow(rows);
    const headers = (rows[hr] || []).map((h) => String(h == null ? '' : h).trim());
    const body = rows.slice(hr + 1).filter((r) => r.some((c) => !U.isBlank(c)));
    const cls = S.classifyHeaders(headers, fileName + ' ' + sheetName);
    return {
      name: sheetName, headerRow: hr + 1, headers, rows: body, rowCount: body.length,
      entity: cls.confidence >= 0.5 && cls.score > 4 ? cls.entity : null,
      suggested: cls.entity, confidence: cls.confidence, mapping: cls.mapping,
      alternatives: cls.alternatives.map((a) => a.entity),
    };
  };

  I.parseFile = async (file) => {
    const kind = kindOf(file.name, file.type);
    const src = {
      fileId: U.uid('file'), name: file.name, size: file.size, kind, mime: file.type || '',
      uploadedAt: new Date().toISOString(), uploadedBy: S.state.session.userId,
      sheets: [], docs: [], status: 'Parsed', notes: [], hash: null,
    };
    try {
      if (kind === 'csv') {
        const text = await file.text();
        src.hash = U.hash(text);
        src.sheets.push(I.sheetFromRows(file.name, 'CSV', U.parseCSV(text)));
      } else if (kind === 'json') {
        const text = await file.text();
        src.hash = U.hash(text);
        const j = JSON.parse(text);
        if (j && j.format === 'sumed-p2p-workspace') { src.workspace = j; src.notes.push('Workspace file'); }
        else {
          const arr = Array.isArray(j) ? j : Object.values(j).find(Array.isArray) || [];
          const headers = U.uniq(arr.flatMap((o) => Object.keys(o || {})));
          src.sheets.push(I.sheetFromRows(file.name, 'JSON', [headers, ...arr.map((o) => headers.map((h) => o[h]))]));
        }
      } else if (kind === 'xlsx') {
        await U.loadAny(I.CDN.xlsx);
        const buf = await file.arrayBuffer();
        src.hash = U.hash(String(buf.byteLength) + file.name + file.lastModified);
        const wb = root.XLSX.read(buf, { type: 'array', cellDates: true });
        for (const sn of wb.SheetNames) {
          const rows = root.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
          if (rows.length) src.sheets.push(I.sheetFromRows(file.name, sn, rows));
        }
      } else if (kind === 'pdf' || kind === 'image') {
        const doc = await I.extractDocument(file, kind);
        src.hash = doc.hash;
        src.docs.push(doc);
      } else if (kind === 'docx') {
        await U.loadAny(I.CDN.mammoth);
        const r = await root.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        src.hash = U.hash(r.value);
        src.docs.push(I.buildDoc(file.name, [{ page: 1, text: r.value, conf: 1, method: 'docx-text' }], U.hash(r.value)));
      } else if (kind === 'zip') {
        await U.loadAny(I.CDN.jszip);
        const zip = await root.JSZip.loadAsync(await file.arrayBuffer());
        src.children = [];
        for (const entry of Object.values(zip.files)) {
          if (entry.dir || /(^|\/)(__MACOSX|\.)/.test(entry.name)) continue;
          const blob = await entry.async('blob');
          const f = new File([blob], entry.name.split('/').pop(), { type: '' });
          src.children.push(await I.parseFile(f));
        }
        src.notes.push(`${src.children.length} files extracted from archive`);
      } else {
        src.status = 'Unsupported';
        src.notes.push('Stored as supporting document; no structured data extracted');
      }
    } catch (e) {
      src.status = 'Parser unavailable';
      src.notes.push(String(e.message || e));
    }
    src.classifiedAs = I.describeSource(src);
    return src;
  };

  I.describeSource = (src) => {
    if (src.workspace) return 'Workspace';
    if (src.children) return 'Archive';
    if (src.docs && src.docs.length) return src.docs[0].docType;
    const ents = U.uniq(src.sheets.map((s) => s.entity).filter(Boolean));
    return ents.length ? ents.map((e) => S.schema[e].label).join(', ') : 'Unclassified';
  };

  /* ---------------- Normalisation ---------------- */
  I.normalize = (entity, sheet, fileName) => {
    const def = S.schema[entity];
    const order = S.state.config.dateOrder;
    const out = [];
    sheet.rows.forEach((row, i) => {
      const rec = { _src: { file: fileName, sheet: sheet.name, row: sheet.headerRow + 1 + i }, _raw: {}, _issues: [], _demo: false };
      for (const f of def.fields) {
        const col = sheet.mapping[f.key];
        if (col == null) continue;
        const raw = row[col];
        rec._raw[f.key] = raw;
        if (U.isBlank(raw)) { rec[f.key] = null; continue; }
        let v;
        if (f.type === 'n') v = U.parseNum(raw);
        else if (f.type === 'd') v = U.parseDate(raw, order);
        else if (f.type === 'b') v = U.parseBool(raw);
        else v = String(raw instanceof Date ? U.parseDate(raw) : raw).trim();
        if (v == null) rec._issues.push({ field: f.key, issue: f.type === 'n' ? 'invalidNumber' : f.type === 'd' ? 'invalidDate' : 'invalidValue', raw: String(raw) });
        rec[f.key] = v;
      }
      if (entity === 'bankTxns' && rec.amount == null && (rec.debit != null || rec.credit != null)) {
        rec.amount = (rec.credit || 0) - (rec.debit || 0);
        (rec._derived = rec._derived || {}).amount = 'credit − debit';
      }
      if (entity === 'payments' && rec.gross == null && rec.net != null) {
        rec.gross = rec.net + (rec.wht || 0);
        (rec._derived = rec._derived || {}).gross = 'net + withholding';
      }
      if (entity === 'invoices' && rec.total == null && rec.subtotal != null) {
        rec.total = rec.subtotal + (rec.tax || 0);
        (rec._derived = rec._derived || {}).total = 'subtotal + tax';
      }
      ['currency', 'contractCurrency'].forEach((k) => { if (rec[k]) rec[k] = String(rec[k]).toUpperCase().replace('LE', 'EGP').replace('جنيه', 'EGP').trim(); });
      rec._key = entity + ':' + U.hash(fileName + '|' + sheet.name + '|' + i).slice(0, 10);
      out.push(rec);
    });
    return out;
  };

  /** Commit confirmed sources into the workspace. */
  I.commit = (sources) => {
    if (S.state.mode === 'demo') S.resetData('live');
    S.state.mode = 'live';
    const flat = [];
    const walk = (s) => { flat.push(s); (s.children || []).forEach(walk); };
    sources.forEach(walk);
    for (const src of flat) {
      if (src.workspace) { S.deserialize(src.workspace); S.audit('workspace.import', 'workspace', src.name); continue; }
      const dup = S.state.sources.find((x) => x.hash && x.hash === src.hash);
      if (dup) { src.status = 'Duplicate file (skipped)'; src.notes.push('Identical to ' + dup.name); }
      const meta = { fileId: src.fileId, name: src.name, size: src.size, kind: src.kind, hash: src.hash, uploadedAt: src.uploadedAt, uploadedBy: src.uploadedBy, status: src.status, notes: src.notes, classifiedAs: src.classifiedAs, sheets: [] };
      if (!dup) {
        for (const sh of src.sheets) {
          const sm = { name: sh.name, entity: sh.entity, rowCount: sh.rowCount, headerRow: sh.headerRow, confidence: sh.confidence, mapping: sh.mapping, headers: sh.headers };
          if (sh.entity) {
            const recs = I.normalize(sh.entity, sh, src.name);
            S.state.data[sh.entity].push(...recs);
            sm.loaded = recs.length;
          } else sm.loaded = 0;
          meta.sheets.push(sm);
        }
        for (const d of src.docs) S.state.ocrDocs.push({ ...d, _pending: false, fileId: src.fileId, fileName: src.name });
      }
      if (!src.children) {
        S.state.sources.push(meta);
        S.audit('file.upload', 'source', src.name, { newValue: meta.classifiedAs + ' · ' + U.sum(meta.sheets, (x) => x.loaded) + ' rows', reason: meta.status });
      }
    }
    // Re-run invoice field extraction now that the supplier master from the same upload batch is loaded
    for (const d of S.state.ocrDocs.filter((x) => x.docType === 'Invoice' && x.status !== 'Posted' && !(x.fields.supplier && x.fields.supplier.corrected))) {
      const f = I.extractInvoiceFields(d.pages, S.state.data.suppliers);
      Object.entries(f).forEach(([k, v]) => { if (!d.fields[k] || (!d.fields[k].corrected && v.confidence > d.fields[k].confidence)) d.fields[k] = v; });
    }
    S.emit('data');
  };

  /* ---------------- Document text extraction & OCR ---------------- */
  I.extractDocument = async (file, kind) => {
    const pages = [];
    let hash;
    if (kind === 'pdf') {
      await U.loadAny(I.CDN.pdf);
      // Load the worker code on the main thread too: pdf.js then runs without a Web Worker (needed on file://).
      const ws = await U.loadAny(I.CDN.pdfWorker);
      root.pdfjsLib.GlobalWorkerOptions.workerSrc = ws;
      const buf = await file.arrayBuffer();
      hash = U.hash(String(buf.byteLength) + file.name);
      const pdf = await root.pdfjsLib.getDocument({ data: buf }).promise;
      for (let p = 1; p <= Math.min(pdf.numPages, 10); p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const text = I.joinPdfText(tc.items);
        if (text.replace(/\s/g, '').length > 30) pages.push({ page: p, text, conf: 1, method: 'pdf-text' });
        else {
          // scanned page → render and OCR
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width; canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          pages.push(await I.ocrImage(canvas, p));
        }
      }
    } else {
      hash = U.hash(file.name + file.size + file.lastModified);
      pages.push(await I.ocrImage(file, 1));
    }
    return I.buildDoc(file.name, pages, hash);
  };
  I.joinPdfText = (items) => {
    const lines = [];
    let lastY = null, cur = [];
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) { lines.push(cur.join(' ')); cur = []; }
      cur.push(it.str); lastY = y;
    }
    if (cur.length) lines.push(cur.join(' '));
    return lines.join('\n');
  };
  I.ocrImage = async (img, page) => {
    await U.loadAny(I.CDN.tesseract);
    const r = await root.Tesseract.recognize(img, 'eng+ara');
    return { page, text: r.data.text, conf: (r.data.confidence || 0) / 100, method: 'ocr', words: (r.data.words || []).map((w) => ({ t: w.text, c: w.confidence / 100 })) };
  };

  /** Classify a document from its text */
  I.docTypeFromText = (text) => {
    const t = text.toLowerCase();
    const score = {
      'Invoice': (t.match(/invoice|فاتورة|tax invoice|bill to/g) || []).length * 2 + (/(total|amount due|الإجمالي)/.test(t) ? 1 : 0),
      'Purchase Order': (t.match(/purchase order|أمر شراء|p\.o\./g) || []).length * 2,
      'Contract': (t.match(/agreement|contract|عقد|hereby|party/g) || []).length,
      'Bank Statement': (t.match(/statement|opening balance|closing balance|كشف حساب/g) || []).length * 2,
      'GRN': (t.match(/goods received|delivery note|إذن استلام|grn/g) || []).length * 2,
      'Tax Document': (t.match(/tax card|tax registration|بطاقة ضريبية|vat certificate/g) || []).length * 2,
    };
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'Supporting Document';
  };

  const DATE_RE = '(\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[\\s-][A-Za-z]{3,9}[\\s-,]+\\d{4})';
  const AMT_RE = '([\\d٠-٩][\\d٠-٩,\\.]*)';

  /** Extract invoice fields. Every field carries value, confidence (0..1), page, method, and the evidence snippet. */
  I.extractInvoiceFields = (pages, suppliers = []) => {
    const fields = {};
    const set = (key, value, conf, page, snippet, method) => {
      if (value == null || value === '') return;
      if (!fields[key] || fields[key].confidence < conf) fields[key] = { value, confidence: U.round(conf, 2), page, snippet: String(snippet || '').slice(0, 140), method, original: value, corrected: false };
    };
    for (const pg of pages) {
      const text = U.normDigits(pg.text);
      const q = pg.conf || 1;
      const find = (re) => { const m = text.match(re); return m; };
      let m;
      if ((m = find(new RegExp('(?:invoice\\s*(?:no\\.?|number|#)|inv\\s*(?:no\\.?|#)|رقم\\s*الفاتورة)\\s*[:#]?\\s*([A-Z0-9][A-Z0-9\\-/]{2,24})', 'i')))) set('invoiceNo', m[1], 0.95 * q, pg.page, m[0], 'label');
      if ((m = find(new RegExp('(?:invoice\\s*date|date\\s*of\\s*invoice|تاريخ\\s*الفاتورة)\\s*[:]?\\s*' + DATE_RE, 'i')))) set('invoiceDate', U.parseDate(m[1], S.state.config.dateOrder), 0.93 * q, pg.page, m[0], 'label');
      else if ((m = find(new RegExp('\\bdate\\s*[:]?\\s*' + DATE_RE, 'i')))) set('invoiceDate', U.parseDate(m[1], S.state.config.dateOrder), 0.7 * q, pg.page, m[0], 'heuristic');
      if ((m = find(new RegExp('(?:due\\s*date|payment\\s*due|تاريخ\\s*الاستحقاق)\\s*[:]?\\s*' + DATE_RE, 'i')))) set('dueDate', U.parseDate(m[1], S.state.config.dateOrder), 0.93 * q, pg.page, m[0], 'label');
      if ((m = find(/(?:\bp\.?\s?o\.?\s*(?:no\.?|number|#|ref)|\bpurchase\s*order(?:\s*no\.?)?|أمر\s*الشراء|أمر\s*شراء)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]*\d[A-Z0-9\-/]*)/i))) set('poNo', m[1], 0.9 * q, pg.page, m[0], 'label');
      if ((m = find(/\b(EGP|USD|EUR|GBP|SAR|AED)\b/))) set('currency', m[1], 0.85 * q, pg.page, m[0], 'token');
      else if (/جنيه|ج\.م/.test(text)) set('currency', 'EGP', 0.75 * q, pg.page, 'جنيه', 'token');
      const amt = (label) => {
        const re = new RegExp('(?:' + label + ')\\s*[:]?\\s*(?:EGP|USD|EUR)?\\s*' + AMT_RE, 'gi');
        let mm, last = null;
        while ((mm = re.exec(text))) last = mm;
        return last;
      };
      if ((m = amt('grand\\s*total|total\\s*amount\\s*due|total\\s*due|amount\\s*due|invoice\\s*total|الإجمالي\\s*المستحق|الإجمالي'))) set('total', U.parseNum(m[1]), 0.92 * q, pg.page, m[0], 'label');
      else if ((m = amt('total'))) set('total', U.parseNum(m[1]), 0.75 * q, pg.page, m[0], 'heuristic');
      if ((m = amt('sub\\s*-?total|net\\s*amount|amount\\s*before\\s*tax|الإجمالي\\s*قبل\\s*الضريبة'))) set('subtotal', U.parseNum(m[1]), 0.9 * q, pg.page, m[0], 'label');
      if ((m = amt('vat(?:\\s*\\(?\\d+%?\\)?)?|value\\s*added\\s*tax|tax\\s*amount|ضريبة\\s*القيمة\\s*المضافة'))) set('tax', U.parseNum(m[1]), 0.88 * q, pg.page, m[0], 'label');
      if ((m = amt('discount|خصم'))) set('discount', U.parseNum(m[1]), 0.85 * q, pg.page, m[0], 'label');
      if ((m = find(/\b([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?)\b/))) {
        const ok = U.ibanValid(m[1]);
        set('iban', U.normIban(m[1]), (ok ? 0.98 : 0.4) * q, pg.page, m[0], ok ? 'iban-checksum-valid' : 'iban-checksum-FAILED');
      }
      if ((m = find(/(?:swift|bic)\s*(?:code)?\s*[:]?\s*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/i))) set('swift', m[1].toUpperCase(), 0.9 * q, pg.page, m[0], 'label');
      if ((m = find(/(?:payment\s*terms|terms\s*of\s*payment|شروط\s*الدفع)\s*[:]?\s*([^\n]{3,40})/i))) set('paymentTerms', m[1].trim(), 0.85 * q, pg.page, m[0], 'label');
      // Supplier: compare first lines with supplier master names
      const head = text.split('\n').slice(0, 12).join(' ');
      let best = null;
      for (const s of suppliers) {
        for (const nm of [s.name, s.nameAr].filter(Boolean)) {
          const sc = Math.max(U.jaccard(head, nm), head.toLowerCase().includes(String(nm).toLowerCase()) ? 1 : 0);
          if (!best || sc > best.sc) best = { sc, s };
        }
      }
      if (best && best.sc >= 0.5) set('supplier', best.s.supplierId, (0.6 + 0.35 * best.sc) * q, pg.page, best.s.name, 'supplier-master-match');
      else if ((m = find(/(?:from|supplier|vendor|المورد)\s*[:]\s*([^\n]{3,60})/i))) set('supplierName', m[1].trim(), 0.6 * q, pg.page, m[0], 'label');
      // Line items: "<desc> <qty> <unit> <amount>" where qty*unit≈amount
      const lines = [];
      text.split('\n').forEach((ln) => {
        const nums = (ln.match(/[\d][\d,]*\.?\d*/g) || []).map(U.parseNum).filter((x) => x != null);
        if (nums.length >= 3) {
          const [a, b, c] = nums.slice(-3);
          if (a > 0 && b > 0 && Math.abs(a * b - c) <= Math.max(1, c * 0.005)) lines.push({ description: ln.replace(/[\d,\.]+/g, '').trim().slice(0, 60), qty: a, unitPrice: b, amount: c, confidence: U.round(0.9 * q, 2), page: pg.page });
        }
      });
      if (lines.length) set('lines', lines, 0.9 * q, pg.page, lines.length + ' line(s) where qty × price = amount', 'arithmetic-check');
    }
    // Arithmetic cross-check boosts confidence when it reconciles; flags when it doesn't
    const v = (k) => (fields[k] ? fields[k].value : null);
    if (v('subtotal') != null && v('total') != null) {
      const calc = v('subtotal') + (v('tax') || 0) - (v('discount') || 0);
      const ok = Math.abs(calc - v('total')) <= Math.max(1, v('total') * 0.001);
      ['subtotal', 'tax', 'total'].forEach((k) => { if (fields[k]) fields[k].confidence = ok ? Math.max(fields[k].confidence, 0.98) : Math.min(fields[k].confidence, 0.6); });
      fields._arithmetic = { ok, calc: U.round(calc, 2), formula: 'subtotal + tax − discount' };
    }
    return fields;
  };

  I.buildDoc = (name, pages, hash) => {
    const text = pages.map((p) => p.text).join('\n');
    const docType = I.docTypeFromText(text);
    const doc = { docId: U.uid('doc'), name, docType, pages: pages.map((p) => ({ page: p.page, method: p.method, conf: p.conf, text: p.text })), hash, status: 'Pending Review', fields: {} };
    if (docType === 'Invoice') doc.fields = I.extractInvoiceFields(pages, S.state.data.suppliers);
    return doc;
  };

  /** User correction of an extracted field (always audit-logged). */
  I.correctField = (doc, key, value, reason) => {
    const f = doc.fields[key] || (doc.fields[key] = { value: null, confidence: 0, page: null, method: 'manual', original: null });
    const old = f.value;
    f.value = value; f.corrected = true; f.correctedBy = S.state.session.userId; f.correctedAt = new Date().toISOString();
    S.audit('ocr.correct', 'ocrDoc', doc.name, { field: key, oldValue: old, newValue: value, reason: reason || 'OCR correction' });
  };

  /** Post a reviewed OCR invoice into the invoice register. Missing fields stay null ("Not Available in Source Data"). */
  I.postInvoice = (doc) => {
    const g = (k) => (doc.fields[k] ? doc.fields[k].value : null);
    const sup = g('supplier') || null;
    const rec = {
      invoiceNo: g('invoiceNo'), supplierId: sup, supplierName: sup ? null : g('supplierName'), invoiceDate: g('invoiceDate'), dueDate: g('dueDate'),
      poNo: g('poNo'), currency: g('currency'), subtotal: g('subtotal'), tax: g('tax'), total: g('total'), paymentTerms: g('paymentTerms'),
      bankIban: g('iban'), status: 'Validated', approvalStatus: 'Pending Approval', enteredBy: S.state.session.userId,
      fileHash: doc.hash, _src: { file: doc.fileName || doc.name, sheet: null, row: null, page: (doc.fields.invoiceNo || {}).page || 1 },
      _ocr: doc.docId,
    };
    S.addRecord('invoices', rec, 'invoice.ocr.post', 'Posted from OCR review');
    S.updateRecord('ocrDoc', doc, 'status', 'Posted', null, 'ocr.post');
    S.emit('data');
    return rec;
  };
})(typeof window !== 'undefined' ? window : globalThis);
