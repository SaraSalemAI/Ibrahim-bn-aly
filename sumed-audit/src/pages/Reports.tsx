import { useState } from 'react';
import { useApp, CAN } from '../state';
import type { Finding, L } from '../engine/types';
import { TEST_BY_ID } from '../engine/tests';
import { RISK_BY_ID, CONTROL_BY_ID, AREA_LABEL } from '../engine/library';
import { buildWorkbook, downloadBlob, downloadCsv, fileStamp, evidenceRows, EVIDENCE_HEADER } from '../exports';
import { fmtMoney } from '../engine/values';
import { Card, Sev, QC, Money } from '../ui/kit';
import { printNow } from './common';
import { InsightLists } from './Dashboards';

interface ReportDef { id: string; title: L; filter?: (f: Finding) => boolean; kind?: 'findings' | 'risks' | 'controls' | 'evidence' | 'actions' | 'executive' }
const A = (...areas: string[]) => (f: Finding) => areas.includes(f.area);
const T = (...p: string[]) => (f: Finding) => p.some((x) => f.testId.startsWith(x));
export const REPORTS: ReportDef[] = [
  { id: 'exec', title: { en: 'Executive Audit Report', ar: 'تقرير المراجعة التنفيذي' }, kind: 'executive' },
  { id: 'detail', title: { en: 'Detailed Internal Audit Report', ar: 'تقرير المراجعة الداخلية التفصيلي' } },
  { id: 'cfo', title: { en: 'CFO Risk Report', ar: 'تقرير مخاطر المدير المالي' }, filter: A('gl', 'ap', 'ar', 'treasury', 'tax', 'loans', 'opex', 'capex', 'recon', 'fa', 'inventory') },
  { id: 'committee', title: { en: 'Audit Committee Report', ar: 'تقرير لجنة المراجعة' }, kind: 'executive', filter: (f) => f.rating === 'critical' || f.rating === 'high' },
  { id: 'fincontrol', title: { en: 'Financial Control Report', ar: 'تقرير الرقابة المالية' }, kind: 'controls' },
  { id: 'fraud', title: { en: 'Fraud Risk Report', ar: 'تقرير مخاطر الاحتيال' }, filter: (f) => f.fraudIndicator },
  { id: 'treasury', title: { en: 'Treasury Audit Report', ar: 'تقرير مراجعة الخزانة' }, filter: A('treasury', 'loans') },
  { id: 'ap', title: { en: 'AP Audit Report', ar: 'تقرير مراجعة الحسابات الدائنة' }, filter: A('ap') },
  { id: 'ar', title: { en: 'AR Audit Report', ar: 'تقرير مراجعة الحسابات المدينة' }, filter: A('ar') },
  { id: 'proc', title: { en: 'Procurement Audit Report', ar: 'تقرير مراجعة المشتريات' }, filter: A('procurement') },
  { id: 'sites', title: { en: 'Site Payments & Contracts Report (HO · Sokhna · Kerir · Dahshour)', ar: 'تقرير مدفوعات وعقود المواقع (المركز الرئيسي · السخنة · كرير · دهشور)' }, filter: T('ST-', 'CT-', 'PR-08') },
  { id: 'fa', title: { en: 'Fixed Asset Audit Report', ar: 'تقرير مراجعة الأصول الثابتة' }, filter: A('fa') },
  { id: 'inv', title: { en: 'Inventory Audit Report', ar: 'تقرير مراجعة المخزون' }, filter: A('inventory') },
  { id: 'payroll', title: { en: 'Payroll Audit Report', ar: 'تقرير مراجعة الرواتب' }, filter: A('payroll') },
  { id: 'capex', title: { en: 'CAPEX Audit Report', ar: 'تقرير مراجعة النفقات الرأسمالية' }, filter: A('capex') },
  { id: 'opex', title: { en: 'OPEX Audit Report', ar: 'تقرير مراجعة النفقات التشغيلية' }, filter: A('opex') },
  { id: 'bankrec', title: { en: 'Bank Reconciliation Report', ar: 'تقرير التسوية البنكية' }, filter: T('REC-07', 'REC-08', 'TR-02') },
  { id: 'je', title: { en: 'Journal Entry Report', ar: 'تقرير قيود اليومية' }, filter: A('gl') },
  { id: 'budget', title: { en: 'Budget Variance Report', ar: 'تقرير انحرافات الموازنة' }, filter: T('BU-', 'CX-', 'OX-') },
  { id: 'tax', title: { en: 'Tax Control Report', ar: 'تقرير الرقابة الضريبية' }, filter: A('tax') },
  { id: 'actions', title: { en: 'Management Action Report', ar: 'تقرير إجراءات الإدارة' }, kind: 'actions' },
  { id: 'risk', title: { en: 'Risk Register', ar: 'سجل المخاطر' }, kind: 'risks' },
  { id: 'control', title: { en: 'Control Register', ar: 'سجل الضوابط' }, kind: 'controls' },
  { id: 'evidence', title: { en: 'Evidence Register', ar: 'سجل الأدلة' }, kind: 'evidence' },
];

export function Reports() {
  const app = useApp();
  const { t, tl, analysis, settings, prefs, lang, log, actions, log_, files, planMeta } = app;
  const [sel, setSel] = useState('exec');
  const [busy, setBusy] = useState(false);
  const def = REPORTS.find((r) => r.id === sel)!;
  const fs = analysis.findings.filter((f) => !def.filter || def.filter(f));
  const canExport = CAN.export(prefs.role);
  const wb = async () => { setBusy(true); try { downloadBlob(`SUMED-audit-workbook-${lang}-${fileStamp()}.xlsx`, await buildWorkbook(analysis, settings, lang, log, actions, prefs.unmask, planMeta)); log_('EXPORT_WORKBOOK', 'workbook', lang); } finally { setBusy(false); } };
  const csv = () => {
    log_('EXPORT_REPORT_CSV', def.id, lang);
    if (def.kind === 'evidence') return downloadCsv(`evidence-register-${fileStamp()}`, EVIDENCE_HEADER, fs.flatMap((f) => evidenceRows(analysis, f, prefs.unmask, lang)));
    if (def.kind === 'risks') return downloadCsv(`risk-register-${fileStamp()}`, ['Risk ID', 'Risk', 'Likelihood', 'Impact', 'Residual', 'Exposure', 'Owner', 'Status'], analysis.risks.map((r) => [r.def.id, tl(r.def.title), r.likelihood, r.impact, r.residual, fmtMoney(r.exposure), r.owner, r.status]));
    if (def.kind === 'controls') return downloadCsv(`control-register-${fileStamp()}`, ['Control ID', 'Objective', 'Score', 'Rating', 'Exceptions'], analysis.controls.map((c) => [c.def.id, tl(c.def.objective), c.score, c.rating, c.exceptions]));
    if (def.kind === 'actions') return downloadCsv(`actions-${fileStamp()}`, ['ID', 'Finding', 'Owner', 'Due', 'Status', '%'], actions.map((a) => [a.id, a.findingId, a.owner, a.dueDate, a.status, a.completion]));
    downloadCsv(`${def.id}-${fileStamp()}`, ['Finding ID', 'Title', 'Rating', 'Condition', 'Criteria', 'Cause', 'Effect', 'Exposure', 'Recommendation', 'Status'], fs.map((f) => [f.id, tl(f.title), f.rating, tl(f.condition), tl(f.criteria), tl(f.cause), tl(f.effect), fmtMoney(f.exposure), tl(TEST_BY_ID[f.testId].recommendation), f.status]));
  };
  return (
    <>
      <Card title={t('reports')} hint={tl({ en: 'Every report is generated from the current data, filters and language. PDF uses the print engine (choose "Save as PDF") so Arabic renders correctly.', ar: 'تُولد التقارير من البيانات والمرشحات واللغة الحالية. يستخدم PDF محرك الطباعة (اختر "حفظ كـ PDF") لعرض العربية بشكل صحيح.' })}
        actions={canExport ? <button className="btn accent" disabled={busy || !analysis.hasData} onClick={wb}>⤓ {t('workbook')}</button> : undefined}>
        <div className="row no-print">
          <select className="inp" value={sel} onChange={(e) => setSel(e.target.value)} style={{ minWidth: 320 }}>{REPORTS.map((r, i) => <option key={r.id} value={r.id}>{i + 1}. {tl(r.title)}</option>)}</select>
          {canExport && <><button className="btn" onClick={() => { log_('EXPORT_REPORT_PDF', def.id, lang); printNow(); }}>⎙ {t('exportPdf')}</button><button className="btn" onClick={wb} disabled={busy || !analysis.hasData}>{t('exportXlsx')}</button><button className="btn" onClick={csv}>{t('exportCsv')}</button></>}
        </div>
      </Card>
      <div className="card" id="report">
        <div className="row"><div><h2 style={{ margin: 0 }}>{tl(def.title)}</h2><div className="small muted">{t('company')}</div></div><span className="spacer" /><div className="small" style={{ textAlign: 'end' }}>{new Date().toISOString().slice(0, 16).replace('T', ' ')}<br />{prefs.user} · {tl({ en: 'QC', ar: 'فحص الجودة' })} <QC s={analysis.qcStatus} /></div></div>
        {analysis.qcStatus === 'FAIL' && <div className="banner fail small" style={{ marginTop: 8 }}>{t('qcBlock')} {tl({ en: 'This report is a DRAFT for internal use.', ar: 'هذا التقرير مسودة للاستخدام الداخلي.' })}</div>}
        <div className="sep" />
        {!analysis.hasData ? <p className="insufficient">{t('uploadToStart')}</p> : def.kind === 'risks' ? (
          <table><thead><tr><th>ID</th><th>{tl({ en: 'Risk', ar: 'المخاطر' })}</th><th>L</th><th>I</th><th>{tl({ en: 'Residual', ar: 'المتبقية' })}</th><th>{t('exposure')}</th><th>{t('owner')}</th><th>{t('status')}</th></tr></thead>
            <tbody>{analysis.risks.map((r) => <tr key={r.def.id}><td className="mono">{r.def.id}</td><td>{tl(r.def.title)}<div className="small muted">{tl(r.basis)}</div></td><td>{r.likelihood ?? '—'}</td><td>{r.impact ?? '—'}</td><td><Sev s={r.residual} /></td><td><Money m={r.exposure} /></td><td>{r.owner || '—'}</td><td>{r.status}</td></tr>)}</tbody></table>
        ) : def.kind === 'controls' ? (
          <table><thead><tr><th>ID</th><th>{tl({ en: 'Objective', ar: 'الهدف' })}</th><th>{tl({ en: 'Tests', ar: 'الاختبارات' })}</th><th>{t('exceptions')}</th><th>{tl({ en: 'Score', ar: 'الدرجة' })}</th><th>{t('rating')}</th></tr></thead>
            <tbody>{analysis.controls.map((c) => <tr key={c.def.id}><td className="mono">{c.def.id}</td><td>{tl(c.def.objective)}</td><td>{c.performed}/{c.tests.length}</td><td>{c.exceptions}</td><td>{c.score ?? '—'}</td><td>{c.rating}</td></tr>)}</tbody></table>
        ) : def.kind === 'actions' ? (
          actions.length ? <table><thead><tr><th>ID</th><th>{t('findingId')}</th><th>{t('owner')}</th><th>{t('dueDate')}</th><th>{t('status')}</th><th>%</th></tr></thead><tbody>{actions.map((a) => <tr key={a.id}><td className="mono">{a.id}</td><td>{a.findingId}</td><td>{a.owner}</td><td>{a.dueDate}</td><td>{a.status !== 'closed' && a.dueDate < analysis.today ? 'OVERDUE' : a.status}</td><td>{a.completion}</td></tr>)}</tbody></table> : <p className="muted">{tl({ en: 'No actions assigned.', ar: 'لا توجد إجراءات.' })}</p>
        ) : def.kind === 'evidence' ? (
          <table><thead><tr>{['Finding', 'Test', 'File', 'Sheet', 'Row', 'Record'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{fs.flatMap((f) => evidenceRows(analysis, f, prefs.unmask, lang)).slice(0, 1000).map((r, i) => <tr key={i}><td className="mono">{r[0]}</td><td className="mono">{r[1]}</td><td className="mono small">{r[9]}</td><td className="small">{r[10]}</td><td>{r[11]}</td><td className="mono small">{r[12]}</td></tr>)}</tbody></table>
        ) : (
          <>
            <div className="row small"><b>{fs.length}</b> {t('findings')} · {(['critical', 'high', 'medium', 'low'] as const).map((s) => <span key={s} className={`badge ${s}`}><span className="dot" />{t(s)} {fs.filter((f) => f.rating === s).length}</span>)} · {t('exposure')}: <Money m={fs.reduce<Record<string, number>>((m, f) => { for (const [c, v] of Object.entries(f.exposure)) m[c] = (m[c] ?? 0) + v; return m; }, {})} /></div>
            {def.kind === 'executive' && <div style={{ marginTop: 12 }}><InsightLists /></div>}
            {fs.length === 0 && <p className="muted">{t('noFindings')}</p>}
            {fs.map((f) => (
              <div key={f.id} style={{ breakInside: 'avoid', marginTop: 14 }}>
                <h3 className="row"><span className="mono">{f.id}</span> {tl(f.title)} <Sev s={f.rating} /> <span className="small muted">{tl(AREA_LABEL[f.area])}</span></h3>
                <dl className="kv small">
                  <dt>{t('condition')}</dt><dd>{tl(f.condition)}</dd><dt>{t('criteria')}</dt><dd>{tl(f.criteria)}</dd><dt>{t('cause')}</dt><dd>{tl(f.cause)} <span className="tag ai">AI</span></dd><dt>{t('effect')}</dt><dd>{tl(f.effect)}</dd>
                  <dt>{t('financialImpact')}</dt><dd><Money m={f.exposure} /></dd><dt>{tl({ en: 'Risk / Control', ar: 'المخاطر / الرقابة' })}</dt><dd>{f.riskId} {tl(RISK_BY_ID[f.riskId]?.title)} · {f.controlId} {tl(CONTROL_BY_ID[f.controlId]?.objective)}</dd>
                  <dt>{t('recommendation')}</dt><dd>{tl(TEST_BY_ID[f.testId].recommendation)}</dd><dt>{t('evidence')}</dt><dd>{f.exceptionCount} {t('exceptions')} · {f.evidenceStatus} · {t('confidence')} {f.confidence}</dd>
                  <dt>{t('owner')} / {t('dueDate')}</dt><dd>{f.owner || '—'} / {f.dueDate || '—'} · {t('status')}: {f.status}</dd>
                </dl>
              </div>
            ))}
          </>
        )}
        <div className="sep" />
        <p className="small muted">{tl({ en: 'Data sources', ar: 'مصادر البيانات' })}: {files.map((f) => `${f.name} (#${f.sha256.slice(0, 10)})`).join(' · ') || '—'}</p>
        <p className="small muted">{tl({ en: 'Framework references (COSO, IIA Standards, EAS/IFRS, Egyptian tax) are structural only; no compliance is claimed. Legal/regulatory conclusions require the relevant document to be provided and verified.', ar: 'المراجع الإطارية (COSO ومعايير IIA ومعايير المحاسبة المصرية/IFRS والضرائب المصرية) هيكلية فقط؛ لا يُدعى الالتزام. الاستنتاجات القانونية تتطلب تقديم المستند المعني والتحقق منه.' })}</p>
      </div>
    </>
  );
}
