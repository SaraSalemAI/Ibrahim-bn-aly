"use client";

import Link from "next/link";
import { AiPanel } from "@/components/AiPanel";
import { BulkUpload } from "@/components/BulkUpload";
import { Banner, Card, NeedsData, Page, Pill, Stat } from "@/components/ui";
import { CHECK_LABELS } from "@/lib/labels";
import { NAV } from "@/lib/nav";
import { canAdvance } from "@/lib/workspace/compute";
import { sampleCompany, isSample } from "@/lib/workspace/sampleCompany";
import { newCompany, useFormat, useL, useWorkspace } from "@/lib/workspace/store";



export default function Overview() {
  const { ws, company, computed, dispatch, loaded } = useWorkspace();
  const L = useL();
  const f = useFormat();
  return (
    <Page
      title={L("AI CFO — financial intelligence", "المدير المالي الذكي")}
      subtitle={L(
        "Trial balance and subledgers in; statements, models, Egyptian tax, valuation and a board pack out. Calculations are deterministic; AI only explains them.",
        "ميزان المراجعة والدفاتر التحليلية كمدخلات؛ وقوائم ونماذج وضريبة مصرية وتقييم وحزمة لمجلس الإدارة كمخرجات. الحسابات حتمية، والذكاء الاصطناعي يشرحها فقط.",
      )}
      actions={
        <>
          <button onClick={() => dispatch({ type: "addCompany", company: sampleCompany() })}>{L("Load complete sample company", "تحميل شركة نموذجية كاملة")}</button>
          <button className="ghost" onClick={() => dispatch({ type: "addCompany", company: newCompany(L("New company", "شركة جديدة")) })}>
            {L("New company", "شركة جديدة")}
          </button>
        </>
      }
    >
      {loaded && !ws.companies.length && (
        <Banner kind="info">
          {L(
            "Start with the sample company to see every module working, or create your own and load its trial balance in the ingestion center.",
            "ابدأ بالشركة النموذجية لترى كل الوحدات تعمل، أو أنشئ شركتك وحمّل ميزان المراجعة من مركز الإدخال.",
          )}
        </Banner>
      )}
      {company ? <BulkUpload /> : loaded && ws.companies.length > 0 && <Banner kind="info">{L("Select a company to upload its files.", "اختر شركة لرفع ملفاتها.")}</Banner>}
      {company && isSample(company) && <Banner kind="info">{L("Sample company: all figures are fictional and for illustration only.", "شركة نموذجية: كل الأرقام افتراضية للتوضيح فقط.")}</Banner>}
      <NeedsData>
        {computed?.analysis && company && (
          <>
            <div className="stats">
              <Stat label={L("Revenue", "الإيرادات")} value={f.money(computed.analysis.current.revenue)} hint={computed.analysis.prior ? `${L("prior", "السابق")}: ${f.n(computed.analysis.prior.revenue)}` : undefined} />
              <Stat label={L("Net profit", "صافي الربح")} value={f.money(computed.analysis.current.netProfit)} tone={computed.analysis.current.netProfit >= 0 ? "good" : "bad"} />
              <Stat label="EBITDA" value={f.money(computed.analysis.current.ebitda)} />
              <Stat label={L("Cash", "النقدية")} value={f.money(computed.analysis.current.cash)} />
              <Stat label={L("Total equity", "حقوق الملكية")} value={f.money(computed.analysis.current.totalEquity)} />
              <Stat label={L("Altman Z''", "مؤشر ألتمان")} value={computed.altman.z === null ? "—" : String(computed.altman.z)} hint={computed.altman.zone ?? undefined} tone={computed.altman.zone === "distress" ? "bad" : computed.altman.zone === "safe" ? "good" : undefined} />
            </div>
            {computed.anomalies.length > 0 && (
              <Card title={L("Close review", "مراجعة الإقفال")} actions={<Link href="/close-review">{L("Open review", "فتح المراجعة")}</Link>}>
                <p className="small">
                  <Pill kind="bad">{computed.anomalies.filter((x) => x.severity === "high").length} {L("high", "مرتفع")}</Pill>{" "}
                  <Pill kind="warn">{computed.anomalies.filter((x) => x.severity === "medium").length} {L("medium", "متوسط")}</Pill>{" "}
                  <Pill>{computed.anomalies.filter((x) => x.severity === "low").length} {L("low", "منخفض")}</Pill>
                </p>
                <ul className="small">
                  {computed.anomalies.slice(0, 4).map((x) => (
                    <li key={x.id}>
                      {L(...x.title)} ({x.count})
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card title={L("Close checklist", "قائمة الإقفال")}>
              <ul className="checklist">
                {computed.checks.map((ch) => (
                  <li key={ch.key} className={ch.ok ? "ok" : "todo"}>
                    {ch.ok ? "✓" : "○"} {L(...CHECK_LABELS[ch.key])} <span className="muted small">→ {ch.requiredFor}</span>
                  </li>
                ))}
              </ul>
              <p className="small muted">
                {L("Period status", "حالة الفترة")}: <Pill>{company.period.status}</Pill>{" "}
                {canAdvance(computed.checks, "RECONCILED") ? L("Ready to reconcile and lock.", "جاهزة للمطابقة والإقفال.") : ""}{" "}
                <Link href="/audit">{L("Manage period", "إدارة الفترة")}</Link>
              </p>
            </Card>
            <AiPanel module="overview" />
          </>
        )}
      </NeedsData>
      <Card title={L("Modules", "الوحدات")}>
        <div className="module-grid">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="module-tile">
              <span className="nav-n">{n.n}</span>
              {L(n.en, n.ar)}
            </Link>
          ))}
        </div>
      </Card>
    </Page>
  );
}
