import { useState } from 'react';
import { useApp } from '../state';
import { TEST_LIBRARY, TEST_BY_ID } from '../engine/tests';
import { AREAS, AREA_LABEL } from '../engine/library';
import { CAT_LABEL, type FsCat } from '../engine/fsa';
import { accessor, fmtNum, dayDiff } from '../engine/values';
import { rowSite } from '../engine/sites';
import { datasetLabel } from '../engine/schema';
import { Card, DataTable, Empty, Insufficient, Kpi, Money, Sev, Tag, Bars, QC } from '../ui/kit';
import { useFindings } from './common';
import type { DatasetType } from '../engine/types';

export function Tests() {
  const { t, tl, analysis, setNav, lang } = useApp();
  const [area, setArea] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const rows = TEST_LIBRARY.filter((x) => !area || x.area === area).map((d) => ({ d, r: analysis.resultById[d.id] }));
  const s = sel ? TEST_BY_ID[sel] : null;
  const sr = sel ? analysis.resultById[sel] : null;
  return (
    <>
      <div className="kpis">
        <Kpi accent label={tl({ en: 'Tests in library', ar: 'الاختبارات في المكتبة' })} value={TEST_LIBRARY.length} />
        <Kpi label={t('testsPerformed')} value={analysis.results.filter((r) => r.status === 'performed').length} />
        <Kpi label={tl({ en: 'Not performed (insufficient data)', ar: 'غير منفذة (بيانات غير كافية)' })} value={analysis.results.filter((r) => r.status === 'insufficient').length} />
        <Kpi label={tl({ en: 'With exceptions', ar: 'بها استثناءات' })} value={analysis.results.filter((r) => r.exceptions.length).length} />
      </div>
      {s && sr && (
        <Card title={<><span className="mono">{s.id}</span> {tl(s.name)}</>} actions={<button className="btn sm" onClick={() => setSel(null)}>✕</button>}>
          <dl className="kv small"><dt>{tl({ en: 'Objective', ar: 'الهدف' })}</dt><dd>{tl(s.objective)}</dd><dt>{tl({ en: 'Rule', ar: 'القاعدة' })}</dt><dd>{tl(s.rule)}</dd><dt>{t('criteria')}</dt><dd>{tl(s.criteria)}</dd><dt>{tl({ en: 'Required data', ar: 'البيانات المطلوبة' })}</dt><dd>{s.needs.map((n) => `${tl(datasetLabel(n.type as DatasetType))}: ${n.fields.join(', ')}`).join(' · ')}</dd>
            <dt>{t('status')}</dt><dd>{sr.status === 'performed' ? <>✓ {t('population')} {sr.population.toLocaleString()} · {t('exceptions')} {sr.exceptions.length}{sr.skipped ? ` · skipped ${sr.skipped}` : ''}</> : <Insufficient missing={sr.missing} />}</dd>
            {sr.params && <><dt>{tl({ en: 'Parameters', ar: 'المعاملات' })}</dt><dd className="ltr small">{Object.entries(sr.params).map(([k, v]) => `${k}=${v}`).join(' · ')}</dd></>}</dl>
          {sr.exceptions.length > 0 && <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={() => setNav({ findingId: `F-${s.id}` })}>{t('findings')} F-{s.id}</button><button className="btn evidence-btn" onClick={() => setNav({ evidence: { findingId: `F-${s.id}`, index: 0 } })}>{t('showEvidence')}</button></div>}
        </Card>
      )}
      <Card title={t('tests')} actions={<select className="inp" value={area} onChange={(e) => setArea(e.target.value)}><option value="">{t('all')}</option>{AREAS.map((a) => <option key={a.id} value={a.id}>{tl(a.label)}</option>)}</select>}>
        <DataTable rows={rows} csvName="audit-tests" onRow={(x) => setSel(x.d.id)} max={300} cols={[
          { key: 'id', label: 'ID', value: (x) => x.d.id, render: (x) => <span className="mono">{x.d.id}</span> },
          { key: 'area', label: t('area'), value: (x) => tl(AREA_LABEL[x.d.area]) },
          { key: 'name', label: tl({ en: 'Test', ar: 'الاختبار' }), value: (x) => tl(x.d.name), render: (x) => <>{tl(x.d.name)} {x.d.fraud && <span className="tag risk">{lang === 'ar' ? 'احتيال' : 'fraud'}</span>}</> },
          { key: 'sev', label: tl({ en: 'Rule severity', ar: 'خطورة القاعدة' }), value: (x) => x.d.severity, render: (x) => <Sev s={x.d.severity} /> },
          { key: 'st', label: t('status'), value: (x) => x.r.status, render: (x) => (x.r.status === 'performed' ? <span className="badge pass">✓</span> : <span className="insufficient small">{x.r.missing[0]}</span>) },
          { key: 'pop', label: t('population'), value: (x) => (x.r.status === 'performed' ? x.r.population : null), num: true },
          { key: 'exc', label: t('exceptions'), value: (x) => (x.r.status === 'performed' ? x.r.exceptions.length : null), num: true },
        ]} />
      </Card>
    </>
  );
}

// ───────────────────────── Site payments & contracts review (HO, Sokhna, Kerir, Dahshour)
export function Sites() {
  const { t, tl, analysis, settings, setNav, go, lang } = useApp();
  const [site, setSite] = useState<string>(settings.sites[0]?.id ?? '');
  if (!analysis.hasData) return <Empty title={t('uploadToStart')}><button className="btn primary" onClick={() => go('upload')}>{t('upload')}</button></Empty>;
  const ap = analysis.filteredTables.filter((x) => x.datasetType === 'ap');
  const ct = analysis.filteredTables.filter((x) => x.datasetType === 'contracts');
  const bySite: Record<string, { pay: Record<string, number>; n: number; paid: number; unpaid: number; cn: number; cval: Record<string, number>; active: number; expired: number }> = {};
  const ensure = (k: string) => (bySite[k] ??= { pay: {}, n: 0, paid: 0, unpaid: 0, cn: 0, cval: {}, active: 0, expired: 0 });
  const ao = settings.asOfDate || analysis.today;
  const apRows: { site: string; vendor: string; inv: string; amt: number | null; cur: string; paid: string; rid: string; tid: string }[] = [];
  for (const tb of ap) { const a = accessor(tb); for (const r of tb.rows) { const s = rowSite(tb, r, settings.sites) ?? '__none'; const e = ensure(s); const v = a.n(r, 'amount'); const c = a.t(r, 'currency').toUpperCase() || '—'; e.n++; if (v !== null) e.pay[c] = (e.pay[c] ?? 0) + v; if (a.d(r, 'paymentDate')) e.paid++; else e.unpaid++; apRows.push({ site: s, vendor: a.t(r, 'vendor'), inv: a.t(r, 'invoiceNo'), amt: v, cur: c, paid: a.d(r, 'paymentDate') ?? '', rid: r.recordId, tid: tb.id }); } }
  const ctRows: { site: string; id: string; party: string; end: string; value: number | null; billed: number | null; cur: string; state: string }[] = [];
  for (const tb of ct) { const a = accessor(tb); for (const r of tb.rows) { const s = rowSite(tb, r, settings.sites) ?? '__none'; const e = ensure(s); e.cn++; const v = a.n(r, 'value'); const c = a.t(r, 'currency').toUpperCase() || '—'; if (v !== null) e.cval[c] = (e.cval[c] ?? 0) + v; const end = a.d(r, 'endDate') ?? ''; const state = !end ? 'unknown' : end < ao ? 'expired' : dayDiff(ao, end) <= 90 ? 'expiring' : 'active'; if (state === 'expired') e.expired++; else if (state !== 'unknown') e.active++; ctRows.push({ site: s, id: a.t(r, 'contractId'), party: a.t(r, 'counterparty'), end, value: v, billed: a.n(r, 'billed'), cur: c, state }); } }
  const name = (id: string) => (id === '__none' ? t('unassigned') : tl(settings.sites.find((s) => s.id === id)?.name));
  // exceptions per site per test (payments/contracts/procurement/treasury tests)
  const scopeTests = analysis.results.filter((r) => r.status === 'performed' && r.exceptions.length && ['ap', 'contracts', 'procurement', 'treasury'].includes(TEST_BY_ID[r.testId].area));
  const excBySite = (sid: string) => scopeTests.map((r) => ({ r, n: r.exceptions.filter((e) => e.rows.some((ref) => { const tb = analysis.tables.find((x) => x.id === ref.tableId); const row = tb?.rows.find((x) => x.recordId === ref.recordId); return !!tb && !!row && (rowSite(tb, row, settings.sites) ?? '__none') === sid; })).length })).filter((x) => x.n);
  const sids = [...settings.sites.map((s) => s.id), '__none'];
  const sel = excBySite(site);
  const noSiteField = !ap.some((x) => ['site', 'costCenter', 'department'].some((f) => x.mapping[f])) && !ct.some((x) => x.mapping.site);
  return (
    <>
      <Card title={t('sites')} hint={tl({ en: 'Review of payments (AP) and contracts by Head Office and operating sites. Sites are matched from Site / Location / Cost center / Department values using configurable EN/AR keywords (Settings).', ar: 'مراجعة المدفوعات (الدائنين) والعقود حسب المركز الرئيسي والمواقع. تتم مطابقة المواقع من حقول الموقع / مركز التكلفة / الإدارة باستخدام كلمات مفتاحية قابلة للتعديل (الإعدادات).' })}>
        {(!ap.length && !ct.length) ? <Insufficient missing={[tl({ en: 'Accounts Payable and/or Contracts dataset not uploaded', ar: 'لم يتم رفع بيانات الدائنين و/أو العقود' })]} /> : noSiteField ? <Insufficient missing={[tl({ en: 'No Site / Cost center / Department field mapped in AP or Contracts — payments cannot be allocated to sites', ar: 'لا يوجد حقل موقع / مركز تكلفة / إدارة مرتبط — لا يمكن تخصيص المدفوعات للمواقع' })]} /> : (
          <div className="kpis">
            {sids.filter((s) => bySite[s] || s !== '__none').map((s) => {
              const e = bySite[s];
              return <button key={s} className={`kpi ${site === s ? 'accent' : ''}`} onClick={() => setSite(s)}>
                <div className="lbl bold">{name(s)}</div>
                {e ? <><div className="val" style={{ fontSize: 15 }}><Money m={e.pay} /></div><div className="note">{e.n} {lang === 'ar' ? 'فاتورة' : 'invoices'} · {e.paid} {lang === 'ar' ? 'مسددة' : 'paid'} · {e.cn} {lang === 'ar' ? 'عقد' : 'contracts'}{e.expired ? ` · ${e.expired} ${lang === 'ar' ? 'منتهي' : 'expired'}` : ''}</div><div className="note">{excBySite(s).reduce((a, x) => a + x.n, 0)} {t('exceptions')}</div></> : <div className="note">{tl({ en: 'No records allocated', ar: 'لا سجلات مخصصة' })}</div>}
              </button>;
            })}
          </div>
        )}
      </Card>
      {(ap.length > 0 || ct.length > 0) && !noSiteField && (
        <>
          <div className="grid g2">
            <Card title={<>{name(site)} — {t('exceptions')}</>}>
              {sel.length ? <Bars data={sel.map((x) => ({ key: x.r.testId, label: `${x.r.testId} ${tl(TEST_BY_ID[x.r.testId].name)}`, value: x.n }))} fmt={(v) => String(v)} onClick={(k) => setNav({ findingId: `F-${k}` })} /> : <p className="muted small">{tl({ en: 'No exceptions for this site in performed tests.', ar: 'لا استثناءات لهذا الموقع في الاختبارات المنفذة.' })}</p>}
              <p className="small muted"><Tag kind="calc" /> {tl({ en: 'Click a bar to open the finding and its evidence.', ar: 'انقر على العمود لفتح الملاحظة وأدلتها.' })}</p>
            </Card>
            <Card title={<>{name(site)} — {tl({ en: 'Payments by vendor', ar: 'المدفوعات حسب المورد' })}</>}>
              <Bars data={Object.entries(apRows.filter((r) => r.site === site).reduce<Record<string, number>>((m, r) => { m[`${r.vendor} (${r.cur})`] = (m[`${r.vendor} (${r.cur})`] ?? 0) + (r.amt ?? 0); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label, value }))} />
            </Card>
          </div>
          <Card title={<>{name(site)} — {tl({ en: 'Contracts', ar: 'العقود' })}</>}>
            <DataTable rows={ctRows.filter((r) => r.site === site)} csvName={`contracts-${site}`} empty={<p className="muted small">{tl({ en: 'No contracts allocated to this site.', ar: 'لا عقود مخصصة لهذا الموقع.' })}</p>} cols={[
              { key: 'id', label: tl({ en: 'Contract', ar: 'العقد' }) },
              { key: 'party', label: tl({ en: 'Counterparty', ar: 'الطرف المقابل' }) },
              { key: 'end', label: tl({ en: 'End date', ar: 'تاريخ الانتهاء' }) },
              { key: 'state', label: t('status'), render: (r) => <span className={`badge ${r.state === 'expired' ? 'fail' : r.state === 'expiring' ? 'warn' : r.state === 'active' ? 'pass' : ''}`}>{r.state}</span> },
              { key: 'value', label: tl({ en: 'Value', ar: 'القيمة' }), num: true, render: (r) => <span className="ltr">{fmtNum(r.value)} {r.cur}</span> },
              { key: 'billed', label: tl({ en: 'Billed', ar: 'المفوتر' }), num: true, render: (r) => <span className="ltr">{fmtNum(r.billed)}</span> },
              { key: 'pct', label: '%', num: true, value: (r) => (r.value && r.billed !== null ? Math.round(r.billed / r.value * 1000) / 10 : null) },
            ]} />
          </Card>
          <Card title={<>{name(site)} — {tl({ en: 'Payments', ar: 'المدفوعات' })}</>}>
            <DataTable rows={apRows.filter((r) => r.site === site)} csvName={`payments-${site}`} cols={[
              { key: 'vendor', label: t('party') }, { key: 'inv', label: tl({ en: 'Invoice', ar: 'الفاتورة' }) },
              { key: 'amt', label: tl({ en: 'Amount', ar: 'المبلغ' }), num: true, render: (r) => <span className="ltr">{fmtNum(r.amt)} {r.cur}</span> },
              { key: 'paid', label: tl({ en: 'Payment date', ar: 'تاريخ السداد' }) },
              { key: 'rid', label: t('chainRecord'), render: (r) => <span className="mono small">{r.rid}</span> },
            ]} />
          </Card>
        </>
      )}
    </>
  );
}

export function Recon() {
  const { t, tl, analysis, setNav } = useApp();
  const rec = TEST_LIBRARY.filter((x) => x.id.startsWith('REC-'));
  const bank = analysis.resultById['REC-08'];
  const p = bank.params ?? {};
  return (
    <>
      <Card title={t('recon')} hint={tl({ en: 'Classification: Matched / Unmatched / Partially matched / Missing / Duplicate / Unexplained difference. Control accounts are identified by account name or FS classification (shown per reconciliation).', ar: 'التصنيف: مطابق / غير مطابق / مطابق جزئيًا / مفقود / مكرر / فرق غير مفسر. تُحدد حسابات المراقبة من اسم الحساب أو تصنيف القوائم.' })}>
        <DataTable rows={rec.map((d) => ({ d, r: analysis.resultById[d.id] }))} csvName="reconciliations" onRow={(x) => x.r.exceptions.length && setNav({ findingId: `F-${x.d.id}` })} cols={[
          { key: 'id', label: 'ID', value: (x) => x.d.id, render: (x) => <span className="mono">{x.d.id}</span> },
          { key: 'n', label: tl({ en: 'Reconciliation', ar: 'المطابقة' }), value: (x) => tl(x.d.name) },
          { key: 's', label: t('status'), value: (x) => (x.r.status === 'insufficient' ? 'INSUFFICIENT DATA' : String(x.r.params?.status ?? (x.r.exceptions.length ? 'Unmatched' : 'Matched'))), render: (x) => (x.r.status === 'insufficient' ? <Insufficient missing={x.r.missing} /> : <QC s={x.r.exceptions.length ? 'WARNING' : 'PASS'} />) },
          { key: 'detail', label: tl({ en: 'Detail', ar: 'التفاصيل' }), value: (x) => Object.entries(x.r.params ?? {}).filter(([k]) => k !== 'status').map(([k, v]) => `${k}: ${typeof v === 'number' ? fmtNum(v) : v}`).join(' · ') },
          { key: 'e', label: t('exceptions'), value: (x) => x.r.exceptions.length, num: true },
        ]} />
      </Card>
      {bank.status === 'performed' && (
        <div className="grid g2">
          <Card title={tl({ en: 'Bank vs GL matching', ar: 'مطابقة البنك مع الأستاذ' })}>
            <Bars data={[{ label: tl({ en: 'Matched', ar: 'مطابق' }), value: +(p.matched ?? 0) }, { label: tl({ en: 'Partially matched', ar: 'مطابق جزئيًا' }), value: +(p.partial ?? 0) }, { label: tl({ en: 'Unmatched (bank)', ar: 'غير مطابق (بنك)' }), value: +(p.unmatchedBank ?? 0) }, { label: tl({ en: 'Unmatched (GL)', ar: 'غير مطابق (أستاذ)' }), value: +(p.unmatchedGL ?? 0) }]} fmt={(v) => String(v)} />
          </Card>
          <Card title={tl({ en: 'Reconciliation ageing (unmatched bank items)', ar: 'أعمار بنود التسوية (غير المطابقة)' })} hint={`as-of ${p.asOf ?? ''}`}>
            <Bars color="var(--series-2)" data={[{ label: '0–30', value: +(p.aging0_30 ?? 0) }, { label: '31–60', value: +(p.aging31_60 ?? 0) }, { label: '61–90', value: +(p.aging61_90 ?? 0) }, { label: '90+', value: +(p.aging90plus ?? 0) }]} fmt={(v) => String(v)} />
          </Card>
        </div>
      )}
    </>
  );
}

export function FinancialStatements() {
  const { t, tl, analysis, settings, go } = useApp();
  const fsa = analysis.fsa;
  if (!fsa.available) return <Card title={t('fs')}><Insufficient missing={[fsa.reason ?? '']} /><button className="btn" onClick={() => go('upload')}>{t('upload')}</button></Card>;
  const cats = (Object.keys(CAT_LABEL) as FsCat[]).filter((c) => fsa.totals[c].accounts);
  const ta = ['cash', 'receivables', 'inventory', 'otherCurrentAssets', 'nonCurrentAssets'].reduce((s, c) => s + Math.abs(fsa.totals[c as FsCat].current), 0);
  const rev = Math.abs(fsa.totals.revenue.current);
  return (
    <>
      <div className="banner info small"><Tag kind="asm" /> {tl({ en: 'Classification basis', ar: 'أساس التصنيف' })}: {fsa.classificationBasis}. {fsa.periodBasis && <>{tl({ en: 'Period', ar: 'الفترة' })}: {fsa.periodBasis}.</>}</div>
      <Card title={tl({ en: 'Ratio analysis', ar: 'تحليل النسب' })}>
        <DataTable rows={fsa.ratios} csvName="ratios" searchable={false} cols={[
          { key: 'n', label: tl({ en: 'Ratio', ar: 'النسبة' }), value: (r) => tl(r.name) },
          { key: 'v', label: tl({ en: 'Value', ar: 'القيمة' }), num: true, value: (r) => r.value, render: (r) => (r.value === null ? <span className="insufficient small">{r.missing}</span> : <b className="ltr">{fmtNum(r.value)} {r.unit === 'EGP' ? settings.baseCurrency : r.unit}</b>) },
          { key: 'f', label: <><Tag kind="calc" /> {tl({ en: 'Formula', ar: 'المعادلة' })}</>, value: (r) => r.formula, render: (r) => <span className="mono small">{r.formula}</span> },
          { key: 'i', label: tl({ en: 'Inputs', ar: 'المدخلات' }), value: (r) => r.inputs.map((x) => `${x.label}=${x.value ?? ''}`).join('; '), render: (r) => <span className="small ltr">{r.inputs.map((x) => `${x.label} = ${fmtNum(x.value)}`).join(' · ')}</span> },
        ]} />
      </Card>
      <div className="grid g2">
        <Card title={tl({ en: 'Vertical analysis — balance sheet (% of total assets)', ar: 'التحليل الرأسي — المركز المالي (% من إجمالي الأصول)' })}>
          <Bars data={cats.filter((c) => ['cash', 'receivables', 'inventory', 'otherCurrentAssets', 'nonCurrentAssets', 'currentLiabilities', 'debt', 'otherLiabilities', 'equity'].includes(c)).map((c) => ({ label: tl(CAT_LABEL[c]), value: ta ? Math.abs(fsa.totals[c].current) / ta * 100 : 0, tip: `${fmtNum(fsa.totals[c].current)} (${fsa.totals[c].accounts} accounts)` }))} fmt={(v) => `${v.toFixed(1)}%`} />
        </Card>
        <Card title={tl({ en: 'Vertical analysis — income statement (% of revenue)', ar: 'التحليل الرأسي — قائمة الدخل (% من الإيرادات)' })}>
          {rev ? <Bars color="var(--series-3)" data={cats.filter((c) => ['revenue', 'cogs', 'opex', 'depreciation', 'interest', 'taxExpense', 'otherIncome'].includes(c)).map((c) => ({ label: tl(CAT_LABEL[c]), value: Math.abs(fsa.totals[c].current) / rev * 100 }))} fmt={(v) => `${v.toFixed(1)}%`} /> : <Insufficient missing={['No revenue accounts classified']} />}
        </Card>
      </div>
      <Card title={tl({ en: 'Significant / unusual movements (horizontal analysis)', ar: 'الحركات الجوهرية / غير المعتادة (التحليل الأفقي)' })} hint={fsa.hasPrior ? tl({ en: 'Flag: |change| ≥ performance materiality, or |%| ≥ 25% above clearly trivial.', ar: 'الرصد: التغير ≥ الأهمية النسبية للتنفيذ أو النسبة ≥ 25% فوق الحد التافه.' }) : undefined}>
        {!fsa.hasPrior ? <Insufficient missing={[tl({ en: 'TB prior-period balance column not provided', ar: 'عمود رصيد الفترة السابقة غير متوفر بالميزان' })]} /> : (
          <DataTable rows={fsa.alerts} csvName="fs-movements" cols={[
            { key: 'account', label: t('account'), render: (r) => <span className="mono">{r.account}</span> },
            { key: 'name', label: tl({ en: 'Name', ar: 'الاسم' }) },
            { key: 'current', label: tl({ en: 'Current', ar: 'الحالية' }), num: true, render: (r) => <span className="ltr">{fmtNum(r.current)}</span> },
            { key: 'prior', label: tl({ en: 'Prior', ar: 'السابقة' }), num: true, render: (r) => <span className="ltr">{fmtNum(r.prior)}</span> },
            { key: 'change', label: tl({ en: 'Change', ar: 'التغير' }), num: true, render: (r) => <span className="ltr">{fmtNum(r.change)}</span> },
            { key: 'pct', label: '%', num: true },
            { key: 'materiality', label: tl({ en: 'Materiality', ar: 'الأهمية النسبية' }) },
            { key: 'risk', label: tl({ en: 'Risk', ar: 'المخاطر' }), value: (r) => tl(r.risk) },
            { key: 'explanation', label: <Tag kind="ai" />, value: (r) => tl(r.explanation), render: (r) => <span className="small">{tl(r.explanation)}</span> },
            { key: 'implication', label: tl({ en: 'Audit implication', ar: 'الأثر على المراجعة' }), value: (r) => tl(r.implication) },
          ]} />
        )}
      </Card>
    </>
  );
}

export function Fraud() {
  const { t, tl, analysis, setNav } = useApp();
  const list = useFindings().filter((f) => f.fraudIndicator);
  return (
    <>
      <div className="banner warn">{tl({ en: 'Items below are Fraud Risk Indicators / Suspicious Patterns that REQUIRE INVESTIGATION. An anomaly is not a conclusion of fraud; significant items must be validated by a human auditor.', ar: 'البنود أدناه مؤشرات مخاطر احتيال / أنماط مثيرة للشك تتطلب التحقيق. الشذوذ ليس استنتاجًا بوقوع احتيال؛ ويجب أن يتحقق المراجع من البنود الجوهرية.' })}</div>
      <div className="kpis">
        <Kpi accent label={t('fraudIndicators')} value={list.length} />
        <Kpi label={tl({ en: 'Fraud tests performed', ar: 'اختبارات الاحتيال المنفذة' })} value={`${TEST_LIBRARY.filter((x) => x.fraud && analysis.resultById[x.id].status === 'performed').length}/${TEST_LIBRARY.filter((x) => x.fraud).length}`} />
        <Kpi label={t('exceptions')} value={list.reduce((s, f) => s + f.exceptionCount, 0)} />
      </div>
      <Card title={t('fraud')}>
        <DataTable rows={TEST_LIBRARY.filter((x) => x.fraud)} csvName="fraud-analytics" onRow={(d) => analysis.findingById[`F-${d.id}`] && setNav({ findingId: `F-${d.id}` })} cols={[
          { key: 'id', label: 'ID', render: (d) => <span className="mono">{d.id}</span> },
          { key: 'n', label: tl({ en: 'Indicator', ar: 'المؤشر' }), value: (d) => tl(d.name) },
          { key: 's', label: t('status'), value: (d) => analysis.resultById[d.id].status, render: (d) => (analysis.resultById[d.id].status === 'performed' ? (analysis.resultById[d.id].exceptions.length ? <span className="badge fail">{tl({ en: 'Requires investigation', ar: 'يتطلب التحقيق' })}</span> : <span className="badge pass">✓ {tl({ en: 'No pattern found', ar: 'لا يوجد نمط' })}</span>) : <span className="insufficient small">{analysis.resultById[d.id].missing[0]}</span>) },
          { key: 'e', label: t('exceptions'), num: true, value: (d) => analysis.resultById[d.id].exceptions.length },
          { key: 'x', label: t('exposure'), value: (d) => Object.values(analysis.findingById[`F-${d.id}`]?.exposure ?? {}).reduce((a, b) => a + b, 0), render: (d) => <Money m={analysis.findingById[`F-${d.id}`]?.exposure} />, num: true },
          { key: 'r', label: t('rating'), render: (d) => (analysis.findingById[`F-${d.id}`] ? <Sev s={analysis.findingById[`F-${d.id}`].rating} /> : '') },
        ]} />
      </Card>
    </>
  );
}
