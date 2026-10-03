/* Driver-based forecast and scenarios.
 * Projects income statement, balance sheet and cash flow from the latest actual year. The balance sheet
 * balances by construction: lines the model does not drive (other current assets, intangibles, accruals,
 * share capital...) are held flat, and cash is the balancing item. If cash would fall below zero, the
 * shortfall is borrowed short term and reported as funding required.
 */
(function (CFO) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const div = (a, b) => (a == null || b == null || b === 0) ? null : a / b;
  const or = (v, d) => (v == null || !isFinite(v) ? d : v);

  // name: [min, max, step, unit] for the controls; unit '%' values are fractions, 'days' and 'money' are plain.
  const DRIVERS = {
    growth: [-0.5, 0.6, 0.01, '%'], grossMargin: [0, 0.9, 0.005, '%'], opexPct: [0, 0.8, 0.005, '%'], dnaPct: [0, 0.2, 0.0025, '%'],
    dso: [0, 240, 1, 'days'], dio: [0, 240, 1, 'days'], dpo: [0, 240, 1, 'days'], capexPct: [0, 0.4, 0.0025, '%'],
    rate: [0, 0.4, 0.0025, '%'], taxRate: [0, 0.5, 0.0025, '%'], payout: [0, 1.5, 0.05, '%'], newDebt: [null, null, null, 'money'],
  };

  /** Offsets applied to the base drivers for the preset scenarios. */
  const SCENARIOS = {
    base: {},
    upside: { growth: +0.05, grossMargin: +0.02, opexPct: -0.01, dso: -5, dio: -5 },
    downside: { growth: -0.08, grossMargin: -0.03, opexPct: +0.01, dso: +10, dio: +10 },
  };

  /** Starting drivers from the company's own history. */
  function defaultDrivers(ds) {
    const P = ds.periods, last = ds.data[P[P.length - 1]] || {}, prev = P.length > 1 ? ds.data[P[P.length - 2]] : null;
    // Year-on-year growth only between years that both report revenue.
    const growths = P.slice(1).map((p, i) => { const a = ds.data[P[i]].revenue, b = ds.data[p].revenue; return a == null || b == null || a === 0 ? null : (b - a) / Math.abs(a); })
      .filter(v => v != null && isFinite(v));
    const days = (a, b) => { const r = div(a, b); return r == null ? null : r * 365; };
    const debt = d => d ? (d.short_debt || 0) + (d.long_debt || 0) : 0;
    const avgDebt = prev ? (debt(prev) + debt(last)) / 2 : debt(last);
    const rev = last.revenue, cogs = last.cogs ?? (rev != null && last.gross_profit != null ? rev - last.gross_profit : null);
    return {
      growth: clamp(growths.length ? growths.reduce((a, b) => a + b, 0) / growths.length : 0.05, -0.3, 0.5),
      grossMargin: clamp(or(cogs == null ? null : div(rev - cogs, rev), 0.3), 0, 0.9),
      opexPct: clamp(or(div(last.opex, rev), 0), 0, 0.8),
      dnaPct: clamp(or(div(last.dna, rev), 0), 0, 0.2),
      dso: Math.round(clamp(or(days(last.receivables, rev), 45), 0, 240)),
      dio: Math.round(clamp(or(days(last.inventory, cogs), 0), 0, 240)),
      dpo: Math.round(clamp(or(days(last.payables, cogs), 0), 0, 240)),
      capexPct: clamp(or(div(last.capex, rev), or(div(last.dna, rev), 0)), 0, 0.4),
      rate: clamp(or(div(last.interest, avgDebt), 0.1), 0, 0.4),
      taxRate: clamp(last.pretax_income > 0 ? or(div(last.tax, last.pretax_income), 0.225) : 0.225, 0, 0.5),
      // Paying out more than profit is not a sustainable starting assumption, so the default is capped at 100%.
      payout: clamp(last.net_income > 0 ? or(div(last.dividends, last.net_income), 0) : 0, 0, 1),
      newDebt: 0,
    };
  }

  /** What the model needs from the latest year; returns the missing item keys. */
  function missingInputs(ds) {
    const last = ds.data[ds.periods[ds.periods.length - 1]] || {};
    return ['revenue', 'total_assets', 'equity'].filter(k => last[k] == null)
      .concat(last.cogs == null && last.gross_profit == null ? ['cogs'] : []);
  }

  // "2024" -> "2025F"; a non-year label ("Current year") -> "+1F".
  const nextLabel = (p, k) => /^\d{4}$/.test(String(p).trim()) ? `${+p + k}F` : `+${k}F`;

  /** Project `years` years. Returns [{ period, data, fundingNeed }]. */
  function project(ds, drivers, years = 3) {
    const P = ds.periods, base = P[P.length - 1], d0 = { ...ds.data[base] };
    const g = n => or(d0[n], 0);
    const cogs0 = d0.cogs ?? (d0.revenue - g('gross_profit'));
    // Lines held flat (whatever the statements show beyond the modelled items).
    const otherCA = or(d0.current_assets, g('cash') + g('receivables') + g('inventory')) - g('cash') - g('receivables') - g('inventory');
    const otherNCA = g('total_assets') - or(d0.current_assets, g('cash') + g('receivables') + g('inventory')) - g('ppe');
    const cl0 = or(d0.current_liabilities, g('payables') + g('short_debt'));
    const otherCL = cl0 - g('payables') - g('short_debt');
    const tl0 = or(d0.total_liabilities, g('total_assets') - g('equity'));
    const otherNCL = tl0 - cl0 - g('long_debt');
    const re0 = d0.retained_earnings ?? g('equity');
    const otherEq = g('equity') - re0;

    let prev = { revenue: d0.revenue, cogs: cogs0, cash: g('cash'), receivables: g('receivables'), inventory: g('inventory'), payables: g('payables'),
      ppe: g('ppe'), short_debt: g('short_debt'), long_debt: g('long_debt'), retained_earnings: re0 };
    const out = [];
    for (let k = 1; k <= years; k++) {
      const dr = drivers;
      const revenue = prev.revenue * (1 + dr.growth);
      const cogs = revenue * (1 - dr.grossMargin), gross_profit = revenue - cogs;
      const capex = revenue * dr.capexPct;
      // Depreciation cannot exceed the asset base it wears down, which keeps PP&E >= 0 and the balance sheet balanced.
      const opex = revenue * dr.opexPct, dna = Math.min(revenue * dr.dnaPct, prev.ppe + capex);
      const operating_income = gross_profit - opex - dna;
      const long_debt = Math.max(0, prev.long_debt + (k === 1 ? dr.newDebt : 0));
      const debtOpen = prev.short_debt + prev.long_debt;
      const interest = dr.rate * (debtOpen + prev.short_debt + long_debt) / 2;
      const pretax_income = operating_income - interest;
      const tax = Math.max(0, pretax_income * dr.taxRate);
      const net_income = pretax_income - tax;
      const dividends = Math.max(0, net_income * dr.payout);
      const receivables = revenue * dr.dso / 365, inventory = cogs * dr.dio / 365, payables = cogs * dr.dpo / 365;
      const ppe = prev.ppe + capex - dna;
      const cfo = net_income + dna - (receivables - prev.receivables) - (inventory - prev.inventory) + (payables - prev.payables);
      const debtFlow = long_debt - prev.long_debt;
      let cash = prev.cash + cfo - capex + debtFlow - dividends;
      // Cash is the balancing item; a shortfall is funded with short-term borrowing.
      let short_debt = prev.short_debt, fundingNeed = 0;
      if (cash < 0) { fundingNeed = -cash; short_debt += fundingNeed; cash = 0; }
      const retained_earnings = prev.retained_earnings + net_income - dividends;
      const current_assets = cash + receivables + inventory + otherCA;
      const total_assets = current_assets + ppe + otherNCA;
      const current_liabilities = payables + short_debt + otherCL;
      const total_liabilities = current_liabilities + long_debt + otherNCL;
      const equity = otherEq + retained_earnings;
      const data = { revenue, cogs, gross_profit, opex, dna, operating_income, interest, pretax_income, tax, net_income,
        cash, receivables, inventory, current_assets, ppe, total_assets, payables, short_debt, current_liabilities, long_debt,
        total_liabilities, retained_earnings, equity, cfo, capex, cfi: -capex, cff: debtFlow + fundingNeed - dividends, dividends };
      out.push({ period: nextLabel(base, k), data, fundingNeed });
      prev = { revenue, cogs, cash, receivables, inventory, payables, ppe, short_debt, long_debt, retained_earnings };
    }
    return out;
  }

  /** Actual years + projected years as one dataset, so the normal analysis and red flags apply. */
  function withProjection(ds, proj) {
    const periods = [...ds.periods, ...proj.map(y => y.period)];
    const data = { ...ds.data }, derived = { ...ds.derived };
    proj.forEach(y => { data[y.period] = y.data; derived[y.period] = new Set(); });
    return { ...ds, periods, data, derived, lines: [], issues: [] };
  }

  /** Drivers for each preset scenario, built on the (possibly edited) base drivers. */
  function scenarioDrivers(base) {
    return Object.fromEntries(Object.entries(SCENARIOS).map(([name, off]) => {
      const d = { ...base };
      for (const [k, v] of Object.entries(off)) {
        const [lo, hi] = DRIVERS[k];
        d[k] = DRIVERS[k][3] === 'days' ? Math.round(clamp(d[k] + v, lo, hi)) : clamp(d[k] + v, lo, hi);
      }
      return [name, d];
    }));
  }

  /** Run every scenario: { name: { drivers, years, A, F } } */
  function runScenarios(ds, base, years = 3) {
    const out = {};
    for (const [name, drivers] of Object.entries(scenarioDrivers(base))) {
      const yearsOut = project(ds, drivers, years);
      const A = CFO.analyze(withProjection(ds, yearsOut));
      out[name] = { drivers, years: yearsOut, A, F: CFO.flags ? CFO.flags(A) : [] };
    }
    return out;
  }

  CFO.FORECAST_DRIVERS = DRIVERS;
  CFO.FORECAST_SCENARIOS = SCENARIOS;
  CFO.defaultDrivers = defaultDrivers;
  /** A driver value kept inside its allowed range (typed values are not limited by the input itself). */
  CFO.clampDriver = (k, v) => { const [lo, hi] = DRIVERS[k]; return lo == null ? v : clamp(v, lo, hi); };
  CFO.forecastMissing = missingInputs;
  CFO.project = project;
  CFO.withProjection = withProjection;
  CFO.runScenarios = runScenarios;
})(globalThis.CFO = globalThis.CFO || {});
