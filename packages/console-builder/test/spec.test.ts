// Generic console builder tests — prepared by Sara Salem. Copyright (c) Sara Salem 2026.
import { describe, expect, it } from "vitest";
import { calc } from "../src/index";
import { buildFromSpec, interpolate, parseSpec, type ConsoleSpec, type SpecContext } from "../src/index";
import { TEMPLATES } from "../src/index";
import { splitChain } from "../src/index";

function harness(spec: ConsoleSpec, responses: Record<string, unknown> = {}) {
  const vars: Record<string, string> = { ...(spec.vars ?? {}) };
  const opened: string[] = [];
  const ctx: SpecContext = {
    vars,
    setVar: (n, v) => (v === null ? delete vars[n] : (vars[n] = v)),
    clear: () => {},
    open: (u) => opened.push(u),
    fetch: async (url) => {
      const hit = responses[url];
      return { ok: hit !== undefined, status: hit === undefined ? 404 : 200, text: async () => JSON.stringify(hit ?? {}) };
    },
    history: () => [],
  };
  const cli = buildFromSpec(spec);
  const run = (line: string) => cli.execute(line, ctx);
  const text = async (line: string) => JSON.stringify((await run(line)).output);
  return { cli, run, text, vars, opened };
}

describe("calc", () => {
  it("evaluates with precedence, powers, functions, constants and variables", () => {
    expect(calc("1 + 2 * 3")).toBe(7);
    expect(calc("(1 + 2) * 3")).toBe(9);
    expect(calc("2 ^ 3 ^ 2")).toBe(512);
    expect(calc("-2 ^ 2")).toBe(-4);
    expect(calc("1,000 * 1.5")).toBe(1500);
    expect(calc("round(sqrt(2), 3) + max(1, 4, 2)")).toBe(5.414);
    expect(calc("rate * 100", { rate: "0.14" })).toBeCloseTo(14);
    expect(calc("$rate", { rate: "2" })).toBe(2);
    expect(calc("round(pi, 2)")).toBe(3.14);
  });
  it("rejects unsafe or malformed input", () => {
    expect(() => calc("alert(1)")).toThrow(/Unknown function/);
    expect(() => calc("1 / 0")).toThrow(/Division by zero/);
    expect(() => calc("2 +")).toThrow();
    expect(() => calc("x")).toThrow(/Unknown name/);
    expect(() => calc("1; process.exit()")).toThrow();
  });
});

describe("chaining", () => {
  it("splits on && and ; outside quotes", () => {
    expect(splitChain(`a && b ; "c && d"`)).toEqual([
      { text: "a", op: null },
      { text: "b", op: "&&" },
      { text: '"c && d"', op: ";" },
    ]);
  });
  it("stops on && after a failure but continues on ;", async () => {
    const h = harness({ name: "t", commands: [{ name: "ok", action: { type: "print", text: "fine" } }] });
    const a = await h.text("nope && ok");
    expect(a).not.toMatch(/fine/);
    const b = await h.text("nope ; ok");
    expect(b).toMatch(/fine/);
  });
});

describe("spec validation", () => {
  it("reports precise errors", () => {
    const r = parseSpec({ name: "", commands: [{ name: "x" }, { name: "y", action: { type: "nope" } }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/name/);
      expect(r.errors.join("\n")).toMatch(/commands\.0/);
      expect(r.errors.join("\n")).toMatch(/commands\.1\.action/);
    }
  });
  it("interpolates args and vars, leaving unknown vars visible", () => {
    expect(interpolate("Hi {name} in {$env} {$missing} {nope}", { name: "Sara" }, { env: "prod" })).toBe("Hi Sara in prod {$missing} ");
  });
});

describe("spec consoles", () => {
  it("every template builds and every command has help", () => {
    for (const t of TEMPLATES) {
      const cli = buildFromSpec(t.spec);
      expect(cli.commands().length, t.id).toBeGreaterThan(5);
      for (const c of cli.commands()) expect(cli.usage(c)).toContain(c.path.join(" "));
    }
  });

  it("runs the finance template end to end", async () => {
    const h = harness(TEMPLATES.find((t) => t.id === "finance")!.spec);
    expect(await h.text("loan 500000 0.18 5")).toMatch(/12696\.\d\d/);
    expect(h.vars.payment).toMatch(/^12696/);
    expect(await h.text("vat 1000")).toMatch(/1140\.00/);
    expect(await h.text("set usd 48.5 && fx convert 100 usd")).toMatch(/4850\.00/);
    expect(await h.text("margin 100 60")).toMatch(/40\.0/);
  });

  it("supports builtins, variables, enums, macros, http and open", async () => {
    const h = harness(TEMPLATES.find((t) => t.id === "devops")!.spec, { "https://api.github.com": { current_user_url: "x" } });
    expect(await h.text("env use production")).toMatch(/production/);
    expect(h.vars.env).toBe("production");
    expect((await h.run("env use moon")).code).toBe(1);
    const rb = await h.run("runbook deploy");
    expect(rb.code).toBe(0);
    expect(JSON.stringify(rb.output)).toMatch(/current_user_url/);
    await h.run("docs fetch");
    expect(h.opened[0]).toMatch(/q=fetch$/);
    expect(await h.text("calc 2 * (3 + 4)")).toMatch(/"14"/);
    expect(await h.text("vars")).toMatch(/production/);
  });

  it("reports HTTP failures and guards runaway macros", async () => {
    const h = harness({
      name: "t",
      commands: [
        { name: "bad", action: { type: "http", url: "https://example.invalid/x" } },
        { name: "local", action: { type: "http", url: "file:///etc/passwd" } },
        { name: "loop", action: { type: "run", commands: ["loop"] } },
      ],
    });
    expect((await h.run("bad")).code).toBe(1);
    expect(await h.text("local")).toMatch(/http\(s\) URL/);
    const r = await h.run("loop");
    expect(r.code).toBe(1);
    expect(JSON.stringify(r.output)).toMatch(/too deep/);
  });

  it("lets a spec override a builtin", async () => {
    const h = harness({ name: "t", commands: [{ name: "echo", action: { type: "print", text: "custom" } }] });
    expect(await h.text("echo")).toMatch(/custom/);
  });
});
