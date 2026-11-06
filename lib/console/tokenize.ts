// Console builder — shell-style tokenizer and argument binding.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import type { ArgSpec, ParsedArgs } from "./types";

export class ConsoleError extends Error {}

/**
 * Splits a line into tokens. Supports "double" and 'single' quotes, backslash escapes
 * and Unicode text (Arabic account names). Returns `trailingSpace` for completion.
 */
export function tokenize(line: string): { tokens: string[]; trailingSpace: boolean } {
  const tokens: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let inToken = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length && quote !== "'") {
      cur += line[++i];
      inToken = true;
    } else if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      inToken = true;
    } else if (/\s/.test(ch)) {
      if (inToken) tokens.push(cur);
      cur = "";
      inToken = false;
    } else {
      cur += ch;
      inToken = true;
    }
  }
  if (quote) throw new ConsoleError(`Unterminated ${quote} quote`);
  if (inToken) tokens.push(cur);
  return { tokens, trailingSpace: /\s$/.test(line) };
}

function coerce(spec: Pick<ArgSpec, "name" | "type" | "choices">, raw: string): string | number | boolean {
  switch (spec.type) {
    case "number": {
      const n = Number(raw.replace(/,/g, ""));
      if (raw.trim() === "" || !Number.isFinite(n)) throw new ConsoleError(`--${spec.name} expects a number, got "${raw}"`);
      return n;
    }
    case "boolean":
      if (/^(true|yes|1|on)$/i.test(raw)) return true;
      if (/^(false|no|0|off)$/i.test(raw)) return false;
      throw new ConsoleError(`--${spec.name} expects true/false, got "${raw}"`);
    case "enum": {
      const hit = spec.choices?.find((c) => c.toLowerCase() === raw.toLowerCase());
      if (!hit) throw new ConsoleError(`${spec.name} must be one of: ${(spec.choices ?? []).join(", ")}`);
      return hit;
    }
    default:
      return raw;
  }
}

/** Binds tokens (after the command path) to the command's argument specs. */
export function bindArgs<C>(specs: ArgSpec<C>[], tokens: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  const flags = specs.filter((s) => !s.positional);
  const positionals = specs.filter((s) => s.positional);
  const free: string[] = [];
  const findFlag = (key: string) => flags.find((f) => f.name === key || f.alias === key);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "--") {
      free.push(...tokens.slice(i + 1));
      break;
    }
    const m = /^--?([A-Za-z][\w-]*)(?:=(.*))?$/.exec(t);
    if (!m || /^-\d/.test(t)) {
      free.push(t);
      continue;
    }
    const key = m[1];
    let inline = m[2];
    const spec = findFlag(key);
    if (!spec && key.startsWith("no-")) {
      const neg = findFlag(key.slice(3));
      if (neg?.type === "boolean") {
        out[neg.name] = false;
        continue;
      }
    }
    if (!spec) throw new ConsoleError(`Unknown option ${t}`);
    if (spec.type === "boolean" && inline === undefined) {
      out[spec.name] = true;
      continue;
    }
    if (inline === undefined) {
      if (i + 1 >= tokens.length) throw new ConsoleError(`--${spec.name} needs a value`);
      inline = tokens[++i];
    }
    out[spec.name] = coerce(spec, inline);
  }

  positionals.forEach((spec) => {
    if (spec.rest) {
      const rest = free.splice(0);
      if (rest.length) out[spec.name] = rest.join(" ");
    } else if (free.length) {
      out[spec.name] = coerce(spec, free.shift()!);
    }
  });
  if (free.length) throw new ConsoleError(`Unexpected argument "${free[0]}"`);

  for (const spec of specs) {
    if (out[spec.name] === undefined && spec.default !== undefined) out[spec.name] = spec.default;
    if (out[spec.name] === undefined && spec.required) throw new ConsoleError(`Missing required ${spec.positional ? "argument" : "option"} ${spec.positional ? `<${spec.name}>` : `--${spec.name}`}`);
  }
  return out;
}

/**
 * Splits a line into chained segments on top-level `&&` (stop on failure) and `;` (always continue).
 * Operators inside quotes are kept as text.
 */
export function splitChain(line: string): Array<{ text: string; op: "&&" | ";" | null }> {
  const out: Array<{ text: string; op: "&&" | ";" | null }> = [];
  let cur = "";
  let quote: string | null = null;
  let pendingOp: "&&" | ";" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length) {
      cur += ch + line[++i];
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ";" || (ch === "&" && line[i + 1] === "&")) {
      if (cur.trim()) out.push({ text: cur.trim(), op: pendingOp });
      pendingOp = ch === ";" ? ";" : "&&";
      if (ch === "&") i++;
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push({ text: cur.trim(), op: pendingOp });
  return out;
}
