/* UI wiring: file intake, state, rendering of every tab. */
(function (CFO) {
  const $ = id => document.getElementById(id);
  const esc = CFO.esc;
  const store = {
    get(k) { try { return localStorage.getItem('cfo-lens:' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('cfo-lens:' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  const TABS = ['overview', 'ratios', 'vertical', 'horizontal', 'flags', 'review', 'report'];
  const SUBTOTALS = new Set(['gross_profit', 'operating_income', 'pretax_income', 'net_income', 'current_assets', 'total_assets', 'current_liabilities', 'total_liabilities', 'equity', 'cfo', 'cfi', 'cff']);

  const state = {
    tables: [], files: [], overrides: {}, errors: [], notes: [], isSample: true,
    lang: store.get('lang') === 'ar' ? 'ar' : 'en',
    tab: TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview',
    hMode: 'pct', A: null, F: [],
  };

  // pdf.js runs on the main thread when its worker script is loaded as a plain script (globalThis.pdfjsWorker),
  // which avoids web-worker restrictions in sandboxed frames. Otherwise fall back to the CDN worker.
  if (globalThis.pdfjsLib && !globalThis.pdfjsWorker) globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  /* ---------- intake ---------- */
  let busy = false;
  async function addFiles(fileList) {
    const files = [...(fileList || [])].filter(f => f && f.name);
    if (!files.length || busy) return;
    busy = true;
    $('loading').hidden = false;
    const L = () => CFO.UI[state.lang];
    const wasSample = state.isSample;
    const kept = wasSample ? { tables: [], files: [] } : { tables: state.tables, files: state.files };
    const added = [];
    state.errors = []; state.notes = [];
    try {
      for (const f of files) {
        try {
          const tables = await CFO.parseFile(f);
          const lines = tables.reduce((n, t) => n + t.lines.length, 0);
          if (!lines) { state.errors.push(() => L().errNoLines(f.name)); continue; }
          tables.forEach(t => { t.file = f.name; });
          const matched = tables.reduce((n, t) => n + t.lines.filter(l => CFO.matchLabel(l.label)).length, 0);
          state.notes.push(matched ? () => L().readOk(f.name, tables.length, lines, matched) : () => L().readNoMatch(f.name));
          added.push({ name: f.name, tables, matched });
        } catch (e) {
          const ext = /^unsupported:(.*)$/.exec(e && e.message);
          state.errors.push(ext ? () => L().errUnsupported(ext[1]) : () => `${L().errRead(f.name)} (${(e && e.message) || e})`);
          console.error(e);
        }
      }
      if (added.length) {
        // Dropping a file with the same name again replaces its earlier version.
        const names = new Set(added.map(a => a.name));
        state.tables = [...kept.tables.filter(t => !names.has(t.file)), ...added.flatMap(a => a.tables)];
        state.files = [...kept.files.filter(n => !names.has(n)), ...added.map(a => a.name)];
        state.overrides = {}; state.isSample = false;
        if (!added.some(a => a.matched)) state.tab = 'review';
      } else if (wasSample) {
        state.notes.push(() => L().keptExample);
      }
    } finally {
      busy = false;
      $('loading').hidden = true;
      render();
    }
  }

  function loadSample() {
    state.tables = CFO.sampleTables().map(t => ({ ...t, file: t.source }));
    state.files = state.tables.map(t => t.file);
    state.overrides = {}; state.isSample = true;
  }

  function removeFile(name) {
    state.tables = state.tables.filter(t => t.file !== name);
    state.files = state.files.filter(f => f !== name);
    state.overrides = {};
    if (!state.files.length) loadSample();
    render();
  }

  /* ---------- helpers ---------- */
  const T = () => CFO.UI[state.lang];
  const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;
  const statusPill = s => pill(s || 'na', T().status[s || 'na']);
  const label = r => r.key ? CFO.itemName(r.key, state.lang) : r.label;
  const derivedTag = (r, p) => r.derived?.includes(p) ? `<span class="tag-derived" title="${esc(T().derivedNote)}">${T().derived}</span>` : '';

  function trend(id) {
    const P = state.A.ds.periods; if (P.length < 2) return '';
    const a = state.A.ratios[id][P[P.length - 2]].value, b = state.A.ratios[id][P[P.length - 1]].value, def = CFO.RATIO[id];
    if (a == null || b == null) return '';
    const up = b > a, same = Math.abs(b - a) < Math.abs(a) * 0.01;
    const better = def.dir ? (def.dir === 'high' ? up : !up) : null;
    const cls = same || better == null ? 'flat' : better ? 'up' : 'down';
    return `<span class="${cls}" aria-label="${up ? 'up' : 'down'}">${same ? '→' : up ? '▲' : '▼'}</span>`;
  }

  /* ---------- panels ---------- */
  function renderOverview() {
    const { A, F } = state, L = T(), lang = state.lang, p = A.latest, P = A.ds.periods;
    const h = A.health || {};
    const color = h.score >= 65 ? 'var(--good)' : h.score >= 45 ? 'var(--warn)' : 'var(--bad)';
    const C = 2 * Math.PI * 52, frac = (h.score || 0) / 100;
    $('hero').innerHTML = `
      <div class="gauge" role="img" aria-label="${L.health} ${h.score ?? '—'} ${L.healthOf}">
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--sunk)" stroke-width="10"/><circle cx="60" cy="60" r="52" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}"/></svg>
        <div class="g-val"><div><b>${h.score ?? '—'}</b><span class="muted small">${L.healthOf}</span></div></div>
      </div>
      <div style="min-width:0">
        <h2>${L.health} · ${esc(p || '')}${h.grade ? `<span class="grade" style="background:${color};color:var(--surface)">${h.grade}</span>` : ''}</h2>
        <p>${esc(CFO.summary(A, F, lang))}</p>
        <div class="group-bars">${Object.entries(h.groups || {}).map(([g, v]) => `<span><i style="--w:${v}%;--c:${v >= 65 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)'}"></i>${L.groups[g]}</span>`).join('')}</div>
      </div>`;

    const kpis = [
      ['revenue', 'money', P.map(q => A.ds.data[q].revenue ?? null), true],
      ['net_income', 'money', P.map(q => A.ds.data[q].net_income ?? null), true],
      ['fcf', 'money', P.map(q => A.ratios.fcf[q].value), true],
      ['current_ratio', 'x', P.map(q => A.ratios.current_ratio[q].value), true],
      ['debt_to_equity', 'x', P.map(q => A.ratios.debt_to_equity[q].value), false],
      ['roe', '%', P.map(q => A.ratios.roe[q].value), true],
    ];
    $('kpis').innerHTML = kpis.map(([k, unit, vals, highGood]) => {
      const cur = vals[vals.length - 1], prev = vals[vals.length - 2];
      let delta = '';
      if (cur != null && prev != null && prev !== 0) {
        const ch = unit === 'money' ? (cur - prev) / Math.abs(prev) : cur - prev;
        const good = (ch >= 0) === highGood;
        const txt = unit === 'money' ? CFO.fmtPct(ch, lang) : unit === '%' ? `${(ch * 100).toFixed(1)} ${L.pts}` : CFO.fmtVal('x', ch, lang);
        delta = `<span class="kpi-delta ${Math.abs(ch) < 1e-9 ? 'flat' : good ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${txt.replace(/^\((.*)\)$/, '$1')} <span class="muted">${L.vs} ${P[P.length - 2]}</span></span>`;
      }
      return `<div class="kpi"><span class="kpi-label">${L.kpi[k]}</span><span class="kpi-value">${CFO.fmtVal(unit, cur, lang)}</span>${delta || '<span class="kpi-delta muted">&nbsp;</span>'}${CFO.sparkline(vals)}</div>`;
    }).join('');

    const top = F.slice(0, 3);
    $('top-flags').innerHTML = `<div class="section-head"><h3>${L.flagsTitle}</h3><button class="btn" type="button" data-go="flags">${F.length} →</button></div>
      <div class="list" style="margin-top:10px">${top.length ? top.map(flagCard).join('') : `<p class="muted">${L.noFlags}</p>`}</div>`;
    requestAnimationFrame(() => CFO.drawCharts(A, lang));
  }

  function flagCard(f) {
    const L = T(), lang = state.lang;
    return `<article class="flag ${f.sev}"><div class="flag-head">${pill(f.sev, L.sev[f.sev])}<h3>${esc(f.title[lang])}</h3></div>
      <dl><dt>${L.evidence}</dt><dd class="ev">${esc(f.ev(lang))}</dd><dt>${L.action}</dt><dd>${esc(f.rec[lang])}</dd></dl></article>`;
  }

  function renderRatios() {
    const { A } = state, L = T(), lang = state.lang, P = A.ds.periods;
    const groups = CFO.GROUPS.map(g => {
      const rows = CFO.RATIOS.filter(r => r.group === g).map(def => {
        const cell = A.ratios[def.id][A.latest];
        const missing = def.needs.filter(k => A.ds.periods.every(p => A.ds.data[p][k] == null));
        const meaning = cell.value != null ? CFO.meaning(def.id, cell.value, lang) : `${L.notAvail}: ${missing.map(k => CFO.itemName(k, lang)).join(', ') || '—'}`;
        const avg = P.some(p => A.ratios[def.id][p].avgUsed) ? ` · ${L.avgNote}` : '';
        return `<tr><td><div class="ratio-name">${esc(CFO.ratioName(def.id, lang))}</div><div class="meaning">${esc(meaning)}</div><div class="formula" dir="ltr">${esc(def.f)}${esc(avg)}</div></td>
          ${P.map(p => `<td class="n">${CFO.fmtVal(def.unit, A.ratios[def.id][p].value, lang)}</td>`).join('')}
          <td class="n">${trend(def.id)}</td><td>${cell.value != null && !def.dir ? pill('na', T().status.info) : statusPill(cell.status)}</td></tr>`;
      }).join('');
      return `<div class="card" style="padding:0;overflow:hidden"><div style="padding:14px 16px 10px"><h3>${L.groups[g]}</h3>${g === 'distress' ? `<span class="muted small">${L.zZones}</span>` : ''}</div>
        <div class="table-wrap" style="border:0;border-radius:0;border-top:1px solid var(--line)"><table><thead><tr><th>${L.item}</th>${P.map(p => `<th class="n">${p}</th>`).join('')}<th class="n"></th><th>${A.latest}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }).join('');
    const dp = A.dupont;
    const dupont = `<div class="card"><h3>${L.dupont}</h3><p class="muted small">${L.dupontHint}</p>
      <div class="table-wrap"><table><thead><tr><th>${L.period}</th><th class="n">${CFO.ratioName('net_margin', lang)}</th><th class="n">${CFO.ratioName('asset_turnover', lang)}</th><th class="n">${CFO.ratioName('equity_multiplier', lang)}</th><th class="n">ROE</th></tr></thead>
      <tbody>${dp.map(r => `<tr><td>${r.period}</td><td class="n">${CFO.fmtPct(r.net_margin, lang)}</td><td class="n">${CFO.fmtVal('x', r.asset_turnover, lang)}</td><td class="n">${CFO.fmtVal('x', r.equity_multiplier, lang)}</td><td class="n">${CFO.fmtPct(r.roe, lang)}</td></tr>`).join('')}</tbody></table></div></div>`;
    $('p-ratios').innerHTML = groups + dupont;
  }

  function statementTables(rows, cellsFor, headFor) {
    const L = T(), P = state.A.ds.periods;
    return ['IS', 'BS', 'CF'].map(st => {
      const rs = rows.filter(r => r.st === st);
      if (!rs.length) return '';
      return `<div class="card" style="padding:0;overflow:hidden"><div style="padding:14px 16px 10px"><h3>${L.st[st]}</h3></div>
        <div class="table-wrap" style="border:0;border-radius:0;border-top:1px solid var(--line)"><table><thead><tr><th>${L.item}</th>${headFor(st, P)}</tr></thead>
        <tbody>${rs.map(r => `<tr class="${SUBTOTALS.has(r.key) ? 'subtotal' : ''}"><td>${esc(label(r))}${r.key ? '' : ' <span class="muted small">*</span>'}</td>${cellsFor(r, P)}</tr>`).join('')}</tbody></table></div></div>`;
    }).join('');
  }

  function renderVertical() {
    const L = T(), lang = state.lang;
    const html = statementTables(state.A.vertical,
      (r, P) => P.map(p => {
        const v = r.pct[p];
        const w = v == null ? 0 : Math.min(100, Math.abs(v) * 100);
        return `<td class="n">${v == null ? '—' : CFO.fmtPct(v, lang)}${derivedTag(r, p)}<span class="cell-bar" style="width:${w}%"></span><div class="muted small">${CFO.fmtNum(r.values[p], 0, lang)}</div></td>`;
      }).join(''),
      (st, P) => P.map(p => `<th class="n">${p}<br><span class="small">${st === 'BS' ? L.ofAssets : L.ofRevenue}</span></th>`).join(''));
    $('p-vertical').innerHTML = `<p class="muted small" style="margin:0">${lang === 'en' ? 'Each line as a share of revenue (income statement, cash flow) or of total assets (balance sheet). * = line not matched to a standard item.' : 'كل بند كنسبة من الإيرادات (قائمة الدخل والتدفقات) أو من إجمالي الأصول (الميزانية). * = بند غير مربوط ببند قياسي.'}</p>` + html;
  }

  function renderHorizontal() {
    const L = T(), lang = state.lang, mode = state.hMode;
    const seg = `<div class="seg" role="group">${[['pct', L.yoy + ' %'], ['abs', L.yoy], ['idx', L.index]].map(([m, t]) => `<button type="button" data-hmode="${m}" aria-pressed="${mode === m}">${esc(t)}</button>`).join('')}</div>`;
    const html = statementTables(state.A.horizontal,
      (r, P) => P.map((p, i) => {
        const amt = `<div>${CFO.fmtNum(r.values[p], 0, lang)}${derivedTag(r, p)}</div>`;
        let ch = '';
        if (mode === 'idx') ch = r.idx[p] == null ? '—' : r.idx[p].toFixed(0);
        else if (i > 0) {
          const y = r.yoy[p];
          if (!y) ch = '—';
          else {
            const v = mode === 'pct' ? y.pct : y.abs;
            const cls = v == null || Math.abs(v) < 1e-9 ? 'muted' : v > 0 ? 'heat-up' : 'heat-down';
            ch = v == null ? '—' : `<span class="${cls}">${v > 0 ? '+' : ''}${mode === 'pct' ? CFO.fmtPct(v, lang) : CFO.fmtNum(v, 0, lang)}</span>`;
          }
        }
        return `<td class="n">${amt}<div class="small">${ch}</div></td>`;
      }).join('') + `<td class="n">${r.cagr == null ? '—' : CFO.fmtPct(r.cagr, lang)}</td>`,
      (st, P) => P.map(p => `<th class="n">${p}</th>`).join('') + `<th class="n">${L.cagr}</th>`);
    $('p-horizontal').innerHTML = `<div class="section-head"><p class="muted small" style="margin:0">${lang === 'en' ? 'Amount per year, with the change beneath it. Green = increase, red = decrease (an increase in costs or debt is not automatically good).' : 'القيمة لكل سنة والتغير أسفلها. الأخضر = زيادة والأحمر = نقص (زيادة التكاليف أو الديون ليست أمراً جيداً بالضرورة).'}</p>${seg}</div>` + html;
  }

  function renderFlags() {
    const L = T(), lang = state.lang, S = CFO.strengths(state.A, lang);
    $('p-flags').innerHTML = `<div class="section-head"><h2>${L.flagsTitle}</h2><span class="muted small">${state.F.length}</span></div>
      <div class="list">${state.F.length ? state.F.map(flagCard).join('') : `<p>${L.noFlags}</p>`}</div>
      <div class="card"><h3>${L.strengths}</h3><div class="list" style="margin-top:8px">${S.length ? S.map(s => `<div class="strength"><span>${esc(s.text)}</span></div>`).join('') : '<span class="muted">—</span>'}</div></div>`;
  }

  function renderReview() {
    const L = T(), lang = state.lang, ds = state.A.ds, P = ds.periods;
    const n = k => CFO.itemName(k, lang);
    const opts = key => `<option value="">${L.ignore}</option>` + ['IS', 'BS', 'CF'].map(st => `<optgroup label="${L.st[st]}">${CFO.ITEMS.filter(i => i.st === st).map(i => `<option value="${i.key}"${i.key === key ? ' selected' : ''}>${esc(n(i.key))}</option>`).join('')}</optgroup>`).join('');
    const issues = ds.issues.map(i => `<li>${esc(L.issue[i.type](i, n))}</li>`).join('');
    $('p-review').innerHTML = `<div class="card"><h3>${L.issues}</h3>${issues ? `<ul class="issues" style="margin-top:8px">${issues}</ul>` : `<p class="muted">${L.noIssues}</p>`}</div>
      <div><h2>${L.reviewTitle}</h2><p class="muted small">${L.reviewHint}</p></div>
      <div class="table-wrap"><table><thead><tr><th>${L.source}</th><th>${L.rawLabel}</th><th>${L.mappedTo}</th>${P.map(p => `<th class="n">${p}</th>`).join('')}</tr></thead>
      <tbody>${ds.lines.map(l => `<tr class="${l.key && !l.used ? 'not-used' : ''}"><td class="small muted">${esc(l.source)}</td><td>${esc(l.label)}</td>
        <td><select class="map${l.key ? '' : ' unmapped'}" data-line="${esc(l.id)}" aria-label="${esc(l.label)}">${opts(l.key)}</select></td>
        ${P.map(p => `<td class="n">${CFO.fmtNum(l.values[p], 0, lang)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderReport() {
    const L = T(), { A, F } = state, lang = state.lang;
    $('p-report').innerHTML = `<div class="actions">
        <button class="btn primary" type="button" id="x-xlsx">${L.exportXlsx}</button>
        <button class="btn" type="button" id="x-html">${L.exportHtml}</button>
        <button class="btn" type="button" id="x-md">${L.copyMd}</button><span id="copy-msg" class="muted small" role="status"></span>
      </div>
      <article class="card report">${CFO.reportHTML(A, F, lang)}</article>
      <textarea id="md-out" readonly aria-label="Markdown">${esc(CFO.reportMarkdown(A, F, lang))}</textarea>`;
  }

  /* ---------- shell ---------- */
  function renderChrome() {
    const L = T();
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-t]').forEach(el => {
      const v = el.dataset.t.split('.').reduce((o, k) => o?.[k], L);
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('.tab').forEach(b => {
      const t = b.dataset.tab;
      b.innerHTML = esc(L.tabs[t]) + (t === 'flags' && state.F.length ? `<span class="count">${state.F.length}</span>` : '');
      b.setAttribute('aria-selected', String(t === state.tab));
    });
    TABS.forEach(t => { $('p-' + t).hidden = t !== state.tab; });
    $('sample-notice').hidden = !state.isSample;
    $('files').innerHTML = state.isSample ? '' : `<span class="muted small">${L.filesLoaded}:</span>` +
      state.files.map(f => `<span class="chip" title="${esc(f)}">${esc(f)} <button type="button" class="btn ghost" style="padding:0 4px;border:0" data-remove="${esc(f)}" aria-label="Remove ${esc(f)}">×</button></span>`).join('') +
      ` <button class="btn ghost small" type="button" id="btn-sample">${L.loadSample}</button>`;
    $('errors').innerHTML = state.errors.map(e => `<div class="error" role="alert">${esc(e())}</div>`).join('') +
      state.notes.map(n => `<div class="note" role="status">${esc(n())}</div>`).join('');
  }

  const PANELS = { overview: renderOverview, ratios: renderRatios, vertical: renderVertical, horizontal: renderHorizontal, flags: renderFlags, review: renderReview, report: renderReport };

  function render() {
    const ds = CFO.buildDataset(state.tables, state.overrides);
    state.A = CFO.analyze(ds);
    state.F = CFO.flags(state.A);
    renderChrome();
    if (!ds.periods.length) { $('p-' + state.tab).innerHTML = ''; return; }
    PANELS[state.tab]();
  }

  function setTab(t) {
    state.tab = t;
    try { history.replaceState(null, '', '#' + t); } catch (e) { /* sandboxed */ }
    renderChrome();
    if (state.A?.ds.periods.length) PANELS[t]();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (t) return setTab(t.dataset.tab);
    const g = e.target.closest('[data-go]'); if (g) return setTab(g.dataset.go);
    const h = e.target.closest('[data-hmode]'); if (h) { state.hMode = h.dataset.hmode; return renderHorizontal(); }
    const r = e.target.closest('[data-remove]'); if (r) return removeFile(r.dataset.remove);
    if (e.target.closest('#btn-sample')) { loadSample(); state.errors = []; state.notes = []; return render(); }
    const x = e.target.closest('#x-xlsx, #x-html');
    if (x) {
      const run = x.id === 'x-xlsx' ? CFO.exportXLSX : CFO.exportHTML;
      Promise.resolve().then(() => run(state.A, state.F, state.lang)).then(status => { $('copy-msg').textContent = T().saveStatus[status] || ''; },
        err => { $('copy-msg').textContent = T().unexpected((err && err.message) || err); });
      return;
    }
    if (e.target.closest('#x-md')) {
      const text = CFO.reportMarkdown(state.A, state.F, state.lang), msg = $('copy-msg');
      const fail = () => { msg.textContent = T().copyFail; $('md-out').select(); };
      try { navigator.clipboard.writeText(text).then(() => { msg.textContent = T().copied; }, fail); } catch (err) { fail(); }
    }
  });
  document.addEventListener('change', e => {
    if (e.target.matches('select.map')) { state.overrides[e.target.dataset.line] = e.target.value; render(); }
    if (e.target.id === 'file-input') { addFiles(e.target.files); e.target.value = ''; }
  });
  $('btn-lang').addEventListener('click', () => { state.lang = state.lang === 'en' ? 'ar' : 'en'; store.set('lang', state.lang); render(); });
  $('btn-theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('theme', root.dataset.theme);
    if (state.tab === 'overview') CFO.drawCharts(state.A, state.lang);
  });
  const theme = store.get('theme'); if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.tab === 'overview') CFO.drawCharts(state.A, state.lang); });

  // File intake: drop (on the card or anywhere), click / keyboard on the card, or paste copied files.
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  let depth = 0;
  const onDragOver = e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  for (const target of [document, $('drop')]) {
    target.addEventListener('dragover', onDragOver);
    target.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); if (target === document) { depth++; document.body.classList.add('dragging'); } });
  }
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging'); } });
  document.addEventListener('drop', e => {
    if (!hasFiles(e) && !e.dataTransfer?.files?.length) return;
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
    addFiles(e.dataTransfer.files);
  });
  $('drop').addEventListener('click', e => { if (!e.target.closest('label, input')) $('file-input').click(); });
  $('drop').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file-input').click(); } });
  document.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  // Never fail silently: unexpected errors and missing libraries are shown on the page.
  const showUnexpected = msg => { state.errors.push(() => T().unexpected(msg)); $('loading').hidden = true; busy = false; renderChrome(); };
  window.addEventListener('error', e => { if (e.message) showUnexpected(e.message); });
  window.addEventListener('unhandledrejection', e => showUnexpected((e.reason && e.reason.message) || String(e.reason)));
  const missing = [['SheetJS (Excel)', 'XLSX'], ['PapaParse (CSV)', 'Papa'], ['pdf.js (PDF)', 'pdfjsLib'], ['Chart.js (charts)', 'Chart']]
    .filter(([, g]) => !globalThis[g]).map(([n]) => n);

  loadSample();
  if (missing.length) state.errors.push(() => T().libMissing(missing.join(', ')));
  render();
  CFO.state = state; CFO.addFiles = addFiles;
})(globalThis.CFO = globalThis.CFO || {});
