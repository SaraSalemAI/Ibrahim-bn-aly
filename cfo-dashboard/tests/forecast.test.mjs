// Run: node --test cfo-dashboard/tests/forecast.test.mjs   (no install needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = fileURLToPath(new URL('../js/', import.meta.url));
for (const f of ['catalog', 'parsers', 'mapper', 'analysis', 'benchmarks', 'i18n', 'insights', 'sample', 'forecast']) {
  vm.runInThisContext(readFileSync(dir + f + '.js', 'utf8'), { filename: f + '.js' });
}
const CFO = globalThis.CFO;
const ds = CFO.buildDataset(CFO.sampleTables());
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('default drivers come from the company history', () => {
  const d = CFO.defaultDrivers(ds);
  near(d.growth, ((58000 - 50000) / 50000 + (61000 - 58000) / 58000) / 2);
  near(d.grossMargin, 21350 / 61000);
  assert.equal(d.dso, Math.round(15800 / 61000 * 365));
  near(d.taxRate, 432 / 1920);
  assert.equal(d.payout, 1, 'a payout above 100% of profit is capped at 100% as a starting assumption');
  assert.deepEqual(CFO.forecastMissing(ds), []);
});

test('projected balance sheets balance and cash rolls forward', () => {
  const years = CFO.project(ds, CFO.defaultDrivers(ds), 3);
  assert.deepEqual(years.map(y => y.period), ['2025F', '2026F', '2027F']);
  let cash = ds.data['2024'].cash;
  for (const { data: d, fundingNeed } of years) {
    near(d.total_assets, d.total_liabilities + d.equity);
    near(d.cash, Math.max(0, cash + d.cfo - d.capex + d.cff - fundingNeed));
    cash = d.cash;
  }
});

test('scenarios are ordered: upside > base > downside', () => {
  const S = CFO.runScenarios(ds, CFO.defaultDrivers(ds), 2);
  const ni = n => S[n].years[1].data.net_income;
  assert.ok(ni('upside') > ni('base') && ni('base') > ni('downside'));
  assert.ok(S.base.A.ratios.current_ratio['2026F'].value > 0, 'projected years go through the normal analysis');
  assert.ok(Array.isArray(S.downside.F));
});

test('a cash shortfall becomes funding required', () => {
  const d = { ...CFO.defaultDrivers(ds), capexPct: 0.4 };
  const y = CFO.project(ds, d, 1)[0];
  assert.ok(y.fundingNeed > 0);
  assert.equal(y.data.cash, 0);
  near(y.data.total_assets, y.data.total_liabilities + y.data.equity);
});

test('sector changes the rating of the same number', () => {
  const def = CFO.RATIO.gross_margin;
  const rate = (sector, v) => { CFO.setSector(sector); const b = CFO.bench('gross_margin'); return v >= b.good ? 'good' : v < b.bad ? 'bad' : 'warn'; };
  assert.equal(rate('retail', 0.31), 'good');
  assert.equal(rate('services', 0.31), 'warn');
  assert.equal(rate('services', 0.25), 'bad');
  CFO.setSector('services');
  const A = CFO.analyze(ds);
  assert.equal(A.ratios.gross_margin['2024'].status, 'warn', 'analysis uses the selected sector');
  assert.ok(CFO.flags(A).some(f => f.id === 'sector_margins'));
  CFO.setSector('general');
  assert.equal(CFO.analyze(ds).ratios.gross_margin['2024'].status, 'good');
  assert.equal(CFO.bench('dso', 'nonexistent').good, CFO.bench('dso', 'general').good, 'unknown sector falls back to general');
  assert.ok(def);
});

// Regressions found in code review.
test('heavy depreciation never makes PP&E negative or unbalances the forecast', () => {
  const years = CFO.project(ds, { ...CFO.defaultDrivers(ds), dnaPct: 0.2, capexPct: 0 }, 3);
  for (const { data: d } of years) { assert.ok(d.ppe >= 0); near(d.total_assets, d.total_liabilities + d.equity); }
});

test('missing revenue years and missing balances do not distort default drivers', () => {
  const t = [{ source: 'x', ...CFO.rowsToLines([['', '2022', '2023', '2024'], ['Revenue', 100, '', 121], ['Total assets', 200, 210, 220], ['Total equity', 100, 105, 110], ['Gross profit', 40, '', 48]]) }];
  const d = CFO.defaultDrivers(CFO.buildDataset(t));
  near(d.growth, 0.05);   // no two consecutive years both report revenue: the 5% default, not -100% for the gap
  assert.equal(d.dso, 45, 'missing receivables fall back to 45 days');
  near(d.grossMargin, 48 / 121);
});

test('typed drivers are kept in range so the upside stays above the base', () => {
  assert.equal(CFO.clampDriver('growth', 1.0), 0.6);
  assert.equal(CFO.clampDriver('dso', -5), 0);
  assert.equal(CFO.clampDriver('newDebt', -5000), -5000);
});
