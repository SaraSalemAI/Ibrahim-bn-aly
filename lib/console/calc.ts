// Console builder — safe arithmetic evaluator (no eval).
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.
//
// Supports + - * / % ^, parentheses, unary minus, decimals, thousands commas,
// variables and functions: abs round floor ceil sqrt min max pow log ln exp.

import { ConsoleError } from "./tokenize";

const FNS: Record<string, (...a: number[]) => number> = {
  abs: Math.abs, round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d, floor: Math.floor, ceil: Math.ceil,
  sqrt: Math.sqrt, min: Math.min, max: Math.max, pow: Math.pow, log: Math.log10, ln: Math.log, exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export function calc(expr: string, vars: Record<string, string | number> = {}): number {
  const src = expr.replace(/(\d),(?=\d{3}\b)/g, "$1");
  let i = 0;
  const peek = () => src[i];
  const skip = () => {
    while (/\s/.test(src[i] ?? "")) i++;
  };
  const expect = (c: string) => {
    skip();
    if (src[i] !== c) throw new ConsoleError(`Expected "${c}" at position ${i + 1}`);
    i++;
  };
  function primary(): number {
    skip();
    const c = peek();
    if (c === "(") {
      i++;
      const v = add();
      expect(")");
      return v;
    }
    if (c === "-" || c === "+") {
      i++;
      const v = power();
      return c === "-" ? -v : v;
    }
    const num = /^\d+(\.\d+)?|^\.\d+/.exec(src.slice(i));
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    const id = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
    if (id) {
      i += id[0].length;
      const name = id[0].replace(/^\$/, "");
      skip();
      if (peek() === "(") {
        i++;
        const fn = FNS[name.toLowerCase()];
        if (!fn) throw new ConsoleError(`Unknown function ${name}()`);
        const args: number[] = [];
        skip();
        if (peek() !== ")") {
          args.push(add());
          skip();
          while (peek() === ",") {
            i++;
            args.push(add());
            skip();
          }
        }
        expect(")");
        return fn(...args);
      }
      if (name in vars) {
        const v = Number(String(vars[name]).replace(/,/g, ""));
        if (!Number.isFinite(v)) throw new ConsoleError(`Variable ${name} is not a number`);
        return v;
      }
      if (name.toLowerCase() in CONSTS) return CONSTS[name.toLowerCase()];
      throw new ConsoleError(`Unknown name "${name}"`);
    }
    throw new ConsoleError(c === undefined ? "Unexpected end of expression" : `Unexpected "${c}" at position ${i + 1}`);
  }
  function power(): number {
    const base = primary();
    skip();
    if (peek() === "^") {
      i++;
      return base ** power();
    }
    return base;
  }
  function mul(): number {
    let v = power();
    for (;;) {
      skip();
      const c = peek();
      if (c !== "*" && c !== "/" && c !== "%") return v;
      i++;
      const r = power();
      if ((c === "/" || c === "%") && r === 0) throw new ConsoleError("Division by zero");
      v = c === "*" ? v * r : c === "/" ? v / r : v % r;
    }
  }
  function add(): number {
    let v = mul();
    for (;;) {
      skip();
      const c = peek();
      if (c !== "+" && c !== "-") return v;
      i++;
      v = c === "+" ? v + mul() : v - mul();
    }
  }
  if (!src.trim()) throw new ConsoleError("Empty expression");
  const v = add();
  skip();
  if (i < src.length) throw new ConsoleError(`Unexpected "${src[i]}" at position ${i + 1}`);
  return v;
}
