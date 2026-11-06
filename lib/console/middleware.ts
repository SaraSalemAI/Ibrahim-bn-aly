// Console builder — reusable middleware driven by command tags.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import type { Middleware } from "./types";

/** Blocks commands tagged `tag` unless `allowed(ctx)` is true. */
export function requireTag<C>(tag: string, allowed: (ctx: C) => boolean, message: string | ((ctx: C) => string)): Middleware<C> {
  return async (inv, io, next) => {
    if (inv.command.tags?.includes(tag) && !allowed(inv.ctx)) {
      io.fail(typeof message === "function" ? message(inv.ctx) : message);
      return;
    }
    await next();
  };
}

/** Role guard: a tag `role:CFO` or `role:REVIEWER|CFO` lists the roles that may run the command. */
export function roleGuard<C>(roleOf: (ctx: C) => string): Middleware<C> {
  return async (inv, io, next) => {
    const tag = inv.command.tags?.find((t) => t.startsWith("role:"));
    if (tag) {
      const roles = tag.slice(5).split("|");
      const role = roleOf(inv.ctx);
      if (!roles.includes(role)) {
        io.fail(`"${inv.command.path.join(" ")}" needs role ${roles.join(" or ")}; you are ${role}.`);
        return;
      }
    }
    await next();
  };
}

/** Reports every invocation (after it runs) to a sink, e.g. telemetry or an audit log. */
export function onExecuted<C>(sink: (line: string, path: string[], ctx: C) => void): Middleware<C> {
  return async (inv, _io, next) => {
    await next();
    sink(inv.line, inv.command.path, inv.ctx);
  };
}
