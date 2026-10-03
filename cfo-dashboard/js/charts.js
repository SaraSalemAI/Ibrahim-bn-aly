/* Overview charts (Chart.js) and KPI sparklines (inline SVG). Colours come from CSS tokens. */
(function (CFO) {
  const live = {};
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function base(lang, unit) {
    const muted = css('--muted'), line = css('--line'), ink = css('--ink');
    const rtl = lang === 'ar';
    const fmt = v => unit === '%' ? CFO.fmtPct(v, lang) : CFO.fmtNum(v, 0, lang);
    return {
      responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { left: 10, right: 10 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { rtl, labels: { color: ink, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', font: { family: css('--font-body') } } },
        tooltip: { rtl, callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.y)}` } },
      },
      scales: {
        x: { reverse: rtl, grid: { display: false }, ticks: { color: muted }, border: { color: line } },
        y: { position: rtl ? 'right' : 'left', grid: { color: line, drawTicks: false }, border: { display: false },
             ticks: { color: muted, padding: 6, maxTicksLimit: 5, callback: v => unit === '%' ? CFO.fmtPct(v, lang).replace(/\.0%/, '%') : CFO.fmtNum(v, 0, lang) } },
      },
    };
  }

  function put(id, cfg) {
    const el = document.getElementById(id);
    if (!el || !globalThis.Chart) return;
    if (live[id]) live[id].destroy();
    live[id] = new globalThis.Chart(el, cfg);
  }

  const bar = (label, data, color) => ({ type: 'bar', label, data, backgroundColor: color, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 30, categoryPercentage: 0.7, barPercentage: 0.9 });
  const line = (label, data, color) => ({ type: 'line', label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: css('--surface'), pointBorderWidth: 2, tension: 0, spanGaps: true });

  function draw(A, lang) {
    const ds = A.ds, P = ds.periods, L = CFO.UI[lang];
    const get = k => P.map(p => ds.data[p][k] ?? null);
    const R = id => P.map(p => A.ratios[id][p].value);
    const s1 = css('--s1'), s2 = css('--s2'), s3 = css('--s3');
    const name = k => CFO.itemName(k, lang);

    put('c-revenue', { type: 'bar', data: { labels: P, datasets: [bar(name('revenue'), get('revenue'), s1), bar(name('net_income'), get('net_income'), s2)] }, options: base(lang) });
    put('c-margins', { type: 'line', data: { labels: P, datasets: [line(CFO.ratioName('gross_margin', lang), R('gross_margin'), s1), line(CFO.ratioName('operating_margin', lang), R('operating_margin'), s2), line(CFO.ratioName('net_margin', lang), R('net_margin'), s3)] }, options: base(lang, '%') });

    // Funding structure: how each year's assets are financed (shares of total assets, stacked to 100%).
    const share = (k, p) => { const d = CFO.enrich(ds.data[p]); return d.total_assets ? (k === 'ncl' ? (d.total_liabilities != null && d.current_liabilities != null ? d.total_liabilities - d.current_liabilities : null) : d[k]) / d.total_assets : null; };
    const opt = base(lang, '%'); opt.scales.x.stacked = true; opt.scales.y.stacked = true; opt.scales.y.max = 1;
    put('c-structure', { type: 'bar', data: { labels: P, datasets: [
      { ...bar(name('equity'), P.map(p => share('equity', p)), s1), borderRadius: 0, borderColor: css('--surface'), borderWidth: { top: 2 } },
      { ...bar(lang === 'ar' ? 'التزامات غير متداولة' : 'Non-current liabilities', P.map(p => share('ncl', p)), s2), borderRadius: 0, borderColor: css('--surface'), borderWidth: { top: 2 } },
      { ...bar(name('current_liabilities'), P.map(p => share('current_liabilities', p)), s3), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: false },
    ] }, options: opt });

    put('c-cash', { type: 'bar', data: { labels: P, datasets: [
      bar(name('cfo'), get('cfo'), s1),
      bar(name('capex'), P.map(p => ds.data[p].capex != null ? -ds.data[p].capex : null), s2),
      bar(L.kpi.fcf, P.map(p => CFO.enrich(ds.data[p]).fcf), s3),
    ] }, options: base(lang) });
  }

  /** Small trend line for KPI tiles; the last point is emphasised. */
  function sparkline(values) {
    const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
    if (pts.length < 2) return '';
    const W = 160, H = 28, pad = 3;
    const ys = pts.map(p => p[1]), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
    const X = i => pad + i / (values.length - 1) * (W - 2 * pad), Y = v => H - pad - (v - min) / span * (H - 2 * pad);
    const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const [li, lv] = pts[pts.length - 1];
    const area = `${d} L${X(li).toFixed(1)},${H} L${X(pts[0][0]).toFixed(1)},${H} Z`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${area}" fill="var(--accent-soft)"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${X(li).toFixed(1)}" cy="${Y(lv).toFixed(1)}" r="3" fill="var(--accent)"/></svg>`;
  }

  /** Cash and net income per scenario, starting from the last actual year. */
  function drawForecast(S, ds, lang) {
    if (!S) return;
    const last = ds.periods[ds.periods.length - 1], F = CFO.UI[lang].fc;
    const labels = [last, ...S.base.years.map(y => y.period)];
    const colors = { base: css('--s1'), upside: css('--s2'), downside: css('--s3') };
    const series = key => Object.keys(colors).map(n => line(F.sc[n], [ds.data[last][key] ?? null, ...S[n].years.map(y => y.data[key])], colors[n]));
    put('c-fc-cash', { type: 'line', data: { labels, datasets: series('cash') }, options: base(lang) });
    put('c-fc-ni', { type: 'line', data: { labels, datasets: series('net_income') }, options: base(lang) });
  }

  CFO.drawCharts = draw;
  CFO.drawForecastCharts = drawForecast;
  CFO.sparkline = sparkline;
})(globalThis.CFO = globalThis.CFO || {});
