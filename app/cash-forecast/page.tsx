"use client";

import Link from "next/link";
import { useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Legend, Lines } from "@/components/charts";
import { Banner, Card, NeedsData, Page, Stat } from "@/components/ui";
import { uid } from "@/lib/workspace/defaults";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";
import type { CashForecastInputs } from "@/lib/workspace/types";

type Item = CashForecastInputs["items"][number];

export default function CashForecastPage() {
  const { company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const [draft, setDraft] = useState<Omit<Item, "id">>({ name: "", amount: 0, every: "once", week: 1 });
  const fc = computed?.analysis ? computed.cashForecast : null;
  const inputs = company?.cashForecast;
  const set = (p: Partial<CashForecastInputs>) => update({ action: "cashForecast.update", entity: "cash_forecast", reason: Object.keys(p).join(", ") }, (c) => ({ ...c, cashForecast: { ...c.cashForecast, ...p } }));
  const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}m` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)));
  const num = (label: [string, string], value: number | null, onSave: (v: number | null) => void, opts: { step?: number; min?: number; max?: number; allowEmpty?: boolean; hint?: [string, string] } = {}) => (
    <label className="field">
      <span>{L(...label)}</span>
      <input
        type="number"
        step={opts.step ?? 1}
        min={opts.min}
        max={opts.max}
        disabled={locked}
        defaultValue={value ?? ""}
        placeholder={opts.allowEmpty ? L("from the trial balance", "من الميزان") : undefined}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const v = raw === "" ? null : Number(raw);
          if (v === null && !opts.allowEmpty) return;
          if (v !== null && !Number.isFinite(v)) return;
          if (v !== value) onSave(v);
        }}
      />
      {opts.hint && <span className="muted small">{L(...opts.hint)}</span>}
    </label>
  );

  return (
    <Page
      title={L("13-week cash forecast", "توقع النقدية لـ ١٣ أسبوعًا")}
      subtitle={L(
        "A direct, week-by-week cash plan from what is actually open at the period end: customer invoices by due date, supplier invoices by due date, payroll and its deductions, plus items you add. Nothing is guessed.",
        "خطة نقدية مباشرة أسبوعًا بأسبوع مما هو مفتوح فعليًا في نهاية الفترة: فواتير العملاء والموردين حسب تاريخ الاستحقاق، والرواتب واستقطاعاتها، والبنود التي تضيفها. لا شيء مُخمّن.",
      )}
    >
      <NeedsData>
        {company && inputs && fc && (
          <>
            {!company.subledgers.ar.length && !company.subledgers.ap.length && (
              <Banner kind="info">
                {L("Load the AR aging and AP listing so receipts and payments fall into the right weeks.", "حمّل أعمار العملاء وقائمة الموردين لتقع المقبوضات والمدفوعات في الأسابيع الصحيحة.")} <Link href="/agent">{L("Upload files", "رفع الملفات")}</Link>
              </Banner>
            )}
            {fc.weeksBelowMinimum.length > 0 && (
              <Banner kind="error">
                {L("Cash falls below the minimum in week", "تنخفض النقدية عن الحد الأدنى في الأسبوع")} {fc.weeksBelowMinimum.join(", ")}. {L("Lowest", "الأدنى")}: {f.money(fc.lowest.closing)} ({L("week", "أسبوع")} {fc.lowest.week}, {fc.lowest.start}).
              </Banner>
            )}
            <div className="stats">
              <Stat label={L("Opening cash", "النقدية الافتتاحية")} value={f.money(fc.weeks[0]?.opening)} hint={inputs.openingCash === null ? L("cash in the trial balance", "النقدية في الميزان") : L("entered", "مُدخلة")} />
              <Stat label={L("Receipts", "المقبوضات")} value={f.money(fc.totals.inflows)} tone="good" />
              <Stat label={L("Payments", "المدفوعات")} value={f.money(fc.totals.outflows)} tone="bad" />
              <Stat label={L(`Cash after week ${fc.weeks.length}`, `النقدية بعد الأسبوع ${fc.weeks.length}`)} value={f.money(fc.totals.closing)} tone={fc.totals.closing >= 0 ? "good" : "bad"} />
              <Stat label={L("Lowest week", "أدنى أسبوع")} value={f.money(fc.lowest.closing)} hint={`${L("week", "أسبوع")} ${fc.lowest.week} · ${fc.lowest.start}`} tone={fc.lowest.closing >= (inputs.minimumCash ?? 0) ? undefined : "bad"} />
            </div>
            <Card title={L("Closing cash by week", "النقدية الختامية أسبوعيًا")}>
              <Lines
                labels={fc.weeks.map((w) => `W${w.week}`)}
                series={[
                  { name: L("Closing cash", "النقدية الختامية"), values: fc.weeks.map((w) => w.closing) },
                  ...(inputs.minimumCash !== null ? [{ name: L("Minimum cash", "الحد الأدنى"), values: fc.weeks.map(() => inputs.minimumCash ?? 0) }] : []),
                ]}
                format={compact}
              />
              <Legend names={[L("Closing cash", "النقدية الختامية"), ...(inputs.minimumCash !== null ? [L("Minimum cash", "الحد الأدنى")] : [])]} />
            </Card>
            <Card title={L("Week by week", "أسبوعًا بأسبوع")}>
              <div className="scroll">
                <table className="compact trend-table">
                  <thead>
                    <tr>
                      <th />
                      {fc.weeks.map((w) => (
                        <th key={w.week} className="num" title={`${w.start} → ${w.end}`}>
                          W{w.week}
                          <div className="muted small">{w.start.slice(5)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["opening", "Opening cash", "النقدية الافتتاحية"],
                        ["collections", "Customer receipts (due)", "مقبوضات العملاء (المستحقة)"],
                        ["overdueCollections", "Overdue collections", "تحصيل المتأخرات"],
                        ["supplierPayments", "Supplier payments", "مدفوعات الموردين"],
                        ["payroll", "Net payroll", "صافي الرواتب"],
                        ["payrollTaxes", "Social insurance and salary tax", "التأمينات وضريبة المرتبات"],
                        ["other", "Other items", "بنود أخرى"],
                        ["net", "Net cash flow", "صافي التدفق"],
                        ["closing", "Closing cash", "النقدية الختامية"],
                      ] as const
                    ).map(([k, en, ar]) => (
                      <tr key={k} className={k === "closing" || k === "net" ? "strong" : undefined}>
                        <td>{L(en, ar)}</td>
                        {fc.weeks.map((w) => (
                          <td key={w.week} className={`num ${k === "closing" && w.belowMinimum ? "bad" : ""}`}>
                            {f.n(w[k])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                {L("Overdue receivables", "متأخرات العملاء")}: {f.n(fc.overdue.receivables)} ({L("expected to collect", "متوقع تحصيل")} {f.n(fc.overdue.expectedCollected)}) · {L("Overdue payables", "متأخرات الموردين")}: {f.n(fc.overdue.payables)} · {L("Due after the horizon", "مستحق بعد الأفق")}: {L("receivables", "عملاء")} {f.n(fc.beyondHorizon.receivables)}, {L("payables", "موردون")} {f.n(fc.beyondHorizon.payables)}
              </p>
            </Card>
            <div className="two-col">
              <Card title={L("Assumptions", "الافتراضات")}>
                <div className="grid">
                  {num(["Weeks", "عدد الأسابيع"], inputs.weeks, (v) => set({ weeks: Math.max(1, Math.min(52, Math.round(v ?? 13))) }), { min: 1, max: 52 })}
                  {num(["Opening cash", "النقدية الافتتاحية"], inputs.openingCash, (v) => set({ openingCash: v }), { allowEmpty: true, hint: ["Leave empty to use cash in the trial balance.", "اتركه فارغًا لاستخدام النقدية في الميزان."] })}
                  {num(["Minimum cash to keep", "الحد الأدنى للنقدية"], inputs.minimumCash, (v) => set({ minimumCash: v }), { allowEmpty: true })}
                  {num(["Collection delay after due date (days)", "تأخير التحصيل بعد الاستحقاق (أيام)"], inputs.collectionLagDays, (v) => set({ collectionLagDays: Math.max(0, Math.round(v ?? 0)) }), { min: 0 })}
                  {num(["Share of overdue receivables collected (%)", "نسبة تحصيل المتأخرات (٪)"], Math.round(inputs.overdueCollectionRate * 100), (v) => set({ overdueCollectionRate: Math.max(0, Math.min(100, v ?? 0)) / 100 }), { min: 0, max: 100 })}
                  {num(["…spread over weeks", "…موزعة على أسابيع"], inputs.overdueWeeks, (v) => set({ overdueWeeks: Math.max(1, Math.round(v ?? 1)) }), { min: 1 })}
                  {num(["Overdue payables paid over weeks", "سداد متأخرات الموردين على أسابيع"], inputs.overduePayableWeeks, (v) => set({ overduePayableWeeks: Math.max(1, Math.round(v ?? 1)) }), { min: 1 })}
                  <label className="field">
                    <span>
                      <input type="checkbox" checked={inputs.includePayroll} disabled={locked} onChange={(e) => set({ includePayroll: e.target.checked })} /> {L("Include payroll from the payroll register", "تضمين الرواتب من كشف الرواتب")}
                    </span>
                    {!company.subledgers.payroll.length && <span className="muted small">{L("No payroll register loaded.", "لم يتم تحميل كشف رواتب.")}</span>}
                  </label>
                </div>
              </Card>
              <Card title={L("Other receipts and payments", "مقبوضات ومدفوعات أخرى")}>
                <p className="muted small">{L("Rent, loan instalments, tax payments, capex, a customer deposit… Positive = receipt, negative = payment.", "إيجار، أقساط قروض، ضرائب، مصروفات رأسمالية، دفعة مقدمة من عميل… موجب = مقبوض، سالب = مدفوع.")}</p>
                {inputs.items.length > 0 && (
                  <table className="compact">
                    <tbody>
                      {inputs.items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.name}</td>
                          <td className={`num ${it.amount < 0 ? "bad" : "good"}`}>{f.n(it.amount)}</td>
                          <td className="small">
                            {it.every === "once" ? L("once", "مرة") : it.every === "week" ? L("weekly", "أسبوعيًا") : L("monthly", "شهريًا")} · {L("from week", "من أسبوع")} {it.week}
                          </td>
                          <td>
                            <button className="link small" disabled={locked} onClick={() => set({ items: inputs.items.filter((x) => x.id !== it.id) })}>
                              {L("Remove", "حذف")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="grid">
                  <label className="field">
                    <span>{L("Description", "الوصف")}</span>
                    <input value={draft.name} disabled={locked} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{L("Amount", "المبلغ")}</span>
                    <input type="number" value={draft.amount || ""} disabled={locked} onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))} />
                  </label>
                  <label className="field">
                    <span>{L("Repeats", "التكرار")}</span>
                    <select value={draft.every} disabled={locked} onChange={(e) => setDraft((d) => ({ ...d, every: e.target.value as Item["every"] }))}>
                      <option value="once">{L("Once", "مرة واحدة")}</option>
                      <option value="week">{L("Every week", "كل أسبوع")}</option>
                      <option value="month">{L("Every month", "كل شهر")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{L("Week", "الأسبوع")}</span>
                    <input type="number" min={1} max={inputs.weeks} value={draft.week} disabled={locked} onChange={(e) => setDraft((d) => ({ ...d, week: Math.max(1, Number(e.target.value) || 1) }))} />
                  </label>
                </div>
                <button
                  disabled={locked || !draft.name.trim() || !draft.amount}
                  onClick={() => {
                    set({ items: [...inputs.items, { ...draft, name: draft.name.trim(), id: uid("cf") }] });
                    setDraft({ name: "", amount: 0, every: "once", week: 1 });
                  }}
                >
                  {L("Add item", "إضافة بند")}
                </button>
              </Card>
            </div>
            <AiPanel module="cash-forecast" />
          </>
        )}
      </NeedsData>
    </Page>
  );
}
