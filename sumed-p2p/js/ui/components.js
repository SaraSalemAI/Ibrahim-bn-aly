/* SUMED P2P — UI kit: values, badges, KPI tiles, tables, record drawer (drill-down chain), evidence & lineage modals. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const UI = (S.ui = S.ui || {});

  /* ---------------- Value rendering (never invents) ---------------- */
  UI.na = (label) => `<span class="na" title="${esc(t('common.na', 'Not Available in Source Data'))}">${esc(label || t('common.na', 'Not Available in Source Data'))}</span>`;
  UI.v = (val) => (val == null || val === '' ? UI.na() : esc(val));
  UI.money = (v, ccy, o) => { const s = S.fmt.money(v, ccy, o); return s == null ? UI.na() : `<span class="num${v < 0 ? ' neg' : ''}">${esc(s)}</span>`; };
  UI.base = (v, o) => UI.money(v, S.state.config.baseCurrency, o);
  UI.num = (v, d) => { const s = S.fmt.num(v, d); return s == null ? UI.na() : `<span class="num">${esc(s)}</span>`; };
  UI.pct = (v, d) => { const s = S.fmt.pct(v, d); return s == null ? UI.na() : `<span class="num">${esc(s)}</span>`; };
  UI.date = (v) => (v ? `<span class="num">${esc(S.fmt.date(v))}</span>` : UI.na());
  UI.kind = (k) => `<span class="kind kind-${esc(String(k).replace(/\s/g, '-').toLowerCase())}">${esc(t('kind.' + k))}</span>`;
  UI.demoTag = () => (S.state.mode === 'demo' ? `<span class="demo-tag" title="${esc(t('demo.tip', 'Synthetic demonstration data — not SUMED data'))}">${esc(t('demo.tag', 'DEMO / SYNTHETIC DATA'))}</span>` : '');

  const ICON = { CRITICAL: '⛔', HIGH: '▲', MEDIUM: '◆', LOW: '●', PASS: '✔', WARNING: '!', FAIL: '✖', 'NOT TESTED': '○', ok: '✔', bad: '✖', warn: '!', info: 'i' };
  const tone = (s) => {
    s = String(s || '').toUpperCase();
    if (/CRITICAL|FAIL|EXCEPTION|DUPLICATE|MISSING|REJECT|BLOCK|EXPIRED|UNMATCHED|FAILED|REVERSED|OVERDUE|HOLD|NON-COMPLIANT/.test(s)) return 'critical';
    if (/HIGH|VARIANCE|PARTIAL|WARNING|POOR|PENDING|EXPIRING|REVIEW|WATCH|INCOMPLETE/.test(s)) return 'serious';
    if (/MEDIUM|SCHEDULED|SUBMITTED|DRAFT|RECEIVED/.test(s)) return 'warning';
    if (/PASS|MATCHED|PAID|APPROVED|ACTIVE|COMPLETE|EXCELLENT|GOOD|LOW|RECONCILED|EXECUTED|CLEARED|COMPLIANT|VALID|PAY NOW/.test(s)) return 'good';
    return 'neutral';
  };
  UI.tone = tone;
  /** Status badge: icon + label (never colour alone) */
  UI.badge = (status, labelKeyPrefix, extraTitle) => {
    if (status == null || status === '') return UI.na();
    const tn = tone(status);
    const ic = ICON[String(status).toUpperCase()] || (tn === 'critical' ? '✖' : tn === 'serious' ? '▲' : tn === 'warning' ? '◆' : tn === 'good' ? '✔' : '•');
    const label = labelKeyPrefix ? t(labelKeyPrefix + status, String(status)) : t('st.' + status, String(status));
    return `<span class="badge b-${tn}" title="${esc(extraTitle || label)}"><i aria-hidden="true">${ic}</i>${esc(label)}</span>`;
  };
  UI.sev = (s) => UI.badge(s, 'sev.');

  /** Translate a coded reason "code:arg0:arg1" */
  UI.reason = (prefix, code) => {
    const parts = String(code).split(':');
    const p = {}; parts.slice(1).forEach((x, i) => (p[i] = x));
    return t(prefix + parts[0], parts[0], p);
  };

  /* ---------------- KPI tile ---------------- */
  UI.kpi = (id, opts = {}) => {
    const k = S.R && S.R.kpis[id];
    const val = opts.value !== undefined ? opts.value : k ? k.value : null;
    const unit = opts.unit || (k && k.unit);
    let shown;
    if (val == null) shown = `<span class="na">${esc(t('common.dataUnavailable', 'Data unavailable'))}</span>`;
    else if (unit === '%') shown = esc(S.fmt.pct(val));
    else if (unit === 'count') shown = esc(S.fmt.num(val));
    else if (unit === 'days') shown = esc(S.fmt.days(val));
    else if (unit === '/100') shown = esc(S.fmt.num(val, 1)) + '<small>/100</small>';
    else shown = esc(S.fmt.money(val, unit, { compact: true }));
    const label = opts.label || t('kpi.' + id, k ? k.label : id);
    const tn = opts.tone ? ` k-${opts.tone}` : '';
    return `<button class="kpi${tn}" data-lineage="${esc(id)}" title="${esc(t('kpi.tip', 'Click: source → calculation → result'))}">
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-value">${shown}</span>
      ${opts.sub ? `<span class="kpi-sub">${opts.sub}</span>` : ''}
      <span class="kpi-foot">${k ? UI.kind(k.kind) : ''}<span class="kpi-drill">${esc(t('kpi.lineage', 'Lineage'))} ›</span></span>
    </button>`;
  };

  /* ---------------- Tables (stateful: search, sort, paging, export, drill) ---------------- */
  UI.tables = {};
  /** cols: [{key, label, render(row), sort(row) , num:true, csv(row)}]; rows: array; opts: {id, drill(row)→key, pageSize, search, title, exportName, empty, rowClass} */
  UI.table = (id, cols, rows, opts = {}) => {
    const st = UI.tables[id] || (UI.tables[id] = { q: '', sort: null, dir: 1, page: 0 });
    UI.tables[id].def = { cols, rows, opts };
    return `<div class="tbl" id="tbl-${esc(id)}">${UI.tableInner(id)}</div>`;
    void st;
  };
  UI.tableInner = (id) => {
    const st = UI.tables[id];
    const { cols, rows, opts } = st.def;
    const ps = opts.pageSize || 15;
    let r = rows;
    if (st.q) {
      const q = st.q.toLowerCase();
      r = r.filter((row) => cols.some((c) => { const v = c.sort ? c.sort(row) : row[c.key]; return v != null && String(v).toLowerCase().includes(q); }) || (opts.searchText && opts.searchText(row).toLowerCase().includes(q)));
    }
    if (st.sort != null) {
      const c = cols[st.sort];
      const f = c.sort || ((x) => x[c.key]);
      r = r.slice().sort((a, b) => { const x = f(a), y = f(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
    }
    const pages = Math.max(1, Math.ceil(r.length / ps));
    if (st.page >= pages) st.page = pages - 1;
    const slice = r.slice(st.page * ps, st.page * ps + ps);
    const head = cols.map((c, i) => `<th class="${c.num ? 'n' : ''}" ${c.nosort ? '' : `data-tsort="${esc(id)}:${i}"`} scope="col">${esc(c.label)}${st.sort === i ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('');
    const body = slice.length ? slice.map((row) => {
      const dk = opts.drill ? opts.drill(row) : row._key;
      const cls = opts.rowClass ? opts.rowClass(row) : '';
      return `<tr ${dk ? `data-drill="${esc(dk)}" tabindex="0"` : ''} class="${cls}">${cols.map((c) => `<td class="${c.num ? 'n' : ''}">${c.render ? c.render(row) : UI.v(row[c.key])}</td>`).join('')}</tr>`;
    }).join('') : `<tr><td colspan="${cols.length}" class="empty">${esc(opts.empty || t('tbl.empty', 'No records'))}</td></tr>`;
    return `<div class="tbl-bar">
        ${opts.title ? `<h3>${esc(opts.title)}</h3>` : ''}
        <input type="search" class="tbl-q" data-tq="${esc(id)}" value="${esc(st.q)}" placeholder="${esc(t('tbl.filter', 'Filter rows…'))}" aria-label="${esc(t('tbl.filter', 'Filter rows…'))}">
        <span class="tbl-count">${esc(t('tbl.count', '{n} rows', { n: S.fmt.num(r.length) }))}</span>
        <button class="btn sm ghost" data-texp="${esc(id)}">⤓ CSV</button>
      </div>
      <div class="tbl-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      ${pages > 1 ? `<div class="tbl-pg"><button class="btn sm ghost" data-tpg="${esc(id)}:-1" ${st.page === 0 ? 'disabled' : ''}>‹</button><span>${st.page + 1} / ${pages}</span><button class="btn sm ghost" data-tpg="${esc(id)}:1" ${st.page >= pages - 1 ? 'disabled' : ''}>›</button></div>` : ''}`;
  };
  UI.refreshTable = (id) => { const el = document.getElementById('tbl-' + id); if (el) el.innerHTML = UI.tableInner(id); };
  UI.exportTable = (id) => {
    const { cols, rows, opts } = UI.tables[id].def;
    const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const data = [cols.map((c) => c.label).concat([t('ev.file', 'Source file'), t('ev.sheet', 'Sheet'), t('ev.row', 'Row'), 'DEMO'])];
    rows.forEach((r) => data.push(cols.map((c) => (c.csv ? c.csv(r) : c.render ? strip(c.render(r)) : r[c.key])).concat([r._src ? r._src.file : '', r._src ? r._src.sheet : '', r._src ? r._src.row : '', r._demo ? 'DEMO / SYNTHETIC' : ''])));
    U.download((opts.exportName || id) + (S.state.mode === 'demo' ? '_DEMO' : '') + '.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    S.audit('export.csv', 'table', id, { newValue: rows.length + ' rows' });
  };

  /* ---------------- Modal & drawer ---------------- */
  UI.modal = (title, html, opts = {}) => {
    const m = document.getElementById('modal');
    m.innerHTML = `<div class="modal-card ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="btn ghost" data-close="modal" aria-label="${esc(t('common.close', 'Close'))}">✕</button></header>
      <div class="modal-body">${html}</div></div>`;
    m.hidden = false;
    m.querySelector('.modal-card').focus && m.querySelector('[data-close]').focus();
  };
  UI.closeModal = () => { const m = document.getElementById('modal'); m.hidden = true; m.innerHTML = ''; };
  UI.drawer = (html) => { const d = document.getElementById('drawer'); d.innerHTML = html; d.hidden = false; d.scrollTop = 0; };
  UI.closeDrawer = () => { const d = document.getElementById('drawer'); d.hidden = true; d.innerHTML = ''; };
  UI.toast = (msg, kind = 'info') => {
    const z = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast t-' + kind; el.setAttribute('role', 'status'); el.textContent = msg;
    z.appendChild(el); setTimeout(() => el.remove(), 4200);
  };

  /* ---------------- Source / evidence rendering ---------------- */
  UI.srcLoc = (r) => {
    if (!r || !r._src) return UI.na();
    const s = r._src;
    return `<span class="src">${esc(s.file)}${s.sheet ? ` · ${esc(t('ev.sheet', 'Sheet'))} <b>${esc(s.sheet)}</b>` : ''}${s.row ? ` · ${esc(t('ev.row', 'Row'))} <b>${esc(s.row)}</b>` : ''}${s.page ? ` · ${esc(t('ev.page', 'Page'))} <b>${esc(s.page)}</b>` : ''}${r._demo ? ' ' + UI.demoTag() : ''}</span>`;
  };
  UI.recLabel = (r) => {
    if (!r) return '—';
    const e = r._entity;
    const pk = S.schema[e] && S.schema[e].pk;
    const lbl = pk && r[pk] ? r[pk] : e === 'invoiceLines' || e === 'poLines' || e === 'grnLines' ? `${r.invoiceNo || r.poNo || r.grnNo} · ${r.itemCode}` : e === 'bankChanges' ? `${r.supplierId} · ${r.changeDate}` : e === 'gl' ? r.period : e === 'supplierDocs' ? `${r.supplierId} · ${r.docType}` : r._key;
    return `${S.isAr() ? (S.schema[e] || {}).labelAr || e : (S.schema[e] || {}).label || e}: ${lbl}`;
  };
  UI.evidenceRows = (rows, max = 50) => {
    rows = (rows || []).filter(Boolean);
    if (!rows.length) return `<p class="muted">${esc(t('ev.none', 'No transaction-level evidence attached.'))}</p>`;
    return `<table class="ev"><thead><tr><th>${esc(t('ev.record', 'Record'))}</th><th>${esc(t('ev.location', 'Source file · sheet · row / page'))}</th></tr></thead><tbody>${rows.slice(0, max).map((r) => `<tr data-drill="${esc(r._key)}" tabindex="0"><td>${esc(UI.recLabel(r))}</td><td>${UI.srcLoc(r)}</td></tr>`).join('')}</tbody></table>${rows.length > max ? `<p class="muted">${esc(t('ev.more', '+ {n} more records', { n: rows.length - max }))}</p>` : ''}`;
  };
  UI.sourcesList = (srcs) => (srcs && srcs.length ? `<ul class="srcs">${srcs.map((s) => `<li>📄 <b>${esc(s.file)}</b>${s.sheet ? ` · ${esc(t('ev.sheet', 'Sheet'))}: ${esc(s.sheet)}` : ''}${s.rows ? ` · ${esc(t('ev.rows', 'Rows'))}: ${esc(s.rows)}` : ''}${s.pages ? ` · ${esc(t('ev.page', 'Page'))}: ${esc(s.pages)}` : ''} <span class="muted">(${esc(S.fmt.num(s.count))})</span>${s.demo ? ' ' + UI.demoTag() : ''}</li>`).join('')}</ul>` : `<p class="muted">${esc(t('ev.nosrc', 'No source rows'))}</p>`);

  /** Lineage modal: SOURCE → CALCULATION → RESULT */
  UI.openLineage = (id) => {
    const k = S.R.kpis[id];
    if (!k) return;
    const fmtV = (v) => (v == null ? UI.na(t('common.dataUnavailable', 'Data unavailable')) : k.unit === '%' ? UI.pct(v) : k.unit === 'count' ? UI.num(v) : k.unit === 'days' ? esc(S.fmt.days(v)) : k.unit === '/100' ? UI.num(v, 1) : UI.money(v, k.unit));
    const rows = (k.rows || []).map((x) => S.R.index.get(x.key)).filter(Boolean);
    const html = `<div class="lineage">
      <section><h4>① ${esc(t('lin.source', 'SOURCE'))}</h4>${UI.sourcesList(k.sources)}</section>
      <section><h4>② ${esc(t('lin.calc', 'CALCULATION'))}</h4><code class="formula">${esc(k.formula || '—')}</code>
        ${k.inputs.length ? `<table class="kv">${k.inputs.map((i) => `<tr><th>${esc(i.label)}</th><td>${typeof i.value === 'number' ? UI.num(i.value, Math.abs(i.value) < 100 && i.value % 1 ? 2 : 0) : UI.v(i.value)}</td></tr>`).join('')}</table>` : ''}
        ${k.assumptions.length ? `<div class="assume">${k.assumptions.map((a) => `<p>${UI.kind('ASSUMPTION')} ${esc(a)}</p>`).join('')}</div>` : ''}
        ${k.excluded.length ? `<div class="excl">${k.excluded.map((e) => `<p>⚠ ${esc(t('lin.excluded', 'Excluded'))}: <b>${esc(e.reason)}</b> — ${esc(e.count)} · <span class="muted">${esc(e.detail || '')}</span></p>`).join('')}</div>` : ''}
        ${k.note ? `<p class="muted">${esc(k.note)}</p>` : ''}</section>
      <section><h4>③ ${esc(t('lin.result', 'RESULT'))}</h4><p class="lin-result">${fmtV(k.value)} ${UI.kind(k.kind)}</p>${k.unavailable ? `<p class="na">${esc(k.unavailable)}</p>` : ''}
        ${k.route ? `<button class="btn" data-nav="${esc(k.route)}">${esc(t('lin.open', 'Open module'))} ›</button>` : ''}</section>
      <section><h4>${esc(t('lin.records', 'Contributing records'))} (${esc(S.fmt.num(rows.length))})</h4>${UI.evidenceRows(rows, 40)}</section>
    </div>`;
    UI.modal(t('kpi.' + id, k.label), html, { wide: true });
  };

  /** Evidence modal for any finding: Finding → Calculation → Transactions → Source */
  UI.openEvidence = (f) => {
    const html = `<div class="lineage">
      <section><h4>① ${esc(t('ev.finding', 'FINDING'))}</h4><p>${f.severity ? UI.sev(f.severity) + ' ' : ''}<b>${esc(f.title)}</b></p>${f.detail ? `<p>${f.detail}</p>` : ''}</section>
      <section><h4>② ${esc(t('lin.calc', 'CALCULATION'))}</h4>${f.calc ? `<code class="formula">${esc(f.calc)}</code>` : `<p class="muted">${esc(t('ev.ruleBased', 'Rule-based detection on source values (no estimation).'))}</p>`}${f.amount ? `<p>${esc(t('ev.amount', 'Amount'))}: ${f.amount}</p>` : ''}${f.action ? `<p><b>${esc(t('ev.action', 'Recommended action'))}:</b> ${esc(f.action)}</p>` : ''}${f.completeness ? `<p>${esc(t('ev.completeness', 'Evidence completeness'))}: ${UI.badge(f.completeness, 'conf.')}</p>` : ''}</section>
      <section><h4>③ ${esc(t('ev.transactions', 'TRANSACTIONS & SOURCE LOCATION'))}</h4>${UI.evidenceRows(f.rows, 60)}</section>
      <section><h4>④ ${esc(t('ev.files', 'SOURCE FILES'))}</h4>${UI.sourcesList(S.engine.sourceSummary((f.rows || []).filter(Boolean)))}</section>
    </div>`;
    UI.modal(t('ev.title', 'Evidence'), html, { wide: true });
  };
  UI.evBtn = (kind, id) => `<button class="btn sm ev-btn" data-evidence="${esc(kind)}:${esc(id)}">🔎 ${esc(t('ev.show', 'Show evidence'))}</button>`;

  /* ---------------- Record drawer with P2P chain ---------------- */
  const FIELD_HIDE = new Set(['_raw', '_issues', '_src', '_key', '_entity', '_demo', '_derived', '_edits', '_fx', '_fxNow', '_payments', '_terms', '_origin', '_ocr']);
  const SENSITIVE = new Set(['iban', 'bankAccount', 'beneficiaryIban', 'bankIban', 'oldIban', 'newIban', 'counterpartyIban', 'accountNo', 'swift']);
  UI.fieldLabel = (k) => t('f.' + k, k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()));
  UI.fieldValue = (r, k) => {
    const v = r[k];
    if (SENSITIVE.has(k) && !U.isBlank(v)) {
      const shown = S.sensitive(v, r._key + ':' + k);
      const masked = shown !== String(v);
      return `<span class="mono">${esc(shown)}</span> ${masked && S.can('view.sensitive') ? `<button class="btn sm ghost" data-act="reveal" data-key="${esc(r._key + ':' + k)}">${esc(t('sec.reveal', 'Reveal (logged)'))}</button>` : masked ? `<span class="muted">🔒 ${esc(t('sec.masked', 'masked'))}</span>` : ''}`;
    }
    if (v == null || v === '') return UI.na();
    if (typeof v === 'boolean') return esc(v ? t('common.yes', 'Yes') : t('common.no', 'No'));
    if (/date|Date$|On$/.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(v)) return UI.date(v);
    if (typeof v === 'number') return UI.num(v, Math.abs(v) < 1000 && v % 1 ? 2 : 2);
    if (k === 'supplierId' && S.R && S.R.P.sup.get(v)) return `<a data-drill="${esc(S.R.P.sup.get(v)._key)}">${esc(v)} — ${esc(S.isAr() ? S.R.P.sup.get(v).nameAr || S.R.P.sup.get(v).name : S.R.P.sup.get(v).name)}</a>`;
    return esc(typeof v === 'object' ? JSON.stringify(v) : v);
  };
  UI.recordFields = (r) => {
    const keys = Object.keys(r).filter((k) => !FIELD_HIDE.has(k) && !k.startsWith('_'));
    return `<table class="kv rec">${keys.map((k) => {
      const kind = r._derived && r._derived[k] ? 'DERIVED' : r._edits && r._edits[k] ? 'EDITED' : 'SOURCE VALUE';
      const note = r._derived && r._derived[k] ? r._derived[k] : r._edits && r._edits[k] ? t('rec.edited', 'Edited in app by {by} on {at} (was: {old})', { by: r._edits[k].by, at: r._edits[k].at.slice(0, 10), old: r._edits[k].old == null ? '∅' : r._edits[k].old }) : '';
      return `<tr><th>${esc(UI.fieldLabel(k))}</th><td>${UI.fieldValue(r, k)}${note ? `<div class="muted small">${esc(note)}</div>` : ''}</td><td class="k">${kind === 'EDITED' ? `<span class="kind kind-derived">${esc(t('kind.EDITED', 'Edited'))}</span>` : UI.kind(kind)}</td></tr>`;
    }).join('')}</table>`;
  };

  /** Build the P2P chain for any record: Supplier → PR → PO → GRN → Invoice → Approval → Payment → Bank → Reconciliation */
  UI.chain = (r) => {
    const R = S.R, D = S.state.data, P = R.P;
    let inv = null, po = null, sup = null, pays = [], grns = [], pr = null;
    const e = r._entity;
    if (e === 'invoices') inv = r;
    if (e === 'payments') { inv = P.inv.get(r.invoiceNo) || null; pays = [r]; }
    if (e === 'pos') po = r;
    if (e === 'grns') po = P.po.get(r.poNo) || null;
    if (e === 'bankTxns') { const b = R.bank.items.find((x) => x.t === r); if (b && b.p) { pays = [b.p]; inv = P.inv.get(b.p.invoiceNo) || null; } }
    if (e === 'invoiceLines') inv = P.inv.get(r.invoiceNo) || null;
    if (inv) { po = po || (inv.poNo ? P.po.get(inv.poNo) : null); if (!pays.length) pays = D.payments.filter((p) => p.invoiceNo === inv.invoiceNo); }
    if (po) { grns = P.grnsByPo.get(po.poNo) || []; pr = po.prNo ? D.prs.find((x) => x.prNo === po.prNo) : null; }
    sup = P.sup.get((inv || po || pays[0] || r).supplierId) || (e === 'suppliers' ? r : null);
    if (e === 'suppliers') return '';
    const m = inv ? R.match.get(inv._key) : null;
    const rfq = po && po.rfqNo ? D.rfqs.filter((x) => x.rfqNo === po.rfqNo) : [];
    const con = (inv && inv.contractId && P.contract.get(inv.contractId)) || (po && po.contractId && P.contract.get(po.contractId)) || null;
    const step = (label, rec, status, extra) => `<li class="${rec ? 'ok' : 'gap'}"><span class="st-l">${esc(label)}</span>${rec ? `<a data-drill="${esc(rec._key)}">${esc(UI.recLabel(rec).split(': ').pop())}</a>` : UI.na(t('chain.none', 'None'))}${status ? ' ' + status : ''}${extra ? `<div class="muted small">${extra}</div>` : ''}</li>`;
    const bankItems = pays.map((p) => R.bank.items.find((x) => x.p === p)).filter(Boolean);
    const html = [
      step(t('chain.supplier', 'Supplier'), sup, sup ? UI.badge(sup.approvedStatus) : ''),
      step(t('chain.pr', 'Purchase requisition'), pr, pr ? UI.badge(pr.status) : ''),
      step(t('chain.rfq', 'RFQ / quotations'), rfq[0] || null, rfq.length ? esc(t('chain.quotes', '{n} quote(s)', { n: rfq.length })) : ''),
      step(t('chain.contract', 'Contract'), con, con ? UI.badge(con.status) : ''),
      step(t('chain.po', 'Purchase order'), po, po ? UI.badge(po.status) : ''),
      grns.length ? grns.map((g) => step(t('chain.grn', 'Goods / service receipt'), g, UI.date(g.receiptDate))).join('') : step(t('chain.grn', 'Goods / service receipt'), null),
      step(t('chain.invoice', 'Invoice'), inv, m ? UI.badge(m.status, 'm.') : ''),
      `<li class="${inv && /approved/i.test(inv.approvalStatus || '') ? 'ok' : 'gap'}"><span class="st-l">${esc(t('chain.approval', 'Approval'))}</span>${inv ? UI.badge(inv.approvalStatus || '—') + (inv.approvedBy ? ` ${esc(t('chain.by', 'by'))} <b>${esc(inv.approvedBy)}</b>` : '') : UI.na()}</li>`,
      pays.length ? pays.map((p) => step(t('chain.payment', 'Payment'), p, UI.badge(p.executionStatus), p.batchId ? esc(t('chain.batch', 'Batch')) + ' ' + esc(p.batchId) : '')).join('') : step(t('chain.payment', 'Payment'), null),
      bankItems.length ? bankItems.map((b) => step(t('chain.bank', 'Bank transaction'), b.t, b.t ? UI.date(b.t.date) : '')).join('') : step(t('chain.bank', 'Bank transaction'), null),
      bankItems.length ? bankItems.map((b) => `<li class="${b.status === 'MATCHED' ? 'ok' : 'gap'}"><span class="st-l">${esc(t('chain.recon', 'Reconciliation'))}</span>${UI.badge(b.status, 'rc.')} <span class="muted">${esc(t('br.' + b.type))}</span></li>`).join('') : `<li class="gap"><span class="st-l">${esc(t('chain.recon', 'Reconciliation'))}</span>${UI.na(t('chain.notRec', 'Not reconciled'))}</li>`,
    ].join('');
    return `<section class="chain"><h4>${esc(t('chain.title', 'Supplier → Invoice → PO → GRN → Approval → Payment → Bank → Reconciliation'))}</h4><ol>${html}</ol></section>`;
  };

  UI.openRecord = (key) => {
    const r = S.R.index.get(key);
    if (!r) return;
    if (r._entity === 'suppliers') { location.hash = '#/supplier/' + encodeURIComponent(r.supplierId); return; }
    const e = r._entity;
    const m = e === 'invoices' ? S.R.match.get(r._key) : null;
    const alerts = S.R.alerts.list.filter((a) => a.rows.includes(r));
    let extra = '';
    if (e === 'invoices') {
      extra += `<section><h4>${esc(t('inv.position', 'AP position'))}</h4><table class="kv">
        <tr><th>${esc(t('f.total', 'Total'))}</th><td>${UI.money(r.total, r.currency)}</td><td>${UI.kind(r._derived && r._derived.total ? 'DERIVED' : 'SOURCE VALUE')}</td></tr>
        <tr><th>${esc(t('f.paidAmount', 'Paid amount'))}</th><td>${UI.money(r._paid, r.currency)}</td><td>${UI.kind(r._paidKind)}</td></tr>
        <tr><th>${esc(t('f.outstanding', 'Outstanding'))}</th><td>${UI.money(r._out, r.currency)}${r._debitBalance ? ' ' + UI.badge(t('inv.debit', 'Supplier debit balance')) : ''}</td><td>${UI.kind(r._outKind)}</td></tr>
        <tr><th>${esc(t('fx.rate', 'FX rate'))}</th><td>${r._fxNow ? esc(S.fmt.num(r._fxNow.rate, 4)) + ` <span class="muted">(${esc(r._fxNow.date || '')} · ${esc(r._fxNow.source)})</span>` : `<span class="na">${esc(t('fx.na', 'FX RATE NOT AVAILABLE'))}</span>`}</td><td>${UI.kind('SOURCE VALUE')}</td></tr>
        <tr><th>${esc(t('inv.outBase', 'Outstanding ({ccy})', { ccy: S.state.config.baseCurrency }))}</th><td>${UI.base(r._outBase)}</td><td>${UI.kind('DERIVED')}</td></tr>
        <tr><th>${esc(t('inv.dpd', 'Days past due'))}</th><td>${r._dpd == null ? UI.na() : UI.num(r._dpd)}</td><td>${UI.kind('DERIVED')}</td></tr></table></section>`;
      if (m) extra += UI.matchPanel(r, m);
      extra += `<div class="btn-row">${S.views && S.views.invoiceActions ? S.views.invoiceActions(r) : ''}</div>`;
    }
    const html = `<header class="dr-h"><div><span class="muted">${esc(S.isAr() ? (S.schema[e] || {}).labelAr : (S.schema[e] || {}).label)}</span><h2>${esc(UI.recLabel(r).split(': ').pop())}</h2>${UI.srcLoc(r)}</div><button class="btn ghost" data-close="drawer" aria-label="${esc(t('common.close', 'Close'))}">✕</button></header>
      ${UI.chain(r)}
      ${extra}
      ${alerts.length ? `<section><h4>${esc(t('rec.alerts', 'Red flags on this record'))}</h4>${alerts.map((a) => `<div class="flag">${UI.sev(a.severity)} ${esc(t('rule.' + a.rule, a.rule, a.params))} ${UI.evBtn('alert', a.id)}</div>`).join('')}</section>` : ''}
      <section><h4>${esc(t('rec.fields', 'Record fields'))}</h4>${UI.recordFields(r)}</section>
      ${r._issues && r._issues.length ? `<section><h4>${esc(t('rec.issues', 'Parsing issues'))}</h4>${r._issues.map((i) => `<p>⚠ ${esc(UI.fieldLabel(i.field))}: ${esc(i.issue)} — "${esc(i.raw)}"</p>`).join('')}</section>` : ''}`;
    UI.drawer(html);
  };

  UI.matchPanel = (inv, m) => {
    const ccy = inv.currency;
    return `<section><h4>${esc(t('m.title', 'Three-way match'))} ${UI.badge(m.status, 'm.')}</h4>
      <table class="kv"><tr><th>${esc(t('m.po', 'PO amount'))}</th><td>${UI.money(m.poAmount, ccy)}</td></tr>
      <tr><th>${esc(t('m.grn', 'GRN amount (accepted × PO price)'))}</th><td>${UI.money(m.grnAmount, ccy)}</td></tr>
      ${m.expectedValue != null ? `<tr><th>${esc(t('m.expected', 'Receipt value attributable to this invoice'))}</th><td>${UI.money(m.expectedValue, ccy)}</td></tr>` : ''}
      <tr><th>${esc(t('m.inv', 'Invoice amount (net)'))}</th><td>${UI.money(m.invAmount, ccy)}</td></tr>
      <tr><th>${esc(t('m.variance', 'Variance'))}</th><td>${UI.money(m.variance, ccy)} ${m.variancePct != null ? '(' + esc(S.fmt.pct(m.variancePct, 2)) + ')' : ''}</td></tr>
      <tr><th>${esc(t('m.basis', 'Basis'))}</th><td>${esc(m.basis ? t('m.basis.' + m.basis, m.basis === 'line' ? 'Line level' : 'Header level') : '—')}</td></tr></table>
      ${m.lines.length ? `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('f.itemCode', 'Item'))}</th><th class="n">${esc(t('m.poQty', 'PO qty'))}</th><th class="n">${esc(t('m.recQty', 'Received'))}</th><th class="n">${esc(t('m.availQty', 'Available'))}</th><th class="n">${esc(t('m.invQty', 'Invoiced'))}</th><th class="n">${esc(t('m.poPrice', 'PO price'))}</th><th class="n">${esc(t('m.invPrice', 'Inv. price'))}</th><th class="n">Δ%</th><th>${esc(t('common.status', 'Status'))}</th></tr></thead><tbody>${m.lines.map((l) => `<tr><td>${esc(l.itemCode)}</td><td class="n">${UI.num(l.poQty)}</td><td class="n">${UI.num(l.recQty)}</td><td class="n">${UI.num(l.availQty)}</td><td class="n">${UI.num(l.invQty)}</td><td class="n">${UI.num(l.poPrice, 2)}</td><td class="n">${UI.num(l.invPrice, 2)}</td><td class="n">${UI.pct(l.priceVarPct, 2)}</td><td>${UI.badge(l.status, 'm.')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <ul class="reasons">${m.reasons.map((x) => `<li>${esc(UI.reason('mr.', x))}</li>`).join('')}</ul></section>`;
  };

  /* ---------------- Misc ---------------- */
  UI.section = (title, body, opts = {}) => `<section class="card ${opts.cls || ''}">${title ? `<header class="card-h"><h3>${esc(title)}</h3>${opts.right || ''}</header>` : ''}<div class="card-b">${body}</div></section>`;
  UI.tabs = (id, tabs, active) => `<nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === active}" class="${k === active ? 'on' : ''}" data-tab="${esc(id)}:${esc(k)}">${esc(l)}</button>`).join('')}</nav>`;
  UI.empty = (msg) => `<div class="empty-state"><p>${esc(msg || t(root.SUMED_NO_DEMO ? 'common.noDataUp' : 'common.noData', root.SUMED_NO_DEMO ? 'No data loaded yet. Upload your source files to begin.' : 'No data loaded. Upload source files or start Demo Mode.'))}</p><div class="btn-row"><button class="btn primary" data-nav="upload">⤒ ${esc(t('nav.upload', 'Upload & Validate'))}</button>${root.SUMED_NO_DEMO ? '' : `<button class="btn" data-act="demo">${esc(t('demo.start', 'Start Demo Mode'))}</button>`}</div></div>`;
  UI.supName = (sid) => { const s = S.R && S.R.P.sup.get(sid); return s ? (S.isAr() ? s.nameAr || s.name : s.name) : sid ? sid + ' (' + t('common.notInMaster', 'not in master') + ')' : null; };
  UI.supLink = (sid) => { const s = S.R && S.R.P.sup.get(sid); return s ? `<a data-drill="${esc(s._key)}">${esc(UI.supName(sid))}</a>` : UI.v(UI.supName(sid)); };
})(typeof window !== 'undefined' ? window : globalThis);
