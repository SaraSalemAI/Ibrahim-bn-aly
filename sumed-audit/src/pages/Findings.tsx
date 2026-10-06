import { useState } from 'react';
import { useApp, CAN } from '../state';
import type { ActionItem, Finding, FindingStatus } from '../engine/types';
import { TEST_BY_ID } from '../engine/tests';
import { RISK_BY_ID, CONTROL_BY_ID, AREA_LABEL } from '../engine/library';
import { Card, DataTable, Empty, Money, Modal, Sev, Tag, Field, SevStack, QC } from '../ui/kit';
import { useFindings, printNow } from './common';
import { downloadBlob, downloadCsv, evidencePackageXlsx, evidenceRows, EVIDENCE_HEADER, fileStamp } from '../exports';
import { fmtMoney } from '../engine/values';
import { statusLabel } from '../i18n/dict';

export function FindingsPage() {
  const { t, tl, analysis, setNav, go, lang } = useApp();
  const list = useFindings();
  if (!analysis.hasData) return <Empty title={t('uploadToStart')}><button className="btn primary" onClick={() => go('upload')}>{t('upload')}</button></Empty>;
  const counts = list.reduce<Record<string, number>>((m, f) => { m[f.rating] = (m[f.rating] ?? 0) + 1; return m; }, {});
  return (
    <>
      {analysis.qcStatus === 'FAIL' && <div className="banner fail"><b>{t('qcBlock')}</b></div>}
      <Card title={`${t('findings')} (${list.length})`} hint={tl({ en: 'AI-generated findings are drafts until reviewed and validated by an auditor. Fraud-related items are indicators requiring investigation, not conclusions.', ar: 'الملاحظات المولدة آليًا مسودات حتى يراجعها ويعتمدها المراجع. البنود المتعلقة بالاحتيال مؤشرات تتطلب التحقيق وليست استنتاجات.' })}>
        <SevStack counts={counts} />
        <div style={{ height: 10 }} />
        <DataTable rows={list} csvName="findings" onRow={(f) => setNav({ findingId: f.id })} empty={<Empty title={t('noFindings')} />} cols={[
          { key: 'id', label: t('findingId'), render: (f) => <span className="mono">{f.id}</span> },
          { key: 'rating', label: t('rating'), render: (f) => <Sev s={f.rating} />, value: (f) => ({ critical: 5, high: 4, medium: 3, low: 2, info: 1 })[f.rating] },
          { key: 'title', label: tl({ en: 'Finding', ar: 'الملاحظة' }), value: (f) => tl(f.title), render: (f) => <>{tl(f.title)} {f.fraudIndicator && <span className="tag risk">{lang === 'ar' ? 'مؤشر احتيال' : 'Fraud risk indicator'}</span>}</> },
          { key: 'area', label: t('area'), value: (f) => tl(AREA_LABEL[f.area]) },
          { key: 'exceptionCount', label: t('exceptions'), num: true },
          { key: 'exposure', label: t('exposure'), value: (f) => Object.values(f.exposure).reduce((a, b) => a + b, 0), csv: (f) => fmtMoney(f.exposure), render: (f) => <Money m={f.exposure} />, num: true },
          { key: 'evidenceStatus', label: t('evidence'), value: (f) => f.evidenceStatus, render: (f) => <EvStatus f={f} /> },
          { key: 'confidence', label: t('confidence') },
          { key: 'status', label: t('status'), render: (f) => statusLabel(f.status, lang) },
          { key: 'owner', label: t('owner'), render: (f) => f.owner || <span className="muted">{t('unassigned')}</span> },
          { key: 'ev', label: '', csv: () => '', render: (f) => <button className="btn sm evidence-btn" onClick={(e) => { e.stopPropagation(); setNav({ evidence: { findingId: f.id, index: 0 } }); }}>{t('showEvidence')}</button> },
        ]} />
      </Card>
    </>
  );
}

export function EvStatus({ f }: { f: Finding }) {
  const { t } = useApp();
  return f.evidenceStatus === 'validated' ? <span className="badge pass">✓ {t('validated')}</span> : f.evidenceStatus === 'validation-required' ? <span className="badge warn">! {t('validationRequired')}</span> : <span className="badge fail">✕ {t('insufficientEvidence')}</span>;
}

const NEXT_STATUS: FindingStatus[] = ['draft', 'under-review', 'validated', 'official', 'closed', 'dismissed'];

export function FindingDetail({ id }: { id: string }) {
  const app = useApp();
  const { t, tl, analysis, setNav, prefs, overrides, setOverride, upsertAction, actions, lang, log_ } = app;
  const f = analysis.findingById[id];
  const [owner, setOwner] = useState(f?.owner ?? '');
  const [due, setDue] = useState(f?.dueDate ?? '');
  const [dept, setDept] = useState('');
  const [notes, setNotes] = useState(overrides[id]?.notes ?? '');
  if (!f) return <Modal title={id} onClose={() => setNav({ findingId: null })}><Empty title={tl({ en: 'This finding is not present under the current data/filters.', ar: 'هذه الملاحظة غير موجودة وفق البيانات/المرشحات الحالية.' })} /></Modal>;
  const def = TEST_BY_ID[f.testId];
  const risk = RISK_BY_ID[f.riskId], ctl = CONTROL_BY_ID[f.controlId];
  const rec = analysis.recommendations.find((r) => r.findingId === f.id);
  const r = analysis.resultById[f.testId];
  const act = actions.find((a) => a.findingId === f.id);
  const setStatus = (s: FindingStatus) => setOverride(f.id, { status: s, ...(s === 'validated' ? { validatedBy: prefs.user } : s === 'under-review' ? { reviewedBy: prefs.user } : {}) }, `status ${f.status} → ${s}`);
  const canOfficial = f.status === 'validated' && analysis.qcStatus !== 'FAIL' && f.evidenceStatus !== 'insufficient' && prefs.role === 'cae';
  const assign = () => {
    if (!owner || !due) return alert(tl({ en: 'Owner and due date are required.', ar: 'المسؤول وتاريخ الاستحقاق مطلوبان.' }));
    const a: ActionItem = act ? { ...act, owner, dueDate: due, department: dept || act.department } : { id: `MA-${f.testId}`, findingId: f.id, recommendationId: f.recommendationId, owner, department: dept, dueDate: due, priority: rec?.priority ?? 'medium', status: 'open', completion: 0, evidence: '', validation: '', closureDate: '', createdAt: new Date().toISOString() };
    upsertAction(a, `assign ${owner} due ${due}`);
    setOverride(f.id, { owner, dueDate: due }, `owner=${owner}; due=${due}`);
  };
  const exportX = async () => { downloadBlob(`evidence-${f.id}-${fileStamp()}.xlsx`, await evidencePackageXlsx(analysis, f, lang, prefs.unmask, prefs.user, notes)); log_('EXPORT_EVIDENCE_XLSX', f.id); };
  const exportC = () => { downloadCsv(`evidence-${f.id}-${fileStamp()}`, EVIDENCE_HEADER, evidenceRows(analysis, f, prefs.unmask, lang)); log_('EXPORT_EVIDENCE_CSV', f.id); };
  const high = f.rating === 'critical' || f.rating === 'high';
  return (
    <Modal title={<><span className="mono">{f.id}</span> · {tl(f.title)}</>} onClose={() => setNav({ findingId: null })}
      actions={<button className="btn evidence-btn" onClick={() => setNav({ evidence: { findingId: f.id, index: 0 } })}>🔍 {t('showEvidence')}</button>}>
      <div className="row"><Sev s={f.rating} /><EvStatus f={f} /><span className="badge">{t('status')}: {statusLabel(f.status, lang)}</span><span className="badge">{t('confidence')}: {f.confidence}</span>{f.fraudIndicator && <span className="badge fail">⚠ {lang === 'ar' ? 'مؤشر مخاطر احتيال — يتطلب التحقيق' : 'Fraud Risk Indicator — Requires Investigation'}</span>}</div>
      {f.fraudIndicator && <div className="banner warn small">{tl({ en: 'This is an anomaly pattern, not a conclusion of fraud. A human auditor must validate before any fraud-related conclusion is drawn.', ar: 'هذا نمط غير معتاد وليس استنتاجًا بوقوع احتيال. يجب أن يتحقق منه مراجع بشري قبل أي استنتاج.' })}</div>}
      {(high || CAN.review(prefs.role)) && prefs.role !== 'readonly' && prefs.role !== 'committee' && (
        <div className="card btn-row no-print">
          <button className="btn" disabled={!CAN.review(prefs.role)} onClick={() => setStatus('under-review')}>{t('review')}</button>
          <button className="btn primary" disabled={!CAN.validate(prefs.role) || f.evidenceStatus === 'insufficient'} onClick={() => setStatus('validated')} title={f.evidenceStatus === 'insufficient' ? t('insufficientEvidence') : ''}>{t('validate')}</button>
          <button className="btn" disabled={!canOfficial} onClick={() => setStatus('official')} title={analysis.qcStatus === 'FAIL' ? t('qcBlock') : ''}>{lang === 'ar' ? 'اعتماد كملاحظة رسمية' : 'Make official'}</button>
          <a className="btn" href="#assign" onClick={(e) => { e.preventDefault(); document.getElementById('assign-box')?.scrollIntoView({ behavior: 'smooth' }); }}>{t('assignAction')}</a>
          <button className="btn" disabled={!CAN.export(prefs.role)} onClick={exportX}>{t('exportEvidence')} · Excel</button>
          <button className="btn" disabled={!CAN.export(prefs.role)} onClick={exportC}>CSV</button>
          <button className="btn" disabled={!CAN.export(prefs.role)} onClick={() => { log_('EXPORT_EVIDENCE_PDF', f.id); printNow(true); }}>PDF</button>
          <span className="spacer" />
          {CAN.validate(prefs.role) && <select className="inp" value={f.status} onChange={(e) => setStatus(e.target.value as FindingStatus)}>{NEXT_STATUS.map((s) => <option key={s} value={s} disabled={s === 'official' && !canOfficial && f.status !== 'official'}>{statusLabel(s, lang)}</option>)}</select>}
        </div>
      )}
      {analysis.qcStatus === 'FAIL' && <div className="banner fail small">{t('qcBlock')}</div>}
      <div className="grid g2">
        <Card title={<><Tag kind="src" /> <Tag kind="calc" /> {t('condition')}</>}><p>{tl(f.condition)}</p><p className="small muted">{t('population')}: {f.population.toLocaleString()} · {t('exceptions')}: {f.exceptionCount}</p></Card>
        <Card title={t('criteria')}><p>{tl(f.criteria)}</p><p className="small muted">{tl(def.rule)}</p></Card>
        <Card title={<><Tag kind="ai" /> {t('cause')}</>}><p>{tl(f.cause)}</p></Card>
        <Card title={<><Tag kind="ai" /> {t('effect')}</>}><p>{tl(f.effect)}</p></Card>
        <Card title={<><Tag kind="risk" /> {t('rating')} · {t('financialImpact')}</>}>
          <dl className="kv"><dt>{t('rating')}</dt><dd><Sev s={f.rating} /></dd><dt>{t('financialImpact')}</dt><dd><Money m={f.exposure} />{Object.keys(f.exposure).includes('—') && <div className="small muted">{tl({ en: '"—" = currency not specified in source; not converted.', ar: '"—" = العملة غير محددة بالمصدر؛ لم يتم تحويلها.' })}</div>}</dd><dt>{tl({ en: 'Basis', ar: 'الأساس' })}</dt><dd className="small">{tl(f.ratingBasis)}</dd><dt>{t('confidence')}</dt><dd className="small">{f.confidence} — {tl(f.confidenceBasis)}</dd></dl>
        </Card>
        <Card title={t('controlImpact')}>
          <dl className="kv"><dt>{tl({ en: 'Risk', ar: 'المخاطر' })}</dt><dd><button className="btn sm ghost" onClick={() => { setNav({ findingId: null, riskId: f.riskId }); app.go('risks'); }}>{f.riskId}</button> {tl(risk?.title)}</dd><dt>{tl({ en: 'Control', ar: 'الضابط' })}</dt><dd><button className="btn sm ghost" onClick={() => { setNav({ findingId: null, controlId: f.controlId }); app.go('controls'); }}>{f.controlId}</button> {tl(ctl?.objective)}</dd><dt>{tl({ en: 'Audit test', ar: 'الاختبار' })}</dt><dd><span className="mono">{def.id}</span> {tl(def.name)}</dd></dl>
        </Card>
      </div>
      <Card title={t('evidenceChecks')}>
        <div className="grid g3">{f.evidenceChecks.map((c) => <div key={c.id} className="row small"><QC s={c.pass ? 'PASS' : c.id === 'materiality' || c.id === 'contradiction' || c.id === 'dup' ? 'WARNING' : 'FAIL'} /> {tl(c.label)}{c.note && <span className="muted"> — {tl(c.note)}</span>}</div>)}</div>
      </Card>
      <Card title={`${t('exceptions')} (${r.exceptions.length})`}>
        <DataTable rows={r.exceptions.map((e, i) => ({ e, i }))} max={200} cols={[
          { key: 'i', label: '#', value: (x) => x.i + 1 },
          { key: 'd', label: tl({ en: 'Exception', ar: 'الاستثناء' }), value: (x) => tl(x.e.description) },
          { key: 'm', label: t('exposure'), value: (x) => x.e.money?.amount ?? null, render: (x) => (x.e.money ? <span className="ltr">{fmtMoney(x.e.money)}</span> : '—'), num: true },
          { key: 'r', label: t('chainRow'), value: (x) => x.e.rows.length },
          { key: 'b', label: '', render: (x) => <button className="btn sm evidence-btn" onClick={() => setNav({ evidence: { findingId: f.id, index: x.i } })}>{t('showEvidence')}</button> },
        ]} />
      </Card>
      <div className="grid g2">
        <Card title={<><Tag kind="rec" /> {t('recommendation')} <span className="mono small">{rec?.id}</span></>}>
          <p>{tl(rec?.action)}</p>
          <dl className="kv small"><dt>{tl({ en: 'Root cause', ar: 'السبب الجذري' })}</dt><dd>{tl(rec?.rootCause)}</dd><dt>{tl({ en: 'Expected benefit', ar: 'العائد المتوقع' })}</dt><dd>{tl(rec?.benefit)}</dd><dt>{tl({ en: 'Control improvement', ar: 'تحسين الرقابة' })}</dt><dd>{tl(rec?.controlImprovement)}</dd><dt>{tl({ en: 'Priority', ar: 'الأولوية' })}</dt><dd>{statusLabel(rec?.priority ?? '', lang)} · {tl({ en: 'target', ar: 'المستهدف' })} {rec?.targetDate}</dd><dt>{tl({ en: 'Effort (estimate)', ar: 'الجهد (تقدير)' })}</dt><dd>{statusLabel(rec?.effort ?? '', lang)} <Tag kind="asm" /></dd></dl>
        </Card>
        <Card title={<span id="assign-box">{t('managementAction')}</span>}>
          {act && <p className="small">{act.id} · {act.owner} · {act.dueDate} · <b>{statusLabel(act.status, lang)}</b> · {act.completion}%</p>}
          {CAN.assign(prefs.role) ? (
            <div className="filters">
              <Field label={t('owner')}><input value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
              <Field label={t('department')}><input value={dept} onChange={(e) => setDept(e.target.value)} /></Field>
              <Field label={t('dueDate')}><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
              <button className="btn accent" onClick={assign}>{t('assignAction')}</button>
            </div>
          ) : <p className="muted small">{t('readOnly')}</p>}
          <Field label={t('auditorNotes')}><textarea value={notes} disabled={!CAN.review(prefs.role)} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (overrides[id]?.notes ?? '') && setOverride(id, { notes }, 'notes updated')} /></Field>
        </Card>
      </div>
    </Modal>
  );
}
