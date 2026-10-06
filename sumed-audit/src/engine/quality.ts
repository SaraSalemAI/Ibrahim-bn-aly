import { DATASET_BY_TYPE } from './schema';
import type { L, RowRef, SourceTable } from './types';
import { accessor, num, isoDate, text } from './values';

export interface DQIssue { kind: string; label: L; count: number; sample: RowRef[] }

export interface TableQuality {
  tableId: string;
  fileName: string;
  sheet: string;
  datasetType: string;
  rows: number;
  completeness: number; // %
  duplicatePct: number;
  invalidRecords: number;
  missingRequired: string[];
  missingRecommended: string[];
  unbalancedJournals: number;
  unmappedAccounts: number | null;
  currencyIssues: number;
  dateAnomalies: number;
  negativeBalances: number;
  outliers: number;
  totalsCheck: { label: L; pass: boolean | null; detail: string }[];
  score: number;
  issues: DQIssue[];
}

export interface QualityReport {
  tables: TableQuality[];
  score: number | null;
  completeness: number | null;
  duplicatePct: number | null;
  invalidRecords: number;
  unbalancedJournals: number;
  unmappedAccounts: number;
  currencyIssues: number;
  dateAnomalies: number;
  negativeBalances: number;
  outliers: number;
  criticalFailures: string[];
}

const NEG_NOT_EXPECTED: Record<string, string[]> = {
  inventory: ['quantity', 'unitCost'],
  fa: ['cost', 'nbv'],
  payroll: ['gross', 'net'],
  ar: ['outstanding'],
};

const CURRENCY_RE = /^[A-Z]{3}$/;

export function assessTable(t: SourceTable, coaAccounts: Set<string> | null, today = new Date().toISOString().slice(0, 10)): TableQuality {
  const def = DATASET_BY_TYPE[t.datasetType];
  const a = accessor(t);
  const issues: DQIssue[] = [];
  const add = (kind: string, label: L, refs: RowRef[]) => { if (refs.length) issues.push({ kind, label, count: refs.length, sample: refs.slice(0, 50) }); };
  const ref = (recordId: string): RowRef => ({ tableId: t.id, recordId });
  const mapped = Object.keys(t.mapping);
  const missingRequired = def ? def.required.filter((r) => !t.mapping[r]) : [];
  const missingRecommended = def ? def.fields.map((f) => f.key).filter((k) => !t.mapping[k] && !def.required.includes(k)) : [];

  // Completeness across mapped fields
  let filled = 0, cells = 0;
  const blankRequired: RowRef[] = [];
  for (const r of t.rows) {
    for (const f of mapped) { cells++; if (text(r.values[t.mapping[f]]) !== '') filled++; }
    if (def && def.required.some((k) => t.mapping[k] && text(r.values[t.mapping[k]]) === '')) blankRequired.push(ref(r.recordId));
  }
  add('blank-required', { en: 'Rows with blank required fields', ar: 'سجلات بها حقول إلزامية فارغة' }, blankRequired);
  const completeness = cells ? (filled / cells) * 100 : 0;

  // Duplicates: identical full rows
  const seen = new Map<string, string>();
  const dups: RowRef[] = [];
  for (const r of t.rows) {
    const k = JSON.stringify(t.headers.map((h) => r.values[h]));
    if (seen.has(k)) dups.push(ref(r.recordId)); else seen.set(k, r.recordId);
  }
  add('duplicate-rows', { en: 'Exact duplicate rows', ar: 'سجلات مكررة بالكامل' }, dups);

  // Type validity
  const invalid: RowRef[] = [];
  const dateAnom: RowRef[] = [];
  if (def) {
    for (const r of t.rows) {
      let bad = false;
      for (const fd of def.fields) {
        const h = t.mapping[fd.key];
        if (!h) continue;
        const v = r.values[h];
        if (v === null || v === '') continue;
        if (fd.kind === 'number' && num(v) === null) bad = true;
        if (fd.kind === 'date') {
          const d = isoDate(v);
          if (!d) bad = true;
          else if (d < '1990-01-01' || d > addYears(today, 1)) dateAnom.push(ref(r.recordId));
        }
      }
      if (t.datasetType === 'gl') {
        const jd = a.d(r, 'date'), pd = a.d(r, 'postingDate');
        if (jd && pd && pd < jd) dateAnom.push(ref(r.recordId));
      }
      if (bad) invalid.push(ref(r.recordId));
    }
  }
  add('invalid-type', { en: 'Invalid numbers or dates', ar: 'أرقام أو تواريخ غير صالحة' }, invalid);
  add('date-anomaly', { en: 'Date anomalies (out of range or posting before journal date)', ar: 'تواريخ غير منطقية (خارج النطاق أو ترحيل قبل تاريخ القيد)' }, dateAnom);

  // Currency consistency
  const curIssues: RowRef[] = [];
  if (a.has('currency')) {
    for (const r of t.rows) {
      const c = a.t(r, 'currency').toUpperCase();
      if (c && !CURRENCY_RE.test(c)) curIssues.push(ref(r.recordId));
      else if (c && a.has('egp') === false && c !== 'EGP' && t.datasetType !== 'bank') curIssues.push(ref(r.recordId));
    }
  }
  add('currency', { en: 'Currency inconsistencies (invalid code or foreign currency without EGP equivalent)', ar: 'عدم اتساق العملة (رمز غير صالح أو عملة أجنبية بدون معادل بالجنيه)' }, curIssues);

  // Negative values where not expected
  const negs: RowRef[] = [];
  for (const f of NEG_NOT_EXPECTED[t.datasetType] ?? []) {
    if (!a.has(f)) continue;
    for (const r of t.rows) { const v = a.n(r, f); if (v !== null && v < 0) negs.push(ref(r.recordId)); }
  }
  add('negative', { en: 'Negative balances where not expected', ar: 'أرصدة سالبة في غير موضعها' }, negs);

  // Outliers: robust z-score (median/MAD) on the main amount field
  const amtField = ['amount', 'debit', 'net', 'cost', 'totalValue', 'actual', 'closing', 'taxAmount', 'outstanding'].find((f) => a.has(f));
  const outl: RowRef[] = [];
  if (amtField) {
    const vals = t.rows.map((r) => ({ r, v: a.n(r, amtField) })).filter((x) => x.v !== null && x.v !== 0) as { r: typeof t.rows[number]; v: number }[];
    if (vals.length >= 20) {
      const sorted = vals.map((x) => Math.abs(x.v)).sort((p, q) => p - q);
      const med = sorted[Math.floor(sorted.length / 2)];
      const mad = [...sorted.map((v) => Math.abs(v - med))].sort((p, q) => p - q)[Math.floor(sorted.length / 2)] || 0;
      if (mad > 0) for (const x of vals) if ((Math.abs(x.v) - med) / (1.4826 * mad) > 6) outl.push(ref(x.r.recordId));
    }
  }
  add('outlier', { en: `Statistical outliers on ${amtField ?? 'amount'} (robust z > 6)`, ar: `قيم شاذة إحصائيًا في ${amtField ?? 'المبلغ'}` }, outl);

  // GL: unbalanced journals and unmapped accounts
  let unbalanced = 0;
  let unmapped: number | null = null;
  const totals: TableQuality['totalsCheck'] = [];
  if (t.datasetType === 'gl' && a.has('debit') && a.has('credit')) {
    const byJ = new Map<string, { d: number; c: number; refs: RowRef[] }>();
    let td = 0, tc = 0;
    for (const r of t.rows) {
      const j = a.t(r, 'journalId'); if (!j) continue;
      const e = byJ.get(j) ?? { d: 0, c: 0, refs: [] };
      const d = a.n(r, 'debit') ?? 0, c = a.n(r, 'credit') ?? 0;
      e.d += d; e.c += c; td += d; tc += c; e.refs.push(ref(r.recordId)); byJ.set(j, e);
    }
    const ub: RowRef[] = [];
    for (const e of byJ.values()) if (Math.abs(e.d - e.c) > 0.005) { unbalanced++; ub.push(...e.refs); }
    add('unbalanced', { en: 'Rows in unbalanced journals', ar: 'سجلات ضمن قيود غير متوازنة' }, ub);
    totals.push({ label: { en: 'Total debits = total credits', ar: 'إجمالي المدين = إجمالي الدائن' }, pass: Math.abs(td - tc) < 0.01, detail: `${td.toFixed(2)} vs ${tc.toFixed(2)}` });
  }
  if (t.datasetType === 'tb' && a.has('debit') && a.has('credit')) {
    let td = 0, tc = 0;
    for (const r of t.rows) { td += a.n(r, 'debit') ?? 0; tc += a.n(r, 'credit') ?? 0; }
    totals.push({ label: { en: 'TB debits = TB credits', ar: 'مدين الميزان = دائن الميزان' }, pass: Math.abs(td - tc) < 0.01, detail: `${td.toFixed(2)} vs ${tc.toFixed(2)}` });
  }
  if (t.datasetType === 'tb' && a.has('opening') && a.has('debit') && a.has('credit')) {
    const bad: RowRef[] = [];
    for (const r of t.rows) {
      const o = a.n(r, 'opening'), d = a.n(r, 'debit'), c = a.n(r, 'credit'), cl = a.n(r, 'closing');
      if (o !== null && d !== null && c !== null && cl !== null && Math.abs(o + d - c - cl) > 0.01) bad.push(ref(r.recordId));
    }
    add('tb-roll', { en: 'TB rows where Opening + Debit − Credit ≠ Closing', ar: 'سجلات بالميزان لا يتحقق فيها الافتتاحي + المدين − الدائن = الختامي' }, bad);
    totals.push({ label: { en: 'TB roll-forward per account', ar: 'تسلسل أرصدة الميزان' }, pass: bad.length === 0, detail: `${bad.length} exceptions` });
  }
  if (t.datasetType === 'fa' && a.has('cost') && a.has('accDep') && a.has('nbv')) {
    const bad: RowRef[] = [];
    for (const r of t.rows) {
      const c = a.n(r, 'cost'), d = a.n(r, 'accDep'), n = a.n(r, 'nbv');
      if (c !== null && d !== null && n !== null && Math.abs(c - Math.abs(d) - n) > 0.01) bad.push(ref(r.recordId));
    }
    add('fa-nbv', { en: 'Assets where Cost − Accumulated Depreciation ≠ NBV', ar: 'أصول لا يتحقق فيها التكلفة − مجمع الإهلاك = صافي القيمة' }, bad);
    totals.push({ label: { en: 'FAR: Cost − AccDep = NBV', ar: 'سجل الأصول: التكلفة − مجمع الإهلاك = الصافي' }, pass: bad.length === 0, detail: `${bad.length} exceptions` });
  }
  if ((t.datasetType === 'gl' || t.datasetType === 'tb') && coaAccounts && a.has('account')) {
    const um: RowRef[] = [];
    for (const r of t.rows) { const ac = a.t(r, 'account'); if (ac && !coaAccounts.has(ac)) um.push(ref(r.recordId)); }
    unmapped = um.length;
    add('unmapped-account', { en: 'Accounts not found in Chart of Accounts', ar: 'حسابات غير موجودة في دليل الحسابات' }, um);
  }

  const n = t.rows.length || 1;
  const validity = 1 - invalid.length / n;
  const uniqueness = 1 - dups.length / n;
  const consistency = 1 - Math.min(1, (curIssues.length + dateAnom.length + (unmapped ?? 0)) / n);
  const reqPenalty = def ? missingRequired.length / def.required.length : 1;
  const score = Math.max(0, Math.round(((completeness / 100) * 40 + validity * 25 + uniqueness * 15 + consistency * 20) * (1 - reqPenalty * 0.6)));

  return {
    tableId: t.id, fileName: t.fileName, sheet: t.sheet, datasetType: t.datasetType, rows: t.rows.length,
    completeness: round1(completeness), duplicatePct: round1((dups.length / n) * 100), invalidRecords: invalid.length,
    missingRequired, missingRecommended, unbalancedJournals: unbalanced, unmappedAccounts: unmapped,
    currencyIssues: curIssues.length, dateAnomalies: dateAnom.length, negativeBalances: negs.length, outliers: outl.length,
    totalsCheck: totals, score, issues,
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
function addYears(iso: string, y: number) { return `${+iso.slice(0, 4) + y}${iso.slice(4)}`; }

export function assessQuality(tables: SourceTable[]): QualityReport {
  const coa = tables.filter((t) => t.datasetType === 'coa');
  let coaSet: Set<string> | null = null;
  if (coa.length) {
    coaSet = new Set();
    for (const t of coa) { const a = accessor(t); for (const r of t.rows) { const ac = a.t(r, 'account'); if (ac) coaSet.add(ac); } }
  }
  const tq = tables.filter((t) => t.datasetType !== 'unknown').map((t) => assessTable(t, coaSet));
  const rows = tq.reduce((s, x) => s + x.rows, 0);
  const w = (k: keyof TableQuality) => rows ? tq.reduce((s, x) => s + (x[k] as number) * x.rows, 0) / rows : null;
  const sum = (k: keyof TableQuality) => tq.reduce((s, x) => s + ((x[k] as number | null) ?? 0), 0);
  const critical: string[] = [];
  for (const x of tq) {
    if (x.missingRequired.length) critical.push(`${x.fileName} / ${x.sheet}: missing required fields ${x.missingRequired.join(', ')}`);
    if (x.unbalancedJournals) critical.push(`${x.fileName} / ${x.sheet}: ${x.unbalancedJournals} unbalanced journal(s)`);
    for (const tc of x.totalsCheck) if (tc.pass === false) critical.push(`${x.fileName} / ${x.sheet}: ${tc.label.en} failed (${tc.detail})`);
  }
  return {
    tables: tq,
    score: w('score') === null ? null : Math.round(w('score')!),
    completeness: w('completeness') === null ? null : round1(w('completeness')!),
    duplicatePct: w('duplicatePct') === null ? null : round1(w('duplicatePct')!),
    invalidRecords: sum('invalidRecords'), unbalancedJournals: sum('unbalancedJournals'), unmappedAccounts: sum('unmappedAccounts'),
    currencyIssues: sum('currencyIssues'), dateAnomalies: sum('dateAnomalies'), negativeBalances: sum('negativeBalances'), outliers: sum('outliers'),
    criticalFailures: critical,
  };
}
