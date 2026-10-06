/* SUMED P2P — supplier views: master, 360° profile, onboarding, performance, risk & compliance. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui, C = S.chart;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const V = (S.views = S.views || {});
  const ccy = () => S.state.config.baseCurrency;

  const supStats = (sid) => {
    const R = S.R, D = S.state.data;
    const sp = R.spend.bySupplier.find((x) => x.key === sid);
    const ap = R.aging.bySup.find((x) => x.supplierId === sid);
    const pays = D.payments.filter((p) => p.supplierId === sid && p._isPaid).sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));
    return { spend: sp ? sp.amount : 0, share: sp ? sp.share : 0, out: ap ? ap.total : 0, overdue: ap ? ap.overdue : 0, lastPay: pays[0] ? pays[0].paymentDate : null, pays };
  };
  V.supStats = supStats;
  const name = (s) => (S.isAr() ? s.nameAr || s.name : s.name);
  const flags = (s) => [s.critical && `<span class="pill p-crit">${esc(t('sup.critical', 'Critical'))}</span>`, s.strategic && `<span class="pill">${esc(t('sup.strategic', 'Strategic'))}</span>`, s.singleSource && `<span class="pill p-warn">${esc(t('sup.single', 'Single-source'))}</span>`].filter(Boolean).join(' ');

  /* ------------------------------ SUPPLIER MASTER ------------------------------ */
  V.suppliers = {
    title: () => t('nav.suppliers', 'Suppliers'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.suppliers.length) return UI.empty(t('sup.none', 'No supplier master loaded.'));
      const rows = D.suppliers.map((s) => Object.assign({ s }, supStats(s.supplierId), { risk: R.risk.get(s.supplierId), perf: R.perf.get(s.supplierId), docs: R.docs.get(s.supplierId), _key: s._key }));
      return `<div class="page-h"><div><h1>${esc(t('nav.suppliers', 'Suppliers'))}</h1><p class="muted">${esc(t('sup.sub', 'Supplier master with risk, performance, exposure and compliance. Bank details are masked.'))} ${UI.demoTag()}</p></div>
        <div class="btn-row"><button class="btn" data-nav="onboarding">${esc(t('nav.onboarding', 'Supplier Onboarding'))} ›</button></div></div>
        <div class="kpis">${UI.kpi('supplierCount')}${UI.kpi('activeSuppliers')}${UI.kpi('criticalSuppliers')}${UI.kpi('highRiskSuppliers')}${UI.kpi('avgRiskScore')}${UI.kpi('top5')}</div>
        ${UI.section('', UI.table('suppliers', [
          { key: 'id', label: t('f.supplierId', 'Supplier ID'), render: (r) => esc(r.s.supplierId), sort: (r) => r.s.supplierId },
          { key: 'name', label: t('f.name', 'Supplier name'), render: (r) => `<b>${esc(name(r.s))}</b><div class="small muted">${esc(S.isAr() ? r.s.name : r.s.nameAr || '')}</div>`, sort: (r) => name(r.s) },
          { key: 'cat', label: t('f.category', 'Category'), render: (r) => UI.v(r.s.category), sort: (r) => r.s.category },
          { key: 'country', label: t('f.country', 'Country'), render: (r) => UI.v(r.s.country), sort: (r) => r.s.country },
          { key: 'flags', label: t('sup.flags', 'Flags'), render: (r) => flags(r.s), sort: (r) => (r.s.critical ? 2 : 0) + (r.s.singleSource ? 1 : 0) },
          { key: 'status', label: t('common.status', 'Status'), render: (r) => UI.badge(r.s.approvedStatus), sort: (r) => r.s.approvedStatus },
          { key: 'risk', label: t('sup.risk', 'Risk'), render: (r) => (r.risk ? `${UI.badge(r.risk.rating, 'sev.')} <span class="num">${r.risk.score}</span>` : UI.na()), sort: (r) => (r.risk ? r.risk.score : -1) },
          { key: 'perf', label: t('sup.perf', 'Performance'), render: (r) => (r.perf && r.perf.score != null ? `<span class="num">${r.perf.score}</span> ${UI.badge(r.perf.band, 'band.')}` : UI.na('—')), sort: (r) => (r.perf ? r.perf.score : -1) },
          { key: 'spend', label: t('sup.spend', 'Spend (12m)'), num: true, render: (r) => UI.base(r.spend, { compact: true }), sort: (r) => r.spend },
          { key: 'out', label: t('sup.outstanding', 'Outstanding AP'), num: true, render: (r) => UI.base(r.out, { compact: true }), sort: (r) => r.out },
          { key: 'overdue', label: t('sup.overdue', 'Overdue AP'), num: true, render: (r) => UI.base(r.overdue, { compact: true }), sort: (r) => r.overdue },
          { key: 'last', label: t('sup.lastPay', 'Last payment'), render: (r) => UI.date(r.lastPay), sort: (r) => r.lastPay },
          { key: 'docs', label: t('sup.docs', 'Documents'), render: (r) => (r.docs ? `${UI.badge(r.docs.overall, 'doc.')} <span class="small">${r.docs.complete}/${r.docs.total}</span>` : UI.na()), sort: (r) => (r.docs ? r.docs.pct : -1) },
          { key: 'iban', label: 'IBAN', render: (r) => `<span class="mono">${esc(U.maskAccount(r.s.iban) || '—')}</span>`, csv: (r) => U.maskAccount(r.s.iban) },
        ], rows, { pageSize: 25, exportName: 'supplier_master', searchText: (r) => [r.s.name, r.s.nameAr, r.s.taxId, r.s.supplierId].join(' ') }))}`;
    },
  };

  /* ------------------------------ SUPPLIER 360 ------------------------------ */
  V.supplier = {
    title: () => t('sup.360', 'Supplier 360°'),
    render(id) {
      const R = S.R, D = S.state.data;
      const s = R.P.sup.get(decodeURIComponent(id || ''));
      if (!s) return `<p>${esc(t('sup.notFound', 'Supplier not found.'))}</p>`;
      const sid = s.supplierId;
      const st = supStats(sid);
      const risk = R.risk.get(sid), perf = R.perf.get(sid), docs = R.docs.get(sid);
      const invs = D.invoices.filter((i) => i.supplierId === sid);
      const pos = D.pos.filter((p) => p.supplierId === sid);
      const cons = R.contracts.list.filter((c) => c.c.supplierId === sid);
      const chg = D.bankChanges.filter((c) => c.supplierId === sid);
      const disp = D.disputes.filter((d) => d.supplierId === sid);
      const al = R.alerts.list.filter((a) => a.supplierId === sid || a.rows.includes(s));
      const trend = Array.from(U.groupBy(R.spend.rows.filter((r) => r.supplierId === sid), (r) => r.date.slice(0, 7)).entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
      const ob = R.onboarding.find((o) => o.supplier === s);
      const fieldsShown = ['supplierId', 'name', 'nameAr', 'type', 'category', 'classification', 'legalEntity', 'country', 'city', 'address', 'taxId', 'commercialReg', 'vatStatus', 'contactPerson', 'email', 'phone', 'website', 'currency', 'paymentTerms', 'creditTerms', 'contractStart', 'contractEnd', 'contractValue', 'poRequired', 'taxTreatment', 'whtApplicable', 'approvedStatus', 'onboardingDate', 'lastReviewDate', 'nextReviewDate', 'complianceStatus', 'sanctionsStatus', 'insuranceStatus', 'insuranceExpiry', 'createdBy', 'approvedBy'];
      const kv = (keys) => `<table class="kv">${keys.map((k) => `<tr><th>${esc(UI.fieldLabel(k))}</th><td>${UI.fieldValue(s, k)}</td></tr>`).join('')}</table>`;
      const explain = risk ? `<p class="explain"><b>${esc(t('risk.explain', 'Supplier risk is {r} ({s}/100) because:', { r: t('sev.' + risk.rating), s: risk.score }))}</b></p><ol class="drivers">${risk.drivers.map((d) => `<li><span class="pts">+${d.points}</span> ${esc(S.driverText(d))} ${d.rows.length ? UI.evBtn('driver', sid + '|' + d.key) : ''}</li>`).join('') || `<li class="muted">${esc(t('risk.noDrivers', 'No risk drivers detected in the available data.'))}</li>`}</ol><p class="muted small">${esc(t('risk.completeness', 'Evidence completeness: {p}% of risk factors could be evaluated from the uploaded data.', { p: risk.completeness }))}</p>` : '';
      return `<div class="page-h"><div><p class="muted"><a data-nav="suppliers">‹ ${esc(t('nav.suppliers', 'Suppliers'))}</a></p><h1>${esc(name(s))}</h1><p>${esc(sid)} · ${UI.v(s.category)} · ${UI.v(s.country)} ${UI.badge(s.approvedStatus)} ${flags(s)} ${UI.demoTag()}</p>${UI.srcLoc(s)}</div>
        <div class="btn-row"><button class="btn" data-act="bankChange" data-id="${esc(sid)}">🏦 ${esc(t('sup.reqBank', 'Request bank change'))}</button></div></div>
        <div class="kpis">
          <div class="kpi static"><span class="kpi-label">${esc(t('sup.spend', 'Spend (12m)'))}</span><span class="kpi-value">${UI.base(st.spend, { compact: true })}</span><span class="kpi-sub">${esc(S.fmt.pct(st.share))} ${esc(t('sup.ofTotal', 'of total'))}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('sup.outstanding', 'Outstanding AP'))}</span><span class="kpi-value">${UI.base(st.out, { compact: true })}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('sup.overdue', 'Overdue AP'))}</span><span class="kpi-value">${UI.base(st.overdue, { compact: true })}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('sup.risk', 'Risk'))}</span><span class="kpi-value">${risk ? risk.score + '<small>/100</small>' : '—'}</span><span class="kpi-sub">${risk ? UI.badge(risk.rating, 'sev.') : ''}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('sup.perf', 'Performance'))}</span><span class="kpi-value">${perf && perf.score != null ? perf.score + '<small>/100</small>' : UI.na('—')}</span><span class="kpi-sub">${perf && perf.band ? UI.badge(perf.band, 'band.') : ''}</span></div>
          <div class="kpi static"><span class="kpi-label">${esc(t('sup.lastPay', 'Last payment'))}</span><span class="kpi-value small">${UI.date(st.lastPay)}</span></div>
        </div>
        <div class="grid g2">
          ${UI.section(t('sup.riskTitle', 'Risk — explainable drivers'), explain)}
          ${UI.section(t('sup.trend', 'Historical spend trend ({c})', { c: ccy() }), C.bars(trend.map(([m, rs]) => ({ label: m, value: U.sum(rs, (r) => r.amountBase) })), { slot: 2 }))}
          ${UI.section(t('sup.overview', 'Supplier overview'), kv(fieldsShown))}
          ${UI.section(t('sup.bank', 'Bank information'), `${kv(['bankName', 'bankBranch', 'bankAccount', 'iban', 'swift', 'bankChangedOn'])}<p>${esc(t('sup.ibanCheck', 'IBAN checksum'))}: ${s.iban ? (U.ibanValid(s.iban) ? UI.badge('Valid') : UI.badge('Invalid')) : UI.na()}</p>
            <h4>${esc(t('sup.bankHist', 'Bank-detail change history'))}</h4>${chg.length ? `<table><thead><tr><th>${esc(t('f.changeDate', 'Date'))}</th><th>${esc(t('f.oldIban', 'Old'))}</th><th>${esc(t('f.newIban', 'New'))}</th><th>${esc(t('f.changedBy', 'Changed by'))}</th><th>${esc(t('f.approvedBy', 'Approved by'))}</th><th>${esc(t('f.verified', 'Verified'))}</th></tr></thead><tbody>${chg.map((c) => `<tr data-drill="${esc(c._key)}"><td>${UI.date(c.changeDate)}</td><td class="mono">${esc(U.maskAccount(c.oldIban))}</td><td class="mono">${esc(U.maskAccount(c.newIban))}</td><td>${UI.v(c.changedBy)}</td><td>${UI.v(c.approvedBy)}</td><td>${c.verified === false ? UI.badge('Unverified') : c.verified ? UI.badge('Verified') : UI.na()}</td></tr>`).join('')}</tbody></table>${chg.some((c) => c.verified === false) && S.can('approve.supplier') ? `<button class="btn" data-act="verifyBank" data-id="${esc(sid)}">${esc(t('sup.verifyBank', 'Record call-back verification'))}</button>` : ''}` : `<p class="muted">${esc(t('sup.noBankHist', 'No bank changes in source data.'))}</p>`}`)}
          ${UI.section(t('sup.perfTitle', 'Performance scorecard'), perf ? `<table class="kv">${Object.keys(S.state.config.performance.weights).map((k) => `<tr><th>${esc(t('pm.' + k))} <span class="muted small">(${esc(t('perf.w', 'w'))} ${S.state.config.performance.weights[k]})</span></th><td>${perf.metrics[k] != null ? UI.num(perf.metrics[k], 1) + ' ' + C.meter(100 - perf.metrics[k], { tone: perf.metrics[k] >= 85 ? 'good' : perf.metrics[k] >= 60 ? 'warning' : 'critical' }) : UI.na()}<div class="small muted">${esc(perf.evidence[k] || '')}</div></td></tr>`).join('')}</table><p class="muted small">${esc(t('perf.coverage', 'Weight coverage {p}% — unavailable metrics are excluded and weights renormalised.', { p: perf.coverage }))}</p>` : UI.na())}
          ${UI.section(t('sup.compliance', 'Compliance & documents'), docs ? `<table><thead><tr><th>${esc(t('doc.type', 'Document'))}</th><th>${esc(t('common.status', 'Status'))}</th><th>${esc(t('f.expiryDate', 'Expiry'))}</th></tr></thead><tbody>${docs.items.map((d) => `<tr ${d.doc ? `data-drill="${esc(d.doc._key)}"` : ''}><td>${esc(t('docname.' + d.type, d.type))}</td><td>${UI.badge(d.status, 'doc.')}${d.expiring ? ' ' + UI.badge(t('doc.expiringSoon', 'Expiring soon')) : ''}</td><td>${d.doc ? UI.date(d.doc.expiryDate) : '—'}</td></tr>`).join('')}</tbody></table>` : UI.na())}
          ${ob ? UI.section(t('nav.onboarding', 'Supplier Onboarding'), V.obStages(ob)) : ''}
          ${UI.section(t('sup.redflags', 'Red flags'), al.length ? al.map((a) => `<div class="flag">${UI.sev(a.severity)} ${esc(S.alertText(a))} ${UI.evBtn('alert', a.id)}</div>`).join('') : `<p class="muted">${esc(t('sup.noFlags', 'No red flags.'))}</p>`)}
        </div>
        ${UI.section(t('nav.contracts', 'Contracts'), UI.table('sup-con-' + sid, V.contractCols(), cons, { drill: (c) => c.c._key, pageSize: 5 }))}
        ${UI.section(t('nav.invoices', 'Invoices'), UI.table('sup-inv-' + sid, V.invoiceCols(), invs, { pageSize: 10 }))}
        ${UI.section(t('nav.payments', 'Payments'), UI.table('sup-pay-' + sid, V.paymentCols(), D.payments.filter((p) => p.supplierId === sid), { pageSize: 10 }))}
        ${UI.section(t('nav.pos', 'Purchase Orders'), UI.table('sup-po-' + sid, V.poCols(), pos, { pageSize: 8 }))}
        ${UI.section(t('nav.disputes', 'Disputes'), UI.table('sup-dsp-' + sid, V.disputeCols(), disp, { pageSize: 5 }))}`;
    },
  };

  /* ------------------------------ ONBOARDING ------------------------------ */
  V.obStages = (o) => `<ol class="ob">${S.engine.ONBOARDING_STAGES.map((k, i) => { const st = o.stages[k]; const reached = o.stageNo != null && o.stageNo >= i + 1; return `<li class="${st.ok ? 'ok' : reached ? 'warn' : 'gap'}"><b>${i + 1}. ${esc(t('ob.' + k))}</b> ${st.ok ? UI.badge('Complete', 'doc.') : reached ? UI.badge('Pending Review', 'doc.') : UI.badge('Incomplete', 'doc.')}<div class="small muted">${esc(st.ev)}</div></li>`; }).join('')}</ol>`;
  V.onboarding = {
    title: () => t('nav.onboarding', 'Supplier Onboarding'),
    render() {
      const R = S.R;
      if (!S.state.data.suppliers.length) return UI.empty();
      const pending = R.onboarding.filter((o) => !o.active);
      const counts = S.engine.ONBOARDING_STAGES.map((k, i) => ({ label: `${i + 1}. ${t('ob.' + k)}`, value: R.onboarding.filter((o) => (o.stageNo || 0) === i + 1 && !o.active).length }));
      return `<div class="page-h"><div><h1>${esc(t('nav.onboarding', 'Supplier Onboarding'))}</h1><p class="muted">${esc(t('ob.sub', 'Request → Screening → Documentation → Tax → Bank → Compliance → Procurement → Finance → Approval → Activation. Gates are checked against evidence; approval enforces segregation of duties.'))} ${UI.demoTag()}</p></div></div>
        ${UI.section(t('ob.pipeline', 'Pipeline (suppliers not yet active)'), C.bars(counts, { horizontal: true, labelW: 210, fmt: (v) => S.fmt.num(v) }))}
        ${pending.map((o) => UI.section(`${o.supplier.supplierId} — ${name(o.supplier)}`, `${V.obStages(o)}
          <h4>${esc(t('ob.docs', 'Required document checklist'))}</h4><div class="chips">${o.docs ? o.docs.items.map((d) => `<span class="chip">${esc(t('docname.' + d.type, d.type))}: ${UI.badge(d.status, 'doc.')}</span>`).join('') : UI.na()}</div>
          <div class="btn-row"><button class="btn primary" data-act="obAdvance" data-id="${esc(o.supplier.supplierId)}">${esc(t('ob.advance', 'Advance to next stage'))} ›</button><button class="btn danger" data-act="obReject" data-id="${esc(o.supplier.supplierId)}">${esc(t('ob.reject', 'Reject'))}</button></div>`, { right: UI.badge(o.firstGap ? t('ob.' + o.firstGap) : 'Complete') })).join('') || `<p class="muted">${esc(t('ob.none', 'All suppliers are active.'))}</p>`}`;
    },
  };

  /* ------------------------------ PERFORMANCE ------------------------------ */
  V.performance = {
    title: () => t('nav.performance', 'Supplier Performance'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.suppliers.length) return UI.empty();
      const W = S.state.config.performance.weights;
      const rows = D.suppliers.filter((s) => R.perf.get(s.supplierId) && R.perf.get(s.supplierId).score != null).map((s) => ({ s, p: R.perf.get(s.supplierId), _key: s._key }));
      const bands = ['Excellent', 'Good', 'Watch', 'Poor', 'Critical'].map((b) => ({ label: t('band.' + b), value: rows.filter((r) => r.p.band === b).length, tone: { Excellent: 'good', Good: 'good', Watch: 'warning', Poor: 'serious', Critical: 'critical' }[b] }));
      return `<div class="page-h"><div><h1>${esc(t('nav.performance', 'Supplier Performance'))}</h1><p class="muted">${esc(t('perf.sub', 'Weighted 0–100 scorecards from receipts, matching, RFQs, disputes, contracts, payments and evaluation files. Weights are configurable in Settings.'))} ${UI.demoTag()}</p></div></div>
        <div class="grid g2">${UI.section(t('perf.dist', 'Distribution'), C.bars(bands))}${UI.section(t('perf.weights', 'Current weights'), `<div class="chips">${Object.entries(W).map(([k, w]) => `<span class="chip">${esc(t('pm.' + k))}: <b>${w}</b></span>`).join('')}</div><button class="btn sm" data-nav="settings">${esc(t('nav.settings', 'Settings'))} ›</button>`)}</div>
        ${UI.section('', UI.table('perf', [
          { key: 'n', label: t('f.name', 'Supplier'), render: (r) => `<b>${esc(name(r.s))}</b>`, sort: (r) => name(r.s) },
          { key: 'sc', label: t('perf.score', 'Score'), num: true, render: (r) => `<span class="num">${r.p.score}</span>`, sort: (r) => r.p.score },
          { key: 'b', label: t('perf.band', 'Category'), render: (r) => UI.badge(r.p.band, 'band.'), sort: (r) => r.p.score },
          ...Object.keys(W).map((k) => ({ key: k, label: t('pm.' + k), num: true, render: (r) => (r.p.metrics[k] != null ? UI.num(r.p.metrics[k], 0) : '<span class="na">—</span>'), sort: (r) => r.p.metrics[k] })),
          { key: 'cov', label: t('perf.cov', 'Coverage'), num: true, render: (r) => UI.pct(r.p.coverage, 0), sort: (r) => r.p.coverage },
        ], rows, { pageSize: 25, exportName: 'supplier_performance' }))}`;
    },
  };

  /* ------------------------------ RISK & COMPLIANCE ------------------------------ */
  V.risk = {
    title: () => t('nav.risk', 'Risk & Compliance'),
    render() {
      const R = S.R, D = S.state.data;
      if (!D.suppliers.length) return UI.empty();
      const rows = D.suppliers.map((s) => ({ s, r: R.risk.get(s.supplierId), _key: s._key })).sort((a, b) => b.r.score - a.r.score);
      const comp = [];
      for (const s of D.suppliers) {
        if (s.sanctionsStatus && !/clear/i.test(s.sanctionsStatus)) comp.push({ s, issue: t('rc2.sanctions', 'Sanctions screening: {v}', { v: s.sanctionsStatus }), sev: 'HIGH' });
        if (s.complianceStatus && /non|fail/i.test(s.complianceStatus)) comp.push({ s, issue: t('rc2.compliance', 'Compliance status: {v}', { v: s.complianceStatus }), sev: 'CRITICAL' });
        if (!s.taxId) comp.push({ s, issue: t('drv.taxIdMissing'), sev: 'HIGH' });
        const dc = R.docs.get(s.supplierId);
        if (dc && dc.expired.length) comp.push({ s, issue: t('drv.docsExpired', { docs: dc.expired.join(', ') }), sev: 'MEDIUM' });
        if (dc) dc.items.filter((d) => d.expiring).forEach((d) => comp.push({ s, issue: t('rc2.expiring', '{d} expires in {n} days', { d: d.type, n: d.daysToExpiry }), sev: 'LOW' }));
        if ((s.insuranceExpiry && s.insuranceExpiry < R.asOf) || /expired/i.test(s.insuranceStatus || '')) comp.push({ s, issue: t('drv.insuranceExpired', { date: S.fmt.date(s.insuranceExpiry) }), sev: 'MEDIUM' });
      }
      comp.forEach((c) => (c._key = c.s._key));
      return `<div class="page-h"><div><h1>${esc(t('nav.risk', 'Risk & Compliance'))}</h1><p class="muted">${esc(t('risk.sub', 'Explainable supplier risk: every score shows its drivers and evidence. Bands are configurable.'))} ${UI.demoTag()}</p></div></div>
        <div class="kpis">${UI.kpi('highRiskSuppliers')}${UI.kpi('avgRiskScore')}${UI.kpi('criticalSuppliers')}</div>
        ${UI.section(t('risk.register', 'Supplier risk register'), UI.table('risk', [
          { key: 'n', label: t('f.name', 'Supplier'), render: (r) => `<b>${esc(name(r.s))}</b> ${flags(r.s)}`, sort: (r) => name(r.s) },
          { key: 'sc', label: t('risk.score', 'Score'), num: true, render: (r) => `<span class="num">${r.r.score}</span> ${C.meter(r.r.score)}`, sort: (r) => r.r.score },
          { key: 'rt', label: t('risk.rating', 'Rating'), render: (r) => UI.badge(r.r.rating, 'sev.'), sort: (r) => r.r.score },
          { key: 'd', label: t('risk.drivers', 'Top drivers'), render: (r) => `<ul class="mini">${r.r.drivers.slice(0, 4).map((d) => `<li>+${d.points} ${esc(S.driverText(d))}</li>`).join('')}</ul>`, sort: (r) => r.r.drivers.length },
          { key: 'c', label: t('risk.compl', 'Evidence completeness'), num: true, render: (r) => UI.pct(r.r.completeness, 0), sort: (r) => r.r.completeness },
          { key: 'e', label: '', nosort: true, render: (r) => UI.evBtn('risk', r.s.supplierId) },
        ], rows, { pageSize: 25, exportName: 'supplier_risk' }))}
        ${UI.section(t('risk.complianceIssues', 'Compliance issues'), UI.table('compl', [
          { key: 'sev', label: t('common.severity', 'Severity'), render: (c) => UI.sev(c.sev), sort: (c) => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 })[c.sev] },
          { key: 'n', label: t('f.name', 'Supplier'), render: (c) => esc(name(c.s)), sort: (c) => name(c.s) },
          { key: 'i', label: t('risk.issue', 'Issue'), render: (c) => esc(c.issue), sort: (c) => c.issue },
          { key: 'st', label: t('common.status', 'Status'), render: (c) => UI.badge(c.s.approvedStatus), sort: (c) => c.s.approvedStatus },
        ], comp, { pageSize: 20, exportName: 'compliance_issues' }))}`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
