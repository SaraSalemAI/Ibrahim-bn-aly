/* Report generation and exports (PDF, Word, Excel, HTML, Markdown). Everything is built in the browser.
 * R = { A, F, S, ai, lang }: analysis, red flags, forecast scenarios, Claude commentary text, language.
 * One report model feeds every format, so they always say the same thing.
 */
(function (CFO) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY_RATIOS = ['current_ratio', 'quick_ratio', 'gross_margin', 'operating_margin', 'net_margin', 'roe', 'roce', 'dso', 'ccc', 'debt_to_equity', 'interest_coverage', 'net_debt_to_ebitda', 'fcf', 'cash_conversion', 'altman_z'];
  const VERTICAL_ITEMS = ['revenue', 'cogs', 'gross_profit', 'opex', 'operating_income', 'net_income', 'cash', 'receivables', 'inventory', 'current_assets', 'ppe', 'total_assets', 'current_liabilities', 'total_liabilities', 'equity'];

  /** Items a person should check before the report is used for decisions. */
  function reviewItems(A, F, lang, ai) {
    const L = CFO.UI[lang], ds = A.ds, out = [];
    const n = k => CFO.itemName(k, lang);
    ds.issues.forEach(i => out.push(L.issue[i.type](i, n)));
    const derived = new Set(ds.periods.flatMap(p => [...ds.derived[p]]));
    if (derived.size) out.push((lang === 'en' ? 'Derived (not read from a file): ' : 'بنود محسوبة (غير مقروءة من ملف): ') + [...derived].map(n).join(lang === 'en' ? ', ' : '، '));
    if (ds.sources.some(s => /\.pdf/i.test(s))) out.push(lang === 'en' ? 'PDF input: verify each number against the original statement.' : 'ملفات PDF: طابق كل رقم مع القوائم الأصلية.');
    F.filter(f => f.sev === 'high').forEach(f => out.push((lang === 'en' ? 'Confirm the cause of: ' : 'تأكد من سبب: ') + f.title[lang]));
    out.push(lang === 'en' ? `Sector benchmarks (${CFO.sectorName(CFO.getSector(), lang)}) are indicative; compare with real peers.` : `معايير القطاع (${CFO.sectorName(CFO.getSector(), lang)}) استرشادية؛ قارن بمنافسين فعليين.`);
    if (ai) out.push(L.ai.note);
    return out;
  }

  /** Everything the report says, as plain data. */
  function model(R) {
    const { A, F, S, ai, lang } = R, L = CFO.UI[lang], P = A.ds.periods, p = A.latest, ds = A.ds;
    const statusText = (id, cell) => L.status[cell.status || (cell.value != null && !CFO.RATIO[id].dir ? 'info' : 'na')];
    const m = {
      lang, title: L.reportTitle,
      meta: `${ds.sources.join(' · ')} · ${P.join(', ')} · ${L.sector}: ${CFO.sectorName(CFO.getSector(), lang)}`,
      summary: CFO.summary(A, F, lang),
      ratios: {
        head: [L.item, ...P, L.typical, p, L.meaning],
        rows: KEY_RATIOS.map(id => { const def = CFO.RATIO[id], cell = A.ratios[id][p];
          return [CFO.ratioName(id, lang), ...P.map(q => CFO.fmtVal(def.unit, A.ratios[id][q].value, lang)), CFO.fmtVal(def.unit, CFO.bench(id).typical, lang), statusText(id, cell), CFO.meaning(id, cell.value, lang)]; }),
        status: KEY_RATIOS.map(id => A.ratios[id][p].status || 'na'),
      },
      vertical: {
        head: [L.item, ...P.map(q => `${q} %`)],
        rows: VERTICAL_ITEMS.map(k => A.vertical.find(r => r.key === k)).filter(Boolean).map(r => [CFO.itemName(r.key, lang), ...P.map(q => CFO.fmtPct(r.pct[q], lang))]),
      },
      horizontal: {
        head: [L.item, ...P.slice(1).map(q => `${q} ${L.yoy}`), L.cagr],
        rows: VERTICAL_ITEMS.map(k => A.horizontal.find(r => r.key === k)).filter(Boolean).map(r => [CFO.itemName(r.key, lang), ...P.slice(1).map(q => CFO.fmtPct(r.yoy[q]?.pct, lang)), CFO.fmtPct(r.cagr, lang)]),
      },
      flags: F.map(f => ({ sev: f.sev, sevText: L.sev[f.sev], title: f.title[lang], ev: f.ev(lang), rec: f.rec[lang] })),
      strengths: CFO.strengths(A, lang).map(s => s.text),
      forecast: null,
      ai: ai || '',
      review: reviewItems(A, F, lang, ai),
      assumptions: L.assumptionList,
      next: L.nextList,
    };
    if (S) {
      const Fc = L.fc, names = ['base', 'upside', 'downside'], end = S.base.years[S.base.years.length - 1].period;
      const v = (sc, k) => sc ? sc.years[sc.years.length - 1].data[k] : ds.data[p][k];
      const r = (sc, id) => (sc ? sc.A.ratios[id][end] : A.ratios[id][p]).value;
      m.forecast = {
        head: ['', `${Fc.actual} ${p}`, ...names.map(n => `${Fc.sc[n]} ${end}`)],
        rows: [
          [CFO.itemName('revenue', lang), sc => CFO.fmtNum(v(sc, 'revenue'), 0, lang)],
          [CFO.itemName('net_income', lang), sc => CFO.fmtNum(v(sc, 'net_income'), 0, lang)],
          [CFO.ratioName('net_margin', lang), sc => CFO.fmtPct(r(sc, 'net_margin'), lang)],
          [CFO.ratioName('fcf', lang), sc => CFO.fmtNum(r(sc, 'fcf'), 0, lang)],
          [CFO.itemName('cash', lang), sc => CFO.fmtNum(v(sc, 'cash'), 0, lang)],
          [Fc.funding, sc => sc ? CFO.fmtNum(sc.years.reduce((t, y) => t + y.fundingNeed, 0), 0, lang) : '—'],
          [CFO.ratioName('current_ratio', lang), sc => CFO.fmtVal('x', r(sc, 'current_ratio'), lang)],
          [CFO.ratioName('debt_to_equity', lang), sc => CFO.fmtVal('x', r(sc, 'debt_to_equity'), lang)],
          [CFO.ratioName('interest_coverage', lang), sc => CFO.fmtVal('x', r(sc, 'interest_coverage'), lang)],
          [CFO.ratioName('roe', lang), sc => CFO.fmtPct(r(sc, 'roe'), lang)],
          [Fc.health, sc => String((sc ? sc.A.health : A.health)?.score ?? '—')],
          [Fc.flags, sc => String((sc ? sc.F : F).length)],
        ].map(([label, f]) => [label, f(null), ...names.map(n => f(S[n]))]),
        note: `${Fc.scHint} ${Fc.note}`,
      };
    }
    return m;
  }

  const L_ = lang => CFO.UI[lang];
  const table = (t, cls = '') => `<div class="table-wrap"><table class="${cls}"><thead><tr>${t.head.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  function reportHTML(R) {
    const m = model(R), L = L_(R.lang);
    const ratioRows = m.ratios.rows.map((r, i) => `<tr><td>${esc(r[0])}</td>${r.slice(1, -2).map(c => `<td class="n">${esc(c)}</td>`).join('')}<td><span class="pill ${m.ratios.status[i]}">${esc(r[r.length - 2])}</span></td><td class="small">${esc(r[r.length - 1])}</td></tr>`).join('');
    return `
      <h2>${esc(m.title)}</h2>
      <p class="muted small">${esc(m.meta)}</p>
      <section><h3>${L.execSummary}</h3><p>${esc(m.summary)}</p></section>
      ${m.ai ? `<section><h3>${L.aiSection}</h3><div class="ai-text">${CFO.md ? CFO.md(m.ai) : esc(m.ai)}</div><p class="muted small">${esc(L.ai.note)}</p></section>` : ''}
      <section><h3>${L.keyRatios}</h3><div class="table-wrap"><table><thead><tr>${m.ratios.head.map((h, i) => `<th${i && i < m.ratios.head.length - 2 ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${ratioRows}</tbody></table></div></section>
      <section><h3>${L.flagsTitle} & ${L.recs}</h3>${m.flags.length ? `<ol>${m.flags.map(f => `<li><span class="pill ${f.sev}">${esc(f.sevText)}</span> <b>${esc(f.title)}</b> — <span class="small">${esc(f.ev)}</span><br>${esc(f.rec)}</li>`).join('')}</ol>` : `<p>${L.noFlags}</p>`}</section>
      ${m.strengths.length ? `<section><h3>${L.strengths}</h3><ul>${m.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></section>` : ''}
      <section><h3>${L.tabs.vertical}</h3>${table(m.vertical)}</section>
      <section><h3>${L.tabs.horizontal}</h3>${table(m.horizontal)}</section>
      ${m.forecast ? `<section><h3>${L.fcSection}</h3>${table(m.forecast)}<p class="muted small">${esc(m.forecast.note)}</p></section>` : ''}
      <section><h3>${L.needsReview}</h3><ul>${m.review.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section><h3>${L.assumptions}</h3><ul>${m.assumptions.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section><h3>${L.nextSteps}</h3><ol>${m.next.map(t => `<li>${esc(t)}</li>`).join('')}</ol></section>`;
  }

  function reportMarkdown(R) {
    const m = model(R), L = L_(R.lang);
    const mdTable = t => [`| ${t.head.join(' | ')} |`, `|${t.head.map((_, i) => i ? '---:' : '---').join('|')}|`, ...t.rows.map(r => `| ${r.join(' | ')} |`)];
    const lines = [`# ${m.title}`, m.meta, '', `## ${L.execSummary}`, m.summary, ''];
    if (m.ai) lines.push(`## ${L.aiSection}`, m.ai, '', `_${L.ai.note}_`, '');
    lines.push(`## ${L.keyRatios}`, ...mdTable({ head: m.ratios.head.slice(0, -1), rows: m.ratios.rows.map(r => r.slice(0, -1)) }), '');
    lines.push(`## ${L.flagsTitle} & ${L.recs}`);
    m.flags.length ? m.flags.forEach((f, i) => lines.push(`${i + 1}. **[${f.sevText}] ${f.title}** — ${f.ev}  \n   ${f.rec}`)) : lines.push(L.noFlags);
    if (m.forecast) lines.push('', `## ${L.fcSection}`, ...mdTable(m.forecast));
    lines.push('', `## ${L.needsReview}`, ...m.review.map(t => `- ${t}`), '', `## ${L.nextSteps}`, ...m.next.map((t, i) => `${i + 1}. ${t}`));
    return lines.join('\n');
  }

  /** Save a generated file. Inside the claude.ai viewer the page cannot download by itself, so the
   * viewer's own save prompt is used (the `downloads` capability); elsewhere a normal browser download.
   * Resolves 'saved' | 'declined' | 'unavailable'. */
  async function download(name, blob) {
    const dl = globalThis.claude?.use ? await globalThis.claude.use('downloads').catch(() => null) : null;
    if (dl) {
      try { await dl.save({ filename: name, data: blob }); return 'saved'; }
      catch (e) { return e && (e.code === 'declined' || e.code === 'rate_limited') ? 'declined' : 'unavailable'; }
    }
    if (globalThis.claude?.use) return 'unavailable';      // in the viewer without the capability, a link would do nothing
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return 'saved';
  }

  const fileName = (R, ext) => `cfo-report-${R.A.latest || 'analysis'}-${R.lang}.${ext}`;

  function exportHTML(R) {
    const styles = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
    const doc = `<!doctype html><html lang="${R.lang}" dir="${R.lang === 'ar' ? 'rtl' : 'ltr'}" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(L_(R.lang).reportTitle)}</title><style>${styles}</style></head><body><main class="wrap"><article class="report">${reportHTML(R)}</article></main></body></html>`;
    return download(fileName(R, 'html'), new Blob([doc], { type: 'text/html' }));
  }

  /* Word: real text with right-to-left paragraphs for Arabic (Word shapes the Arabic letters itself). */
  async function exportDOCX(R) {
    const D = globalThis.docx, m = model(R), L = L_(R.lang), rtl = R.lang === 'ar';
    const font = { ascii: 'Calibri', hAnsi: 'Calibri', cs: 'Arial' };
    const run = (text, o = {}) => new D.TextRun({ text: String(text ?? ''), font, rightToLeft: rtl, size: o.size || 21, sizeComplexScript: o.size || 21, bold: o.bold, color: o.color });
    const align = rtl ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT;
    const para = (text, o = {}) => new D.Paragraph({ bidirectional: rtl, alignment: align, spacing: { after: 80 }, heading: o.heading, bullet: o.bullet ? { level: 0 } : undefined,
      children: Array.isArray(text) ? text : [run(text, o)] });
    const h = (text, level) => new D.Paragraph({ bidirectional: rtl, alignment: align, heading: level, spacing: { before: 240, after: 100 }, children: [run(text, { bold: true, size: level === D.HeadingLevel.TITLE ? 36 : 26, color: '0D6B63' })] });
    // **bold** spans inside a line
    const rich = text => String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t => /^\*\*.*\*\*$/.test(t) ? run(t.slice(2, -2), { bold: true }) : run(t));
    const cell = (text, o = {}) => new D.TableCell({ shading: o.head ? { fill: 'EAEEEB', type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new D.Paragraph({ bidirectional: rtl, alignment: o.num ? (rtl ? D.AlignmentType.LEFT : D.AlignmentType.RIGHT) : align, children: [run(text, { bold: o.head, size: 18 })] })] });
    const tbl = t => new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, visuallyRightToLeft: rtl,
      rows: [new D.TableRow({ tableHeader: true, children: t.head.map((c, i) => cell(c, { head: true, num: i > 0 })) }),
        ...t.rows.map(r => new D.TableRow({ children: r.map((c, i) => cell(c, { num: i > 0 && i < t.head.length - (t.textCols || 0) })) }))] });
    const list = (items, numbered) => items.map((t, i) => para(numbered ? `${i + 1}. ${t}` : t, { bullet: !numbered }));
    const aiParas = text => String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const hd = l.match(/^#{1,4}\s+(.*)$/); if (hd) return h(hd[1].replace(/\*\*/g, ''), D.HeadingLevel.HEADING_3);
      const li = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/); if (li) return para(rich(li[1]), { bullet: true });
      return para(rich(l));
    });

    const children = [
      h(m.title, D.HeadingLevel.TITLE), para(m.meta, { size: 18, color: '586664' }),
      h(L.execSummary, D.HeadingLevel.HEADING_1), para(m.summary),
      ...(m.ai ? [h(L.aiSection, D.HeadingLevel.HEADING_1), ...aiParas(m.ai), para(L.ai.note, { size: 18, color: '586664' })] : []),
      h(L.keyRatios, D.HeadingLevel.HEADING_1), tbl({ ...m.ratios, textCols: 2 }),
      h(`${L.flagsTitle} & ${L.recs}`, D.HeadingLevel.HEADING_1),
      ...(m.flags.length ? m.flags.flatMap(f => [para([run(`[${f.sevText}] `, { bold: true, color: f.sev === 'high' ? 'B42318' : f.sev === 'med' ? '9A6500' : '586664' }), run(f.title, { bold: true })]),
        para(`${L.evidence}: ${f.ev}`, { size: 19 }), para(`${L.action}: ${f.rec}`, { size: 19 })]) : [para(L.noFlags)]),
      ...(m.strengths.length ? [h(L.strengths, D.HeadingLevel.HEADING_1), ...list(m.strengths)] : []),
      h(L.tabs.vertical, D.HeadingLevel.HEADING_1), tbl(m.vertical),
      h(L.tabs.horizontal, D.HeadingLevel.HEADING_1), tbl(m.horizontal),
      ...(m.forecast ? [h(L.fcSection, D.HeadingLevel.HEADING_1), tbl(m.forecast), para(m.forecast.note, { size: 18, color: '586664' })] : []),
      h(L.needsReview, D.HeadingLevel.HEADING_1), ...list(m.review),
      h(L.assumptions, D.HeadingLevel.HEADING_1), ...list(m.assumptions),
      h(L.nextSteps, D.HeadingLevel.HEADING_1), ...list(m.next, true),
    ];
    const doc = new D.Document({ creator: 'CFO Lens', title: m.title, sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }] });
    return download(fileName(R, 'docx'), await D.Packer.toBlob(doc));
  }

  /* PDF: drawn from the on-screen report, so Arabic text and layout look exactly as they do in the page.
   * The text is part of the image (not selectable); the Word file is the editable version. */
  async function exportPDF(R, el) {
    if (!el) throw new Error('report not on screen');
    const root = document.documentElement, theme = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');                       // print on white whatever the screen theme
    let canvas;
    // Keep the canvas under ~16M pixels (Safari / iOS refuse larger ones); long reports get a lower scale.
    const scale = Math.max(0.75, Math.min(2, Math.sqrt(16e6 / Math.max(1, el.scrollWidth * el.scrollHeight))));
    try { canvas = await globalThis.html2canvas(el, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false }); }
    finally { theme == null ? root.removeAttribute('data-theme') : root.setAttribute('data-theme', theme); }
    const { jsPDF } = globalThis.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const margin = 10, w = 210 - 2 * margin, pageH = 297 - 2 * margin - 6;
    const pxPerMm = canvas.width / w, slicePx = Math.floor(pageH * pxPerMm);
    const pages = Math.max(1, Math.ceil(canvas.height / slicePx));
    for (let i = 0; i < pages; i++) {
      const part = document.createElement('canvas');
      part.width = canvas.width; part.height = Math.min(slicePx, canvas.height - i * slicePx);
      const g = part.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, part.width, part.height);
      g.drawImage(canvas, 0, i * slicePx, part.width, part.height, 0, 0, part.width, part.height);
      if (i) pdf.addPage();
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, w, part.height / pxPerMm);
      pdf.setFontSize(8); pdf.setTextColor(120);
      pdf.text(`${i + 1} / ${pages}`, 105, 297 - 6, { align: 'center' });
    }
    return download(fileName(R, 'pdf'), pdf.output('blob'));
  }

  function exportXLSX(R) {
    const { A, F, S, lang } = R;
    const X = globalThis.XLSX, L = L_(lang), P = A.ds.periods, ds = A.ds, m = model(R);
    const wb = X.utils.book_new();
    const add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), name);
    add('Summary', [[L.reportTitle], [m.meta], [CFO.summary(A, F, lang)], [], [L.health, A.health?.score, A.health?.grade]]);
    add('Data', [[L.item, ...P], ...CFO.ITEMS.filter(it => P.some(p => ds.data[p][it.key] != null)).map(it => [CFO.itemName(it.key, lang), ...P.map(p => ds.data[p][it.key] ?? '')])]);
    add('Ratios', [[lang === 'ar' ? 'المجموعة' : 'Group', L.item, L.formula, ...P, L.typical, `${A.latest}`, L.meaning],
      ...CFO.RATIOS.map(def => [L.groups[def.group], CFO.ratioName(def.id, lang), def.f, ...P.map(p => A.ratios[def.id][p].value ?? ''), CFO.bench(def.id).typical ?? '', L.status[A.ratios[def.id][A.latest].status || 'na'], CFO.meaning(def.id, A.ratios[def.id][A.latest].value, lang)])]);
    const label = r => r.key ? CFO.itemName(r.key, lang) : r.label;
    add('Vertical', [['', L.item, ...P.map(p => `${p} %`)], ...A.vertical.map(r => [L.st[r.st], label(r), ...P.map(p => r.pct[p] ?? '')])]);
    add('Horizontal', [['', L.item, ...P.map(p => `${p} ${L.yoy} %`), ...P.map(p => `${p} ${L.index}`), L.cagr],
      ...A.horizontal.map(r => [L.st[r.st], label(r), ...P.map(p => r.yoy[p]?.pct ?? ''), ...P.map(p => r.idx[p] ?? ''), r.cagr ?? ''])]);
    add('Red flags', [[lang === 'ar' ? 'الخطورة' : 'Severity', L.flagsTitle, L.evidence, L.action], ...F.map(f => [L.sev[f.sev], f.title[lang], f.ev(lang), f.rec[lang]])]);
    if (S) {
      const lines = ['revenue', 'gross_profit', 'operating_income', 'net_income', 'cash', 'total_assets', 'total_liabilities', 'equity', 'cfo', 'capex', 'dividends'];
      const rows = [[L.fc.title], ...Object.entries(S.base.drivers).map(([k, v]) => [L.fc.d[k], v])];
      for (const [name, sc] of Object.entries(S)) {
        rows.push([], [L.fc.sc[name], ...sc.years.map(y => y.period)]);
        lines.forEach(k => rows.push([CFO.itemName(k, lang), ...sc.years.map(y => y.data[k])]));
        rows.push([L.fc.funding, ...sc.years.map(y => y.fundingNeed)]);
      }
      add('Forecast', rows);
    }
    if (R.ai) add('Claude', [[L.aiSection], [L.ai.note], ...String(R.ai).split(/\r?\n/).map(l => [l])]);
    add('Mapping', [[L.source, L.rawLabel, L.mappedTo, ...P], ...ds.lines.map(l => [l.source, l.label, l.key ? CFO.itemName(l.key, lang) : '', ...P.map(p => l.values[p] ?? '')])]);
    const bytes = X.write(wb, { type: 'array', bookType: 'xlsx' });
    return download(`cfo-analysis-${A.latest || 'report'}.xlsx`, new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }

  CFO.reportModel = model;
  CFO.reportHTML = reportHTML;
  CFO.reportMarkdown = reportMarkdown;
  CFO.exportHTML = exportHTML;
  CFO.exportXLSX = exportXLSX;
  CFO.exportDOCX = exportDOCX;
  CFO.exportPDF = exportPDF;
  CFO.esc = esc;
})(globalThis.CFO = globalThis.CFO || {});
