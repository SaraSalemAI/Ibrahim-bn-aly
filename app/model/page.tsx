"use client";

import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, Field, LockNotice, NeedsData, NumInput, Page, Pill } from "@/components/ui";
import { defaultModelInputs, type ModelInputs, type ModelPeriod } from "@/lib/finance/model";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

export default function ModelPage() {
  const { company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  if (!computed?.analysis || !company) return <Page title={L("8 · 3-statement model", "٨ · النموذج المالي المتكامل")}><NeedsData>{null}</NeedsData></Page>;
  const m = computed.modelInputs;
  const set = <K extends keyof ModelInputs>(k: K, v: ModelInputs[K]) => update({ action: "model.update", entity: "model_inputs" }, (c) => ({ ...c, model: { ...m, [k]: v } }));
  const periods = computed.model;
  const label = (p: ModelPeriod) => (m.granularity === "monthly" ? `M${p.period}` : `Y+${p.period}`);
  const row = (title: string, get: (p: ModelPeriod) => number, cls = "") => (
    <tr className={cls}>
      <td>{title}</td>
      {periods.map((p) => (
        <td key={p.period} className={`num ${get(p) < 0 ? "neg" : ""}`}>
          {f.n(get(p))}
        </td>
      ))}
    </tr>
  );
  const head = (
    <thead>
      <tr>
        <th />
        {periods.map((p) => (
          <th key={p.period} className="num">
            {label(p)}
          </th>
        ))}
      </tr>
    </thead>
  );
  const unbalanced = periods.filter((p) => Math.abs(p.balanceCheck) > 0.05);
  const notConverged = periods.filter((p) => !p.converged);
  const a = computed.analysis.current;

  return (
    <Page title={L("8 · 3-statement model", "٨ · النموذج المالي المتكامل")} subtitle={L("Linked P&L, balance sheet and cash flow from the latest actuals, with a bounded circularity solver for interest.", "قائمة دخل ومركز مالي وتدفقات مترابطة من آخر أرقام فعلية، مع حل محدود لدائرية الفوائد.")}>
      <LockNotice />
      <Card
        title={L("Drivers", "المحركات")}
        actions={
          <button className="ghost" disabled={locked} onClick={() => update({ action: "model.reset", entity: "model_inputs" }, (c) => ({ ...c, model: defaultModelInputs(a, computed.analysis!.prior) }))}>
            {L("Reset to defaults from actuals", "إعادة القيم المبدئية من الفعلي")}
          </button>
        }
      >
        <fieldset disabled={locked} className="grid">
          <Field label={L("Horizon", "الأفق")}>
            <select value={m.granularity} onChange={(e) => update({ action: "model.update", entity: "model_inputs" }, (c) => ({ ...c, model: { ...m, granularity: e.target.value as "annual" | "monthly", periods: e.target.value === "monthly" ? 12 : 3 } }))}>
              <option value="annual">{L("3 years (annual)", "٣ سنوات (سنوي)")}</option>
              <option value="monthly">{L("12 months (monthly)", "١٢ شهرًا (شهري)")}</option>
            </select>
          </Field>
          <Field label={L("Revenue growth % (annual)", "نمو الإيرادات ٪ (سنوي)")}>
            <NumInput percent value={m.revenueGrowth} onChange={(v) => set("revenueGrowth", v ?? 0)} />
          </Field>
          <Field label={L("Gross margin %", "هامش مجمل الربح ٪")}>
            <NumInput percent value={m.grossMargin} onChange={(v) => set("grossMargin", v ?? 0)} />
          </Field>
          <Field label={L("Opex % of revenue", "المصروفات ٪ من الإيرادات")}>
            <NumInput percent value={m.opexPctRevenue} onChange={(v) => set("opexPctRevenue", v ?? 0)} />
          </Field>
          <Field label={L("Capex % of revenue", "الإنفاق الرأسمالي ٪ من الإيرادات")}>
            <NumInput percent value={m.capexPctRevenue} onChange={(v) => set("capexPctRevenue", v ?? 0)} />
          </Field>
          <Field label={L("Depreciation % of gross PP&E", "الإهلاك ٪ من تكلفة الأصول")}>
            <NumInput percent value={m.depreciationRate} onChange={(v) => set("depreciationRate", v ?? 0)} />
          </Field>
          <Field label="DSO">
            <NumInput value={m.dso} onChange={(v) => set("dso", v ?? 0)} />
          </Field>
          <Field label="DIO">
            <NumInput value={m.dio} onChange={(v) => set("dio", v ?? 0)} />
          </Field>
          <Field label="DPO">
            <NumInput value={m.dpo} onChange={(v) => set("dpo", v ?? 0)} />
          </Field>
          <Field label={L("Tax rate %", "سعر الضريبة ٪")}>
            <NumInput percent value={m.taxRate} onChange={(v) => set("taxRate", v ?? 0)} />
          </Field>
          <Field label={L("Interest rate on debt %", "سعر الفائدة على القروض ٪")} hint={L("Default: finance costs / average debt.", "مبدئيًا: المصروفات التمويلية / متوسط القروض.")}>
            <NumInput percent value={m.debtInterestRate} onChange={(v) => set("debtInterestRate", v ?? 0)} />
          </Field>
          <Field label={L("Interest on cash %", "العائد على النقدية ٪")}>
            <NumInput percent value={m.cashInterestRate} onChange={(v) => set("cashInterestRate", v ?? 0)} />
          </Field>
          <Field label={L("Term-loan repayment / year", "سداد القرض سنويًا")}>
            <NumInput value={m.termLoanRepayment} onChange={(v) => set("termLoanRepayment", v ?? 0)} />
          </Field>
          <Field label={L("Minimum cash (revolver draws below)", "الحد الأدنى للنقدية")}>
            <NumInput value={m.minimumCash} onChange={(v) => set("minimumCash", v ?? 0)} />
          </Field>
          <Field label={L("Dividend payout %", "نسبة التوزيعات ٪")}>
            <NumInput percent value={m.dividendPayout} onChange={(v) => set("dividendPayout", v ?? 0)} />
          </Field>
          <Field label={L("Circularity", "الدائرية")}>
            <select value={m.circularity} onChange={(e) => set("circularity", e.target.value as ModelInputs["circularity"])}>
              <option value="iterative">{L("Average debt — Gauss-Seidel (≤10 iterations)", "متوسط القروض — حل تكراري (≤١٠)")}</option>
              <option value="beginning">{L("Beginning debt balance (no circularity)", "رصيد أول المدة (بدون دائرية)")}</option>
            </select>
          </Field>
          <label className="inline">
            <input type="checkbox" checked={m.cashSweep} onChange={(e) => set("cashSweep", e.target.checked)} /> {L("Cash sweep (repay revolver, then term loan)", "استخدام الفائض لسداد القروض")}
          </label>
        </fieldset>
      </Card>

      {unbalanced.length > 0 ? (
        <Banner kind="error">{L("Balance sheet does not balance in some periods.", "المركز المالي غير متوازن في بعض الفترات.")}</Banner>
      ) : (
        <Banner kind="ok">✓ {L("Balance sheet balances in every projected period.", "المركز المالي متوازن في كل الفترات المتوقعة.")}</Banner>
      )}
      <p className="small">
        {L("Solver", "الحل")}: {periods.map((p) => `${label(p)} ${p.iterations}×`).join(" · ")} {notConverged.length ? <Pill kind="bad">{L("not converged", "لم يتقارب")}</Pill> : <Pill kind="good">{L("converged", "متقارب")}</Pill>}
      </p>

      <Card title={L("Income statement", "قائمة الدخل")}>
        <div className="scroll">
          <table>
            {head}
            <tbody>
              {row(L("Revenue", "الإيرادات"), (p) => p.revenue)}
              {row(L("Gross profit", "مجمل الربح"), (p) => p.grossProfit)}
              {row(L("Opex", "المصروفات"), (p) => -p.opex)}
              {row("EBITDA", (p) => p.ebitda, "total")}
              {row(L("Depreciation", "الإهلاك"), (p) => -p.depreciation)}
              {row(L("Interest expense", "الفوائد المدينة"), (p) => -p.interestExpense)}
              {row(L("Interest income", "الفوائد الدائنة"), (p) => p.interestIncome)}
              {row(L("Profit before tax", "الربح قبل الضريبة"), (p) => p.ebt, "total")}
              {row(L("Tax", "الضريبة"), (p) => -p.tax)}
              {row(L("Net profit", "صافي الربح"), (p) => p.netProfit, "total")}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={L("Balance sheet", "المركز المالي")}>
        <div className="scroll">
          <table>
            {head}
            <tbody>
              {row(L("Cash", "النقدية"), (p) => p.cash)}
              {row(L("Receivables", "العملاء"), (p) => p.receivables)}
              {row(L("Inventory", "المخزون"), (p) => p.inventory)}
              {row(L("Other current assets", "أصول متداولة أخرى"), (p) => p.otherCurrentAssets)}
              {row(L("Net PP&E", "صافي الأصول الثابتة"), (p) => p.ppeGross + p.accumulatedDepreciation)}
              {row(L("Other non-current assets", "أصول غير متداولة أخرى"), (p) => p.otherNonCurrentAssets)}
              {row(L("Total assets", "إجمالي الأصول"), (p) => p.totalAssets, "total")}
              {row(L("Payables", "الموردون"), (p) => p.payables)}
              {row(L("Other current liabilities", "التزامات متداولة أخرى"), (p) => p.otherCurrentLiabilities)}
              {row(L("Revolver / short-term debt", "التسهيلات قصيرة الأجل"), (p) => p.revolver)}
              {row(L("Term loan", "القرض طويل الأجل"), (p) => p.termLoan)}
              {row(L("Other non-current liabilities", "التزامات غير متداولة أخرى"), (p) => p.otherNonCurrentLiabilities)}
              {row(L("Equity", "حقوق الملكية"), (p) => p.equity)}
              {row(L("Total liabilities & equity", "إجمالي الالتزامات وحقوق الملكية"), (p) => p.totalLiabilitiesAndEquity, "total")}
              {row(L("Check", "الفرق"), (p) => p.balanceCheck)}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="two-col">
        <Card title={L("Cash flow", "التدفقات النقدية")}>
          <div className="scroll">
            <table>
              {head}
              <tbody>
                {row(L("Operating", "التشغيلية"), (p) => p.cfo)}
                {row(L("Capex", "الإنفاق الرأسمالي"), (p) => p.capex)}
                {row(L("Financing", "التمويلية"), (p) => p.cff)}
                {row(L("Net cash flow", "صافي التدفق"), (p) => p.netCashFlow, "total")}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={L("PP&E roll-forward & debt schedule", "حركة الأصول وجدول القروض")}>
          <div className="scroll">
            <table>
              {head}
              <tbody>
                {row(L("Capex additions", "الإضافات"), (p) => -p.capex)}
                {row(L("Depreciation", "الإهلاك"), (p) => -p.depreciation)}
                {row(L("Closing net PP&E", "صافي الأصول آخر المدة"), (p) => p.ppeGross + p.accumulatedDepreciation, "total")}
                {row(L("Revolver draw / (repay)", "سحب/(سداد) التسهيلات"), (p) => p.revolverDraw)}
                {row(L("Term-loan repayment", "سداد القرض"), (p) => p.debtRepayment)}
                {row(L("Closing debt", "القروض آخر المدة"), (p) => p.revolver + p.termLoan, "total")}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <AiPanel module="model" />
    </Page>
  );
}
