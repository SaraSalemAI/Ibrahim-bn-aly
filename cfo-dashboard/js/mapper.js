/* Merge parsed tables into one dataset.
 * dataset = {
 *   periods: ['2022','2023','2024'],            // ascending
 *   data:    { [period]: { [itemKey]: number } },
 *   derived: { [period]: Set(itemKey) },          // values computed, not read from a file
 *   lines:   [{ id, source, label, values, auto, key, statement, used }],
 *   issues:  [{ type, ... }]                      // conflicts, balance-sheet checks, missing data
 * }
 */
(function (CFO) {
  // Calendar years sort numerically; relative headers ("Prior year" < "Current year") sort after them in time order.
  const RELATIVE = { 'Prior year': 99998, 'Current year': 99999 };
  const periodRank = p => RELATIVE[p] ?? parseInt(p, 10);
  const periodSort = (a, b) => {
    const ya = periodRank(a), yb = periodRank(b);
    return (isNaN(ya) || isNaN(yb) || ya === yb) ? String(a).localeCompare(String(b)) : ya - yb;
  };

  /** tables: output of parseFile for every file; overrides: { lineId: itemKey | '' } */
  function buildDataset(tables, overrides = {}) {
    const lines = [];
    tables.forEach((t, ti) => t.lines.forEach((l, li) => {
      const id = `${ti}:${li}:${CFO.normalize(l.label).slice(0, 40)}`;
      const auto = CFO.matchLabel(l.label);
      const key = Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] || null : auto;
      lines.push({ id, table: ti, source: t.source, label: l.label, values: l.values, auto, key, used: false });
    }));

    // Statement of each table = the statement most of its mapped lines belong to.
    const tableSt = tables.map((_, ti) => {
      const count = {};
      lines.filter(l => l.table === ti && l.key).forEach(l => { const st = CFO.ITEM[l.key].st; count[st] = (count[st] || 0) + 1; });
      return Object.keys(count).sort((a, b) => count[b] - count[a])[0] || null;
    });
    lines.forEach(l => { l.statement = l.key ? CFO.ITEM[l.key].st : tableSt[l.table]; });

    const periods = [...new Set(lines.flatMap(l => Object.keys(l.values)))].sort(periodSort);
    const data = Object.fromEntries(periods.map(p => [p, {}]));
    const origin = Object.fromEntries(periods.map(p => [p, {}]));
    const issues = [];

    // Items a statement often splits over several lines ("Selling and distribution" + "General and administrative";
    // "Short-term loans" + "Overdraft" + "Current portion of long-term loans"). Within one table their lines are
    // added up, unless the table already shows a total line for the item, which is then used on its own.
    // D&A, capex and dividends are left out: they appear in two statements on the same sheet, not split in parts.
    const SUMMED = new Set(['opex', 'short_debt', 'long_debt']);
    const isTotal = l => /^(total|sum)\b|^(اجمالي|مجموع|جمله)(\s|$)/.test(CFO.normalize(l.label));
    const merged = [];
    const groups = new Map();
    for (const l of lines) {
      if (!l.key) continue;
      const g = `${l.table}|${l.key}`;
      groups.has(g) ? groups.get(g).push(l) : groups.set(g, [l]);
    }
    for (const ls of groups.values()) {
      const key = ls[0].key, totals = ls.filter(isTotal);
      if (!SUMMED.has(key) || ls.length === 1) { merged.push(...ls); continue; }
      if (totals.length) { ls.forEach(l => { if (l !== totals[0]) { l.component = true; l.used = true; } }); merged.push(totals[0]); continue; }
      // The same figures repeated (an item shown in two statements on one sheet) are one line, not two parts.
      const same = (x, y) => Object.keys(x.values).length === Object.keys(y.values).length && Object.entries(x.values).every(([p, v]) => Math.abs(Math.abs(v) - Math.abs(y.values[p] ?? NaN)) < 1e-9);
      const parts = ls.filter((l, i) => !ls.slice(0, i).some(o => same(o, l)));
      if (parts.length === 1) { merged.push(...ls); continue; }
      // Add the components up, sign by sign as shown (expenses are made positive afterwards).
      const values = {};
      for (const l of parts) for (const [p, v] of Object.entries(l.values)) values[p] = (values[p] || 0) + (CFO.ITEM[key].expense ? Math.abs(v) : v);
      ls.forEach(l => { l.component = true; l.used = true; });
      merged.push({ ...ls[0], label: parts.map(l => l.label).join(' + '), values, sumOf: ls });
    }
    merged.sort((x, y) => lines.indexOf(x.sumOf ? x.sumOf[0] : x) - lines.indexOf(y.sumOf ? y.sumOf[0] : y));

    for (const l of merged) {
      const item = CFO.ITEM[l.key];
      for (const [p, raw] of Object.entries(l.values)) {
        const v = item.expense ? Math.abs(raw) : raw;
        const prev = data[p][l.key];
        if (prev == null) { data[p][l.key] = v; origin[p][l.key] = l; l.used = true; (l.sumOf || []).forEach(c => { c.used = true; }); }
        else if (Math.abs(prev - v) > Math.max(1, Math.abs(prev) * 0.005)) {
          issues.push({ type: 'conflict', key: l.key, period: p, kept: prev, ignored: v, keptFrom: origin[p][l.key].source, ignoredFrom: l.source, label: l.label });
        } else l.used = true;
      }
    }

    // Fill gaps from accounting identities (repeat so chains resolve, e.g. TL -> equity).
    const derived = Object.fromEntries(periods.map(p => [p, new Set()]));
    for (const p of periods) {
      for (let pass = 0; pass < 3; pass++) {
        for (const [k, f] of Object.entries(CFO.DERIVED)) {
          if (data[p][k] != null) continue;
          const v = f(data[p]);
          if (v != null && isFinite(v)) { data[p][k] = v; derived[p].add(k); }
        }
      }
    }

    // Checks a reviewer should see before trusting the analysis.
    for (const p of periods) {
      const d = data[p];
      if (d.total_assets != null && d.total_liabilities != null && d.equity != null && !derived[p].has('total_liabilities') && !derived[p].has('equity') && !derived[p].has('total_assets')) {
        const gap = d.total_assets - d.total_liabilities - d.equity;
        if (Math.abs(gap) > Math.max(1, Math.abs(d.total_assets) * 0.005)) issues.push({ type: 'unbalanced', period: p, gap });
      }
      if (d.revenue != null && d.cogs != null && d.gross_profit != null && !derived[p].has('gross_profit') && !derived[p].has('cogs')) {
        const gap = d.revenue - d.cogs - d.gross_profit;
        if (Math.abs(gap) > Math.max(1, Math.abs(d.revenue) * 0.005)) issues.push({ type: 'gp_mismatch', period: p, gap });
      }
    }
    for (const k of ['revenue', 'net_income', 'total_assets', 'equity', 'current_assets', 'current_liabilities', 'cfo']) {
      if (periods.length && periods.every(p => data[p][k] == null)) issues.push({ type: 'missing', key: k });
    }
    // Columns without a real year (P1, Prior year...) can be named in Data review.
    const unnamed = periods.filter(p => !/^(19|20)\d{2}/.test(p));
    if (unnamed.length) issues.push({ type: 'noYears', periods: unnamed });
    const unmapped = lines.filter(l => !l.key).length;
    if (unmapped) issues.push({ type: 'unmapped', count: unmapped });

    return { periods, data, derived, lines, issues, sources: [...new Set(tables.map(t => t.source))] };
  }

  CFO.buildDataset = buildDataset;
  CFO.periodSort = periodSort;
})(globalThis.CFO = globalThis.CFO || {});
