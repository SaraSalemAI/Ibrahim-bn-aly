// Run: node --test cfo-dashboard/tests/variance.test.mjs   (no install needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';

globalThis.Papa = createRequire(import.meta.url)('papaparse');

const dir = fileURLToPath(new URL('../js/', import.meta.url));
for (const f of ['catalog', 'parsers', 'mapper', 'analysis', 'benchmarks', 'i18n', 'insights', 'sample', 'forecast', 'valuation', 'cashflow', 'peers', 'variance', 'charts', 'report', 'ai']) {
  vm.runInThisContext(readFileSync(dir + f + '.js', 'utf8'), { filename: f + '.js' });
}
const CFO = globalThis.CFO;
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${msg || ''} ${a} ≠ ${b}`);
const ds = CFO.buildDataset(CFO.sampleTables()), A = CFO.analyze(ds), F = CFO.flags(A);
const enc = t => new TextEncoder().encode(t);
// A budget in the same layout, with a "Budget 2024" column header.
const budgetCsv = 'Line item,Budget 2024\nRevenue,"65,000"\nCost of sales,"(40,000)"\nGross profit,"25,000"\nSelling and administrative expenses,"(15,500)"\nDepreciation,"(2,500)"\nOperating profit,"7,000"\nFinance costs,"(2,000)"\nProfit before tax,"5,000"\nIncome tax,"(1,100)"\nNet profit,"3,900"\n';
const budget = CFO.buildDataset(CFO.csvTables(enc(budgetCsv), 'budget.csv'));

test('the budget is read by the same reader and matched to the actual year', () => {
  assert.deepEqual(budget.periods, ['2024']);
  assert.equal(budget.data['2024'].revenue, 65000);
  assert.equal(budget.data['2024'].opex, 15500, 'costs stored positive');
  const v = CFO.variance(ds, budget);
  assert.equal(v.mode, 'budget'); assert.equal(v.actual, '2024'); assert.equal(v.plan, '2024');
});

test('variances have the right sign: revenue below plan and costs above plan are adverse', () => {
  const v = CFO.variance(ds, budget), row = k => v.rows.find(r => r.key === k);
  const a = ds.data['2024'];
  close(row('revenue').diff, a.revenue - 65000); assert.equal(row('revenue').fav, false);
  close(row('revenue').pct, (a.revenue - 65000) / 65000);
  assert.equal(row('cogs').fav, a.cogs < 40000, 'lower cost of sales is favourable');
  assert.equal(row('net_income').fav, a.net_income > 3900);
});

test('the net income walk explains the whole gap', () => {
  const { walk } = CFO.variance(ds, budget), a = ds.data['2024'];
  close(walk.steps.reduce((t, [, x]) => t + x, 0), walk.end - walk.start);
  const vol = walk.steps.find(([k]) => k === 'volume')[1], mar = walk.steps.find(([k]) => k === 'margin')[1];
  close(vol + mar, a.gross_profit - 25000, 'volume + margin = gross profit variance');
  close(vol, (a.revenue - 65000) * (25000 / 65000));
});

test('without a budget the latest year is compared with the prior year', () => {
  const v = CFO.variance(ds, null);
  assert.equal(v.mode, 'prior'); assert.equal(v.plan, '2023');
  close(v.rows.find(r => r.key === 'revenue').diff, 3000);
});

test('adverse variances reach the action plan and every report format', () => {
  const plan = CFO.actionPlan(A, F, null, 'en', { budget });
  assert.ok(plan.some(it => it.title.startsWith('Adverse variance')));
  for (const lang of ['en', 'ar']) {
    const R = { A, F, S: null, lang, ai: '', budget }, html = CFO.fullHTML(R), md = CFO.reportMarkdown(R);
    assert.ok(html.includes(CFO.esc(CFO.UI[lang].secVariance)) && md.includes(CFO.UI[lang].secVariance));
    assert.ok(!/NaN|undefined|Infinity/.test(html + md));
  }
});

test('review cases: quarterly budget, year mismatch, budget equal to actuals, tax credit', () => {
  const q = CFO.buildDataset(CFO.csvTables(enc('Line item,Q1,Q2,Q3,Q4\nRevenue,"15,000","16,000","17,000","17,000"\nNet profit,900,1000,1000,1000\n'), 'q.csv'));
  const v = CFO.variance(ds, q);
  assert.equal(v.rows.find(r => r.key === 'revenue').plan, 65000, 'quarters are added up');
  const m = CFO.varianceModel({ A, lang: 'en', budget: q });
  assert.ok(m.table.head[2].includes('4 columns'));
  const y = CFO.buildDataset(CFO.csvTables(enc('Line item,2030\nRevenue,"90,000"\nNet profit,"5,000"\n'), 'y.csv'));
  assert.ok(CFO.varianceModel({ A, lang: 'en', budget: y }).warnings[0].includes('2030'));
  const same = CFO.buildDataset(CFO.csvTables(enc('Line item,2024\nRevenue,"61,000"\nNet profit,"1,488"\n'), 's.csv'));
  assert.ok(CFO.varianceModel({ A, lang: 'ar', budget: same }).warnings.length === 1);
  // A loss with a tax credit: −100 before tax, +20 credit, −80 after tax.
  const loss = { periods: ['2024'], data: { 2024: { pretax_income: -100, tax: 20, net_income: -80 } }, derived: { 2024: new Set() }, lines: [], issues: [], sources: ['t'] };
  assert.ok(CFO.reconcile(loss).find(c => c.id === 'profit').ok);
});

test('review cases: no cash-flow statement, zero revenue, operating loss, blank peer revenue', () => {
  const isBs = CFO.buildDataset(CFO.sampleTables().filter(t => !/cash/i.test(t.source)));
  const [b] = CFO.cashBridge(isBs);
  assert.equal(b.rows.cfo, null); assert.ok(b.rows.cfo_est != null, 'estimate kept apart');
  assert.equal(CFO.sourcesUses(isBs).length, 0, 'no sources and uses without a cash-flow statement');
  const zero = { periods: ['2024'], data: { 2024: { revenue: 0, operating_income: -5 } }, derived: { 2024: new Set() }, lines: [], issues: [], sources: ['t'] };
  assert.deepEqual(CFO.breakEven(zero).missing, ['revenue']);
  const lossy = { periods: ['2024'], data: { 2024: { revenue: 100, cogs: 60, operating_income: -10, interest: 5 } }, derived: { 2024: new Set() }, lines: [], issues: [], sources: ['t'] };
  const be = CFO.breakEven(lossy); assert.equal(be.dol, null); assert.equal(be.dcl, null); assert.ok(be.mos < 0);
  const rows = CFO.comparePeers(CFO.companyFigures(ds), [{ name: 'X', revenue: null, revenue_prev: 100 }]);
  assert.equal(rows.find(r => r.id === 'revenue_growth')?.peers[0] ?? null, null);
});
