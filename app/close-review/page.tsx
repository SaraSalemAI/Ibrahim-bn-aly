"use client";

import Link from "next/link";
import { useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, NeedsData, Page, Pill, Stat } from "@/components/ui";
import type { Anomaly } from "@/lib/finance/anomalies";
import { CHECK_LABELS, TIE_LABELS } from "@/lib/labels";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const AREAS: Record<Anomaly["area"], [string, string]> = {
  gl: ["General ledger", "دفتر الأستاذ"],
  tb: ["Trial balance", "ميزان المراجعة"],
  ar: ["Receivables", "العملاء"],
  ap: ["Payables", "الموردون"],
  inventory: ["Inventory", "المخزون"],
  payroll: ["Payroll", "الرواتب"],
  bank: ["Bank", "البنك"],
};

const SEVERITY: Record<Anomaly["severity"], [string, string]> = { high: ["High", "مرتفع"], medium: ["Medium", "متوسط"], low: ["Low", "منخفض"] };

export default function CloseReviewPage() {
  const { company, computed } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const [sev, setSev] = useState<"all" | Anomaly["severity"]>("all");
  const k = computed?.analysis ? computed : null;
  const list = k ? k.anomalies.filter((a) => sev === "all" || a.severity === sev) : [];
  const count = (s: Anomaly["severity"]) => (k ? k.anomalies.filter((a) => a.severity === s).length : 0);

  return (
    <Page
      title={L("Close review", "مراجعة الإقفال")}
      subtitle={L(
        "Every file you loaded, checked together: tie-outs, readiness gates and rule-based anomaly flags with the entries behind them. AI only explains what the rules found.",
        "كل الملفات المحملة تُفحص معًا: المطابقات وشروط الإقفال والمؤشرات غير المعتادة مع القيود وراءها. الذكاء الاصطناعي يشرح النتائج فقط.",
      )}
    >
      <NeedsData>
        {k && company && (
          <>
            <div className="stats">
              <Stat label={L("High", "مرتفع")} value={String(count("high"))} tone={count("high") ? "bad" : "good"} />
              <Stat label={L("Medium", "متوسط")} value={String(count("medium"))} />
              <Stat label={L("Low", "منخفض")} value={String(count("low"))} />
              <Stat label={L("Readiness gates passed", "شروط الإقفال المستوفاة")} value={`${k.checks.filter((c) => c.ok).length}/${k.checks.length}`} tone={k.checks.every((c) => c.ok) ? "good" : undefined} />
            </div>

            <div className="two-col">
              <Card title={L("Readiness", "الجاهزية")} actions={<Link href="/audit">{L("Period status", "حالة الفترة")}</Link>}>
                <ul className="checklist">
                  {k.checks.map((ch) => (
                    <li key={ch.key} className={ch.ok ? "ok" : "todo"}>
                      {ch.ok ? "✓" : "○"} {L(...CHECK_LABELS[ch.key])} <span className="muted small">→ {ch.requiredFor}</span>
                    </li>
                  ))}
                </ul>
                {k.fx.missing.length > 0 && <Banner kind="warning">{L("Exchange rates missing for", "أسعار صرف غير متوفرة لـ")} {k.fx.missing.join(", ")}: {L("foreign invoices are left untranslated.", "الفواتير بالعملة الأجنبية لم تُترجم.")}</Banner>}
              </Card>
              <Card title={L("Tie-outs", "المطابقات")}>
                <table className="compact">
                  <tbody>
                    {Object.entries(k.tieOuts).map(([key, v]) => (
                      <tr key={key}>
                        <td>{L(...TIE_LABELS[key])}</td>
                        <td className="num">{v ? <span className={v.ties ? "good" : "bad"}>{v.ties ? "✓" : f.n(v.difference)}</span> : <span className="muted">{L("not loaded", "غير محمّل")}</span>}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>{L("Bank reconciliation", "التسوية البنكية")}</td>
                      <td className="num">{k.subledgers.bank ? <span className={k.subledgers.bank.difference === 0 ? "good" : "bad"}>{k.subledgers.bank.difference === 0 ? "✓" : f.n(k.subledgers.bank.difference)}</span> : <span className="muted">{L("not loaded", "غير محمّل")}</span>}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </div>

            <Card
              title={L("Anomaly flags", "المؤشرات غير المعتادة")}
              actions={
                <select value={sev} onChange={(e) => setSev(e.target.value as typeof sev)} aria-label={L("Severity", "الأهمية")}>
                  <option value="all">{L("All severities", "كل المستويات")}</option>
                  <option value="high">{L("High", "مرتفع")}</option>
                  <option value="medium">{L("Medium", "متوسط")}</option>
                  <option value="low">{L("Low", "منخفض")}</option>
                </select>
              }
            >
              {!k.anomalies.length && <Banner kind="ok">{L("No rule flagged anything in the loaded data.", "لم تظهر أي مؤشرات في البيانات المحملة.")}</Banner>}
              {!company.subledgers.gl.length && <Banner kind="info">{L("Load the general ledger to run the journal-entry tests (weekend postings, round amounts, period-end entries, duplicates, Benford).", "حمّل دفتر الأستاذ لتشغيل اختبارات القيود (عطلات، مبالغ مقربة، قيود آخر الفترة، تكرار، بنفورد).")}</Banner>}
              {list.map((a) => (
                <div key={a.id} className={`anomaly severity-${a.severity}`}>
                  <div>
                    <Pill kind={a.severity === "high" ? "bad" : a.severity === "medium" ? "warn" : "neutral"}>{L(...SEVERITY[a.severity])}</Pill> <Pill>{L(...AREAS[a.area])}</Pill> <strong>{L(...a.title)}</strong> <span className="muted">({a.count})</span>
                  </div>
                  <div className="small muted">{L(...a.detail)}</div>
                  {a.examples.length > 0 && (
                    <ul className="small mono">
                      {a.examples.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Card>
            <AiPanel module="close" title={L("AI close review", "مراجعة الإقفال بالذكاء الاصطناعي")} />
          </>
        )}
      </NeedsData>
    </Page>
  );
}
