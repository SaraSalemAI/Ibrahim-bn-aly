// Run: node --test cfo-dashboard/tests/full.test.mjs   (no install needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = fileURLToPath(new URL('../js/', import.meta.url));
for (const f of ['catalog', 'parsers', 'mapper', 'analysis', 'benchmarks', 'i18n', 'insights', 'sample', 'forecast', 'charts', 'report', 'ai']) {
  vm.runInThisContext(readFileSync(dir + f + '.js', 'utf8'), { filename: f + '.js' });
}
const CFO = globalThis.CFO;
const ds = CFO.buildDataset(CFO.sampleTables());
const A = CFO.analyze(ds), F = CFO.flags(A), S = CFO.runScenarios(ds, CFO.defaultDrivers(ds), 3);
const R = lang => ({ A, F, S, ai: '', lang });

test('the full analysis model holds every analysis', () => {
  for (const lang of ['en', 'ar']) {
    const m = CFO.reportModel(R(lang));
    assert.equal(m.groups.reduce((n, g) => n + g.rows.length, 0), CFO.RATIOS.length, 'all ratios');
    assert.equal(m.vertical.reduce((n, t) => n + t.rows.length, 0), A.vertical.length, 'every vertical line');
    assert.equal(m.horizontal.reduce((n, t) => n + t.rows.length, 0), A.horizontal.length, 'every horizontal line');
    assert.equal(m.dupont.rows.length, ds.periods.length);
    assert.ok(m.altman.value && m.altman.meaning);
    assert.equal(m.kpis.length, 6);
    assert.equal(m.charts.length, 5, 'four history charts + forecast cash');
    assert.ok(m.forecast.rows.length >= 10 && m.forecastDetail.rows.length > 10);
    assert.ok(m.flags.length > 0 && m.next.length === 3);
  }
});

test('the HTML file carries both languages, its own switch, and nothing from outside', () => {
  const html = CFO.fullDocument({ ...R('ar'), ai: '## Summary\n- one', aiLang: 'en' }, '');
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /data-lang="en"[^>]*hidden/, 'English starts hidden when exported from Arabic');
  assert.match(html, /data-lang="ar" lang="ar" dir="rtl">/);
  assert.ok(html.includes('Full financial analysis') && html.includes('التحليل المالي الكامل'));
  assert.ok(html.includes('data-l="en"') && html.includes('data-l="ar"') && html.includes('data-theme-toggle'));
  assert.equal((html.match(/<svg class="svg-chart"/g) || []).length, 10, '5 charts in each language');
  assert.ok(!/<script[^>]+src=|<link[^>]+href=|https?:\/\//.test(html), 'no external scripts, styles or links');
  assert.equal((html.match(/<h2>Summary<\/h2>|<h4>Summary<\/h4>/g) || []).length, 1, 'Claude text only in the language it was written in');
  assert.ok(new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1])).size === [...html.matchAll(/ id="([^"]+)"/g)].length, 'ids are unique');
});

test('Markdown includes every ratio group and both analyses', () => {
  const md = CFO.reportMarkdown(R('en'));
  for (const g of CFO.GROUPS) assert.ok(md.includes(`### ${CFO.UI.en.groups[g]}`), g);
  assert.ok(md.includes('## Vertical') && md.includes('## Horizontal') && md.includes('DuPont'));
});

test('SVG charts draw negatives, stacks and lines', () => {
  const bar = CFO.svgChart({ kind: 'bar', labels: ['a', 'b'], series: [{ name: 'x', values: [5, -3], color: 'red' }] });
  assert.equal((bar.match(/<rect x=/g) || []).length, 3, 'two bars + legend swatch');
  const line = CFO.svgChart({ kind: 'line', labels: ['a', 'b', 'c'], series: [{ name: 'y', values: [1, null, 3], color: 'blue' }] });
  assert.equal((line.match(/<circle/g) || []).length, 2);
  assert.ok(CFO.svgChart({ kind: 'stack', max100: true, labels: ['a'], series: [{ name: 'p', values: [0.6], color: 'g' }, { name: 'q', values: [0.4], color: 'h' }] }).includes('<title>q · a'));
});

test('the full analysis never shows NaN, undefined or Infinity, whatever is missing', () => {
  const cases = {
    'income statement only': [['', 2023, 2024], ['Revenue', 58000, 61000], ['Cost of sales', 35960, 39650], ['Net income', 3937, 1488]],
    'balance sheet only': [['', 2023, 2024], ['Total current assets', 25700, 30300], ['Total current liabilities', 15000, 21500], ['Total assets', 58700, 65800], ['Total equity', 29200, 27800]],
    'single year': [['', 2024], ['Revenue', 61000], ['Net income', 1488], ['Total assets', 65800], ['Total equity', 27800]],
    'losses and zeros': [['', 2023, 2024], ['Revenue', 0, 1000], ['Cost of sales', 0, 1500], ['Net income', -500, -900], ['Total assets', 1000, 800], ['Total equity', -100, -1000], ['Total liabilities', 1100, 1800], ['Finance costs', 0, 0]],
    'no years': [['Revenue', 100, 120], ['Net income', 5, 6], ['Total assets', 300, 320], ['Total equity', 150, 160]],
  };
  for (const [name, rows] of Object.entries(cases)) {
    const d = CFO.buildDataset([{ source: name, ...CFO.rowsToLines(rows) }]);
    const a = CFO.analyze(d), f = CFO.flags(a);
    const s = CFO.forecastMissing(d).length ? null : CFO.runScenarios(d, CFO.defaultDrivers(d), 2);
    for (const lang of ['en', 'ar']) {
      const html = CFO.fullHTML({ A: a, F: f, S: s, ai: '', lang }) + CFO.reportMarkdown({ A: a, F: f, S: s, ai: '', lang });
      const bad = html.match(/.{0,40}\b(NaN|undefined|Infinity)\b.{0,20}/);
      assert.equal(bad, null, `${name} (${lang}): ${bad && bad[0]}`);
    }
  }
});
