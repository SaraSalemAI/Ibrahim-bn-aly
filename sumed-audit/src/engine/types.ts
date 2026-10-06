// Core domain types for the SUMED Internal Audit platform.
// Source data is immutable: parsed rows are frozen and every derived value
// keeps a reference back to file → sheet/table → row.

export type Lang = 'en' | 'ar';
/** Bilingual text. Library content (tests, controls, risks) is authored in both languages. */
export interface L { en: string; ar: string }

export type Cell = string | number | boolean | null;

export type DatasetType =
  | 'company' | 'coa' | 'gl' | 'tb' | 'ap' | 'ar' | 'bank' | 'fa' | 'inventory'
  | 'procurement' | 'payroll' | 'budget' | 'tax' | 'loans' | 'contracts'
  | 'related' | 'vendors' | 'policy' | 'unknown';

export type FileStatus = 'parsed' | 'text-only' | 'ocr-required' | 'failed' | 'unsupported';

export interface SourceRow {
  /** Stable source record ID: <fileShort>-<sheet#>-R<row> */
  readonly recordId: string;
  /** 1-based row number as it appears in the source sheet/file */
  readonly rowNumber: number;
  readonly values: Readonly<Record<string, Cell>>;
}

export interface SourceTable {
  id: string;
  fileId: string;
  fileName: string;
  sheet: string;
  sheetIndex: number;
  headerRow: number;
  headers: string[];
  rows: readonly SourceRow[];
  /** Classification (editable by the auditor; original suggestion kept) */
  datasetType: DatasetType;
  suggestedType: DatasetType;
  classificationScore: number;
  /** canonical field → source header */
  mapping: Record<string, string>;
  suggestedMapping: Record<string, string>;
}

export interface SourceFile {
  id: string;
  name: string;
  ext: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  uploadedBy: string;
  /** Optional period label supplied at upload (e.g. 2025-Q4). Not inferred. */
  periodLabel: string;
  status: FileStatus;
  error?: string;
  text?: string;
  tables: SourceTable[];
}

export interface RowRef { tableId: string; recordId: string }

export interface CalcInput { label: L | string; value: Cell; ref?: RowRef; field?: string }

export interface Calculation {
  /** Formula in plain notation, e.g. "Variance = Current − Prior" */
  formula: string;
  inputs: CalcInput[];
  result: Cell;
}

export interface Money { amount: number; currency: string }

export interface TestException {
  /** Deterministic key: identical data yields identical key (used for repeat/resolved detection). */
  key: string;
  description: L;
  rows: RowRef[];
  /** recordId → canonical fields that triggered the rule (source highlighting) */
  highlight: Record<string, string[]>;
  calc: Calculation;
  money?: Money;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AuditArea =
  | 'gl' | 'ap' | 'ar' | 'treasury' | 'fa' | 'inventory' | 'procurement' | 'payroll'
  | 'capex' | 'opex' | 'budget' | 'tax' | 'loans' | 'contracts' | 'related' | 'fraud' | 'fs' | 'recon';

export interface TestOutput {
  status: 'performed' | 'insufficient';
  /** Human-readable list of what is missing when status = insufficient */
  missing: string[];
  population: number;
  exceptions: TestException[];
  /** Parameters actually used (thresholds, configured lists) — displayed in evidence */
  params?: Record<string, Cell>;
  /** Rows skipped because a required field was blank/invalid */
  skipped?: number;
}

export interface TestResult extends TestOutput {
  testId: string;
}

export type FindingStatus = 'draft' | 'under-review' | 'validated' | 'official' | 'closed' | 'dismissed';

export interface EvidenceCheck { id: string; label: L; pass: boolean; note?: L }

export interface Finding {
  id: string;
  testId: string;
  area: AuditArea;
  riskId: string;
  controlId: string;
  title: L;
  condition: L;
  criteria: L;
  cause: L;
  effect: L;
  rating: Severity;
  ratingBasis: L;
  exposure: Record<string, number>;
  exceptionCount: number;
  population: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceBasis: L;
  evidenceChecks: EvidenceCheck[];
  evidenceStatus: 'validated' | 'validation-required' | 'insufficient';
  fraudIndicator: boolean;
  recommendationId: string;
  status: FindingStatus;
  owner: string;
  dueDate: string;
}

/** An operating site / cost location (e.g. Head Office, terminals). Keywords match source values in EN/AR. */
export interface SiteDef { id: string; name: L; keywords: string[] }

export interface Settings {
  sites: SiteDef[];
  baseCurrency: string;
  assumeBaseCurrencyWhenMissing: boolean;
  materiality: { overall: number | null; performance: number | null; trivial: number | null };
  weekendDays: number[]; // 0=Sun … 6=Sat
  holidays: string[]; // ISO dates supplied by the company
  workHours: { start: number | null; end: number | null };
  approvalLimits: number[]; // configured approval thresholds (base currency)
  nearThresholdPct: number; // % below a limit considered "just below"
  largeAmount: number | null; // large-journal threshold
  roundNumberBase: number; // e.g. 1000
  dormantDays: number;
  overdueDays: number;
  slowMovingDays: number;
  suspenseKeywords: string[];
  suspiciousKeywords: string[];
  splitWindowDays: number;
  backdateDays: number;
  concentrationPct: number;
  budgetVariancePct: number;
  spikeMultiple: number;
  /** Fiscal year end as MM-DD; blank = not configured (year-end tests not performed) */
  fiscalYearEnd: string;
  /** Analysis as-of date; blank = latest date found in each dataset */
  asOfDate: string;
  riskWeights: Record<string, number>;
  /** CAE judgement ratings per audit area for factors not derivable from data (1-5) */
  judgementRatings: Record<string, Record<string, number>>;
  /** CAE judgement of inherent likelihood per risk (1-5) */
  inherentLikelihood: Record<string, number>;
  /** Control design assessments by CAE (controlId → 0..1) */
  controlDesign: Record<string, number>;
  /** Accounting framework / policy documents the auditor has confirmed as controlling sources */
  policySources: string[];
}

export interface Filters {
  dateFrom: string;
  dateTo: string;
  department: string;
  costCenter: string;
  site: string;
  bank: string;
  owner: string;
  currency: string;
  vendor: string;
  account: string;
  area: string;
  risk: string;
  status: string;
}

export interface ActionItem {
  id: string;
  findingId: string;
  recommendationId: string;
  owner: string;
  department: string;
  dueDate: string;
  priority: 'immediate' | 'short' | 'medium' | 'long';
  status: 'open' | 'in-progress' | 'implemented' | 'pending-validation' | 'closed';
  completion: number;
  evidence: string;
  validation: string;
  closureDate: string;
  createdAt: string;
}

export interface AuditLogEntry {
  seq: number;
  ts: string;
  user: string;
  role: string;
  action: string;
  target: string;
  detail: string;
  prevHash: string;
  hash: string;
}

export interface Snapshot {
  id: string;
  label: string;
  createdAt: string;
  createdBy: string;
  exceptionKeys: Record<string, string[]>; // testId → keys
  entities: Record<string, string[]>; // vendors, employees, bankAccounts, accounts, users
  findingIds: string[];
}

export type Role =
  | 'cae' | 'auditor' | 'senior' | 'cfo' | 'finance' | 'treasury' | 'risk'
  | 'compliance' | 'management' | 'committee' | 'readonly';
