// Run: node --test cfo-dashboard/tests/peers.test.mjs   (no install needed)
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
const ds = CFO.buildDataset(CFO.sampleTables()), A = CFO.analyze(ds), F = CFO.flags(A), V = CFO.valuation(ds, null, null);
const peers = [
  { name: 'Alpha', revenue: 80000, revenue_prev: 70000, ebitda: 12000, net_income: 6000, total_assets: 70000, equity: 40000, total_debt: 15000, cash: 5000, market_cap: 60000 },
  { name: 'Beta', revenue: 50000, revenue_prev: 48000, ebitda: 6000, net_income: 2500, total_assets: 45000, equity: 20000, total_debt: 18000, cash: 2000, market_cap: 25000 },
  { name: 'Gamma', revenue: 65000, revenue_prev: 60000, ebitda: 9000, net_income: 4000, total_assets: 60000, equity: 30000, total_debt: 20000, cash: 3000, market_cap: 40000 },
];

test('quantiles interpolate like a spreadsheet', () => {
  assert.equal(CFO.quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(CFO.quantile([1, 2, 3, 4], 0.25), 1.75);
  assert.equal(CFO.quantile([5], 0.75), 5);
});

test('the company is ranked against peer median and quartiles', () => {
  const rows = CFO.comparePeers(CFO.companyFigures(ds), peers);
  const nm = rows.find(r => r.id === 'net_margin');
  close(nm.median, 4000 / 65000);
  close(nm.company, 1488 / 61000);
  assert.equal(nm.rank, 4, 'lowest net margin of four'); assert.equal(nm.quartile, 'bottom');
  const de = rows.find(r => r.id === 'debt_to_equity');
  assert.ok(de.dir === 'low' && de.rank >= 1);
  const ev = rows.find(r => r.id === 'ev_ebitda');
  close(ev.peers[0], (60000 + 15000 - 5000) / 12000);
  assert.equal(ev.company, null, 'no market value for the company');
});

test('multiples, dividend discount and book value give a weighted value range', () => {
  const rows = CFO.comparePeers(CFO.companyFigures(ds), peers);
  const mt = CFO.valuationMethods({ ds, V, rows });
  const ids = mt.list.map(x => x.id);
  for (const id of ['dcf', 'ev_ebitda', 'ev_revenue', 'pe', 'ddm', 'book']) assert.ok(ids.includes(id), id);
  const c = CFO.companyFigures(ds), evm = mt.list.find(x => x.id === 'ev_ebitda');
  close(evm.mid, evm.multiple.mid * c.ebitda - mt.netDebt);
  const pe = mt.list.find(x => x.id === 'pe'); close(pe.mid, pe.multiple.mid * c.net_income);
  const ddm = mt.list.find(x => x.id === 'ddm'); close(ddm.mid, ds.data['2024'].dividends * (1 + V.inputs.g) / (V.ke - V.inputs.g));
  close(mt.list.reduce((t, x) => t + x.weight, 0), 1, 'weights add up to 100%');
  close(mt.weighted.mid, mt.list.reduce((t, x) => t + x.weight * x.mid, 0));
  for (const x of mt.list) assert.ok(x.low <= x.mid + 1e-9 && x.mid <= x.high + 1e-9, x.id);
  const typed = CFO.valuationMethods({ ds, V, rows: [], typed: { ev_ebitda: 6 } });
  close(typed.list.find(x => x.id === 'ev_ebitda').mid, 6 * c.ebitda - typed.netDebt, 'typed multiple without peers');
  const bookOnly = CFO.valuationMethods({ ds, V, rows, weights: { dcf: 0, multiples: 0, book: 1 } });
  close(bookOnly.weighted.mid, c.equity);
});

test('a peer read from statements uses the same reader', () => {
  const p = CFO.peerFromTables('Nile', CFO.sampleTables());
  assert.equal(p.period, '2024'); assert.equal(p.revenue, 61000); assert.equal(p.revenue_prev, 58000);
});

test('bottom-quartile ratios join the action plan, and the report carries the comparison', () => {
  const plan = CFO.actionPlan(A, F, V, 'en', { peers });
  assert.ok(plan.some(it => it.title.startsWith('Below most peers')));
  for (const lang of ['en', 'ar']) {
    const R = { A, F, S: null, lang, ai: '', peers }, html = CFO.fullHTML(R), md = CFO.reportMarkdown(R);
    assert.ok(html.includes(CFO.esc(CFO.UI[lang].secPeers)) && md.includes(CFO.UI[lang].secPeers));
    assert.ok(html.includes('Alpha') && !/NaN|undefined|Infinity/.test(html + md));
  }
  const none = CFO.peerModel({ A, lang: 'en', V });
  assert.equal(none.hasPeers, false); assert.ok(none.methodTable, 'methods work without peers (DCF, DDM, book)');
});
