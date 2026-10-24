import { describe, expect, it } from "vitest";
import { canAdvance, computeCompany } from "../lib/workspace/compute";
import { sampleCompany } from "../lib/workspace/sampleCompany";
import { migrateCompany } from "../lib/workspace/defaults";
import { moduleFacts, MODULES } from "../lib/ai/facts";

describe("sample company end to end", () => {
  const c = sampleCompany();
  const computed = computeCompany(c);
  if (!computed.analysis) throw new Error("sample has no analysis");
  const k = computed;

  it("ties every subledger to the TB except the deliberate ETA finding", () => {
    expect(k.analysis).not.toBeNull();
    const t = k.tieOuts;
    for (const key of ["ar", "ap", "farCost", "farAccumDep", "inventory"] as const) expect(t[key]?.ties, key).toBe(true);
    expect(t.eta?.difference).toBe(-150000); // ETA net sales below GL revenue
    expect(k.subledgers.bank?.difference).toBe(0);
    expect(k.subledgers.gl?.vsTb.exceptions).toBe(0);
  });

  it("passes reconciliation checks once mapping is confirmed", () => {
    expect(canAdvance(k.checks, "MAPPED")).toBe(false);
    const confirmed = computeCompany({ ...c, period: { ...c.period, mappingConfirmed: true } });
    expect(confirmed.analysis && canAdvance(confirmed.checks, "LOCKED")).toBe(true);
  });

  it("builds facts for every module", () => {
    for (const m of MODULES) {
      const facts = moduleFacts(m, c, k, { companies: [c, sampleCompany()], benchmarks: {}, audit: [] });
      expect(JSON.stringify(facts).length, m).toBeGreaterThan(50);
    }
  });

  it("migrates older saved companies", () => {
    const old = { id: "x", rows: [], settings: { tradeNameEn: "Old" } } as never;
    const m = migrateCompany(old);
    expect(m.settings.framework).toBe("EAS");
    expect(m.subledgers.gl).toEqual([]);
  });

  it("values the sample company once market inputs exist", () => {
    expect(k.valuation.wacc.available).toBe(true);
    expect(k.valuation.dcf?.gordon?.equityValue).toBeGreaterThan(0);
    expect(k.valuation.footballField.length).toBeGreaterThanOrEqual(3);
    expect(k.stress.fxReady).toBe(true);
    expect(k.stress.exposure.debt).toBe(5_000_000);
  });
});
