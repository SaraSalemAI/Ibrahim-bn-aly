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

  /* ---------- Inline SVG charts (no library): used by the Full analysis and the exported HTML ---------- */
  const escX = t => CFO.esc(t);   // defined in js/report.js, available by the time charts are drawn
  function niceStep(span) {
    const raw = span / 4 || 1, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }
  /** { kind: 'bar' | 'line' | 'stack', labels, series: [{ name, values, color }], fmt, title } -> SVG string.
   * One axis, at most three series, a legend, and a native tooltip (<title>) on every mark. */
  function svgChart({ kind = 'bar', labels, series, fmt = v => String(v), title = '', max100 = false }) {
    const W = 560, H = 236, L = 64, R = 14, T = 34, B = 26;
    const ok = v => v != null && isFinite(v);
    let lo = 0, hi = 0;
    if (kind === 'stack') labels.forEach((_, i) => { const t = series.reduce((a, s) => a + (ok(s.values[i]) ? s.values[i] : 0), 0); hi = Math.max(hi, t); });
    else series.forEach(s => s.values.forEach(v => { if (ok(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (max100) hi = Math.max(hi, 1);
    if (hi === lo) hi = lo + 1;
    const step = niceStep(hi - lo), y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
    const y = v => T + (y1 - v) / (y1 - y0) * (H - T - B);
    const band = (W - L - R) / Math.max(1, labels.length), cx = i => L + band * (i + 0.5);
    const out = [];
    for (let v = y0; v <= y1 + step / 2; v += step) {
      out.push(`<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-width="${Math.abs(v) < step / 2 ? 1.2 : 0.6}"/>`,
        `<text x="${L - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${escX(fmt(Math.abs(v) < step / 1e6 ? 0 : v))}</text>`);
    }
    labels.forEach((lab, i) => out.push(`<text x="${cx(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${escX(lab)}</text>`));
    if (kind === 'bar') {
      const gw = band * 0.72, bw = Math.max(4, gw / series.length - 2);
      series.forEach((s, k) => s.values.forEach((v, i) => {
        if (!ok(v)) return;
        const x = cx(i) - gw / 2 + k * (bw + 2), top = y(Math.max(v, 0)), h = Math.max(1, Math.abs(y(v) - y(0)));
        out.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${s.color}"><title>${escX(`${s.name} · ${labels[i]}: ${fmt(v)}`)}</title></rect>`);
      }));
    } else if (kind === 'stack') {
      const bw = Math.min(46, band * 0.5);
      labels.forEach((lab, i) => {
        let acc = 0;
        series.forEach(s => {
          const v = s.values[i]; if (!ok(v) || v <= 0) return;
          const top = y(acc + v), h = y(acc) - top;
          out.push(`<rect x="${(cx(i) - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h - 2).toFixed(1)}" fill="${s.color}"><title>${escX(`${s.name} · ${lab}: ${fmt(v)}`)}</title></rect>`);
          acc += v;
        });
      });
    } else {
      series.forEach(s => {
        const pts = s.values.map((v, i) => ok(v) ? [cx(i), y(v), v, i] : null).filter(Boolean);
        if (pts.length > 1) out.push(`<path d="${pts.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2"/>`);
        pts.forEach(p => out.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"><title>${escX(`${s.name} · ${labels[p[3]]}: ${fmt(p[2])}`)}</title></circle>`));
      });
    }
    let lx = L;
    series.forEach(s => {
      out.push(`<rect x="${lx}" y="10" width="10" height="10" rx="2" fill="${s.color}"/><text x="${lx + 14}" y="19" font-size="11" fill="var(--ink)">${escX(s.name)}</text>`);
      lx += 26 + s.name.length * 6.4;
    });
    return `<svg class="svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escX(title)}" style="direction:ltr">${out.join('')}</svg>`;
  }

  CFO.svgChart = svgChart;
  CFO.drawCharts = draw;
  CFO.drawForecastCharts = drawForecast;
  CFO.sparkline = sparkline;
})(globalThis.CFO = globalThis.CFO || {});
