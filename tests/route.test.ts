import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleCompany } from "../lib/workspace/sampleCompany";

const streamText = vi.fn();
const generateText = vi.fn();
vi.mock("ai", () => ({
  streamText: (opts: unknown) => streamText(opts),
  generateText: (opts: unknown) => generateText(opts),
  gateway: (id: string) => ({ id }),
  Output: { object: (o: unknown) => o },
}));

const explain = await import("../app/api/explain/route");
const map = await import("../app/api/map/route");
const exp = await import("../app/api/export/route");

function partsStream(parts: Array<Record<string, unknown>>) {
  return {
    stream: (async function* () {
      for (const p of parts) yield p;
    })(),
  };
}

const req = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const company = () => JSON.parse(JSON.stringify(sampleCompany()));

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
    expect((await (await explain.GET()).json()).configured).toBe(false);
    expect((await explain.POST(req({ company: company() }))).status).toBe(503);
  });

  it("rejects invalid input", async () => {
    expect((await explain.POST(req({ company: { id: "x", rows: "nope" } }))).status).toBe(400);
    expect((await explain.POST(req({ module: "nope", company: company() }))).status).toBe(400);
  });

  it("streams text and sends only server-computed facts for the module", async () => {
    streamText.mockReturnValue(partsStream([{ type: "start" }, { type: "text-delta", text: "Hello " }, { type: "text-delta", text: "world" }]));
    const res = await explain.POST(req({ module: "tax", language: "ar", company: company() }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello world");
    const opts = streamText.mock.calls[0][0];
    expect(opts.model).toEqual({ id: "anthropic/claude-sonnet-5.5" });
    expect(opts.prompt).toContain("Arabic");
    expect(opts.prompt).toContain("book-to-tax");
    expect(opts.prompt).toContain('"thinCap"');
    expect(opts.system).toContain("Use only the figures");
  });

  it("recomputes figures instead of trusting client totals", async () => {
    streamText.mockReturnValue(partsStream([{ type: "text-delta", text: "ok" }]));
    const c = company();
    c.rows[0].currentDebit += 1000; // unbalance the TB
    await explain.POST(req({ module: "overview", company: c }));
    expect(streamText.mock.calls[0][0].prompt).toContain('"unbalanced"');
  });

  it("turns an upfront gateway failure into a 502 with a message", async () => {
    streamText.mockReturnValue(partsStream([{ type: "error", error: new Error("Invalid API key") }]));
    const res = await explain.POST(req({ company: company() }));
    expect(res.status).toBe(502);
    expect((await res.json()).message).toBe("Invalid API key");
  });

  it("marks a stream interrupted midway", async () => {
    streamText.mockReturnValue(partsStream([{ type: "text-delta", text: "Partial" }, { type: "error", error: new Error("timeout") }]));
    const res = await explain.POST(req({ company: company() }));
    expect(await res.text()).toBe("Partial\n\n[Explanation interrupted: timeout]");
  });
});

describe("/api/map", () => {
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = "test";
  });
  it("returns only suggestions for submitted accounts", async () => {
    generateText.mockResolvedValue({ output: { mappings: [{ code: "9001", category: "CASH", confidence: 80, rationale: "bank" }, { code: "evil", category: "CASH", confidence: 99, rationale: "" }] } });
    const res = await map.POST(req({ accounts: [{ code: "9001", name: "Bank Misr current", balance: 10 }] }));
    expect((await res.json()).mappings).toEqual([{ code: "9001", category: "CASH", confidence: 80, rationale: "bank" }]);
  });
});

describe("/api/export", () => {
  it("returns an xlsx workbook", async () => {
    const res = await exp.POST(req({ company: company() }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x50); // "PK" zip header
    expect(buf[1]).toBe(0x4b);
  });
});
