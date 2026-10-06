import { useState } from 'react';
import { useApp, CAN } from '../state';
import type { ActionItem } from '../engine/types';
import { TEST_BY_ID } from '../engine/tests';
import { makeSnapshot, type Recommendation } from '../engine/analysis';
import { Card, DataTable, Empty, Kpi, Sev, Field, Tag } from '../ui/kit';
import { statusLabel } from '../i18n/dict';

const PRI_LABEL = { immediate: ['Immediate (0–30 days)', 'فوري (0–30 يومًا)'], short: ['Short-term (31–90 days)', 'قصير الأجل (31–90 يومًا)'], medium: ['Medium-term (91–180 days)', 'متوسط الأجل (91–180 يومًا)'], long: ['Long-term (180+ days)', 'طويل الأجل (+180 يومًا)'] } as const;

function AssignBox({ r, onDone }: { r: Recommendation; onDone: () => void }) {
  const { t, upsertAction, actions, setOverride, prefs } = useApp();
  const ex = actions.find((a) => a.findingId === r.findingId);
  const [owner, setOwner] = useState(ex?.owner ?? r.owner);
  const [due, setDue] = useState(ex?.dueDate ?? r.targetDate);
  const [dept, setDept] = useState(ex?.department ?? '');
  if (!CAN.assign(prefs.role)) return <span className="muted small">{t('readOnly')}</span>;
  return (
    <div className="filters" style={{ marginTop: 6 }}>
      <Field label={t('assignOwner')}><input value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
      <Field label={t('department')}><input value={dept} onChange={(e) => setDept(e.target.value)} /></Field>
      <Field label={t('setDeadline')}><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      <button className="btn accent" disabled={!owner || !due} onClick={() => {
        const a: ActionItem = ex ? { ...ex, owner, dueDate: due, department: dept } : { id: `MA-${r.findingId.slice(2)}`, findingId: r.findingId, recommendationId: r.id, owner, department: dept, dueDate: due, priority: r.priority, status: 'open', completion: 0, evidence: '', validation: '', closureDate: '', createdAt: new Date().toISOString() };
        upsertAction(a, `assign ${owner} / ${due}`); setOverride(r.findingId, { owner, dueDate: due }, `owner=${owner}; due=${due}`); onDone();
      }}>{t('track')}</button>
    </div>
  );
}

export function Recommendations() {
  const { t, tl, analysis, setNav, go, lang } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  if (!analysis.recommendations.length) return <Empty title={t('noFindings')} />;
  const groups = (['immediate', 'short', 'medium', 'long'] as const).map((p) => ({ p, list: analysis.recommendations.filter((r) => r.priority === p) }));
  return (
    <>
      <div className="kpis">{groups.map((g) => <Kpi key={g.p} label={PRI_LABEL[g.p][lang === 'ar' ? 1 : 0]} value={g.list.length} />)}</div>
      <Card title={t('topRecs')} hint={tl({ en: 'Ranked by: risk (35%), financial impact (25%), control weakness / exception rate (20%), urgency incl. fraud indicators (10%), implementation effort (10%).', ar: 'الترتيب حسب: المخاطر 35%، الأثر المالي 25%، ضعف الرقابة 20%، الإلحاح 10%، جهد التنفيذ 10%.' })}>
        <div className="stack">
          {analysis.recommendations.slice(0, 10).map((r, i) => (
            <div key={r.id} className="card" style={{ padding: 12 }}>
              <div className="row"><b>{i + 1}.</b><Sev s={r.rating} /><span className="mono small">{r.id}</span><span className="badge">{PRI_LABEL[r.priority][lang === 'ar' ? 1 : 0]}</span><span className="badge">{tl({ en: 'Score', ar: 'الدرجة' })} {r.score}</span><span className="spacer" />
                <button className="btn sm" onClick={() => setNav({ findingId: r.findingId })}>{r.findingId}</button>
                <button className="btn sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{t('assignOwner')} / {t('setDeadline')}</button>
                <button className="btn sm" onClick={() => go('actions')}>{t('track')}</button>
              </div>
              <p style={{ margin: '6px 0' }}><Tag kind="rec" /> {tl(r.action)}</p>
              <div className="small muted">{tl({ en: 'Risk addressed', ar: 'المخاطر المعالجة' })}: {r.riskId} · {tl({ en: 'Root cause', ar: 'السبب الجذري' })}: {tl(r.rootCause)} · {tl({ en: 'Benefit', ar: 'العائد' })}: {tl(r.benefit)} · {tl({ en: 'Effort', ar: 'الجهد' })}: {statusLabel(r.effort, lang)} · {t('owner')}: {r.owner || t('unassigned')} · {tl({ en: 'Target', ar: 'المستهدف' })}: {r.targetDate} · {t('status')}: {statusLabel(r.status, lang)}</div>
              {open === r.id && <AssignBox r={r} onDone={() => setOpen(null)} />}
            </div>
          ))}
        </div>
      </Card>
      <Card title={`${t('recommendations')} (${analysis.recommendations.length})`}>
        <DataTable rows={analysis.recommendations} csvName="recommendations" onRow={(r) => setNav({ findingId: r.findingId })} cols={[
          { key: 'id', label: 'ID', render: (r) => <span className="mono">{r.id}</span> },
          { key: 'findingId', label: t('findingId') },
          { key: 'riskId', label: tl({ en: 'Risk', ar: 'المخاطر' }) },
          { key: 'action', label: t('recommendation'), value: (r) => tl(r.action) },
          { key: 'ci', label: tl({ en: 'Control improvement', ar: 'تحسين الرقابة' }), value: (r) => tl(r.controlImprovement) },
          { key: 'priority', label: tl({ en: 'Priority', ar: 'الأولوية' }), render: (r) => statusLabel(r.priority, lang) },
          { key: 'effort', label: tl({ en: 'Effort', ar: 'الجهد' }), render: (r) => statusLabel(r.effort, lang) },
          { key: 'owner', label: t('owner') },
          { key: 'targetDate', label: tl({ en: 'Target date', ar: 'التاريخ المستهدف' }) },
          { key: 'score', label: tl({ en: 'Score', ar: 'الدرجة' }), num: true },
          { key: 'status', label: t('status'), render: (r) => statusLabel(r.status, lang) },
        ]} />
      </Card>
    </>
  );
}

export function Actions() {
  const { t, tl, actions, upsertAction, analysis, prefs, setNav, lang } = useApp();
  const today = analysis.today;
  const mine = prefs.role === 'management' ? actions.filter((a) => a.owner.trim().toLowerCase() === prefs.user.trim().toLowerCase()) : actions;
  const isOver = (a: ActionItem) => a.status !== 'closed' && !!a.dueDate && a.dueDate < today;
  const disp = (a: ActionItem) => (isOver(a) ? 'overdue' : a.status);
  const canUpd = CAN.updateAction(prefs.role);
  const canVal = CAN.validate(prefs.role);
  const upd = (a: ActionItem, patch: Partial<ActionItem>, why: string) => upsertAction({ ...a, ...patch }, why);
  const counts = (s: string) => mine.filter((a) => disp(a) === s).length;
  return (
    <>
      <div className="kpis">
        {['open', 'in-progress', 'overdue', 'implemented', 'pending-validation', 'closed'].map((s) => <Kpi key={s} accent={s === 'overdue'} label={statusLabel(s, lang)} value={counts(s)} />)}
      </div>
      {prefs.role === 'management' && <div className="banner info small">{tl({ en: `Showing actions assigned to "${prefs.user}".`, ar: `عرض الإجراءات المسندة إلى "${prefs.user}".` })}</div>}
      <Card title={t('actions')} hint={tl({ en: 'Overdue status is flagged automatically when the due date passes. Closure requires Internal Audit validation (Senior Auditor / CAE).', ar: 'تُرصد حالة التأخر آليًا عند تجاوز الموعد. يتطلب الإغلاق تحقق المراجعة الداخلية.' })}>
        {!mine.length ? <Empty title={tl({ en: 'No management actions assigned yet', ar: 'لا توجد إجراءات مسندة بعد' })}>{tl({ en: 'Assign actions from a finding or recommendation.', ar: 'أسند الإجراءات من الملاحظة أو التوصية.' })}</Empty> : (
          <DataTable rows={mine} csvName="management-actions" cols={[
            { key: 'id', label: 'ID', render: (a) => <span className="mono">{a.id}</span> },
            { key: 'findingId', label: t('findingId'), render: (a) => <button className="btn sm ghost" onClick={() => setNav({ findingId: a.findingId })}>{a.findingId}</button> },
            { key: 'rec', label: t('recommendation'), value: (a) => tl(TEST_BY_ID[a.findingId.slice(2)]?.recommendation), render: (a) => <span className="small">{tl(TEST_BY_ID[a.findingId.slice(2)]?.recommendation)}</span> },
            { key: 'owner', label: t('owner') }, { key: 'department', label: t('department') },
            { key: 'dueDate', label: t('dueDate'), render: (a) => <span className={isOver(a) ? 'insufficient' : ''}>{a.dueDate}</span> },
            { key: 'priority', label: tl({ en: 'Priority', ar: 'الأولوية' }), render: (a) => statusLabel(a.priority, lang) },
            { key: 'status', label: t('status'), value: disp, render: (a) => (
              <select className="inp" disabled={!canUpd} value={a.status} onChange={(e) => {
                const s = e.target.value as ActionItem['status'];
                if (s === 'closed' && !canVal) { alert(tl({ en: 'Closure requires Internal Audit validation.', ar: 'الإغلاق يتطلب تحقق المراجعة الداخلية.' })); return; }
                upd(a, { status: s, closureDate: s === 'closed' ? today : a.closureDate, completion: s === 'implemented' || s === 'pending-validation' || s === 'closed' ? 100 : a.completion }, `status → ${s}`);
              }}>{['open', 'in-progress', 'implemented', 'pending-validation', 'closed'].map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}</select>) },
            { key: 'completion', label: '%', num: true, render: (a) => <input className="inp" type="number" min={0} max={100} style={{ width: 64 }} disabled={!canUpd} defaultValue={a.completion} onBlur={(e) => +e.target.value !== a.completion && upd(a, { completion: Math.max(0, Math.min(100, +e.target.value)) }, `completion ${e.target.value}%`)} /> },
            { key: 'evidence', label: t('evidence'), render: (a) => <input className="inp" disabled={!canUpd} defaultValue={a.evidence} placeholder="…" onBlur={(e) => e.target.value !== a.evidence && upd(a, { evidence: e.target.value }, 'evidence updated')} /> },
            { key: 'validation', label: tl({ en: 'IA validation', ar: 'تحقق المراجعة' }), render: (a) => canVal ? <input className="inp" defaultValue={a.validation} placeholder="…" onBlur={(e) => e.target.value !== a.validation && upd(a, { validation: e.target.value }, 'validation note')} /> : a.validation },
            { key: 'closureDate', label: tl({ en: 'Closed', ar: 'تاريخ الإغلاق' }) },
          ]} />
        )}
      </Card>
    </>
  );
}

export function ChangeMonitor() {
  const { t, tl, analysis, snapshots, addSnapshot, prefs, setNav } = useApp();
  const [label, setLabel] = useState('');
  const c = analysis.change;
  return (
    <>
      <Card title={tl({ en: 'Cycle snapshots (continuous auditing baseline)', ar: 'لقطات الدورة (أساس المراجعة المستمرة)' })} hint={tl({ en: 'Save a snapshot at the end of each audit cycle. When new data is uploaded, results are compared with the latest snapshot.', ar: 'احفظ لقطة في نهاية كل دورة. عند رفع بيانات جديدة تتم المقارنة مع آخر لقطة.' })}>
        {CAN.review(prefs.role) && <div className="row"><input className="inp" placeholder={tl({ en: 'Snapshot label (e.g. FY2025 Q4)', ar: 'وصف اللقطة' })} value={label} onChange={(e) => setLabel(e.target.value)} /><button className="btn primary" disabled={!analysis.hasData || !label} onClick={() => { addSnapshot(makeSnapshot(analysis, label, prefs.user)); setLabel(''); }}>{t('save')}</button></div>}
        <ul className="small">{snapshots.map((s) => <li key={s.id}><b>{s.label}</b> — {s.createdAt.slice(0, 16).replace('T', ' ')} · {s.createdBy} · {s.findingIds.length} {t('findings')}</li>)}</ul>
      </Card>
      {!c.baseline ? <Card title={t('change')}><span className="insufficient">{t('insufficient')}</span> — {tl({ en: 'no baseline snapshot yet.', ar: 'لا توجد لقطة أساس بعد.' })}</Card> : (
        <>
          <div className="kpis">
            <Kpi accent label={tl({ en: 'New exceptions', ar: 'استثناءات جديدة' })} value={c.newExceptions.reduce((s, x) => s + x.keys.length, 0)} />
            <Kpi label={tl({ en: 'Repeat exceptions', ar: 'استثناءات متكررة' })} value={c.repeatExceptions.reduce((s, x) => s + x.keys.length, 0)} />
            <Kpi label={tl({ en: 'Resolved exceptions', ar: 'استثناءات تمت معالجتها' })} value={c.resolvedExceptions.reduce((s, x) => s + x.keys.length, 0)} />
            {['vendors', 'employees', 'bankAccounts', 'accounts', 'users', 'customers'].map((k) => <Kpi key={k} label={`${tl({ en: 'New', ar: 'جديد' })} ${k}`} value={c.newEntities[k]?.length ?? 0} />)}
          </div>
          <Card title={t('change')} hint={`${tl({ en: 'Baseline', ar: 'الأساس' })}: ${c.baseline.label} (${c.baseline.createdAt.slice(0, 10)})`}>
            <DataTable rows={[...c.newExceptions.map((x) => ({ ...x, kind: 'new' })), ...c.repeatExceptions.map((x) => ({ ...x, kind: 'repeat' })), ...c.resolvedExceptions.map((x) => ({ ...x, kind: 'resolved' }))]} csvName="change-monitor" onRow={(x) => analysis.findingById[`F-${x.testId}`] && setNav({ findingId: `F-${x.testId}` })} cols={[
              { key: 'kind', label: tl({ en: 'Change', ar: 'التغير' }), render: (x) => <span className={`badge ${x.kind === 'new' ? 'fail' : x.kind === 'repeat' ? 'warn' : 'pass'}`}>{x.kind}</span> },
              { key: 'testId', label: 'Test' },
              { key: 'n', label: tl({ en: 'Test name', ar: 'الاختبار' }), value: (x) => tl(TEST_BY_ID[x.testId]?.name) },
              { key: 'c', label: t('exceptions'), num: true, value: (x) => x.keys.length },
            ]} />
            {Object.keys(c.newEntities).length > 0 && <details style={{ marginTop: 10 }}><summary>{tl({ en: 'New entities', ar: 'كيانات جديدة' })}</summary>{Object.entries(c.newEntities).map(([k, v]) => <p key={k} className="small"><b>{k}</b>: {(k === 'bankAccounts' ? v.map((x) => '••••' + x.slice(-4)) : v).slice(0, 50).join(', ')}{v.length > 50 ? ' …' : ''}</p>)}</details>}
          </Card>
        </>
      )}
    </>
  );
}
