import { DEFAULT_SCENARIOS } from "../finance/model";
import { DEFAULT_STRESS } from "../finance/stress";
import { PLACEHOLDER_ECL_RATES } from "../finance/subledgers";
import { DEFAULT_TAX_INPUTS } from "../finance/tax";
import { DEFAULT_VALUATION } from "../finance/valuation";
import type { Company, Workspace } from "./types";

export const DEFAULT_AUTOMATION = { autoImport: true, autoMapThreshold: 85, aiMapping: true, autoAdvance: true, minConfidence: 60 };
export const DEFAULT_CASH_FORECAST = { weeks: 13, overdueCollectionRate: 0.8, overdueWeeks: 4, collectionLagDays: 0, overduePayableWeeks: 2, includePayroll: true, minimumCash: null, openingCash: null };

export function uid(prefix = "id"): string {
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rnd.replace(/-/g, "").slice(0, 16)}`;
}

export function newCompany(name = "New company"): Company {
  const year = new Date().getFullYear() - 1;
  return {
    id: uid("co"),
    settings: {
      tradeNameEn: name,
      tradeNameAr: "",
      legalType: "SAE",
      taxCardNumber: "",
      commercialRegistry: "",
      industry: "",
      functionalCurrency: "EGP",
      presentationCurrency: "EGP",
      framework: "EAS",
      fiscalYearEnd: "12-31",
      cashFlowMethod: "INDIRECT",
    },
    period: {
      status: "DRAFT",
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      currentLabel: `FY${year}`,
      priorLabel: `FY${year - 1}`,
      lockedAt: null,
      lockedBy: null,
      mappingConfirmed: false,
    },
    docs: [],
    rows: [],
    ajes: [],
    bridge: { employeeProfitShare: 0, boardRemuneration: 0 },
    subledgers: { ar: [], ap: [], far: [], inventory: [], payroll: [], bank: [], eta: [], gl: [] },
    eclRates: { ...PLACEHOLDER_ECL_RATES },
    payrollPeriodsPerYear: 12,
    profitSharePct: 0.1,
    budgets: [],
    activeBudgetId: null,
    model: null,
    scenarios: structuredClone(DEFAULT_SCENARIOS),
    sensitivity: { x: "revenueGrowth", y: "grossMargin", metric: "ebitda", stepX: 0.02, stepY: 0.01 },
    covenants: { maxDebtToEbitda: null, minInterestCoverage: null },
    tax: { ...DEFAULT_TAX_INPUTS },
    disclosures: {},
    valuation: structuredClone(DEFAULT_VALUATION),
    stress: { ...DEFAULT_STRESS },
    columnMaps: {},
    fxRates: {},
    monthly: [],
    monthlyYtd: true,
    intercompanyCodes: [],
    opening: null,
    history: [],
    boardPacks: [],
    tolerance: 1,
    automation: { ...DEFAULT_AUTOMATION },
    fileMemory: {},
    importRuns: [],
    validationRuns: [],
    cashForecast: { ...DEFAULT_CASH_FORECAST, items: [] },
  };
}

export function newWorkspace(): Workspace {
  return {
    version: 1,
    id: uid("ws"),
    profile: { name: "Analyst", role: "CFO" },
    lang: "en",
    companies: [],
    activeCompanyId: null,
    benchmarks: {},
    audit: [],
    groups: [],
    sync: null,
  };
}

/** Fills fields added after a workspace was saved, so older saved data keeps loading. */
export function migrateCompany(c: Partial<Company>): Company {
  const base = newCompany();
  return {
    ...base,
    ...c,
    settings: { ...base.settings, ...c.settings },
    period: { ...base.period, ...c.period },
    subledgers: { ...base.subledgers, ...c.subledgers },
    tax: { ...base.tax, ...c.tax },
    valuation: { ...base.valuation, ...c.valuation },
    stress: { ...base.stress, ...c.stress },
    scenarios: { ...base.scenarios, ...c.scenarios },
    sensitivity: { ...base.sensitivity, ...c.sensitivity },
    covenants: { ...base.covenants, ...c.covenants },
    automation: { ...base.automation, ...c.automation },
    cashForecast: { ...base.cashForecast, ...c.cashForecast },
  } as Company;
}
