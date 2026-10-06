import { useRef, useState } from 'react';
import { useApp, CAN } from '../state';
import { ingestFile } from '../engine/parse';
import { DATASETS, DATASET_BY_TYPE, datasetLabel } from '../engine/schema';
import { reclassify } from '../engine/classify';
import { requirementStatus } from '../engine/analysis';
import { TEST_LIBRARY } from '../engine/tests';
import type { DatasetType, SourceFile, SourceTable } from '../engine/types';
import { Card, DataTable, Empty, Kpi, QC, Field } from '../ui/kit';
import { downloadCsv } from '../exports';
import { mask } from '../engine/values';
import { fieldDef } from '../engine/schema';

const TYPES: DatasetType[] = [...DATASETS.map((d) => d.type), 'policy', 'unknown'];

function TableMapper({ file, table }: { file: SourceFile; table: SourceTable }) {
  const { t, tl, updateFile, prefs } = useApp();
  const def = DATASET_BY_TYPE[table.datasetType];
  const canEdit = CAN.upload(prefs.role);
  const patch = (nt: SourceTable, why: string) => updateFile({ ...file, tables: file.tables.map((x) => (x.id === nt.id ? nt : x)) }, why);
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ padding: 12, background: 'var(--surface-2)' }}>
      <div className="row">
        <b className="mono">{table.sheet}</b>
        <span className="muted small">{table.rows.length.toLocaleString()} {t('rows')} · {t('headerRow')} {table.headerRow}</span>
        <span className="spacer" />
        <Field label={t('classification')}>
          <select disabled={!canEdit} value={table.datasetType} onChange={(e) => patch(reclassify(table, e.target.value as DatasetType), `${table.sheet}: ${table.datasetType} → ${e.target.value}`)}>
            {TYPES.map((x) => <option key={x} value={x}>{tl(datasetLabel(x))}{x === table.suggestedType ? ' ✦' : ''}</option>)}
          </select>
        </Field>
        {def && <button className="btn sm" onClick={() => setOpen((o) => !o)}>{t('mapping')} ({Object.keys(table.mapping).length}/{def.fields.length}) {open ? '▴' : '▾'}</button>}
      </div>
      {def && def.required.some((r) => !table.mapping[r]) && <div className="insufficient small" style={{ marginTop: 6 }}>{t('missingFields')}: {def.required.filter((r) => !table.mapping[r]).map((r) => tl(def.fields.find((f) => f.key === r)!.label)).join(', ')}</div>}
      {open && def && (
        <div className="filters" style={{ marginTop: 10 }}>
          {def.fields.map((f) => (
            <Field key={f.key} label={<>{tl(f.label)}{def.required.includes(f.key) ? ' *' : ''}</>}>
              <select disabled={!canEdit} value={table.mapping[f.key] ?? ''} onChange={(e) => { const m = { ...table.mapping }; if (e.target.value) m[f.key] = e.target.value; else delete m[f.key]; patch({ ...table, mapping: m }, `${table.sheet}: map ${f.key} → ${e.target.value || '(none)'}`); }}>
                <option value="">{t('unmapped')}</option>
                {table.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
          ))}
        </div>
      )}
    </div>
  );
}

export function Upload() {
  const app = useApp();
  const { t, tl, files, addFiles, removeFile, prefs, analysis, go } = app;
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [period, setPeriod] = useState('');
  const inp = useRef<HTMLInputElement>(null);
  const canUpload = CAN.upload(prefs.role);
  const handle = async (list: FileList | null) => {
    if (!list?.length || !canUpload) return;
    const out: SourceFile[] = [];
    for (const f of Array.from(list)) { setBusy(`${t('processing')} ${f.name}`); out.push(await ingestFile(f, prefs.user, period)); }
    await addFiles(out); setBusy(null);
  };
  return (
    <>
      {!files.length && <div className="banner info"><b>{t('uploadToStart')}</b></div>}
      {canUpload ? (
        <Card title={t('upload')} hint={t('supported')}>
          <div className="row" style={{ marginBottom: 10 }}><Field label={t('periodLabel')}><input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2025-Q4" /></Field></div>
          <div className={`drop ${over ? 'over' : ''}`} onClick={() => inp.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }} role="button" tabIndex={0}>
            <b>⇪ {t('dropHere')}</b>
            <span className="muted small">.xlsx · .csv · .tsv · .pdf · .docx · .txt</span>
            <input ref={inp} type="file" multiple hidden accept=".xlsx,.xlsm,.csv,.tsv,.pdf,.docx,.txt,.xls" onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
          </div>
          {busy && <p className="muted">{busy}</p>}
        </Card>
      ) : <div className="banner warn">{t('readOnly')}</div>}
      {analysis.hasData && <div className="row"><button className="btn primary" onClick={() => go('quality')}>◎ {t('quality')} →</button><button className="btn" onClick={() => go('requirements')}>☰ {t('requirements')}</button></div>}
      {files.length > 0 && (
        <Card title={`${t('files')} (${files.length})`}>
          <div className="stack">
            {files.map((f) => (
              <div key={f.id} className="card" style={{ padding: 12 }}>
                <div className="row">
                  <b className="mono">{f.name}</b>
                  <span className={`badge ${f.status === 'parsed' ? 'pass' : f.status === 'text-only' ? '' : 'fail'}`}>{f.status}</span>
                  <span className="muted small">{(f.size / 1024).toFixed(1)} KB · {f.uploadedAt.slice(0, 16).replace('T', ' ')} · {f.uploadedBy}{f.periodLabel ? ` · ${f.periodLabel}` : ''}</span>
                  <span className="spacer" />
                  <span className="mono muted small" title={t('fileHash')}>#{f.sha256.slice(0, 12)}</span>
                  {CAN.deleteFile(prefs.role) && <button className="btn sm danger" onClick={() => { if (confirm(`${t('removeFile')}: ${f.name}?`)) removeFile(f.id); }}>{t('removeFile')}</button>}
                </div>
                {f.error && <div className="insufficient small">{f.error}</div>}
                {f.status === 'text-only' && <div className="small muted">{t('textOnly')} — {(f.text ?? '').slice(0, 160)}…</div>}
                <div className="stack" style={{ marginTop: 8 }}>{f.tables.map((tb) => <TableMapper key={tb.id} file={f} table={tb} />)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <p className="small muted">{tl({ en: 'Source data is immutable: files are hashed (SHA-256) and rows are stored read-only. Classification and field mapping are metadata and every change is recorded in the audit trail.', ar: 'بيانات المصدر غير قابلة للتعديل: يتم حساب بصمة SHA-256 للملفات وتُخزن السطور للقراءة فقط. التصنيف وربط الحقول بيانات وصفية وكل تعديل يُسجل في مسار المراجعة.' })}</p>
    </>
  );
}

export function Requirements() {
  const { t, tl, analysis, lang } = useApp();
  const st = requirementStatus(analysis.tables);
  const uploaded = st.filter((x) => x.uploaded).length;
  return (
    <>
      {!analysis.hasData && <div className="banner info"><b>{t('uploadToStart')}</b></div>}
      <div className="kpis">
        <Kpi label={tl({ en: 'Datasets provided', ar: 'مجموعات البيانات المقدمة' })} value={`${uploaded} / ${st.length}`} accent />
        <Kpi label={t('testsPerformed')} value={`${analysis.results.filter((r) => r.status === 'performed').length} / ${analysis.results.length}`} />
      </div>
      {st.map((s) => {
        const tests = TEST_LIBRARY.filter((x) => x.needs.some((n) => n.type === s.def.type));
        return (
          <Card key={s.def.type} title={<>{s.def.code}. {tl(s.def.label)} {s.uploaded ? <span className="badge pass">✓ {s.rows.toLocaleString()} {t('rows')}</span> : <span className="badge fail">✕ {tl({ en: 'Not uploaded', ar: 'لم يُرفع' })}</span>}</>}
            actions={<button className="btn sm" onClick={() => downloadCsv(`template-${s.def.type}`, s.def.fields.map((f) => f.label.en), [])}>⤓ {tl({ en: 'CSV template (headers only)', ar: 'قالب CSV (عناوين فقط)' })}</button>}>
            <div className="row small">
              {s.fields.map(({ f, mapped, required }) => <span key={f.key} className={`badge ${mapped ? 'pass' : required ? 'fail' : ''}`} title={f.syn.slice(0, 5).join(', ')}>{mapped ? '✓' : required ? '✕' : '○'} {tl(f.label)}{required ? ' *' : ''}</span>)}
            </div>
            {tests.length > 0 && <details style={{ marginTop: 8 }}><summary className="small">{tests.length} {lang === 'ar' ? 'اختبار يعتمد على هذه البيانات' : 'tests depend on this dataset'}</summary>
              <ul className="small">{tests.map((x) => { const r = analysis.resultById[x.id]; return <li key={x.id}><span className="mono">{x.id}</span> {tl(x.name)} — {r.status === 'performed' ? <span className="badge pass">✓</span> : <span className="insufficient">{r.missing.join('; ')}</span>}</li>; })}</ul></details>}
          </Card>
        );
      })}
    </>
  );
}

export function Quality() {
  const { t, tl, analysis, go, prefs } = useApp();
  const q = analysis.quality;
  const [sel, setSel] = useState<string | null>(null);
  if (!analysis.hasData) return <Empty title={t('uploadToStart')}><button className="btn primary" onClick={() => go('upload')}>{t('upload')}</button></Empty>;
  const tq = q.tables.find((x) => x.tableId === sel);
  const tbl = analysis.tables.find((x) => x.id === sel);
  return (
    <>
      {q.criticalFailures.length > 0 && <div className="banner fail"><div><b>{tl({ en: 'Critical data-quality failures — final audit conclusions are withheld until resolved', ar: 'إخفاقات حرجة في جودة البيانات — يتم حجب الاستنتاجات النهائية حتى المعالجة' })}</b><ul className="small">{q.criticalFailures.map((c) => <li key={c}>{c}</li>)}</ul></div></div>}
      <div className="kpis">
        <Kpi accent label={t('dqScore')} value={q.score ?? '—'} note="0–100" />
        <Kpi label={t('completeness')} value={`${q.completeness ?? '—'}%`} />
        <Kpi label={t('duplicates')} value={`${q.duplicatePct ?? '—'}%`} />
        <Kpi label={t('invalidRecords')} value={q.invalidRecords} />
        <Kpi label={t('unbalancedJournals')} value={q.unbalancedJournals} />
        <Kpi label={t('unmappedAccounts')} value={analysis.datasetsPresent.has('coa') ? q.unmappedAccounts : '—'} note={analysis.datasetsPresent.has('coa') ? undefined : tl({ en: 'Chart of accounts not uploaded', ar: 'دليل الحسابات غير مرفوع' })} />
        <Kpi label={t('currencyIssues')} value={q.currencyIssues} />
        <Kpi label={t('dateAnomalies')} value={q.dateAnomalies} />
        <Kpi label={t('negativeBalances')} value={q.negativeBalances} />
        <Kpi label={t('outliers')} value={q.outliers} />
      </div>
      <Card title={tl({ en: 'Quality by dataset', ar: 'الجودة حسب مجموعة البيانات' })} hint={tl({ en: 'Score = 40% completeness + 25% validity + 15% uniqueness + 20% consistency, reduced when required fields are missing.', ar: 'المؤشر = 40% اكتمال + 25% صلاحية + 15% تفرد + 20% اتساق، ويُخفض عند غياب الحقول الإلزامية.' })}>
        <DataTable rows={q.tables} csvName="data-quality" onRow={(r) => setSel(r.tableId)} cols={[
          { key: 'fileName', label: t('chainFile'), render: (r) => <span className="mono">{r.fileName}</span> },
          { key: 'sheet', label: t('chainSheet') },
          { key: 'datasetType', label: t('classification'), render: (r) => tl(datasetLabel(r.datasetType as DatasetType)) },
          { key: 'rows', label: t('rows'), num: true },
          { key: 'score', label: t('dqScore'), num: true },
          { key: 'completeness', label: `${t('completeness')} %`, num: true },
          { key: 'duplicatePct', label: `${t('duplicates')} %`, num: true },
          { key: 'invalidRecords', label: t('invalidRecords'), num: true },
          { key: 'missingRequired', label: t('missingFields'), value: (r) => r.missingRequired.join(', ') },
          { key: 'totals', label: tl({ en: 'Totals check', ar: 'فحص الإجماليات' }), value: (r) => r.totalsCheck.map((c) => `${c.label.en}: ${c.pass ? 'PASS' : 'FAIL'}`).join('; '), render: (r) => r.totalsCheck.map((c) => <div key={c.label.en}><QC s={c.pass ? 'PASS' : 'FAIL'} /> <span className="small">{tl(c.label)} <span className="ltr muted">({c.detail})</span></span></div>) },
        ]} />
      </Card>
      {tq && tbl && (
        <Card title={<>{tq.fileName} / {tq.sheet}</>} actions={<button className="btn sm" onClick={() => setSel(null)}>✕</button>}>
          {tq.issues.length === 0 ? <p className="muted">{tl({ en: 'No issues detected.', ar: 'لا توجد ملاحظات.' })}</p> : tq.issues.map((i) => (
            <details key={i.kind} style={{ marginBottom: 6 }}>
              <summary>{tl(i.label)} — {i.count}</summary>
              <div className="table-wrap" style={{ maxHeight: 280 }}><table><thead><tr><th>{t('chainRow')}</th>{tbl.headers.slice(0, 12).map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{i.sample.slice(0, 30).map((s) => { const row = tbl.rows.find((r) => r.recordId === s.recordId); return row ? <tr key={s.recordId}><td className="mono">{row.rowNumber}</td>{tbl.headers.slice(0, 12).map((h) => { const fk = Object.entries(tbl.mapping).find(([, v]) => v === h)?.[0]; const sens = fk && fieldDef(tbl.datasetType, fk)?.sensitive && !prefs.unmask; const v = row.values[h]; return <td key={h}>{sens && v ? mask(String(v)) : String(v ?? '')}</td>; })}</tr> : null; })}</tbody></table></div>
            </details>
          ))}
          {tq.missingRecommended.length > 0 && <p className="small muted">{tl({ en: 'Recommended fields not provided', ar: 'حقول موصى بها غير مقدمة' })}: {tq.missingRecommended.map((k) => tl(DATASET_BY_TYPE[tq.datasetType]?.fields.find((f) => f.key === k)?.label)).join(', ')}</p>}
        </Card>
      )}
    </>
  );
}
