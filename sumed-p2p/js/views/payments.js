/* SUMED P2P — payments, payment calendar, AP aging & DPO, treasury & scenarios, banks & reconciliation. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui, C = S.chart;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const V = (S.views = S.views || {});
  S.vs = S.vs || {};
  const ccy = () => S.state.config.baseCurrency;

  V.paymentCols = () => [
    { key: 'paymentId', label: t('f.paymentId', 'Payment ID'), render: (p) => `<b>${esc(p.paymentId)}</b>` },
    { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (p) => esc(UI.supName(p.supplierId) || '—'), sort: (p) => UI.supName(p.supplierId) },
    { key: 'invoiceNo', label: t('f.invoiceNo', 'Invoice'), render: (p) => UI.v(p.invoiceNo) },
    { key: 'paymentDate', label: t('f.paymentDate', 'Payment date'), render: (p) => UI.date(p.paymentDate) },
    { key: 'currency', label: t('f.currency', 'Ccy') },
    { key: 'gross', label: t('f.gross', 'Gross'), num: true, render: (p) => UI.num(p.gross, 2) },
    { key: 'wht', label: t('f.wht', 'WHT'), num: true, render: (p) => UI.num(p.wht, 2) },
    { key: 'net', label: t('f.net', 'Net payment'), num: true, render: (p) => UI.num(p.net, 2) },
    { key: 'bank', label: t('f.bankAccountId', 'Paying account'), render: (p) => UI.v(p.bankAccountId) },
    { key: 'method', label: t('f.method', 'Method'), render: (p) => UI.v(p.method) },
    { key: 'batchId', label: t('f.batchId', 'Batch'), render: (p) => UI.v(p.batchId) },
    { key: 'reference', label: t('f.reference', 'Bank reference'), render: (p) => UI.v(p.reference) },
    { key: 'appr', label: t('f.approvalStatus', 'Approval'), render: (p) => UI.badge(p.approvalStatus), sort: (p) => p.approvalStatus },
    { key: 'exec', label: t('f.executionStatus', 'Execution'), render: (p) => UI.badge(p.executionStatus), sort: (p) => p.executionStatus },
    { key: 'rec', label: t('pay.recon', 'Reconciliation'), render: (p) => { const b = S.R.bank.items.find((x) => x.p === p); return b ? UI.badge(b.status, 'rc.') : UI.na('—'); }, sort: (p) => (S.R.bank.items.find((x) => x.p === p) || {}).status },
  ];

  /** Batch approval requirements (config-driven) and state */
  V.batchInfo = (b) => {
    const R = S.R, D = S.state.data;
    const ps = D.payments.filter((p) => p.batchId === b.batchId);
    const tot = U.sum(ps, (p) => p.net || 0);
    const totBase = U.sum(ps, (p) => p._netBase || 0);
    const req = S.engine.requiredApprovers(totBase, { currency: b.currency, emergency: ps.some((p) => p.urgent) }, S.state.config);
    const needCfo = req.roles.some((r) => ['CFO', 'Authorized Executive'].includes(r));
    const ready = !!b.treasuryApprovedBy && (!needCfo || !!b.cfoApprovedBy);
    return { ps, tot, totBase, req, needCfo, ready, suppliers: U.uniq(ps.map((p) => p.supplierId)).length, invoices: U.uniq(ps.map((p) => p.invoiceNo)).length };
  };

  /* ------------------------------ PAYMENTS ------------------------------ */
  V.payments = {
    title: () => t('nav.payments', 'Payments'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.invoices.length && !D.payments.length) return UI.empty();
      const tab = S.vs.payTab || 'queue';
      const sel = (S.vs.paySel = S.vs.paySel || new Set());
      const head = `<div class="page-h"><div><h1>${esc(t('nav.payments', 'Payments'))}</h1><p class="muted">⚠ ${esc(t('pay.never', 'The system recommends; it never executes payments. Authorised humans approve, submit and execute.'))} ${UI.demoTag()}</p></div></div>
        <div class="kpis">${UI.kpi('payToday')}${UI.kpi('paymentsDue')}${UI.kpi('paymentsScheduled')}${UI.kpi('paymentsExecuted')}${UI.kpi('onTimeRate')}${UI.kpi('latePaymentRate')}${UI.kpi('discountCapture')}${UI.kpi('paymentRegisterTotal')}</div>
        ${UI.tabs('payTab', [['queue', t('pay.queue', 'Payment priority queue')], ['proposal', t('pay.proposal', 'Payment proposal')], ['batches', t('pay.batches', 'Payment batches')], ['register', t('pay.register', 'Payment register')]], tab)}`;
      if (tab === 'register') return head + UI.section('', UI.table('payReg', V.paymentCols(), D.payments, { pageSize: 25, exportName: 'payment_register' }));
      if (tab === 'batches') {
        const rows = D.batches.slice().sort((a, b) => ((a.paymentDate || '') < (b.paymentDate || '') ? 1 : -1)).map((b) => Object.assign({ b, _key: b._key }, V.batchInfo(b)));
        return head + UI.section('', UI.table('batches', [
          { key: 'id', label: t('f.batchId', 'Batch'), render: (r) => `<b>${esc(r.b.batchId)}</b>`, sort: (r) => r.b.batchId },
          { key: 'date', label: t('f.paymentDate', 'Payment date'), render: (r) => UI.date(r.b.paymentDate), sort: (r) => r.b.paymentDate },
          { key: 'sup', label: t('bt.suppliers', 'Suppliers'), num: true, render: (r) => UI.num(r.suppliers), sort: (r) => r.suppliers },
          { key: 'inv', label: t('bt.invoices', 'Invoices'), num: true, render: (r) => UI.num(r.invoices), sort: (r) => r.invoices },
          { key: 'tot', label: t('f.total', 'Total'), num: true, render: (r) => UI.money(r.tot, r.b.currency), sort: (r) => r.totBase },
          { key: 'bank', label: t('f.bankAccountId', 'Bank'), render: (r) => UI.v(r.b.bankAccountId), sort: (r) => r.b.bankAccountId },
          { key: 'req', label: t('bt.required', 'Required approvals'), render: (r) => `<span class="small">${r.req.roles.map((x) => esc(t('role.' + x, x))).join(' + ')}</span>`, sort: (r) => r.req.roles.length },
          { key: 'tr', label: t('bt.treasury', 'Treasury approval'), render: (r) => (r.b.treasuryApprovedBy ? UI.badge('Approved') + ` <span class="small">${esc(r.b.treasuryApprovedBy)}</span>` : UI.badge('Pending')), sort: (r) => r.b.treasuryApprovedBy },
          { key: 'cfo', label: t('bt.cfo', 'CFO approval'), render: (r) => (r.b.cfoApprovedBy ? UI.badge('Approved') + ` <span class="small">${esc(r.b.cfoApprovedBy)}</span>` : r.needCfo ? UI.badge('Pending') : `<span class="muted">${esc(t('bt.notReq', 'Not required'))}</span>`), sort: (r) => r.b.cfoApprovedBy },
          { key: 'st', label: t('f.status', 'Status'), render: (r) => UI.badge(r.b.status), sort: (r) => r.b.status },
          { key: 'act', label: '', nosort: true, render: (r) => `<button class="btn sm" data-act="batchOpen" data-id="${esc(r.b.batchId)}">${esc(t('bt.review', 'Review'))} ›</button>` },
        ], rows, { drill: () => null, pageSize: 20, exportName: 'payment_batches' }));
      }
      const q = R.priority;
      if (tab === 'proposal') {
        const H = ['overdue', 'today', 'd3', 'd7', 'd30'];
        const crit = q.filter((x) => (R.P.sup.get(x.supplierId) || {}).critical && !x.blocks.length);
        const contr = q.filter((x) => x.contractual && !x.blocks.length);
        const cell = (rows) => `<b>${esc(S.fmt.num(rows.length))}</b><small>${esc(S.fmt.money(U.sum(rows, (x) => x.amountBase || 0), ccy(), { compact: true }))}</small>`;
        const cash = Object.values(R.cash.currencies).filter((c) => !c.noBank);
        return head + `<div class="funnel">${H.map((h) => `<div class="fn"><span>${esc(t('hz.' + h))}</span>${cell(q.filter((x) => x.horizon === h && !x.blocks.length))}</div>`).join('')}<div class="fn"><span>${esc(t('pay.critical', 'Critical suppliers'))}</span>${cell(crit)}</div><div class="fn"><span>${esc(t('pay.contractual', 'Contractually urgent'))}</span>${cell(contr)}</div></div>
          ${UI.section(t('pay.cashAvail', 'Cash availability by currency'), `<div class="chips">${cash.map((c) => `<span class="chip">${esc(c.currency)}: <b>${esc(S.fmt.money(c.opening, c.currency, { compact: true }))}</b> · ${esc(t('tr.minCash', 'Minimum cash'))} ${esc(S.fmt.money(c.minCash, c.currency, { compact: true }))}</span>`).join('')}</div>`)}
          ${V.queueTable(q.filter((x) => !x.blocks.length && ['overdue', 'today', 'd3', 'd7'].includes(x.horizon)), sel, t('pay.proposed', 'Proposed for next payment run (due ≤ 7 days, unblocked)'))}`;
      }
      return head + V.queueTable(q, sel, t('pay.queueAll', 'All open invoices ranked (blocked items last)'));
    },
  };
  V.queueTable = (rows, sel, title) => {
    const can = S.can('create.batch');
    const selTotal = U.sum(rows.filter((x) => sel.has(x.key)), (x) => x.amountBase || 0);
    return UI.section(title, `<div class="btn-row"><button class="btn primary" data-act="createBatch" ${can ? '' : 'disabled title="' + esc(t('perm.denied', 'Your role does not permit this action.')) + '"'}>＋ ${esc(t('pay.createBatch', 'Create payment batch from selection'))}</button><span class="muted">${esc(t('pay.selected', '{n} selected · {a}', { n: rows.filter((x) => sel.has(x.key)).length, a: S.fmt.money(selTotal, ccy(), { compact: true }) }))}</span><button class="btn ghost sm" data-act="selAll">${esc(t('pay.selAll', 'Select all unblocked'))}</button><button class="btn ghost sm" data-act="selNone">${esc(t('pay.selNone', 'Clear'))}</button></div>` +
      UI.table('queue', [
        { key: 'sel', label: '✓', nosort: true, render: (x) => (x.blocks.length ? '🔒' : `<input type="checkbox" data-act="sel" data-key="${esc(x.key)}" ${sel.has(x.key) ? 'checked' : ''} aria-label="select">`) },
        { key: 'score', label: t('pq.score', 'Priority'), num: true, render: (x) => (x.score == null ? UI.na() : `<span class="num"><b>${x.score}</b></span>`), sort: (x) => (x.blocks.length ? -1 : x.score) },
        { key: 'rec', label: t('pq.rec', 'Recommendation'), render: (x) => UI.badge(x.rec, 'rec.'), sort: (x) => x.rec },
        { key: 'inv', label: t('f.invoiceNo', 'Invoice'), render: (x) => `<b>${esc(x.inv.invoiceNo)}</b>`, sort: (x) => x.inv.invoiceNo },
        { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (x) => esc(UI.supName(x.supplierId) || '—'), sort: (x) => x.inv._supName },
        { key: 'due', label: t('f.dueDate', 'Due date'), render: (x) => `${UI.date(x.inv.dueDate)} <div class="small">${esc(t('hz.' + x.horizon))}</div>`, sort: (x) => x.inv.dueDate },
        { key: 'amt', label: t('f.outstanding', 'Amount'), num: true, render: (x) => `${UI.money(x.inv._out, x.inv.currency)}<div class="small muted">${x.amountBase != null ? esc(S.fmt.money(x.amountBase, ccy(), { compact: true })) : esc(t('fx.na', 'FX RATE NOT AVAILABLE'))}</div>`, sort: (x) => x.amountBase },
        { key: 'crit', label: t('pc.criticality', 'Supplier criticality'), num: true, render: (x) => UI.num(x.comp.criticality), sort: (x) => x.comp.criticality },
        { key: 'liq', label: t('pc.liquidity', 'Liquidity impact'), num: true, render: (x) => UI.num(x.comp.liquidity), sort: (x) => x.comp.liquidity },
        { key: 'con', label: t('pq.contract', 'Contractual risk'), render: (x) => (x.penaltyPct ? esc(t('pq.penalty', 'Penalty {p}%', { p: x.penaltyPct })) : '—'), sort: (x) => x.penaltyPct },
        { key: 'op', label: t('pc.operational', 'Operational risk'), num: true, render: (x) => UI.num(x.comp.operational), sort: (x) => x.comp.operational },
        { key: 'disc', label: t('pc.discount', 'Discount opportunity'), render: (x) => (x.discount ? `${esc(x.discount.pct)}% → ${UI.date(x.discount.lastDate)}<div class="small">${UI.money(x.discount.value, x.inv.currency)}</div>` : '—'), sort: (x) => (x.discount ? x.discount.valueBase : 0) },
        { key: 'pen', label: t('pc.penalty', 'Late-penalty risk'), num: true, render: (x) => UI.num(x.comp.penalty), sort: (x) => x.comp.penalty },
        { key: 'blk', label: t('pq.blocks', 'Blocks / warnings'), render: (x) => `<span class="small">${x.blocks.map((b) => '🔒 ' + esc(UI.reason('blk.', b))).concat(x.warns.map((w) => '⚠ ' + esc(UI.reason('blk.', w)))).join('<br>')}</span>`, sort: (x) => x.blocks.length },
      ], rows, { drill: (x) => x.key, pageSize: 25, exportName: 'payment_priority_queue', rowClass: (x) => (x.blocks.length ? 'blocked' : '') }) +
      `<p class="muted small">${esc(t('pq.method', 'Score = Σ(component × weight) ÷ Σ weights of available components. Weights (configurable): {w}.', { w: Object.entries(S.state.config.priority.weights).map(([k, v]) => t('pc.' + k) + ' ' + v).join(' · ') }))}</p>`);
  };

  /* ------------------------------ PAYMENT CALENDAR ------------------------------ */
  V.calendar = {
    title: () => t('nav.calendar', 'Payment Calendar'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.invoices.length) return UI.empty();
      const f = (S.vs.cal = S.vs.cal || { view: 'month', anchor: R.asOf.slice(0, 7) + '-01', ccy: '', sup: '', dept: '', bank: '', prio: '' });
      const items = [];
      R.priority.forEach((x) => items.push({ date: x.inv.dueDate, kind: 'due', inv: x.inv, sup: x.supplierId, amt: x.inv._out, ccy: x.inv.currency, base: x.amountBase, prio: x.score, rec: x.rec, appr: x.inv.approvalStatus, pay: V.invStatus(x.inv), dept: x.inv.department, bank: null, key: x.inv._key }));
      D.payments.filter((p) => ['Scheduled', 'Approved', 'Submitted to Bank', 'Pending'].includes(p.executionStatus)).forEach((p) => items.push({ date: p.paymentDate, kind: 'sched', inv: R.P.inv.get(p.invoiceNo) || {}, sup: p.supplierId, amt: p.net, ccy: p.currency, base: p._netBase, prio: null, rec: null, appr: p.approvalStatus, pay: p.executionStatus, dept: (R.P.inv.get(p.invoiceNo) || {}).department, bank: p.bankAccountId, key: p._key }));
      const flt = items.filter((x) => x.date && (!f.ccy || x.ccy === f.ccy) && (!f.sup || x.sup === f.sup) && (!f.dept || x.dept === f.dept) && (!f.bank || x.bank === f.bank) && (!f.prio || (f.prio === 'high' ? x.prio >= 70 : f.prio === 'blocked' ? x.rec === 'HOLD' : true)));
      const opt = (arr, cur, lab) => arr.map((v) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(lab ? lab(v) : v)}</option>`).join('');
      const filters = `<div class="filters">
        <label>${esc(t('cal.view', 'View'))}<select data-act="calF" data-k="view">${opt(['day', 'week', 'month', 'quarter'], f.view, (v) => t('cal.' + v, v))}</select></label>
        <button class="btn sm" data-act="calNav" data-d="-1">‹</button><b>${esc(f.view === 'month' ? f.anchor.slice(0, 7) : S.fmt.date(f.anchor))}</b><button class="btn sm" data-act="calNav" data-d="1">›</button><button class="btn sm ghost" data-act="calNav" data-d="0">${esc(t('cal.today', 'Today'))}</button>
        <label>${esc(t('f.currency', 'Currency'))}<select data-act="calF" data-k="ccy"><option value="">${esc(t('common.all', 'All'))}</option>${opt(U.uniq(items.map((x) => x.ccy)).filter(Boolean).sort(), f.ccy)}</select></label>
        <label>${esc(t('f.supplierId', 'Supplier'))}<select data-act="calF" data-k="sup"><option value="">${esc(t('common.all', 'All'))}</option>${opt(U.uniq(items.map((x) => x.sup)).filter(Boolean).sort(), f.sup, (v) => UI.supName(v))}</select></label>
        <label>${esc(t('f.department', 'Department'))}<select data-act="calF" data-k="dept"><option value="">${esc(t('common.all', 'All'))}</option>${opt(U.uniq(items.map((x) => x.dept)).filter(Boolean).sort(), f.dept)}</select></label>
        <label>${esc(t('f.bankAccountId', 'Bank'))}<select data-act="calF" data-k="bank"><option value="">${esc(t('common.all', 'All'))}</option>${opt(D.bankAccounts.map((b) => b.accountId), f.bank)}</select></label>
        <label>${esc(t('pq.score', 'Priority'))}<select data-act="calF" data-k="prio"><option value="">${esc(t('common.all', 'All'))}</option><option value="high" ${f.prio === 'high' ? 'selected' : ''}>≥ 70</option><option value="blocked" ${f.prio === 'blocked' ? 'selected' : ''}>${esc(t('rec.HOLD'))}</option></select></label></div>`;
      const chip = (x) => `<div class="cal-it ${x.kind} ${x.rec === 'HOLD' ? 'hold' : ''}" data-drill="${esc(x.key)}" data-tip="${esc(`${UI.supName(x.sup)} · ${x.inv.invoiceNo || ''} · ${S.fmt.money(x.amt, x.ccy)} · ${t('pq.score', 'Priority')} ${x.prio == null ? '—' : x.prio} · ${x.appr || ''} · ${x.pay || ''}`)}">${esc(String(UI.supName(x.sup) || '').slice(0, 16))} <b>${esc(C.short(x.amt))}</b></div>`;
      let body;
      if (f.view === 'month') {
        const first = f.anchor;
        const start = U.startOfWeek(first);
        const end = U.endOfMonth(first);
        const days = [];
        for (let d = start; d <= end || U.dow(d) !== U.dow(start); d = U.addDays(d, 1)) days.push(d);
        const dn = Array.from({ length: 7 }, (_, i) => S.fmt.date(U.addDays(start, i)) && new Intl.DateTimeFormat(S.isAr() ? 'ar-EG' : 'en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(U.toUTC(U.addDays(start, i)))));
        body = `<div class="cal"><div class="cal-h">${dn.map((d) => `<span>${esc(d)}</span>`).join('')}</div><div class="cal-g">${days.map((d) => { const its = flt.filter((x) => x.date === d); const tot = U.sum(its, (x) => x.base || 0); return `<div class="cal-d ${d.slice(0, 7) !== first.slice(0, 7) ? 'out' : ''} ${d === R.asOf ? 'today' : ''} ${S.state.config.weekendDays.includes(U.dow(d)) ? 'we' : ''}"><div class="cal-n">${+d.slice(8)}${tot ? `<span>${esc(C.short(tot))}</span>` : ''}</div>${its.slice(0, 4).map(chip).join('')}${its.length > 4 ? `<div class="muted small">+${its.length - 4}</div>` : ''}</div>`; }).join('')}</div></div>`;
      } else {
        const len = f.view === 'day' ? 1 : f.view === 'week' ? 7 : 91;
        const from = f.anchor, to = U.addDays(from, len - 1);
        const its = flt.filter((x) => x.date >= from && x.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
        body = UI.table('calList', [
          { key: 'date', label: t('f.dueDate', 'Date'), render: (x) => UI.date(x.date) }, { key: 'kind', label: t('cal.kind', 'Type'), render: (x) => esc(x.kind === 'due' ? t('cal.due', 'Invoice due') : t('ftype.scheduled')) },
          { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (x) => esc(UI.supName(x.sup) || '—') }, { key: 'inv', label: t('f.invoiceNo', 'Invoice'), render: (x) => UI.v(x.inv.invoiceNo) },
          { key: 'amt', label: t('f.amount', 'Amount'), num: true, render: (x) => UI.money(x.amt, x.ccy) }, { key: 'prio', label: t('pq.score', 'Priority'), num: true, render: (x) => UI.num(x.prio) },
          { key: 'appr', label: t('f.approvalStatus', 'Approval'), render: (x) => UI.badge(x.appr) }, { key: 'pay', label: t('f.status', 'Payment status'), render: (x) => UI.badge(x.pay) },
        ], its, { drill: (x) => x.key, pageSize: 30 });
      }
      return `<div class="page-h"><div><h1>${esc(t('nav.calendar', 'Payment Calendar'))}</h1><p class="muted">${esc(t('cal.sub', 'Invoice due dates and scheduled payments. Weekend days are shaded (configurable).'))} ${UI.demoTag()}</p></div></div>${filters}${UI.section('', body)}`;
    },
  };

  /* ------------------------------ AP AGING & DPO ------------------------------ */
  V.aging = {
    title: () => t('nav.aging', 'AP Aging'),
    render() {
      const R = S.R, A = R.aging, dpo = R.dpo;
      if (!S.state.data.invoices.length) return UI.empty();
      const B = S.engine.BUCKETS.map((b) => b.id);
      return `<div class="page-h"><div><h1>${esc(t('nav.aging', 'AP Aging'))}</h1><p class="muted">${esc(t('ag.sub', 'Outstanding by days past due at {d}. Foreign-currency balances revalued at the latest FX rate on/before the as-of date.', { d: S.fmt.date(R.asOf) }))} ${UI.demoTag()}</p></div><div class="btn-row"><button class="btn" data-act="report" data-id="aging">⤓ ${esc(t('rep.export', 'Export'))}</button></div></div>
        <div class="kpis">${UI.kpi('totalAP')}${UI.kpi('overdueAP')}${UI.kpi('currentAP')}${UI.kpi('avgPayDays')}${UI.kpi('apConcentration')}${UI.kpi('dpo')}</div>
        ${A.noFx.length ? `<p class="warnbar">⚠ ${esc(t('ag.noFx', '{n} open invoice(s) excluded from base-currency totals: FX RATE NOT AVAILABLE ({l}).', { n: A.noFx.length, l: A.noFx.map((i) => i.invoiceNo + ' ' + i.currency).join(', ') }))}</p>` : ''}
        <div class="grid g2">
          ${UI.section(t('ag.buckets', 'Aging buckets'), C.bars(A.buckets.map((b) => ({ label: t('bk.' + b.id), value: b.amount, tone: b.id === 'current' ? 'good' : b.id === 'b1_30' ? 'warning' : b.id === 'noDue' ? null : 'critical' }))) + `<table><thead><tr><th>${esc(t('ag.bucket', 'Bucket'))}</th><th class="n">${esc(t('ag.count', 'Invoices'))}</th><th class="n">${esc(t('f.amount', 'Amount'))} (${esc(ccy())})</th><th class="n">%</th></tr></thead><tbody>${A.buckets.map((b) => `<tr><td>${esc(t('bk.' + b.id))}</td><td class="n">${UI.num(b.count)}</td><td class="n">${UI.num(b.amount, 0)}</td><td class="n">${UI.pct(A.total ? (b.amount / A.total) * 100 : null)}</td></tr>`).join('')}<tr class="tot"><td>Σ</td><td class="n">${UI.num(U.sum(A.buckets, (b) => b.count))}</td><td class="n">${UI.num(A.total, 0)}</td><td class="n">100%</td></tr></tbody></table>`)}
          ${UI.section(t('ag.dpo', 'DPO analysis'), `<table class="kv"><tr><th>${esc(t('dpo.current', 'Current DPO'))}</th><td>${dpo.value == null ? `<span class="na">${esc(dpo.lineage.unavailable)}</span>` : esc(S.fmt.days(dpo.value))}</td></tr><tr><th>${esc(t('dpo.target', 'Target DPO'))}</th><td>${dpo.target == null ? UI.na(t('dpo.noTarget', 'Not configured')) : esc(S.fmt.days(dpo.target))}</td></tr><tr><th>${esc(t('dpo.variance', 'Variance'))}</th><td>${dpo.variance == null ? '—' : esc(S.fmt.days(dpo.variance))}</td></tr></table><button class="btn sm" data-lineage="dpo">${esc(t('kpi.lineage', 'Lineage'))} ›</button>
            <h4>${esc(t('dpo.hist', 'Historical DPO (monthly)'))}</h4>${dpo.hist.length ? C.line(dpo.hist.map((h) => h.period), [{ name: 'DPO', values: dpo.hist.map((h) => h.dpo) }], dpo.target != null ? { threshold: { value: dpo.target, label: t('dpo.target', 'Target DPO') }, zero: false } : { zero: false }) : UI.na()}`)}
        </div>
        ${UI.section(t('ag.bySup', 'Aging by supplier ({c})', { c: ccy() }), UI.table('agingSup', [
          { key: 'n', label: t('f.name', 'Supplier'), render: (r) => `<b>${esc(UI.supName(r.supplierId) || r.name || '—')}</b>`, sort: (r) => r.name },
          ...B.map((b) => ({ key: b, label: t('bk.' + b), num: true, render: (r) => (r[b] ? UI.num(r[b], 0) : '<span class="muted">·</span>'), sort: (r) => r[b] })),
          { key: 'total', label: t('ag.total', 'Total'), num: true, render: (r) => `<b>${UI.num(r.total, 0)}</b>` },
          { key: 'overdue', label: t('ag.overdue', 'Overdue'), num: true, render: (r) => UI.num(r.overdue, 0) },
          { key: 'share', label: '%', num: true, render: (r) => UI.pct(A.total ? (r.total / A.total) * 100 : null), sort: (r) => r.total },
        ], A.bySup, { drill: (r) => (S.R.P.sup.get(r.supplierId) || {})._key, pageSize: 20, exportName: 'ap_aging_by_supplier' }))}
        ${UI.section(t('ag.open', 'Open invoices'), UI.table('agingInv', V.invoiceCols().concat([{ key: 'dpd', label: t('inv.dpd', 'Days past due'), num: true, render: (i) => UI.num(i._dpd), sort: (i) => i._dpd }, { key: 'outBase', label: t('inv.outBase', 'Outstanding ({ccy})', { ccy: ccy() }), num: true, render: (i) => UI.num(i._outBase, 0), sort: (i) => i._outBase }]), A.open, { pageSize: 15, exportName: 'ap_open_items' }))}`;
    },
  };

  /* ------------------------------ TREASURY ------------------------------ */
  V.treasury = {
    title: () => t('nav.treasury', 'Treasury'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.bankAccounts.length && !D.invoices.length) return UI.empty();
      const st = (S.vs.tr = S.vs.tr || { horizon: 'weekly', dim: 'supplier', ph: 'd30', sc: { delayDays: 0, termsDays: 0, spendPct: 0, fxCcy: 'USD', fxPct: 0, collectionsPct: 0, immediateSupplier: '' } });
      const cash = R.cash, cons = cash.consolidated;
      const cashPos = U.sum(D.bankAccounts, (b) => b._availBase || 0);
      let fc = cash;
      if (st.horizon === 'monthly') fc = S.engine.cashForecast(D, R.P, S.state.config, R.asOf, R.items, { days: 365 });
      const series = fc.consolidated.series;
      let xs, ys;
      if (st.horizon === 'daily') { xs = series.map((x) => x.date.slice(5)); ys = series.map((x) => x.closing); }
      else if (st.horizon === 'weekly') { xs = cash.weekly.map((w) => 'W' + w.week); ys = cash.weekly.map((w) => w.closing); }
      else { const m = U.groupBy(series, (x) => x.date.slice(0, 7)); xs = Array.from(m.keys()); ys = Array.from(m.values()).map((a) => a[a.length - 1].closing); }
      const large = R.items.filter((x) => x.type !== 'poCommitment' && x.amountBase >= S.state.config.alerts.largePayment && x.date && U.daysBetween(R.asOf, x.date) <= 30).sort((a, b) => (a.date < b.date ? -1 : 1));
      const apByCcy = Array.from(U.groupBy(R.aging.open, 'currency').entries()).map(([c, rs]) => ({ c, amt: U.sum(rs, (i) => i._out), base: U.sum(rs, (i) => i._outBase || 0) }));
      const byBank = Array.from(U.groupBy(D.bankAccounts, 'bank').entries()).map(([b, as]) => ({ label: b, value: U.sum(as, (a) => a._availBase || 0) }));
      const pf = R.payForecast;
      const h = pf.horizons.find((x) => x.id === st.ph) || pf.horizons[1];
      const dimKey = { supplier: 'supplierId', category: 'category', department: 'department', project: 'project', currency: 'currency', bank: 'bankAccountId', type: 'type' }[st.dim];
      const grp = Array.from(U.groupBy(h.rows.filter((r) => r.amountBase != null), (r) => r[dimKey] || '—').entries()).map(([k, rs]) => ({ label: st.dim === 'supplier' ? UI.supName(k) || k : st.dim === 'type' ? t('ftype.' + k) : k, value: U.sum(rs, (r) => r.amountBase) })).sort((a, b) => b.value - a.value).slice(0, 12);
      const scen = S.vs.scenResult;
      const sc = st.sc;
      return `<div class="page-h"><div><h1>${esc(t('nav.treasury', 'Treasury'))}</h1><p class="muted">${esc(t('tr.sub', 'Opening cash + expected collections − approved payments − scheduled payments − other outflows = projected cash.'))} ${UI.demoTag()}</p></div></div>
        <div class="kpis">
          <div class="kpi static"><span class="kpi-label">${esc(t('tr.cashPos', 'Cash position (available, {c})', { c: ccy() }))}</span><span class="kpi-value">${UI.base(cashPos, { compact: true })}</span><span class="kpi-sub">${UI.kind('SOURCE VALUE')}</span></div>
          ${UI.kpi('paymentsScheduled')}${UI.kpi('cashRequired')}${UI.kpi('paymentForecast30')}
          <div class="kpi static ${cons.fundingReq > 0 ? 'k-critical' : ''}"><span class="kpi-label">${esc(t('tr.funding', 'Funding requirement (13w)'))}</span><span class="kpi-value">${UI.base(cons.fundingReq, { compact: true })}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('tr.idle', 'Idle cash above minimum (13w)'))}</span><span class="kpi-value">${UI.base(cons.idle, { compact: true })}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('tr.lowest', 'Lowest projected (consolidated)'))}</span><span class="kpi-value">${cons.min ? UI.base(cons.min.closing, { compact: true }) : UI.na()}</span><span class="kpi-sub">${cons.min ? UI.date(cons.min.date) : ''}</span></div>
        </div>
        ${UI.section(t('tr.forecast', 'Cash forecast ({c}, consolidated)', { c: ccy() }), `${UI.tabs('trH', [['daily', t('tr.daily', 'Daily (90 days)')], ['weekly', t('tr.weekly', '13-week')], ['monthly', t('tr.monthly', 'Monthly (12 months)')]], st.horizon)}${C.line(xs, [{ name: t('tr.projected', 'Projected cash'), values: ys }], { threshold: { value: fc.consolidated.minCash, label: t('tr.minCash', 'Minimum cash') }, area: true })}
          ${cons.excluded.length ? `<p class="warnbar">⚠ ${esc(t('tr.excluded', 'Excluded (no bank balance or FX rate): {c}', { c: cons.excluded.join(', ') }))}</p>` : ''}
          <details><summary>${esc(t('tr.assumptions', 'Assumptions'))}</summary><ul>${cash.assumptions.map((a) => `<li>${UI.kind('ASSUMPTION')} ${esc(a)}</li>`).join('')}</ul></details>`)}
        ${UI.section(t('tr.13w', '13-week cash forecast ({c})', { c: ccy() }), `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('tr.week', 'Week'))}</th><th>${esc(t('tr.period', 'Period'))}</th><th class="n">${esc(t('tr.inflow', 'Collections'))}</th><th class="n">${esc(t('tr.outflow', 'Outflows'))}</th><th class="n">${esc(t('tr.closing', 'Closing cash'))}</th><th>${esc(t('tr.gap', 'Liquidity gap'))}</th></tr></thead><tbody>${cash.weekly.map((w) => `<tr><td>W${w.week}</td><td>${UI.date(w.from)} – ${UI.date(w.to)}</td><td class="n">${UI.num(w.inflow, 0)}</td><td class="n">${UI.num(w.outflow, 0)}</td><td class="n">${UI.num(w.closing, 0)}</td><td>${w.closing < cons.minCash ? UI.badge(t('tr.belowMin', 'Below minimum')) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>`)}
        <div class="grid g2">
          ${UI.section(t('tr.byCcy', 'By currency (local currency)'), `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('f.currency', 'Ccy'))}</th><th class="n">${esc(t('tr.opening', 'Opening'))}</th><th class="n">${esc(t('tr.inflow', 'Collections'))}</th><th class="n">${esc(t('tr.sched', 'Scheduled'))}</th><th class="n">${esc(t('tr.approved', 'Approved inv.'))}</th><th class="n">${esc(t('tr.other', 'Other'))}</th><th class="n">${esc(t('tr.lowestShort', 'Lowest'))}</th><th class="n">${esc(t('tr.minCash', 'Minimum cash'))}</th><th>${esc(t('common.status', 'Status'))}</th></tr></thead><tbody>${Object.values(cash.currencies).map((c) => `<tr><td><b>${esc(c.currency)}</b></td><td class="n">${c.opening == null ? UI.na('—') : UI.num(c.opening, 0)}</td><td class="n">${UI.num(c.totals.inflow, 0)}</td><td class="n">${UI.num(c.totals.scheduled, 0)}</td><td class="n">${UI.num(c.totals.approved, 0)}</td><td class="n">${UI.num(c.totals.other, 0)}</td><td class="n">${c.min ? UI.num(c.min.closing, 0) : '—'}</td><td class="n">${c.minCash == null ? '—' : UI.num(c.minCash, 0)}</td><td>${c.noBank ? UI.badge(t('tr.noBank', 'No bank data')) : c.shortfallDays ? UI.badge(t('tr.shortfall', 'Shortfall')) : c.belowMinDays ? UI.badge(t('tr.belowMin', 'Below minimum')) : UI.badge('OK')}</td></tr>`).join('')}</tbody></table></div>`)}
          ${UI.section(t('tr.exposure', 'Currency exposure — open AP'), C.bars(apByCcy.map((x) => ({ label: x.c, value: x.base, tip: `${x.c} ${S.fmt.num(x.amt, 0)} ≈ ${S.fmt.money(x.base, ccy())}` })), { horizontal: true, labelW: 60 }) + (R.aging.noFx.length ? `<p class="small muted">⚠ ${esc(t('fx.na', 'FX RATE NOT AVAILABLE'))}: ${esc(R.aging.noFx.map((i) => i.currency).join(', '))}</p>` : ''))}
          ${UI.section(t('tr.bankExp', 'Bank exposure (available cash, {c})', { c: ccy() }), C.donut(byBank, { centerLabel: ccy() }))}
          ${UI.section(t('tr.large', 'Large upcoming payments (≤ 30 days, ≥ {a})', { a: S.fmt.money(S.state.config.alerts.largePayment, ccy(), { compact: true }) }), large.length ? `<table><tbody>${large.map((x) => `<tr data-drill="${esc(x.rec._key)}"><td>${UI.date(x.date)}</td><td>${esc(UI.supName(x.supplierId) || '—')}</td><td class="n">${UI.money(x.amount, x.currency)}</td><td>${esc(t('ftype.' + x.type))}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(t('tr.noLarge', 'None.'))}</p>`)}
        </div>
        ${UI.section(t('pf.title', 'Payment forecast'), `<div class="filters"><label>${esc(t('pf.horizon', 'Horizon'))}<select data-act="trF" data-k="ph">${pf.horizons.map((x) => `<option value="${x.id}" ${st.ph === x.id ? 'selected' : ''}>${esc(t('pf.' + x.id, x.id))}</option>`).join('')}</select></label><label>${esc(t('pf.by', 'Break down by'))}<select data-act="trF" data-k="dim">${['supplier', 'category', 'department', 'project', 'currency', 'bank', 'type'].map((d) => `<option value="${d}" ${st.dim === d ? 'selected' : ''}>${esc(t('pf.d.' + d, d))}</option>`).join('')}</select></label>
          <span class="muted">Σ ${esc(S.fmt.money(h.total, ccy()))}${h.noFx ? ' · ⚠ ' + esc(t('pf.noFx', '{n} item(s) without FX', { n: h.noFx })) : ''}</span></div>
          <div class="grid g2">${C.bars(grp, { horizontal: true })}<div><table class="kv">${Object.entries(h.byType).map(([k, v]) => `<tr><th>${esc(t('ftype.' + k))}</th><td>${UI.base(v)}</td></tr>`).join('')}</table><p class="small muted">${esc(t('pf.note', 'Pending-approval invoices and PO commitments are potential outflows (timing ASSUMPTION: required date + supplier terms).'))}</p></div></div>`)}
        ${UI.section(t('sc.title', 'Scenario analysis'), `<p class="scen-flag">⚠ ${esc(t('sc.flag', 'SCENARIO — NOT ACTUAL'))}</p>
          <div class="filters sc">
            <label>${esc(t('sc.delay', 'Delay approved/scheduled payments (days)'))}<input type="number" data-sc="delayDays" value="${esc(sc.delayDays)}"></label>
            <label>${esc(t('sc.terms', 'Extend supplier payment terms (days)'))}<input type="number" data-sc="termsDays" value="${esc(sc.termsDays)}"></label>
            <label>${esc(t('sc.spend', 'Supplier spend change (%)'))}<input type="number" data-sc="spendPct" value="${esc(sc.spendPct)}"></label>
            <label>${esc(t('sc.fx', 'FX shock'))}<select data-sc="fxCcy">${S.state.config.currencies.filter((c) => c !== ccy()).map((c) => `<option ${sc.fxCcy === c ? 'selected' : ''}>${c}</option>`).join('')}</select><input type="number" data-sc="fxPct" value="${esc(sc.fxPct)}" aria-label="%"></label>
            <label>${esc(t('sc.coll', 'Collections shortfall (%)'))}<input type="number" data-sc="collectionsPct" value="${esc(sc.collectionsPct)}"></label>
            <label>${esc(t('sc.imm', 'Major supplier demands immediate payment'))}<select data-sc="immediateSupplier"><option value="">—</option>${S.R.aging.bySup.slice(0, 15).map((s) => `<option value="${esc(s.supplierId)}" ${sc.immediateSupplier === s.supplierId ? 'selected' : ''}>${esc(UI.supName(s.supplierId))}</option>`).join('')}</select></label>
            <button class="btn primary" data-act="runScenario" ${S.can('scenario') || S.can('view.all') ? '' : 'disabled'}>▶ ${esc(t('sc.run', 'Run scenario'))}</button></div>
          ${scen ? V.scenarioResult(scen) : ''}`)}`;
    },
  };
  V.scenarioResult = (r) => {
    const i = r.impact;
    const b = r.base.consolidated, s = r.scen.consolidated;
    const xs = r.base.weekly.map((w) => 'W' + w.week);
    return `<div class="scen"><p class="scen-flag">${esc(t('sc.flag', 'SCENARIO — NOT ACTUAL'))}</p>
      <div class="kpis small">
        <div class="kpi static"><span class="kpi-label">${esc(t('sc.cashImpact', 'Cash impact (13-week end)'))}</span><span class="kpi-value">${UI.base(i.endCashDelta, { compact: true })}</span></div>
        <div class="kpi static"><span class="kpi-label">${esc(t('sc.liqImpact', 'Liquidity impact (lowest point)'))}</span><span class="kpi-value">${UI.base(i.minCashDelta, { compact: true })}</span><span class="kpi-sub">${s.min ? UI.date(s.min.date) : ''}</span></div>
        <div class="kpi static"><span class="kpi-label">${esc(t('sc.funding', 'Funding requirement'))}</span><span class="kpi-value">${UI.base(i.fundingReq, { compact: true })}</span><span class="kpi-sub">${esc(t('sc.base', 'base'))}: ${esc(S.fmt.money(i.baseFundingReq, ccy(), { compact: true }))}</span></div>
        <div class="kpi static"><span class="kpi-label">${esc(t('sc.supImpact', 'Supplier impact'))}</span><span class="kpi-value">${esc(S.fmt.num(i.suppliersAffected))}</span><span class="kpi-sub">${esc(t('sc.late', '{n} payment(s) pushed past due date', { n: i.newlyLateCount }))}</span></div>
        <div class="kpi static"><span class="kpi-label">${esc(t('sc.penalty', 'Late-penalty exposure (contract %)'))}</span><span class="kpi-value">${UI.base(i.penaltyExposure, { compact: true })}</span></div>
        <div class="kpi static"><span class="kpi-label">${esc(t('sc.wc', 'Working-capital impact (≈ DPO days)'))}</span><span class="kpi-value">${esc(S.fmt.num(i.wcDpoDeltaDays))}</span></div>
      </div>
      ${C.line(xs, [{ name: t('sc.baseLine', 'Base (actual data)'), values: r.base.weekly.map((w) => w.closing), slot: 0 }, { name: t('sc.scenLine', 'Scenario — not actual'), values: r.scen.weekly.map((w) => w.closing), slot: 1, dashed: true }], { threshold: { value: b.minCash, label: t('tr.minCash', 'Minimum cash') } })}</div>`;
  };

  /* ------------------------------ BANKS ------------------------------ */
  V.banks = {
    title: () => t('nav.banks', 'Banks'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.bankAccounts.length && !D.bankTxns.length) return UI.empty(t('bank.none', 'No bank accounts or statements loaded.'));
      const pend = (acc) => D.payments.filter((p) => p.bankAccountId === acc && ['Scheduled', 'Approved', 'Submitted to Bank', 'Pending'].includes(p.executionStatus));
      const rows = D.bankAccounts.map((b) => ({ b, reserved: U.sum(pend(b.accountId).filter((p) => p.executionStatus !== 'Pending'), (p) => p.net), pending: U.sum(pend(b.accountId), (p) => p.net), coll: U.sum(D.collections.filter((c) => c.currency === b.currency && c.date >= R.asOf && c.date <= U.addDays(R.asOf, 30)), (c) => c.amount), _key: b._key }));
      const f = S.vs.brType || 'exceptions';
      const items = R.bank.items.filter((x) => (f === 'all' ? true : f === 'exceptions' ? x.status !== 'MATCHED' || x.type !== 'matched' : x.type === f));
      return `<div class="page-h"><div><h1>${esc(t('nav.banks', 'Banks'))}</h1><p class="muted">${esc(t('bank.sub', 'Multi-bank, multi-currency accounts and payment-register vs bank-statement reconciliation.'))} ${UI.demoTag()}</p></div></div>
        ${UI.section(t('bank.accounts', 'Company bank accounts'), UI.table('accounts', [
          { key: 'bank', label: t('f.bank', 'Bank'), render: (r) => `<b>${esc(r.b.bank)}</b>`, sort: (r) => r.b.bank },
          { key: 'acc', label: t('f.accountId', 'Account'), render: (r) => `${esc(r.b.accountId)}<div class="mono small">${esc(U.maskAccount(r.b.iban || r.b.accountNo))}</div>`, sort: (r) => r.b.accountId },
          { key: 'ccy', label: t('f.currency', 'Ccy'), render: (r) => esc(r.b.currency), sort: (r) => r.b.currency },
          { key: 'open', label: t('f.openingBalance', 'Opening'), num: true, render: (r) => UI.num(r.b.openingBalance, 0), sort: (r) => r.b.openingBalance },
          { key: 'cur', label: t('f.currentBalance', 'Current'), num: true, render: (r) => UI.num(r.b.currentBalance, 0), sort: (r) => r.b.currentBalance },
          { key: 'avail', label: t('f.availableBalance', 'Available'), num: true, render: (r) => UI.num(r.b.availableBalance, 0), sort: (r) => r.b.availableBalance },
          { key: 'res', label: t('bank.reserved', 'Reserved (scheduled)'), num: true, render: (r) => UI.num(r.reserved, 0), sort: (r) => r.reserved },
          { key: 'pend', label: t('bank.pending', 'Pending payments'), num: true, render: (r) => UI.num(r.pending, 0), sort: (r) => r.pending },
          { key: 'coll', label: t('bank.coll', 'Expected collections 30d (currency)'), num: true, render: (r) => UI.num(r.coll, 0), sort: (r) => r.coll },
          { key: 'min', label: t('f.minCash', 'Minimum cash'), num: true, render: (r) => UI.num(r.b.minCash, 0), sort: (r) => r.b.minCash },
          { key: 'asof', label: t('f.asOfDate', 'As of'), render: (r) => UI.date(r.b.asOfDate), sort: (r) => r.b.asOfDate },
        ], rows, { pageSize: 15, exportName: 'bank_accounts' }))}
        ${UI.section(t('bank.recon', 'Bank reconciliation — payment register vs bank statement'), `<div class="kpis small">${['matched', 'missingInBank', 'uncleared', 'wrongAmount', 'wrongReference', 'timingDifference', 'reversed', 'duplicateBankDebit', 'bankWithoutPayment'].map((k) => `<button class="kpi static" data-tab="brType:${k}"><span class="kpi-label">${esc(t('br.' + k))}</span><span class="kpi-value">${esc(S.fmt.num(R.bank.items.filter((x) => x.type === k).length))}</span></button>`).join('')}</div>
          <p class="muted small">${esc(t('bank.rate', 'Match rate {r} of {n} executed payments. Matching: exact bank reference first, then amount ± tolerance and date ± 5 days on the same account.', { r: S.fmt.pct(R.bank.rate), n: R.bank.population }))}</p>
          ${UI.tabs('brType', [['exceptions', t('bank.exceptions', 'Exceptions')], ['all', t('common.all', 'All')]], f === 'all' ? 'all' : 'exceptions')}
          ${UI.table('bankRecon', [
            { key: 'type', label: t('bank.type', 'Result'), render: (x) => esc(t('br.' + x.type)), sort: (x) => x.type },
            { key: 'st', label: t('common.status', 'Status'), render: (x) => UI.badge(x.status, 'rc.'), sort: (x) => x.status },
            { key: 'pay', label: t('f.paymentId', 'Payment'), render: (x) => (x.p ? `<a data-drill="${esc(x.p._key)}">${esc(x.p.paymentId)}</a>` : UI.na('—')), sort: (x) => (x.p ? x.p.paymentId : '') },
            { key: 'pd', label: t('f.paymentDate', 'Payment date'), render: (x) => (x.p ? UI.date(x.p.paymentDate) : '—'), sort: (x) => (x.p ? x.p.paymentDate : '') },
            { key: 'pa', label: t('f.net', 'Register amount'), num: true, render: (x) => (x.p ? UI.money(x.p.net, x.p.currency) : '—'), sort: (x) => (x.p ? x.p.net : 0) },
            { key: 'tx', label: t('bank.txn', 'Bank transaction'), render: (x) => (x.t ? `<a data-drill="${esc(x.t._key)}">${esc(x.t.txnId)}</a>` : UI.na('—')), sort: (x) => (x.t ? x.t.txnId : '') },
            { key: 'td', label: t('bank.valueDate', 'Value date'), render: (x) => (x.t ? UI.date(x.t.date) : '—'), sort: (x) => (x.t ? x.t.date : '') },
            { key: 'ta', label: t('bank.amount', 'Bank amount'), num: true, render: (x) => (x.t ? UI.num(-x.t.amount, 2) : '—'), sort: (x) => (x.t ? -x.t.amount : 0) },
            { key: 'diff', label: t('rc.diff', 'Difference'), num: true, render: (x) => UI.num(x.diff, 2), sort: (x) => x.diff },
            { key: 'ref', label: t('f.reference', 'Reference'), render: (x) => `<span class="small">${esc((x.p && x.p.reference) || '—')} / ${esc((x.t && x.t.reference) || '—')}</span>` },
          ], items, { drill: (x) => (x.p || x.t)._key, pageSize: 20, exportName: 'bank_reconciliation' })}`)}`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
