import type { Aje, BridgeInputs, Framework } from "../finance/adjustments";
import type { AuditEntry } from "../finance/audit";
import type { BudgetVersion } from "../finance/budget";
import type { NoteStatus } from "../finance/disclosures";
import type { GlLine } from "../finance/gl";
import type { Covenants, ModelInputs, ScenarioKey, ScenarioOverride, SensitivityDriver, SensitivityMetric } from "../finance/model";
import type { StressInputs } from "../finance/stress";
import type { ApInvoice, ArInvoice, BankLine, EclRates, EtaDocument, FixedAsset, InventoryItem, PayrollLine } from "../finance/subledgers";
import type { TaxInputs } from "../finance/tax";
import type { DocCategory, SourceDoc, TBRow } from "../finance/types";
import type { ValuationInputs } from "../finance/valuation";

export type Role = "ANALYST" | "REVIEWER" | "CFO";
export type PeriodStatus = "DRAFT" | "MAPPED" | "RECONCILED" | "LOCKED";
export type LegalType = "SAE" | "LLC" | "BRANCH" | "ONE_PERSON";

export interface CompanySettings {
  tradeNameEn: string;
  tradeNameAr: string;
  legalType: LegalType;
  taxCardNumber: string;
  commercialRegistry: string;
  industry: string;
  functionalCurrency: string;
  presentationCurrency: string;
  framework: Framework;
  fiscalYearEnd: "12-31" | "06-30";
  cashFlowMethod: "INDIRECT" | "DIRECT";
}

export interface Period {
  status: PeriodStatus;
  start: string;
  end: string;
  currentLabel: string;
  priorLabel: string;
  lockedAt: string | null;
  lockedBy: string | null;
  mappingConfirmed: boolean;
}

export interface Subledgers {
  ar: ArInvoice[];
  ap: ApInvoice[];
  far: FixedAsset[];
  inventory: InventoryItem[];
  payroll: PayrollLine[];
  bank: BankLine[];
  eta: EtaDocument[];
  gl: GlLine[];
}

/** One month's trial balance, kept for trend analysis. */
export interface MonthlyTb {
  id: string;
  /** YYYY-MM */
  label: string;
  end: string;
  rows: TBRow[];
  docId: string;
}

/** A closed period kept after rolling forward. */
export interface PeriodArchive {
  id: string;
  label: string;
  start: string;
  end: string;
  status: PeriodStatus;
  lockedAt: string | null;
  lockedBy: string | null;
  rows: TBRow[];
  ajes: Aje[];
  archivedAt: string;
}

/** Board pack frozen when the period was locked: the company state it was produced from, without bulky raw data. */
export interface BoardPackSnapshot {
  id: string;
  periodLabel: string;
  createdAt: string;
  createdBy: string;
  hash: string;
  company: Company;
}

export interface Company {
  id: string;
  settings: CompanySettings;
  period: Period;
  docs: SourceDoc[];
  rows: TBRow[];
  ajes: Aje[];
  bridge: BridgeInputs;
  subledgers: Subledgers;
  eclRates: EclRates;
  payrollPeriodsPerYear: number;
  profitSharePct: number;
  budgets: BudgetVersion[];
  activeBudgetId: string | null;
  model: ModelInputs | null;
  scenarios: Record<ScenarioKey, ScenarioOverride>;
  sensitivity: { x: SensitivityDriver; y: SensitivityDriver; metric: SensitivityMetric; stepX: number; stepY: number };
  covenants: Covenants;
  tax: TaxInputs;
  disclosures: Record<string, { status: NoteStatus; override?: string }>;
  valuation: ValuationInputs;
  stress: StressInputs;
  /** Analyst's column matches per file type: importer field -> header in their export. */
  columnMaps: Partial<Record<DocCategory, Record<string, string>>>;
  /** Units of functional currency per unit of foreign currency, entered by the analyst. */
  fxRates: Record<string, number>;
  monthly: MonthlyTb[];
  /** True when monthly TB files show year-to-date P&L (most ERPs); monthly figures are then the differences. */
  monthlyYtd: boolean;
  /** Account codes holding balances with other group companies (eliminated on consolidation). */
  intercompanyCodes: string[];
  /** Opening balances carried from the previous period by a roll-forward. */
  opening: TBRow[] | null;
  history: PeriodArchive[];
  boardPacks: BoardPackSnapshot[];
  /** Differences up to this amount count as agreed in validations and tie-outs. */
  tolerance: number;
  automation: Automation;
  /** What each recurring file turned out to be, keyed by its name without dates or numbers. */
  fileMemory: Record<string, { category: DocCategory; role?: "current" | "prior" | "monthly" }>;
  importRuns: ImportRun[];
  validationRuns: ValidationRun[];
  cashForecast: CashForecastInputs;
}

export interface Automation {
  /** Import recognised files without waiting for a click. */
  autoImport: boolean;
  /** Accept suggested mappings at or above this confidence (0-100); 101 turns it off. */
  autoMapThreshold: number;
  /** Ask AI for the accounts still unmapped (full app with AI configured). */
  aiMapping: boolean;
  /** Move the period to Mapped / Reconciled when every gate passes. Locking stays manual. */
  autoAdvance: boolean;
  /** Minimum detection confidence for a file to be imported automatically. */
  minConfidence: number;
}

export interface ImportRun {
  id: string;
  at: string;
  by: string;
  files: Array<{ name: string; category: DocCategory; role?: string; rows: number; erp?: string | null; via: string; confidence: number }>;
  held: Array<{ name: string; reason: string }>;
  autoMapped: number;
  aiSuggested: number;
  stillToMap: number;
  statusAfter: PeriodStatus;
}

export interface ValidationRun {
  id: string;
  at: string;
  trigger: string;
  tolerance: number;
  /** Rule id -> outcome, compact so history can be compared. */
  results: Record<string, { level: "error" | "warning" | "info"; ok: boolean; count: number }>;
}

export interface CashForecastInputs {
  weeks: number;
  /** Share of overdue receivables expected to be collected, spread over overdueWeeks. */
  overdueCollectionRate: number;
  overdueWeeks: number;
  /** Days customers pay after the due date on average. */
  collectionLagDays: number;
  /** Overdue payables are paid over this many weeks. */
  overduePayableWeeks: number;
  includePayroll: boolean;
  minimumCash: number | null;
  openingCash: number | null;
  items: Array<{ id: string; name: string; amount: number; every: "once" | "week" | "month"; week: number }>;
}

export interface GroupMember {
  companyId: string;
  /** Parent's ownership, 0-1. 1 for the parent itself. */
  ownership: number;
}

export interface Group {
  id: string;
  name: string;
  parentId: string;
  members: GroupMember[];
}

export interface SyncSettings {
  url: string;
  anonKey: string;
  email: string;
  workspaceKey: string;
  accessToken: string | null;
  refreshToken: string | null;
  remoteVersion: number;
  lastSyncedAt: string | null;
  auto: boolean;
}

export interface Workspace {
  version: 1;
  id: string;
  profile: { name: string; role: Role };
  lang: "en" | "ar";
  companies: Company[];
  activeCompanyId: string | null;
  benchmarks: Record<string, number | null>;
  audit: AuditEntry[];
  groups: Group[];
  sync: SyncSettings | null;
}
