// Console builder — core types.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

/** One rendered block of console output. The UI decides how each kind looks. */
export type OutputBlock =
  | { kind: "text"; text: string; tone?: "info" | "ok" | "warn" | "error" | "muted" }
  | { kind: "table"; columns: string[]; rows: Array<Array<string | number | null>> }
  | { kind: "kv"; pairs: Array<[string, string | number | null]> };

export type ArgType = "string" | "number" | "boolean" | "enum";

/** Declarative argument spec. Positionals are matched in order; flags by `--name` or `-alias`. */
export interface ArgSpec<C = unknown> {
  name: string;
  type: ArgType;
  description?: string;
  required?: boolean;
  /** Positional args take the next free token; non-positional args are flags. */
  positional?: boolean;
  /** Collect all remaining positional tokens (string only, last positional). */
  rest?: boolean;
  alias?: string;
  choices?: readonly string[];
  default?: string | number | boolean;
  /** Dynamic completion values for this argument, given the app context. */
  complete?: (ctx: C) => string[];
}

export type ParsedArgs = Record<string, string | number | boolean | string[] | undefined>;

export interface CommandResult {
  output: OutputBlock[];
  /** Non-zero means failure; the UI and middleware can react to it. */
  code: number;
}

export interface CommandSpec<C> {
  /** Full path, e.g. ["company", "select"]. */
  path: string[];
  summary: string;
  args?: ArgSpec<C>[];
  aliases?: string[];
  /** Free-form tags middleware can read, e.g. "mutates", "role:CFO". */
  tags?: string[];
  examples?: string[];
  run: (args: ParsedArgs, ctx: C, io: CommandIO) => void | Promise<void>;
}

/** Output sink passed to every command. */
export interface CommandIO {
  print: (text: string, tone?: Extract<OutputBlock, { kind: "text" }>["tone"]) => void;
  table: (columns: string[], rows: Array<Array<string | number | null>>) => void;
  kv: (pairs: Array<[string, string | number | null]>) => void;
  fail: (message: string) => void;
}

export interface Invocation<C> {
  command: CommandSpec<C>;
  args: ParsedArgs;
  ctx: C;
  line: string;
}

/** Middleware wraps execution: guard (return without calling next), decorate, audit or time. */
export type Middleware<C> = (inv: Invocation<C>, io: CommandIO, next: () => Promise<void>) => Promise<void>;

export interface Completion {
  /** Replacement for the last token. */
  value: string;
  description?: string;
}
