import type { ReactNode } from 'react';
import { useApp } from '../state';
import { buildInsights } from '../engine/insights';
import { AREA_LABEL, AREAS } from '../engine/library';
import { accessor, fmtNum } from '../engine/values';
import { groupBy } from '../engine/tests/kit';
import type { Analysis } from '../engine/analysis';
import type { Finding, Settings } from '../engine/types';
import { Card, Kpi, Sev, Money, Bars, Empty, QC, SevStack, Tag } from '../ui/kit';
import { Heatmap } from './RiskControl';
import { useFindings } from './common';


export const PRIORITY = { immediate: { en: 'Immediate', ar: 'فوري' }, short: { en: 'Short-term', ar: 'قصير الأجل' }, medium: { en: 'Medium-term', ar: 'متوسط الأجل' }, long: { en: 'Long-term', ar: 'طويل الأجل' } };

function NoData() {
  const { t, go } = useApp();
  return <Empty title={t('uploadToStart')}><p className="muted">{t('requirements')}</p><div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={() => go('upload')}>{t('upload')}</button><button className="btn" onClick={() => go('requirements')}>{t('requirements')}</button></div></Empty>;
}

function FindingList({ items, empty }: { items: Finding[]; empty?: ReactNode }) {
  const { tl, setNav, t } = useApp();
  if (!items.length) return <div className="muted small">{empty ?? t('noFindings')}</div>;
  return <ol style={{ margin: 0, paddingInlineStart: 20 }}>{items.map((f) => <li key={f.id} style={{ marginBottom: 6 }}><div className="row"><Sev s={f.rating} /><button className="btn sm ghost" onClick={() => setNav({ findingId: f.id })}><span className="mono">{f.id}</span></button><span>{tl(f.title)}</span><span className="spacer" /><Money m={f.exposure} /><button className="btn sm evidence-btn" onClick={() => setNav({ evidence: { findingId: f.id, index: 0 } })}>{t('showEvidence')}</button></div></li>)}</ol>;
}

const sumExp = (fs: Finding[]) => fs.reduce<Record<string, number>>((m, f) => { for (const [c, v] of Object.entries(f.exposure)) m[c] = (m[c] ?? 0) + v; return m; }, {});
const ctlEff = (a: Analysis) => { const tested = a.controls.filter((c) => c.score !== null); return tested.length ? Math.round(tested.reduce((s, c) => s + c.score!, 0) / tested.length) : null; };

export function InsightLists() {
  const { t, tl, analysis, settings, setNav, go } = useApp();
  const ins = buildInsights(analysis, settings);
  return (
    <div className="grid g2">
      <Card title={t('topRisks')}>{ins.topRisks.length ? <ol style={{ margin: 0, paddingInlineStart: 20 }}>{ins.topRisks.map((r) => <li key={r.def.id}><div className="row"><Sev s={r.residual} /><button className="btn sm ghost" onClick={() => { setNav({ riskId: r.def.id }); go('risks'); }}><span className="mono">{r.def.id}</span></button> {tl(r.def.title)} <span className="spacer" /><span className="small muted ltr">L{r.likelihood}×I{r.impact}</span></div></li>)}</ol> : <p className="muted small">{t('noFindings')}</p>}</Card>
      <Card title={t('topFindings')}><FindingList items={ins.topFindings} /></Card>
      <Card title={t('topRecs')}>{ins.topRecommendations.length ? <ol style={{ margin: 0, paddingInlineStart: 20 }}>{ins.topRecommendations.map((r) => <li key={r.id} className="small" style={{ marginBottom: 4 }}><b>{tl(PRIORITY[r.priority])}</b> · {tl(r.action)} <button className="btn sm ghost" onClick={() => setNav({ findingId: r.findingId })}>{r.findingId}</button></li>)}</ol> : <p className="muted small">{t('noFindings')}</p>}</Card>
      <Card title={t('topCfoActions')}>{ins.cfoActions.length ? <ol style={{ margin: 0, paddingInlineStart: 20 }}>{ins.cfoActions.map((r) => <li key={r.id} className="small" style={{ marginBottom: 4 }}>{tl(r.action)} <button className="btn sm ghost" onClick={() => setNav({ findingId: r.findingId })}>{r.findingId}</button></li>)}</ol> : <p className="muted small">{t('noFindings')}</p>}</Card>
      <Card title={t('auditPriorities')}><ol style={{ margin: 0, paddingInlineStart: 20 }}>{ins.auditPriorities.map((p, i) => <li key={i} className="small">{tl(AREA_LABEL[p.area]) || p.area} — <span className={p.reason === 'insufficient-data' ? 'insufficient' : ''}>{p.reason === 'insufficient-data' ? tl({ en: 'obtain missing data', ar: 'الحصول على البيانات الناقصة' }) : p.reason === 'repeat' ? tl({ en: 'repeat exceptions', ar: 'استثناءات متكررة' }) : tl({ en: 'high risk', ar: 'مخاطر مرتفعة' })}</span> <span className="muted">({tl(p.detail)})</span></li>)}</ol></Card>
      <Card title={t('topExposures')}><FindingList items={ins.topExposures} /></Card>
      <Card title={t('controlWeaknesses')}>{ins.controlWeaknesses.length ? <ol style={{ margin: 0, paddingInlineStart: 20 }}>{ins.controlWeaknesses.map((c) => <li key={c.def.id} className="small"><button className="btn sm ghost" onClick={() => { setNav({ controlId: c.def.id }); go('controls'); }}>{c.def.id}</button> {tl(c.def.objective)} — {c.score} {c.repeat && <span className="badge fail">REPEAT</span>}</li>)}</ol> : <p className="muted small">{t('noFindings')}</p>}</Card>
      <Card title={t('topFraud')} hint={tl({ en: 'Indicators requiring investigation — not conclusions of fraud.', ar: 'مؤشرات تتطلب التحقيق — ليست استنتاجات بوقوع احتيال.' })}><FindingList items={ins.fraudIndicators} /></Card>
    </div>
  );
}

export function Overview() {
  const { t, tl, analysis, settings, go, setFilters, filters, actions } = useApp();
  const list = useFindings();
  if (!analysis.hasData) return <NoData />;
  const counts = list.reduce<Record<string, number>>((m, f) => { m[f.rating] = (m[f.rating] ?? 0) + 1; return m; }, {});
  const exp = sumExp(list);
  const overdue = actions.filter((a) => a.status !== 'closed' && a.dueDate && a.dueDate < analysis.today).length;
  const perf = analysis.results.filter((r) => r.status === 'performed').length;
  const byArea = AREAS.map((a) => ({ label: tl(a.label), key: a.id, value: list.filter((f) => f.area === a.id).length })).filter((x) => x.value);
  const drill = (risk: string) => { setFilters({ ...filters, risk }); go('findings'); };
  return (
    <>
      <QCBanner />
      <div className="kpis">
        <Kpi accent label={t('dqScore')} value={analysis.quality.score ?? '—'} onClick={() => go('quality')} />
        <Kpi label={t('findings')} value={list.length} onClick={() => go('findings')} />
        <Kpi label={t('criticalFindings')} value={counts.critical ?? 0} onClick={() => drill('critical')} />
        <Kpi label={t('highFindings')} value={counts.high ?? 0} onClick={() => drill('high')} />
        <Kpi label={t('exposure')} value={<span style={{ fontSize: 15 }}><Money m={exp} /></span>} note={<Tag kind="calc" />} onClick={() => go('findings')} />
        <Kpi label={t('fraudIndicators')} value={list.filter((f) => f.fraudIndicator).length} onClick={() => go('fraud')} />
        <Kpi label={t('controlEffectiveness')} value={ctlEff(analysis) === null ? '—' : `${ctlEff(analysis)}%`} onClick={() => go('controls')} />
        <Kpi label={t('overdueActions')} value={overdue} onClick={() => go('actions')} />
        <Kpi label={t('testsPerformed')} value={`${perf}/${analysis.results.length}`} onClick={() => go('tests')} />
      </div>
      <div className="grid g2">
        <Card title={t('heatmap')}><Heatmap /></Card>
        <Card title={tl({ en: 'Findings by severity and audit area', ar: 'الملاحظات حسب الخطورة والمجال' })}>
          <SevStack counts={counts} />
          <div className="sep" />
          <Bars data={byArea} fmt={(v) => String(v)} onClick={(k) => { setFilters({ ...filters, area: k }); go('findings'); }} />
        </Card>
      </div>
      <h2 style={{ margin: '8px 0 0', fontSize: 16 }}>{tl({ en: 'Executive Insight Engine', ar: 'محرك الرؤى التنفيذية' })}</h2>
      <InsightLists />
      <p className="small muted">{tl({ en: 'Base currency', ar: 'العملة الأساسية' })}: {settings.baseCurrency}. {tl({ en: 'All values derive from uploaded data; nothing is estimated.', ar: 'جميع القيم مستمدة من البيانات المرفوعة؛ لا يوجد أي تقدير.' })}</p>
    </>
  );
}

export function QCBanner() {
  const { t, tl, analysis, go } = useApp();
  const cls = analysis.qcStatus === 'FAIL' ? 'fail' : analysis.qcStatus === 'WARNING' ? 'warn' : 'ok';
  return <div className={`banner ${cls}`}><QC s={analysis.qcStatus} /><div><b>{t('qc')}</b> — {analysis.qcStatus === 'FAIL' ? t('qcBlock') : tl({ en: 'See the quality check for warnings and their detail.', ar: 'راجع فحص الجودة لمعرفة التحذيرات وتفاصيلها.' })}</div><span className="spacer" /><button className="btn sm" onClick={() => go('qc')}>{t('qc')} →</button></div>;
}

/** CFO metrics computed from uploaded data only. Each returns value + source note or insufficient. */
function cfoMetrics(a: Analysis, s: Settings) {
  type M = { v: number | null; note: string; cur?: string };
  const tbl = (type: string) => a.filteredTables.filter((t) => t.datasetType === type);
  const out: Record<string, M> = {};
  // Cash: latest balance per bank account
  const bank = tbl('bank').filter((t) => t.mapping.balance && t.mapping.bankAccount);
  if (bank.length) {
    let sum = 0, n = 0; const curs = new Set<string>();
    for (const t of bank) { const ac = accessor(t); for (const [, rows] of groupBy([...t.rows], (r) => ac.t(r, 'bankAccount'))) { const last = [...rows].sort((x, y) => (ac.d(x, 'date') ?? '').localeCompare(ac.d(y, 'date') ?? '') || x.rowNumber - y.rowNumber).pop()!; sum += ac.n(last, 'balance') ?? 0; n++; curs.add(ac.t(last, 'currency').toUpperCase() || '—'); } }
    out.cash = { v: sum, note: `Σ latest balance of ${n} bank account(s)`, cur: [...curs].join('/') };
  } else if (a.fsa.available && a.fsa.totals.cash.accounts) out.cash = { v: a.fsa.totals.cash.current, note: `TB cash accounts (${a.fsa.totals.cash.accounts})` };
  else out.cash = { v: null, note: 'Bank data or TB required' };
  const r = (id: string) => a.fsa.ratios.find((x) => x.id === id);
  out.liquidity = { v: r('current')?.value ?? null, note: r('current')?.missing ?? 'Current ratio (TB)' };
  out.wc = { v: r('wc')?.value ?? null, note: r('wc')?.missing ?? 'Current assets − current liabilities (TB)' };
  const sumF = (type: string, f: string, pred?: (t: ReturnType<typeof accessor>, row: ReturnType<typeof accessor>['table']['rows'][number]) => boolean) => { const ts = tbl(type).filter((t) => t.mapping[f]); if (!ts.length) return null; let s2 = 0; for (const t of ts) { const ac = accessor(t); for (const row of t.rows) if (!pred || pred(ac, row)) s2 += ac.n(row, f) ?? 0; } return s2; };
  const arOut = sumF('ar', 'outstanding') ?? sumF('ar', 'amount');
  out.ar = { v: arOut, note: arOut === null ? 'AR data required' : 'Σ AR outstanding (or invoice amount)' };
  const apOpen = sumF('ap', 'amount', (ac, row) => !ac.d(row, 'paymentDate'));
  out.ap = { v: apOpen, note: apOpen === null ? 'AP data required' : 'Σ unpaid AP invoices' };
  const debt = sumF('loans', 'outstanding');
  out.debt = { v: debt ?? (a.fsa.totals.debt.accounts ? Math.abs(a.fsa.totals.debt.current) : null), note: debt !== null ? 'Σ loans outstanding' : a.fsa.totals.debt.accounts ? 'TB borrowings' : 'Loan schedule or TB required' };
  // FX exposure: non-base currency amounts across bank (latest balances), AP unpaid, AR outstanding, loans
  let fx = 0, fxSeen = false;
  for (const t of [...tbl('ap'), ...tbl('ar'), ...tbl('loans')]) { const ac = accessor(t); if (!ac.has('currency')) continue; fxSeen = true; const f = t.datasetType === 'loans' ? 'outstanding' : t.datasetType === 'ar' && ac.has('outstanding') ? 'outstanding' : 'amount'; for (const row of t.rows) { const c = ac.t(row, 'currency').toUpperCase(); if (c && c !== s.baseCurrency) fx += Math.abs(ac.n(row, f) ?? 0); } }
  out.fx = { v: fxSeen ? fx : null, note: fxSeen ? `Σ non-${s.baseCurrency} AP/AR/loan amounts in original currencies (not converted)` : 'Currency field required' };
  const bud = tbl('budget');
  const capexA = bud.length ? sumF('budget', 'actual', (ac, row) => /capex|capital|رأسمالي/i.test(ac.t(row, 'capex'))) : null;
  const opexA = bud.length ? sumF('budget', 'actual', (ac, row) => !/capex|capital|رأسمالي/i.test(ac.t(row, 'capex'))) : null;
  out.capex = { v: bud.some((t) => t.mapping.capex) ? capexA : null, note: bud.some((t) => t.mapping.capex) ? 'Σ actual CAPEX lines' : 'Budget with CAPEX/OPEX flag required' };
  out.opex = { v: bud.length ? opexA : null, note: bud.length ? 'Σ actual non-CAPEX lines' : 'Budget data required' };
  const act = sumF('budget', 'actual'), bb = sumF('budget', 'revised') ?? sumF('budget', 'original');
  out.bv = { v: act !== null && bb !== null ? act - bb : null, note: act !== null && bb !== null ? 'Σ Actual − Σ Budget' : 'Budget data required' };
  return out;
}

export function CfoDashboard() {
  const { t, tl, analysis, settings, go, actions, setNav } = useApp();
  if (!analysis.hasData) return <NoData />;
  const m = cfoMetrics(analysis, settings);
  const ins = buildInsights(analysis, settings);
  const finRisks = analysis.risks.filter((r) => r.def.category === 'financial' && r.residualScore !== null);
  const overdue = actions.filter((a) => a.status !== 'closed' && a.dueDate && a.dueDate < analysis.today).length;
  const K = (k: string, label: string, page: Parameters<typeof go>[0], unit = '') => <Kpi label={label} value={m[k].v === null ? '—' : <span className="ltr">{fmtNum(m[k].v)}{unit}</span>} note={m[k].v === null ? <span className="insufficient">{t('insufficient')}</span> : <span title={m[k].note}><Tag kind="src" /> {m[k].note}{m[k].cur ? ` (${m[k].cur})` : ''}</span>} onClick={() => go(page)} />;
  const fin = analysis.findings.filter((f) => ['gl', 'ap', 'ar', 'treasury', 'tax', 'loans', 'opex', 'capex', 'recon', 'fa', 'inventory'].includes(f.area));
  return (
    <>
      <QCBanner />
      <div className="kpis">
        {K('cash', t('cash'), 'recon')}{K('liquidity', `${t('liquidity')} (${tl({ en: 'current ratio', ar: 'نسبة التداول' })})`, 'fs', 'x')}{K('wc', t('workingCapital'), 'fs')}{K('ar', t('ar'), 'findings')}{K('ap', t('ap'), 'findings')}{K('debt', t('debt'), 'fs')}{K('fx', t('fxExposure'), 'fs')}{K('capex', t('capex'), 'findings')}{K('opex', t('opex'), 'findings')}{K('bv', t('budgetVariance'), 'findings')}
        <Kpi label={t('financialRisk')} value={finRisks.filter((r) => r.residual === 'critical' || r.residual === 'high').length} note={tl({ en: 'financial risks rated High/Critical', ar: 'مخاطر مالية مرتفعة/حرجة' })} onClick={() => go('risks')} />
        <Kpi label={t('controlFailures')} value={analysis.controls.filter((c) => c.rating === 'ineffective').length} onClick={() => go('controls')} />
        <Kpi label={t('fraudIndicators')} value={analysis.findings.filter((f) => f.fraudIndicator).length} onClick={() => go('fraud')} />
        <Kpi label={t('openFindings')} value={analysis.findings.filter((f) => !['closed', 'dismissed'].includes(f.status)).length} onClick={() => go('findings')} />
        <Kpi label={t('overdueActions')} value={overdue} onClick={() => go('actions')} />
      </div>
      <div className="grid g3">
        <Card title={t('cfoRisks')}>{finRisks.length ? <ol style={{ margin: 0, paddingInlineStart: 20 }}>{finRisks.slice(0, 10).map((r) => <li key={r.def.id} className="small"><Sev s={r.residual} /> {tl(r.def.title)} — <Money m={r.exposure} /> <button className="btn sm ghost" onClick={() => { setNav({ riskId: r.def.id }); go('risks'); }}>→</button></li>)}</ol> : <p className="muted small">{t('insufficient')}</p>}</Card>
        <Card title={t('topCfoActions')}>{ins.cfoActions.length ? <ol style={{ margin: 0, paddingInlineStart: 20 }}>{ins.cfoActions.map((r) => <li key={r.id} className="small">{tl(r.action)} <button className="btn sm ghost" onClick={() => setNav({ findingId: r.findingId })}>{r.findingId}</button></li>)}</ol> : <p className="muted small">{t('noFindings')}</p>}</Card>
        <Card title={t('cfoExceptions')}><FindingList items={[...fin].sort((x, y) => (y.exposure[settings.baseCurrency] ?? 0) - (x.exposure[settings.baseCurrency] ?? 0)).slice(0, 10)} /></Card>
      </div>
      <p className="small muted">{tl({ en: 'Amounts are shown in source currencies; no FX conversion is applied unless an EGP-equivalent column is uploaded.', ar: 'تُعرض المبالغ بعملات المصدر؛ لا يتم أي تحويل ما لم يُرفع عمود المعادل بالجنيه.' })}</p>
    </>
  );
}

export function CommitteeDashboard() {
  const { t, tl, analysis, settings, go, actions, setNav } = useApp();
  if (!analysis.hasData) return <NoData />;
  const ins = buildInsights(analysis, settings);
  const fs = analysis.findings;
  const worst = analysis.risks.find((r) => r.residualScore !== null);
  const tested = analysis.controls.filter((c) => c.score !== null);
  const effPct = tested.length ? Math.round(tested.filter((c) => c.rating === 'effective').length / tested.length * 100) : null;
  const areasWithData = analysis.universe.filter((u) => u.rows > 0);
  const planPct = analysis.universe.length ? Math.round(areasWithData.length / analysis.universe.length * 100) : 0;
  const overdue = actions.filter((a) => a.status !== 'closed' && a.dueDate && a.dueDate < analysis.today).length;
  return (
    <>
      <QCBanner />
      <div className="kpis">
        <Kpi accent label={t('overallRisk')} value={worst ? <Sev s={worst.residual} /> : '—'} note={worst ? tl(worst.def.title) : t('insufficient')} onClick={() => go('risks')} />
        <Kpi label={t('criticalFindings')} value={fs.filter((f) => f.rating === 'critical').length} onClick={() => go('findings')} />
        <Kpi label={t('highFindings')} value={fs.filter((f) => f.rating === 'high').length} onClick={() => go('findings')} />
        <Kpi label={t('exposure')} value={<span style={{ fontSize: 15 }}><Money m={sumExp(fs)} /></span>} />
        <Kpi label={t('fraudIndicators')} value={fs.filter((f) => f.fraudIndicator).length} note={tl({ en: 'require investigation', ar: 'تتطلب التحقيق' })} />
        <Kpi label={t('controlEffectiveness')} value={effPct === null ? '—' : `${effPct}%`} note={tl({ en: '% of tested controls rated effective', ar: 'نسبة الضوابط الفعالة من المختبرة' })} onClick={() => go('controls')} />
        <Kpi label={t('planProgress')} value={`${planPct}%`} note={tl({ en: 'audit areas with data tested', ar: 'مجالات تم اختبارها' })} onClick={() => go('universe')} />
        <Kpi label={t('overdueActions')} value={overdue} onClick={() => go('actions')} />
      </div>
      <div className="grid g2">
        <Card title={t('emergingRisks')}>{analysis.change.baseline ? (analysis.change.newExceptions.length ? <ul className="small">{analysis.change.newExceptions.slice(0, 8).map((x) => <li key={x.testId}>{x.testId}: {x.keys.length} {tl({ en: 'new exception(s)', ar: 'استثناء جديد' })}</li>)}</ul> : <p className="muted small">{tl({ en: 'No new exceptions since the last snapshot.', ar: 'لا استثناءات جديدة منذ آخر لقطة.' })}</p>) : <p className="small"><span className="insufficient">{t('insufficient')}</span> — {tl({ en: 'no baseline snapshot', ar: 'لا توجد لقطة أساس' })}</p>}</Card>
        <Card title={t('topRecs')}>{ins.topRecommendations.slice(0, 5).map((r) => <div key={r.id} className="small row" style={{ marginBottom: 4 }}><Sev s={r.rating} /> {tl(r.action)} <button className="btn sm ghost" onClick={() => setNav({ findingId: r.findingId })}>{r.findingId}</button></div>)}{!ins.topRecommendations.length && <p className="muted small">{t('noFindings')}</p>}</Card>
      </div>
      <Card title={t('topFindings')}><FindingList items={ins.topFindings.slice(0, 5)} /></Card>
    </>
  );
}

export function QualityCheck() {
  const { t, tl, analysis } = useApp();
  return (
    <>
      <QCBanner />
      <Card title={t('qc')} hint={tl({ en: 'Official audit conclusions are not presented while any check is FAIL.', ar: 'لا تُعرض استنتاجات المراجعة الرسمية ما دام أي فحص في حالة إخفاق.' })}>
        <div className="table-wrap"><table><thead><tr><th>{tl({ en: 'Check', ar: 'الفحص' })}</th><th>{t('status')}</th><th>{tl({ en: 'Detail', ar: 'التفاصيل' })}</th></tr></thead>
          <tbody>{analysis.qc.map((q) => <tr key={q.id}><td>{tl(q.label)}</td><td><QC s={q.status} /></td><td className="small">{q.detail}</td></tr>)}</tbody></table></div>
      </Card>
    </>
  );
}

