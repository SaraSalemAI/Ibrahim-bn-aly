/* SUMED P2P — dependency-free SVG charts. Colours come from CSS custom properties (--s1..--s8, status)
 * so light/dark are selected per theme. Every mark carries data-tip (hover) and optional data-drill/data-nav. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const esc = U.esc;
  const C = (S.chart = {});

  const nice = (max) => {
    if (!(max > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const m = max / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  };
  const short = (v) => {
    const a = Math.abs(v);
    // Axis/label abbreviations stay language-neutral (K / M / bn) so they fit the axis in both languages; tooltips show full values.
    return a >= 1e9 ? S.fmt.num(v / 1e9, 1) + 'bn' : a >= 1e6 ? S.fmt.num(v / 1e6, a >= 1e8 ? 0 : 1) + 'M' : a >= 1e3 ? S.fmt.num(v / 1e3, 0) + 'K' : S.fmt.num(v, 0);
  };
  C.short = short;
  const series = (i) => `var(--s${(i % 8) + 1})`;
  const attrs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}="${esc(v)}"`).join(' ');

  /** Vertical or horizontal bars. data: [{label, value, tip, drill, nav, tone}] */
  C.bars = (data, o = {}) => {
    if (!data.length) return `<p class="muted">${esc(S.t('chart.noData', 'No data for this chart'))}</p>`;
    const W = 640, H = o.height || 240;
    if (o.horizontal) {
      const rowH = 26, pad = { l: o.labelW || 190, r: 70, t: 6, b: 6 };
      const h = pad.t + pad.b + data.length * rowH;
      const max = nice(Math.max(...data.map((d) => Math.abs(d.value || 0))));
      const iw = W - pad.l - pad.r;
      const bars = data.map((d, i) => {
        const w = Math.max(1, (Math.abs(d.value || 0) / max) * iw);
        const y = pad.t + i * rowH;
        const fill = d.tone ? `var(--st-${d.tone})` : series(o.slot || 0);
        const lab = String(d.label);
        return `<g class="mk" ${attrs({ 'data-tip': d.tip || `${lab}: ${S.fmt.num(d.value)}`, 'data-drill': d.drill, 'data-nav': d.nav })}>
          <rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"/>
          <text x="${pad.l - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" class="ax">${esc(lab.length > 28 ? lab.slice(0, 27) + '…' : lab)}</text>
          <rect x="${pad.l}" y="${y + 5}" width="${w}" height="${rowH - 10}" rx="3" fill="${fill}"/>
          <text x="${pad.l + w + 6}" y="${y + rowH / 2 + 4}" class="val">${esc(o.fmt ? o.fmt(d.value) : short(d.value))}</text></g>`;
      }).join('');
      return `<svg class="chart" dir="ltr" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(o.title || '')}">${bars}</svg>`;
    }
    const pad = { l: 56, r: 10, t: 14, b: 44 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const vals = data.map((d) => d.value || 0);
    const max = nice(Math.max(0, ...vals)), min = Math.min(0, ...vals) < 0 ? -nice(-Math.min(...vals)) : 0;
    const y = (v) => pad.t + ih - ((v - min) / (max - min)) * ih;
    const bw = iw / data.length;
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => { const v = min + (max - min) * f; return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${esc(short(v))}</text>`; }).join('');
    const every = Math.ceil(data.length / 12);
    const bars = data.map((d, i) => {
      const x = pad.l + i * bw;
      const v = d.value || 0;
      const top = Math.min(y(v), y(0)), hh = Math.max(1, Math.abs(y(v) - y(0)));
      const fill = d.tone ? `var(--st-${d.tone})` : series(o.slot || 0);
      return `<g class="mk" ${attrs({ 'data-tip': d.tip || `${d.label}: ${S.fmt.num(v)}`, 'data-drill': d.drill, 'data-nav': d.nav })}>
        <rect x="${x}" y="${pad.t}" width="${bw}" height="${ih}" fill="transparent"/>
        <rect x="${x + bw * 0.18}" y="${top}" width="${Math.max(2, bw * 0.64)}" height="${hh}" rx="3" fill="${fill}"/>
        ${i % every === 0 ? `<text x="${x + bw / 2}" y="${H - pad.b + 16}" text-anchor="middle" class="ax">${esc(String(d.label).slice(0, data.length <= 8 ? 16 : 10))}</text>` : ''}</g>`;
    }).join('');
    return `<svg class="chart" dir="ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}">${grid}<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(0)}" y2="${y(0)}" class="base"/>${bars}</svg>`;
  };

  /** Stacked vertical bars. cats: [label], ser: [{name, values:[], slot, tone}] */
  C.stacked = (cats, ser, o = {}) => {
    if (!cats.length) return `<p class="muted">${esc(S.t('chart.noData', 'No data for this chart'))}</p>`;
    const W = 640, H = o.height || 250, pad = { l: 56, r: 10, t: 14, b: 44 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const tot = cats.map((_, i) => U.sum(ser, (s) => Math.max(0, s.values[i] || 0)));
    const max = nice(Math.max(...tot, 0));
    const y = (v) => pad.t + ih - (v / max) * ih;
    const bw = iw / cats.length;
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(max * f)}" y2="${y(max * f)}" class="gl"/><text x="${pad.l - 6}" y="${y(max * f) + 4}" text-anchor="end" class="ax">${esc(short(max * f))}</text>`).join('');
    const every = Math.ceil(cats.length / 13);
    const bars = cats.map((c, i) => {
      let acc = 0;
      const x = pad.l + i * bw;
      const segs = ser.map((s, si) => {
        const v = Math.max(0, s.values[i] || 0);
        if (!v) return '';
        const y0 = y(acc), y1 = y(acc + v);
        acc += v;
        const fill = s.tone ? `var(--st-${s.tone})` : series(s.slot != null ? s.slot : si);
        return `<rect x="${x + bw * 0.16}" y="${y1}" width="${Math.max(2, bw * 0.68)}" height="${Math.max(0.5, y0 - y1 - 1)}" fill="${fill}"/>`;
      }).join('');
      const tip = `${c}\n` + ser.map((s) => `${s.name}: ${S.fmt.num(s.values[i] || 0)}`).join('\n') + `\nΣ ${S.fmt.num(tot[i])}`;
      return `<g class="mk" ${attrs({ 'data-tip': tip, 'data-nav': o.nav && o.nav(i), 'data-drill': o.drill && o.drill(i) })}><rect x="${x}" y="${pad.t}" width="${bw}" height="${ih}" fill="transparent"/>${segs}${i % every === 0 ? `<text x="${x + bw / 2}" y="${H - pad.b + 16}" text-anchor="middle" class="ax">${esc(String(c).slice(0, 10))}</text>` : ''}</g>`;
    }).join('');
    return `<svg class="chart" dir="ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}">${grid}${bars}</svg>${C.legend(ser)}`;
  };

  /** Line chart. xs: labels; ser: [{name, values, slot, dashed}]; o.threshold: {value, label} */
  C.line = (xs, ser, o = {}) => {
    if (!xs.length) return `<p class="muted">${esc(S.t('chart.noData', 'No data for this chart'))}</p>`;
    const W = 640, H = o.height || 240, pad = { l: 60, r: 12, t: 14, b: 40 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const all = ser.flatMap((s) => s.values.filter((v) => v != null)).concat(o.threshold ? [o.threshold.value] : []);
    let max = Math.max(...all), min = Math.min(...all);
    if (o.zero !== false) min = Math.min(0, min);
    const span = nice((max - min) || 1);
    max = min + span;
    const x = (i) => pad.l + (xs.length === 1 ? iw / 2 : (i / (xs.length - 1)) * iw);
    const y = (v) => pad.t + ih - ((v - min) / (max - min)) * ih;
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => { const v = min + (max - min) * f; return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${esc(short(v))}</text>`; }).join('');
    const every = Math.ceil(xs.length / 8);
    const xl = xs.map((l, i) => (i % every === 0 ? `<text x="${x(i)}" y="${H - pad.b + 16}" text-anchor="middle" class="ax">${esc(String(l).slice(0, 10))}</text>` : '')).join('');
    const paths = ser.map((s, si) => {
      let d = '';
      s.values.forEach((v, i) => { if (v == null) return; d += (d ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); });
      const col = s.tone ? `var(--st-${s.tone})` : series(s.slot != null ? s.slot : si);
      const area = o.area && si === 0 ? `<path d="${d}L${x(s.values.length - 1)},${y(Math.max(min, 0))}L${x(0)},${y(Math.max(min, 0))}Z" fill="${col}" opacity=".12"/>` : '';
      return `${area}<path d="${d}" fill="none" stroke="${col}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
    }).join('');
    const th = o.threshold ? `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(o.threshold.value)}" y2="${y(o.threshold.value)}" class="thr"/><text x="${W - pad.r}" y="${y(o.threshold.value) - 5}" text-anchor="end" class="thr-l">${esc(o.threshold.label)}</text>` : '';
    const hits = xs.map((l, i) => `<rect class="mk hit" x="${x(i) - iw / xs.length / 2}" y="${pad.t}" width="${Math.max(2, iw / xs.length)}" height="${ih}" fill="transparent" ${attrs({ 'data-tip': `${l}\n` + ser.map((s) => `${s.name}: ${s.values[i] == null ? '—' : S.fmt.num(s.values[i])}`).join('\n'), 'data-nav': o.nav && o.nav(i) })}/>`).join('');
    const zero = min < 0 ? `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(0)}" y2="${y(0)}" class="base"/>` : '';
    return `<svg class="chart" dir="ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}">${grid}${zero}${th}${paths}${xl}${hits}</svg>${ser.length > 1 ? C.legend(ser) : ''}`;
  };

  /** Donut — folds beyond 6 slices into "Other". data: [{label, value, nav, drill}] */
  C.donut = (data, o = {}) => {
    data = data.filter((d) => d.value > 0);
    if (!data.length) return `<p class="muted">${esc(S.t('chart.noData', 'No data for this chart'))}</p>`;
    if (data.length > 7) { const rest = data.slice(6); data = data.slice(0, 6).concat([{ label: S.t('common.other', 'Other'), value: U.sum(rest, (d) => d.value) }]); }
    const tot = U.sum(data, (d) => d.value);
    const R = 80, r = 52, cx = 100, cy = 100;
    let a0 = -Math.PI / 2;
    const segs = data.map((d, i) => {
      const a1 = a0 + (d.value / tot) * Math.PI * 2 - 0.012;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, rr) => `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
      const path = `M${p(a0, R)}A${R},${R} 0 ${large} 1 ${p(a1, R)}L${p(a1, r)}A${r},${r} 0 ${large} 0 ${p(a0, r)}Z`;
      a0 = a1 + 0.012;
      const fill = d.tone ? `var(--st-${d.tone})` : series(i);
      return `<path class="mk" d="${path}" fill="${fill}" ${attrs({ 'data-tip': `${d.label}: ${S.fmt.num(d.value)} (${S.fmt.pct((d.value / tot) * 100)})`, 'data-nav': d.nav, 'data-drill': d.drill })}/>`;
    }).join('');
    const legend = `<ul class="legend v">${data.map((d, i) => `<li><i style="background:${d.tone ? `var(--st-${d.tone})` : series(i)}"></i>${esc(d.label)} <b>${esc(S.fmt.pct((d.value / tot) * 100))}</b></li>`).join('')}</ul>`;
    return `<div class="donut"><svg class="chart" dir="ltr" viewBox="0 0 200 200" role="img" aria-label="${esc(o.title || '')}">${segs}<text x="100" y="98" text-anchor="middle" class="d-tot">${esc(o.center || short(tot))}</text><text x="100" y="116" text-anchor="middle" class="ax">${esc(o.centerLabel || '')}</text></svg>${legend}</div>`;
  };

  C.legend = (ser) => `<ul class="legend">${ser.map((s, i) => `<li><i style="background:${s.tone ? `var(--st-${s.tone})` : series(s.slot != null ? s.slot : i)}"></i>${esc(s.name)}</li>`).join('')}</ul>`;

  /** Meter for 0-100 scores */
  C.meter = (v, o = {}) => {
    if (v == null) return `<span class="na">${esc(S.t('common.dataUnavailable', 'Data unavailable'))}</span>`;
    const tn = o.tone || (v >= 75 ? 'critical' : v >= 55 ? 'serious' : v >= 30 ? 'warning' : 'good');
    return `<span class="meter" title="${esc(v)}"><span style="width:${U.clamp(v, 0, 100)}%;background:var(--st-${tn})"></span></span>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
