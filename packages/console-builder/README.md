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

## Layout

| Path | Purpose |
|---|---|
| `src/builder.ts`, `tokenize.ts`, `types.ts`, `middleware.ts`, `history.ts` | Core engine: tokenizer, typed args, command tree, middleware, help, completion |
| `src/spec.ts`, `calc.ts`, `templates.ts` | JSON specs, safe calculator, templates |
| `src/render-text.ts`, `cli.ts` | Terminal output and the CLI |
| `src/web.ts`, `html.ts`, `browser.ts` | Browser terminal, standalone HTML export, browser bundle entry |
| `web/studio.html` | The Studio. The build inlines the browser bundle into `dist/console-builder-studio.html`, one interactive HTML file that runs offline |
| `test/` | Vitest suites (`npm test`) |
