import type { Aje, BridgeInputs, Framework } from "../finance/adjustments";
import type { AuditEntry } from "../finance/audit";
import type { BudgetVersion } from "../finance/budget";
import type { NoteStatus } from "../finance/disclosures";
import type { GlLine } from "../finance/gl";
import type { Covenants, ModelInputs, ScenarioKey, ScenarioOverride, SensitivityDriver, SensitivityMetric } from "../finance/model";
import type { StressInputs } from "../finance/stress";
import type { ApInvoice, ArInvoice, BankLine, EclRates, EtaDocument, FixedAsset, InventoryItem, PayrollLine } from "../finance/subledgers";
import type { TaxInputs } from "../finance/tax";
import type { SourceDoc, TBRow } from "../finance/types";
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
}
