import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentTools, type AgentTools } from "../lib/agent/tools";
import { sampleCompany } from "../lib/workspace/sampleCompany";
import { newCompany } from "../lib/workspace/defaults";

const opts = { toolCallId: "t", messages: [] } as never;
const run = (tools: AgentTools, name: keyof AgentTools, input: unknown = {}) =>
  (tools[name].execute as unknown as (i: unknown, o: unknown) => Promise<Record<string, unknown>>)(input, opts);

describe("agent tools", () => {
  const company = sampleCompany();
  const tools = buildAgentTools(company, [sampleCompany()])!;

  it("returns null without a trial balance", () => {
    expect(buildAgentTools(newCompany())).toBeNull();
  });

  it("exposes the expected tools", () => {
    expect(Object.keys(tools).sort()).toEqual(
      [
        "compare_peers", "find_accounts", "get_budget_vs_actual", "get_disclosures", "get_overview", "get_ratios", "get_statement",
        "get_subledger", "get_tax_computation", "get_variances", "propose_adjusting_entry", "propose_mapping_change", "run_forecast",
        "run_sensitivity", "run_stress_test", "run_valuation",
      ].sort(),
    );
  });

  it("reads overview, statements, ratios and variances from the engines", async () => {
    const o = await run(tools, "get_overview");
    expect((o.figures as Record<string, number>).netProfit).toBe(2_867_500);
    const pl = (await run(tools, "get_statement", { statement: "income" })) as unknown as Array<{ line: string; current: number }>;
    expect(pl.find((l) => l.line === "revenue")?.current).toBe(38_000_000);
    const cf = await run(tools, "get_statement", { statement: "cashflow" });
    expect(cf.tieOutDifference).toBe(0);
    const v = (await run(tools, "get_variances", { statement: "both", materialOnly: true })) as unknown as unknown[];
    expect(v.length).toBeGreaterThan(0);
    const r = await run(tools, "get_ratios", { group: "liquidity", includeScores: true });
    expect((r.ratios as unknown[]).length).toBe(3);
    expect(r.altmanZDoublePrime).toBeTruthy();
  });

  it("searches accounts in Arabic and reports lineage", async () => {
    const res = (await run(tools, "find_accounts", { query: "العملاء", limit: 5 })) as unknown as Array<Record<string, unknown>>;
    expect(res[0]).toMatchObject({ code: "1201", category: "RECEIVABLES", source: "sample-trial-balance.csv" });
  });

  it("reads subledgers and reports what is missing", async () => {
    const eta = await run(tools, "get_subledger", { kind: "eta" });
    expect(eta.difference).toBe(150000);
    const empty = buildAgentTools({ ...company, subledgers: { ...company.subledgers, ar: [] } })!;
    expect(await run(empty, "get_subledger", { kind: "ar" })).toEqual({ error: "AR subledger not loaded" });
  });

  it("runs what-if forecasts without changing saved inputs", async () => {
    const before = JSON.stringify(company);
    const base = await run(tools, "run_forecast", { scenario: "base", overrides: {} });
    const slow = await run(tools, "run_forecast", { scenario: "base", overrides: { revenueGrowth: 0.05 } });
    const last = (x: Record<string, unknown>) => (x.periods as Array<{ revenue: number; balanceCheck: number }>).at(-1)!;
    expect(last(slow).revenue).toBeLessThan(last(base).revenue);
    expect(Math.abs(last(slow).balanceCheck)).toBeLessThan(0.05);
    expect(JSON.stringify(company)).toBe(before);
  });

  it("refuses valuation without market inputs and stress without FX rates", async () => {
    const bare = { ...company, valuation: { ...company.valuation, riskFreeRate: null }, stress: { ...company.stress, baseRate: null, shockedRate: null } };
    const t = buildAgentTools(bare)!;
    expect(await run(t, "run_valuation", { overrides: {} })).toMatchObject({ error: "Market inputs not provided", missing: ["riskFreeRate"] });
    expect((await run(t, "run_stress_test", {})).warning).toBeTruthy();
    const ok = await run(t, "run_valuation", { overrides: { riskFreeRate: 0.22 } });
    expect(ok.dcf).toBeTruthy();
  });

  it("drafts a balanced AJE with its impact, and rejects an unbalanced one", async () => {
    const good = await run(tools, "propose_adjusting_entry", {
      reason: "Accrue audit fees",
      lines: [
        { code: "6201", debit: 50000, credit: 0 },
        { code: "2301", debit: 0, credit: 50000 },
      ],
    });
    expect(good.proposal).toMatchObject({ type: "aje" });
    const impact = good.impact as { netProfit: { before: number; after: number }; balanceCheckAfter: number };
    expect(impact.netProfit.before - impact.netProfit.after).toBe(50000);
    expect(impact.balanceCheckAfter).toBe(0);
    const bad = await run(tools, "propose_adjusting_entry", { reason: "x x x", lines: [{ code: "6201", debit: 10, credit: 0 }, { code: "9999", debit: 0, credit: 5 }] });
    expect(bad.proposal).toBeNull();
    expect(bad.problems).toEqual(expect.arrayContaining(["Debits do not equal credits", "New account 9999 needs a name and category"]));
  });

  it("drafts mapping changes only for open periods", async () => {
    expect((await run(tools, "propose_mapping_change", { code: "1401", category: "OTHER_CURRENT_ASSET", rationale: "prepayment" })).proposal).toMatchObject({ type: "mapping", from: "OTHER_CURRENT_ASSET" });
    const locked = buildAgentTools({ ...company, period: { ...company.period, status: "LOCKED" } })!;
    expect((await run(locked, "propose_mapping_change", { code: "1401", category: "CASH", rationale: "x" })).proposal).toBeNull();
  });

  it("compares peers in the workspace", async () => {
    const res = await run(tools, "compare_peers");
    expect((res.companies as unknown[]).length).toBe(2);
  });
});

const streamText = vi.fn();
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), streamText: (o: unknown) => streamText(o), gateway: (id: string) => ({ id }) }));
const route = await import("../app/api/agent/route");

describe("/api/agent", () => {
  const req = (body: unknown) => new Request("http://x/api/agent", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const company = () => JSON.parse(JSON.stringify(sampleCompany()));
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = "test";
    streamText.mockReset();
  });
  afterEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("is not available without a gateway credential", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    expect((await route.POST(req({ company: company(), messages: [{ role: "user", content: "hi" }] }))).status).toBe(503);
  });

  it("requires the last message to come from the user", async () => {
    expect((await route.POST(req({ company: company(), messages: [{ role: "assistant", content: "hi" }] }))).status).toBe(400);
  });

  it("streams tool activity and text as NDJSON with a step limit and tools attached", async () => {
    streamText.mockReturnValue({
      stream: (async function* () {
        yield { type: "tool-call", toolCallId: "1", toolName: "get_overview", input: {} };
        yield { type: "tool-result", toolCallId: "1", toolName: "get_overview", input: {}, output: { ok: true } };
        yield { type: "finish-step" };
        yield { type: "text-delta", text: "Net profit is " };
        yield { type: "text-delta", text: "2,867,500 EGP." };
        yield { type: "finish-step" };
      })(),
    });
    const res = await route.POST(req({ company: company(), messages: [{ role: "user", content: "How much profit?" }] }));
    expect(res.headers.get("Content-Type")).toContain("ndjson");
    const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(events.map((e) => e.type)).toEqual(["tool-call", "tool-result", "text", "text", "done"]);
    expect(events.at(-1)).toEqual({ type: "done", steps: 2 });
    const opts = streamText.mock.calls[0][0];
    expect(Object.keys(opts.tools)).toContain("propose_adjusting_entry");
    expect(opts.system).toContain("Get every figure from a tool");
    expect(opts.stopWhen).toBeTruthy();
    expect(opts.messages).toEqual([{ role: "user", content: "How much profit?" }]);
  });

  it("reports gateway errors as an error event", async () => {
    streamText.mockReturnValue({
      stream: (async function* () {
        yield { type: "error", error: new Error("Invalid API key") };
      })(),
    });
    const events = (await (await route.POST(req({ company: company(), messages: [{ role: "user", content: "x" }] }))).text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(events[0]).toEqual({ type: "error", message: "Invalid API key" });
  });
});
