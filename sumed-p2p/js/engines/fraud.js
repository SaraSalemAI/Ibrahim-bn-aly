/* SUMED P2P — fraud & anomaly detection. Every alert = rule + params (reason) + evidence rows + amount + action.
 * Rules only fire on data that is present; rules whose inputs are absent are reported as NOT TESTED. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const E = (S.engine = S.engine || {});

  E.anomalies = (D, P, cfg, asOf, ctx) => {
    const F = cfg.fraud;
    const alerts = [];
    const notTested = [];
    const add = (o) => {
      const rows = (o.rows || []).filter(Boolean);
      alerts.push(Object.assign({ id: 'AL-' + U.hash(o.rule + '|' + rows.map((r) => r._key).join(',') + '|' + JSON.stringify(o.params || {})).slice(0, 10), status: 'Open' }, o, { rows }));
    };
    const supName = (sid) => (P.sup.get(sid) || {}).name || sid || '—';
    const thresholds = cfg.approvalMatrix.tiers.map((t) => t.max).filter((x) => x != null);
    const paid = D.payments.filter((p) => p._isPaid);
    const allPays = D.payments.filter((p) => !['Rejected', 'Failed'].includes(p.executionStatus));

    /* Duplicates (from matching engine) */
    for (const d of ctx.dupInv.list) {
      const a = D.invoices.find((x) => x._key === d.a), b = D.invoices.find((x) => x._key === d.b);
      add({ category: 'FRAUD', rule: 'duplicateInvoice', severity: d.level === 'EXACT DUPLICATE' ? (d.paidBoth ? 'CRITICAL' : 'HIGH') : d.level === 'HIGH-RISK DUPLICATE' ? (d.paidBoth ? 'CRITICAL' : 'HIGH') : 'MEDIUM', params: { level: d.level, a: d.aNo, b: d.bNo, reasons: d.reasons.join(', ') }, supplierId: d.supplierId, amount: d.amount, currency: d.currency, amountBase: d.amountBase, txn: d.bNo, rows: [a, b], action: d.paidBoth ? 'recoverDuplicate' : 'holdDuplicate' });
    }
    for (const d of ctx.dupPay) {
      const a = D.payments.find((x) => x._key === d.a), b = D.payments.find((x) => x._key === d.b);
      add({ category: 'PAYMENT', rule: 'duplicatePayment', severity: d.level === 'POSSIBLE DUPLICATE' ? 'MEDIUM' : 'CRITICAL', params: { level: d.level, a: d.aId, b: d.bId, reasons: d.reasons.join(', ') }, supplierId: d.supplierId, amount: d.amount, currency: d.currency, amountBase: d.amountBase, txn: d.bId, rows: [a, b], action: 'recoverDuplicate' });
    }

    /* Round-number invoices */
    for (const i of D.invoices.filter((x) => !x._closed && x._totalBase != null && Math.abs(x._totalBase) >= F.roundAmountMin && x.total % F.roundAmountModulo === 0)) {
      add({ category: 'FRAUD', rule: 'roundAmount', severity: i.poNo ? 'LOW' : 'MEDIUM', params: { amount: i.total, ccy: i.currency, modulo: F.roundAmountModulo, nonPO: !i.poNo }, supplierId: i.supplierId, amount: i.total, currency: i.currency, amountBase: i._totalBase, txn: i.invoiceNo, rows: [i], action: 'verifySupport' });
    }

    /* Unusual amounts — robust z-score vs supplier history (≥ 6 invoices) */
    for (const [sid, arr] of U.groupBy(D.invoices.filter((x) => !x._closed && x._totalBase > 0), 'supplierId')) {
      if (arr.length < 6) continue;
      const v = arr.map((x) => x._totalBase).sort((a, b) => a - b);
      const med = v[Math.floor(v.length / 2)];
      const mad = v.map((x) => Math.abs(x - med)).sort((a, b) => a - b)[Math.floor(v.length / 2)] || 1;
      for (const i of arr) {
        const z = (0.6745 * (i._totalBase - med)) / mad;
        if (z > F.zScore * 2) add({ category: 'PAYMENT', rule: 'unusualAmount', severity: 'MEDIUM', params: { z: U.round(z, 1), median: Math.round(med), n: arr.length }, supplierId: sid, amount: i.total, currency: i.currency, amountBase: i._totalBase, txn: i.invoiceNo, rows: [i], action: 'verifySupport', calc: 'Robust z = 0.6745 × (x − median) ÷ MAD' });
      }
    }

    /* Weekend / holiday payments */
    const hol = new Map((cfg.holidays || []).concat(D.holidays || []).filter((h) => h.date).map((h) => [h.date, h.name]));
    for (const p of allPays.filter((x) => x.paymentDate)) {
      if (cfg.weekendDays.includes(U.dow(p.paymentDate))) add({ category: 'PAYMENT', rule: 'weekendPayment', severity: p.manual || p.urgent ? 'HIGH' : 'MEDIUM', params: { date: p.paymentDate, dow: U.dow(p.paymentDate), manual: !!p.manual }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p], action: 'confirmAuthorisation' });
      if (hol.has(p.paymentDate)) add({ category: 'PAYMENT', rule: 'holidayPayment', severity: 'MEDIUM', params: { date: p.paymentDate, name: hol.get(p.paymentDate) }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p], action: 'confirmAuthorisation' });
    }
    if (!hol.size) notTested.push({ rule: 'holidayPayment', reason: 'holidayCalendarNotConfigured' });

    /* Urgent / manual payments */
    for (const p of allPays.filter((x) => x.urgent || x.manual)) add({ category: 'CONTROL', rule: 'urgentManualPayment', severity: 'LOW', params: { urgent: !!p.urgent, manual: !!p.manual }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p], action: 'confirmAuthorisation' });

    /* Bank changes before payment */
    for (const c of D.bankChanges) {
      const after = allPays.filter((p) => p.supplierId === c.supplierId && p.paymentDate && c.changeDate && p.paymentDate >= c.changeDate && U.daysBetween(c.changeDate, p.paymentDate) <= F.bankChangePayWindowDays);
      for (const p of after) add({ category: 'BANK', rule: 'paymentAfterBankChange', severity: c.verified === false ? 'CRITICAL' : 'HIGH', params: { days: U.daysBetween(c.changeDate, p.paymentDate), verified: c.verified, changedBy: c.changedBy || 'Not Available' }, supplierId: c.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [c, p], action: 'callbackVerify' });
      if (c.changeDate && U.daysBetween(c.changeDate, asOf) <= cfg.risk.bankChangeLookbackDays && !after.length) add({ category: 'BANK', rule: 'recentBankChange', severity: c.verified === false ? 'HIGH' : 'LOW', params: { date: c.changeDate, verified: c.verified }, supplierId: c.supplierId, txn: c.supplierId, rows: [c], action: 'callbackVerify' });
    }
    if (!D.bankChanges.length) notTested.push({ rule: 'paymentAfterBankChange', reason: 'noBankChangeLog' });
    /* Payment beneficiary differs from supplier master IBAN */
    for (const p of allPays.filter((x) => x.beneficiaryIban)) {
      const s = P.sup.get(p.supplierId);
      if (!s || !s.iban) continue;
      const hist = (P.bankChgBySup.get(p.supplierId) || []).some((c) => U.normIban(c.oldIban) === U.normIban(p.beneficiaryIban) && p.paymentDate <= c.changeDate);
      if (U.normIban(s.iban) !== U.normIban(p.beneficiaryIban) && !hist) add({ category: 'BANK', rule: 'beneficiaryMismatch', severity: 'CRITICAL', params: { paid: U.maskAccount(p.beneficiaryIban), master: U.maskAccount(s.iban) }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p, s], action: 'callbackVerify' });
    }
    /* Supplier-master changes (audit) shortly before payment */
    const masterEdits = S.state.audit.filter((e) => e.entity === 'suppliers' && /update|bank/.test(e.action));
    for (const e of masterEdits) {
      const p = allPays.find((x) => x.supplierId === e.recordId && x.paymentDate >= e.ts.slice(0, 10));
      if (p) add({ category: 'SUPPLIER', rule: 'masterChangeBeforePayment', severity: 'HIGH', params: { field: e.field, by: e.userId, at: e.ts.slice(0, 10) }, supplierId: e.recordId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p], action: 'callbackVerify' });
    }

    /* Just-below-threshold & split invoices */
    const invOpen = D.invoices.filter((i) => !i._closed && i._totalBase > 0);
    for (const i of invOpen) {
      for (const t of thresholds) {
        if (i._totalBase < t && i._totalBase >= t * (1 - F.belowThresholdPct / 100)) add({ category: 'CONTROL', rule: 'belowThreshold', severity: 'MEDIUM', params: { threshold: t, pct: U.round(((t - i._totalBase) / t) * 100, 1) }, supplierId: i.supplierId, amount: i.total, currency: i.currency, amountBase: i._totalBase, txn: i.invoiceNo, rows: [i], action: 'reviewSplit' });
      }
    }
    for (const [sid, arr] of U.groupBy(invOpen.filter((i) => i.invoiceDate), 'supplierId')) {
      const s = arr.slice().sort((a, b) => (a.invoiceDate < b.invoiceDate ? -1 : 1));
      const used = new Set();
      for (let i = 0; i < s.length; i++) {
        if (used.has(i)) continue;
        const grp = [s[i]];
        for (let j = i + 1; j < s.length && U.daysBetween(s[i].invoiceDate, s[j].invoiceDate) <= F.splitWindowDays; j++) grp.push(s[j]);
        if (grp.length < 2) continue;
        const tot = U.sum(grp, (x) => x._totalBase);
        const t = thresholds.find((th) => grp.every((x) => x._totalBase < th) && tot >= th);
        if (t) { grp.forEach((x) => used.add(s.indexOf(x))); add({ category: 'FRAUD', rule: 'splitInvoices', severity: 'HIGH', params: { n: grp.length, days: F.splitWindowDays, total: Math.round(tot), threshold: t }, supplierId: sid, amount: tot, currency: cfg.baseCurrency, amountBase: tot, txn: grp.map((x) => x.invoiceNo).join(', '), rows: grp, action: 'reviewSplit', calc: `Σ ${grp.length} invoices = ${Math.round(tot).toLocaleString('en')} ≥ ${t.toLocaleString('en')} while each < threshold` }); }
      }
    }

    /* Dormant suppliers suddenly active; inactive/blocked receiving payments */
    for (const [sid, arr] of U.groupBy(D.invoices.filter((i) => i.invoiceDate), 'supplierId')) {
      const s = arr.slice().sort((a, b) => (a.invoiceDate < b.invoiceDate ? -1 : 1));
      for (let i = 1; i < s.length; i++) {
        const gap = U.daysBetween(s[i - 1].invoiceDate, s[i].invoiceDate);
        if (gap >= F.dormantDays && U.daysBetween(s[i].invoiceDate, asOf) <= 90) add({ category: 'SUPPLIER', rule: 'dormantReactivated', severity: s[i]._totalBase > 500000 ? 'HIGH' : 'MEDIUM', params: { gap, last: s[i - 1].invoiceDate }, supplierId: sid, amount: s[i].total, currency: s[i].currency, amountBase: s[i]._totalBase, txn: s[i].invoiceNo, rows: [s[i - 1], s[i]], action: 'verifySupport' });
      }
    }
    for (const p of allPays) {
      const s = P.sup.get(p.supplierId);
      if (!s) add({ category: 'SUPPLIER', rule: 'paymentUnknownSupplier', severity: 'CRITICAL', params: {}, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p], action: 'blockPayment' });
      else if (s.approvedStatus && /block|inactive|suspend|pending/i.test(s.approvedStatus)) add({ category: 'SUPPLIER', rule: 'inactiveSupplierPaid', severity: 'CRITICAL', params: { status: s.approvedStatus }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p, s], action: 'blockPayment' });
    }

    /* Payments without PO / GRN / approval / approved invoice / bank reference */
    for (const p of allPays) {
      const inv = p.invoiceNo ? P.inv.get(p.invoiceNo) : null;
      if (!inv) add({ category: 'PAYMENT', rule: 'paymentNoInvoice', severity: 'CRITICAL', params: { ref: p.invoiceNo || '—' }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p], action: 'blockPayment' });
      else {
        if (!/approved/i.test(inv.approvalStatus || '')) add({ category: 'CONTROL', rule: 'paymentUnapprovedInvoice', severity: 'CRITICAL', params: { inv: inv.invoiceNo, status: inv.approvalStatus || 'Not Available' }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p, inv], action: 'blockPayment' });
        const po = inv.poNo || p.poNo;
        if (!po) add({ category: 'PROCUREMENT', rule: 'paymentNoPO', severity: 'LOW', params: { inv: inv.invoiceNo }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p, inv], action: 'verifySupport' });
        else if (!(P.grnsByPo.get(po) || []).length) add({ category: 'PROCUREMENT', rule: 'paymentNoGRN', severity: 'HIGH', params: { po }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p, inv], action: 'obtainGRN' });
      }
      if (!/approved/i.test(p.approvalStatus || '') && p._isPaid) add({ category: 'CONTROL', rule: 'paymentNoApproval', severity: 'CRITICAL', params: { status: p.approvalStatus || 'Not Available' }, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p], action: 'blockPayment' });
      if (p._isPaid && !p.reference) add({ category: 'BANK', rule: 'paymentNoReference', severity: 'HIGH', params: {}, supplierId: p.supplierId, amount: p.net, currency: p.currency, amountBase: p._netBase, txn: p.paymentId, rows: [p], action: 'reconcile' });
    }

    /* Payment frequency */
    for (const [sid, arr] of U.groupBy(paid.filter((p) => p.paymentDate), 'supplierId')) {
      const s = arr.slice().sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1));
      for (let i = 0; i < s.length; i++) {
        const win = s.filter((x) => x.paymentDate >= s[i].paymentDate && U.daysBetween(s[i].paymentDate, x.paymentDate) < 7);
        if (win.length >= F.freqPer7Days) { add({ category: 'PAYMENT', rule: 'paymentFrequency', severity: 'MEDIUM', params: { n: win.length }, supplierId: sid, amount: U.sum(win, (x) => x.net), currency: win[0].currency, amountBase: U.sum(win, (x) => x._netBase), txn: win.map((x) => x.paymentId).join(', '), rows: win, action: 'verifySupport' }); break; }
      }
    }

    /* Shared bank accounts / addresses / related-party indicators */
    const byIban = U.groupBy(D.suppliers.filter((s) => s.iban), (s) => U.normIban(s.iban));
    for (const arr of byIban.values()) if (arr.length > 1) add({ category: 'FRAUD', rule: 'sharedBankAccount', severity: 'CRITICAL', params: { names: arr.map((s) => s.supplierId).join(', '), iban: U.maskAccount(arr[0].iban) }, supplierId: arr[1].supplierId, txn: arr.map((s) => s.supplierId).join(' / '), rows: arr, action: 'investigateSupplier' });
    const byAddr = U.groupBy(D.suppliers.filter((s) => s.address), (s) => U.normName(s.address));
    for (const arr of byAddr.values()) if (arr.length > 1) add({ category: 'SUPPLIER', rule: 'sharedAddress', severity: 'MEDIUM', params: { names: arr.map((s) => s.supplierId).join(', ') }, supplierId: arr[1].supplierId, txn: arr.map((s) => s.supplierId).join(' / '), rows: arr, action: 'investigateSupplier' });
    const byNm = U.groupBy(D.suppliers, (s) => U.normName(s.name));
    for (const arr of byNm.values()) if (arr.length > 1) add({ category: 'DATA QUALITY', rule: 'duplicateSupplier', severity: 'HIGH', params: { names: arr.map((s) => `${s.supplierId} "${s.name}"`).join(', ') }, supplierId: arr[1].supplierId, txn: arr.map((s) => s.supplierId).join(' / '), rows: arr, action: 'mergeSuppliers' });
    if (D.users.length) {
      for (const s of D.suppliers) {
        for (const u of D.users) {
          const hits = [];
          if (s.phone && u.phone && s.phone.replace(/\D/g, '') === u.phone.replace(/\D/g, '')) hits.push('phone');
          if (s.email && u.email && s.email.toLowerCase() === u.email.toLowerCase()) hits.push('email');
          if (s.iban && u.bankIban && U.normIban(s.iban) === U.normIban(u.bankIban)) hits.push('iban');
          if (hits.length) add({ category: 'COMPLIANCE', rule: 'relatedParty', severity: 'HIGH', params: { user: u.userId, fields: hits.join(', ') }, supplierId: s.supplierId, txn: s.supplierId + ' ↔ ' + u.userId, rows: [s, u], action: 'investigateSupplier' });
        }
      }
    } else notTested.push({ rule: 'relatedParty', reason: 'noUserDirectory' });

    /* Unusual price changes (same item, consecutive POs) */
    const byItem = U.groupBy(D.poLines.filter((l) => l.itemCode && l.unitPrice > 0), 'itemCode');
    for (const [item, arr] of byItem) {
      const s = arr.map((l) => ({ l, po: P.po.get(l.poNo) })).filter((x) => x.po && x.po.poDate).sort((a, b) => (a.po.poDate < b.po.poDate ? -1 : 1));
      for (let i = 1; i < s.length; i++) {
        if (s[i].po.currency !== s[i - 1].po.currency) continue;
        const ch = ((s[i].l.unitPrice - s[i - 1].l.unitPrice) / s[i - 1].l.unitPrice) * 100;
        if (ch >= F.priceJumpPct) add({ category: 'PROCUREMENT', rule: 'priceJump', severity: 'MEDIUM', params: { item, pct: U.round(ch, 1), from: s[i - 1].l.unitPrice, to: s[i].l.unitPrice }, supplierId: s[i].po.supplierId, amount: s[i].l.qty * (s[i].l.unitPrice - s[i - 1].l.unitPrice), currency: s[i].po.currency, txn: s[i].po.poNo, rows: [s[i - 1].l, s[i].l], action: 'renegotiate' });
      }
    }
    /* Unusual quantity (invoice qty > 3× median for item) */
    const byItemQ = U.groupBy(D.invoiceLines.filter((l) => l.itemCode && l.qty > 0), 'itemCode');
    for (const [item, arr] of byItemQ) {
      if (arr.length < 5) continue;
      const q = arr.map((x) => x.qty).sort((a, b) => a - b);
      const med = q[Math.floor(q.length / 2)];
      arr.filter((l) => l.qty > med * 3 && l.qty - med > 5).forEach((l) => add({ category: 'PROCUREMENT', rule: 'unusualQuantity', severity: 'LOW', params: { item, qty: l.qty, median: med }, supplierId: l.supplierId, txn: l.invoiceNo, rows: [l], action: 'verifySupport' }));
    }

    /* Unusual tax values vs configured rates */
    const vatRates = (cfg.taxCodes || []).filter((t) => /vat/i.test(t.type) && t.ratePct != null).map((t) => t.ratePct);
    if (vatRates.length) {
      for (const i of D.invoices.filter((x) => !x._closed && x.subtotal > 0 && x.tax != null && x.tax > 0)) {
        const r = (i.tax / i.subtotal) * 100;
        if (!vatRates.some((v) => Math.abs(v - r) <= cfg.matching.taxTolPct)) add({ category: 'TAX', rule: 'unusualTax', severity: 'MEDIUM', params: { rate: U.round(r, 2), configured: vatRates.join('/') }, supplierId: i.supplierId, amount: i.tax, currency: i.currency, amountBase: i._fx ? i.tax * i._fx.rate : null, txn: i.invoiceNo, rows: [i], action: 'taxReview', calc: 'tax ÷ subtotal × 100' });
      }
    } else notTested.push({ rule: 'unusualTax', reason: 'taxRatesNotConfigured' });
    /* Missing tax info */
    for (const i of D.invoices.filter((x) => !x._closed && x.total > 0 && x.tax == null)) add({ category: 'TAX', rule: 'missingTax', severity: 'LOW', params: {}, supplierId: i.supplierId, amount: i.total, currency: i.currency, amountBase: i._totalBase, txn: i.invoiceNo, rows: [i], action: 'taxReview' });

    /* Contract leakage / off-contract */
    for (const c of ctx.contracts.list) {
      if (c.alerts.includes('exceeded')) add({ category: 'CONTRACT', rule: 'contractExceeded', severity: 'HIGH', params: { contract: c.c.contractId, util: c.util }, supplierId: c.c.supplierId, amount: -c.remainingValue, currency: c.c.currency, txn: c.c.contractId, rows: [c.c, ...c.invs.slice(-3)], action: 'contractAmend' });
      if (c.outside.length) add({ category: 'CONTRACT', rule: 'offContract', severity: 'HIGH', params: { contract: c.c.contractId, n: c.outside.length, end: c.c.endDate }, supplierId: c.c.supplierId, amount: U.sum(c.outside, (i) => i.total), currency: c.c.currency, amountBase: U.sum(c.outside, (i) => i._totalBase || 0), txn: c.outside.map((i) => i.invoiceNo).join(', '), rows: [c.c, ...c.outside], action: 'contractAmend' });
    }

    /* IBAN checksum */
    for (const s of D.suppliers.filter((x) => x.iban && U.ibanValid(x.iban) === false)) add({ category: 'BANK', rule: 'invalidIban', severity: 'HIGH', params: { iban: U.maskAccount(s.iban) }, supplierId: s.supplierId, txn: s.supplierId, rows: [s], action: 'callbackVerify' });

    const sevRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    alerts.sort((a, b) => sevRank[b.severity] - sevRank[a.severity] || (b.amountBase || 0) - (a.amountBase || 0));
    const bySup = U.groupBy(alerts.filter((a) => a.supplierId && a.severity !== 'LOW'), 'supplierId');
    return { list: alerts, notTested, bySup, supName };
  };
})(typeof window !== 'undefined' ? window : globalThis);
