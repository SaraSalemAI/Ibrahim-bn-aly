/* SUMED P2P — spend analytics & concentration; cost reduction & working capital. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui, C = S.chart;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const V = (S.views = S.views || {});
  S.vs = S.vs || {};
  const ccy = () => S.state.config.baseCurrency;

  V.spend = {
    title: () => t('nav.spend', 'Spend Analytics'),
    render() {
      const R = S.R, Sp = R.spend, D = S.state.data;
      if (!Sp.rows.length) return UI.empty(t('spend.none', 'No spend in the last 12 months from the loaded data.'));
      const dim = S.vs.spendDim || 'supplier';
      const map = { supplier: Sp.bySupplier.map((x) => ({ key: x.key, label: UI.supName(x.key) || x.name, amount: x.amount, count: x.count, rows: x.rows })), category: Sp.byCategory, department: Sp.byDepartment, costCenter: Sp.byCostCenter, project: Sp.byProject, contract: Sp.byContract, currency: Sp.byCurrency, month: Sp.byMonth, quarter: Sp.byQuarter, year: Array.from(U.groupBy(Sp.rows, (r) => r.date.slice(0, 4)).entries()).map(([k, rs]) => ({ key: k, amount: U.sum(rs, (r) => r.amountBase), rows: rs })) };
      const data = (map[dim] || []).map((x) => ({ label: x.label || x.key, value: x.amount, count: x.count || x.rows.length, key: x.key }));
      const isTime = ['month', 'quarter', 'year'].includes(dim);
      const cc = Sp.conc, cfg = S.state.config.concentration;
      const budgets = D.budgets.length ? D.budgets.map((b) => { const act = U.sum(Sp.rows.filter((r) => r.costCenter === b.costCenter), (r) => r.amountBase); const rate = (R.P.fx.rate(b.currency || ccy(), R.asOf) || {}).rate; const bud = rate && b.amount != null ? b.amount * rate : null; return { b, act, bud, var: bud != null ? act - bud : null, pct: bud ? (act / bud) * 100 : null, _key: b._key }; }) : [];
      return `<div class="page-h"><div><h1>${esc(t('nav.spend', 'Spend Analytics'))}</h1><p class="muted">${esc(Sp.basisLabel)} · ${esc(S.fmt.date(Sp.from))} → ${esc(S.fmt.date(Sp.to))} ${UI.demoTag()}</p></div></div>
        <div class="kpis">${UI.kpi('totalSpend')}${UI.kpi('contractSpend')}${UI.kpi('nonPOSpend')}${UI.kpi('offContractSpend')}${UI.kpi('maverickSpend')}${UI.kpi('emergencySpend')}${UI.kpi('top5')}
          <div class="kpi static"><span class="kpi-label">${esc(t('spend.top10', 'Top-10 share'))}</span><span class="kpi-value">${esc(S.fmt.pct(cc.top10))}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('spend.top20', 'Top-20 share'))}</span><span class="kpi-value">${esc(S.fmt.pct(cc.top20))}</span></div>
          <div class="kpi static"><span class="kpi-label">HHI</span><span class="kpi-value">${esc(S.fmt.num(cc.hhi))}</span><span class="kpi-sub">${esc(t('spend.hhi', 'Herfindahl index (0–10,000)'))}</span></div></div>
        ${cc.flags.length ? `<div class="warnbar">${cc.flags.map((f) => `⛔ <b>${esc(t('spend.high', 'HIGH CONCENTRATION'))}</b>: ${esc(f.key === 'single' ? t('spend.flagSingle', '{n} = {v}% of spend (threshold {th}%)', { n: UI.supName(f.supplierId), v: f.value, th: f.threshold }) : t('spend.flagTop', 'Top-{k} = {v}% (threshold {th}%)', { k: f.key.replace('top', ''), v: f.value, th: f.threshold }))}`).join('<br>')}</div>` : ''}
        ${UI.tabs('spendDim', ['supplier', 'category', 'department', 'costCenter', 'project', 'contract', 'currency', 'month', 'quarter', 'year'].map((d) => [d, t('spend.d.' + d, d)]), dim)}
        <div class="grid g2">
          ${UI.section(t('spend.by', 'Spend by {d} ({c})', { d: t('spend.d.' + dim, dim), c: ccy() }), isTime ? C.bars(data.map((d) => ({ label: d.label, value: d.value }))) : C.bars(data.slice(0, 15).map((d) => ({ label: d.label, value: d.value, tip: `${d.label}: ${S.fmt.money(d.value, ccy())} · ${S.fmt.pct(Sp.total ? (d.value / Sp.total) * 100 : null)}` })), { horizontal: true }))}
          ${UI.section(t('spend.mix', 'Spend mix'), C.donut([{ label: t('spend.onContract', 'On-contract PO spend'), value: Sp.total - U.sum(Sp.mav, (r) => r.amountBase), tone: 'good' }, { label: t('spend.nonPO', 'Non-PO'), value: U.sum(Sp.nonPO, (r) => r.amountBase), tone: 'serious' }, { label: t('spend.offContractOnly', 'Off-contract (with PO)'), value: U.sum(Sp.offC.filter((r) => !r.nonPO), (r) => r.amountBase), tone: 'critical' }, { label: t('spend.unapproved', 'Unapproved supplier (other)'), value: U.sum(Sp.mav.filter((r) => !r.nonPO && !r.offContract), (r) => r.amountBase), tone: 'warning' }], { centerLabel: ccy() }))}
        </div>
        ${UI.section('', UI.table('spendTbl', [
          { key: 'label', label: t('spend.d.' + dim, dim) },
          { key: 'value', label: t('f.amount', 'Amount') + ' (' + ccy() + ')', num: true, render: (d) => UI.num(d.value, 0) },
          { key: 'share', label: t('spend.share', 'Share'), num: true, render: (d) => UI.pct(Sp.total ? (d.value / Sp.total) * 100 : null), sort: (d) => d.value },
          { key: 'count', label: t('spend.docs', 'Documents'), num: true, render: (d) => UI.num(d.count) },
        ], data, { drill: (d) => (dim === 'supplier' ? (R.P.sup.get(d.key) || {})._key : null), pageSize: 20, exportName: 'spend_by_' + dim }))}
        ${budgets.length ? UI.section(t('spend.budget', 'Budget vs actual by cost center ({c})', { c: ccy() }), UI.table('budget', [
          { key: 'cc', label: t('f.costCenter', 'Cost center'), render: (x) => esc(x.b.costCenter), sort: (x) => x.b.costCenter },
          { key: 'bud', label: t('spend.budgetAmt', 'Budget'), num: true, render: (x) => UI.num(x.bud, 0), sort: (x) => x.bud },
          { key: 'act', label: t('spend.actual', 'Actual (12m)'), num: true, render: (x) => UI.num(x.act, 0), sort: (x) => x.act },
          { key: 'var', label: t('m.variance', 'Variance'), num: true, render: (x) => UI.num(x.var, 0), sort: (x) => x.var },
          { key: 'pct', label: t('spend.used', 'Used %'), num: true, render: (x) => `${UI.pct(x.pct)} ${C.meter(Math.min(100, x.pct || 0), { tone: x.pct > 100 ? 'critical' : x.pct > 90 ? 'serious' : 'good' })}`, sort: (x) => x.pct },
        ], budgets, { pageSize: 15 }) + `<p class="small muted">${esc(t('spend.budgetNote', 'Budget year from file; actual = trailing 12 months net spend. Budget and actual periods may differ.'))}</p>`) : ''}`;
    },
  };

  V.savings = {
    title: () => t('nav.savings', 'Cost Reduction & Working Capital'),
    render() {
      const R = S.R;
      if (!S.state.data.invoices.length) return UI.empty();
      const wc = R.wc;
      return `<div class="page-h"><div><h1>${esc(t('nav.savings', 'Cost Reduction & Working Capital'))}</h1><p class="muted">${esc(t('sav.sub', 'No saving is claimed without a transparent calculation: current spend, benchmark, estimated saving, method, evidence and confidence.'))} ${UI.demoTag()}</p></div></div>
        <div class="kpis">${UI.kpi('potentialSavings')}${UI.kpi('discountCapture')}${UI.kpi('dpo')}${UI.kpi('avgPayDays')}${UI.kpi('overdueAP')}</div>
        ${UI.section(t('sav.opps', 'Cost-reduction opportunities'), UI.table('savings', [
          { key: 'type', label: t('sav.opp', 'Opportunity'), render: (s) => `<b>${esc(t('sv.' + s.type))}</b>` },
          { key: 'n', label: t('sav.items', 'Items'), num: true, render: (s) => UI.num(s.n) },
          { key: 'cur', label: t('sav.current', 'Current / addressable'), num: true, render: (s) => (s.current == null ? UI.na('—') : UI.base(s.current, { compact: true })), sort: (s) => s.current },
          { key: 'sav', label: t('sav.saving', 'Estimated saving'), num: true, render: (s) => (s.saving == null ? (s.release ? `<span class="small">${esc(t('sav.release', 'Release'))}: ${esc(S.fmt.money(s.release, ccy(), { compact: true }))}</span>` : UI.na(t('sav.notQ', 'Not quantified'))) : `<b>${UI.base(s.saving, { compact: true })}</b>`), sort: (s) => s.saving },
          { key: 'conf', label: t('sav.conf', 'Confidence'), render: (s) => UI.badge(s.confidence, 'conf.') },
          { key: 'm', label: t('sav.method', 'Calculation method'), render: (s) => `<span class="small">${esc(s.method)}</span>` },
          { key: 'e', label: '', nosort: true, render: (s) => UI.evBtn('sav', s.id) },
        ], R.savings, { drill: () => null, pageSize: 15, exportName: 'cost_reduction' }))}
        ${(R.savings.find((s) => s.type === 'consolidation') || {}).detail ? UI.section(t('sav.bench', 'Best-price benchmark detail'), UI.table('bench', [
          { key: 'item', label: t('f.itemCode', 'Item') }, { key: 'suppliers', label: t('sav.nSup', 'Suppliers'), num: true }, { key: 'min', label: t('sav.min', 'Best unit price'), num: true, render: (d) => UI.num(d.min, 2) },
          { key: 'minSup', label: t('sav.minSup', 'Best-price supplier'), render: (d) => esc(UI.supName(d.minSup)) }, { key: 'excess', label: t('sav.saving', 'Estimated saving'), num: true, render: (d) => UI.base(d.excess) },
        ], R.savings.find((s) => s.type === 'consolidation').detail, { drill: () => null, pageSize: 10 })) : ''}
        <div class="grid g2">
          ${UI.section(t('wc.title', 'Working-capital optimisation'), `<table class="kv">
            <tr><th>${esc(t('wc.early', 'Paid > 5 days before due date (no discount)'))}</th><td>${esc(S.fmt.num(wc.early.length))} · ${UI.base(wc.earlyAmount, { compact: true })} · ${esc(t('wc.avgEarly', 'avg {d} days early', { d: wc.avgEarlyDays == null ? '—' : S.fmt.num(wc.avgEarlyDays, 1) }))}</td></tr>
            <tr><th>${esc(t('wc.fin', 'Financing value of early payments'))}</th><td>${wc.financingValue == null ? UI.na(t('wc.coc', 'Cost of capital not configured')) : UI.base(wc.financingValue)}</td></tr>
            <tr><th>${esc(t('wc.overdue', 'Overdue balances to reduce'))}</th><td>${UI.base(wc.overdue, { compact: true })} (${esc(S.fmt.num(wc.overdueRows.length))})</td></tr>
            <tr><th>DPO</th><td>${wc.dpo.value == null ? `<span class="na">${esc(wc.dpo.lineage.unavailable)}</span>` : esc(S.fmt.days(wc.dpo.value))}</td></tr>
            <tr><th>${esc(t('wc.ar', 'Accounts receivable'))}</th><td>${UI.v(wc.ar)}</td></tr><tr><th>${esc(t('wc.inv', 'Inventory'))}</th><td>${UI.v(wc.inventory)}</td></tr>
            <tr><th>${esc(t('wc.ccc', 'Cash conversion cycle'))}</th><td><span class="na">${esc(wc.cccReason)}</span></td></tr></table>`)}
          ${UI.section(t('wc.recs', 'Recommendations'), `<ol class="stmts">
            <li>${esc(t('wc.r1', 'Preserve liquidity: schedule non-discount invoices on their due date, not earlier ({n} early payments found).', { n: wc.early.length }))} ${wc.early.length ? UI.evBtn('wcEarly', 'x') : ''}</li>
            <li>${esc(t('wc.r2', 'Capture genuine discounts: {n} open invoice(s) still inside the discount window.', { n: R.priority.filter((x) => x.discount && !x.blocks.length).length }))}</li>
            <li>${esc(t('wc.r3', 'Avoid penalties: prioritise overdue invoices under contracts with late-payment penalties.'))}</li>
            <li>${esc(t('wc.r4', 'Reduce overdue balances by clearing approval/exception blockers first (see Payment priority queue).'))}</li>
            <li>${esc(t('wc.r5', 'Upload AR ledger and inventory to enable DSO, DIO and cash conversion cycle.'))}</li></ol>`)}
        </div>`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
