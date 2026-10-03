/* CFO commentary by Claude, through the claude.ai viewer's `sample` capability.
 * Only computed figures are sent (ratios, trends, flags, forecast), never the uploaded files.
 * Outside a claude.ai viewer `window.claude` is absent and the feature stays hidden.
 */
(function (CFO) {
  const KEY = ['current_ratio', 'quick_ratio', 'gross_margin', 'operating_margin', 'net_margin', 'roe', 'roce', 'asset_turnover', 'dso', 'dio', 'ccc',
    'debt_to_equity', 'interest_coverage', 'net_debt_to_ebitda', 'fcf', 'cash_conversion', 'payout_ratio', 'altman_z'];
  const ITEMS = ['revenue', 'gross_profit', 'operating_income', 'net_income', 'cash', 'receivables', 'inventory', 'total_assets', 'total_liabilities', 'equity', 'cfo', 'capex', 'dividends'];
  const r3 = v => (v == null || !isFinite(v) ? null : Math.round(v * 1000) / 1000);

  /** Compact, language-neutral facts for the prompt. */
  function context(A, F, S) {
    const ds = A.ds, P = ds.periods;
    const facts = {
      sector: CFO.sectorName(CFO.getSector(), 'en'),
      periods: P,
      statements: Object.fromEntries(ITEMS.map(k => [k, P.map(p => ds.data[p][k] ?? null)]).filter(([, v]) => v.some(x => x != null))),
      ratios: Object.fromEntries(KEY.map(id => [id, {
        values: P.map(p => r3(A.ratios[id][p].value)), status: A.ratios[id][A.latest]?.status || null,
        sector_typical: CFO.bench ? CFO.bench(id).typical : null, formula: CFO.RATIO[id].f }]).filter(([, v]) => v.values.some(x => x != null))),
      health_score: A.health?.score ?? null,
      red_flags: F.map(f => ({ severity: f.sev, title: f.title.en, evidence: f.ev('en') })),
      data_issues: ds.issues.filter(i => i.type !== 'unmapped').map(i => i.type + (i.period ? ' ' + i.period : '')),
    };
    if (S) {
      facts.forecast = Object.fromEntries(Object.entries(S).map(([name, sc]) => [name, sc.years.map(y => ({
        period: y.period, revenue: Math.round(y.data.revenue), net_income: Math.round(y.data.net_income), cash: Math.round(y.data.cash),
        funding_required: Math.round(y.fundingNeed), current_ratio: r3(sc.A.ratios.current_ratio[y.period].value),
        debt_to_equity: r3(sc.A.ratios.debt_to_equity[y.period].value) }))]));
      facts.forecast_drivers_base = Object.fromEntries(Object.entries(S.base.drivers).map(([k, v]) => [k, r3(v)]));
    }
    return facts;
  }

  /** The full instruction; Claude sees nothing but this text. */
  function prompt(facts, lang, question) {
    const ar = lang === 'ar';
    const task = question
      ? `Answer this question from the company's management, using only the data below: "${question}"`
      : 'Write a CFO-level commentary on these financial statements for the board.';
    const sections = ar
      ? 'الملخص التنفيذي، نقاط القوة، المخاطر وإشارات الخطر، التوصيات مرتبة حسب الأولوية (مع المسؤول والإطار الزمني المقترح)، أسئلة للإدارة'
      : 'Executive summary, Strengths, Risks and red flags, Recommendations in priority order (with a suggested owner and timeframe), Questions for management';
    return [
      'You are an experienced CFO and financial analyst reviewing a company\'s financial statements.',
      task,
      `Write in ${ar ? 'Modern Standard Arabic' : 'English'}.`,
      question ? 'Be direct and concise; cite the figures you rely on.' : `Use these section headings, as Markdown "## " headings: ${sections}.`,
      'Rules: use only the figures provided; cite the actual numbers (amounts, ratios, years); say clearly when something cannot be judged from the data;',
      'sector typical values are indicative rules of thumb, not market statistics; the forecast is a driver-based model, not a prediction;',
      'ratios are decimals (0.35 = 35%), days are days, amounts are in the statements\' own currency unit. Use short paragraphs and "- " bullets; no tables.',
      '',
      'DATA (JSON):',
      JSON.stringify(facts),
    ].join('\n');
  }

  let samplePromise = null;
  /** The viewer's `sample` function, or null outside a claude.ai viewer. */
  function getSample() {
    if (!globalThis.claude?.use) return Promise.resolve(null);
    samplePromise = samplePromise || globalThis.claude.use('sample').catch(() => null);
    return samplePromise;
  }

  /** Ask Claude; streams through onText({ text }). Rejects with { code, message, text? }. */
  async function ask(A, F, S, lang, question, { onText, signal } = {}) {
    const sample = await getSample();
    if (!sample) throw { code: 'unavailable', message: 'sample unavailable' };
    const { text, truncated } = await sample(prompt(context(A, F, S), lang, question), { onText, signal, modelTier: 'default' });
    return { text, truncated };
  }

  /** Minimal, safe Markdown -> HTML (headings, bullets, bold); everything is escaped first. */
  function md(text) {
    const esc = CFO.esc;
    const out = []; let list = null;
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      const li = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (li) { if (!list) { list = []; } list.push(`<li>${inline(li[1])}</li>`); continue; }
      if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
      const h = line.match(/^#{1,4}\s+(.*)$/);
      if (h) out.push(`<h4>${inline(h[1])}</h4>`);
      else if (line) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`<ul>${list.join('')}</ul>`);
    return out.join('');
  }

  CFO.aiContext = context;
  CFO.aiPrompt = prompt;
  CFO.aiAvailable = () => getSample().then(Boolean);
  CFO.askClaude = ask;
  CFO.md = md;
})(globalThis.CFO = globalThis.CFO || {});
