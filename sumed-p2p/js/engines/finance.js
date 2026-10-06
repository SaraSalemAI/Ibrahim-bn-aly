/* SUMED P2P — AP aging, DPO, payment proposal/priority, cash & payment forecasting, scenarios. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const E = (S.engine = S.engine || {});

  E.BUCKETS = [
    { id: 'current', test: (d) => d != null && d <= 0 },
    { id: 'b1_30', test: (d) => d >= 1 && d <= 30 },
    { id: 'b31_60', test: (d) => d >= 31 && d <= 60 },
    { id: 'b61_90', test: (d) => d >= 61 && d <= 90 },
    { id: 'b91_180', test: (d) => d >= 91 && d <= 180 },
    { id: 'b180p', test: (d) => d > 180 },
    { id: 'noDue', test: (d) => d == null },
  ];

  /* ---------------- AP aging ---------------- */
  E.aging = (D, P, cfg, asOf) => {
    const open = D.invoices.filter((i) => i._open);
    const conv = open.filter((i) => i._outBase != null);
    const noFx = open.filter((i) => i._outBase == null);
    const buckets = E.BUCKETS.map((b) => {
      const rows = conv.filter((i) => b.test(i._dpd));
      return { id: b.id, count: rows.length, amount: U.sum(rows, (i) => i._outBase), rows };
    });
    const total = U.sum(conv, (i) => i._outBase);
    const overdueRows = conv.filter((i) => i._dpd != null && i._dpd > 0);
    const overdue = U.sum(overdueRows, (i) => i._outBase);
    const bySup = Array.from(U.groupBy(conv, 'supplierId').entries()).map(([sid, rows]) => {
      const o = { supplierId: sid, name: rows[0]._supName, nameAr: rows[0]._supNameAr, total: U.sum(rows, (i) => i._outBase), overdue: U.sum(rows.filter((i) => i._dpd > 0), (i) => i._outBase), count: rows.length, rows };
      E.BUCKETS.forEach((b) => (o[b.id] = U.sum(rows.filter((i) => b.test(i._dpd)), (i) => i._outBase)));
      return o;
    }).sort((a, b) => b.total - a.total);
    // Actual payment days (amount-weighted invoice→payment)
    const paidPairs = [];
    for (const p of D.payments.filter((x) => x._isPaid && x.invoiceNo)) {
      const inv = P.inv.get(p.invoiceNo);
      if (inv && inv.invoiceDate && p.paymentDate && p._netBase) paidPairs.push({ days: U.daysBetween(inv.invoiceDate, p.paymentDate), w: Math.abs(p._netBase), p, inv, late: inv.dueDate ? U.daysBetween(inv.dueDate, p.paymentDate) : null });
    }
    const wsum = U.sum(paidPairs, (x) => x.w);
    const avgPayDays = wsum ? U.round(U.sum(paidPairs, (x) => x.days * x.w) / wsum, 1) : null;
    const withDue = paidPairs.filter((x) => x.late != null);
    const onTime = withDue.filter((x) => x.late <= 0).length;
    const L = {};
    L.totalAP = E.lineage({ label: 'Total Outstanding AP', value: U.round(total, 2), unit: cfg.baseCurrency, formula: 'SUM(outstanding × FX rate at as-of date) over open invoices', inputs: [{ label: 'Open invoices (converted)', value: conv.length }, { label: 'As-of date', value: asOf }], rows: conv, entity: 'invoices', route: 'aging', excluded: noFx.length ? [{ reason: 'FX RATE NOT AVAILABLE', count: noFx.length, detail: noFx.map((i) => `${i.invoiceNo}: ${i.currency} ${i._out}`).join('; ') }] : [], note: 'Outstanding = SOURCE "Outstanding" column when provided, else DERIVED as Total − executed/reconciled payments from the Payment Register.' });
    L.overdueAP = E.lineage({ label: 'Overdue AP', value: U.round(overdue, 2), unit: cfg.baseCurrency, formula: 'SUM(outstanding base) WHERE as-of date − due date ≥ 1', rows: overdueRows, entity: 'invoices', route: 'aging' });
    L.currentAP = E.lineage({ label: 'Current (not yet due) AP', value: U.round(buckets[0].amount, 2), unit: cfg.baseCurrency, formula: 'SUM(outstanding base) WHERE due date ≥ as-of date', rows: buckets[0].rows, entity: 'invoices', route: 'aging' });
    L.avgPayDays = E.lineage({ label: 'Average payment days (amount-weighted)', value: avgPayDays, unit: 'days', formula: 'Σ(days invoice→payment × net base) / Σ net base', inputs: [{ label: 'Paid invoice/payment pairs', value: paidPairs.length }], rows: paidPairs.map((x) => x.p), entity: 'payments', route: 'aging', note: 'Operational metric — not DPO.' });
    L.onTimeRate = E.lineage({ label: 'On-time payment rate', value: withDue.length ? U.round((onTime / withDue.length) * 100, 1) : null, unit: '%', formula: 'payments made on/before due date ÷ payments with a due date', inputs: [{ label: 'On time', value: onTime }, { label: 'With due date', value: withDue.length }], rows: withDue.map((x) => x.p), entity: 'payments', route: 'payments' });
    const top = bySup[0];
    L.apConcentration = E.lineage({ label: 'Largest supplier share of AP', value: top && total ? U.round((top.total / total) * 100, 1) : null, unit: '%', formula: 'largest supplier outstanding ÷ total AP', inputs: top ? [{ label: top.name, value: U.round(top.total, 0) }, { label: 'Total AP', value: U.round(total, 0) }] : [], rows: top ? top.rows : [], entity: 'invoices', route: 'aging' });
    return { buckets, total, overdue, overdueRows, open, noFx, bySup, avgPayDays, paidPairs, lineage: L };
  };

  /* ---------------- DPO ---------------- */
  E.dpo = (D, P, cfg) => {
    const gl = D.gl.filter((g) => g.period && g.apBalance != null).sort((a, b) => (a.period < b.period ? -1 : 1));
    const missing = [];
    if (gl.length < 2) missing.push('At least two GL / AP-ledger period balances (opening and closing AP)');
    const purchKey = gl.some((g) => g.purchases != null) ? 'purchases' : gl.some((g) => g.cogs != null) ? 'cogs' : null;
    if (!purchKey) missing.push('Purchases or Cost of Sales for the period');
    const hist = [];
    for (let i = 1; i < gl.length; i++) {
      const p = gl[i], prev = gl[i - 1];
      const pur = p[purchKey];
      hist.push({ period: p.period, ap: p.apBalance, dpo: purchKey && pur ? U.round((((prev.apBalance + p.apBalance) / 2) / pur) * 30, 1) : null });
    }
    let value = null, inputs = [], rows = [];
    if (!missing.length) {
      const win = gl.slice(-13);
      const opening = win[0], closing = win[win.length - 1];
      const purchases = U.sum(win.slice(1), (g) => g[purchKey]);
      const days = U.daysBetween(opening.period + '-01', closing.period + '-01') || cfg.dpo.periodDays;
      value = purchases ? U.round((((opening.apBalance + closing.apBalance) / 2) / purchases) * days, 1) : null;
      if (!purchases) missing.push('Non-zero purchases for the period');
      inputs = [{ label: 'Opening AP (' + opening.period + ')', value: opening.apBalance }, { label: 'Closing AP (' + closing.period + ')', value: closing.apBalance }, { label: (purchKey === 'cogs' ? 'Cost of sales' : 'Purchases') + ' (' + win[1].period + '→' + closing.period + ')', value: purchases }, { label: 'Days in period', value: days }];
      rows = win;
    }
    const target = cfg.dpo.targetDays;
    return {
      value, hist, target, variance: value != null && target != null ? U.round(value - target, 1) : null,
      lineage: E.lineage({ label: 'DPO', value, unit: 'days', formula: 'DPO = Average AP ÷ ' + (purchKey === 'cogs' ? 'Cost of Sales' : 'Purchases') + ' × Days', inputs, rows, entity: 'gl', route: 'aging', unavailable: missing.length ? 'Calculation unavailable because required input data is missing: ' + missing.join('; ') : null, note: target == null ? 'Target DPO not configured (Settings).' : null }),
    };
  };

  /* ---------------- Payment proposal & priority queue ---------------- */
  E.priority = (D, P, cfg, asOf, ctx) => {
    const w = cfg.priority.weights;
    const cashBy = {};
    D.bankAccounts.forEach((b) => { if (b._availBase != null) cashBy[b.currency] = (cashBy[b.currency] || 0) + b._availBase; });
    const scheduledInv = new Set(D.payments.filter((p) => ['Scheduled', 'Approved', 'Submitted to Bank', 'Pending'].includes(p.executionStatus)).map((p) => p.invoiceNo));
    const openDisputes = new Set(D.disputes.filter((d) => !/resolv|closed/i.test(d.status || '')).map((d) => d.invoiceNo).filter(Boolean));
    const out = [];
    for (const inv of D.invoices.filter((i) => i._open && i._out > 0)) {
      const s = P.sup.get(inv.supplierId);
      const m = ctx.match.get(inv._key);
      const risk = ctx.risk.get(inv.supplierId);
      const blocks = [], warns = [];
      if (!/approved/i.test(inv.approvalStatus || '')) blocks.push('notApproved');
      if (m && ['DUPLICATE', 'EXCEPTION', 'QUANTITY VARIANCE', 'PRICE VARIANCE', 'MISSING GRN'].includes(m.status)) blocks.push('match:' + m.status);
      if (!s) blocks.push('supplierNotInMaster');
      else if (!/approved|active/i.test(s.approvedStatus || '')) blocks.push('supplierStatus:' + s.approvedStatus);
      if (openDisputes.has(inv.invoiceNo)) blocks.push('openDispute');
      if (scheduledInv.has(inv.invoiceNo)) blocks.push('alreadyScheduled');
      if (m && m.status === 'MISSING PO') warns.push('nonPO');
      if (m && m.status === 'TAX VARIANCE') warns.push('taxVariance');
      if (risk && ['HIGH', 'CRITICAL'].includes(risk.rating)) warns.push('supplierRisk:' + risk.rating);
      if (inv._fxMissing) warns.push('fxMissing');
      const comp = {};
      const d = inv._dpd;
      comp.urgency = d == null ? null : d >= 1 ? 100 : d === 0 ? 95 : d >= -3 ? 85 : d >= -7 ? 70 : d >= -14 ? 50 : d >= -30 ? 30 : 10;
      comp.criticality = s ? (s.critical ? 100 : s.strategic ? 70 : 30) : null;
      const t = inv._terms;
      let discount = null;
      if (t && t.discountPct && inv.invoiceDate) {
        const last = U.addDays(inv.invoiceDate, t.discountDays);
        if (last >= asOf) discount = { pct: t.discountPct, lastDate: last, value: U.round(inv._out * t.discountPct / 100, 2), valueBase: inv._outBase != null ? U.round(inv._outBase * t.discountPct / 100, 2) : null };
      }
      comp.discount = discount ? 100 : 0;
      const con = inv.contractId ? P.contract.get(inv.contractId) : null;
      const pen = con && con.latePenaltyPct ? con.latePenaltyPct : null;
      comp.penalty = pen && d != null && d >= -3 ? Math.min(100, pen * 50) : 0;
      comp.operational = cfg.priority.criticalCategories.includes(inv.category || (s && s.category)) ? 100 : 30;
      comp.risk = risk && risk.score != null ? 100 - risk.score : null;
      const cash = cashBy[inv.currency];
      comp.liquidity = cash && inv._outBase != null ? U.clamp(100 - ((inv._outBase / cash) * 100 - 1) * (100 / 19), 0, 100) : null;
      let num = 0, den = 0;
      Object.keys(w).forEach((k) => { if (comp[k] != null) { num += comp[k] * w[k]; den += w[k]; } });
      const score = den ? Math.round(num / den) : null;
      const horizon = d == null ? 'noDue' : d >= 1 ? 'overdue' : d === 0 ? 'today' : d >= -3 ? 'd3' : d >= -7 ? 'd7' : d >= -30 ? 'd30' : 'later';
      let rec;
      if (blocks.length) rec = 'HOLD';
      else if (discount) rec = 'PAY EARLY — DISCOUNT';
      else if (warns.some((x) => x.startsWith('supplierRisk'))) rec = 'PAY AFTER REVIEW';
      else if (['overdue', 'today', 'd3'].includes(horizon)) rec = 'PAY NOW';
      else if (horizon === 'noDue') rec = 'HOLD';
      else rec = 'SCHEDULE AT DUE DATE';
      if (horizon === 'noDue' && !blocks.includes('noDueDate')) blocks.push('noDueDate');
      out.push({ key: inv._key, inv, supplierId: inv.supplierId, score, comp, blocks, warns, discount, penaltyPct: pen, horizon, rec, amountBase: inv._outBase, contractual: !!pen });
    }
    out.sort((a, b) => (a.blocks.length ? 1 : 0) - (b.blocks.length ? 1 : 0) || (b.score || 0) - (a.score || 0));
    return out;
  };

  /* ---------------- Forecast items (payments & commitments) ---------------- */
  E.forecastItems = (D, P, cfg, asOf) => {
    const items = [];
    const fxLatest = (c) => P.fx.rate(c, asOf);
    const add = (o) => { const r = fxLatest(o.currency); o.rate = r ? r.rate : null; o.amountBase = r && o.amount != null ? o.amount * r.rate : null; items.push(o); };
    const scheduled = D.payments.filter((p) => ['Scheduled', 'Approved', 'Submitted to Bank'].includes(p.executionStatus) && p.paymentDate);
    const schedInv = new Set(scheduled.map((p) => p.invoiceNo));
    for (const p of scheduled) {
      const inv = P.inv.get(p.invoiceNo) || {};
      add({ type: 'scheduled', date: p.paymentDate < asOf ? asOf : p.paymentDate, currency: p.currency, amount: p.net, supplierId: p.supplierId, category: inv.category, department: inv.department, project: inv.project, bankAccountId: p.bankAccountId, method: p.method, rec: p, basis: 'SOURCE VALUE (scheduled payment)' });
    }
    for (const inv of D.invoices.filter((i) => i._open && i._out > 0 && !schedInv.has(i.invoiceNo))) {
      const approved = /approved/i.test(inv.approvalStatus || '');
      const date = !inv.dueDate ? null : inv.dueDate < asOf ? asOf : inv.dueDate;
      add({ type: approved ? 'approvedInvoice' : 'pendingInvoice', date, currency: inv.currency, amount: inv._out, supplierId: inv.supplierId, category: inv.category, department: inv.department, project: inv.project, bankAccountId: null, method: null, rec: inv, basis: inv.dueDate < asOf ? 'ASSUMPTION: overdue invoice assumed paid on as-of date' : 'Due date (SOURCE VALUE)' });
    }
    for (const po of D.pos.filter((p) => !['Closed', 'Cancelled', 'Draft'].includes(p.status))) {
      const invoiced = U.sum((P.invByPo.get(po.poNo) || []).filter((i) => !i._closed), (i) => i.total);
      const remaining = po._total != null ? po._total - invoiced : null;
      if (remaining == null || remaining <= 1) continue;
      const s = P.sup.get(po.supplierId);
      const t = E.parseTerms(s && s.paymentTerms);
      const base = po.requiredDate && po.requiredDate > asOf ? po.requiredDate : asOf;
      const date = t ? U.addDays(base, t.netDays) : null;
      add({ type: 'poCommitment', date, currency: po.currency, amount: remaining, supplierId: po.supplierId, category: po.category, department: po.department, project: po.project, bankAccountId: null, method: null, rec: po, basis: t ? 'ASSUMPTION: required delivery date (or as-of) + supplier payment terms' : 'Timing unavailable — supplier payment terms missing' });
    }
    return items;
  };

  /* ---------------- Cash forecast (per currency + consolidated) ---------------- */
  E.cashForecast = (D, P, cfg, asOf, items, opts = {}) => {
    const days = opts.days || 91;
    const end = U.addDays(asOf, days - 1);
    const ccys = U.uniq([...D.bankAccounts.map((b) => b.currency), ...items.map((i) => i.currency)]).filter(Boolean);
    const collMul = opts.collectionsMul != null ? opts.collectionsMul : 1;
    const fxMul = opts.fxMul || {};
    const result = { asOf, days, currencies: {}, assumptions: ['Future flows translated at the latest available FX rate on/before the as-of date (ASSUMPTION).', 'Overdue approved invoices assumed paid on the as-of date (ASSUMPTION).', 'Withholding tax remittance assumed to occur with payment (ASSUMPTION).', 'Pending-approval invoices and open PO commitments are NOT in the projection; shown separately as potential outflows.'] };
    for (const c of ccys) {
      const accs = D.bankAccounts.filter((b) => b.currency === c);
      const opening = accs.length ? U.sum(accs, (b) => b.availableBalance) : null;
      const minCash = accs.length ? U.sum(accs, (b) => b.minCash) : null;
      const series = [];
      let bal = opening;
      const coll = D.collections.filter((x) => x.currency === c && x.date >= asOf && x.date <= end);
      const oth = D.otherOutflows.filter((x) => x.currency === c && x.date >= asOf && x.date <= end);
      const its = items.filter((x) => x.currency === c && x.date && x.date <= end);
      for (let i = 0; i < days; i++) {
        const dt = U.addDays(asOf, i);
        const inflow = U.sum(coll.filter((x) => x.date === dt), (x) => x.amount) * collMul;
        const sched = U.sum(its.filter((x) => x.type === 'scheduled' && x.date === dt), (x) => x.amount);
        const appr = U.sum(its.filter((x) => x.type === 'approvedInvoice' && x.date === dt), (x) => x.amount);
        const other = U.sum(oth.filter((x) => x.date === dt), (x) => x.amount);
        const potential = U.sum(its.filter((x) => (x.type === 'pendingInvoice' || x.type === 'poCommitment') && x.date === dt), (x) => x.amount);
        if (bal != null) bal = bal + inflow - sched - appr - other;
        series.push({ date: dt, inflow, scheduled: sched, approved: appr, other, potential, closing: bal });
      }
      const r = P.fx.rate(c, asOf);
      const rate = r ? r.rate * (fxMul[c] || 1) : null;
      const minPoint = series.reduce((m, x) => (x.closing != null && (m == null || x.closing < m.closing) ? x : m), null);
      result.currencies[c] = {
        currency: c, opening, minCash, series, rate, accounts: accs,
        totals: { inflow: U.sum(series, (x) => x.inflow), scheduled: U.sum(series, (x) => x.scheduled), approved: U.sum(series, (x) => x.approved), other: U.sum(series, (x) => x.other), potential: U.sum(series, (x) => x.potential) },
        min: minPoint, end: series[series.length - 1].closing,
        shortfallDays: series.filter((x) => x.closing != null && x.closing < 0).length,
        belowMinDays: minCash != null ? series.filter((x) => x.closing != null && x.closing < minCash).length : null,
        fundingReq: minPoint && minCash != null ? Math.max(0, minCash - minPoint.closing) : null,
        idle: minPoint && minCash != null ? Math.max(0, minPoint.closing - minCash) : null,
        noBank: !accs.length,
      };
    }
    // Consolidated in base currency
    const cons = [];
    const excluded = Object.values(result.currencies).filter((x) => x.rate == null || x.opening == null).map((x) => x.currency);
    for (let i = 0; i < days; i++) {
      let v = 0, inflow = 0, out = 0;
      for (const x of Object.values(result.currencies)) {
        if (excluded.includes(x.currency)) continue;
        const p = x.series[i];
        v += p.closing * x.rate; inflow += p.inflow * x.rate; out += (p.scheduled + p.approved + p.other) * x.rate;
      }
      cons.push({ date: U.addDays(asOf, i), closing: v, inflow, outflow: out });
    }
    result.consolidated = { series: cons, excluded, opening: cons.length ? cons[0].closing + cons[0].outflow - cons[0].inflow : null };
    const minCashBase = U.sum(Object.values(result.currencies).filter((x) => !excluded.includes(x.currency)), (x) => (x.minCash || 0) * x.rate);
    result.consolidated.minCash = minCashBase;
    const mp = cons.reduce((m, x) => (m == null || x.closing < m.closing ? x : m), null);
    result.consolidated.min = mp;
    result.consolidated.fundingReq = mp ? Math.max(0, minCashBase - mp.closing) : null;
    result.consolidated.idle = mp ? Math.max(0, mp.closing - minCashBase) : null;
    result.consolidated.end = cons.length ? cons[cons.length - 1].closing : null;
    // Weekly (13) & monthly roll-ups
    result.weekly = [];
    for (let w = 0; w < 13; w++) {
      const seg = cons.slice(w * 7, w * 7 + 7);
      if (!seg.length) break;
      result.weekly.push({ week: w + 1, from: seg[0].date, to: seg[seg.length - 1].date, inflow: U.sum(seg, (x) => x.inflow), outflow: U.sum(seg, (x) => x.outflow), closing: seg[seg.length - 1].closing });
    }
    return result;
  };

  /** Payment requirement by horizon and dimension (base currency). */
  E.paymentForecast = (items, asOf) => {
    const H = [['d7', 7], ['d30', 30], ['d60', 60], ['d90', 90], ['w13', 91], ['m12', 365]];
    const within = (it, n) => it.date && U.daysBetween(asOf, it.date) < n;
    const horizons = H.map(([id, n]) => {
      const rows = items.filter((it) => within(it, n));
      const conv = rows.filter((r) => r.amountBase != null);
      return { id, days: n, rows, total: U.sum(conv, (r) => r.amountBase), byType: Object.fromEntries(['scheduled', 'approvedInvoice', 'pendingInvoice', 'poCommitment'].map((t) => [t, U.sum(conv.filter((r) => r.type === t), (r) => r.amountBase)])), noFx: rows.length - conv.length };
    });
    const months = [];
    for (let m = 0; m < 12; m++) {
      const ms = U.addMonths(asOf, m).slice(0, 7);
      const rows = items.filter((it) => it.date && it.date.slice(0, 7) === ms && it.amountBase != null);
      months.push({ month: ms, total: U.sum(rows, (r) => r.amountBase), byType: Object.fromEntries(['scheduled', 'approvedInvoice', 'pendingInvoice', 'poCommitment'].map((t) => [t, U.sum(rows.filter((r) => r.type === t), (r) => r.amountBase)])) });
    }
    return { horizons, months, undated: items.filter((i) => !i.date) };
  };

  /* ---------------- Scenario engine — results are always labelled SCENARIO — NOT ACTUAL ---------------- */
  E.scenario = (D, P, cfg, asOf, baseItems, sc) => {
    const items = baseItems.map((x) => ({ ...x }));
    const affected = new Set();
    let delayedAmt = 0, newlyLate = [], movedEarlier = 0;
    for (const it of items) {
      const orig = it.date;
      if (sc.delayDays && (it.type === 'approvedInvoice' || it.type === 'scheduled') && it.date) {
        it.date = U.addDays(it.date, sc.delayDays);
        affected.add(it.supplierId); delayedAmt += it.amountBase || 0;
        const due = it.rec.dueDate || (P.inv.get(it.rec.invoiceNo) || {}).dueDate;
        if (due && orig <= due && it.date > due) newlyLate.push(it);
      }
      if (sc.termsDays && (it.type === 'approvedInvoice' || it.type === 'pendingInvoice' || it.type === 'poCommitment') && it.date && it.date > asOf) { it.date = U.addDays(it.date, sc.termsDays); affected.add(it.supplierId); }
      if (sc.spendPct && (it.type === 'poCommitment' || it.type === 'pendingInvoice')) { it.amount *= 1 + sc.spendPct / 100; it.amountBase = it.amountBase != null ? it.amountBase * (1 + sc.spendPct / 100) : null; }
      if (sc.immediateSupplier && it.supplierId === sc.immediateSupplier && it.date && it.date > asOf) { it.date = asOf; if (it.type !== 'scheduled') it.type = 'approvedInvoice'; movedEarlier += it.amountBase || 0; affected.add(it.supplierId); }
      if (sc.fxCcy && sc.fxPct && it.currency === sc.fxCcy && it.amountBase != null) it.amountBase *= 1 + sc.fxPct / 100;
    }
    const fxMul = sc.fxCcy && sc.fxPct ? { [sc.fxCcy]: 1 + sc.fxPct / 100 } : {};
    const base = E.cashForecast(D, P, cfg, asOf, baseItems);
    const scen = E.cashForecast(D, P, cfg, asOf, items, { collectionsMul: sc.collectionsPct ? 1 - sc.collectionsPct / 100 : 1, fxMul });
    const penalty = U.sum(newlyLate, (it) => {
      const con = it.rec.contractId ? P.contract.get(it.rec.contractId) : null;
      return con && con.latePenaltyPct ? (it.amountBase || 0) * con.latePenaltyPct / 100 : 0;
    });
    return {
      label: 'SCENARIO — NOT ACTUAL', base, scen,
      impact: {
        minCashDelta: scen.consolidated.min && base.consolidated.min ? scen.consolidated.min.closing - base.consolidated.min.closing : null,
        endCashDelta: scen.consolidated.end != null && base.consolidated.end != null ? scen.consolidated.end - base.consolidated.end : null,
        fundingReq: scen.consolidated.fundingReq, baseFundingReq: base.consolidated.fundingReq,
        suppliersAffected: affected.size, delayedAmount: delayedAmt, newlyLateCount: newlyLate.length, penaltyExposure: penalty, movedEarlier,
        wcDpoDeltaDays: sc.delayDays ? sc.delayDays : sc.termsDays ? sc.termsDays : 0,
      },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
