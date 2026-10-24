"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { GROUPS, NAV } from "@/lib/nav";
import { useL, useWorkspace } from "@/lib/workspace/store";
import { ErrorToast, Pill } from "./ui";

const STATUS_KIND = { DRAFT: "neutral", MAPPED: "info", RECONCILED: "good", LOCKED: "warn" } as const;

export function Shell({ children }: { children: ReactNode }) {
  const { ws, company, dispatch } = useWorkspace();
  const L = useL();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === "/board-pack") return <>{children}</>;
  const groups = Object.keys(GROUPS) as (keyof typeof GROUPS)[];
  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      <aside className="sidebar" aria-label={L("Modules", "الوحدات")}>
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          {L("AI CFO", "المدير المالي الذكي")}
        </Link>
        {groups.map((g) => (
          <div key={g} className="nav-group">
            <div className="nav-group-title">{L(...GROUPS[g])}</div>
            {NAV.filter((n) => n.group === g).map((n) => (
              <Link key={n.href} href={n.href} className={path === n.href ? "nav-item active" : "nav-item"} onClick={() => setOpen(false)}>
                <span className="nav-n">{n.n}</span> {L(n.en, n.ar)}
              </Link>
            ))}
          </div>
        ))}
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="ghost menu-btn" onClick={() => setOpen(!open)} aria-label={L("Menu", "القائمة")}>
            ☰
          </button>
          <select
            aria-label={L("Company", "الشركة")}
            value={ws.activeCompanyId ?? ""}
            onChange={(e) => dispatch({ type: "selectCompany", id: e.target.value })}
          >
            {!ws.companies.length && <option value="">{L("No company yet", "لا توجد شركة")}</option>}
            {ws.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {(ws.lang === "ar" && c.settings.tradeNameAr) || c.settings.tradeNameEn}
              </option>
            ))}
          </select>
          {company && (
            <>
              <span className="muted small">
                {company.period.currentLabel} · {company.settings.framework}
              </span>
              <Pill kind={STATUS_KIND[company.period.status]}>{company.period.status}</Pill>
            </>
          )}
          <span className="spacer" />
          <span className="muted small">
            {ws.profile.name} · {ws.profile.role}
          </span>
          <button className="ghost" onClick={() => dispatch({ type: "setLang", lang: ws.lang === "en" ? "ar" : "en" })}>
            {ws.lang === "en" ? "العربية" : "English"}
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
      <ErrorToast />
    </div>
  );
}
