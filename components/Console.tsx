"use client";
// AI CFO console drawer — the AI CFO console rendered with the generic Terminal. Toggle with Ctrl+` or Ctrl+K.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildCfoConsole, type CfoContext } from "@/lib/console/commands/cfo";
import type { PeriodStatus } from "@/lib/workspace/types";
import { useWorkspace } from "@/lib/workspace/store";
import { Terminal } from "./Terminal";

export function ConsoleDrawer() {
  const { ws, company, computed, dispatch, update } = useWorkspace();
  const router = useRouter();
  const path = usePathname();
  const cli = useMemo(() => buildCfoConsole(), []);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "`" || e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (path === "/console-builder") return null;

  if (!open)
    return (
      <button className="con-launch" onClick={() => setOpen(true)} title="Console (Ctrl+`)" aria-label="Open console">
        &gt;_
      </button>
    );

  return (
    <div className="con" role="dialog" aria-label="AI CFO console">
      <Terminal<CfoContext>
        cli={cli}
        title="ai-cfo console"
        subtitle={`${company ? company.settings.tradeNameEn : "no company"} · ${ws.profile.role}`}
        welcome="Type help to list commands. Chain with && or ;. Tab completes, ↑/↓ history, Esc closes. Prepared by Sara Salem © 2026."
        historyKey="ai-cfo.console.history"
        onClose={() => setOpen(false)}
        makeCtx={(api) => ({
          ws,
          company,
          computed,
          dispatch,
          navigate: (href) => router.push(href),
          clear: api.clear,
          setPeriodStatus: (to: PeriodStatus) =>
            update(
              { action: `period.${to.toLowerCase()}`, entity: "financial_periods", reason: "console" },
              (c) => ({ ...c, period: { ...c.period, status: to, lockedAt: to === "LOCKED" ? new Date().toISOString() : null, lockedBy: to === "LOCKED" ? ws.profile.name : null } }),
              { allowWhenLocked: true },
            ),
        })}
      />
    </div>
  );
}
