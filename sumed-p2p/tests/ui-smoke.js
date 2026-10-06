#!/usr/bin/env node
/* Browser smoke test (optional; needs Playwright + Chromium). Usage: node tests/ui-smoke.js [outDir]
 * Demo mode → every route & tab in EN/AR × light/dark, drill-down drawer, KPI lineage, evidence modals,
 * every report export (xlsx/csv), phone-width layout (no horizontal page scroll). Fails on any console/page error. */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { try { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); } catch (e2) { console.log('Playwright not installed — skipping UI smoke test.'); process.exit(0); } }
const path = require('path'), fs = require('fs');
const out = process.argv[2] || require('os').tmpdir();
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const ROUTES = ['dashboard', 'actions', 'summary', 'insights', 'upload', 'quality', 'recon', 'suppliers', 'supplier/S001', 'onboarding', 'performance', 'risk', 'procurement', 'pos', 'contracts', 'invoices', 'matching', 'duplicates', 'disputes', 'payments', 'calendar', 'aging', 'treasury', 'banks', 'spend', 'savings', 'fraud', 'controls', 'tax', 'audit', 'reports', 'settings'];
const TABS = { payments: ['payTab', ['queue', 'proposal', 'batches', 'register']], controls: ['ctlTab', ['tests', 'sod', 'authority']], tax: ['taxTab', ['tax', 'fx']], settings: ['setTab', ['general', 'approval', 'thresholds', 'weights', 'tax', 'roles', 'api']], treasury: ['trH', ['daily', 'weekly', 'monthly']], calendar: ['cal', null] };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  let checks = 0;
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|ERR_NAME|net::ERR/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  const viewErr = async (label) => { checks++; const bad = await p.evaluate(() => { const w = document.querySelector('.warnbar.crit pre'); return w ? w.textContent.slice(0, 300) : null; }); if (bad) errs.push(label + ': ' + bad); };
  await p.goto(url); await p.waitForTimeout(400);
  await p.click('[data-act="demo"]'); await p.waitForTimeout(600);
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    await p.evaluate(([l, th]) => { SUMED.state.prefs.lang = l; SUMED.state.prefs.theme = th; SUMED.app.render(); }, [lang, theme]);
    for (const r of ROUTES) {
      await p.evaluate((r) => (location.hash = '#/' + r), r); await p.waitForTimeout(60);
      await viewErr(`${lang}/${theme} ${r}`);
      const raw = await p.evaluate(() => (document.getElementById('main').innerText.match(/\b(?:nav|kpi|rule|drv|ct|dq|sv|ac|ins|st|f|m|br|pc|pq|tr|set|sup|rep|up)\.[a-zA-Z_]+\b/g) || []).filter((x) => !/^(f|m|st)\.[a-z]$/i.test(x)).slice(0, 5));
      if (raw.length) errs.push(`raw i18n keys on ${lang} ${r}: ${raw.join(', ')}`);
      const tabs = TABS[r];
      if (tabs && tabs[1]) for (const v of tabs[1]) { await p.evaluate(([k, v]) => { SUMED.vs[k] = v; SUMED.app.render(); }, [tabs[0], v]); await viewErr(`${lang} ${r}:${v}`); }
    }
    await p.screenshot({ path: path.join(out, `smoke-${lang}-${theme}.png`) });
  }
  await p.evaluate(() => { SUMED.state.prefs.lang = 'en'; SUMED.state.prefs.theme = 'light'; location.hash = '#/dashboard'; }); await p.waitForTimeout(150);
  // KPI lineage modals
  const kpis = await p.evaluate(() => Object.keys(SUMED.R.kpis));
  for (const k of kpis) { await p.evaluate((k) => SUMED.ui.openLineage(k), k); checks++; const ok = await p.evaluate(() => !document.getElementById('modal').hidden && /SOURCE|المصدر/.test(document.getElementById('modal').innerText)); if (!ok) errs.push('lineage modal ' + k); }
  // Evidence for every red flag, insight, action, summary statement, control test, saving, risk
  const ev = await p.evaluate(() => { const R = SUMED.R; return [].concat(R.redFlags.map((f) => 'flag:' + f.id), R.insights.map((i) => 'insight:' + i.id), R.actions.map((a) => 'action:' + a.id), R.controls.tests.filter((t) => t.count).map((t) => 'ctl:' + t.id), R.savings.map((s) => 'sav:' + s.id), [...R.risk.keys()].map((k) => 'risk:' + k), R.dq.issues.map((i) => 'dq:' + i.id), R.dupInv.list.map((d) => 'dup:' + d.id)); });
  for (const e of ev) { const [k, ...id] = e.split(':'); const f = await p.evaluate(([k, id]) => { const f = SUMED.evidence(k, id); if (!f) return 'none'; SUMED.ui.openEvidence(f); return f.rows.filter(Boolean).every((r) => r._src && r._src.file) ? 'ok' : 'nosrc'; }, [k, id.join(':')]); checks++; if (f !== 'ok') errs.push(`evidence ${e}: ${f}`); }
  // Drill-down drawer for a sample of every entity
  const keys = await p.evaluate(() => Object.values(SUMED.state.data).flatMap((a) => a.slice(0, 3).map((r) => r._key)).filter((k) => !k.startsWith('suppliers')));
  for (const k of keys) { await p.evaluate((k) => SUMED.ui.openRecord(k), k); checks++; const ok = await p.evaluate(() => !document.getElementById('drawer').hidden); if (!ok) errs.push('drawer ' + k); }
  // Every report export
  const reps = await p.evaluate(() => SUMED.reports.defs().map((d) => d.id));
  // Chromium throttles bursts of programmatic downloads (every ~11th is dropped); pace them like a user would.
  for (const r of reps) for (const fmt of ['excel', 'csv']) {
    checks++;
    await p.waitForTimeout(1100);
    try {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.evaluate(([r, f]) => SUMED.reports[f](r), [r, fmt])]);
      const f = path.join(out, dl.suggestedFilename()); await dl.saveAs(f);
      if (fs.statSync(f).size < 100) errs.push('empty export ' + f);
    } catch (e) { errs.push(`export ${r}/${fmt}: ${e.message.split('\n')[0]}`); }
  }
  // Phone width: no horizontal page scroll
  await p.setViewportSize({ width: 390, height: 844 });
  for (const r of ['dashboard', 'payments', 'suppliers', 'treasury', 'fraud']) { await p.evaluate((r) => (location.hash = '#/' + r), r); await p.waitForTimeout(100); checks++; const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 2) errs.push(`horizontal overflow ${o}px on ${r} at 390px`); }
  await p.screenshot({ path: path.join(out, 'smoke-mobile.png') });
  console.log(`UI smoke: ${checks} checks, ${errs.length} problems`);
  if (errs.length) console.log(errs.slice(0, 40).join('\n'));
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
