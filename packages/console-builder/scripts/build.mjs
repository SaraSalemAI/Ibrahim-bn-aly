// Builds console-builder: Node library + CLI (ESM), browser bundle (IIFE), and the studio.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "web"), { recursive: true });

const banner = "/*! console-builder — prepared by Sara Salem, (c) Sara Salem 2026 */";
await build({ input: { index: join(root, "src/index.ts"), cli: join(root, "src/cli.ts") }, platform: "node", external: ["zod", /^node:/], output: { dir: dist, format: "esm", entryFileNames: "[name].mjs", chunkFileNames: "[name]-[hash].mjs", banner } });
await build({ input: join(root, "src/browser.ts"), platform: "browser", output: { file: join(dist, "console-builder.browser.js"), format: "iife", name: "ConsoleBuilder", minify: true, banner } });

const cli = join(dist, "cli.mjs");
writeFileSync(cli, "#!/usr/bin/env node\n" + readFileSync(cli, "utf8").replace(/^#!.*\n/, ""));
chmodSync(cli, 0o755);
// Studio: one self-contained page with the browser bundle inlined.
const bundle = readFileSync(join(dist, "console-builder.browser.js"), "utf8").replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
const fragment = readFileSync(join(root, "web/studio.html"), "utf8").replace("/*__BUNDLE__*/", () => bundle);
const page = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${fragment}\n</body>\n</html>\n`;
writeFileSync(join(dist, "studio.fragment.html"), fragment);
writeFileSync(join(dist, "console-builder-studio.html"), page);
writeFileSync(join(dist, "web/index.html"), page);
console.log("Built dist/: index.mjs, cli.mjs, console-builder.browser.js, console-builder-studio.html, web/");
