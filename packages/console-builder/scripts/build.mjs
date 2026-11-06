// Builds console-builder: Node library + CLI (ESM), browser bundle (IIFE), and the studio.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
copyFileSync(join(root, "web/index.html"), join(dist, "web/index.html"));
copyFileSync(join(dist, "console-builder.browser.js"), join(dist, "web/console-builder.browser.js"));
console.log("Built dist/: index.mjs, cli.mjs, console-builder.browser.js, web/");
