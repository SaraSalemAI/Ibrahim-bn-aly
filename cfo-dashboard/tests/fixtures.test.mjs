// Real-world layouts that once broke the reader. Needs the pinned libraries: npm install --prefix cfo-dashboard
// Run: npm test --prefix cfo-dashboard
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(root + 'package.json');
const ready = existsSync(root + 'node_modules/xlsx') && existsSync(root + 'node_modules/papaparse');

if (ready) {
  globalThis.XLSX = require('xlsx');
  globalThis.Papa = require('papaparse');
  // Same pdf.js version as the page; the worker runs in-process, as it does in the bundled page.
  // pdf.js prints a warning that 'canvas' is missing; text extraction does not need it.
  globalThis.pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  globalThis.pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');
  for (const f of ['catalog', 'parsers', 'mapper', 'analysis']) vm.runInThisContext(readFileSync(`${root}js/${f}.js`, 'utf8'), { filename: f + '.js' });
}
const CFO = globalThis.CFO;
const dir = root + 'tests/fixtures/';

for (const name of ready ? readdirSync(dir).sort() : []) {
  test(`fixture ${name}`, async () => {
    const buf = new Uint8Array(readFileSync(dir + name));
    const tables = name.endsWith('.csv') ? CFO.csvTables(buf, name) : name.endsWith('.pdf') ? await CFO.pdfTables(buf, name) : CFO.workbookTables(buf, name);
    const ds = CFO.buildDataset(tables);
    const A = CFO.analyze(ds), d = ds.data['2024'];
    assert.deepEqual(ds.periods, ['2023', '2024']);
    assert.equal(d.revenue, 61000);
    assert.equal(d.total_assets, 65800);
    assert.equal(d.net_income, 1488);
    assert.ok(Math.abs(A.ratios.current_ratio['2024'].value - 30300 / 21500) < 1e-9);
  });
}

test('parser edge cases', { skip: !ready && 'run npm install --prefix cfo-dashboard' }, () => {
  assert.equal(CFO.parseNumber('−39.650,00'), -39650);
  assert.equal(CFO.parseNumber('1 234'), 1234);
  assert.equal(CFO.parseNumber('1,234.5'), 1234.5);
  assert.equal(CFO.headerOf(['Intangible assets', 2000, 2000]), null, 'repeated amounts are not years');
  assert.equal(CFO.headerOf(['Intangible assets', '2000', '2000', '2000']), null, 'same, as CSV text');
  assert.deepEqual(CFO.headerOf(['Line item', '2022', '2023', '2024']).map(c => c.p), ['2022', '2023', '2024']);
  assert.equal(CFO.headerOf(['Revenue', 2023, 2024]), null, 'a known line item with year-like amounts is data');
  assert.deepEqual(CFO.headerOf(['', 2024, 2023]).map(c => c.p), ['2024', '2023']);
  assert.equal(CFO.headerOf(['As at 31 December 2024']), null, 'a title is not a header');
  assert.deepEqual(CFO.headerOf(['Item', '2024']).map(c => c.p), ['2024'], 'one-year statement header');
  assert.equal(CFO.headerOf(['Prepayments', '2024'], ['2023', '2024']), null, 'after a header, a lone year-like amount is data');
});

// Regressions found in code review.
test('units cell in the header row', { skip: !ready }, () => {
  assert.deepEqual(CFO.rowsToLines([['Item', "EGP '000", '2024', '2023'], ['Revenue', '', '100', '90']]).lines, [{ label: 'Revenue', values: { 2024: 100, 2023: 90 } }]);
  assert.deepEqual(CFO.rowsToLines([['القيمة بالألف جنيه', '2024', '2023'], ['الإيرادات', '100', '90']]).lines[0].values, { 2024: 100, 2023: 90 });
});

test('year-like data rows and subtitles keep the current header', { skip: !ready }, () => {
  const v = rows => CFO.rowsToLines(rows).lines.map(l => l.values);
  assert.deepEqual(v([['Item', '2024', '2023'], ['Headcount', 2019, 2021], ['Cash', '50', '40']])[1], { 2024: 50, 2023: 40 });
  assert.deepEqual(v([['Item', '2024', '2023'], ['', '31 December 2024'], ['Cash', '50', '40']])[0], { 2024: 50, 2023: 40 });
  assert.deepEqual(v([['', 2024, 2023], ['Revenue', 100, 90], ['Note', 2023, 2024], ['Cash', 40, 50]])[1], { 2023: 40, 2024: 50 }, 'second statement, swapped columns');
});

test('US decimals are not read as European thousands', { skip: !ready }, () => {
  assert.deepEqual(['0.125', '1.500', '2.250', '1.234.567', '1.234,56', '432,00'].map(CFO.parseNumber), [0.125, 1.5, 2.25, 1234567, 1234.56, 432]);
  const t = CFO.csvTables(new TextEncoder().encode('Item;2024\nRevenue;61.000\nEPS;1,5'), 'eu.csv')[0];
  assert.deepEqual(t.lines.map(l => l.values[2024]), [61000, 1.5], 'semicolon file uses European style throughout');
});

test('legacy encodings', { skip: !ready }, () => {
  assert.equal(CFO.decodeText(Uint8Array.from([67, 114, 0xE9, 97, 110, 99, 101, 115])), 'Créances');
  assert.equal(CFO.decodeText(Uint8Array.from([0xC7, 0xE1, 0xC5, 0xED, 0xD1, 0xC7, 0xCF, 0xC7, 0xCA])), 'الإيرادات');
});

test('PDF: Arabic wrapped labels are joined and Arabic footers skipped', { skip: !ready }, () => {
  const row = (y, items) => ({ y, items: items.map(([s, x]) => ({ s, x, cx: x, y })) });
  const t = CFO.pdfRowsToLines([row(700, [['2024', 300], ['2023', 400]]), row(680, [['الممتلكات و', 50]]),
    row(670, [['المعدات', 50], ['100', 300], ['90', 400]]), row(660, [['صفحة 3', 200]]), row(650, [['p. 4', 200]])]);
  assert.deepEqual(t.lines, [{ label: 'الممتلكات و المعدات', values: { 2024: 100, 2023: 90 } }]);
  assert.equal(CFO.sniffDelimiter('a;b;c\n1;2;3,5'), ';');
});

test('cells pasted from Excel (tab-separated text) are read like a file', { skip: !ready }, () => {
  const text = '\t2023\t2024\r\nRevenue\t58,000\t61,000\r\nNet income\t3,937\t1,488\r\nTotal assets\t58,700\t65,800\r\nTotal equity\t29,200\t27,800\r\n';
  const ds = CFO.buildDataset(CFO.csvTables(new TextEncoder().encode(text), 'Pasted table 1'));
  assert.deepEqual(ds.periods, ['2023', '2024']);
  assert.equal(ds.data['2024'].revenue, 61000);
  assert.equal(ds.data['2024'].equity, 27800);
});
