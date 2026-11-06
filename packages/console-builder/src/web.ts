// Console builder — framework-free browser terminal. Works in any web page.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { BuiltConsole } from "./builder";
import { applyCompletion, commonPrefix, History } from "./history";
import { buildFromSpec, type ConsoleSpec, type SpecContext } from "./spec";
import type { OutputBlock } from "./types";

export const CONSOLE_CSS = `
.cb-term{--bg:var(--cb-bg,#0d1117);--fg:var(--cb-fg,#d6dde8);--ac:var(--cb-accent,#7fd1b9);display:flex;flex-direction:column;min-height:0;height:100%;background:var(--bg);color:var(--fg);border:1px solid #222a35;border-top:2px solid var(--ac);border-radius:10px;overflow:hidden;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-sizing:border-box}
.cb-term *{box-sizing:border-box}
.cb-head{display:flex;align-items:center;gap:12px;padding:6px 12px;border-bottom:1px solid rgba(127,127,127,.25)}
.cb-title{font-weight:700;color:var(--ac)}.cb-sub{color:#8b949e;font-size:12px}
.cb-body{flex:1;overflow:auto;padding:8px 12px;min-height:0}
.cb-entry{margin-bottom:10px}.cb-line{font-weight:600}.cb-prompt{color:var(--ac);margin-inline-end:6px}
.cb-text{white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext}
.cb-ok{color:#6fdc8c}.cb-error{color:#ff7b72}.cb-warn{color:#e3b341}.cb-info{color:#79c0ff}.cb-muted{color:#8b949e}
.cb-tablewrap{overflow-x:auto}.cb-table{border-collapse:collapse;margin:4px 0}
.cb-table th,.cb-table td{padding:1px 14px 1px 0;text-align:start;white-space:nowrap;unicode-bidi:plaintext;border:0;background:none;color:inherit}
.cb-table th{color:#8b949e;font-weight:600;border-bottom:1px solid rgba(127,127,127,.3)}
.cb-kv{display:grid;grid-template-columns:max-content 1fr;gap:0 16px;margin:4px 0}.cb-kv dt{color:#8b949e}.cb-kv dd{margin:0;overflow-wrap:anywhere}
.cb-hints{display:flex;flex-wrap:wrap;gap:4px;padding:4px 12px;border-top:1px solid rgba(127,127,127,.25)}
.cb-hints button{font:inherit;font-size:12px;padding:2px 8px;background:transparent;color:var(--fg);border:1px solid rgba(127,127,127,.35);border-radius:6px;cursor:pointer}
.cb-input{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid rgba(127,127,127,.25)}
.cb-input input{flex:1;min-width:0;background:transparent;border:0;outline:none;color:var(--fg);font:inherit;padding:0}
`;

export interface MountOptions {
  title?: string;
  subtitle?: string;
  welcome?: string;
  prompt?: string;
  theme?: { background?: string; foreground?: string; accent?: string };
  historyKey?: string;
  autoFocus?: boolean;
  /** Overrides how spec consoles open links and make HTTP calls (e.g. inside sandboxed pages). */
  open?: (url: string) => void;
  fetch?: SpecContext["fetch"];
  /** Only for consoles built in code: supplies the command context. Spec consoles get one automatically. */
  makeCtx?: (api: { clear: () => void; history: () => string[] }) => unknown;
}

export interface MountedConsole {
  run: (line: string) => Promise<number>;
  clear: () => void;
  destroy: () => void;
  vars: Record<string, string>;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderBlock(b: OutputBlock): HTMLElement {
  if (b.kind === "text") return el("div", `cb-text${b.tone ? ` cb-${b.tone}` : ""}`, b.text);
  if (b.kind === "kv") {
    const dl = el("dl", "cb-kv");
    for (const [k, v] of b.pairs) {
      dl.append(el("dt", undefined, k), el("dd", undefined, v === null ? "—" : String(v)));
    }
    return dl;
  }
  const wrap = el("div", "cb-tablewrap");
  const t = el("table", "cb-table");
  const hr = el("tr");
  for (const c of b.columns) hr.append(el("th", undefined, c));
  t.append(el("thead"), el("tbody"));
  t.tHead!.append(hr);
  for (const r of b.rows) {
    const tr = el("tr");
    for (const v of r) tr.append(el("td", undefined, v === null ? "—" : String(v)));
    t.tBodies[0].append(tr);
  }
  wrap.append(t);
  return wrap;
}

let cssInjected = false;
function injectCss() {
  if (cssInjected || typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = CONSOLE_CSS;
  document.head.append(s);
  cssInjected = true;
}

/** Mounts a working terminal into `target`, from a JSON spec or a console built in code. */
export function mountConsole(target: HTMLElement, source: ConsoleSpec | BuiltConsole<unknown>, opts: MountOptions = {}): MountedConsole {
  injectCss();
  const isSpec = !(source instanceof BuiltConsole);
  const spec = isSpec ? (source as ConsoleSpec) : null;
  const cli = (isSpec ? buildFromSpec(spec!) : source) as BuiltConsole<unknown>;
  const vars: Record<string, string> = { ...(spec?.vars ?? {}) };
  let saved: string[] = [];
  const hk = opts.historyKey ?? `console-builder.history.${cli.name}`;
  try {
    saved = JSON.parse(localStorage.getItem(hk) ?? "[]");
  } catch {
    /* storage blocked */
  }
  const history = new History(Array.isArray(saved) ? saved : []);
  const prompt = opts.prompt ?? spec?.prompt ?? "❯";
  const theme = opts.theme ?? spec?.theme;

  const root = el("section", "cb-term");
  root.setAttribute("dir", "ltr");
  root.setAttribute("aria-label", opts.title ?? cli.name);
  if (theme?.background) root.style.setProperty("--cb-bg", theme.background);
  if (theme?.foreground) root.style.setProperty("--cb-fg", theme.foreground);
  if (theme?.accent) root.style.setProperty("--cb-accent", theme.accent);
  const head = el("header", "cb-head");
  head.append(el("span", "cb-title", opts.title ?? cli.name));
  if (opts.subtitle) head.append(el("span", "cb-sub", opts.subtitle));
  const body = el("div", "cb-body");
  const welcome = () => body.append(el("div", "cb-text cb-muted", opts.welcome ?? spec?.welcome ?? "Type help to list commands. Tab completes, ↑/↓ history, Ctrl+L clears."));
  welcome();
  const hints = el("div", "cb-hints");
  hints.hidden = true;
  const bar = el("div", "cb-input");
  const input = el("input");
  input.setAttribute("aria-label", "Command");
  input.spellcheck = false;
  input.autocomplete = "off";
  bar.append(el("span", "cb-prompt", prompt), input);
  root.append(head, body, hints, bar);
  target.replaceChildren(root);

  let cleared = false;
  const clear = () => {
    cleared = true;
    body.replaceChildren();
  };
  const api = { clear, history: () => history.all() };
  const ctx = (): unknown =>
    isSpec
      ? ({
          vars,
          setVar: (n: string, v: string | null) => (v === null ? delete vars[n] : (vars[n] = v)),
          clear,
          open: opts.open ?? ((url: string) => window.open(url, "_blank", "noopener,noreferrer")),
          fetch: opts.fetch ?? ((url: string, init?: RequestInit) => fetch(url, init)),
          history: api.history,
        } satisfies SpecContext)
      : (opts.makeCtx?.(api) ?? {});

  const run = async (line: string) => {
    cleared = false;
    history.push(line);
    try {
      localStorage.setItem(hk, JSON.stringify(history.all()));
    } catch {
      /* storage blocked */
    }
    input.disabled = true;
    const res = await cli.execute(line, ctx());
    input.disabled = false;
    if (!cleared) {
      const entry = el("div", "cb-entry");
      const l = el("div", "cb-line");
      l.append(el("span", "cb-prompt", prompt), document.createTextNode(line));
      entry.append(l, ...res.output.map(renderBlock));
      body.append(entry);
      while (body.children.length > 200) body.firstElementChild?.remove();
      body.scrollTop = body.scrollHeight;
    }
    input.focus();
    return res.code;
  };

  const showHints = (list: { value: string; description?: string }[]) => {
    hints.replaceChildren(
      ...list.slice(0, 12).map((h) => {
        const b = el("button", undefined, h.description ? `${h.value} — ${h.description}` : h.value);
        b.type = "button";
        b.onclick = () => {
          input.value = applyCompletion(input.value, h.value, true);
          hints.hidden = true;
          input.focus();
        };
        return b;
      }),
    );
    hints.hidden = list.length < 2;
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const line = input.value;
      input.value = "";
      hints.hidden = true;
      if (line.trim()) void run(line);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const v = history.prev();
      if (v !== null) input.value = v;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      input.value = history.next();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const c = cli.complete(input.value, ctx());
      if (c.length === 1) {
        input.value = applyCompletion(input.value, c[0].value, true);
        hints.hidden = true;
      } else if (c.length > 1) {
        const p = commonPrefix(c.map((x) => x.value));
        if (p) input.value = applyCompletion(input.value, p, false);
        showHints(c);
      }
    } else if (e.key.toLowerCase() === "l" && e.ctrlKey) {
      e.preventDefault();
      body.replaceChildren();
    }
  });
  body.addEventListener("click", () => input.focus());
  if (opts.autoFocus !== false) input.focus();

  return { run, clear, destroy: () => root.remove(), vars };
}
