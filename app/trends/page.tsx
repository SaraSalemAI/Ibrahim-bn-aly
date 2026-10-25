"use client";

import Link from "next/link";
import { AiPanel } from "@/components/AiPanel";
import { Lines, Legend } from "@/components/charts";
import { Banner, Card, Page, Stat } from "@/components/ui";
import { TREND_KEYS, type TrendKey } from "@/lib/finance/trends";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const LABELS: Record<TrendKey, [string, string]> = {
  revenue: ["Revenue", "الإيرادات"],
  grossProfit: ["Gross profit", "مجمل الربح"],
  ebitda: ["EBITDA", "EBITDA"],
  netProfit: ["Net profit", "صافي الربح"],
  cash: ["Cash", "النقدية"],
  receivables: ["Receivables", "العملاء"],
  inventory: ["Inventory", "المخزون"],
  payables: ["Payables", "الموردون"],
  totalEquity: ["Total equity", "حقوق الملكية"],
};

export default function TrendsPage() {
  const { company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const pts = computed?.analysis ? computed.trend : [];
  const sum = computed?.analysis ? computed.trendSummary : null;
  const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}m` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)));

  return (
    <Page
      title={L("Monthly trends", "الاتجاهات الشهرية")}
      subtitle={L("Upload one trial balance per month (on the dashboard, choose “One month”) to see revenue, margins, cash and working capital move month by month.", "ارفع ميزان مراجعة لكل شهر (من لوحة التحكم اختر «شهر واحد») لترى الإيرادات والهوامش والنقدية ورأس المال العامل شهرًا بشهر.")}
    >
      {!company && <Banner kind="info">{L("Create a company first.", "أنشئ شركة أولًا.")}</Banner>}
      {company && pts.length === 0 && (
        <Banner kind="info">
          {company.monthly.length ? L("Load the current period trial balance too, so the trend can be computed.", "حمّل ميزان الفترة الحالية أيضًا لحساب الاتجاه.") : L("No monthly trial balances loaded yet.", "لم يتم تحميل موازين شهرية بعد.")} <Link href="/">{L("Upload files", "رفع الملفات")}</Link>
        </Banner>
      )}
      {company && pts.length > 0 && sum && (
        <>
          <Card
            title={L("Settings", "الإعدادات")}
            actions={
              <label className="small">
                <input type="checkbox" checked={company.monthlyYtd} disabled={locked} onChange={(e) => update({ action: "trends.ytd", entity: "monthly_tb" }, (c) => ({ ...c, monthlyYtd: e.target.checked }))} /> {L("P&L in the files is year-to-date", "قائمة الدخل في الملفات من بداية السنة")}
              </label>
            }
          >
            <p className="small muted">
              {company.monthly.length} {L("months loaded", "شهر محمّل")}: {company.monthly.map((m) => m.label).join(", ")}
            </p>
          </Card>
          <div className="stats">
            {(["revenue", "netProfit", "cash", "receivables"] as TrendKey[]).map((k) => (
              <Stat key={k} label={`${L(...LABELS[k])} · ${pts[pts.length - 1].label}`} value={f.money(sum[k].latest)} hint={sum[k].momPct === null ? undefined : `${sum[k].momPct > 0 ? "+" : ""}${sum[k].momPct}% ${L("vs last month", "عن الشهر السابق")}`} tone={k === "netProfit" ? (sum[k].latest >= 0 ? "good" : "bad") : undefined} />
            ))}
          </div>
          <div className="two-col">
            <Card title={L("Profit and loss by month", "الأرباح والخسائر شهريًا")}>
              <Lines labels={pts.map((p) => p.label)} series={(["revenue", "grossProfit", "netProfit"] as TrendKey[]).map((k) => ({ name: L(...LABELS[k]), values: pts.map((p) => p.values[k]) }))} format={compact} />
              <Legend names={(["revenue", "grossProfit", "netProfit"] as TrendKey[]).map((k) => L(...LABELS[k]))} />
            </Card>
            <Card title={L("Cash and working capital", "النقدية ورأس المال العامل")}>
              <Lines labels={pts.map((p) => p.label)} series={(["cash", "receivables", "inventory", "payables"] as TrendKey[]).map((k) => ({ name: L(...LABELS[k]), values: pts.map((p) => p.values[k]) }))} format={compact} />
              <Legend names={(["cash", "receivables", "inventory", "payables"] as TrendKey[]).map((k) => L(...LABELS[k]))} />
            </Card>
          </div>
          <Card title={L("Month by month", "شهرًا بشهر")}>
            <div className="scroll">
              <table className="compact trend-table">
                <thead>
                  <tr>
                    <th />
                    {pts.map((p) => (
                      <th key={p.label} className="num">{p.label}</th>
                    ))}
                    <th className="num">{L("3-month avg", "متوسط ٣ أشهر")}</th>
                  </tr>
                </thead>
                <tbody>
                  {TREND_KEYS.map((k) => (
                    <tr key={k}>
                      <td>{L(...LABELS[k])}</td>
                      {pts.map((p) => (
                        <td key={p.label} className="num">{f.n(p.values[k])}</td>
                      ))}
                      <td className="num">{f.n(sum[k].avg3)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>{L("Gross margin %", "هامش الربح الإجمالي ٪")}</td>
                    {pts.map((p) => (
                      <td key={p.label} className="num">{f.pct(p.grossMargin)}</td>
                    ))}
                    <td />
                  </tr>
                  <tr>
                    <td>{L("Receivable days", "أيام التحصيل")}</td>
                    {pts.map((p) => (
                      <td key={p.label} className="num">{p.dso === null ? "—" : Math.round(p.dso)}</td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="actions">
              {company.monthly.map((m) => (
                <button
                  key={m.id}
                  className="ghost small"
                  disabled={locked}
                  onClick={() => update({ action: "monthly.remove", entity: "monthly_tb", recordId: m.label }, (c) => ({ ...c, monthly: c.monthly.filter((x) => x.id !== m.id), docs: c.docs.filter((d) => d.id !== m.docId) }))}
                >
                  {L("Remove", "حذف")} {m.label}
                </button>
              ))}
            </div>
          </Card>
          <AiPanel module="trends" />
        </>
      )}
    </Page>
  );
}
