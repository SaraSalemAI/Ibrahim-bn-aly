// AI Audit Copilot — deterministic, evidence-grounded answers over the analysis results.
// It never generates figures: every number comes from computed results and every answer cites findings/tests.
import type { Analysis } from './analysis';
import type { L, Settings } from './types';
import { buildInsights } from './insights';
import { TEST_BY_ID } from './tests';
import { AREA_LABEL } from './library';
import { accessor, fmtMoney, fmtNum, normalizeForSearch } from './values';
import { rowSite } from './sites';

export interface CopilotAnswer { title: L; lines: L[]; refs: { kind: 'finding' | 'test' | 'risk' | 'control'; id: string }[]; confidence: 'high' | 'medium' | 'low'; insufficient?: boolean }

export const SUGGESTED: L[] = [
  { en: 'What are the top 10 risks?', ar: 'ما هي أهم 10 مخاطر؟' },
  { en: 'Which findings require immediate attention?', ar: 'ما الملاحظات التي تتطلب اهتمامًا فوريًا؟' },
  { en: 'Which transactions are unusual?', ar: 'ما المعاملات غير المعتادة؟' },
  { en: 'Which vendors are high risk?', ar: 'من هم الموردون مرتفعو المخاطر؟' },
  { en: 'Where are the largest control weaknesses?', ar: 'أين يوجد أكبر ضعف في الرقابة؟' },
  { en: 'What changed this month?', ar: 'ما الذي تغير هذا الشهر؟' },
  { en: 'What are the largest budget overruns?', ar: 'ما أكبر تجاوزات الموازنة؟' },
  { en: 'Which bank accounts contain unexplained movements?', ar: 'ما الحسابات البنكية التي بها حركات غير مفسرة؟' },
  { en: 'Which assets appear inactive?', ar: 'ما الأصول التي تبدو غير نشطة؟' },
  { en: 'What are the largest fraud-risk indicators?', ar: 'ما أكبر مؤشرات مخاطر الاحتيال؟' },
  { en: 'What should Internal Audit test next?', ar: 'ماذا يجب أن تختبر المراجعة الداخلية بعد ذلك؟' },
  { en: 'What should the CFO know?', ar: 'ماذا يجب أن يعرف المدير المالي؟' },
  { en: 'What should the Audit Committee know?', ar: 'ماذا يجب أن تعرف لجنة المراجعة؟' },
  { en: 'Review payments and contracts for Ain Sokhna', ar: 'مراجعة مدفوعات وعقود السخنة' },
];

const T = (en: string, ar: string): L => ({ en, ar });
const sevAr: Record<string, string> = { critical: 'حرج', high: 'مرتفع', medium: 'متوسط', low: 'منخفض', info: 'معلوماتي' };

function findingLine(a: Analysis, id: string): L {
  const f = a.findingById[id];
  return { en: `${f.id} [${f.rating.toUpperCase()}] ${f.title.en} — ${f.exceptionCount} exception(s), exposure ${fmtMoney(f.exposure)}`, ar: `${f.id} [${sevAr[f.rating]}] ${f.title.ar} — ${f.exceptionCount} استثناء، التعرض ${fmtMoney(f.exposure)}` };
}

export function answer(q: string, a: Analysis, s: Settings): CopilotAnswer {
  if (!a.hasData) return { title: T('INSUFFICIENT DATA', 'بيانات غير كافية'), lines: [T('No data has been uploaded. Upload your data to start the audit.', 'لم يتم رفع أي بيانات. ارفع بياناتك لبدء المراجعة.')], refs: [], confidence: 'high', insufficient: true };
  const n = normalizeForSearch(q);
  const has = (...k: string[]) => k.some((x) => n.includes(normalizeForSearch(x)));
  const ins = buildInsights(a, s);
  const fl = (ids: string[], title: L, empty: L): CopilotAnswer => ids.length
    ? { title, lines: ids.map((id) => findingLine(a, id)), refs: ids.map((id) => ({ kind: 'finding' as const, id })), confidence: 'high' }
    : { title, lines: [empty], refs: [], confidence: 'high' };
  const none = T('No exceptions found in the uploaded data for this question. Check the Data Requirements Center for tests not performed.', 'لا توجد استثناءات في البيانات المرفوعة لهذا السؤال. راجع مركز متطلبات البيانات للاختبارات غير المنفذة.');

  // Site review (Head Office, Sokhna, Kerir, Dahshour)
  const site = s.sites.find((x) => [x.id, x.name.en, x.name.ar, ...x.keywords].some((k) => k.length > 2 && n.includes(normalizeForSearch(k))));
  if (site) {
    const lines: L[] = []; const refs: CopilotAnswer['refs'] = [];
    let pay = 0, payN = 0, con = 0, conN = 0;
    for (const t of a.filteredTables) {
      if (t.datasetType !== 'ap' && t.datasetType !== 'contracts') continue;
      const ac = accessor(t);
      for (const r of t.rows) {
        if (rowSite(t, r, s.sites) !== site.id) continue;
        if (t.datasetType === 'ap') { pay += ac.n(r, 'amount') ?? 0; payN++; } else { con += ac.n(r, 'value') ?? 0; conN++; }
      }
    }
    lines.push({ en: `SOURCE DATA: ${payN} invoice/payment record(s) totalling ${fmtNum(pay)}; ${conN} contract(s) with total value ${fmtNum(con)} allocated to ${site.name.en}.`, ar: `بيانات المصدر: ${payN} سجل فاتورة/دفعة بإجمالي ${fmtNum(pay)}؛ ${conN} عقد بقيمة ${fmtNum(con)} مخصصة لـ ${site.name.ar}.` });
    for (const f of a.findings) {
      const r = a.resultById[f.testId];
      const cnt = r.exceptions.filter((e) => e.rows.some((ref) => { const t = a.tables.find((x) => x.id === ref.tableId); const row = t?.rows.find((x) => x.recordId === ref.recordId); return t && row && rowSite(t, row, s.sites) === site.id; })).length;
      if (cnt && ['ap', 'contracts', 'procurement', 'treasury'].includes(f.area)) { lines.push({ en: `${f.id} [${f.rating.toUpperCase()}] ${f.title.en}: ${cnt} exception(s) at ${site.name.en}`, ar: `${f.id} [${sevAr[f.rating]}] ${f.title.ar}: ${cnt} استثناء في ${site.name.ar}` }); refs.push({ kind: 'finding', id: f.id }); }
    }
    if (!payN && !conN) return { title: T(`${site.name.en} — payments & contracts`, `${site.name.ar} — المدفوعات والعقود`), lines: [T(`INSUFFICIENT DATA — no payments or contracts could be allocated to ${site.name.en}. Map a Site / Cost center field.`, `بيانات غير كافية — لا توجد مدفوعات أو عقود مخصصة لـ ${site.name.ar}. يرجى ربط حقل الموقع / مركز التكلفة.`)], refs: [], confidence: 'high', insufficient: true };
    return { title: T(`${site.name.en} — payments & contracts review`, `${site.name.ar} — مراجعة المدفوعات والعقود`), lines, refs, confidence: 'high' };
  }

  if (has('top 10 risk', 'top risk', 'أهم المخاطر', 'اهم المخاطر', 'أهم 10 مخاطر'))
    return ins.topRisks.length ? { title: T('Top risks (residual score × exposure)', 'أهم المخاطر (الدرجة المتبقية × التعرض)'), lines: ins.topRisks.map((r) => ({ en: `${r.def.id} ${r.def.title.en} — L${r.likelihood}×I${r.impact}=${r.residualScore}; exposure ${fmtMoney(r.exposure)}; findings ${r.findings.join(', ')}`, ar: `${r.def.id} ${r.def.title.ar} — احتمال ${r.likelihood}×أثر ${r.impact}=${r.residualScore}؛ التعرض ${fmtMoney(r.exposure)}` })), refs: ins.topRisks.map((r) => ({ kind: 'risk' as const, id: r.def.id })), confidence: 'high' } : { title: T('Top risks', 'أهم المخاطر'), lines: [none], refs: [], confidence: 'high' };
  if (has('immediate', 'urgent', 'فوري', 'عاجل'))
    return fl(a.findings.filter((f) => f.rating === 'critical' || f.rating === 'high').map((f) => f.id), T('Findings requiring immediate attention (Critical / High)', 'ملاحظات تتطلب اهتمامًا فوريًا (حرجة / مرتفعة)'), none);
  if (has('vendor', 'supplier', 'مورد', 'الموردين')) {
    const score = new Map<string, { n: number; tests: Set<string> }>();
    for (const r of a.results) for (const e of r.exceptions) for (const ref of e.rows) {
      const t = a.tables.find((x) => x.id === ref.tableId); if (!t?.mapping.vendor) continue;
      const row = t.rows.find((x) => x.recordId === ref.recordId); if (!row) continue;
      const v = String(row.values[t.mapping.vendor] ?? ''); if (!v) continue;
      const g = score.get(v) ?? { n: 0, tests: new Set() }; g.n++; g.tests.add(r.testId); score.set(v, g);
    }
    const top = [...score.entries()].sort((x, y) => y[1].tests.size - x[1].tests.size || y[1].n - x[1].n).slice(0, 10);
    return { title: T('Vendors with the most exceptions across tests', 'الموردون الأكثر استثناءات عبر الاختبارات'), lines: top.length ? top.map(([v, g]) => ({ en: `${v}: ${g.n} exception row(s) in ${[...g.tests].join(', ')}`, ar: `${v}: ${g.n} سجل استثناء في ${[...g.tests].join('، ')}` })) : [none], refs: [...new Set(top.flatMap(([, g]) => [...g.tests]))].map((id) => ({ kind: 'test' as const, id })), confidence: 'medium' };
  }
  if (has('control weak', 'ضعف الرقابة', 'الرقابة'))
    return { title: T('Largest control weaknesses', 'أكبر نقاط ضعف الرقابة'), lines: ins.controlWeaknesses.length ? ins.controlWeaknesses.map((c) => ({ en: `${c.def.id} ${c.def.objective.en} — score ${c.score} (${c.rating})${c.repeat ? ', REPEAT' : ''}; ${c.exceptions} exception(s)`, ar: `${c.def.id} ${c.def.objective.ar} — الدرجة ${c.score}${c.repeat ? '، متكررة' : ''}؛ ${c.exceptions} استثناء` })) : [none], refs: ins.controlWeaknesses.map((c) => ({ kind: 'control' as const, id: c.def.id })), confidence: 'high' };
  if (has('changed', 'change', 'new', 'تغير', 'جديد')) {
    if (!a.change.baseline) return { title: T('Audit change monitor', 'مراقب التغيرات'), lines: [T('INSUFFICIENT DATA — no baseline snapshot exists. Save a cycle snapshot in the Change Monitor, then upload the next period.', 'بيانات غير كافية — لا توجد لقطة أساس. احفظ لقطة الدورة ثم ارفع بيانات الفترة التالية.')], refs: [], confidence: 'high', insufficient: true };
    const lines: L[] = [
      { en: `Compared with snapshot "${a.change.baseline.label}" (${a.change.baseline.createdAt.slice(0, 10)}):`, ar: `مقارنة باللقطة "${a.change.baseline.label}":` },
      ...a.change.newExceptions.map((x) => ({ en: `NEW: ${x.keys.length} exception(s) in ${x.testId} ${TEST_BY_ID[x.testId].name.en}`, ar: `جديد: ${x.keys.length} استثناء في ${TEST_BY_ID[x.testId].name.ar}` })),
      ...a.change.repeatExceptions.map((x) => ({ en: `REPEAT: ${x.keys.length} in ${x.testId}`, ar: `متكرر: ${x.keys.length} في ${x.testId}` })),
      ...a.change.resolvedExceptions.map((x) => ({ en: `RESOLVED: ${x.keys.length} in ${x.testId}`, ar: `تمت المعالجة: ${x.keys.length} في ${x.testId}` })),
      ...Object.entries(a.change.newEntities).map(([k, v]) => ({ en: `New ${k}: ${v.length}`, ar: `جديد (${k}): ${v.length}` })),
    ];
    return { title: T('What changed', 'ما الذي تغير'), lines, refs: a.change.newExceptions.map((x) => ({ kind: 'test' as const, id: x.testId })), confidence: 'high' };
  }
  if (has('budget', 'overrun', 'الموازنة', 'تجاوز')) return fl(a.findings.filter((f) => ['BU-01', 'CX-01', 'CX-02', 'OX-01'].includes(f.testId)).map((f) => f.id), T('Budget overruns', 'تجاوزات الموازنة'), none);
  if (has('bank', 'unexplained', 'البنك', 'بنكية', 'غير مفسرة')) return fl(a.findings.filter((f) => f.area === 'treasury' || ['REC-07', 'REC-08'].includes(f.testId)).map((f) => f.id), T('Bank accounts with unexplained movements', 'حسابات بنكية بحركات غير مفسرة'), none);
  if (has('asset', 'inactive', 'الأصول', 'الاصول')) return fl(a.findings.filter((f) => ['FA-03', 'FA-11', 'FA-05', 'IN-02', 'IN-03'].includes(f.testId)).map((f) => f.id), T('Assets / items that appear inactive or unverified', 'أصول / أصناف تبدو غير نشطة أو غير متحقق منها'), none);
  if (has('fraud', 'احتيال')) return fl(ins.fraudIndicators.map((f) => f.id), T('Fraud-risk indicators (require investigation — not conclusions of fraud)', 'مؤشرات مخاطر الاحتيال (تتطلب التحقيق — ليست استنتاجًا بوقوع احتيال)'), none);
  if (has('unusual', 'غير معتادة', 'غير عادية')) return fl(a.findings.filter((f) => ['GL-02', 'GL-04', 'GL-05', 'GL-10', 'GL-14', 'GL-15', 'GL-18', 'TR-05', 'AP-16', 'PR-06'].includes(f.testId)).map((f) => f.id), T('Unusual transactions', 'المعاملات غير المعتادة'), none);
  if (has('test next', 'next', 'بعد ذلك', 'التالي'))
    return { title: T('Recommended audit priorities', 'أولويات المراجعة المقترحة'), lines: ins.auditPriorities.map((p) => ({ en: `${AREA_LABEL[p.area]?.en ?? p.area}: ${p.reason === 'insufficient-data' ? 'obtain data — ' : p.reason === 'repeat' ? 'repeat exceptions — ' : 'high risk — '}${p.detail.en}`, ar: `${AREA_LABEL[p.area]?.ar ?? p.area}: ${p.reason === 'insufficient-data' ? 'الحصول على البيانات' : p.reason === 'repeat' ? 'استثناءات متكررة' : 'مخاطر مرتفعة'} — ${p.detail.ar}` })), refs: [], confidence: 'medium' };
  if (has('cfo', 'المدير المالي'))
    return { title: T('What the CFO should know', 'ما يجب أن يعرفه المدير المالي'), lines: [...ins.cfoActions.map((r) => ({ en: `${r.id} (${r.priority}) ${r.action.en} — ${r.findingId}`, ar: `${r.id} ${r.action.ar} — ${r.findingId}` }))], refs: ins.cfoActions.map((r) => ({ kind: 'finding' as const, id: r.findingId })), confidence: 'high' };
  if (has('committee', 'لجنة'))
    return { title: T('What the Audit Committee should know', 'ما يجب أن تعرفه لجنة المراجعة'), lines: [
      { en: `Platform quality check: ${a.qcStatus}${a.qcStatus === 'FAIL' ? ' — official conclusions are withheld until data-quality failures are resolved' : ''}`, ar: `فحص جودة المنصة: ${a.qcStatus}` },
      { en: `${a.findings.filter((f) => f.rating === 'critical').length} critical and ${a.findings.filter((f) => f.rating === 'high').length} high findings; ${a.findings.filter((f) => f.fraudIndicator).length} fraud-risk indicators requiring investigation`, ar: `${a.findings.filter((f) => f.rating === 'critical').length} ملاحظة حرجة و${a.findings.filter((f) => f.rating === 'high').length} مرتفعة؛ ${a.findings.filter((f) => f.fraudIndicator).length} مؤشر احتيال يتطلب التحقيق` },
      ...ins.topFindings.slice(0, 5).map((f) => findingLine(a, f.id)),
    ], refs: ins.topFindings.slice(0, 5).map((f) => ({ kind: 'finding' as const, id: f.id })), confidence: 'high' };
  return { title: T('Question not recognised', 'لم يتم التعرف على السؤال'), lines: [T('The copilot answers only from computed audit results to avoid unsupported statements. Try one of the suggested questions, or ask about a site (Head Office, Sokhna, Kerir, Dahshour).', 'يجيب المساعد فقط من نتائج المراجعة المحتسبة لتجنب أي معلومات غير مؤيدة. جرّب أحد الأسئلة المقترحة أو اسأل عن موقع (المركز الرئيسي، السخنة، كرير، دهشور).')], refs: [], confidence: 'high', insufficient: true };
}
