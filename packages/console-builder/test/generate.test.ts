// File and prompt generation — prepared by Sara Salem. Copyright (c) Sara Salem 2026.
import { describe, expect, it } from "vitest";
import { buildFromSpec, buildPrompt, extractJson, loadFile, parseDelimited, parseSpec, specFromDatasets, type SpecContext } from "../src/index";

const CSV = `region,product,units,revenue\nCairo,Tea,120,"1,800"\nAlex,Coffee,80,2400\n"Giza, West",Tea,45,675\nCairo,Coffee,200,6000\n`;
const ctx = (): SpecContext => ({ vars: {}, setVar: () => {}, clear: () => {}, open: () => {}, fetch: async () => ({ ok: false, status: 0, text: async () => "" }), history: () => [] });
const text = async (spec: ReturnType<typeof specFromDatasets>, line: string) => {
  const r = await buildFromSpec(spec).execute(line, ctx());
  return { code: r.code, out: JSON.stringify(r.output) };
};

describe("parseDelimited", () => {
  it("handles quotes, commas in fields and numbers", () => {
    const rows = parseDelimited(CSV);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ region: "Cairo", product: "Tea", units: 120, revenue: 1800 });
    expect(rows[2].region).toBe("Giza, West");
    expect(parseDelimited("a\tb\n1\t2\n")).toEqual([{ a: 1, b: 2 }]);
  });
});

describe("loadFile", () => {
  it("recognises specs, record arrays, CSV and plain text", () => {
    expect(loadFile("c.json", JSON.stringify({ name: "x", commands: [] })).kind).toBe("spec");
    const arr = loadFile("People List.json", JSON.stringify({ items: [{ name: "Sara", tags: ["a"] }] }));
    expect(arr).toMatchObject({ kind: "data", dataset: "people_list", rows: [{ name: "Sara", tags: '["a"]' }] });
    expect(loadFile("sales.csv", CSV)).toMatchObject({ kind: "data", dataset: "sales" });
    const notes = loadFile("notes.md", "# Title\n\nline two\n");
    expect(notes.kind === "data" && notes.rows).toEqual([{ line: 1, text: "# Title" }, { line: 3, text: "line two" }]);
    expect(() => loadFile("bad.json", "{oops")).toThrow(/not valid JSON/);
  });
});

describe("specFromDatasets", () => {
  const spec = specFromDatasets({ sales: parseDelimited(CSV) }, "sales");
  it("produces a valid console", () => {
    expect(parseSpec(spec).ok).toBe(true);
  });
  it("browses, searches, filters, sorts and summarises", async () => {
    expect((await text(spec, "rows -n 2")).out).toMatch(/2 of 4 matching rows/);
    expect((await text(spec, "find coffee")).out).toMatch(/2 of 2/);
    expect((await text(spec, "where region=cairo and units>150")).out).toMatch(/6000/);
    const top = (await text(spec, "top revenue -n 1")).out;
    expect(top).toMatch(/6000/);
    expect((await text(spec, "top revenue -n 1 --no-desc")).out).toMatch(/675/);
    expect((await text(spec, "stats revenue")).out).toMatch(/"Sum","10,875"/);
    expect((await text(spec, "stats product")).out).toMatch(/"Tea",2/);
    expect((await text(spec, "columns")).out).toMatch(/"units","number"/);
    expect((await text(spec, "where nope=1")).code).toBe(1);
  });
  it("prefixes commands when there are several datasets", () => {
    const multi = specFromDatasets({ a: [{ x: 1 }], b: [{ y: 2 }] });
    expect(multi.commands.map((c) => c.name)).toContain("b stats");
    expect(() => buildFromSpec(multi)).not.toThrow();
  });
});

describe("prompt helpers", () => {
  it("describes datasets without copying them", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const p = buildPrompt("a sales console", { big: rows });
    expect(p).toMatch(/big \(100 rows\), columns: id/);
    expect(p).not.toMatch(/"id":99/);
  });
  it("extracts JSON from fenced or chatty answers", () => {
    expect(extractJson('Here:\n```json\n{"name":"a","commands":[]}\n```')).toEqual({ name: "a", commands: [] });
    expect(extractJson('sure {"name":"b","commands":[]} done')).toEqual({ name: "b", commands: [] });
    expect(() => extractJson("no json")).toThrow();
  });
});
