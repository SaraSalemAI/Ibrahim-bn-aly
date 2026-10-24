import { emptyBudget } from "../finance/budget";
import { parseGl } from "../finance/gl";
import { sha256 } from "../finance/hash";
import { parseTrialBalance } from "../finance/parse";
import { SAMPLE_TB_CSV } from "../finance/sample";
import * as S from "../finance/sampleData";
import { parseAp, parseAr, parseBank, parseEta, parseFar, parseInventory, parsePayroll } from "../finance/subledgers";
import type { DocCategory, SourceDoc } from "../finance/types";
import { newCompany, uid } from "./defaults";
import type { Company } from "./types";

export const SAMPLE_PREFIX = "sample_";

/** A complete fictional company (illustrative numbers only) so every module can be explored without real data. */
export function sampleCompany(): Company {
  const c = newCompany("Nile Trading Co. (sample)");
  c.id = SAMPLE_PREFIX + uid("co");
  c.settings = { ...c.settings, tradeNameAr: "شركة النيل للتجارة (مثال)", legalType: "SAE", taxCardNumber: "100200300", commercialRegistry: "CR-12345 Cairo", industry: "Wholesale trade" };
  c.period = { ...c.period, start: S.SAMPLE_PERIOD.start, end: S.SAMPLE_PERIOD.end, currentLabel: "FY2025", priorLabel: "FY2024" };
  const now = new Date().toISOString();
  const doc = (fileName: string, category: DocCategory, text: string, rowCount: number): SourceDoc => ({ id: uid("doc"), fileName, sha256: sha256(text), category, rowCount, encoding: "utf-8", uploadedAt: now });

  const tbDoc = doc("sample-trial-balance.csv", "TRIAL_BALANCE", SAMPLE_TB_CSV, 21);
  c.rows = parseTrialBalance(SAMPLE_TB_CSV).rows.map((r) => ({ ...r, sourceDocId: tbDoc.id, currency: r.code === "2401" ? "USD" : undefined }));
  const glText = S.buildSampleGlCsv();
  const sl = c.subledgers;
  sl.gl = parseGl(glText).records;
  sl.ar = parseAr(S.SAMPLE_AR_CSV).records;
  sl.ap = parseAp(S.SAMPLE_AP_CSV).records;
  sl.far = parseFar(S.SAMPLE_FAR_CSV).records;
  sl.inventory = parseInventory(S.SAMPLE_INVENTORY_CSV).records;
  sl.payroll = parsePayroll(S.SAMPLE_PAYROLL_CSV).records;
  sl.bank = parseBank(S.SAMPLE_BANK_CSV).records;
  sl.eta = parseEta(S.SAMPLE_ETA_JSON).documents;
  c.docs = [
    tbDoc,
    doc("sample-general-ledger.csv", "GENERAL_LEDGER", glText, sl.gl.length),
    doc("sample-ar-aging.csv", "AR_SUBLEDGER", S.SAMPLE_AR_CSV, sl.ar.length),
    doc("sample-ap-ledger.csv", "AP_SUBLEDGER", S.SAMPLE_AP_CSV, sl.ap.length),
    doc("sample-fixed-assets.csv", "FIXED_ASSETS", S.SAMPLE_FAR_CSV, sl.far.length),
    doc("sample-inventory.csv", "INVENTORY", S.SAMPLE_INVENTORY_CSV, sl.inventory.length),
    doc("sample-payroll-dec.csv", "PAYROLL", S.SAMPLE_PAYROLL_CSV, sl.payroll.length),
    doc("sample-bank-dec.csv", "BANK_STATEMENT", S.SAMPLE_BANK_CSV, sl.bank.length),
    doc("sample-eta-export.json", "ETA_INVOICE", S.SAMPLE_ETA_JSON, sl.eta.length),
  ];
  c.bridge = { employeeProfitShare: 286750, boardRemuneration: 120000 };
  c.tax = { ...c.tax, finesAndPenalties: 25000, unsupportedExpenses: 240000, provisionsFormed: 50000, provisionsBalance: 150000, withholdingCredits: 180000, advancePayments: 300000 };

  const b = emptyBudget(uid("bud"), "FY2025 approved budget");
  b.approved = true;
  b.products = [
    { name: "Packaged rice", units: 70000, unitPrice: 300, discountPct: 0.05, unitCost: 210, actualUnits: 72000, actualUnitPrice: 290 },
    { name: "Sunflower oil", units: 30000, unitPrice: 420, discountPct: 0.03, unitCost: 300, actualUnits: 27000, actualUnitPrice: 440 },
    { name: "Household", units: 9000, unitPrice: 780, discountPct: 0, unitCost: 560, actualUnits: 9500, actualUnitPrice: 760 },
  ];
  b.headcount = [
    { department: "Sales", count: 18, monthlySalary: 12000, socialInsurancePct: 0.1875 },
    { department: "Operations", count: 14, monthlySalary: 9000, socialInsurancePct: 0.1875 },
    { department: "Finance & admin", count: 8, monthlySalary: 14000, socialInsurancePct: 0.1875 },
  ];
  b.rent = 900000;
  b.marketingPctRevenue = 0.02;
  b.otherOpex = 600000;
  b.targetDso = 60;
  b.targetDio = 70;
  b.targetDpo = 55;
  b.capex = [{ name: "Packaging machine", amount: 1500000, usefulLifeYears: 10, month: 4 }];
  c.budgets = [b];
  c.activeBudgetId = b.id;
  c.covenants = { maxDebtToEbitda: 2.5, minInterestCoverage: 3 };
  // Illustrative market inputs for the fictional sample only; real companies start with these empty.
  c.valuation = {
    ...c.valuation,
    riskFreeRate: 0.22,
    beta: 1.1,
    equityRiskPremium: 0.06,
    countryRiskPremium: 0.04,
    preTaxCostOfDebt: 0.24,
    targetDebtWeight: 0.3,
    terminalGrowth: 0.07,
    exitMultiple: 6,
    comps: [
      { name: "Peer A (illustrative)", evRevenue: 0.8, evEbitda: 6.5, pe: 9 },
      { name: "Peer B (illustrative)", evRevenue: 0.6, evEbitda: 5.2, pe: 8 },
      { name: "Peer C (illustrative)", evRevenue: 1.0, evEbitda: 7.4, pe: 11 },
    ],
  };
  c.stress = { ...c.stress, foreignCurrency: "USD", baseRate: 48, shockedRate: 60, importedCogsShare: 0.35, passThrough: 0.4, floatingDebtShare: 0.6, rateShock: 0.02 };
  return c;
}

export const isSample = (c: Company) => c.id.startsWith(SAMPLE_PREFIX);
