import type { Filters, Settings } from './types';
import { DEFAULT_SITES } from './sites';

/** Risk-scoring factors for the Audit Universe. Data-derived factors are computed; judgement factors are rated by the CAE. */
export const UNIVERSE_FACTORS: { id: string; en: string; ar: string; derived: boolean }[] = [
  { id: 'materiality', en: 'Financial materiality', ar: 'الأهمية النسبية المالية', derived: true },
  { id: 'volume', en: 'Transaction volume', ar: 'حجم المعاملات', derived: true },
  { id: 'exceptions', en: 'Historical / current exceptions', ar: 'الاستثناءات الحالية والسابقة', derived: true },
  { id: 'fraud', en: 'Fraud exposure', ar: 'التعرض للاحتيال', derived: true },
  { id: 'manual', en: 'Manual intervention', ar: 'التدخل اليدوي', derived: true },
  { id: 'fx', en: 'FX exposure', ar: 'التعرض لأسعار الصرف', derived: true },
  { id: 'controlWeakness', en: 'Control weaknesses', ar: 'ضعف الرقابة', derived: true },
  { id: 'relatedParty', en: 'Related-party exposure', ar: 'التعرض للأطراف ذات العلاقة', derived: true },
  { id: 'frequency', en: 'Transaction frequency', ar: 'تكرار المعاملات', derived: false },
  { id: 'judgment', en: 'Management judgment', ar: 'التقديرات الإدارية', derived: false },
  { id: 'system', en: 'System dependency', ar: 'الاعتماد على الأنظمة', derived: false },
  { id: 'regulatory', en: 'Regulatory exposure', ar: 'التعرض التنظيمي', derived: false },
  { id: 'liquidity', en: 'Liquidity impact', ar: 'الأثر على السيولة', derived: false },
  { id: 'criticality', en: 'Operational criticality', ar: 'الأهمية التشغيلية', derived: false },
];

export const DEFAULT_SETTINGS: Settings = {
  sites: DEFAULT_SITES,
  baseCurrency: 'EGP',
  assumeBaseCurrencyWhenMissing: false,
  materiality: { overall: null, performance: null, trivial: null },
  weekendDays: [5, 6], // Friday & Saturday — Egyptian working week
  holidays: [],
  workHours: { start: null, end: null },
  approvalLimits: [],
  nearThresholdPct: 5,
  largeAmount: null,
  roundNumberBase: 1000,
  dormantDays: 365,
  overdueDays: 90,
  slowMovingDays: 365,
  suspenseKeywords: ['suspense', 'clearing', 'unallocated', 'unidentified', 'معلق', 'وسيط', 'تحت التسوية'],
  suspiciousKeywords: ['adjust', 'plug', 'override', 'per ceo', 'per cfo', 'urgent', 'cash', 'personal', 'gift', 'consult', 'misc', 'تسوية', 'شخصي', 'هدية', 'متنوعة'],
  splitWindowDays: 7,
  backdateDays: 30,
  concentrationPct: 20,
  budgetVariancePct: 10,
  spikeMultiple: 2,
  fiscalYearEnd: '',
  asOfDate: '',
  riskWeights: Object.fromEntries(UNIVERSE_FACTORS.map((f) => [f.id, 1])),
  judgementRatings: {},
  inherentLikelihood: {},
  controlDesign: {},
  policySources: [],
};

export const EMPTY_FILTERS: Filters = { dateFrom: '', dateTo: '', department: '', costCenter: '', site: '', currency: '', vendor: '', account: '', area: '', risk: '', status: '' };
