"use client";
// Generic terminal UI for any console built with lib/console.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { applyCompletion, commonPrefix, History, type BuiltConsole, type Completion, type OutputBlock } from "console-builder";

export interface TerminalApi {
  clear: () => void;
  run: (line: string) => Promise<number>;
  history: () => string[];
}

interface Entry {
  id: number;
  line: string;
  output: OutputBlock[];
}

export function OutputView({ b }: { b: OutputBlock }) {
  if (b.kind === "text") return <div className={`con-text ${b.tone ?? ""}`}>{b.text}</div>;
  if (b.kind === "kv")
    return (
      <dl className="con-kv">
        {b.pairs.map(([k, v], i) => (
          <div key={i}>
            <dt>{k}</dt>
            <dd>{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <div className="con-table-wrap">
      <table className="con-table">
        <thead>
          <tr>{b.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j}>{v ?? "—"}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface TerminalProps<C> {
  cli: BuiltConsole<C>;
  /** Builds the command context on every run, so commands see fresh state. */
  makeCtx: (api: TerminalApi) => C;
  title?: string;
  subtitle?: string;
  welcome?: string;
  prompt?: string;
  historyKey?: string;
  theme?: { background?: string; foreground?: string; accent?: string };
  autoFocus?: boolean;
  onClose?: () => void;
  className?: string;
}

export function Terminal<C>({ cli, makeCtx, title, subtitle, welcome, prompt = "❯", historyKey, theme, autoFocus = true, onClose, className = "" }: TerminalProps<C>) {
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hints, setHints] = useState<Completion[]>([]);
  const [busy, setBusy] = useState(false);
  const history = useRef<History>(new History());
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let saved: string[] = [];
    if (historyKey)
      try {
        saved = JSON.parse(localStorage.getItem(historyKey) ?? "[]");
      } catch {
        /* storage blocked */
      }
    history.current = new History(Array.isArray(saved) ? saved : []);
  }, [historyKey]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  // A new console (e.g. edited spec) starts on a clean screen.
  useEffect(() => setEntries([]), [cli]);

  const api: TerminalApi = {
    clear: () => setEntries([]),
    history: () => history.current.all(),
    run: async (line) => {
      const res = await cli.execute(line, makeCtx(api));
      setEntries((prev) => [...prev, { id: ++seq.current, line, output: res.output }].slice(-200));
      return res.code;
    },
  };

  const submit = async (line: string) => {
    history.current.push(line);
    if (historyKey)
      try {
        localStorage.setItem(historyKey, JSON.stringify(history.current.all()));
      } catch {
        /* storage blocked */
      }
    setBusy(true);
    let cleared = false;
    const ctx = makeCtx({ ...api, clear: () => ((cleared = true), setEntries([])) });
    const res = await cli.execute(line, ctx);
    setBusy(false);
    if (!cleared) setEntries((prev) => [...prev, { id: ++seq.current, line, output: res.output }].slice(-200));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const line = input;
      setInput("");
      setHints([]);
      if (line.trim()) void submit(line);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const v = history.current.prev();
      if (v !== null) setInput(v);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setInput(history.current.next());
    } else if (e.key === "Tab") {
      e.preventDefault();
      const c = cli.complete(input, makeCtx(api));
      if (c.length === 1) {
        setInput(applyCompletion(input, c[0].value, true));
        setHints([]);
      } else if (c.length > 1) {
        const p = commonPrefix(c.map((x) => x.value));
        if (p) setInput(applyCompletion(input, p, false));
        setHints(c);
      }
    } else if (e.key === "Escape" && onClose) onClose();
    else if (e.key.toLowerCase() === "l" && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    }
  };

  const style = { "--con-bg": theme?.background, "--con-fg": theme?.foreground, "--con-accent": theme?.accent } as CSSProperties;

  return (
    <section className={`con-term ${className}`} style={style} role="region" aria-label={title ?? cli.name} dir="ltr">
      <header className="con-head">
        <span className="con-title">{title ?? cli.name}</span>
        {subtitle && <span className="muted small">{subtitle}</span>}
        <span className="spacer" />
        {onClose && (
          <button className="ghost" onClick={onClose} aria-label="Close console">
            ✕
          </button>
        )}
      </header>
      <div className="con-body" onClick={() => inputRef.current?.focus()}>
        {!entries.length && <div className="con-text muted">{welcome ?? "Type help to list commands. Tab completes, ↑/↓ history, Ctrl+L clears."}</div>}
        {entries.map((e) => (
          <div key={e.id} className="con-entry">
            <div className="con-line">
              <span className="con-prompt">{prompt}</span> {e.line}
            </div>
            {e.output.map((b, i) => (
              <OutputView key={i} b={b} />
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {hints.length > 1 && (
        <div className="con-hints">
          {hints.slice(0, 12).map((h) => (
            <button
              key={h.value}
              className="ghost"
              onClick={() => {
                setInput(applyCompletion(input, h.value, true));
                setHints([]);
                inputRef.current?.focus();
              }}
            >
              {h.value}
              {h.description && <span className="muted"> — {h.description}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="con-input">
        <span className="con-prompt">{prompt}</span>
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} disabled={busy} spellCheck={false} autoComplete="off" aria-label="Command" />
      </div>
    </section>
  );
}
