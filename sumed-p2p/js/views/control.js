/* SUMED P2P — Red Flags Center, Finance Control Center (tests, SoD, authority), Tax & FX, Audit Trail. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui, C = S.chart;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const V = (S.views = S.views || {});
  S.vs = S.vs || {};
  const ccy = () => S.state.config.baseCurrency;
  const SEVR = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const CATS = ['PAYMENT', 'SUPPLIER', 'PROCUREMENT', 'CONTRACT', 'TAX', 'BANK', 'FRAUD', 'COMPLIANCE', 'LIQUIDITY', 'CONTROL', 'DATA QUALITY'];
  V.flagStatus = (id) => (S.state.alertStatus && S.state.alertStatus[id]) || { status: 'Open' };

  /* ------------------------------ RED FLAGS ------------------------------ */
  V.fraud = {
    title: () => t('nav.fraud', 'AI Red Flags Center'),
    render() {
      const R = S.R;
      if (!S.state.data.invoices.length && !S.state.data.payments.length) return UI.empty();
      const cat = S.vs.rfCat || 'all';
      const sev = S.vs.rfSev || 'all';
      const all = R.redFlags;
      const list = all.filter((f) => (cat === 'all' || f.category === cat) && (sev === 'all' || f.severity === sev));
      const bySev = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({ s, n: all.filter((f) => f.severity === s).length }));
      return `<div class="page-h"><div><h1>${esc(t('nav.fraud', 'AI Red Flags Center'))}</h1><p class="muted">${esc(t('rf.sub', 'Fraud, anomaly, control, liquidity and data-quality flags. Each flag: risk · reason · evidence · amount · supplier · transaction · recommended action.'))} ${UI.demoTag()}</p></div><div class="btn-row"><button class="btn" data-act="report" data-id="fraud">⤓ ${esc(t('rep.export', 'Export'))}</button></div></div>
        <div class="kpis small">${bySev.map((x) => `<button class="kpi static k-${{ CRITICAL: 'critical', HIGH: 'serious', MEDIUM: 'warning', LOW: 'good' }[x.s]}" data-tab="rfSev:${x.s}"><span class="kpi-label">${UI.sev(x.s)}</span><span class="kpi-value">${esc(S.fmt.num(x.n))}</span></button>`).join('')}<button class="kpi static" data-tab="rfSev:all"><span class="kpi-label">${esc(t('common.all', 'All'))}</span><span class="kpi-value">${esc(S.fmt.num(all.length))}</span></button></div>
        ${UI.tabs('rfCat', [['all', t('common.all', 'All') + ' (' + all.length + ')']].concat(CATS.filter((c) => all.some((f) => f.category === c)).map((c) => [c, t('cat.' + c) + ' (' + all.filter((f) => f.category === c).length + ')'])), cat)}
        ${UI.section('', UI.table('redflags', [
          { key: 'sev', label: t('common.severity', 'Risk'), render: (f) => UI.sev(f.severity), sort: (f) => SEVR[f.severity] },
          { key: 'cat', label: t('rf.category', 'Category'), render: (f) => `<span class="pill">${esc(t('cat.' + f.category))}</span>`, sort: (f) => f.category },
          { key: 'reason', label: t('rf.reason', 'Reason'), render: (f) => esc(S.alertText(f)), sort: (f) => f.rule },
          { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (f) => (f.supplierId ? esc(UI.supName(f.supplierId)) : '—'), sort: (f) => f.supplierId },
          { key: 'txn', label: t('rf.txn', 'Transaction'), render: (f) => `<span class="small">${esc(String(f.txn || '—').slice(0, 60))}</span>`, sort: (f) => f.txn },
          { key: 'amt', label: t('f.amount', 'Amount'), num: true, render: (f) => (f.amountBase != null ? UI.base(f.amountBase, { compact: true }) : f.amount != null ? UI.money(f.amount, f.currency, { compact: true }) : '—'), sort: (f) => f.amountBase || 0 },
          { key: 'act', label: t('ev.action', 'Recommended action'), render: (f) => `<span class="small">${esc(t('act.' + f.action))}</span>` },
          { key: 'st', label: t('common.status', 'Status'), render: (f) => { const s = V.flagStatus(f.id); return `${UI.badge(s.status)}${s.by ? `<div class="small muted">${esc(s.by)}</div>` : ''}`; }, sort: (f) => V.flagStatus(f.id).status },
          { key: 'ev', label: '', nosort: true, render: (f) => `${UI.evBtn('flag', f.id)} <button class="btn sm ghost" data-act="flagStatus" data-id="${esc(f.id)}">${esc(t('rf.update', 'Update'))}</button>` },
        ], list, { drill: (f) => (f.rows[0] ? f.rows[0]._key : null), pageSize: 25, exportName: 'red_flags' }))}
        ${R.alerts.notTested.length ? UI.section(t('rf.notTested', 'Rules not tested (inputs missing)'), `<ul>${R.alerts.notTested.map((n) => `<li>${esc(n.rule)} — ${esc(t('nt.' + n.reason))}</li>`).join('')}</ul>`) : ''}`;
    },
  };

  /* ------------------------------ CONTROLS ------------------------------ */
  V.controls = {
    title: () => t('nav.controls', 'Finance Control Center'),
    render() {
      const R = S.R, ct = R.controls;
      if (!S.state.data.invoices.length && !S.state.data.suppliers.length) return UI.empty();
      const tab = S.vs.ctlTab || 'tests';
      const head = `<div class="page-h"><div><h1>${esc(t('nav.controls', 'Finance Control Center'))}</h1><p class="muted">${esc(t('ctl.sub', 'Automated control tests over the full population. PASS / WARNING / FAIL / NOT TESTED.'))} ${UI.demoTag()}</p></div>
        <div class="btn-row"><button class="btn primary" data-act="runControls" ${S.can('run.controls') || S.can('view.all') ? '' : 'disabled'}>▶ ${esc(t('ctl.run', 'Run control tests'))}</button><button class="btn" data-act="report" data-id="controls">⤓ ${esc(t('rep.export', 'Export'))}</button></div></div>
        <div class="kpis small">${['PASS', 'WARNING', 'FAIL', 'NOT TESTED'].map((s) => `<div class="kpi static"><span class="kpi-label">${UI.badge(s, 'ctl.')}</span><span class="kpi-value">${esc(S.fmt.num(ct.summary[s]))}</span></div>`).join('')}</div>
        <div class="domains">${ct.domains.map((d) => `<button class="dom d-${UI.tone(d.status)}" data-tab="ctlDom:${esc(d.domain)}"><span>${esc(t('dom.' + d.domain))}</span>${UI.badge(d.status, 'ctl.')}<small>${esc(t('ctl.nTests', '{n} test(s)', { n: d.tests.length }))}</small></button>`).join('')}</div>
        ${UI.tabs('ctlTab', [['tests', t('ctl.tests', 'Control tests')], ['sod', t('ctl.sod', 'Segregation of duties')], ['authority', t('ctl.authority', 'Approval authority')]], tab)}`;
      if (tab === 'sod') return head + V.sodView();
      if (tab === 'authority') return head + V.authorityView();
      const dom = S.vs.ctlDom;
      const tests = ct.tests.filter((x) => !dom || x.domain === dom);
      return head + (dom ? `<p>${esc(t('ctl.filtered', 'Filtered: {d}', { d: t('dom.' + dom) }))} <button class="btn sm ghost" data-tab="ctlDom:">✕</button></p>` : '') + UI.section('', UI.table('ctlTests', [
        { key: 'id', label: 'ID', render: (x) => `<b>${esc(x.id)}</b>` },
        { key: 'domain', label: t('ctl.domain', 'Domain'), render: (x) => esc(t('dom.' + x.domain)) },
        { key: 'name', label: t('ctl.name', 'Control test'), render: (x) => esc(t('ct.' + x.id)), sort: (x) => t('ct.' + x.id) },
        { key: 'population', label: t('rc.population', 'Population'), num: true, render: (x) => UI.num(x.population) },
        { key: 'count', label: t('rc.exceptions', 'Exceptions'), num: true, render: (x) => UI.num(x.count) },
        { key: 'status', label: t('common.status', 'Status'), render: (x) => UI.badge(x.status, 'ctl.'), sort: (x) => ({ FAIL: 4, WARNING: 3, PASS: 1, 'NOT TESTED': 0 })[x.status] },
        { key: 'note', label: t('rc.note', 'Note'), render: (x) => `<span class="small muted">${esc(x.note || '')}</span>` },
        { key: 'ev', label: '', nosort: true, render: (x) => (x.count ? UI.evBtn('ctl', x.id) : '') },
      ], tests, { drill: () => null, pageSize: 50, exportName: 'control_tests' }));
    },
  };
  V.sodView = () => {
    const R = S.R, sod = R.sod;
    const critical = sod.users.filter((u) => u.severity === 'CRITICAL');
    return `${critical.map((u) => `<div class="warnbar crit">⛔ <b>${esc(t('sod.critical', 'CRITICAL CONTROL ISSUE'))}</b> — ${esc(t('sod.same', 'Same user {u} ({r}):', { u: u.name, r: u.role }))} ${u.txConflicts.map((x) => x.duties.map((d) => t('duty.' + d)).join(' + ')).filter((v, i, a) => a.indexOf(v) === i).map(esc).join(' · ')}</div>`).join('')}
      ${UI.section(t('sod.users', 'User duty profile (from transactions)'), UI.table('sodUsers', [
        { key: 'user', label: t('sod.user', 'User'), render: (u) => `<b>${esc(u.name)}</b><div class="small muted">${esc(u.user)} · ${esc(u.role)}</div>`, sort: (u) => u.name },
        { key: 'duties', label: t('sod.duties', 'Duties performed (count)'), render: (u) => `<span class="small">${Object.entries(u.counts).map(([d, n]) => `${esc(t('duty.' + d))} (${n})`).join(' · ')}</span>`, sort: (u) => u.duties.length },
        { key: 'tx', label: t('sod.txConf', 'Same-record conflicts'), num: true, render: (u) => UI.num(u.txConflicts.length), sort: (u) => u.txConflicts.length },
        { key: 'pairs', label: t('sod.pairs', 'Incompatible duty pairs held'), render: (u) => `<span class="small">${u.pairs.map((p) => p.map((d) => t('duty.' + d)).join(' ↔ ')).map(esc).join('<br>')}</span>`, sort: (u) => u.pairs.length },
        { key: 'sev', label: t('common.severity', 'Severity'), render: (u) => (u.severity ? UI.sev(u.severity) : UI.badge('PASS', 'ctl.')), sort: (u) => SEVR[u.severity] || 0 },
      ], sod.users, { drill: () => null, pageSize: 20, exportName: 'sod_users' }))}
      ${UI.section(t('sod.tx', 'Transaction-level conflicts'), UI.table('sodTx', [
        { key: 'user', label: t('sod.user', 'User') }, { key: 'd', label: t('sod.duties', 'Duties'), render: (x) => esc(x.duties.map((d) => t('duty.' + d)).join(' + ')) },
        { key: 'entity', label: t('dq.entity', 'Entity'), render: (x) => esc((S.schema[x.entity] || {}).label || x.entity) }, { key: 'detail', label: t('rf.txn', 'Transaction') },
      ], sod.tx, { drill: (x) => x.rec._key, pageSize: 15, exportName: 'sod_conflicts' }))}
      ${UI.section(t('sod.roles', 'Role design conflicts (permissions)'), sod.roleConf.length ? `<table><thead><tr><th>${esc(t('sod.role', 'Role'))}</th><th>${esc(t('sod.pairs', 'Incompatible duty pairs held'))}</th><th>${esc(t('sod.assigned', 'Users assigned'))}</th></tr></thead><tbody>${sod.roleConf.map((r) => `<tr><td>${esc(t('role.' + r.role, r.role))}</td><td class="small">${r.pairs.map((p) => p.map((d) => t('duty.' + d)).join(' ↔ ')).map(esc).join('<br>')}</td><td>${esc(r.users.join(', ') || '—')}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(t('sod.noRoleConf', 'No role grants incompatible duties.'))}</p>`)}`;
  };
  V.authorityView = () => {
    const R = S.R, a = R.authority, m = S.state.config.approvalMatrix;
    return `${UI.section(t('auth.matrix', 'Approval matrix (configurable — not SUMED policy)'), `<p class="muted small">${esc(m.note)}</p><table><thead><tr><th>${esc(t('auth.tier', 'Tier'))}</th><th>${esc(t('auth.upTo', 'Amount < ({c})', { c: ccy() }))}</th><th>${esc(t('auth.approvers', 'Approvers'))}</th></tr></thead><tbody>${m.tiers.map((x) => `<tr><td>${esc(x.id)}</td><td>${x.max == null ? '∞' : esc(S.fmt.num(x.max))}</td><td>${x.approvers.map((r) => esc(t('role.' + r, r))).join(' + ')}</td></tr>`).join('')}</tbody></table><ul class="small">${m.rules.filter((r) => r.enabled).map((r) => `<li>${esc(t('auth.rule.' + r.when, r.when))} → + ${esc(t('role.' + r.add, r.add))}</li>`).join('')}</ul><button class="btn sm" data-nav="settings">${esc(t('nav.settings', 'Settings'))} ›</button>`)}
      ${UI.section(t('auth.ex', 'Payments above approval authority'), a.tested ? UI.table('authEx', [
        { key: 'p', label: t('f.paymentId', 'Payment'), render: (x) => `<b>${esc(x.p.paymentId)}</b>`, sort: (x) => x.p.paymentId },
        { key: 's', label: t('f.supplierId', 'Supplier'), render: (x) => esc(UI.supName(x.p.supplierId) || '—') },
        { key: 'a', label: t('f.net', 'Amount'), num: true, render: (x) => UI.money(x.p.net, x.p.currency), sort: (x) => x.p._netBase },
        { key: 'req', label: t('bt.required', 'Required approvals'), render: (x) => `<span class="small">${x.req.roles.map((r) => esc(t('role.' + r, r))).join(' + ')}</span>` },
        { key: 'act', label: t('auth.actual', 'Actual approvers'), render: (x) => `<span class="small">${x.actual.map((u) => esc(u.u + ' (' + (u.role || '?') + ')')).join(', ') || '—'}</span>` },
        { key: 'miss', label: t('auth.missing', 'Missing'), render: (x) => x.missing.map((r) => UI.badge(t('role.' + r, r))).join(' ') },
      ], a.exceptions, { drill: (x) => x.p._key, pageSize: 15, exportName: 'authority_exceptions' }) : UI.na(t('auth.notTested', 'NOT TESTED — user directory with roles required')))}`;
  };

  /* ------------------------------ TAX & FX ------------------------------ */
  V.tax = {
    title: () => t('nav.tax', 'Tax & FX'),
    render() {
      const R = S.R, D = S.state.data, cfg = S.state.config;
      if (!D.invoices.length) return UI.empty();
      const tab = S.vs.taxTab || 'tax';
      const head = `<div class="page-h"><div><h1>${esc(t('nav.tax', 'Tax & FX'))}</h1><p class="muted">${esc(t('tax.sub', 'Tax rates and FX rates are never assumed: they come only from uploaded or configured authoritative inputs.'))} ${UI.demoTag()}</p></div></div>
        ${UI.tabs('taxTab', [['tax', t('tax.tax', 'Tax')], ['fx', t('tax.fx', 'FX exposure')]], tab)}`;
      if (tab === 'fx') {
        const rows = D.invoices.filter((i) => i.currency && i.currency !== cfg.baseCurrency).map((i) => {
          const pays = D.payments.filter((p) => p.invoiceNo === i.invoiceNo && p._isPaid);
          const realized = i._fx && pays.length && pays.every((p) => p._fx) ? U.sum(pays, (p) => (p._fx.rate - i._fx.rate) * (p.gross != null ? p.gross : p.net)) : null;
          const unreal = i._open && i._fx && i._fxNow ? (i._fxNow.rate - i._fx.rate) * i._out : null;
          return { i, pays, realized, unreal, _key: i._key };
        });
        const latest = U.uniq(D.fxRates.map((r) => r.currency)).map((c) => R.P.fx.rate(c, R.asOf)).filter(Boolean);
        const missingCcy = U.uniq(D.invoices.filter((i) => i._fxMissing && i.currency).map((i) => i.currency));
        return head + `<div class="grid g2">${UI.section(t('fx.rates', 'FX rates used (latest on/before as-of)'), latest.length ? `<table><thead><tr><th>${esc(t('f.currency', 'Ccy'))}</th><th class="n">${esc(t('fx.rate', 'Rate'))} → ${esc(cfg.baseCurrency)}</th><th>${esc(t('fx.date', 'Rate date'))}</th><th>${esc(t('fx.source', 'Source'))}</th></tr></thead><tbody>${latest.map((r) => `<tr data-drill="${esc(r.rec._key)}"><td>${esc(r.rec.currency)}</td><td class="n">${UI.num(r.rate, 4)}</td><td>${UI.date(r.date)}</td><td class="small">${esc(r.source)}</td></tr>`).join('')}</tbody></table>` : UI.na()) + (missingCcy.length ? `<p class="warnbar">⚠ ${esc(t('fx.na', 'FX RATE NOT AVAILABLE'))}: ${esc(missingCcy.join(', '))}</p>` : '')}
          ${UI.section(t('fx.summary', 'FX gain / loss (payables)'), `<table class="kv"><tr><th>${esc(t('fx.realized', 'Realised (paid invoices)'))}</th><td>${UI.base(-U.sum(rows.filter((r) => r.realized != null), (r) => r.realized))}</td></tr><tr><th>${esc(t('fx.unrealized', 'Unrealised (open invoices, revalued at as-of rate)'))}</th><td>${UI.base(-U.sum(rows.filter((r) => r.unreal != null), (r) => r.unreal))}</td></tr></table><p class="small muted">${esc(t('fx.sign', 'Positive = gain (base-currency cost fell); negative = loss. Formula: (invoice-date rate − payment/as-of rate) × foreign amount. Only computed when both rates exist.'))}</p>`)}</div>
          ${UI.section('', UI.table('fxTbl', [
            { key: 'inv', label: t('f.invoiceNo', 'Invoice'), render: (r) => `<b>${esc(r.i.invoiceNo)}</b>`, sort: (r) => r.i.invoiceNo },
            { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (r) => esc(UI.supName(r.i.supplierId) || '—') },
            { key: 'ic', label: t('fx.invCcy', 'Invoice currency'), render: (r) => esc(r.i.currency) },
            { key: 'pc', label: t('fx.payCcy', 'Payment currency'), render: (r) => esc(U.uniq(r.pays.map((p) => p.currency)).join(', ') || '—') },
            { key: 'amt', label: t('f.total', 'Total'), num: true, render: (r) => UI.num(r.i.total, 2) },
            { key: 'r1', label: t('fx.invRate', 'Rate (invoice date)'), num: true, render: (r) => (r.i._fx ? `${UI.num(r.i._fx.rate, 4)}<div class="small muted">${esc(r.i._fx.date || '')}</div>` : `<span class="na">${esc(t('fx.na', 'FX RATE NOT AVAILABLE'))}</span>`) },
            { key: 'b', label: t('fx.base', 'Base amount'), num: true, render: (r) => UI.num(r.i._totalBase, 0), sort: (r) => r.i._totalBase },
            { key: 'r2', label: t('fx.payRate', 'Rate (payment)'), num: true, render: (r) => (r.pays.length ? r.pays.map((p) => (p._fx ? S.fmt.num(p._fx.rate, 4) : '—')).join(', ') : '—') },
            { key: 'rg', label: t('fx.realized', 'Realised'), num: true, render: (r) => (r.realized == null ? '—' : UI.num(-r.realized, 0)), sort: (r) => r.realized },
            { key: 'ug', label: t('fx.unrealized', 'Unrealised'), num: true, render: (r) => (r.unreal == null ? '—' : UI.num(-r.unreal, 0)), sort: (r) => r.unreal },
          ], rows, { pageSize: 20, exportName: 'fx_exposure' }))}`;
      }
      const tc = cfg.taxCodes.concat(D.taxCodes.filter((x) => !cfg.taxCodes.some((y) => y.code === x.code)));
      const invs = D.invoices.filter((i) => !i._closed && i.total != null);
      const byCcy = Array.from(U.groupBy(invs, 'currency').entries()).map(([c, rs]) => ({ c, gross: U.sum(rs, (i) => i.total), tax: U.sum(rs, (i) => i.tax || 0), wht: U.sum(rs, (i) => i.wht || 0), missing: rs.filter((i) => i.tax == null).length }));
      const rates = Array.from(U.groupBy(invs.filter((i) => i.subtotal > 0 && i.tax != null), (i) => S.fmt.num(Math.round((i.tax / i.subtotal) * 1000) / 10, 1) + '%').entries()).map(([k, rs]) => ({ label: k, value: rs.length })).sort((a, b) => b.value - a.value);
      return head + `<div class="grid g2">${UI.section(t('tax.config', 'Configured tax codes'), tc.length ? `<table><thead><tr><th>${esc(t('tax.code', 'Code'))}</th><th>${esc(t('tax.name', 'Name'))}</th><th>${esc(t('tax.type', 'Type'))}</th><th class="n">${esc(t('tax.rate', 'Rate %'))}</th><th>${esc(t('fx.source', 'Source'))}</th></tr></thead><tbody>${tc.map((x) => `<tr><td>${esc(x.code)}</td><td>${esc(x.name || '')}</td><td>${esc(x.type)}</td><td class="n">${UI.num(x.ratePct, 2)}</td><td class="small">${esc(x.source || '')}</td></tr>`).join('')}</tbody></table>` : `<p class="warnbar">⚠ ${esc(t('tax.noConfig', 'No tax rates configured. Upload a tax configuration file or add codes in Settings. Tax-rate tests are NOT TESTED.'))}</p>`)}
        ${UI.section(t('tax.rates', 'Effective VAT rate distribution (tax ÷ subtotal)'), C.bars(rates.slice(0, 10), { fmt: (v) => S.fmt.num(v) }))}</div>
        ${UI.section(t('tax.summary', 'Gross · tax · withholding · net payment (by invoice currency)'), `<table><thead><tr><th>${esc(t('f.currency', 'Ccy'))}</th><th class="n">${esc(t('tax.gross', 'Gross'))}</th><th class="n">${esc(t('f.tax', 'Tax'))}</th><th class="n">${esc(t('f.wht', 'Withholding'))}</th><th class="n">${esc(t('tax.net', 'Net payable'))}</th><th class="n">${esc(t('tax.missing', 'Missing tax info'))}</th></tr></thead><tbody>${byCcy.map((x) => `<tr><td>${esc(x.c || '—')}</td><td class="n">${UI.num(x.gross, 2)}</td><td class="n">${UI.num(x.tax, 2)}</td><td class="n">${UI.num(x.wht, 2)}</td><td class="n">${UI.num(x.gross - x.wht, 2)}</td><td class="n">${UI.num(x.missing)}</td></tr>`).join('')}</tbody></table>`)}
        ${UI.section(t('tax.flags', 'Tax red flags'), R.alerts.list.filter((a) => a.category === 'TAX').map((a) => `<div class="flag">${UI.sev(a.severity)} ${esc(a.txn)} — ${esc(S.alertText(a))} ${UI.evBtn('alert', a.id)}</div>`).join('') || `<p class="muted">${esc(t('tax.noFlags', 'No tax flags.'))}</p>`)}`;
    },
  };

  /* ------------------------------ AUDIT TRAIL ------------------------------ */
  V.audit = {
    title: () => t('nav.audit', 'Audit Trail'),
    render() {
      const log = S.state.audit.slice().reverse();
      const chain = S.verifyAudit();
      return `<div class="page-h"><div><h1>${esc(t('nav.audit', 'Audit Trail'))}</h1><p class="muted">${esc(t('aud.sub', 'Append-only and hash-chained (each entry carries the hash of the previous one). There is no edit or delete function in the user interface.'))}</p></div><div class="btn-row"><button class="btn" data-act="report" data-id="audit">⤓ ${esc(t('rep.export', 'Export'))}</button></div></div>
        <p class="${chain.ok ? 'okbar' : 'warnbar crit'}">${chain.ok ? '✔ ' + esc(t('aud.ok', 'Hash chain verified: {n} entries intact.', { n: chain.total })) : '⛔ ' + esc(t('aud.broken', 'Hash chain broken at entry {n}.', { n: chain.brokenAt }))}</p>
        ${UI.section('', UI.table('audit', [
          { key: 'seq', label: '#', num: true }, { key: 'ts', label: t('aud.ts', 'Timestamp'), render: (e) => `<span class="small">${esc(S.fmt.ts(e.ts))}</span>` },
          { key: 'userId', label: t('aud.user', 'User'), render: (e) => `${esc(e.userId)}<div class="small muted">${esc(e.role)}</div>` },
          { key: 'action', label: t('aud.action', 'Action'), render: (e) => `<code>${esc(e.action)}</code>` }, { key: 'entity', label: t('dq.entity', 'Record type') }, { key: 'recordId', label: t('aud.record', 'Record') },
          { key: 'field', label: t('aud.field', 'Field') }, { key: 'oldValue', label: t('aud.old', 'Old value'), render: (e) => `<span class="small">${esc(e.oldValue == null ? '' : typeof e.oldValue === 'object' ? JSON.stringify(e.oldValue) : e.oldValue)}</span>` },
          { key: 'newValue', label: t('aud.new', 'New value'), render: (e) => `<span class="small">${esc(e.newValue == null ? '' : typeof e.newValue === 'object' ? JSON.stringify(e.newValue) : e.newValue)}</span>` },
          { key: 'reason', label: t('aud.reason', 'Reason'), render: (e) => `<span class="small">${esc(e.reason || '')}</span>` },
          { key: 'sessionId', label: t('aud.session', 'Session / IP'), render: (e) => `<span class="small mono">${esc(e.sessionId)}</span><div class="small muted">${esc(t('aud.ip', 'IP: {v}', { v: e.ip }))}</div>` },
          { key: 'hash', label: t('aud.hash', 'Hash'), render: (e) => `<span class="small mono">${esc(e.hash)}</span>` },
        ], log, { drill: () => null, pageSize: 30, exportName: 'audit_trail' }))}`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
