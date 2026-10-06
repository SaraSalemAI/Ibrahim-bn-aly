/* SUMED P2P — Data Quality & Control Report, reconciliation (bank + cross-register),
 * segregation of duties, automated control tests (PASS / WARNING / FAIL / NOT TESTED). */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const E = (S.engine = S.engine || {});

  /* ---------------- Data quality ---------------- */
  E.dataQuality = (D, P, cfg, asOf, ctx) => {
    const issues = [];
    const add = (check, severity, entity, rows, detail) => { if (rows.length) issues.push({ id: 'DQ-' + issues.length, check, severity, entity, count: rows.length, rows, detail: detail || null }); };
    const range = (arr, k) => { const v = arr.map((r) => r[k]).filter(Boolean).sort(); return v.length ? { from: v[0], to: v[v.length - 1] } : null; };
    const summary = {
      files: S.state.sources.length,
      records: U.sum(Object.values(D), (a) => a.length),
      byEntity: Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v.length])),
      suppliers: D.suppliers.length, invoices: D.invoices.length, pos: D.pos.length, payments: D.payments.length, bankTxns: D.bankTxns.length,
      currencies: U.uniq([...D.invoices, ...D.payments, ...D.pos, ...D.bankAccounts].map((r) => r.currency).filter(Boolean)).sort(),
      dateRanges: { invoices: range(D.invoices, 'invoiceDate'), payments: range(D.payments, 'paymentDate'), pos: range(D.pos, 'poDate'), bankTxns: range(D.bankTxns, 'date') },
    };
    // Parse issues & missing required fields
    for (const [ent, arr] of Object.entries(D)) {
      const def = S.schema[ent];
      if (!def || !arr.length) continue;
      const invalid = arr.filter((r) => r._issues && r._issues.length);
      add('invalidValues', 'HIGH', ent, invalid, U.uniq(invalid.flatMap((r) => r._issues.map((i) => i.field + ':' + i.issue))).slice(0, 8).join(', '));
      for (const f of def.fields.filter((x) => x.req)) {
        const miss = arr.filter((r) => U.isBlank(r[f.key]) && !(r._issues || []).some((i) => i.field === f.key));
        if (ent === 'invoices' && f.key === 'supplierId') continue; // handled by unknownSupplier
        add('missingField:' + f.key, ['total', 'net', 'invoiceNo', 'paymentId', 'currency', 'iban'].includes(f.key) ? 'HIGH' : 'MEDIUM', ent, miss);
      }
      // Fully identical rows
      const sig = U.groupBy(arr, (r) => JSON.stringify(def.fields.map((f) => r[f.key])));
      add('duplicateRecords', 'MEDIUM', ent, Array.from(sig.values()).filter((g) => g.length > 1).flatMap((g) => g.slice(1)));
      if (def.pk && !['invoices'].includes(ent)) {
        const pk = U.groupBy(arr.filter((r) => r[def.pk]), def.pk);
        add('duplicateKey:' + def.pk, 'HIGH', ent, Array.from(pk.values()).filter((g) => g.length > 1).flatMap((g) => g.slice(1)));
      }
    }
    add('duplicateInvoices', 'CRITICAL', 'invoices', ctx.dupInv.list.filter((d) => d.level === 'EXACT DUPLICATE').map((d) => D.invoices.find((i) => i._key === d.b)));
    add('possibleDuplicateInvoices', 'HIGH', 'invoices', ctx.dupInv.list.filter((d) => d.level !== 'EXACT DUPLICATE').map((d) => D.invoices.find((i) => i._key === d.b)));
    add('duplicatePaymentRefs', 'HIGH', 'payments', Array.from(U.groupBy(D.payments.filter((p) => p.reference), 'reference').values()).filter((g) => g.length > 1).flatMap((g) => g.slice(1)));
    add('invalidInvoiceNo', 'MEDIUM', 'invoices', D.invoices.filter((i) => i.invoiceNo != null && (String(i.invoiceNo).trim().length < 3 || /^0+$/.test(String(i.invoiceNo)) || /\s{2,}|[?*<>]/.test(String(i.invoiceNo)))));
    add('unknownSupplier', 'CRITICAL', 'invoices', D.invoices.filter((i) => !P.sup.has(i.supplierId)));
    add('unknownSupplierPayment', 'CRITICAL', 'payments', D.payments.filter((p) => !P.sup.has(p.supplierId)));
    // inconsistent supplier names
    const incMemo = new Map();
    add('inconsistentSupplierName', 'LOW', 'invoices', D.invoices.filter((i) => {
      const s = P.sup.get(i.supplierId);
      if (!s || !i.supplierName) return false;
      const k = i.supplierId + '|' + i.supplierName;
      if (!incMemo.has(k)) { const a = U.normName(i.supplierName), b = U.normName(s.name); incMemo.set(k, a !== b && a !== U.normName(s.nameAr) && U.levRatio(a, b) < 0.95); }
      return incMemo.get(k);
    }));
    // Near-identical names: sorted-neighbourhood comparison (each name vs the next 5 in sort order) — O(n·k)
    const nearDup = [];
    const sorted = D.suppliers.filter((x) => x.name).map((x) => ({ x, n: U.normName(x.name) })).sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
    const seenND = new Set();
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < Math.min(sorted.length, i + 6); j++) {
      const a = sorted[i], b = sorted[j];
      if (seenND.has(b.x._key) || Math.abs(a.n.length - b.n.length) > Math.max(2, a.n.length * 0.1)) continue;
      if (U.levRatio(a.n, b.n) >= 0.9) { nearDup.push(b.x); seenND.add(b.x._key); }
    }
    add('similarSupplierNames', 'MEDIUM', 'suppliers', nearDup);
    add('invoiceWithoutPO', 'MEDIUM', 'invoices', D.invoices.filter((i) => !i.poNo && !i._closed && i.total > 0 && (P.sup.get(i.supplierId) || {}).poRequired !== false));
    add('invoiceWithoutGRN', 'HIGH', 'invoices', D.invoices.filter((i) => i.poNo && P.po.has(i.poNo) && !(P.grnsByPo.get(i.poNo) || []).length));
    add('invoicePONotFound', 'HIGH', 'invoices', D.invoices.filter((i) => i.poNo && !P.po.has(i.poNo)));
    add('poWithoutInvoice', 'LOW', 'pos', D.pos.filter((p) => /received/i.test(p.status || '') && !(P.invByPo.get(p.poNo) || []).length && p.poDate && U.daysBetween(p.poDate, asOf) > 60));
    add('invoiceWithoutApproval', 'MEDIUM', 'invoices', D.invoices.filter((i) => i._open && !/approved/i.test(i.approvalStatus || '') && i.receivedDate && U.daysBetween(i.receivedDate, asOf) > cfg.alerts.approvalDelayDays));
    add('paymentWithoutApprovedInvoice', 'CRITICAL', 'payments', D.payments.filter((p) => { const i = P.inv.get(p.invoiceNo); return !i || !/approved/i.test(i.approvalStatus || ''); }));
    add('paymentWithoutBankRef', 'HIGH', 'payments', D.payments.filter((p) => p._isPaid && !p.reference));
    add('negativeValues', 'MEDIUM', 'invoices', D.invoices.filter((i) => i.total != null && i.total < 0));
    add('negativePayments', 'HIGH', 'payments', D.payments.filter((p) => p.net != null && p.net < 0));
    add('zeroValue', 'LOW', 'invoices', D.invoices.filter((i) => i.total === 0));
    add('zeroPayments', 'LOW', 'payments', D.payments.filter((p) => p.net === 0));
    add('missingTaxInvoice', 'MEDIUM', 'invoices', D.invoices.filter((i) => i.total > 0 && i.tax == null));
    add('missingSupplierTaxId', 'HIGH', 'suppliers', D.suppliers.filter((s) => !s.taxId && /approved|active/i.test(s.approvedStatus || '')));
    add('missingBankInfo', 'HIGH', 'suppliers', D.suppliers.filter((s) => !s.iban && !s.bankAccount && /approved|active/i.test(s.approvedStatus || '')));
    add('invalidIban', 'HIGH', 'suppliers', D.suppliers.filter((s) => s.iban && U.ibanValid(s.iban) === false));
    add('fxMissing', 'HIGH', 'invoices', D.invoices.filter((i) => i._fxMissing && i.currency));
    add('futureDated', 'MEDIUM', 'invoices', D.invoices.filter((i) => i.invoiceDate && i.invoiceDate > asOf));
    add('dueBeforeInvoice', 'MEDIUM', 'invoices', D.invoices.filter((i) => i.invoiceDate && i.dueDate && i.dueDate < i.invoiceDate));
    add('unusualAmounts', 'MEDIUM', 'invoices', ctx.alerts.list.filter((a) => a.rule === 'unusualAmount' || a.rule === 'roundAmount').flatMap((a) => a.rows));
    const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    issues.sort((a, b) => rank[b.severity] - rank[a.severity] || b.count - a.count);
    const bySev = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    issues.forEach((i) => (bySev[i.severity] += i.count));
    const recs = summary.records || 1;
    const affected = new Set(issues.flatMap((i) => i.rows.map((r) => r && r._key)));
    return { summary, issues, bySev, score: Math.max(0, Math.round(100 - (affected.size / recs) * 100)), affected: affected.size };
  };

  /* ---------------- Bank reconciliation ---------------- */
  E.bankRecon = (D, P, cfg, asOf) => {
    const pays = D.payments.filter((p) => ['Executed', 'Reconciled', 'Submitted to Bank', 'Reversed'].includes(p.executionStatus));
    const debits = D.bankTxns.filter((t) => t.amount != null && t.amount < 0);
    const credits = D.bankTxns.filter((t) => t.amount != null && t.amount > 0);
    const used = new Set();
    const res = [];
    const tol = cfg.matching.amountTolAbs;
    const byRef = U.groupBy(debits.filter((x) => x.reference), 'reference');
    const byAmt = U.groupBy(debits, (x) => Math.round(-x.amount));
    for (const p of pays) {
      let t = null, how = null;
      if (p.reference) {
        const c = (byRef.get(p.reference) || []).filter((x) => !used.has(x._key));
        if (c.length) { t = c[0]; how = 'reference'; if (c.length > 1) c.slice(1).forEach((x) => res.push({ type: 'duplicateBankDebit', status: 'EXCEPTION', p, t: x, diff: x.amount })); c.forEach((x) => used.add(x._key)); }
      }
      if (!t) {
        const near = [Math.round(p.net) - 1, Math.round(p.net), Math.round(p.net) + 1].flatMap((k) => byAmt.get(k) || []);
        const c = near.filter((x) => !used.has(x._key) && Math.abs(-x.amount - p.net) <= tol && x.date && p.paymentDate && Math.abs(U.daysBetween(p.paymentDate, x.date)) <= 5 && (!x.accountId || !p.bankAccountId || x.accountId === p.bankAccountId));
        if (c.length) { t = c[0]; how = 'amount+date'; used.add(t._key); }
      }
      const reversal = credits.find((x) => (p.reference && x.reference === p.reference) || (/revers/i.test(x.description || '') && x.reference === p.reference));
      if (!t) {
        const age = U.daysBetween(p.paymentDate, asOf);
        res.push({ type: p.executionStatus === 'Submitted to Bank' || age <= 2 ? 'uncleared' : 'missingInBank', status: 'UNMATCHED', p, t: null, diff: p.net, how: null, reversal });
        continue;
      }
      const diff = U.round(-t.amount - p.net, 2);
      const dd = U.daysBetween(p.paymentDate, t.date);
      const refMismatch = how === 'amount+date' && p.reference && t.reference && p.reference !== t.reference;
      let type = 'matched', status = 'MATCHED';
      if (Math.abs(diff) > tol) { type = 'wrongAmount'; status = 'PARTIAL'; }
      else if (refMismatch) { type = 'wrongReference'; status = 'PARTIAL'; }
      else if (Math.abs(dd) > 2) { type = 'timingDifference'; status = 'MATCHED'; }
      if (reversal || p.executionStatus === 'Reversed') { type = 'reversed'; status = 'EXCEPTION'; }
      res.push({ type, status, p, t, diff, dd, how, reversal });
    }
    for (const t of debits.filter((x) => !used.has(x._key))) res.push({ type: 'bankWithoutPayment', status: 'EXCEPTION', p: null, t, diff: t.amount });
    const count = (f) => res.filter(f).length;
    const totals = {
      register: U.sum(pays.filter((p) => p.executionStatus !== 'Reversed'), (p) => p._netBase || 0),
      bank: -U.sum(debits, (t) => { const a = P.bankAcc.get(t.accountId); const r = a && a._fx ? a._fx.rate : null; return r ? t.amount * r : 0; }),
    };
    return { items: res, matched: count((x) => x.status === 'MATCHED'), partial: count((x) => x.status === 'PARTIAL'), unmatched: count((x) => x.status === 'UNMATCHED'), exception: count((x) => x.status === 'EXCEPTION'), totals, rate: pays.length ? U.round((count((x) => x.status === 'MATCHED' && x.p) / pays.length) * 100, 1) : null, population: pays.length };
  };

  /* ---------------- Cross-register reconciliation ---------------- */
  E.registerRecon = (D, P, cfg, asOf, ctx) => {
    const pairs = [];
    const mk = (id, left, right, population, exceptions, note) => pairs.push({ id, left, right, population, exceptions, status: !population ? 'NOT TESTED' : !exceptions.length ? 'MATCHED' : exceptions.length < population * 0.05 ? 'PARTIAL' : 'EXCEPTION', note: note || null });
    mk('supInv', 'Supplier Register', 'Invoice Register', D.invoices.length, D.invoices.filter((i) => !P.sup.has(i.supplierId)), 'Invoices whose supplier is not in the master');
    mk('poInv', 'PO Register', 'Invoice Register', D.invoices.filter((i) => i.poNo).length, D.invoices.filter((i) => i.poNo && !P.po.has(i.poNo)), 'Invoice PO references not found');
    mk('poGrn', 'PO Register', 'GRN Register', D.grns.length, D.grns.filter((g) => !P.po.has(g.poNo)), 'GRNs referencing unknown POs');
    mk('grnInv', 'GRN Register', 'Invoice Register', D.invoices.filter((i) => i.poNo && P.po.has(i.poNo)).length, D.invoices.filter((i) => i.poNo && P.po.has(i.poNo) && !(P.grnsByPo.get(i.poNo) || []).length), 'PO invoices without GRN');
    mk('invPay', 'Invoice Register', 'Payment Register', D.payments.length, D.payments.filter((p) => !P.inv.has(p.invoiceNo)), 'Payments referencing unknown invoices');
    const over = D.invoices.filter((i) => i.total > 0 && i._paidFromRegister > i.total + cfg.matching.amountTolAbs);
    const srcDiff = D.invoices.filter((i) => i.paidAmount != null && Math.abs(i.paidAmount - i._paidFromRegister) > cfg.matching.amountTolAbs);
    mk('invPayAmt', 'Invoice paid amount', 'Payment Register', D.invoices.filter((i) => i._paid > 0 || i.paidAmount != null).length, over.concat(srcDiff), 'Over-payments, or invoice "paid amount" ≠ payment register');
    mk('payBank', 'Payment Register', 'Bank Statement', ctx.bank.population, ctx.bank.items.filter((x) => x.status !== 'MATCHED').map((x) => x.p || x.t), 'See Bank Reconciliation');
    // GL vs sub-ledger
    const gl = D.gl.filter((g) => g.apBalance != null).sort((a, b) => (a.period < b.period ? -1 : 1)).pop();
    let glRes = null;
    if (gl) {
      const sub = ctx.aging.total;
      const diff = U.round(gl.apBalance - sub, 2);
      glRes = { period: gl.period, gl: gl.apBalance, sub: U.round(sub, 2), diff, status: Math.abs(diff) <= Math.max(1000, Math.abs(gl.apBalance) * 0.0005) ? 'MATCHED' : 'EXCEPTION', rec: gl, excludedNoFx: ctx.aging.noFx.length };
      pairs.push({ id: 'glAP', left: 'GL / AP Ledger', right: 'AP Sub-ledger (open invoices)', population: 1, exceptions: glRes.status === 'MATCHED' ? [] : [gl], status: glRes.status, note: `GL ${gl.period}: ${Math.round(gl.apBalance).toLocaleString('en')} vs sub-ledger ${Math.round(sub).toLocaleString('en')} → difference ${Math.round(diff).toLocaleString('en')}` + (ctx.aging.noFx.length ? ` (sub-ledger excludes ${ctx.aging.noFx.length} invoice(s) without FX rate)` : '') });
    } else pairs.push({ id: 'glAP', left: 'GL / AP Ledger', right: 'AP Sub-ledger', population: 0, exceptions: [], status: 'NOT TESTED', note: 'GL / AP ledger not uploaded' });
    return { pairs, gl: glRes };
  };

  /* ---------------- Segregation of duties ---------------- */
  const PERM_DUTY = { 'create.supplier': 'supplier.create', 'approve.supplier': 'supplier.approve', 'create.invoice': 'invoice.create', 'approve.invoice': 'invoice.approve', 'create.batch': 'payment.create', 'approve.payment': 'payment.approve', 'approve.batch.treasury': 'payment.approve', 'approve.batch.cfo': 'payment.approve', 'execute.payment': 'payment.execute', reconcile: 'payment.reconcile', 'manage.banks': 'supplier.bankchange' };
  E.sod = (D, P, cfg, roles) => {
    const conflicts = cfg.sod.conflicts.map((c) => c.slice().sort().join('+'));
    const isConflict = (a, b) => conflicts.includes([a, b].sort().join('+'));
    const tx = [];
    const add = (user, duties, rec, entity, detail) => { if (user && isConflict(duties[0], duties[1])) tx.push({ user, duties, rec, entity, detail }); };
    D.suppliers.forEach((s) => { if (s.createdBy && s.createdBy === s.approvedBy) add(s.createdBy, ['supplier.create', 'supplier.approve'], s, 'suppliers', s.supplierId); });
    D.invoices.forEach((i) => { if (i.enteredBy && i.enteredBy === i.approvedBy) add(i.enteredBy, ['invoice.create', 'invoice.approve'], i, 'invoices', i.invoiceNo); });
    const batchBy = U.indexBy(D.batches, 'batchId');
    D.payments.forEach((p) => {
      if (p.createdBy && p.createdBy === p.approvedBy) add(p.createdBy, ['payment.create', 'payment.approve'], p, 'payments', p.paymentId);
      if (p.approvedBy && p.approvedBy === p.executedBy) add(p.approvedBy, ['payment.approve', 'payment.execute'], p, 'payments', p.paymentId);
      if (p.executedBy && p.executedBy === p.reconciledBy) add(p.executedBy, ['payment.execute', 'payment.reconcile'], p, 'payments', p.paymentId);
      const s = P.sup.get(p.supplierId);
      const b = batchBy.get(p.batchId);
      const approvers = U.uniq([p.approvedBy, b && b.treasuryApprovedBy, b && b.cfoApprovedBy].filter(Boolean));
      if (s && s.createdBy && approvers.includes(s.createdBy)) add(s.createdBy, ['supplier.create', 'payment.approve'], p, 'payments', `${p.paymentId} to ${s.supplierId} (created by same user)`);
      const inv = P.inv.get(p.invoiceNo);
      if (inv && inv.approvedBy && approvers.includes(inv.approvedBy)) add(inv.approvedBy, ['invoice.approve', 'payment.approve'], p, 'payments', `${inv.invoiceNo} → ${p.paymentId}`);
      (P.bankChgBySup.get(p.supplierId) || []).forEach((c) => { if (c.changedBy && approvers.includes(c.changedBy) && p.paymentDate >= c.changeDate) add(c.changedBy, ['supplier.bankchange', 'payment.approve'], p, 'payments', `bank change ${c.changeDate} → ${p.paymentId}`); });
    });
    // Per-user duty profile from transactions
    const duty = new Map();
    const note = (u, d, rec) => { if (!u) return; if (!duty.has(u)) duty.set(u, new Map()); const m = duty.get(u); if (!m.has(d)) m.set(d, []); m.get(d).push(rec); };
    D.suppliers.forEach((s) => { note(s.createdBy, 'supplier.create', s); note(s.approvedBy, 'supplier.approve', s); });
    D.bankChanges.forEach((c) => note(c.changedBy, 'supplier.bankchange', c));
    D.invoices.forEach((i) => { note(i.enteredBy, 'invoice.create', i); note(i.approvedBy, 'invoice.approve', i); });
    D.payments.forEach((p) => { note(p.createdBy, 'payment.create', p); note(p.approvedBy, 'payment.approve', p); note(p.executedBy, 'payment.execute', p); note(p.reconciledBy, 'payment.reconcile', p); });
    D.batches.forEach((b) => { note(b.createdBy, 'payment.create', b); note(b.treasuryApprovedBy, 'payment.approve', b); note(b.cfoApprovedBy, 'payment.approve', b); });
    const users = Array.from(duty.entries()).map(([u, m]) => {
      const ds = Array.from(m.keys());
      const pairs = [];
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) if (isConflict(ds[i], ds[j])) pairs.push([ds[i], ds[j]]);
      const txConf = tx.filter((x) => x.user === u);
      const sev = txConf.length && U.uniq(txConf.map((x) => x.duties.join('+'))).length >= 2 ? 'CRITICAL' : txConf.length ? 'HIGH' : pairs.length ? 'MEDIUM' : null;
      return { user: u, name: (P.users.get(u) || {}).name || u, role: (P.users.get(u) || {}).role || 'Not Available in Source Data', duties: ds, counts: Object.fromEntries(Array.from(m.entries()).map(([k, v]) => [k, v.length])), pairs, txConflicts: txConf, severity: sev };
    }).sort((a, b) => b.txConflicts.length - a.txConflicts.length || b.pairs.length - a.pairs.length);
    // Role design conflicts
    const roleConf = Object.entries(roles).map(([role, perms]) => {
      const ds = U.uniq(perms.map((p) => PERM_DUTY[p]).filter(Boolean));
      const pairs = [];
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) if (isConflict(ds[i], ds[j])) pairs.push([ds[i], ds[j]]);
      return { role, duties: ds, pairs, users: D.users.filter((u) => u.role === role).map((u) => u.userId) };
    }).filter((r) => r.pairs.length);
    return { tx, users, roleConf };
  };

  /* ---------------- Payment authority check ---------------- */
  E.authorityCheck = (D, P, cfg) => {
    if (!D.users.length) return { tested: false, exceptions: [] };
    const batchBy = U.indexBy(D.batches, 'batchId');
    const exceptions = [];
    for (const p of D.payments.filter((x) => x._isPaid || ['Approved', 'Scheduled', 'Submitted to Bank'].includes(x.executionStatus))) {
      const inv = P.inv.get(p.invoiceNo) || {};
      const b = batchBy.get(p.batchId);
      const req = E.requiredApprovers(p._grossBase != null ? p._grossBase : p._netBase, { currency: p.currency, emergency: !!(p.urgent || inv.emergency), nonPO: !inv.poNo }, cfg);
      const ids = U.uniq([inv.approvedBy, p.approvedBy, b && b.treasuryApprovedBy, b && b.cfoApprovedBy].filter(Boolean));
      const actual = ids.map((u) => ({ u, role: (P.users.get(u) || {}).role, rank: E.ROLE_RANK[(P.users.get(u) || {}).role] || 0 })).sort((a, b2) => b2.rank - a.rank);
      const need = req.roles.map((r) => ({ role: r, rank: E.ROLE_RANK[r] || 1 })).sort((a, b2) => b2.rank - a.rank);
      const usedU = new Set();
      const missing = [];
      for (const n of need) {
        const exact = actual.find((a) => !usedU.has(a.u) && a.role === n.role);
        const cover = exact || actual.find((a) => !usedU.has(a.u) && a.rank >= n.rank && E.ROLE_RANK[a.role] != null);
        if (cover) usedU.add(cover.u); else missing.push(n.role);
      }
      if (missing.length) exceptions.push({ p, inv, req, actual, missing });
    }
    return { tested: true, exceptions };
  };

  /* ---------------- Control tests ---------------- */
  E.controlTests = (D, P, cfg, asOf, ctx) => {
    const T = [];
    const al = (rule) => ctx.alerts.list.filter((a) => a.rule === rule);
    const t = (id, domain, popEntity, population, exceptions, failSev, note) => {
      const status = population == null || population === 0 ? 'NOT TESTED' : !exceptions.length ? 'PASS' : failSev === 'FAIL' ? 'FAIL' : 'WARNING';
      T.push({ id, domain, population: population || 0, exceptions, count: exceptions.length, status, note: note || null, entity: popEntity });
    };
    const act = D.suppliers.filter((s) => /approved|active/i.test(s.approvedStatus || ''));
    const dupSup = ctx.alerts.list.filter((a) => a.rule === 'duplicateSupplier' || a.rule === 'sharedBankAccount').flatMap((a) => a.rows.slice(1));
    t('SM-01', 'supplier', 'suppliers', D.suppliers.length, dupSup, 'FAIL');
    t('SM-02', 'supplier', 'suppliers', act.length, act.filter((s) => !s.taxId), 'FAIL');
    t('SM-03', 'supplier', 'suppliers', act.length, act.filter((s) => !s.iban && !s.bankAccount), 'FAIL');
    t('SM-04', 'supplier', 'suppliers', act.filter((s) => s.iban).length, act.filter((s) => s.iban && U.ibanValid(s.iban) === false), 'FAIL');
    t('SM-05', 'supplier', 'supplierDocs', D.supplierDocs.length ? act.length : 0, act.filter((s) => (ctx.docs.get(s.supplierId) || { expired: [] }).expired.length), 'WARN');
    t('SM-06', 'supplier', 'suppliers', act.filter((s) => s.sanctionsStatus != null).length, act.filter((s) => s.sanctionsStatus && !/clear/i.test(s.sanctionsStatus)), 'FAIL');
    t('SM-07', 'sod', 'suppliers', D.suppliers.filter((s) => s.createdBy && s.approvedBy).length, D.suppliers.filter((s) => s.createdBy && s.createdBy === s.approvedBy), 'FAIL');
    const invs = D.invoices.filter((i) => !i._closed && i.total > 0);
    t('IN-01', 'invoice', 'invoices', invs.length, invs.filter((i) => !i.poNo && (P.sup.get(i.supplierId) || {}).poRequired !== false), 'WARN');
    t('IN-02', 'grn', 'invoices', invs.filter((i) => i.poNo).length, invs.filter((i) => i.poNo && P.po.has(i.poNo) && !(P.grnsByPo.get(i.poNo) || []).length), 'FAIL');
    t('IN-03', 'duplicate', 'invoices', invs.length, ctx.dupInv.list.filter((d) => d.level !== 'POSSIBLE DUPLICATE').map((d) => D.invoices.find((i) => i._key === d.b)), 'FAIL');
    t('IN-04', 'invoice', 'invoices', invs.filter((i) => i._open).length, invs.filter((i) => i._open && !/approved/i.test(i.approvalStatus || '') && i.receivedDate && U.daysBetween(i.receivedDate, asOf) > cfg.alerts.approvalDelayDays), 'WARN');
    t('IN-05', 'invoice', 'invoices', invs.filter((i) => i.poNo).length, invs.filter((i) => { const m = ctx.match.get(i._key); return m && ['EXCEPTION', 'QUANTITY VARIANCE', 'PRICE VARIANCE', 'TAX VARIANCE'].includes(m.status); }), 'FAIL');
    t('PO-01', 'po', 'invoices', invs.filter((i) => i.poNo && P.po.has(i.poNo)).length, invs.filter((i) => { const po = P.po.get(i.poNo); return po && po.poDate && i.invoiceDate && po.poDate > i.invoiceDate; }), 'FAIL');
    t('PO-02', 'po', 'pos', D.pos.length, D.pos.filter((p) => !p.approvedBy && !/draft|pending/i.test(p.status || '')), 'FAIL');
    t('PO-03', 'contract', 'pos', D.pos.filter((p) => p.contractId).length, ctx.contracts.list.filter((c) => c.poOutside.length).flatMap((c) => c.poOutside), 'WARN');
    t('GR-01', 'grn', 'grns', D.grns.length, D.grns.filter((g) => { const po = P.po.get(g.poNo); return po && po.poDate && g.receiptDate && g.receiptDate < po.poDate; }), 'FAIL');
    t('GR-02', 'grn', 'grnLines', D.grnLines.length, D.grnLines.filter((l) => { const pl = (P.poLines.get(l.poNo) || []).find((x) => x.itemCode === l.itemCode); return pl && l.qtyReceived > pl.qty * (1 + cfg.matching.qtyTolPct / 100); }), 'WARN');
    const pays = D.payments.filter((p) => p._isPaid);
    t('PY-01', 'payment', 'payments', pays.length, al('paymentNoApproval').map((a) => a.rows[0]), 'FAIL');
    t('PY-02', 'approval', 'payments', ctx.authority.tested ? pays.length : 0, ctx.authority.exceptions.map((x) => x.p), 'FAIL', ctx.authority.tested ? null : 'User directory (roles) required');
    t('PY-03', 'duplicate', 'payments', pays.length, ctx.dupPay.filter((d) => d.level !== 'POSSIBLE DUPLICATE').map((d) => D.payments.find((p) => p._key === d.b)), 'FAIL');
    t('PY-04', 'payment', 'payments', pays.length, al('inactiveSupplierPaid').concat(al('paymentUnknownSupplier')).map((a) => a.rows[0]), 'FAIL');
    t('PY-05', 'payment', 'payments', pays.length, pays.filter((p) => p.manual || p.urgent), 'WARN');
    t('PY-06', 'payment', 'payments', pays.length, al('paymentUnapprovedInvoice').concat(al('paymentNoInvoice')).map((a) => a.rows[0]), 'FAIL');
    t('PY-07', 'payment', 'payments', pays.length, pays.filter((p) => { const i = P.inv.get(p.invoiceNo); return i && i.invoiceDate && p.paymentDate < i.invoiceDate; }), 'FAIL');
    t('BK-01', 'bank', 'bankChanges', D.bankChanges.length ? pays.length : 0, al('paymentAfterBankChange').map((a) => a.rows[1]), 'FAIL', D.bankChanges.length ? null : 'Bank-change log not uploaded');
    t('BK-02', 'bank', 'bankChanges', D.bankChanges.length, D.bankChanges.filter((c) => c.verified === false || !c.approvedBy || c.approvedBy === c.changedBy), 'FAIL');
    t('BK-03', 'bank', 'payments', D.bankTxns.length ? ctx.bank.population : 0, ctx.bank.items.filter((x) => x.status !== 'MATCHED').map((x) => x.p || x.t), 'WARN', D.bankTxns.length ? null : 'Bank statement not uploaded');
    t('BK-04', 'bank', 'payments', pays.filter((p) => p.beneficiaryIban).length, al('beneficiaryMismatch').map((a) => a.rows[0]), 'FAIL');
    t('AP-01', 'approval', 'invoices', invs.length, al('belowThreshold').map((a) => a.rows[0]), 'WARN');
    t('AP-02', 'approval', 'invoices', invs.length, al('splitInvoices').flatMap((a) => a.rows), 'FAIL');
    const batchEx = D.batches.filter((b) => {
      const ps = D.payments.filter((p) => p.batchId === b.batchId);
      const tot = U.sum(ps, (p) => p._netBase || 0);
      return E.requiredApprovers(tot, {}, cfg).roles.includes('CFO') && !b.cfoApprovedBy && !/draft/i.test(b.status || '');
    });
    t('AP-03', 'approval', 'batches', D.batches.length, batchEx, 'FAIL');
    t('SD-01', 'sod', 'payments', D.payments.length + D.invoices.length, ctx.sod.tx.map((x) => x.rec), 'FAIL');
    t('SD-02', 'sod', 'users', D.users.length, ctx.sod.roleConf.filter((r) => r.users.length).flatMap((r) => D.users.filter((u) => r.users.includes(u.userId))), 'WARN', 'Role design permits incompatible duties');
    t('CT-01', 'contract', 'contracts', D.contracts.length, ctx.contracts.list.filter((c) => c.status === 'Expired' && c.invs.some((i) => i._open)).map((c) => c.c), 'WARN');
    t('CT-02', 'contract', 'contracts', D.contracts.length, ctx.contracts.list.filter((c) => c.alerts.includes('exceeded')).map((c) => c.c), 'FAIL');
    t('CT-03', 'contract', 'invoices', invs.filter((i) => i.contractId).length, ctx.contracts.list.flatMap((c) => c.outside), 'FAIL');
    const vat = (cfg.taxCodes || []).some((x) => /vat/i.test(x.type));
    t('TX-01', 'tax', 'invoices', vat ? invs.filter((i) => i.tax > 0).length : 0, al('unusualTax').map((a) => a.rows[0]), 'WARN', vat ? null : 'Tax rates not configured');
    t('TX-02', 'tax', 'invoices', invs.length, invs.filter((i) => i.tax == null), 'WARN');
    t('FR-01', 'fraud', 'suppliers', D.suppliers.length, al('sharedBankAccount').flatMap((a) => a.rows), 'FAIL');
    t('FR-02', 'fraud', 'suppliers', D.users.length ? D.suppliers.length : 0, al('relatedParty').map((a) => a.rows[0]), 'FAIL', D.users.length ? null : 'User directory not uploaded');
    t('FR-03', 'fraud', 'payments', pays.length, al('weekendPayment').map((a) => a.rows[0]), 'WARN');
    const hol = (cfg.holidays || []).length + D.holidays.length;
    t('FR-04', 'fraud', 'payments', hol ? pays.length : 0, al('holidayPayment').map((a) => a.rows[0]), 'WARN', hol ? null : 'Holiday calendar not configured');
    t('FR-05', 'fraud', 'invoices', invs.length, al('dormantReactivated').map((a) => a.rows[1]), 'WARN');
    const chain = S.verifyAudit();
    T.push({ id: 'AU-01', domain: 'audit', population: chain.total, exceptions: [], count: chain.ok ? 0 : 1, status: chain.total ? (chain.ok ? 'PASS' : 'FAIL') : 'NOT TESTED', note: chain.ok ? null : 'Hash chain broken at entry ' + chain.brokenAt, entity: 'audit' });
    const summary = { PASS: 0, WARNING: 0, FAIL: 0, 'NOT TESTED': 0 };
    T.forEach((x) => summary[x.status]++);
    const domains = Array.from(U.groupBy(T, 'domain').entries()).map(([d, ts]) => ({ domain: d, tests: ts, status: ts.some((x) => x.status === 'FAIL') ? 'FAIL' : ts.some((x) => x.status === 'WARNING') ? 'WARNING' : ts.every((x) => x.status === 'NOT TESTED') ? 'NOT TESTED' : 'PASS' }));
    return { tests: T, summary, domains };
  };
})(typeof window !== 'undefined' ? window : globalThis);
