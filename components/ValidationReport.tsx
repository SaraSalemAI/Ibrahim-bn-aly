"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { compareRuns, summarise, toRun, validateCompany, type Area, type Check } from "@/lib/ingest/validate";
import { uid } from "@/lib/workspace/defaults";
import { useL, useWorkspace } from "@/lib/workspace/store";
import { Banner, Card, Pill } from "./ui";

const AREA_LABELS: Record<Area, [string, string]> = {
  tb: ["Trial balance", "ميزان المراجعة"],
  opening: ["Opening balances", "الأرصدة الافتتاحية"],
  gl: ["General ledger", "دفتر الأستاذ"],
  ar: ["Receivables", "العملاء"],
  ap: ["Payables", "الموردون"],
  far: ["Fixed assets", "الأصول الثابتة"],
  inventory: ["Inventory", "المخزون"],
  payroll: ["Payroll", "الرواتب"],
  bank: ["Bank", "البنك"],
  eta: ["ETA e-invoices", "الفواتير الإلكترونية"],
  tieout: ["Tie-outs", "المطابقات"],
  fx: ["Exchange rates", "أسعار الصرف"],
  period: ["Period", "الفترة"],
};

/**
 * Every validation rule on the loaded data, grouped by area, with a tolerance setting and a saved
 * history so each run shows what broke and what was fixed since the last one.
 */
export function ValidationReport({ compact = false }: { compact?: boolean }) {
  const { company, computed, update, locked } = useWorkspace();
  const L = useL();
  const [showPassed, setShowPassed] = useState(false);
  const checks = useMemo(() => (company && computed ? validateCompany(company, computed) : []), [company, computed]);
  if (!company || !computed) return null;
  if (!company.rows.length && !company.docs.length) return null;

  const s = summarise(checks);
  const prev = company.validationRuns.at(-1);
  const diff = prev ? compareRuns(prev, toRun(checks, "live", company.tolerance, "live", "")) : null;
  const byArea = new Map<Area, Check[]>();
  for (const c of checks) byArea.set(c.area, [...(byArea.get(c.area) ?? []), c]);
  const titleOf = (id: string) => checks.find((c) => c.id === id)?.title ?? [id, id];

  const save = () =>
    update({ action: "validation.run", entity: "validation_runs" }, (c) => ({ ...c, validationRuns: [...c.validationRuns, toRun(checks, "manual", c.tolerance, uid("val"))].slice(-30) }), { allowWhenLocked: true });

  return (
    <Card
      title={L("Validation", "التحقق")}
      actions={
        <>
          <label className="small">
            {L("Tolerance", "حد التسامح")}{" "}
            <input
              type="number"
              min={0.01}
              step={0.01}
              style={{ width: 90 }}
              defaultValue={company.tolerance}
              disabled={locked}
              onBlur={(e) => {
                const v = Math.max(0.01, Number(e.target.value) || 0.01);
                if (v !== company.tolerance) update({ action: "tolerance.update", entity: "settings", reason: `Rounding tolerance ${v}` }, (c) => ({ ...c, tolerance: v }));
              }}
            />
          </label>
          <button onClick={save}>{L("Save validation run", "حفظ نتيجة التحقق")}</button>
        </>
      }
    >
      <p className="small">
        <Pill kind={s.errors ? "bad" : "good"}>{s.errors} {L("errors", "أخطاء")}</Pill> <Pill kind={s.warnings ? "warn" : "good"}>{s.warnings} {L("warnings", "تحذيرات")}</Pill> <Pill>{s.passed}/{s.total} {L("rules passed", "قاعدة ناجحة")}</Pill>
        {prev && <span className="muted"> · {L("last saved run", "آخر تشغيل محفوظ")} {prev.at.slice(0, 16).replace("T", " ")}</span>}
      </p>
      {diff && (diff.newFailures.length > 0 || diff.resolved.length > 0) && (
        <Banner kind={diff.newFailures.length ? "warning" : "ok"}>
          {diff.newFailures.length > 0 && (
            <div>
              {L("New since last run", "جديد منذ آخر تشغيل")}: {diff.newFailures.map((id) => L(...titleOf(id))).join(" · ")}
            </div>
          )}
          {diff.resolved.length > 0 && (
            <div>
              {L("Fixed since last run", "تم إصلاحه منذ آخر تشغيل")}: {diff.resolved.map((id) => L(...titleOf(id))).join(" · ")}
            </div>
          )}
        </Banner>
      )}
      {!s.errors && !s.warnings && <Banner kind="ok">{L("Every rule passes on the loaded data.", "كل القواعد ناجحة على البيانات المحملة.")}</Banner>}
      {[...byArea.entries()].map(([area, list]) => {
        const shown = list.filter((c) => showPassed || !c.ok);
        if (!shown.length) return null;
        return (
          <div key={area} className="validation-area">
            <h4>
              {L(...AREA_LABELS[area])} <span className="muted small">{list.filter((c) => c.ok).length}/{list.length}</span>
            </h4>
            <ul className="issues">
              {shown.map((c) => (
                <li key={c.id} className={c.ok ? "" : c.level === "info" ? "" : c.level}>
                  {c.ok ? "✓" : c.level === "error" ? "✕" : "!"} {L(...c.title)}
                  {!c.ok && c.detail && <span className="muted small"> — {L(...c.detail)}</span>}
                  {!c.ok && c.fix && !compact && (
                    <>
                      {" "}
                      <Link className="small" href={c.fix}>
                        {L("Fix", "إصلاح")}
                      </Link>
                    </>
                  )}
                  {!c.ok && c.items.length > 0 && <div className="muted small mono">{c.items.slice(0, compact ? 4 : 10).join(" · ")}{c.count > c.items.slice(0, compact ? 4 : 10).length ? ` (+${c.count - c.items.slice(0, compact ? 4 : 10).length})` : ""}</div>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <button className="link small" onClick={() => setShowPassed((v) => !v)}>
        {showPassed ? L("Hide passed rules", "إخفاء القواعد الناجحة") : L("Show passed rules too", "إظهار القواعد الناجحة")}
      </button>
      {!compact && company.validationRuns.length > 0 && (
        <details>
          <summary className="small">{L("Validation history", "سجل التحقق")} ({company.validationRuns.length})</summary>
          <table className="compact">
            <thead>
              <tr>
                <th>{L("When", "الوقت")}</th>
                <th>{L("Trigger", "السبب")}</th>
                <th className="num">{L("Errors", "أخطاء")}</th>
                <th className="num">{L("Warnings", "تحذيرات")}</th>
                <th className="num">{L("Tolerance", "التسامح")}</th>
              </tr>
            </thead>
            <tbody>
              {[...company.validationRuns].reverse().map((r) => {
                const vals = Object.values(r.results);
                return (
                  <tr key={r.id}>
                    <td className="small">{r.at.slice(0, 16).replace("T", " ")}</td>
                    <td className="small">{r.trigger}</td>
                    <td className="num">{vals.filter((v) => !v.ok && v.level === "error").length}</td>
                    <td className="num">{vals.filter((v) => !v.ok && v.level === "warning").length}</td>
                    <td className="num">{r.tolerance}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </Card>
  );
}
