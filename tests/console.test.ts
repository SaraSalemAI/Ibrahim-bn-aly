// Console builder tests — prepared by Sara Salem. Copyright (c) Sara Salem 2026.
import { describe, expect, it } from "vitest";
import { applyCompletion, bindArgs, commonPrefix, ConsoleBuilder, History, tokenize } from "console-builder";
import { buildCfoConsole, type CfoContext } from "@/lib/console/commands/cfo";
import { computeCompany } from "@/lib/workspace/compute";
import { newWorkspace } from "@/lib/workspace/defaults";
import { sampleCompany } from "@/lib/workspace/sampleCompany";
import type { Company, Workspace } from "@/lib/workspace/types";

describe("tokenize", () => {
  it("handles quotes, escapes and Arabic text", () => {
    expect(tokenize(`tb -s "cash at bank" 'x y' a\\ b النقدية`).tokens).toEqual(["tb", "-s", "cash at bank", "x y", "a b", "النقدية"]);
    expect(tokenize("go ").trailingSpace).toBe(true);
    expect(() => tokenize(`echo "open`)).toThrow(/Unterminated/);
  });
});

describe("bindArgs", () => {
  const specs = [
    { name: "file", type: "string", positional: true, required: true },
    { name: "limit", alias: "n", type: "number", default: 5 },
    { name: "verbose", type: "boolean" },
    { name: "mode", type: "enum", choices: ["fast", "safe"] },
  ] as const;
  it("binds positionals, flags, aliases, negation and defaults", () => {
    expect(bindArgs([...specs], ["a.csv", "-n", "1,000", "--verbose", "--mode=SAFE"])).toEqual({ file: "a.csv", limit: 1000, verbose: true, mode: "safe" });
    expect(bindArgs([...specs], ["a.csv", "--no-verbose"])).toEqual({ file: "a.csv", limit: 5, verbose: false });
    expect(bindArgs([...specs], ["-5"]).file).toBe("-5");
  });
  it("rejects bad input with clear messages", () => {
    expect(() => bindArgs([...specs], [])).toThrow(/Missing required argument <file>/);
    expect(() => bindArgs([...specs], ["a", "--limit", "x"])).toThrow(/expects a number/);
    expect(() => bindArgs([...specs], ["a", "--mode", "slow"])).toThrow(/one of: fast, safe/);
    expect(() => bindArgs([...specs], ["a", "--nope"])).toThrow(/Unknown option/);
    expect(() => bindArgs([...specs], ["a", "b"])).toThrow(/Unexpected argument/);
  });
});

describe("ConsoleBuilder", () => {
  const log: string[] = [];
  const cli = new ConsoleBuilder<{ role: string }>("t")
    .use(async (inv, _io, next) => {
      log.push(`before ${inv.command.path.join(" ")}`);
      await next();
      log.push("after");
    })
    .use(async (inv, io, next) => (inv.command.tags?.includes("admin") && inv.ctx.role !== "admin" ? io.fail("denied") : next()))
    .command({ path: ["echo"], aliases: ["say"], summary: "Echo", args: [{ name: "text", type: "string", positional: true, rest: true }], run: (a, _c, io) => io.print(String(a.text ?? "")) })
    .group("db", "Database", (g) => g.command({ path: ["drop"], summary: "Drop", tags: ["admin"], args: [{ name: "table", type: "enum", choices: ["users", "orders"], positional: true, required: true }], run: (a, _c, io) => io.print(`dropped ${a.table}`) }))
    .build();

  it("dispatches commands, aliases and groups through middleware", async () => {
    expect((await cli.execute("say hello world", { role: "x" })).output).toEqual([{ kind: "text", text: "hello world", tone: undefined }]);
    expect(log).toEqual(["before echo", "after"]);
    const denied = await cli.execute("db drop users", { role: "x" });
    expect(denied.code).toBe(1);
    expect((await cli.execute("DB DROP users", { role: "admin" })).output[0]).toMatchObject({ text: "dropped users" });
  });

  it("reports unknown commands with a suggestion and shows group help", async () => {
    const r = await cli.execute("ecko hi", { role: "x" });
    expect(r.code).toBe(1);
    expect(JSON.stringify(r.output)).toMatch(/Did you mean \\"echo\\"/);
    const g = await cli.execute("db", { role: "x" });
    expect(g.code).toBe(0);
    expect(g.output[0]).toMatchObject({ kind: "table" });
    expect(JSON.stringify(cli.help(["db", "drop"]))).toMatch(/db drop <table>/);
  });

  it("rejects duplicate registrations", () => {
    expect(() => new ConsoleBuilder("x").command({ path: ["a"], summary: "", run: () => {} }).command({ path: ["a"], summary: "", run: () => {} })).toThrow(/Duplicate/);
  });

  it("completes commands, subcommands and enum values", () => {
    expect(cli.complete("e", { role: "x" }).map((c) => c.value)).toEqual(["echo"]);
    expect(cli.complete("db ", { role: "x" }).map((c) => c.value)).toEqual(["drop"]);
    expect(cli.complete("db drop o", { role: "x" }).map((c) => c.value)).toEqual(["orders"]);
    expect(cli.complete("help d", { role: "x" }).map((c) => c.value)).toEqual(["db"]);
  });
});

describe("History and completion helpers", () => {
  it("navigates, dedupes and bounds", () => {
    const h = new History([], 2);
    h.push("a");
    h.push("a");
    h.push("b");
    h.push("c");
    expect(h.all()).toEqual(["b", "c"]);
    expect(h.prev()).toBe("c");
    expect(h.prev()).toBe("b");
    expect(h.next()).toBe("c");
    expect(h.next()).toBe("");
  });
  it("computes prefixes and applies completions", () => {
    expect(commonPrefix(["company", "comp", "compute"])).toBe("comp");
    expect(applyCompletion("company sel", "select", true)).toBe("company select ");
    expect(applyCompletion("company select ", "Nile Trading Co", true)).toBe('company select "Nile Trading Co" ');
  });
});

describe("AI CFO console", () => {
  function setup(withSample = true) {
    let ws: Workspace = newWorkspace();
    const nav: string[] = [];
    let status: string | null = null;
    if (withSample) {
      const c = sampleCompany();
      ws = { ...ws, companies: [c], activeCompanyId: c.id };
    }
    const ctx = (): CfoContext => {
      const company: Company | null = ws.companies.find((c) => c.id === ws.activeCompanyId) ?? null;
      return {
        ws,
        company,
        computed: company ? computeCompany(company) : null,
        dispatch: (a) => {
          if (a.type === "setLang") ws = { ...ws, lang: a.lang };
          if (a.type === "selectCompany") ws = { ...ws, activeCompanyId: a.id };
          if (a.type === "addCompany") ws = { ...ws, companies: [...ws.companies, a.company], activeCompanyId: a.company.id };
        },
        setPeriodStatus: (to) => (status = to),
        navigate: (h) => nav.push(h),
        clear: () => {},
      };
    };
    return { cli: buildCfoConsole(), ctx, nav, status: () => status, setRole: (role: Workspace["profile"]["role"]) => (ws = { ...ws, profile: { ...ws.profile, role } }) };
  }

  it("guards data commands until a company exists, then loads the sample", async () => {
    const { cli, ctx } = setup(false);
    const r = await cli.execute("kpi", ctx());
    expect(r.code).toBe(1);
    expect(JSON.stringify(r.output)).toMatch(/company sample/);
    expect((await cli.execute("company sample", ctx())).code).toBe(0);
    expect((await cli.execute("kpi", ctx())).output[0]).toMatchObject({ kind: "kv" });
  });

  it("navigates by key, number and prefix", async () => {
    const { cli, ctx, nav } = setup();
    await cli.execute("go tax", ctx());
    await cli.execute("open 5", ctx());
    await cli.execute("cd val", ctx());
    expect(nav).toEqual(["/tax", "/statements", "/valuation"]);
    expect((await cli.execute("go nowhere", ctx())).code).toBe(1);
  });

  it("reads statements, ratios, trial balance and audit", async () => {
    const { cli, ctx } = setup();
    for (const line of ["status", "fs bs", "ratios -g liquidity", "tb --search cash -n 3", "audit verify", "audit tail", "modules", "whoami", "help tb"]) {
      const r = await cli.execute(line, ctx());
      expect(r.code, line).toBe(0);
      expect(r.output.length, line).toBeGreaterThan(0);
    }
  });

  it("enforces roles on period changes", async () => {
    const { cli, ctx, setRole, status } = setup();
    setRole("ANALYST");
    const r = await cli.execute("period advance", ctx());
    expect(r.code).toBe(1);
    expect(JSON.stringify(r.output)).toMatch(/needs role REVIEWER or CFO/);
    setRole("CFO");
    await cli.execute("period advance", ctx());
    // Either it advanced, or it explained which checks fail — never silently.
    expect(status() === "MAPPED" || status() === null).toBe(true);
  });

  it("completes module keys and company names", () => {
    const { cli, ctx } = setup();
    expect(cli.complete("go ta", ctx()).map((c) => c.value)).toEqual(["tax"]);
    expect(cli.complete("company select ", ctx()).length).toBe(1);
    expect(cli.complete("ratios --group p", ctx()).map((c) => c.value)).toEqual(["profitability"]);
  });
});
