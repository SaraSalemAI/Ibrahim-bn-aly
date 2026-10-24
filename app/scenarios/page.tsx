"use client";

import { AiPanel } from "@/components/AiPanel";
import { Heatmap } from "@/components/charts";
import { Banner, Card, Field, LockNotice, NeedsData, NumInput, Page, Pill } from "@/components/ui";
import { DEFAULT_SCENARIOS, SENSITIVITY_DRIVERS, SENSITIVITY_METRICS, type ScenarioKey, type ScenarioOverride } from "@/lib/finance/model";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const KEYS: ScenarioKey[] = ["base", "bull", "bear"];

export default function ScenariosPage() {
  const { company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const drvLabel: Record<string, string> = {
    revenueGrowth: L("Revenue growth", "نمو الإيرادات"),
    grossMargin: L("Gross margin", "هامش مجمل الربح"),
    opexPctRevenue: L("Opex % revenue", "المصروفات ٪"),
    debtInterestRate: L("Interest rate", "سعر الفائدة"),
    capexPctRevenue: L("Capex % revenue", "الإنفاق الرأسمالي ٪"),
  };
  const metLabel: Record<string, string> = { ebitda: "EBITDA", netProfit: L("Net profit", "صافي الربح"), cash: L("Ending cash", "النقدية آخر المدة"), cfo: L("Operating cash flow", "التدفق التشغيلي") };
  const scLabel = { base: L("Base", "الأساسي"), bull: L("Bull", "المتفائل"), bear: L("Bear (stress)", "المتحفظ (ضغط)") };
  const setOverride = (k: ScenarioKey, field: keyof ScenarioOverride, v: number) => update({ action: "scenario.update", entity: "scenarios", recordId: k }, (c) => ({ ...c, scenarios: { ...c.scenarios, [k]: { ...c.scenarios[k], [field]: v } } }));

  return (
    <Page title={L("10 · Forecasting, scenarios & sensitivity", "١٠ · التنبؤ والسيناريوهات والحساسية")} subtitle={L("Scenarios adjust the 3-statement model drivers. The heatmap reruns the full model for each cell.", "السيناريوهات تعدل محركات النموذج المتكامل، وخريطة الحساسية تعيد تشغيل النموذج لكل خلية.")}>
      <NeedsData>
        {computed?.analysis && company && (
          <>
            <LockNotice />
            <Card
              title={L("Scenario switcher (changes vs model drivers)", "السيناريوهات (التغير عن محركات النموذج)")}
              actions={
                <button className="ghost" disabled={locked} onClick={() => update({ action: "scenario.reset", entity: "scenarios" }, (c) => ({ ...c, scenarios: structuredClone(DEFAULT_SCENARIOS) }))}>
                  {L("Reset", "إعادة")}
                </button>
              }
            >
              <table>
                <thead>
                  <tr>
                    <th />
                    {KEYS.map((k) => (
                      <th key={k} className="num">{scLabel[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["revenueGrowthDelta", L("Revenue growth Δ (pp)", "تغير نمو الإيرادات")],
                      ["grossMarginDelta", L("Gross margin Δ (pp)", "تغير هامش الربح")],
                      ["opexPctDelta", L("Opex % Δ (pp)", "تغير المصروفات")],
                      ["interestRateDelta", L("Interest rate Δ (pp)", "تغير سعر الفائدة")],
                    ] as const
                  ).map(([field, label]) => (
                    <tr key={field}>
                      <td>{label}</td>
                      {KEYS.map((k) => (
                        <td key={k} className="num">
                          <NumInput percent disabled={locked} value={company.scenarios[k][field]} onChange={(v) => setOverride(k, field, v ?? 0)} width={90} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">{L("Defaults are assumptions, not market forecasts. Edit them to match your view.", "القيم المبدئية افتراضات وليست توقعات سوق. عدّلها حسب رؤيتك.")}</p>
            </Card>

            <Card title={L("Scenario comparison (final period)", "مقارنة السيناريوهات (آخر فترة)")}>
              <table>
                <thead>
                  <tr>
                    <th />
                    {KEYS.map((k) => (
                      <th key={k} className="num">{scLabel[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["revenue", L("Revenue", "الإيرادات")],
                      ["ebitda", "EBITDA"],
                      ["netProfit", L("Net profit", "صافي الربح")],
                      ["cash", L("Ending cash", "النقدية آخر المدة")],
                      ["equity", L("Equity", "حقوق الملكية")],
                    ] as const
                  ).map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      {KEYS.map((k) => {
                        const ps = computed.scenarios[k].periods;
                        return (
                          <td key={k} className="num">
                            {f.n(ps[ps.length - 1][key])}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td>{L("Debt (revolver + term)", "القروض")}</td>
                    {KEYS.map((k) => {
                      const p = computed.scenarios[k].periods.at(-1)!;
                      return (
                        <td key={k} className="num">
                          {f.n(p.revolver + p.termLoan)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </Card>

            <Card title={L("2D sensitivity heatmap", "خريطة الحساسية ثنائية الأبعاد")}>
              <fieldset disabled={locked} className="grid">
                <Field label={L("Target metric (final period)", "المؤشر المستهدف")}>
                  <select value={company.sensitivity.metric} onChange={(e) => update({ action: "sensitivity.update", entity: "scenarios" }, (c) => ({ ...c, sensitivity: { ...c.sensitivity, metric: e.target.value as never } }))}>
                    {SENSITIVITY_METRICS.map((m) => (
                      <option key={m} value={m}>{metLabel[m]}</option>
                    ))}
                  </select>
                </Field>
                <Field label={L("Columns (X)", "الأعمدة")}>
                  <select value={company.sensitivity.x} onChange={(e) => update({ action: "sensitivity.update", entity: "scenarios" }, (c) => ({ ...c, sensitivity: { ...c.sensitivity, x: e.target.value as never } }))}>
                    {SENSITIVITY_DRIVERS.map((d) => (
                      <option key={d} value={d}>{drvLabel[d]}</option>
                    ))}
                  </select>
                </Field>
                <Field label={L("X step (pp)", "خطوة X")}>
                  <NumInput percent value={company.sensitivity.stepX} onChange={(v) => update({ action: "sensitivity.update", entity: "scenarios" }, (c) => ({ ...c, sensitivity: { ...c.sensitivity, stepX: v ?? 0.01 } }))} />
                </Field>
                <Field label={L("Rows (Y)", "الصفوف")}>
                  <select value={company.sensitivity.y} onChange={(e) => update({ action: "sensitivity.update", entity: "scenarios" }, (c) => ({ ...c, sensitivity: { ...c.sensitivity, y: e.target.value as never } }))}>
                    {SENSITIVITY_DRIVERS.map((d) => (
                      <option key={d} value={d}>{drvLabel[d]}</option>
                    ))}
                  </select>
                </Field>
                <Field label={L("Y step (pp)", "خطوة Y")}>
                  <NumInput percent value={company.sensitivity.stepY} onChange={(v) => update({ action: "sensitivity.update", entity: "scenarios" }, (c) => ({ ...c, sensitivity: { ...c.sensitivity, stepY: v ?? 0.01 } }))} />
                </Field>
              </fieldset>
              {company.sensitivity.x === company.sensitivity.y ? (
                <Banner kind="warning">{L("Choose two different drivers.", "اختر محركين مختلفين.")}</Banner>
              ) : (
                <>
                  <p className="small muted">
                    {drvLabel[company.sensitivity.x]} → · {drvLabel[company.sensitivity.y]} ↓ · {metLabel[company.sensitivity.metric]}
                  </p>
                  <Heatmap xs={computed.sensitivity.xs} ys={computed.sensitivity.ys} grid={computed.sensitivity.grid} fx={(v) => `${(v * 100).toFixed(1)}%`} fy={(v) => `${(v * 100).toFixed(1)}%`} fv={(v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}m` : f.n(v))} />
                </>
              )}
            </Card>

            <Card title={L("Bank covenant monitor", "مراقبة تعهدات البنوك")}>
              <fieldset disabled={locked} className="grid">
                <Field label={L("Maximum debt / EBITDA (×)", "الحد الأقصى للديون / EBITDA")}>
                  <NumInput nullable step={0.1} value={company.covenants.maxDebtToEbitda} onChange={(v) => update({ action: "covenants.update", entity: "covenants" }, (c) => ({ ...c, covenants: { ...c.covenants, maxDebtToEbitda: v } }))} />
                </Field>
                <Field label={L("Minimum interest coverage (×)", "الحد الأدنى لتغطية الفوائد")}>
                  <NumInput nullable step={0.1} value={company.covenants.minInterestCoverage} onChange={(v) => update({ action: "covenants.update", entity: "covenants" }, (c) => ({ ...c, covenants: { ...c.covenants, minInterestCoverage: v } }))} />
                </Field>
              </fieldset>
              {company.covenants.maxDebtToEbitda === null && company.covenants.minInterestCoverage === null ? (
                <p className="muted">{L("Enter your facility's covenant thresholds.", "أدخل حدود التعهدات في عقد التمويل.")}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{L("Scenario", "السيناريو")}</th>
                      {computed.scenarios.base.covenants.map((c) => (
                        <th key={c.period} className="num">
                          {computed.modelInputs.granularity === "monthly" ? `M${c.period}` : `Y+${c.period}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {KEYS.map((k) => (
                      <tr key={k}>
                        <td>{scLabel[k]}</td>
                        {computed.scenarios[k].covenants.map((c) => (
                          <td key={c.period} className="num">
                            {f.x(c.debtToEbitda)} / {f.x(c.coverage)} {(c.leverageBreach || c.coverageBreach) && <Pill kind="bad">{L("breach", "إخلال")}</Pill>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="small muted">{L("Cells show debt/EBITDA (annualised) / interest coverage.", "الخلايا: الديون/EBITDA (سنوي) / تغطية الفوائد.")}</p>
            </Card>
            <AiPanel module="scenarios" />
          </>
        )}
      </NeedsData>
    </Page>
  );
}
