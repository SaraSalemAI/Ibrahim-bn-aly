/* Peer comparison and valuation by other methods.
 * Peers come from the user: key figures typed into a table, or their statements dropped as files (read by the same
 * parsers, kept apart from the company). Nothing is fetched from the internet. For each key ratio the company is
 * compared with the peer median and quartiles and ranked. Trading multiples (from the peers, or typed in), a dividend
 * discount model and book value join the DCF in a "football field" with a weighted value range.
 */
(function (CFO) {
  const nn = v => v != null && isFinite(v);
  const div = (a, b) => (nn(a) && nn(b) && b !== 0 ? a / b : null);

  // Figures a peer can have (typed or read from statements).
  const FIELDS = ['revenue', 'revenue_prev', 'ebitda', 'net_income', 'total_assets', 'equity', 'total_debt', 'cash', 'market_cap'];

  /* Ratios compared: dir 'high' = higher is better. All on closing balances so typed peers compare like for like. */
  const METRICS = [
    { id: 'revenue_growth', unit: '%', dir: 'high', f: x => nn(x.revenue) && nn(x.revenue_prev) && x.revenue_prev !== 0 ? (x.revenue - x.revenue_prev) / Math.abs(x.revenue_prev) : null },
    { id: 'ebitda_margin', unit: '%', dir: 'high', f: x => div(x.ebitda, x.revenue) },
    { id: 'net_margin', unit: '%', dir: 'high', f: x => div(x.net_income, x.revenue) },
    { id: 'roe', unit: '%', dir: 'high', f: x => x.equity > 0 ? div(x.net_income, x.equity) : null },
    { id: 'roa', unit: '%', dir: 'high', f: x => div(x.net_income, x.total_assets) },
    { id: 'asset_turnover', unit: 'x', dir: 'high', f: x => div(x.revenue, x.total_assets) },
    { id: 'debt_to_equity', unit: 'x', dir: 'low', f: x => x.equity > 0 ? div(x.total_debt, x.equity) : null },
    { id: 'net_debt_to_ebitda', unit: 'x', dir: 'low', f: x => x.ebitda > 0 && nn(x.total_debt) ? (x.total_debt - (x.cash || 0)) / x.ebitda : null },
    { id: 'equity_ratio', unit: '%', dir: 'high', f: x => div(x.equity, x.total_assets) },
    { id: 'ev_ebitda', unit: 'x', dir: null, f: x => x.ebitda > 0 && nn(x.market_cap) ? ev(x) / x.ebitda : null },
    { id: 'ev_revenue', unit: 'x', dir: null, f: x => x.revenue > 0 && nn(x.market_cap) ? ev(x) / x.revenue : null },
    { id: 'pe', unit: 'x', dir: null, f: x => x.net_income > 0 && nn(x.market_cap) ? x.market_cap / x.net_income : null },
    { id: 'pb', unit: 'x', dir: null, f: x => x.equity > 0 && nn(x.market_cap) ? x.market_cap / x.equity : null },
  ];
  const ev = x => x.market_cap + (x.total_debt || 0) - (x.cash || 0);

  /** Linear-interpolated quantile of sorted numbers. */
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  const stats = values => {
    const s = values.filter(nn).sort((a, b) => a - b);
    return { n: s.length, min: s[0] ?? null, q1: quantile(s, 0.25), median: quantile(s, 0.5), q3: quantile(s, 0.75), max: s[s.length - 1] ?? null };
  };

  /** The company's figures in peer form, from the latest year. */
  function companyFigures(ds) {
    const P = ds.periods, d = ds.data[P[P.length - 1]] || {}, e = CFO.enrich(d), prev = P.length > 1 ? ds.data[P[P.length - 2]] : null;
    return { revenue: d.revenue ?? null, revenue_prev: prev?.revenue ?? null, ebitda: e.ebitda, net_income: d.net_income ?? null,
      total_assets: d.total_assets ?? null, equity: d.equity ?? null, total_debt: e.total_debt, cash: d.cash ?? null, market_cap: null };
  }
  /** A peer read from statement files: the same reader as the company, latest year only. */
  function peerFromTables(name, tables) {
    const ds = CFO.buildDataset(tables);
    if (!ds.periods.length) return null;
    return { name, source: 'file', period: ds.periods[ds.periods.length - 1], ...companyFigures(ds) };
  }

  /** Company vs peers for every metric: values, median, quartiles, rank (1 = best), gap to median. */
  function compare(company, peers) {
    return METRICS.map(m => {
      const pv = peers.map(p => m.f(p)), c = m.f(company), st = stats(pv);
      let rank = null, quartile = null;
      if (nn(c) && m.dir && st.n) {
        const better = pv.filter(v => nn(v) && (m.dir === 'high' ? v > c : v < c)).length;
        rank = better + 1;
        const pos = m.dir === 'high' ? c : -c, q1 = m.dir === 'high' ? st.q1 : -st.q3, q3 = m.dir === 'high' ? st.q3 : -st.q1;
        quartile = pos >= q3 ? 'top' : pos < q1 ? 'bottom' : 'mid';
      }
      return { ...m, company: c, peers: pv, ...st, rank, of: st.n + 1, quartile, gap: nn(c) && nn(st.median) ? c - st.median : null };
    }).filter(r => nn(r.company) || r.n);
  }

  /** Multiples to apply: typed values win, else the peer quartiles. { id: { low, mid, high, source } } */
  function multiples(rows, typed = {}) {
    const out = {};
    for (const id of ['ev_ebitda', 'ev_revenue', 'pe']) {
      if (nn(typed[id]) && typed[id] > 0) out[id] = { low: typed[id] * 0.9, mid: typed[id], high: typed[id] * 1.1, source: 'typed' };
      else { const r = rows.find(x => x.id === id); if (r && r.n) out[id] = { low: r.q1, mid: r.median, high: r.q3, source: 'peers', n: r.n }; }
    }
    return out;
  }

  /** Equity value under every method, low–mid–high, and the weighted range. */
  function methods({ ds, V, rows, typed, weights }) {
    const c = companyFigures(ds), netDebt = (c.total_debt || 0) - (c.cash || 0), out = [];
    if (V && nn(V.equity) && V.sens) {
      const inner = V.sens.grid.slice(1, 4).flatMap(r => r.slice(1, 4)).filter(nn);
      out.push({ id: 'dcf', group: 'dcf', low: Math.min(...inner), mid: V.equity, high: Math.max(...inner) });
    }
    const mult = multiples(rows, typed);
    const base = { ev_ebitda: c.ebitda, ev_revenue: c.revenue, pe: c.net_income };
    for (const [id, m] of Object.entries(mult)) {
      if (!(base[id] > 0)) continue;
      const val = k => id === 'pe' ? m[k] * base[id] : m[k] * base[id] - netDebt;
      out.push({ id, group: 'multiples', low: val('low'), mid: val('mid'), high: val('high'), multiple: m });
    }
    // Dividend discount (Gordon): next year's dividend ÷ (cost of equity − growth).
    const d = ds.data[ds.periods[ds.periods.length - 1]] || {};
    if (V && d.dividends > 0 && nn(V.ke)) {
      const g = V.inputs.g, at = gg => V.ke - gg > 0.005 ? d.dividends * (1 + gg) / (V.ke - gg) : null;
      const mid = at(g);
      if (nn(mid)) out.push({ id: 'ddm', group: 'dcf', low: at(g - 0.005) ?? mid, mid, high: at(g + 0.005) ?? mid });
    }
    if (nn(c.equity)) out.push({ id: 'book', group: 'book', low: c.equity, mid: c.equity, high: c.equity });
    // Weighted range: each group's weight shared equally among its methods, renormalised over what is available.
    const w = { dcf: 0.5, multiples: 0.4, book: 0.1, ...(weights || {}) };
    const groups = [...new Set(out.map(x => x.group))], tot = groups.reduce((t, g) => t + (w[g] || 0), 0);
    let weighted = null;
    if (tot > 0) {
      weighted = { low: 0, mid: 0, high: 0 };
      for (const x of out) {
        const share = (w[x.group] || 0) / tot / out.filter(y => y.group === x.group).length;
        x.weight = share;
        for (const k of ['low', 'mid', 'high']) weighted[k] += share * x[k];
      }
    }
    return { list: out, weighted, weights: w, netDebt };
  }

  /* ---------- charts (inline SVG) ---------- */
  function footballSVG(list, weighted, labelOf, fmt) {
    const rows = [...list, ...(weighted ? [{ id: 'weighted', ...weighted }] : [])];
    if (!rows.length) return '';
    const W = 560, rowH = 30, left = 150, right = 20, top = 10, H = top + rows.length * rowH + 26;
    const lo0 = Math.min(0, ...rows.map(r => r.low)), hi0 = Math.max(0, ...rows.map(r => r.high)), padv = (hi0 - lo0) * 0.06 || 1;
    const lo = lo0 < 0 ? lo0 - padv : 0, hi = hi0 + padv;
    const X = v => left + (v - lo) / (hi - lo) * (W - left - right);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => lo + (hi - lo) * f);
    const esc = CFO.esc;
    return `<div class="football"><svg class="svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Football field" style="direction:ltr">
      ${ticks.map(t => `<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${top}" y2="${H - 22}" stroke="var(--line)" stroke-width="0.6"/><text x="${X(t).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(fmt(t))}</text>`).join('')}
      ${rows.map((r, i) => { const y = top + i * rowH, wid = Math.max(2, X(r.high) - X(r.low)), col = r.id === 'weighted' ? 'var(--s3)' : 'var(--s1)';
        return `<text x="${left - 8}" y="${y + 19}" text-anchor="end" font-size="11" fill="var(--ink)"${r.id === 'weighted' ? ' font-weight="700"' : ''}>${esc(labelOf(r.id))}</text>
        <rect x="${X(r.low).toFixed(1)}" y="${y + 7}" width="${wid.toFixed(1)}" height="16" rx="3" fill="${col}" opacity="0.85"><title>${esc(labelOf(r.id))}: ${esc(fmt(r.low))} – ${esc(fmt(r.high))}</title></rect>
        <line x1="${X(r.mid).toFixed(1)}" x2="${X(r.mid).toFixed(1)}" y1="${y + 4}" y2="${y + 26}" stroke="var(--ink)" stroke-width="2"/>`; }).join('')}
    </svg></div>`;
  }

  function scatterSVG(points, xl, yl, fmtX, fmtY) {
    const pts = points.filter(p => nn(p.x) && nn(p.y));
    if (pts.length < 2) return '';
    const W = 560, H = 260, l = 56, r = 16, t = 14, b = 34, esc = CFO.esc;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const pad = (a, z) => { const d = (z - a) || Math.abs(a) || 1; return [a - d * 0.1, z + d * 0.1]; };
    const [x0, x1] = pad(Math.min(...xs), Math.max(...xs)), [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
    const X = v => l + (v - x0) / (x1 - x0) * (W - l - r), Y = v => H - b - (v - y0) / (y1 - y0) * (H - t - b);
    return `<svg class="svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(xl)} / ${esc(yl)}" style="direction:ltr">
      <line x1="${l}" x2="${W - r}" y1="${H - b}" y2="${H - b}" stroke="var(--line)"/><line x1="${l}" x2="${l}" y1="${t}" y2="${H - b}" stroke="var(--line)"/>
      <text x="${(l + W - r) / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(xl)}</text>
      <text x="12" y="${(t + H - b) / 2}" transform="rotate(-90 12 ${(t + H - b) / 2})" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(yl)}</text>
      <text x="${l}" y="${H - b + 14}" font-size="10" fill="var(--muted)">${esc(fmtX(x0))}</text><text x="${W - r}" y="${H - b + 14}" text-anchor="end" font-size="10" fill="var(--muted)">${esc(fmtX(x1))}</text>
      <text x="${l - 4}" y="${H - b}" text-anchor="end" font-size="10" fill="var(--muted)">${esc(fmtY(y0))}</text><text x="${l - 4}" y="${t + 8}" text-anchor="end" font-size="10" fill="var(--muted)">${esc(fmtY(y1))}</text>
      ${pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.self ? 7 : 5}" fill="${p.self ? 'var(--s3)' : 'var(--s1)'}" stroke="var(--surface)" stroke-width="2"><title>${esc(p.name)}: ${esc(fmtX(p.x))}, ${esc(fmtY(p.y))}</title></circle>
        <text x="${(X(p.x) + 9).toFixed(1)}" y="${(Y(p.y) + 4).toFixed(1)}" font-size="10.5" fill="var(--ink)"${p.self ? ' font-weight="700"' : ''}>${esc(p.name)}</text>`).join('')}
    </svg>`;
  }

  /* ---------- text ---------- */
  const UIP = {
    en: {
      title: 'Peer comparison', hint: 'Add the companies you compete with: type their key figures (from their published accounts or a market data service) or drop their statements. Figures stay in this browser. Without peers, the sector typical values are used.',
      add: 'Add peer', addFiles: 'Add peer statements', remove: 'Remove', clear: 'Remove all peers', name: 'Company', you: 'This company',
      f: { revenue: 'Revenue', revenue_prev: 'Revenue, prior year', ebitda: 'EBITDA', net_income: 'Net income', total_assets: 'Total assets', equity: 'Equity', total_debt: 'Total debt', cash: 'Cash', market_cap: 'Market value of equity' },
      m: { ev_ebitda: 'EV / EBITDA', ev_revenue: 'EV / revenue', pe: 'Price / earnings', pb: 'Price / book', equity_ratio: 'Equity ratio' },
      median: 'Peer median', q1: 'Lower quartile', q3: 'Upper quartile', rank: 'Rank', gap: 'vs median', sector: 'Sector typical',
      quart: { top: 'Top quartile', mid: 'Middle', bottom: 'Bottom quartile' },
      none: 'No peers yet. Add at least one to compare; two or more give quartiles.',
      scatter: 'Growth vs margin', fileRead: (n, p) => `Added peer ${n} (${p}).`, fileFail: n => `${n}: no statements could be read for this peer.`,
      methods: 'Valuation by method', methodsHint: 'Equity value under each method. Bars run from low to high; the line is the central value. Multiples use the peer quartiles, or the values you type.',
      method: { dcf: 'DCF (WACC ± 0.5 pt, g ± 0.5 pt)', ev_ebitda: 'EV / EBITDA multiple', ev_revenue: 'EV / revenue multiple', pe: 'P / E multiple', ddm: 'Dividend discount model', book: 'Book value of equity', weighted: 'Weighted value' },
      short: { dcf: 'DCF', ev_ebitda: 'EV / EBITDA', ev_revenue: 'EV / revenue', pe: 'P / E', ddm: 'Dividend discount', book: 'Book value', weighted: 'Weighted' },
      typed: 'Multiples (optional, overrides peers)', weights: 'Weights', w: { dcf: 'DCF & dividends', multiples: 'Multiples', book: 'Book value' },
      low: 'Low', mid: 'Central', high: 'High', weight: 'Weight', source: 'Source', src: { typed: 'typed', peers: n => `${n} peers` },
      noMethods: 'Not enough data for any method yet.', bottomTitle: n => `Below most peers: ${n}`, bottomAction: 'Study what the top-quartile peers do differently (pricing, cost base, asset use, funding) and set a target to reach at least the peer median.',
    },
    ar: {
      title: 'المقارنة بالمنافسين', hint: 'أضف الشركات المنافسة: اكتب أرقامها الرئيسية (من قوائمها المنشورة أو مزود بيانات سوق) أو أسقط قوائمها. تبقى الأرقام في هذا المتصفح. دون منافسين تُستخدم القيم النموذجية للقطاع.',
      add: 'إضافة منافس', addFiles: 'إضافة قوائم منافس', remove: 'حذف', clear: 'حذف كل المنافسين', name: 'الشركة', you: 'هذه الشركة',
      f: { revenue: 'الإيرادات', revenue_prev: 'إيرادات السنة السابقة', ebitda: 'EBITDA', net_income: 'صافي الربح', total_assets: 'إجمالي الأصول', equity: 'حقوق الملكية', total_debt: 'إجمالي الديون', cash: 'النقدية', market_cap: 'القيمة السوقية لحقوق الملكية' },
      m: { ev_ebitda: 'قيمة المنشأة / EBITDA', ev_revenue: 'قيمة المنشأة / الإيرادات', pe: 'السعر / الربحية', pb: 'السعر / القيمة الدفترية', equity_ratio: 'نسبة حقوق الملكية' },
      median: 'وسيط المنافسين', q1: 'الربيع الأدنى', q3: 'الربيع الأعلى', rank: 'الترتيب', gap: 'الفرق عن الوسيط', sector: 'القيمة النموذجية للقطاع',
      quart: { top: 'الربع الأعلى', mid: 'الوسط', bottom: 'الربع الأدنى' },
      none: 'لا يوجد منافسون بعد. أضف منافساً واحداً على الأقل؛ اثنان أو أكثر يعطيان الأرباع.',
      scatter: 'النمو مقابل الهامش', fileRead: (n, p) => `أُضيف المنافس ${n} (${p}).`, fileFail: n => `${n}: تعذرت قراءة قوائم هذا المنافس.`,
      methods: 'التقييم حسب الطريقة', methodsHint: 'قيمة حقوق الملكية بكل طريقة. الأعمدة من الأدنى إلى الأعلى؛ الخط هو القيمة الوسطى. المضاعفات من أرباع المنافسين أو القيم التي تكتبها.',
      method: { dcf: 'التدفقات المخصومة (WACC ± 0.5، g ± 0.5)', ev_ebitda: 'مضاعف قيمة المنشأة / EBITDA', ev_revenue: 'مضاعف قيمة المنشأة / الإيرادات', pe: 'مضاعف الربحية', ddm: 'نموذج خصم التوزيعات', book: 'القيمة الدفترية لحقوق الملكية', weighted: 'القيمة المرجحة' },
      short: { dcf: 'التدفقات المخصومة', ev_ebitda: 'EV / EBITDA', ev_revenue: 'EV / الإيرادات', pe: 'مضاعف الربحية', ddm: 'خصم التوزيعات', book: 'القيمة الدفترية', weighted: 'المرجحة' },
      typed: 'المضاعفات (اختياري، تتقدم على المنافسين)', weights: 'الأوزان', w: { dcf: 'التدفقات والتوزيعات', multiples: 'المضاعفات', book: 'القيمة الدفترية' },
      low: 'أدنى', mid: 'وسطى', high: 'أعلى', weight: 'الوزن', source: 'المصدر', src: { typed: 'مُدخل', peers: n => `${n} منافسين` },
      noMethods: 'لا توجد بيانات كافية لأي طريقة بعد.', bottomTitle: n => `أقل من معظم المنافسين: ${n}`, bottomAction: 'ادرس ما يفعله منافسو الربع الأعلى بشكل مختلف (التسعير، هيكل التكاليف، استخدام الأصول، التمويل) وحدد هدفاً للوصول إلى وسيط المنافسين على الأقل.',
    },
  };
  const metricName = (id, lang) => UIP[lang].m[id] || CFO.ratioName(id, lang);

  /** Display-ready peer comparison and valuation by method. R: { A, V, peers, mult, weights, lang } */
  function peerModel(R) {
    const { A, lang } = R, L = UIP[lang], ds = A.ds, peers = (R.peers || []).filter(p => p && p.name);
    const company = companyFigures(ds), rows = compare(company, peers);
    const fmt = (unit, v) => CFO.fmtVal(unit, v, lang), money = v => CFO.fmtNum(v, 0, lang);
    const m = { peers, hasPeers: peers.length > 0 };
    if (peers.length) {
      m.figures = { head: [L.name, ...FIELDS.map(k => L.f[k])], text: 1,
        rows: [[L.you, ...FIELDS.map(k => money(company[k]))], ...peers.map(p => [p.name, ...FIELDS.map(k => money(p[k]))])] };
      m.compare = { head: ['', L.you, L.median, L.q1, L.q3, L.sector, L.rank, ''], text: 1, rows: rows.map(r => {
        const sec = CFO.RATIO[r.id] ? CFO.bench(r.id).typical : null;
        return [metricName(r.id, lang), fmt(r.unit, r.company), fmt(r.unit, r.median), fmt(r.unit, r.q1), fmt(r.unit, r.q3), fmt(r.unit, sec),
          r.rank ? `${r.rank} / ${r.of}` : '—', r.quartile ? L.quart[r.quartile] : '']; }), items: rows };
      m.detail = { head: ['', L.you, ...peers.map(p => p.name)], text: 1, rows: rows.map(r => [metricName(r.id, lang), fmt(r.unit, r.company), ...r.peers.map(v => fmt(r.unit, v))]) };
      const pick = ['net_margin', 'roe', 'debt_to_equity', 'ebitda_margin'];
      m.charts = pick.map(id => rows.find(r => r.id === id)).filter(r => r && [r.company, ...r.peers].filter(nn).length >= 2).map(r => ({
        title: metricName(r.id, lang), kind: 'bar', labels: [L.you, ...peers.map(p => p.name)], fmt: v => fmt(r.unit, v),
        series: [{ name: metricName(r.id, lang), values: [r.company, ...r.peers], color: 'var(--s1)' }] }));
      const g = rows.find(r => r.id === 'revenue_growth'), nm = rows.find(r => r.id === 'net_margin');
      if (g && nm) m.scatter = scatterSVG([{ name: L.you, x: g.company, y: nm.company, self: true }, ...peers.map((p, i) => ({ name: p.name, x: g.peers[i], y: nm.peers[i] }))],
        metricName('revenue_growth', lang), metricName('net_margin', lang), v => CFO.fmtPct(v, lang), v => CFO.fmtPct(v, lang));
      m.bottom = rows.filter(r => r.quartile === 'bottom' && r.n >= 2);
    }
    const V = R.V !== undefined ? R.V : null;
    const mt = methods({ ds, V: V && !V.missing && !V.error ? V : null, rows, typed: R.mult, weights: R.weights });
    m.methods = mt;
    if (mt.list.length) {
      const label = id => L.method[id];
      m.methodTable = { head: [L.methods, L.low, L.mid, L.high, L.weight, L.source], text: 1,
        rows: [...mt.list.map(x => [label(x.id), money(x.low), money(x.mid), money(x.high), CFO.fmtPct(x.weight, lang),
          x.multiple ? `${CFO.fmtVal('x', x.multiple.mid, lang)} · ${x.multiple.source === 'typed' ? L.src.typed : L.src.peers(x.multiple.n)}` : '']),
          ...(mt.weighted ? [[label('weighted'), money(mt.weighted.low), money(mt.weighted.mid), money(mt.weighted.high), CFO.fmtPct(1, lang), '']] : [])],
        sub: [...mt.list.map(() => false), true] };
      m.football = footballSVG(mt.list, mt.weighted, id => L.short[id], money);
    }
    return m;
  }

  for (const lang of ['en', 'ar']) if (CFO.UI?.[lang]) CFO.UI[lang].peer = UIP[lang];
  CFO.PEER_FIELDS = FIELDS;
  CFO.PEER_METRICS = METRICS;
  CFO.quantile = quantile;
  CFO.companyFigures = companyFigures;
  CFO.peerFromTables = peerFromTables;
  CFO.comparePeers = compare;
  CFO.peerMultiples = multiples;
  CFO.valuationMethods = methods;
  CFO.peerModel = peerModel;
})(globalThis.CFO = globalThis.CFO || {});
