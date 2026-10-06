/* SUMED P2P — procure-to-pay views: procurement, purchase orders, contracts, invoices, three-way matching, duplicates, disputes. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui, C = S.chart;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const V = (S.views = S.views || {});
  S.vs = S.vs || {};
  const ccy = () => S.state.config.baseCurrency;

  /* ------------------------------ Shared column sets ------------------------------ */
  V.invoiceCols = () => [
    { key: 'invoiceNo', label: t('f.invoiceNo', 'Invoice no.'), render: (i) => `<b>${UI.v(i.invoiceNo)}</b>${i._demo ? '' : ''}` },
    { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (i) => esc(UI.supName(i.supplierId) || i.supplierName || '—'), sort: (i) => i._supName },
    { key: 'invoiceDate', label: t('f.invoiceDate', 'Invoice date'), render: (i) => UI.date(i.invoiceDate) },
    { key: 'dueDate', label: t('f.dueDate', 'Due date'), render: (i) => UI.date(i.dueDate) },
    { key: 'poNo', label: t('f.poNo', 'PO'), render: (i) => UI.v(i.poNo) },
    { key: 'currency', label: t('f.currency', 'Ccy') },
    { key: 'total', label: t('f.total', 'Total'), num: true, render: (i) => UI.num(i.total, 2) },
    { key: 'paid', label: t('f.paidAmount', 'Paid'), num: true, render: (i) => UI.num(i._paid, 2), sort: (i) => i._paid },
    { key: 'out', label: t('f.outstanding', 'Outstanding'), num: true, render: (i) => UI.num(i._out, 2), sort: (i) => i._out },
    { key: 'appr', label: t('f.approvalStatus', 'Approval'), render: (i) => UI.badge(i.approvalStatus), sort: (i) => i.approvalStatus },
    { key: 'match', label: t('m.short', 'Match'), render: (i) => { const m = S.R.match.get(i._key); return m ? UI.badge(m.status, 'm.') : '—'; }, sort: (i) => (S.R.match.get(i._key) || {}).status },
    { key: 'status', label: t('f.status', 'Status'), render: (i) => UI.badge(V.invStatus(i)), sort: (i) => V.invStatus(i) },
  ];
  /** Lifecycle status: source status, refined by payments & approvals (Received → … → Paid) */
  V.invStatus = (i) => {
    if (i._closed) return i.status;
    if (i.total > 0 && i._paid >= i.total - 0.005) return 'Paid';
    const sched = S.state.data.payments.some((p) => p.invoiceNo === i.invoiceNo && ['Scheduled', 'Approved', 'Submitted to Bank', 'Pending'].includes(p.executionStatus));
    if (sched) return 'Scheduled';
    const m = S.R.match.get(i._key);
    if (m && ['DUPLICATE', 'EXCEPTION', 'QUANTITY VARIANCE', 'PRICE VARIANCE', 'MISSING GRN'].includes(m.status)) return 'Exception';
    if (/approved/i.test(i.approvalStatus || '')) return 'Approved';
    if (/reject/i.test(i.approvalStatus || '')) return 'Rejected';
    return i.status && !/approved|paid/i.test(i.status) ? (i.status === 'Received' ? 'Pending Approval' : i.status) : 'Pending Approval';
  };
  V.poCols = () => [
    { key: 'poNo', label: t('f.poNo', 'PO number'), render: (p) => `<b>${esc(p.poNo)}</b>` },
    { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (p) => esc(UI.supName(p.supplierId) || '—'), sort: (p) => UI.supName(p.supplierId) },
    { key: 'department', label: t('f.department', 'Department') },
    { key: 'poDate', label: t('f.poDate', 'PO date'), render: (p) => UI.date(p.poDate) },
    { key: 'currency', label: t('f.currency', 'Ccy') },
    { key: 'total', label: t('f.total', 'Total'), num: true, render: (p) => UI.num(p._total, 2), sort: (p) => p._total },
    { key: 'status', label: t('f.status', 'Status'), render: (p) => UI.badge(p.status) },
  ];
  V.contractCols = () => [
    { key: 'id', label: t('f.contractId', 'Contract'), render: (c) => `<b>${esc(c.c.contractId)}</b>`, sort: (c) => c.c.contractId },
    { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (c) => esc(UI.supName(c.c.supplierId) || '—'), sort: (c) => UI.supName(c.c.supplierId) },
    { key: 'type', label: t('f.type', 'Type'), render: (c) => UI.v(c.c.type), sort: (c) => c.c.type },
    { key: 'start', label: t('f.startDate', 'Start'), render: (c) => UI.date(c.c.startDate), sort: (c) => c.c.startDate },
    { key: 'end', label: t('f.endDate', 'End'), render: (c) => UI.date(c.c.endDate), sort: (c) => c.c.endDate },
    { key: 'val', label: t('f.value', 'Value'), num: true, render: (c) => UI.money(c.c.value, c.c.currency), sort: (c) => c.c._valueBase },
    { key: 'used', label: t('con.used', 'Used'), num: true, render: (c) => UI.money(c.used, c.c.currency), sort: (c) => c.used },
    { key: 'rem', label: t('con.remaining', 'Remaining'), num: true, render: (c) => UI.money(c.remainingValue, c.c.currency), sort: (c) => c.remainingValue },
    { key: 'util', label: t('con.util', 'Utilisation'), num: true, render: (c) => (c.util != null ? `${UI.pct(c.util, 0)} ${C.meter(Math.min(100, c.util), { tone: c.util > 100 ? 'critical' : c.util >= 90 ? 'serious' : 'good' })}` : UI.na()), sort: (c) => c.util },
    { key: 'days', label: t('con.days', 'Days left'), num: true, render: (c) => (c.remainingDays == null ? UI.na() : UI.num(c.remainingDays)), sort: (c) => c.remainingDays },
    { key: 'st', label: t('f.status', 'Status'), render: (c) => UI.badge(c.status), sort: (c) => c.status },
    { key: 'al', label: t('con.alerts', 'Alerts'), render: (c) => c.alerts.map((a) => UI.badge(t('ca.' + a))).join(' '), sort: (c) => c.alerts.length },
  ];
  V.disputeCols = () => [
    { key: 'disputeId', label: t('f.disputeId', 'Dispute') }, { key: 'type', label: t('f.type', 'Type'), render: (d) => esc(t('dsp.' + d.type, d.type)) },
    { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (d) => esc(UI.supName(d.supplierId) || '—') },
    { key: 'invoiceNo', label: t('f.invoiceNo', 'Invoice'), render: (d) => UI.v(d.invoiceNo) }, { key: 'amount', label: t('f.amount', 'Amount'), num: true, render: (d) => UI.money(d.amount, d.currency) },
    { key: 'issue', label: t('f.issue', 'Issue') }, { key: 'owner', label: t('f.owner', 'Owner') },
    { key: 'raisedDate', label: t('f.raisedDate', 'Raised'), render: (d) => UI.date(d.raisedDate) }, { key: 'targetDate', label: t('f.targetDate', 'Target'), render: (d) => UI.date(d.targetDate) },
    { key: 'status', label: t('f.status', 'Status'), render: (d) => UI.badge(d.status) }, { key: 'rootCause', label: t('f.rootCause', 'Root cause') }, { key: 'resolution', label: t('f.resolution', 'Resolution') },
  ];

  /* ------------------------------ PROCUREMENT ------------------------------ */
  V.procurement = {
    title: () => t('nav.procurement', 'Procurement'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.pos.length && !D.invoices.length) return UI.empty();
      const sumB = (arr, f) => U.sum(arr, f);
      const fx = (c, d) => (R.P.fx.rate(c, d) || {}).rate;
      const prAmt = sumB(D.prs, (p) => (fx(p.currency, p.date) || 0) * (p.amount || 0));
      const rfqN = U.uniq(D.rfqs.map((r) => r.rfqNo)).length;
      const grnVal = sumB(D.grnLines, (l) => { const pl = (R.P.poLines.get(l.poNo) || []).find((x) => x.itemCode === l.itemCode); const po = R.P.po.get(l.poNo); return pl && po && po._fx ? (l.qtyAccepted != null ? l.qtyAccepted : l.qtyReceived) * pl.unitPrice * po._fx.rate : 0; });
      const appr = D.invoices.filter((i) => /approved/i.test(i.approvalStatus || ''));
      const funnel = [
        ['PR', D.prs.length, prAmt, 'procurement'], ['RFQ', rfqN, null, 'procurement'], ['PO', D.pos.length, sumB(D.pos, (p) => p._totalBase || 0), 'pos'], ['GRN', D.grns.length, grnVal, 'pos'],
        ['Invoice', D.invoices.length, sumB(D.invoices, (i) => i._totalBase || 0), 'invoices'], ['Approval', appr.length, sumB(appr, (i) => i._totalBase || 0), 'invoices'], ['Payment', D.payments.filter((p) => p._isPaid).length, R.kpis.paymentRegisterTotal.value, 'payments'],
      ];
      const poUtil = D.pos.filter((p) => p._total > 0).map((p) => U.sum((R.P.invByPo.get(p.poNo) || []).filter((i) => !i._closed), (i) => i.total) / p._total * 100);
      const avgUtil = poUtil.length ? U.sum(poUtil) / poUtil.length : null;
      const cons = R.contracts.list.filter((c) => c.util != null);
      const conUtil = cons.length ? U.sum(cons, (c) => c.util) / cons.length : null;
      const rfqGroups = Array.from(U.groupBy(D.rfqs, 'rfqNo').entries()).map(([no, rs]) => ({ no, rs, pr: rs[0].prNo, n: rs.length, min: Math.min(...rs.map((r) => r.quoteAmount || Infinity)), sel: rs.find((r) => r.selected), _key: rs[0]._key }));
      return `<div class="page-h"><div><h1>${esc(t('nav.procurement', 'Procurement'))}</h1><p class="muted">${esc(t('proc.sub', 'PR → RFQ → PO → GRN → Invoice → Approval → Payment — full P2P visibility.'))} ${UI.demoTag()}</p></div></div>
        <div class="funnel">${funnel.map(([k, n, v, nav]) => `<button class="fn" data-nav="${nav}"><span>${esc(t('p2p.' + k, k))}</span><b>${esc(S.fmt.num(n))}</b><small>${v != null ? esc(S.fmt.money(v, ccy(), { compact: true })) : '&nbsp;'}</small></button>`).join('<span class="fn-arr" aria-hidden="true">→</span>')}</div>
        <div class="kpis">
          <div class="kpi static"><span class="kpi-label">${esc(t('proc.poUtil', 'Average PO utilisation (invoiced ÷ PO)'))}</span><span class="kpi-value">${avgUtil == null ? UI.na() : esc(S.fmt.pct(avgUtil))}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('proc.conUtil', 'Average contract utilisation'))}</span><span class="kpi-value">${conUtil == null ? UI.na() : esc(S.fmt.pct(conUtil))}</span></div>
          ${UI.kpi('nonPOSpend')}${UI.kpi('maverickSpend')}${UI.kpi('top5')}${UI.kpi('poCompliance')}${UI.kpi('potentialSavings')}
        </div>
        ${UI.section(t('proc.prs', 'Purchase requisitions'), UI.table('prs', [
          { key: 'prNo', label: t('f.prNo', 'PR') }, { key: 'date', label: t('f.date', 'Date'), render: (p) => UI.date(p.date) }, { key: 'department', label: t('f.department', 'Department') },
          { key: 'costCenter', label: t('f.costCenter', 'Cost center') }, { key: 'project', label: t('f.project', 'Project') }, { key: 'description', label: t('f.description', 'Description') },
          { key: 'amount', label: t('f.amount', 'Amount'), num: true, render: (p) => UI.money(p.amount, p.currency) }, { key: 'status', label: t('f.status', 'Status'), render: (p) => UI.badge(p.status) },
          { key: 'po', label: t('f.poNo', 'PO'), render: (p) => { const po = D.pos.find((x) => x.prNo === p.prNo); return po ? `<a data-drill="${esc(po._key)}">${esc(po.poNo)}</a>` : UI.na('—'); } },
        ], D.prs, { pageSize: 10, exportName: 'purchase_requisitions' }))}
        ${UI.section(t('proc.rfqs', 'RFQs & quotation comparison'), UI.table('rfqs', [
          { key: 'no', label: t('f.rfqNo', 'RFQ') }, { key: 'pr', label: t('f.prNo', 'PR') }, { key: 'n', label: t('proc.bidders', 'Bidders'), num: true },
          { key: 'quotes', label: t('proc.quotes', 'Quotes'), render: (g) => g.rs.map((r) => `${esc(UI.supName(r.supplierId))}: ${esc(S.fmt.money(r.quoteAmount, r.currency))}${r.selected ? ' ✔' : ''}`).join('<br>'), sort: (g) => g.min },
          { key: 'sel', label: t('proc.selected', 'Selected = lowest?'), render: (g) => (g.sel ? (g.sel.quoteAmount <= g.min ? UI.badge('Yes', null) : UI.badge(t('proc.notLowest', 'Not lowest — justify'))) : UI.na()), sort: (g) => (g.sel && g.sel.quoteAmount <= g.min ? 1 : 0) },
        ], rfqGroups, { pageSize: 10, exportName: 'rfqs' }))}`;
    },
  };

  /* ------------------------------ PURCHASE ORDERS ------------------------------ */
  V.poDerived = (p) => {
    const R = S.R;
    const pl = R.P.poLines.get(p.poNo) || [];
    const gl = R.P.grnLinesByPo.get(p.poNo) || [];
    const invs = (R.P.invByPo.get(p.poNo) || []).filter((i) => !i._closed);
    const received = pl.length && gl.length ? U.sum(gl, (g) => { const l = pl.find((x) => x.itemCode === g.itemCode); return l ? (g.qtyAccepted != null ? g.qtyAccepted : g.qtyReceived) * l.unitPrice : 0; }) : gl.length ? null : 0;
    const invoiced = U.sum(invs, (i) => i.total);
    const paid = U.sum(invs, (i) => i._paid);
    const tot = p._total;
    const approved = /approved|received|invoiced|paid|closed/i.test(p.status || '') || p.approvedBy ? tot : 0;
    let st = p.status;
    if (!/cancel|closed|draft|pending/i.test(p.status || '')) {
      const tol = 1;
      if (paid > 0 && paid >= invoiced - tol && invoiced >= tot - tol) st = 'Fully Paid';
      else if (paid > 0) st = 'Partially Paid';
      else if (invoiced >= tot - tol && tot) st = 'Fully Invoiced';
      else if (invoiced > 0) st = 'Partially Invoiced';
      else if (received != null && tot && received >= (p.amount || tot) - tol) st = 'Fully Received';
      else if (received > 0) st = 'Partially Received';
      else if (p.requiredDate && U.daysBetween(p.requiredDate, R.asOf) > 90) st = 'Expired';
      else st = 'Approved';
    }
    return { approved, received, invoiced, paid, outstanding: invoiced - paid, remaining: tot != null ? tot - invoiced : null, derived: st };
  };
  V.pos = {
    title: () => t('nav.pos', 'Purchase Orders'),
    render() {
      const D = S.state.data;
      if (!D.pos.length) return UI.empty(t('po.none', 'No purchase orders loaded.'));
      const rows = D.pos.map((p) => Object.assign({ p, _key: p._key }, V.poDerived(p)));
      const STS = ['Draft', 'Pending Approval', 'Approved', 'Partially Received', 'Fully Received', 'Partially Invoiced', 'Fully Invoiced', 'Partially Paid', 'Fully Paid', 'Closed', 'Cancelled', 'Expired'];
      const f = S.vs.poStatus || 'all';
      const shown = rows.filter((r) => f === 'all' || r.derived === f);
      const m = (r, k) => UI.num(r[k], 2);
      return `<div class="page-h"><div><h1>${esc(t('nav.pos', 'Purchase Orders'))}</h1><p class="muted">${esc(t('po.sub', 'Approved, received, invoiced, paid and remaining balances are DERIVED from PO lines, GRNs, invoices and payments.'))} ${UI.demoTag()}</p></div></div>
        ${UI.tabs('poStatus', [['all', t('common.all', 'All') + ' (' + rows.length + ')']].concat(STS.filter((s) => rows.some((r) => r.derived === s)).map((s) => [s, t('pos.' + s, s) + ' (' + rows.filter((r) => r.derived === s).length + ')'])), f)}
        ${UI.section('', UI.table('pos', [
          { key: 'po', label: t('f.poNo', 'PO number'), render: (r) => `<b>${esc(r.p.poNo)}</b>${r.p.emergency ? ' <span class="pill p-warn">' + esc(t('po.emergency', 'Emergency')) + '</span>' : ''}`, sort: (r) => r.p.poNo },
          { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (r) => esc(UI.supName(r.p.supplierId) || '—'), sort: (r) => UI.supName(r.p.supplierId) },
          { key: 'dep', label: t('f.department', 'Department'), render: (r) => UI.v(r.p.department), sort: (r) => r.p.department },
          { key: 'cc', label: t('f.costCenter', 'Cost center'), render: (r) => UI.v(r.p.costCenter), sort: (r) => r.p.costCenter },
          { key: 'prj', label: t('f.project', 'Project'), render: (r) => UI.v(r.p.project), sort: (r) => r.p.project },
          { key: 'con', label: t('f.contractId', 'Contract'), render: (r) => UI.v(r.p.contractId), sort: (r) => r.p.contractId },
          { key: 'date', label: t('f.poDate', 'PO date'), render: (r) => UI.date(r.p.poDate), sort: (r) => r.p.poDate },
          { key: 'req', label: t('f.requiredDate', 'Required'), render: (r) => UI.date(r.p.requiredDate), sort: (r) => r.p.requiredDate },
          { key: 'ccy', label: t('f.currency', 'Ccy'), render: (r) => esc(r.p.currency), sort: (r) => r.p.currency },
          { key: 'amt', label: t('f.amount', 'PO amount'), num: true, render: (r) => UI.num(r.p.amount, 2), sort: (r) => r.p.amount },
          { key: 'tax', label: t('f.tax', 'Tax'), num: true, render: (r) => UI.num(r.p.tax, 2), sort: (r) => r.p.tax },
          { key: 'tot', label: t('f.total', 'Total'), num: true, render: (r) => UI.num(r.p._total, 2), sort: (r) => r.p._total },
          { key: 'rec', label: t('po.received', 'Received'), num: true, render: (r) => m(r, 'received'), sort: (r) => r.received },
          { key: 'inv', label: t('po.invoiced', 'Invoiced'), num: true, render: (r) => m(r, 'invoiced'), sort: (r) => r.invoiced },
          { key: 'paid', label: t('po.paid', 'Paid'), num: true, render: (r) => m(r, 'paid'), sort: (r) => r.paid },
          { key: 'out', label: t('po.outstanding', 'Outstanding'), num: true, render: (r) => m(r, 'outstanding'), sort: (r) => r.outstanding },
          { key: 'rem', label: t('po.remaining', 'Remaining PO balance'), num: true, render: (r) => m(r, 'remaining'), sort: (r) => r.remaining },
          { key: 'st', label: t('f.status', 'Status'), render: (r) => `${UI.badge(r.derived, 'pos.')}${r.p.status && r.p.status !== r.derived ? `<div class="small muted">${esc(t('po.source', 'source'))}: ${esc(r.p.status)}</div>` : ''}`, sort: (r) => r.derived },
        ], shown, { pageSize: 20, exportName: 'purchase_orders' }))}`;
    },
  };

  /* ------------------------------ CONTRACTS ------------------------------ */
  V.contracts = {
    title: () => t('nav.contracts', 'Contracts'),
    render() {
      const R = S.R;
      if (!S.state.data.contracts.length) return UI.empty(t('con.none', 'No contracts loaded.'));
      const L = R.contracts.list;
      const cnt = (a) => L.filter((c) => c.alerts.includes(a)).length;
      return `<div class="page-h"><div><h1>${esc(t('nav.contracts', 'Contracts'))}</h1><p class="muted">${esc(t('con.sub', 'Used value = invoices referencing the contract (directly or via PO), in contract currency.'))} ${UI.demoTag()}</p></div></div>
        <div class="kpis">${UI.kpi('contractExposure')}${UI.kpi('contractCompliance')}${UI.kpi('contractSpend')}${UI.kpi('offContractSpend')}
          ${['expiring', 'expired', 'exceeded', 'nearlyExhausted', 'invoiceOutside', 'poOutside'].map((a) => `<div class="kpi static"><span class="kpi-label">${esc(t('ca.' + a))}</span><span class="kpi-value">${esc(S.fmt.num(cnt(a)))}</span></div>`).join('')}</div>
        ${UI.section('', UI.table('contracts', V.contractCols(), L, { drill: (c) => c.c._key, pageSize: 20, exportName: 'contracts' }))}
        ${UI.section(t('con.missing', 'Missing contracts (critical/strategic or ≥ 5% spend, no contract on file)'), UI.table('conMissing', [
          { key: 'n', label: t('f.name', 'Supplier'), render: (m) => esc(UI.supName(m.supplierId)) }, { key: 'spend', label: t('sup.spend', 'Spend (12m)'), num: true, render: (m) => UI.base(m.spend) }, { key: 'share', label: t('spend.share', 'Share'), num: true, render: (m) => UI.pct(m.share) },
        ], R.contracts.missing, { drill: (m) => (R.P.sup.get(m.supplierId) || {})._key }))}`;
    },
  };

  /* ------------------------------ INVOICES ------------------------------ */
  V.invoiceActions = (inv) => {
    if (inv._closed || V.invStatus(inv) === 'Paid') return '';
    const pending = !/approved|reject/i.test(inv.approvalStatus || '');
    return pending ? `<button class="btn primary" data-act="invApprove" data-key="${esc(inv._key)}">✔ ${esc(t('inv.approve', 'Approve invoice'))}</button><button class="btn danger" data-act="invReject" data-key="${esc(inv._key)}">✖ ${esc(t('inv.reject', 'Reject'))}</button><button class="btn" data-act="dispute" data-key="${esc(inv._key)}">⚑ ${esc(t('dsp.raise', 'Raise dispute'))}</button>` : `<button class="btn" data-act="dispute" data-key="${esc(inv._key)}">⚑ ${esc(t('dsp.raise', 'Raise dispute'))}</button>`;
  };
  V.invoices = {
    title: () => t('nav.invoices', 'Invoices'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.invoices.length) return UI.empty(t('inv.none', 'No invoices loaded.'));
      const STS = ['Received', 'OCR Processing', 'Validated', 'Exception', 'Pending Approval', 'Approved', 'Scheduled', 'Paid', 'Rejected', 'Cancelled'];
      const st = D.invoices.map((i) => [i, V.invStatus(i)]);
      const f = S.vs.invStatus || 'all';
      const rows = st.filter(([, s]) => f === 'all' || s === f).map(([i]) => i);
      const cnt = (s) => st.filter(([, x]) => x === s).length;
      const due = D.invoices.filter((i) => i._open && i._dpd != null && i._dpd <= 0 && i._dpd >= -S.state.config.alerts.invoiceDueDays).length;
      const od = D.invoices.filter((i) => i._open && i._dpd > 0).length;
      const hold = R.priority.filter((x) => x.blocks.length).length;
      const box = (k, l, v, tab) => `<button class="kpi static" ${tab ? `data-tab="invStatus:${tab}"` : ''}><span class="kpi-label">${esc(t(k, l))}</span><span class="kpi-value">${esc(S.fmt.num(v))}</span></button>`;
      return `<div class="page-h"><div><h1>${esc(t('nav.invoices', 'Invoices'))}</h1><p class="muted">${esc(t('inv.sub', 'Accounts Payable dashboard and invoice lifecycle: Received → OCR → Validated → Exception → Pending Approval → Approved → Scheduled → Paid.'))} ${UI.demoTag()}</p></div><div class="btn-row"><button class="btn" data-nav="upload">⤒ ${esc(t('inv.uploadOcr', 'Upload invoices (OCR)'))}</button></div></div>
        <div class="kpis">${box('inv.k.received', 'Invoices received', D.invoices.length, 'all')}${box('inv.k.pending', 'Pending approval', cnt('Pending Approval'), 'Pending Approval')}${box('inv.k.approved', 'Approved', cnt('Approved'), 'Approved')}${box('inv.k.rejected', 'Rejected', cnt('Rejected'), 'Rejected')}${box('inv.k.hold', 'On hold (blocked)', hold)}${box('inv.k.due', 'Due ≤ {n} days', due)}${box('inv.k.overdue', 'Overdue', od)}${box('inv.k.exceptions', 'Exceptions', cnt('Exception'), 'Exception')}
          ${UI.kpi('avgProcessing')}${UI.kpi('paymentCycle')}${UI.kpi('duplicateRisk')}${UI.kpi('exceptionRate')}</div>
        ${UI.tabs('invStatus', [['all', t('common.all', 'All') + ' (' + D.invoices.length + ')']].concat(STS.filter((s) => cnt(s)).map((s) => [s, t('is.' + s, s) + ' (' + cnt(s) + ')'])), f)}
        ${UI.section('', UI.table('invoices', V.invoiceCols().concat([
          { key: 'sub', label: t('f.subtotal', 'Subtotal'), num: true, render: (i) => UI.num(i.subtotal, 2) },
          { key: 'tax', label: t('f.tax', 'Tax'), num: true, render: (i) => UI.num(i.tax, 2) },
          { key: 'wht', label: t('f.wht', 'WHT'), num: true, render: (i) => UI.num(i.wht, 2) },
          { key: 'grnNo', label: t('f.grnNo', 'GRN'), render: (i) => UI.v(i.grnNo) },
          { key: 'contractId', label: t('f.contractId', 'Contract'), render: (i) => UI.v(i.contractId) },
          { key: 'terms', label: t('f.paymentTerms', 'Terms'), render: (i) => UI.v(i.paymentTerms) },
        ]), rows, { pageSize: 20, exportName: 'invoice_register', searchText: (i) => [i.invoiceNo, i._supName, i.poNo, i.description].join(' ') }))}`;
    },
  };

  /* ------------------------------ THREE-WAY MATCHING ------------------------------ */
  V.matching = {
    title: () => t('nav.matching', 'Three-Way Matching'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.invoices.length) return UI.empty();
      const rows = D.invoices.map((i) => ({ i, m: R.match.get(i._key), _key: i._key }));
      const f = S.vs.matchStatus || 'all';
      const shown = rows.filter((r) => f === 'all' || r.m.status === f);
      const cnt = (s) => rows.filter((r) => r.m.status === s).length;
      const tol = S.state.config.matching;
      return `<div class="page-h"><div><h1>${esc(t('nav.matching', 'Three-Way Matching'))}</h1><p class="muted">${esc(t('m.sub', 'Purchase order + goods/service receipt + supplier invoice. Tolerances: price {p}% · quantity {q}% · tax {x} pp (configurable). Missing values are never fabricated.', { p: tol.priceTolPct, q: tol.qtyTolPct, x: tol.taxTolPct }))} ${UI.demoTag()}</p></div></div>
        <div class="kpis">${UI.kpi('threeWayRate')}${UI.kpi('invoiceMatchRate')}${UI.kpi('invoiceExceptions')}${UI.kpi('exceptionRate')}</div>
        ${UI.section(t('m.dist', 'Match status distribution'), C.bars(S.engine.MATCH_ORDER.map((s) => ({ label: t('m.' + s), value: cnt(s), tone: UI.tone(s) === 'neutral' ? null : UI.tone(s) })), { horizontal: true, fmt: (v) => S.fmt.num(v) }))}
        ${UI.tabs('matchStatus', [['all', t('common.all', 'All') + ' (' + rows.length + ')']].concat(S.engine.MATCH_ORDER.filter(cnt).map((s) => [s, t('m.' + s) + ' (' + cnt(s) + ')'])), f)}
        ${UI.section('', UI.table('matching', [
          { key: 'inv', label: t('f.invoiceNo', 'Invoice'), render: (r) => `<b>${esc(r.i.invoiceNo)}</b>`, sort: (r) => r.i.invoiceNo },
          { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (r) => esc(UI.supName(r.i.supplierId) || '—'), sort: (r) => r.i._supName },
          { key: 'po', label: t('f.poNo', 'PO'), render: (r) => UI.v(r.i.poNo), sort: (r) => r.i.poNo },
          { key: 'grn', label: t('f.grnNo', 'GRN'), render: (r) => (r.m.grnNos.length ? esc(r.m.grnNos.join(', ')) : UI.na('—')), sort: (r) => r.m.grnNos.length },
          { key: 'ccy', label: t('f.currency', 'Ccy'), render: (r) => esc(r.i.currency || '—'), sort: (r) => r.i.currency },
          { key: 'poa', label: t('m.po', 'PO amount'), num: true, render: (r) => UI.num(r.m.poAmount, 2), sort: (r) => r.m.poAmount },
          { key: 'grna', label: t('m.grnShort', 'GRN amount'), num: true, render: (r) => UI.num(r.m.grnAmount, 2), sort: (r) => r.m.grnAmount },
          { key: 'inva', label: t('m.invShort', 'Invoice amount'), num: true, render: (r) => UI.num(r.m.invAmount, 2), sort: (r) => r.m.invAmount },
          { key: 'var', label: t('m.variance', 'Variance'), num: true, render: (r) => UI.num(r.m.variance, 2), sort: (r) => r.m.variance },
          { key: 'varp', label: t('m.variancePct', 'Variance %'), num: true, render: (r) => UI.pct(r.m.variancePct, 2), sort: (r) => r.m.variancePct },
          { key: 'st', label: t('common.status', 'Status'), render: (r) => UI.badge(r.m.status, 'm.'), sort: (r) => S.engine.MATCH_ORDER.indexOf(r.m.status) },
          { key: 'rs', label: t('m.reasons', 'Reasons'), render: (r) => `<span class="small">${r.m.reasons.map((x) => esc(UI.reason('mr.', x))).join('; ')}</span>`, sort: (r) => r.m.reasons.length },
        ], shown, { pageSize: 20, exportName: 'three_way_match', rowClass: (r) => (['MATCHED', 'PARTIALLY MATCHED'].includes(r.m.status) ? '' : 'exc') }))}`;
    },
  };

  /* ------------------------------ DUPLICATES ------------------------------ */
  V.duplicates = {
    title: () => t('nav.duplicates', 'Duplicate Detection'),
    render() {
      const R = S.R;
      if (!S.state.data.invoices.length) return UI.empty();
      const inv = R.dupInv.list, pay = R.dupPay;
      const rowsI = inv.map((d) => Object.assign({ _key: d.b }, d));
      const rowsP = pay.map((d) => Object.assign({ _key: d.b }, d));
      return `<div class="page-h"><div><h1>${esc(t('nav.duplicates', 'Duplicate Detection'))}</h1><p class="muted">${esc(t('dup.sub', 'Signals: invoice number (raw & normalised), supplier, amount, date window, PO, description similarity, bank account, file hash, identical line items.'))} ${UI.demoTag()}</p></div></div>
        <div class="kpis">${UI.kpi('duplicateRisk')}${UI.kpi('duplicateRate')}${['EXACT DUPLICATE', 'HIGH-RISK DUPLICATE', 'POSSIBLE DUPLICATE'].map((l) => `<div class="kpi static"><span class="kpi-label">${esc(t('dup.' + l))}</span><span class="kpi-value">${esc(S.fmt.num(inv.filter((d) => d.level === l).length))}</span></div>`).join('')}</div>
        ${UI.section(t('dup.invoices', 'Duplicate invoices'), UI.table('dupInv', [
          { key: 'level', label: t('dup.level', 'Flag'), render: (d) => UI.badge(d.level, 'dup.'), sort: (d) => ({ 'EXACT DUPLICATE': 3, 'HIGH-RISK DUPLICATE': 2, 'POSSIBLE DUPLICATE': 1 })[d.level] },
          { key: 'aNo', label: t('dup.first', 'Original'), render: (d) => `<a data-drill="${esc(d.a)}">${esc(d.aNo)}</a>` },
          { key: 'bNo', label: t('dup.second', 'Suspected duplicate'), render: (d) => `<a data-drill="${esc(d.b)}">${esc(d.bNo)}</a>` },
          { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (d) => esc(UI.supName(d.supplierId) || '—') },
          { key: 'amount', label: t('f.amount', 'Amount'), num: true, render: (d) => UI.money(d.amount, d.currency) },
          { key: 'why', label: t('dup.why', 'Why flagged'), render: (d) => `<span class="small">${d.reasons.map((x) => esc(UI.reason('sig.', x))).join(' · ')}</span>` },
          { key: 'paid', label: t('dup.paidBoth', 'Both paid'), render: (d) => (d.paidBoth ? UI.badge(t('common.yes', 'Yes'), null) : esc(t('common.no', 'No'))) },
          { key: 'e', label: '', nosort: true, render: (d) => UI.evBtn('dup', d.id) },
        ], rowsI, { pageSize: 20, exportName: 'duplicate_invoices' }))}
        ${UI.section(t('dup.payments', 'Duplicate payments'), UI.table('dupPay', [
          { key: 'level', label: t('dup.level', 'Flag'), render: (d) => UI.badge(d.level, 'dup.') },
          { key: 'aId', label: t('dup.first', 'Original'), render: (d) => `<a data-drill="${esc(d.a)}">${esc(d.aId)}</a>` },
          { key: 'bId', label: t('dup.second', 'Suspected duplicate'), render: (d) => `<a data-drill="${esc(d.b)}">${esc(d.bId)}</a>` },
          { key: 'sup', label: t('f.supplierId', 'Supplier'), render: (d) => esc(UI.supName(d.supplierId) || '—') },
          { key: 'amount', label: t('f.amount', 'Amount'), num: true, render: (d) => UI.money(d.amount, d.currency) },
          { key: 'why', label: t('dup.why', 'Why flagged'), render: (d) => `<span class="small">${d.reasons.map((x) => esc(UI.reason('sig.', x))).join(' · ')}</span>` },
          { key: 'e', label: '', nosort: true, render: (d) => UI.evBtn('dpay', d.id) },
        ], rowsP, { pageSize: 10, exportName: 'duplicate_payments' }))}`;
    },
  };

  /* ------------------------------ DISPUTES ------------------------------ */
  V.disputes = {
    title: () => t('nav.disputes', 'Disputes'),
    render() {
      const D = S.state.data;
      const open = D.disputes.filter((d) => !/resolv|closed/i.test(d.status || ''));
      const types = Array.from(U.groupBy(D.disputes, 'type').entries()).map(([k, v]) => ({ label: t('dsp.' + k, k), value: v.length }));
      return `<div class="page-h"><div><h1>${esc(t('nav.disputes', 'Disputes'))}</h1><p class="muted">${esc(t('dsp.sub', 'Invoice, supplier, price, quantity, quality, contract, tax and payment disputes.'))} ${UI.demoTag()}</p></div>
        <div class="btn-row"><button class="btn primary" data-act="dispute">⚑ ${esc(t('dsp.raise', 'Raise dispute'))}</button></div></div>
        <div class="kpis small"><div class="kpi static"><span class="kpi-label">${esc(t('dsp.open', 'Open disputes'))}</span><span class="kpi-value">${esc(S.fmt.num(open.length))}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('dsp.overdue', 'Past resolution target'))}</span><span class="kpi-value">${esc(S.fmt.num(open.filter((d) => d.targetDate && d.targetDate < S.R.asOf).length))}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('dsp.amount', 'Disputed amount (open)'))}</span><span class="kpi-value">${UI.base(U.sum(open, (d) => { const r = S.R.P.fx.rate(d.currency, S.R.asOf); return r && d.amount ? d.amount * r.rate : 0; }), { compact: true })}</span></div></div>
        ${UI.section(t('dsp.byType', 'By type'), C.bars(types, { horizontal: true, fmt: (v) => S.fmt.num(v) }))}
        ${UI.section('', UI.table('disputes', V.disputeCols().concat([{ key: 'act', label: '', nosort: true, render: (d) => (/resolv|closed/i.test(d.status || '') ? '' : `<button class="btn sm" data-act="disputeResolve" data-key="${esc(d._key)}">${esc(t('dsp.resolve', 'Resolve'))}</button>`) }]), D.disputes, { pageSize: 20, exportName: 'disputes' }))}`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
