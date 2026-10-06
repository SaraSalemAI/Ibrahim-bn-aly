// Export utilities: CSV, Excel workbook (26 sheets), evidence packages. PDF uses the browser's print engine
// (print-optimized report view) so Arabic shaping and RTL render correctly.
import type { Analysis } from './engine/analysis';
import type { ActionItem, AuditLogEntry, Cell, Finding, L, Lang, Settings, SourceTable } from './engine/types';
import { TEST_BY_ID } from './engine/tests';
import { RISK_BY_ID, CONTROL_BY_ID, AREA_LABEL } from './engine/library';
import { buildInsights } from './engine/insights';
import { fieldDef } from './engine/schema';
import { mask } from './engine/values';
import { CAT_LABEL } from './engine/fsa';

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(header: string[], rows: unknown[][]) { return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'); }
export function downloadCsv(name: string, header: string[], rows: unknown[][]) { downloadBlob(name.endsWith('.csv') ? name : `${name}.csv`, new Blob([toCsv(header, rows)], { type: 'text/csv;charset=utf-8' })); }

const tl = (l: L | undefined, lang: Lang) => (l ? l[lang] || l.en : '');
const money = (m: Record<string, number>) => Object.entries(m).map(([c, v]) => `${Math.round(v * 100) / 100} ${c}`).join(' + ');
const INS = 'INSUFFICIENT DATA — TEST NOT PERFORMED';

export function findRow(a: Analysis, tableId: string, recordId: string) {
  const t = a.tables.find((x) => x.id === tableId);
  return { t, row: t?.rows.find((r) => r.recordId === recordId) };
}

function displayValue(t: SourceTable, header: string, v: Cell, unmask: boolean): Cell {
  const field = Object.entries(t.mapping).find(([, h]) => h === header)?.[0];
  if (!unmask && field && fieldDef(t.datasetType, field)?.sensitive && v !== null && v !== '') return mask(String(v));
  return v;
}

/** Evidence rows for a finding, flattened (one line per source row). */
export function evidenceRows(a: Analysis, f: Finding, unmask: boolean, lang: Lang) {
  const r = a.resultById[f.testId];
  const def = TEST_BY_ID[f.testId];
  const out: Cell[][] = [];
  r.exceptions.forEach((e, i) => {
    for (const ref of e.rows) {
      const { t, row } = findRow(a, ref.tableId, ref.recordId);
      const hl = e.highlight[ref.recordId] ?? [];
      const vals = t && row ? hl.map((fk) => `${fk}=${displayValue(t, t.mapping[fk], row.values[t.mapping[fk]] ?? null, unmask)}`).join('; ') : '';
      out.push([f.id, def.id, tl(def.name, lang), i + 1, tl(e.description, lang), e.calc.formula, e.calc.inputs.map((x) => `${typeof x.label === 'string' ? x.label : tl(x.label, lang)}=${x.value}`).join('; '), String(e.calc.result ?? ''), e.money ? `${e.money.amount} ${e.money.currency}` : '', t?.fileName ?? 'MISSING', t?.sheet ?? '', row?.rowNumber ?? '', ref.recordId, vals]);
    }
  });
  return out;
}
export const EVIDENCE_HEADER = ['Finding ID', 'Test ID', 'Test', 'Exception #', 'Exception', 'Formula', 'Inputs', 'Result', 'Amount', 'Source file', 'Sheet/Table', 'Row', 'Source record ID', 'Highlighted fields'];

async function newWb() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SUMED Internal Audit Platform'; wb.created = new Date();
  return wb;
}
type WB = Awaited<ReturnType<typeof newWb>>;
function sheet(wb: WB, name: string, header: string[], rows: unknown[][], rtl: boolean) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1, rightToLeft: rtl }] });
  ws.addRow(header);
  const h = ws.getRow(1); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } };
  if (!rows.length) ws.addRow([INS]);
  for (const r of rows) ws.addRow(r.map((v) => (v === undefined ? null : v)));
  ws.columns.forEach((c, i) => { c.width = Math.min(60, Math.max(10, header[i]?.length ?? 10, ...rows.slice(0, 200).map((r) => String(r[i] ?? '').length))); });
  return ws;
}

export async function buildWorkbook(a: Analysis, s: Settings, lang: Lang, log: AuditLogEntry[], actions: ActionItem[], unmask: boolean, plan: Record<string, { planned?: string; auditor?: string; hours?: number; status?: string }> = {}): Promise<Blob> {
  const wb = await newWb();
  const rtl = lang === 'ar';
  const ins = buildInsights(a, s);
  const res = (prefix: string[]) => a.results.filter((r) => prefix.some((p) => r.testId.startsWith(p)));
  const testSheet = (name: string, prefixes: string[]) => sheet(wb, name, ['Test ID', 'Test', 'Status', 'Population', 'Exceptions', 'Exception', 'Formula', 'Result', 'Amount', 'Source rows'],
    res(prefixes).flatMap((r) => r.status === 'insufficient' ? [[r.testId, tl(TEST_BY_ID[r.testId].name, lang), INS, '', '', r.missing.join('; '), '', '', '', '']] : r.exceptions.length ? r.exceptions.map((e) => [r.testId, tl(TEST_BY_ID[r.testId].name, lang), 'Performed', r.population, r.exceptions.length, tl(e.description, lang), e.calc.formula, String(e.calc.result ?? ''), e.money ? `${e.money.amount} ${e.money.currency}` : '', e.rows.map((x) => x.recordId).join(' ')]) : [[r.testId, tl(TEST_BY_ID[r.testId].name, lang), 'Performed — no exceptions', r.population, 0, '', '', '', '', '']]), rtl);

  sheet(wb, '1 Executive Dashboard', ['Metric', 'Value'], [
    ['Platform quality check', a.qcStatus], ['Data quality score', a.quality.score ?? INS], ['Findings', a.findings.length], ['Critical', a.findings.filter((f) => f.rating === 'critical').length], ['High', a.findings.filter((f) => f.rating === 'high').length],
    ['Fraud risk indicators (require investigation)', a.findings.filter((f) => f.fraudIndicator).length], ['Tests performed', a.results.filter((r) => r.status === 'performed').length], ['Tests not performed (insufficient data)', a.results.filter((r) => r.status === 'insufficient').length],
    ...ins.topFindings.map((f, i) => [`Top finding ${i + 1}`, `${f.id} [${f.rating}] ${tl(f.title, lang)} — ${money(f.exposure)}`]),
  ], rtl);
  sheet(wb, '2 Audit Universe', ['Area', 'Score', 'Rating', 'Findings', 'Tests not performed', 'Rows', ...Object.keys(a.universe[0]?.factors ?? {})], a.universe.map((u) => [tl(u.label, lang), u.score ?? INS, u.rating, u.findings, u.insufficient, u.rows, ...Object.values(u.factors).map((v) => (v === null ? '' : Math.round(v * 100) / 100))]), rtl);
  sheet(wb, '3 Risk Register', ['Risk ID', 'Category', 'Risk', 'Description', 'Cause', 'Impact', 'Likelihood', 'Impact score', 'Inherent', 'Residual', 'Controls', 'Risk owner', 'Control owner', 'Exposure', 'Recommended action', 'Due date', 'Status', 'Basis'],
    a.risks.map((r) => [r.def.id, r.def.category, tl(r.def.title, lang), tl(r.def.description, lang), tl(r.def.cause, lang), tl(r.def.impact, lang), r.likelihood ?? INS, r.impact ?? INS, r.inherent, r.residual, r.controls.join(', '), r.owner, r.controlOwner, money(r.exposure), tl(r.recommendedAction ?? undefined, lang), r.dueDate, r.status, tl(r.basis, lang)]), rtl);
  sheet(wb, '4 Control Register', ['Control ID', 'Category', 'Process', 'Risk', 'Objective', 'Description', 'Owner', 'Frequency', 'Evidence required', 'Testing procedure', 'Tests', 'Exceptions', 'Score', 'Rating', 'Repeat'],
    a.controls.map((c) => [c.def.id, c.def.category, tl(c.def.process, lang), c.def.riskId, tl(c.def.objective, lang), tl(c.def.description, lang), c.owner, tl(c.def.frequency, lang), tl(c.def.evidence, lang), tl(c.def.procedure, lang), c.tests.join(', '), c.exceptions, c.score ?? 'Not tested', c.rating, c.repeat ? 'Yes' : 'No']), rtl);
  sheet(wb, '5 Audit Plan', ['Priority', 'Audit area', 'Risk score', 'Rating', 'Planned date', 'Auditor', 'Hours', 'Status', 'Findings', 'Data gaps'], a.universe.map((u, i) => [i + 1, tl(u.label, lang), u.score ?? INS, u.rating, plan[u.area]?.planned ?? '', plan[u.area]?.auditor ?? '', plan[u.area]?.hours ?? '', plan[u.area]?.status ?? '', u.findings, u.insufficient]), rtl);
  testSheet('6 GL Analytics', ['REC-01']);
  testSheet('7 Journal Testing', ['GL-']);
  testSheet('8 AP Testing', ['AP-', 'ST-01']);
  testSheet('9 AR Testing', ['AR-']);
  testSheet('10 Bank Testing', ['TR-']);
  testSheet('11 Reconciliation', ['REC-']);
  testSheet('12 Fixed Assets', ['FA-']);
  testSheet('13 Inventory', ['IN-']);
  testSheet('14 Procurement', ['PR-', 'CT-', 'ST-']);
  testSheet('15 Payroll', ['PY-']);
  testSheet('16 CAPEX', ['CX-']);
  testSheet('17 OPEX', ['BU-', 'OX-']);
  testSheet('18 Tax', ['TX-', 'REC-09']);
  sheet(wb, '19 Fraud Analytics', ['Finding ID', 'Indicator', 'Rating', 'Exceptions', 'Exposure', 'Label'], a.findings.filter((f) => f.fraudIndicator).map((f) => [f.id, tl(f.title, lang), f.rating, f.exceptionCount, money(f.exposure), 'Fraud Risk Indicator — Requires Investigation']), rtl);
  testSheet('20 Budget Variance', ['BU-', 'CX-', 'OX-']);
  sheet(wb, '21 Findings', ['Finding ID', 'Area', 'Title', 'Risk', 'Control', 'Condition', 'Criteria', 'Cause (AI interpretation)', 'Effect', 'Rating', 'Rating basis', 'Exposure', 'Exceptions', 'Population', 'Evidence status', 'AI confidence', 'Owner', 'Due date', 'Status'],
    a.findings.map((f) => [f.id, tl(AREA_LABEL[f.area], lang), tl(f.title, lang), `${f.riskId} ${tl(RISK_BY_ID[f.riskId]?.title, lang)}`, `${f.controlId} ${tl(CONTROL_BY_ID[f.controlId]?.objective, lang)}`, tl(f.condition, lang), tl(f.criteria, lang), tl(f.cause, lang), tl(f.effect, lang), f.rating, tl(f.ratingBasis, lang), money(f.exposure), f.exceptionCount, f.population, f.evidenceStatus, f.confidence, f.owner, f.dueDate, f.status]), rtl);
  sheet(wb, '22 Recommendations', ['Rec ID', 'Finding', 'Risk', 'Root cause', 'Action', 'Expected benefit', 'Control improvement', 'Owner', 'Priority', 'Target date', 'Effort (estimate)', 'Score', 'Status'],
    a.recommendations.map((r) => [r.id, r.findingId, r.riskId, tl(r.rootCause, lang), tl(r.action, lang), tl(r.benefit, lang), tl(r.controlImprovement, lang), r.owner, r.priority, r.targetDate, r.effort, r.score, r.status]), rtl);
  sheet(wb, '23 Management Actions', ['Action ID', 'Finding', 'Recommendation', 'Owner', 'Department', 'Due date', 'Priority', 'Status', 'Completion %', 'Evidence', 'Validation', 'Closure date', 'Overdue'],
    actions.map((x) => [x.id, x.findingId, x.recommendationId, x.owner, x.department, x.dueDate, x.priority, x.status, x.completion, x.evidence, x.validation, x.closureDate, x.status !== 'closed' && x.dueDate && x.dueDate < a.today ? 'OVERDUE' : '']), rtl);
  sheet(wb, '24 Evidence', EVIDENCE_HEADER, a.findings.flatMap((f) => evidenceRows(a, f, unmask, lang)), rtl);
  sheet(wb, '25 Data Quality', ['File', 'Sheet', 'Dataset', 'Rows', 'Score', 'Completeness %', 'Duplicate %', 'Invalid', 'Missing required', 'Unbalanced journals', 'Unmapped accounts', 'Currency issues', 'Date anomalies', 'Negative', 'Outliers'],
    a.quality.tables.map((q) => [q.fileName, q.sheet, q.datasetType, q.rows, q.score, q.completeness, q.duplicatePct, q.invalidRecords, q.missingRequired.join(', '), q.unbalancedJournals, q.unmappedAccounts ?? 'n/a', q.currencyIssues, q.dateAnomalies, q.negativeBalances, q.outliers]), rtl);
  sheet(wb, '26 Audit Trail', ['Seq', 'Timestamp', 'User', 'Role', 'Action', 'Target', 'Detail', 'Hash'], log.map((e) => [e.seq, e.ts, e.user, e.role, e.action, e.target, e.detail, e.hash]), rtl);
  // Financial statement analytics appendix
  sheet(wb, 'FS Ratios', ['Ratio', 'Formula', 'Value', 'Unit', 'Inputs', 'Note'], a.fsa.ratios.map((r) => [tl(r.name, lang), r.formula, r.value ?? INS, r.unit, r.inputs.map((x) => `${x.label}=${x.value ?? ''}`).join('; '), r.missing ?? '']), rtl);
  sheet(wb, 'FS Movements', ['Account', 'Name', 'Category', 'Current', 'Prior', 'Change', '%', 'Materiality', 'Risk', 'Explanation', 'Audit implication'], a.fsa.alerts.map((x) => [x.account, x.name, tl(CAT_LABEL[x.cat], lang), x.current, x.prior, x.change, x.pct, x.materiality, tl(x.risk, lang), tl(x.explanation, lang), tl(x.implication, lang)]), rtl);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function evidencePackageXlsx(a: Analysis, f: Finding, lang: Lang, unmask: boolean, user: string, notes: string): Promise<Blob> {
  const wb = await newWb();
  const def = TEST_BY_ID[f.testId];
  const rec = a.recommendations.find((r) => r.findingId === f.id);
  sheet(wb, 'Finding', ['Field', 'Value'], [
    ['Finding ID', f.id], ['Title', tl(f.title, lang)], ['Area', tl(AREA_LABEL[f.area], lang)], ['Risk', `${f.riskId} ${tl(RISK_BY_ID[f.riskId]?.title, lang)}`], ['Control', `${f.controlId} ${tl(CONTROL_BY_ID[f.controlId]?.objective, lang)}`],
    ['Condition (SOURCE DATA + CALCULATION)', tl(f.condition, lang)], ['Criteria', tl(f.criteria, lang)], ['Cause (AI INTERPRETATION — to be confirmed)', tl(f.cause, lang)], ['Effect', tl(f.effect, lang)],
    ['Rating (RISK ASSESSMENT)', f.rating], ['Rating basis', tl(f.ratingBasis, lang)], ['Exposure', money(f.exposure)], ['AI confidence', `${f.confidence} — ${tl(f.confidenceBasis, lang)}`], ['Evidence status', f.evidenceStatus],
    ...f.evidenceChecks.map((c) => [`Check: ${tl(c.label, lang)}`, `${c.pass ? 'PASS' : 'FAIL'}${c.note ? ' — ' + tl(c.note, lang) : ''}`]),
    ['Audit test', `${def.id} ${tl(def.name, lang)}`], ['Test objective', tl(def.objective, lang)], ['Audit rule', tl(def.rule, lang)],
    ['Recommendation', tl(rec?.action, lang)], ['Auditor notes', notes], ['Status', f.status], ['Exported by', user], ['Timestamp', new Date().toISOString()],
  ], lang === 'ar');
  sheet(wb, 'Evidence', EVIDENCE_HEADER, evidenceRows(a, f, unmask, lang), lang === 'ar');
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function fileStamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); }
