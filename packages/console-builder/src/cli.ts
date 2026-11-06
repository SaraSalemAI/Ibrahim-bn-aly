// Console builder — command-line tool. Run, check, scaffold and export consoles from a terminal.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { standaloneHtml } from "./html";
import { renderText } from "./render-text";
import { buildFromSpec, parseSpec, type ConsoleSpec, type SpecContext } from "./spec";
import { TEMPLATES } from "./templates";

const VERSION = "1.0.0";
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const here = dirname(fileURLToPath(import.meta.url));

const USAGE = `console-builder ${VERSION} — build any command console from a JSON spec
Prepared by Sara Salem · © Sara Salem 2026

Usage:
  console-builder run <spec.json|template>        Start an interactive console
  console-builder exec <spec.json|template> "<command>"
                                                  Run one command line and exit (exit code 1 on failure)
  console-builder validate <spec.json>            Check a spec and list its commands
  console-builder init [template] [file]          Write a starter spec (default: starter → console.json)
  console-builder templates                       List built-in templates
  console-builder html <spec.json|template> [-o file.html]
                                                  Export a standalone, offline web console
  console-builder studio [--port 4321]            Open the visual builder in your browser

Templates: ${TEMPLATES.map((t) => t.id).join(", ")}`;

function fail(msg: string): never {
  process.stderr.write(`${paint("31", "error")} ${msg}\n`);
  process.exit(1);
}

function loadSpec(ref: string | undefined): ConsoleSpec {
  if (!ref) fail("missing spec file or template name\n\n" + USAGE);
  const t = TEMPLATES.find((x) => x.id === ref);
  if (t && !existsSync(ref)) return t.spec;
  if (!existsSync(ref)) fail(`no file or template named "${ref}"`);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(ref, "utf8"));
  } catch (e) {
    fail(`${ref} is not valid JSON: ${(e as Error).message}`);
  }
  const r = parseSpec(json);
  if (!r.ok) fail(`${ref} is not a valid console spec:\n  ${r.errors.join("\n  ")}`);
  return json as ConsoleSpec;
}

function makeCtx(spec: ConsoleSpec, history: () => string[]): SpecContext {
  const vars: Record<string, string> = { ...(spec.vars ?? {}) };
  return {
    vars,
    setVar: (n, v) => (v === null ? delete vars[n] : (vars[n] = v)),
    clear: () => process.stdout.write("\x1b[2J\x1b[H"),
    open: (url) => process.stdout.write(`${paint("36", "open")} ${url}\n`),
    fetch: (url, init) => fetch(url, init),
    history,
  };
}

function bundleSource(): string {
  for (const p of [join(here, "console-builder.browser.js"), join(here, "../dist/console-builder.browser.js")]) if (existsSync(p)) return readFileSync(p, "utf8");
  fail("browser bundle not found; run `npm run build` in packages/console-builder first");
}

async function exec(ref: string | undefined, line: string | undefined) {
  if (!line) fail('missing command line, e.g. exec finance "loan 500000 0.18 5"');
  const spec = loadSpec(ref);
  const r = await buildFromSpec(spec).execute(line, makeCtx(spec, () => [line]));
  if (r.output.length) process.stdout.write(renderText(r.output, !!color) + "\n");
  process.exit(r.code);
}

async function repl(ref: string | undefined) {
  const spec = loadSpec(ref);
  const cli = buildFromSpec(spec);
  const histFile = join(homedir(), `.console-builder_${spec.name.replace(/[^\w-]/g, "_")}_history`);
  let saved: string[] = [];
  try {
    saved = readFileSync(histFile, "utf8").split("\n").filter(Boolean).slice(-500);
  } catch {
    /* first run */
  }
  const lines: string[] = [...saved];
  const ctx = makeCtx(spec, () => lines);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${paint("36", spec.prompt ?? "❯")} `,
    history: [...saved].reverse(),
    historySize: 500,
    completer: (line: string) => {
      const hits = cli.complete(line, ctx).map((c) => c.value);
      const last = /(\S*)$/.exec(line)![1];
      return [hits, last];
    },
  });
  process.stdout.write(`${paint("1;36", spec.name)}  ${paint("90", spec.welcome ?? "Type help to list commands, exit to quit.")}\n`);
  rl.prompt();
  for await (const line of rl) {
    const t = line.trim();
    if (t === "exit" || t === "quit") break;
    if (t) {
      lines.push(t);
      const r = await cli.execute(t, ctx);
      if (r.output.length) process.stdout.write(renderText(r.output, !!color) + "\n");
    }
    rl.prompt();
  }
  try {
    writeFileSync(histFile, lines.slice(-500).join("\n") + "\n");
  } catch {
    /* read-only home */
  }
  rl.close();
}

function studio(port: number) {
  const root = join(here, "web");
  const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };
  if (!existsSync(join(root, "index.html"))) fail("studio files not found; run `npm run build` in packages/console-builder first");
  createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  }).listen(port, "127.0.0.1", () => process.stdout.write(`Console builder studio → ${paint("36", `http://localhost:${port}`)}  (Ctrl+C to stop)\n`));
}

async function main(argv: string[]) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      process.stdout.write(USAGE + "\n");
      return;
    case "-v":
    case "--version":
      process.stdout.write(VERSION + "\n");
      return;
    case "templates":
      for (const t of TEMPLATES) process.stdout.write(`${paint("36", t.id.padEnd(10))} ${t.title} — ${t.description}\n`);
      return;
    case "init": {
      const t = TEMPLATES.find((x) => x.id === (rest[0] ?? "starter")) ?? fail(`unknown template "${rest[0]}". Run: console-builder templates`);
      const file = rest[1] ?? "console.json";
      if (existsSync(file)) fail(`${file} already exists`);
      writeFileSync(file, JSON.stringify(t.spec, null, 2) + "\n");
      process.stdout.write(`Created ${file} from "${t.title}". Try: console-builder run ${file}\n`);
      return;
    }
    case "validate": {
      const spec = loadSpec(rest[0]);
      const cli = buildFromSpec(spec);
      process.stdout.write(`${paint("32", "✓")} ${spec.name}: ${cli.commands().length} commands\n`);
      for (const c of cli.commands()) process.stdout.write(`  ${cli.usage(c).padEnd(40)} ${paint("90", c.summary)}\n`);
      return;
    }
    case "exec":
      return exec(rest[0], rest.slice(1).join(" "));
    case "run":
      return repl(rest[0]);
    case "html": {
      const spec = loadSpec(rest[0]);
      const o = rest.indexOf("-o");
      const out = o >= 0 ? rest[o + 1] : `${spec.name}.html`;
      writeFileSync(out, standaloneHtml(spec, bundleSource()));
      process.stdout.write(`Wrote ${out} — open it in any browser, no server needed.\n`);
      return;
    }
    case "studio": {
      const p = rest.indexOf("--port");
      return studio(p >= 0 ? Number(rest[p + 1]) : 4321);
    }
    default:
      fail(`unknown command "${cmd}"\n\n${USAGE}`);
  }
}

process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(0);
  throw e;
});

main(process.argv.slice(2)).catch((e) => fail(e instanceof Error ? e.message : String(e)));
