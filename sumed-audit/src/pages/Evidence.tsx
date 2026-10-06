import { useEffect, useRef } from 'react';
import { useApp, CAN } from '../state';
import { TEST_BY_ID } from '../engine/tests';
import { RISK_BY_ID, CONTROL_BY_ID } from '../engine/library';
import { fieldDef, datasetLabel } from '../engine/schema';
import { mask, fmtMoney } from '../engine/values';
import { translateValue } from '../i18n/dict';
import { Card, Modal, Sev, Tag, Empty } from '../ui/kit';
import { EvStatus } from './Findings';
import { printNow } from './common';
import type { CalcInput } from '../engine/types';

const STEPS = ['chainFinding', 'risk', 'control', 'chainTest', 'chainCalc', 'chainTxn', 'chainRecord', 'chainFile', 'chainSheet', 'chainRow'] as const;

export function EvidencePanel({ findingId, index }: { findingId: string; index: number }) {
  const { t, tl, analysis, setNav, prefs, setPrefs, log_, lang, files } = useApp();
  const f = analysis.findingById[findingId];
  const refs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => { if (f) log_('EVIDENCE_VIEW', findingId, `exception #${index + 1}`); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [findingId, index]);
  const close = () => setNav({ evidence: null });
  if (!CAN.viewEvidence(prefs.role)) return <Modal title={t('evidenceViewer')} onClose={close}><Empty title={t('noAccess')} /></Modal>;
  if (!f) return <Modal title={t('evidenceViewer')} onClose={close}><Empty title={tl({ en: 'Finding not present under current data/filters.', ar: 'الملاحظة غير موجودة وفق البيانات/المرشحات الحالية.' })} /></Modal>;
  const def = TEST_BY_ID[f.testId];
  const res = analysis.resultById[f.testId];
  const ex = res.exceptions[Math.min(index, res.exceptions.length - 1)];
  const risk = RISK_BY_ID[f.riskId], ctl = CONTROL_BY_ID[f.controlId];
  const go = (i: number) => setNav({ evidence: { findingId, index: Math.max(0, Math.min(res.exceptions.length - 1, i)) } });
  const jump = (k: string) => refs.current[k]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const stepLabel = (k: typeof STEPS[number]) => (k === 'risk' ? tl({ en: 'Risk', ar: 'المخاطر' }) : k === 'control' ? tl({ en: 'Control', ar: 'الرقابة' }) : t(k));
  const inLabel = (x: CalcInput) => (typeof x.label === 'string' ? x.label : tl(x.label));
  return (
    <Modal title={<>{t('evidenceViewer')} · <span className="mono">{f.id}</span></>} onClose={close}
      actions={<div className="btn-row no-print">
        <button className="btn sm" disabled={index <= 0} onClick={() => go(index - 1)}>{lang === 'ar' ? '→' : '←'}</button>
        <span className="small">{t('exceptionOf')} {index + 1} / {res.exceptions.length}</span>
        <button className="btn sm" disabled={index >= res.exceptions.length - 1} onClick={() => go(index + 1)}>{lang === 'ar' ? '←' : '→'}</button>
        {CAN.unmask(prefs.role) && <button className="btn sm" onClick={() => setPrefs({ unmask: !prefs.unmask })}>{prefs.unmask ? '🔒' : t('unmask')}</button>}
        {CAN.export(prefs.role) && <button className="btn sm" onClick={() => { log_('EXPORT_EVIDENCE_PDF', findingId, `exception #${index + 1}`); printNow(true); }}>PDF</button>}
      </div>}>
      <div className="chain no-print" aria-label="evidence chain">
        {STEPS.map((k, i) => <span key={k} className="row" style={{ gap: 4 }}>{i > 0 && <span className="arrow">→</span>}<button className="step" onClick={() => jump(k)}>{stepLabel(k)}</button></span>)}
      </div>

      <div ref={(el) => { refs.current.chainFinding = el; }}><Card title={<>1 · {t('chainFinding')}</>}>
        <div className="row"><span className="mono">{f.id}</span><b>{tl(f.title)}</b><Sev s={f.rating} /><EvStatus f={f} /></div>
        <p><Tag kind="src" /> <Tag kind="calc" /> {tl(f.condition)}</p>
        <p className="small"><b>{t('whyFlagged')}:</b> {tl(ex.description)}</p>
        <p className="small"><Tag kind="ai" /> {tl(f.cause)}</p>
        <p className="small muted">{t('confidence')}: {f.confidence} — {tl(f.confidenceBasis)}. {tl({ en: 'AI confidence never replaces evidence.', ar: 'ثقة الذكاء الاصطناعي لا تغني عن الأدلة.' })}</p>
      </Card></div>

      <div className="grid g2">
        <div ref={(el) => { refs.current.risk = el; }}><Card title={<>2 · <Tag kind="risk" /> {tl({ en: 'Risk', ar: 'المخاطر' })}</>}><b className="mono">{risk?.id}</b> {tl(risk?.title)}<p className="small">{tl(risk?.description)}</p></Card></div>
        <div ref={(el) => { refs.current.control = el; }}><Card title={<>3 · {tl({ en: 'Control', ar: 'الرقابة' })}</>}><b className="mono">{ctl?.id}</b> {tl(ctl?.objective)}<p className="small">{tl(ctl?.description)}</p></Card></div>
      </div>

      <div ref={(el) => { refs.current.chainTest = el; }}><Card title={<>4 · {t('chainTest')}</>}>
        <dl className="kv"><dt>{tl({ en: 'Test ID', ar: 'رقم الاختبار' })}</dt><dd className="mono">{def.id}</dd><dt>{tl({ en: 'Test name', ar: 'اسم الاختبار' })}</dt><dd>{tl(def.name)}</dd><dt>{tl({ en: 'Objective', ar: 'الهدف' })}</dt><dd>{tl(def.objective)}</dd><dt>{tl({ en: 'Audit rule', ar: 'قاعدة المراجعة' })}</dt><dd>{tl(def.rule)}</dd><dt>{tl({ en: 'Control objective', ar: 'هدف الرقابة' })}</dt><dd>{tl(ctl?.objective)}</dd>
          {res.params && <><dt>{tl({ en: 'Parameters used', ar: 'المعاملات المستخدمة' })}</dt><dd className="small ltr">{Object.entries(res.params).map(([k, v]) => `${k}=${v}`).join(' · ')}</dd></>}
        </dl>
      </Card></div>

      <div ref={(el) => { refs.current.chainCalc = el; }}><Card title={<>5 · <Tag kind="calc" /> {t('chainCalc')}</>}>
        <div className="formula">{ex.calc.formula}</div>
        <table style={{ marginTop: 8 }}><tbody>
          {ex.calc.inputs.map((x, i) => <tr key={i}><td>{inLabel(x)}</td><td className="num mono">{x.value === null ? <span className="insufficient">null</span> : String(x.value)}</td><td className="small muted mono">{x.ref ? x.ref.recordId : ''}</td></tr>)}
          <tr><td className="bold">= {tl({ en: 'Result', ar: 'النتيجة' })}</td><td className="num mono bold">{String(ex.calc.result ?? '')}</td><td /></tr>
        </tbody></table>
        {ex.money && <p className="small">{t('exposure')}: <span className="ltr">{fmtMoney(ex.money)}</span></p>}
      </Card></div>

      <div ref={(el) => { refs.current.chainTxn = el; }} />
      {ex.rows.map((ref, i) => {
        const tb = analysis.tables.find((x) => x.id === ref.tableId);
        const row = tb?.rows.find((r) => r.recordId === ref.recordId);
        const file = files.find((x) => x.id === tb?.fileId);
        if (!tb || !row) return <Card key={i} title={t('chainTxn')}><span className="insufficient">{t('insufficientEvidence')} — {ref.recordId}</span></Card>;
        const hl = new Set((ex.highlight[ref.recordId] ?? []).map((k) => tb.mapping[k]).filter(Boolean));
        const byHeader = Object.fromEntries(Object.entries(tb.mapping).map(([k, h]) => [h, k]));
        return (
          <div key={ref.recordId} ref={i === 0 ? (el) => { refs.current.chainRecord = el; refs.current.chainFile = el; refs.current.chainSheet = el; refs.current.chainRow = el; } : undefined}>
            <Card title={<>6–10 · {t('chainTxn')} → {t('chainRecord')} → {t('chainFile')} → {t('chainSheet')} → {t('chainRow')} {ex.rows.length > 1 && <span className="muted small">({i + 1}/{ex.rows.length})</span>}</>}>
              <dl className="kv small">
                <dt>{t('chainFile')}</dt><dd className="mono">{tb.fileName} <span className="muted">({file?.ext.toUpperCase()})</span></dd>
                <dt>{t('fileHash')}</dt><dd className="mono small">{file?.sha256}</dd>
                <dt>{tl({ en: 'Uploaded', ar: 'تاريخ الرفع' })}</dt><dd>{file?.uploadedAt.replace('T', ' ').slice(0, 19)} · {file?.uploadedBy}{file?.periodLabel ? ` · ${file.periodLabel}` : ''}</dd>
                <dt>{t('chainSheet')}</dt><dd className="mono">{tb.sheet} <span className="muted">({tl(datasetLabel(tb.datasetType))}, {t('headerRow')} {tb.headerRow})</span></dd>
                <dt>{t('chainRow')}</dt><dd className="mono bold">{row.rowNumber}</dd>
                <dt>{tl({ en: 'Source Record ID', ar: 'رقم السجل المصدري' })}</dt><dd className="mono">{row.recordId}</dd>
              </dl>
              <p className="small"><span className="badge" style={{ background: 'var(--hl)' }}>■</span> {t('highlighted')}{!prefs.unmask && <> · 🔒 {t('masked')}</>}</p>
              <div className="table-wrap" style={{ maxHeight: 420 }}>
                <table>
                  <thead><tr><th>{tl({ en: 'Source column', ar: 'عمود المصدر' })}</th><th>{tl({ en: 'Mapped field', ar: 'الحقل المرتبط' })}</th><th>{t('originalValue')}</th>{lang === 'ar' && <th>{t('translatedValue')}</th>}</tr></thead>
                  <tbody>
                    {tb.headers.map((h) => {
                      const fk = byHeader[h];
                      const fd = fk ? fieldDef(tb.datasetType, fk) : undefined;
                      const raw = row.values[h];
                      const shown = fd?.sensitive && !prefs.unmask && raw !== null && raw !== '' ? mask(String(raw)) : raw === null ? '' : String(raw);
                      const tr = typeof raw === 'string' ? translateValue(raw, lang) : null;
                      const on = hl.has(h);
                      return (
                        <tr key={h}>
                          <td className={on ? 'hl' : ''}>{h}</td>
                          <td className="small muted">{fd ? tl(fd.label) : ''}</td>
                          <td className={on ? 'hl' : ''}><span className="ltr">{shown}</span></td>
                          {lang === 'ar' && <td className="small">{tr ?? (raw !== null && raw !== '' && typeof raw === 'string' && /[a-z]/i.test(raw) ? <span className="muted">{tl({ en: 'Translation not available — original shown', ar: 'لا تتوفر ترجمة — تُعرض القيمة الأصلية' })}</span> : '')}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      })}
      <p className="small muted">{tl({ en: 'Reproduce: open the source file above, go to the sheet and row number, apply the audit rule and formula with the shown inputs. Original uploaded data is never modified.', ar: 'لإعادة الإنتاج: افتح الملف المصدر، انتقل إلى الورقة والسطر، وطبق القاعدة والمعادلة على المدخلات الموضحة. البيانات الأصلية لا تُعدل أبدًا.' })}</p>
    </Modal>
  );
}
