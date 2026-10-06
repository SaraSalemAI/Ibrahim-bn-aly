/* SUMED P2P — supplier documents & onboarding, contracts, spend analytics & concentration,
 * explainable supplier risk score, weighted performance scorecards. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const E = (S.engine = S.engine || {});

  /* ---------------- Documents ---------------- */
  E.supplierDocs = (D, P, cfg, asOf) => {
    const out = new Map();
    for (const s of D.suppliers) {
      const docs = P.docsBySup.get(s.supplierId) || [];
      const items = cfg.requiredDocs.map((type) => {
        const ds = docs.filter((d) => String(d.docType || '').toLowerCase() === type.toLowerCase());
        const d = ds.sort((a, b) => ((a.expiryDate || '9') < (b.expiryDate || '9') ? 1 : -1))[0];
        let status;
        if (!d) status = 'Missing';
        else if (/reject/i.test(d.status || '')) status = 'Rejected';
        else if (/pending|review/i.test(d.status || '')) status = 'Pending Review';
        else if (d.expiryDate && d.expiryDate < asOf) status = 'Expired';
        else status = 'Complete';
        const expiring = d && d.expiryDate && status === 'Complete' && U.daysBetween(asOf, d.expiryDate) <= cfg.alerts.docExpiryDays;
        return { type, status, doc: d || null, expiring, daysToExpiry: d && d.expiryDate ? U.daysBetween(asOf, d.expiryDate) : null };
      });
      const complete = items.filter((x) => x.status === 'Complete').length;
      out.set(s.supplierId, { items, complete, total: items.length, pct: Math.round((complete / items.length) * 100), missing: items.filter((x) => x.status === 'Missing').map((x) => x.type), expired: items.filter((x) => x.status === 'Expired').map((x) => x.type), overall: complete === items.length ? 'Complete' : items.some((x) => x.status === 'Expired') ? 'Expired' : items.some((x) => x.status === 'Rejected') ? 'Rejected' : 'Incomplete' });
    }
    return out;
  };

  E.ONBOARDING_STAGES = ['request', 'screening', 'documentation', 'tax', 'bank', 'compliance', 'procurement', 'finance', 'approval', 'activation'];
  E.onboarding = (D, P, cfg, docs) => D.suppliers.map((s) => {
    const dc = docs.get(s.supplierId);
    const has = (t) => dc && dc.items.find((x) => x.type === t && x.status === 'Complete');
    const stageNo = s.onboardingStage != null ? s.onboardingStage : /approved|active/i.test(s.approvedStatus || '') ? 10 : null;
    const st = {};
    st.request = { ok: true, ev: 'Supplier record exists' };
    st.screening = { ok: !!(s.name && s.country), ev: 'Name/country present' };
    st.documentation = { ok: dc ? dc.overall === 'Complete' : false, ev: dc ? `${dc.complete}/${dc.total} documents complete` : 'No documents' };
    st.tax = { ok: !!(s.taxId && has('Tax Card')), ev: s.taxId ? 'Tax ID present' + (has('Tax Card') ? ' + tax card' : ', tax card missing') : 'Tax ID missing' };
    const iv = U.ibanValid(s.iban);
    st.bank = { ok: !!(s.iban && iv !== false && has('Bank Certificate')), ev: !s.iban ? 'IBAN missing' : iv === false ? 'IBAN checksum invalid' : has('Bank Certificate') ? 'IBAN valid + bank certificate' : 'Bank certificate missing' };
    st.compliance = { ok: /clear/i.test(s.sanctionsStatus || '') && /compliant/i.test(s.complianceStatus || '') && !/non/i.test(s.complianceStatus || ''), ev: `Sanctions: ${s.sanctionsStatus || 'Not Available'} · Compliance: ${s.complianceStatus || 'Not Available'}` };
    st.procurement = { ok: stageNo != null && stageNo >= 7, ev: 'Stage ' + (stageNo == null ? 'Not Available' : stageNo) };
    st.finance = { ok: stageNo != null && stageNo >= 8, ev: 'Stage ' + (stageNo == null ? 'Not Available' : stageNo) };
    st.approval = { ok: !!s.approvedBy && /approved|active/i.test(s.approvedStatus || ''), ev: s.approvedBy ? 'Approved by ' + s.approvedBy : 'No approver recorded' };
    st.activation = { ok: /approved|active/i.test(s.approvedStatus || ''), ev: 'Status: ' + (s.approvedStatus || 'Not Available') };
    const firstGap = E.ONBOARDING_STAGES.find((k) => !st[k].ok);
    return { supplier: s, stageNo, stages: st, firstGap, active: st.activation.ok, docs: dc };
  });

  /* ---------------- Spend ---------------- */
  E.spend = (D, P, cfg, asOf) => {
    const from = U.addDays(asOf, -364);
    let rows, basisLabel;
    if (cfg.spendBasis === 'paid') {
      rows = D.payments.filter((p) => p._isPaid && p.paymentDate >= from && p.paymentDate <= asOf).map((p) => {
        const inv = P.inv.get(p.invoiceNo) || {};
        return { rec: p, date: p.paymentDate, supplierId: p.supplierId, amountBase: p._grossBase, category: inv.category || (P.sup.get(p.supplierId) || {}).category, department: inv.department, costCenter: inv.costCenter, project: inv.project, contractId: inv.contractId, currency: p.currency, nonPO: !inv.poNo, emergency: !!(inv.emergency || p.urgent), inv };
      });
      basisLabel = 'Paid basis: executed/reconciled payments (gross), last 12 months';
    } else {
      rows = D.invoices.filter((i) => !i._closed && i.invoiceDate && i.invoiceDate >= from && i.invoiceDate <= asOf && i.total != null).map((i) => ({ rec: i, date: i.invoiceDate, supplierId: i.supplierId, amountBase: i._subBase != null ? i._subBase : i._totalBase, category: i.category || (P.sup.get(i.supplierId) || {}).category, department: i.department, costCenter: i.costCenter, project: i.project, contractId: i.contractId, currency: i.currency, nonPO: !i.poNo, emergency: !!i.emergency, inv: i }));
      basisLabel = 'Invoiced basis: invoice amounts net of tax, last 12 months (invoice date)';
    }
    const conv = rows.filter((r) => r.amountBase != null);
    const noFx = rows.filter((r) => r.amountBase == null);
    const total = U.sum(conv, (r) => r.amountBase);
    // off-contract: invoice outside its contract window, or supplier with active contracts but invoice has none (and > threshold not applied)
    for (const r of conv) {
      const c = r.contractId ? P.contract.get(r.contractId) : null;
      r.offContract = c ? (c.startDate && r.date < c.startDate) || (c.endDate && r.date > c.endDate) : false;
      const s = P.sup.get(r.supplierId);
      r.unapprovedSupplier = !s || !/approved|active/i.test(s.approvedStatus || '');
      r.maverick = r.nonPO || r.offContract || r.unapprovedSupplier;
    }
    const by = (dim) => Array.from(U.groupBy(conv, (r) => r[dim] || '—').entries()).map(([k, rs]) => ({ key: k, amount: U.sum(rs, (r) => r.amountBase), count: rs.length, rows: rs })).sort((a, b) => b.amount - a.amount);
    const bySupplier = by('supplierId').map((x) => ({ ...x, name: (P.sup.get(x.key) || {}).name || (x.rows[0].inv && x.rows[0].inv.supplierName) || x.key, share: total ? (x.amount / total) * 100 : null }));
    const byMonth = Array.from(U.groupBy(conv, (r) => r.date.slice(0, 7)).entries()).map(([k, rs]) => ({ key: k, amount: U.sum(rs, (r) => r.amountBase), rows: rs })).sort((a, b) => (a.key < b.key ? -1 : 1));
    const byQuarter = Array.from(U.groupBy(conv, (r) => U.quarter(r.date)).entries()).map(([k, rs]) => ({ key: k, amount: U.sum(rs, (r) => r.amountBase), rows: rs })).sort((a, b) => (a.key < b.key ? -1 : 1));
    const topN = (n) => U.sum(bySupplier.slice(0, n), (x) => x.amount);
    const pct = (v) => (total ? U.round((v / total) * 100, 1) : null);
    const hhi = total ? Math.round(U.sum(bySupplier, (x) => Math.pow((x.amount / total) * 100, 2))) : null;
    const sumF = (f) => conv.filter(f);
    const nonPO = sumF((r) => r.nonPO), offC = sumF((r) => r.offContract), mav = sumF((r) => r.maverick), emer = sumF((r) => r.emergency), contract = sumF((r) => !!r.contractId);
    const cc = cfg.concentration;
    const L = {};
    const mk = (key, label, rs, formula) => (L[key] = E.lineage({ label, value: U.round(U.sum(rs, (r) => r.amountBase), 2), unit: cfg.baseCurrency, formula, rows: rs.map((r) => r.rec), route: 'spend', note: basisLabel }));
    mk('totalSpend', 'Total supplier spend (12 months)', conv, 'SUM(amount × FX at document date)');
    mk('nonPOSpend', 'Non-PO spend', nonPO, 'SUM(spend) WHERE no PO reference');
    mk('offContractSpend', 'Off-contract spend', offC, 'SUM(spend) WHERE document date outside referenced contract window');
    mk('maverickSpend', 'Maverick spend', mav, 'SUM(spend) WHERE non-PO OR off-contract OR supplier not approved');
    mk('emergencySpend', 'Emergency spend', emer, 'SUM(spend) WHERE emergency/urgent flag');
    mk('contractSpend', 'Contract spend', contract, 'SUM(spend) WHERE contract reference present');
    if (noFx.length) L.totalSpend.excluded.push({ reason: 'FX RATE NOT AVAILABLE', count: noFx.length, detail: noFx.map((r) => `${r.rec.invoiceNo || r.rec.paymentId}: ${r.currency}`).join('; ') });
    const conc = { top5: pct(topN(5)), top10: pct(topN(10)), top20: pct(topN(20)), hhi, flags: [] };
    if (conc.top5 != null && conc.top5 > cc.top5Pct) conc.flags.push({ key: 'top5', value: conc.top5, threshold: cc.top5Pct });
    if (conc.top10 != null && conc.top10 > cc.top10Pct) conc.flags.push({ key: 'top10', value: conc.top10, threshold: cc.top10Pct });
    bySupplier.filter((x) => x.share > cc.singleSupplierPct).forEach((x) => conc.flags.push({ key: 'single', supplierId: x.key, name: x.name, value: U.round(x.share, 1), threshold: cc.singleSupplierPct }));
    L.top5 = E.lineage({ label: 'Top-5 supplier concentration', value: conc.top5, unit: '%', formula: 'Σ spend of 5 largest suppliers ÷ total spend', inputs: bySupplier.slice(0, 5).map((x) => ({ label: x.name, value: U.round(x.amount, 0) })), rows: bySupplier.slice(0, 5).flatMap((x) => x.rows.map((r) => r.rec)), route: 'spend' });
    return { rows: conv, noFx, total, basisLabel, bySupplier, byCategory: by('category'), byDepartment: by('department'), byCostCenter: by('costCenter'), byProject: by('project'), byContract: by('contractId'), byCurrency: by('currency'), byMonth, byQuarter, conc, lineage: L, from, to: asOf, nonPO, offC, mav, emer };
  };

  /* ---------------- Contracts ---------------- */
  E.contracts = (D, P, cfg, asOf, spend) => {
    const res = D.contracts.map((c) => {
      const viaPO = new Set(D.pos.filter((p) => p.contractId === c.contractId).map((p) => p.poNo));
      const invs = D.invoices.filter((i) => !i._closed && (i.contractId === c.contractId || (i.poNo && viaPO.has(i.poNo))) && i.currency === c.currency);
      const used = U.sum(invs, (i) => i.subtotal != null ? i.subtotal : i.total);
      const remainingValue = c.value != null ? c.value - used : null;
      const util = c.value ? (used / c.value) * 100 : null;
      const remainingDays = c.endDate ? U.daysBetween(asOf, c.endDate) : null;
      const alerts = [];
      if (remainingDays != null && remainingDays < 0) alerts.push('expired');
      else if (remainingDays != null && remainingDays <= cfg.alerts.contractExpiryDays) alerts.push('expiring');
      if (util != null && util > 100) alerts.push('exceeded');
      else if (util != null && util >= cfg.alerts.poNearLimitPct) alerts.push('nearlyExhausted');
      const outside = invs.filter((i) => i.invoiceDate && ((c.startDate && i.invoiceDate < c.startDate) || (c.endDate && i.invoiceDate > c.endDate)));
      if (outside.length) alerts.push('invoiceOutside');
      const poOutside = D.pos.filter((p) => p.contractId === c.contractId && p.poDate && ((c.startDate && p.poDate < c.startDate) || (c.endDate && p.poDate > c.endDate)));
      if (poOutside.length) alerts.push('poOutside');
      const status = remainingDays != null && remainingDays < 0 ? 'Expired' : c.status || 'Active';
      return { c, invs, used: U.round(used, 2), remainingValue: U.round(remainingValue, 2), util: U.round(util, 1), remainingDays, alerts, outside, poOutside, status };
    });
    // Missing contract: critical/strategic suppliers or those above single-supplier concentration with spend but no contract
    const withC = new Set(D.contracts.map((c) => c.supplierId));
    const missing = spend.bySupplier.filter((x) => !withC.has(x.key) && P.sup.get(x.key) && ((P.sup.get(x.key).critical || P.sup.get(x.key).strategic) || x.share >= 5)).map((x) => ({ supplierId: x.key, name: x.name, spend: x.amount, share: x.share }));
    return { list: res, missing };
  };

  /* ---------------- Supplier performance ---------------- */
  E.performance = (D, P, cfg, ctx) => {
    const W = cfg.performance.weights;
    const bands = cfg.performance.bands;
    const evalBy = U.groupBy(D.evaluations, 'supplierId');
    const posBy = U.groupBy(D.pos, 'supplierId');
    const grnsBySup = U.groupBy(D.grns.map((g) => ({ g, sid: g.supplierId || (P.po.get(g.poNo) || {}).supplierId })), 'sid');
    const glByGrn = U.groupBy(D.grnLines, 'grnNo');
    const invBy = U.groupBy(D.invoices.filter((i) => !i._closed && i.total > 0), 'supplierId');
    const rfqBy = U.groupBy(D.rfqs.filter((r) => r.quoteAmount > 0), 'supplierId');
    const rfqByNo = U.groupBy(D.rfqs.filter((r) => r.quoteAmount > 0), 'rfqNo');
    const payBy = U.groupBy(D.payments.filter((p) => p._isPaid && p.invoiceNo), 'supplierId');
    const dispBy = U.groupBy(D.disputes, 'supplierId');
    const out = new Map();
    for (const s of D.suppliers) {
      const sid = s.supplierId;
      const grns = (grnsBySup.get(sid) || []).map((x) => x.g);
      const invs = invBy.get(sid) || [];
      const m = {};
      const ev = {};
      const withReq = grns.filter((g) => { const po = P.po.get(g.poNo); return po && po.requiredDate && g.receiptDate; });
      if (withReq.length) { const ok = withReq.filter((g) => g.receiptDate <= P.po.get(g.poNo).requiredDate).length; m.otd = (ok / withReq.length) * 100; ev.otd = `${ok}/${withReq.length} receipts on/before required date`; }
      const gl = grns.flatMap((g) => glByGrn.get(g.grnNo) || []);
      const rec = U.sum(gl, (l) => l.qtyReceived);
      if (rec > 0 && gl.some((l) => l.qtyAccepted != null)) { const acc = U.sum(gl, (l) => (l.qtyAccepted != null ? l.qtyAccepted : l.qtyReceived)); m.quality = (acc / rec) * 100; ev.quality = `${acc}/${rec} units accepted`; }
      const rfq = rfqBy.get(sid) || [];
      if (rfq.length) {
        const ratios = rfq.map((r) => { const peers = (rfqByNo.get(r.rfqNo) || []).filter((x) => x.currency === r.currency); const min = Math.min(...peers.map((x) => x.quoteAmount)); return peers.length > 1 ? min / r.quoteAmount : null; }).filter((x) => x != null);
        if (ratios.length) { m.price = (U.sum(ratios) / ratios.length) * 100; ev.price = `${ratios.length} competitive RFQ(s): lowest quote ÷ supplier quote`; }
      }
      if (invs.length) {
        const ms = invs.map((i) => ctx.match.get(i._key)).filter(Boolean);
        const good = ms.filter((x) => ['MATCHED', 'PARTIALLY MATCHED'].includes(x.status)).length;
        const poInv = invs.filter((i) => i.poNo);
        m.invoiceAccuracy = (good / invs.length) * 100; ev.invoiceAccuracy = `${good}/${invs.length} invoices matched`;
        m.poCompliance = (poInv.length / invs.length) * 100; ev.poCompliance = `${poInv.length}/${invs.length} invoices reference a PO`;
        if (poInv.length) { const g = poInv.filter((i) => (P.grnsByPo.get(i.poNo) || []).length).length; m.grnCompliance = (g / poInv.length) * 100; ev.grnCompliance = `${g}/${poInv.length} PO invoices have a GRN`; }
        const disp = (dispBy.get(sid) || []).length;
        m.disputes = Math.max(0, 100 - (disp / invs.length) * 100 * 5); ev.disputes = `${disp} dispute(s) on ${invs.length} invoices (−5 pts per 1% rate)`;
        const withC = invs.filter((i) => i.contractId);
        if (withC.length) { const okc = withC.filter((i) => { const c = P.contract.get(i.contractId); return c && (!c.endDate || i.invoiceDate <= c.endDate) && (!c.startDate || i.invoiceDate >= c.startDate); }).length; m.contract = (okc / withC.length) * 100; ev.contract = `${okc}/${withC.length} contract invoices inside contract window`; }
      }
      const pays = payBy.get(sid) || [];
      if (pays.length) { const ok = pays.filter((p) => { const i = P.inv.get(p.invoiceNo); return i && Math.abs((i.total - (i.wht || 0)) - p.net) <= Math.max(1, Math.abs(p.net) * 0.001); }).length; m.paymentAccuracy = (ok / pays.length) * 100; ev.paymentAccuracy = `${ok}/${pays.length} payments equal invoice net`; }
      const e = (evalBy.get(sid) || []).slice(-1)[0];
      if (e && e.responsiveness != null) { m.responsiveness = e.responsiveness; ev.responsiveness = 'Evaluation file: ' + (e.period || ''); }
      if (e && e.reliability != null) { m.reliability = e.reliability; ev.reliability = 'Evaluation file: ' + (e.period || ''); }
      let num = 0, den = 0;
      Object.keys(W).forEach((k) => { if (m[k] != null) { num += m[k] * W[k]; den += W[k]; } });
      const score = den ? Math.round(num / den) : null;
      const coverage = Math.round((den / U.sum(Object.values(W))) * 100);
      const band = score == null ? null : score >= bands.excellent ? 'Excellent' : score >= bands.good ? 'Good' : score >= bands.watch ? 'Watch' : score >= bands.poor ? 'Poor' : 'Critical';
      out.set(sid, { metrics: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, U.round(v, 1)])), evidence: ev, score, band, coverage, unavailable: Object.keys(W).filter((k) => m[k] == null), lateCount: withReq.filter((g) => g.receiptDate > P.po.get(g.poNo).requiredDate).length, rejectedQty: U.sum(gl, (l) => l.qtyRejected || 0) });
    }
    return out;
  };

  /* ---------------- Explainable supplier risk ---------------- */
  E.supplierRisk = (D, P, cfg, asOf, ctx) => {
    const R = cfg.risk;
    const out = new Map();
    const shareBy = new Map(ctx.spend.bySupplier.map((x) => [x.key, x.share]));
    const invBySup = U.groupBy(D.invoices.filter((i) => !i._closed && i.total > 0), 'supplierId');
    const openPoByCon = new Set(D.pos.filter((p) => p.contractId && !['Closed', 'Cancelled', 'Fully Paid'].includes(p.status)).map((p) => p.supplierId + '|' + p.contractId));
    const apBySup = new Map(ctx.aging.bySup.map((x) => [x.supplierId, x]));
    const totalAP = ctx.aging.total;
    for (const s of D.suppliers) {
      const sid = s.supplierId;
      const drivers = [];
      const add = (key, pts, params, rows) => drivers.push({ key, points: pts, params: params || {}, rows: (rows || []).filter(Boolean) });
      let evaluated = 0, possible = 0;
      const ev = (cond) => { possible++; if (cond) evaluated++; return cond; };
      // Spend concentration / financial exposure
      if (ev(shareBy.has(sid) || ctx.spend.total > 0)) {
        const sh = shareBy.get(sid) || 0;
        if (sh >= R.spendShareCriticalPct) add('spendShare', 20, { pct: U.round(sh, 1) });
        else if (sh >= R.spendShareHighPct) add('spendShare', 12, { pct: U.round(sh, 1) });
      }
      const apRow = apBySup.get(sid);
      if (ev(true) && apRow && totalAP && apRow.total / totalAP >= 0.1) add('apExposure', 8, { pct: U.round((apRow.total / totalAP) * 100, 1) }, apRow.rows);
      if (ev(true) && apRow && apRow.overdue > 0) add('overdueBalance', 5, { amount: Math.round(apRow.overdue) }, apRow.rows.filter((r) => r._dpd > 0));
      // Dependency flags (source values)
      if (ev(s.critical != null)) { if (s.critical) add('critical', 8, {}, [s]); }
      if (ev(s.singleSource != null)) { if (s.singleSource) add('singleSource', 10, {}, [s]); }
      // Contract
      const cons = (P.contractsBySup.get(sid) || []);
      if (ev(cons.length > 0 || true)) {
        for (const c of cons) {
          const days = c.endDate ? U.daysBetween(asOf, c.endDate) : null;
          const openPO = openPoByCon.has(sid + '|' + c.contractId);
          if (days != null && days < 0 && openPO) add('contractExpiredOpenPO', 12, { contract: c.contractId, days: -days }, [c]);
          else if (days != null && days >= 0 && days <= R.contractExpiryDays) add('contractExpiring', 10, { contract: c.contractId, days }, [c]);
        }
      }
      // Delivery & quality
      const perf = ctx.perf.get(sid);
      if (ev(perf && perf.metrics.otd != null)) { if (perf.lateCount >= 2) add('lateDeliveries', Math.min(15, perf.lateCount * 3), { count: perf.lateCount }); }
      if (ev(perf && perf.metrics.quality != null)) { if (perf.rejectedQty > 0) add('qualityIssues', Math.min(10, 4 + Math.round(perf.rejectedQty / 10)), { qty: perf.rejectedQty }); }
      if (ev(perf && perf.score != null)) { if (perf.score < 60) add('performanceLow', 8, { score: perf.score }); }
      // Invoice exceptions & pricing
      const invs = invBySup.get(sid) || [];
      if (ev(invs.length > 0)) {
        const exc = invs.filter((i) => { const m = ctx.match.get(i._key); return m && !['MATCHED', 'PARTIALLY MATCHED', 'MISSING PO'].includes(m.status); });
        const rate = (exc.length / invs.length) * 100;
        if (rate >= R.exceptionRateHighPct) add('exceptionRate', 10, { pct: U.round(rate, 0), n: exc.length, total: invs.length }, exc);
        const pv = invs.filter((i) => { const m = ctx.match.get(i._key); return m && m.flags.includes('PRICE VARIANCE'); });
        if (pv.length) add('pricingAnomaly', 6, { n: pv.length }, pv);
      }
      // Bank changes
      const chg = (P.bankChgBySup.get(sid) || []).filter((c) => c.changeDate && U.daysBetween(c.changeDate, asOf) <= R.bankChangeLookbackDays);
      if (ev(true)) {
        if (chg.length) add('bankChanged', 12 + (chg.length > 1 ? 5 : 0), { n: chg.length, days: R.bankChangeLookbackDays, unverified: chg.filter((c) => c.verified === false).length }, chg);
        else if (s.bankChangedOn && U.daysBetween(s.bankChangedOn, asOf) <= R.bankChangeLookbackDays) add('bankChanged', 12, { n: 1, days: R.bankChangeLookbackDays, unverified: 0 }, [s]);
      }
      // Tax & compliance
      if (ev(true)) { if (!s.taxId) add('taxIdMissing', 8, {}, [s]); }
      if (ev(s.sanctionsStatus != null || s.complianceStatus != null)) {
        if (s.sanctionsStatus && !/clear/i.test(s.sanctionsStatus)) add('sanctionsNotCleared', 15, { status: s.sanctionsStatus }, [s]);
        if (s.complianceStatus && /non|fail|reject/i.test(s.complianceStatus)) add('nonCompliant', 20, { status: s.complianceStatus }, [s]);
      }
      const dc = ctx.docs.get(sid);
      if (ev(!!dc)) {
        if (dc.expired.length) add('docsExpired', Math.min(10, dc.expired.length * 5), { docs: dc.expired.join(', ') });
        if (dc.missing.length) add('docsMissing', Math.min(10, dc.missing.length * 2), { docs: dc.missing.join(', ') });
      }
      if (ev(s.insuranceExpiry != null || s.insuranceStatus != null)) { if ((s.insuranceExpiry && s.insuranceExpiry < asOf) || /expired/i.test(s.insuranceStatus || '')) add('insuranceExpired', 6, { date: s.insuranceExpiry }, [s]); }
      if (ev(true) && s.approvedStatus && /block|inactive|suspend/i.test(s.approvedStatus)) add('blocked', 15, { status: s.approvedStatus }, [s]);
      // Unusual transaction behaviour (from fraud engine)
      const al = (ctx.alertsBySup && ctx.alertsBySup.get(sid)) || [];
      if (ev(true) && al.length) add('anomalies', Math.min(15, al.length * 4), { n: al.length });
      const score = Math.min(100, U.sum(drivers, (d) => d.points));
      const b = R.bands;
      const rating = score >= b.critical ? 'CRITICAL' : score >= b.high ? 'HIGH' : score >= b.medium ? 'MEDIUM' : 'LOW';
      drivers.sort((x, y) => y.points - x.points);
      out.set(sid, { score, rating, drivers, completeness: possible ? Math.round((evaluated / possible) * 100) : 0 });
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
