// Run: node --test cfo-dashboard/tests/valuation.test.mjs   (no install needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = fileURLToPath(new URL('../js/', import.meta.url));
for (const f of ['catalog', 'parsers', 'mapper', 'analysis', 'benchmarks', 'i18n', 'insights', 'sample', 'forecast', 'valuation', 'cashflow', 'peers', 'charts', 'report', 'ai']) {
  vm.runInThisContext(readFileSync(dir + f + '.js', 'utf8'), { filename: f + '.js' });
}
const CFO = globalThis.CFO;
const close = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg || ''} ${a} ≠ ${b}`);

// A small company with round numbers, two years.
const y23 = { revenue: 1000, cogs: 600, gross_profit: 400, opex: 200, dna: 50, operating_income: 150, interest: 20, pretax_income: 130, tax: 30, net_income: 100,
  cash: 100, receivables: 150, inventory: 120, current_assets: 400, ppe: 500, total_assets: 900, payables: 80, short_debt: 50, current_liabilities: 200,
  long_debt: 250, total_liabilities: 450, equity: 450, retained_earnings: 300, cfo: 140, capex: 60, dividends: 40 };
const y24 = { revenue: 1100, cogs: 660, gross_profit: 440, opex: 210, dna: 55, operating_income: 175, interest: 22, pretax_income: 153, tax: 33, net_income: 120,
  cash: 120, receivables: 160, inventory: 130, current_assets: 440, ppe: 520, total_assets: 960, payables: 90, short_debt: 40, current_liabilities: 210,
  long_debt: 240, total_liabilities: 450, equity: 510, retained_earnings: 380, cfo: 160, capex: 70, dividends: 40 };
const ds = { periods: ['2023', '2024'], data: { 2023: y23, 2024: y24 }, derived: { 2023: new Set(), 2024: new Set() }, lines: [], issues: [], sources: ['test'] };
const A = CFO.analyze(ds), F = CFO.flags(A);
const r = id => A.ratios[id]['2024'].value;

test('the added ratios match hand calculations', () => {
  close(r('revenue_growth'), 0.1);
  close(r('net_income_growth'), 0.2);
  const t = 33 / 153, nopat = 175 * (1 - t);
  close(r('nopat_margin'), nopat / 1100);
  close(r('roic'), nopat / ((300 + 450 + 280 + 510) / 2), 1e-9, 'ROIC on average debt + equity');
  close(r('debt_to_capital'), 280 / 790);
  close(r('debt_to_assets'), 280 / 960);
  close(r('equity_ratio'), 510 / 960);
  close(r('receivables_turnover'), 1100 / 155);
  close(r('inventory_turnover'), 660 / 125);
  close(r('payables_turnover'), 660 / 85);
  close(r('debt_to_ebitda'), 280 / 230);
  close(r('cfo_to_debt'), 160 / 280);
  close(r('cfo_margin'), 160 / 1100);
  close(r('capex_to_cfo'), 70 / 160);
  close(r('fcf_to_net_income'), 90 / 120);
  close(r('sustainable_growth'), (120 / 480) * (1 - 40 / 120));
  close(r('accruals_ratio'), (120 - 160) / 930);
  close(r('defensive_interval'), (120 + 160) / ((660 + 210) / 365));
  close(r('piotroski_f'), 7.9, 1e-9, '7 of 8 tests that can run, scaled to 9');
  assert.equal(A.ratios.revenue_growth['2023'].value, null, 'no growth without a prior year');
  const dp = A.dupont[1];
  close(dp.tax_burden * dp.interest_burden * dp.ebit_margin * dp.asset_turnover * dp.equity_multiplier, dp.roe, 1e-9, '5-step DuPont multiplies to ROE');
});

test('every ratio has a name and a meaning in both languages', () => {
  for (const def of CFO.RATIOS) for (const lang of ['en', 'ar']) {
    assert.notEqual(CFO.ratioName(def.id, lang), def.id, `${def.id} ${lang}`);
    const v = A.ratios[def.id]['2024'].value;
    if (v != null) assert.ok(CFO.meaning(def.id, v, lang).length > 10, `${def.id} meaning ${lang}`);
  }
  for (const g of CFO.GROUPS) assert.ok(CFO.UI.en.groups[g] && CFO.UI.ar.groups[g], g);
});

test('DCF arithmetic: WACC, discounting, terminal value and the bridge to equity', () => {
  const inp = { rf: 0.04, erp: 0.06, beta: 1.2, kd: 0.08, tax: 0.2, wd: 0.3, g: 0.02, years: 5 };
  const V = CFO.valuation(ds, null, inp);
  const ke = 0.04 + 1.2 * 0.06, w = 0.3 * 0.08 * 0.8 + 0.7 * ke;
  close(V.ke, ke); close(V.wacc, w);
  assert.equal(V.rows.length, 5);
  close(V.rows[4].growth, 0.02, 1e-12, 'growth fades to the terminal rate');
  for (const [i, row] of V.rows.entries()) {
    close(row.nopat, row.ebit * 0.8);
    close(row.fcff, row.nopat + row.dna - row.capex - row.dNwc);
    close(row.df, 1 / Math.pow(1 + w, i + 1));
  }
  const last = V.rows[4];
  close(V.tv, last.nopat * 1.02 * (1 - 0.02 / V.ronic) / (w - 0.02));
  close(V.ev, V.rows.reduce((t, x) => t + x.fcff * x.df, 0) + V.tv * last.df);
  close(V.netDebt, 280 - 120);
  close(V.equity, V.ev - 160);
  assert.ok(V.ronic >= w, 'return on new investment is at least WACC');
  close(V.sens.grid[2][2], V.equity, 1e-9, 'the centre of the grid is the base case');
  for (const row of V.sens.grid) for (let j = 1; j < row.length; j++) assert.ok(row[j] >= row[j - 1] - 1e-6, 'higher growth never lowers value here');
  for (let j = 0; j < 5; j++) for (let i = 1; i < 5; i++) assert.ok(V.sens.grid[i][j] < V.sens.grid[i - 1][j], 'higher WACC lowers value');
  const eva24 = V.eva[1];
  close(eva24.eva, eva24.nopat - w * 750, 1e-9, 'EVA on opening invested capital');
  const withShares = CFO.valuation(ds, null, { ...inp, shares: 100, price: 5 });
  close(withShares.perShare, withShares.equity / 100);
  close(withShares.upside, withShares.perShare / 5 - 1);
});

test('the DCF refuses WACC at or below terminal growth, and explains missing data', () => {
  const V = CFO.valuation(ds, null, { rf: 0.01, erp: 0.01, beta: 1, kd: 0.02, tax: 0.2, wd: 0.5, g: 0.03, years: 5 });
  assert.equal(V.error, 'waccLeG');
  assert.equal(V.ev, undefined);
  const m = CFO.valuationModel({ A, F, lang: 'en', dcf: V.inputs });
  assert.ok(m.warnings[0].includes('WACC'));
  const isOnly = { ...ds, data: { 2023: { revenue: 1000, net_income: 100 }, 2024: { revenue: 1100, net_income: 120 } } };
  const miss = CFO.valuation(isOnly, null, null);
  assert.ok(miss.missing.includes('total_assets'));
  const mm = CFO.valuationModel({ A: CFO.analyze(isOnly), F: [], lang: 'ar' });
  assert.ok(/يحتاج التقييم/.test(mm.missing));
});

test('review cases: no debt lines, missing gross profit, zero WACC, negative equity', () => {
  const noDebt = JSON.parse(JSON.stringify(ds.data));
  for (const y of Object.values(noDebt)) { delete y.short_debt; delete y.long_debt; }
  const dn = { ...ds, data: noDebt }, An = CFO.analyze(dn);
  const nop = 175 * (1 - 33 / 153);
  close(An.ratios.roic['2024'].value, nop / ((450 + 510) / 2), 1e-9, 'debt-free ROIC');
  assert.ok(CFO.valuation(dn, null, null).eva.every(e => e.eva != null));
  const noGp = JSON.parse(JSON.stringify(ds.data));
  for (const y of Object.values(noGp)) delete y.gross_profit;
  assert.equal(CFO.piotroskiSignals(noGp['2024'], noGp['2023'])[7], null, 'missing gross profit cannot run the test');
  const z = CFO.valuation(ds, null, { rf: 0, erp: 0, beta: 0, kd: 0, tax: 0.2, wd: 0.5, g: -0.01, years: 5 });
  assert.equal(z.error, 'waccLeG');
  const neg = JSON.parse(JSON.stringify(ds.data)); neg['2024'].equity = -200; neg['2023'].equity = -100;
  assert.equal(CFO.analyze({ ...ds, data: neg }).ratios.roic['2024'].value, null, 'no ROIC on negative equity');
  const V = CFO.valuation(ds, null, null);
  const w1 = CFO.valuation(ds, null, { ...V.inputs, rf: V.inputs.rf + 0.01 / (1 - V.inputs.wd) });
  close(V.sens.grid[4][2], w1.equity, 1e-6, 'off-centre grid cell equals a direct re-valuation');
});

test('value levers are ranked by the equity value they add', () => {
  const V = CFO.valuation(ds, null, null), L = CFO.valueLevers(ds, V);
  assert.ok(L.length >= 4);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].impact <= L[i - 1].impact);
  assert.ok(L.every(l => l.impact > 0));
  const dsoLever = L.find(l => l.id === 'dso');
  assert.equal(dsoLever.to, dsoLever.from - 10);
});

test('the action plan orders every recommendation by urgency, with owner, KPI and target', () => {
  const sample = CFO.buildDataset(CFO.sampleTables()), SA = CFO.analyze(sample), SF = CFO.flags(SA);
  for (const lang of ['en', 'ar']) {
    const plan = CFO.actionPlan(SA, SF, CFO.valuation(sample, null, null), lang);
    assert.ok(plan.length >= SF.length, 'every red flag becomes an action');
    const order = { high: 0, med: 1, low: 2 };
    for (let i = 1; i < plan.length; i++) assert.ok(order[plan[i].sev] >= order[plan[i - 1].sev]);
    for (const it of plan) assert.ok(it.horizon && it.areaText && it.action && it.kpi, JSON.stringify(it));
    assert.ok(plan.some(it => it.title === CFO.UI[lang].val.roicTitle), 'ROIC below WACC is raised');
  }
});

test('the report carries the valuation and the plan in every format', () => {
  const sample = CFO.buildDataset(CFO.sampleTables()), SA = CFO.analyze(sample), SF = CFO.flags(SA);
  const S = CFO.runScenarios(sample, CFO.defaultDrivers(sample), 3);
  for (const lang of ['en', 'ar']) {
    const R = { A: SA, F: SF, S, lang, ai: '' }, L = CFO.UI[lang];
    const html = CFO.fullHTML(R), md = CFO.reportMarkdown(R);
    for (const t of [L.secValuation, L.secPlan, L.val.levers, L.val.evaTitle, L.val.sens, L.dupont5]) {
      assert.ok(html.includes(CFO.esc(t)), `HTML: ${t}`);
      assert.ok(md.includes(t), `Markdown: ${t}`);
    }
    assert.ok(!/NaN|undefined|Infinity/.test(html + md));
    const m = CFO.reportModel(R);
    assert.ok(m.val.bridge && m.val.sens.rows.length === 5 && m.val.scen.rows[0].length === 4);
  }
});
