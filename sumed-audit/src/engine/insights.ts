// Executive insight engine — every item references findings/risks/controls derived from uploaded data only.
import type { Analysis, Recommendation, RiskRow, ControlRow } from './analysis';
import type { Finding, Settings } from './types';
import { TEST_BY_ID } from './tests';

const SEV: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const FIN_AREAS = new Set(['gl', 'ap', 'ar', 'treasury', 'tax', 'loans', 'budget', 'opex', 'capex', 'recon', 'fa', 'inventory']);

export interface Insights {
  topRisks: RiskRow[];
  topFindings: Finding[];
  topRecommendations: Recommendation[];
  cfoActions: Recommendation[];
  auditPriorities: { area: string; reason: 'high-risk' | 'insufficient-data' | 'repeat'; score: number | null; detail: { en: string; ar: string } }[];
  topExposures: Finding[];
  controlWeaknesses: ControlRow[];
  fraudIndicators: Finding[];
}

export function buildInsights(a: Analysis, s: Settings): Insights {
  const base = (f: Finding) => f.exposure[s.baseCurrency] ?? 0;
  const maxExp = Math.max(1, ...a.findings.map(base));
  const topRisks = a.risks.filter((r) => r.residualScore !== null && r.findings.length)
    .map((r) => ({ r, k: (r.residualScore ?? 0) * (1 + (r.exposure[s.baseCurrency] ?? 0) / maxExp) }))
    .sort((x, y) => y.k - x.k).slice(0, 10).map((x) => x.r);
  const topFindings = [...a.findings].sort((x, y) => SEV[y.rating] - SEV[x.rating] || base(y) - base(x)).slice(0, 10);
  const topRecommendations = a.recommendations.slice(0, 10);
  const cfoActions = a.recommendations.filter((r) => FIN_AREAS.has(TEST_BY_ID[r.findingId.slice(2)]?.area ?? '')).slice(0, 10);
  const pri: Insights['auditPriorities'] = [];
  for (const u of a.universe) if (u.rating === 'high') pri.push({ area: u.area, reason: 'high-risk', score: u.score, detail: { en: `Risk score ${u.score}; ${u.findings} finding(s)`, ar: `درجة المخاطر ${u.score}؛ ${u.findings} ملاحظة` } });
  for (const c of a.controls.filter((c) => c.repeat)) pri.push({ area: c.def.id, reason: 'repeat', score: c.score, detail: { en: `Repeat exceptions on control ${c.def.id}`, ar: `استثناءات متكررة على الضابط ${c.def.id}` } });
  for (const u of a.universe) if (u.rows === 0 || u.insufficient > 0) pri.push({ area: u.area, reason: 'insufficient-data', score: null, detail: { en: `${u.insufficient} test(s) not performed`, ar: `${u.insufficient} اختبار غير منفذ` } });
  const auditPriorities = pri.slice(0, 10);
  const topExposures = a.findings.filter((f) => Object.values(f.exposure).some((v) => v > 0)).sort((x, y) => base(y) - base(x) || Object.values(y.exposure).reduce((p, q) => p + q, 0) - Object.values(x.exposure).reduce((p, q) => p + q, 0)).slice(0, 10);
  const controlWeaknesses = a.controls.filter((c) => c.rating === 'ineffective' || c.rating === 'needs-improvement').sort((x, y) => (Number(y.repeat) - Number(x.repeat)) || (x.score ?? 0) - (y.score ?? 0)).slice(0, 10);
  const fraudIndicators = a.findings.filter((f) => f.fraudIndicator).sort((x, y) => SEV[y.rating] - SEV[x.rating] || base(y) - base(x)).slice(0, 10);
  return { topRisks, topFindings, topRecommendations, cfoActions, auditPriorities, topExposures, controlWeaknesses, fraudIndicators };
}
