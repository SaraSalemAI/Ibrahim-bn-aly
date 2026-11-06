# Console builder — architecture

*Prepared by Sara Salem. Copyright © Sara Salem 2026.*

`lib/console` is a small, framework-free toolkit for building typed command consoles. The AI CFO
console (`lib/console/commands/cfo.ts` + `components/Console.tsx`) is the first console built with it.

```
 keyboard ──► ConsoleDrawer (React UI)         components/Console.tsx
                │  history ↑/↓, Tab completion, output rendering
                ▼
           BuiltConsole.execute(line, ctx)      lib/console/builder.ts
                │
   tokenize ─► resolve (command tree) ─► bindArgs (typed) ─► middleware chain ─► command.run(args, ctx, io)
   tokenize.ts   builder.ts               tokenize.ts         middleware.ts        commands/*.ts
                                                                                     │
                                                         OutputBlock[] (text | table | kv) ◄┘
```

## Layers

| Layer | File | Responsibility |
|---|---|---|
| Types | `types.ts` | `CommandSpec<C>`, `ArgSpec<C>`, `OutputBlock`, `Middleware<C>`, `CommandIO`. `C` is the app context type, so commands are typed against the host app without the toolkit knowing about it. |
| Tokenizer | `tokenize.ts` | Shell-style splitting (quotes, escapes, Unicode/Arabic), then binding tokens to declared args: positionals, `--flag value`, `--flag=value`, `-alias`, `--no-flag`, `--`, defaults, required checks, number/boolean/enum coercion with clear errors. |
| Builder | `builder.ts` | Fluent `ConsoleBuilder` (`command`, `group`, `use`, `build`) producing a command **tree** (multi-word commands, aliases, case-insensitive). `BuiltConsole` provides `execute`, `help`, `usage`, `complete` and "did you mean" suggestions. |
| Middleware | `middleware.ts` | Onion-style chain driven by command **tags**: `requireTag` (preconditions), `roleGuard` (`role:REVIEWER\|CFO`), `onExecuted` (telemetry/audit sinks). |
| History | `history.ts` | Bounded, de-duplicated history with cursor navigation; completion helpers (`commonPrefix`, `applyCompletion`). |
| Commands | `commands/cfo.ts` | The AI CFO command set. Pure functions of `CfoContext` — no React — so the whole set is unit-tested. |
| UI | `components/Console.tsx` | Drawer mounted by `Shell`. Builds `CfoContext` from the workspace store each render, persists history to `localStorage`. |

## Design rules

1. **Commands never mutate state directly.** They call `ctx.dispatch` / `ctx.setPeriodStatus`, which go
   through the existing reducer, so the period lock and the hash-chained audit log still apply.
2. **Output is data, not markup.** Commands emit `OutputBlock`s; any renderer (drawer, test, future CLI
   or API route) can display them.
3. **Policy lives in middleware, declared by tags.** `needs:company`, `needs:data`, `role:…`, `mutates`.
4. **Errors are values.** Parse errors, guard failures and thrown exceptions all become `code: 1` plus an
   error block; `execute` never throws.

## AI CFO commands

| Command | Purpose |
|---|---|
| `help [command]` | List commands or show usage, arguments and examples |
| `modules` / `go <key\|n>` | List modules / navigate (`go tax`, `go 5`) |
| `company list\|select <name>\|sample` | Manage the active company; load the fictional sample |
| `status` | Period, framework, status and close-checklist results |
| `kpi`, `fs [pl\|bs]`, `ratios [-g group]`, `tb [-s text] [--unmapped] [-n N]` | Read figures |
| `period advance [STATUS]` | Gated state transition (Reviewer/CFO; lock is CFO only) |
| `audit verify` / `audit tail [n]` | Verify the hash chain / recent entries |
| `lang en\|ar`, `whoami`, `clear` | Session utilities |

Open with **Ctrl+`** or **Ctrl+K** (or the `>_` button), Tab to complete, ↑/↓ for history, Esc to close.

## Adding a command

```ts
.command({
  path: ["fx", "rate"],
  summary: "Show the stress-test FX shock",
  tags: ["needs:company"],
  args: [{ name: "currency", type: "enum", choices: ["USD", "EUR"], positional: true, required: true }],
  run: (args, ctx, io) => io.kv([["Shock", ctx.company!.stress.fxShockPct]]),
})
```

Add a test in `tests/console.test.ts`; `npm test` runs it without a browser.

## General-purpose console builder (any console)

The toolkit is not tied to finance. Any console can be described as a JSON **spec** and built at runtime:

| Piece | File | What it does |
|---|---|---|
| Spec engine | `lib/console/spec.ts` | Zod-validated `ConsoleSpec` → `BuiltConsole` (`buildFromSpec`). Precise error paths, `{arg}` / `{$var}` templating, built-in commands. |
| Safe calculator | `lib/console/calc.ts` | Recursive-descent arithmetic (no `eval`): `+ - * / % ^`, parentheses, variables, `round sqrt min max pow log ln exp abs floor ceil`, `pi`, `e`. |
| Chaining | `splitChain` in `tokenize.ts` | `a && b` stops on failure, `a ; b` always continues; quotes are respected. |
| Templates | `lib/console/templates.ts` | Starter, Finance calculator, DevOps toolbox, API explorer, Decision helper. |
| Terminal UI | `components/Terminal.tsx` | Reusable terminal for **any** `BuiltConsole` (history, Tab completion, hints, themes, Ctrl+L). The AI CFO drawer uses it too. |
| Builder page | `app/console-builder/page.tsx` | `/console-builder`: pick a template, edit JSON, see errors live, try the console, export/import JSON, copy a share link (`#spec=…`). |

### Spec format

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
      "actions": [{ "type": "set", "name": "env", "value": "{name}" }, { "type": "print", "text": "Environment → {name}", "tone": "ok" }]
    }
  ]
}
```

Actions: `print`, `table`, `kv`, `calc` (`saveAs`, `decimals`, `label`), `set`, `http` (GET/POST, http(s) only, `pick` dot-path, `as: table|kv|json|text`, `saveAs`), `open`, `run` (macro, max depth 5), `choice`, `date`.
Every console also gets `help`, `clear`, `echo`, `set`, `unset`, `vars`, `calc`, `history`; a spec command with the same name overrides the built-in.

### In code

```ts
import { buildFromSpec } from "@/lib/console/spec";
const cli = buildFromSpec(mySpec);
const { output, code } = await cli.execute("env use production && env show", ctx);
```

Or build fully custom, typed consoles with `new ConsoleBuilder<MyCtx>("name")` as the AI CFO console does.
