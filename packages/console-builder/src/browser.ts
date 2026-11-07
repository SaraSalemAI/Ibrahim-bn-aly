// Console builder — browser entry (exposed as window.ConsoleBuilder).
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

export * from "./index";
export { mountConsole, renderBlock, CONSOLE_CSS } from "./web";
export type { MountOptions, MountedConsole } from "./web";
export { standaloneHtml } from "./html";
export { renderWidgets, WIDGET_CSS } from "./widgets-dom";
