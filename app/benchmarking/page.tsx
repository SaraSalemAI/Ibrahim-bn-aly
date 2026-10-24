"use client";

import { useMemo, useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, NeedsData, NumInput, Page, Tabs } from "@/components/ui";
import { BENCHMARK_KPIS, commonSize, medianOf } from "@/lib/finance/benchmark";
import { makeT } from "@/lib/i18n";
import { TOTAL_LINES } from "@/lib/labels";
import { computeCompany } from "@/lib/workspace/compute";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

export default function BenchmarkingPage() {
  const { ws, dispatch } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { line } = makeT(ws.lang);
  const [tab, setTab] = useState<"PL" | "BS">("PL");
  const all = useMemo(
    () => ws.companies.map((c) => ({ c, k: computeCompany(c) })).filter((x): x is { c: typeof x.c; k: typeof x.k & { analysis: NonNullable<typeof x.k.analysis> } } => Boolean(x.k.analysis)),
    [ws.companies],
  );
  const name = (c: (typeof all)[number]["c"]) => (ws.lang === "ar" && c.settings.tradeNameAr) || c.settings.tradeNameEn;
  const ratio = (k: (typeof all)[number]["k"], key: string) => k.analysis.ratios.find((r) => r.key === key)?.current ?? null;
  const unitOf = (key: string) => all[0]?.k.analysis.ratios.find((r) => r.key === key)?.unit ?? "x";
  const fmt = (key: string, v: number | null) => (v === null ? "—" : unitOf(key) === "%" ? f.pct(v) : unitOf(key) === "days" ? v.toFixed(0) : f.x(v));
  const sizes = all.map(({ k }) => commonSize(k.analysis.current));
  const keys = sizes[0]?.filter((s) => s.statement === tab).map((s) => s.key) ?? [];

  return (
    <Page title={L("13 · Multi-company benchmarking", "١٣ · المقارنة المرجعية متعددة الشركات")} subtitle={L("Common-size statements and a peer KPI matrix across the companies in this workspace.", "قوائم بالنسب المئوية ومصفوفة مؤشرات مقارنة بين شركات مساحة العمل.")}>
      <NeedsData>
        {all.length < 2 && <Banner kind="info">{L("Add more companies (each with its own trial balance) to compare them side by side.", "أضف شركات أخرى (لكل منها ميزان مراجعة) لمقارنتها.")}</Banner>}
        <Card title={L("Common-size statements", "القوائم بالنسب المئوية")}>
          <Tabs value={tab} onChange={setTab} tabs={[["PL", L("P&L (% of revenue)", "الدخل (٪ من الإيرادات)")], ["BS", L("Balance sheet (% of total assets)", "المركز المالي (٪ من الأصول)")]]} />
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th />
                  {all.map(({ c }) => (
                    <th key={c.id} className="num">{name(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys
                  .filter((k) => k !== "unmappedHolding")
                  .map((key) => (
                    <tr key={key} className={TOTAL_LINES.has(key) ? "total" : ""}>
                      <td>{line(key)}</td>
                      {sizes.map((s, i) => (
                        <td key={i} className="num">
                          {f.pct(s.find((x) => x.key === key)?.pct ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={L("Peer comparison matrix", "مصفوفة مقارنة المؤشرات")}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>{L("KPI", "المؤشر")}</th>
                  {all.map(({ c }) => (
                    <th key={c.id} className="num">{name(c)}</th>
                  ))}
                  <th className="num">{L("Workspace median", "الوسيط")}</th>
                  <th className="num">{L("Industry benchmark (you enter)", "المعيار القطاعي (تدخله أنت)")}</th>
                </tr>
              </thead>
              <tbody>
                {BENCHMARK_KPIS.map((key) => (
                  <tr key={key}>
                    <td>{line(key)}</td>
                    {all.map(({ c, k }) => (
                      <td key={c.id} className="num">{fmt(key, ratio(k, key))}</td>
                    ))}
                    <td className="num strong">{fmt(key, medianOf(all.map(({ k }) => ratio(k, key))))}</td>
                    <td className="num">
                      <NumInput nullable step={0.1} width={100} value={ws.benchmarks[key] ?? null} onChange={(v) => dispatch({ type: "setBenchmarks", benchmarks: { ...ws.benchmarks, [key]: v } })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            {L(
              "Industry benchmarks are never filled in by the app: enter values from a source you trust (same units as the row). Each company's data stays in this browser; in a multi-user deployment, tenant isolation is enforced by the row-level security policies in supabase/migrations.",
              "لا يملأ التطبيق المعايير القطاعية: أدخلها من مصدر موثوق (بنفس وحدة الصف). بيانات كل شركة تبقى في هذا المتصفح؛ وفي النشر متعدد المستخدمين يتم العزل بسياسات الأمان على مستوى الصفوف في supabase/migrations.",
            )}
          </p>
        </Card>
        <AiPanel module="benchmarking" />
      </NeedsData>
    </Page>
  );
}
