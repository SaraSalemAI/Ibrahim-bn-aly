/* Financial analysis: ratios, DuPont, Altman Z'', vertical (common-size), horizontal (trend).
 * Pure functions over a dataset from CFO.buildDataset().
 * Thresholds are general rules of thumb, not industry benchmarks; edit them here.
 */
(function (CFO) {
  const div = (a, b) => (a == null || b == null || b === 0) ? null : a / b;
  const nz = v => v == null ? null : v;

  /** Values derived from the statements that several ratios share. */
  function enrich(d) {
    const e = { ...d };
    e.total_debt = (d.short_debt != null || d.long_debt != null) ? (d.short_debt || 0) + (d.long_debt || 0) : null;
    e.ebit = d.operating_income;
    e.ebitda = d.operating_income != null && d.dna != null ? d.operating_income + d.dna : null;
    e.working_capital = d.current_assets != null && d.current_liabilities != null ? d.current_assets - d.current_liabilities : null;
    e.fcf = d.cfo != null && d.capex != null ? d.cfo - d.capex : null;
    e.net_debt = e.total_debt != null && d.cash != null ? e.total_debt - d.cash : null;
    e.capital_employed = d.total_assets != null && d.current_liabilities != null ? d.total_assets - d.current_liabilities : null;
    return e;
  }

  /* dir: 'high' = higher is better, 'low' = lower is better, null = informational.
   * good/bad: status boundaries. avg(k) uses the average of opening and closing balance when the prior year exists. */
  const RATIOS = [
    // Liquidity
    { id: 'current_ratio', group: 'liquidity', unit: 'x', dir: 'high', good: 1.5, bad: 1.0, needs: ['current_assets', 'current_liabilities'],
      f: 'Current assets ÷ Current liabilities', calc: d => div(d.current_assets, d.current_liabilities) },
    { id: 'quick_ratio', group: 'liquidity', unit: 'x', dir: 'high', good: 1.0, bad: 0.7, needs: ['current_assets', 'inventory', 'current_liabilities'],
      f: '(Current assets − Inventory) ÷ Current liabilities', calc: d => d.inventory == null ? null : div(d.current_assets - d.inventory, d.current_liabilities) },
    { id: 'cash_ratio', group: 'liquidity', unit: 'x', dir: 'high', good: 0.5, bad: 0.2, needs: ['cash', 'current_liabilities'],
      f: 'Cash ÷ Current liabilities', calc: d => div(d.cash, d.current_liabilities) },
    { id: 'ocf_ratio', group: 'liquidity', unit: 'x', dir: 'high', good: 0.4, bad: 0.2, needs: ['cfo', 'current_liabilities'],
      f: 'Cash from operations ÷ Current liabilities', calc: d => div(d.cfo, d.current_liabilities) },
    { id: 'working_capital', group: 'liquidity', unit: 'money', dir: 'high', good: 0, bad: 0, needs: ['current_assets', 'current_liabilities'],
      f: 'Current assets − Current liabilities', calc: d => d.working_capital },

    // Profitability
    { id: 'gross_margin', group: 'profitability', unit: '%', dir: 'high', good: 0.35, bad: 0.15, needs: ['gross_profit', 'revenue'],
      f: 'Gross profit ÷ Revenue', calc: d => div(d.gross_profit, d.revenue) },
    { id: 'ebitda_margin', group: 'profitability', unit: '%', dir: 'high', good: 0.15, bad: 0.05, needs: ['operating_income', 'dna', 'revenue'],
      f: '(EBIT + D&A) ÷ Revenue', calc: d => div(d.ebitda, d.revenue) },
    { id: 'operating_margin', group: 'profitability', unit: '%', dir: 'high', good: 0.10, bad: 0.03, needs: ['operating_income', 'revenue'],
      f: 'Operating income ÷ Revenue', calc: d => div(d.operating_income, d.revenue) },
    { id: 'net_margin', group: 'profitability', unit: '%', dir: 'high', good: 0.08, bad: 0.02, needs: ['net_income', 'revenue'],
      f: 'Net income ÷ Revenue', calc: d => div(d.net_income, d.revenue) },
    { id: 'roa', group: 'profitability', unit: '%', dir: 'high', good: 0.06, bad: 0.02, needs: ['net_income', 'total_assets'],
      f: 'Net income ÷ Average total assets', calc: (d, avg) => div(d.net_income, avg('total_assets')) },
    { id: 'roe', group: 'profitability', unit: '%', dir: 'high', good: 0.15, bad: 0.05, needs: ['net_income', 'equity'],
      f: 'Net income ÷ Average equity', calc: (d, avg) => { const e = avg('equity'); return e != null && e <= 0 ? null : div(d.net_income, e); } },
    { id: 'roce', group: 'profitability', unit: '%', dir: 'high', good: 0.12, bad: 0.05, needs: ['operating_income', 'total_assets', 'current_liabilities'],
      f: 'EBIT ÷ (Total assets − Current liabilities)', calc: d => div(d.ebit, d.capital_employed) },
    { id: 'tax_rate', group: 'profitability', unit: '%', dir: null, needs: ['tax', 'pretax_income'],
      f: 'Income tax ÷ Profit before tax', calc: d => d.pretax_income > 0 ? div(d.tax, d.pretax_income) : null },

    // Efficiency
    { id: 'asset_turnover', group: 'efficiency', unit: 'x', dir: 'high', good: 1.0, bad: 0.5, needs: ['revenue', 'total_assets'],
      f: 'Revenue ÷ Average total assets', calc: (d, avg) => div(d.revenue, avg('total_assets')) },
    { id: 'fixed_asset_turnover', group: 'efficiency', unit: 'x', dir: 'high', good: 3, bad: 1, needs: ['revenue', 'ppe'],
      f: 'Revenue ÷ Average PP&E', calc: (d, avg) => div(d.revenue, avg('ppe')) },
    { id: 'dso', group: 'efficiency', unit: 'days', dir: 'low', good: 45, bad: 90, needs: ['receivables', 'revenue'],
      f: 'Average receivables ÷ Revenue × 365', calc: (d, avg) => { const r = div(avg('receivables'), d.revenue); return r == null ? null : r * 365; } },
    { id: 'dio', group: 'efficiency', unit: 'days', dir: 'low', good: 60, bad: 120, needs: ['inventory', 'cogs'],
      f: 'Average inventory ÷ Cost of sales × 365', calc: (d, avg) => { const r = div(avg('inventory'), d.cogs); return r == null ? null : r * 365; } },
    { id: 'dpo', group: 'efficiency', unit: 'days', dir: null, needs: ['payables', 'cogs'],
      f: 'Average payables ÷ Cost of sales × 365', calc: (d, avg) => { const r = div(avg('payables'), d.cogs); return r == null ? null : r * 365; } },
    { id: 'ccc', group: 'efficiency', unit: 'days', dir: 'low', good: 60, bad: 120, needs: ['receivables', 'inventory', 'payables', 'revenue', 'cogs'],
      f: 'DSO + DIO − DPO', calc: (d, avg, r) => (r.dso == null || r.dio == null || r.dpo == null) ? null : r.dso + r.dio - r.dpo },

    // Leverage & solvency
    { id: 'debt_to_equity', group: 'leverage', unit: 'x', dir: 'low', good: 1.0, bad: 2.0, needs: ['short_debt', 'long_debt', 'equity'],
      f: '(Short-term + Long-term debt) ÷ Equity', calc: d => d.equity != null && d.equity <= 0 ? null : div(d.total_debt, d.equity) },
    { id: 'debt_ratio', group: 'leverage', unit: '%', dir: 'low', good: 0.5, bad: 0.7, needs: ['total_liabilities', 'total_assets'],
      f: 'Total liabilities ÷ Total assets', calc: d => div(d.total_liabilities, d.total_assets) },
    { id: 'equity_multiplier', group: 'leverage', unit: 'x', dir: 'low', good: 2, bad: 3, needs: ['total_assets', 'equity'],
      f: 'Total assets ÷ Equity', calc: d => d.equity != null && d.equity <= 0 ? null : div(d.total_assets, d.equity) },
    { id: 'interest_coverage', group: 'leverage', unit: 'x', dir: 'high', good: 3, bad: 1.5, needs: ['operating_income', 'interest'],
      f: 'EBIT ÷ Interest expense', calc: d => div(d.ebit, d.interest) },
    { id: 'net_debt_to_ebitda', group: 'leverage', unit: 'x', dir: 'low', good: 2, bad: 4, needs: ['short_debt', 'long_debt', 'cash', 'operating_income', 'dna'],
      f: '(Debt − Cash) ÷ EBITDA', calc: d => d.ebitda != null && d.ebitda <= 0 ? null : div(d.net_debt, d.ebitda) },

    // Cash flow
    { id: 'fcf', group: 'cashflow', unit: 'money', dir: 'high', good: 0, bad: 0, needs: ['cfo', 'capex'],
      f: 'Cash from operations − Capital expenditure', calc: d => d.fcf },
    { id: 'fcf_margin', group: 'cashflow', unit: '%', dir: 'high', good: 0.05, bad: 0, needs: ['cfo', 'capex', 'revenue'],
      f: 'Free cash flow ÷ Revenue', calc: d => div(d.fcf, d.revenue) },
    { id: 'cash_conversion', group: 'cashflow', unit: 'x', dir: 'high', good: 1.0, bad: 0.8, needs: ['cfo', 'net_income'],
      f: 'Cash from operations ÷ Net income', calc: d => d.net_income > 0 ? div(d.cfo, d.net_income) : null },
    { id: 'capex_to_dna', group: 'cashflow', unit: 'x', dir: null, needs: ['capex', 'dna'],
      f: 'Capital expenditure ÷ D&A', calc: d => div(d.capex, d.dna) },
    { id: 'payout_ratio', group: 'cashflow', unit: '%', dir: 'low', good: 0.6, bad: 1.0, needs: ['dividends', 'net_income'],
      f: 'Dividends paid ÷ Net income', calc: d => d.net_income > 0 ? div(d.dividends, d.net_income) : null },

    // Distress
    { id: 'altman_z', group: 'distress', unit: 'score', dir: 'high', good: 2.6, bad: 1.1,
      needs: ['current_assets', 'current_liabilities', 'retained_earnings', 'operating_income', 'total_assets', 'equity', 'total_liabilities'],
      f: "Z'' = 6.56·WC/TA + 3.26·RE/TA + 6.72·EBIT/TA + 1.05·Equity/TL",
      calc: d => {
        const ta = d.total_assets;
        if (!ta || d.working_capital == null || d.retained_earnings == null || d.ebit == null || d.equity == null || !d.total_liabilities) return null;
        return 6.56 * d.working_capital / ta + 3.26 * d.retained_earnings / ta + 6.72 * d.ebit / ta + 1.05 * d.equity / d.total_liabilities;
      } },
  ];
  const GROUPS = ['liquidity', 'profitability', 'efficiency', 'leverage', 'cashflow', 'distress'];

  /** Healthy / watch / weak against the selected sector's limits (js/benchmarks.js), else the defaults above. */
  function status(def, v) {
    if (v == null || !def.dir) return null;
    const { good, bad } = CFO.bench ? CFO.bench(def.id) : def;
    if (def.dir === 'high') return v >= good ? 'good' : v < bad ? 'bad' : (good === bad ? 'bad' : 'warn');
    return v <= good ? 'good' : v > bad ? 'bad' : 'warn';
  }

  /** Ratios for every period: { [id]: { [period]: { value, status, avgUsed } } } */
  function computeRatios(ds) {
    const out = Object.fromEntries(RATIOS.map(r => [r.id, {}]));
    ds.periods.forEach((p, i) => {
      const d = enrich(ds.data[p]);
      const prev = i > 0 ? ds.data[ds.periods[i - 1]] : null;
      let avgUsed = false;
      const avg = k => {
        if (prev && prev[k] != null && d[k] != null) { avgUsed = true; return (prev[k] + d[k]) / 2; }
        return nz(d[k]);
      };
      const r = {};
      for (const def of RATIOS) {
        avgUsed = false;
        let v = def.calc(d, avg, r);
        if (v != null && !isFinite(v)) v = null;
        r[def.id] = v;
        out[def.id][p] = { value: v, status: status(def, v), avgUsed };
      }
    });
    return out;
  }

  /** ROE = Net margin × Asset turnover × Equity multiplier (all on closing balances so the product reconciles). */
  function dupont(ds) {
    return ds.periods.map(p => {
      const d = ds.data[p];
      const nm = div(d.net_income, d.revenue), at = div(d.revenue, d.total_assets), em = d.equity > 0 ? div(d.total_assets, d.equity) : null;
      return { period: p, net_margin: nm, asset_turnover: at, equity_multiplier: em, roe: nm != null && at != null && em != null ? nm * at * em : null };
    });
  }

  /** Rows for vertical & horizontal analysis: standard items plus unmapped lines, grouped by statement. */
  function analysisRows(ds) {
    const rows = [];
    for (const st of ['IS', 'BS', 'CF']) {
      for (const it of CFO.ITEMS.filter(i => i.st === st)) {
        const values = {};
        ds.periods.forEach(p => { if (ds.data[p][it.key] != null) values[p] = ds.data[p][it.key]; });
        if (Object.keys(values).length) rows.push({ st, key: it.key, label: null, values, derived: ds.periods.filter(p => ds.derived[p].has(it.key)) });
      }
      for (const l of ds.lines.filter(l => !l.key && l.statement === st)) rows.push({ st, key: null, label: l.label, values: l.values, derived: [] });
    }
    return rows;
  }

  const BASE = { IS: 'revenue', CF: 'revenue', BS: 'total_assets' };

  /** Common-size: each line as a share of revenue (IS, CF) or total assets (BS). */
  function vertical(ds) {
    return analysisRows(ds).map(r => {
      const pct = {};
      ds.periods.forEach(p => { const base = ds.data[p][BASE[r.st]]; pct[p] = r.values[p] == null ? null : div(r.values[p], base); });
      return { ...r, pct };
    });
  }

  /** Trend: year-over-year change, index vs first available year (=100), CAGR. */
  function horizontal(ds) {
    return analysisRows(ds).map(r => {
      const ps = ds.periods.filter(p => r.values[p] != null);
      const yoy = {}, idx = {};
      ds.periods.forEach((p, i) => {
        const prevP = ds.periods[i - 1];
        const cur = r.values[p], prev = prevP != null ? r.values[prevP] : null;
        yoy[p] = cur == null || prev == null ? null : { abs: cur - prev, pct: prev === 0 ? null : (cur - prev) / Math.abs(prev) };
        const base = ps.length ? r.values[ps[0]] : null;
        idx[p] = cur == null || !base || base < 0 || cur < 0 ? null : cur / base * 100;
      });
      let cagr = null;
      if (ps.length >= 2) {
        const a = r.values[ps[0]], b = r.values[ps[ps.length - 1]];
        const n = parseInt(ps[ps.length - 1], 10) - parseInt(ps[0], 10) || ps.length - 1;
        if (a > 0 && b > 0) cagr = Math.pow(b / a, 1 / n) - 1;
      }
      return { ...r, yoy, idx, cagr };
    });
  }

  /** 0-100 health score from the latest year's ratio statuses, weighted by group. */
  function healthScore(ratios, period) {
    const W = { liquidity: 1, profitability: 1.2, efficiency: 0.6, leverage: 1.2, cashflow: 1, distress: 1 };
    const P = { good: 100, warn: 55, bad: 10 };
    let sum = 0, w = 0;
    const byGroup = {};
    for (const def of RATIOS) {
      const s = ratios[def.id][period]?.status;
      if (!s) continue;
      sum += P[s] * W[def.group]; w += W[def.group];
      (byGroup[def.group] = byGroup[def.group] || []).push(P[s]);
    }
    const groups = Object.fromEntries(Object.entries(byGroup).map(([g, a]) => [g, a.reduce((x, y) => x + y, 0) / a.length]));
    const score = w ? Math.round(sum / w) : null;
    const grade = score == null ? null : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'E';
    return { score, grade, groups };
  }

  function analyze(ds) {
    const ratios = computeRatios(ds);
    const latest = ds.periods[ds.periods.length - 1];
    return { ds, latest, ratios, dupont: dupont(ds), vertical: vertical(ds), horizontal: horizontal(ds), health: latest ? healthScore(ratios, latest) : null };
  }

  CFO.RATIOS = RATIOS;
  CFO.RATIO = Object.fromEntries(RATIOS.map(r => [r.id, r]));
  CFO.GROUPS = GROUPS;
  CFO.enrich = enrich;
  CFO.analyze = analyze;
})(globalThis.CFO = globalThis.CFO || {});
