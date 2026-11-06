// Console builder — export a console as one self-contained HTML file (works offline, no server).
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { parseSpec, type ConsoleSpec } from "./spec";
import { ConsoleError } from "./tokenize";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Makes text safe inside an inline <script>. */
const scriptSafe = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

/**
 * Returns a complete HTML page that runs `spec` as a terminal.
 * `bundle` is the browser build (dist/console-builder.browser.js), which defines `window.ConsoleBuilder`.
 */
export function standaloneHtml(spec: ConsoleSpec, bundle: string): string {
  const r = parseSpec(spec);
  if (!r.ok) throw new ConsoleError(`Invalid console spec:\n${r.errors.join("\n")}`);
  const title = esc(spec.name);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="console-builder — prepared by Sara Salem, © Sara Salem 2026">
<title>${title}</title>
<style>
html,body{height:100%;margin:0;background:${esc(spec.theme?.background ?? "#0d1117")}}
body{display:flex;flex-direction:column;padding:16px;box-sizing:border-box;font-family:system-ui,sans-serif}
#app{flex:1;min-height:0}
footer{color:#8b949e;font:12px system-ui,sans-serif;text-align:center;padding-top:8px}
</style>
</head>
<body>
<div id="app"></div>
<footer>Built with console-builder · Prepared by Sara Salem · © Sara Salem 2026</footer>
<script>${scriptSafe(bundle)}</script>
<script>
ConsoleBuilder.mountConsole(document.getElementById("app"), ${scriptSafe(JSON.stringify(spec))});
</script>
</body>
</html>
`;
}
