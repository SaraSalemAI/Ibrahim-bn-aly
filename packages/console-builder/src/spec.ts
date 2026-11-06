// Console builder — declarative console specs: build any console from JSON.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { z } from "zod";
import { ConsoleBuilder, type BuiltConsole } from "./builder";
import { calc } from "./calc";
import { ConsoleError } from "./tokenize";
import type { ArgSpec, CommandIO, ParsedArgs } from "./types";

const tone = z.enum(["info", "ok", "warn", "error", "muted"]);
const cell = z.union([z.string(), z.number(), z.null()]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("print"), text: z.string(), tone: tone.optional() }),
  z.object({ type: z.literal("table"), columns: z.array(z.string()), rows: z.array(z.array(cell)) }),
  z.object({ type: z.literal("kv"), pairs: z.array(z.tuple([z.string(), cell])) }),
  z.object({ type: z.literal("calc"), expression: z.string(), label: z.string().optional(), saveAs: z.string().optional(), decimals: z.number().int().min(0).max(10).optional() }),
  z.object({ type: z.literal("set"), name: z.string(), value: z.string() }),
  z.object({ type: z.literal("http"), url: z.string(), method: z.enum(["GET", "POST"]).optional(), body: z.string().optional(), pick: z.string().optional(), as: z.enum(["json", "text", "table", "kv"]).optional(), saveAs: z.string().optional() }),
  z.object({ type: z.literal("open"), url: z.string() }),
  z.object({ type: z.literal("run"), commands: z.array(z.string()).min(1) }),
  z.object({ type: z.literal("choice"), options: z.array(z.string()).min(1), saveAs: z.string().optional() }),
  z.object({ type: z.literal("date"), format: z.enum(["iso", "local", "date", "time"]).optional() }),
  z.object({
    type: z.literal("query"),
    dataset: z.string(),
    search: z.string().optional(),
    where: z.string().optional(),
    sortBy: z.string().optional(),
    desc: z.union([z.boolean(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
    columns: z.array(z.string()).optional(),
  }),
  z.object({ type: z.literal("stats"), dataset: z.string(), column: z.string() }),
  z.object({ type: z.literal("columns"), dataset: z.string() }),
]);

const argSchema = z.object({
  name: z.string().regex(/^[A-Za-z][\w-]*$/, "use letters, digits, - or _"),
  type: z.enum(["string", "number", "boolean", "enum"]).default("string"),
  description: z.string().optional(),
  required: z.boolean().optional(),
  positional: z.boolean().optional(),
  rest: z.boolean().optional(),
  alias: z.string().optional(),
  choices: z.array(z.string()).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const commandSchema = z
  .object({
    name: z.string().min(1).describe("Space-separated path, e.g. 'deploy app'"),
    summary: z.string().default(""),
    aliases: z.array(z.string()).optional(),
    args: z.array(argSchema).optional(),
    examples: z.array(z.string()).optional(),
    action: actionSchema.optional(),
    actions: z.array(actionSchema).optional(),
  })
  .refine((c) => c.action || c.actions?.length, { message: "each command needs an action or actions" });

export const consoleSpecSchema = z.object({
  name: z.string().min(1),
  welcome: z.string().optional(),
  prompt: z.string().optional(),
  theme: z.object({ background: z.string().optional(), foreground: z.string().optional(), accent: z.string().optional() }).optional(),
  vars: z.record(z.string(), z.string()).optional(),
  datasets: z.record(z.string(), z.array(z.record(z.string(), cell))).optional(),
  groups: z.array(z.object({ name: z.string(), summary: z.string() })).optional(),
  commands: z.array(commandSchema),
});

export type ConsoleSpec = z.input<typeof consoleSpecSchema>;
export type ConsoleAction = z.infer<typeof actionSchema>;

/** Runtime services a spec console uses. Everything is injectable for tests. */
export interface SpecContext {
  vars: Record<string, string>;
  setVar: (name: string, value: string | null) => void;
  clear: () => void;
  open: (url: string) => void;
  fetch: (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  history: () => string[];
  depth?: number;
}

export function parseSpec(input: unknown): { ok: true; spec: z.infer<typeof consoleSpecSchema> } | { ok: false; errors: string[] } {
  const r = consoleSpecSchema.safeParse(input);
  if (r.success) return { ok: true, spec: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
}

/** Replaces {arg} with argument values and {$var} with console variables. Unknown placeholders stay as-is. */
export function interpolate(template: string, args: ParsedArgs, vars: Record<string, string>): string {
  return template.replace(/\{(\$?)([A-Za-z_][\w-]*)\}/g, (m, isVar: string, key: string) => {
    const v = isVar ? vars[key] : args[key];
    return v === undefined ? (isVar ? m : "") : String(v);
  });
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").filter(Boolean).reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function render(io: CommandIO, data: unknown, as: "json" | "text" | "table" | "kv") {
  if (as === "table" && Array.isArray(data) && data.length && typeof data[0] === "object") {
    const columns = [...new Set(data.slice(0, 50).flatMap((r) => Object.keys(r as object)))].slice(0, 8);
    io.table(columns, data.slice(0, 100).map((r) => columns.map((c) => scalar((r as Record<string, unknown>)[c]))));
  } else if (as === "kv" && data && typeof data === "object" && !Array.isArray(data)) {
    io.kv(Object.entries(data as object).slice(0, 40).map(([k, v]) => [k, scalar(v)]));
  } else io.print(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

export type Row = Record<string, string | number | null>;

const isNum = (v: unknown) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v.replace(/,/g, ""))));
const toNum = (v: unknown) => (typeof v === "number" ? v : Number(String(v).replace(/,/g, "")));
const fmtNum = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

function columnsOf(rows: Row[]): string[] {
  return [...new Set(rows.slice(0, 200).flatMap((r) => Object.keys(r)))];
}

function findColumn(rows: Row[], name: string): string {
  const cols = columnsOf(rows);
  const hit = cols.find((c) => c === name) ?? cols.find((c) => c.toLowerCase() === name.toLowerCase());
  if (!hit) throw new ConsoleError(`No column "${name}". Columns: ${cols.join(", ")}`);
  return hit;
}

/** `where` filters: "col=value", "col!=value", "col>n", "col<n", "col>=n", "col<=n", "col~text"; several joined with " and ". */
function applyWhere(rows: Row[], where: string): Row[] {
  const parts = where.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
  return parts.reduce((acc, part) => {
    const m = /^(.+?)\s*(>=|<=|!=|=|>|<|~)\s*(.*)$/.exec(part);
    if (!m) throw new ConsoleError(`Cannot read filter "${part}". Use column=value, column>10 or column~text.`);
    const col = findColumn(rows, m[1].trim());
    const [, , op, raw] = m;
    const val = raw.trim();
    return acc.filter((r) => {
      const v = r[col];
      if (op === "~") return String(v ?? "").toLowerCase().includes(val.toLowerCase());
      if (op === "=" || op === "!=") {
        const eq = isNum(v) && isNum(val) ? toNum(v) === toNum(val) : String(v ?? "").toLowerCase() === val.toLowerCase();
        return op === "=" ? eq : !eq;
      }
      if (!isNum(v) || !isNum(val)) return false;
      const a = toNum(v), b = toNum(val);
      return op === ">" ? a > b : op === "<" ? a < b : op === ">=" ? a >= b : a <= b;
    });
  }, rows);
}

function getDataset(data: Record<string, Row[]>, name: string): Row[] {
  const rows = data[name];
  if (!rows) throw new ConsoleError(`No dataset "${name}". Datasets: ${Object.keys(data).join(", ") || "none"}`);
  return rows;
}

const scalar = (v: unknown): string | number | null => (v === null || v === undefined ? null : typeof v === "number" ? v : typeof v === "object" ? JSON.stringify(v) : String(v));
const MAX_DEPTH = 5;

async function runAction(a: ConsoleAction, args: ParsedArgs, ctx: SpecContext, io: CommandIO, self: () => BuiltConsole<SpecContext>, data: Record<string, Row[]>): Promise<void> {
  const t = (s: string) => interpolate(s, args, ctx.vars);
  switch (a.type) {
    case "print":
      return io.print(t(a.text), a.tone);
    case "table":
      return io.table(a.columns.map(t), a.rows.map((r) => r.map((c) => (typeof c === "string" ? t(c) : c))));
    case "kv":
      return io.kv(a.pairs.map(([k, v]) => [t(k), typeof v === "string" ? t(v) : v]));
    case "calc": {
      const n = calc(t(a.expression), { ...ctx.vars, ...Object.fromEntries(Object.entries(args).filter(([, v]) => typeof v === "number" || typeof v === "string") as [string, string][]) });
      const v = a.decimals !== undefined ? n.toFixed(a.decimals) : String(Math.round(n * 1e10) / 1e10);
      if (a.saveAs) ctx.setVar(a.saveAs, v);
      return io.print(a.label ? `${t(a.label)}: ${v}` : v);
    }
    case "set":
      ctx.setVar(a.name, t(a.value));
      return;
    case "http": {
      const url = t(a.url);
      if (!/^https?:\/\//i.test(url)) throw new ConsoleError(`http needs an http(s) URL, got "${url}"`);
      const res = await ctx.fetch(url, { method: a.method ?? "GET", body: a.body ? t(a.body) : undefined, headers: a.body ? { "content-type": "application/json" } : undefined });
      const text = await res.text();
      if (!res.ok) throw new ConsoleError(`HTTP ${res.status} from ${url}`);
      let data: unknown = text;
      if (a.as !== "text") {
        try {
          data = JSON.parse(text);
        } catch {
          /* not JSON: show as text */
        }
      }
      if (a.pick) data = getPath(data, t(a.pick));
      if (a.saveAs) ctx.setVar(a.saveAs, typeof data === "string" ? data : JSON.stringify(data));
      return render(io, data, a.as ?? (Array.isArray(data) ? "table" : "json"));
    }
    case "open":
      return ctx.open(t(a.url));
    case "run": {
      const depth = (ctx.depth ?? 0) + 1;
      if (depth > MAX_DEPTH) throw new ConsoleError("Macro nesting too deep (max 5)");
      for (const line of a.commands) {
        const r = await self().execute(t(line), { ...ctx, depth });
        for (const b of r.output) {
          if (b.kind === "text") io.print(b.text, b.tone);
          else if (b.kind === "table") io.table(b.columns, b.rows);
          else io.kv(b.pairs);
        }
        if (r.code !== 0) throw new ConsoleError(`Stopped: "${t(line)}" failed`);
      }
      return;
    }
    case "choice": {
      const pick = a.options[Math.floor(Math.random() * a.options.length)];
      if (a.saveAs) ctx.setVar(a.saveAs, t(pick));
      return io.print(t(pick));
    }
    case "query": {
      let rows = getDataset(data, t(a.dataset));
      const total = rows.length;
      const where = a.where ? t(a.where).trim() : "";
      if (where) rows = applyWhere(rows, where);
      const q = a.search ? t(a.search).trim().toLowerCase() : "";
      if (q) rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
      const sortBy = a.sortBy ? t(a.sortBy).trim() : "";
      const desc = typeof a.desc === "string" ? /^(true|1|yes)$/i.test(t(a.desc)) : !!a.desc;
      if (sortBy) {
        const col = findColumn(rows.length ? rows : getDataset(data, t(a.dataset)), sortBy);
        rows = [...rows].sort((x, y) => {
          const u = x[col], v = y[col];
          const c = isNum(u) && isNum(v) ? toNum(u) - toNum(v) : String(u ?? "").localeCompare(String(v ?? ""));
          return desc ? -c : c;
        });
      }
      const lim = Math.max(1, Math.min(500, Number(typeof a.limit === "string" ? t(a.limit) : (a.limit ?? 20)) || 20));
      const cols = a.columns?.length ? a.columns.map(t) : columnsOf(rows.length ? rows : getDataset(data, t(a.dataset))).slice(0, 8);
      if (!rows.length) return io.print(`No matching rows (of ${total}).`, "muted");
      io.table(cols, rows.slice(0, lim).map((r) => cols.map((c) => scalar(r[c]))));
      return io.print(`${Math.min(lim, rows.length)} of ${rows.length} matching rows · ${total} total`, "muted");
    }
    case "stats": {
      const rows = getDataset(data, t(a.dataset));
      const col = findColumn(rows, t(a.column));
      const vals = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
      const nums = vals.filter(isNum).map(toNum);
      const pairs: Array<[string, string | number | null]> = [["Column", col], ["Rows", rows.length], ["Filled", vals.length], ["Distinct", new Set(vals.map(String)).size]];
      if (nums.length && nums.length >= vals.length * 0.8) {
        const sum = nums.reduce((x, y) => x + y, 0);
        const sorted = [...nums].sort((x, y) => x - y);
        const mid = sorted.length >> 1;
        pairs.push(["Sum", fmtNum(sum)], ["Average", fmtNum(sum / nums.length)], ["Median", fmtNum(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)], ["Min", fmtNum(sorted[0])], ["Max", fmtNum(sorted[sorted.length - 1])]);
        return io.kv(pairs);
      }
      io.kv(pairs);
      const counts = new Map<string, number>();
      for (const v of vals) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
      return io.table(["Value", "Count"], [...counts].sort((x, y) => y[1] - x[1]).slice(0, 10).map(([v, n]) => [v, n]));
    }
    case "columns": {
      const rows = getDataset(data, t(a.dataset));
      return io.table(
        ["Column", "Type", "Example"],
        columnsOf(rows).map((c) => {
          const vals = rows.map((r) => r[c]).filter((v) => v !== null && v !== undefined && String(v) !== "");
          return [c, vals.length && vals.every(isNum) ? "number" : "text", scalar(vals[0] ?? null)];
        }),
      );
    }
    case "date": {
      const d = new Date();
      const f = a.format ?? "local";
      return io.print(f === "iso" ? d.toISOString() : f === "date" ? d.toLocaleDateString() : f === "time" ? d.toLocaleTimeString() : d.toLocaleString());
    }
  }
}

/** Commands every console gets for free. */
export function addBuiltins(b: ConsoleBuilder<SpecContext>, skip: Set<string> = new Set()): ConsoleBuilder<SpecContext> {
  const add = (name: string, fn: () => void) => {
    if (!skip.has(name)) fn();
  };
  add("clear", () => b.command({ path: ["clear"], aliases: ["cls"], summary: "Clear the screen", run: (_a, ctx) => ctx.clear() }));
  add("echo", () => b.command({ path: ["echo"], summary: "Print text ({$var} expands)", args: [{ name: "text", type: "string", positional: true, rest: true }], run: (a, ctx, io) => io.print(interpolate(String(a.text ?? ""), a, ctx.vars)) }));
  add("set", () =>
    b.command({
      path: ["set"],
      summary: "Set a variable",
      args: [
        { name: "name", type: "string", positional: true, required: true },
        { name: "value", type: "string", positional: true, required: true, rest: true },
      ],
      examples: ["set rate 0.14", "echo {$rate}"],
      run: (a, ctx, io) => {
        ctx.setVar(String(a.name), String(a.value));
        io.print(`${a.name} = ${a.value}`, "muted");
      },
    }),
  );
  add("unset", () => b.command({ path: ["unset"], summary: "Remove a variable", args: [{ name: "name", type: "string", positional: true, required: true, complete: (ctx: SpecContext) => Object.keys(ctx.vars) }], run: (a, ctx) => ctx.setVar(String(a.name), null) }));
  add("vars", () => b.command({ path: ["vars"], summary: "List variables", run: (_a, ctx, io) => (Object.keys(ctx.vars).length ? io.kv(Object.entries(ctx.vars)) : io.print("No variables.", "muted")) }));
  add("calc", () =>
    b.command({
      path: ["calc"],
      aliases: ["="],
      summary: "Evaluate arithmetic (variables allowed)",
      args: [{ name: "expression", type: "string", positional: true, required: true, rest: true }],
      examples: ["calc (120000 * 0.14) / 12", "calc round(sqrt(2), 3)"],
      run: (a, ctx, io) => io.print(String(Math.round(calc(String(a.expression), ctx.vars) * 1e10) / 1e10)),
    }),
  );
  add("history", () => b.command({ path: ["history"], summary: "Recent commands", run: (_a, ctx, io) => io.table(["#", "Command"], ctx.history().slice(-20).map((l, i) => [i + 1, l])) }));
  return b;
}

/** Builds a working console from a validated spec. Spec commands override built-ins with the same name. */
export function buildFromSpec(input: ConsoleSpec): BuiltConsole<SpecContext> {
  const parsed = parseSpec(input);
  if (!parsed.ok) throw new ConsoleError(`Invalid console spec:\n${parsed.errors.join("\n")}`);
  const spec = parsed.spec;
  const b = new ConsoleBuilder<SpecContext>(spec.name);
  let built: BuiltConsole<SpecContext> | null = null;
  const data = (spec.datasets ?? {}) as Record<string, Row[]>;
  const self = () => built!;
  const own = new Set(spec.commands.map((c) => c.name.trim().toLowerCase().split(/\s+/)[0]));
  for (const g of spec.groups ?? []) b.group(g.name, g.summary, () => {});
  addBuiltins(b, new Set([...own].filter((n) => spec.commands.some((c) => c.name.trim().toLowerCase() === n))));
  for (const c of spec.commands) {
    const actions = c.actions ?? (c.action ? [c.action] : []);
    b.command({
      path: c.name.trim().split(/\s+/),
      summary: c.summary,
      aliases: c.aliases,
      examples: c.examples,
      args: c.args as ArgSpec<SpecContext>[] | undefined,
      run: async (args, ctx, io) => {
        for (const a of actions) await runAction(a, args, ctx, io, self, data);
      },
    });
  }
  built = b.build();
  return built;
}
