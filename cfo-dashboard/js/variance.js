/* Budget vs actual (or actual vs prior year when no budget is given).
 * The budget is read by the same parsers and mapped to the same standard items, kept apart from the actuals.
 * For each line: actual, plan, variance, variance %, favourable / adverse (lower is better for costs).
 * The profit walk splits the gross-profit variance into a volume effect (revenue change at the planned margin)
 * and a margin effect (margin change on actual revenue), then the cost, interest and tax lines down to net income.
 */
(function (CFO) {
  const nn = v => v != null && isFinite(v);
  const LINES = ['revenue', 'cogs', 'gross_profit', 'opex', 'dna', 'operating_income', 'interest', 'pretax_income', 'tax', 'net_income',
    'cash', 'receivables', 'inventory', 'current_assets', 'total_assets', 'payables', 'short_debt', 'long_debt', 'total_liabilities', 'equity', 'cfo', 'capex', 'dividends'];
  // Better when higher (+1), lower (−1), or neither (0) for the favourable / adverse label.
  const GOOD = { revenue: 1, gross_profit: 1, operating_income: 1, pretax_income: 1, net_income: 1, cash: 1, equity: 1, cfo: 1,
    cogs: -1, opex: -1, dna: -1, interest: -1, tax: 0, receivables: -1, inventory: -1, short_debt: -1, long_debt: -1, capex: 0, dividends: 0 };

  /** Which plan period to compare with: the same year if the budget has it, else the budget's latest column. */
  const isYear = p => /^(19|20)\d{2}/.test(String(p));
  function pickPeriods(ds, budget) {
    const actual = ds.periods[ds.periods.length - 1];
    if (!budget) return { actual, plan: ds.periods.length > 1 ? ds.periods[ds.periods.length - 2] : null, mode: 'prior' };
    if (budget.periods.includes(actual)) return { actual, plan: actual, mode: 'budget' };
    const unnamed = budget.periods.filter(p => !isYear(p));
    // Several columns without a year (Q1–Q4, months): together they are the year's budget.
    if (unnamed.length > 1 && unnamed.length === budget.periods.length) return { actual, plan: null, sumOf: unnamed, mode: 'budget' };
    const plan = budget.periods[budget.periods.length - 1];
    return { actual, plan, mode: 'budget', yearMismatch: isYear(plan) ? plan : null };
  }
  /** The budget figures for the comparison: one column, or flows added up and balances from the last column. */
  function planData(budget, pp) {
    if (!pp.sumOf) return budget.data[pp.plan] || {};
    const out = {}, last = budget.data[pp.sumOf[pp.sumOf.length - 1]] || {};
    for (const it of CFO.ITEMS) {
      if (it.kind === 'stock') { if (nn(last[it.key])) out[it.key] = last[it.key]; continue; }
      const vals = pp.sumOf.map(p => budget.data[p][it.key]).filter(nn);
      if (vals.length) out[it.key] = vals.reduce((a, b) => a + b, 0);
    }
    return out;
  }

  function variance(ds, budget) {
    const pp = pickPeriods(ds, budget);
    if (!pp.actual || (!pp.plan && !pp.sumOf)) return { ...pp, rows: [] };
    const a = ds.data[pp.actual] || {}, b = budget ? planData(budget, pp) : ds.data[pp.plan] || {};
    const rows = LINES.filter(k => nn(a[k]) && nn(b[k])).map(k => {
      const diff = a[k] - b[k], pct = b[k] !== 0 ? diff / Math.abs(b[k]) : null, g = GOOD[k] ?? 0;
      return { key: k, actual: a[k], plan: b[k], diff, pct, fav: g === 0 || Math.abs(diff) < 1e-9 ? null : diff * g > 0 };
    });
    // Profit walk from plan to actual net income.
    let walk = null;
    if (nn(a.revenue) && nn(b.revenue) && nn(a.gross_profit) && nn(b.gross_profit) && b.revenue !== 0 && a.revenue !== 0 && nn(a.net_income) && nn(b.net_income)) {
      const gmB = b.gross_profit / b.revenue, gmA = a.gross_profit / a.revenue;
      const step = k => nn(a[k]) && nn(b[k]) ? -(a[k] - b[k]) : null;   // a cost above plan lowers profit
      // Tax as the gap between profit before and after tax, so a tax credit on a loss keeps its sign.
      const taxOf = x => nn(x.pretax_income) && nn(x.net_income) ? x.pretax_income - x.net_income : null;
      const steps = [['volume', (a.revenue - b.revenue) * gmB], ['margin', (gmA - gmB) * a.revenue],
        ['opex', step('opex')], ['dna', step('dna')], ['interest', step('interest')], ['tax', nn(taxOf(a)) && nn(taxOf(b)) ? -(taxOf(a) - taxOf(b)) : step('tax')]].filter(([, v]) => nn(v));
      const explained = steps.reduce((t, [, v]) => t + v, 0), total = a.net_income - b.net_income;
      if (Math.abs(total - explained) > Math.max(Math.abs(a.net_income), Math.abs(b.net_income), 1) * 1e-6) steps.push(['other', total - explained]);
      walk = { start: b.net_income, end: a.net_income, steps };
    }
    // A "budget" identical to the actuals usually means the actual column was read instead of the budget column.
    const same = ['revenue', 'net_income'].every(k => nn(a[k]) && nn(b[k]) && Math.abs(a[k] - b[k]) < 1e-9);
    return { ...pp, rows, walk, sameAsActual: budget ? same : false };
  }

  const UIV = {
    en: {
      title: 'Budget vs actual', hintBudget: 'Compared with the budget you added. Favourable = better for profit or cash (lower costs, higher revenue).',
      hintPrior: 'No budget added, so the latest year is compared with the prior year. Add a budget in the same layout as the statements (labels + a year or "Budget" column).',
      addBudget: 'Add budget file', pasteBudget: 'Paste budget from Excel', useBudget: 'Use pasted budget', removeBudget: 'Remove budget',
      actual: 'Actual', plan: { budget: 'Budget', prior: 'Prior year' }, diff: 'Variance', pct: 'Variance %', fav: 'Favourable', adv: 'Adverse',
      walk: 'Net income walk', walkHint: 'From planned to actual net income. Volume = revenue change at the planned gross margin; margin = change in gross margin on actual revenue.',
      sumOf: n => `Budget (${n} columns added)`, yearMismatch: (b, a) => `The budget is for ${b} but the latest actual year is ${a}: check that this is the right comparison.`,
      sameAsActual: 'The budget equals the actual figures for revenue and net income: the actual column may have been read instead of the budget column. Keep only the budget column in the file.',
      step: { startPrior: 'Prior-year net income', start: 'Planned net income', volume: 'Sales volume / revenue', margin: 'Gross margin', opex: 'Operating expenses', dna: 'Depreciation', interest: 'Interest', tax: 'Tax', other: 'Other items', end: 'Actual net income' },
      none: 'Needs a budget or at least two years of statements.', read: (n, p) => `Budget read from ${n} (${p}).`, fail: n => `${n}: no budget lines with a year or budget column were found.`,
      advTitle: n => `Adverse variance: ${n}`, advAction: 'Explain the gap (price, volume, cost, timing) with the line owner, agree corrective actions and update the forecast.',
    },
    ar: {
      title: 'الموازنة مقابل الفعلي', hintBudget: 'مقارنة بالموازنة التي أضفتها. ملائم = أفضل للربح أو النقد (تكاليف أقل، إيرادات أعلى).',
      hintPrior: 'لم تُضف موازنة، لذا تُقارن آخر سنة بالسنة السابقة. أضف موازنة بنفس شكل القوائم (البنود + عمود سنة أو «موازنة»).',
      addBudget: 'إضافة ملف الموازنة', pasteBudget: 'لصق الموازنة من Excel', useBudget: 'استخدام الموازنة الملصقة', removeBudget: 'حذف الموازنة',
      actual: 'الفعلي', plan: { budget: 'الموازنة', prior: 'السنة السابقة' }, diff: 'الانحراف', pct: 'الانحراف %', fav: 'ملائم', adv: 'غير ملائم',
      walk: 'جسر صافي الربح', walkHint: 'من صافي الربح المخطط إلى الفعلي. الحجم = تغير الإيرادات بهامش مجمل الربح المخطط؛ الهامش = تغير هامش مجمل الربح على الإيرادات الفعلية.',
      sumOf: n => `الموازنة (مجموع ${n} أعمدة)`, yearMismatch: (b, a) => `الموازنة لعام ${b} بينما آخر سنة فعلية ${a}: تأكد أن هذه هي المقارنة الصحيحة.`,
      sameAsActual: 'الموازنة تساوي الأرقام الفعلية للإيرادات وصافي الربح: ربما قُرئ العمود الفعلي بدل عمود الموازنة. أبقِ عمود الموازنة فقط في الملف.',
      step: { startPrior: 'صافي ربح السنة السابقة', start: 'صافي الربح المخطط', volume: 'حجم المبيعات / الإيرادات', margin: 'هامش مجمل الربح', opex: 'المصروفات التشغيلية', dna: 'الإهلاك', interest: 'الفوائد', tax: 'الضريبة', other: 'بنود أخرى', end: 'صافي الربح الفعلي' },
      none: 'يحتاج إلى موازنة أو سنتين على الأقل من القوائم.', read: (n, p) => `قُرئت الموازنة من ${n} (${p}).`, fail: n => `${n}: لم يُعثر على بنود موازنة بعمود سنة أو موازنة.`,
      advTitle: n => `انحراف غير ملائم: ${n}`, advAction: 'فسّر الفجوة (سعر، حجم، تكلفة، توقيت) مع مسؤول البند، واتفق على إجراءات تصحيحية، وحدّث التوقعات.',
    },
  };

  /** Display-ready variance tables. R: { A, budget (dataset or null), lang } */
  function varianceModel(R) {
    const { A, lang } = R, L = UIV[lang], v = variance(A.ds, R.budget || null);
    const money = x => CFO.fmtNum(x, 0, lang), pct = x => (x == null ? '—' : `${x > 0 ? '+' : ''}${CFO.fmtPct(x, lang)}`);
    const planName = v.mode === 'budget' ? (v.sumOf ? L.sumOf(v.sumOf.length) : /^(19|20)\d{2}/.test(v.plan) ? `${L.plan.budget} ${v.plan}` : L.plan.budget) : `${L.plan.prior} ${v.plan || ''}`;
    const m = { v, mode: v.mode, hint: v.mode === 'budget' ? L.hintBudget : L.hintPrior,
      warnings: [v.yearMismatch ? L.yearMismatch(v.yearMismatch, v.actual) : null, v.sameAsActual ? L.sameAsActual : null].filter(Boolean) };
    if (!v.rows.length) { m.none = L.none; return m; }
    m.table = { head: [CFO.UI[lang].item, `${L.actual} ${v.actual}`, planName, L.diff, L.pct, ''], text: 1, sub: v.rows.map(r => CFO.SUBTOTALS.has(r.key)),
      rows: v.rows.map(r => [CFO.itemName(r.key, lang), money(r.actual), money(r.plan), money(r.diff), pct(r.pct), r.fav == null ? '' : r.fav ? L.fav : L.adv]), items: v.rows };
    if (v.walk) {
      const w = v.walk;
      m.walk = { head: [L.walk, ''], sub: [true, ...w.steps.map(() => false), true],
        rows: [[v.mode === 'budget' ? L.step.start : L.step.startPrior, money(w.start)], ...w.steps.map(([k, x]) => [L.step[k], `${x >= 0 ? '+' : ''}${money(x)}`]), [L.step.end, money(w.end)]] };
      m.chart = { title: L.walk, kind: 'bar', labels: w.steps.map(([k]) => L.step[k]), fmt: money,
        series: [{ name: L.diff, values: w.steps.map(([, x]) => x), color: 'var(--s1)' }] };
    }
    return m;
  }

  /** Adverse variances above 10% on the main profit lines, for the action plan. */
  function adverse(ds, budget) {
    return variance(ds, budget).rows.filter(r => r.fav === false && r.pct != null && Math.abs(r.pct) > 0.1 &&
      ['revenue', 'gross_profit', 'opex', 'operating_income', 'net_income', 'cfo'].includes(r.key));
  }

  for (const lang of ['en', 'ar']) if (CFO.UI?.[lang]) CFO.UI[lang].var = UIV[lang];
  CFO.variance = variance;
  CFO.varianceModel = varianceModel;
  CFO.adverseVariances = adverse;
})(globalThis.CFO = globalThis.CFO || {});
