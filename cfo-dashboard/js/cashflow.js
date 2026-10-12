/* Statement checks, cash-flow analysis and break-even.
 * - reconcile(ds): ties the statements together (balance sheet balances, profit after tax, cash movement = change in cash)
 *   and shows each difference with its amount, so a misread line is visible at once.
 * - cashBridge(ds): indirect-method bridge from net income to the change in cash, with the reported totals beside it.
 * - sourcesUses(ds): where the cash came from and where it went, each year.
 * - breakEven(ds, opts): contribution margin, break-even revenue, margin of safety, operating / financial leverage.
 *   Cost of sales is variable and other operating costs fixed by default (editable shares); fixed costs are inferred
 *   as contribution − reported EBIT so the model reproduces the reported operating profit.
 */
(function (CFO) {
  const nn = v => v != null && isFinite(v);
  const or0 = v => (nn(v) ? v : 0);
  // Half a percent of the larger figure: works for statements in units, thousands or millions alike.
  const tol = (...vals) => Math.max(1e-6, ...vals.map(v => Math.abs(or0(v)) * 0.005));

  /** [{ id, period, left, right, diff, ok }] for every check the statements allow. */
  function reconcile(ds) {
    const out = [], P = ds.periods;
    const read = (p, ...ks) => ks.every(k => nn(ds.data[p][k]) && !ds.derived[p].has(k));
    P.forEach((p, i) => {
      const d = ds.data[p];
      if (read(p, 'total_assets', 'total_liabilities', 'equity')) {
        const r = d.total_liabilities + d.equity;
        out.push({ id: 'balance', period: p, left: d.total_assets, right: r, diff: d.total_assets - r });
      }
      if (read(p, 'pretax_income', 'tax', 'net_income')) {
        // Tax is stored as a positive cost; a tax credit on a loss is added back instead, so accept either reading.
        const r1 = d.pretax_income - d.tax, r2 = d.pretax_income + d.tax;
        const r = d.pretax_income < 0 && Math.abs(d.net_income - r2) < Math.abs(d.net_income - r1) ? r2 : r1;
        out.push({ id: 'profit', period: p, left: d.net_income, right: r, diff: d.net_income - r });
      }
      if (read(p, 'revenue', 'cogs', 'gross_profit')) {
        const r = d.revenue - d.cogs;
        out.push({ id: 'gross', period: p, left: d.gross_profit, right: r, diff: d.gross_profit - r });
      }
      if (read(p, 'current_assets', 'total_assets') && d.current_assets > d.total_assets + tol(d.total_assets))
        out.push({ id: 'caTa', period: p, left: d.current_assets, right: d.total_assets, diff: d.current_assets - d.total_assets });
      const q = P[i - 1];
      if (q && read(p, 'cfo', 'cfi', 'cff', 'cash') && nn(ds.data[q].cash)) {
        const move = d.cfo + d.cfi + d.cff, change = d.cash - ds.data[q].cash;
        out.push({ id: 'cash', period: p, left: move, right: change, diff: move - change });
      }
    });
    return out.map(c => ({ ...c, ok: Math.abs(c.diff) <= tol(c.left, c.right) }));
  }

  /** Indirect-method bridge for every year that has a prior year. */
  function cashBridge(ds) {
    const P = ds.periods;
    return P.slice(1).map((p, i) => {
      const d = ds.data[p], q = ds.data[P[i]];
      const delta = k => nn(d[k]) && nn(q[k]) ? d[k] - q[k] : null;
      const debt = x => (nn(x.short_debt) || nn(x.long_debt)) ? or0(x.short_debt) + or0(x.long_debt) : null;
      const dDebt = nn(debt(d)) && nn(debt(q)) ? debt(d) - debt(q) : null;
      const rows = {
        net_income: d.net_income ?? null, dna: d.dna ?? null,
        d_receivables: delta('receivables') == null ? null : -delta('receivables'),
        d_inventory: delta('inventory') == null ? null : -delta('inventory'),
        d_payables: delta('payables'),
      };
      const known = Object.values(rows).filter(nn).reduce((a, b) => a + b, 0);
      rows.cfo_other = nn(d.cfo) && nn(rows.net_income) ? d.cfo - known : null;   // tax, provisions, other working capital…
      rows.cfo = d.cfo ?? null;
      // Without a cash-flow statement the operating cash flow is only an estimate from the other two statements.
      rows.cfo_est = !nn(d.cfo) && nn(rows.net_income) ? known : null;
      rows.capex = nn(d.capex) ? -d.capex : null;
      rows.cfi_other = nn(d.cfi) && nn(d.capex) ? d.cfi + d.capex : null;
      rows.cfi = d.cfi ?? null;
      rows.dividends = nn(d.dividends) ? -d.dividends : null;
      rows.net_borrowing = dDebt;
      rows.cff_other = nn(d.cff) ? d.cff - or0(rows.dividends) - or0(dDebt) : null;
      rows.cff = d.cff ?? null;
      rows.change = nn(rows.cfo) && nn(rows.cfi) && nn(rows.cff) ? rows.cfo + rows.cfi + rows.cff : null;
      rows.change_reported = delta('cash');
      rows.fcff = nn(d.cfo) && nn(d.capex) ? d.cfo - d.capex + or0(d.interest) * (1 - CFO.enrich(d).tax_rate_eff) : null;
      rows.fcfe = nn(d.cfo) && nn(d.capex) ? d.cfo - d.capex + or0(dDebt) : null;
      return { period: p, rows };
    });
  }

  /** Sources and uses of cash; "other" balances the two sides to the reported change in cash. */
  function sourcesUses(ds) {
    return cashBridge(ds).filter(b => nn(b.rows.cfo)).map(({ period, rows: r }) => {
      const src = [], use = [];
      const put = (k, v) => { if (!nn(v) || v === 0) return; (v > 0 ? src : use).push([k, Math.abs(v)]); };
      put('cfo', r.cfo); put('capex', r.capex); put('cfi_other', r.cfi_other); put('dividends', r.dividends);
      put('net_borrowing', r.net_borrowing); put('cff_other', r.cff_other);
      if (nn(r.change_reported)) put('cash_used', -r.change_reported);   // cash run down is a source, cash built up a use
      const s = src.reduce((a, [, v]) => a + v, 0), u = use.reduce((a, [, v]) => a + v, 0);
      if (Math.abs(s - u) > Math.max(s, u) * 1e-6) (s > u ? use : src).push(['other', Math.abs(s - u)]);
      return { period, sources: src, uses: use, total: Math.max(s, u) };
    }).filter(x => x.sources.length || x.uses.length);
  }

  /** Break-even for one year. opts: { cogsVar: share of cost of sales that is variable, opexVar, target: operating profit }. */
  function breakEven(ds, opts = {}, period = ds.periods[ds.periods.length - 1]) {
    const d = ds.data[period] || {};
    if (!(d.revenue > 0) || !nn(d.operating_income)) return { period, missing: [...(d.revenue > 0 ? [] : ['revenue']), ...(nn(d.operating_income) ? [] : ['operating_income'])] };
    const cogs = d.cogs ?? (nn(d.gross_profit) ? d.revenue - d.gross_profit : null);
    if (!nn(cogs)) return { period, missing: ['cogs'] };
    const cv = opts.cogsVar ?? 1, ov = opts.opexVar ?? 0;
    const variable = cogs * cv + or0(d.opex) * ov;
    const cm = d.revenue - variable, cmr = cm / d.revenue;
    const fixed = cm - d.operating_income;               // everything that does not move with sales
    const out = { period, revenue: d.revenue, variable, cm, cmr, fixed, ebit: d.operating_income, interest: or0(d.interest), cogsVar: cv, opexVar: ov };
    if (cmr > 0) {
      out.beRevenue = Math.max(0, fixed / cmr);
      out.mos = (d.revenue - out.beRevenue) / d.revenue;
      out.mosAmount = d.revenue - out.beRevenue;
      if (nn(opts.target)) out.targetRevenue = Math.max(0, (fixed + opts.target) / cmr);
      out.cashBe = Math.max(0, (fixed - or0(d.dna)) / cmr);   // depreciation is not a cash cost
    }
    const pbt = d.operating_income - or0(d.interest);
    // Leverage multipliers only mean something while the company is profitable at each level.
    out.dol = d.operating_income > 0 && cm > 0 ? cm / d.operating_income : null;
    out.dfl = d.operating_income > 0 && pbt > 0 ? d.operating_income / pbt : null;
    out.dcl = nn(out.dol) && nn(out.dfl) ? out.dol * out.dfl : null;
    // High-low method across the years: the variable cost rate implied by how total operating cost moved with revenue.
    const ys = ds.periods.filter(p => ds.data[p].revenue > 0 && nn(ds.data[p].operating_income));
    if (ys.length >= 2) {
      const lo = ys.reduce((a, p) => ds.data[p].revenue < ds.data[a].revenue ? p : a), hi = ys.reduce((a, p) => ds.data[p].revenue > ds.data[a].revenue ? p : a);
      const cost = p => ds.data[p].revenue - ds.data[p].operating_income, dr = ds.data[hi].revenue - ds.data[lo].revenue;
      if (dr > 0) {
        const rate = (cost(hi) - cost(lo)) / dr, f = cost(hi) - rate * ds.data[hi].revenue;
        out.highLow = { lo, hi, rate, fixed: f, beRevenue: rate < 1 && f > 0 ? f / (1 - rate) : null, usable: rate > 0 && rate < 1 && f >= 0 };
      }
    }
    return out;
  }

  /* ---------- text ---------- */
  const UIC = {
    en: {
      title: 'Cash flow and break-even', recon: 'Statement checks', reconHint: 'Each check ties two statements together. A difference usually means a line was read or mapped wrongly: open Data review.',
      check: { balance: 'Total assets = liabilities + equity', profit: 'Net income = profit before tax − tax', gross: 'Gross profit = revenue − cost of sales', caTa: 'Current assets ≤ total assets', cash: 'Operating + investing + financing cash flow = change in cash' },
      left: 'Statement', right: 'Should equal', diff: 'Difference', ok: 'Ties', off: 'Check',
      bridge: 'Cash-flow bridge (indirect method)', bridgeHint: 'From net income to the change in cash. "Other" lines are what the statements show beyond the items read (tax, provisions, other working capital, FX).',
      r: { net_income: 'Net income', dna: '+ Depreciation & amortisation', d_receivables: '− Increase in receivables', d_inventory: '− Increase in inventory', d_payables: '+ Increase in payables',
        cfo_other: '± Other operating items', cfo: 'Cash from operations', cfo_est: 'Estimated cash from operations (no cash-flow statement)', capex: '− Capital expenditure', cfi_other: '± Other investing', cfi: 'Cash from investing',
        dividends: '− Dividends paid', net_borrowing: '± Net borrowing (change in debt)', cff_other: '± Other financing', cff: 'Cash from financing',
        change: 'Change in cash (flows)', change_reported: 'Change in cash (balance sheet)', fcff: 'Free cash flow to the firm', fcfe: 'Free cash flow to equity' },
      su: 'Sources and uses of cash', sources: 'Sources', uses: 'Uses',
      suItem: { cfo: 'Operations', capex: 'Capital expenditure', cfi_other: 'Other investing', dividends: 'Dividends', net_borrowing: 'Borrowing (net)', cff_other: 'Other financing', cash_used: 'Cash balance', other: 'Other / unexplained' },
      be: 'Break-even and operating leverage', beHint: 'Cost of sales is treated as variable and other operating costs as fixed; change the shares to match your business. Fixed costs are inferred so that the model reproduces the reported operating profit.',
      cogsVar: 'Variable share of cost of sales', opexVar: 'Variable share of operating expenses', target: 'Target operating profit',
      cm: 'Contribution margin', cmr: 'Contribution margin ratio', variable: 'Variable costs', fixed: 'Fixed costs (incl. D&A)', beRevenue: 'Break-even revenue', cashBe: 'Cash break-even revenue (excl. D&A)',
      mos: 'Margin of safety', targetRevenue: 'Revenue for the target profit', dol: 'Operating leverage (DOL)', dfl: 'Financial leverage (DFL)', dcl: 'Combined leverage (DCL)',
      highLow: (lo, hi) => `High–low method (${lo} → ${hi})`, rate: 'Variable cost per 1 of revenue', hlNote: 'Not usable: costs did not move with revenue in a way the method can read.',
      cvp: 'Cost–volume–profit', revenueLine: 'Revenue', costLine: 'Total cost',
      mean: {
        mos: v => `Sales could fall by ${v} before the company stops making an operating profit.`,
        mosNeg: v => `Sales are ${v} below the break-even point: the business does not cover its fixed costs at this volume.`,
        dol: v => `A 1% change in sales moves operating profit by about ${v}%.`,
        dcl: v => `A 1% change in sales moves profit before tax by about ${v}%.`,
      },
      missing: list => `Break-even needs ${list} for the latest year.`,
      none: 'Needs at least two years of statements.',
      cfr: 'Cash-flow ratios',
    },
    ar: {
      title: 'التدفقات النقدية ونقطة التعادل', recon: 'فحوص الربط بين القوائم', reconHint: 'كل فحص يربط قائمتين ببعضهما. الفرق غالباً يعني أن بنداً قُرئ أو رُبط خطأ: افتح مراجعة البيانات.',
      check: { balance: 'إجمالي الأصول = الالتزامات + حقوق الملكية', profit: 'صافي الربح = الربح قبل الضريبة − الضريبة', gross: 'مجمل الربح = الإيرادات − تكلفة المبيعات', caTa: 'الأصول المتداولة ≤ إجمالي الأصول', cash: 'التدفق التشغيلي + الاستثماري + التمويلي = التغير في النقدية' },
      left: 'القائمة', right: 'يجب أن يساوي', diff: 'الفرق', ok: 'متطابق', off: 'راجع',
      bridge: 'جسر التدفقات النقدية (الطريقة غير المباشرة)', bridgeHint: 'من صافي الربح إلى التغير في النقدية. بنود «أخرى» هي ما تظهره القوائم خارج البنود المقروءة (ضرائب، مخصصات، رأس مال عامل آخر، فروق عملة).',
      r: { net_income: 'صافي الربح', dna: '+ الإهلاك والاستهلاك', d_receivables: '− الزيادة في المدينين', d_inventory: '− الزيادة في المخزون', d_payables: '+ الزيادة في الدائنين',
        cfo_other: '± بنود تشغيلية أخرى', cfo: 'التدفق النقدي التشغيلي', cfo_est: 'تدفق تشغيلي تقديري (لا توجد قائمة تدفقات نقدية)', capex: '− الإنفاق الرأسمالي', cfi_other: '± استثمارات أخرى', cfi: 'التدفق النقدي الاستثماري',
        dividends: '− توزيعات الأرباح', net_borrowing: '± صافي الاقتراض (التغير في الديون)', cff_other: '± تمويل آخر', cff: 'التدفق النقدي التمويلي',
        change: 'التغير في النقدية (من التدفقات)', change_reported: 'التغير في النقدية (من الميزانية)', fcff: 'التدفق النقدي الحر للشركة', fcfe: 'التدفق النقدي الحر للمساهمين' },
      su: 'مصادر واستخدامات النقدية', sources: 'المصادر', uses: 'الاستخدامات',
      suItem: { cfo: 'التشغيل', capex: 'الإنفاق الرأسمالي', cfi_other: 'استثمارات أخرى', dividends: 'التوزيعات', net_borrowing: 'الاقتراض (صافي)', cff_other: 'تمويل آخر', cash_used: 'رصيد النقدية', other: 'أخرى / غير مفسرة' },
      be: 'نقطة التعادل والرافعة التشغيلية', beHint: 'تُعامل تكلفة المبيعات كمتغيرة والمصروفات التشغيلية الأخرى كثابتة؛ عدّل النسب لتناسب نشاطك. تُستنتج التكاليف الثابتة بحيث يطابق النموذج الربح التشغيلي المعلن.',
      cogsVar: 'الجزء المتغير من تكلفة المبيعات', opexVar: 'الجزء المتغير من المصروفات التشغيلية', target: 'الربح التشغيلي المستهدف',
      cm: 'هامش المساهمة', cmr: 'نسبة هامش المساهمة', variable: 'التكاليف المتغيرة', fixed: 'التكاليف الثابتة (شاملة الإهلاك)', beRevenue: 'إيرادات التعادل', cashBe: 'إيرادات التعادل النقدي (دون الإهلاك)',
      mos: 'هامش الأمان', targetRevenue: 'الإيرادات اللازمة للربح المستهدف', dol: 'الرافعة التشغيلية (DOL)', dfl: 'الرافعة المالية (DFL)', dcl: 'الرافعة المركبة (DCL)',
      highLow: (lo, hi) => `طريقة الحد الأعلى والأدنى (${lo} ← ${hi})`, rate: 'التكلفة المتغيرة لكل 1 إيراد', hlNote: 'غير صالحة: لم تتحرك التكاليف مع الإيرادات بطريقة تقرؤها الطريقة.',
      cvp: 'التكلفة والحجم والربح', revenueLine: 'الإيرادات', costLine: 'إجمالي التكلفة',
      mean: {
        mos: v => `يمكن أن تنخفض المبيعات بنسبة ${v} قبل أن تتوقف الشركة عن تحقيق ربح تشغيلي.`,
        mosNeg: v => `المبيعات أقل من نقطة التعادل بنسبة ${v}: لا يغطي النشاط تكاليفه الثابتة عند هذا الحجم.`,
        dol: v => `تغير المبيعات بنسبة 1% يحرك الربح التشغيلي بحوالي ${v}%.`,
        dcl: v => `تغير المبيعات بنسبة 1% يحرك الربح قبل الضريبة بحوالي ${v}%.`,
      },
      missing: list => `تحتاج نقطة التعادل إلى ${list} لآخر سنة.`,
      none: 'يحتاج إلى سنتين على الأقل من القوائم.',
      cfr: 'نسب التدفقات النقدية',
    },
  };

  /** Display-ready tables for the tab, the Full analysis and the exports. */
  function cashModel(R) {
    const { A, lang } = R, ds = A.ds, L = UIC[lang], money = v => CFO.fmtNum(v, 0, lang), pct = v => CFO.fmtPct(v, lang), x = v => CFO.fmtVal('x', v, lang);
    const rec = reconcile(ds);
    const m = { title: L.title };
    m.recon = { head: [L.recon, CFO.UI[lang].period, L.left, L.right, L.diff, ''], text: 2, items: rec,
      rows: rec.map(c => [L.check[c.id], c.period, money(c.left), money(c.right), money(c.diff), c.ok ? L.ok : L.off]) };
    const br = cashBridge(ds);
    const keys = Object.keys(L.r).filter(k => br.some(b => nn(b.rows[k])));
    const SUB = new Set(['cfo', 'cfi', 'cff', 'change', 'fcff', 'fcfe']);
    m.bridge = br.length ? { head: ['', ...br.map(b => b.period)], sub: keys.map(k => SUB.has(k)), rows: keys.map(k => [L.r[k], ...br.map(b => money(b.rows[k]))]) } : null;
    m.su = sourcesUses(ds).map(s => {
      const n = Math.max(s.sources.length, s.uses.length);
      return { period: s.period, head: [L.sources, '', L.uses, ''], text: 1,
        rows: [...Array.from({ length: n }, (_, i) => [s.sources[i] ? L.suItem[s.sources[i][0]] : '', s.sources[i] ? money(s.sources[i][1]) : '', s.uses[i] ? L.suItem[s.uses[i][0]] : '', s.uses[i] ? money(s.uses[i][1]) : '']),
          ['', money(s.total), '', money(s.total)]], sub: [...Array(n).fill(false), true] };
    });
    const ids = CFO.RATIOS.filter(r => r.group === 'cashflow').map(r => r.id);
    m.ratios = { head: [CFO.UI[lang].item, ...ds.periods], rows: ids.filter(id => ds.periods.some(p => A.ratios[id][p].value != null))
      .map(id => [CFO.ratioName(id, lang), ...ds.periods.map(p => CFO.fmtVal(CFO.RATIO[id].unit, A.ratios[id][p].value, lang))]) };
    const be = breakEven(ds, R.be || {});
    if (be.missing) m.beMissing = L.missing(be.missing.map(k => CFO.itemName(k, lang)).join(lang === 'ar' ? '، ' : ', '));
    else {
      m.beData = be;
      const beRows = [[CFO.itemName('revenue', lang), money(be.revenue)], [L.variable, money(be.variable)], [L.cm, money(be.cm), 1], [L.cmr, pct(be.cmr)],
        [L.fixed, money(be.fixed)], [CFO.itemName('operating_income', lang), money(be.ebit)], [L.beRevenue, money(be.beRevenue), 1], [L.cashBe, money(be.cashBe)], [L.mos, pct(be.mos), 1],
        ...(nn(be.targetRevenue) ? [[L.targetRevenue, money(be.targetRevenue), 1]] : []), [L.dol, x(be.dol)], [L.dfl, x(be.dfl)], [L.dcl, x(be.dcl)]];
      m.be = { head: [L.be, be.period], rows: beRows.map(r => r.slice(0, 2)), sub: beRows.map(r => !!r[2]) };
      m.beMeaning = [nn(be.mos) ? (be.mos >= 0 ? L.mean.mos(pct(be.mos)) : L.mean.mosNeg(pct(-be.mos))) : null,
        nn(be.dol) ? L.mean.dol(CFO.fmtNum(be.dol, 1, lang)) : null, nn(be.dcl) ? L.mean.dcl(CFO.fmtNum(be.dcl, 1, lang)) : null].filter(Boolean);
      if (be.highLow) m.highLow = { title: L.highLow(be.highLow.lo, be.highLow.hi), usable: be.highLow.usable, note: L.hlNote,
        rows: [[L.rate, pct(be.highLow.rate)], [L.fixed, money(be.highLow.fixed)], [L.beRevenue, money(be.highLow.beRevenue)]] };
      if (nn(be.beRevenue) && be.cmr > 0) {
        const top = Math.max(be.revenue, be.beRevenue) * 1.4, steps = [0, 0.2, 0.4, 0.6, 0.8, 1].map(f => f * top);
        m.cvp = { title: L.cvp, kind: 'line', labels: steps.map(v => CFO.fmtNum(v, 0, lang)), fmt: money,
          series: [{ name: L.revenueLine, values: steps, color: 'var(--s1)' }, { name: L.costLine, values: steps.map(s => be.fixed + s * (1 - be.cmr)), color: 'var(--s3)' }] };
      }
    }
    return m;
  }

  for (const lang of ['en', 'ar']) if (CFO.UI?.[lang]) CFO.UI[lang].cf = UIC[lang];
  CFO.reconcile = reconcile;
  CFO.cashBridge = cashBridge;
  CFO.sourcesUses = sourcesUses;
  CFO.breakEven = breakEven;
  CFO.cashModel = cashModel;
})(globalThis.CFO = globalThis.CFO || {});
