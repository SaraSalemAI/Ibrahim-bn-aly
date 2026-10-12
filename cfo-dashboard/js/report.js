/* Report generation and exports (PDF, Word, Excel, HTML, Markdown). Everything is built in the browser.
 * R = { A, F, S, ai, lang }: analysis, red flags, forecast scenarios, Claude commentary text, language.
 * One report model feeds every format, so they always say the same thing.
 */
(function (CFO) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Subtotal lines, shown in bold wherever statements are listed (also used by js/app.js).
  const SUBTOTALS = new Set(['gross_profit', 'operating_income', 'pretax_income', 'net_income', 'current_assets', 'total_assets', 'current_liabilities', 'total_liabilities', 'equity', 'cfo', 'cfi', 'cff']);
  const FORECAST_LINES = ['revenue', 'gross_profit', 'operating_income', 'interest', 'net_income', 'cash', 'receivables', 'inventory', 'total_assets', 'short_debt', 'long_debt', 'total_liabilities', 'equity', 'cfo', 'capex', 'dividends'];

  /** Key figures with their history and the change on the prior year (shared by Overview and the Full analysis). */
  function kpiList(A, lang) {
    const L = CFO.UI[lang], P = A.ds.periods, ds = A.ds, prevP = P[P.length - 2];
    const e = q => CFO.enrich(ds.data[q]), rv = id => q => A.ratios[id][q].value;
    return [['revenue', 'money', q => ds.data[q].revenue, true], ['gross_profit', 'money', q => ds.data[q].gross_profit, true],
      ['ebitda', 'money', q => e(q).ebitda, true], ['net_income', 'money', q => ds.data[q].net_income, true],
      ['cfo', 'money', q => ds.data[q].cfo, true], ['fcf', 'money', rv('fcf'), true], ['cash', 'money', q => ds.data[q].cash, true],
      ['total_debt', 'money', q => e(q).total_debt, false], ['working_capital', 'money', rv('working_capital'), true],
      ['revenue_growth', '%', rv('revenue_growth'), true], ['current_ratio', 'x', rv('current_ratio'), true],
      ['debt_to_equity', 'x', rv('debt_to_equity'), false], ['roe', '%', rv('roe'), true], ['roic', '%', rv('roic'), true]]
      // Figures the statements cannot give are left out rather than shown as a row of dashes.
      .filter(([, , get]) => P.some(q => get(q) != null && isFinite(get(q))))
      .map(([k, unit, get, highGood]) => {
        const series = P.map(q => get(q) ?? null), cur = series[series.length - 1], prev = series[series.length - 2];
        let change = '', dir = 'flat', up = true;
        if (cur != null && prev != null && prev !== 0) {
          const ch = unit === 'money' ? (cur - prev) / Math.abs(prev) : cur - prev;
          up = ch >= 0;
          dir = Math.abs(ch) < 1e-9 ? 'flat' : up === highGood ? 'up' : 'down';
          change = unit === 'money' ? CFO.fmtPct(Math.abs(ch), lang) : unit === '%' ? `${CFO.fmtNum(Math.abs(ch * 100), 1, lang)} ${L.pts}` : CFO.fmtVal('x', Math.abs(ch), lang);
        }
        return { key: k, label: L.kpi[k], value: CFO.fmtVal(unit, cur, lang), series, dir,
          arrow: change ? (up ? '▲' : '▼') : '', change, vs: change ? `${L.vs} ${prevP}` : '',
          delta: change ? `${up ? '▲' : '▼'} ${change} ${L.vs} ${prevP}` : '' };
      });
  }

  /** Scenario comparison and base projected statements (shared by the Forecast tab and the Full analysis). */
  function forecastTables(R) {
    const { A, F, S, lang } = R, L = CFO.UI[lang], Fc = L.fc, ds = A.ds, p = A.latest;
    if (!S) return { forecast: null, forecastDetail: null };
    const names = ['base', 'upside', 'downside'], end = S.base.years[S.base.years.length - 1].period;
    const v = (sc, k) => sc ? sc.years[sc.years.length - 1].data[k] : ds.data[p][k];
    const r = (sc, id) => (sc ? sc.A.ratios[id][end] : A.ratios[id][p]).value;
    return {
      forecast: {
        head: ['', `${Fc.actual} ${p}`, ...names.map(n => `${Fc.sc[n]} ${end}`)],
        rows: [
          [CFO.itemName('revenue', lang), sc => CFO.fmtNum(v(sc, 'revenue'), 0, lang)],
          [CFO.itemName('net_income', lang), sc => CFO.fmtNum(v(sc, 'net_income'), 0, lang)],
          [CFO.ratioName('net_margin', lang), sc => CFO.fmtPct(r(sc, 'net_margin'), lang)],
          [CFO.ratioName('fcf', lang), sc => CFO.fmtNum(r(sc, 'fcf'), 0, lang)],
          [CFO.itemName('cash', lang), sc => CFO.fmtNum(v(sc, 'cash'), 0, lang)],
          [Fc.funding, sc => sc ? CFO.fmtNum(sc.years.reduce((t, y) => t + y.fundingNeed, 0), 0, lang) : '—'],
          [CFO.ratioName('current_ratio', lang), sc => CFO.fmtVal('x', r(sc, 'current_ratio'), lang)],
          [CFO.ratioName('debt_to_equity', lang), sc => CFO.fmtVal('x', r(sc, 'debt_to_equity'), lang)],
          [CFO.ratioName('interest_coverage', lang), sc => CFO.fmtVal('x', r(sc, 'interest_coverage'), lang)],
          [CFO.ratioName('roe', lang), sc => CFO.fmtPct(r(sc, 'roe'), lang)],
          [Fc.health, sc => String((sc ? sc.A.health : A.health)?.score ?? '—')],
          [Fc.flags, sc => String((sc ? sc.F : F).length)],
        ].map(([lab, f]) => [lab, f(null), ...names.map(n => f(S[n]))]),
        note: `${Fc.scHint} ${Fc.note}`,
      },
      forecastDetail: { head: [L.item, p, ...S.base.years.map(y => y.period)], sub: [...FORECAST_LINES.map(k => SUBTOTALS.has(k)), false],
        rows: [...FORECAST_LINES.map(k => [CFO.itemName(k, lang), CFO.fmtNum(ds.data[p][k], 0, lang), ...S.base.years.map(y => CFO.fmtNum(y.data[k], 0, lang))]),
          [Fc.funding, '—', ...S.base.years.map(y => CFO.fmtNum(y.fundingNeed, 0, lang))]] },
    };
  }

  /** Items a person should check before the report is used for decisions. */
  function reviewItems(A, F, lang, ai) {
    const L = CFO.UI[lang], ds = A.ds, out = [];
    const n = k => CFO.itemName(k, lang);
    ds.issues.forEach(i => out.push(L.issue[i.type](i, n)));
    const derived = new Set(ds.periods.flatMap(p => [...ds.derived[p]]));
    if (derived.size) out.push((lang === 'en' ? 'Derived (not read from a file): ' : 'بنود محسوبة (غير مقروءة من ملف): ') + [...derived].map(n).join(lang === 'en' ? ', ' : '، '));
    if (ds.sources.some(s => /\.pdf/i.test(s))) out.push(lang === 'en' ? 'PDF input: verify each number against the original statement.' : 'ملفات PDF: طابق كل رقم مع القوائم الأصلية.');
    F.filter(f => f.sev === 'high').forEach(f => out.push((lang === 'en' ? 'Confirm the cause of: ' : 'تأكد من سبب: ') + f.title[lang]));
    out.push(lang === 'en' ? `Sector benchmarks (${CFO.sectorName(CFO.getSector(), lang)}) are indicative; compare with real peers.` : `معايير القطاع (${CFO.sectorName(CFO.getSector(), lang)}) استرشادية؛ قارن بمنافسين فعليين.`);
    if (ai) out.push(L.ai.note);
    return out;
  }

  /** Everything the full analysis says, as plain data (one model for the page, HTML, Word, PDF, Markdown). */
  function model(R) {
    const { A, F, S, ai, lang } = R, L = CFO.UI[lang], P = A.ds.periods, p = A.latest, ds = A.ds;
    const statusOf = (id, cell) => cell.status || (cell.value != null && !CFO.RATIO[id].dir ? 'info' : 'na');
    const label = r => r.key ? CFO.itemName(r.key, lang) : r.label;
    const kpis = kpiList(A, lang);

    const groups = CFO.GROUPS.map(g => ({
      group: g, title: L.groups[g],
      head: [L.item, ...P, L.typical, p],
      rows: CFO.RATIOS.filter(r => r.group === g).map(def => {
        const cell = A.ratios[def.id][p], st = statusOf(def.id, cell);
        const missing = def.needs.filter(k => P.every(q => ds.data[q][k] == null));
        return { id: def.id, name: CFO.ratioName(def.id, lang), values: P.map(q => CFO.fmtVal(def.unit, A.ratios[def.id][q].value, lang)),
          typical: CFO.fmtVal(def.unit, CFO.bench(def.id).typical, lang), status: st, statusText: L.status[st], formula: def.f,
          meaning: cell.value != null ? CFO.meaning(def.id, cell.value, lang) : `${L.notAvail}: ${missing.map(k => CFO.itemName(k, lang)).join(lang === 'ar' ? '، ' : ', ') || '—'}` };
      }),
    }));

    const byStatement = (rows, cells, head) => ['IS', 'BS', 'CF'].map(st => ({ st, title: L.st[st], head: head(st),
      rows: rows.filter(r => r.st === st).map(r => ({ sub: SUBTOTALS.has(r.key), mapped: !!r.key, cells: [label(r), ...cells(r)] })) })).filter(t => t.rows.length);

    const z = A.ratios.altman_z[p]?.value;
    const m = {
      lang, title: L.fullTitle, latest: p, periods: P,
      meta: `${ds.sources.join(' · ')} · ${P.join(', ')} · ${L.sector}: ${CFO.sectorName(CFO.getSector(), lang)}`,
      summary: CFO.summary(A, F, lang),
      health: A.health || {}, kpis, groups,
      dupont: { head: [L.period, CFO.ratioName('net_margin', lang), CFO.ratioName('asset_turnover', lang), CFO.ratioName('equity_multiplier', lang), 'ROE'],
        rows: A.dupont.map(r => [r.period, CFO.fmtPct(r.net_margin, lang), CFO.fmtVal('x', r.asset_turnover, lang), CFO.fmtVal('x', r.equity_multiplier, lang), CFO.fmtPct(r.roe, lang)]) },
      dupont5: { head: [L.period, L.taxBurden, L.interestBurden, L.ebitMargin, CFO.ratioName('asset_turnover', lang), CFO.ratioName('equity_multiplier', lang), 'ROE'],
        rows: A.dupont.map(r => [r.period, CFO.fmtVal('x', r.tax_burden, lang), CFO.fmtVal('x', r.interest_burden, lang), CFO.fmtPct(r.ebit_margin, lang),
          CFO.fmtVal('x', r.asset_turnover, lang), CFO.fmtVal('x', r.equity_multiplier, lang), CFO.fmtPct(r.roe, lang)]) },
      val: CFO.valuationModel ? CFO.valuationModel(R) : null,
      altman: { value: CFO.fmtVal('score', z, lang), meaning: z != null ? CFO.meaning('altman_z', z, lang) : L.notAvail, zones: L.zZones,
        status: z == null ? 'na' : A.ratios.altman_z[p].status },
      vertical: byStatement(A.vertical, r => P.map(q => r.pct[q] == null ? '—' : `${CFO.fmtPct(r.pct[q], lang)}`), st => [L.item, ...P.map(q => `${q} · ${st === 'BS' ? L.ofAssets : L.ofRevenue}`)]),
      horizontal: byStatement(A.horizontal, r => [...P.map(q => CFO.fmtNum(r.values[q], 0, lang)), ...P.slice(1).map(q => r.yoy[q]?.pct == null ? '—' : `${r.yoy[q].pct > 0 ? '+' : ''}${CFO.fmtPct(r.yoy[q].pct, lang)}`), CFO.fmtPct(r.cagr, lang)],
        () => [L.item, ...P, ...P.slice(1).map(q => `${L.yoy} ${q}`), L.cagr]),
      flags: F.map(f => ({ sev: f.sev, sevText: L.sev[f.sev], title: f.title[lang], ev: f.ev(lang), rec: f.rec[lang] })),
      strengths: CFO.strengths(A, lang).map(s => s.text),
      ai: ai || '',
      checks: ds.issues.map(i => L.issue[i.type](i, k => CFO.itemName(k, lang))),
      review: reviewItems(A, F, lang, ai),
      assumptions: L.assumptionList,
      next: L.nextList,
    };

    // Chart data (drawn as inline SVG, so the HTML file needs no library).
    const val = k => P.map(q => ds.data[q][k] ?? null), rat = id => P.map(q => A.ratios[id][q].value);
    // Axis labels drop a zero decimal in either digit system: "20.0%" -> "20%", "٢٠٫٠%" -> "٢٠%".
    const money = v => CFO.fmtNum(v, 0, lang), pctf = v => CFO.fmtPct(v, lang).replace(/[.,٫][0٠]%$/, '%');
    const shareOf = (k, q) => { const d = ds.data[q]; const v = k === 'ncl' ? (d.total_liabilities != null && d.current_liabilities != null ? d.total_liabilities - d.current_liabilities : null) : d[k]; return d.total_assets && v != null ? v / d.total_assets : null; };
    m.charts = [
      { title: L.chart.revenueProfit, kind: 'bar', labels: P, fmt: money, series: [{ name: CFO.itemName('revenue', lang), values: val('revenue'), color: 'var(--s1)' }, { name: CFO.itemName('net_income', lang), values: val('net_income'), color: 'var(--s2)' }] },
      { title: L.chart.margins, kind: 'line', labels: P, fmt: pctf, series: [{ name: CFO.ratioName('gross_margin', lang), values: rat('gross_margin'), color: 'var(--s1)' }, { name: CFO.ratioName('operating_margin', lang), values: rat('operating_margin'), color: 'var(--s2)' }, { name: CFO.ratioName('net_margin', lang), values: rat('net_margin'), color: 'var(--s3)' }] },
      { title: L.chart.structure, kind: 'stack', max100: true, labels: P, fmt: pctf, series: [{ name: CFO.itemName('equity', lang), values: P.map(q => shareOf('equity', q)), color: 'var(--s1)' }, { name: lang === 'ar' ? 'التزامات غير متداولة' : 'Non-current liabilities', values: P.map(q => shareOf('ncl', q)), color: 'var(--s2)' }, { name: CFO.itemName('current_liabilities', lang), values: P.map(q => shareOf('current_liabilities', q)), color: 'var(--s3)' }] },
      { title: L.chart.cash, kind: 'bar', labels: P, fmt: money, series: [{ name: CFO.itemName('cfo', lang), values: val('cfo'), color: 'var(--s1)' }, { name: CFO.itemName('capex', lang), values: P.map(q => ds.data[q].capex != null ? -ds.data[q].capex : null), color: 'var(--s2)' }, { name: L.kpi.fcf, values: rat('fcf'), color: 'var(--s3)' }] },
    ].filter(c => c.series.some(sr => sr.values.some(v => v != null)));

    Object.assign(m, forecastTables(R));
    if (m.val?.chart) m.charts.push(m.val.chart);
    if (S) {
      const names = ['base', 'upside', 'downside'];
      m.charts.push({ title: L.fc.cash, kind: 'line', labels: [p, ...S.base.years.map(y => y.period)], fmt: money,
        series: names.map((n, i) => ({ name: L.fc.sc[n], values: [ds.data[p].cash ?? null, ...S[n].years.map(y => y.data.cash)], color: `var(--s${i + 1})` })) });
    }
    return m;
  }

  const L_ = lang => CFO.UI[lang];

  /** The full analysis as HTML. `pre` makes ids unique when both languages share one document. */
  function fullHTML(R, pre = 'fa') {
    const m = model(R), L = L_(R.lang), id = k => `${pre}-${R.lang}-${k}`;
    const li = arr => arr.map(t => `<li>${esc(t)}</li>`).join('');
    const tbl = (head, rows, opts = {}) => `<div class="table-wrap"><table${opts.cls ? ` class="${opts.cls}"` : ''}><thead><tr>${head.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
    const plainRows = (rows, sub) => rows.map((r, k) => `<tr${sub?.[k] ? ' class="subtotal"' : ''}>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`);
    const T = t => !t ? '' : `<div class="table-wrap"><table><thead><tr>${t.head.map((h, i) => `<th${i >= (t.text || 1) ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r, k) =>
      `<tr${t.sub?.[k] ? ' class="subtotal"' : ''}>${r.map((c, i) => `<td${i >= (t.text || 1) ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const v = m.val, VL = CFO.UI[R.lang].val;
    const planHTML = !v ? '' : `<section class="fa-sec" id="${id('plan')}"><h2>${esc(L.secPlan)}</h2><p class="muted small">${esc(VL.planHint)}</p>
        ${v.plan.rows.length ? `<div class="table-wrap"><table class="plan"><thead><tr>${v.plan.head.map((h, i) => `<th${i >= 6 ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${v.plan.items.map(it =>
          `<tr><td>${it.n}</td><td><span class="pill ${it.sev}">${esc(it.sevText)}</span></td><td>${esc(it.horizon)}</td><td>${esc(it.areaText)}</td><td><b>${esc(it.title)}</b><div class="meaning">${esc(it.action)}</div></td><td>${esc(it.kpi)}</td><td class="n">${esc(it.current)}</td><td class="n">${esc(it.target)}</td></tr>`).join('')}</tbody></table></div>` : `<p>${esc(L.noFlags)}</p>`}
        ${v.levers?.rows.length ? `<h3>${esc(VL.levers)}</h3><p class="muted small">${esc(VL.leversHint)}</p>${T(v.levers)}` : ''}</section>`;
    const valHTML = !v ? '' : `<section class="fa-sec" id="${id('valuation')}"><h2>${esc(L.secValuation)}</h2><p class="muted small">${esc(VL.hint)}</p>
        ${v.missing ? `<p>${esc(v.missing)}</p>` : `
        ${v.headline ? `<div class="kpis"><div class="kpi"><span class="kpi-label">${esc(VL.ev)}</span><span class="kpi-value">${esc(v.headline.ev)}</span></div><div class="kpi"><span class="kpi-label">${esc(VL.equity)}</span><span class="kpi-value">${esc(v.headline.equity)}</span></div><div class="kpi"><span class="kpi-label">WACC</span><span class="kpi-value">${esc(v.headline.wacc)}</span></div>${v.headline.perShare ? `<div class="kpi"><span class="kpi-label">${esc(VL.perShare)}</span><span class="kpi-value">${esc(v.headline.perShare)}</span></div>` : ''}</div>` : ''}
        ${v.warnings.map(w => `<div class="note" role="status">${esc(w)}</div>`).join('')}
        <div class="grid-2"><div>${T(v.wacc)}</div><div>${v.bridge ? T(v.bridge) + T(v.multiples) : ''}</div></div>
        <h3>${esc(VL.fcffTitle)}</h3>${T(v.fcff)}
        ${v.sens ? `<h3>${esc(VL.sens)}</h3><p class="muted small">${esc(VL.sensHint)}</p>${T(v.sens)}` : ''}
        ${v.scen ? `<h3>${esc(VL.scen)}</h3>${T(v.scen)}` : ''}
        <h3>${esc(VL.evaTitle)}</h3><p class="muted small">${esc(VL.evaHint)}</p>${T(v.eva)}
        <p class="muted small">${esc(v.assumptions)}</p>`}</section>`;
    const stmtRows = t => t.rows.map(r => `<tr class="${r.sub ? 'subtotal' : ''}">${r.cells.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}${!i && !r.mapped ? ' <span class="muted small">*</span>' : ''}</td>`).join('')}</tr>`);
    const sections = [
      ['summary', L.secSummary], ...(m.ai ? [['ai', L.aiSection]] : []), ['ratios', L.secRatios], ['dupont', L.secDupont],
      ['vertical', L.tabs.vertical], ['horizontal', L.tabs.horizontal], ['flags', L.flagsRecs],
      ...(m.val ? [['plan', L.secPlan]] : []), ...(m.forecast ? [['forecast', L.fcSection]] : []), ...(m.val ? [['valuation', L.secValuation]] : []), ['checks', L.needsReview],
    ];
    const h = m.health;
    const hColor = h.score == null ? 'var(--muted)' : h.score >= 65 ? 'var(--good)' : h.score >= 45 ? 'var(--warn)' : 'var(--bad)';
    const ratioTables = m.groups.map(g => `<h3>${esc(g.title)}</h3>` + tbl(g.head, g.rows.map(r =>
      `<tr><td><div class="ratio-name">${esc(r.name)}</div><div class="meaning">${esc(r.meaning)}</div><div class="formula" dir="ltr">${esc(r.formula)}</div></td>${r.values.map(v => `<td class="n">${esc(v)}</td>`).join('')}<td class="n muted">${esc(r.typical)}</td><td><span class="pill ${r.status}">${esc(r.statusText)}</span></td></tr>`))).join('');
    return `
      <header class="fa-head"><h2>${esc(m.title)}</h2><p class="muted small">${esc(m.meta)}</p></header>
      <nav class="fa-toc" aria-label="${esc(L.toc)}"><b>${esc(L.toc)}</b>${sections.map(([k, t], i) => `<a href="#${id(k)}">${i + 1}. ${esc(t)}</a>`).join('')}</nav>
      <section class="fa-sec" id="${id('summary')}"><h2>${esc(L.secSummary)}</h2>
        <div class="fa-health"><span class="fa-score" style="border-color:${hColor};color:${hColor}">${h.score ?? '—'}</span><div><b>${esc(L.health)}${h.grade ? ` · ${h.grade}` : ''}</b><p>${esc(m.summary)}</p></div></div>
        <div class="kpis">${m.kpis.map(k => `<div class="kpi"><span class="kpi-label">${esc(k.label)}</span><span class="kpi-value">${esc(k.value)}</span><span class="kpi-delta ${k.dir}">${esc(k.delta) || '&nbsp;'}</span></div>`).join('')}</div>
        <div class="grid-2 fa-charts">${m.charts.map(c => `<figure class="card"><figcaption><b>${esc(c.title)}</b></figcaption>${CFO.svgChart(c)}</figure>`).join('')}</div>
      </section>
      ${m.ai ? `<section class="fa-sec" id="${id('ai')}"><h2>${esc(L.aiSection)}</h2><div class="ai-text">${CFO.md ? CFO.md(m.ai) : esc(m.ai)}</div><p class="muted small">${esc(L.ai.note)}</p></section>` : ''}
      <section class="fa-sec" id="${id('ratios')}"><h2>${esc(L.secRatios)}</h2><p class="muted small">${esc(L.sectorNote)}</p>${ratioTables}</section>
      <section class="fa-sec" id="${id('dupont')}"><h2>${esc(L.secDupont)}</h2><p class="muted small">${esc(L.dupontHint)}</p>${tbl(m.dupont.head, plainRows(m.dupont.rows))}
        <h3>${esc(L.dupont5)}</h3>${T(m.dupont5)}
        <p><b>${esc(CFO.ratioName('altman_z', R.lang))}: ${esc(m.altman.value)}</b> <span class="pill ${m.altman.status}">${esc(L.status[m.altman.status] || '')}</span><br>${esc(m.altman.meaning)}<br><span class="muted small">${esc(m.altman.zones)}</span></p></section>
      <section class="fa-sec" id="${id('vertical')}"><h2>${esc(L.tabs.vertical)}</h2><p class="muted small">${esc(L.verticalHint)}</p>${m.vertical.map(t => `<h3>${esc(t.title)}</h3>` + tbl(t.head, stmtRows(t))).join('')}</section>
      <section class="fa-sec" id="${id('horizontal')}"><h2>${esc(L.tabs.horizontal)}</h2>${m.horizontal.map(t => `<h3>${esc(t.title)}</h3>` + tbl(t.head, stmtRows(t))).join('')}</section>
      <section class="fa-sec" id="${id('flags')}"><h2>${esc(L.flagsRecs)}</h2>
        ${m.flags.length ? `<div class="list">${m.flags.map(f => `<article class="flag ${f.sev}"><div class="flag-head"><span class="pill ${f.sev}">${esc(f.sevText)}</span><h3>${esc(f.title)}</h3></div><dl><dt>${esc(L.evidence)}</dt><dd class="ev">${esc(f.ev)}</dd><dt>${esc(L.action)}</dt><dd>${esc(f.rec)}</dd></dl></article>`).join('')}</div>` : `<p>${esc(L.noFlags)}</p>`}
        ${m.strengths.length ? `<h3>${esc(L.strengths)}</h3><ul>${li(m.strengths)}</ul>` : ''}</section>
      ${planHTML}
      ${m.forecast ? `<section class="fa-sec" id="${id('forecast')}"><h2>${esc(L.fcSection)}</h2>${tbl(m.forecast.head, plainRows(m.forecast.rows))}
        <h3>${esc(L.fc.detail)}</h3>${tbl(m.forecastDetail.head, plainRows(m.forecastDetail.rows))}<p class="muted small">${esc(m.forecast.note)}</p></section>` : ''}
      ${valHTML}
      <section class="fa-sec" id="${id('checks')}"><h2>${esc(L.needsReview)}</h2>
        ${m.checks.length ? `<h3>${esc(L.issues)}</h3><ul>${li(m.checks)}</ul>` : ''}
        <ul>${li(m.review)}</ul><h3>${esc(L.assumptions)}</h3><ul>${li(m.assumptions)}</ul><h3>${esc(L.nextSteps)}</h3><ol>${li(m.next)}</ol></section>`;
  }

  function reportMarkdown(R) {
    const m = model(R), L = L_(R.lang);
    const mdTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map((_, i) => i ? '---:' : '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)];
    const lines = [`# ${m.title}`, m.meta, '', `## ${L.secSummary}`, m.summary, '', ...m.kpis.map(k => `- **${k.label}**: ${k.value} ${k.delta}`), ''];
    if (m.ai) lines.push(`## ${L.aiSection}`, m.ai, '', `_${L.ai.note}_`, '');
    lines.push(`## ${L.secRatios}`);
    m.groups.forEach(g => lines.push('', `### ${g.title}`, ...mdTable(g.head, g.rows.map(r => [r.name, ...r.values, r.typical, r.statusText]))));
    lines.push('', `## ${L.secDupont}`, ...mdTable(m.dupont.head, m.dupont.rows), '', `### ${L.dupont5}`, ...mdTable(m.dupont5.head, m.dupont5.rows), '', `${CFO.ratioName('altman_z', R.lang)}: ${m.altman.value} — ${m.altman.meaning}`);
    lines.push('', `## ${L.tabs.vertical}`); m.vertical.forEach(t => lines.push('', `### ${t.title}`, ...mdTable(t.head, t.rows.map(r => r.cells))));
    lines.push('', `## ${L.tabs.horizontal}`); m.horizontal.forEach(t => lines.push('', `### ${t.title}`, ...mdTable(t.head, t.rows.map(r => r.cells))));
    lines.push('', `## ${L.flagsRecs}`);
    m.flags.length ? m.flags.forEach((f, i) => lines.push(`${i + 1}. **[${f.sevText}] ${f.title}** — ${f.ev}  \n   ${f.rec}`)) : lines.push(L.noFlags);
    if (m.strengths.length) lines.push('', `### ${L.strengths}`, ...m.strengths.map(t => `- ${t}`));
    const v = m.val, VL = CFO.UI[R.lang].val;
    if (v) {
      lines.push('', `## ${L.secPlan}`, `_${VL.planHint}_`);
      v.plan.items.forEach(it => lines.push(`${it.n}. **[${it.sevText} · ${it.horizon} · ${it.areaText}] ${it.title}** — ${it.action}  \n   ${it.kpi}: ${it.current} → ${it.target}`));
      if (v.levers?.rows.length) lines.push('', `### ${VL.levers}`, ...mdTable(v.levers.head, v.levers.rows));
    }
    if (m.forecast) lines.push('', `## ${L.fcSection}`, ...mdTable(m.forecast.head, m.forecast.rows), '', `### ${L.fc.detail}`, ...mdTable(m.forecastDetail.head, m.forecastDetail.rows));
    if (v) {
      lines.push('', `## ${L.secValuation}`, `_${VL.hint}_`);
      if (v.missing) lines.push(v.missing);
      else {
        v.warnings.forEach(w => lines.push(`> ${w}`));
        lines.push('', ...mdTable(v.wacc.head, v.wacc.rows));
        if (v.bridge) lines.push('', ...mdTable(v.bridge.head, v.bridge.rows), '', ...mdTable(v.multiples.head, v.multiples.rows));
        lines.push('', `### ${VL.fcffTitle}`, ...mdTable(v.fcff.head, v.fcff.rows));
        if (v.sens) lines.push('', `### ${VL.sens}`, ...mdTable(v.sens.head, v.sens.rows));
        if (v.scen) lines.push('', `### ${VL.scen}`, ...mdTable(v.scen.head, v.scen.rows));
        lines.push('', `### ${VL.evaTitle}`, ...mdTable(v.eva.head, v.eva.rows), '', `_${v.assumptions}_`);
      }
    }
    lines.push('', `## ${L.needsReview}`, ...m.checks.map(t => `- ${t}`), ...m.review.map(t => `- ${t}`), '', `## ${L.assumptions}`, ...m.assumptions.map(t => `- ${t}`),
      '', `## ${L.nextSteps}`, ...m.next.map((t, i) => `${i + 1}. ${t}`));
    return lines.join('\n');
  }

  /** Save a generated file. Inside the claude.ai viewer the page cannot download by itself, so the
   * viewer's own save prompt is used (the `downloads` capability); elsewhere a normal browser download.
   * Resolves 'saved' | 'declined' | 'unavailable'. */
  async function download(name, blob) {
    const dl = globalThis.claude?.use ? await globalThis.claude.use('downloads').catch(() => null) : null;
    if (dl) {
      try { await dl.save({ filename: name, data: blob }); return 'saved'; }
      catch (e) { return e && (e.code === 'declined' || e.code === 'rate_limited') ? 'declined' : 'unavailable'; }
    }
    if (globalThis.claude?.use) return 'unavailable';      // in the viewer without the capability, a link would do nothing
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return 'saved';
  }

  const fileName = (R, ext) => `cfo-report-${R.A.latest || 'analysis'}-${R.lang}.${ext}`;

  /** A standalone HTML document with the full analysis in English and Arabic and its own switches.
   * Needs nothing from the internet; `css` is the dashboard's stylesheet text. */
  function fullDocument(R, css = '') {
    const parts = ['en', 'ar'].map(lang => {
      // Claude's commentary appears only in the language it was written in.
      const text = R.aiAll ?? R.ai;
      const RL = { ...R, lang, ai: R.aiLang && R.aiLang !== lang ? '' : text };
      return `<div class="fa-doc" data-lang="${lang}" lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"${lang === R.lang ? '' : ' hidden'}>${fullHTML(RL)}</div>`;
    }).join('');
    const title = `${CFO.UI[R.lang].fullTitle} · ${R.A.latest || ''}`;
    const script = `(function(){var d=document.documentElement;function setL(l){var a=document.querySelectorAll('[data-lang]');for(var i=0;i<a.length;i++){a[i].hidden=a[i].getAttribute('data-lang')!==l;}d.lang=l;d.dir=l==='ar'?'rtl':'ltr';var b=document.querySelectorAll('[data-l]');for(var j=0;j<b.length;j++){b[j].setAttribute('aria-pressed',String(b[j].getAttribute('data-l')===l));}try{localStorage.setItem('cfo-lens-lang',l);}catch(e){}}
var s=null;try{s=localStorage.getItem('cfo-lens-lang');}catch(e){}setL(s==='en'||s==='ar'?s:'${R.lang}');
document.addEventListener('click',function(e){var t=e.target.closest('[data-l]');if(t){setL(t.getAttribute('data-l'));return;}if(e.target.closest('[data-theme-toggle]')){var dark=d.getAttribute('data-theme')?d.getAttribute('data-theme')==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;d.setAttribute('data-theme',dark?'light':'dark');}});})();`;
    // Light by default: it is a document people print; the switch offers dark.
    return `<!doctype html><html lang="${R.lang}" dir="${R.lang === 'ar' ? 'rtl' : 'ltr'}" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>${css}
.fa-bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--line)}
.fa-bar b{margin-inline-end:auto;font-family:var(--font-display);font-size:1.1rem}
.fa-bar button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
@media print{.fa-bar{display:none}}</style></head>
<body><div class="fa-bar"><b>CFO Lens</b><button class="btn" type="button" data-l="en">English</button><button class="btn" type="button" data-l="ar">العربية</button><button class="btn ghost" type="button" data-theme-toggle aria-label="Theme">◐</button></div>
<main class="wrap"><article class="report full">${parts}</article></main><script>${script}</script></body></html>`;
  }

  function exportHTML(R) {
    const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
    return download(`cfo-full-analysis-${R.A.latest || 'report'}.html`, new Blob([fullDocument(R, css)], { type: 'text/html' }));
  }

  /* Word: real text with right-to-left paragraphs for Arabic (Word shapes the Arabic letters itself). */
  async function exportDOCX(R) {
    const D = globalThis.docx, m = model(R), L = L_(R.lang), rtl = R.lang === 'ar';
    const font = { ascii: 'Calibri', hAnsi: 'Calibri', cs: 'Arial' };
    const run = (text, o = {}) => new D.TextRun({ text: String(text ?? ''), font, rightToLeft: rtl, size: o.size || 21, sizeComplexScript: o.size || 21, bold: o.bold, color: o.color });
    const align = rtl ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT;
    const para = (text, o = {}) => new D.Paragraph({ bidirectional: rtl, alignment: align, spacing: { after: 80 }, heading: o.heading, bullet: o.bullet ? { level: 0 } : undefined,
      children: Array.isArray(text) ? text : [run(text, o)] });
    const h = (text, level) => new D.Paragraph({ bidirectional: rtl, alignment: align, heading: level, spacing: { before: 240, after: 100 }, children: [run(text, { bold: true, size: level === D.HeadingLevel.TITLE ? 36 : 26, color: '0D6B63' })] });
    // **bold** spans inside a line
    const rich = text => String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t => /^\*\*.*\*\*$/.test(t) ? run(t.slice(2, -2), { bold: true }) : run(t));
    const cell = (text, o = {}) => new D.TableCell({ shading: o.head ? { fill: 'EAEEEB', type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new D.Paragraph({ bidirectional: rtl, alignment: o.num ? (rtl ? D.AlignmentType.LEFT : D.AlignmentType.RIGHT) : align, children: [run(text, { bold: o.head, size: 18 })] })] });
    const tbl = t => new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, visuallyRightToLeft: rtl,
      rows: [new D.TableRow({ tableHeader: true, children: t.head.map((c, i) => cell(c, { head: true, num: i >= (t.text || 1) })) }),
        ...t.rows.map(r => new D.TableRow({ children: r.map((c, i) => cell(c, { num: i >= (t.text || 1) && i < t.head.length - (t.textCols || 0) })) }))] });
    const list = (items, numbered) => items.map((t, i) => para(numbered ? `${i + 1}. ${t}` : t, { bullet: !numbered }));
    const aiParas = text => String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const hd = l.match(/^#{1,4}\s+(.*)$/); if (hd) return h(hd[1].replace(/\*\*/g, ''), D.HeadingLevel.HEADING_3);
      const li = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/); if (li) return para(rich(li[1]), { bullet: true });
      return para(rich(l));
    });

    const H1 = t => h(t, D.HeadingLevel.HEADING_1), H2 = t => h(t, D.HeadingLevel.HEADING_2);
    const v = m.val, VL = CFO.UI[R.lang].val;
    const muted = t => para(t, { size: 18, color: '586664' });
    const children = [
      h(m.title, D.HeadingLevel.TITLE), muted(m.meta),
      H1(L.secSummary), para(m.summary),
      tbl({ head: [L.item, m.latest, ''], rows: m.kpis.map(k => [k.label, k.value, k.delta]) }),
      ...(m.ai ? [H1(L.aiSection), ...aiParas(m.ai), muted(L.ai.note)] : []),
      H1(L.secRatios), muted(L.sectorNote),
      ...m.groups.flatMap(g => [H2(g.title), tbl({ head: [...g.head, L.meaning], textCols: 2, rows: g.rows.map(r => [r.name, ...r.values, r.typical, r.statusText, r.meaning]) })]),
      H1(L.secDupont), muted(L.dupontHint), tbl(m.dupont), H2(L.dupont5), tbl(m.dupont5),
      para([run(`${CFO.ratioName('altman_z', R.lang)}: ${m.altman.value}  `, { bold: true }), run(m.altman.meaning)]), muted(m.altman.zones),
      H1(L.tabs.vertical), muted(L.verticalHint), ...m.vertical.flatMap(t => [H2(t.title), tbl({ head: t.head, rows: t.rows.map(r => r.cells) })]),
      H1(L.tabs.horizontal), ...m.horizontal.flatMap(t => [H2(t.title), tbl({ head: t.head, rows: t.rows.map(r => r.cells) })]),
      H1(L.flagsRecs),
      ...(m.flags.length ? m.flags.flatMap(f => [para([run(`[${f.sevText}] `, { bold: true, color: f.sev === 'high' ? 'B42318' : f.sev === 'med' ? '9A6500' : '586664' }), run(f.title, { bold: true })]),
        para(`${L.evidence}: ${f.ev}`, { size: 19 }), para(`${L.action}: ${f.rec}`, { size: 19 })]) : [para(L.noFlags)]),
      ...(m.strengths.length ? [H2(L.strengths), ...list(m.strengths)] : []),
      ...(v ? [H1(L.secPlan), muted(VL.planHint), ...(v.plan.rows.length ? [tbl({ head: v.plan.head, rows: v.plan.rows, textCols: 7 })] : []),
        ...(v.levers?.rows.length ? [H2(VL.levers), muted(VL.leversHint), tbl(v.levers)] : [])] : []),
      ...(m.forecast ? [H1(L.fcSection), tbl(m.forecast), H2(L.fc.detail), tbl(m.forecastDetail), muted(m.forecast.note)] : []),
      ...(v ? [H1(L.secValuation), muted(VL.hint), ...(v.missing ? [para(v.missing)] : [
        ...v.warnings.map(w => para(w, { color: '9A6500' })), tbl(v.wacc), ...(v.bridge ? [tbl(v.bridge), tbl(v.multiples)] : []),
        H2(VL.fcffTitle), tbl(v.fcff), ...(v.sens ? [H2(VL.sens), muted(VL.sensHint), tbl(v.sens)] : []), ...(v.scen ? [H2(VL.scen), tbl(v.scen)] : []),
        H2(VL.evaTitle), muted(VL.evaHint), tbl(v.eva), muted(v.assumptions)])] : []),
      H1(L.needsReview), ...(m.checks.length ? [H2(L.issues), ...list(m.checks)] : []), ...list(m.review),
      H1(L.assumptions), ...list(m.assumptions),
      H1(L.nextSteps), ...list(m.next, true),
    ];
    const doc = new D.Document({ creator: 'CFO Lens', title: m.title, sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }] });
    return download(fileName(R, 'docx'), await D.Packer.toBlob(doc));
  }

  /* PDF: drawn from the on-screen report, so Arabic text and layout look exactly as they do in the page.
   * The text is part of the image (not selectable); the Word file is the editable version. */
  async function exportPDF(R, el) {
    if (!el) throw new Error('report not on screen');
    const root = document.documentElement, theme = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');                       // print on white whatever the screen theme
    // html2canvas draws each SVG as a separate image that cannot see the page's CSS variables,
    // so chart colours are written out as literal values for the capture and put back afterwards.
    const tokens = getComputedStyle(root), restore = [];
    el.querySelectorAll('svg.svg-chart [fill^="var("], svg.svg-chart [stroke^="var("]').forEach(node => {
      for (const attr of ['fill', 'stroke']) {
        const v = node.getAttribute(attr), m = v && v.match(/^var\((--[\w-]+)\)$/);
        if (m) { restore.push([node, attr, v]); node.setAttribute(attr, tokens.getPropertyValue(m[1]).trim() || '#000'); }
      }
    });
    const width = el.style.width; el.style.width = '860px';           // A4-friendly text size
    const { jsPDF } = globalThis.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const margin = 10, w = 210 - 2 * margin, pageH = 297 - 2 * margin - 6;
    let y = 0, page = 1;
    try {
      // One block at a time keeps every canvas well under the ~16M-pixel limit of Safari / iOS.
      for (const block of el.children) {
        if (!block.offsetHeight) continue;
        const scale = Math.min(2, Math.sqrt(16e6 / Math.max(1, block.scrollWidth * block.scrollHeight)));
        const canvas = await globalThis.html2canvas(block, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false });
        const pxPerMm = canvas.width / w;
        let srcY = 0;
        while (srcY < canvas.height) {
          if (y >= pageH - 4) { pdf.addPage(); page++; y = 0; }
          const take = Math.min(canvas.height - srcY, Math.floor((pageH - y) * pxPerMm));
          const part = document.createElement('canvas');
          part.width = canvas.width; part.height = take;
          const g = part.getContext('2d');
          g.fillStyle = '#ffffff'; g.fillRect(0, 0, part.width, part.height);
          g.drawImage(canvas, 0, srcY, part.width, take, 0, 0, part.width, take);
          pdf.addImage(part.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin + y, w, take / pxPerMm);
          y += take / pxPerMm + 2; srcY += take;
        }
      }
    } finally {
      el.style.width = width;
      restore.forEach(([node, attr, v]) => node.setAttribute(attr, v));
      theme == null ? root.removeAttribute('data-theme') : root.setAttribute('data-theme', theme);
    }
    for (let i = 1; i <= page; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(`${i} / ${page}`, 105, 297 - 6, { align: 'center' }); }
    return download(fileName(R, 'pdf'), pdf.output('blob'));
  }


  function exportXLSX(R) {
    const { A, F, S, lang } = R;
    const X = globalThis.XLSX, L = L_(lang), P = A.ds.periods, ds = A.ds, m = model(R);
    const wb = X.utils.book_new();
    const add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), name);
    add('Summary', [[L.reportTitle], [m.meta], [CFO.summary(A, F, lang)], [], [L.health, A.health?.score, A.health?.grade]]);
    add('Data', [[L.item, ...P], ...CFO.ITEMS.filter(it => P.some(p => ds.data[p][it.key] != null)).map(it => [CFO.itemName(it.key, lang), ...P.map(p => ds.data[p][it.key] ?? '')])]);
    add('Ratios', [[lang === 'ar' ? 'المجموعة' : 'Group', L.item, L.formula, ...P, L.typical, `${A.latest}`, L.meaning],
      ...CFO.RATIOS.map(def => [L.groups[def.group], CFO.ratioName(def.id, lang), def.f, ...P.map(p => A.ratios[def.id][p].value ?? ''), CFO.bench(def.id).typical ?? '', L.status[A.ratios[def.id][A.latest].status || 'na'], CFO.meaning(def.id, A.ratios[def.id][A.latest].value, lang)])]);
    const label = r => r.key ? CFO.itemName(r.key, lang) : r.label;
    add('Vertical', [['', L.item, ...P.map(p => `${p} %`)], ...A.vertical.map(r => [L.st[r.st], label(r), ...P.map(p => r.pct[p] ?? '')])]);
    add('Horizontal', [['', L.item, ...P.map(p => `${p} ${L.yoy} %`), ...P.map(p => `${p} ${L.index}`), L.cagr],
      ...A.horizontal.map(r => [L.st[r.st], label(r), ...P.map(p => r.yoy[p]?.pct ?? ''), ...P.map(p => r.idx[p] ?? ''), r.cagr ?? ''])]);
    add('Red flags', [[lang === 'ar' ? 'الخطورة' : 'Severity', L.flagsTitle, L.evidence, L.action], ...F.map(f => [L.sev[f.sev], f.title[lang], f.ev(lang), f.rec[lang]])]);
    if (S) {
      const lines = ['revenue', 'gross_profit', 'operating_income', 'net_income', 'cash', 'total_assets', 'total_liabilities', 'equity', 'cfo', 'capex', 'dividends'];
      const rows = [[L.fc.title], ...Object.entries(S.base.drivers).map(([k, v]) => [L.fc.d[k], v])];
      for (const [name, sc] of Object.entries(S)) {
        rows.push([], [L.fc.sc[name], ...sc.years.map(y => y.period)]);
        lines.forEach(k => rows.push([CFO.itemName(k, lang), ...sc.years.map(y => y.data[k])]));
        rows.push([L.fc.funding, ...sc.years.map(y => y.fundingNeed)]);
      }
      add('Forecast', rows);
    }
    const v = m.val, VL = CFO.UI[lang].val;
    if (v?.plan.rows.length) add('Action plan', [v.plan.head, ...v.plan.rows]);
    if (v && !v.missing) {
      const V = v.V, rows = [[VL.title], [VL.hint], ...v.warnings.map(w => [w]), [], ...v.wacc.rows.map(([k]) => [k]).map((r, i) => [r[0], [V.inputs.rf, V.inputs.erp, V.inputs.beta, V.ke, V.inputs.kd, V.inputs.tax, V.kdAt, V.inputs.wd, V.wacc, V.inputs.g, V.ronic][i]]), [],
        ['', ...V.rows.map(r => r.period)], ...['revenue', 'growth', 'ebit', 'nopat', 'dna', 'capex', 'dNwc', 'fcff', 'df', 'pv'].map(k => [k === 'revenue' ? CFO.itemName('revenue', lang) : VL[k], ...V.rows.map(r => r[k])])];
      if (!V.error) {
        rows.push([], [VL.sumPv, V.sumPv], [VL.pvTv, V.pvTv], [VL.ev, V.ev], [VL.netDebt, V.netDebt], [VL.equity, V.equity], [VL.perShare, V.perShare ?? ''], [VL.upside, V.upside ?? ''], [VL.tvShare, V.tvShare ?? ''],
          [VL.evEbitda, V.evEbitda ?? ''], [VL.pe, V.pe ?? ''], [], [VL.sens], ['WACC \\ g', ...V.sens.gs], ...V.sens.waccs.map((w, i) => [w, ...V.sens.grid[i].map(x => x ?? '')]));
        if (v.levers?.rows.length) rows.push([], [VL.levers], ...v.levers.rows);
      }
      rows.push([], [VL.evaTitle], v.eva.head, ...V.eva.map(e => [e.period, e.nopat ?? '', e.ic ?? '', e.roic ?? '', V.wacc, e.roic == null ? '' : e.roic - V.wacc, e.eva ?? '']));
      add('Valuation', rows);
    }
    if (R.ai) add('Claude', [[L.aiSection], [L.ai.note], ...String(R.ai).split(/\r?\n/).map(l => [l])]);
    add('Mapping', [[L.source, L.rawLabel, L.mappedTo, ...P], ...ds.lines.map(l => [l.source, l.label, l.key ? CFO.itemName(l.key, lang) : '', ...P.map(p => l.values[p] ?? '')])]);
    const bytes = X.write(wb, { type: 'array', bookType: 'xlsx' });
    return download(`cfo-analysis-${A.latest || 'report'}.xlsx`, new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }

  CFO.reportModel = model;
  CFO.kpiList = kpiList;
  CFO.forecastTables = forecastTables;
  CFO.SUBTOTALS = SUBTOTALS;
  CFO.reportHTML = fullHTML;
  CFO.fullHTML = fullHTML;
  CFO.fullDocument = fullDocument;
  CFO.reportMarkdown = reportMarkdown;
  CFO.exportHTML = exportHTML;
  CFO.exportXLSX = exportXLSX;
  CFO.exportDOCX = exportDOCX;
  CFO.exportPDF = exportPDF;
  CFO.esc = esc;
})(globalThis.CFO = globalThis.CFO || {});
