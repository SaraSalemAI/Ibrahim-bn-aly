// The same company presented in many real-world layouts must give the same years, items and ratios.
// Run: node --test cfo-dashboard/tests/layouts.test.mjs   (no install needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = fileURLToPath(new URL('../js/', import.meta.url));
for (const f of ['catalog', 'parsers', 'mapper', 'analysis', 'benchmarks', 'i18n', 'insights']) vm.runInThisContext(readFileSync(dir + f + '.js', 'utf8'), { filename: f + '.js' });
const CFO = globalThis.CFO;

// Nile Trading (fictional): 2023 and 2024.
const Y = { 2023: { rev: 58000, cogs: 35960, opex: 12760, ni: 3937, ca: 25700, cl: 15000, ta: 58700, tl: 29500, eq: 29200, cash: 4200, sd: 6500, ld: 14500, cfo: 2237, capex: 5300 },
            2024: { rev: 61000, cogs: 39650, opex: 14030, ni: 1488, ca: 30300, cl: 21500, ta: 65800, tl: 38000, eq: 27800, cash: 2100, sd: 10000, ld: 16500, cfo: 388, capex: 5100 } };
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const grp = n => n.toLocaleString('en-US');
const neg = n => `(${grp(n)})`;

function check(name, tables, years = ['2023', '2024'], scale = 1) {
  const ds = CFO.buildDataset(tables.map((rows, i) => ({ source: `${name}#${i}`, ...CFO.rowsToLines(rows) })));
  assert.deepEqual(ds.periods, years, `${name}: years`);
  const A = CFO.analyze(ds), d = ds.data['2024'], e = Y[2024];
  const near = (a, b, what) => assert.ok(a != null && Math.abs(a - b * scale) <= Math.abs(b * scale) * 1e-6 + 1e-9, `${name}: ${what} ${a} vs ${b * scale}`);
  near(d.revenue, e.rev, 'revenue'); near(d.cogs, e.cogs, 'cost of sales'); near(d.net_income, e.ni, 'net income');
  near(d.total_assets, e.ta, 'total assets'); near(d.equity, e.eq, 'equity');
  near(A.ratios.current_ratio['2024'].value, e.ca / e.cl / scale, 'current ratio');
  near(A.ratios.gross_margin['2024'].value, (e.rev - e.cogs) / e.rev / scale, 'gross margin');
  return { ds, A };
}

test('English IFRS: title block, Note column, newest year first, three statements in one sheet', () => {
  const { ds } = check('ifrs', [[
    ['Nile Trading Company S.A.E.'], ['Consolidated financial statements'], ['For the year ended 31 December 2024'], ["EGP '000"], [],
    ['', 'Note', '31 December 2024', '31 December 2023'],
    ['Revenue from contracts with customers', 4, grp(61000), grp(58000)], ['Cost of revenues', 5, neg(39650), neg(35960)], ['Gross profit', '', grp(21350), grp(22040)],
    ['Selling and distribution expenses', 6, neg(6030), neg(5760)], ['General and administrative expenses', 7, neg(8000), neg(7000)],
    ['Operating profit', '', grp(4720), grp(6980)], ['Finance costs', 8, neg(2800), neg(1900)], ['Profit before income tax', '', grp(1920), grp(5080)],
    ['Income tax expense', 9, neg(432), neg(1143)], ['Profit for the year', '', grp(1488), grp(3937)], ['Basic earnings per share', '', '0.15', '0.39'], [],
    ['Statement of financial position'], ['', 'Note', '2024', '2023'],
    ['Cash and bank balances', 10, grp(2100), grp(4200)], ['Trade and other receivables, net', 11, grp(15800), grp(11500)], ['Inventories', 12, grp(11200), grp(8900)],
    ['Total current assets', '', grp(30300), grp(25700)], ['Property, plant and equipment', 13, grp(33500), grp(31000)], ['Total assets', '', grp(65800), grp(58700)],
    ['Trade and other payables', '', grp(8900), grp(6200)], ['Short-term loans', '', grp(7000), grp(4500)], ['Current portion of long-term loans', '', grp(3000), grp(2000)],
    ['Total current liabilities', '', grp(21500), grp(15000)], ['Long-term loans', '', grp(16500), grp(14500)], ['Total liabilities', '', grp(38000), grp(29500)],
    ['Share capital', '', grp(15000), grp(15000)], ['Retained earnings', '', grp(12800), grp(14200)], ["Total equity", '', grp(27800), grp(29200)],
    ['Total equity and liabilities', '', grp(65800), grp(58700)],
  ]]);
  assert.equal(ds.data['2024'].opex, 14030, 'S&D + G&A are added up');
  assert.equal(ds.data['2024'].short_debt, 10000, 'short-term loans + current portion');
  assert.equal(ds.issues.filter(i => i.type === 'conflict').length, 0);
});

test('Egyptian Arabic: Arabic-Indic digits, long year headers, labels on the right', () => {
  const H = y => `عن السنة المالية المنتهية في ٣١ ديسمبر ${AR(y)}`;
  check('eg-ar', [[
    ['شركة النيل للتجارة (ش.م.م)'], ['القيمة بالألف جنيه مصري'],
    [H(2023), H(2024), 'إيضاح', 'البيان'],
    [AR('58,000'), AR('61,000'), '٤', 'صافي المبيعات'], [`(${AR('35,960')})`, `(${AR('39,650')})`, '', 'تكلفة المبيعات'], [AR('22,040'), AR('21,350'), '', 'مجمل الربح'],
    [`(${AR('5,760')})`, `(${AR('6,030')})`, '', 'مصروفات بيع وتوزيع'], [`(${AR('7,000')})`, `(${AR('8,000')})`, '', 'مصروفات عمومية وإدارية'],
    [AR('3,937'), AR('1,488'), '', 'صافي ربح العام'],
    [AR('4,200'), AR('2,100'), '', 'نقدية بالصندوق ولدى البنوك'], [AR('11,500'), AR('15,800'), '', 'العملاء وأوراق القبض'],
    [AR('25,700'), AR('30,300'), '', 'مجموع الأصول المتداولة'], [AR('58,700'), AR('65,800'), '', 'إجمالي الأصول'],
    [AR('15,000'), AR('21,500'), '', 'مجموع الالتزامات المتداولة'], [AR('29,500'), AR('38,000'), '', 'إجمالي الالتزامات'],
    [AR('29,200'), AR('27,800'), '', 'إجمالي حقوق الملكية'], [AR('58,700'), AR('65,800'), '', 'إجمالي الالتزامات وحقوق الملكية'],
  ]]);
});

test('Fiscal years written as ranges are named by the year they end', () => {
  check('fiscal', [[['Item', 'FY 2022/23', 'FY 2023/24'], ['Revenue', 58000, 61000], ['Cost of sales', 35960, 39650], ['Net income', 3937, 1488],
    ['Total current assets', 25700, 30300], ['Total current liabilities', 15000, 21500], ['Total assets', 58700, 65800], ['Total equity', 29200, 27800]]]);
});

test('Five years of history, oldest first', () => {
  const { A } = check('five', [[['', 2020, 2021, 2022, 2023, 2024], ['Revenue', 40000, 45000, 50000, 58000, 61000], ['Cost of sales', 24000, 27000, 30000, 35960, 39650],
    ['Net income', 3000, 3500, 4495, 3937, 1488], ['Total current assets', 18000, 20000, 22000, 25700, 30300], ['Total current liabilities', 9000, 10000, 11000, 15000, 21500],
    ['Total assets', 45000, 48000, 52000, 58700, 65800], ['Total equity', 25000, 27000, 29000, 29200, 27800]]], ['2020', '2021', '2022', '2023', '2024']);
  const h = A.horizontal.find(r => r.key === 'revenue');
  assert.ok(Math.abs(h.cagr - (Math.pow(61000 / 40000, 1 / 4) - 1)) < 1e-9, 'CAGR over four years');
});

test('A single year still gives every ratio that needs no prior year', () => {
  const ds = CFO.buildDataset([{ source: 'one', ...CFO.rowsToLines([['Line item', '2024'], ['Revenue', 61000], ['Cost of sales', 39650], ['Net income', 1488],
    ['Total current assets', 30300], ['Total current liabilities', 21500], ['Total assets', 65800], ['Total equity', 27800]]) }]);
  assert.deepEqual(ds.periods, ['2024']);
  const A = CFO.analyze(ds);
  assert.ok(Math.abs(A.ratios.current_ratio['2024'].value - 30300 / 21500) < 1e-9);
  assert.ok(Math.abs(A.ratios.roe['2024'].value - 1488 / 27800) < 1e-9, 'closing equity when no prior year');
});

test('No years in the file: columns are flagged and can be named', () => {
  // As a CSV gives them: every cell is text.
  const rows = [['Revenue', '58,000', '61,000'], ['Net income', '3,937', '1,488'], ['Total assets', '58,700', '65,800'], ['Total equity', '29,200', '27,800']];
  const t = { source: 'noyears', ...CFO.rowsToLines(rows) };
  const ds = CFO.buildDataset([t]);
  assert.ok(ds.issues.some(i => i.type === 'noYears'));
  // What Data review does when the user types the years:
  const ren = { P1: '2023', P2: '2024' };
  const named = { ...t, periods: t.periods.map(p => ren[p]), lines: t.lines.map(l => ({ ...l, values: Object.fromEntries(Object.entries(l.values).map(([p, v]) => [ren[p], v])) })) };
  const ds2 = CFO.buildDataset([named]);
  assert.deepEqual(ds2.periods, ['2023', '2024']);
  assert.equal(ds2.data['2024'].revenue, 61000);
  assert.ok(!ds2.issues.some(i => i.type === 'noYears'));
});

test('Two-row header (years, then a currency row) and figures in millions', () => {
  check('millions', [[['', '2023', '2024'], ['', 'EGP m', 'EGP m'], ['Revenue', '58.0', '61.0'], ['Cost of sales', '(35.96)', '(39.65)'], ['Net income', '3.937', '1.488'],
    ['Total current assets', '25.7', '30.3'], ['Total current liabilities', '15.0', '21.5'], ['Total assets', '58.7', '65.8'], ['Total equity', '29.2', '27.8']]], ['2023', '2024'], 0.001);
});

test('Gulf Arabic with zakat, statements in separate tables', () => {
  const H = ['البيان', '٢٠٢٣م', '٢٠٢٤م'];
  const { ds } = check('gulf', [
    [H, ['الإيرادات', 58000, 61000], ['تكلفة الإيرادات', -35960, -39650], ['الربح قبل الزكاة وضريبة الدخل', 5080, 1920], ['الزكاة وضريبة الدخل', -1143, -432], ['صافي ربح السنة', 3937, 1488]],
    [H, ['النقد وما في حكمه', 4200, 2100], ['إجمالي الموجودات المتداولة', 25700, 30300], ['إجمالي الموجودات', 58700, 65800], ['إجمالي المطلوبات المتداولة', 15000, 21500],
      ['إجمالي المطلوبات', 29500, 38000], ['إجمالي حقوق المساهمين', 29200, 27800]],
    [H, ['صافي التدفقات النقدية الناتجة من أنشطة التشغيل', 2237, 388], ['مدفوعات لشراء ممتلكات وآلات ومعدات', -5300, -5100], ['توزيعات أرباح مدفوعة', -3737, -2888]],
  ]);
  assert.equal(ds.data['2024'].pretax_income, 1920);
  assert.equal(ds.data['2024'].tax, 432);
  assert.equal(ds.data['2024'].cfo, 388);
  assert.equal(ds.data['2024'].capex, 5100);
});

test('An item shown in two statements on one sheet is not added to itself; split items are', () => {
  const ds = CFO.buildDataset([{ source: 'stacked', ...CFO.rowsToLines([['', 2023, 2024], ['Revenue', 900, 1000], ['Depreciation and amortisation', -50, -60],
    ['Selling expenses', -30, -40], ['Administrative expenses', -20, -25], ['Net income', 100, 120],
    ['Cash flows from operating activities'], ['Net income', 100, 120], ['Depreciation and amortisation', 50, 60], ['Dividends paid', -10, -12],
    ['Statement of changes in equity'], ['Dividends paid', -10, -12]]) }]);
  assert.equal(ds.data['2024'].dna, 60);
  assert.equal(ds.data['2024'].dividends, 12);
  assert.equal(ds.data['2024'].opex, 65, 'selling + administrative');
});

test('IFRS order (non-current first) keeps current items right', () => {
  const ds = CFO.buildDataset([{ source: 'ifrs', ...CFO.rowsToLines([['', 2024], ['Property, plant and equipment', 4000], ['Total non-current assets', 5000],
    ['Inventories', 300], ['Total current assets', 900], ['Total assets', 5900], ['Other operating income', 20], ['Operating profit', 250]]) }]);
  assert.equal(ds.data['2024'].current_assets, 900);
  assert.equal(ds.data['2024'].operating_income, 250);
});

test('A note-reference column in a file without years is not a year', () => {
  const t = CFO.rowsToLines([['Revenue', '4', '58,000', '61,000'], ['Net income', '5', '3,937', '1,488'], ['Total assets', '12', '58,700', '65,800']]);
  assert.deepEqual(t.periods, ['P1', 'P2']);
  assert.deepEqual(t.lines[0].values, { P1: 58000, P2: 61000 });
});
