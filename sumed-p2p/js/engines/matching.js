/* SUMED P2P — three-way matching (PO + GRN + Invoice) and duplicate detection (invoices & payments). */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const E = (S.engine = S.engine || {});

  E.MATCH_ORDER = ['DUPLICATE', 'MISSING PO', 'EXCEPTION', 'MISSING GRN', 'QUANTITY VARIANCE', 'PRICE VARIANCE', 'TAX VARIANCE', 'PARTIALLY MATCHED', 'MATCHED'];

  /* ---------------- Duplicate invoices ---------------- */
  E.duplicateInvoices = (D, P, cfg) => {
    const c = cfg.duplicates;
    const inv = D.invoices.filter((i) => i.total != null && i.total !== 0 && !i._closed);
    const lineSig = (i) => (P.invLines.get(i.invoiceNo) || []).map((l) => `${l.itemCode}|${l.qty}|${l.unitPrice}`).sort().join(';');
    const sigs = new Map(inv.map((i) => [i._key, lineSig(i)]));
    const toks = new Map(inv.map((i) => [i._key, new Set(U.tokens(i.description))]));
    const jac = (a, b) => { const A = toks.get(a._key), B = toks.get(b._key); if (!A.size || !B.size) return 0; let n = 0; A.forEach((x) => B.has(x) && n++); return n / (A.size + B.size - n); };
    const out = [];
    const seen = new Set();
    const consider = (a, b) => {
      if (a._key === b._key) return;
      const pk = [a._key, b._key].sort().join('~');
      if (seen.has(pk)) return;
      seen.add(pk);
      const reasons = [];
      const sameSup = a.supplierId && a.supplierId === b.supplierId;
      const sameNo = String(a.invoiceNo || '') === String(b.invoiceNo || '') && a.invoiceNo;
      const normEq = U.normInvNo(a.invoiceNo) && U.normInvNo(a.invoiceNo) === U.normInvNo(b.invoiceNo);
      const amtEq = Math.abs(a.total - b.total) <= cfg.matching.amountTolAbs;
      const amtNear = Math.abs(a.total - b.total) <= Math.abs(a.total) * (c.amountTolPct / 100);
      const sameCcy = a.currency === b.currency;
      const dd = a.invoiceDate && b.invoiceDate ? Math.abs(U.daysBetween(a.invoiceDate, b.invoiceDate)) : null;
      const samePO = a.poNo && a.poNo === b.poNo;
      const sameHash = a.fileHash && a.fileHash === b.fileHash;
      const desc = a.description && b.description ? jac(a, b) : 0;
      const sameIban = a.bankIban && U.normIban(a.bankIban) === U.normIban(b.bankIban);
      const linesEq = sigs.get(a._key) && sigs.get(a._key) === sigs.get(b._key);
      if (sameSup) reasons.push('sameSupplier');
      if (sameNo) reasons.push('sameInvoiceNo'); else if (normEq) reasons.push('normalisedInvoiceNo');
      if (amtEq && sameCcy) reasons.push('sameAmount'); else if (amtNear && sameCcy) reasons.push('similarAmount');
      if (dd != null && dd <= c.possibleWindowDays) reasons.push('dateWithin:' + dd);
      if (samePO) reasons.push('samePO');
      if (sameHash) reasons.push('sameFileHash');
      if (desc >= c.descSimilarity) reasons.push('similarDescription:' + Math.round(desc * 100));
      if (sameIban) reasons.push('sameBankAccount');
      if (linesEq) reasons.push('identicalLines');
      let level = null;
      if (sameHash || (sameSup && sameNo && amtEq && sameCcy)) level = 'EXACT DUPLICATE';
      else if ((sameSup && normEq && amtNear && sameCcy) || (sameSup && amtEq && sameCcy && dd != null && dd <= c.highRiskWindowDays && (samePO || desc >= c.descSimilarity || linesEq)) || (!sameSup && normEq && amtEq && sameIban)) level = 'HIGH-RISK DUPLICATE';
      else if ((sameSup && amtNear && sameCcy && dd != null && dd <= c.possibleWindowDays && (desc >= c.descSimilarity || samePO)) || (!sameSup && normEq && amtNear && sameCcy) || (sameSup && linesEq && sameCcy) || (sameSup && sameNo)) level = 'POSSIBLE DUPLICATE';
      if (!level) return;
      const paidA = a._paid > 0, paidB = b._paid > 0;
      if (paidA && paidB) reasons.push('bothPaid');
      if (level === 'POSSIBLE DUPLICATE' && paidA && paidB) level = 'HIGH-RISK DUPLICATE';
      const [first, second] = (a.invoiceDate || '') <= (b.invoiceDate || '') ? [a, b] : [b, a];
      out.push({ id: 'DUP-' + U.hash(pk).slice(0, 8), level, a: first._key, b: second._key, aNo: first.invoiceNo, bNo: second.invoiceNo, supplierId: second.supplierId, currency: second.currency, amount: second.total, amountBase: second._totalBase, reasons, paidBoth: paidA && paidB, exposure: paidA && paidB ? Math.min(first._paid, second._paid) : second._out });
    };
    const bySup = U.groupBy(inv, (i) => i.supplierId || '∅');
    for (const arr of bySup.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) consider(arr[i], arr[j]);
    const byNo = U.groupBy(inv, (i) => U.normInvNo(i.invoiceNo));
    for (const [k, arr] of byNo) if (k) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) consider(arr[i], arr[j]);
    const rank = { 'EXACT DUPLICATE': 3, 'HIGH-RISK DUPLICATE': 2, 'POSSIBLE DUPLICATE': 1 };
    out.sort((x, y) => rank[y.level] - rank[x.level] || (y.amountBase || 0) - (x.amountBase || 0));
    const byInv = new Map();
    out.forEach((d) => [d.a, d.b].forEach((k) => { if (!byInv.has(k) || rank[byInv.get(k).level] < rank[d.level]) byInv.set(k, d); }));
    return { list: out, byInv };
  };

  /* ---------------- Duplicate payments ---------------- */
  E.duplicatePayments = (D, P, cfg, dupInv) => {
    const pays = D.payments.filter((p) => p.executionStatus !== 'Rejected' && p.executionStatus !== 'Failed' && p.net);
    const out = [];
    const seen = new Set();
    const add = (a, b, level, reasons) => {
      const k = [a._key, b._key].sort().join('~');
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ id: 'DPAY-' + U.hash(k).slice(0, 8), level, a: a._key, b: b._key, aId: a.paymentId, bId: b.paymentId, supplierId: b.supplierId, amount: b.net, currency: b.currency, amountBase: b._netBase, reasons });
    };
    const byRef = U.groupBy(pays.filter((p) => p.reference), 'reference');
    for (const arr of byRef.values()) for (let i = 1; i < arr.length; i++) add(arr[0], arr[i], 'EXACT DUPLICATE', ['sameBankReference']);
    const byInv = U.groupBy(pays.filter((p) => p.invoiceNo && p._isPaid), (p) => p.supplierId + '|' + p.invoiceNo);
    for (const [k, arr] of byInv) {
      if (arr.length < 2) continue;
      const inv = P.inv.get(arr[0].invoiceNo);
      const paid = U.sum(arr, (p) => p.gross != null ? p.gross : p.net);
      if (inv && inv.total != null && paid <= inv.total + cfg.matching.amountTolAbs) continue; // instalments within invoice total
      for (let i = 1; i < arr.length; i++) add(arr[0], arr[i], 'EXACT DUPLICATE', ['sameInvoicePaidTwice']);
    }
    const bySup = U.groupBy(pays.filter((p) => p._isPaid), 'supplierId');
    for (const arr of bySup.values()) {
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        if (a.currency !== b.currency || Math.abs(a.net - b.net) > cfg.matching.amountTolAbs) continue;
        const dd = Math.abs(U.daysBetween(a.paymentDate, b.paymentDate) || 0);
        if (dd > cfg.duplicates.paymentWindowDays) continue;
        const ia = P.inv.get(a.invoiceNo), ib = P.inv.get(b.invoiceNo);
        const invDup = ia && ib && dupInv.list.find((d) => (d.a === ia._key && d.b === ib._key) || (d.a === ib._key && d.b === ia._key));
        add(a, b, invDup ? 'HIGH-RISK DUPLICATE' : 'POSSIBLE DUPLICATE', ['sameSupplier', 'sameAmount', 'dateWithin:' + dd].concat(invDup ? ['invoicesAreDuplicates:' + invDup.level] : []));
      }
    }
    return out;
  };

  /* ---------------- Three-way match ---------------- */
  E.threeWay = (D, P, cfg, dupInv) => {
    const tol = cfg.matching;
    const res = new Map();
    // cumulative invoiced qty per PO+item in invoice-date order
    const consumed = new Map();
    const ordered = D.invoices.slice().sort((a, b) => ((a.invoiceDate || '') < (b.invoiceDate || '') ? -1 : (a.invoiceDate || '') > (b.invoiceDate || '') ? 1 : 0));
    for (const inv of ordered) {
      const r = { status: null, flags: [], reasons: [], checks: {}, lines: [], poAmount: null, grnAmount: null, invAmount: inv.subtotal != null ? inv.subtotal : inv.total, variance: null, variancePct: null, basis: null, poNo: inv.poNo || null, grnNos: [] };
      res.set(inv._key, r);
      if (inv._closed) { r.status = 'EXCEPTION'; r.flags.push('EXCEPTION'); r.reasons.push('invoiceClosed:' + inv.status); continue; }
      const dup = dupInv.byInv.get(inv._key);
      if (dup && dup.level !== 'POSSIBLE DUPLICATE' && dup.b === inv._key) { r.flags.push('DUPLICATE'); r.reasons.push('duplicateOf:' + dup.aNo + ':' + dup.level); }
      if (inv.total != null && inv.total < 0) { r.flags.push('EXCEPTION'); r.reasons.push('creditNote'); }
      if (!inv.poNo) { r.flags.push('MISSING PO'); r.reasons.push('noPOReference'); }
      const po = inv.poNo ? P.po.get(inv.poNo) : null;
      if (inv.poNo && !po) { r.flags.push('MISSING PO'); r.reasons.push('poNotInRegister:' + inv.poNo); }
      if (po) {
        r.poAmount = po.amount != null ? po.amount : po._total;
        r.checks.supplier = po.supplierId === inv.supplierId;
        if (!r.checks.supplier) { r.flags.push('EXCEPTION'); r.reasons.push('supplierMismatch:' + po.supplierId); }
        r.checks.currency = !po.currency || !inv.currency || po.currency === inv.currency;
        if (!r.checks.currency) { r.flags.push('EXCEPTION'); r.reasons.push('currencyMismatch:' + po.currency + '≠' + inv.currency); }
        if (['Cancelled', 'Closed'].includes(po.status)) { r.flags.push('EXCEPTION'); r.reasons.push('poStatus:' + po.status); }
        const grns = P.grnsByPo.get(po.poNo) || [];
        r.grnNos = grns.map((g) => g.grnNo);
        if (!grns.length) { r.flags.push('MISSING GRN'); r.reasons.push('noReceiptForPO'); }
        // delivery timing (informational)
        if (grns.length && po.requiredDate) {
          const lastRec = grns.map((g) => g.receiptDate).filter(Boolean).sort().pop();
          r.checks.delivery = lastRec ? lastRec <= po.requiredDate : null;
          if (lastRec && lastRec > po.requiredDate) r.reasons.push('lateDelivery:' + U.daysBetween(po.requiredDate, lastRec));
        }
        const pl = P.poLines.get(po.poNo) || [];
        const il = P.invLines.get(inv.invoiceNo) || [];
        const gl = P.grnLinesByPo.get(po.poNo) || [];
        const isDupCopy = r.flags.includes('DUPLICATE');
        if (pl.length && il.length) {
          r.basis = 'line';
          let grnVal = 0, ok = true;
          r.poAmount = U.round(U.sum(pl, (l) => l.qty * l.unitPrice), 2);
          r.grnAmount = U.round(U.sum(gl, (g) => { const p = pl.find((x) => x.itemCode === g.itemCode); return p ? (g.qtyAccepted != null ? g.qtyAccepted : g.qtyReceived) * p.unitPrice : 0; }), 2);
          for (const l of il) {
            const p = pl.find((x) => x.itemCode === l.itemCode);
            const line = { itemCode: l.itemCode, invQty: l.qty, invPrice: l.unitPrice, poQty: p ? p.qty : null, poPrice: p ? p.unitPrice : null, recQty: null, availQty: null, priceVarPct: null, qtyVar: null, status: 'MATCHED' };
            r.lines.push(line);
            if (!p) { line.status = 'EXCEPTION'; r.flags.push('EXCEPTION'); r.reasons.push('itemNotOnPO:' + l.itemCode); ok = false; continue; }
            const rec = U.sum(gl.filter((g) => g.itemCode === l.itemCode), (g) => (g.qtyAccepted != null ? g.qtyAccepted : g.qtyReceived));
            const ck = po.poNo + '|' + l.itemCode;
            const prior = consumed.get(ck) || 0;
            line.recQty = rec; line.availQty = Math.max(0, rec - prior);
            if (!isDupCopy) consumed.set(ck, prior + (l.qty || 0));
            line.priceVarPct = p.unitPrice ? U.round(((l.unitPrice - p.unitPrice) / p.unitPrice) * 100, 2) : null;
            if (line.priceVarPct != null && line.priceVarPct > tol.priceTolPct) { line.status = 'PRICE VARIANCE'; r.flags.push('PRICE VARIANCE'); r.reasons.push(`priceVariance:${l.itemCode}:${line.priceVarPct}`); }
            if (gl.length && l.qty > line.availQty * (1 + tol.qtyTolPct / 100) + 1e-9) { line.qtyVar = U.round(l.qty - line.availQty, 3); line.status = line.status === 'MATCHED' ? 'QUANTITY VARIANCE' : line.status; r.flags.push('QUANTITY VARIANCE'); r.reasons.push(`qtyVariance:${l.itemCode}:${line.qtyVar}`); }
            grnVal += Math.min(l.qty, line.availQty) * p.unitPrice;
          }
          const expected = U.round(grnVal, 2);
          r.expectedValue = gl.length ? expected : null;
          if (r.expectedValue != null && r.invAmount != null) {
            r.variance = U.round(r.invAmount - r.expectedValue, 2);
            r.variancePct = r.expectedValue ? U.round((r.variance / r.expectedValue) * 100, 2) : null;
          }
          void ok;
        } else {
          r.basis = 'header';
          if (gl.length && pl.length) r.grnAmount = U.round(U.sum(gl, (g) => { const p = pl.find((x) => x.itemCode === g.itemCode); return p ? (g.qtyAccepted != null ? g.qtyAccepted : g.qtyReceived) * p.unitPrice : 0; }), 2);
          const cum = U.sum((P.invByPo.get(po.poNo) || []).filter((x) => !x._closed && (x.invoiceDate || '') <= (inv.invoiceDate || '')), (x) => x.subtotal != null ? x.subtotal : x.total);
          const ref = r.grnAmount != null ? r.grnAmount : r.poAmount;
          if (ref != null && cum > ref * (1 + tol.priceTolPct / 100) + tol.amountTolAbs) { r.flags.push(r.grnAmount != null ? 'QUANTITY VARIANCE' : 'PRICE VARIANCE'); r.reasons.push('cumulativeInvoicedExceeds:' + (r.grnAmount != null ? 'GRN' : 'PO')); }
          if (ref != null && r.invAmount != null) { r.variance = U.round(r.invAmount - ref, 2); r.variancePct = ref ? U.round((r.variance / ref) * 100, 2) : null; }
          if (!r.flags.length) { r.flags.push('PARTIALLY MATCHED'); r.reasons.push('headerOnlyNoLineData'); }
        }
        // tax rate vs PO
        const poRate = po.amount ? (po.tax || 0) / po.amount : null;
        const invRate = inv.subtotal ? (inv.tax || 0) / inv.subtotal : null;
        if (poRate != null && invRate != null && Math.abs(poRate - invRate) * 100 > tol.taxTolPct) { r.flags.push('TAX VARIANCE'); r.reasons.push(`taxRate:${U.round(invRate * 100, 2)}%≠PO ${U.round(poRate * 100, 2)}%`); }
      }
      r.status = E.MATCH_ORDER.find((s) => r.flags.includes(s)) || 'MATCHED';
    }
    return res;
  };
})(typeof window !== 'undefined' ? window : globalThis);
