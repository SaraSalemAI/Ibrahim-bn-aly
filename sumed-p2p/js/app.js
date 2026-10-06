/* SUMED P2P — application shell: router, navigation, header, events, evidence resolver, workflows, API. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui, V = S.views, E = S.engine;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const A = (S.app = {});
  S.state.alertStatus = S.state.alertStatus || {};

  /* ---------------- Navigation ---------------- */
  A.NAV = [
    ['exec', [['dashboard', '◧', 'CFO Dashboard'], ['actions', '⚡', 'CFO Action Center'], ['summary', '📝', 'Management Summary'], ['insights', '✦', 'AI Insights']]],
    ['data', [['upload', '⤒', 'Upload & Validate'], ['quality', '✓', 'Data Quality'], ['recon', '⇄', 'Reconciliation']]],
    ['suppliers', [['suppliers', '▣', 'Suppliers'], ['onboarding', '➜', 'Supplier Onboarding'], ['performance', '★', 'Supplier Performance'], ['risk', '⚠', 'Risk & Compliance']]],
    ['p2p', [['procurement', '⛓', 'Procurement'], ['pos', '📄', 'Purchase Orders'], ['contracts', '§', 'Contracts'], ['invoices', '🧾', 'Invoices'], ['matching', '≡', 'Three-Way Matching'], ['duplicates', '⧉', 'Duplicate Detection'], ['disputes', '⚑', 'Disputes']]],
    ['treasury', [['payments', '💳', 'Payments'], ['calendar', '📅', 'Payment Calendar'], ['aging', '⏳', 'AP Aging'], ['treasury', '🏛', 'Treasury'], ['banks', '🏦', 'Banks']]],
    ['analytics', [['spend', '◔', 'Spend Analytics'], ['savings', '↘', 'Cost Reduction & WC']]],
    ['control', [['fraud', '⛔', 'Fraud & Anomalies'], ['controls', '🛡', 'Controls'], ['tax', '%', 'Tax & FX'], ['audit', '🔒', 'Audit Trail']]],
    ['admin', [['reports', '⤓', 'Reports'], ['settings', '⚙', 'Settings']]],
  ];
  const GROUP = { exec: 'Executive', data: 'Data', suppliers: 'Suppliers', p2p: 'Procure-to-Pay', treasury: 'Payments & Treasury', analytics: 'Analytics', control: 'Control & Audit', admin: 'Administration' };

  A.route = () => {
    const h = (location.hash || '').replace(/^#\/?/, '');
    const [r, ...rest] = h.split('/');
    return { name: r || (S.state.mode === 'empty' ? 'upload' : 'dashboard'), param: rest.join('/') };
  };

  /* ---------------- Shell ---------------- */
  A.shell = () => {
    const app = document.getElementById('app');
    if (app.dataset.ready) return;
    app.dataset.ready = '1';
    app.innerHTML = `<a class="skip" href="#main">Skip to content</a><header id="top"></header><div class="body"><nav id="nav" aria-label="Main"></nav><main id="main" tabindex="-1"></main></div>
      <aside id="drawer" hidden aria-label="Record"></aside><div id="modal" hidden></div><div id="tip" role="tooltip" hidden></div><div id="toasts" aria-live="polite"></div>`;
  };
  A.header = () => {
    const s = S.state, mode = s.mode;
    const users = s.data.users.filter((u) => u.active !== false);
    const inDir = users.some((u) => u.userId === s.session.userId);
    const sessionOpts = (users.length && !inDir ? `<option value="" selected>${esc(s.session.name)} — ${esc(t('role.' + s.session.role, s.session.role))}</option>` : '') + (users.length ? users.map((u) => `<option value="u:${esc(u.userId)}" ${s.session.userId === u.userId ? 'selected' : ''}>${esc(u.name)} — ${esc(t('role.' + u.role, u.role))}</option>`).join('') : Object.keys(s.roles).map((r) => `<option value="r:${esc(r)}" ${s.session.role === r ? 'selected' : ''}>${esc(t('role.' + r, r))}</option>`).join(''));
    return `<div class="brand"><span class="logo" aria-hidden="true">S</span><div><b>${esc(t('app.name', 'SUMED Supplier & Payments'))}</b><small>${esc(t('app.org', 'Arab Petroleum Pipelines Company · Alexandria'))}</small></div></div>
      <span class="mode m-${mode}" title="${esc(mode === 'demo' ? t('demo.tip', 'Synthetic demonstration data — not SUMED data') : '')}">${esc(t('mode.' + mode))}</span>
      <div class="gsearch"><input id="gsearch" type="search" placeholder="${esc(t('search.ph', 'Search supplier, invoice, PO, contract, payment, bank ref, user, project… ( / )'))}" aria-label="${esc(t('search.label', 'Global search'))}" autocomplete="off"><div id="gresults" hidden></div></div>
      <label class="asof">${esc(t('hdr.asOf', 'As of'))} <input type="date" id="asof" value="${esc(s.config.asOfDate || U.todayISO())}"></label>
      <label class="sess" title="${esc(t('hdr.session', 'Signed-in user / role (role-based access)'))}">👤 <select id="session">${sessionOpts}</select></label>
      <div class="seg" role="group" aria-label="Language"><button class="${S.lang() === 'en' ? 'on' : ''}" data-lang="en">ENGLISH</button><button class="${S.lang() === 'ar' ? 'on' : ''}" data-lang="ar" lang="ar">العربية</button></div>
      <button class="btn ghost icon" id="theme" title="${esc(t('hdr.theme', 'Light / dark mode'))}" aria-label="${esc(t('hdr.theme', 'Light / dark mode'))}">${A.isDark() ? '☀' : '☾'}</button>`;
  };
  A.isDark = () => document.documentElement.getAttribute('data-theme') === 'dark' || (document.documentElement.getAttribute('data-theme') !== 'light' && root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
  A.nav = (active) => A.NAV.map(([g, items]) => `<div class="ng"><h4>${esc(t('ng.' + g, GROUP[g]))}</h4>${items.map(([id, ic, l]) => `<a href="#/${id}" class="${active === id || (active === 'supplier' && id === 'suppliers') ? 'on' : ''}" ${active === id ? 'aria-current="page"' : ''}><i aria-hidden="true">${ic}</i><span>${esc(t('nav.' + id, l))}</span>${A.badgeFor(id)}</a>`).join('')}</div>`).join('') + `<p class="nav-foot">${esc(t('nav.foot', 'Evidence-first · no invented data'))}</p>`;
  A.badgeFor = (id) => {
    const R = S.R;
    if (!R) return '';
    const n = id === 'actions' ? R.actions.filter((a) => a.bucket === 'today').length : id === 'fraud' ? R.redFlags.filter((f) => f.severity === 'CRITICAL').length : id === 'controls' ? R.controls.summary.FAIL : id === 'quality' ? R.dq.issues.filter((i) => i.severity === 'CRITICAL').length : 0;
    return n ? `<em class="nb">${n}</em>` : '';
  };

  A.render = () => {
    A.shell();
    const html = document.documentElement;
    html.lang = S.lang();
    html.dir = S.isAr() ? 'rtl' : 'ltr';
    // Theme: only touch data-theme when the user chose one in the app (a host page may set its own).
    const th = S.state.prefs.theme;
    if (th !== 'auto') { html.setAttribute('data-theme', th); A._themeSet = true; } else if (A._themeSet) { html.removeAttribute('data-theme'); A._themeSet = false; }
    const r = A.route();
    const view = V[r.name] || V.dashboard;
    document.getElementById('top').innerHTML = A.header();
    document.getElementById('nav').innerHTML = A.nav(r.name);
    const main = document.getElementById('main');
    let out;
    try { out = view.render(r.param); } catch (e) { console.error(e); out = `<div class="warnbar crit">⚠ ${esc(t('err.render', 'This view could not be rendered from the current data.'))}<pre class="small">${esc(e.stack || e)}</pre></div>`; }
    main.innerHTML = `<div class="proto-note" role="note">${esc(t('app.disclaimer', 'Independent prototype built for SUMED — not an official SUMED system.'))}${root.SUMED_ARTIFACT ? ' ' + esc(t('app.webNote', 'Shared web view: exports ask before saving; PDF reports save as a print-ready HTML file; OCR of scanned images needs the local app.')) : ''}</div>` + (S.state.mode === 'demo' ? `<div class="demo-banner" role="note">${esc(t('demo.banner', 'DEMO MODE — all figures are synthetic sample data generated for demonstration. They are not SUMED data. Upload source files to analyse real data.'))}</div>` : '') + out;
    document.title = `${view.title ? view.title() : ''} · ${t('app.short', 'SUMED P2P')}`;
    if (view.after) view.after(main);
  };
  A.rerun = () => { E.run(); A.render(); };

  /* ---------------- Evidence resolver ---------------- */
  S.evidence = (kind, id) => {
    const R = S.R, D = S.state.data;
    const byKey = (k) => R.index.get(k);
    switch (kind) {
      case 'alert': case 'flag': { const a = R.redFlags.find((x) => x.id === id) || R.alerts.list.find((x) => x.id === id); return a && { title: `${t('cat.' + a.category)} — ${S.alertText(a)}`, severity: a.severity, detail: `${esc(t('f.supplierId', 'Supplier'))}: ${esc(UI.supName(a.supplierId) || '—')} · ${esc(t('rf.txn', 'Transaction'))}: ${esc(a.txn || '—')}`, rows: a.rows, calc: a.calc, amount: a.amountBase != null ? UI.base(a.amountBase) : a.amount != null ? UI.money(a.amount, a.currency) : null, action: t('act.' + a.action), completeness: a.rows.every((r) => r && r._src) ? 'High' : 'Medium' }; }
      case 'insight': { const i = R.insights.find((x) => x.id === id); return i && { title: S.insightText(i, 'o'), severity: i.priority, detail: esc(S.insightText(i, 'w')), rows: i.rows, calc: i.calc, amount: i.impact != null ? UI.base(i.impact) : null, action: S.insightText(i, 'a'), completeness: i.completeness }; }
      case 'action': { const a = R.actions.find((x) => x.id === id); return a && { title: t('ac.' + a.key, a.key, a.params), rows: a.rows, action: t('act.' + a.rec), amount: a.impact != null ? UI.base(a.impact) : null }; }
      case 'sum': { const x = (S.vs.summary || V.buildSummary())[+id]; return x && { title: x.text, severity: x.sev, rows: x.rows, calc: x.calc }; }
      case 'dq': { const i = R.dq.issues.find((x) => x.id === id); return i && { title: UI.reason('dq.', i.check), severity: i.severity, detail: esc(i.detail || ''), rows: i.rows }; }
      case 'ctl': { const c = R.controls.tests.find((x) => x.id === id); return c && { title: `${c.id} ${t('ct.' + c.id)} — ${t('ctl.' + c.status)}`, severity: c.status === 'FAIL' ? 'HIGH' : 'MEDIUM', detail: esc(t('ctl.pop', 'Population {p} · exceptions {n}', { p: c.population, n: c.count })), rows: c.exceptions }; }
      case 'sav': { const s = R.savings.find((x) => x.id === id); return s && { title: t('sv.' + s.type), rows: s.rows, calc: s.method, amount: s.saving != null ? UI.base(s.saving) : null, completeness: s.confidence }; }
      case 'risk': { const r = R.risk.get(id); return r && { title: t('risk.explain', 'Supplier risk is {r} ({s}/100) because:', { r: t('sev.' + r.rating), s: r.score }) + ' ' + UI.supName(id), severity: r.rating, detail: `<ol>${r.drivers.map((d) => `<li>+${d.points} ${esc(S.driverText(d))}</li>`).join('')}</ol>`, rows: r.drivers.flatMap((d) => d.rows).concat([R.P.sup.get(id)]), calc: t('risk.calc', 'Score = Σ driver points (capped at 100); bands configurable'), completeness: r.completeness >= 80 ? 'High' : r.completeness >= 50 ? 'Medium' : 'Low' }; }
      case 'driver': { const [sid, k] = id.split('|'); const d = R.risk.get(sid).drivers.find((x) => x.key === k); return d && { title: S.driverText(d), rows: d.rows }; }
      case 'dup': { const d = R.dupInv.list.find((x) => x.id === id); return d && { title: `${t('dup.' + d.level)}: ${d.aNo} ↔ ${d.bNo}`, severity: d.level === 'POSSIBLE DUPLICATE' ? 'MEDIUM' : 'HIGH', detail: esc(d.reasons.map((x) => UI.reason('sig.', x)).join(' · ')), rows: [byKey(d.a), byKey(d.b)], amount: UI.money(d.amount, d.currency) }; }
      case 'dpay': { const d = R.dupPay.find((x) => x.id === id); return d && { title: `${t('dup.' + d.level)}: ${d.aId} ↔ ${d.bId}`, severity: 'CRITICAL', detail: esc(d.reasons.map((x) => UI.reason('sig.', x)).join(' · ')), rows: [byKey(d.a), byKey(d.b)], amount: UI.money(d.amount, d.currency) }; }
      case 'recon': { const p = R.recon.pairs.find((x) => x.id === id); return p && { title: `${p.left} ↔ ${p.right}`, detail: esc(p.note || ''), rows: p.exceptions }; }
      case 'auto': { const a = R.autoAlerts.find((x) => x.type === id); return a && { title: t('aa.' + a.type, a.type, a.params), rows: a.rows }; }
      case 'wcEarly': return { title: t('wc.early', 'Paid > 5 days before due date (no discount)'), rows: R.wc.early.map((x) => x.p), calc: 'payment date < due date − 5 days AND no discount terms captured' };
      default: return null;
    }
  };

  /* ---------------- Forms (modal) ---------------- */
  UI.form = (title, fields, onSubmit, opts = {}) => {
    const html = `<form id="mform" class="mform">${opts.intro ? `<p>${opts.intro}</p>` : ''}${fields.map((f) => `<label><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${f.type === 'select' ? `<select name="${esc(f.name)}">${f.options.map((o) => `<option value="${esc(o[0])}" ${o[0] === f.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>` : f.type === 'textarea' ? `<textarea name="${esc(f.name)}" rows="3" ${f.required ? 'required' : ''}>${esc(f.value || '')}</textarea>` : `<input name="${esc(f.name)}" type="${f.type || 'text'}" value="${esc(f.value == null ? '' : f.value)}" ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''}>`}</label>`).join('')}
      <div class="btn-row"><button class="btn primary" type="submit">${esc(opts.submit || t('common.confirm', 'Confirm'))}</button><button class="btn ghost" type="button" data-close="modal">${esc(t('common.cancel', 'Cancel'))}</button></div></form>`;
    UI.modal(title, html);
    document.getElementById('mform').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target).entries());
      const missing = fields.find((f) => f.required && !String(v[f.name] || '').trim());
      if (missing) { UI.toast(t('form.required', 'Required: {f}', { f: missing.label }), 'error'); return; }
      const res = onSubmit(v);
      if (res !== false) UI.closeModal();
    });
  };
  const deny = (msg) => { UI.toast(msg || t('perm.denied', 'Your role does not permit this action.'), 'error'); return false; };
  const me = () => S.state.session.userId;
  const userRole = (u) => ((S.R.P.users.get(u) || {}).role) || (u === me() ? S.state.session.role : null);

  /* ---------------- Workflows ---------------- */
  const W = (A.workflows = {});
  /** Invoice approval — multi-level per approval matrix, SoD enforced, override reason for exceptions. */
  W.invApprove = (key) => {
    if (!S.can('approve.invoice')) return deny();
    const inv = S.R.index.get(key);
    if (!inv) return;
    if (inv.enteredBy && inv.enteredBy === me()) return deny(t('sod.selfApprove', 'Segregation of duties: you entered this invoice and cannot approve it.'));
    const approvals = Array.isArray(inv.approvals) ? inv.approvals.slice() : [];
    if (approvals.some((a) => a.user === me())) return deny(t('wf.already', 'You have already approved this document.'));
    const m = S.R.match.get(inv._key);
    const risk = S.R.risk.get(inv.supplierId);
    const req = E.requiredApprovers(inv._totalBase, { currency: inv.currency, emergency: inv.emergency, nonPO: !inv.poNo, supplierRisk: risk && risk.rating }, S.state.config);
    const exception = m && !['MATCHED', 'PARTIALLY MATCHED'].includes(m.status);
    const go = (reason) => {
      approvals.push({ user: me(), role: S.state.session.role, at: new Date().toISOString(), reason: reason || null });
      S.updateRecord('invoices', inv, 'approvals', approvals, reason, exception ? 'invoice.approve.override' : 'invoice.approve');
      // coverage check
      const pool = approvals.map((a) => ({ u: a.user, rank: E.ROLE_RANK[a.role] || 0, role: a.role })).sort((a, b) => b.rank - a.rank);
      const used = new Set(); const missing = [];
      req.roles.map((r) => ({ r, rank: E.ROLE_RANK[r] || 1 })).sort((a, b) => b.rank - a.rank).forEach((n) => { const c = pool.find((p) => !used.has(p.u) && (p.role === n.r || p.rank >= n.rank)); if (c) used.add(c.u); else missing.push(n.r); });
      if (!missing.length) {
        S.updateRecord('invoices', inv, 'approvalStatus', 'Approved', reason, 'invoice.approve.final');
        S.updateRecord('invoices', inv, 'approvedBy', me(), null, 'invoice.approve.final');
        S.updateRecord('invoices', inv, 'approvedDate', S.R.asOf, null, 'invoice.approve.final');
        S.updateRecord('invoices', inv, 'approvedAmount', inv.total, null, 'invoice.approve.final');
        UI.toast(t('wf.invApproved', 'Invoice {n} fully approved.', { n: inv.invoiceNo }), 'ok');
      } else UI.toast(t('wf.invPartial', 'Approval recorded. Still required: {r}', { r: missing.map((r) => t('role.' + r, r)).join(' + ') }), 'info');
      S.emit('data');
    };
    UI.form(t('inv.approve', 'Approve invoice') + ' ' + inv.invoiceNo, exception ? [{ name: 'reason', label: t('wf.override', 'Override reason (match status: {s})', { s: t('m.' + m.status) }), type: 'textarea', required: true }] : [{ name: 'reason', label: t('wf.comment', 'Comment (optional)'), type: 'textarea' }], (v) => go(v.reason), { intro: esc(t('wf.required', 'Required approvals (matrix tier {tier}): {r}', { tier: req.tier || '—', r: req.roles.map((r) => t('role.' + r, r)).join(' + ') })) + (approvals.length ? '<br>' + esc(t('wf.sofar', 'Approved so far: {a}', { a: approvals.map((a) => a.user + ' (' + a.role + ')').join(', ') })) : '') + (exception ? `<br><b class="neg">⚠ ${esc(t('wf.excWarn', 'This invoice has a three-way match exception. Approval requires a documented override.'))}</b>` : '') });
  };
  W.invReject = (key) => {
    if (!S.can('approve.invoice')) return deny();
    const inv = S.R.index.get(key);
    UI.form(t('inv.reject', 'Reject') + ' ' + inv.invoiceNo, [{ name: 'reason', label: t('wf.reason', 'Reason'), type: 'textarea', required: true }], (v) => { S.updateRecord('invoices', inv, 'approvalStatus', 'Rejected', v.reason, 'invoice.reject'); S.updateRecord('invoices', inv, 'status', 'Rejected', v.reason, 'invoice.reject'); S.emit('data'); });
  };
  W.dispute = (key) => {
    if (!S.can('manage.disputes') && !S.can('approve.invoice')) return deny();
    const inv = key ? S.R.index.get(key) : null;
    const types = ['Invoice dispute', 'Supplier dispute', 'Price dispute', 'Quantity dispute', 'Quality dispute', 'Contract dispute', 'Tax dispute', 'Payment dispute'];
    UI.form(t('dsp.raise', 'Raise dispute'), [
      { name: 'type', label: t('f.type', 'Type'), type: 'select', options: types.map((x) => [x, t('dsp.' + x, x)]) },
      { name: 'supplierId', label: t('f.supplierId', 'Supplier'), type: 'select', value: inv && inv.supplierId, options: S.state.data.suppliers.map((s) => [s.supplierId, s.supplierId + ' — ' + s.name]) },
      { name: 'invoiceNo', label: t('f.invoiceNo', 'Invoice'), value: inv ? inv.invoiceNo : '' },
      { name: 'issue', label: t('f.issue', 'Issue'), type: 'textarea', required: true },
      { name: 'owner', label: t('f.owner', 'Owner'), value: me(), required: true },
      { name: 'targetDate', label: t('f.targetDate', 'Resolution target'), type: 'date', value: U.addDays(S.R.asOf, 14), required: true },
    ], (v) => {
      const i = S.R.P.inv.get(v.invoiceNo);
      S.addRecord('disputes', { disputeId: 'DSP-APP-' + String(S.state.data.disputes.length + 1).padStart(3, '0'), type: v.type, supplierId: v.supplierId, invoiceNo: v.invoiceNo || null, amount: i ? i.total : null, currency: i ? i.currency : null, issue: v.issue, owner: v.owner, raisedDate: S.R.asOf, targetDate: v.targetDate, status: 'Open', rootCause: null, resolution: null }, 'dispute.create');
      S.emit('data');
    });
  };
  W.disputeResolve = (key) => {
    const d = S.R.index.get(key);
    if (!S.can('manage.disputes')) return deny();
    UI.form(t('dsp.resolve', 'Resolve') + ' ' + d.disputeId, [{ name: 'rootCause', label: t('f.rootCause', 'Root cause'), type: 'textarea', required: true }, { name: 'resolution', label: t('f.resolution', 'Resolution'), type: 'textarea', required: true }], (v) => { S.updateRecord('disputes', d, 'rootCause', v.rootCause, null, 'dispute.update'); S.updateRecord('disputes', d, 'resolution', v.resolution, null, 'dispute.update'); S.updateRecord('disputes', d, 'status', 'Resolved', v.resolution, 'dispute.resolve'); S.emit('data'); });
  };

  /** Create payment batch(es) from selected, unblocked priority items. Never executes. */
  W.createBatch = () => {
    if (!S.can('create.batch')) return deny();
    const sel = S.vs.paySel || new Set();
    const items = S.R.priority.filter((x) => sel.has(x.key) && !x.blocks.length);
    if (!items.length) return UI.toast(t('pay.selectFirst', 'Select at least one unblocked invoice.'), 'error');
    let nd = U.addDays(S.R.asOf, 1);
    while (S.state.config.weekendDays.includes(U.dow(nd))) nd = U.addDays(nd, 1);
    UI.form(t('pay.createBatch', 'Create payment batch'), [{ name: 'date', label: t('f.paymentDate', 'Payment date'), type: 'date', value: nd, required: true }, { name: 'note', label: t('wf.comment', 'Comment'), type: 'textarea' }], (v) => {
      const D = S.state.data;
      const created = [];
      for (const [cc, its] of U.groupBy(items, (x) => x.inv.currency)) {
        const acc = D.bankAccounts.filter((b) => b.currency === cc).sort((a, b) => (b.availableBalance || 0) - (a.availableBalance || 0))[0];
        if (!acc) { UI.toast(t('pay.noAcc', 'No company bank account in {c} — batch not created for these invoices.', { c: cc }), 'error'); continue; }
        const yr = v.date.slice(0, 4);
        const seq = D.batches.filter((b) => new RegExp('^PB-' + yr + '-\\d+$').test(String(b.batchId))).length + 1;
        const batchId = `PB-${yr}-${String(seq).padStart(3, '0')}`;
        const b = S.addRecord('batches', { batchId, createdDate: S.R.asOf, paymentDate: v.date, bankAccountId: acc.accountId, currency: cc, createdBy: me(), treasuryApprovedBy: null, cfoApprovedBy: null, status: 'Pending Approval', note: v.note || null }, 'batch.create', v.note);
        its.forEach((x, i) => {
          const inv = x.inv, s = S.R.P.sup.get(inv.supplierId) || {};
          const wht = inv.total ? (inv.wht || 0) * (inv._out / inv.total) : 0;
          S.addRecord('payments', { paymentId: `PAY-${batchId}-${String(i + 1).padStart(3, '0')}`, supplierId: inv.supplierId, invoiceNo: inv.invoiceNo, poNo: inv.poNo, paymentDate: v.date, currency: cc, gross: U.round(inv._out, 2), wht: U.round(wht, 2), net: U.round(inv._out - wht, 2), bankAccountId: acc.accountId, beneficiaryIban: s.iban || null, method: 'Bank Transfer', batchId, reference: null, approvalStatus: 'Pending', executionStatus: 'Pending', createdBy: me(), approvedBy: null, executedBy: null, urgent: false, manual: false }, 'payment.create');
        });
        const tot = U.sum(its, (x) => x.inv._out);
        if (acc.availableBalance != null && tot > acc.availableBalance) UI.toast(t('pay.liqWarn', 'Warning: batch {b} exceeds available balance on {a}.', { b: batchId, a: acc.accountId }), 'error');
        created.push(b.batchId);
      }
      S.vs.paySel = new Set();
      S.vs.payTab = 'batches';
      if (created.length) UI.toast(t('pay.created', 'Created {b}. It now requires Treasury (and if applicable CFO) approval.', { b: created.join(', ') }), 'ok');
      S.emit('data');
    }, { intro: esc(t('pay.batchIntro', '{n} invoice(s). One batch per currency. The system will NOT execute the payment.', { n: items.length })) });
  };

  const batchOf = (id) => S.state.data.batches.find((b) => b.batchId === id);
  W.batchOpen = (id) => {
    const b = batchOf(id), info = V.batchInfo(b);
    const can = (p) => S.can(p);
    const st = b.status;
    const btn = (act, label, cls, ok) => `<button class="btn ${cls || ''}" data-act="${act}" data-id="${esc(id)}" ${ok ? '' : 'disabled'}>${esc(label)}</button>`;
    const html = `<table class="kv"><tr><th>${esc(t('f.batchId', 'Batch'))}</th><td><b>${esc(b.batchId)}</b> ${UI.badge(st)} ${b._demo ? UI.demoTag() : ''}</td></tr>
      <tr><th>${esc(t('f.paymentDate', 'Payment date'))}</th><td>${UI.date(b.paymentDate)}</td></tr><tr><th>${esc(t('f.bankAccountId', 'Bank'))}</th><td>${esc(b.bankAccountId)}</td></tr>
      <tr><th>${esc(t('bt.suppliers', 'Suppliers'))} / ${esc(t('bt.invoices', 'Invoices'))}</th><td>${info.suppliers} / ${info.invoices}</td></tr><tr><th>${esc(t('f.total', 'Total'))}</th><td>${UI.money(info.tot, b.currency)} (${UI.base(info.totBase)})</td></tr>
      <tr><th>${esc(t('bt.required', 'Required approvals'))}</th><td>${info.req.roles.map((r) => esc(t('role.' + r, r))).join(' + ')} <div class="small muted">${esc(info.req.reasons.join(' · '))}</div></td></tr>
      <tr><th>${esc(t('f.createdBy', 'Created by'))}</th><td>${UI.v(b.createdBy)}</td></tr><tr><th>${esc(t('bt.treasury', 'Treasury approval'))}</th><td>${UI.v(b.treasuryApprovedBy)}</td></tr><tr><th>${esc(t('bt.cfo', 'CFO approval'))}</th><td>${b.cfoApprovedBy ? esc(b.cfoApprovedBy) : info.needCfo ? UI.na(t('bt.pending', 'Pending')) : esc(t('bt.notReq', 'Not required'))}</td></tr></table>
      <div class="tbl-wrap"><table><thead><tr><th>${esc(t('f.paymentId', 'Payment'))}</th><th>${esc(t('f.supplierId', 'Supplier'))}</th><th>${esc(t('f.invoiceNo', 'Invoice'))}</th><th class="n">${esc(t('f.net', 'Net'))}</th><th>IBAN</th><th>${esc(t('f.executionStatus', 'Status'))}</th><th></th></tr></thead><tbody>${info.ps.map((p) => `<tr><td><a data-drill="${esc(p._key)}">${esc(p.paymentId)}</a></td><td>${esc(UI.supName(p.supplierId))}</td><td>${esc(p.invoiceNo || '')}</td><td class="n">${UI.num(p.net, 2)}</td><td class="mono">${esc(U.maskAccount(p.beneficiaryIban))}</td><td>${UI.badge(p.executionStatus)}</td><td>${st === 'Pending Approval' && can('create.batch') ? `<button class="btn sm ghost" data-act="bRemove" data-id="${esc(id)}" data-key="${esc(p._key)}">${esc(t('bt.remove', 'Remove'))}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <div class="btn-row">${btn('bApproveT', t('bt.approveT', 'Treasury approve'), 'primary', st === 'Pending Approval' && can('approve.batch.treasury') && !b.treasuryApprovedBy)}${btn('bApproveC', t('bt.approveC', 'CFO approve'), 'primary', ['Pending Approval', 'Scheduled'].includes(st) && can('approve.batch.cfo') && info.needCfo && !b.cfoApprovedBy)}${btn('bReject', t('bt.reject', 'Reject'), 'danger', ['Pending Approval', 'Scheduled'].includes(st) && (can('approve.batch.treasury') || can('approve.batch.cfo')))}
        ${btn('bSubmit', t('bt.submit', 'Submit to bank'), '', st === 'Scheduled' && info.ready && can('submit.batch'))}${btn('bExport', t('bt.export', 'Export bank file'), '', ['Scheduled', 'Submitted to Bank'].includes(st) && can('export'))}${btn('bExecute', t('bt.execute', 'Record bank execution'), '', st === 'Submitted to Bank' && can('execute.payment'))}${btn('bReconcile', t('bt.reconcile', 'Reconcile'), '', ['Executed'].includes(st) && can('reconcile'))}</div>
      <p class="small muted">${esc(t('bt.note', 'Approvals are checked against the configured matrix and segregation of duties (creator ≠ approver ≠ executor ≠ reconciler; invoice approver ≠ payment approver). Every step is audit-logged. Execution is only recorded — it happens in the bank, by authorised people.'))}</p>`;
    UI.modal(t('bt.title', 'Payment batch'), html, { wide: true });
  };
  const sodBatch = (b, info, duty) => {
    const u = me();
    if (b.createdBy === u) return t('sod.batchCreator', 'Segregation of duties: you created this batch.');
    if (duty !== 'approve' && (b.treasuryApprovedBy === u || b.cfoApprovedBy === u)) return t('sod.approverExec', 'Segregation of duties: you approved this batch.');
    if (duty === 'approve' && info.ps.some((p) => { const i = S.R.P.inv.get(p.invoiceNo); return i && (i.approvedBy === u || (Array.isArray(i.approvals) && i.approvals.some((a) => a.user === u))); })) return t('sod.invPay', 'Segregation of duties: you approved an invoice in this batch.');
    if (duty === 'reconcile' && info.ps.some((p) => p.executedBy === u)) return t('sod.execRec', 'Segregation of duties: you recorded execution of this batch.');
    return null;
  };
  const setPays = (info, field, val, reason, action) => info.ps.filter((p) => !['Rejected'].includes(p.executionStatus)).forEach((p) => S.updateRecord('payments', p, field, val, reason, action));
  W.bApproveT = (id) => {
    const b = batchOf(id), info = V.batchInfo(b);
    if (!S.can('approve.batch.treasury')) return deny();
    const sod = sodBatch(b, info, 'approve'); if (sod) return deny(sod);
    if (b.cfoApprovedBy === me()) return deny(t('sod.twoApprovers', 'The two batch approvals must be by different people.'));
    S.updateRecord('batches', b, 'treasuryApprovedBy', me(), null, 'batch.approve.treasury');
    W.batchState(b);
  };
  W.bApproveC = (id) => {
    const b = batchOf(id), info = V.batchInfo(b);
    if (!S.can('approve.batch.cfo')) return deny();
    const sod = sodBatch(b, info, 'approve'); if (sod) return deny(sod);
    if (b.treasuryApprovedBy === me()) return deny(t('sod.twoApprovers', 'The two batch approvals must be by different people.'));
    S.updateRecord('batches', b, 'cfoApprovedBy', me(), null, 'batch.approve.cfo');
    W.batchState(b);
  };
  W.batchState = (b) => {
    const info = V.batchInfo(b);
    if (info.ready && b.status === 'Pending Approval') {
      S.updateRecord('batches', b, 'status', 'Scheduled', null, 'batch.scheduled');
      setPays(info, 'approvalStatus', 'Approved', null, 'payment.approve');
      setPays(info, 'approvedBy', [b.treasuryApprovedBy, b.cfoApprovedBy].filter(Boolean).join(' + '), null, 'payment.approve');
      setPays(info, 'executionStatus', 'Scheduled', null, 'payment.schedule');
      UI.toast(t('bt.scheduled', 'Batch {b} fully approved and scheduled.', { b: b.batchId }), 'ok');
    } else UI.toast(t('bt.recorded', 'Approval recorded.'), 'info');
    S.emit('data'); UI.closeModal(); W.batchOpen(b.batchId);
  };
  W.bReject = (id) => {
    const b = batchOf(id), info = V.batchInfo(b);
    UI.form(t('bt.reject', 'Reject') + ' ' + id, [{ name: 'reason', label: t('wf.reason', 'Reason'), type: 'textarea', required: true }], (v) => { S.updateRecord('batches', b, 'status', 'Rejected', v.reason, 'batch.reject'); setPays(info, 'executionStatus', 'Rejected', v.reason, 'payment.reject'); setPays(info, 'approvalStatus', 'Rejected', v.reason, 'payment.reject'); S.emit('data'); });
  };
  W.bRemove = (id, key) => {
    const b = batchOf(id), p = S.R.index.get(key);
    UI.form(t('bt.remove', 'Remove') + ' ' + p.paymentId, [{ name: 'reason', label: t('wf.reason', 'Reason'), type: 'textarea', required: true }], (v) => {
      S.updateRecord('payments', p, 'executionStatus', 'Rejected', 'Removed from batch: ' + v.reason, 'batch.modify');
      if (b.treasuryApprovedBy || b.cfoApprovedBy) { S.updateRecord('batches', b, 'treasuryApprovedBy', null, 'Batch modified — approvals reset', 'batch.modify'); S.updateRecord('batches', b, 'cfoApprovedBy', null, 'Batch modified — approvals reset', 'batch.modify'); }
      S.emit('data');
    });
  };
  W.bSubmit = (id) => {
    const b = batchOf(id), info = V.batchInfo(b);
    if (!S.can('submit.batch')) return deny();
    if (!info.ready) return deny(t('bt.notReady', 'Required approvals are not complete.'));
    S.updateRecord('batches', b, 'status', 'Submitted to Bank', null, 'batch.submit');
    setPays(info, 'executionStatus', 'Submitted to Bank', null, 'payment.submit');
    S.emit('data'); UI.closeModal();
  };
  W.bExport = (id) => {
    const b = batchOf(id), info = V.batchInfo(b);
    const full = S.can('view.sensitive');
    const iban = (v) => (full ? U.normIban(v) : U.maskAccount(v));
    const ps = info.ps.filter((p) => p.executionStatus !== 'Rejected');
    const csv = [['BatchId', 'PaymentId', 'ValueDate', 'Currency', 'Amount', 'BeneficiaryName', 'BeneficiaryIBAN', 'RemittanceInfo'], ...ps.map((p) => [b.batchId, p.paymentId, p.paymentDate, p.currency, p.net, (S.R.P.sup.get(p.supplierId) || {}).name || p.supplierId, iban(p.beneficiaryIban), p.invoiceNo])];
    const acc = S.R.P.bankAcc.get(b.bankAccountId) || {};
    const x = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const pain = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${S.state.mode === 'demo' ? 'DEMO / SYNTHETIC — NOT FOR SUBMISSION' : 'Generated by SUMED P2P — validate against your bank\'s pain.001 implementation guide before submission'} -->\n<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"><CstmrCdtTrfInitn><GrpHdr><MsgId>${x(b.batchId)}</MsgId><CreDtTm>${new Date().toISOString().slice(0, 19)}</CreDtTm><NbOfTxs>${ps.length}</NbOfTxs><CtrlSum>${U.round(U.sum(ps, (p) => p.net), 2)}</CtrlSum><InitgPty><Nm>SUMED</Nm></InitgPty></GrpHdr><PmtInf><PmtInfId>${x(b.batchId)}</PmtInfId><PmtMtd>TRF</PmtMtd><ReqdExctnDt>${x(b.paymentDate)}</ReqdExctnDt><Dbtr><Nm>SUMED</Nm></Dbtr><DbtrAcct><Id><IBAN>${x(iban(acc.iban))}</IBAN></Id></DbtrAcct><DbtrAgt><FinInstnId/></DbtrAgt>${ps.map((p) => `<CdtTrfTxInf><PmtId><EndToEndId>${x(p.paymentId)}</EndToEndId></PmtId><Amt><InstdAmt Ccy="${x(p.currency)}">${U.round(p.net, 2)}</InstdAmt></Amt><Cdtr><Nm>${x((S.R.P.sup.get(p.supplierId) || {}).name || p.supplierId)}</Nm></Cdtr><CdtrAcct><Id><IBAN>${x(iban(p.beneficiaryIban))}</IBAN></Id></CdtrAcct><RmtInf><Ustrd>${x(p.invoiceNo)}</Ustrd></RmtInf></CdtTrfTxInf>`).join('')}</PmtInf></CstmrCdtTrfInitn></Document>`;
    const blob = S.reports.zip([{ name: b.batchId + '.csv', data: U.toCSV(csv) }, { name: b.batchId + '_pain001.xml', data: pain }]);
    U.download(b.batchId + (S.state.mode === 'demo' ? '_DEMO' : '') + '_bankfile.zip', blob);
    S.audit('batch.export', 'batches', b.batchId, { newValue: full ? 'full IBAN' : 'masked IBAN', reason: full ? 'Bank file export (sensitive)' : 'Masked export — role lacks view.sensitive' });
  };
  W.bExecute = (id) => {
    const b = batchOf(id), info = V.batchInfo(b);
    if (!S.can('execute.payment')) return deny();
    const sod = sodBatch(b, info, 'execute'); if (sod) return deny(sod);
    UI.form(t('bt.execute', 'Record bank execution') + ' ' + id, [{ name: 'ref', label: t('bt.ref', 'Bank reference (batch) — payments get suffix -001, -002…'), required: true }, { name: 'date', label: t('bank.valueDate', 'Value date'), type: 'date', value: b.paymentDate, required: true }], (v) => {
      info.ps.filter((p) => p.executionStatus === 'Submitted to Bank').forEach((p, i) => { S.updateRecord('payments', p, 'reference', v.ref + '-' + String(i + 1).padStart(3, '0'), null, 'payment.execute'); S.updateRecord('payments', p, 'executedBy', me(), null, 'payment.execute'); S.updateRecord('payments', p, 'paymentDate', v.date, null, 'payment.execute'); S.updateRecord('payments', p, 'executionStatus', 'Executed', null, 'payment.execute'); });
      S.updateRecord('batches', b, 'status', 'Executed', null, 'batch.execute');
      S.emit('data');
    }, { intro: esc(t('bt.execIntro', 'Record what the bank executed. This does not send money.')) });
  };
  W.bReconcile = (id) => {
    const b = batchOf(id), info = V.batchInfo(b);
    if (!S.can('reconcile')) return deny();
    const sod = sodBatch(b, info, 'reconcile'); if (sod) return deny(sod);
    let ok = 0, miss = 0;
    info.ps.filter((p) => p.executionStatus === 'Executed').forEach((p) => { const it = S.R.bank.items.find((x) => x.p === p); if (it && it.status === 'MATCHED') { S.updateRecord('payments', p, 'executionStatus', 'Reconciled', null, 'payment.reconcile'); S.updateRecord('payments', p, 'reconciledBy', me(), null, 'payment.reconcile'); ok++; } else miss++; });
    if (ok && !miss) S.updateRecord('batches', b, 'status', 'Reconciled', null, 'batch.reconcile');
    UI.toast(t('bt.recResult', '{ok} reconciled against the bank statement; {miss} not found in the bank statement yet.', { ok, miss }), miss ? 'error' : 'ok');
    S.emit('data'); UI.closeModal();
  };

  /** Onboarding: evidence-gated stage advance with SoD at approval. */
  W.obAdvance = (sid) => {
    const o = S.R.onboarding.find((x) => x.supplier.supplierId === sid);
    const s = o.supplier;
    const cur = o.stageNo || 1;
    const nextIdx = Math.min(10, cur + 1);
    const nextKey = E.ONBOARDING_STAGES[nextIdx - 1];
    const permOk = nextIdx <= 6 ? S.can('create.supplier') || S.can('approve.compliance') || S.can('approve.supplier') : nextIdx <= 8 ? S.can('approve.supplier') || S.can('approve.invoice') : S.can('approve.supplier');
    if (!permOk) return deny();
    if (nextIdx >= 9 && s.createdBy === me()) return deny(t('sod.supplierSelf', 'Segregation of duties: you created this supplier and cannot approve it.'));
    const gaps = E.ONBOARDING_STAGES.slice(0, cur).filter((k) => !o.stages[k].ok);
    const go = (reason) => {
      S.updateRecord('suppliers', s, 'onboardingStage', nextIdx, reason, 'supplier.onboarding.advance');
      if (nextIdx === 9) S.updateRecord('suppliers', s, 'approvedBy', me(), reason, 'supplier.approve');
      if (nextIdx === 10) S.updateRecord('suppliers', s, 'approvedStatus', 'Approved', reason, 'supplier.activate');
      S.emit('data');
    };
    UI.form(t('ob.advance', 'Advance to next stage') + ': ' + t('ob.' + nextKey), gaps.length ? [{ name: 'reason', label: t('ob.override', 'Open gaps: {g}. Override justification', { g: gaps.map((k) => t('ob.' + k)).join(', ') }), type: 'textarea', required: true }] : [{ name: 'reason', label: t('wf.comment', 'Comment'), type: 'textarea' }], (v) => go(v.reason));
  };
  W.obReject = (sid) => {
    if (!S.can('approve.supplier') && !S.can('approve.compliance')) return deny();
    const s = S.R.P.sup.get(sid);
    UI.form(t('ob.reject', 'Reject') + ' ' + sid, [{ name: 'reason', label: t('wf.reason', 'Reason'), type: 'textarea', required: true }], (v) => { S.updateRecord('suppliers', s, 'approvedStatus', 'Rejected', v.reason, 'supplier.reject'); S.emit('data'); });
  };
  W.bankChange = (sid) => {
    if (!S.can('create.supplier') && !S.can('manage.banks')) return deny();
    const s = S.R.P.sup.get(sid);
    UI.form(t('sup.reqBank', 'Request bank change') + ' — ' + s.name, [{ name: 'iban', label: t('f.newIban', 'New IBAN'), required: true }, { name: 'bank', label: t('f.bankName', 'Bank name'), value: s.bankName }, { name: 'reason', label: t('wf.reason', 'Reason / supporting document reference'), type: 'textarea', required: true }], (v) => {
      const ok = U.ibanValid(v.iban);
      if (ok === false) { UI.toast(t('sup.ibanInvalid', 'IBAN fails the ISO 13616 checksum — not saved.'), 'error'); return false; }
      S.addRecord('bankChanges', { supplierId: sid, changeDate: S.R.asOf, oldIban: s.iban, newIban: U.normIban(v.iban), changedBy: me(), approvedBy: null, verified: false }, 'supplier.bankchange.request', v.reason);
      S.updateRecord('suppliers', s, 'iban', U.normIban(v.iban), v.reason, 'supplier.bankchange');
      S.updateRecord('suppliers', s, 'bankName', v.bank || s.bankName, v.reason, 'supplier.bankchange');
      S.updateRecord('suppliers', s, 'bankChangedOn', S.R.asOf, v.reason, 'supplier.bankchange');
      UI.toast(t('sup.bankPending', 'Bank change recorded as UNVERIFIED. Payments to this supplier will be flagged until an independent call-back is recorded.'), 'info');
      S.emit('data');
    });
  };
  W.verifyBank = (sid) => {
    if (!S.can('approve.supplier')) return deny();
    const chg = S.state.data.bankChanges.filter((c) => c.supplierId === sid && c.verified === false);
    if (chg.some((c) => c.changedBy === me())) return deny(t('sod.bankSelf', 'Segregation of duties: you requested this bank change.'));
    UI.form(t('sup.verifyBank', 'Record call-back verification'), [{ name: 'contact', label: t('sup.cbContact', 'Contact called (from master file, not from the change request)'), required: true }, { name: 'reason', label: t('wf.comment', 'Notes'), type: 'textarea', required: true }], (v) => { chg.forEach((c) => { S.updateRecord('bankChanges', c, 'verified', true, `Call-back: ${v.contact}. ${v.reason}`, 'supplier.bankchange.verify'); S.updateRecord('bankChanges', c, 'approvedBy', me(), null, 'supplier.bankchange.verify'); }); S.emit('data'); });
  };
  W.flagStatus = (id) => {
    const cur = V.flagStatus(id);
    UI.form(t('rf.update', 'Update flag'), [{ name: 'status', label: t('common.status', 'Status'), type: 'select', value: cur.status, options: ['Open', 'Investigating', 'Escalated', 'Closed — false positive', 'Closed — confirmed & remediated'].map((x) => [x, t('fs.' + x, x)]) }, { name: 'reason', label: t('wf.reason', 'Reason / investigation notes'), type: 'textarea', required: true }], (v) => {
      const old = cur.status;
      S.state.alertStatus[id] = { status: v.status, by: me(), at: new Date().toISOString(), reason: v.reason };
      S.audit('flag.status', 'redFlag', id, { field: 'status', oldValue: old, newValue: v.status, reason: v.reason });
      A.render();
    });
  };

  /* ---------------- Settings changes ---------------- */
  A.setCfg = (path, raw, el) => {
    if (!S.can('config.edit')) return deny();
    const parts = path.split('.');
    let o = S.state.config;
    for (let i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
    const k = parts[parts.length - 1];
    const old = o[k];
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (Array.isArray(old) || ['approvers', 'criticalCategories', 'requiredDocs', 'currencies'].includes(k)) v = String(raw).split(',').map((x) => x.trim()).filter(Boolean);
    else if (k === 'weekendDays') v = String(raw).split(',').map((x) => parseInt(x, 10)).filter((x) => x >= 0 && x <= 6);
    else if (el.type === 'number') v = raw === '' ? null : Number(raw);
    else v = raw === '' ? null : raw;
    if (k === 'weekendDays' && !Array.isArray(v)) v = [];
    o[k] = v;
    S.audit('config.update', 'config', path, { field: path, oldValue: old, newValue: v });
    A.rerun();
  };

  /* ---------------- Global search ---------------- */
  A.search = (q) => {
    const box = document.getElementById('gresults');
    q = q.trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; return; }
    const D = S.state.data, out = [];
    const add = (type, label, sub, act) => out.length < 30 && out.push({ type, label, sub, act });
    D.suppliers.forEach((s) => { if ([s.supplierId, s.name, s.nameAr, s.taxId].some((x) => x && String(x).toLowerCase().includes(q))) add(t('f.supplierId', 'Supplier'), s.name, s.supplierId, `data-drill="${esc(s._key)}"`); });
    D.invoices.forEach((i) => { if ([i.invoiceNo, i.description].some((x) => x && String(x).toLowerCase().includes(q))) add(t('f.invoiceNo', 'Invoice'), i.invoiceNo, `${UI.supName(i.supplierId) || ''} · ${S.fmt.money(i.total, i.currency) || ''}`, `data-drill="${esc(i._key)}"`); });
    D.pos.forEach((p) => { if (String(p.poNo).toLowerCase().includes(q)) add(t('f.poNo', 'PO'), p.poNo, UI.supName(p.supplierId), `data-drill="${esc(p._key)}"`); });
    D.contracts.forEach((c) => { if (String(c.contractId).toLowerCase().includes(q)) add(t('f.contractId', 'Contract'), c.contractId, UI.supName(c.supplierId), `data-drill="${esc(c._key)}"`); });
    D.payments.forEach((p) => { if ([p.paymentId, p.reference, p.batchId].some((x) => x && String(x).toLowerCase().includes(q))) add(t('f.paymentId', 'Payment'), p.paymentId, `${p.reference || ''} · ${S.fmt.money(p.net, p.currency) || ''}`, `data-drill="${esc(p._key)}"`); });
    D.bankTxns.forEach((x) => { if ([x.txnId, x.reference, x.description].some((v) => v && String(v).toLowerCase().includes(q))) add(t('bank.txn', 'Bank transaction'), x.txnId, x.reference || '', `data-drill="${esc(x._key)}"`); });
    D.bankAccounts.forEach((b) => { if ([b.accountId, b.bank].some((v) => v && String(v).toLowerCase().includes(q))) add(t('f.bank', 'Bank'), b.accountId, b.bank, 'data-nav="banks"'); });
    D.users.forEach((u) => { if ([u.userId, u.name].some((v) => v && String(v).toLowerCase().includes(q))) add(t('sod.user', 'User'), u.name, u.role, 'data-nav="controls"'); });
    U.uniq(D.pos.map((p) => p.project).filter(Boolean)).forEach((p) => { if (p.toLowerCase().includes(q)) add(t('f.project', 'Project'), p, '', 'data-nav="spend"'); });
    U.uniq(D.pos.map((p) => p.costCenter).filter(Boolean)).forEach((c) => { if (c.toLowerCase().includes(q)) add(t('f.costCenter', 'Cost center'), c, '', 'data-nav="spend"'); });
    box.innerHTML = out.length ? out.map((r) => `<button ${r.act}><small>${esc(r.type)}</small><b>${esc(r.label)}</b><span>${esc(r.sub || '')}</span></button>`).join('') : `<p class="muted">${esc(t('search.none', 'No matches'))}</p>`;
    box.hidden = false;
  };

  /* ---------------- Actions dispatcher ---------------- */
  const ACT = {
    demo: () => { S.loadDemo(); location.hash = '#/dashboard'; },
    commit: () => { const pend = S.vs.pending || []; if (!pend.length) return; S.ingest.commit(pend); S.vs.pending = []; UI.toast(t('up.committed', 'Files validated and loaded. Review the Data Quality report.'), 'ok'); location.hash = '#/quality'; },
    discard: () => { S.vs.pending = []; A.render(); },
    templates: () => { const files = S.entityOrder.map((e) => ({ name: `${e}.csv`, data: U.toCSV([S.schema[e].fields.map((f) => (f.syn[0] || f.key))]) })); files.push({ name: 'README.txt', data: 'SUMED P2P upload templates. One CSV per entity; header names may also be any synonym listed in docs/DATA_MODEL.md (English or Arabic). Required fields are marked * in the mapping screen.' }); U.download('SUMED_P2P_templates.zip', S.reports.zip(files)); },
    exportWs: () => { U.download(`SUMED_P2P_workspace_${U.todayISO()}${S.state.mode === 'demo' ? '_DEMO' : ''}.json`, S.serialize(), 'application/json'); S.audit('workspace.export', 'workspace', null); },
    clearWs: () => UI.form(t('up.clearWs', 'Clear workspace'), [{ name: 'reason', label: t('wf.reason', 'Reason'), type: 'textarea', required: true }], (v) => { S.audit('workspace.clear', 'workspace', null, { reason: v.reason }); S.resetData('empty'); S.clearWorkspace(); S.emit('data'); location.hash = '#/upload'; }, { intro: esc(t('up.clearWarn', 'Removes all loaded data from this browser. The audit trail is kept.')) }),
    reveal: (el) => UI.form(t('sec.reveal', 'Reveal (logged)'), [{ name: 'reason', label: t('sec.why', 'Business reason'), type: 'textarea', required: true }], (v) => { S.reveal(el.dataset.key, v.reason); const k = el.dataset.key; A.render(); UI.openRecord(k.slice(0, k.lastIndexOf(':'))); }),
    invApprove: (el) => W.invApprove(el.dataset.key), invReject: (el) => W.invReject(el.dataset.key), dispute: (el) => W.dispute(el.dataset.key), disputeResolve: (el) => W.disputeResolve(el.dataset.key),
    createBatch: () => W.createBatch(),
    selAll: () => { S.vs.paySel = new Set(S.R.priority.filter((x) => !x.blocks.length && (S.vs.payTab !== 'proposal' || ['overdue', 'today', 'd3', 'd7'].includes(x.horizon))).map((x) => x.key)); A.render(); },
    selNone: () => { S.vs.paySel = new Set(); A.render(); },
    batchOpen: (el) => W.batchOpen(el.dataset.id), bApproveT: (el) => W.bApproveT(el.dataset.id), bApproveC: (el) => W.bApproveC(el.dataset.id), bReject: (el) => W.bReject(el.dataset.id), bRemove: (el) => W.bRemove(el.dataset.id, el.dataset.key), bSubmit: (el) => W.bSubmit(el.dataset.id), bExport: (el) => W.bExport(el.dataset.id), bExecute: (el) => W.bExecute(el.dataset.id), bReconcile: (el) => W.bReconcile(el.dataset.id),
    flagStatus: (el) => W.flagStatus(el.dataset.id),
    runControls: () => { E.run(); S.audit('controls.run', 'controls', null, { newValue: JSON.stringify(S.R.controls.summary) }); A.render(); UI.toast(t('ctl.done', 'Control tests executed over the full population.'), 'ok'); },
    runScenario: () => { const sc = S.vs.tr.sc; S.vs.scenResult = E.scenario(S.state.data, S.R.P, S.state.config, S.R.asOf, S.R.items, sc); S.audit('scenario.run', 'scenario', null, { newValue: JSON.stringify(sc), reason: 'SCENARIO — NOT ACTUAL' }); A.render(); },
    report: (el) => (S.can('export') ? S.reports.pdf(el.dataset.id) : deny()), repX: (el) => S.reports.excel(el.dataset.id), repP: (el) => S.reports.pdf(el.dataset.id), repC: (el) => S.reports.csv(el.dataset.id),
    obAdvance: (el) => W.obAdvance(el.dataset.id), obReject: (el) => W.obReject(el.dataset.id), bankChange: (el) => W.bankChange(el.dataset.id), verifyBank: (el) => W.verifyBank(el.dataset.id),
    ocrSave: (el) => { const doc = S.state.ocrDocs.find((d) => d.docId === el.dataset.doc); document.querySelectorAll(`.ocr-in[data-doc="${el.dataset.doc}"]`).forEach((i) => { const k = i.dataset.k; const cur = doc.fields[k] ? doc.fields[k].value : null; let v = i.value.trim() === '' ? null : i.value.trim(); if (['subtotal', 'tax', 'total', 'discount'].includes(k) && v != null) v = U.parseNum(v); if (['invoiceDate', 'dueDate'].includes(k) && v != null) v = U.parseDate(v, S.state.config.dateOrder) || v; if (String(cur == null ? '' : cur) !== String(v == null ? '' : v)) S.ingest.correctField(doc, k, v, 'Manual OCR review'); }); UI.toast(t('ocr.saved', 'Corrections saved and logged.'), 'ok'); A.render(); },
    ocrPost: (el) => { ACT.ocrSave(el); const doc = S.state.ocrDocs.find((d) => d.docId === el.dataset.doc); S.ingest.postInvoice(doc); UI.toast(t('ocr.posted', 'Invoice posted to the register as Pending Approval. Missing fields remain "Not Available in Source Data".'), 'ok'); },
    taxAdd: () => { const g = (id) => document.getElementById(id).value.trim(); if (!g('tx-code') || !g('tx-rate') || !g('tx-src')) return UI.toast(t('set.taxReq', 'Code, rate and source are required.'), 'error'); const n = { code: g('tx-code'), name: g('tx-name'), type: document.getElementById('tx-type').value, ratePct: Number(g('tx-rate')), source: g('tx-src') }; S.state.config.taxCodes.push(n); S.audit('config.tax.add', 'config', n.code, { newValue: n }); A.rerun(); },
    taxDel: (el) => { const x = S.state.config.taxCodes.splice(+el.dataset.i, 1)[0]; S.audit('config.tax.remove', 'config', x.code, { oldValue: x }); A.rerun(); },
    holAdd: () => { const d = document.getElementById('hol-date').value, n = document.getElementById('hol-name').value.trim(); if (!d || !n) return; S.state.config.holidays.push({ date: d, name: n }); S.audit('config.holiday.add', 'config', d, { newValue: n }); A.rerun(); },
    holDel: (el) => { const x = S.state.config.holidays.splice(+el.dataset.i, 1)[0]; S.audit('config.holiday.remove', 'config', x.date, { oldValue: x.name }); A.rerun(); },
    switchUser: (el) => { const u = S.state.data.users.find((x) => x.userId === el.dataset.id); if (u) S.setSession(u); },
    toggleMap: (el) => { const sh = V.pendFlat()[+el.dataset.f].sheets[+el.dataset.s]; sh._open = !sh._open; A.render(); },
    calNav: (el) => { const f = S.vs.cal, d = +el.dataset.d; if (d === 0) f.anchor = f.view === 'month' ? S.R.asOf.slice(0, 7) + '-01' : S.R.asOf; else if (f.view === 'month') f.anchor = U.addMonths(f.anchor, d); else f.anchor = U.addDays(f.anchor, d * (f.view === 'day' ? 1 : f.view === 'week' ? 7 : 91)); A.render(); },
  };
  const CHANGE = {
    setEntity: (el) => { const sh = V.pendFlat()[+el.dataset.f].sheets[+el.dataset.s]; sh.entity = el.value || null; if (sh.entity) sh.mapping = S.autoMap(sh.headers.map((h) => String(h || '').toLowerCase().replace(/[_\-./#:()]/g, ' ').replace(/\s+/g, ' ').trim()), S.schema[sh.entity]); A.render(); },
    setMap: (el) => { const sh = V.pendFlat()[+el.dataset.f].sheets[+el.dataset.s]; if (el.value === '') delete sh.mapping[el.dataset.k]; else sh.mapping[el.dataset.k] = +el.value; },
    sel: (el) => { const s = (S.vs.paySel = S.vs.paySel || new Set()); if (el.checked) s.add(el.dataset.key); else s.delete(el.dataset.key); A.render(); },
    calF: (el) => { S.vs.cal[el.dataset.k] = el.value; if (el.dataset.k === 'view') S.vs.cal.anchor = el.value === 'month' ? S.vs.cal.anchor.slice(0, 7) + '-01' : S.R.asOf; A.render(); },
    trF: (el) => { S.vs.tr[el.dataset.k] = el.value; A.render(); },
  };

  /* ---------------- Events ---------------- */
  A.bind = () => {
    const doc = document;
    doc.addEventListener('click', (e) => {
      const el = e.target.closest('[data-close],[data-lang],#theme,[data-nav],[data-lineage],[data-evidence],[data-tab],[data-tsort],[data-tpg],[data-texp],[data-act],[data-drill]');
      const res = document.getElementById('gresults');
      if (res && !e.target.closest('.gsearch')) res.hidden = true;
      if (e.target.id === 'modal') return UI.closeModal();
      if (!el) return;
      if (el.matches('select,input') && el.dataset.act && CHANGE[el.dataset.act]) return; // handled by change
      if (el.dataset.close) return el.dataset.close === 'modal' ? UI.closeModal() : UI.closeDrawer();
      if (el.dataset.lang) { S.state.prefs.lang = el.dataset.lang; S.savePrefs(); S.audit('ui.language', 'session', null, { newValue: el.dataset.lang }); return A.render(); }
      if (el.id === 'theme') { S.state.prefs.theme = A.isDark() ? 'light' : 'dark'; S.savePrefs(); return A.render(); }
      if (el.dataset.nav) { e.preventDefault(); UI.closeModal(); UI.closeDrawer(); location.hash = '#/' + el.dataset.nav; return; }
      if (el.dataset.lineage) return UI.openLineage(el.dataset.lineage);
      if (el.dataset.evidence) { const [k, ...rest] = el.dataset.evidence.split(':'); const f = S.evidence(k, rest.join(':')); return f ? UI.openEvidence(f) : UI.toast(t('ev.none', 'No evidence available.'), 'error'); }
      if (el.dataset.tab) { const [k, ...v] = el.dataset.tab.split(':'); S.vs[k] = v.join(':') || null; Object.keys(UI.tables).forEach((id) => (UI.tables[id].page = 0)); return A.render(); }
      if (el.dataset.tsort) { const [id, i] = el.dataset.tsort.split(':'); const st = UI.tables[id]; if (st.sort === +i) st.dir *= -1; else { st.sort = +i; st.dir = -1; } return UI.refreshTable(id); }
      if (el.dataset.tpg) { const [id, d] = el.dataset.tpg.split(':'); UI.tables[id].page += +d; return UI.refreshTable(id); }
      if (el.dataset.texp) return S.can('export') ? UI.exportTable(el.dataset.texp) : deny();
      if (el.dataset.act && ACT[el.dataset.act]) { e.preventDefault(); return ACT[el.dataset.act](el); }
      if (el.dataset.drill) { e.preventDefault(); if (res) res.hidden = true; return UI.openRecord(el.dataset.drill); }
    });
    doc.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.act && CHANGE[el.dataset.act]) return CHANGE[el.dataset.act](el);
      if (el.dataset.cfg) return A.setCfg(el.dataset.cfg, el.value, el);
      if (el.dataset.sc) { const sc = S.vs.tr.sc; sc[el.dataset.sc] = el.type === 'number' ? Number(el.value) || 0 : el.value; return; }
      if (el.id === 'asof') { const old = S.state.config.asOfDate; S.state.config.asOfDate = el.value || null; S.audit('config.update', 'config', 'asOfDate', { field: 'asOfDate', oldValue: old, newValue: el.value }); return A.rerun(); }
      if (el.id === 'session') { if (!el.value) return; const [k, v] = el.value.split(':'); if (k === 'u') S.setSession(S.state.data.users.find((u) => u.userId === v)); else S.setSession({ userId: 'local.' + v.toLowerCase().replace(/\s+/g, '.'), name: t('role.' + v, v) + ' (local)', role: v }); return; }
    });
    const tq = U.debounce((el) => { UI.tables[el.dataset.tq].q = el.value; UI.tables[el.dataset.tq].page = 0; UI.refreshTable(el.dataset.tq); const n = document.querySelector(`[data-tq="${el.dataset.tq}"]`); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200);
    const gs = U.debounce((v) => A.search(v), 150);
    doc.addEventListener('input', (e) => { if (e.target.dataset.tq) tq(e.target); if (e.target.id === 'gsearch') gs(e.target.value); });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { UI.closeModal(); UI.closeDrawer(); }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); document.getElementById('gsearch').focus(); }
      if (e.key === 'Enter' && e.target.dataset && e.target.dataset.drill && e.target.tagName === 'TR') UI.openRecord(e.target.dataset.drill);
    });
    const tip = () => document.getElementById('tip');
    doc.addEventListener('mouseover', (e) => { const m = e.target.closest('[data-tip]'); const tp = tip(); if (!tp) return; if (!m) { tp.hidden = true; return; } tp.textContent = m.dataset.tip; tp.hidden = false; });
    doc.addEventListener('mousemove', (e) => { const tp = tip(); if (tp && !tp.hidden) { const x = Math.min(e.clientX + 14, innerWidth - tp.offsetWidth - 8); tp.style.left = x + 'px'; tp.style.top = e.clientY + 14 + 'px'; } });
    root.addEventListener('hashchange', () => { UI.closeDrawer(); A.render(); document.getElementById('main').focus({ preventScroll: true }); root.scrollTo(0, 0); });
    if (root.matchMedia) root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => A.render());
  };

  /* ---------------- Integration API ---------------- */
  S.api = {
    load(data, opts = {}) {
      if (S.state.mode === 'demo') S.resetData('live');
      S.state.mode = 'live';
      for (const [ent, rows] of Object.entries(data)) {
        if (!S.schema[ent]) continue;
        rows.forEach((r, i) => S.state.data[ent].push(Object.assign({}, r, { _src: { file: opts.source || 'API', sheet: ent, row: i + 1 }, _key: ent + ':api:' + (S.state.data[ent].length + 1), _demo: false })));
      }
      S.audit('api.load', 'workspace', opts.source || 'API', { newValue: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) });
      S.emit('data');
      return S.R.dq.summary;
    },
    kpis: () => S.R.kpis, redFlags: () => S.R.redFlags, controls: () => S.R.controls, audit: () => S.state.audit,
    match: (invoiceNo) => { const i = S.R.P.inv.get(invoiceNo); return i ? S.R.match.get(i._key) : null; },
    paymentProposal: () => S.R.priority.map((x) => ({ invoiceNo: x.inv.invoiceNo, supplierId: x.supplierId, score: x.score, recommendation: x.rec, blocks: x.blocks, components: x.comp })),
    cashForecast: () => S.R.cash, dataQuality: () => S.R.dq, exportWorkspace: () => JSON.parse(S.serialize()),
    run: () => E.run(),
  };

  /* ---------------- Init ---------------- */
  A.init = () => {
    S.loadPrefs();
    const restored = S.restore();
    S.on((what) => { if (what === 'data' || what === 'session') { E.run(); S.persistSoon(); A.render(); } });
    E.run();
    A.bind();
    if (!restored && S.state.audit.length === 0) S.audit('session.start', 'session', S.state.session.userId);
    if (!restored && root.SUMED_AUTODEMO && S.state.mode === 'empty') S.loadDemo();
    A.render();
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', A.init); else A.init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
