import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseTrialBalance } from "../lib/finance/parse";
import { SAMPLE_TB_CSV } from "../lib/finance/sample";

const streamText = vi.fn();
vi.mock("ai", () => ({ streamText: (opts: unknown) => streamText(opts), gateway: (id: string) => ({ id }) }));

const { POST, GET } = await import("../app/api/explain/route");

function partsStream(parts: Array<Record<string, unknown>>) {
  return {
    stream: (async function* () {
      for (const p of parts) yield p;
    })(),
  };
}

const post = (body: unknown) =>
  POST(new Request("http://x/api/explain", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

const rows = parseTrialBalance(SAMPLE_TB_CSV).rows;

describe("/api/explain", () => {
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = "test";
    streamText.mockReset();
  });
  afterEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("reports not configured without a gateway credential", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    expect((await (await GET()).json()).configured).toBe(false);
    expect((await post({ rows })).status).toBe(503);
  });

  it("rejects invalid input", async () => {
    expect((await post({ rows: [] })).status).toBe(400);
  });

  it("streams text and sends only engine-computed facts to the model", async () => {
    streamText.mockReturnValue(partsStream([{ type: "start" }, { type: "text-delta", text: "Hello " }, { type: "text-delta", text: "world" }]));
    const res = await post({ rows, language: "ar", focus: "ratios", companyName: "Nile" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello world");
    const opts = streamText.mock.calls[0][0];
    expect(opts.model).toEqual({ id: "anthropic/claude-sonnet-5.5" });
    expect(opts.prompt).toContain("Arabic");
    expect(opts.prompt).toContain('"netProfit"');
    expect(opts.prompt).toContain("2867500");
    expect(opts.system).toContain("Use only the figures");
  });

  it("turns an upfront gateway failure into a 502 with a message", async () => {
    streamText.mockReturnValue(partsStream([{ type: "error", error: new Error("Invalid API key") }]));
    const res = await post({ rows });
    expect(res.status).toBe(502);
    expect((await res.json()).message).toBe("Invalid API key");
  });

  it("marks a stream interrupted midway", async () => {
    streamText.mockReturnValue(partsStream([{ type: "text-delta", text: "Partial" }, { type: "error", error: new Error("timeout") }]));
    const res = await post({ rows });
    expect(await res.text()).toBe("Partial\n\n[Explanation interrupted: timeout]");
  });
});
