"use client";

import { AiPanel } from "@/components/AiPanel";
import { FootballField } from "@/components/charts";
import { Banner, Card, Field, LockNotice, NeedsData, NumInput, Page } from "@/components/ui";
import type { ValuationInputs } from "@/lib/finance/valuation";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

export default function ValuationPage() {
  const { company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  if (!computed?.analysis || !company) return <Page title={L("14 · Valuation lab", "١٤ · مختبر التقييم")}><NeedsData>{null}</NeedsData></Page>;
  const v = company.valuation;
  const set = <K extends keyof ValuationInputs>(k: K, val: ValuationInputs[K]) => update({ action: "valuation.update", entity: "valuation_inputs" }, (c) => ({ ...c, valuation: { ...c.valuation, [k]: val } }));
  const w = computed.valuation.wacc;
  const d = computed.valuation.dcf;
  const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : f.n(n));
  const pctField = (k: keyof ValuationInputs, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <NumInput percent nullable value={v[k] as number | null} onChange={(x) => set(k, x as never)} />
    </Field>
  );

  return (
    <Page title={L("14 · Valuation lab", "١٤ · مختبر التقييم")} subtitle={L("DCF on unlevered free cash flows from the 3-statement model, trading comparables and a football field. All market inputs are yours.", "تدفقات نقدية حرة مخصومة من النموذج المتكامل، ومضاعفات مقارنة، ومخطط ملعب كرة القدم. كل مدخلات السوق منك.")}>
      <LockNotice />
      <div className="two-col">
        <Card title={L("WACC build-up", "تكوين المتوسط المرجح لتكلفة رأس المال")}>
          <fieldset disabled={locked} className="grid">
            {pctField("riskFreeRate", L("Risk-free rate %", "العائد الخالي من المخاطر ٪"), L("e.g. local-currency government bond yield you choose", "مثل عائد السندات الحكومية بالعملة المحلية"))}
            <Field label={L("Beta", "بيتا")}>
              <NumInput nullable step={0.05} value={v.beta} onChange={(x) => set("beta", x)} />
            </Field>
            {pctField("equityRiskPremium", L("Equity risk premium %", "علاوة مخاطر الأسهم ٪"))}
            <Field label={`${L("Country risk premium %", "علاوة مخاطر الدولة ٪")}: ${v.countryRiskPremium === null ? "—" : (v.countryRiskPremium * 100).toFixed(1)}`}>
              <input type="range" min={0} max={0.15} step={0.0025} disabled={locked} value={v.countryRiskPremium ?? 0} onChange={(e) => set("countryRiskPremium", Number(e.target.value))} />
            </Field>
            {pctField("preTaxCostOfDebt", L("Pre-tax cost of debt %", "تكلفة الدين قبل الضريبة ٪"))}
            {pctField("targetDebtWeight", L("Target debt weight D/(D+E) %", "وزن الدين المستهدف ٪"))}
            {pctField("taxRate", L("Tax rate %", "سعر الضريبة ٪"))}
          </fieldset>
          {w.available ? (
            <table className="compact">
              <tbody>
                <tr><td>{L("Cost of equity (CAPM + CRP)", "تكلفة حقوق الملكية")}</td><td className="num">{f.pct(w.costOfEquity * 100, 2)}</td></tr>
                <tr><td>{L("After-tax cost of debt", "تكلفة الدين بعد الضريبة")}</td><td className="num">{f.pct(w.afterTaxCostOfDebt * 100, 2)}</td></tr>
                <tr className="total"><td>WACC</td><td className="num">{f.pct(w.wacc * 100, 2)}</td></tr>
              </tbody>
            </table>
          ) : (
            <Banner kind="info">{L("Enter all WACC inputs to run the DCF. Missing:", "أدخل كل مدخلات المتوسط المرجح لتشغيل التقييم. الناقص:")} {w.missing.join(", ")}</Banner>
          )}
        </Card>
        <Card title={L("Terminal value", "القيمة النهائية")}>
          <fieldset disabled={locked} className="grid">
            {pctField("terminalGrowth", L("Perpetual growth %", "معدل النمو الدائم ٪"))}
            <Field label={L("Exit EV/EBITDA multiple (×)", "مضاعف الخروج")}>
              <NumInput nullable step={0.5} value={v.exitMultiple} onChange={(x) => set("exitMultiple", x)} />
            </Field>
            <label className="inline">
              <input type="checkbox" checked={v.midYear} onChange={(e) => set("midYear", e.target.checked)} /> {L("Mid-year discounting", "خصم منتصف السنة")}
            </label>
          </fieldset>
          {d?.gordonInvalid && <Banner kind="error">{L("Perpetual growth must be below WACC.", "يجب أن يكون النمو الدائم أقل من المتوسط المرجح.")}</Banner>}
        </Card>
      </div>

      <Card title={L("Unlevered free cash flow (from the base model, annual)", "التدفق النقدي الحر غير الممول (من النموذج الأساسي)")}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th />
                {computed.valuation.flows.map((x) => (
                  <th key={x.period} className="num">Y+{x.period}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["nopat", "NOPAT"],
                  ["depreciation", L("Depreciation add-back", "إضافة الإهلاك")],
                  ["capex", L("Capital expenditure", "الإنفاق الرأسمالي")],
                  ["changeNwc", L("Investment in working capital", "الاستثمار في رأس المال العامل")],
                  ["ufcf", "UFCF"],
                ] as const
              ).map(([k, label]) => (
                <tr key={k} className={k === "ufcf" ? "total" : ""}>
                  <td>{label}</td>
                  {computed.valuation.flows.map((x) => (
                    <td key={x.period} className="num">{f.n(k === "changeNwc" ? -x[k] : x[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {d && (
        <Card title={L("DCF results and enterprise-to-equity bridge", "نتائج التقييم والجسر إلى قيمة حقوق الملكية")}>
          <table>
            <thead>
              <tr>
                <th />
                <th className="num">{L("Gordon growth", "نموذج جوردن")}</th>
                <th className="num">{L("Exit multiple", "مضاعف الخروج")}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>{L("PV of forecast UFCF", "القيمة الحالية للتدفقات")}</td><td className="num">{f.n(d.pvFlows)}</td><td className="num">{f.n(d.pvFlows)}</td></tr>
              <tr><td>{L("PV of terminal value", "القيمة الحالية للقيمة النهائية")}</td><td className="num">{f.n(d.gordon?.pvTerminal)}</td><td className="num">{f.n(d.exit?.pvTerminal)}</td></tr>
              <tr className="total"><td>{L("Enterprise value", "قيمة المنشأة")}</td><td className="num">{f.n(d.gordon?.enterpriseValue)}</td><td className="num">{f.n(d.exit?.enterpriseValue)}</td></tr>
              <tr><td>{L("− Net debt (debt − cash)", "− صافي الدين")}</td><td className="num">{f.n(-computed.valuation.netDebt)}</td><td className="num">{f.n(-computed.valuation.netDebt)}</td></tr>
              <tr className="total"><td>{L("Equity value", "قيمة حقوق الملكية")}</td><td className="num">{f.n(d.gordon?.equityValue)}</td><td className="num">{f.n(d.exit?.equityValue)}</td></tr>
              <tr><td>{L("Terminal value share of EV", "نسبة القيمة النهائية")}</td><td className="num">{f.pct(d.gordon?.tvShare ?? null)}</td><td className="num">{f.pct(d.exit?.tvShare ?? null)}</td></tr>
            </tbody>
          </table>
        </Card>
      )}

      <Card
        title={L("Trading comparables", "المضاعفات المقارنة")}
        actions={
          <button className="ghost" disabled={locked} onClick={() => set("comps", [...v.comps, { name: "", evRevenue: null, evEbitda: null, pe: null }])}>
            {L("Add peer", "إضافة شركة")}
          </button>
        }
      >
        <table className="compact">
          <thead>
            <tr>
              <th>{L("Peer", "الشركة")}</th>
              <th>EV/Revenue</th>
              <th>EV/EBITDA</th>
              <th>P/E</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {v.comps.map((p, i) => (
              <tr key={i}>
                <td><input disabled={locked} value={p.name} onChange={(e) => set("comps", v.comps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                {(["evRevenue", "evEbitda", "pe"] as const).map((k) => (
                  <td key={k}>
                    <NumInput nullable disabled={locked} step={0.1} width={90} value={p[k]} onChange={(x) => set("comps", v.comps.map((y, j) => (j === i ? { ...y, [k]: x } : y)))} />
                  </td>
                ))}
                <td><button className="link danger" disabled={locked} onClick={() => set("comps", v.comps.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!v.comps.length && <p className="muted small">{L("Enter peer multiples from your own market data source; the app does not supply them.", "أدخل مضاعفات الشركات المقارنة من مصدر بياناتك؛ التطبيق لا يوفرها.")}</p>}
        <table>
          <thead>
            <tr>
              <th>{L("Implied equity value", "قيمة حقوق الملكية الضمنية")}</th>
              <th className="num">{L("Low", "أدنى")}</th>
              <th className="num">{L("Median", "الوسيط")}</th>
              <th className="num">{L("High", "أعلى")}</th>
            </tr>
          </thead>
          <tbody>
            {computed.valuation.comps.map((c) => (
              <tr key={c.multiple}>
                <td>{{ evRevenue: "EV/Revenue", evEbitda: "EV/EBITDA", pe: "P/E" }[c.multiple]} ({c.count})</td>
                <td className="num">{f.n(c.low)}</td>
                <td className="num">{f.n(c.median)}</td>
                <td className="num">{f.n(c.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={L("Valuation football field (equity value)", "مخطط نطاقات التقييم")}>
        {computed.valuation.footballField.length ? <FootballField bars={computed.valuation.footballField} format={compact} /> : <p className="muted">{L("Complete the inputs above to draw the ranges.", "أكمل المدخلات أعلاه لرسم النطاقات.")}</p>}
        <p className="small muted">{L("DCF ranges flex WACC ±1pp with growth ±0.5pp, or exit multiple ±1×. Comps bars span low–high peer multiples.", "نطاقات التدفقات: المتوسط المرجح ±١٪ والنمو ±٠٫٥٪ أو المضاعف ±١. المضاعفات من الأدنى للأعلى.")}</p>
      </Card>
      <AiPanel module="valuation" />
    </Page>
  );
}
