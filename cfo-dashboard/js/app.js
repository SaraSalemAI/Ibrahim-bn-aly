/* UI wiring: file intake, state, rendering of every tab. */
(function (CFO) {
  const $ = id => document.getElementById(id);
  const esc = CFO.esc;
  const store = {
    get(k) { try { return localStorage.getItem('cfo-lens:' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('cfo-lens:' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  const TABS = ['overview', 'ratios', 'vertical', 'horizontal', 'flags', 'forecast', 'review', 'report'];
  const SUBTOTALS = new Set(['gross_profit', 'operating_income', 'pretax_income', 'net_income', 'current_assets', 'total_assets', 'current_liabilities', 'total_liabilities', 'equity', 'cfo', 'cfi', 'cff']);

  const state = {
    tables: [], files: [], overrides: {}, errors: [], notes: [], isSample: true,
    lang: store.get('lang') === 'ar' ? 'ar' : 'en',
    tab: TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview',
    hMode: 'pct', A: null, F: [],
    sector: CFO.SECTORS[store.get('sector')] ? store.get('sector') : 'general',
    drivers: null, fcYears: 3, S: null,            // forecast: drivers (null = from history), scenarios
    ai: { text: '', busy: false, err: '', ctl: null }, aiOn: false,
    diagNumbers: false, diagOpen: false,
  };
  CFO.setSector(state.sector);
  // Anything that changes the data starts the forecast and the commentary afresh.
  const dataChanged = () => { state.drivers = null; state.ai.ctl?.abort(); state.ai = { text: '', busy: false, err: '', ctl: null }; };
  // Everything the report and the exports need, in one object.
  const ctx = () => ({ A: state.A, F: state.F, S: state.S, ai: state.ai.text, lang: state.lang });

  // pdf.js runs on the main thread when its worker script is loaded as a plain script (globalThis.pdfjsWorker),
  // which avoids web-worker restrictions in sandboxed frames. Otherwise fall back to the CDN worker.
  if (globalThis.pdfjsLib && !globalThis.pdfjsWorker) globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  CFO.BUILD = '2026-10-03.6';

  /* ---------- intake ---------- */
  // What happened to each attempt, for the diagnostics box (Data review) the user can copy to support.
  const diag = { events: { drop: 0, chooser: 0, pasteFiles: 0, pasteTable: 0 }, files: [], errors: [] };
  const withTimeout = (promise, ms, what) => Promise.race([promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout:${what}`)), ms))]);
  let busy = false, queued = [];
  async function addFiles(fileList) {
    const files = [...(fileList || [])].filter(f => f && f.name);
    if (!files.length) return;
    // Files arriving while others are read wait their turn instead of being ignored.
    if (busy) { queued.push(...files); return; }
    busy = true;
    $('loading').hidden = false;
    const L = () => CFO.UI[state.lang];
    const wasSample = state.isSample;
    const kept = wasSample ? { tables: [], files: [] } : { tables: state.tables, files: state.files };
    const added = [];
    state.errors = []; state.notes = [];
    try {
      for (const f of files) {
        const info = { name: f.name, size: f.size, type: f.type || '?', started: Date.now() };
        diag.files.push(info);
        try {
          // A reader that never finishes must not freeze the page: give up after 60 s.
          const tables = await withTimeout(f.tables ? Promise.resolve(f.tables) : CFO.parseFile(f), 60000, f.name);
          const lines = tables.reduce((n, t) => n + t.lines.length, 0);
          info.ms = Date.now() - info.started;
          info.tables = tables.map(t => ({ source: t.source, periods: t.periods, lines: t.lines.length, labels: t.lines.map(l => l.label), values: t.lines.map(l => l.values) }));
          if (!lines) { info.result = 'no lines with year columns'; state.errors.push(() => L().errNoLines(f.name)); continue; }
          tables.forEach(t => { t.file = f.name; });
          const matched = tables.reduce((n, t) => n + t.lines.filter(l => CFO.matchLabel(l.label)).length, 0);
          info.result = `${lines} lines, ${matched} matched`;
          state.notes.push(matched ? () => L().readOk(f.name, tables.length, lines, matched) : () => L().readNoMatch(f.name));
          added.push({ name: f.name, tables, matched });
        } catch (e) {
          const msg = (e && e.message) || String(e);
          info.result = 'error: ' + msg; info.ms = Date.now() - info.started;
          const ext = /^unsupported:(.*)$/.exec(msg);
          state.errors.push(ext ? () => L().errUnsupported(ext[1]) : /^timeout:/.test(msg) ? () => L().errTimeout(f.name) : () => `${L().errRead(f.name)} (${msg})`);
          console.error(e);
        }
      }
      if (added.length) {
        // Dropping a file with the same name again replaces its earlier version.
        const names = new Set(added.map(a => a.name));
        state.tables = [...kept.tables.filter(t => !names.has(t.file)), ...added.flatMap(a => a.tables)];
        state.files = [...kept.files.filter(n => !names.has(n)), ...added.map(a => a.name)];
        state.overrides = {}; state.isSample = false; dataChanged();
        if (!added.some(a => a.matched)) { state.tab = 'review'; state.diagOpen = true; }
      } else if (wasSample) {
        state.notes.push(() => L().keptExample);
        state.diagOpen = true;
      }
    } finally {
      busy = false;
      $('loading').hidden = true;
      render();
      if (queued.length) { const next = queued; queued = []; addFiles(next); }
    }
  }

  /** Cells copied from Excel (or any table) and pasted as text: read like a tab-separated file. */
  function addPastedTable(text) {
    if (!text || !text.trim()) return;
    diag.events.pasteTable++;
    const n = state.files.filter(f => /^Pasted table/.test(f)).length + 1;
    const name = `Pasted table ${n}`;
    const tables = CFO.csvTables(new TextEncoder().encode(text), name);
    addFiles([{ name, size: text.length, type: 'text/plain (pasted)', tables }]);
  }

  /** Plain-text report of what the page saw, for the user to paste into a support chat. */
  const KEY_ITEMS = ['revenue', 'cogs', 'net_income', 'total_assets', 'current_assets', 'current_liabilities', 'total_liabilities', 'equity', 'cash', 'receivables', 'inventory', 'payables', 'cfo'];
  function diagnosticsText(withNumbers) {
    const ds = state.A?.ds, last = ds?.periods[ds.periods.length - 1], d = last ? ds.data[last] : {};
    const libs = [['SheetJS', 'XLSX'], ['PapaParse', 'Papa'], ['pdf.js', 'pdfjsLib'], ['pdf.js worker', 'pdfjsWorker'], ['Chart.js', 'Chart'], ['jsPDF', 'jspdf'], ['html2canvas', 'html2canvas'], ['docx', 'docx']];
    const out = [
      `CFO Lens diagnostics · build ${CFO.BUILD} · ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      `claude.ai viewer: ${globalThis.claude?.use ? 'yes' : 'no'} · language ${state.lang} · sector ${state.sector} · tab ${state.tab}`,
      `Libraries: ${libs.map(([n, g]) => `${n} ${globalThis[g] ? 'ok' : 'MISSING'}`).join(', ')}`,
      `Events: drop ${diag.events.drop}, choose ${diag.events.chooser}, paste files ${diag.events.pasteFiles}, paste table ${diag.events.pasteTable}`,
      `Showing: ${state.isSample ? 'example data' : state.files.join(', ')}`,
      `Periods: ${ds ? ds.periods.join(', ') : '-'}`,
      `Found in ${last || '-'}: ${KEY_ITEMS.filter(k => d[k] != null).join(', ') || 'none'}`,
      `Missing in ${last || '-'}: ${KEY_ITEMS.filter(k => d[k] == null).join(', ') || 'none'}`,
      `Ratios available: ${ds ? CFO.RATIOS.filter(r => state.A.ratios[r.id][last]?.value != null).length : 0} of ${CFO.RATIOS.length}`,
      `Data checks: ${ds ? ds.issues.map(i => i.type + (i.period ? ' ' + i.period : '') + (i.key ? ' ' + i.key : '')).join('; ') || 'ok' : '-'}`,
      '', 'Files:',
    ];
    if (!diag.files.length) out.push('  (no file received by the page yet)');
    for (const f of diag.files) {
      out.push(`- ${f.name} (${f.size} bytes, ${f.type}): ${f.result || 'still reading'}${f.ms != null ? `, ${f.ms} ms` : ''}`);
      for (const t of f.tables || []) {
        out.push(`  table "${t.source}": years [${t.periods.join(', ')}], ${t.lines} lines`);
        t.labels.slice(0, 40).forEach((l, i) => {
          const key = CFO.matchLabel(l);
          out.push(`    ${l}${key ? ` -> ${key}` : ' -> (not matched)'}${withNumbers ? ` ${JSON.stringify(t.values[i])}` : ''}`);
        });
        if (t.labels.length > 40) out.push(`    ... ${t.labels.length - 40} more`);
      }
    }
    out.push('', `Errors: ${diag.errors.length ? diag.errors.slice(-8).join(' | ') : 'none'}`);
    return out.join('\n');
  }

  function loadSample() {
    state.tables = CFO.sampleTables().map(t => ({ ...t, file: t.source }));
    state.files = state.tables.map(t => t.file);
    state.overrides = {}; state.isSample = true; dataChanged();
  }

  function removeFile(name) {
    state.tables = state.tables.filter(t => t.file !== name);
    state.files = state.files.filter(f => f !== name);
    state.overrides = {}; dataChanged();
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
    // Ratios that cannot be computed are explained instead of showing silent dashes.
    const missingIssues = A.ds.issues.filter(i => i.type === 'missing');
    $('missing-card').hidden = state.isSample || !missingIssues.length;
    $('missing-card').innerHTML = missingIssues.length ? `<h3>${esc(L.missingTitle)}</h3><p>${esc(L.missingBody(missingIssues.map(i => CFO.itemName(i.key, lang)).join(lang === 'ar' ? '، ' : ', ')))}</p>
      <div class="actions"><button class="btn primary" type="button" data-go="review">${esc(L.openReview)}</button></div>` : '';
    $('ai-overview').innerHTML = aiPanel();
    $('ai-overview').hidden = !state.aiOn;
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
          <td class="n muted">${CFO.fmtVal(def.unit, CFO.bench(def.id).typical, lang)}</td>
          <td class="n">${trend(def.id)}</td><td>${cell.value != null && !def.dir ? pill('na', T().status.info) : statusPill(cell.status)}</td></tr>`;
      }).join('');
      return `<div class="card" style="padding:0;overflow:hidden"><div style="padding:14px 16px 10px"><h3>${L.groups[g]}</h3>${g === 'distress' ? `<span class="muted small">${L.zZones}</span>` : ''}</div>
        <div class="table-wrap" style="border:0;border-radius:0;border-top:1px solid var(--line)"><table><thead><tr><th>${L.item}</th>${P.map(p => `<th class="n">${p}</th>`).join('')}<th class="n">${L.typical}</th><th class="n"></th><th>${A.latest}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }).join('');
    const dp = A.dupont;
    const dupont = `<div class="card"><h3>${L.dupont}</h3><p class="muted small">${L.dupontHint}</p>
      <div class="table-wrap"><table><thead><tr><th>${L.period}</th><th class="n">${CFO.ratioName('net_margin', lang)}</th><th class="n">${CFO.ratioName('asset_turnover', lang)}</th><th class="n">${CFO.ratioName('equity_multiplier', lang)}</th><th class="n">ROE</th></tr></thead>
      <tbody>${dp.map(r => `<tr><td>${r.period}</td><td class="n">${CFO.fmtPct(r.net_margin, lang)}</td><td class="n">${CFO.fmtVal('x', r.asset_turnover, lang)}</td><td class="n">${CFO.fmtVal('x', r.equity_multiplier, lang)}</td><td class="n">${CFO.fmtPct(r.roe, lang)}</td></tr>`).join('')}</tbody></table></div></div>`;
    const sectorNote = `<p class="muted small" style="margin:0">${esc(L.sector)}: <b>${esc(CFO.sectorName(state.sector, lang))}</b>. ${esc(L.sectorNote)}</p>`;
    $('p-ratios').innerHTML = sectorNote + groups + dupont;
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
    const D = L.diag;
    const diagCard = `<details class="card" id="diag" ${state.diagOpen ? 'open' : ''}><summary><h3 style="display:inline">${esc(D.title)}</h3></summary>
      <p class="muted small">${esc(D.hint)}</p>
      <div class="actions"><label class="small"><input type="checkbox" id="diag-num" ${state.diagNumbers ? 'checked' : ''}> ${esc(D.withNumbers)}</label>
        <button class="btn primary" type="button" data-diag="copy">${esc(D.copy)}</button><span class="muted small" id="diag-msg" role="status"></span></div>
      <textarea id="diag-out" readonly aria-label="${esc(D.title)}">${esc(diagnosticsText(state.diagNumbers))}</textarea></details>`;
    $('p-review').innerHTML = diagCard + `<div class="card"><h3>${L.issues}</h3>${issues ? `<ul class="issues" style="margin-top:8px">${issues}</ul>` : `<p class="muted">${L.noIssues}</p>`}</div>
      <div><h2>${L.reviewTitle}</h2><p class="muted small">${L.reviewHint}</p></div>
      <div class="table-wrap"><table><thead><tr><th>${L.source}</th><th>${L.rawLabel}</th><th>${L.mappedTo}</th>${P.map(p => `<th class="n">${p}</th>`).join('')}</tr></thead>
      <tbody>${ds.lines.map(l => `<tr class="${l.key && !l.used ? 'not-used' : ''}"><td class="small muted">${esc(l.source)}</td><td>${esc(l.label)}</td>
        <td><select class="map${l.key ? '' : ' unmapped'}" data-line="${esc(l.id)}" aria-label="${esc(l.label)}">${opts(l.key)}</select></td>
        ${P.map(p => `<td class="n">${CFO.fmtNum(l.values[p], 0, lang)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderReport() {
    const L = T();
    $('p-report').innerHTML = `<div class="actions">
        <button class="btn primary" type="button" data-export="pdf">${L.exportPdf}</button>
        <button class="btn primary" type="button" data-export="docx">${L.exportDocx}</button>
        <button class="btn" type="button" data-export="xlsx">${L.exportXlsx}</button>
        <button class="btn" type="button" data-export="html">${L.exportHtml}</button>
        <button class="btn" type="button" id="x-md">${L.copyMd}</button><span id="copy-msg" class="muted small" role="status"></span>
      </div>
      ${state.aiOn ? `<div class="card" id="ai-report">${aiPanel()}</div>` : ''}
      <article class="card report" id="report-doc">${CFO.reportHTML(ctx())}</article>
      <textarea id="md-out" readonly aria-label="Markdown">${esc(CFO.reportMarkdown(ctx()))}</textarea>`;
  }

  /* ---------- Claude commentary ---------- */
  function aiPanel() {
    const L = T().ai, a = state.ai;
    const body = a.busy && !a.text ? `<p class="muted">${esc(L.thinking)}</p>` : a.text ? `<div class="ai-text">${CFO.md(a.text)}</div><p class="muted small">${esc(L.note)}</p>` : '';
    return `<div class="section-head"><h3>${esc(L.title)}</h3></div>
      <p class="muted small" style="margin:4px 0 10px">${esc(L.hint)}</p>
      <form class="ai-ask" data-ai-form>
        <input class="ai-q" name="q" type="text" placeholder="${esc(L.placeholder)}" aria-label="${esc(L.placeholder)}" ${a.busy ? 'disabled' : ''}>
        <button class="btn" type="submit" ${a.busy ? 'disabled' : ''}>${esc(L.askQ)}</button>
        <button class="btn primary" type="button" data-ai="ask" ${a.busy ? 'disabled' : ''}>${esc(L.ask)}</button>
        ${a.busy ? `<button class="btn" type="button" data-ai="stop">${esc(L.stop)}</button>` : ''}
      </form>
      ${a.err ? `<div class="error" role="alert" style="margin-top:10px">${esc(a.err)}</div>` : ''}
      <div class="ai-out" aria-live="polite">${body}</div>`;
  }

  function refreshAi() {
    for (const id of ['ai-overview', 'ai-report']) { const el = $(id); if (el) el.innerHTML = aiPanel(); }
  }
  // While streaming, only the visible answer is redrawn, at most once per frame.
  let aiFrame = 0;
  function refreshAiText() {
    if (aiFrame) return;
    aiFrame = requestAnimationFrame(() => {
      aiFrame = 0;
      const out = document.querySelector(`#${state.tab === 'report' ? 'ai-report' : 'ai-overview'} .ai-out`);
      if (out) out.innerHTML = `<div class="ai-text">${CFO.md(state.ai.text)}</div>`;
    });
  }

  async function runAi(question) {
    if (state.ai.busy) return;
    const ctl = new AbortController();
    state.ai = { text: '', busy: true, err: '', ctl };
    refreshAi();
    try {
      const { text } = await CFO.askClaude(state.A, state.F, state.S, state.lang, question, {
        signal: ctl.signal, onText: ({ text }) => { if (state.ai.ctl === ctl) { state.ai.text = text; refreshAiText(); } },
      });
      if (state.ai.ctl === ctl) state.ai.text = text;
    } catch (e) {
      if (state.ai.ctl !== ctl) return;
      state.ai.text = e?.text || state.ai.text;
      const errs = T().ai.err;
      const stopped = ctl.signal.aborted || e?.code === 'cancelled' || e?.name === 'AbortError';
      state.ai.err = stopped ? '' : (errs[e?.code] || errs.other);
    } finally {
      if (state.ai.ctl === ctl) { state.ai.busy = false; state.ai.ctl = null; refreshAi(); if (state.tab === 'report') renderReport(); }
    }
  }

  /* ---------- forecast ---------- */
  function renderForecast() {
    const L = T(), F = L.fc, lang = state.lang, ds = state.A.ds;
    const missing = CFO.forecastMissing(ds);
    if (missing.length) { $('p-forecast').innerHTML = `<div class="card"><h2>${esc(F.title)}</h2><p>${esc(F.missing(missing.map(k => CFO.itemName(k, lang)).join(lang === 'ar' ? '، ' : ', ')))}</p></div>`; return; }
    const S = state.S, dr = state.drivers, P = ds.periods, last = P[P.length - 1];
    const fmtDriver = (k, v) => CFO.FORECAST_DRIVERS[k][3] === '%' ? +(v * 100).toFixed(2) : Math.round(v);
    const inputs = Object.entries(CFO.FORECAST_DRIVERS).map(([k, [lo, hi, step, unit]]) => {
      const pct = unit === '%';
      return `<label class="driver"><span>${esc(F.d[k])}</span><span class="driver-in"><input type="number" data-driver="${k}" id="drv-${k}" value="${fmtDriver(k, dr[k])}"
        ${lo != null ? `min="${pct ? lo * 100 : lo}" max="${pct ? hi * 100 : hi}" step="${pct ? +(step * 100).toFixed(2) : step}"` : 'step="100"'}><em>${pct ? '%' : unit === 'days' ? esc(L.days) : ''}</em></span></label>`;
    }).join('');
    const fc = CFO.reportModel(ctx()).forecast;   // the same comparison the report uses
    const compare = `<div class="table-wrap"><table><thead><tr>${fc.head.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${fc.rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const lines = ['revenue', 'gross_profit', 'operating_income', 'interest', 'net_income', 'cash', 'receivables', 'inventory', 'total_assets', 'short_debt', 'long_debt', 'total_liabilities', 'equity', 'cfo', 'capex', 'dividends'];
    const detail = `<div class="table-wrap"><table><thead><tr><th>${esc(L.item)}</th><th class="n">${last}</th>${S.base.years.map(y => `<th class="n">${y.period}</th>`).join('')}</tr></thead>
      <tbody>${lines.map(k => `<tr class="${SUBTOTALS.has(k) ? 'subtotal' : ''}"><td>${esc(CFO.itemName(k, lang))}</td><td class="n">${CFO.fmtNum(ds.data[last][k], 0, lang)}</td>${S.base.years.map(y => `<td class="n">${CFO.fmtNum(y.data[k], 0, lang)}</td>`).join('')}</tr>`).join('')}
      <tr><td>${esc(F.funding)}</td><td class="n">—</td>${S.base.years.map(y => `<td class="n${y.fundingNeed ? ' heat-down' : ''}">${CFO.fmtNum(y.fundingNeed, 0, lang)}</td>`).join('')}</tr></tbody></table></div>`;
    const down = S.downside.F.slice(0, 4);
    $('p-forecast').innerHTML = `<div class="card"><div class="section-head"><h2>${esc(F.title)}</h2>
        <span class="actions"><label class="small">${esc(F.years)} <select id="fc-years">${[1, 2, 3].map(n => `<option${n === state.fcYears ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <button class="btn" type="button" data-fc="reset">${esc(F.reset)}</button></span></div>
        <p class="muted small">${esc(F.hint)}</p>
        <h3 style="margin-top:12px">${esc(F.drivers)}</h3><div class="drivers">${inputs}</div>
        <p class="muted small" style="margin-bottom:0">${esc(F.scHint)}</p></div>
      <div class="card"><h3>${esc(F.compare)}</h3>${compare}</div>
      <div class="grid-2">
        <div class="card"><h3>${esc(F.cash)}</h3><div class="chart-box"><canvas id="c-fc-cash" role="img" aria-label="${esc(F.cash)}"></canvas></div></div>
        <div class="card"><h3>${esc(F.ni)}</h3><div class="chart-box"><canvas id="c-fc-ni" role="img" aria-label="${esc(F.ni)}"></canvas></div></div>
      </div>
      <div class="card"><h3>${esc(F.detail)}</h3>${detail}</div>
      <div class="card"><h3>${esc(F.flagsIn(F.sc.downside))}</h3><div class="list" style="margin-top:8px">${down.length ? down.map(flagCard).join('') : `<p class="muted">${L.noFlags}</p>`}</div>
        <p class="muted small">${esc(F.note)}</p></div>`;
    requestAnimationFrame(() => CFO.drawForecastCharts(state.S, ds, lang));
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
    $('paste-in').placeholder = L.pastePlaceholder;
    $('sector').innerHTML = Object.keys(CFO.SECTORS).map(k => `<option value="${k}"${k === state.sector ? ' selected' : ''}>${esc(CFO.sectorName(k, state.lang))}</option>`).join('');
    $('sector').setAttribute('aria-label', L.sector);
    $('files').innerHTML = state.isSample ? '' : `<span class="muted small">${L.filesLoaded}:</span>` +
      state.files.map(f => `<span class="chip" title="${esc(f)}">${esc(f)} <button type="button" class="btn ghost" style="padding:0 4px;border:0" data-remove="${esc(f)}" aria-label="Remove ${esc(f)}">×</button></span>`).join('') +
      ` <button class="btn ghost small" type="button" id="btn-sample">${L.loadSample}</button>`;
    $('errors').innerHTML = state.errors.map(e => `<div class="error" role="alert">${esc(e())}</div>`).join('') +
      state.notes.map(n => `<div class="note" role="status">${esc(n())}</div>`).join('');
  }

  const PANELS = { overview: renderOverview, ratios: renderRatios, vertical: renderVertical, horizontal: renderHorizontal, flags: renderFlags, forecast: renderForecast, review: renderReview, report: renderReport };

  function render() {
    const ds = CFO.buildDataset(state.tables, state.overrides);
    state.A = CFO.analyze(ds);
    state.F = CFO.flags(state.A);
    state.S = null;
    if (ds.periods.length && !CFO.forecastMissing(ds).length) {
      state.drivers = state.drivers || CFO.defaultDrivers(ds);
      state.S = CFO.runScenarios(ds, state.drivers, state.fcYears);
    }
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

  // Chart colours come from CSS tokens, so a theme change redraws the visible charts.
  const redrawCharts = () => {
    if (state.tab === 'overview') CFO.drawCharts(state.A, state.lang);
    if (state.tab === 'forecast') CFO.drawForecastCharts(state.S, state.A.ds, state.lang);
  };

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (t) return setTab(t.dataset.tab);
    const g = e.target.closest('[data-go]'); if (g) return setTab(g.dataset.go);
    const h = e.target.closest('[data-hmode]'); if (h) { state.hMode = h.dataset.hmode; return renderHorizontal(); }
    const r = e.target.closest('[data-remove]'); if (r) return removeFile(r.dataset.remove);
    if (e.target.closest('#btn-sample')) { loadSample(); state.errors = []; state.notes = []; return render(); }
    const x = e.target.closest('[data-export]');
    if (x) {
      const run = { xlsx: CFO.exportXLSX, html: CFO.exportHTML, docx: CFO.exportDOCX, pdf: CFO.exportPDF }[x.dataset.export];
      const msg = $('copy-msg'); msg.textContent = T().building;
      document.querySelectorAll('[data-export]').forEach(b => { b.disabled = true; });
      Promise.resolve().then(() => run(ctx(), $('report-doc'))).then(status => { msg.textContent = T().saveStatus[status] || ''; },
        err => { console.error(err); msg.textContent = T().unexpected((err && err.message) || err); })
        .finally(() => document.querySelectorAll('[data-export]').forEach(b => { b.disabled = false; }));
      return;
    }
    if (e.target.closest('[data-fc="reset"]')) { state.drivers = null; return render(); }
    if (e.target.closest('[data-paste="go"]')) { addPastedTable($('paste-in').value); $('paste-in').value = ''; return; }
    if (e.target.closest('[data-diag="copy"]')) {
      const text = diagnosticsText(state.diagNumbers), msg = $('diag-msg');
      const fail = () => { msg.textContent = T().copyFail; $('diag-out').select(); };
      try { navigator.clipboard.writeText(text).then(() => { msg.textContent = T().copied; }, fail); } catch (err) { fail(); }
      return;
    }
    if (e.target.closest('[data-ai="ask"]')) return runAi('');
    if (e.target.closest('[data-ai="stop"]')) { state.ai.ctl?.abort(); return; }
    if (e.target.closest('#x-md')) {
      const text = CFO.reportMarkdown(ctx()), msg = $('copy-msg');
      const fail = () => { msg.textContent = T().copyFail; $('md-out').select(); };
      try { navigator.clipboard.writeText(text).then(() => { msg.textContent = T().copied; }, fail); } catch (err) { fail(); }
    }
  });
  document.addEventListener('submit', e => {
    if (!e.target.matches('[data-ai-form]')) return;
    e.preventDefault();
    const q = (e.target.querySelector('.ai-q')?.value || '').trim();
    if (q) runAi(q);
  });
  document.addEventListener('change', e => {
    if (e.target.matches('select.map')) { state.overrides[e.target.dataset.line] = e.target.value; dataChanged(); render(); }
    if (e.target.id === 'sector') {
      // Commentary was written against the old sector's limits and flags, so it is cleared.
      state.ai.ctl?.abort(); state.ai = { text: '', busy: false, err: '', ctl: null };
      state.sector = e.target.value; store.set('sector', state.sector); CFO.setSector(state.sector); render();
    }
    if (e.target.matches('[data-driver]')) {
      const k = e.target.dataset.driver, unit = CFO.FORECAST_DRIVERS[k][3], v = parseFloat(e.target.value);
      if (isFinite(v)) { state.drivers = { ...state.drivers, [k]: CFO.clampDriver(k, unit === '%' ? v / 100 : v) }; render(); }
    }
    if (e.target.id === 'fc-years') { state.fcYears = +e.target.value; render(); }
    if (e.target.id === 'diag-num') { state.diagNumbers = e.target.checked; state.diagOpen = true; renderReview(); }
    if (e.target.id === 'file-input') { diag.events.chooser++; addFiles(e.target.files); e.target.value = ''; }
  });
  $('btn-lang').addEventListener('click', () => { state.lang = state.lang === 'en' ? 'ar' : 'en'; store.set('lang', state.lang); render(); });
  $('btn-theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('theme', root.dataset.theme);
    redrawCharts();
  });
  const theme = store.get('theme'); if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { redrawCharts(); });

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
    diag.events.drop++;
    addFiles(e.dataTransfer.files);
  });
  $('drop').addEventListener('click', e => { if (!e.target.closest('label, input, textarea, button, details')) $('file-input').click(); });
  $('drop').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file-input').click(); } });
  document.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); diag.events.pasteFiles++; addFiles(files); return; }
    // Text pasted outside an input (cells copied from Excel) is read as a table.
    const text = e.clipboardData?.getData('text/plain');
    if (text && !e.target.closest('input, textarea') && /\t/.test(text)) { e.preventDefault(); addPastedTable(text); }
  });

  // Never fail silently: unexpected errors and missing libraries are shown on the page.
  const showUnexpected = msg => { diag.errors.push(msg); };
  const showUnexpectedBanner = msg => { state.errors.push(() => T().unexpected(msg)); $('loading').hidden = true; busy = false; renderChrome(); };
  window.addEventListener('error', e => { if (e.message) { showUnexpected(e.message); showUnexpectedBanner(e.message); } });
  window.addEventListener('unhandledrejection', e => { const m = (e.reason && e.reason.message) || String(e.reason); showUnexpected(m); showUnexpectedBanner(m); });
  const missing = [['SheetJS (Excel)', 'XLSX'], ['PapaParse (CSV)', 'Papa'], ['pdf.js (PDF)', 'pdfjsLib'], ['Chart.js (charts)', 'Chart'], ['jsPDF (PDF report)', 'jspdf'], ['html2canvas (PDF report)', 'html2canvas'], ['docx (Word report)', 'docx']]
    .filter(([, g]) => !globalThis[g]).map(([n]) => n);

  // Claude commentary appears only where the claude.ai viewer offers it.
  CFO.aiAvailable().then(on => { state.aiOn = on; if (on && ['overview', 'report'].includes(state.tab)) PANELS[state.tab](); });
  loadSample();
  if (missing.length) state.errors.push(() => T().libMissing(missing.join(', ')));
  render();
  CFO.state = state; CFO.addFiles = addFiles; CFO.diagnosticsText = diagnosticsText; CFO.addPastedTable = addPastedTable;
})(globalThis.CFO = globalThis.CFO || {});
