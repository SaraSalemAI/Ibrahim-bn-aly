"use client";

import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, Field, LockNotice, NeedsData, NumInput, Page, Pill } from "@/components/ui";
import { emptyBudget, type BudgetVersion, type CapexLine, type HeadcountLine, type ProductLine } from "@/lib/finance/budget";
import { uid } from "@/lib/workspace/defaults";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const BVA_LABELS: Record<string, [string, string]> = {
  revenue: ["Revenue", "الإيرادات"],
  cogs: ["Cost of sales", "تكلفة المبيعات"],
  grossProfit: ["Gross profit", "مجمل الربح"],
  opex: ["Operating expenses", "المصروفات التشغيلية"],
  ebitda: ["EBITDA", "EBITDA"],
  depreciation: ["Depreciation", "الإهلاك"],
  financeCosts: ["Finance costs", "المصروفات التمويلية"],
  netProfit: ["Net profit", "صافي الربح"],
};

export default function BudgetPage() {
  const { company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const budget = company?.budgets.find((b) => b.id === company.activeBudgetId) ?? null;
  const setBudget = (recipe: (b: BudgetVersion) => BudgetVersion, action = "budget.update") =>
    update({ action, entity: "budgets", recordId: budget?.id }, (c) => ({ ...c, budgets: c.budgets.map((b) => (b.id === c.activeBudgetId ? recipe(b) : b)) }));
  const editable = !locked && !budget?.approved;
  const res = computed?.analysis ? computed.budget : null;

  const rowsEditor = <T extends object>(items: T[], cols: Array<{ key: keyof T; label: string; percent?: boolean; text?: boolean }>, onChange: (items: T[]) => void, blank: T) => (
    <>
      <div className="scroll">
        <table className="compact">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={String(c.key)}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={String(c.key)}>
                    {c.text ? (
                      <input disabled={!editable} value={String(it[c.key] ?? "")} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value } : x)))} />
                    ) : (
                      <NumInput disabled={!editable} percent={c.percent} nullable value={(it[c.key] as number | null) ?? null} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, [c.key]: v } : x)))} width={110} />
                    )}
                  </td>
                ))}
                <td>
                  <button className="link danger" disabled={!editable} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="ghost" disabled={!editable} onClick={() => onChange([...items, blank])}>
        {L("Add row", "إضافة سطر")}
      </button>
    </>
  );

  return (
    <Page title={L("7 · Driver-based budgeting & BVA", "٧ · الموازنة المبنية على المحركات والمقارنة بالفعلي")} subtitle={L("Products, headcount, opex, working-capital targets and capex drive the budget; actuals come from the trial balance.", "المنتجات والعمالة والمصروفات وأهداف رأس المال العامل والإنفاق الرأسمالي تبني الموازنة؛ والفعلي من ميزان المراجعة.")}>
      <NeedsData>
        <LockNotice />
        <Card
          title={L("Budget versions", "نسخ الموازنة")}
          actions={
            <>
              <button
                disabled={locked}
                onClick={() => {
                  const b = emptyBudget(uid("bud"), `${L("Budget", "موازنة")} ${(company?.budgets.length ?? 0) + 1}`);
                  update({ action: "budget.create", entity: "budgets", recordId: b.id }, (c) => ({ ...c, budgets: [...c.budgets, b], activeBudgetId: b.id }));
                }}
              >
                {L("New version", "نسخة جديدة")}
              </button>
              {budget && (
                <button
                  className="ghost"
                  disabled={locked}
                  onClick={() => {
                    const b = { ...structuredClone(budget), id: uid("bud"), name: `${budget.name} (${L("copy", "نسخة")})`, approved: false };
                    update({ action: "budget.duplicate", entity: "budgets", recordId: b.id }, (c) => ({ ...c, budgets: [...c.budgets, b], activeBudgetId: b.id }));
                  }}
                >
                  {L("Duplicate", "تكرار")}
                </button>
              )}
            </>
          }
        >
          {company?.budgets.length ? (
            <div className="actions">
              <select value={company.activeBudgetId ?? ""} onChange={(e) => update({ action: "budget.select", entity: "budgets" }, (c) => ({ ...c, activeBudgetId: e.target.value }))}>
                {company.budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.approved ? "✓" : ""}
                  </option>
                ))}
              </select>
              {budget && (
                <>
                  <input disabled={!editable} value={budget.name} onChange={(e) => setBudget((b) => ({ ...b, name: e.target.value }))} />
                  {budget.approved ? <Pill kind="good">{L("Approved", "معتمدة")}</Pill> : <Pill>{L("Draft", "مسودة")}</Pill>}
                  <button className="ghost" disabled={locked} onClick={() => setBudget((b) => ({ ...b, approved: !b.approved }), budget.approved ? "budget.unapprove" : "budget.approve")}>
                    {budget.approved ? L("Reopen for editing", "إعادة فتح للتعديل") : L("Approve version", "اعتماد النسخة")}
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="muted">{L("No budget yet. Create a version to start.", "لا توجد موازنة. أنشئ نسخة للبدء.")}</p>
          )}
        </Card>

        {budget && (
          <>
            <Card title={L("Revenue drivers by product line", "محركات الإيرادات حسب المنتج")}>
              {rowsEditor<ProductLine>(
                budget.products,
                [
                  { key: "name", label: L("Product", "المنتج"), text: true },
                  { key: "units", label: L("Units", "الكمية") },
                  { key: "unitPrice", label: L("Unit price", "سعر الوحدة") },
                  { key: "discountPct", label: L("Discount %", "الخصم ٪"), percent: true },
                  { key: "unitCost", label: L("Unit cost", "تكلفة الوحدة") },
                  { key: "actualUnits", label: L("Actual units", "الكمية الفعلية") },
                  { key: "actualUnitPrice", label: L("Actual price", "السعر الفعلي") },
                ],
                (products) => setBudget((b) => ({ ...b, products })),
                { name: "", units: 0, unitPrice: 0, discountPct: 0, unitCost: 0, actualUnits: null, actualUnitPrice: null },
              )}
            </Card>
            <Card title={L("Headcount roster", "خطة العمالة")}>
              {rowsEditor<HeadcountLine>(
                budget.headcount,
                [
                  { key: "department", label: L("Department", "الإدارة"), text: true },
                  { key: "count", label: L("Headcount", "العدد") },
                  { key: "monthlySalary", label: L("Monthly salary", "المرتب الشهري") },
                  { key: "socialInsurancePct", label: L("Company SI %", "التأمينات ٪"), percent: true },
                ],
                (headcount) => setBudget((b) => ({ ...b, headcount })),
                { department: "", count: 0, monthlySalary: 0, socialInsurancePct: 0 },
              )}
              <p className="muted small">{L("Enter the company social-insurance share from the current Social Insurance Law schedule.", "أدخل نسبة حصة الشركة في التأمينات وفق جدول قانون التأمينات الحالي.")}</p>
            </Card>
            <div className="two-col">
              <Card title={L("Operating costs & working capital", "التكاليف التشغيلية ورأس المال العامل")}>
                <fieldset disabled={!editable} className="grid">
                  <Field label={L("Rent (annual)", "الإيجار السنوي")}>
                    <NumInput value={budget.rent} onChange={(v) => setBudget((b) => ({ ...b, rent: v ?? 0 }))} />
                  </Field>
                  <Field label={L("Marketing % of revenue", "التسويق ٪ من الإيرادات")}>
                    <NumInput percent value={budget.marketingPctRevenue} onChange={(v) => setBudget((b) => ({ ...b, marketingPctRevenue: v ?? 0 }))} />
                  </Field>
                  <Field label={L("Other opex", "مصروفات أخرى")}>
                    <NumInput value={budget.otherOpex} onChange={(v) => setBudget((b) => ({ ...b, otherOpex: v ?? 0 }))} />
                  </Field>
                  <Field label={L("Target DSO (days)", "فترة التحصيل المستهدفة")}>
                    <NumInput value={budget.targetDso} onChange={(v) => setBudget((b) => ({ ...b, targetDso: v ?? 0 }))} />
                  </Field>
                  <Field label={L("Target DIO (days)", "فترة التخزين المستهدفة")}>
                    <NumInput value={budget.targetDio} onChange={(v) => setBudget((b) => ({ ...b, targetDio: v ?? 0 }))} />
                  </Field>
                  <Field label={L("Target DPO (days)", "فترة السداد المستهدفة")}>
                    <NumInput value={budget.targetDpo} onChange={(v) => setBudget((b) => ({ ...b, targetDpo: v ?? 0 }))} />
                  </Field>
                  <Field label={L("Tax rate %", "سعر الضريبة ٪")}>
                    <NumInput percent value={budget.taxRate} onChange={(v) => setBudget((b) => ({ ...b, taxRate: v ?? 0 }))} />
                  </Field>
                </fieldset>
              </Card>
              <Card title={L("Capital expenditure", "الإنفاق الرأسمالي")}>
                {rowsEditor<CapexLine>(
                  budget.capex,
                  [
                    { key: "name", label: L("Asset", "الأصل"), text: true },
                    { key: "amount", label: L("Amount", "المبلغ") },
                    { key: "usefulLifeYears", label: L("Life (yrs)", "العمر (سنوات)") },
                    { key: "month", label: L("In-use month", "شهر التشغيل") },
                  ],
                  (capex) => setBudget((b) => ({ ...b, capex })),
                  { name: "", amount: 0, usefulLifeYears: 5, month: 1 },
                )}
              </Card>
            </div>
            {budget.approved && <Banner kind="info">{L("Approved versions are read-only. Reopen or duplicate to change drivers.", "النسخ المعتمدة للقراءة فقط. أعد فتحها أو كررها لتعديل المحركات.")}</Banner>}
            {res && (
              <>
                <Card title={L("Budget vs actual", "الموازنة مقابل الفعلي")}>
                  <table>
                    <thead>
                      <tr>
                        <th />
                        <th className="num">{L("Budget", "الموازنة")}</th>
                        <th className="num">{L("Actual", "الفعلي")}</th>
                        <th className="num">{L("Variance", "الانحراف")}</th>
                        <th className="num">%</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {res.bva.map((l) => (
                        <tr key={l.key} className={["grossProfit", "ebitda", "netProfit"].includes(l.key) ? "total" : ""}>
                          <td>{L(...BVA_LABELS[l.key])}</td>
                          <td className="num">{f.n(l.budget)}</td>
                          <td className="num">{f.n(l.actual)}</td>
                          <td className={`num ${l.favourable ? "good" : "bad"}`}>{f.n(l.variance)}</td>
                          <td className="num">{f.pct(l.variancePct)}</td>
                          <td>{l.favourable ? <Pill kind="good">{L("F", "ملائم")}</Pill> : <Pill kind="bad">{L("U", "غير ملائم")}</Pill>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted small">
                    {L("Budget cash: opening", "النقدية المخططة: أول المدة")} {f.n(res.statements.cash.opening)} → {L("operating", "التشغيلية")} {f.n(res.statements.cash.operating)} · capex {f.n(-res.statements.cash.capex)} → {L("ending", "آخر المدة")} {f.n(res.statements.cash.ending)}
                  </p>
                </Card>
                <Card title={L("Revenue variance: price, mix and quantity", "انحراف الإيرادات: السعر والمزيج والكمية")}>
                  {res.revenueVariance ? (
                    <table>
                      <tbody>
                        <tr>
                          <td>{L("Budget revenue (lines with actuals)", "الإيرادات المخططة")}</td>
                          <td className="num">{f.n(res.revenueVariance.budgetRevenue)}</td>
                        </tr>
                        <tr>
                          <td>{L("Price variance", "انحراف السعر")}</td>
                          <td className="num">{f.n(res.revenueVariance.price)}</td>
                        </tr>
                        <tr>
                          <td>{L("Mix variance", "انحراف المزيج")}</td>
                          <td className="num">{f.n(res.revenueVariance.mix)}</td>
                        </tr>
                        <tr>
                          <td>{L("Quantity variance", "انحراف الكمية")}</td>
                          <td className="num">{f.n(res.revenueVariance.quantity)}</td>
                        </tr>
                        <tr className="total">
                          <td>{L("Actual revenue (lines with actuals)", "الإيرادات الفعلية")}</td>
                          <td className="num">{f.n(res.revenueVariance.actualRevenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted">{L("Enter actual units and prices on the product lines to split the revenue variance.", "أدخل الكميات والأسعار الفعلية للمنتجات لتحليل انحراف الإيرادات.")}</p>
                  )}
                </Card>
              </>
            )}
          </>
        )}
        <AiPanel module="budget" />
      </NeedsData>
    </Page>
  );
}
