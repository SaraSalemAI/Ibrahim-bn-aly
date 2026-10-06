/* SUMED P2P — data views: Upload & Validate (classify, map, OCR review), Data Quality report, Reconciliation. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const V = (S.views = S.views || {});
  S.vs = S.vs || {};
  const entLabel = (e) => (S.isAr() ? S.schema[e].labelAr : S.schema[e].label);

  const STEPS = ['upload', 'validate', 'extract', 'reconcile', 'analyze', 'dashboard', 'report'];
  V.stepper = (active) => `<ol class="stepper">${STEPS.map((s, i) => `<li class="${i < active ? 'done' : i === active ? 'on' : ''}">${esc(t('step.' + s, s.toUpperCase()))}</li>`).join('<li class="arr" aria-hidden="true">→</li>')}</ol>`;

  /* ------------------------------ UPLOAD ------------------------------ */
  V.upload = {
    title: () => t('nav.upload', 'Upload & Validate'),
    render() {
      const pend = S.vs.pending || [];
      const busy = S.vs.parsing;
      const flat = [];
      const walk = (s, depth) => { flat.push([s, depth]); (s.children || []).forEach((c) => walk(c, depth + 1)); };
      pend.forEach((s) => walk(s, 0));
      const step = pend.length ? 1 : S.state.sources.length ? 4 : 0;
      const pendHtml = flat.map(([src, depth], fi) => `<div class="pend" style="margin-inline-start:${depth * 18}px">
          <header><b>${esc(src.name)}</b> <span class="muted">${src.size != null ? esc(S.fmt.num(src.size / 1024, 0)) + ' KB · ' : ''}${esc(src.kind)}</span> ${UI.badge(src.status)} <span class="pill">${esc(src.classifiedAs || '')}</span></header>
          ${src.notes.length ? `<p class="muted small">${src.notes.map(esc).join(' · ')}</p>` : ''}
          ${src.sheets.map((sh, si) => `<div class="sheet">
            <div class="sheet-h"><span>📄 ${esc(t('ev.sheet', 'Sheet'))}: <b>${esc(sh.name)}</b> · ${esc(t('up.rows', '{n} rows', { n: sh.rowCount }))} · ${esc(t('up.headerRow', 'header row {n}', { n: sh.headerRow }))}</span>
              <label>${esc(t('up.classAs', 'Classified as'))}
                <select data-act="setEntity" data-f="${fi}" data-s="${si}"><option value="">— ${esc(t('up.ignore', 'Ignore / unclassified'))} —</option>${S.entityOrder.map((e) => `<option value="${e}" ${sh.entity === e ? 'selected' : ''}>${esc(entLabel(e))}</option>`).join('')}</select></label>
              <span>${esc(t('up.conf', 'Required-field coverage'))}: ${UI.badge(sh.confidence >= 0.8 ? 'High' : sh.confidence >= 0.5 ? 'Medium' : 'Low', 'conf.')} ${esc(S.fmt.pct(sh.confidence * 100, 0))}</span>
              <button class="btn sm ghost" data-act="toggleMap" data-f="${fi}" data-s="${si}">${esc(t('up.mapping', 'Column mapping'))} ▾</button></div>
            ${sh._open && sh.entity ? `<div class="mapping"><table><thead><tr><th>${esc(t('up.field', 'System field'))}</th><th>${esc(t('up.column', 'Source column'))}</th><th>${esc(t('up.sample', 'Sample'))}</th></tr></thead><tbody>${S.schema[sh.entity].fields.map((f) => `<tr class="${f.req && sh.mapping[f.key] == null ? 'miss' : ''}"><td>${esc(UI.fieldLabel(f.key))}${f.req ? ' *' : ''}</td><td><select data-act="setMap" data-f="${fi}" data-s="${si}" data-k="${f.key}"><option value="">—</option>${sh.headers.map((h, hi) => `<option value="${hi}" ${sh.mapping[f.key] === hi ? 'selected' : ''}>${esc(h || '(col ' + (hi + 1) + ')')}</option>`).join('')}</select></td><td class="muted">${sh.mapping[f.key] != null && sh.rows[0] ? esc(String(sh.rows[0][sh.mapping[f.key]] ?? '').slice(0, 40)) : ''}</td></tr>`).join('')}</tbody></table><p class="muted small">* ${esc(t('up.req', 'required for core controls — missing required fields are reported in the Data Quality report, never filled in.'))}</p></div>` : ''}
          </div>`).join('')}
          ${src.docs.map((d) => `<div class="sheet"><span>🧾 ${esc(t('up.doc', 'Document'))}: <b>${esc(d.docType)}</b> · ${esc(d.pages.length)} ${esc(t('up.pages', 'page(s)'))} · ${d.pages.map((p) => esc(p.method) + (p.method === 'ocr' ? ' ' + esc(S.fmt.pct(p.conf * 100, 0)) : '')).join(', ')}${Object.keys(d.fields).length ? ' · ' + esc(t('up.fieldsExtracted', '{n} fields extracted', { n: Object.keys(d.fields).filter((k) => !k.startsWith('_')).length })) : ''}</span></div>`).join('')}
        </div>`).join('');
      const loaded = S.state.sources;
      return `<div class="page-h"><div><h1>${esc(t('nav.upload', 'Upload & Validate'))}</h1><p class="muted">${esc(t('up.sub', 'Upload-first: every dashboard is built only from files you load here. Nothing is invented.'))}</p></div>
        <div class="btn-row"><button class="btn" data-act="templates">⤓ ${esc(t('up.templates', 'CSV templates'))}</button>${root.SUMED_NO_DEMO ? '' : `<button class="btn" data-act="demo">${esc(t('demo.start', 'Start Demo Mode'))}</button>`}</div></div>
        ${V.stepper(step)}
        <label class="drop ${busy ? 'busy' : ''}" id="dropzone">
          <input type="file" id="fileInput" multiple accept=".xlsx,.xls,.xlsm,.csv,.txt,.tsv,.json,.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,.bmp,.docx,.zip" hidden>
          <strong>⤒ ${esc(t('up.drop', 'Drag & drop files here, or click to browse'))}</strong>
          <span class="muted">${esc(t('up.types', 'Excel · CSV · PDF · scanned PDF · images · Word · ZIP · JSON — supplier master, invoices, POs, GRNs, contracts, payments, bank statements, FX, tax, GL, budget…'))}</span>
          ${busy ? `<span class="spin">${esc(t('up.parsing', 'Parsing {n} file(s)…', { n: busy }))}</span>` : ''}
        </label>
        <p class="muted small">🔒 ${esc(t('up.local', 'Files are processed locally in this browser session. Excel, PDF, Word and ZIP parsers are bundled (vendor/); OCR of scanned documents loads Tesseract on demand from cdn.jsdelivr.net. Nothing is uploaded to a server.'))}</p>
        ${pend.length ? UI.section(t('up.review', 'Step 2 — Validate classification & mapping'), pendHtml + `<div class="btn-row"><button class="btn primary" data-act="commit">✔ ${esc(t('up.commit', 'Validate & load into workspace'))}</button><button class="btn ghost" data-act="discard">${esc(t('up.discard', 'Discard'))}</button></div>`) : ''}
        ${V.ocrPanel()}
        ${UI.section(t('up.loaded', 'Loaded sources'), loaded.length ? UI.table('sources', [
          { key: 'name', label: t('up.file', 'File'), render: (s) => esc(s.name) + (s.kind === 'demo' ? ' ' + UI.demoTag() : '') },
          { key: 'classifiedAs', label: t('up.class', 'Classification') },
          { key: 'sheets', label: t('up.sheets', 'Sheets → entity (rows)'), render: (s) => s.sheets.map((x) => `${esc(x.name)} → ${x.entity ? esc(entLabel(x.entity)) : '—'} (${esc(x.loaded)})`).join('<br>'), sort: (s) => s.sheets.length },
          { key: 'status', label: t('common.status', 'Status'), render: (s) => UI.badge(s.status) },
          { key: 'uploadedBy', label: t('up.by', 'Uploaded by') },
          { key: 'uploadedAt', label: t('up.at', 'At'), render: (s) => esc(S.fmt.ts(s.uploadedAt)) },
          { key: 'hash', label: t('up.hash', 'Hash'), render: (s) => `<span class="mono small">${esc(s.hash || '—')}</span>` },
        ], loaded, { drill: () => null, exportName: 'sources' }) : `<p class="muted">${esc(t('up.none', 'No files loaded yet.'))}</p>`)}
        ${UI.section(t('up.workspace', 'Workspace'), `<p class="muted">${esc(t('up.wsNote', 'The workspace (data, settings, audit trail) is kept in this browser when storage allows. Export it to share or archive.'))}${S.state.persistWarning ? ' ⚠ ' + esc(t('up.persist.' + S.state.persistWarning, 'Workspace not persisted')) : ''}</p>
          <div class="btn-row"><button class="btn" data-act="exportWs">⤓ ${esc(t('up.exportWs', 'Export workspace (JSON)'))}</button><button class="btn danger" data-act="clearWs">${esc(t('up.clearWs', 'Clear workspace'))}</button></div>`)}`;
    },
    after(el) {
      const dz = el.querySelector('#dropzone');
      const inp = el.querySelector('#fileInput');
      if (!dz) return;
      inp.addEventListener('change', () => V.handleFiles(Array.from(inp.files)));
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
      dz.addEventListener('drop', (e) => V.handleFiles(Array.from(e.dataTransfer.files)));
    },
  };
  V.handleFiles = async (files) => {
    if (!files.length) return;
    if (!S.can('upload') && !S.can('config.edit')) { UI.toast(t('perm.denied', 'Your role does not permit this action.'), 'error'); return; }
    S.vs.parsing = files.length; S.app.render();
    const res = [];
    for (const f of files) res.push(await S.ingest.parseFile(f));
    S.vs.pending = (S.vs.pending || []).concat(res);
    S.vs.parsing = 0; S.app.render();
  };
  V.pendFlat = () => { const flat = []; const walk = (s) => { flat.push(s); (s.children || []).forEach(walk); }; (S.vs.pending || []).forEach(walk); return flat; };

  /* ------------------------------ OCR REVIEW ------------------------------ */
  V.ocrPanel = () => {
    const docs = S.state.ocrDocs.concat(V.pendFlat().flatMap((s) => s.docs.map((d) => Object.assign(d, { _pending: true, fileName: s.name }))));
    if (!docs.length) return '';
    const FIELDS = ['supplier', 'supplierName', 'invoiceNo', 'invoiceDate', 'dueDate', 'poNo', 'currency', 'subtotal', 'tax', 'discount', 'total', 'iban', 'swift', 'paymentTerms'];
    return UI.section(t('ocr.title', 'Step 3 — Extract: document OCR review'), docs.map((d) => `<div class="ocr">
      <header><b>${esc(d.name)}</b> · ${esc(d.docType)} ${UI.badge(d.status)} ${d._pending ? `<span class="muted">(${esc(t('ocr.pending', 'commit to enable posting'))})</span>` : ''}</header>
      ${d.docType === 'Invoice' ? `<table class="ocr-t"><thead><tr><th>${esc(t('up.field', 'Field'))}</th><th>${esc(t('ocr.value', 'Extracted value (editable)'))}</th><th>${esc(t('ocr.conf', 'Confidence'))}</th><th>${esc(t('ev.page', 'Page'))}</th><th>${esc(t('ocr.method', 'Method / evidence'))}</th></tr></thead><tbody>
        ${FIELDS.map((k) => { const f = d.fields[k]; const c = f ? f.confidence : null; return `<tr class="${!f ? 'miss' : c < 0.7 ? 'low' : ''}"><td>${esc(UI.fieldLabel(k))}</td><td><input class="ocr-in" data-doc="${esc(d.docId)}" data-k="${esc(k)}" value="${esc(f && f.value != null ? f.value : '')}" placeholder="${esc(t('common.na', 'Not Available in Source Data'))}" ${d._pending || !S.can('correct.ocr') ? 'disabled' : ''}>${f && f.corrected ? `<div class="small muted">✎ ${esc(t('ocr.corrected', 'corrected by {u}; original: {o}', { u: f.correctedBy, o: f.original == null ? '∅' : f.original }))}</div>` : ''}</td><td>${c == null ? UI.na('—') : `<span class="badge b-${c >= 0.9 ? 'good' : c >= 0.7 ? 'warning' : 'critical'}">${esc(S.fmt.pct(c * 100, 0))}</span>`}</td><td>${f ? esc(f.page || '—') : '—'}</td><td class="small">${f ? esc(f.method) + (f.snippet ? ` · <q>${esc(f.snippet)}</q>` : '') : ''}</td></tr>`; }).join('')}
        </tbody></table>
        ${d.fields._arithmetic ? `<p>${d.fields._arithmetic.ok ? '✔' : '⚠'} ${esc(t('ocr.arith', 'Arithmetic check: {f} = {c}', { f: d.fields._arithmetic.formula, c: S.fmt.num(d.fields._arithmetic.calc, 2) }))}</p>` : `<p class="muted">${esc(t('ocr.noArith', 'Arithmetic cross-check unavailable (subtotal or total not extracted).'))}</p>`}
        ${d.fields.lines ? `<p>${esc(t('ocr.lines', '{n} line item(s) detected (qty × unit price = amount).', { n: d.fields.lines.value.length }))}</p>` : ''}
        <p class="muted small">${esc(t('ocr.note', 'Confidence is heuristic: label-anchored patterns, OCR word confidence and arithmetic cross-checks. Every correction is written to the audit trail.'))}</p>
        ${!d._pending && d.status !== 'Posted' ? `<div class="btn-row"><button class="btn" data-act="ocrSave" data-doc="${esc(d.docId)}" ${S.can('correct.ocr') ? '' : 'disabled'}>✎ ${esc(t('ocr.save', 'Save corrections'))}</button><button class="btn primary" data-act="ocrPost" data-doc="${esc(d.docId)}" ${S.can('create.invoice') ? '' : 'disabled'}>⤓ ${esc(t('ocr.post', 'Post to invoice register'))}</button></div>` : ''}`
      : `<details><summary>${esc(t('ocr.text', 'Extracted text'))}</summary><pre class="ocr-text">${esc(d.pages.map((p) => p.text).join('\n---\n').slice(0, 6000))}</pre></details><p class="muted small">${esc(t('ocr.supporting', 'Stored as a supporting document; no structured fields are posted automatically.'))}</p>`}
    </div>`).join(''));
  };

  /* ------------------------------ DATA QUALITY ------------------------------ */
  V.quality = {
    title: () => t('nav.quality', 'Data Quality & Control Report'),
    render() {
      const R = S.R, q = R.dq, s = q.summary;
      if (!s.records) return UI.empty();
      const dr = (r) => (r ? `${S.fmt.date(r.from)} → ${S.fmt.date(r.to)}` : t('common.na', 'Not Available in Source Data'));
      return `<div class="page-h"><div><h1>${esc(t('nav.quality', 'Data Quality & Control Report'))}</h1><p class="muted">${esc(t('dq.sub', 'Validation performed before any dashboard is generated.'))} ${UI.demoTag()}</p></div><div class="btn-row"><button class="btn" data-act="report" data-id="dq">⤓ ${esc(t('rep.export', 'Export'))}</button></div></div>
        ${V.stepper(1)}
        <div class="kpis small">
          ${[['dq.files', 'Files', s.files], ['dq.records', 'Records', s.records], ['dq.suppliers', 'Suppliers', s.suppliers], ['dq.invoices', 'Invoices', s.invoices], ['dq.pos', 'Purchase orders', s.pos], ['dq.payments', 'Payments', s.payments], ['dq.bankTxns', 'Bank transactions', s.bankTxns]].map(([k, l, v]) => `<div class="kpi static"><span class="kpi-label">${esc(t(k, l))}</span><span class="kpi-value">${esc(S.fmt.num(v))}</span></div>`).join('')}
          <div class="kpi static"><span class="kpi-label">${esc(t('dq.score', 'Clean-record score'))}</span><span class="kpi-value">${esc(S.fmt.num(q.score))}<small>/100</small></span><span class="kpi-sub">${esc(t('dq.affected', '{n} records affected', { n: S.fmt.num(q.affected) }))}</span></div>
        </div>
        <div class="grid g2">
          ${UI.section(t('dq.coverage', 'Coverage'), `<table class="kv"><tr><th>${esc(t('dq.currencies', 'Currencies'))}</th><td>${esc(s.currencies.join(', ') || '—')}</td></tr>
            <tr><th>${esc(t('dq.rangeInv', 'Invoice dates'))}</th><td>${esc(dr(s.dateRanges.invoices))}</td></tr><tr><th>${esc(t('dq.rangePay', 'Payment dates'))}</th><td>${esc(dr(s.dateRanges.payments))}</td></tr>
            <tr><th>${esc(t('dq.rangePo', 'PO dates'))}</th><td>${esc(dr(s.dateRanges.pos))}</td></tr><tr><th>${esc(t('dq.rangeBank', 'Bank statement dates'))}</th><td>${esc(dr(s.dateRanges.bankTxns))}</td></tr></table>
            <h4>${esc(t('dq.entities', 'Records by entity'))}</h4><div class="chips">${Object.entries(s.byEntity).map(([e, n]) => `<span class="chip ${n ? '' : 'off'}">${esc(entLabel(e))}: <b>${esc(S.fmt.num(n))}</b></span>`).join('')}</div>`)}
          ${UI.section(t('dq.bySev', 'Issues by severity (records)'), S.chart.bars(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((k) => ({ label: t('sev.' + k), value: q.bySev[k], tone: { CRITICAL: 'critical', HIGH: 'serious', MEDIUM: 'warning', LOW: 'good' }[k] }))))}
        </div>
        ${UI.section(t('dq.issues', 'Validation findings'), UI.table('dq', [
          { key: 'severity', label: t('common.severity', 'Severity'), render: (i) => UI.sev(i.severity), sort: (i) => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 })[i.severity] },
          { key: 'check', label: t('dq.check', 'Check'), render: (i) => esc(UI.reason('dq.', i.check)) },
          { key: 'entity', label: t('dq.entity', 'Entity'), render: (i) => esc(entLabel(i.entity)) },
          { key: 'count', label: t('dq.count', 'Records'), num: true, render: (i) => UI.num(i.count) },
          { key: 'detail', label: t('dq.detail', 'Detail'), render: (i) => `<span class="small muted">${esc(i.detail || '')}</span>` },
          { key: 'ev', label: '', nosort: true, render: (i) => UI.evBtn('dq', i.id) },
        ], q.issues, { drill: () => null, pageSize: 40, exportName: 'data_quality' }))}`;
    },
  };

  /* ------------------------------ RECONCILIATION ------------------------------ */
  V.recon = {
    title: () => t('nav.recon', 'Data Reconciliation'),
    render() {
      const R = S.R;
      if (!S.state.data.invoices.length) return UI.empty();
      const g = R.recon.gl;
      return `<div class="page-h"><div><h1>${esc(t('nav.recon', 'Data Reconciliation'))}</h1><p class="muted">${esc(t('rc.sub', 'Supplier ↔ PO ↔ GRN ↔ Invoice ↔ Payment ↔ Bank ↔ GL'))} ${UI.demoTag()}</p></div></div>
        ${UI.section(t('rc.pairs', 'Register reconciliation'), UI.table('reconPairs', [
          { key: 'left', label: t('rc.left', 'Register A') }, { key: 'right', label: t('rc.right', 'Register B') },
          { key: 'population', label: t('rc.population', 'Population'), num: true, render: (p) => UI.num(p.population) },
          { key: 'ex', label: t('rc.exceptions', 'Exceptions'), num: true, render: (p) => UI.num(p.exceptions.length), sort: (p) => p.exceptions.length },
          { key: 'status', label: t('common.status', 'Status'), render: (p) => UI.badge(p.status, 'rc.') },
          { key: 'note', label: t('rc.note', 'Test'), render: (p) => `<span class="small">${esc(p.note || '')}</span>` },
          { key: 'e', label: '', nosort: true, render: (p) => (p.exceptions.length ? UI.evBtn('recon', p.id) : '') },
        ], R.recon.pairs, { drill: () => null, pageSize: 20 }))}
        <div class="grid g2">
        ${UI.section(t('rc.gl', 'GL / AP ledger vs AP sub-ledger'), g ? `<table class="kv"><tr><th>${esc(t('rc.glBal', 'GL AP balance ({p})', { p: g.period }))}</th><td>${UI.base(g.gl)}</td><td>${UI.kind('SOURCE VALUE')}</td></tr><tr><th>${esc(t('rc.sub', 'Sub-ledger (open invoices)'))}</th><td>${UI.base(g.sub)}</td><td>${UI.kind('DERIVED')}</td></tr><tr><th>${esc(t('rc.diff', 'Difference'))}</th><td>${UI.base(g.diff)}</td><td>${UI.badge(g.status, 'rc.')}</td></tr></table>${g.excludedNoFx ? `<p class="muted small">⚠ ${esc(t('rc.glNoFx', 'Sub-ledger excludes {n} invoice(s) without FX rate.', { n: g.excludedNoFx }))}</p>` : ''}<button class="btn sm" data-lineage="totalAP">${esc(t('kpi.lineage', 'Lineage'))} ›</button>` : UI.na(t('rc.noGl', 'GL / AP ledger not uploaded — reconciliation not performed')))}
        ${UI.section(t('rc.bank', 'Payment register vs bank statement'), `<div class="kpis small">${[['MATCHED', R.bank.matched], ['PARTIAL', R.bank.partial], ['UNMATCHED', R.bank.unmatched], ['EXCEPTION', R.bank.exception]].map(([k, v]) => `<div class="kpi static"><span class="kpi-label">${UI.badge(k, 'rc.')}</span><span class="kpi-value">${esc(S.fmt.num(v))}</span></div>`).join('')}</div><button class="btn" data-nav="banks">${esc(t('rc.openBank', 'Open bank reconciliation'))} ›</button>`)}
        </div>`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
