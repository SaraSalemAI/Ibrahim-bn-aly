/* SUMED P2P — executive views: CFO dashboard, CFO action center, management summary, AI insights. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui, C = S.chart;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const V = (S.views = S.views || {});
  S.vs = S.vs || {};

  /** Human text for an alert (numbers formatted, booleans translated) */
  S.alertText = (a) => {
    const p = {};
    Object.entries(a.params || {}).forEach(([k, v]) => {
      if (typeof v === 'number') p[k] = S.fmt.num(v, Math.abs(v) < 100 && v % 1 ? 1 : 0);
      else if (typeof v === 'boolean') p[k] = v ? t('common.yes', 'Yes') : t('common.no', 'No');
      else if (k === 'dow') p[k] = v;
      else if (k === 'reasons') p[k] = String(v).split(', ').map((x) => UI.reason('sig.', x)).join(', ');
      else if (k === 'level') p[k] = t('dup.' + v, v);
      else p[k] = v;
    });
    if (a.rule === 'roundAmount') p.nonPO = a.params.nonPO ? ' — ' + t('fr.noPO', 'no PO reference') : '';
    if (a.rule === 'dq_missingField') p.field = UI.fieldLabel(a.params.field || '');
    return t('rule.' + a.rule, a.rule, p);
  };
  S.insightText = (i, part) => {
    const p = {};
    Object.entries(i.params || {}).forEach(([k, v]) => (p[k] = typeof v === 'number' ? S.fmt.num(v, v % 1 ? 1 : 0) : Array.isArray(v) ? v.map((d) => t('drv.' + d + '.short', d)).join(', ') : k === 'rating' ? t('sev.' + v, v) : v));
    const key = 'ins.' + i.key + '.' + part;
    if (i.key.startsWith('saving_') && part !== 'o') return t('ins.saving.' + part, '', p);
    return t(key, '', p);
  };
  const ccy = () => S.state.config.baseCurrency;
  const sevTone = { CRITICAL: 'critical', HIGH: 'serious', MEDIUM: 'warning', LOW: 'good' };

  /* ------------------------------ DASHBOARD ------------------------------ */
  V.dashboard = {
    title: () => t('nav.dashboard', 'CFO Dashboard'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.invoices.length && !D.suppliers.length) return UI.empty();
      const K = (id, o) => UI.kpi(id, o);
      const k = R.kpis;
      const months = R.spend.byMonth;
      const top10 = R.spend.bySupplier.slice(0, 10);
      const cat = R.spend.byCategory;
      const dept = R.spend.byDepartment.slice(0, 8);
      const ag = R.aging.buckets;
      const payStatus = Array.from(U.groupBy(D.payments, (p) => p.executionStatus || '—').entries()).map(([s, ps]) => ({ label: s, value: U.sum(ps, (p) => p._netBase || 0), nav: 'payments', tone: UI.tone(s) === 'neutral' ? null : UI.tone(s) }));
      const exByMonth = Array.from(U.groupBy(D.invoices.filter((i) => i.invoiceDate), (i) => i.invoiceDate.slice(0, 7)).entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-12);
      const riskCounts = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((r) => ({ label: t('sev.' + r), value: Array.from(R.risk.values()).filter((x) => x.rating === r).length, tone: sevTone[r], nav: 'risk' }));
      const cons = R.cash.consolidated;
      const wk = R.cash.weekly;
      const pf = R.payForecast.months;
      return `
      <div class="page-h"><div><h1>${esc(t('nav.dashboard', 'CFO Dashboard'))}</h1><p class="muted">${esc(t('dash.sub', 'Supplier-to-payment position as of {d} · base currency {c}', { d: S.fmt.date(R.asOf), c: ccy() }))} ${UI.demoTag()}</p></div>
        <div class="btn-row"><button class="btn" data-nav="actions">⚡ ${esc(t('nav.actions', 'CFO Action Center'))}</button><button class="btn" data-nav="summary">📝 ${esc(t('nav.summary', 'Management Summary'))}</button></div></div>
      <div class="kpis">
        ${K('totalSpend')}${K('totalAP')}${K('overdueAP', { tone: k.overdueAP.value > 0 ? 'serious' : null })}${K('paymentsDue')}
        ${K('paymentsScheduled')}${K('paymentsExecuted')}${K('cashRequired')}${K('supplierCount')}
        ${K('criticalSuppliers')}${K('highRiskSuppliers', { tone: k.highRiskSuppliers.value ? 'critical' : null })}${K('invoiceExceptions', { tone: k.invoiceExceptions.value ? 'serious' : null })}${K('duplicateRisk', { tone: k.duplicateRisk.value ? 'critical' : null })}
        ${K('fraudAlerts', { tone: k.fraudAlerts.value ? 'critical' : null })}${K('contractExposure')}${K('dpo')}${K('paymentCycle')}
      </div>
      <div class="grid g2">
        ${UI.section(t('ch.spendTrend', 'Supplier spend trend (monthly, {c})', { c: ccy() }), C.bars(months.map((m) => ({ label: m.key, value: m.amount, nav: 'spend', tip: `${m.key}: ${S.fmt.money(m.amount, ccy())}` })), { title: 'spend' }))}
        ${UI.section(t('ch.aging', 'AP aging ({c})', { c: ccy() }), C.bars(ag.map((b) => ({ label: t('bk.' + b.id), value: b.amount, nav: 'aging', tone: b.id === 'current' ? 'good' : b.id === 'b1_30' ? 'warning' : b.id === 'noDue' ? null : 'critical', tip: `${t('bk.' + b.id)}: ${S.fmt.money(b.amount, ccy())} · ${b.count}` }))))}
        ${UI.section(t('ch.payForecast', 'Payment forecast — next 12 months ({c})', { c: ccy() }), C.stacked(pf.map((m) => m.month), ['scheduled', 'approvedInvoice', 'pendingInvoice', 'poCommitment'].map((ty, i) => ({ name: t('ftype.' + ty), values: pf.map((m) => m.byType[ty]), slot: i })), { nav: () => 'treasury' }))}
        ${UI.section(t('ch.cash', '13-week consolidated cash projection ({c})', { c: ccy() }), cons.series.length ? C.line(wk.map((w) => S.fmt.date(w.to)), [{ name: t('tr.projected', 'Projected cash'), values: wk.map((w) => w.closing) }], { threshold: { value: cons.minCash, label: t('tr.minCash', 'Minimum cash') }, area: true, nav: () => 'treasury' }) + (cons.excluded.length ? `<p class="muted small">⚠ ${esc(t('tr.excluded', 'Excluded (no bank balance or FX rate): {c}', { c: cons.excluded.join(', ') }))}</p>` : '') : UI.na())}
        ${UI.section(t('ch.topSup', 'Top 10 suppliers by spend'), C.bars(top10.map((s) => ({ label: UI.supName(s.key) || s.name, value: s.amount, drill: (R.P.sup.get(s.key) || {})._key, tip: `${s.name}: ${S.fmt.money(s.amount, ccy())} (${S.fmt.pct(s.share)})` })), { horizontal: true }))}
        ${UI.section(t('ch.category', 'Spend by category'), C.donut(cat.map((c) => ({ label: c.key, value: c.amount, nav: 'spend' })), { centerLabel: ccy() }))}
        ${UI.section(t('ch.dept', 'Spend by department'), C.bars(dept.map((d) => ({ label: d.key, value: d.amount, nav: 'spend' })), { horizontal: true, slot: 2 }))}
        ${UI.section(t('ch.payStatus', 'Payments by status ({c})', { c: ccy() }), C.donut(payStatus, { centerLabel: ccy() }))}
        ${UI.section(t('ch.exceptions', 'Invoice exceptions by month'), C.line(exByMonth.map((x) => x[0]), [{ name: t('ch.exc', 'Exceptions'), values: exByMonth.map((x) => x[1].filter((i) => { const m = R.match.get(i._key); return m && !['MATCHED', 'PARTIALLY MATCHED'].includes(m.status); }).length), tone: 'critical' }, { name: t('ch.invoices', 'Invoices'), values: exByMonth.map((x) => x[1].length), slot: 0, dashed: true }], { nav: () => 'matching' }))}
        ${UI.section(t('ch.risk', 'Supplier risk distribution'), C.bars(riskCounts, {}))}
      </div>
      ${V.cfoQuestions()}`;
    },
  };

  /** Section 71: the 16 CFO questions, each answered from data with a link */
  V.cfoQuestions = () => {
    const R = S.R, k = R.kpis, D = S.state.data;
    const m = (v) => (v == null ? UI.na() : UI.base(v, { compact: true }));
    const crit = D.suppliers.filter((s) => s.critical).length;
    const hr = Array.from(R.risk.entries()).filter(([, r]) => ['HIGH', 'CRITICAL'].includes(r.rating));
    const appr = R.priority.filter((x) => x.blocks.includes('notApproved'));
    const dupl = R.alerts.list.filter((a) => ['duplicateInvoice', 'duplicatePayment'].includes(a.rule) || a.category === 'FRAUD');
    const nosup = D.invoices.filter((i) => { const mm = R.match.get(i._key); return mm && ['MISSING PO', 'MISSING GRN', 'DUPLICATE', 'EXCEPTION'].includes(mm.status) && !i._closed; });
    const poExc = D.invoices.filter((i) => { const mm = R.match.get(i._key); return i.poNo && mm && !['MATCHED', 'PARTIALLY MATCHED'].includes(mm.status); });
    const exp = R.contracts.list.filter((c) => c.alerts.includes('expiring') || c.alerts.includes('expired'));
    const sav = k.potentialSavings.value;
    const fails = R.controls.tests.filter((x) => x.status === 'FAIL').length;
    const cons = R.cash.consolidated;
    const topExp = R.aging.bySup[0];
    const urgent = R.actions.filter((a) => a.bucket === 'today').length;
    const today = k.payToday.value;
    const week = U.sum(R.priority.filter((x) => x.inv._dpd != null && x.inv._dpd >= -7), (x) => x.amountBase || 0);
    const Q = [
      ['q1', 'How much do we owe suppliers?', m(k.totalAP.value), 'aging'],
      ['q2', 'What must we pay today?', m(today), 'payments'],
      ['q3', 'What must we pay this week?', m(week), 'payments'],
      ['q4', 'Which suppliers are critical?', esc(S.fmt.num(crit)), 'suppliers'],
      ['q5', 'Which suppliers are high-risk?', esc(S.fmt.num(hr.length)), 'risk'],
      ['q6', 'Where is cash going?', R.spend.byCategory[0] ? esc(R.spend.byCategory[0].key) + ' · ' + m(R.spend.byCategory[0].amount) : UI.na(), 'spend'],
      ['q7', 'Which payments require approval?', esc(S.fmt.num(appr.length)) + ' · ' + m(U.sum(appr, (x) => x.amountBase || 0)), 'payments'],
      ['q8', 'Are there duplicate or suspicious payments?', esc(S.fmt.num(dupl.length)), 'fraud'],
      ['q9', 'Which invoices lack proper supporting documents?', esc(S.fmt.num(nosup.length)), 'matching'],
      ['q10', 'Which POs have exceptions?', esc(S.fmt.num(U.uniq(poExc.map((i) => i.poNo)).length)), 'matching'],
      ['q11', 'Which contracts are expiring?', esc(S.fmt.num(exp.length)), 'contracts'],
      ['q12', 'Where can we reduce cost?', m(sav), 'savings'],
      ['q13', 'Where are internal controls failing?', esc(S.fmt.num(fails)) + ' ' + esc(t('q.fails', 'failed tests')), 'controls'],
      ['q14', 'What is the projected cash impact?', cons.min ? m(cons.min.closing) + ` <span class="muted small">${esc(t('q.lowest', 'lowest, {d}', { d: S.fmt.date(cons.min.date) }))}</span>` : UI.na(), 'treasury'],
      ['q15', 'Which suppliers have the largest exposure?', topExp ? esc(UI.supName(topExp.supplierId) || '') + ' · ' + m(topExp.total) : UI.na(), 'aging'],
      ['q16', 'What requires immediate CFO attention?', esc(S.fmt.num(urgent)) + ' ' + esc(t('q.urgent', 'urgent items')), 'actions'],
    ];
    return UI.section(t('q.title', 'CFO questions — answered from source data'), `<div class="qgrid">${Q.map(([id, q, a, nav]) => `<button class="q" data-nav="${nav}"><span>${esc(t('q.' + id, q))}</span><b>${a}</b></button>`).join('')}</div>`);
  };

  /* ------------------------------ ACTION CENTER ------------------------------ */
  V.actions = {
    title: () => t('nav.actions', 'CFO Action Center'),
    render() {
      const R = S.R;
      if (!S.state.data.invoices.length) return UI.empty();
      const col = (b) => {
        const items = R.actions.filter((a) => a.bucket === b);
        return `<div class="ac-col"><h3>${esc(t('bucket.' + b))} <span class="count">${items.length}</span></h3>${items.map((a) => `<article class="ac-card">
          <p class="ac-issue">${esc(t('ac.' + a.key, a.key, Object.fromEntries(Object.entries(a.params).map(([k, v]) => [k, typeof v === 'number' ? S.fmt.num(v) : k === 'date' ? S.fmt.date(v) : v]))))}</p>
          <dl><dt>${esc(t('ac.impact', 'Impact'))}</dt><dd>${a.impact != null ? UI.base(a.impact, { compact: true }) : UI.na(t('ac.notQuantified', 'Not quantified'))}</dd>
          <dt>${esc(t('ac.owner', 'Owner'))}</dt><dd>${esc(t('role.' + a.owner, a.owner))}</dd>
          <dt>${esc(t('ac.due', 'Due'))}</dt><dd>${UI.date(a.due)}</dd>
          <dt>${esc(t('ac.rec', 'Recommendation'))}</dt><dd>${esc(t('act.' + a.rec))}</dd></dl>
          ${UI.evBtn('action', a.id)}</article>`).join('') || `<p class="muted">${esc(t('ac.none', 'Nothing in this bucket.'))}</p>`}</div>`;
      };
      return `<div class="page-h"><div><h1>${esc(t('nav.actions', 'CFO Action Center'))}</h1><p class="muted">${esc(t('ac.sub', 'Issue · impact · owner · due date · recommendation · evidence'))} ${UI.demoTag()}</p></div></div>
        <div class="ac">${col('today')}${col('week')}${col('month')}</div>`;
    },
  };

  /* ------------------------------ MANAGEMENT SUMMARY ------------------------------ */
  V.buildSummary = () => {
    const R = S.R, D = S.state.data, cur = ccy();
    const out = [];
    const st = (sec, text, rows, extra = {}) => out.push(Object.assign({ sec, text, rows: (rows || []).filter(Boolean) }, extra));
    const money = (v) => S.fmt.money(v, cur, { compact: true });
    // 1 Financial issues — largest-impact alerts & control/data issues
    const fin = R.redFlags.filter((f) => f.amountBase).sort((a, b) => b.amountBase - a.amountBase).slice(0, 5);
    fin.forEach((f) => st(1, `${t('cat.' + f.category)}: ${S.alertText(f)} — ${money(f.amountBase)}`, f.rows, { sev: f.severity }));
    if (R.recon.gl && R.recon.gl.status !== 'MATCHED') st(1, t('sum.glDiff', 'GL AP balance ({p}) differs from the AP sub-ledger by {d}', { p: R.recon.gl.period, d: money(R.recon.gl.diff) }), [R.recon.gl.rec], { sev: 'HIGH' });
    // 2 Payment risks
    R.alerts.list.filter((a) => ['PAYMENT', 'BANK'].includes(a.category) && ['CRITICAL', 'HIGH'].includes(a.severity)).slice(0, 5).forEach((a) => st(2, `${S.alertText(a)} — ${a.txn}${a.amountBase ? ' · ' + money(a.amountBase) : ''}`, a.rows, { sev: a.severity }));
    // 3 Supplier risks
    Array.from(R.risk.entries()).sort((a, b) => b[1].score - a[1].score).slice(0, 5).forEach(([sid, r]) => st(3, `${UI.supName(sid)} — ${t('sev.' + r.rating)} ${r.score}/100: ${r.drivers.slice(0, 3).map((d) => S.driverText(d)).join('; ')}`, r.drivers.flatMap((d) => d.rows).concat([R.P.sup.get(sid)]), { sev: r.rating }));
    // 4 Control failures
    R.controls.tests.filter((x) => x.status === 'FAIL').sort((a, b) => b.count - a.count).slice(0, 5).forEach((x) => st(4, `${x.id} ${t('ct.' + x.id)} — ${t('sum.exceptions', '{n} exception(s) in {p}', { n: x.count, p: x.population })}`, x.exceptions, { sev: 'HIGH' }));
    // 5 Liquidity
    const cs = Object.values(R.cash.currencies).filter((c) => !c.noBank);
    cs.forEach((c) => {
      if (c.belowMinDays) st(5, t('sum.liqBelow', '{c}: projected below minimum cash on {n} day(s); lowest {v} on {d}', { c: c.currency, n: c.belowMinDays, v: S.fmt.money(c.min.closing, c.currency, { compact: true }), d: S.fmt.date(c.min.date) }), c.accounts, { sev: c.shortfallDays ? 'CRITICAL' : 'HIGH' });
    });
    if (!out.some((x) => x.sec === 5)) st(5, t('sum.liqOk', 'No currency is projected below its configured minimum cash in the next 13 weeks (lowest consolidated {v}).', { v: R.cash.consolidated.min ? money(R.cash.consolidated.min.closing) : '—' }), D.bankAccounts);
    Object.values(R.cash.currencies).filter((c) => c.noBank).forEach((c) => st(5, t('sum.liqNoBank', '{c}: obligations exist but no bank account / balance was provided — liquidity cannot be assessed.', { c: c.currency }), R.items.filter((x) => x.currency === c.currency).map((x) => x.rec).slice(0, 20), { sev: 'MEDIUM' }));
    // 6 Savings
    R.savings.filter((s) => s.saving > 0).slice(0, 5).forEach((s) => st(6, `${t('sv.' + s.type)}: ${money(s.saving)} (${t('conf.' + s.confidence)})`, s.rows, { calc: s.method }));
    // 7 Immediate actions
    R.actions.filter((a) => a.bucket === 'today').slice(0, 8).forEach((a) => st(7, `${t('ac.' + a.key, a.key, Object.fromEntries(Object.entries(a.params).map(([k, v]) => [k, typeof v === 'number' ? S.fmt.num(v) : v])))} → ${t('act.' + a.rec)}`, a.rows));
    // 8 Upcoming critical payments (next 7 days, critical supplier or large)
    R.items.filter((x) => x.type !== 'poCommitment' && x.date && U.daysBetween(R.asOf, x.date) <= 7 && ((R.P.sup.get(x.supplierId) || {}).critical || x.amountBase >= S.state.config.alerts.largePayment)).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 8).forEach((x) => st(8, `${S.fmt.date(x.date)} · ${UI.supName(x.supplierId)} · ${S.fmt.money(x.amount, x.currency)} (${t('ftype.' + x.type)})`, [x.rec]));
    return out;
  };
  S.driverText = (d) => {
    const p = {};
    Object.entries(d.params).forEach(([k, v]) => (p[k] = typeof v === 'number' ? S.fmt.num(v, v % 1 ? 1 : 0) : v === true ? t('common.yes', 'Yes') : v === false ? t('common.no', 'No') : k === 'date' ? S.fmt.date(v) : v));
    return t('drv.' + d.key, d.key, p);
  };
  V.summary = {
    title: () => t('nav.summary', 'Management Summary'),
    render() {
      if (!S.state.data.invoices.length) return UI.empty();
      const items = (S.vs.summary = V.buildSummary());
      const secs = [[1, 'Top financial issues'], [2, 'Top payment risks'], [3, 'Top supplier risks'], [4, 'Top control failures'], [5, 'Liquidity concerns'], [6, 'Cost-saving opportunities'], [7, 'Immediate actions'], [8, 'Upcoming critical payments']];
      return `<div class="page-h"><div><h1>${esc(t('sum.title', 'What does the CFO need to know today?'))}</h1><p class="muted">${esc(t('sum.sub', 'Every statement is generated from source data and links to its evidence. As of {d}.', { d: S.fmt.date(S.R.asOf) }))} ${UI.demoTag()}</p></div>
        <div class="btn-row"><button class="btn" data-act="report" data-id="exec">⤓ PDF</button></div></div>
        <div class="grid g2">${secs.map(([n, title]) => UI.section(`${n}. ${t('sum.s' + n, title)}`, `<ol class="stmts">${items.map((x, i) => (x.sec === n ? `<li>${x.sev ? UI.sev(x.sev) + ' ' : ''}${esc(x.text)} ${UI.evBtn('sum', i)}</li>` : '')).join('') || `<li class="muted">${esc(t('sum.none', 'Nothing to report from the available data.'))}</li>`}</ol>`)).join('')}</div>`;
    },
  };

  /* ------------------------------ AI INSIGHTS ------------------------------ */
  V.insights = {
    title: () => t('nav.insights', 'AI Insights'),
    render() {
      const R = S.R;
      if (!S.state.data.invoices.length) return UI.empty();
      const area = S.vs.insArea || 'all';
      const areas = ['all', 'cfo', 'treasury', 'ap', 'procurement', 'supplier', 'audit', 'fraud', 'cost'];
      const list = R.insights.filter((i) => area === 'all' || i.area === area);
      return `<div class="page-h"><div><h1>${esc(t('nav.insights', 'AI Insights'))}</h1><p class="muted">${esc(t('ins.sub', 'Deterministic, explainable analytics — every insight shows observation, why it matters, impact, evidence, root cause, action, priority and owner.'))} ${UI.demoTag()}</p></div></div>
        ${UI.tabs('insArea', areas.map((a) => [a, a === 'all' ? t('common.all', 'All') : t('area.' + a)]), area)}
        <div class="ins-list">${list.map((i) => `<article class="ins">
          <header>${UI.sev(i.priority)} <span class="pill">${esc(t('area.' + i.area))}</span> <h3>${esc(S.insightText(i, 'o'))}</h3></header>
          <dl class="ins-dl">
            <dt>${esc(t('ins.why', 'Why it matters'))}</dt><dd>${esc(S.insightText(i, 'w'))}</dd>
            <dt>${esc(t('ins.impact', 'Financial impact'))}</dt><dd>${i.impact != null ? UI.base(i.impact) + ' ' + UI.kind('DERIVED') : UI.na(t('ac.notQuantified', 'Not quantified'))}</dd>
            <dt>${esc(t('ins.root', 'Root cause'))}</dt><dd>${esc(i.rootCause ? t('rcz.' + i.rootCause, t('drv.' + i.rootCause + '.short', t('sv.' + i.rootCause, i.rootCause))) : '—')}</dd>
            <dt>${esc(t('ins.action', 'Recommended action'))}</dt><dd>${esc(S.insightText(i, 'a'))}</dd>
            <dt>${esc(t('ins.owner', 'Responsible function'))}</dt><dd>${esc(t('role.' + i.owner, i.owner))}</dd>
            <dt>${esc(t('ins.evidence', 'Evidence'))}</dt><dd>${esc(t('ins.records', '{n} record(s)', { n: (i.rows || []).filter(Boolean).length }))} · ${esc(t('ev.completeness', 'Evidence completeness'))}: ${UI.badge(i.completeness, 'conf.')} ${UI.evBtn('insight', i.id)}</dd>
            ${i.calc ? `<dt>${esc(t('ins.calc', 'Calculation'))}</dt><dd><code>${esc(i.calc)}</code></dd>` : ''}
          </dl></article>`).join('') || `<p class="muted">${esc(t('ins.none', 'No insights for this area from the available data.'))}</p>`}</div>`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
