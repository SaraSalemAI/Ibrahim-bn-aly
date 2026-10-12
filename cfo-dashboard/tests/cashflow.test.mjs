// Run: node --test cfo-dashboard/tests/cashflow.test.mjs   (no install needed)
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
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${msg || ''} ${a} ≠ ${b}`);

const y23 = { revenue: 1000, cogs: 600, gross_profit: 400, opex: 200, dna: 50, operating_income: 150, interest: 20, pretax_income: 130, tax: 30, net_income: 100,
  cash: 100, receivables: 150, inventory: 120, current_assets: 400, ppe: 500, total_assets: 900, payables: 80, short_debt: 50, current_liabilities: 200,
  long_debt: 250, total_liabilities: 450, equity: 450, cfo: 140, capex: 60, cfi: -60, cff: -40, dividends: 40 };
const y24 = { revenue: 1100, cogs: 660, gross_profit: 440, opex: 210, dna: 55, operating_income: 175, interest: 22, pretax_income: 153, tax: 33, net_income: 120,
  cash: 120, receivables: 160, inventory: 130, current_assets: 440, ppe: 520, total_assets: 960, payables: 90, short_debt: 40, current_liabilities: 210,
  long_debt: 240, total_liabilities: 450, equity: 510, cfo: 160, capex: 70, cfi: -70, cff: -70, dividends: 40 };
const mk = (a, b) => ({ periods: ['2023', '2024'], data: { 2023: a, 2024: b }, derived: { 2023: new Set(), 2024: new Set() }, lines: [], issues: [], sources: ['t'] });
const ds = mk(y23, y24);

test('statement checks tie the statements together and show each difference', () => {
  const rec = CFO.reconcile(ds);
  assert.ok(rec.filter(c => c.id === 'balance').every(c => c.ok));
  const cash = rec.find(c => c.id === 'cash');
  close(cash.left, 160 - 70 - 70); close(cash.right, 20); close(cash.diff, 0); assert.ok(cash.ok);
  const bad = CFO.reconcile(mk(y23, { ...y24, total_assets: 1000 }));
  const b = bad.find(c => c.id === 'balance' && c.period === '2024');
  assert.equal(b.ok, false); close(b.diff, 40);
  const plan = CFO.actionPlan(CFO.analyze(mk(y23, { ...y24, total_assets: 1000 })), [], null, 'en');
  assert.equal(plan[0].title, CFO.UI.en.val.reconTitle, 'a statement that does not tie comes first in the plan');
});

test('the indirect cash-flow bridge adds up to the reported change in cash', () => {
  const [b] = CFO.cashBridge(ds), r = b.rows;
  close(r.d_receivables, -10); close(r.d_inventory, -10); close(r.d_payables, 10);
  close(r.cfo_other, 160 - (120 + 55 - 10 - 10 + 10));
  close(r.net_borrowing, -20); close(r.cff_other, -70 + 40 + 20);
  close(r.change, 20); close(r.change_reported, 20);
  close(r.fcfe, 160 - 70 - 20);
  const su = CFO.sourcesUses(ds)[0];
  close(su.sources.reduce((a, [, v]) => a + v, 0), su.uses.reduce((a, [, v]) => a + v, 0), 'sources = uses');
});

test('break-even, margin of safety and leverage match hand calculations', () => {
  const be = CFO.breakEven(ds);
  close(be.cm, 440); close(be.cmr, 0.4); close(be.fixed, 440 - 175);
  close(be.beRevenue, 265 / 0.4); close(be.mos, (1100 - 662.5) / 1100);
  close(be.dol, 440 / 175); close(be.dfl, 175 / 153); close(be.dcl, 440 / 153);
  const t = CFO.breakEven(ds, { target: 300 }); close(t.targetRevenue, (265 + 300) / 0.4);
  const half = CFO.breakEven(ds, { opexVar: 0.5 }); close(half.variable, 660 + 105);
  close(be.highLow.rate, ((1100 - 175) - (1000 - 150)) / 100);
  assert.ok(CFO.breakEven(mk({ revenue: 10 }, { revenue: 12 })).missing.length);
});

test('cash-flow ratios', () => {
  const A = CFO.analyze(ds), r = id => A.ratios[id]['2024'].value;
  close(r('cf_adequacy'), 160 / (70 + 40 + 20));
  close(r('fcf_div_cover'), 90 / 40);
  close(r('cash_interest_cover'), (160 + 22 + 33) / 22);
});

test('cash section appears in every format, in both languages, without NaN', () => {
  const sample = CFO.buildDataset(CFO.sampleTables()), A = CFO.analyze(sample), F = CFO.flags(A);
  for (const lang of ['en', 'ar']) {
    const R = { A, F, S: null, lang, ai: '' }, html = CFO.fullHTML(R), md = CFO.reportMarkdown(R), L = CFO.UI[lang].cf;
    for (const t of [L.recon, L.bridge, L.be]) { assert.ok(html.includes(CFO.esc(t)), t); assert.ok(md.includes(t), t); }
    assert.ok(!/NaN|undefined|Infinity/.test(html + md));
  }
});
