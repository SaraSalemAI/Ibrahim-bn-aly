import { suggestMapping } from "./classify";
import { round2 } from "./engine";
import type { GlLine } from "./gl";
import type { Category, TBRow } from "./types";

const PL: ReadonlySet<Category | ""> = new Set(["REVENUE", "COGS", "SELLING_EXPENSE", "ADMIN_EXPENSE", "DEPRECIATION", "FINANCE_COST", "OTHER_INCOME", "TAX_EXPENSE"]);

const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86_400_000).toISOString().slice(0, 10);

function monthsBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(addDays(end, 1));
  return (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
}

/** The period after this one, with the same length (a month, a quarter or a year). */
export function nextPeriod(p: { start: string; end: string; currentLabel: string }) {
  const months = Math.max(1, monthsBetween(p.start, p.end));
  const start = addDays(p.end, 1);
  const s = new Date(start);
  const end = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + months, 0)).toISOString().slice(0, 10);
  const y = Number(end.slice(0, 4));
  const label = months >= 12 ? `FY${y}` : months === 3 ? `Q${Math.ceil(Number(end.slice(5, 7)) / 3)} ${y}` : end.slice(0, 7);
  return { start, end, currentLabel: label, priorLabel: p.currentLabel, months };
}

/** True when `start` is the first day of a fiscal year ending on fiscalYearEnd ("12-31" or "06-30"). */
export function startsFiscalYear(start: string, fiscalYearEnd: "12-31" | "06-30"): boolean {
  return start.slice(5) === (fiscalYearEnd === "12-31" ? "01-01" : "07-01");
}

/**
 * Opening balances for the next period from this period's closing (adjusted) trial balance. At a
 * fiscal year end the P&L accounts are closed into retained earnings; inside a year they carry their
 * year-to-date balances.
 */
export function openingBalances(closing: TBRow[], closeYear: boolean): TBRow[] {
  const keep = closing.map((r) => ({ ...r, priorDebit: 0, priorCredit: 0, suggested: false, mappingRule: r.mappingRule ?? "opening" }));
  if (!closeYear) return keep;
  const profit = round2(-keep.filter((r) => PL.has(r.category)).reduce((a, r) => a + r.currentDebit - r.currentCredit, 0));
  const out = keep.map((r) => (PL.has(r.category) ? { ...r, currentDebit: 0, currentCredit: 0 } : r));
  const re = out.find((r) => r.category === "RETAINED_EARNINGS");
  if (re) {
    const net = re.currentDebit - re.currentCredit - profit;
    re.currentDebit = round2(Math.max(net, 0));
    re.currentCredit = round2(Math.max(-net, 0));
  } else if (profit) {
    out.push({ code: "RE-OPEN", name: "Retained earnings (closing profit carried forward)", category: "RETAINED_EARNINGS", suggested: false, currentDebit: Math.max(-profit, 0), currentCredit: Math.max(profit, 0), priorDebit: 0, priorCredit: 0, sourceRow: 0, mappingRule: "roll-forward" });
  }
  return out;
}

/**
 * Builds the period's closing trial balance from opening balances plus the general ledger's
 * movements, by account code. Accounts that appear only in the GL get a suggested mapping.
 * `prior` supplies comparatives (the previous period's closing balances).
 */
export function buildTbFromGl(opening: TBRow[], gl: GlLine[], prior: TBRow[] = []) {
  const map = new Map<string, TBRow>();
  for (const r of opening) map.set(r.code, { ...r, priorDebit: 0, priorCredit: 0 });
  const added: string[] = [];
  for (const l of gl) {
    let r = map.get(l.accountCode);
    if (!r) {
      const s = suggestMapping(l.accountCode, l.accountName);
      r = { code: l.accountCode, name: l.accountName || l.accountCode, category: s.category, suggested: s.category !== "", confidence: s.confidence, mappingRule: s.rule, currentDebit: 0, currentCredit: 0, priorDebit: 0, priorCredit: 0, sourceRow: l.sourceRow };
      map.set(l.accountCode, r);
      added.push(l.accountCode);
    }
    const net = r.currentDebit - r.currentCredit + l.debit - l.credit;
    r.currentDebit = Math.max(net, 0);
    r.currentCredit = Math.max(-net, 0);
  }
  const priorBy = new Map(prior.map((p) => [p.code, p]));
  const rows = [...map.values()].map((r) => {
    const p = priorBy.get(r.code);
    priorBy.delete(r.code);
    return { ...r, currentDebit: round2(r.currentDebit), currentCredit: round2(r.currentCredit), priorDebit: p?.priorDebit ?? 0, priorCredit: p?.priorCredit ?? 0 };
  });
  for (const p of priorBy.values()) if (p.priorDebit || p.priorCredit) rows.push({ ...p, currentDebit: 0, currentCredit: 0 });
  return { rows, newAccounts: added };
}
