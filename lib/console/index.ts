// Console builder — public API.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

export { ConsoleBuilder, BuiltConsole } from "./builder";
export { tokenize, bindArgs, ConsoleError } from "./tokenize";
export { History, commonPrefix, applyCompletion } from "./history";
export { requireTag, roleGuard, onExecuted } from "./middleware";
export type * from "./types";
