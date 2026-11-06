// Console builder — fluent registry, dispatcher, help and completion.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { bindArgs, ConsoleError, tokenize } from "./tokenize";
import type { CommandIO, CommandResult, CommandSpec, Completion, Middleware, OutputBlock } from "./types";

interface Node<C> {
  name: string;
  summary?: string;
  command?: CommandSpec<C>;
  children: Map<string, Node<C>>;
}

const newNode = <C,>(name: string): Node<C> => ({ name, children: new Map() });

/** Collects output blocks for one execution. */
function makeIO(out: OutputBlock[], state: { code: number }): CommandIO {
  return {
    print: (text, tone) => out.push({ kind: "text", text, tone }),
    table: (columns, rows) => out.push({ kind: "table", columns, rows }),
    kv: (pairs) => out.push({ kind: "kv", pairs }),
    fail: (message) => {
      out.push({ kind: "text", text: message, tone: "error" });
      state.code = 1;
    },
  };
}

/**
 * Fluent builder for command consoles.
 *
 *   const console = new ConsoleBuilder<Ctx>("cfo")
 *     .use(auditMiddleware)
 *     .group("company", "Companies in the workspace", (g) => g.command({ path: ["list"], ... }))
 *     .build();
 */
export class ConsoleBuilder<C> {
  private root: Node<C> = newNode<C>("");
  private middleware: Middleware<C>[] = [];
  private prefix: string[] = [];

  constructor(readonly name: string) {}

  command(spec: CommandSpec<C>): this {
    const path = [...this.prefix, ...spec.path].map((p) => p.toLowerCase());
    if (!path.length) throw new Error("Command path cannot be empty");
    const full = { ...spec, path };
    const place = (segments: string[]) => {
      let node = this.root;
      for (const seg of segments) {
        if (!node.children.has(seg)) node.children.set(seg, newNode<C>(seg));
        node = node.children.get(seg)!;
      }
      if (node.command) throw new Error(`Duplicate command: ${segments.join(" ")}`);
      node.command = full;
    };
    place(path);
    for (const a of spec.aliases ?? []) place([...path.slice(0, -1), a.toLowerCase()]);
    return this;
  }

  /** Registers commands under a shared prefix, e.g. `company list`, `company select`. */
  group(name: string, summary: string, define: (g: this) => void): this {
    const seg = name.toLowerCase();
    let node = this.root;
    for (const p of [...this.prefix, seg]) {
      if (!node.children.has(p)) node.children.set(p, newNode<C>(p));
      node = node.children.get(p)!;
    }
    node.summary = summary;
    this.prefix.push(seg);
    try {
      define(this);
    } finally {
      this.prefix.pop();
    }
    return this;
  }

  use(mw: Middleware<C>): this {
    this.middleware.push(mw);
    return this;
  }

  build(): BuiltConsole<C> {
    return new BuiltConsole(this.name, this.root, [...this.middleware]);
  }
}

export class BuiltConsole<C> {
  constructor(
    readonly name: string,
    private root: Node<C>,
    private middleware: Middleware<C>[],
  ) {}

  /** Walks the command tree; returns the deepest command and the remaining tokens. */
  resolve(tokens: string[]): { node: Node<C>; command?: CommandSpec<C>; rest: string[]; depth: number } {
    let node = this.root;
    let found: { command?: CommandSpec<C>; depth: number } = { depth: 0 };
    let i = 0;
    for (; i < tokens.length; i++) {
      const next = node.children.get(tokens[i].toLowerCase());
      if (!next) break;
      node = next;
      if (node.command) found = { command: node.command, depth: i + 1 };
    }
    // If the walk ended on a group, prefer reporting the group (for help) over a shallower command.
    if (!node.command && i > found.depth) return { node, rest: tokens.slice(i), depth: i };
    return { node, command: found.command, rest: tokens.slice(found.depth), depth: found.depth };
  }

  /** All unique commands (aliases collapsed), sorted by path. */
  commands(): CommandSpec<C>[] {
    const seen = new Set<CommandSpec<C>>();
    const walk = (n: Node<C>) => {
      if (n.command) seen.add(n.command);
      n.children.forEach(walk);
    };
    walk(this.root);
    return [...seen].sort((a, b) => a.path.join(" ").localeCompare(b.path.join(" ")));
  }

  usage(cmd: CommandSpec<C>): string {
    const parts = (cmd.args ?? []).map((a) => {
      if (a.positional) {
        const inner = a.rest ? `${a.name}...` : a.name;
        return a.required ? `<${inner}>` : `[${inner}]`;
      }
      const val = a.type === "boolean" ? "" : ` <${a.type === "enum" ? (a.choices ?? []).join("|") : a.type}>`;
      return a.required ? `--${a.name}${val}` : `[--${a.name}${val}]`;
    });
    return [cmd.path.join(" "), ...parts].join(" ");
  }

  help(topic: string[] = []): OutputBlock[] {
    const { node, command } = this.resolve(topic);
    if (topic.length && command && command.path.length === topic.length) {
      const blocks: OutputBlock[] = [
        { kind: "text", text: this.usage(command) },
        { kind: "text", text: command.summary, tone: "muted" },
      ];
      const args = command.args ?? [];
      if (args.length)
        blocks.push({
          kind: "table",
          columns: ["Argument", "Type", "Description"],
          rows: args.map((a) => [a.positional ? `<${a.name}>` : `--${a.name}${a.alias ? `, -${a.alias}` : ""}`, a.type === "enum" ? (a.choices ?? []).join("|") : a.type, `${a.description ?? ""}${a.default !== undefined ? ` (default ${a.default})` : ""}`]),
        });
      if (command.aliases?.length) blocks.push({ kind: "text", text: `Aliases: ${command.aliases.join(", ")}`, tone: "muted" });
      for (const ex of command.examples ?? []) blocks.push({ kind: "text", text: `  $ ${ex}`, tone: "muted" });
      return blocks;
    }
    const scope = topic.length && node !== this.root ? node : this.root;
    const prefix = scope === this.root ? "" : topic.join(" ").toLowerCase();
    const rows = this.commands()
      .filter((c) => !prefix || c.path.join(" ").startsWith(prefix))
      .map((c) => [this.usage(c), c.summary]);
    return [{ kind: "table", columns: ["Command", "Description"], rows }, { kind: "text", text: "Type help <command> for details. Tab completes, ↑/↓ browse history.", tone: "muted" }];
  }

  async execute(line: string, ctx: C): Promise<CommandResult> {
    const out: OutputBlock[] = [];
    const state = { code: 0 };
    const io = makeIO(out, state);
    try {
      const { tokens } = tokenize(line);
      if (!tokens.length) return { output: [], code: 0 };
      if (tokens[0].toLowerCase() === "help" || tokens[0] === "?") return { output: this.help(tokens.slice(1)), code: 0 };
      const { command, rest, node } = this.resolve(tokens);
      if (!command) {
        if (node !== this.root && node.children.size) return { output: this.help(tokens.slice(0, tokens.length - rest.length)), code: 0 };
        const near = this.suggest(tokens[0]);
        throw new ConsoleError(`Unknown command "${tokens.join(" ")}".${near ? ` Did you mean "${near}"?` : ""} Type help.`);
      }
      const args = bindArgs(command.args ?? [], rest);
      const inv = { command, args, ctx, line };
      const chain = this.middleware.reduceRight<() => Promise<void>>((next, mw) => () => mw(inv, io, next), async () => {
        await command.run(args, ctx, io);
      });
      await chain();
    } catch (e) {
      io.fail(e instanceof Error ? e.message : String(e));
    }
    return { output: out, code: state.code };
  }

  /** Completes the last token of `line`: command segments, then flags and argument values. */
  complete(line: string, ctx: C): Completion[] {
    let parsed: { tokens: string[]; trailingSpace: boolean };
    try {
      parsed = tokenize(line);
    } catch {
      return [];
    }
    const tokens = parsed.trailingSpace ? [...parsed.tokens, ""] : parsed.tokens.length ? parsed.tokens : [""];
    const partial = tokens[tokens.length - 1].toLowerCase();
    const head = tokens.slice(0, -1);
    if (head[0]?.toLowerCase() === "help") return this.complete(line.replace(/^\s*help\s*/i, ""), ctx);

    let node = this.root;
    let depth = 0;
    for (; depth < head.length; depth++) {
      const next = node.children.get(head[depth].toLowerCase());
      if (!next) break;
      node = next;
    }
    const out: Completion[] = [];
    if (depth === head.length) {
      if (depth === 0 && "help".startsWith(partial)) out.push({ value: "help", description: "Show commands" });
      node.children.forEach((child, key) => {
        if (key.startsWith(partial)) out.push({ value: key, description: child.command?.summary ?? child.summary });
      });
    }
    const cmd = node.command;
    if (cmd) {
      const args = cmd.args ?? [];
      const isValueFlag = (t: string) => args.find((a) => !a.positional && a.type !== "boolean" && (`--${a.name}` === t || `-${a.alias}` === t));
      const valuesFor = (a: (typeof args)[number]) => a.choices?.slice() ?? a.complete?.(ctx) ?? [];
      const after = head.slice(depth);
      const flag = after.length ? isValueFlag(after[after.length - 1]) : undefined;
      if (flag) return valuesFor(flag).filter((v) => v.toLowerCase().startsWith(partial)).map((value) => ({ value }));
      if (partial.startsWith("-")) {
        for (const a of args) if (!a.positional && `--${a.name}`.startsWith(partial)) out.push({ value: `--${a.name}`, description: a.description });
      } else {
        let used = 0;
        for (let i = 0; i < after.length; i++) {
          if (isValueFlag(after[i])) i++;
          else if (!after[i].startsWith("-")) used++;
        }
        const positionals = args.filter((a) => a.positional);
        const pos = positionals[used] ?? (positionals.at(-1)?.rest ? positionals.at(-1) : undefined);
        if (pos) for (const v of valuesFor(pos)) if (v.toLowerCase().startsWith(partial)) out.push({ value: v, description: pos.name });
      }
    }
    return out;
  }

  private suggest(word: string): string | null {
    const names = [...this.root.children.keys()];
    let best: [string, number] | null = null;
    for (const n of names) {
      const d = levenshtein(word.toLowerCase(), n);
      if (d <= 2 && (!best || d < best[1])) best = [n, d];
    }
    return best?.[0] ?? null;
  }
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
