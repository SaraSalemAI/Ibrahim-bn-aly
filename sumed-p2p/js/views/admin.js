/* SUMED P2P — Reports, Settings (configuration, roles, integration). */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util, UI = S.ui;
  const t = (...a) => S.t(...a);
  const esc = U.esc;
  const V = (S.views = S.views || {});
  S.vs = S.vs || {};

  V.reports = {
    title: () => t('nav.reports', 'Reports'),
    render() {
      if (!S.state.data.invoices.length && !S.state.data.suppliers.length) return UI.empty();
      const defs = S.reports.defs();
      const can = S.can('export');
      return `<div class="page-h"><div><h1>${esc(t('nav.reports', 'Reports'))}</h1><p class="muted">${esc(t('rep.sub', 'Excel: raw data, cleaned data, calculations, KPIs, exceptions and source references. PDF: executive summary, KPIs, charts, findings, red flags, recommendations and evidence references.'))} ${UI.demoTag()}</p></div></div>
        ${can ? '' : `<p class="warnbar">🔒 ${esc(t('rep.noPerm', 'Your role does not include export permission.'))}</p>`}
        <div class="rep-grid">${defs.map((d) => `<article class="rep"><h3>${esc(t('rep.' + d.id, d.name))}</h3><p class="small muted">${esc(t('rep.d.' + d.id, ''))}</p>
          <div class="btn-row"><button class="btn sm" data-act="repX" data-id="${d.id}" ${can ? '' : 'disabled'}>⤓ Excel</button><button class="btn sm" data-act="repP" data-id="${d.id}" ${can ? '' : 'disabled'}>⤓ PDF</button><button class="btn sm ghost" data-act="repC" data-id="${d.id}" ${can ? '' : 'disabled'}>⤓ CSV</button></div></article>`).join('')}</div>`;
    },
  };

  /* ------------------------------ SETTINGS ------------------------------ */
  const inp = (path, val, type = 'number', extra = '') => `<input type="${type}" data-cfg="${esc(path)}" value="${esc(val == null ? '' : val)}" ${S.can('config.edit') ? '' : 'disabled'} ${extra}>`;
  const row = (label, html, note) => `<tr><th>${esc(label)}</th><td>${html}${note ? `<div class="small muted">${esc(note)}</div>` : ''}</td></tr>`;
  V.settings = {
    title: () => t('nav.settings', 'Settings'),
    render() {
      const c = S.state.config;
      const tab = S.vs.setTab || 'general';
      const ro = !S.can('config.edit');
      const head = `<div class="page-h"><div><h1>${esc(t('nav.settings', 'Settings'))}</h1><p class="muted">${esc(t('set.sub', 'All thresholds are configurable and audit-logged. Defaults are ILLUSTRATIVE — they are not SUMED policy.'))}</p></div></div>
        ${ro ? `<p class="warnbar">🔒 ${esc(t('set.ro', 'Read-only: your role cannot change configuration (System Administrator required).'))}</p>` : ''}
        ${UI.tabs('setTab', [['general', t('set.general', 'General')], ['approval', t('set.approval', 'Approval matrix')], ['thresholds', t('set.thresholds', 'Thresholds & tolerances')], ['weights', t('set.weights', 'Scoring weights')], ['tax', t('set.taxfx', 'Tax, FX & calendar')], ['roles', t('set.roles', 'Users & roles')], ['api', t('set.api', 'Integration & API')]], tab)}`;
      if (tab === 'approval') {
        const m = c.approvalMatrix;
        return head + UI.section(t('auth.matrix', 'Approval matrix'), `<p class="warnbar">${esc(m.note)}</p><table><thead><tr><th>${esc(t('auth.tier', 'Tier'))}</th><th>${esc(t('auth.upTo', 'Amount < ({c})', { c: c.baseCurrency }))}</th><th>${esc(t('auth.approvers', 'Approvers (comma-separated roles)'))}</th></tr></thead><tbody>${m.tiers.map((x, i) => `<tr><td>${esc(x.id)}</td><td>${inp(`approvalMatrix.tiers.${i}.max`, x.max, 'number', 'placeholder="∞"')}</td><td>${inp(`approvalMatrix.tiers.${i}.approvers`, x.approvers.join(', '), 'text', 'class="wide"')}</td></tr>`).join('')}</tbody></table>
          <h4>${esc(t('auth.rules', 'Escalation rules'))}</h4><table><tbody>${m.rules.map((r, i) => `<tr><td><label><input type="checkbox" data-cfg="approvalMatrix.rules.${i}.enabled" ${r.enabled ? 'checked' : ''} ${ro ? 'disabled' : ''}> ${esc(t('auth.rule.' + r.when, r.when))}</label></td><td>→ + ${inp(`approvalMatrix.rules.${i}.add`, r.add, 'text')}</td></tr>`).join('')}</tbody></table>
          <p class="small muted">${esc(t('auth.dims', 'Approval can be driven by amount, department, supplier risk, currency, project, cost center, payment type, emergency payment and contract type. Additional rule types plug into S.engine.requiredApprovers().'))}</p>`);
      }
      if (tab === 'thresholds') {
        const sec = (title, rows) => UI.section(title, `<table class="kv">${rows.join('')}</table>`);
        return head + `<div class="grid g2">
          ${sec(t('set.matching', 'Three-way matching'), [row(t('set.priceTol', 'Price tolerance %'), inp('matching.priceTolPct', c.matching.priceTolPct)), row(t('set.qtyTol', 'Quantity tolerance %'), inp('matching.qtyTolPct', c.matching.qtyTolPct)), row(t('set.taxTol', 'Tax-rate tolerance (pp)'), inp('matching.taxTolPct', c.matching.taxTolPct)), row(t('set.amtTol', 'Rounding tolerance (amount)'), inp('matching.amountTolAbs', c.matching.amountTolAbs))])}
          ${sec(t('set.dup', 'Duplicate detection'), [row(t('set.dupWin', 'Possible-duplicate window (days)'), inp('duplicates.possibleWindowDays', c.duplicates.possibleWindowDays)), row(t('set.dupHigh', 'High-risk window (days)'), inp('duplicates.highRiskWindowDays', c.duplicates.highRiskWindowDays)), row(t('set.dupAmt', 'Amount tolerance %'), inp('duplicates.amountTolPct', c.duplicates.amountTolPct)), row(t('set.dupDesc', 'Description similarity (0–1)'), inp('duplicates.descSimilarity', c.duplicates.descSimilarity, 'number', 'step="0.05"')), row(t('set.dupPay', 'Payment window (days)'), inp('duplicates.paymentWindowDays', c.duplicates.paymentWindowDays))])}
          ${sec(t('set.risk', 'Supplier risk'), [row(t('set.bandM', 'MEDIUM from score'), inp('risk.bands.medium', c.risk.bands.medium)), row(t('set.bandH', 'HIGH from score'), inp('risk.bands.high', c.risk.bands.high)), row(t('set.bandC', 'CRITICAL from score'), inp('risk.bands.critical', c.risk.bands.critical)), row(t('set.share', 'Spend share HIGH / CRITICAL %'), inp('risk.spendShareHighPct', c.risk.spendShareHighPct) + ' / ' + inp('risk.spendShareCriticalPct', c.risk.spendShareCriticalPct)), row(t('set.conExp', 'Contract-expiry window (days)'), inp('risk.contractExpiryDays', c.risk.contractExpiryDays)), row(t('set.bankLook', 'Bank-change look-back (days)'), inp('risk.bankChangeLookbackDays', c.risk.bankChangeLookbackDays)), row(t('set.excRate', 'Exception-rate threshold %'), inp('risk.exceptionRateHighPct', c.risk.exceptionRateHighPct))])}
          ${sec(t('set.conc', 'Concentration'), [row(t('set.top5', 'Top-5 threshold %'), inp('concentration.top5Pct', c.concentration.top5Pct)), row(t('set.top10', 'Top-10 threshold %'), inp('concentration.top10Pct', c.concentration.top10Pct)), row(t('set.single', 'Single supplier threshold %'), inp('concentration.singleSupplierPct', c.concentration.singleSupplierPct))])}
          ${sec(t('set.fraud', 'Fraud & anomaly'), [row(t('set.round', 'Round amount ≥ / multiple of'), inp('fraud.roundAmountMin', c.fraud.roundAmountMin) + ' / ' + inp('fraud.roundAmountModulo', c.fraud.roundAmountModulo)), row(t('set.below', 'Just-below-threshold band %'), inp('fraud.belowThresholdPct', c.fraud.belowThresholdPct)), row(t('set.split', 'Split window (days)'), inp('fraud.splitWindowDays', c.fraud.splitWindowDays)), row(t('set.dormant', 'Dormant after (days)'), inp('fraud.dormantDays', c.fraud.dormantDays)), row(t('set.bankPay', 'Payment after bank change (days)'), inp('fraud.bankChangePayWindowDays', c.fraud.bankChangePayWindowDays)), row(t('set.price', 'Price jump %'), inp('fraud.priceJumpPct', c.fraud.priceJumpPct)), row(t('set.freq', 'Payments per 7 days'), inp('fraud.freqPer7Days', c.fraud.freqPer7Days))])}
          ${sec(t('set.alerts', 'Automated alerts'), [row(t('set.due', 'Invoice due within (days)'), inp('alerts.invoiceDueDays', c.alerts.invoiceDueDays)), row(t('set.large', 'Large payment ≥ ({c})', { c: c.baseCurrency }), inp('alerts.largePayment', c.alerts.largePayment)), row(t('set.conAl', 'Contract expiry alert (days)'), inp('alerts.contractExpiryDays', c.alerts.contractExpiryDays)), row(t('set.docAl', 'Document expiry alert (days)'), inp('alerts.docExpiryDays', c.alerts.docExpiryDays)), row(t('set.apprAl', 'Approval delay (days)'), inp('alerts.approvalDelayDays', c.alerts.approvalDelayDays)), row(t('set.poAl', 'PO near limit %'), inp('alerts.poNearLimitPct', c.alerts.poNearLimitPct)), row(t('set.enabled', 'Enabled'), Object.keys(c.alerts.enabled).map((k) => `<label class="chk"><input type="checkbox" data-cfg="alerts.enabled.${k}" ${c.alerts.enabled[k] ? 'checked' : ''} ${ro ? 'disabled' : ''}> ${esc(t('aa.' + k, k, { days: '…', amount: '…', pct: '…' }))}</label>`).join(''))])}
          ${sec(t('set.treasury', 'Treasury & DPO'), [row(t('dpo.target', 'Target DPO (days)'), inp('dpo.targetDays', c.dpo.targetDays)), row(t('set.coc', 'Cost of capital % (for early-payment value)'), inp('treasury.costOfCapitalPct', c.treasury ? c.treasury.costOfCapitalPct : null, 'number', 'step="0.1"'), t('set.cocNote', 'Leave empty if not provided by Treasury — the value is then shown as unavailable.'))])}
        </div>
        ${UI.section(t('set.live', 'Current alerts'), `<table>${S.R.autoAlerts.map((a) => `<tr><td>${esc(t('aa.' + a.type, a.type, Object.fromEntries(Object.entries(a.params).map(([k, v]) => [k, typeof v === 'number' ? S.fmt.num(v) : v]))))}</td><td class="n">${UI.num(a.count)}</td><td>${a.count ? UI.evBtn('auto', a.type) : ''}</td></tr>`).join('')}</table>`)}`;
      }
      if (tab === 'weights') {
        return head + `<div class="grid g2">${UI.section(t('set.perfW', 'Supplier performance weights'), `<table class="kv">${Object.entries(c.performance.weights).map(([k, v]) => row(t('pm.' + k), inp('performance.weights.' + k, v))).join('')}${row(t('set.bands', 'Bands: Excellent / Good / Watch / Poor ≥'), ['excellent', 'good', 'watch', 'poor'].map((b) => inp('performance.bands.' + b, c.performance.bands[b])).join(' '))}</table>`)}
          ${UI.section(t('set.prioW', 'Payment priority weights'), `<table class="kv">${Object.entries(c.priority.weights).map(([k, v]) => row(t('pc.' + k), inp('priority.weights.' + k, v))).join('')}${row(t('set.critCats', 'Operationally critical categories'), inp('priority.criticalCategories', c.priority.criticalCategories.join(', '), 'text', 'class="wide"'))}</table>`)}</div>`;
      }
      if (tab === 'tax') {
        return head + `<div class="grid g2">${UI.section(t('tax.config', 'Tax codes'), `<p class="small muted">${esc(t('set.taxNote', 'Tax rates are never assumed. Enter rates from an authoritative source and record that source.'))}</p><table><thead><tr><th>${esc(t('tax.code', 'Code'))}</th><th>${esc(t('tax.name', 'Name'))}</th><th>${esc(t('tax.type', 'Type'))}</th><th>${esc(t('tax.rate', 'Rate %'))}</th><th>${esc(t('fx.source', 'Source'))}</th><th></th></tr></thead><tbody>${c.taxCodes.map((x, i) => `<tr><td>${esc(x.code)}</td><td>${esc(x.name || '')}</td><td>${esc(x.type)}</td><td class="n">${UI.num(x.ratePct, 2)}</td><td class="small">${esc(x.source || '')}</td><td>${ro ? '' : `<button class="btn sm ghost" data-act="taxDel" data-i="${i}">✕</button>`}</td></tr>`).join('')}</tbody></table>
            ${ro ? '' : `<div class="filters"><input id="tx-code" placeholder="${esc(t('tax.code', 'Code'))}"><input id="tx-name" placeholder="${esc(t('tax.name', 'Name'))}"><select id="tx-type"><option>VAT</option><option>WHT</option><option>OTHER</option></select><input id="tx-rate" type="number" step="0.01" placeholder="%"><input id="tx-src" placeholder="${esc(t('fx.source', 'Source'))} *"><button class="btn sm" data-act="taxAdd">＋</button></div>`}`)}
          ${UI.section(t('set.general2', 'Calendar & currency'), `<table class="kv">${row(t('set.weekend', 'Weekend days (0=Sun … 6=Sat)'), inp('weekendDays', c.weekendDays.join(','), 'text'))}${row(t('set.ccys', 'Currencies'), inp('currencies', c.currencies.join(','), 'text'))}</table>
            <h4>${esc(t('set.holidays', 'Holiday calendar'))}</h4><p class="small muted">${esc(t('set.holNote', 'Holidays are not assumed; enter official dates or upload a holiday file.'))}</p><ul>${c.holidays.map((h, i) => `<li>${UI.date(h.date)} — ${esc(h.name)} ${ro ? '' : `<button class="btn sm ghost" data-act="holDel" data-i="${i}">✕</button>`}</li>`).join('') || `<li class="muted">${esc(t('set.noHol', 'None configured'))}</li>`}</ul>
            ${ro ? '' : `<div class="filters"><input id="hol-date" type="date"><input id="hol-name" placeholder="${esc(t('tax.name', 'Name'))}"><button class="btn sm" data-act="holAdd">＋</button></div>`}
            <h4>${esc(t('set.fxNote', 'FX rates'))}</h4><p class="small muted">${esc(t('set.fxText', 'FX rates come only from uploaded FX-rate files ({n} rows loaded). Missing rates show "FX RATE NOT AVAILABLE".', { n: S.state.data.fxRates.length }))}</p>`)}</div>`;
      }
      if (tab === 'roles') {
        const roles = S.state.roles;
        const perms = U.uniq(Object.values(roles).flat()).sort();
        return head + UI.section(t('set.rbac', 'Role-based access (least privilege)'), `<div class="tbl-wrap"><table class="matrix"><thead><tr><th>${esc(t('sod.role', 'Role'))}</th>${perms.map((p) => `<th class="rot"><span>${esc(p)}</span></th>`).join('')}</tr></thead><tbody>${Object.entries(roles).map(([r, ps]) => `<tr><th>${esc(t('role.' + r, r))}</th>${perms.map((p) => `<td class="c">${ps.includes(p) ? '●' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`) +
          UI.section(t('set.users', 'User directory'), S.state.data.users.length ? UI.table('users', [{ key: 'userId', label: t('sod.user', 'User') }, { key: 'name', label: t('f.name', 'Name') }, { key: 'role', label: t('sod.role', 'Role'), render: (u) => esc(t('role.' + u.role, u.role)) }, { key: 'department', label: t('f.department', 'Department') }, { key: 'sw', label: '', nosort: true, render: (u) => `<button class="btn sm" data-act="switchUser" data-id="${esc(u.userId)}">${esc(t('set.actAs', 'Sign in as'))}</button>` }], S.state.data.users, { drill: () => null, pageSize: 20 }) : `<p class="muted">${esc(t('set.noUsers', 'No user directory uploaded. Use the role selector in the header to test role-based access.'))}</p>`);
      }
      if (tab === 'api') {
        return head + UI.section(t('set.api', 'Integration & API'), `<p>${esc(t('set.apiText', 'The engine is a set of pure functions over normalised entities, exposed as window.SUMED.api. ERP connectors (SAP, Oracle, Dynamics), bank/TMS feeds, DMS and Power BI can push canonical JSON and read results. See docs/API.md.'))}</p>
          <pre class="code">// Load canonical data (same shape as the CSV templates)
SUMED.api.load({ suppliers:[…], invoices:[…], payments:[…], bankTxns:[…] }, { source: 'SAP S/4HANA extract' })
// Read results
SUMED.api.kpis()            // KPI library with lineage
SUMED.api.redFlags()        // fraud / anomaly / control flags with evidence
SUMED.api.match('INV-…')    // three-way match result
SUMED.api.paymentProposal() // ranked queue (recommendation only)
SUMED.api.cashForecast()    // 13-week & per-currency forecast
SUMED.api.controls()        // control tests
SUMED.api.audit()           // hash-chained audit trail
SUMED.api.exportWorkspace() // JSON for archiving / Power BI</pre>
          <p class="small muted">${esc(t('set.entities', 'Canonical entities: {e}', { e: S.entityOrder.join(', ') }))}</p>`);
      }
      return head + UI.section(t('set.general', 'General'), `<table class="kv">
        ${row(t('set.base', 'Base currency'), inp('baseCurrency', c.baseCurrency, 'text', 'maxlength="3"'))}
        ${row(t('set.asOf', 'As-of date (empty = today)'), inp('asOfDate', c.asOfDate || '', 'date'))}
        ${row(t('set.dateOrder', 'Ambiguous date order in uploads'), `<select data-cfg="dateOrder" ${ro ? 'disabled' : ''}><option value="DMY" ${c.dateOrder === 'DMY' ? 'selected' : ''}>DD/MM/YYYY</option><option value="MDY" ${c.dateOrder === 'MDY' ? 'selected' : ''}>MM/DD/YYYY</option></select>`)}
        ${row(t('set.spendBasis', 'Spend basis'), `<select data-cfg="spendBasis" ${ro ? 'disabled' : ''}><option value="invoiced" ${c.spendBasis === 'invoiced' ? 'selected' : ''}>${esc(t('set.invoiced', 'Invoiced (net of tax)'))}</option><option value="paid" ${c.spendBasis === 'paid' ? 'selected' : ''}>${esc(t('set.paid', 'Paid (gross)'))}</option></select>`)}
        ${row(t('set.docs', 'Required supplier documents'), inp('requiredDocs', c.requiredDocs.join(', '), 'text', 'class="wide"'))}
      </table>`);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
