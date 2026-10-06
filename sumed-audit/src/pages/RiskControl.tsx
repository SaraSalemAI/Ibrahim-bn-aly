import { useState } from 'react';
import { useApp, CAN } from '../state';
import { RISK_BY_ID, CONTROL_BY_ID } from '../engine/library';
import { UNIVERSE_FACTORS } from '../engine/defaults';
import { TEST_BY_ID } from '../engine/tests';
import type { Severity } from '../engine/types';
import { Card, DataTable, Empty, Money, Sev, Field, Tag } from '../ui/kit';
import { statusLabel } from '../i18n/dict';

const cellColor = (score: number): string => (score >= 20 ? 'var(--sev-critical)' : score >= 12 ? 'var(--sev-high)' : score >= 6 ? 'var(--sev-medium)' : 'var(--sev-low)');

export function Heatmap() {
  const { t, tl, analysis, setNav, go, lang } = useApp();
  const placed = analysis.risks.filter((r) => r.likelihood && r.impact);
  const notAssessed = analysis.risks.length - placed.length;
  return (
    <div>
      <div className="heat" role="grid" aria-label={t('heatmap')}>
        {[5, 4, 3, 2, 1].map((imp) => (
          <div key={imp} style={{ display: 'contents' }}>
            <div className="ax">{imp}</div>
            {[1, 2, 3, 4, 5].map((lik) => {
              const here = placed.filter((r) => r.impact === imp && r.likelihood === lik);
              return (
                <div key={lik} className="cell" style={{ background: cellColor(imp * lik), opacity: here.length ? 1 : 0.35 }} title={`${t('impact')} ${imp} × ${t('likelihood')} ${lik} = ${imp * lik}`}>
                  {here.map((r) => <button key={r.def.id} className="pill" title={tl(r.def.title)} onClick={() => { setNav({ riskId: r.def.id }); go('risks'); }}>{r.def.id.replace('R-', '')}</button>)}
                </div>
              );
            })}
          </div>
        ))}
        <div />
        {[1, 2, 3, 4, 5].map((l) => <div key={l} className="ax">{l}</div>)}
      </div>
      <div className="row small muted" style={{ marginTop: 6, justifyContent: 'space-between' }}>
        <span>↑ {t('impact')} · → {t('likelihood')}</span>
        <span className="row">{(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => <span key={s} className={`badge ${s}`}><span className="dot" />{t(s)}</span>)}</span>
      </div>
      {notAssessed > 0 && <p className="small"><span className="insufficient">{notAssessed} {lang === 'ar' ? 'مخاطر لم تُقيّم (بيانات غير كافية)' : 'risk(s) not assessed — insufficient data'}</span></p>}
    </div>
  );
}

export function Risks() {
  const { t, tl, analysis, nav, setNav, go, prefs, setRiskMeta, lang } = useApp();
  const sel = analysis.risks.find((r) => r.def.id === nav.riskId);
  const canEdit = CAN.editParameters(prefs.role) || prefs.role === 'risk';
  return (
    <>
      <div className="grid g2">
        <Card title={t('heatmap')} hint={tl({ en: 'Residual (observed) risk: likelihood from exception rate; impact from exposure vs. materiality (or finding severity when materiality is not configured).', ar: 'المخاطر المتبقية (الملاحظة): الاحتمالية من معدل الاستثناءات؛ الأثر من التعرض مقابل الأهمية النسبية.' })}><Heatmap /></Card>
        {sel ? (
          <Card title={<><span className="mono">{sel.def.id}</span> {tl(sel.def.title)}</>} actions={<button className="btn sm" onClick={() => setNav({ riskId: null })}>✕</button>}>
            <dl className="kv small">
              <dt>{tl({ en: 'Category', ar: 'الفئة' })}</dt><dd>{sel.def.category}</dd>
              <dt>{tl({ en: 'Description', ar: 'الوصف' })}</dt><dd>{tl(sel.def.description)}</dd>
              <dt>{t('cause')}</dt><dd>{tl(sel.def.cause)}</dd>
              <dt>{t('impact')}</dt><dd>{tl(sel.def.impact)}</dd>
              <dt><Tag kind="risk" /></dt><dd>{t('likelihood')} {sel.likelihood ?? '—'} × {t('impact')} {sel.impact ?? '—'} = {sel.residualScore ?? '—'} <Sev s={sel.residual} /></dd>
              <dt>{tl({ en: 'Inherent risk', ar: 'المخاطر الكامنة' })}</dt><dd>{sel.inherentScore ?? <span className="muted">{tl({ en: 'CAE inherent-likelihood judgement not set (Settings)', ar: 'لم يحدد رئيس المراجعة الاحتمالية الكامنة' })}</span>} {sel.inherentScore !== null && <Sev s={sel.inherent} />}</dd>
              <dt>{tl({ en: 'Basis', ar: 'الأساس' })}</dt><dd>{tl(sel.basis)}</dd>
              <dt>{t('exposure')}</dt><dd><Money m={sel.exposure} /></dd>
              <dt>{tl({ en: 'Recommended action', ar: 'الإجراء الموصى به' })}</dt><dd>{tl(sel.recommendedAction ?? undefined) || '—'}</dd>
            </dl>
            <div className="filters" style={{ marginTop: 8 }}>
              <Field label={tl({ en: 'Risk owner', ar: 'مسؤول المخاطر' })}><input disabled={!canEdit} defaultValue={sel.owner} onBlur={(e) => e.target.value !== sel.owner && setRiskMeta(sel.def.id, { owner: e.target.value })} /></Field>
              <Field label={tl({ en: 'Control owner', ar: 'مسؤول الرقابة' })}><input disabled={!canEdit} defaultValue={sel.controlOwner} onBlur={(e) => e.target.value !== sel.controlOwner && setRiskMeta(sel.def.id, { controlOwner: e.target.value })} /></Field>
              <Field label={t('dueDate')}><input type="date" disabled={!canEdit} defaultValue={sel.dueDate} onBlur={(e) => e.target.value !== sel.dueDate && setRiskMeta(sel.def.id, { dueDate: e.target.value })} /></Field>
              <Field label={t('status')}><select disabled={!canEdit} value={sel.status} onChange={(e) => setRiskMeta(sel.def.id, { status: e.target.value })}>{['open', 'monitored', 'mitigating', 'accepted', 'closed', 'not-assessed'].map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}</select></Field>
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => { setNav({ controlId: sel.controls[0] ?? null }); go('controls'); }}>{t('viewControls')} ({sel.controls.length})</button>
              <button className="btn" disabled={!sel.findings.length} onClick={() => setNav({ findingId: sel.findings[0] })}>{t('viewFindings')} ({sel.findings.length})</button>
              <button className="btn evidence-btn" disabled={!sel.findings.length} onClick={() => setNav({ evidence: { findingId: sel.findings[0], index: 0 } })}>{t('viewEvidence')}</button>
            </div>
            {sel.findings.length > 0 && <ul className="small">{sel.findings.map((id) => <li key={id}><button className="btn sm ghost" onClick={() => setNav({ findingId: id })}>{id}</button> {tl(analysis.findingById[id].title)}</li>)}</ul>}
          </Card>
        ) : <Card title={tl({ en: 'Select a risk', ar: 'اختر خطرًا' })}><p className="muted">{tl({ en: 'Click a risk on the heatmap or in the register to drill down: Risk → Control → Finding → Transaction → Evidence.', ar: 'انقر على خطر في الخريطة أو السجل للتعمق: المخاطر ← الرقابة ← الملاحظة ← المعاملة ← الدليل.' })}</p></Card>}
      </div>
      <Card title={tl({ en: 'Enterprise Risk Register', ar: 'سجل المخاطر المؤسسية' })}>
        <DataTable rows={analysis.risks} csvName="risk-register" onRow={(r) => setNav({ riskId: r.def.id })} cols={[
          { key: 'id', label: 'Risk ID', value: (r) => r.def.id, render: (r) => <span className="mono">{r.def.id}</span> },
          { key: 'cat', label: tl({ en: 'Category', ar: 'الفئة' }), value: (r) => r.def.category },
          { key: 'title', label: tl({ en: 'Risk', ar: 'المخاطر' }), value: (r) => tl(r.def.title) },
          { key: 'l', label: t('likelihood'), value: (r) => r.likelihood, num: true },
          { key: 'i', label: t('impact'), value: (r) => r.impact, num: true },
          { key: 'inh', label: tl({ en: 'Inherent', ar: 'الكامنة' }), value: (r) => r.inherentScore, render: (r) => <Sev s={r.inherent} /> },
          { key: 'res', label: tl({ en: 'Residual', ar: 'المتبقية' }), value: (r) => r.residualScore, render: (r) => <Sev s={r.residual} /> },
          { key: 'exp', label: t('exposure'), value: (r) => Object.values(r.exposure).reduce((a, b) => a + b, 0), render: (r) => <Money m={r.exposure} />, num: true },
          { key: 'ctl', label: tl({ en: 'Existing controls', ar: 'الضوابط القائمة' }), value: (r) => r.controls.join(', ') },
          { key: 'f', label: t('findings'), value: (r) => r.findings.length, num: true },
          { key: 'owner', label: t('owner'), value: (r) => r.owner },
          { key: 'due', label: t('dueDate'), value: (r) => r.dueDate },
          { key: 'status', label: t('status'), value: (r) => r.status, render: (r) => statusLabel(r.status, lang) },
        ]} />
      </Card>
    </>
  );
}

export function Controls() {
  const { t, tl, analysis, nav, setNav, prefs, setControlMeta, settings, setSettings } = useApp();
  const sel = analysis.controls.find((c) => c.def.id === nav.controlId);
  const ratingL = (r: string) => ({ effective: tl({ en: 'EFFECTIVE', ar: 'فعال' }), 'needs-improvement': tl({ en: 'NEEDS IMPROVEMENT', ar: 'يحتاج إلى تحسين' }), ineffective: tl({ en: 'INEFFECTIVE', ar: 'غير فعال' }), 'not-tested': tl({ en: 'NOT TESTED', ar: 'لم يُختبر' }) }[r] ?? r);
  const rc = (r: string) => (r === 'effective' ? 'pass' : r === 'ineffective' ? 'fail' : r === 'needs-improvement' ? 'warn' : '');
  return (
    <>
      {sel && (
        <Card title={<><span className="mono">{sel.def.id}</span> {tl(sel.def.objective)}</>} actions={<button className="btn sm" onClick={() => setNav({ controlId: null })}>✕</button>}>
          <div className="grid g2">
            <dl className="kv small">
              <dt>{tl({ en: 'Category', ar: 'الفئة' })}</dt><dd>{sel.def.category}</dd>
              <dt>{tl({ en: 'Process', ar: 'العملية' })}</dt><dd>{tl(sel.def.process)}</dd>
              <dt>{tl({ en: 'Risk', ar: 'المخاطر' })}</dt><dd>{sel.def.riskId} {tl(RISK_BY_ID[sel.def.riskId]?.title)}</dd>
              <dt>{tl({ en: 'Description', ar: 'الوصف' })}</dt><dd>{tl(sel.def.description)}</dd>
              <dt>{tl({ en: 'Frequency', ar: 'التكرار' })}</dt><dd>{tl(sel.def.frequency)}</dd>
              <dt>{tl({ en: 'Evidence required', ar: 'الأدلة المطلوبة' })}</dt><dd>{tl(sel.def.evidence)}</dd>
              <dt>{tl({ en: 'Testing procedure', ar: 'إجراء الاختبار' })}</dt><dd>{tl(sel.def.procedure)}</dd>
              <dt>{tl({ en: 'Tests', ar: 'الاختبارات' })}</dt><dd>{sel.tests.map((x) => `${x} (${analysis.resultById[x].status === 'performed' ? analysis.resultById[x].exceptions.length + ' exc.' : 'n/p'})`).join(', ') || '—'}</dd>
            </dl>
            <div>
              <div className="row"><b>{t('controlEffectiveness')}:</b> <span className={`badge ${rc(sel.rating)}`}>{ratingL(sel.rating)}</span> {sel.score !== null && <b>{sel.score}/100</b>}</div>
              <table className="small" style={{ marginTop: 8 }}><thead><tr><th>{tl({ en: 'Component', ar: 'المكون' })}</th><th className="num">{tl({ en: 'Value', ar: 'القيمة' })}</th><th className="num">{tl({ en: 'Weight', ar: 'الوزن' })}</th></tr></thead>
                <tbody>{sel.components.map((c) => <tr key={c.label}><td>{c.label}</td><td className="num">{c.value === null ? <span className="muted">n/a</span> : c.value.toFixed(2)}</td><td className="num">{c.weight}</td></tr>)}</tbody></table>
              <p className="small muted">Score = Σ(value × weight) ÷ Σ(weights of available components) × 100. EFFECTIVE ≥ 80, NEEDS IMPROVEMENT ≥ 55.</p>
              <div className="filters">
                <Field label={tl({ en: 'Design effectiveness (CAE)', ar: 'فعالية التصميم (رئيس المراجعة)' })}>
                  <select disabled={!CAN.editMethodology(prefs.role)} value={settings.controlDesign[sel.def.id] ?? ''} onChange={(e) => { const cd = { ...settings.controlDesign }; if (e.target.value === '') delete cd[sel.def.id]; else cd[sel.def.id] = +e.target.value; setSettings({ ...settings, controlDesign: cd }, `control design ${sel.def.id} = ${e.target.value || 'not assessed'}`); }}>
                    <option value="">{t('na')}</option><option value="1">{tl({ en: 'Effective design', ar: 'تصميم فعال' })}</option><option value="0.5">{tl({ en: 'Partially effective', ar: 'فعال جزئيًا' })}</option><option value="0">{tl({ en: 'Ineffective design', ar: 'تصميم غير فعال' })}</option>
                  </select>
                </Field>
                <Field label={t('owner')}><input disabled={!CAN.editParameters(prefs.role)} defaultValue={sel.owner} onBlur={(e) => e.target.value !== sel.owner && setControlMeta(sel.def.id, { owner: e.target.value })} /></Field>
              </div>
            </div>
          </div>
          {sel.findings.length > 0 && <><h3>{t('findings')}</h3><ul className="small">{sel.findings.map((id) => <li key={id}><button className="btn sm ghost" onClick={() => setNav({ findingId: id })}>{id}</button> {tl(analysis.findingById[id].title)} <button className="btn sm evidence-btn" onClick={() => setNav({ evidence: { findingId: id, index: 0 } })}>{t('showEvidence')}</button></li>)}</ul></>}
        </Card>
      )}
      <Card title={t('controls')} hint={tl({ en: 'Framework control library (COSO-aligned categories). Owners are assigned by the CAE; nothing is pre-filled.', ar: 'مكتبة ضوابط إطارية (متوافقة مع COSO). يحدد رئيس المراجعة المسؤولين؛ لا يوجد أي تعبئة مسبقة.' })}>
        <DataTable rows={analysis.controls} csvName="control-register" onRow={(c) => setNav({ controlId: c.def.id })} cols={[
          { key: 'id', label: 'Control ID', value: (c) => c.def.id, render: (c) => <span className="mono">{c.def.id}</span> },
          { key: 'cat', label: tl({ en: 'Category', ar: 'الفئة' }), value: (c) => c.def.category },
          { key: 'proc', label: tl({ en: 'Process', ar: 'العملية' }), value: (c) => tl(c.def.process) },
          { key: 'obj', label: tl({ en: 'Control objective', ar: 'هدف الرقابة' }), value: (c) => tl(c.def.objective) },
          { key: 'risk', label: tl({ en: 'Risk', ar: 'المخاطر' }), value: (c) => c.def.riskId },
          { key: 'freq', label: tl({ en: 'Frequency', ar: 'التكرار' }), value: (c) => tl(c.def.frequency) },
          { key: 'tests', label: tl({ en: 'Tests performed', ar: 'الاختبارات المنفذة' }), value: (c) => `${c.performed}/${c.tests.length}` },
          { key: 'exc', label: t('exceptions'), value: (c) => c.exceptions, num: true },
          { key: 'score', label: tl({ en: 'Score', ar: 'الدرجة' }), value: (c) => c.score, num: true },
          { key: 'rating', label: t('rating'), value: (c) => c.rating, render: (c) => <span className={`badge ${rc(c.rating)}`}>{ratingL(c.rating)}</span> },
          { key: 'rep', label: tl({ en: 'Repeat', ar: 'متكرر' }), value: (c) => (c.repeat ? 'Yes' : '') },
          { key: 'owner', label: t('owner'), value: (c) => c.owner },
        ]} />
      </Card>
    </>
  );
}

export function Universe() {
  const { t, tl, analysis, settings, setSettings, prefs, lang } = useApp();
  const canEdit = CAN.editMethodology(prefs.role);
  const [w, setW] = useState(settings.riskWeights);
  if (!analysis.hasData) return <Empty title={t('uploadToStart')} />;
  const rateLbl = (r: string) => (r === 'na' ? t('na') : t(r as 'high'));
  return (
    <>
      <Card title={tl({ en: 'Audit Universe — risk-based', ar: 'نطاق المراجعة — على أساس المخاطر' })} hint={tl({ en: 'Score (0–100) = Σ(factor 0–5 × weight) ÷ Σ weights × 20. Data-derived factors are computed from uploads; judgement factors are rated by the CAE (blank = excluded, never assumed). HIGH ≥ 60, MEDIUM ≥ 35.', ar: 'الدرجة = مجموع (العامل × الوزن) ÷ مجموع الأوزان × 20. العوامل المستمدة من البيانات تُحتسب آليًا وعوامل التقدير يحددها رئيس المراجعة (الفارغ يُستبعد ولا يُفترض).' })}>
        <DataTable rows={analysis.universe} csvName="audit-universe" cols={[
          { key: 'area', label: t('area'), value: (u) => tl(u.label) },
          { key: 'score', label: tl({ en: 'Risk score', ar: 'درجة المخاطر' }), value: (u) => u.score, num: true },
          { key: 'rating', label: t('rating'), value: (u) => u.rating, render: (u) => <span className={`badge ${u.rating === 'high' ? 'critical' : u.rating === 'medium' ? 'medium' : u.rating === 'low' ? 'low' : 'na'}`}><span className="dot" />{rateLbl(u.rating)}</span> },
          ...UNIVERSE_FACTORS.map((fd) => ({ key: fd.id, label: lang === 'ar' ? fd.ar : fd.en, num: true, value: (u: typeof analysis.universe[number]) => (u.factors[fd.id] === null || u.factors[fd.id] === undefined ? null : Math.round(u.factors[fd.id]! * 10) / 10) })),
          { key: 'f', label: t('findings'), value: (u) => u.findings, num: true },
          { key: 'ins', label: tl({ en: 'Tests not performed', ar: 'اختبارات غير منفذة' }), value: (u) => u.insufficient, num: true },
        ]} />
      </Card>
      <Card title={tl({ en: 'Risk methodology weights', ar: 'أوزان منهجية المخاطر' })} hint={canEdit ? tl({ en: 'Changes are versioned in the audit trail. The methodology is never changed silently.', ar: 'التعديلات تُسجل في مسار المراجعة. لا تتغير المنهجية دون علم.' }) : t('readOnly')}>
        <div className="filters">
          {UNIVERSE_FACTORS.map((fd) => <Field key={fd.id} label={<>{lang === 'ar' ? fd.ar : fd.en} {fd.derived ? <Tag kind="calc">data</Tag> : <Tag kind="asm">CAE</Tag>}</>}><input type="number" min={0} max={5} step={0.5} disabled={!canEdit} value={w[fd.id] ?? 0} onChange={(e) => setW({ ...w, [fd.id]: +e.target.value })} /></Field>)}
        </div>
        {canEdit && <div className="row" style={{ marginTop: 8 }}><button className="btn primary" onClick={() => setSettings({ ...settings, riskWeights: w }, `risk weights: ${JSON.stringify(w)}`)}>{t('save')}</button></div>}
      </Card>
      {canEdit && (
        <Card title={tl({ en: 'CAE judgement ratings (1–5)', ar: 'تقديرات رئيس المراجعة (1–5)' })}>
          <div className="table-wrap"><table><thead><tr><th>{t('area')}</th>{UNIVERSE_FACTORS.filter((f) => !f.derived).map((f) => <th key={f.id}>{lang === 'ar' ? f.ar : f.en}</th>)}</tr></thead>
            <tbody>{analysis.universe.map((u) => <tr key={u.area}><td>{tl(u.label)}</td>{UNIVERSE_FACTORS.filter((f) => !f.derived).map((fd) => <td key={fd.id}><select className="inp" value={settings.judgementRatings[u.area]?.[fd.id] ?? ''} onChange={(e) => { const jr = { ...settings.judgementRatings, [u.area]: { ...settings.judgementRatings[u.area] } }; if (e.target.value === '') delete jr[u.area][fd.id]; else jr[u.area][fd.id] = +e.target.value; setSettings({ ...settings, judgementRatings: jr }, `judgement ${u.area}.${fd.id} = ${e.target.value || 'blank'}`); }}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></td>)}</tr>)}</tbody></table></div>
        </Card>
      )}
      <AuditPlan />
    </>
  );
}

function AuditPlan() {
  const { t, tl, analysis, planMeta, setPlanMeta, prefs, lang } = useApp();
  const can = CAN.editParameters(prefs.role);
  const rows = analysis.universe.filter((u) => u.rows > 0 || u.insufficient > 0).map((u, i) => {
    const tests = Object.values(TEST_BY_ID).filter((x) => x.area === u.area);
    const perf = tests.filter((x) => analysis.resultById[x.id].status === 'performed');
    return { u, priority: i + 1, tests, perf, m: planMeta[u.area] ?? {} };
  });
  const auto = (r: typeof rows[number]) => (r.perf.length === r.tests.length ? 'Tested' : r.perf.length ? 'Partially tested' : 'Awaiting data');
  const hours = rows.reduce((s, r) => s + (r.m.hours ?? 0), 0);
  return (
    <Card title={tl({ en: 'Risk-based Internal Audit Plan', ar: 'خطة المراجعة الداخلية على أساس المخاطر' })} hint={tl({ en: 'Prioritized automatically by audit-universe score. Planned date, auditor, hours and status are entered by the CAE / Senior Auditor (never generated).', ar: 'مرتبة آليًا حسب درجة المخاطر. التاريخ المخطط والمراجع والساعات والحالة يدخلها رئيس المراجعة / المراجع الأول (لا تُولد آليًا).' })}>
      <p className="small muted">{tl({ en: 'Planned hours', ar: 'الساعات المخططة' })}: <b>{hours}</b></p>
      <DataTable rows={rows} csvName="audit-plan" cols={[
        { key: 'p', label: '#', value: (r) => r.priority, num: true },
        { key: 'a', label: t('area'), value: (r) => tl(r.u.label) },
        { key: 's', label: tl({ en: 'Risk score', ar: 'درجة المخاطر' }), value: (r) => r.u.score, num: true },
        { key: 'pd', label: tl({ en: 'Planned date', ar: 'التاريخ المخطط' }), value: (r) => r.m.planned ?? '', render: (r) => <input type="date" className="inp" disabled={!can} defaultValue={r.m.planned ?? ''} onBlur={(e) => e.target.value !== (r.m.planned ?? '') && setPlanMeta(r.u.area, { planned: e.target.value })} /> },
        { key: 'au', label: tl({ en: 'Auditor', ar: 'المراجع' }), value: (r) => r.m.auditor ?? '', render: (r) => <input className="inp" style={{ width: 130 }} disabled={!can} defaultValue={r.m.auditor ?? ''} onBlur={(e) => e.target.value !== (r.m.auditor ?? '') && setPlanMeta(r.u.area, { auditor: e.target.value })} /> },
        { key: 'h', label: tl({ en: 'Hours', ar: 'الساعات' }), value: (r) => r.m.hours ?? null, num: true, render: (r) => <input type="number" min={0} className="inp" style={{ width: 70 }} disabled={!can} defaultValue={r.m.hours ?? ''} onBlur={(e) => +e.target.value !== (r.m.hours ?? 0) && setPlanMeta(r.u.area, { hours: +e.target.value || 0 })} /> },
        { key: 'scope', label: tl({ en: 'Scope / procedures', ar: 'النطاق / الإجراءات' }), value: (r) => r.tests.map((x) => x.id).join(', '), render: (r) => <span className="small mono">{r.tests.map((x) => x.id).join(', ')}</span> },
        { key: 'obj', label: tl({ en: 'Objectives', ar: 'الأهداف' }), value: (r) => [...new Set(r.tests.map((x) => x.controlId))].map((c) => tl(CONTROL_BY_ID[c]?.objective)).slice(0, 2).join('; ') },
        { key: 'st', label: t('status'), value: (r) => r.m.status || auto(r), render: (r) => <select className="inp" disabled={!can} value={r.m.status ?? ''} onChange={(e) => setPlanMeta(r.u.area, { status: e.target.value })}><option value="">{statusLabel(auto(r), lang)} (auto)</option>{['Planned', 'Fieldwork', 'Reporting', 'Completed', 'Deferred'].map((x) => <option key={x} value={x}>{statusLabel(x, lang)}</option>)}</select> },
        { key: 'f', label: t('findings'), value: (r) => r.u.findings, num: true },
        { key: 'fu', label: tl({ en: 'Follow-up', ar: 'المتابعة' }), value: (r) => (r.u.findings ? 'Management actions' : '—') },
      ]} />
    </Card>
  );
}
