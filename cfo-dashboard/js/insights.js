/* Red flags, strengths, recommendations and the executive summary.
 * Every flag carries the numbers that triggered it so a reviewer can verify it.
 */
(function (CFO) {
  const pct = (v, l) => CFO.fmtPct(v, l), x = (v, l) => CFO.fmtVal('x', v, l), num = (v, l) => CFO.fmtNum(v, 0, l);

  function growth(ds, key, i) {
    const p = ds.periods[i], q = ds.periods[i - 1];
    if (q == null) return null;
    const a = ds.data[q][key], b = ds.data[p][key];
    return a == null || b == null || a === 0 ? null : (b - a) / Math.abs(a);
  }

  /* Each rule: (ctx) => flag | null. ctx = { ds, R(id, i), d(i), i (latest index), g(key, i) } */
  const RULES = [
    ctx => {
      const cr = ctx.R('current_ratio'), qr = ctx.R('quick_ratio');
      if (cr != null && cr < 1) return {
        id: 'liquidity', sev: 'high',
        title: { en: 'Short-term liquidity squeeze', ar: 'ضغط على السيولة قصيرة الأجل' },
        ev: l => (l === 'en' ? `Current ratio ${x(cr, l)} (below 1.0)` : `نسبة التداول ${x(cr, l)} (أقل من 1.0)`) + (qr != null ? (l === 'en' ? `; quick ratio ${x(qr, l)}` : `؛ النسبة السريعة ${x(qr, l)}`) : ''),
        rec: { en: 'Build a 13-week cash forecast, negotiate longer supplier terms, and refinance short-term borrowings into long-term facilities.', ar: 'أعدّ توقعاً نقدياً لمدة 13 أسبوعاً، وتفاوض على آجال أطول مع الموردين، وأعد تمويل القروض قصيرة الأجل بتسهيلات طويلة الأجل.' } };
      if (qr != null && qr < 0.7) return {
        id: 'liquidity', sev: 'med',
        title: { en: 'Liquidity depends on selling inventory', ar: 'السيولة تعتمد على بيع المخزون' },
        ev: l => (l === 'en' ? `Quick ratio ${x(qr, l)} (below 0.7); current ratio ${x(cr, l)}` : `النسبة السريعة ${x(qr, l)} (أقل من 0.7)؛ نسبة التداول ${x(cr, l)}`),
        rec: { en: 'Reduce slow-moving stock and speed up collections so bills can be paid without relying on inventory sales.', ar: 'خفّض المخزون بطيء الحركة وسرّع التحصيل لسداد الالتزامات دون الاعتماد على بيع المخزون.' } };
      return null;
    },
    ctx => {
      const ic = ctx.R('interest_coverage');
      if (ic == null || ic >= 3) return null;
      return { id: 'interest', sev: ic < 1.5 ? 'high' : 'med',
        title: { en: 'Thin cover for interest payments', ar: 'تغطية ضعيفة لمدفوعات الفوائد' },
        ev: l => (l === 'en' ? `Interest coverage ${x(ic, l)} (comfort level ≥ 3.0); interest expense ${num(ctx.d().interest, l)}` : `تغطية الفوائد ${x(ic, l)} (المستوى المريح ≥ 3.0)؛ مصروف الفوائد ${num(ctx.d().interest, l)}`),
        rec: { en: 'Stop adding debt, repay or reprice the most expensive facilities, and check covenant headroom with lenders.', ar: 'أوقف الاقتراض الجديد، وسدد أو أعد تسعير أغلى التسهيلات، وراجع هامش التعهدات مع البنوك.' } };
    },
    ctx => {
      const de = ctx.R('debt_to_equity'), nd = ctx.R('net_debt_to_ebitda');
      if ((de == null || de <= 2) && (nd == null || nd <= 3)) return null;
      return { id: 'leverage', sev: (de > 2 || nd > 4) ? 'high' : 'med',
        title: { en: 'High debt load', ar: 'عبء ديون مرتفع' },
        ev: l => [de != null ? (l === 'en' ? `Debt/equity ${x(de, l)}` : `الديون/حقوق الملكية ${x(de, l)}`) : null, nd != null ? (l === 'en' ? `net debt/EBITDA ${x(nd, l)}` : `صافي الدين/EBITDA ${x(nd, l)}`) : null].filter(Boolean).join(l === 'en' ? '; ' : '؛ '),
        rec: { en: 'Set a deleveraging target (e.g. net debt/EBITDA below 2.5×) funded from free cash flow, asset sales or new equity.', ar: 'حدد هدفاً لخفض الديون (مثلاً صافي الدين/EBITDA أقل من 2.5×) يُموّل من التدفق النقدي الحر أو بيع أصول أو زيادة رأس المال.' } };
    },
    ctx => {
      const e = ctx.d().equity;
      if (e == null || e > 0) return null;
      return { id: 'neg_equity', sev: 'high',
        title: { en: 'Negative equity', ar: 'حقوق ملكية سالبة' },
        ev: l => (l === 'en' ? `Total equity ${num(e, l)}: liabilities exceed assets` : `إجمالي حقوق الملكية ${num(e, l)}: الالتزامات تتجاوز الأصول`),
        rec: { en: 'Recapitalise (capital injection or debt-to-equity conversion) and check local company-law thresholds on accumulated losses.', ar: 'أعد الرسملة (ضخ رأس مال أو تحويل ديون لحقوق ملكية) وراجع حدود قانون الشركات بشأن الخسائر المتراكمة.' } };
    },
    ctx => {
      const ni = ctx.d().net_income;
      if (ni == null || ni >= 0) return null;
      return { id: 'loss', sev: 'high',
        title: { en: 'Net loss', ar: 'صافي خسارة' },
        ev: l => (l === 'en' ? `Net income ${num(ni, l)} in ${ctx.p()}` : `صافي الربح ${num(ni, l)} في ${ctx.p()}`),
        rec: { en: 'Split the loss into structural vs one-off items and prepare a break-even plan with cost and pricing actions.', ar: 'افصل الخسارة إلى بنود هيكلية وأخرى غير متكررة، وضع خطة للوصول لنقطة التعادل عبر التكاليف والتسعير.' } };
    },
    ctx => {
      // Earnings quality: operating cash flow persistently below profit.
      const idx = [ctx.i, ctx.i - 1].filter(k => k >= 0);
      const weak = idx.filter(k => { const d = ctx.d(k); return d.cfo != null && d.net_income > 0 && d.cfo < d.net_income; });
      if (!weak.length || (weak.length < 2 && idx.length >= 2 && ctx.d().cfo >= 0)) return null;
      const d = ctx.d();
      return { id: 'earnings_quality', sev: d.cfo < 0 && d.net_income > 0 ? 'high' : 'med',
        title: { en: 'Profits are not turning into cash', ar: 'الأرباح لا تتحول إلى نقد' },
        ev: l => weak.map(k => { const dk = ctx.d(k); return l === 'en' ? `${ctx.p(k)}: CFO ${num(dk.cfo, l)} vs net income ${num(dk.net_income, l)}` : `${ctx.p(k)}: التدفق التشغيلي ${num(dk.cfo, l)} مقابل صافي الربح ${num(dk.net_income, l)}`; }).join(l === 'en' ? '; ' : '؛ '),
        rec: { en: 'Review revenue recognition and working-capital build-up; tighten credit terms and collections.', ar: 'راجع سياسة الاعتراف بالإيراد وتراكم رأس المال العامل؛ شدد شروط الائتمان والتحصيل.' } };
    },
    ctx => {
      const ar = ctx.g('receivables'), rv = ctx.g('revenue');
      if (ar == null || rv == null || ar - rv <= 0.15) return null;
      return { id: 'receivables', sev: ar - rv > 0.3 ? 'high' : 'med',
        title: { en: 'Receivables growing much faster than sales', ar: 'الذمم المدينة تنمو أسرع بكثير من المبيعات' },
        ev: l => (l === 'en' ? `Receivables ${pct(ar, l)} vs revenue ${pct(rv, l)}; DSO ${CFO.fmtVal('days', ctx.R('dso'), l)}` : `الذمم المدينة ${pct(ar, l)} مقابل الإيرادات ${pct(rv, l)}؛ فترة التحصيل ${CFO.fmtVal('days', ctx.R('dso'), l)}`),
        rec: { en: 'Age the receivables, provision for doubtful accounts, stop credit to overdue customers, and consider factoring.', ar: 'أعدّ أعمار الديون، وكوّن مخصصاً للديون المشكوك فيها، وأوقف الائتمان للعملاء المتأخرين، وفكّر في التخصيم.' } };
    },
    ctx => {
      const inv = ctx.g('inventory'), cg = ctx.g('cogs');
      if (inv == null || cg == null || inv - cg <= 0.15) return null;
      return { id: 'inventory', sev: 'med',
        title: { en: 'Inventory building up', ar: 'تراكم المخزون' },
        ev: l => (l === 'en' ? `Inventory ${pct(inv, l)} vs cost of sales ${pct(cg, l)}; DIO ${CFO.fmtVal('days', ctx.R('dio'), l)}` : `المخزون ${pct(inv, l)} مقابل تكلفة المبيعات ${pct(cg, l)}؛ فترة المخزون ${CFO.fmtVal('days', ctx.R('dio'), l)}`),
        rec: { en: 'Identify slow-moving and obsolete stock, test for write-downs, and align purchasing with demand.', ar: 'حدد المخزون الراكد والمتقادم، واختبر الحاجة لتخفيض قيمته، واربط المشتريات بالطلب الفعلي.' } };
    },
    ctx => {
      if (ctx.i < 1) return null;
      const g0 = ctx.R('gross_margin', ctx.i - 1), g1 = ctx.R('gross_margin'), n0 = ctx.R('net_margin', ctx.i - 1), n1 = ctx.R('net_margin');
      const gDrop = g0 != null && g1 != null ? g0 - g1 : 0, nDrop = n0 != null && n1 != null ? n0 - n1 : 0;
      if (gDrop <= 0.03 && nDrop <= 0.03) return null;
      return { id: 'margins', sev: Math.max(gDrop, nDrop) > 0.06 ? 'high' : 'med',
        title: { en: 'Margin compression', ar: 'تآكل الهوامش' },
        ev: l => [gDrop > 0 ? (l === 'en' ? `Gross margin ${pct(g0, l)} → ${pct(g1, l)}` : `هامش مجمل الربح ${pct(g0, l)} ← ${pct(g1, l)}`) : null, nDrop > 0 ? (l === 'en' ? `net margin ${pct(n0, l)} → ${pct(n1, l)}` : `هامش صافي الربح ${pct(n0, l)} ← ${pct(n1, l)}`) : null].filter(Boolean).join(l === 'en' ? '; ' : '؛ '),
        rec: { en: 'Break down the change into price, volume, mix and input cost; review pricing and supplier contracts.', ar: 'حلّل التغير إلى سعر وكمية ومزيج منتجات وتكلفة مدخلات؛ وراجع التسعير وعقود الموردين.' } };
    },
    ctx => {
      const rv = ctx.g('revenue');
      if (rv == null || rv >= 0) return null;
      return { id: 'revenue', sev: rv < -0.1 ? 'high' : 'med',
        title: { en: 'Revenue decline', ar: 'تراجع الإيرادات' },
        ev: l => (l === 'en' ? `Revenue ${pct(rv, l)} year over year` : `الإيرادات ${pct(rv, l)} مقارنة بالعام السابق`),
        rec: { en: 'Analyse lost customers, products and regions; protect the core and resize the cost base to the new volume.', ar: 'حلّل العملاء والمنتجات والمناطق المفقودة؛ احمِ النشاط الأساسي وأعد ضبط هيكل التكاليف للحجم الجديد.' } };
    },
    ctx => {
      const d = CFO.enrich(ctx.d());
      if (d.fcf == null || d.fcf >= 0 || !(d.dividends > 0)) return null;
      return { id: 'fcf_div', sev: 'high',
        title: { en: 'Dividends paid while free cash flow is negative', ar: 'توزيع أرباح رغم تدفق نقدي حر سالب' },
        ev: l => (l === 'en' ? `Free cash flow ${num(d.fcf, l)}; dividends ${num(d.dividends, l)}` : `التدفق النقدي الحر ${num(d.fcf, l)}؛ التوزيعات ${num(d.dividends, l)}`),
        rec: { en: 'Link dividends to free cash flow; pause or cut the payout until FCF is positive. Dividends are currently funded by debt or cash reserves.', ar: 'اربط التوزيعات بالتدفق النقدي الحر؛ أوقفها أو خفّضها حتى يصبح موجباً. التوزيعات حالياً ممولة بالديون أو الاحتياطي النقدي.' } };
    },
    ctx => {
      const po = ctx.R('payout_ratio');
      if (po == null || po <= 1) return null;
      return { id: 'payout', sev: 'med',
        title: { en: 'Dividends exceed earnings', ar: 'التوزيعات تتجاوز الأرباح' },
        ev: l => (l === 'en' ? `Payout ratio ${pct(po, l)}` : `نسبة التوزيع ${pct(po, l)}`),
        rec: { en: 'Adopt a payout policy tied to sustainable earnings (for example 40–60% of net income).', ar: 'اعتمد سياسة توزيع مرتبطة بالأرباح المستدامة (مثلاً 40–60% من صافي الربح).' } };
    },
    ctx => {
      const z = ctx.R('altman_z');
      if (z == null || z > 2.6) return null;
      return { id: 'altman', sev: z < 1.1 ? 'high' : 'low',
        title: { en: z < 1.1 ? 'Altman Z\'\' in distress zone' : 'Altman Z\'\' in grey zone', ar: z < 1.1 ? 'مؤشر ألتمان في منطقة التعثر' : 'مؤشر ألتمان في المنطقة الرمادية' },
        ev: l => (l === 'en' ? `Z'' = ${CFO.fmtVal('score', z, l)} (safe > 2.6, distress < 1.1)` : `Z'' = ${CFO.fmtVal('score', z, l)} (آمن > 2.6، تعثر < 1.1)`),
        rec: { en: 'Prepare a contingency plan: liquidity headroom, covenant tests and a list of non-core assets that could be sold.', ar: 'جهّز خطة طوارئ: هامش سيولة، واختبارات التعهدات البنكية، وقائمة بأصول غير أساسية يمكن بيعها.' } };
    },
    ctx => {
      const cg = ctx.g('cash'), d = CFO.enrich(ctx.d());
      if (cg == null || cg > -0.3 || !(d.fcf < 0)) return null;
      return { id: 'cash_burn', sev: 'med',
        title: { en: 'Cash balance falling fast', ar: 'انخفاض سريع في رصيد النقدية' },
        ev: l => (l === 'en' ? `Cash ${pct(cg, l)} to ${num(d.cash, l)}; free cash flow ${num(d.fcf, l)}` : `النقدية ${pct(cg, l)} إلى ${num(d.cash, l)}؛ التدفق النقدي الحر ${num(d.fcf, l)}`),
        rec: { en: 'Set a minimum cash buffer, defer non-essential capex, and secure committed credit lines now.', ar: 'حدد حداً أدنى للنقدية، وأجّل الإنفاق الرأسمالي غير الضروري، واحصل على خطوط ائتمان ملتزمة الآن.' } };
    },
    ctx => {
      const d1 = CFO.enrich(ctx.d()), d0 = ctx.i > 0 ? CFO.enrich(ctx.d(ctx.i - 1)) : null, rv = ctx.g('revenue');
      if (!d0 || !d0.total_debt || d1.total_debt == null || rv == null) return null;
      const dg = (d1.total_debt - d0.total_debt) / d0.total_debt;
      if (dg - rv <= 0.2) return null;
      return { id: 'debt_growth', sev: 'med',
        title: { en: 'Borrowing growing faster than the business', ar: 'الاقتراض ينمو أسرع من النشاط' },
        ev: l => (l === 'en' ? `Total debt ${pct(dg, l)} vs revenue ${pct(rv, l)}` : `إجمالي الديون ${pct(dg, l)} مقابل الإيرادات ${pct(rv, l)}`),
        rec: { en: 'Check what the new debt funded (working capital, capex, dividends) and whether it earns more than its cost.', ar: 'تحقق مما موّله الدين الجديد (رأس مال عامل، استثمارات، توزيعات) وهل عائده أعلى من تكلفته.' } };
    },
    ctx => {
      const og = ctx.g('opex'), rv = ctx.g('revenue');
      if (og == null || rv == null || og - rv <= 0.05) return null;
      return { id: 'opex', sev: 'low',
        title: { en: 'Overheads growing faster than revenue', ar: 'المصروفات التشغيلية تنمو أسرع من الإيرادات' },
        ev: l => (l === 'en' ? `Operating expenses ${pct(og, l)} vs revenue ${pct(rv, l)}` : `المصروفات التشغيلية ${pct(og, l)} مقابل الإيرادات ${pct(rv, l)}`),
        rec: { en: 'Review headcount and discretionary spend; set opex as a % of revenue budget ceiling.', ar: 'راجع العمالة والمصروفات الاختيارية؛ وحدد سقفاً للمصروفات كنسبة من الإيرادات.' } };
    },
  ];

  /** Data-integrity issues that undermine the analysis itself become flags too. */
  function dataFlags(ds) {
    return ds.issues.filter(i => i.type === 'unbalanced').map(i => ({
      id: 'data_' + i.period, sev: 'high',
      title: { en: 'Balance sheet does not balance', ar: 'الميزانية غير متوازنة' },
      ev: l => (l === 'en' ? `${i.period}: difference ${num(i.gap, l)}` : `${i.period}: الفرق ${num(i.gap, l)}`),
      rec: { en: 'Check the source file for missing lines or wrong mappings before relying on any ratio.', ar: 'راجع الملف المصدر بحثاً عن بنود ناقصة أو ربط خاطئ قبل الاعتماد على أي نسبة.' } }));
  }

  function makeCtx(A) {
    const ds = A.ds, last = ds.periods.length - 1;
    return {
      ds, i: last,
      p: (k = last) => ds.periods[k],
      d: (k = last) => ds.data[ds.periods[k]] || {},
      R: (id, k = last) => A.ratios[id]?.[ds.periods[k]]?.value ?? null,
      g: (key, k = last) => growth(ds, key, k),
    };
  }

  const SEV_ORDER = { high: 0, med: 1, low: 2 };

  function flags(A) {
    if (!A.ds.periods.length) return [];
    const ctx = makeCtx(A);
    const out = [...dataFlags(A.ds)];
    for (const rule of RULES) { try { const f = rule(ctx); if (f) out.push(f); } catch (e) { /* a rule with missing data stays silent */ } }
    return out.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  }

  /** Ratios rated healthy in the latest year, best-known first. */
  function strengths(A, lang) {
    const keep = ['current_ratio', 'quick_ratio', 'gross_margin', 'operating_margin', 'net_margin', 'roe', 'roce', 'interest_coverage', 'debt_to_equity', 'cash_conversion', 'fcf', 'altman_z', 'ccc'];
    return keep.filter(id => A.ratios[id]?.[A.latest]?.status === 'good')
      .map(id => ({ id, text: `${CFO.ratioName(id, lang)} ${CFO.fmtVal(CFO.RATIO[id].unit, A.ratios[id][A.latest].value, lang)}: ${CFO.meaning(id, A.ratios[id][A.latest].value, lang)}` }));
  }

  /** Short narrative for the top of the report. */
  function summary(A, F, lang) {
    const ds = A.ds, p = A.latest, d = ds.data[p] || {}, en = lang === 'en';
    if (!p) return '';
    const parts = [];
    const rg = growth(ds, 'revenue', ds.periods.length - 1);
    const h = A.health;
    if (h?.score != null) parts.push(en ? `Overall financial health for ${p} scores ${h.score}/100 (grade ${h.grade}).` : `تحصل الصحة المالية لعام ${p} على ${h.score}/100 (تقدير ${h.grade}).`);
    if (d.revenue != null) parts.push(en
      ? `Revenue was ${num(d.revenue, lang)}${rg != null ? ` (${rg >= 0 ? 'up' : 'down'} ${pct(Math.abs(rg), lang)} on the prior year)` : ''}${d.net_income != null ? ` with net income of ${num(d.net_income, lang)} (net margin ${pct(A.ratios.net_margin[p].value, lang)})` : ''}.`
      : `بلغت الإيرادات ${num(d.revenue, lang)}${rg != null ? ` (${rg >= 0 ? 'بزيادة' : 'بانخفاض'} ${pct(Math.abs(rg), lang)} عن العام السابق)` : ''}${d.net_income != null ? ` وصافي ربح ${num(d.net_income, lang)} (هامش صافي ${pct(A.ratios.net_margin[p].value, lang)})` : ''}.`);
    const hi = F.filter(f => f.sev === 'high'), med = F.filter(f => f.sev === 'med');
    if (F.length) parts.push(en
      ? `The rules raised ${F.length} red flag${F.length > 1 ? 's' : ''} (${hi.length} high, ${med.length} medium). Most urgent: ${(hi[0] || F[0]).title.en.toLowerCase()}.`
      : `أطلقت القواعد ${F.length} إشارات خطر (${hi.length} مرتفعة، ${med.length} متوسطة). الأكثر إلحاحاً: ${(hi[0] || F[0]).title.ar}.`);
    else parts.push(en ? 'No red flags were raised by the rules.' : 'لم تُطلق القواعد أي إشارة خطر.');
    return parts.join(' ');
  }

  CFO.flags = flags;
  CFO.strengths = strengths;
  CFO.summary = summary;
})(globalThis.CFO = globalThis.CFO || {});
