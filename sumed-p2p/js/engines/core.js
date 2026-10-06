/* SUMED P2P — engine core: preparation, FX, lineage, approval matrix.
 * Conventions:
 *   SOURCE VALUE — taken as-is from an uploaded row (has _src)
 *   DERIVED      — calculated; carries formula + inputs + contributing rows
 *   ASSUMPTION   — explicitly labelled when a calculation needs one
 * Nothing is ever defaulted to zero silently: missing inputs produce null + an "unavailable" reason. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const E = (S.engine = S.engine || {});

  E.PAID_STATUSES = ['Executed', 'Reconciled'];
  E.CLOSED_INV = ['Rejected', 'Cancelled'];

  /* ---------------- Lineage ---------------- */
  /** Compress row numbers into ranges, grouped by file+sheet */
  E.sourceSummary = (recs) => {
    const g = U.groupBy(recs.filter((r) => r && r._src), (r) => r._src.file + '¦' + (r._src.sheet || ''));
    return Array.from(g.entries()).map(([k, rs]) => {
      const [file, sheet] = k.split('¦');
      const rows = rs.map((r) => r._src.row).filter((x) => x != null).sort((a, b) => a - b);
      const ranges = [];
      for (let i = 0; i < rows.length; i++) {
        let j = i;
        while (j + 1 < rows.length && rows[j + 1] <= rows[j] + 1) j++;
        ranges.push(rows[i] === rows[j] ? String(rows[i]) : rows[i] + '–' + rows[j]);
        i = j;
      }
      const pages = U.uniq(rs.map((r) => r._src.page).filter(Boolean));
      return { file, sheet: sheet || null, rows: ranges.join(', ') || null, pages: pages.join(', ') || null, count: rs.length, demo: rs.some((r) => r._demo) };
    });
  };
  /** Build a lineage record. rows = records that contributed. */
  E.lineage = (o) => ({
    kind: o.kind || 'DERIVED',
    label: o.label, value: o.value == null ? null : o.value, unit: o.unit || null,
    formula: o.formula || null, inputs: o.inputs || [], note: o.note || null,
    assumptions: o.assumptions || [], excluded: o.excluded || [],
    unavailable: o.value == null ? o.unavailable || 'Calculation unavailable because required input data is missing.' : null,
    rows: (o.rows || []).map((r) => ({ entity: r._entity || o.entity, key: r._key })).slice(0, 5000),
    entity: o.entity || null,
    sources: E.sourceSummary(o.rows || []),
    route: o.route || null,
  });

  /* ---------------- FX ---------------- */
  E.buildFx = (D, cfg) => {
    const by = U.groupBy(D.fxRates.filter((r) => r.currency && r.date && r.rate > 0), (r) => r.currency.toUpperCase());
    for (const arr of by.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    return {
      /** Latest rate on or before date; else null. Never invented. */
      rate(ccy, date) {
        if (!ccy) return null;
        ccy = ccy.toUpperCase();
        if (ccy === cfg.baseCurrency) return { rate: 1, date: date || null, source: 'Base currency', rec: null };
        const arr = by.get(ccy);
        if (!arr || !arr.length) return null;
        let best = null;
        for (const r of arr) { if (!date || r.date <= date) best = r; else break; }
        if (!best) best = null; // no rate on/before date — do not use a future rate
        return best ? { rate: best.rate, date: best.date, source: best.source || 'FX table', rec: best } : null;
      },
      latest(ccy) { return this.rate(ccy, null); },
      currencies: Array.from(by.keys()),
    };
  };

  /* ---------------- Payment terms parsing ---------------- */
  E.parseTerms = (t) => {
    if (!t) return null;
    const s = String(t);
    let m = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*,?\s*net\s*(\d+)/i);
    if (m) return { discountPct: +m[1], discountDays: +m[2], netDays: +m[3] };
    m = s.match(/net\s*(\d+)/i) || s.match(/(\d+)\s*(?:days|يوم)/i);
    if (m) return { discountPct: null, discountDays: null, netDays: +m[1] };
    return null;
  };

  /* ---------------- Preparation ---------------- */
  E.prepare = (D, cfg, asOf) => {
    const P = {};
    const fx = E.buildFx(D, cfg);
    P.fx = fx;
    Object.entries(D).forEach(([ent, arr]) => arr.forEach((r) => { r._entity = ent; }));
    P.sup = U.indexBy(D.suppliers, 'supplierId');
    P.po = U.indexBy(D.pos, 'poNo');
    P.grn = U.indexBy(D.grns, 'grnNo');
    P.contract = U.indexBy(D.contracts, 'contractId');
    P.bankAcc = U.indexBy(D.bankAccounts, 'accountId');
    P.users = U.indexBy(D.users, 'userId');
    P.poLines = U.groupBy(D.poLines, 'poNo');
    P.grnsByPo = U.groupBy(D.grns, 'poNo');
    P.grnLinesByPo = U.groupBy(D.grnLines, (l) => l.poNo || (P.grn.get(l.grnNo) || {}).poNo);
    P.invLines = U.groupBy(D.invoiceLines, 'invoiceNo');
    P.invByPo = U.groupBy(D.invoices.filter((i) => i.poNo), 'poNo');
    P.paysByInv = U.groupBy(D.payments.filter((p) => p.invoiceNo), 'invoiceNo');
    P.docsBySup = U.groupBy(D.supplierDocs, 'supplierId');
    P.bankChgBySup = U.groupBy(D.bankChanges, 'supplierId');
    P.contractsBySup = U.groupBy(D.contracts, 'supplierId');

    // Resolve supplierId by name when only a name is present (DERIVED, logged on the record)
    const byName = new Map();
    D.suppliers.forEach((s) => { [s.name, s.nameAr].filter(Boolean).forEach((n) => byName.set(U.normName(n), s)); });
    const memo = new Map();
    const lookup = (n) => {
      if (memo.has(n)) return memo.get(n);
      let res = byName.has(n) ? { s: byName.get(n), score: 1 } : null;
      if (!res) {
        let best = null;
        for (const [k, v] of byName) {
          if (Math.abs(k.length - n.length) > Math.max(2, n.length * 0.1) || k[0] !== n[0]) continue; // ≥ 0.9 similarity is impossible otherwise
          const r = U.levRatio(k, n);
          if (!best || r > best.r) best = { r, v };
        }
        if (best && best.r >= 0.9) res = { s: best.v, score: best.r };
      }
      memo.set(n, res);
      return res;
    };
    const resolve = (rec) => {
      if (rec.supplierId && P.sup.has(rec.supplierId)) return;
      if (!rec.supplierName) return;
      const n = U.normName(rec.supplierName);
      const hit = lookup(n);
      const s = hit && hit.s, score = hit ? hit.score : 0;
      if (s) {
        rec._derived = rec._derived || {};
        rec._derived.supplierId = `Matched by supplier name "${rec.supplierName}" → ${s.supplierId} (similarity ${Math.round(score * 100)}%)`;
        rec._origSupplierId = rec.supplierId;
        rec.supplierId = s.supplierId;
      }
    };
    D.invoices.forEach(resolve);

    // Payments: base amounts
    for (const p of D.payments) {
      const r = fx.rate(p.currency, p.paymentDate);
      p._fx = r;
      p._netBase = r && p.net != null ? p.net * r.rate : null;
      p._grossBase = r && p.gross != null ? p.gross * r.rate : null;
      p._isPaid = E.PAID_STATUSES.includes(p.executionStatus);
    }

    // Payments → invoices. When several invoices share supplier + invoice number (e.g. duplicates), payments are
    // allocated in invoice-date order so the same payment is never counted against two invoices.
    const alloc = new Map();
    for (const [k, grp] of U.groupBy(D.invoices, (i) => (i.supplierId || '') + '|' + i.invoiceNo)) {
      const pays = (P.paysByInv.get(grp[0].invoiceNo) || []).filter((p) => p._isPaid && (!grp[0].supplierId || !p.supplierId || p.supplierId === grp[0].supplierId));
      if (grp.length === 1) { alloc.set(grp[0]._key, pays); continue; }
      const order = grp.slice().sort((a, b) => ((a.invoiceDate || '') + (a.receivedDate || '') < (b.invoiceDate || '') + (b.receivedDate || '') ? -1 : 1));
      const queue = pays.slice().sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1));
      order.forEach((inv) => alloc.set(inv._key, []));
      for (const p of queue) {
        const target = order.find((inv) => U.sum(alloc.get(inv._key), (x) => x.gross != null ? x.gross : x.net) + 0.005 < (inv.total || 0)) || order[order.length - 1];
        alloc.get(target._key).push(p);
      }
      void k;
    }
    // Invoices: paid / outstanding / base / due
    for (const inv of D.invoices) {
      const pays = alloc.get(inv._key) || [];
      inv._payments = pays.map((p) => p._key);
      const paidFromRegister = U.sum(pays, (p) => (p.gross != null ? p.gross : p.net));
      inv._paidFromRegister = U.round(paidFromRegister, 2);
      if (inv.paidAmount != null) { inv._paid = inv.paidAmount; inv._paidKind = 'SOURCE VALUE'; }
      else { inv._paid = U.round(paidFromRegister, 2); inv._paidKind = 'DERIVED'; }
      if (inv.outstanding != null) { inv._out = inv.outstanding; inv._outKind = 'SOURCE VALUE'; }
      else if (inv.total != null) { inv._out = U.round(inv.total - inv._paid, 2); inv._outKind = 'DERIVED'; } // negative = supplier debit balance (over-payment / credit note)
      else { inv._out = null; inv._outKind = 'UNAVAILABLE'; }
      inv._closed = E.CLOSED_INV.includes(inv.status);
      const r = fx.rate(inv.currency, inv.invoiceDate);
      const rNow = fx.rate(inv.currency, asOf);
      inv._fx = r; inv._fxNow = rNow;
      inv._fxMissing = !r;
      inv._totalBase = r && inv.total != null ? inv.total * r.rate : null;
      inv._subBase = r && inv.subtotal != null ? inv.subtotal * r.rate : r && inv.total != null && inv.tax != null ? (inv.total - inv.tax) * r.rate : null;
      inv._outBase = rNow && inv._out != null ? inv._out * rNow.rate : null; // AP revalued at as-of rate
      inv._dpd = inv.dueDate ? U.daysBetween(inv.dueDate, asOf) : null; // days past due (+ overdue)
      inv._open = !inv._closed && inv._out != null && Math.abs(inv._out) > 0.005;
      inv._debitBalance = inv._open && inv._out < 0;
      const s = P.sup.get(inv.supplierId);
      inv._supName = s ? s.name : inv.supplierName || null;
      inv._supNameAr = s ? s.nameAr || s.name : inv.supplierName || null;
      inv._terms = E.parseTerms(inv.paymentTerms || (s && s.paymentTerms));
    }
    P.inv = U.indexBy(D.invoices, 'invoiceNo');

    for (const po of D.pos) {
      const r = fx.rate(po.currency, po.poDate);
      po._fx = r;
      const tot = po.total != null ? po.total : po.amount != null ? po.amount + (po.tax || 0) : null;
      po._total = tot;
      po._totalBase = r && tot != null ? tot * r.rate : null;
    }
    for (const c of D.contracts) {
      const r = fx.rate(c.currency, c.startDate) || fx.latest(c.currency);
      c._valueBase = r && c.value != null ? c.value * r.rate : null;
    }
    for (const b of D.bankAccounts) {
      const r = fx.rate(b.currency, asOf);
      b._fx = r;
      b._availBase = r && b.availableBalance != null ? b.availableBalance * r.rate : null;
    }
    return P;
  };

  /* ---------------- Approval matrix ---------------- */
  /** Returns required approver roles for an amount (base currency) + context. Config-driven only. */
  E.requiredApprovers = (amountBase, ctx, cfg) => {
    const m = cfg.approvalMatrix;
    if (amountBase == null) return { tier: null, roles: [], reasons: ['Amount in base currency unavailable (FX rate missing) — approval tier cannot be determined'] };
    const tier = m.tiers.find((t) => t.max == null || amountBase < t.max) || m.tiers[m.tiers.length - 1];
    const roles = tier.approvers.slice();
    const reasons = [`Tier ${tier.id}: amount ${Math.round(amountBase).toLocaleString('en')} ${cfg.baseCurrency} ${tier.max == null ? '≥ top threshold' : '< ' + tier.max.toLocaleString('en')}`];
    for (const r of m.rules.filter((x) => x.enabled)) {
      let hit = false;
      if (r.when === 'supplierRisk' && ctx.supplierRisk && ['HIGH', 'CRITICAL'].includes(ctx.supplierRisk)) hit = true;
      if (r.when === 'emergency' && ctx.emergency) hit = true;
      if (r.when === 'foreignCurrency' && ctx.currency && ctx.currency !== cfg.baseCurrency) hit = true;
      if (r.when === 'nonPO' && ctx.nonPO) hit = true;
      if (hit && !roles.includes(r.add)) { roles.push(r.add); reasons.push(`Rule ${r.id}: ${r.when} → add ${r.add}`); }
    }
    return { tier: tier.id, roles, reasons };
  };
  /** Which roles have approved, from user ids → roles */
  E.rolesOf = (userIds, P) => U.uniq(userIds.filter(Boolean).map((u) => (P.users.get(u) || {}).role || null).filter(Boolean));
  /** Role equivalence for authority checks (higher roles can cover lower) */
  E.ROLE_RANK = { 'Department Manager': 1, Approver: 1, 'AP Manager': 1, 'Procurement Manager': 1, 'Treasury Manager': 2, 'Compliance Officer': 2, 'Finance Director': 3, CFO: 4, 'Authorized Executive': 5 };
})(typeof window !== 'undefined' ? window : globalThis);
