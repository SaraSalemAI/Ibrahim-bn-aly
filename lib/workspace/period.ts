import { sha256 } from "../finance/hash";
import { nextPeriod, openingBalances, startsFiscalYear } from "../finance/rollforward";
import { uid } from "./defaults";
import type { TBRow } from "../finance/types";
import type { BoardPackSnapshot, Company } from "./types";

/** The company state a board pack is produced from, without raw ledgers or earlier packs, hashed for evidence. */
export function snapshotPack(c: Company, by: string): BoardPackSnapshot {
  const company: Company = { ...c, subledgers: { ...c.subledgers, gl: [], bank: [] }, boardPacks: [], history: [], monthly: [] };
  return { id: uid("pack"), periodLabel: c.period.currentLabel, createdAt: new Date().toISOString(), createdBy: by, hash: sha256(JSON.stringify(company)), company };
}

/**
 * Closes the period and opens the next one: the locked period is archived, closing balances become
 * opening balances (P&L closed to retained earnings when a new fiscal year starts) and the
 * comparatives. Current balances start at the opening balances until a new TB or GL is loaded.
 */
export function rollForwardCompany(c: Company, adjustedRows: Company["rows"]): Company {
  const p = nextPeriod(c.period);
  const closeYear = startsFiscalYear(p.start, c.settings.fiscalYearEnd);
  const opening = openingBalances(adjustedRows, closeYear);
  const rows: TBRow[] = adjustedRows.map((r) => ({ ...r, priorDebit: r.currentDebit, priorCredit: r.currentCredit, currentDebit: 0, currentCredit: 0, sourceDocId: undefined, mappingRule: r.mappingRule ?? "roll-forward" }));
  // Balance-sheet accounts open at their brought-forward balance; P&L opens at zero at a year end.
  const byCode = new Map(opening.map((o) => [o.code, o]));
  const seeded = rows.map((r) => ({ ...r, currentDebit: byCode.get(r.code)?.currentDebit ?? 0, currentCredit: byCode.get(r.code)?.currentCredit ?? 0 }));
  for (const o of opening) if (!rows.some((r) => r.code === o.code)) seeded.push(o);
  return {
    ...c,
    history: [...c.history, { id: uid("hist"), label: c.period.currentLabel, start: c.period.start, end: c.period.end, status: c.period.status, lockedAt: c.period.lockedAt, lockedBy: c.period.lockedBy, rows: adjustedRows, ajes: c.ajes, archivedAt: new Date().toISOString() }],
    period: { ...c.period, start: p.start, end: p.end, currentLabel: p.currentLabel, priorLabel: p.priorLabel, status: "DRAFT", lockedAt: null, lockedBy: null, mappingConfirmed: false },
    rows: seeded,
    opening,
    ajes: [],
    docs: [],
    subledgers: { ar: [], ap: [], far: c.subledgers.far, inventory: [], payroll: [], bank: [], eta: [], gl: [] },
    disclosures: {},
    model: null,
  };
}
