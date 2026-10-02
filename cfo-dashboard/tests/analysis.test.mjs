// Run: node --test cfo-dashboard/tests/
// Loads the browser scripts into a shared global, the same way index.html does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = fileURLToPath(new URL('../js/', import.meta.url));
for (const f of ['catalog', 'parsers', 'mapper', 'analysis', 'i18n', 'insights', 'sample']) {
  vm.runInThisContext(readFileSync(dir + f + '.js', 'utf8'), { filename: f + '.js' });
}
const CFO = globalThis.CFO;
const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

const ds = CFO.buildDataset(CFO.sampleTables());
const A = CFO.analyze(ds);
const r = id => A.ratios[id]['2024'].value;

test('sample merges three statements into one dataset', () => {
  assert.deepEqual(ds.periods, ['2022', '2023', '2024']);
  assert.equal(ds.data['2024'].revenue, 61000);
  assert.equal(ds.data['2024'].cogs, 39650, 'expense stored as positive');
  assert.equal(ds.data['2024'].capex, 5100);
  assert.equal(ds.issues.filter(i => i.type === 'unbalanced').length, 0);
});

test('liquidity ratios', () => {
  close(r('current_ratio'), 30300 / 21500);
  close(r('quick_ratio'), (30300 - 11200) / 21500);
  close(r('cash_ratio'), 2100 / 21500);
  assert.equal(r('working_capital'), 8800);
});

test('profitability ratios use average balances when the prior year exists', () => {
  close(r('gross_margin'), 21350 / 61000);
  close(r('ebitda_margin'), (4720 + 2600) / 61000);
  close(r('roa'), 1488 / ((58700 + 65800) / 2));
  close(r('roe'), 1488 / ((29200 + 27800) / 2));
  close(r('roce'), 4720 / (65800 - 21500));
  close(A.ratios.roa['2022'].value, 4495 / 52000, 1e-6); // first year: closing balance
});

test('efficiency and cash cycle', () => {
  const dso = (11500 + 15800) / 2 / 61000 * 365, dio = (8900 + 11200) / 2 / 39650 * 365, dpo = (6200 + 8900) / 2 / 39650 * 365;
  close(r('dso'), dso); close(r('dio'), dio); close(r('dpo'), dpo); close(r('ccc'), dso + dio - dpo);
});

test('leverage, cash flow and Altman Z\'\'', () => {
  close(r('debt_to_equity'), 26500 / 27800);
  close(r('interest_coverage'), 4720 / 2800);
  close(r('net_debt_to_ebitda'), (26500 - 2100) / 7320);
  assert.equal(r('fcf'), 388 - 5100);
  close(r('cash_conversion'), 388 / 1488);
  close(r('payout_ratio'), 2888 / 1488);
  const z = 6.56 * 8800 / 65800 + 3.26 * 12800 / 65800 + 6.72 * 4720 / 65800 + 1.05 * 27800 / 38000;
  close(r('altman_z'), z);
});

test('DuPont product equals ROE on closing balances', () => {
  const d = A.dupont.at(-1);
  close(d.roe, 1488 / 27800);
});

test('vertical and horizontal analysis', () => {
  const v = A.vertical.find(x => x.key === 'cogs');
  close(v.pct['2024'], 39650 / 61000);
  const vb = A.vertical.find(x => x.key === 'receivables');
  close(vb.pct['2024'], 15800 / 65800);
  const h = A.horizontal.find(x => x.key === 'revenue');
  close(h.yoy['2024'].pct, 3000 / 58000);
  close(h.idx['2024'], 122);
  close(h.cagr, Math.sqrt(61000 / 50000) - 1);
  assert.ok(A.horizontal.some(x => x.label === 'Share capital'), 'unmapped lines are kept');
});

test('red flags fire on the sample weaknesses', () => {
  const ids = CFO.flags(A).map(f => f.id);
  for (const id of ['earnings_quality', 'receivables', 'margins', 'fcf_div', 'payout', 'interest']) assert.ok(ids.includes(id), `missing flag ${id}`);
  assert.ok(!ids.includes('neg_equity') && !ids.includes('loss'));
  const f = CFO.flags(A)[0];
  assert.equal(f.sev, 'high');
  assert.ok(f.ev('en').length && f.ev('ar').length && f.rec.ar.length);
});

test('number and period parsing', () => {
  assert.equal(CFO.parseNumber('(1,200)'), -1200);
  assert.equal(CFO.parseNumber('١٬٢٣٤'), 1234);
  assert.equal(CFO.parseNumber('EGP 5,000'), 5000);
  assert.equal(CFO.parseNumber('-'), 0);
  assert.equal(CFO.parseNumber('abc'), null);
  assert.equal(CFO.parsePeriod('FY2024'), '2024');
  assert.equal(CFO.parsePeriod('31/12/2023'), '2023');
  assert.equal(CFO.parsePeriod('٢٠٢٢'), '2022');
});

test('Arabic labels map and multiple files with different years merge', () => {
  const t1 = { source: 'a.csv', ...CFO.rowsToLines([['البند', '2023'], ['الإيرادات', 100], ['صافي الربح', 10], ['إجمالي الأصول', 200], ['إجمالي حقوق الملكية', 120], ['إجمالي الالتزامات', 80]]) };
  const t2 = { source: 'b.csv', ...CFO.rowsToLines([['Item', 'FY2024'], ['Net sales', 130], ['Net profit', 13], ['Total assets', 260], ['Total equity', 150], ['Total liabilities', 100]]) };
  const d = CFO.buildDataset([t2, t1]);
  assert.deepEqual(d.periods, ['2023', '2024']);
  assert.equal(d.data['2023'].revenue, 100);
  assert.equal(d.data['2024'].revenue, 130);
  assert.ok(d.issues.some(i => i.type === 'unbalanced' && i.period === '2024'));
});

test('manual re-mapping overrides the automatic match', () => {
  const t = [{ source: 'x.csv', ...CFO.rowsToLines([['', '2024'], ['Turnover of goods', 500], ['Total assets', 1000]]) }];
  const auto = CFO.buildDataset(t);
  const line = auto.lines.find(l => l.label === 'Turnover of goods');
  const d = CFO.buildDataset(t, { [line.id]: 'cash' });
  assert.equal(d.data['2024'].cash, 500);
});

test('conflicting values across files are reported', () => {
  const a = { source: 'a.csv', ...CFO.rowsToLines([['', '2024'], ['Revenue', 100]]) };
  const b = { source: 'b.csv', ...CFO.rowsToLines([['', '2024'], ['Revenue', 140]]) };
  const d = CFO.buildDataset([a, b]);
  assert.equal(d.data['2024'].revenue, 100);
  assert.ok(d.issues.some(i => i.type === 'conflict'));
});
