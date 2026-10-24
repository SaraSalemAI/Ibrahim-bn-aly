"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useL, useWorkspace } from "@/lib/workspace/store";

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Banner({ kind, children }: { kind: "error" | "warning" | "info" | "ok"; children: ReactNode }) {
  return <div className={`banner ${kind}`}>{children}</div>;
}

export function Pill({ kind = "neutral", children }: { kind?: "neutral" | "good" | "bad" | "warn" | "info"; children: ReactNode }) {
  return <span className={`pill pill-${kind}`}>{children}</span>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ""}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<[T, string]>; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? "tab active" : "tab"} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Numeric input. `percent` shows fractions as percentages (0.225 ↔ 22.5). Empty input maps to null when `nullable`. */
export function NumInput({
  value,
  onChange,
  percent = false,
  nullable = false,
  step,
  disabled,
  width,
  min,
  max,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  percent?: boolean;
  nullable?: boolean;
  step?: number;
  disabled?: boolean;
  width?: number;
  min?: number;
  max?: number;
}) {
  const shown = value === null ? "" : percent ? Math.round(value * 1e6) / 1e4 : value;
  return (
    <input
      type="number"
      className="num-input"
      style={width ? { width } : undefined}
      value={shown}
      step={step ?? (percent ? 0.5 : 1)}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(nullable ? null : 0);
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(percent ? n / 100 : n);
      }}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function NeedsData({ children }: { children: ReactNode }) {
  const { company, computed, loaded } = useWorkspace();
  const L = useL();
  if (!loaded) return <p className="muted">{L("Loading workspace…", "جارٍ تحميل مساحة العمل…")}</p>;
  if (!company)
    return (
      <Banner kind="info">
        {L("Create or select a company first.", "أنشئ شركة أو اخترها أولًا.")} <Link href="/company">{L("Go to company setup", "إعداد الشركة")}</Link>
      </Banner>
    );
  if (!computed?.analysis)
    return (
      <Banner kind="info">
        {L("Load a trial balance to use this module.", "حمّل ميزان المراجعة لاستخدام هذه الوحدة.")} <Link href="/ingest">{L("Go to ingestion", "مركز الإدخال")}</Link>
      </Banner>
    );
  return <>{children}</>;
}

export function LockNotice() {
  const { locked } = useWorkspace();
  const L = useL();
  if (!locked) return null;
  return (
    <Banner kind="warning">
      {L(
        "This period is LOCKED. Source data, mapping and inputs are read-only; only adjusting journal entries with a logged reason are allowed.",
        "هذه الفترة مقفلة. البيانات والربط والمدخلات للقراءة فقط؛ يُسمح فقط بقيود التسوية مع تسجيل السبب.",
      )}
    </Banner>
  );
}

export function ErrorToast() {
  const { error, dispatch } = useWorkspace();
  const L = useL();
  if (!error) return null;
  const msg = error === "periodLocked" ? L("Change rejected: the period is locked.", "تم رفض التعديل: الفترة مقفلة.") : error;
  return (
    <div className="toast" role="alert">
      {msg}
      <button className="link" onClick={() => dispatch({ type: "clearError" })}>
        ✕
      </button>
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button className="link collapse-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "▾" : "▸"} {title}
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  );
}

export function download(filename: string, data: BlobPart, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
