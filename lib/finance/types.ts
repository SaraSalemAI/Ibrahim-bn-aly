export const CATEGORIES = [
  "CASH",
  "RECEIVABLES",
  "INVENTORY",
  "OTHER_CURRENT_ASSET",
  "PPE",
  "ACCUM_DEPRECIATION",
  "OTHER_NON_CURRENT_ASSET",
  "PAYABLES",
  "SHORT_TERM_DEBT",
  "OTHER_CURRENT_LIABILITY",
  "LONG_TERM_DEBT",
  "OTHER_NON_CURRENT_LIABILITY",
  "SHARE_CAPITAL",
  "LEGAL_RESERVE",
  "RETAINED_EARNINGS",
  "OTHER_EQUITY",
  "REVENUE",
  "COGS",
  "SELLING_EXPENSE",
  "ADMIN_EXPENSE",
  "DEPRECIATION",
  "FINANCE_COST",
  "OTHER_INCOME",
  "TAX_EXPENSE",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** How a category is presented: debit-natural lines are Dr - Cr, credit-natural are Cr - Dr. */
export const CREDIT_NATURAL: ReadonlySet<Category> = new Set<Category>([
  "PAYABLES",
  "SHORT_TERM_DEBT",
  "OTHER_CURRENT_LIABILITY",
  "LONG_TERM_DEBT",
  "OTHER_NON_CURRENT_LIABILITY",
  "SHARE_CAPITAL",
  "LEGAL_RESERVE",
  "RETAINED_EARNINGS",
  "OTHER_EQUITY",
  "REVENUE",
  "OTHER_INCOME",
]);

export interface TBRow {
  code: string;
  name: string;
  /** Empty string means unmapped: the row sits in the holding class until the analyst maps it. */
  category: Category | "";
  /** True when the category came from the keyword/code classifier rather than the source file or the analyst. */
  suggested: boolean;
  currentDebit: number;
  currentCredit: number;
  priorDebit: number;
  priorCredit: number;
  /** 1-based row number in the source file, for lineage. */
  sourceRow: number;
  /** Source document id (see SourceDoc), for drill-to-source. */
  sourceDocId?: string;
  /** Currency the account is denominated in, for FX stress tests. Defaults to the functional currency. */
  currency?: string;
  /** How the category was set: from the file, the analyst, a bulk rule, keyword classifier or AI. */
  mappingRule?: string;
  /** 0-100 confidence of an automatic suggestion. */
  confidence?: number;
}

export interface SourceDoc {
  id: string;
  fileName: string;
  sha256: string;
  category: DocCategory;
  rowCount: number;
  encoding: string;
  uploadedAt: string;
}

export type DocCategory =
  | "TRIAL_BALANCE"
  | "GENERAL_LEDGER"
  | "AR_SUBLEDGER"
  | "AP_SUBLEDGER"
  | "FIXED_ASSETS"
  | "INVENTORY"
  | "PAYROLL"
  | "BANK_STATEMENT"
  | "ETA_INVOICE";

export interface Drivers {
  revenueGrowth: number;
  grossMargin: number;
  opexPctRevenue: number;
  financeCostChange: number;
  taxRate: number;
}

export type ScenarioName = "base" | "bull" | "bear";
export type ScenarioDrivers = Record<ScenarioName, Drivers>;

export interface Issue {
  level: "error" | "warning";
  code: string;
  params?: Record<string, string | number>;
}
