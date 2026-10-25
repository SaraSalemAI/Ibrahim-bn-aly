import { describe, expect, it, vi } from "vitest";
import { answerOffline, routeQuestion, toMarkdown } from "@/lib/agent/offline";
import { buildAgentTools, type AgentTools } from "@/lib/agent/tools";
import { fromSearchResult, searchIssued, windows } from "@/lib/eta/client";
import * as Sync from "@/lib/sync/supabase";
import { newWorkspace } from "@/lib/workspace/defaults";
import { rollForwardCompany, snapshotPack } from "@/lib/workspace/period";
import { computeCompany } from "@/lib/workspace/compute";
import { sampleCompany } from "@/lib/workspace/sampleCompany";
import type { SyncSettings } from "@/lib/workspace/types";

const opts = { toolCallId: "t", messages: [] } as never;
const run = (tools: AgentTools, name: keyof AgentTools, input: unknown = {}) =>
  (tools[name].execute as unknown as (i: unknown, o: unknown) => Promise<Record<string, unknown>>)(input, opts);

describe("new agent tools", () => {
  const c = sampleCompany();
  const tools = buildAgentTools(c, [], [])!;
  it("searches the GL and ranks counterparties", async () => {
    const all = await run(tools, "search_gl", { limit: 5 });
    expect(all.matches).toBe(c.subledgers.gl.length);
    expect((all.lines as unknown[]).length).toBe(5);
    const cust = (await run(tools, "get_top_counterparties", { side: "customers", limit: 3 })) as unknown as Array<{ customer: string; open: number }>;
    expect(cust[0]).toMatchObject({ customer: "Delta Retail SAE", open: 2_100_000 });
    const review = await run(tools, "get_close_review", { severity: "all" });
    expect(Array.isArray(review.anomalies)).toBe(true);
    expect(await run(tools, "get_trends")).toHaveProperty("error");
    expect(await run(tools, "get_consolidation")).toHaveProperty("error");
  });

  it("routes offline questions to tools and renders tables", async () => {
    expect(routeQuestion("Who are my top 5 customers?", "2025-12-31")).toEqual([{ name: "get_top_counterparties", input: { side: "customers", limit: 5 } }]);
    expect(routeQuestion('find "rent" entries over 10,000', "2025-12-31")[0]).toEqual({ name: "search_gl", input: { limit: 25, text: "rent", minAmount: 10000 } });
    expect(routeQuestion("ما الذي يبدو غير سليم؟", "2025-12-31")[0].name).toBe("get_close_review");
    expect(routeQuestion("hello", "2025-12-31")[0].name).toBe("get_overview");
    expect(toMarkdown([{ a: 1, b: "x|y" }])).toBe("| a | b |\n| --- | --- |\n| 1 | x/y |\n");
    const r = await answerOffline("top suppliers", c, [], [], "en");
    expect(r.calls[0].name).toBe("get_top_counterparties");
    expect(r.text).toContain("Nile Packaging Co");
  });
});

describe("period lock and roll-forward", () => {
  it("freezes a hashed board pack and rolls into the next year with opening balances", () => {
    const c = sampleCompany();
    const pack = snapshotPack(c, "Sara");
    expect(pack.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(pack.company.subledgers.gl).toEqual([]);
    const k = computeCompany(c);
    const next = rollForwardCompany(c, k.rows);
    expect(next.period).toMatchObject({ start: "2026-01-01", end: "2026-12-31", currentLabel: "FY2026", priorLabel: "FY2025", status: "DRAFT" });
    expect(next.history).toHaveLength(1);
    const a = computeCompany(next).analysis!;
    expect(a.current.revenue).toBe(0);
    expect(a.prior?.revenue).toBe(k.analysis!.current.revenue);
    expect(a.current.balanceCheck).toBeCloseTo(0, 2);
    expect(a.current.cash).toBe(k.analysis!.current.cash);
  });
});

describe("ETA portal client", () => {
  it("signs in, pages through 30-day windows and maps documents", async () => {
    expect(windows("2025-01-01", "2025-03-31")).toHaveLength(3);
    const calls: string[] = [];
    const f = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("/connect/token")) return Response.json({ access_token: "tok" });
      const page2 = url.includes("continuationToken=next");
      return Response.json({
        result: [{ uuid: page2 ? "U2" : "U1", internalId: "INV1", typeName: "i", dateTimeIssued: "2025-01-05T10:00:00Z", netAmount: 100, total: 114 }],
        metadata: { continuationToken: url.includes("2025-01-01") && !page2 ? "next" : "EndofResultSet" },
      });
    }) as unknown as typeof fetch;
    const r = await searchIssued({ clientId: "a", clientSecret: "b", env: "preprod" }, "2025-01-01", "2025-01-31", f);
    expect(r.documents.map((d) => d.uuid)).toEqual(["U1", "U2"]);
    expect(r.documents[0]).toMatchObject({ type: "I", vat: 14, dateIssued: "2025-01-05" });
    expect(calls[0]).toBe("https://id.preprod.eta.gov.eg/connect/token");
    expect(fromSearchResult({ typeName: "c", netAmount: 50, total: 57 }).type).toBe("C");
  });
});

describe("team sync", () => {
  const s: SyncSettings = { url: "https://x.supabase.co/", anonKey: "anon", email: "a@b.c", workspaceKey: "nile", accessToken: "jwt", refreshToken: "r", remoteVersion: 3, lastSyncedAt: null, auto: false };
  it("refuses a save when someone else saved first, and strips sign-in from the shared copy", async () => {
    let body: Record<string, unknown> = {};
    let url = "";
    const f = vi.fn(async (u: string, init?: RequestInit) => {
      url = u;
      body = JSON.parse(String(init?.body ?? "{}"));
      return Response.json([]);
    }) as unknown as typeof fetch;
    const ws = { ...newWorkspace(), sync: s };
    expect(await Sync.push(s, ws, f)).toEqual({ ok: false, conflict: true });
    expect(url).toBe("https://x.supabase.co/rest/v1/workspace_snapshots?workspace_key=eq.nile&version=eq.3");
    expect(body.version).toBe(4);
    expect((body.data as { sync: unknown }).sync).toBeNull();
    const ok = vi.fn(async () => Response.json([{ version: 4 }])) as unknown as typeof fetch;
    expect(await Sync.push(s, ws, ok)).toEqual({ ok: true, version: 4 });
  });
});
