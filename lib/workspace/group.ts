import { consolidate } from "../finance/consolidation";
import { analyze } from "../finance/engine";
import { computeCompany } from "./compute";
import { newCompany, uid } from "./defaults";
import type { Company, Group } from "./types";

/** Consolidates a group from its members' adjusted trial balances (after AJEs and framework bridge entries). */
export function consolidateGroup(companies: Company[], group: Group) {
  const members = group.members
    .map((m) => ({ m, c: companies.find((c) => c.id === m.companyId) }))
    .filter((x): x is { m: Group["members"][number]; c: Company } => !!x.c && x.c.rows.length > 0);
  const entities = members.map(({ m, c }) => ({
    id: c.id,
    name: c.settings.tradeNameEn || c.id,
    ownership: c.id === group.parentId ? 1 : Math.min(1, Math.max(0, m.ownership)),
    isParent: c.id === group.parentId,
    rows: computeCompany(c).rows,
    intercompanyCodes: c.intercompanyCodes,
  }));
  const result = consolidate(entities);
  return { ...result, entities, analysis: result.rows.length ? analyze(result.rows) : null, missing: group.members.filter((m) => !members.some((x) => x.m.companyId === m.companyId)).map((m) => m.companyId) };
}

/** A company holding the consolidated trial balance, so every module (statements, ratios, model, board pack) runs on the group. */
export function consolidatedCompany(parent: Company, group: Group, rows: Company["rows"]): Company {
  const c = newCompany(`${group.name} (consolidated)`);
  return {
    ...c,
    id: uid("grp"),
    settings: { ...parent.settings, tradeNameEn: `${group.name} (consolidated)`, tradeNameAr: parent.settings.tradeNameAr ? `${parent.settings.tradeNameAr} (مجمعة)` : "" },
    period: { ...parent.period, status: "DRAFT", lockedAt: null, lockedBy: null, mappingConfirmed: true },
    rows: rows.map((r) => ({ ...r, suggested: false })),
  };
}
