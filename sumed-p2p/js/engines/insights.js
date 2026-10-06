/* SUMED P2P — cost-reduction, working-capital, explainable insights, CFO summary, action center,
 * automated alerts, KPI library, and the engine orchestrator S.engine.run().
 * "AI" here = deterministic, explainable analytics rules. Every output carries evidence rows. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const E = (S.engine = S.engine || {});
  const SEV = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  /* ---------------- Cost reduction ---------------- */
  E.savings = (D, P, cfg, asOf, ctx) => {
    const ops = [];
    const add = (o) => ops.push(Object.assign({ id: 'SAV-' + ops.length }, o));
    // 1 Early-payment discounts still capturable
    const disc = ctx.priority.filter((x) => x.discount && !x.blocks.length);
    if (disc.length) add({ type: 'earlyDiscount', current: U.sum(disc, (x) => x.amountBase || 0), saving: U.sum(disc, (x) => x.discount.valueBase || 0), method: 'Σ outstanding × discount % for approved invoices whose discount window is still open', rows: disc.map((x) => x.inv), confidence: 'High', n: disc.length });
    // 2 Missed discounts (history)
    const missed = [];
    for (const p of D.payments.filter((x) => x._isPaid)) {
      const inv = P.inv.get(p.invoiceNo);
      if (!inv || !inv._terms || !inv._terms.discountPct || !inv.invoiceDate) continue;
      if (p.paymentDate > U.addDays(inv.invoiceDate, inv._terms.discountDays)) missed.push({ p, inv, lost: (p._grossBase || 0) * inv._terms.discountPct / 100 });
    }
    if (missed.length) add({ type: 'missedDiscount', current: U.sum(missed, (x) => x.p._grossBase || 0), saving: U.sum(missed, (x) => x.lost), method: 'Σ paid amount × discount % where payment date > invoice date + discount days (historical leakage)', rows: missed.map((x) => x.p), confidence: 'High', n: missed.length });
    // 3 Duplicate payment recovery
    const dps = ctx.dupPay.filter((d) => d.level !== 'POSSIBLE DUPLICATE');
    if (dps.length) add({ type: 'duplicateRecovery', current: U.sum(dps, (d) => d.amountBase || 0), saving: U.sum(dps, (d) => d.amountBase || 0), method: 'Σ amount of exact / high-risk duplicate payments (recoverable from supplier)', rows: dps.map((d) => D.payments.find((p) => p._key === d.b)), confidence: dps.some((d) => d.level === 'EXACT DUPLICATE') ? 'High' : 'Medium', n: dps.length });
    // 4 Price variance recovery
    const pv = [];
    for (const inv of D.invoices) {
      const m = ctx.match.get(inv._key);
      if (!m) continue;
      for (const l of m.lines.filter((x) => x.priceVarPct > cfg.matching.priceTolPct)) pv.push({ inv, line: l, excess: (l.invPrice - l.poPrice) * l.invQty * (inv._fx ? inv._fx.rate : NaN) });
    }
    const pvOk = pv.filter((x) => isFinite(x.excess));
    if (pvOk.length) add({ type: 'priceVariance', current: null, saving: U.sum(pvOk, (x) => x.excess), method: 'Σ (invoice unit price − PO unit price) × invoiced qty', rows: pvOk.map((x) => x.inv), confidence: 'High', n: pvOk.length });
    // 5 Best-price benchmark (same item from ≥ 2 suppliers, same currency, last 12 months)
    const from = U.addDays(asOf, -364);
    const lines = D.poLines.map((l) => ({ l, po: P.po.get(l.poNo) })).filter((x) => x.po && x.po.poDate >= from && x.l.unitPrice > 0);
    const byItem = U.groupBy(lines, (x) => x.l.itemCode + '|' + x.po.currency);
    let cons = 0; const consRows = []; const consDetail = [];
    for (const [k, arr] of byItem) {
      const sups = U.uniq(arr.map((x) => x.po.supplierId));
      if (sups.length < 2) continue;
      const min = Math.min(...arr.map((x) => x.l.unitPrice));
      const minSup = arr.find((x) => x.l.unitPrice === min).po.supplierId;
      const rate = (P.fx.rate(arr[0].po.currency, asOf) || {}).rate;
      if (!rate) continue;
      const ex = U.sum(arr, (x) => (x.l.unitPrice - min) * x.l.qty) * rate;
      if (ex > 0) { cons += ex; consRows.push(...arr.map((x) => x.l)); consDetail.push({ item: k.split('|')[0], suppliers: sups.length, min, minSup, excess: ex }); }
    }
    if (cons > 0) add({ type: 'consolidation', current: null, saving: cons, method: 'Σ qty × (unit price − lowest unit price paid for the same item & currency) over 12 months. Benchmark = internal best price; assumes the best-price supplier can serve the volume.', rows: consRows, confidence: 'Medium', n: consDetail.length, detail: consDetail });
    // 6 Unused PO commitments (release, not a saving)
    const stale = ctx.items.filter((x) => x.type === 'poCommitment' && x.rec.poDate && U.daysBetween(x.rec.poDate, asOf) > 180 && x.amountBase);
    if (stale.length) add({ type: 'unusedPO', current: U.sum(stale, (x) => x.amountBase), saving: null, release: U.sum(stale, (x) => x.amountBase), method: 'Σ open balance of POs older than 180 days — commitment release (cash / budget), NOT a P&L saving', rows: stale.map((x) => x.rec), confidence: 'Medium', n: stale.length });
    // 7 Late-payment penalties accruing
    const pen = ctx.priority.filter((x) => x.penaltyPct && x.inv._dpd > 0 && x.amountBase);
    if (pen.length) add({ type: 'latePenalty', current: U.sum(pen, (x) => x.amountBase), saving: U.sum(pen, (x) => x.amountBase * x.penaltyPct / 100 * Math.ceil(x.inv._dpd / 30)), method: 'Σ outstanding × contract late-penalty % × ⌈days overdue ÷ 30⌉ — ASSUMPTION: penalty % applies per 30 days overdue', rows: pen.map((x) => x.inv), confidence: 'Low', n: pen.length });
    // 8 Maverick spend — not quantified (no benchmark)
    if (ctx.spend.mav.length) add({ type: 'maverick', current: U.sum(ctx.spend.mav, (r) => r.amountBase), saving: null, method: 'Saving not quantified — requires an external or contract price benchmark. Shown as addressable spend only.', rows: ctx.spend.mav.map((r) => r.rec), confidence: 'Low', n: ctx.spend.mav.length });
    // 9 Competitive sourcing — POs above RFQ threshold with no RFQ
    const noRfq = D.pos.filter((p) => p._totalBase > 300000 && !p.rfqNo && p.poDate >= from);
    if (D.rfqs.length && noRfq.length) add({ type: 'competition', current: U.sum(noRfq, (p) => p._totalBase), saving: null, method: 'Saving not quantified. POs > 300,000 (illustrative threshold) without an RFQ — addressable for competitive sourcing.', rows: noRfq, confidence: 'Low', n: noRfq.length });
    return ops.sort((a, b) => (b.saving || 0) - (a.saving || 0));
  };

  /* ---------------- Working capital ---------------- */
  E.workingCapital = (D, P, cfg, asOf, ctx) => {
    const early = [];
    for (const x of ctx.aging.paidPairs) {
      const inv = x.inv;
      if (!inv.dueDate) continue;
      const days = U.daysBetween(x.p.paymentDate, inv.dueDate);
      const hasDisc = inv._terms && inv._terms.discountPct && x.p.paymentDate <= U.addDays(inv.invoiceDate, inv._terms.discountDays);
      if (days > 5 && !hasDisc) early.push({ p: x.p, days, cashDays: days * (x.p._netBase || 0) });
    }
    const coc = cfg.treasury && cfg.treasury.costOfCapitalPct;
    const cashDays = U.sum(early, (x) => x.cashDays);
    return {
      early, earlyAmount: U.sum(early, (x) => x.p._netBase || 0), avgEarlyDays: early.length ? U.round(U.sum(early, (x) => x.days) / early.length, 1) : null,
      financingValue: coc != null ? (cashDays * coc) / 100 / 365 : null,
      overdue: ctx.aging.overdue, overdueRows: ctx.aging.overdueRows,
      dpo: ctx.dpo, ar: D.collections.length ? 'Expected collections only (no AR ledger)' : null, inventory: null,
      ccc: null, cccReason: 'Calculation unavailable because required input data is missing: AR ledger (DSO) and inventory (DIO) not uploaded.',
    };
  };

  /* ---------------- Insights ---------------- */
  E.insights = (D, P, cfg, asOf, ctx) => {
    const L = [];
    const add = (o) => L.push(Object.assign({ id: 'INS-' + L.length }, o));
    const cur = cfg.baseCurrency;
    // CFO — concentration
    const top = ctx.spend.bySupplier[0];
    if (top && top.share >= cfg.concentration.singleSupplierPct) add({ area: 'cfo', key: 'concentration', params: { name: top.name, pct: U.round(top.share, 1) }, impact: top.amount, rows: top.rows.map((r) => r.rec), priority: 'HIGH', owner: 'Procurement Manager', rootCause: 'singleSourceDependency' });
    if (ctx.spend.conc.flags.find((f) => f.key === 'top5')) add({ area: 'cfo', key: 'top5', params: { pct: ctx.spend.conc.top5, th: cfg.concentration.top5Pct }, impact: null, rows: ctx.spend.bySupplier.slice(0, 5).flatMap((x) => x.rows.map((r) => r.rec)), priority: 'MEDIUM', owner: 'CFO', rootCause: 'supplierBaseNarrow' });
    // Treasury — liquidity
    for (const c of Object.values(ctx.cash.currencies)) {
      if (c.belowMinDays) add({ area: 'treasury', key: 'belowMin', params: { ccy: c.currency, days: c.belowMinDays, date: c.min && c.min.date, min: c.min && Math.round(c.min.closing) }, impact: c.fundingReq != null && c.rate ? c.fundingReq * c.rate : null, rows: c.accounts, priority: c.shortfallDays ? 'CRITICAL' : 'HIGH', owner: 'Treasury Manager', rootCause: 'outflowsExceedInflows' });
      if (c.idle && c.rate && c.idle * c.rate > 50000000) add({ area: 'treasury', key: 'idleCash', params: { ccy: c.currency, amount: Math.round(c.idle) }, impact: c.idle * c.rate, rows: c.accounts, priority: 'LOW', owner: 'Treasury Manager', rootCause: 'cashAboveRequirement' });
    }
    const large = ctx.items.filter((x) => x.amountBase >= cfg.alerts.largePayment && x.date && U.daysBetween(asOf, x.date) <= 14 && x.type !== 'poCommitment');
    if (large.length) add({ area: 'treasury', key: 'largeUpcoming', params: { n: large.length, days: 14 }, impact: U.sum(large, (x) => x.amountBase), rows: large.map((x) => x.rec), priority: 'MEDIUM', owner: 'Treasury Manager', rootCause: 'scheduledObligations' });
    // AP
    if (ctx.aging.overdue > 0) add({ area: 'ap', key: 'overdue', params: { pct: U.round((ctx.aging.overdue / ctx.aging.total) * 100, 1), n: ctx.aging.overdueRows.length }, impact: ctx.aging.overdue, rows: ctx.aging.overdueRows, priority: ctx.aging.overdue / ctx.aging.total > 0.2 ? 'HIGH' : 'MEDIUM', owner: 'AP Manager', rootCause: 'approvalOrExceptionDelay' });
    const pend = D.invoices.filter((i) => i._open && !/approved/i.test(i.approvalStatus || '') && i.receivedDate && U.daysBetween(i.receivedDate, asOf) > cfg.alerts.approvalDelayDays);
    if (pend.length) add({ area: 'ap', key: 'approvalBacklog', params: { n: pend.length, days: cfg.alerts.approvalDelayDays }, impact: U.sum(pend, (i) => i._outBase || 0), rows: pend, priority: 'MEDIUM', owner: 'AP Manager', rootCause: 'approvalBottleneck' });
    const exc = D.invoices.filter((i) => { const m = ctx.match.get(i._key); return m && !['MATCHED', 'PARTIALLY MATCHED'].includes(m.status) && !i._closed; });
    if (exc.length) add({ area: 'ap', key: 'matchExceptions', params: { n: exc.length, pct: U.round((exc.length / Math.max(1, D.invoices.length)) * 100, 1) }, impact: U.sum(exc, (i) => i._totalBase || 0), rows: exc, priority: 'HIGH', owner: 'AP Manager', rootCause: 'p2pComplianceGaps' });
    // Procurement
    if (ctx.spend.nonPO.length) add({ area: 'procurement', key: 'nonPO', params: { pct: U.round((U.sum(ctx.spend.nonPO, (r) => r.amountBase) / ctx.spend.total) * 100, 1) }, impact: U.sum(ctx.spend.nonPO, (r) => r.amountBase), rows: ctx.spend.nonPO.map((r) => r.rec), priority: 'MEDIUM', owner: 'Procurement Manager', rootCause: 'poBypass' });
    for (const c of ctx.contracts.list.filter((x) => x.alerts.includes('expiring'))) add({ area: 'procurement', key: 'contractExpiring', params: { id: c.c.contractId, name: (P.sup.get(c.c.supplierId) || {}).name || c.c.supplierId, days: c.remainingDays }, impact: c.c._valueBase, rows: [c.c], priority: c.remainingDays <= 30 ? 'HIGH' : 'MEDIUM', owner: 'Procurement Manager', rootCause: 'renewalNotStarted' });
    // Supplier
    const hr = Array.from(ctx.risk.entries()).filter(([, r]) => ['HIGH', 'CRITICAL'].includes(r.rating)).sort((a, b) => b[1].score - a[1].score);
    for (const [sid, r] of hr.slice(0, 5)) add({ area: 'supplier', key: 'supplierRisk', params: { name: (P.sup.get(sid) || {}).name || sid, score: r.score, rating: r.rating, drivers: r.drivers.slice(0, 4).map((d) => d.key) }, impact: (ctx.aging.bySup.find((x) => x.supplierId === sid) || {}).total || null, rows: r.drivers.flatMap((d) => d.rows).concat([P.sup.get(sid)]), priority: r.rating, owner: 'Procurement Manager', rootCause: r.drivers[0] ? r.drivers[0].key : null, supplierId: sid });
    // Audit / controls
    const fails = ctx.controls.tests.filter((t) => t.status === 'FAIL');
    if (fails.length) add({ area: 'audit', key: 'controlFails', params: { n: fails.length, ids: fails.slice(0, 6).map((t) => t.id).join(', ') }, impact: null, rows: fails.flatMap((t) => t.exceptions).slice(0, 200), priority: 'HIGH', owner: 'Internal Auditor', rootCause: 'controlDesignOrOperation' });
    if (ctx.sod.tx.length) add({ area: 'audit', key: 'sod', params: { n: ctx.sod.tx.length, users: U.uniq(ctx.sod.tx.map((x) => x.user)).length }, impact: null, rows: ctx.sod.tx.map((x) => x.rec), priority: 'CRITICAL', owner: 'Internal Auditor', rootCause: 'sodNotEnforced' });
    // Fraud
    const crit = ctx.alerts.list.filter((a) => a.severity === 'CRITICAL');
    if (crit.length) add({ area: 'fraud', key: 'criticalAlerts', params: { n: crit.length, rules: U.uniq(crit.map((a) => a.rule)).slice(0, 4).join(', ') }, impact: U.sum(crit, (a) => a.amountBase || 0), rows: crit.flatMap((a) => a.rows), priority: 'CRITICAL', owner: 'Internal Auditor', rootCause: 'preventiveControlGap' });
    // Cost
    for (const s of ctx.savings.filter((x) => x.saving > 0).slice(0, 3)) add({ area: 'cost', key: 'saving_' + s.type, params: { n: s.n }, impact: s.saving, rows: s.rows, priority: s.confidence === 'High' ? 'HIGH' : 'MEDIUM', owner: s.type === 'earlyDiscount' || s.type === 'missedDiscount' ? 'Treasury Manager' : 'Procurement Manager', rootCause: s.type, calc: s.method, confidence: s.confidence });
    L.forEach((x) => { x.evidence = E.sourceSummary(x.rows || []); x.completeness = (x.rows || []).length ? (x.rows.every((r) => r && r._src) ? 'High' : 'Medium') : 'Low'; x.cur = cur; });
    return L.sort((a, b) => SEV[b.priority] - SEV[a.priority] || (b.impact || 0) - (a.impact || 0));
  };

  /* ---------------- Action center ---------------- */
  E.actions = (D, P, cfg, asOf, ctx) => {
    const A = [];
    const add = (bucket, o) => A.push(Object.assign({ id: 'ACT-' + A.length, bucket }, o));
    const name = (sid) => (P.sup.get(sid) || {}).name || sid;
    const critDue = ctx.priority.filter((x) => !x.blocks.length && ['overdue', 'today'].includes(x.horizon) && (P.sup.get(x.supplierId) || {}).critical);
    for (const [sid, qs] of U.groupBy(critDue, 'supplierId')) add('today', { key: 'criticalDue', params: { n: qs.length, inv: qs.map((q) => q.inv.invoiceNo).slice(0, 3).join(', '), name: name(sid), dpd: Math.max(...qs.map((q) => q.inv._dpd)) }, impact: U.sum(qs, (q) => q.amountBase || 0), owner: 'Treasury Manager', due: asOf, rec: 'payOrSchedule', rows: qs.map((q) => q.inv) });
    for (const a of ctx.alerts.list.filter((x) => x.severity === 'CRITICAL' && ['duplicatePayment', 'duplicateInvoice', 'paymentAfterBankChange', 'beneficiaryMismatch', 'sharedBankAccount', 'inactiveSupplierPaid'].includes(x.rule)).slice(0, 8)) add('today', { key: 'alert_' + a.rule, params: { txn: a.txn, name: name(a.supplierId) }, impact: a.amountBase, owner: 'Internal Auditor', due: asOf, rec: a.action, rows: a.rows, alertId: a.id });
    for (const c of Object.values(ctx.cash.currencies).filter((x) => x.belowMinDays && x.min)) add(U.daysBetween(asOf, c.min.date) <= 7 ? 'today' : 'week', { key: 'liquidityGap', params: { ccy: c.currency, date: c.min.date }, impact: c.fundingReq != null && c.rate ? c.fundingReq * c.rate : null, owner: 'Treasury Manager', due: c.min.date, rec: 'arrangeFunding', rows: c.accounts });
    for (const [sid, r] of ctx.risk) {
      if (!['HIGH', 'CRITICAL'].includes(r.rating)) continue;
      const up = ctx.items.filter((x) => x.supplierId === sid && x.date && U.daysBetween(asOf, x.date) <= 7 && x.type !== 'poCommitment');
      if (up.length) add('today', { key: 'riskyPayment', params: { name: name(sid), score: r.score, n: up.length }, impact: U.sum(up, (x) => x.amountBase || 0), owner: 'Compliance Officer', due: up.map((x) => x.date).sort()[0], rec: 'reviewBeforePay', rows: up.map((x) => x.rec) });
    }
    const blocked = ctx.priority.filter((x) => x.blocks.some((b) => b === 'notApproved') && x.inv._dpd != null && x.inv._dpd >= -7);
    if (blocked.length) add('week', { key: 'approvalBottleneck', params: { n: blocked.length }, impact: U.sum(blocked, (x) => x.amountBase || 0), owner: 'AP Manager', due: U.addDays(asOf, 2), rec: 'expediteApproval', rows: blocked.map((x) => x.inv) });
    for (const c of ctx.contracts.list.filter((x) => x.alerts.includes('expiring'))) add(c.remainingDays <= 7 ? 'week' : 'month', { key: 'contractExpiring', params: { id: c.c.contractId, name: name(c.c.supplierId), days: c.remainingDays }, impact: c.c._valueBase, owner: 'Procurement Manager', due: c.c.endDate, rec: 'renewOrRetender', rows: [c.c] });
    for (const s of D.suppliers.filter((x) => /approved/i.test(x.approvedStatus || ''))) {
      const dc = ctx.docs.get(s.supplierId);
      const ap = ctx.aging.bySup.find((x) => x.supplierId === s.supplierId);
      if (dc && (dc.expired.length || dc.missing.length) && ap) add('week', { key: 'docsMissing', params: { name: s.name, docs: dc.expired.concat(dc.missing).slice(0, 4).join(', ') }, impact: ap.total, owner: 'Compliance Officer', due: U.addDays(asOf, 5), rec: 'obtainDocuments', rows: [s] });
    }
    for (const c of D.bankChanges.filter((x) => x.verified === false)) add('today', { key: 'bankUnverified', params: { name: name(c.supplierId), date: c.changeDate }, impact: null, owner: 'Treasury Manager', due: asOf, rec: 'callbackVerify', rows: [c] });
    for (const t of ctx.controls.tests.filter((x) => x.status === 'FAIL')) add('month', { key: 'controlFail', params: { id: t.id, n: t.count }, impact: null, owner: 'Internal Auditor', due: U.addDays(asOf, 30), rec: 'remediateControl', rows: t.exceptions.slice(0, 50), testId: t.id });
    A.forEach((a) => (a.evidence = E.sourceSummary(a.rows)));
    return A;
  };

  /* ---------------- Automated alerts (configurable) ---------------- */
  E.autoAlerts = (D, P, cfg, asOf, ctx) => {
    const c = cfg.alerts;
    const on = c.enabled;
    const res = [];
    const add = (type, rows, params) => { if (on[type] !== false) res.push({ type, count: rows.length, rows, params: params || {} }); };
    add('invoiceDue', D.invoices.filter((i) => i._open && i._dpd != null && i._dpd <= 0 && i._dpd >= -c.invoiceDueDays), { days: c.invoiceDueDays });
    add('invoiceOverdue', D.invoices.filter((i) => i._open && i._dpd > 0));
    add('largePayment', ctx.items.filter((x) => x.amountBase >= c.largePayment && x.type !== 'poCommitment').map((x) => x.rec), { amount: c.largePayment });
    add('riskIncrease', D.suppliers.filter((s) => { const r = ctx.risk.get(s.supplierId); return r && ['HIGH', 'CRITICAL'].includes(r.rating); }));
    add('bankChange', D.bankChanges.filter((x) => x.changeDate && U.daysBetween(x.changeDate, asOf) <= cfg.risk.bankChangeLookbackDays));
    add('contractExpiry', ctx.contracts.list.filter((x) => x.remainingDays != null && x.remainingDays >= 0 && x.remainingDays <= c.contractExpiryDays).map((x) => x.c), { days: c.contractExpiryDays });
    add('paymentAnomaly', ctx.alerts.list.filter((a) => a.category === 'PAYMENT').flatMap((a) => a.rows.slice(0, 1)));
    add('duplicateInvoice', ctx.dupInv.list.map((d) => D.invoices.find((i) => i._key === d.b)));
    add('duplicatePayment', ctx.dupPay.map((d) => D.payments.find((p) => p._key === d.b)));
    add('cashShortfall', Object.values(ctx.cash.currencies).filter((x) => x.belowMinDays).flatMap((x) => x.accounts));
    add('approvalDelay', D.invoices.filter((i) => i._open && !/approved/i.test(i.approvalStatus || '') && i.receivedDate && U.daysBetween(i.receivedDate, asOf) > c.approvalDelayDays), { days: c.approvalDelayDays });
    add('docExpiry', D.supplierDocs.filter((d) => d.expiryDate && U.daysBetween(asOf, d.expiryDate) <= c.docExpiryDays), { days: c.docExpiryDays });
    add('poNearLimit', D.pos.filter((p) => { const inv = U.sum((P.invByPo.get(p.poNo) || []).filter((i) => !i._closed), (i) => i.total); return p._total && inv / p._total * 100 >= c.poNearLimitPct; }), { pct: c.poNearLimitPct });
    return res;
  };

  /* ---------------- Orchestrator ---------------- */
  E.run = () => {
    const t0 = Date.now();
    const st = S.state;
    const D = st.data, cfg = st.config;
    const asOf = cfg.asOfDate || U.todayISO();
    const P = E.prepare(D, cfg, asOf);
    const ctx = { asOf, cfg, P };
    ctx.dupInv = E.duplicateInvoices(D, P, cfg);
    ctx.dupPay = E.duplicatePayments(D, P, cfg, ctx.dupInv);
    ctx.match = E.threeWay(D, P, cfg, ctx.dupInv);
    ctx.aging = E.aging(D, P, cfg, asOf);
    ctx.dpo = E.dpo(D, P, cfg);
    ctx.spend = E.spend(D, P, cfg, asOf);
    ctx.contracts = E.contracts(D, P, cfg, asOf, ctx.spend);
    ctx.docs = E.supplierDocs(D, P, cfg, asOf);
    ctx.onboarding = E.onboarding(D, P, cfg, ctx.docs);
    ctx.perf = E.performance(D, P, cfg, ctx);
    ctx.alerts = E.anomalies(D, P, cfg, asOf, ctx);
    ctx.alertsBySup = ctx.alerts.bySup;
    ctx.risk = E.supplierRisk(D, P, cfg, asOf, ctx);
    ctx.priority = E.priority(D, P, cfg, asOf, ctx);
    ctx.items = E.forecastItems(D, P, cfg, asOf);
    ctx.cash = E.cashForecast(D, P, cfg, asOf, ctx.items);
    ctx.payForecast = E.paymentForecast(ctx.items, asOf);
    ctx.bank = E.bankRecon(D, P, cfg, asOf);
    ctx.recon = E.registerRecon(D, P, cfg, asOf, ctx);
    ctx.sod = E.sod(D, P, cfg, st.roles);
    ctx.authority = E.authorityCheck(D, P, cfg);
    ctx.controls = E.controlTests(D, P, cfg, asOf, ctx);
    ctx.dq = E.dataQuality(D, P, cfg, asOf, ctx);
    ctx.savings = E.savings(D, P, cfg, asOf, ctx);
    ctx.wc = E.workingCapital(D, P, cfg, asOf, ctx);
    ctx.insights = E.insights(D, P, cfg, asOf, ctx);
    ctx.actions = E.actions(D, P, cfg, asOf, ctx);
    ctx.autoAlerts = E.autoAlerts(D, P, cfg, asOf, ctx);
    // red flags = anomaly alerts + data-quality + control failures + liquidity, unified
    ctx.redFlags = ctx.alerts.list.slice();
    ctx.dq.issues.filter((i) => SEV[i.severity] >= 3).forEach((i) => ctx.redFlags.push({ id: i.id, category: 'DATA QUALITY', rule: 'dq_' + i.check.split(':')[0], params: { n: i.count, field: i.check.split(':')[1] || '' }, severity: i.severity, rows: i.rows.slice(0, 100), txn: i.count + ' record(s)', action: 'fixData', amountBase: null }));
    for (const c of Object.values(ctx.cash.currencies).filter((x) => x.belowMinDays)) ctx.redFlags.push({ id: 'LQ-' + c.currency, category: 'LIQUIDITY', rule: 'liquidityGap', params: { ccy: c.currency, days: c.belowMinDays, date: c.min && c.min.date }, severity: c.shortfallDays ? 'CRITICAL' : 'HIGH', rows: c.accounts, txn: c.currency, action: 'arrangeFunding', amountBase: c.fundingReq != null && c.rate ? c.fundingReq * c.rate : null });
    ctx.controls.tests.filter((t) => t.status === 'FAIL').forEach((t) => ctx.redFlags.push({ id: 'CF-' + t.id, category: 'CONTROL', rule: 'controlFail', params: { id: t.id, n: t.count }, severity: 'HIGH', rows: t.exceptions.slice(0, 100), txn: t.id, action: 'remediateControl', amountBase: null }));
    ctx.redFlags.sort((a, b) => SEV[b.severity] - SEV[a.severity] || (b.amountBase || 0) - (a.amountBase || 0));
    // record index for drill-down
    ctx.index = new Map();
    Object.values(D).forEach((arr) => arr.forEach((r) => ctx.index.set(r._key, r)));
    ctx.kpis = E.kpis(D, P, cfg, asOf, ctx);
    ctx.ms = Date.now() - t0;
    S.R = ctx;
    return ctx;
  };

  /* ---------------- KPI library ---------------- */
  E.kpis = (D, P, cfg, asOf, ctx) => {
    const K = {};
    const L = (id, o) => (K[id] = Object.assign({ id }, E.lineage(o)));
    Object.entries(ctx.aging.lineage).forEach(([k, v]) => (K[k] = Object.assign({ id: k }, v)));
    Object.entries(ctx.spend.lineage).forEach(([k, v]) => (K[k] = Object.assign({ id: k }, v)));
    K.dpo = Object.assign({ id: 'dpo' }, ctx.dpo.lineage);
    const act = D.suppliers.filter((s) => /approved|active/i.test(s.approvedStatus || ''));
    L('supplierCount', { label: 'Suppliers in master', value: D.suppliers.length, unit: 'count', formula: 'COUNT(supplier master rows)', rows: D.suppliers, route: 'suppliers', kind: D.suppliers.length ? 'DERIVED' : 'DERIVED' });
    L('activeSuppliers', { label: 'Active / approved suppliers', value: act.length, unit: 'count', formula: 'COUNT WHERE status ∈ {Approved, Active}', rows: act, route: 'suppliers' });
    const crit = D.suppliers.filter((s) => s.critical);
    L('criticalSuppliers', { label: 'Critical suppliers', value: crit.length, unit: 'count', formula: 'COUNT WHERE Critical flag = Yes (SOURCE VALUE)', rows: crit, route: 'suppliers' });
    const hr = D.suppliers.filter((s) => { const r = ctx.risk.get(s.supplierId); return r && ['HIGH', 'CRITICAL'].includes(r.rating); });
    L('highRiskSuppliers', { label: 'High / critical-risk suppliers', value: hr.length, unit: 'count', formula: 'COUNT WHERE risk rating ∈ {HIGH, CRITICAL} (explainable risk model)', rows: hr, route: 'risk' });
    const due7 = ctx.priority.filter((x) => x.inv._dpd != null && x.inv._dpd >= -7);
    L('paymentsDue', { label: 'Payments due ≤ 7 days (incl. overdue)', value: U.round(U.sum(due7, (x) => x.amountBase || 0), 2), unit: cfg.baseCurrency, formula: 'SUM(outstanding base) WHERE due date ≤ as-of + 7', rows: due7.map((x) => x.inv), route: 'payments' });
    const today = ctx.priority.filter((x) => x.inv._dpd != null && x.inv._dpd >= 0);
    L('payToday', { label: 'Due today or overdue', value: U.round(U.sum(today, (x) => x.amountBase || 0), 2), unit: cfg.baseCurrency, formula: 'SUM(outstanding base) WHERE due date ≤ as-of', rows: today.map((x) => x.inv), route: 'payments' });
    const sched = D.payments.filter((p) => ['Scheduled', 'Approved', 'Submitted to Bank'].includes(p.executionStatus));
    L('paymentsScheduled', { label: 'Payments scheduled (not executed)', value: U.round(U.sum(sched, (p) => p._netBase || 0), 2), unit: cfg.baseCurrency, formula: 'SUM(net × FX) WHERE status ∈ {Approved, Scheduled, Submitted to Bank}', rows: sched, route: 'payments' });
    const from30 = U.addDays(asOf, -30);
    const exec30 = D.payments.filter((p) => p._isPaid && p.paymentDate >= from30);
    L('paymentsExecuted', { label: 'Payments executed (30 days)', value: U.round(U.sum(exec30, (p) => p._netBase || 0), 2), unit: cfg.baseCurrency, formula: 'SUM(net × FX) WHERE executed/reconciled AND payment date ≥ as-of − 30', rows: exec30, route: 'payments' });
    const totPaid = D.payments.filter((p) => p._isPaid);
    L('paymentRegisterTotal', { label: 'Payment register total (executed/reconciled)', value: U.round(U.sum(totPaid, (p) => p._netBase || 0), 2), unit: cfg.baseCurrency, formula: 'SUM(net × FX at payment date)', rows: totPaid, route: 'payments' });
    const w13 = ctx.payForecast.horizons.find((h) => h.id === 'w13');
    L('cashRequired', { label: 'Cash required — 13 weeks', value: w13 ? U.round(w13.byType.scheduled + w13.byType.approvedInvoice, 2) : null, unit: cfg.baseCurrency, formula: 'Σ scheduled payments + approved unpaid invoices due within 91 days (at latest FX)', rows: w13 ? w13.rows.filter((r) => r.type === 'scheduled' || r.type === 'approvedInvoice').map((r) => r.rec) : [], route: 'treasury', assumptions: ['Overdue approved invoices assumed paid on as-of date'] });
    const exc = D.invoices.filter((i) => { const m = ctx.match.get(i._key); return m && !['MATCHED', 'PARTIALLY MATCHED'].includes(m.status) && !i._closed; });
    L('invoiceExceptions', { label: 'Invoice exceptions (3-way match)', value: exc.length, unit: 'count', formula: 'COUNT WHERE match status ∉ {MATCHED, PARTIALLY MATCHED}', rows: exc, route: 'matching' });
    const dupRows = ctx.dupInv.list.map((d) => D.invoices.find((i) => i._key === d.b));
    L('duplicateRisk', { label: 'Duplicate invoice risk (exposure)', value: U.round(U.sum(ctx.dupInv.list, (d) => (d.amountBase || 0)), 2), unit: cfg.baseCurrency, formula: 'Σ amount of the later invoice in each flagged pair', inputs: [{ label: 'Pairs flagged', value: ctx.dupInv.list.length }], rows: dupRows, route: 'duplicates' });
    const fr = ctx.alerts.list.filter((a) => ['HIGH', 'CRITICAL'].includes(a.severity));
    L('fraudAlerts', { label: 'High / critical fraud & anomaly alerts', value: fr.length, unit: 'count', formula: 'COUNT(alerts) WHERE severity ∈ {HIGH, CRITICAL}', rows: fr.flatMap((a) => a.rows), route: 'fraud' });
    const conExp = ctx.contracts.list.filter((c) => c.status !== 'Expired');
    L('contractExposure', { label: 'Remaining contract value (active)', value: U.round(U.sum(conExp, (c) => { const r = P.fx.rate(c.c.currency, asOf); return r && c.remainingValue != null ? Math.max(0, c.remainingValue) * r.rate : 0; }), 2), unit: cfg.baseCurrency, formula: 'Σ (contract value − invoiced against contract) × latest FX', rows: conExp.map((c) => c.c), route: 'contracts' });
    // processing & cycle time
    const proc = D.invoices.filter((i) => i.approvedDate && (i.receivedDate || i.invoiceDate));
    L('avgProcessing', { label: 'Average invoice processing time', value: proc.length ? U.round(U.sum(proc, (i) => U.daysBetween(i.receivedDate || i.invoiceDate, i.approvedDate)) / proc.length, 1) : null, unit: 'days', formula: 'AVG(approved date − received date)', rows: proc, route: 'invoices' });
    const cyc = ctx.aging.paidPairs;
    L('paymentCycle', { label: 'Average payment cycle (invoice → payment)', value: cyc.length ? U.round(U.sum(cyc, (x) => x.days) / cyc.length, 1) : null, unit: 'days', formula: 'AVG(payment date − invoice date)', rows: cyc.map((x) => x.p), route: 'payments' });
    const invs = D.invoices.filter((i) => !i._closed && i.total > 0);
    const poInv = invs.filter((i) => i.poNo);
    L('poCompliance', { label: 'PO compliance', value: invs.length ? U.round((poInv.length / invs.length) * 100, 1) : null, unit: '%', formula: 'invoices with PO ÷ all invoices', inputs: [{ label: 'With PO', value: poInv.length }, { label: 'All', value: invs.length }], rows: invs, route: 'invoices' });
    const m3 = poInv.filter((i) => (ctx.match.get(i._key) || {}).status === 'MATCHED');
    L('threeWayRate', { label: 'Three-way match rate', value: poInv.length ? U.round((m3.length / poInv.length) * 100, 1) : null, unit: '%', formula: 'MATCHED ÷ PO-backed invoices', inputs: [{ label: 'Matched', value: m3.length }, { label: 'PO invoices', value: poInv.length }], rows: m3, route: 'matching' });
    const mAny = invs.filter((i) => ['MATCHED', 'PARTIALLY MATCHED'].includes((ctx.match.get(i._key) || {}).status));
    L('invoiceMatchRate', { label: 'Invoice match rate (incl. header-only)', value: invs.length ? U.round((mAny.length / invs.length) * 100, 1) : null, unit: '%', formula: '(MATCHED + PARTIALLY MATCHED) ÷ invoices', rows: mAny, route: 'matching' });
    L('exceptionRate', { label: 'Exception rate', value: invs.length ? U.round((exc.length / invs.length) * 100, 1) : null, unit: '%', formula: 'exceptions ÷ invoices', rows: exc, route: 'matching' });
    L('duplicateRate', { label: 'Duplicate rate', value: invs.length ? U.round((U.uniq(ctx.dupInv.list.map((d) => d.b)).length / invs.length) * 100, 2) : null, unit: '%', formula: 'invoices flagged as later member of a duplicate pair ÷ invoices', rows: dupRows, route: 'duplicates' });
    const late = ctx.aging.paidPairs.filter((x) => x.late != null && x.late > 0);
    L('latePaymentRate', { label: 'Late payment rate', value: ctx.aging.paidPairs.filter((x) => x.late != null).length ? U.round((late.length / ctx.aging.paidPairs.filter((x) => x.late != null).length) * 100, 1) : null, unit: '%', formula: 'payments after due date ÷ payments with due date', rows: late.map((x) => x.p), route: 'payments' });
    const cc = ctx.contracts.list;
    const compliant = invs.filter((i) => i.contractId && !cc.some((c) => c.outside.includes(i)));
    const withC = invs.filter((i) => i.contractId);
    L('contractCompliance', { label: 'Contract compliance', value: withC.length ? U.round((compliant.length / withC.length) * 100, 1) : null, unit: '%', formula: 'contract invoices within contract window ÷ contract invoices', rows: withC, route: 'contracts' });
    const scores = Array.from(ctx.risk.values()).map((r) => r.score);
    L('avgRiskScore', { label: 'Average supplier risk score', value: scores.length ? U.round(U.sum(scores) / scores.length, 1) : null, unit: '/100', formula: 'AVG(supplier risk score)', rows: D.suppliers, route: 'risk' });
    L('discountCapture', { label: 'Discount capture rate', value: (() => { const elig = ctx.aging.paidPairs.filter((x) => x.inv._terms && x.inv._terms.discountPct); if (!elig.length) return null; const cap = elig.filter((x) => x.p.paymentDate <= U.addDays(x.inv.invoiceDate, x.inv._terms.discountDays)); return U.round((cap.length / elig.length) * 100, 1); })(), unit: '%', formula: 'payments within discount window ÷ payments on discount terms', rows: ctx.aging.paidPairs.filter((x) => x.inv._terms && x.inv._terms.discountPct).map((x) => x.p), route: 'workingcapital' });
    const sav = ctx.savings.filter((s) => s.saving > 0);
    L('potentialSavings', { label: 'Potential savings (quantified)', value: U.round(U.sum(sav, (s) => s.saving), 2), unit: cfg.baseCurrency, formula: 'Σ quantified opportunities (see Cost Reduction for method & confidence)', inputs: sav.map((s) => ({ label: s.type, value: Math.round(s.saving) })), rows: sav.flatMap((s) => s.rows).slice(0, 2000), route: 'savings' });
    const cf = ctx.controls.tests.filter((t) => t.status === 'FAIL');
    L('controlFailures', { label: 'Control failures', value: cf.length, unit: 'count', formula: 'COUNT(control tests with status FAIL)', inputs: cf.map((t) => ({ label: t.id, value: t.count })), rows: cf.flatMap((t) => t.exceptions).slice(0, 2000), route: 'controls' });
    const w = ctx.payForecast.horizons.find((h) => h.id === 'd30');
    L('paymentForecast30', { label: 'Payment forecast — 30 days (all types)', value: w ? U.round(w.total, 2) : null, unit: cfg.baseCurrency, formula: 'Σ scheduled + approved + pending invoices + PO commitments dated within 30 days', rows: w ? w.rows.map((r) => r.rec) : [], route: 'treasury' });
    return K;
  };
})(typeof window !== 'undefined' ? window : globalThis);
