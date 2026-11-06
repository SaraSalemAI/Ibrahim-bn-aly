// Console builder — public API. Build any command console, in code or from a JSON spec.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

export { ConsoleBuilder, BuiltConsole } from "./builder";
export { tokenize, bindArgs, splitChain, ConsoleError } from "./tokenize";
export { History, commonPrefix, applyCompletion } from "./history";
export { requireTag, roleGuard, onExecuted } from "./middleware";
export { calc } from "./calc";
export { buildFromSpec, parseSpec, interpolate, addBuiltins, consoleSpecSchema, actionSchema } from "./spec";
export type { ConsoleSpec, ConsoleAction, SpecContext, Row } from "./spec";
export { TEMPLATES } from "./templates";
export { parseDelimited, loadFile, specFromDatasets, buildPrompt, extractJson, summarizeDatasets, datasetName, SPEC_GUIDE } from "./generate";
export type { LoadedFile, DatasetSummary } from "./generate";
export type { ConsoleTemplate } from "./templates";
export { renderText } from "./render-text";
export { standaloneHtml } from "./html";
export type * from "./types";
