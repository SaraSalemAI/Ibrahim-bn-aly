import { round2 } from "./engine";
import type { Category, TBRow } from "./types";

/**
 * Full consolidation of a parent and its subsidiaries from their (adjusted) trial balances:
 * line-by-line aggregation, elimination of intercompany balances and transactions, elimination of
 * the parent's investment against subsidiary share capital, and non-controlling interests.
 *
 * Simplifications, shown to the user: subsidiary share capital stands in for net assets at
 * acquisition (no fair-value or pre-acquisition reserves), and intercompany differences are put to
 * a visible "unreconciled" line instead of being guessed away.
 */
export interface ConsolidationEntity {
  id: string;
  name: string;
  /** Parent's ownership, 0-1; 1 for the parent. */
  ownership: number;
  isParent: boolean;
  rows: TBRow[];
  intercompanyCodes: string[];
}

export interface Elimination {
  type: "intercompanyBalances" | "intercompanyPnl" | "investment" | "nci";
  description: string;
  current: number;
  prior: number;
}

const IC_NAME = /inter-?company|related part|due (from|to) (group|parent|subsidiar|affiliat|sister)|current account.*(group|subsidiar|parent)|أطراف ذات علاقة|شركات? شقيقة|شركة تابعة|الشركة الأم|جاري الشركات|حساب جاري.*(شركة|الشركات)/i;
const INVESTMENT_NAME = /investments? in subsidiar|investment in group compan|استثمارات? في (شركات|الشركات) تابعة|استثمار في شركة تابعة/i;

const IC_ASSET: ReadonlySet<Category | ""> = new Set(["RECEIVABLES", "OTHER_CURRENT_ASSET", "OTHER_NON_CURRENT_ASSET", "CASH"]);
const IC_LIAB: ReadonlySet<Category | ""> = new Set(["PAYABLES", "OTHER_CURRENT_LIABILITY", "SHORT_TERM_DEBT", "LONG_TERM_DEBT", "OTHER_NON_CURRENT_LIABILITY"]);
const IC_INCOME: ReadonlySet<Category | ""> = new Set(["REVENUE", "OTHER_INCOME"]);
const IC_EXPENSE: ReadonlySet<Category | ""> = new Set(["COGS", "SELLING_EXPENSE", "ADMIN_EXPENSE", "FINANCE_COST"]);
const EQUITY: Category[] = ["SHARE_CAPITAL", "LEGAL_RESERVE", "RETAINED_EARNINGS", "OTHER_EQUITY"];

export const isIntercompany = (r: TBRow, codes: string[]) => codes.includes(r.code) || IC_NAME.test(r.name);
export const isInvestmentInSub = (r: TBRow) => r.category === "OTHER_NON_CURRENT_ASSET" && INVESTMENT_NAME.test(r.name);

const netCur = (r: TBRow) => r.currentDebit - r.currentCredit;
const netPri = (r: TBRow) => r.priorDebit - r.priorCredit;

function row(code: string, name: string, category: Category, cur: number, pri: number): TBRow {
  return {
    code,
    name,
    category,
    suggested: false,
    currentDebit: round2(Math.max(cur, 0)),
    currentCredit: round2(Math.max(-cur, 0)),
    priorDebit: round2(Math.max(pri, 0)),
    priorCredit: round2(Math.max(-pri, 0)),
    sourceRow: 0,
    mappingRule: "consolidation",
  };
}

const prefixOf = (i: number) => `E${i + 1}`;

export function consolidate(entities: ConsolidationEntity[]) {
  const rows: TBRow[] = [];
  const elims: Elimination[] = [];
  const add = (r: TBRow) => rows.push(r);

  entities.forEach((e, i) => {
    for (const r of e.rows) add({ ...r, code: `${prefixOf(i)}:${r.code}`, name: `${r.name} (${e.name})` });
  });

  // 1. Intercompany balances.
  let icA = [0, 0];
  let icL = [0, 0];
  entities.forEach((e, i) => {
    for (const r of e.rows) {
      if (!isIntercompany(r, e.intercompanyCodes) || isInvestmentInSub(r)) continue;
      const asset = IC_ASSET.has(r.category);
      const liab = IC_LIAB.has(r.category);
      if (!asset && !liab) continue;
      add(row(`ELIM:${prefixOf(i)}:${r.code}`, `Eliminate intercompany: ${r.name} (${e.name})`, r.category as Category, -netCur(r), -netPri(r)));
      if (asset) icA = [icA[0] + netCur(r), icA[1] + netPri(r)];
      else icL = [icL[0] - netCur(r), icL[1] - netPri(r)];
    }
  });
  const balDiff = [round2(icA[0] - icL[0]), round2(icA[1] - icL[1])];
  if (icA[0] || icL[0] || icA[1] || icL[1]) {
    elims.push({ type: "intercompanyBalances", description: "Intercompany receivables and payables", current: round2(icA[0]), prior: round2(icA[1]) });
    if (balDiff[0] || balDiff[1]) add(row("ELIM:IC-DIFF", "Intercompany balances not agreed (unreconciled)", "OTHER_CURRENT_ASSET", balDiff[0], balDiff[1]));
  }

  // 2. Intercompany income and expenses.
  let icR = [0, 0];
  let icE = [0, 0];
  entities.forEach((e, i) => {
    for (const r of e.rows) {
      if (!isIntercompany(r, e.intercompanyCodes)) continue;
      const inc = IC_INCOME.has(r.category);
      const exp = IC_EXPENSE.has(r.category);
      if (!inc && !exp) continue;
      add(row(`ELIM:${prefixOf(i)}:${r.code}`, `Eliminate intercompany: ${r.name} (${e.name})`, r.category as Category, -netCur(r), -netPri(r)));
      if (inc) icR = [icR[0] - netCur(r), icR[1] - netPri(r)];
      else icE = [icE[0] + netCur(r), icE[1] + netPri(r)];
    }
  });
  const pnlDiff = [round2(icR[0] - icE[0]), round2(icR[1] - icE[1])];
  if (icR[0] || icE[0] || icR[1] || icE[1]) {
    elims.push({ type: "intercompanyPnl", description: "Intercompany sales, charges and interest", current: round2(icR[0]), prior: round2(icR[1]) });
    // Credit the difference so the elimination itself has no profit effect; the line flags it for follow-up.
    if (pnlDiff[0] || pnlDiff[1]) add(row("ELIM:IC-PNL-DIFF", "Intercompany income/expense not agreed (unreconciled)", "OTHER_INCOME", -pnlDiff[0], -pnlDiff[1]));
  }

  // 3. Investment in subsidiaries against subsidiary share capital.
  const parentIdx = entities.findIndex((e) => e.isParent);
  const parent = entities[parentIdx];
  const subs = entities.map((e, i) => ({ e, i })).filter((x) => !x.e.isParent);
  const invest = parent ? parent.rows.filter(isInvestmentInSub) : [];
  const capital = (e: ConsolidationEntity, f: (r: TBRow) => number) => -e.rows.filter((r) => r.category === "SHARE_CAPITAL").reduce((a, r) => a + f(r), 0);
  let goodwill = [0, 0];
  if (invest.length && subs.length) {
    const inv = [invest.reduce((a, r) => a + netCur(r), 0), invest.reduce((a, r) => a + netPri(r), 0)];
    for (const r of invest) add(row(`ELIM:${prefixOf(parentIdx)}:${r.code}`, `Eliminate investment: ${r.name}`, "OTHER_NON_CURRENT_ASSET", -netCur(r), -netPri(r)));
    const acquired = [0, 0];
    for (const { e, i } of subs) {
      const sc = [capital(e, netCur) * e.ownership, capital(e, netPri) * e.ownership];
      acquired[0] += sc[0];
      acquired[1] += sc[1];
      add(row(`ELIM:${prefixOf(i)}:SC`, `Eliminate parent's share of capital (${e.name})`, "SHARE_CAPITAL", sc[0], sc[1]));
    }
    goodwill = [round2(inv[0] - acquired[0]), round2(inv[1] - acquired[1])];
    if (goodwill[0] >= 0) add(row("ELIM:GOODWILL", "Goodwill on consolidation", "OTHER_NON_CURRENT_ASSET", goodwill[0], goodwill[1]));
    else add(row("ELIM:CONS-RESERVE", "Consolidation reserve (gain on acquisition)", "OTHER_EQUITY", goodwill[0], goodwill[1]));
    elims.push({ type: "investment", description: "Investment in subsidiaries against share capital", current: round2(inv[0]), prior: round2(inv[1]) });
  }

  // 4. Non-controlling interests in subsidiary equity (excluding the current period's profit, which is attributed below).
  let nciEquity = [0, 0];
  let nciProfit = 0;
  for (const { e, i } of subs) {
    const minority = 1 - e.ownership;
    if (minority <= 0) continue;
    for (const cat of EQUITY) {
      const rs = e.rows.filter((r) => r.category === cat);
      const cur = -rs.reduce((a, r) => a + netCur(r), 0) * minority;
      const pri = -rs.reduce((a, r) => a + netPri(r), 0) * minority;
      if (!cur && !pri) continue;
      add(row(`NCI:${prefixOf(i)}:${cat}`, `Non-controlling share of ${cat.toLowerCase().replace(/_/g, " ")} (${e.name})`, cat, cur, pri));
      nciEquity = [nciEquity[0] + cur, nciEquity[1] + pri];
    }
    const pl = e.rows.filter((r) => ["REVENUE", "OTHER_INCOME", "COGS", "SELLING_EXPENSE", "ADMIN_EXPENSE", "DEPRECIATION", "FINANCE_COST", "TAX_EXPENSE"].includes(r.category));
    nciProfit += -pl.reduce((a, r) => a + netCur(r), 0) * minority;
  }
  if (nciEquity[0] || nciEquity[1]) {
    add(row("NCI:TOTAL", "Non-controlling interests", "OTHER_EQUITY", -nciEquity[0], -nciEquity[1]));
    elims.push({ type: "nci", description: "Non-controlling interests reclassified from subsidiary equity", current: round2(nciEquity[0]), prior: round2(nciEquity[1]) });
  }

  return {
    rows,
    eliminations: elims,
    differences: { balances: { current: balDiff[0], prior: balDiff[1] }, pnl: { current: pnlDiff[0], prior: pnlDiff[1] } },
    goodwill: { current: goodwill[0], prior: goodwill[1] },
    nci: { equity: round2(nciEquity[0]), profit: round2(nciProfit) },
  };
}
