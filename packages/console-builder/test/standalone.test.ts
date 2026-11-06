// Standalone outputs: text rendering, HTML export, CLI — prepared by Sara Salem. Copyright (c) Sara Salem 2026.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderText, standaloneHtml, TEMPLATES } from "../src/index";

const CLI = join(__dirname, "../dist/cli.mjs");

describe("renderText", () => {
  it("renders text, aligned kv pairs and tables, with optional colour", () => {
    const out = renderText([
      { kind: "text", text: "done", tone: "ok" },
      { kind: "kv", pairs: [["a", 1], ["long key", null]] },
      { kind: "table", columns: ["Name", "Qty"], rows: [["Apples", 3], ["Kiwi", null]] },
    ]);
    expect(out).toBe(["done", "a         1", "long key  —", "Name    Qty", "──────  ───", "Apples  3", "Kiwi    —"].join("\n"));
    expect(renderText([{ kind: "text", text: "x", tone: "error" }], true)).toBe("\x1b[31mx\x1b[0m");
  });
});

describe("standaloneHtml", () => {
  it("embeds the spec and bundle safely", () => {
    const spec = { name: "x</script><b>", commands: [{ name: "hi", action: { type: "print" as const, text: "</script><script>alert(1)</script>" } }] };
    const html = standaloneHtml(spec, "window.ConsoleBuilder={mountConsole(){}};");
    expect(html).toContain("<title>x&lt;/script&gt;&lt;b&gt;</title>");
    expect(html.match(/<\/script>/g)!.length).toBe(2);
    expect(html).toContain("Sara Salem");
  });
  it("rejects invalid specs", () => {
    expect(() => standaloneHtml({ name: "", commands: [] }, "")).toThrow(/Invalid console spec/);
  });
});

describe.skipIf(!existsSync(CLI))("cli (built)", () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  it("execs commands with exit codes", () => {
    const ok = run("exec", "finance", "loan 500000 0.18 5");
    expect(ok.status).toBe(0);
    expect(ok.stdout).toMatch(/12696\.71/);
    expect(run("exec", "finance", "nope").status).toBe(1);
  });
  it("scaffolds, validates and exports", () => {
    const dir = mkdtempSync(join(tmpdir(), "cb-"));
    const file = join(dir, "c.json");
    execFileSync(process.execPath, [CLI, "init", "api", file]);
    expect(JSON.parse(readFileSync(file, "utf8")).name).toBe("api");
    expect(run("validate", file).stdout).toMatch(/✓ api/);
    const out = join(dir, "c.html");
    run("html", file, "-o", out);
    expect(readFileSync(out, "utf8")).toMatch(/ConsoleBuilder\.mountConsole/);
    expect(run("templates").stdout.split("\n").filter(Boolean)).toHaveLength(TEMPLATES.length);
  });
  it("drives the interactive console from stdin", () => {
    const r = spawnSync(process.execPath, [CLI, "run", "game"], { input: "set x 5\ncalc x * 2\nexit\n", encoding: "utf8", env: { ...process.env, NO_COLOR: "1", HOME: tmpdir() } });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/x = 5/);
    expect(r.stdout).toMatch(/\b10\b/);
  });
});
