import { useState } from 'react';
import { useApp, CAN } from '../state';
import type { Settings, SiteDef } from '../engine/types';
import { RISKS } from '../engine/library';
import { GLOSSARY } from '../i18n/dict';
import { verifyLog } from '../store/db';
import { Card, DataTable, Field, Tag } from '../ui/kit';

export function Trail() {
  const { t, tl, log } = useApp();
  const [ok, setOk] = useState<string | null>(null);
  return (
    <Card title={`${t('trail')} (${log.length})`} hint={tl({ en: 'Append-only, SHA-256 hash-chained log of uploads, mapping changes, evidence access, status changes, approvals, settings and exports.', ar: 'سجل إلحاقي فقط ومتسلسل ببصمات SHA-256 للرفع وتعديلات الربط والوصول للأدلة وتغيير الحالات والاعتمادات والإعدادات والتصدير.' })}
      actions={<button className="btn" onClick={async () => { const b = await verifyLog(log); setOk(b === null ? tl({ en: 'Chain intact ✓', ar: 'السلسلة سليمة ✓' }) : `${tl({ en: 'Chain broken at entry', ar: 'انقطاع السلسلة عند' })} #${b}`); }}>{tl({ en: 'Verify integrity', ar: 'التحقق من السلامة' })}</button>}>
      {ok && <div className={`banner ${ok.includes('✓') ? 'ok' : 'fail'}`}>{ok}</div>}
      <DataTable rows={[...log].reverse()} csvName="audit-trail" cols={[
        { key: 'seq', label: '#', num: true }, { key: 'ts', label: tl({ en: 'Timestamp', ar: 'الوقت' }), render: (e) => <span className="mono small">{e.ts.replace('T', ' ').slice(0, 19)}</span> },
        { key: 'user', label: t('user') }, { key: 'role', label: t('role') }, { key: 'action', label: tl({ en: 'Action', ar: 'الإجراء' }), render: (e) => <span className="mono">{e.action}</span> },
        { key: 'target', label: tl({ en: 'Target', ar: 'الهدف' }) }, { key: 'detail', label: tl({ en: 'Detail', ar: 'التفاصيل' }), render: (e) => <span className="small">{e.detail}</span> },
        { key: 'hash', label: 'Hash', render: (e) => <span className="mono small">{e.hash.slice(0, 12)}</span> },
      ]} />
    </Card>
  );
}

const DAYS = [['Sun', 'الأحد'], ['Mon', 'الإثنين'], ['Tue', 'الثلاثاء'], ['Wed', 'الأربعاء'], ['Thu', 'الخميس'], ['Fri', 'الجمعة'], ['Sat', 'السبت']];
const numOrNull = (v: string) => (v.trim() === '' ? null : Number.isFinite(+v) ? +v : null);

export function SettingsPage() {
  const { t, tl, settings, setSettings, prefs, lang, files, resetAll } = useApp();
  const [s, setS] = useState<Settings>(settings);
  const canP = CAN.editParameters(prefs.role), canM = CAN.editMethodology(prefs.role);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const diff = () => Object.keys(s).filter((k) => JSON.stringify(s[k as keyof Settings]) !== JSON.stringify(settings[k as keyof Settings])).join(', ');
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const setSite = (i: number, p: Partial<SiteDef>) => set('sites', s.sites.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const textDocs = files.filter((f) => f.status === 'text-only');
  return (
    <>
      {!canP && <div className="banner warn">{t('readOnly')}</div>}
      <div className="row no-print" style={{ position: 'sticky', top: 64, zIndex: 5 }}>
        {dirty && canP && <><button className="btn primary" onClick={() => setSettings(s, `changed: ${diff()}`)}>{t('save')}</button><button className="btn" onClick={() => setS(settings)}>{t('cancel')}</button><span className="small muted">{tl({ en: 'Unsaved changes — saving re-runs all tests and is recorded in the audit trail.', ar: 'تغييرات غير محفوظة — الحفظ يعيد تشغيل الاختبارات ويُسجل في مسار المراجعة.' })}</span></>}
      </div>
      <Card title={tl({ en: 'Materiality engine', ar: 'محرك الأهمية النسبية' })} hint={tl({ en: 'Configured by authorized users. The platform never invents materiality; tests and ratings that depend on it report INSUFFICIENT DATA until set.', ar: 'يحددها المستخدمون المصرح لهم. لا تخترع المنصة الأهمية النسبية؛ الاختبارات المعتمدة عليها تظهر "بيانات غير كافية" حتى تحديدها.' })}>
        <div className="filters">
          <Field label={`${tl({ en: 'Overall materiality', ar: 'الأهمية النسبية الكلية' })} (${s.baseCurrency})`}><input type="number" disabled={!canM} value={s.materiality.overall ?? ''} onChange={(e) => set('materiality', { ...s.materiality, overall: numOrNull(e.target.value) })} /></Field>
          <Field label={`${tl({ en: 'Performance materiality', ar: 'الأهمية النسبية للتنفيذ' })}`}><input type="number" disabled={!canM} value={s.materiality.performance ?? ''} onChange={(e) => set('materiality', { ...s.materiality, performance: numOrNull(e.target.value) })} /></Field>
          <Field label={tl({ en: 'Clearly trivial threshold', ar: 'الحد التافه بوضوح' })}><input type="number" disabled={!canM} value={s.materiality.trivial ?? ''} onChange={(e) => set('materiality', { ...s.materiality, trivial: numOrNull(e.target.value) })} /></Field>
          <Field label={tl({ en: 'Base currency', ar: 'العملة الأساسية' })}><input disabled={!canM} value={s.baseCurrency} onChange={(e) => set('baseCurrency', e.target.value.toUpperCase().slice(0, 3))} /></Field>
        </div>
        <label className="row small" style={{ marginTop: 10 }}><input type="checkbox" disabled={!canM} checked={s.assumeBaseCurrencyWhenMissing} onChange={(e) => set('assumeBaseCurrencyWhenMissing', e.target.checked)} /> <Tag kind="asm" /> {tl({ en: 'Treat amounts with no currency as base currency (explicit assumption — shown on every affected result)', ar: 'اعتبار المبالغ بدون عملة بالعملة الأساسية (افتراض صريح يظهر في كل نتيجة متأثرة)' })}</label>
      </Card>
      <Card title={tl({ en: 'Company calendar & policy parameters', ar: 'تقويم الشركة ومعاملات السياسات' })} hint={tl({ en: 'Company-specific facts. Tests depending on a blank parameter are not performed.', ar: 'حقائق خاصة بالشركة. الاختبارات المعتمدة على معامل فارغ لا تُنفذ.' })}>
        <div className="filters">
          <Field label={tl({ en: 'Weekend days', ar: 'أيام العطلة الأسبوعية' })}><div className="row">{DAYS.map((d, i) => <label key={i} className="row small"><input type="checkbox" disabled={!canP} checked={s.weekendDays.includes(i)} onChange={(e) => set('weekendDays', e.target.checked ? [...s.weekendDays, i] : s.weekendDays.filter((x) => x !== i))} />{lang === 'ar' ? d[1] : d[0]}</label>)}</div></Field>
          <Field label={tl({ en: 'Fiscal year-end (MM-DD)', ar: 'نهاية السنة المالية (شهر-يوم)' })}><input disabled={!canP} placeholder="12-31 / 06-30" value={s.fiscalYearEnd} onChange={(e) => set('fiscalYearEnd', e.target.value)} /></Field>
          <Field label={tl({ en: 'Analysis as-of date (blank = latest date in data)', ar: 'تاريخ التقييم (فارغ = آخر تاريخ بالبيانات)' })}><input type="date" disabled={!canP} value={s.asOfDate} onChange={(e) => set('asOfDate', e.target.value)} /></Field>
          <Field label={tl({ en: 'Working hours start (0–23)', ar: 'بداية ساعات العمل' })}><input type="number" disabled={!canP} value={s.workHours.start ?? ''} onChange={(e) => set('workHours', { ...s.workHours, start: numOrNull(e.target.value) })} /></Field>
          <Field label={tl({ en: 'Working hours end (0–23)', ar: 'نهاية ساعات العمل' })}><input type="number" disabled={!canP} value={s.workHours.end ?? ''} onChange={(e) => set('workHours', { ...s.workHours, end: numOrNull(e.target.value) })} /></Field>
          <Field label={tl({ en: 'Approval limits — DoA (comma-separated)', ar: 'حدود الاعتماد — جدول الصلاحيات (مفصولة بفواصل)' })}><input disabled={!canP} value={s.approvalLimits.join(', ')} onChange={(e) => set('approvalLimits', e.target.value.split(/[,،\s]+/).map(Number).filter((x) => x > 0))} /></Field>
          <Field label={tl({ en: 'Large-journal threshold', ar: 'حد القيود الكبيرة' })}><input type="number" disabled={!canP} value={s.largeAmount ?? ''} onChange={(e) => set('largeAmount', numOrNull(e.target.value))} /></Field>
        </div>
        <Field label={tl({ en: 'Company holiday calendar (one ISO date per line)', ar: 'تقويم العطلات الرسمية (تاريخ في كل سطر)' })}><textarea disabled={!canP} value={s.holidays.join('\n')} onChange={(e) => set('holidays', e.target.value.split(/\s+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)))} /></Field>
      </Card>
      <Card title={tl({ en: 'Audit test parameters (methodology)', ar: 'معاملات اختبارات المراجعة (المنهجية)' })} hint={tl({ en: 'Transparent rule thresholds — shown in the evidence of every exception that uses them.', ar: 'حدود قواعد شفافة — تظهر في أدلة كل استثناء يستخدمها.' })}>
        <div className="filters">
          {([['roundNumberBase', 'Round-number base', 'أساس الأرقام المقربة'], ['nearThresholdPct', 'Just-below-limit tolerance %', 'نسبة القرب من الحد %'], ['splitWindowDays', 'Split window (days)', 'مدة التجزئة (يوم)'], ['backdateDays', 'Backdating tolerance (days)', 'مهلة التأريخ السابق'], ['dormantDays', 'Dormant period (days)', 'فترة الخمول (يوم)'], ['overdueDays', 'Overdue AR (days)', 'تأخر المدينين (يوم)'], ['slowMovingDays', 'Slow-moving inventory (days)', 'بطء حركة المخزون (يوم)'], ['concentrationPct', 'Concentration threshold %', 'حد التركز %'], ['budgetVariancePct', 'Budget variance tolerance %', 'حد انحراف الموازنة %'], ['spikeMultiple', 'Cost spike multiple', 'مضاعف قفزة التكلفة']] as const).map(([k, en, ar]) => (
            <Field key={k} label={lang === 'ar' ? ar : en}><input type="number" disabled={!canM} value={s[k]} onChange={(e) => set(k, +e.target.value)} /></Field>
          ))}
        </div>
        <div className="grid g2" style={{ marginTop: 8 }}>
          <Field label={tl({ en: 'Suspense-account keywords', ar: 'كلمات الحسابات المعلقة' })}><textarea disabled={!canM} value={s.suspenseKeywords.join('\n')} onChange={(e) => set('suspenseKeywords', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></Field>
          <Field label={tl({ en: 'Red-flag description keywords', ar: 'كلمات البيانات التحذيرية' })}><textarea disabled={!canM} value={s.suspiciousKeywords.join('\n')} onChange={(e) => set('suspiciousKeywords', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></Field>
        </div>
      </Card>
      <Card title={tl({ en: 'Sites (Head Office and operating locations)', ar: 'المواقع (المركز الرئيسي والمواقع التشغيلية)' })} hint={tl({ en: 'Keywords are matched against Site / Location / Cost center / Department values (English and Arabic).', ar: 'تتم مطابقة الكلمات مع قيم الموقع / مركز التكلفة / الإدارة (بالعربية والإنجليزية).' })}>
        <div className="stack">
          {s.sites.map((x, i) => (
            <div key={i} className="filters">
              <Field label="ID"><input disabled={!canM} value={x.id} onChange={(e) => setSite(i, { id: e.target.value.toUpperCase() })} /></Field>
              <Field label="Name (EN)"><input disabled={!canM} value={x.name.en} onChange={(e) => setSite(i, { name: { ...x.name, en: e.target.value } })} /></Field>
              <Field label="الاسم (AR)"><input disabled={!canM} value={x.name.ar} onChange={(e) => setSite(i, { name: { ...x.name, ar: e.target.value } })} dir="rtl" /></Field>
              <Field label={tl({ en: 'Keywords (comma-separated)', ar: 'الكلمات المفتاحية' })}><input disabled={!canM} value={x.keywords.join(', ')} onChange={(e) => setSite(i, { keywords: e.target.value.split(/[,،]/).map((k) => k.trim()).filter(Boolean) })} /></Field>
              {canM && <button className="btn sm danger" onClick={() => set('sites', s.sites.filter((_, j) => j !== i))}>{t('delete')}</button>}
            </div>
          ))}
          {canM && <button className="btn" onClick={() => set('sites', [...s.sites, { id: `S${s.sites.length + 1}`, name: { en: '', ar: '' }, keywords: [] }])}>+ {tl({ en: 'Add site', ar: 'إضافة موقع' })}</button>}
        </div>
      </Card>
      <Card title={tl({ en: 'Inherent likelihood (CAE judgement, 1–5)', ar: 'الاحتمالية الكامنة (تقدير رئيس المراجعة 1–5)' })}>
        <div className="filters">{RISKS.map((r) => <Field key={r.id} label={`${r.id} ${tl(r.title)}`}><select disabled={!canM} value={s.inherentLikelihood[r.id] ?? ''} onChange={(e) => { const x = { ...s.inherentLikelihood }; if (e.target.value === '') delete x[r.id]; else x[r.id] = +e.target.value; set('inherentLikelihood', x); }}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Field>)}</div>
      </Card>
      <Card title={tl({ en: 'Controlling policy / regulatory sources', ar: 'مصادر السياسات / اللوائح الحاكمة' })} hint={tl({ en: 'Standards (EAS, IFRS, COSO, IIA, Egyptian tax law) are referenced structurally; no compliance is claimed. Upload the relevant document and confirm it here to use it as the controlling source.', ar: 'تتم الإشارة للمعايير هيكليًا دون ادعاء الالتزام. ارفع المستند المعني وأكده هنا لاستخدامه كمصدر حاكم.' })}>
        {!textDocs.length ? <p className="muted small">{tl({ en: 'No policy / regulatory documents uploaded (Word, PDF or TXT).', ar: 'لم يتم رفع مستندات سياسات / لوائح.' })}</p> : textDocs.map((f) => <label key={f.id} className="row small"><input type="checkbox" disabled={!canM} checked={s.policySources.includes(f.id)} onChange={(e) => set('policySources', e.target.checked ? [...s.policySources, f.id] : s.policySources.filter((x) => x !== f.id))} /> <span className="mono">{f.name}</span> <span className="muted">#{f.sha256.slice(0, 10)}</span></label>)}
      </Card>
      <Card title={tl({ en: 'Bilingual audit terminology dictionary', ar: 'قاموس مصطلحات المراجعة ثنائي اللغة' })}>
        <DataTable rows={GLOSSARY.map(([en, ar]) => ({ en, ar }))} csvName="glossary" cols={[{ key: 'en', label: 'English' }, { key: 'ar', label: 'العربية' }]} />
      </Card>
      {prefs.role === 'cae' && <Card title={tl({ en: 'Workspace', ar: 'مساحة العمل' })}><button className="btn danger" onClick={() => { if (confirm(tl({ en: 'Remove all uploaded data, settings and actions from this browser? The audit trail is kept.', ar: 'حذف جميع البيانات والإعدادات والإجراءات من هذا المتصفح؟ يتم الاحتفاظ بمسار المراجعة.' }))) resetAll(); }}>{tl({ en: 'Reset workspace (audit trail is preserved)', ar: 'إعادة تعيين مساحة العمل (مع الاحتفاظ بمسار المراجعة)' })}</button></Card>}
    </>
  );
}
