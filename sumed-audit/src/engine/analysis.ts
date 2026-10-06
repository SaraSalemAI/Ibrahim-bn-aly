// Analysis orchestrator: filters → data quality → audit tests → findings → evidence validation →
// recommendations → risks → controls → audit universe → change monitor → quality check → insights.
import type { ActionItem, AuditArea, EvidenceCheck, Filters, Finding, FindingStatus, L, Settings, Severity, Snapshot, SourceFile, SourceRow, SourceTable, TestResult } from './types';
import { TEST_LIBRARY, TEST_BY_ID, type TestDef } from './tests';
import { assessQuality, type QualityReport } from './quality';
import { analyseFS, type FsaResult } from './fsa';
import { RISKS, CONTROLS, AREAS, CONTROL_BY_ID, RISK_BY_ID, type RiskDef, type ControlDef } from './library';
import { UNIVERSE_FACTORS } from './defaults';
import { accessor, norm } from './values';
import { rowSite } from './sites';
import { DATASETS } from './schema';

export interface FindingOverride { status?: FindingStatus; owner?: string; dueDate?: string; notes?: string; reviewedBy?: string; validatedBy?: string }
export interface RiskMeta { owner?: string; controlOwner?: string; dueDate?: string; status?: string }

export interface AnalysisInput {
  files: SourceFile[];
  settings: Settings;
  filters: Filters;
  overrides: Record<string, FindingOverride>;
  riskMeta: Record<string, RiskMeta>;
  controlMeta: Record<string, { owner?: string }>;
  actions: ActionItem[];
  snapshots: Snapshot[];
  today?: string;
}

export interface Recommendation {
  id: string; findingId: string; riskId: string; rootCause: L; action: L; benefit: L; controlImprovement: L;
  owner: string; priority: 'immediate' | 'short' | 'medium' | 'long'; targetDate: string; effort: 'Low' | 'Medium' | 'High';
  status: string; score: number; rating: Severity;
}

export interface RiskRow {
  def: RiskDef; likelihood: number | null; impact: number | null; residualScore: number | null; residual: Severity | 'na';
  inherentScore: number | null; inherent: Severity | 'na'; exposure: Record<string, number>; exceptionRate: number | null;
  tests: string[]; performed: number; findings: string[]; controls: string[]; basis: L; owner: string; controlOwner: string; dueDate: string; status: string; recommendedAction: L | null;
}

export interface ControlRow {
  def: ControlDef; tests: string[]; performed: number; exceptions: number; population: number; exceptionRate: number | null;
  maxSeverity: Severity | null; repeat: boolean; design: number | null; operating: number | null; remediation: number | null;
  score: number | null; rating: 'effective' | 'needs-improvement' | 'ineffective' | 'not-tested'; components: { label: string; value: number | null; weight: number }[];
  findings: string[]; owner: string;
}

export interface UniverseRow { area: AuditArea; label: L; factors: Record<string, number | null>; score: number | null; rating: 'high' | 'medium' | 'low' | 'na'; findings: number; insufficient: number; rows: number }

export interface ChangeMonitor {
  baseline: Snapshot | null;
  newExceptions: { testId: string; keys: string[] }[];
  repeatExceptions: { testId: string; keys: string[] }[];
  resolvedExceptions: { testId: string; keys: string[] }[];
  newEntities: Record<string, string[]>;
}

export interface QCCheck { id: string; label: L; status: 'PASS' | 'WARNING' | 'FAIL'; detail: string }

export interface Analysis {
  tables: SourceTable[];
  filteredTables: SourceTable[];
  filterNotes: string[];
  quality: QualityReport;
  results: TestResult[];
  resultById: Record<string, TestResult>;
  findings: Finding[];
  findingById: Record<string, Finding>;
  recommendations: Recommendation[];
  risks: RiskRow[];
  controls: ControlRow[];
  universe: UniverseRow[];
  fsa: FsaResult;
  change: ChangeMonitor;
  qc: QCCheck[];
  qcStatus: 'PASS' | 'WARNING' | 'FAIL';
  entities: Record<string, string[]>;
  hasData: boolean;
  datasetsPresent: Set<string>;
  today: string;
}

export const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const SEV_RANK: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const fromRank = (n: number): Severity => (['info', 'info', 'low', 'medium', 'high', 'critical'] as Severity[])[Math.max(1, Math.min(5, n))];

const DATE_FIELD: Record<string, string> = { gl: 'date', ap: 'invoiceDate', ar: 'invoiceDate', bank: 'date', procurement: 'poDate', payroll: 'payDate', tax: 'filingDue' };
const PARTY_FIELDS = ['vendor', 'customer', 'counterparty', 'beneficiary', 'party', 'lender'];

/** Apply global filters to tables. Filters only apply where the table maps the relevant field. */
export function applyFilters(tables: SourceTable[], f: Filters, s: Settings): { tables: SourceTable[]; notes: string[] } {
  const notes: string[] = [];
  const active = f.dateFrom || f.dateTo || f.department || f.costCenter || f.site || f.bank || f.currency || f.vendor || f.account;
  if (!active) return { tables, notes };
  const out = tables.map((t) => {
    const a = accessor(t);
    const df = DATE_FIELD[t.datasetType];
    const checks: ((r: SourceRow) => boolean)[] = [];
    const na: string[] = [];
    if ((f.dateFrom || f.dateTo) && df) {
      if (a.has(df)) checks.push((r) => { const d = a.d(r, df); return !!d && (!f.dateFrom || d >= f.dateFrom) && (!f.dateTo || d <= f.dateTo); });
      else na.push('date');
    }
    const textEq = (field: string, val: string) => {
      if (!val) return;
      if (a.has(field)) checks.push((r) => norm(a.t(r, field)) === norm(val)); else na.push(field);
    };
    textEq('department', f.department);
    textEq('costCenter', f.costCenter);
    textEq('bank', f.bank);
    if (f.currency) { if (a.has('currency')) checks.push((r) => a.t(r, 'currency').toUpperCase() === f.currency.toUpperCase()); else na.push('currency'); }
    if (f.site) {
      if (['site', 'location', 'costCenter', 'department'].some((x) => a.has(x))) checks.push((r) => rowSite(t, r, s.sites) === f.site); else na.push('site');
    }
    if (f.vendor) {
      const pf = PARTY_FIELDS.filter((x) => a.has(x));
      if (pf.length) checks.push((r) => pf.some((x) => norm(a.t(r, x)).includes(norm(f.vendor)))); else na.push('vendor');
    }
    if (f.account) { if (a.has('account')) checks.push((r) => a.t(r, 'account').startsWith(f.account)); else na.push('account'); }
    if (na.length && checks.length === 0) notes.push(`${t.fileName} / ${t.sheet}: filter(s) not applicable (${na.join(', ')}) — rows kept`);
    else if (na.length) notes.push(`${t.fileName} / ${t.sheet}: filter(s) ${na.join(', ')} not applicable`);
    if (!checks.length) return t;
    return { ...t, rows: t.rows.filter((r) => checks.every((c) => c(r))) };
  });
  return { tables: out, notes };
}

function baseExposure(exp: Record<string, number>, s: Settings): number {
  return exp[s.baseCurrency] ?? 0;
}

function rateFinding(def: TestDef, exp: Record<string, number>, s: Settings): { rating: Severity; basis: L } {
  let r = SEV_RANK[def.severity];
  const b = baseExposure(exp, s);
  const { overall, performance, trivial } = s.materiality;
  const parts: string[] = [`Rule severity: ${def.severity.toUpperCase()}`];
  const partsAr: string[] = [`خطورة القاعدة: ${def.severity}`];
  if (overall && b >= overall) { r = Math.max(r, 4) + (r >= 4 ? 1 : 0); parts.push(`exposure ${b.toLocaleString()} ≥ overall materiality ${overall.toLocaleString()} → escalated`); partsAr.push('التعرض ≥ الأهمية النسبية الكلية → رفع التصنيف'); }
  else if (performance && b >= performance) { r = Math.max(r, 3); parts.push(`exposure ≥ performance materiality ${performance.toLocaleString()} → at least MEDIUM`); partsAr.push('التعرض ≥ الأهمية النسبية للتنفيذ → متوسط على الأقل'); }
  else if (trivial && b > 0 && b < trivial && !def.fraud && Object.keys(exp).every((c) => c === s.baseCurrency)) { r = Math.max(2, r - 1); parts.push(`exposure < clearly trivial ${trivial.toLocaleString()} → downgraded one level`); partsAr.push('التعرض أقل من الحد التافه → خفض درجة'); }
  if (!overall) { parts.push('materiality not configured — rating based on rule severity'); partsAr.push('الأهمية النسبية غير محددة — التصنيف وفق خطورة القاعدة'); }
  return { rating: fromRank(Math.min(5, r)), basis: { en: parts.join('; '), ar: partsAr.join('؛ ') } };
}

const EFFORT: Record<string, Recommendation['effort']> = { recon: 'Medium', gl: 'Medium', ap: 'Low', ar: 'Low', treasury: 'Low', fa: 'Medium', inventory: 'Medium', procurement: 'Medium', payroll: 'Low', capex: 'High', opex: 'Medium', tax: 'Low', loans: 'Low', contracts: 'Medium', related: 'Low' };
const HORIZON: Record<Severity, Recommendation['priority']> = { critical: 'immediate', high: 'short', medium: 'medium', low: 'long', info: 'long' };
const HORIZON_DAYS: Record<Recommendation['priority'], number> = { immediate: 30, short: 90, medium: 180, long: 365 };

function addDays(iso: string, d: number) { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); }

interface Core { tables: SourceTable[]; filtered: SourceTable[]; notes: string[]; quality: QualityReport; results: TestResult[]; resultById: Record<string, TestResult>; findings: Finding[]; fsa: FsaResult }
let coreCache: { files: SourceFile[]; settings: Settings; filters: Filters; core: Core } | null = null;

/** Heavy phase (tests, data quality, evidence validation, FS analytics). Cached until files, settings or filters change. */
function computeCore(files: SourceFile[], s: Settings, filters: Filters): Core {
  if (coreCache && coreCache.files === files && coreCache.settings === s && coreCache.filters === filters) return coreCache.core;
  const tables = files.flatMap((f) => f.tables);
  const { tables: filtered, notes } = applyFilters(tables, filters, s);
  const quality = assessQuality(tables);
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const rowIndex = new Map(tables.map((t) => [t.id, new Set(t.rows.map((r) => r.recordId))]));
  const rowExists = (tid: string, rid: string) => !!rowIndex.get(tid)?.has(rid);

  // 1) Run tests
  const ctx = { tables: filtered, settings: s };
  const results: TestResult[] = TEST_LIBRARY.map((def) => {
    try { return { testId: def.id, ...def.run(ctx) }; } catch (e) { return { testId: def.id, status: 'insufficient', missing: [`Test error: ${e instanceof Error ? e.message : String(e)}`], population: 0, exceptions: [] }; }
  });
  const resultById = Object.fromEntries(results.map((r) => [r.testId, r]));

  // Data-quality flags used for contradiction checks
  const dqFlag = new Set<string>();
  for (const tq of quality.tables) for (const i of tq.issues) if (['duplicate-rows', 'invalid-type'].includes(i.kind)) i.sample.forEach((x) => dqFlag.add(x.recordId));

  // 2) Findings (status/owner/due are applied later from auditor overrides)
  const findings: Finding[] = [];
  const seenRowSets = new Map<string, string>();
  for (const r of results) {
    if (r.status !== 'performed' || !r.exceptions.length) continue;
    const def = TEST_BY_ID[r.testId];
    const exposure: Record<string, number> = {};
    for (const e of r.exceptions) if (e.money) exposure[e.money.currency] = (exposure[e.money.currency] ?? 0) + Math.abs(e.money.amount);
    const { rating, basis } = rateFinding(def, exposure, s);
    const id = `F-${def.id}`;

    // Evidence validation (9 checks)
    const allRefs = r.exceptions.flatMap((e) => e.rows);
    const filesOk = allRefs.every((x) => tableById.has(x.tableId));
    const rowsOk = allRefs.every((x) => rowExists(x.tableId, x.recordId));
    let reproducible = false;
    try { const again = def.run(ctx); reproducible = again.exceptions.map((e) => e.key).join('\n') === r.exceptions.map((e) => e.key).join('\n'); } catch { reproducible = false; }
    const calcsOk = r.exceptions.every((e) => e.calc && e.calc.inputs.length > 0 && e.calc.result !== null && e.calc.result !== undefined);
    const contradictory = allRefs.filter((x) => dqFlag.has(x.recordId)).length;
    const rowKey = [...new Set(allRefs.map((x) => x.recordId))].sort().join(',');
    const dupOf = seenRowSets.get(rowKey);
    if (!dupOf) seenRowSets.set(rowKey, id);
    const checks: EvidenceCheck[] = [
      { id: 'source', label: { en: 'Source file exists', ar: 'الملف المصدر موجود' }, pass: filesOk },
      { id: 'record', label: { en: 'Source records exist', ar: 'السجلات المصدرية موجودة' }, pass: rowsOk },
      { id: 'calc', label: { en: 'Calculation is reproducible (re-run identical)', ar: 'الاحتساب قابل لإعادة الإنتاج' }, pass: reproducible && calcsOk },
      { id: 'txn', label: { en: 'Transactions exist', ar: 'المعاملات موجودة' }, pass: allRefs.length > 0 },
      { id: 'rule', label: { en: 'Audit rule exists', ar: 'قاعدة المراجعة موجودة' }, pass: !!def.rule.en },
      { id: 'sufficient', label: { en: 'Evidence is sufficient (inputs + highlighted fields)', ar: 'الأدلة كافية' }, pass: r.exceptions.every((e) => Object.keys(e.highlight).length > 0) && calcsOk },
      { id: 'contradiction', label: { en: 'Contradictory data checked', ar: 'تم فحص البيانات المتعارضة' }, pass: contradictory === 0, note: contradictory ? { en: `${contradictory} evidence row(s) flagged by data-quality (duplicate/invalid) — auditor review`, ar: `${contradictory} سجل عليه ملاحظات جودة بيانات — مراجعة المراجع` } : undefined },
      { id: 'materiality', label: { en: 'Materiality is valid (configured)', ar: 'الأهمية النسبية محددة' }, pass: !!s.materiality.overall },
      { id: 'dup', label: { en: 'Finding is not duplicated', ar: 'الملاحظة غير مكررة' }, pass: !dupOf, note: dupOf ? { en: `Same evidence rows as ${dupOf}`, ar: `نفس سجلات ${dupOf}` } : undefined },
    ];
    const core = checks.slice(0, 5).every((c) => c.pass);
    const evidenceStatus: Finding['evidenceStatus'] = !core ? 'insufficient' : checks.every((c) => c.pass) ? 'validated' : 'validation-required';
    const unspecified = Object.keys(exposure).includes('—');
    const confidence: Finding['confidence'] = !core ? 'low' : (r.skipped ?? 0) > 0 || unspecified || contradictory ? 'medium' : 'high';
    const confBasis: L = confidence === 'high'
      ? { en: 'Deterministic rule on complete, mapped source fields; reproduced on re-run.', ar: 'قاعدة حتمية على حقول مصدرية كاملة؛ أعيد إنتاجها.' }
      : confidence === 'medium' ? { en: `Rule reproduced, but ${unspecified ? 'currency not specified for some amounts; ' : ''}${r.skipped ? `${r.skipped} rows skipped for blank fields; ` : ''}${contradictory ? 'some rows have data-quality flags' : ''}`, ar: 'أعيد إنتاج القاعدة لكن توجد بيانات ناقصة أو ملاحظات جودة.' }
      : { en: 'Evidence chain incomplete — auditor review required.', ar: 'سلسلة الأدلة غير مكتملة — تتطلب مراجعة المراجع.' };
    const n = r.exceptions.length;
    findings.push({
      id, testId: def.id, area: def.area, riskId: def.riskId, controlId: def.controlId,
      title: def.name,
      condition: { en: `${n} exception(s) identified out of ${r.population} item(s) tested. ${r.exceptions[0].description.en}${n > 1 ? ` (and ${n - 1} more)` : ''}.`, ar: `تم رصد ${n} استثناء من أصل ${r.population} بند مختبر. ${r.exceptions[0].description.ar}${n > 1 ? ` (و${n - 1} أخرى)` : ''}.` },
      criteria: def.criteria, cause: def.cause, effect: def.effect,
      rating, ratingBasis: basis, exposure, exceptionCount: n, population: r.population,
      confidence, confidenceBasis: confBasis, evidenceChecks: checks, evidenceStatus,
      fraudIndicator: !!def.fraud, recommendationId: `RM-${def.id}`,
      status: 'draft', owner: '', dueDate: '',
    });
  }
  findings.sort((a, b) => SEV_RANK[b.rating] - SEV_RANK[a.rating] || baseExposure(b.exposure, s) - baseExposure(a.exposure, s));
  const core: Core = { tables, filtered, notes, quality, results, resultById, findings, fsa: analyseFS(filtered, s) };
  coreCache = { files, settings: s, filters, core };
  return core;
}

export function runAnalysis(input: AnalysisInput): Analysis {
  const s = input.settings;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const { tables, filtered, notes, quality, results, resultById, fsa } = computeCore(input.files, s, input.filters);
  const lastSnap = input.snapshots[input.snapshots.length - 1] ?? null;
  const findings: Finding[] = computeCore(input.files, s, input.filters).findings.map((f) => {
    const ov = input.overrides[f.id] ?? {};
    return { ...f, status: ov.status ?? 'draft', owner: ov.owner ?? '', dueDate: ov.dueDate ?? '' };
  });
  const findingById = Object.fromEntries(findings.map((f) => [f.id, f]));

  // 3) Recommendations
  const maxExp = Math.max(1, ...findings.map((f) => baseExposure(f.exposure, s)));
  const actionByFinding = new Map(input.actions.map((a) => [a.findingId, a]));
  const recommendations: Recommendation[] = findings.map((f) => {
    const def = TEST_BY_ID[f.testId];
    const ctl = CONTROL_BY_ID[f.controlId];
    const priority = HORIZON[f.rating];
    const act = actionByFinding.get(f.id);
    const effort = EFFORT[f.area] ?? 'Medium';
    const score = SEV_RANK[f.rating] / 5 * 35 + baseExposure(f.exposure, s) / maxExp * 25 + (f.exceptionCount / Math.max(1, f.population)) * 20 + (f.fraudIndicator ? 10 : 0) + (effort === 'Low' ? 10 : effort === 'Medium' ? 5 : 0);
    return {
      id: f.recommendationId, findingId: f.id, riskId: f.riskId, rootCause: def.cause, action: def.recommendation,
      benefit: { en: `Reduces ${RISK_BY_ID[f.riskId]?.title.en.toLowerCase() ?? 'risk'}${baseExposure(f.exposure, s) ? `; addresses exposure of ${baseExposure(f.exposure, s).toLocaleString()} ${s.baseCurrency}` : ''}.`, ar: `يخفض ${RISK_BY_ID[f.riskId]?.title.ar ?? 'المخاطر'}${baseExposure(f.exposure, s) ? `؛ ويعالج تعرضًا قدره ${baseExposure(f.exposure, s).toLocaleString()} ${s.baseCurrency}` : ''}.` },
      controlImprovement: ctl ? { en: `${ctl.id}: ${ctl.description.en}`, ar: `${ctl.id}: ${ctl.description.ar}` } : { en: '—', ar: '—' },
      owner: act?.owner || f.owner || '', priority, targetDate: act?.dueDate || f.dueDate || addDays(today, HORIZON_DAYS[priority]),
      effort, status: act ? act.status : 'not-assigned', score: Math.round(score * 10) / 10, rating: f.rating,
    };
  }).sort((a, b) => b.score - a.score);

  // 4) Controls
  const prevKeys = lastSnap?.exceptionKeys ?? {};
  const controls: ControlRow[] = CONTROLS.map((c) => {
    const tests = TEST_LIBRARY.filter((t) => t.controlId === c.id).map((t) => t.id);
    const perf = tests.map((t) => resultById[t]).filter((r) => r.status === 'performed');
    const exc = perf.reduce((s2, r) => s2 + r.exceptions.length, 0);
    const pop = perf.reduce((s2, r) => s2 + r.population, 0);
    const rate = perf.length && pop ? exc / pop : perf.length ? 0 : null;
    const fids = findings.filter((f) => f.controlId === c.id);
    const maxSev = fids.length ? fids.reduce<Severity>((m, f) => (SEV_RANK[f.rating] > SEV_RANK[m] ? f.rating : m), 'info') : null;
    const repeat = perf.some((r) => r.exceptions.some((e) => prevKeys[r.testId]?.includes(e.key)));
    const acts = input.actions.filter((a) => fids.some((f) => f.id === a.findingId));
    const overdue = acts.filter((a) => a.status !== 'closed' && a.dueDate && a.dueDate < today).length;
    const remediation = acts.length ? 1 - overdue / acts.length : null;
    const design = s.controlDesign[c.id] ?? null;
    const operating = rate === null ? null : Math.max(0, 1 - rate * 5);
    const severityF = perf.length ? (maxSev ? ({ critical: 0.3, high: 0.5, medium: 0.7, low: 0.85, info: 1 } as Record<Severity, number>)[maxSev] : 1) : null;
    const repeatF = perf.length ? (repeat ? 0.6 : 1) : null;
    const comps = [
      { label: 'Design effectiveness (CAE assessment)', value: design, weight: 0.25 },
      { label: 'Operating effectiveness (1 − 5 × exception rate)', value: operating, weight: 0.35 },
      { label: 'Exception severity', value: severityF, weight: 0.2 },
      { label: 'Repeat findings', value: repeatF, weight: 0.1 },
      { label: 'Remediation performance (actions not overdue)', value: remediation, weight: 0.1 },
    ];
    const avail = comps.filter((x) => x.value !== null);
    const wsum = avail.reduce((s2, x) => s2 + x.weight, 0);
    const score = perf.length && wsum ? Math.round(avail.reduce((s2, x) => s2 + x.value! * x.weight, 0) / wsum * 100) : design !== null ? Math.round(design * 100) : null;
    const rating: ControlRow['rating'] = score === null ? 'not-tested' : score >= 80 ? 'effective' : score >= 55 ? 'needs-improvement' : 'ineffective';
    return { def: c, tests, performed: perf.length, exceptions: exc, population: pop, exceptionRate: rate, maxSeverity: maxSev, repeat, design, operating, remediation, score, rating, components: comps, findings: fids.map((f) => f.id), owner: input.controlMeta[c.id]?.owner ?? '' };
  });

  // 5) Risks
  const { overall, performance, trivial } = s.materiality;
  const risks: RiskRow[] = RISKS.map((d) => {
    const tests = TEST_LIBRARY.filter((t) => t.riskId === d.id).map((t) => t.id);
    const perf = tests.map((t) => resultById[t]).filter((r) => r.status === 'performed');
    const fs = findings.filter((f) => f.riskId === d.id);
    const exposure: Record<string, number> = {};
    fs.forEach((f) => Object.entries(f.exposure).forEach(([c, v]) => { exposure[c] = (exposure[c] ?? 0) + v; }));
    const exc = perf.reduce((s2, r) => s2 + r.exceptions.length, 0);
    const pop = perf.reduce((s2, r) => s2 + r.population, 0);
    const rate = perf.length ? (pop ? exc / pop : 0) : null;
    const likelihood = rate === null ? null : rate === 0 ? 1 : rate <= 0.01 ? 2 : rate <= 0.05 ? 3 : rate <= 0.15 ? 4 : 5;
    const b = exposure[s.baseCurrency] ?? 0;
    let impact: number | null = null; let basisEn = '', basisAr = '';
    if (perf.length) {
      if (overall) {
        impact = b >= overall ? 5 : performance && b >= performance ? 4 : trivial && b >= trivial ? 3 : b > 0 ? 2 : fs.length ? 2 : 1;
        basisEn = `Impact from exposure ${b.toLocaleString()} ${s.baseCurrency} vs materiality`; basisAr = 'الأثر وفق التعرض مقارنة بالأهمية النسبية';
      } else {
        const mx = fs.reduce((m, f) => Math.max(m, SEV_RANK[f.rating]), 1);
        impact = mx; basisEn = 'Impact from highest finding severity (materiality not configured)'; basisAr = 'الأثر وفق أعلى خطورة (الأهمية النسبية غير محددة)';
      }
      basisEn += `; likelihood from exception rate ${(rate! * 100).toFixed(2)}% (${exc}/${pop})`; basisAr += `؛ الاحتمال وفق معدل الاستثناءات ${(rate! * 100).toFixed(2)}%`;
    } else { basisEn = 'Not assessed — no linked test could be performed (INSUFFICIENT DATA)'; basisAr = 'لم يُقيّم — لم يُنفذ أي اختبار مرتبط (بيانات غير كافية)'; }
    const residualScore = likelihood && impact ? likelihood * impact : null;
    const il = s.inherentLikelihood[d.id];
    const inherentScore = il && impact ? Math.max(il, likelihood ?? 0) * impact : null;
    const band = (x: number | null): Severity | 'na' => x === null ? 'na' : x >= 20 ? 'critical' : x >= 12 ? 'high' : x >= 6 ? 'medium' : 'low';
    const ctrls = [...new Set([...CONTROLS.filter((c) => c.riskId === d.id).map((c) => c.id), ...TEST_LIBRARY.filter((t) => t.riskId === d.id).map((t) => t.controlId)])];
    const meta = input.riskMeta[d.id] ?? {};
    const topRec = recommendations.find((r) => r.riskId === d.id);
    return { def: d, likelihood, impact, residualScore, residual: band(residualScore), inherentScore, inherent: band(inherentScore), exposure, exceptionRate: rate, tests, performed: perf.length, findings: fs.map((f) => f.id), controls: ctrls, basis: { en: basisEn, ar: basisAr }, owner: meta.owner ?? '', controlOwner: meta.controlOwner ?? '', dueDate: meta.dueDate ?? '', status: meta.status ?? (fs.length ? 'open' : perf.length ? 'monitored' : 'not-assessed'), recommendedAction: topRec?.action ?? null };
  }).sort((a, b) => (b.residualScore ?? -1) - (a.residualScore ?? -1));

  // 6) Audit universe
  const totalRows = filtered.reduce((s2, t) => s2 + t.rows.length, 0) || 1;
  const areaValue: Record<string, number> = {};
  let totalValue = 0;
  const areaDatasets: Record<string, string[]> = { gl: ['gl'], ap: ['ap', 'vendors'], ar: ['ar'], treasury: ['bank'], fa: ['fa'], inventory: ['inventory'], procurement: ['procurement'], payroll: ['payroll'], capex: ['budget'], opex: ['budget'], tax: ['tax'], loans: ['loans'], contracts: ['contracts'], related: ['related'], recon: ['tb'] };
  const valField: Record<string, string> = { gl: 'debit', ap: 'amount', ar: 'amount', bank: 'debit', fa: 'cost', inventory: 'totalValue', procurement: 'amount', payroll: 'gross', budget: 'actual', tax: 'taxAmount', loans: 'outstanding', contracts: 'value', related: 'amount', tb: 'closing' };
  for (const ar of AREAS) {
    let v = 0;
    for (const t of filtered.filter((x) => areaDatasets[ar.id]?.includes(x.datasetType))) {
      const a = accessor(t); const vf = valField[t.datasetType]; if (!vf || !a.has(vf)) continue;
      for (const r of t.rows) v += Math.abs(a.n(r, vf) ?? 0);
    }
    areaValue[ar.id] = v; totalValue += v;
  }
  const maxVal = Math.max(1, ...Object.values(areaValue));
  const universe: UniverseRow[] = AREAS.map((ar): UniverseRow => {
    const dts = areaDatasets[ar.id] ?? [];
    const ts = filtered.filter((t) => dts.includes(t.datasetType));
    const rows = ts.reduce((s2, t) => s2 + t.rows.length, 0);
    const tdefs = TEST_LIBRARY.filter((t) => t.area === ar.id);
    const res = tdefs.map((t) => resultById[t.id]);
    const perf = res.filter((r) => r.status === 'performed');
    const fs = findings.filter((f) => f.area === ar.id);
    const fx: Record<string, number | null> = {};
    if (rows) {
      fx.materiality = (areaValue[ar.id] / maxVal) * 5;
      fx.volume = Math.min(5, Math.log10(rows + 1) * 1.25);
      const pop = perf.reduce((s2, r) => s2 + r.population, 0); const ex = perf.reduce((s2, r) => s2 + r.exceptions.length, 0);
      fx.exceptions = perf.length ? Math.min(5, (pop ? ex / pop : 0) * 50) : null;
      fx.fraud = Math.min(5, fs.filter((f) => f.fraudIndicator).length * 1.5);
      if (ar.id === 'gl') {
        const g = ts.find((t) => t.mapping.source); if (g) { const a = accessor(g); const man = g.rows.filter((r) => /manual|mje|gj|يدوي/i.test(a.t(r, 'source'))).length; fx.manual = (man / Math.max(1, g.rows.length)) * 5; } else fx.manual = null;
      } else fx.manual = null;
      let fxn = 0, fxt = 0; for (const t of ts) { const a = accessor(t); if (!a.has('currency')) continue; for (const r of t.rows) { fxt++; const c = a.t(r, 'currency').toUpperCase(); if (c && c !== s.baseCurrency) fxn++; } }
      fx.fx = fxt ? (fxn / fxt) * 5 : null;
      const ctrlRows = controls.filter((c) => tdefs.some((t) => t.controlId === c.def.id) && c.score !== null);
      fx.controlWeakness = ctrlRows.length ? (1 - ctrlRows.reduce((s2, c) => s2 + c.score!, 0) / ctrlRows.length / 100) * 5 : null;
      fx.relatedParty = ar.id === 'related' || fs.some((f) => f.testId.startsWith('RP')) ? Math.min(5, findings.filter((f) => f.testId.startsWith('RP')).length * 2) : null;
    }
    for (const fdef of UNIVERSE_FACTORS.filter((x) => !x.derived)) fx[fdef.id] = s.judgementRatings[ar.id]?.[fdef.id] ?? null;
    const avail = UNIVERSE_FACTORS.filter((x) => fx[x.id] !== null && fx[x.id] !== undefined && (s.riskWeights[x.id] ?? 0) > 0);
    const wsum = avail.reduce((s2, x) => s2 + (s.riskWeights[x.id] ?? 0), 0);
    const score = rows && wsum ? Math.round(avail.reduce((s2, x) => s2 + (fx[x.id] as number) * (s.riskWeights[x.id] ?? 0), 0) / wsum * 20) : null;
    return { area: ar.id, label: ar.label, factors: fx, score, rating: score === null ? 'na' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low', findings: fs.length, insufficient: res.filter((r) => r.status === 'insufficient').length, rows };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  void totalRows; void totalValue;

  // 7) Entities & change monitor
  const entities: Record<string, Set<string>> = { vendors: new Set(), employees: new Set(), bankAccounts: new Set(), accounts: new Set(), users: new Set(), customers: new Set() };
  for (const t of tables) {
    const a = accessor(t);
    for (const r of t.rows) {
      if (a.has('vendor')) { const v = a.t(r, 'vendor'); if (v) entities.vendors.add(v); }
      if (a.has('customer')) { const v = a.t(r, 'customer'); if (v) entities.customers.add(v); }
      if (t.datasetType === 'payroll') { const v = a.t(r, 'employeeId'); if (v) entities.employees.add(v); }
      if (a.has('bankAccount')) { const v = a.t(r, 'bankAccount'); if (v) entities.bankAccounts.add(v); }
      if (a.has('account') && (t.datasetType === 'gl' || t.datasetType === 'tb' || t.datasetType === 'coa')) { const v = a.t(r, 'account'); if (v) entities.accounts.add(v); }
      if (a.has('user')) { const v = a.t(r, 'user'); if (v) entities.users.add(v); }
    }
  }
  const entObj = Object.fromEntries(Object.entries(entities).map(([k, v]) => [k, [...v]]));
  const change: ChangeMonitor = { baseline: lastSnap, newExceptions: [], repeatExceptions: [], resolvedExceptions: [], newEntities: {} };
  if (lastSnap) {
    for (const r of results) {
      const prev = new Set(lastSnap.exceptionKeys[r.testId] ?? []);
      const cur = new Set(r.exceptions.map((e) => e.key));
      const nw = [...cur].filter((k) => !prev.has(k)), rp = [...cur].filter((k) => prev.has(k)), rs = r.status === 'performed' ? [...prev].filter((k) => !cur.has(k)) : [];
      if (nw.length) change.newExceptions.push({ testId: r.testId, keys: nw });
      if (rp.length) change.repeatExceptions.push({ testId: r.testId, keys: rp });
      if (rs.length) change.resolvedExceptions.push({ testId: r.testId, keys: rs });
    }
    for (const [k, v] of Object.entries(entObj)) { const prev = new Set(lastSnap.entities[k] ?? []); const nw = v.filter((x) => !prev.has(x)); if (nw.length) change.newEntities[k] = nw; }
  }


  // 9) Audit platform quality check
  const hasData = tables.length > 0;
  const performed = results.filter((r) => r.status === 'performed').length;
  const qc: QCCheck[] = [];
  const add = (id: string, en: string, ar: string, status: QCCheck['status'], detail: string) => qc.push({ id, label: { en, ar }, status, detail });
  add('data', 'Data validation', 'التحقق من البيانات', !hasData ? 'FAIL' : quality.score === null ? 'FAIL' : quality.score >= 80 ? 'PASS' : quality.score >= 60 ? 'WARNING' : 'FAIL', hasData ? `Data Quality Score ${quality.score ?? '—'}` : 'No data uploaded');
  add('critical', 'Critical data-quality failures', 'إخفاقات جودة البيانات الحرجة', quality.criticalFailures.length ? 'FAIL' : hasData ? 'PASS' : 'FAIL', quality.criticalFailures.length ? quality.criticalFailures.slice(0, 3).join(' | ') : hasData ? 'None' : 'No data');
  const nonRepro = findings.filter((f) => !f.evidenceChecks.find((c) => c.id === 'calc')?.pass).length;
  add('formula', 'Formula & calculation validation', 'التحقق من المعادلات والاحتسابات', nonRepro ? 'FAIL' : 'PASS', `${findings.length - nonRepro}/${findings.length} findings reproduced on independent re-run`);
  const recRes = results.filter((r) => r.testId.startsWith('REC-'));
  const recUn = recRes.filter((r) => r.status === 'performed' && r.exceptions.length).length;
  add('recon', 'Reconciliation', 'المطابقات', recRes.every((r) => r.status === 'insufficient') ? 'WARNING' : recUn ? 'WARNING' : 'PASS', `${recRes.filter((r) => r.status === 'performed').length} performed, ${recUn} with differences`);
  add('dup', 'Duplicate testing', 'اختبار التكرار', (quality.duplicatePct ?? 0) > 1 ? 'WARNING' : 'PASS', `Exact duplicate rows ${quality.duplicatePct ?? 0}%`);
  const insuff = results.length - performed;
  add('missing', 'Missing-data testing', 'اختبار البيانات الناقصة', !performed ? 'FAIL' : insuff / results.length > 0.5 ? 'WARNING' : 'PASS', `${performed} tests performed, ${insuff} not performed (INSUFFICIENT DATA)`);
  const glTb = resultById['REC-01'];
  add('cross', 'Cross-module consistency (GL ↔ TB)', 'الاتساق بين الوحدات', glTb.status !== 'performed' ? 'WARNING' : glTb.exceptions.length ? 'WARNING' : 'PASS', glTb.status !== 'performed' ? glTb.missing.join('; ') : `${glTb.exceptions.length} account difference(s)`);
  const insEv = findings.filter((f) => f.evidenceStatus === 'insufficient').length;
  add('evidence', 'Evidence validation', 'التحقق من الأدلة', insEv ? 'FAIL' : findings.some((f) => f.evidenceStatus === 'validation-required') ? 'WARNING' : 'PASS', `${findings.filter((f) => f.evidenceStatus === 'validated').length} validated, ${findings.filter((f) => f.evidenceStatus === 'validation-required').length} require validation, ${insEv} insufficient`);
  const untrace = findings.filter((f) => !f.evidenceChecks.find((c) => c.id === 'record')?.pass).length;
  add('trace', 'Source traceability', 'إمكانية التتبع للمصدر', untrace ? 'FAIL' : 'PASS', `${findings.length - untrace}/${findings.length} findings fully traceable to file → sheet → row`);
  const dupF = findings.filter((f) => !f.evidenceChecks.find((c) => c.id === 'dup')?.pass).length;
  add('dupf', 'Finding duplication check', 'فحص تكرار الملاحظات', dupF ? 'WARNING' : 'PASS', `${dupF} potential duplicate finding(s)`);
  add('materiality', 'Materiality configured', 'تحديد الأهمية النسبية', s.materiality.overall ? 'PASS' : 'WARNING', s.materiality.overall ? `Overall ${s.materiality.overall.toLocaleString()} ${s.baseCurrency}` : 'Not configured — the platform does not invent materiality');
  const qcStatus: Analysis['qcStatus'] = qc.some((q) => q.status === 'FAIL') ? 'FAIL' : qc.some((q) => q.status === 'WARNING') ? 'WARNING' : 'PASS';

  return {
    tables, filteredTables: filtered, filterNotes: notes, quality, results, resultById, findings, findingById, recommendations, risks, controls, universe, fsa, change, qc, qcStatus,
    entities: entObj, hasData, datasetsPresent: new Set(tables.map((t) => t.datasetType)), today,
  };
}

export function exposureBase(f: { exposure: Record<string, number> }, s: Settings): number { return f.exposure[s.baseCurrency] ?? 0; }

export function makeSnapshot(a: Analysis, label: string, user: string): Snapshot {
  return {
    id: `S-${Date.now().toString(36)}`, label, createdAt: new Date().toISOString(), createdBy: user,
    exceptionKeys: Object.fromEntries(a.results.filter((r) => r.exceptions.length).map((r) => [r.testId, r.exceptions.map((e) => e.key)])),
    entities: a.entities, findingIds: a.findings.map((f) => f.id),
  };
}

/** Dataset requirement status for the Data Requirements Center. */
export function requirementStatus(tables: SourceTable[]) {
  return DATASETS.map((d) => {
    const ts = tables.filter((t) => t.datasetType === d.type);
    const mapped = new Set(ts.flatMap((t) => Object.keys(t.mapping)));
    return { def: d, uploaded: ts.length > 0, tables: ts.length, rows: ts.reduce((s, t) => s + t.rows.length, 0), fields: d.fields.map((f) => ({ f, mapped: mapped.has(f.key), required: d.required.includes(f.key) })) };
  });
}

