/* Report generation and exports. Everything stays in the browser; files are local downloads. */
(function (CFO) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY_RATIOS = ['current_ratio', 'quick_ratio', 'gross_margin', 'operating_margin', 'net_margin', 'roe', 'roce', 'dso', 'ccc', 'debt_to_equity', 'interest_coverage', 'net_debt_to_ebitda', 'fcf', 'cash_conversion', 'altman_z'];

  /** Items a person should check before the report is used for decisions. */
  function reviewItems(A, F, lang) {
    const L = CFO.UI[lang], ds = A.ds, out = [];
    const n = k => CFO.itemName(k, lang);
    ds.issues.forEach(i => out.push(L.issue[i.type](i, n)));
    const derived = new Set(ds.periods.flatMap(p => [...ds.derived[p]]));
    if (derived.size) out.push((lang === 'en' ? 'Derived (not read from a file): ' : 'بنود محسوبة (غير مقروءة من ملف): ') + [...derived].map(n).join(lang === 'en' ? ', ' : '، '));
    if (ds.sources.some(s => /\.pdf/i.test(s))) out.push(lang === 'en' ? 'PDF input: verify each number against the original statement.' : 'ملفات PDF: طابق كل رقم مع القوائم الأصلية.');
    F.filter(f => f.sev === 'high').forEach(f => out.push((lang === 'en' ? 'Confirm the cause of: ' : 'تأكد من سبب: ') + f.title[lang]));
    return out;
  }

  function reportHTML(A, F, lang) {
    const L = CFO.UI[lang], P = A.ds.periods, p = A.latest;
    const strengths = CFO.strengths(A, lang);
    const rows = KEY_RATIOS.map(id => {
      const def = CFO.RATIO[id], cell = A.ratios[id][p];
      return `<tr><td>${esc(CFO.ratioName(id, lang))}</td>${P.map(q => `<td class="n">${CFO.fmtVal(def.unit, A.ratios[id][q].value, lang)}</td>`).join('')}<td><span class="pill ${cell.status || 'na'}">${L.status[cell.status || (cell.value != null && !def.dir ? 'info' : 'na')]}</span></td><td class="small">${esc(CFO.meaning(id, cell.value, lang))}</td></tr>`;
    }).join('');
    return `
      <h2>${L.reportTitle}</h2>
      <p class="muted small">${esc(A.ds.sources.join(' · '))} · ${P.join(', ')}</p>
      <section><h3>${L.execSummary}</h3><p>${esc(CFO.summary(A, F, lang))}</p></section>
      <section><h3>${L.keyRatios}</h3><div class="table-wrap"><table><thead><tr><th>${L.item}</th>${P.map(q => `<th class="n">${q}</th>`).join('')}<th>${p}</th><th>${L.meaning}</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <section><h3>${L.flagsTitle} & ${L.recs}</h3>${F.length ? `<ol>${F.map(f => `<li><span class="pill ${f.sev}">${L.sev[f.sev]}</span> <b>${esc(f.title[lang])}</b> — <span class="small">${esc(f.ev(lang))}</span><br>${esc(f.rec[lang])}</li>`).join('')}</ol>` : `<p>${L.noFlags}</p>`}</section>
      ${strengths.length ? `<section><h3>${L.strengths}</h3><ul>${strengths.map(s => `<li>${esc(s.text)}</li>`).join('')}</ul></section>` : ''}
      <section><h3>${L.needsReview}</h3><ul>${reviewItems(A, F, lang).map(t => `<li>${esc(t)}</li>`).join('') || `<li>${L.noIssues}</li>`}</ul></section>
      <section><h3>${L.assumptions}</h3><ul>${L.assumptionList.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section><h3>${L.nextSteps}</h3><ol>${L.nextList.map(t => `<li>${esc(t)}</li>`).join('')}</ol></section>`;
  }

  function reportMarkdown(A, F, lang) {
    const L = CFO.UI[lang], P = A.ds.periods, p = A.latest;
    const lines = [`# ${L.reportTitle}`, '', `## ${L.execSummary}`, CFO.summary(A, F, lang), '', `## ${L.keyRatios}`,
      `| ${L.item} | ${P.join(' | ')} | ${p} |`, `|---|${P.map(() => '---:').join('|')}|---|`];
    KEY_RATIOS.forEach(id => { const def = CFO.RATIO[id]; lines.push(`| ${CFO.ratioName(id, lang)} | ${P.map(q => CFO.fmtVal(def.unit, A.ratios[id][q].value, lang)).join(' | ')} | ${L.status[A.ratios[id][p].status || 'na']} |`); });
    lines.push('', `## ${L.flagsTitle} & ${L.recs}`);
    F.length ? F.forEach((f, i) => lines.push(`${i + 1}. **[${L.sev[f.sev]}] ${f.title[lang]}** — ${f.ev(lang)}  \n   ${f.rec[lang]}`)) : lines.push(L.noFlags);
    lines.push('', `## ${L.needsReview}`, ...reviewItems(A, F, lang).map(t => `- ${t}`), '', `## ${L.nextSteps}`, ...L.nextList.map((t, i) => `${i + 1}. ${t}`));
    return lines.join('\n');
  }

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function exportHTML(A, F, lang) {
    const styles = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
    const doc = `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${CFO.UI[lang].reportTitle}</title><style>${styles}</style></head><body><main class="wrap"><article class="report">${reportHTML(A, F, lang)}</article></main></body></html>`;
    download(`cfo-report-${A.latest || 'analysis'}-${lang}.html`, new Blob([doc], { type: 'text/html' }));
  }

  function exportXLSX(A, F, lang) {
    const X = globalThis.XLSX, L = CFO.UI[lang], P = A.ds.periods, ds = A.ds;
    const wb = X.utils.book_new();
    const add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), name);
    add('Summary', [[L.reportTitle], [CFO.summary(A, F, lang)], [], [L.health, A.health?.score, A.health?.grade]]);
    add('Data', [[L.item, ...P], ...CFO.ITEMS.filter(it => P.some(p => ds.data[p][it.key] != null)).map(it => [CFO.itemName(it.key, lang), ...P.map(p => ds.data[p][it.key] ?? '')])]);
    add('Ratios', [[lang === 'ar' ? 'المجموعة' : 'Group', L.item, L.formula, ...P, `${A.latest}`, L.meaning],
      ...CFO.RATIOS.map(def => [L.groups[def.group], CFO.ratioName(def.id, lang), def.f, ...P.map(p => A.ratios[def.id][p].value ?? ''), L.status[A.ratios[def.id][A.latest].status || 'na'], CFO.meaning(def.id, A.ratios[def.id][A.latest].value, lang)])]);
    const label = r => r.key ? CFO.itemName(r.key, lang) : r.label;
    add('Vertical', [['', L.item, ...P.map(p => `${p} %`)], ...A.vertical.map(r => [L.st[r.st], label(r), ...P.map(p => r.pct[p] ?? '')])]);
    add('Horizontal', [['', L.item, ...P.map(p => `${p} ${L.yoy} %`), ...P.map(p => `${p} ${L.index}`), L.cagr],
      ...A.horizontal.map(r => [L.st[r.st], label(r), ...P.map(p => r.yoy[p]?.pct ?? ''), ...P.map(p => r.idx[p] ?? ''), r.cagr ?? ''])]);
    add('Red flags', [[lang === 'ar' ? 'الخطورة' : 'Severity', L.flagsTitle, L.evidence, L.action], ...F.map(f => [L.sev[f.sev], f.title[lang], f.ev(lang), f.rec[lang]])]);
    add('Mapping', [[L.source, L.rawLabel, L.mappedTo, ...P], ...ds.lines.map(l => [l.source, l.label, l.key ? CFO.itemName(l.key, lang) : '', ...P.map(p => l.values[p] ?? '')])]);
    X.writeFile(wb, `cfo-analysis-${A.latest || ''}.xlsx`);
  }

  CFO.reportHTML = reportHTML;
  CFO.reportMarkdown = reportMarkdown;
  CFO.exportHTML = exportHTML;
  CFO.exportXLSX = exportXLSX;
  CFO.esc = esc;
})(globalThis.CFO = globalThis.CFO || {});
