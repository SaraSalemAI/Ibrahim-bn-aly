/* Valuation and action plan.
 * DCF: free cash flow to the firm (FCFF) from the driver forecast in js/forecast.js, discounted at WACC (CAPM cost of
 * equity + after-tax cost of debt). The terminal value uses the value-driver formula NOPAT × (1 − g ÷ RONIC) ÷ (WACC − g):
 * the reinvestment needed to grow at g forever, at a return on new investment (RONIC) equal to the higher of the
 * latest ROIC and WACC, rather than carrying the last forecast year's capex and working-capital build-up into perpetuity. Revenue growth fades in a straight line from
 * the forecast growth rate to the terminal rate. Also: EVA by year, a WACC × growth sensitivity grid, value under the
 * three scenarios, value levers ranked by their effect on equity value, and a prioritised action plan.
 * Market inputs (risk-free rate, equity risk premium, beta) depend on the country and currency: the defaults are
 * placeholders to replace, and the page says so.
 */
(function (CFO) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const or0 = v => (v == null || !isFinite(v) ? 0 : v);

  // name: [min, max, step, unit]; '%' values are fractions.
  const INPUTS = {
    rf: [0, 0.3, 0.0025, '%'], erp: [0, 0.2, 0.0025, '%'], beta: [0, 3, 0.05, 'x'], kd: [0, 0.4, 0.0025, '%'],
    tax: [0, 0.5, 0.0025, '%'], wd: [0, 0.9, 0.01, '%'], g: [-0.03, 0.08, 0.0025, '%'], years: [3, 10, 1, 'n'],
    shares: [0, null, 1, 'n'], price: [0, null, 0.01, 'n'],
  };
  const MIN_SPREAD = 0.005;   // WACC must exceed terminal growth by at least half a point

  /** Default inputs: market placeholders + the company's own interest rate, tax rate and book debt weight. */
  function dcfDefaults(ds, drivers) {
    const d = ds.data[ds.periods[ds.periods.length - 1]] || {}, e = CFO.enrich(d);
    const debt = e.total_debt || 0;
    const wd = d.equity > 0 ? clamp(debt / (debt + d.equity), 0, 0.8) : debt > 0 ? 0.6 : 0;
    return { rf: 0.045, erp: 0.055, beta: 1, kd: drivers?.rate ?? 0.08, tax: drivers?.taxRate ?? 0.225, wd: Math.round(wd * 100) / 100,
      g: 0.025, years: 5, shares: null, price: null };
  }
  const clampInput = (k, v) => { const [lo, hi] = INPUTS[k]; return clamp(v, lo ?? -Infinity, hi ?? Infinity); };

  function wacc(inp) {
    const ke = inp.rf + inp.beta * inp.erp, kdAt = inp.kd * (1 - inp.tax);
    return { ke, kdAt, wacc: inp.wd * kdAt + (1 - inp.wd) * ke };
  }

  /** Terminal value at the end of the forecast: next year's NOPAT less the reinvestment growth at g needs. */
  const terminal = (nopatN, w, g, ronic) => nopatN * (1 + g) * (1 - g / ronic) / (w - g);

  /** Equity value from forecast cash flows at a given WACC and terminal growth (null when WACC − g is under half a point). */
  function equityAt(fcff, nopatN, ronic, netDebt, w, g) {
    if (!(w - g >= MIN_SPREAD - 1e-12)) return null;
    let pv = 0;
    fcff.forEach((f, i) => { pv += f / Math.pow(1 + w, i + 1); });
    return pv + terminal(nopatN, w, g, ronic) / Math.pow(1 + w, fcff.length) - netDebt;
  }

  /** Full DCF. Returns { missing } when the forecast cannot run. */
  function valuation(ds, driversIn, inputs) {
    if (!ds.periods.length) return { missing: ['revenue'] };
    const missing = CFO.forecastMissing(ds);
    if (missing.length) return { missing };
    const drivers = driversIn || CFO.defaultDrivers(ds);
    const inp = { ...dcfDefaults(ds, drivers), ...(inputs || {}) };
    const n = Math.round(clamp(inp.years, 3, 10));
    const { ke, kdAt, wacc: w } = wacc(inp);
    const path = Array.from({ length: n }, (_, k) => drivers.growth + (inp.g - drivers.growth) * k / (n - 1));
    const proj = CFO.project(ds, { ...drivers, growthPath: path }, n);

    const p0 = ds.periods[ds.periods.length - 1], d0 = ds.data[p0], e0 = CFO.enrich(d0);
    const nwc = d => or0(d.receivables) + or0(d.inventory) - or0(d.payables);
    let prevNwc = nwc(d0);
    const rows = proj.map((y, i) => {
      const d = y.data, ebit = d.operating_income, nopat = ebit * (1 - inp.tax), w_ = nwc(d), dNwc = w_ - prevNwc;
      prevNwc = w_;
      const fcff = nopat + d.dna - d.capex - dNwc, df = 1 / Math.pow(1 + w, i + 1);
      return { period: y.period, revenue: d.revenue, growth: path[i], ebit, nopat, dna: d.dna, capex: d.capex, dNwc, fcff, df, pv: fcff * df };
    });
    const netDebt = or0(e0.total_debt) - or0(d0.cash);
    const fcff = rows.map(r => r.fcff);
    const out = { inputs: inp, drivers, ke, kdAt, wacc: w, rows, netDebt, base: p0, warnings: [] };
    // EVA by historical year: NOPAT − WACC × invested capital (opening capital when the prior year exists).
    out.eva = ds.periods.map((p, i) => {
      const e = CFO.enrich(ds.data[p]), pe = i ? CFO.enrich(ds.data[ds.periods[i - 1]]) : null;
      const ic = pe?.invested_capital > 0 ? pe.invested_capital : e.invested_capital;
      if (e.nopat == null || !(ic > 0)) return { period: p, nopat: e.nopat, ic: ic ?? null, roic: null, eva: null };
      return { period: p, nopat: e.nopat, ic, roic: e.nopat / ic, eva: e.nopat - w * ic };
    });
    if (w - inp.g < MIN_SPREAD || w <= 0) { out.error = 'waccLeG'; return out; }
    const last = rows[n - 1];
    const roic0 = e0.invested_capital > 0 && e0.nopat != null ? e0.nopat / e0.invested_capital : null;
    // RONIC: at least WACC, and always above g so the reinvestment rate g ÷ RONIC stays below 1.
    const ronicAt = ww => Math.max(ww, roic0 ?? 0, inp.g + MIN_SPREAD);
    out.ronic = ronicAt(w);
    out.sumPv = rows.reduce((t, r) => t + r.pv, 0);
    out.tv = terminal(last.nopat, w, inp.g, out.ronic);
    out.pvTv = out.tv * last.df;
    out.ev = out.sumPv + out.pvTv;
    out.equity = out.ev - netDebt;
    if (!isFinite(out.ev) || !isFinite(out.equity)) { out.error = 'waccLeG'; out.ev = out.equity = undefined; return out; }
    out.tvShare = out.ev > 0 ? out.pvTv / out.ev : null;
    out.perShare = inp.shares > 0 ? out.equity / inp.shares : null;
    out.upside = out.perShare != null && inp.price > 0 ? out.perShare / inp.price - 1 : null;
    out.evEbitda = e0.ebitda > 0 ? out.ev / e0.ebitda : null;
    out.pe = d0.net_income > 0 ? out.equity / d0.net_income : null;
    out.evRevenue = d0.revenue > 0 ? out.ev / d0.revenue : null;
    if (out.tvShare != null && out.tvShare > 0.75) out.warnings.push('tvHigh');
    if (out.ev <= 0) out.warnings.push('negative');
    else if (out.equity <= 0) out.warnings.push('debtExceeds');
    if (!(d0.operating_income > 0)) out.warnings.push('loss');
    if (inp.wd > 0.6) out.warnings.push('highDebtWeight');

    // Sensitivity: the same forecast cash flows at other discount rates and terminal growth rates.
    const steps = [-0.01, -0.005, 0, 0.005, 0.01];
    const waccs = steps.map(s => w + s), gs = steps.map(s => inp.g + s);
    out.sens = { waccs, gs, grid: waccs.map(ww => gs.map(gg => equityAt(fcff, last.nopat, Math.max(ww, roic0 ?? 0, gg + MIN_SPREAD), netDebt, ww, gg))) };

    return out;
  }

  /** Equity value under the base, upside and downside scenarios (same offsets as the Forecast tab). */
  function scenarioValues(ds, drivers, inputs) {
    const sd = CFO.scenarioDrivers(drivers || CFO.defaultDrivers(ds));
    return Object.fromEntries(Object.entries(sd).map(([k, d]) => {
      const v = valuation(ds, d, inputs);
      return [k, v.equity ?? null];
    }));
  }

  /* Value levers: one operational change at a time, re-valued. */
  const LEVERS = [
    { id: 'growth', k: 'growth', by: 0.02 }, { id: 'grossMargin', k: 'grossMargin', by: 0.01 }, { id: 'opex', k: 'opexPct', by: -0.01 },
    { id: 'dso', k: 'dso', by: -10 }, { id: 'dio', k: 'dio', by: -10 }, { id: 'capex', k: 'capexPct', by: -0.01 },
  ];
  function valueLevers(ds, V) {
    if (!V || V.equity == null) return [];
    return LEVERS.map(l => {
      const from = V.drivers[l.k], to = CFO.clampDriver(l.k, from + l.by);
      if (Math.abs(to - from) < 1e-9) return null;
      const v = valuation(ds, { ...V.drivers, [l.k]: to }, V.inputs);
      if (v.equity == null) return null;
      return { id: l.id, key: l.k, from, to, impact: v.equity - V.equity, pct: V.equity > 0 ? (v.equity - V.equity) / V.equity : null };
    }).filter(x => x && x.impact > 0).sort((a, b) => b.impact - a.impact);
  }

  /* ---------- prioritised action plan ---------- */
  // flag id -> [owner area, ratio to track]
  const FLAG_KPI = {
    liquidity: ['treasury', 'current_ratio'], interest: ['treasury', 'interest_coverage'], leverage: ['treasury', 'net_debt_to_ebitda'],
    neg_equity: ['board', 'equity_ratio'], loss: ['management', 'net_margin'], earnings_quality: ['finance', 'cash_conversion'],
    receivables: ['sales', 'dso'], inventory: ['operations', 'dio'], margins: ['procurement', 'gross_margin'],
    sector_margins: ['management', 'operating_margin'], revenue: ['sales', 'revenue_growth'], fcf_div: ['board', 'payout_ratio'],
    payout: ['board', 'payout_ratio'], altman: ['board', 'altman_z'], cash_burn: ['treasury', 'fcf_margin'],
    debt_growth: ['treasury', 'debt_to_ebitda'], opex: ['operations', 'operating_margin'],
  };
  const GROUP_AREA = { liquidity: 'treasury', profitability: 'management', efficiency: 'operations', leverage: 'treasury', cashflow: 'finance', growth: 'sales', quality: 'finance', distress: 'board' };
  const SEV_ORDER = { high: 0, med: 1, low: 2 };

  function actionPlan(A, F, V, lang, opts = {}) {
    const L = CFO.UI[lang].val, p = A.latest, items = [], tracked = new Set();
    const fmt = (id, v) => CFO.fmtVal(CFO.RATIO[id].unit, v, lang);
    const target = id => { const b = CFO.bench(id), def = CFO.RATIO[id]; return def.dir && b.good != null ? `${def.dir === 'high' ? '≥' : '≤'} ${fmt(id, b.good)}` : '—'; };
    const kpiFor = id => id && CFO.RATIO[id] ? { kpi: CFO.ratioName(id, lang), current: fmt(id, A.ratios[id][p]?.value), target: target(id) } : { kpi: '—', current: '—', target: '—' };
    F.forEach(f => {
      const [area, id] = FLAG_KPI[f.id] || ['finance', null];
      if (id) tracked.add(id);
      items.push({ sev: f.sev, area, title: f.title[lang], action: f.rec[lang], ...kpiFor(id) });
    });
    // Valuation: returns below the cost of capital destroy value even when profit is positive.
    const roic = A.ratios.roic?.[p]?.value;
    if (V && V.wacc != null && roic != null && roic < V.wacc) {
      tracked.add('roic');
      items.push({ sev: roic < V.wacc - 0.03 ? 'high' : 'med', area: 'management', title: L.roicTitle, action: L.roicAction,
        kpi: CFO.ratioName('roic', lang), current: fmt('roic', roic), target: `≥ ${CFO.fmtPct(V.wacc, lang)} (WACC)` });
    }
    // Statements that do not tie together: the figures above may rest on a misread line.
    const off = CFO.reconcile ? CFO.reconcile(A.ds).filter(c => !c.ok) : [];
    if (off.length) items.push({ sev: 'high', area: 'finance', title: L.reconTitle, action: L.reconAction(off.map(c => `${CFO.UI[lang].cf.check[c.id]} (${c.period}: ${CFO.fmtNum(c.diff, 0, lang)})`).join(lang === 'ar' ? '؛ ' : '; ')),
      kpi: '—', current: String(off.length), target: '0' });
    // A thin margin of safety leaves little room before the business stops covering its fixed costs.
    const be = CFO.breakEven ? CFO.breakEven(A.ds, opts.be || {}) : null;
    if (be && be.mos != null && be.mos < 0.15) items.push({ sev: be.mos < 0.05 ? 'high' : 'med', area: 'management', title: L.mosTitle, action: L.mosAction,
      kpi: CFO.UI[lang].cf.mos, current: CFO.fmtPct(be.mos, lang), target: `≥ ${CFO.fmtPct(0.15, lang)}` });
    // Bottom quartile against the user's own peers (two or more).
    if (opts.peers?.length >= 2 && CFO.comparePeers) {
      const PL = CFO.UI[lang].peer;
      CFO.comparePeers(CFO.companyFigures(A.ds), opts.peers).filter(r => r.quartile === 'bottom' && r.n >= 2 && !tracked.has(r.id)).slice(0, 3).forEach(r => {
        tracked.add(r.id);
        const name = PL.m[r.id] || CFO.ratioName(r.id, lang);
        items.push({ sev: 'med', area: GROUP_AREA[CFO.RATIO[r.id]?.group] || 'management', title: PL.bottomTitle(name), action: PL.bottomAction,
          kpi: name, current: CFO.fmtVal(r.unit, r.company, lang), target: `${r.dir === 'high' ? '≥' : '≤'} ${CFO.fmtVal(r.unit, r.median, lang)}` });
      });
    }
    // Ratios rated weak or on watch that no red flag covers yet.
    for (const [status, sev, cap] of [['bad', 'med', 4], ['warn', 'low', 4]]) {
      const seen = new Set();   // one per group: their actions would repeat
      CFO.RATIOS.filter(def => !tracked.has(def.id) && A.ratios[def.id][p]?.status === status && !seen.has(def.group) && seen.add(def.group)).slice(0, cap).forEach(def => {
        tracked.add(def.id);
        items.push({ sev, area: GROUP_AREA[def.group], title: L.improve(CFO.ratioName(def.id, lang)), action: L.groupAction[def.group], ...kpiFor(def.id) });
      });
    }
    return items.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev])
      .map((it, i) => ({ ...it, n: i + 1, horizon: L.horizon[it.sev], areaText: L.area[it.area], sevText: CFO.UI[lang].sev[it.sev] }));
  }

  /* ---------- text ---------- */
  const UIV = {
    en: {
      title: 'Valuation (DCF)', hint: 'Discounted cash flow from the base forecast. Market inputs depend on the country and currency of the statements: the defaults are placeholders, replace them with your own.',
      inputs: 'Inputs', reset: 'Reset inputs',
      in: { rf: 'Risk-free rate', erp: 'Equity risk premium', beta: 'Beta', kd: 'Cost of debt (pre-tax)', tax: 'Tax rate', wd: 'Debt weight D/(D+E)', g: 'Terminal growth', years: 'Forecast years', shares: 'Shares outstanding (optional)', price: 'Share price (optional)' },
      ke: 'Cost of equity (CAPM)', kdAt: 'Cost of debt after tax', wacc: 'WACC',
      fcffTitle: 'Free cash flow to the firm', growth: 'Revenue growth', ebit: 'EBIT', nopat: 'NOPAT = EBIT × (1 − tax)', dna: '+ Depreciation & amortisation', capex: '− Capital expenditure',
      dNwc: '− Increase in working capital', fcff: 'FCFF', df: 'Discount factor', pv: 'Present value',
      ronic: 'Return on new investment (terminal)', bridge: 'From enterprise value to equity value', sumPv: 'PV of forecast cash flows', pvTv: 'PV of terminal value', ev: 'Enterprise value', netDebt: '− Net debt (debt − cash)',
      equity: 'Equity value', perShare: 'Value per share', upside: 'Upside / downside vs price', tvShare: 'Terminal value share of EV',
      multiples: 'Implied multiples (latest year)', evEbitda: 'EV / EBITDA', pe: 'Equity value / net income', evRevenue: 'EV / revenue',
      sens: 'Sensitivity: equity value', sensHint: 'Rows: WACC; columns: terminal growth. Same forecast cash flows.',
      scen: 'Equity value by scenario', evaTitle: 'Economic value added (EVA)', evaHint: 'EVA = NOPAT − WACC × invested capital (debt + equity, opening balance). Positive means returns above the cost of capital.',
      ic: 'Invested capital', roic: 'ROIC', eva: 'EVA', spread: 'ROIC − WACC',
      levers: 'Value levers', leversHint: 'Each change is applied on its own to the base forecast and the company re-valued. Largest effect on equity value first.',
      lever: { growth: 'Revenue growth +2 pts', grossMargin: 'Gross margin +1 pt', opex: 'Operating expenses −1 pt of revenue', dso: 'Collect 10 days faster (DSO −10)', dio: 'Hold 10 days less stock (DIO −10)', capex: 'Capex −1 pt of revenue' },
      impact: 'Added equity value', change: 'Change',
      planTitle: 'Action plan', planHint: 'Every recommendation, ordered by urgency. These are proposals for management: nothing is sent, paid or posted.',
      when: 'When', owner: 'Owner', priority: 'Priority', recommendation: 'Recommendation', kpi: 'KPI', current: 'Now', target: 'Target',
      horizon: { high: '0–3 months', med: '3–6 months', low: '6–12 months' },
      area: { treasury: 'Treasury', sales: 'Sales & credit', procurement: 'Procurement', operations: 'Operations', finance: 'Finance', management: 'Management', board: 'Board' },
      reconTitle: 'Statements do not tie together', reconAction: list => `Find the misread or mis-mapped line before using these figures: ${list}. Check Data review and the original statements.`,
      mosTitle: 'Thin margin of safety', mosAction: 'Lower the break-even point: raise the contribution margin (pricing, mix, variable costs) or cut fixed costs, and stress-test the budget for a sales drop.',
      roicTitle: 'Returns below the cost of capital', roicAction: 'Improve margins or release capital: exit or reprice low-return activities, cut working capital and approve new investment only above WACC.',
      improve: n => `Improve ${n.charAt(0).toLowerCase() + n.slice(1)}`,
      groupAction: {
        liquidity: 'Keep a minimum cash buffer, match debt maturities to cash inflows and run a 13-week cash forecast.',
        profitability: 'Review pricing, product mix and unit costs; reprice or drop loss-making lines.',
        efficiency: 'Tighten credit terms and collections, cut slow-moving stock and agree supplier terms that fit the cash cycle.',
        leverage: 'Set a target debt level, fix or hedge interest costs and plan repayments from free cash flow.',
        cashflow: 'Rank capital spending by return and keep dividends within free cash flow.',
        growth: 'Set a growth plan by product and market, funded within the sustainable growth rate.',
        quality: 'Reconcile profit with cash: review revenue recognition, provisions and working-capital build-ups.',
        distress: 'Strengthen equity and liquidity and agree a recovery plan with the board and lenders.',
      },
      warn: {
        waccLeG: 'WACC must be at least 0.5 points above terminal growth: raise WACC inputs or lower terminal growth.',
        tvHigh: 'More than 75% of the value comes from the terminal value: the result is very sensitive to the long-run assumptions.',
        negative: 'Forecast cash flows are negative, so the DCF gives no positive value. Look at the levers and the forecast drivers.',
        debtExceeds: 'Net debt exceeds the enterprise value: on these assumptions the shares have no value.',
        loss: 'The latest year has no operating profit: the value depends entirely on the forecast recovering.',
        highDebtWeight: 'The debt weight is above 60%: the cost of equity (beta) is likely understated at this leverage.',
      },
      missing: list => `The valuation needs ${list} in the latest year. Add the statement or map the line in Data review.`,
      assumptions: 'End-of-year discounting; growth fades in a straight line to the terminal rate; terminal value = NOPAT × (1 − g ÷ RONIC) ÷ (WACC − g); working capital, capex and D&A follow the forecast drivers; net debt from the latest balance sheet (leases only if shown as debt).',
    },
    ar: {
      title: 'التقييم (التدفقات النقدية المخصومة)', hint: 'تقييم بالتدفقات النقدية المخصومة من التوقع الأساسي. مدخلات السوق تعتمد على دولة وعملة القوائم: القيم الافتراضية مؤقتة، استبدلها بقيمك.',
      inputs: 'المدخلات', reset: 'إعادة المدخلات',
      in: { rf: 'العائد الخالي من المخاطر', erp: 'علاوة مخاطر السوق', beta: 'معامل بيتا', kd: 'تكلفة الدين (قبل الضريبة)', tax: 'معدل الضريبة', wd: 'وزن الدين D/(D+E)', g: 'النمو طويل الأجل', years: 'سنوات التوقع', shares: 'عدد الأسهم (اختياري)', price: 'سعر السهم (اختياري)' },
      ke: 'تكلفة حقوق الملكية (CAPM)', kdAt: 'تكلفة الدين بعد الضريبة', wacc: 'المتوسط المرجح لتكلفة رأس المال WACC',
      fcffTitle: 'التدفق النقدي الحر للشركة', growth: 'نمو الإيرادات', ebit: 'الربح التشغيلي EBIT', nopat: 'NOPAT = EBIT × (1 − الضريبة)', dna: '+ الإهلاك والاستهلاك', capex: '− الإنفاق الرأسمالي',
      dNwc: '− الزيادة في رأس المال العامل', fcff: 'FCFF', df: 'معامل الخصم', pv: 'القيمة الحالية',
      ronic: 'العائد على الاستثمار الجديد (المدى الطويل)', bridge: 'من قيمة المنشأة إلى قيمة حقوق الملكية', sumPv: 'القيمة الحالية لتدفقات التوقع', pvTv: 'القيمة الحالية للقيمة النهائية', ev: 'قيمة المنشأة', netDebt: '− صافي الدين (الديون − النقدية)',
      equity: 'قيمة حقوق الملكية', perShare: 'القيمة للسهم', upside: 'الفرق عن سعر السهم', tvShare: 'نسبة القيمة النهائية من قيمة المنشأة',
      multiples: 'المضاعفات الضمنية (آخر سنة)', evEbitda: 'قيمة المنشأة / EBITDA', pe: 'قيمة حقوق الملكية / صافي الربح', evRevenue: 'قيمة المنشأة / الإيرادات',
      sens: 'الحساسية: قيمة حقوق الملكية', sensHint: 'الصفوف: WACC؛ الأعمدة: النمو طويل الأجل. نفس التدفقات المتوقعة.',
      scen: 'قيمة حقوق الملكية حسب السيناريو', evaTitle: 'القيمة الاقتصادية المضافة (EVA)', evaHint: 'EVA = NOPAT − WACC × رأس المال المستثمر (ديون + حقوق ملكية، رصيد أول المدة). الموجب يعني عائداً أعلى من تكلفة رأس المال.',
      ic: 'رأس المال المستثمر', roic: 'العائد على رأس المال المستثمر', eva: 'EVA', spread: 'ROIC − WACC',
      levers: 'روافع القيمة', leversHint: 'يُطبَّق كل تغيير وحده على التوقع الأساسي ويُعاد التقييم. الأكبر أثراً على قيمة حقوق الملكية أولاً.',
      lever: { growth: 'نمو الإيرادات +2 نقطة', grossMargin: 'هامش مجمل الربح +1 نقطة', opex: 'المصروفات التشغيلية −1 نقطة من الإيرادات', dso: 'تحصيل أسرع بـ10 أيام', dio: 'مخزون أقل بـ10 أيام', capex: 'الإنفاق الرأسمالي −1 نقطة من الإيرادات' },
      impact: 'قيمة مضافة لحقوق الملكية', change: 'التغيير',
      planTitle: 'خطة العمل', planHint: 'كل التوصيات مرتبة حسب الأولوية. هذه مقترحات للإدارة: لا يُرسل أو يُدفع أو يُرحَّل أي شيء.',
      when: 'التوقيت', owner: 'المسؤول', priority: 'الأولوية', recommendation: 'التوصية', kpi: 'المؤشر', current: 'الآن', target: 'المستهدف',
      horizon: { high: '0–3 أشهر', med: '3–6 أشهر', low: '6–12 شهراً' },
      area: { treasury: 'الخزينة', sales: 'المبيعات والائتمان', procurement: 'المشتريات', operations: 'العمليات', finance: 'المالية', management: 'الإدارة العليا', board: 'مجلس الإدارة' },
      reconTitle: 'القوائم غير مترابطة', reconAction: list => `ابحث عن البند المقروء أو المربوط خطأ قبل استخدام هذه الأرقام: ${list}. راجع مراجعة البيانات والقوائم الأصلية.`,
      mosTitle: 'هامش أمان ضيق', mosAction: 'خفّض نقطة التعادل: ارفع هامش المساهمة (التسعير، المزيج، التكاليف المتغيرة) أو خفّض التكاليف الثابتة، واختبر الموازنة لانخفاض المبيعات.',
      roicTitle: 'عائد أقل من تكلفة رأس المال', roicAction: 'حسّن الهوامش أو حرّر رأس المال: اخرج من الأنشطة منخفضة العائد أو أعد تسعيرها، خفّض رأس المال العامل، ولا توافق على استثمار جديد بعائد أقل من WACC.',
      improve: n => `تحسين ${n}`,
      groupAction: {
        liquidity: 'احتفظ بحد أدنى من النقدية، وطابق آجال الديون مع التدفقات الداخلة، وأعدّ توقعاً نقدياً لمدة 13 أسبوعاً.',
        profitability: 'راجع التسعير ومزيج المنتجات وتكلفة الوحدة؛ أعد تسعير الخطوط الخاسرة أو أوقفها.',
        efficiency: 'شدّد شروط الائتمان والتحصيل، وخفّض المخزون بطيء الحركة، واتفق مع الموردين على آجال تناسب الدورة النقدية.',
        leverage: 'حدد مستوى مستهدفاً للديون، وثبّت أو تحوّط تكلفة الفائدة، وخطط للسداد من التدفق النقدي الحر.',
        cashflow: 'رتّب الإنفاق الرأسمالي حسب العائد، وأبقِ التوزيعات في حدود التدفق النقدي الحر.',
        growth: 'ضع خطة نمو حسب المنتج والسوق، ممولة في حدود معدل النمو المستدام.',
        quality: 'طابق الربح مع النقد: راجع الاعتراف بالإيراد والمخصصات وتراكم رأس المال العامل.',
        distress: 'دعّم حقوق الملكية والسيولة واتفق على خطة تعافٍ مع مجلس الإدارة والبنوك.',
      },
      warn: {
        waccLeG: 'يجب أن يزيد WACC عن النمو طويل الأجل بنصف نقطة على الأقل: ارفع مدخلات WACC أو خفّض النمو.',
        tvHigh: 'أكثر من 75% من القيمة يأتي من القيمة النهائية: النتيجة حساسة جداً لافتراضات المدى الطويل.',
        negative: 'التدفقات المتوقعة سالبة، فلا يعطي التقييم قيمة موجبة. راجع روافع القيمة ومحركات التوقع.',
        debtExceeds: 'صافي الدين يتجاوز قيمة المنشأة: وفق هذه الافتراضات لا قيمة للأسهم.',
        loss: 'لا يوجد ربح تشغيلي في آخر سنة: القيمة تعتمد كلياً على تعافي التوقع.',
        highDebtWeight: 'وزن الدين أعلى من 60%: غالباً ما تكون تكلفة حقوق الملكية (بيتا) أقل من الواقع عند هذا الرفع.',
      },
      missing: list => `يحتاج التقييم إلى ${list} في آخر سنة. أضف القائمة أو اربط البند في مراجعة البيانات.`,
      assumptions: 'الخصم في نهاية السنة؛ النمو يتناقص خطياً حتى معدل المدى الطويل؛ القيمة النهائية = NOPAT × (1 − g ÷ RONIC) ÷ (WACC − g)؛ رأس المال العامل والإنفاق الرأسمالي والإهلاك تتبع محركات التوقع؛ صافي الدين من آخر ميزانية (الإيجارات فقط إن ظهرت كديون).',
    },
  };

  /** Valuation and plan as display-ready tables, shared by the Valuation tab, the Full analysis and the exports. */
  function valuationModel(R) {
    const { A, F, lang } = R, L = UIV[lang], ds = A.ds;
    const V = R.V !== undefined ? R.V : valuation(ds, R.drivers, R.dcf);
    const money = v => CFO.fmtNum(v, 0, lang), pct = v => CFO.fmtPct(v, lang), x = v => CFO.fmtVal('x', v, lang);
    const plan = actionPlan(A, F, V && !V.missing ? V : null, lang, { be: R.be, peers: R.peers });
    const planTable = { head: ['#', L.priority, L.when, L.owner, L.recommendation, L.kpi, L.current, L.target],
      rows: plan.map(it => [String(it.n), it.sevText, it.horizon, it.areaText, `${it.title}: ${it.action}`, it.kpi, it.current, it.target]), items: plan };
    if (!V || V.missing) return { missing: L.missing((V?.missing || []).map(k => CFO.itemName(k, lang)).join(lang === 'ar' ? '، ' : ', ')), plan: planTable, levers: null };
    const out = { V, warnings: [...(V.error ? [V.error] : []), ...V.warnings].map(w => L.warn[w]), plan: planTable, assumptions: L.assumptions };
    out.wacc = { head: [L.inputs, ''], rows: [[L.in.rf, pct(V.inputs.rf)], [L.in.erp, pct(V.inputs.erp)], [L.in.beta, x(V.inputs.beta)], [L.ke, pct(V.ke)],
      [L.in.kd, pct(V.inputs.kd)], [L.in.tax, pct(V.inputs.tax)], [L.kdAt, pct(V.kdAt)], [L.in.wd, pct(V.inputs.wd)], [L.wacc, pct(V.wacc)], [L.in.g, pct(V.inputs.g)],
      ...(V.ronic != null ? [[L.ronic, pct(V.ronic)]] : [])] };
    out.fcff = { head: ['', ...V.rows.map(r => r.period)], sub: [false, false, false, false, false, false, false, true, false, false],
      rows: [[CFO.itemName('revenue', lang), ...V.rows.map(r => money(r.revenue))], [L.growth, ...V.rows.map(r => pct(r.growth))], [L.ebit, ...V.rows.map(r => money(r.ebit))],
        [L.nopat, ...V.rows.map(r => money(r.nopat))], [L.dna, ...V.rows.map(r => money(r.dna))], [L.capex, ...V.rows.map(r => money(r.capex))],
        [L.dNwc, ...V.rows.map(r => money(r.dNwc))], [L.fcff, ...V.rows.map(r => money(r.fcff))], [L.df, ...V.rows.map(r => r.df.toFixed(3))], [L.pv, ...V.rows.map(r => money(r.pv))]] };
    out.eva = { head: [CFO.UI[lang].period, L.nopat, L.ic, L.roic, L.wacc, L.spread, L.eva],
      rows: V.eva.map(e => [e.period, money(e.nopat), money(e.ic), pct(e.roic), pct(V.wacc), e.roic == null ? '—' : pct(e.roic - V.wacc), money(e.eva)]) };
    if (V.error) return out;
    out.bridge = { head: [L.bridge, ''], sub: [false, false, true, false, true, false, false],
      rows: [[L.sumPv, money(V.sumPv)], [L.pvTv, money(V.pvTv)], [L.ev, money(V.ev)], [L.netDebt, money(V.netDebt)], [L.equity, money(V.equity)],
        ...(V.perShare != null ? [[L.perShare, CFO.fmtVal('num', V.perShare, lang)]] : []), ...(V.upside != null ? [[L.upside, `${V.upside >= 0 ? '+' : ''}${pct(V.upside)}`]] : []),
        [L.tvShare, pct(V.tvShare)]] };
    out.multiples = { head: [L.multiples, ''], rows: [[L.evEbitda, x(V.evEbitda)], [L.pe, x(V.pe)], [L.evRevenue, x(V.evRevenue)]] };
    out.sens = { head: [`WACC \\ g`, ...V.sens.gs.map(pct)], center: 2,
      rows: V.sens.waccs.map((w, i) => [pct(w), ...V.sens.grid[i].map(v => v == null ? '—' : money(v))]) };
    const sv = R.scenarioValues !== undefined ? R.scenarioValues : scenarioValues(ds, V.drivers, V.inputs);
    const Fc = CFO.UI[lang].fc;
    out.scen = { head: ['', ...['base', 'upside', 'downside'].map(n => Fc.sc[n])], rows: [[L.equity, ...['base', 'upside', 'downside'].map(n => money(sv[n]))]] };
    const lev = R.levers !== undefined ? R.levers : valueLevers(ds, V);
    const fmtD = (k, v) => CFO.FORECAST_DRIVERS[k][3] === '%' ? pct(v) : CFO.fmtVal('days', v, lang);
    out.levers = { head: ['#', L.levers, L.change, L.impact, '%'], text: 2,
      rows: lev.map((l, i) => [String(i + 1), L.lever[l.id], `${fmtD(l.key, l.from)} → ${fmtD(l.key, l.to)}`, `+${money(l.impact)}`, l.pct == null ? '—' : `+${pct(l.pct)}`]) };
    out.headline = { ev: money(V.ev), equity: money(V.equity), wacc: pct(V.wacc), perShare: V.perShare != null ? CFO.fmtVal('num', V.perShare, lang) : null };
    out.chart = { title: L.fcffTitle, kind: 'bar', labels: V.rows.map(r => r.period), fmt: money,
      series: [{ name: L.fcff, values: V.rows.map(r => r.fcff), color: 'var(--s1)' }, { name: L.pv, values: V.rows.map(r => r.pv), color: 'var(--s2)' }] };
    return out;
  }

  for (const lang of ['en', 'ar']) if (CFO.UI?.[lang]) CFO.UI[lang].val = UIV[lang];
  CFO.DCF_INPUTS = INPUTS;
  CFO.dcfDefaults = dcfDefaults;
  CFO.clampDcf = clampInput;
  CFO.valuation = valuation;
  CFO.scenarioValues = scenarioValues;
  CFO.valueLevers = valueLevers;
  CFO.actionPlan = actionPlan;
  CFO.valuationModel = valuationModel;
  CFO.equityAt = equityAt;
})(globalThis.CFO = globalThis.CFO || {});
