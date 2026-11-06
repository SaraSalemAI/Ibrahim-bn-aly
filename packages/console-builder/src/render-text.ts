// Console builder — render output blocks as plain or ANSI-coloured text (CLI, logs, tests).
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import type { OutputBlock } from "./types";

const TONES: Record<string, string> = { ok: "32", error: "31", warn: "33", info: "36", muted: "90" };
const width = (s: string) => [...s].length;
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - width(s)));

export function renderText(blocks: OutputBlock[], color = false): string {
  const c = (code: string | undefined, s: string) => (color && code ? `\x1b[${code}m${s}\x1b[0m` : s);
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === "text") out.push(c(b.tone ? TONES[b.tone] : undefined, b.text));
    else if (b.kind === "kv") {
      const w = Math.max(0, ...b.pairs.map(([k]) => width(k)));
      for (const [k, v] of b.pairs) out.push(`${c("90", pad(k, w))}  ${v ?? "—"}`);
    } else {
      const cells = b.rows.map((r) => r.map((v) => (v === null || v === undefined ? "—" : String(v))));
      const widths = b.columns.map((h, i) => Math.min(60, Math.max(width(h), ...cells.map((r) => width(r[i] ?? "")))));
      const line = (r: string[]) => r.map((v, i) => pad(width(v) > widths[i] ? [...v].slice(0, widths[i] - 1).join("") + "…" : v, widths[i])).join("  ").trimEnd();
      out.push(c("1", line(b.columns)));
      out.push(c("90", widths.map((w) => "─".repeat(w)).join("  ")));
      for (const r of cells) out.push(line(r));
    }
  }
  return out.join("\n");
}
