# console-builder

*Prepared by Sara Salem · © Sara Salem 2026*

Build **any** command console — in code or from a JSON spec — and run it:

- in your **terminal** (interactive, with Tab completion and history),
- in **any web page** (a framework-free terminal widget),
- as a **standalone offline HTML file** you can email or host anywhere,
- or design it visually in the **Studio**.

It is a separate package with one dependency (`zod`). The AI CFO app in this repository is just one user of it.

## Quick start

```bash
cd packages/console-builder
npm install        # inside this repo, the root install is enough
npm run build      # builds dist/: library, CLI, browser bundle, studio
```

```bash
node dist/cli.mjs init finance my-console.json   # start from a template
node dist/cli.mjs run my-console.json            # interactive console
node dist/cli.mjs exec my-console.json "loan 500000 0.18 5"
node dist/cli.mjs html my-console.json -o my-console.html   # offline web console
node dist/cli.mjs studio                         # visual builder → http://localhost:4321
# or just open dist/console-builder-studio.html in a browser: one self-contained interactive file
```

After `npm link` (or installing the package), the command is simply `console-builder`.

| CLI command | What it does |
|---|---|
| `run <spec\|template>` | Interactive console (Tab completes, ↑/↓ history saved per console, `exit` quits) |
| `exec <spec\|template> "<line>"` | Runs one line (chains allowed), prints the result, exit code 1 on failure — good for scripts and CI |
| `validate <spec>` | Checks a spec and lists its commands, with precise error paths |
| `init [template] [file]` | Writes a starter spec |
| `templates` | Lists built-in templates: `starter`, `finance`, `devops`, `api`, `game` |
| `html <spec\|template> [-o file]` | Exports a single self-contained HTML console |
| `studio [--port n]` | Serves the visual builder locally |

## The spec

```json
{
  "name": "ops",
  "welcome": "Ops console",
  "prompt": "$",
  "theme": { "background": "#0d1117", "foreground": "#d6dde8", "accent": "#7fd1b9" },
  "vars": { "env": "staging" },
  "groups": [{ "name": "env", "summary": "Environment" }],
  "commands": [
    {
      "name": "env use",
      "summary": "Switch environment",
      "args": [{ "name": "name", "type": "enum", "choices": ["dev", "staging", "production"], "positional": true, "required": true }],
      "actions": [
        { "type": "set", "name": "env", "value": "{name}" },
        { "type": "print", "text": "Environment → {name}", "tone": "ok" }
      ]
    }
  ]
}
```

- **Arguments:** `string`, `number`, `boolean`, `enum`; positional or `--flag value` / `--flag=value` / `-alias`; `required`, `default`, `rest`, `--no-flag`.
- **Templating:** `{arg}` for arguments, `{$var}` for variables.
- **Actions:** `print`, `table`, `kv`, `calc` (safe arithmetic — no `eval`; `saveAs`, `decimals`, `label`), `set`, `http` (GET/POST JSON, http(s) only, `pick`, `as: table|kv|json|text`, `saveAs`), `open`, `run` (macro, max depth 5), `choice`, `date`.
- **Built-in commands:** `help`, `clear`, `echo`, `set`, `unset`, `vars`, `calc`, `history`. A spec command with the same name replaces the built-in.
- **Chaining:** `a && b` stops on failure, `a ; b` always continues.

## In code

```ts
import { buildFromSpec, ConsoleBuilder, renderText } from "console-builder";

// From a spec
const cli = buildFromSpec(spec);
const { output, code } = await cli.execute("env use production && env show", ctx);
console.log(renderText(output, true));

// Fully custom and typed, with your own context and middleware
const app = new ConsoleBuilder<{ user: string }>("app")
  .command({ path: ["whoami"], summary: "Current user", run: (_a, ctx, io) => io.print(ctx.user) })
  .build();
```

In a web page (no framework):

```html
<div id="term" style="height:400px"></div>
<script src="console-builder.browser.js"></script>
<script>ConsoleBuilder.mountConsole(document.getElementById("term"), spec);</script>
```

## Build from a prompt or from files

The studio (`npm run studio`, or `dist/console-builder-studio.html`) is a dashboard with four ways to build:

- **Describe** – write what the console should do; Claude designs the spec (inside the Claude page only; it asks consent on first use).
- **Upload files** – drop CSV, TSV, JSON or text files. They become datasets with `rows`, `find`, `where`, `top`, `stats` and `columns` commands, no AI needed. Files can also be sent to Claude as context.
- **Start here** – 24 templates in 6 groups (Start, Agents, Business, Data, Tools, Fun), including 10 agent samples (support, sales, HR, travel, tutor, marketing, project manager, health coach, budget, recruiter). Each has easy numbered steps with a ▶ button and "Run all steps".
- **Library** – a prompt library of 30 ready text prompts by field (use in Describe or copy to any AI), plus "My library" to save your own consoles and prompts in the browser.
- **More agents** – 20 more field agents: clinic, pharmacy, teacher, legal, broker, restaurant, online store, shipping, construction, farm, IT helpdesk, security, accountant, insurance, hotel, events, gym, charity, content creator, car rental. Each step shows what it does and what to type.
- **Sample files** – products.csv, employees.csv, orders.json and notes.txt to try uploads without your own file.
- **JSON** – edit the spec directly.

KPIs, usage bars, a run log and a data preview update as you use the console.

Datasets live in the spec under `datasets` and are read by three actions:

```json
{"type":"query","dataset":"sales","search":"{text}","where":"amount>100 and region=EU","sortBy":"amount","desc":true,"limit":20}
{"type":"stats","dataset":"sales","column":"amount"}
{"type":"columns","dataset":"sales"}
```

In code: `loadFile(name, text)`, `parseDelimited(text)`, `specFromDatasets(datasets)`, `buildPrompt(request, datasets, notes)` and `extractJson(reply)`.

## Dashboards, builder, brand and more

- **Dashboard widgets** (inspired by the AI Console Builder app on Base44): `widgets` in a spec draw KPI, bar, line, pie and table widgets from datasets. Uploaded data gets a starter dashboard automatically (`suggestWidgets`); the exported web console shows it above the terminal.
- **Builder** tab: make an agent with a form, step by step, no JSON.
- **AI chat**: every agent has `ask <question>` (action `{"type":"ai"}`), answered by Claude inside Claude.
- **Live data links**: `sources` maps a dataset to a CSV/JSON URL (Google Sheets links are converted) that reloads when the web console opens.
- **Brand** tab: themes, colours, title, welcome line and prompt symbol.
- **Report**: save the session's runs as an HTML report or CSV.
- **Team library**: share consoles with everyone who opens the studio page in Claude.
- **Arabic / English** switch for the studio.
- 54 templates including 40 agents (finance, HR and training agents added).

## Layout

| Path | Purpose |
|---|---|
| `src/builder.ts`, `tokenize.ts`, `types.ts`, `middleware.ts`, `history.ts` | Core engine: tokenizer, typed args, command tree, middleware, help, completion |
| `src/spec.ts`, `calc.ts`, `templates.ts` | JSON specs, safe calculator, templates |
| `src/render-text.ts`, `cli.ts` | Terminal output and the CLI |
| `src/web.ts`, `html.ts`, `browser.ts` | Browser terminal, standalone HTML export, browser bundle entry |
| `web/studio.html` | The Studio. The build inlines the browser bundle into `dist/console-builder-studio.html`, one interactive HTML file that runs offline |
| `test/` | Vitest suites (`npm test`) |
