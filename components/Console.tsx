"use client";
// AI CFO console drawer — UI for the console builder. Toggle with Ctrl+` or Ctrl+K.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { applyCompletion, commonPrefix, History, type Completion, type OutputBlock } from "@/lib/console";
import { buildCfoConsole, type CfoContext } from "@/lib/console/commands/cfo";
import type { PeriodStatus } from "@/lib/workspace/types";
import { useWorkspace } from "@/lib/workspace/store";

interface Entry {
  id: number;
  line: string;
  output: OutputBlock[];
  code: number;
}

const HISTORY_KEY = "ai-cfo.console.history";

function readHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function Block({ b }: { b: OutputBlock }) {
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
          <tr>{b.columns.map((c) => <th key={c}>{c}</th>)}</tr>
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

export function ConsoleDrawer() {
  const { ws, company, computed, dispatch, update } = useWorkspace();
  const router = useRouter();
  const cli = useMemo(() => buildCfoConsole(), []);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hints, setHints] = useState<Completion[]>([]);
  const [busy, setBusy] = useState(false);
  const history = useRef<History | null>(null);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    history.current = new History(readHistory());
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "`" || e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  const ctx: CfoContext = {
    ws,
    company,
    computed,
    dispatch,
    navigate: (href) => router.push(href),
    clear: () => setEntries([]),
    setPeriodStatus: (to: PeriodStatus) =>
      update(
        { action: `period.${to.toLowerCase()}`, entity: "financial_periods", reason: "console" },
        (c) => ({ ...c, period: { ...c.period, status: to, lockedAt: to === "LOCKED" ? new Date().toISOString() : null, lockedBy: to === "LOCKED" ? ws.profile.name : null } }),
        { allowWhenLocked: true },
      ),
  };

  const run = useCallback(
    async (line: string) => {
      history.current?.push(line);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.current?.all() ?? []));
      } catch {
        /* storage blocked: history stays in memory */
      }
      setBusy(true);
      const res = await cli.execute(line, ctx);
      setBusy(false);
      const isClear = /^\s*(clear|cls)\s*$/i.test(line);
      if (!isClear) setEntries((prev) => [...prev, { id: ++seq.current, line, output: res.output, code: res.code }].slice(-100));
    },
    // ctx is rebuilt every render on purpose so commands always see the latest workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cli, ws, company, computed],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const line = input;
      setInput("");
      setHints([]);
      if (line.trim()) void run(line);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const v = history.current?.prev();
      if (v !== null && v !== undefined) setInput(v);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setInput(history.current?.next() ?? "");
    } else if (e.key === "Tab") {
      e.preventDefault();
      const c = cli.complete(input, ctx);
      if (c.length === 1) {
        setInput(applyCompletion(input, c[0].value, true));
        setHints([]);
      } else if (c.length > 1) {
        const p = commonPrefix(c.map((x) => x.value));
        if (p) setInput(applyCompletion(input, p, false));
        setHints(c);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open)
    return (
      <button className="con-launch" onClick={() => setOpen(true)} title="Console (Ctrl+`)" aria-label="Open console">
        &gt;_
      </button>
    );

  return (
    <section className="con" role="dialog" aria-label="AI CFO console" dir="ltr">
      <header className="con-head">
        <span className="con-title">ai-cfo console</span>
        <span className="muted small">{company ? company.settings.tradeNameEn : "no company"} · {ws.profile.role}</span>
        <span className="spacer" />
        <button className="ghost" onClick={() => setOpen(false)} aria-label="Close console">
          ✕
        </button>
      </header>
      <div className="con-body" onClick={() => inputRef.current?.focus()}>
        {!entries.length && <div className="con-text muted">Type help to list commands. Tab completes, ↑/↓ history, Esc closes. Prepared by Sara Salem © 2026.</div>}
        {entries.map((e) => (
          <div key={e.id} className="con-entry">
            <div className="con-line">
              <span className="con-prompt">❯</span> {e.line}
            </div>
            {e.output.map((b, i) => (
              <Block key={i} b={b} />
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {hints.length > 1 && (
        <div className="con-hints">
          {hints.slice(0, 12).map((h) => (
            <button key={h.value} className="ghost" onClick={() => { setInput(applyCompletion(input, h.value, true)); setHints([]); inputRef.current?.focus(); }}>
              {h.value}
              {h.description && <span className="muted"> — {h.description}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="con-input">
        <span className="con-prompt">❯</span>
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} disabled={busy} spellCheck={false} autoComplete="off" aria-label="Command" />
      </div>
    </section>
  );
}
