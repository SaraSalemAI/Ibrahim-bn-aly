"use client";

import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, Field, LockNotice, NeedsData, NumInput, Page, Stat } from "@/components/ui";
import type { StressInputs } from "@/lib/finance/stress";
import { makeT } from "@/lib/i18n";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const MONETARY = ["CASH", "RECEIVABLES", "PAYABLES", "SHORT_TERM_DEBT", "OTHER_CURRENT_LIABILITY", "LONG_TERM_DEBT", "OTHER_NON_CURRENT_LIABILITY"];

export default function StressPage() {
  const { ws, company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { category } = makeT(ws.lang);
  if (!computed?.analysis || !company) return <Page title={L("15 · Macro, FX & stress testing", "١٥ · اختبارات الضغط والعملة")}><NeedsData>{null}</NeedsData></Page>;
  const s = company.stress;
  const r = computed.stress;
  const set = <K extends keyof StressInputs>(k: K, v: StressInputs[K]) => update({ action: "stress.update", entity: "stress_inputs" }, (c) => ({ ...c, stress: { ...c.stress, [k]: v } }));
  const fc = company.settings.functionalCurrency;

  return (
    <Page title={L("15 · Macro, FX devaluation & stress testing", "١٥ · الاقتصاد الكلي وتخفيض العملة واختبارات الضغط")} subtitle={L("Tag foreign-currency balances, shock the exchange rate and the policy rate, and see profit, solvency and runway under stress.", "حدد الأرصدة بالعملة الأجنبية، واختبر صدمة سعر الصرف وسعر الفائدة، وشاهد الربح والملاءة والنقدية تحت الضغط.")}>
      <LockNotice />
      <div className="two-col">
        <Card title={L("Shock settings", "إعدادات الصدمة")}>
          <fieldset disabled={locked} className="grid">
            <Field label={L("Foreign currency", "العملة الأجنبية")}>
              <select value={s.foreignCurrency} onChange={(e) => set("foreignCurrency", e.target.value)}>
                {["USD", "EUR", "GBP", "SAR", "AED"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label={`${L("Base rate", "السعر الأساسي")} (${fc}/${s.foreignCurrency})`} hint={L("The rate the trial balance was translated at.", "السعر الذي ترجم به الميزان.")}>
              <NumInput nullable step={0.01} value={s.baseRate} onChange={(v) => set("baseRate", v)} />
            </Field>
            <Field label={`${L("Shocked rate", "السعر بعد الصدمة")}: ${s.shockedRate ?? "—"}`}>
              <NumInput nullable step={0.01} value={s.shockedRate} onChange={(v) => set("shockedRate", v)} />
              {s.baseRate !== null && (
                <input type="range" min={s.baseRate * 0.5} max={s.baseRate * 2} step={s.baseRate / 200} value={s.shockedRate ?? s.baseRate} onChange={(e) => set("shockedRate", Math.round(Number(e.target.value) * 100) / 100)} />
              )}
            </Field>
            <Field label={L("Imported share of COGS %", "نسبة المستورد من تكلفة المبيعات ٪")}>
              <NumInput percent value={s.importedCogsShare} onChange={(v) => set("importedCogsShare", v ?? 0)} />
            </Field>
            <Field label={L("Price pass-through %", "نسبة تحميل الزيادة على الأسعار ٪")}>
              <NumInput percent value={s.passThrough} onChange={(v) => set("passThrough", v ?? 0)} />
            </Field>
            <Field label={L("Floating-rate share of debt %", "نسبة القروض بفائدة متغيرة ٪")}>
              <NumInput percent value={s.floatingDebtShare} onChange={(v) => set("floatingDebtShare", v ?? 0)} />
            </Field>
            <Field label={L("Policy-rate shock (pp)", "صدمة سعر الفائدة (نقاط مئوية)")}>
              <NumInput percent step={0.25} value={s.rateShock} onChange={(v) => set("rateShock", v ?? 0)} />
            </Field>
            <Field label={L("Tax rate %", "سعر الضريبة ٪")}>
              <NumInput percent value={s.taxRate} onChange={(v) => set("taxRate", v ?? 0)} />
            </Field>
          </fieldset>
          {!r.fxReady && <Banner kind="info">{L("Enter the base and shocked exchange rates; the app does not supply market rates.", "أدخل سعر الصرف الأساسي وسعر الصدمة؛ التطبيق لا يوفر أسعار السوق.")}</Banner>}
        </Card>
        <Card title={L("Currency tagging of monetary balances", "تحديد عملة الأرصدة النقدية")}>
          <div className="scroll">
            <table className="compact">
              <tbody>
                {company.rows
                  .map((row, i) => ({ row, i }))
                  .filter(({ row }) => MONETARY.includes(row.category))
                  .map(({ row, i }) => (
                    <tr key={row.code}>
                      <td>{row.code} {row.name}</td>
                      <td className="muted small">{row.category && category(row.category)}</td>
                      <td className="num">{f.n(row.currentDebit - row.currentCredit)}</td>
                      <td>
                        <select
                          disabled={locked}
                          value={row.currency ?? fc}
                          onChange={(e) => update({ action: "stress.tagCurrency", entity: "trial_balance_records", recordId: row.code }, (c) => ({ ...c, rows: c.rows.map((x, j) => (j === i ? { ...x, currency: e.target.value === fc ? undefined : e.target.value } : x)) }))}
                        >
                          {[fc, "USD", "EUR", "GBP", "SAR", "AED"].filter((v, k, a) => a.indexOf(v) === k).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="small">
            {s.foreignCurrency} {L("monetary assets", "أصول نقدية")} {f.n(r.exposure.monetaryAssets)} − {L("liabilities", "التزامات")} {f.n(r.exposure.monetaryLiabilities)} = {L("net position", "صافي المركز")} <strong>{f.n(r.exposure.netPosition)}</strong> ({L("of which debt", "منها قروض")} {f.n(r.exposure.debt)})
          </p>
        </Card>
      </div>
      <Card title={L("Stress results", "نتائج الضغط")}>
        <p className="small">{L("Currency move", "تغير العملة")}: {r.fxReady ? `${r.move > 0 ? "+" : ""}${r.move}%` : "—"}</p>
        <div className="stats">
          <Stat label={L("FX translation gain/(loss)", "أرباح/(خسائر) فروق العملة")} value={f.money(r.impacts.translation)} tone={r.impacts.translation < 0 ? "bad" : "good"} />
          <Stat label={L("FX debt service", "خدمة الدين بالعملة")} value={f.money(r.impacts.fxDebtService)} />
          <Stat label={L("Imported COGS margin hit", "أثر تكلفة الواردات")} value={f.money(r.impacts.importedCogs)} />
          <Stat label={L("Interest-rate shock", "صدمة الفائدة")} value={f.money(r.impacts.interestRateShock)} />
        </div>
        <table>
          <thead>
            <tr>
              <th />
              <th className="num">{L("Base", "الأساس")}</th>
              <th className="num">{L("Stressed", "تحت الضغط")}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>{L("Net profit", "صافي الربح")}</td><td className="num">{f.n(r.base.netProfit)}</td><td className={`num ${r.stressed.netProfit < 0 ? "neg" : ""}`}>{f.n(r.stressed.netProfit)}</td></tr>
            <tr><td>EBITDA</td><td className="num">{f.n(r.base.ebitda)}</td><td className="num">{f.n(r.stressed.ebitda)}</td></tr>
            <tr><td>{L("Debt / EBITDA", "الديون / EBITDA")}</td><td className="num">{f.x(r.base.debtToEbitda)}</td><td className="num">{f.x(r.stressed.debtToEbitda)}</td></tr>
            <tr><td>{L("Interest coverage", "تغطية الفوائد")}</td><td className="num">{f.x(r.base.interestCoverage)}</td><td className="num">{f.x(r.stressed.interestCoverage)}</td></tr>
            <tr><td>{L("Total equity", "حقوق الملكية")}</td><td className="num">{f.n(r.base.equity)}</td><td className="num">{f.n(r.stressed.equity)}</td></tr>
            <tr><td>{L("Cash runway", "مدة كفاية النقدية")}</td><td className="num">—</td><td className="num">{r.stressed.cashRunwayMonths === null ? L("not cash-burning", "لا يوجد استنزاف نقدي") : `${r.stressed.cashRunwayMonths} ${L("months", "شهر")}`}</td></tr>
          </tbody>
        </table>
        <p className="muted small">{L("Single-period, static shock on the latest actuals; runway uses stressed profit + depreciation as monthly cash generation.", "صدمة ثابتة لفترة واحدة على آخر أرقام فعلية؛ مدة النقدية تستخدم الربح تحت الضغط + الإهلاك كتوليد نقدي شهري.")}</p>
      </Card>
      <AiPanel module="stress" />
    </Page>
  );
}
