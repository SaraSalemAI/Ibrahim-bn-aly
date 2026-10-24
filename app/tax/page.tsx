"use client";

import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, Field, LockNotice, NeedsData, NumInput, Page, Pill } from "@/components/ui";
import { TAX_POOLS } from "@/lib/finance/subledgers";
import type { TaxInputs } from "@/lib/finance/tax";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const LINE: Record<string, [string, string]> = {
  profitBeforeTax: ["Accounting profit before tax", "صافي الربح المحاسبي قبل الضريبة"],
  accountingDepreciation: ["Add: accounting depreciation", "يضاف: الإهلاك المحاسبي"],
  provisionsFormed: ["Add: non-deductible provisions formed", "يضاف: المخصصات المكونة غير القابلة للخصم"],
  finesAndPenalties: ["Add: fines, penalties and delay interest", "يضاف: الغرامات والجزاءات وفوائد التأخير"],
  unsupportedExpenses: ["Add: unsupported expenses above the allowance", "يضاف: المصروفات غير المؤيدة بمستندات فوق الحد"],
  thinCapitalisationInterest: ["Add: interest above the debt-to-equity ratio", "يضاف: الفوائد الزائدة عن نسبة الديون إلى حقوق الملكية"],
  otherAddBacks: ["Add: other non-deductible items", "يضاف: بنود أخرى غير قابلة للخصم"],
  taxDepreciation: ["Less: statutory tax depreciation (Art. 25/26)", "يخصم: الإهلاك الضريبي (المادتان ٢٥ و٢٦)"],
  realisedBadDebts: ["Less: realised bad debts", "يخصم: الديون المعدومة الفعلية"],
  exemptIncome: ["Less: exempt income", "يخصم: الإيرادات المعفاة"],
  otherDeductions: ["Less: other deductions", "يخصم: خصومات أخرى"],
  adjustedProfit: ["Adjusted profit", "الربح المعدل"],
  lossesUsed: ["Less: tax losses brought forward used", "يخصم: الخسائر الضريبية المرحلة المستخدمة"],
  taxableProfit: ["Net taxable profit", "صافي الربح الضريبي"],
  corporateTax: ["Corporate income tax", "ضريبة شركات الأموال"],
  withholdingCredits: ["Less: tax withheld by customers (Form 41 credits)", "يخصم: الضريبة المخصومة من المنبع (نموذج ٤١)"],
  advancePayments: ["Less: advance payments", "يخصم: الدفعات المقدمة"],
  taxPayable: ["Tax payable / (refundable)", "الضريبة المستحقة / (المستردة)"],
};

export default function TaxPage() {
  const { company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const set = <K extends keyof TaxInputs>(k: K, v: TaxInputs[K]) => update({ action: "tax.update", entity: "tax_inputs" }, (c) => ({ ...c, tax: { ...c.tax, [k]: v } }));
  const t = computed?.analysis ? computed.tax : null;
  const far = computed?.analysis ? computed.subledgers.far : null;
  const ap = computed?.analysis ? computed.subledgers.ap : null;
  const num = (k: keyof TaxInputs, label: string, opts: { percent?: boolean; nullable?: boolean; hint?: string } = {}) => (
    <Field label={label} hint={opts.hint}>
      <NumInput percent={opts.percent} nullable={opts.nullable} value={company!.tax[k] as number | null} onChange={(v) => set(k, (opts.nullable ? v : (v ?? 0)) as never)} />
    </Field>
  );

  return (
    <Page title={L("11 · Egyptian tax computation schedule", "١١ · جدول احتساب الضريبة المصرية")} subtitle={L("Book-to-tax reconciliation (Law 91/2005 as amended), Form 41 withholding and deferred tax (EAS 24 / IAS 12).", "التسوية بين الربح المحاسبي والضريبي (القانون ٩١ لسنة ٢٠٠٥ وتعديلاته)، ونموذج ٤١، والضريبة المؤجلة.")}>
      <NeedsData>
        {t && company && (
          <>
            <LockNotice />
            <Banner kind="warning">
              {L(
                "Rates, allowances and the thin-capitalisation ratio below are editable parameters taken from the build specification. Confirm them with your tax adviser against the current law and executive regulations before filing.",
                "الأسعار والحدود ونسبة الرسملة الضعيفة أدناه معايير قابلة للتعديل مأخوذة من مواصفات البناء. أكدها مع مستشارك الضريبي وفق القانون واللائحة التنفيذية الحالية قبل تقديم الإقرار.",
              )}
            </Banner>
            <div className="two-col">
              <Card title={L("Inputs", "المدخلات")}>
                <fieldset disabled={locked} className="grid">
                  {num("rate", L("Corporate tax rate %", "سعر الضريبة ٪"), { percent: true })}
                  {num("provisionsFormed", L("Provisions formed in the year", "المخصصات المكونة خلال العام"))}
                  {num("finesAndPenalties", L("Fines and penalties", "الغرامات والجزاءات"))}
                  {num("unsupportedExpenses", L("Unsupported (undocumented) expenses", "مصروفات غير مؤيدة بمستندات"))}
                  {num("unsupportedAllowancePct", L("Allowance % of supported G&A", "الحد المسموح ٪ من المصروفات الإدارية المؤيدة"), { percent: true })}
                  {num("supportedGeneralAdmin", L("Supported G&A (blank = TB admin expenses)", "المصروفات الإدارية المؤيدة (فارغ = من الميزان)"), { nullable: true })}
                  {num("otherAddBacks", L("Other add-backs", "إضافات أخرى"))}
                  {num("taxDepreciation", L("Tax depreciation (blank = from asset register)", "الإهلاك الضريبي (فارغ = من سجل الأصول)"), { nullable: true })}
                  {num("realisedBadDebts", L("Realised bad debts", "ديون معدومة فعلية"))}
                  {num("exemptIncome", L("Exempt income", "إيرادات معفاة"))}
                  {num("otherDeductions", L("Other deductions", "خصومات أخرى"))}
                  {num("thinCapRatio", L("Debt-to-equity limit (x:1)", "حد نسبة الديون إلى حقوق الملكية"))}
                  {num("lossesBroughtForward", L("Tax losses brought forward", "الخسائر الضريبية المرحلة"))}
                  {num("withholdingCredits", L("WHT deducted by customers (credits)", "ضريبة مخصومة من الشركة لدى العملاء"))}
                  {num("advancePayments", L("Advance tax payments", "الدفعات المقدمة"))}
                  {num("provisionsBalance", L("Closing non-deductible provisions (deferred tax)", "رصيد المخصصات غير القابلة للخصم"))}
                </fieldset>
              </Card>
              <Card title={L("Tax computation schedule", "جدول احتساب الضريبة")}>
                <table>
                  <tbody>
                    {t.lines.map((l) => (
                      <tr key={l.key} className={["subtotal", "result", "tax"].includes(l.kind) ? "total" : ""}>
                        <td>
                          {L(...LINE[l.key])}
                          {l.note && <div className="muted small">{l.note}</div>}
                        </td>
                        <td className="num">{l.kind === "deduct" || l.kind === "credit" ? `(${f.n(l.amount)})` : f.n(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small">
                  {L("Effective rate on accounting profit", "السعر الفعلي على الربح المحاسبي")}: {f.pct(t.effectiveRate)} · {L("booked tax expense", "الضريبة المسجلة")}: {f.money(t.bookedTax)}{" "}
                  {Math.abs(t.tax - t.bookedTax) > 1 && <Pill kind="warn">{L("differs from computed", "تختلف عن المحسوبة")} {f.n(t.tax - t.bookedTax)}</Pill>}
                </p>
                <p className="small muted">
                  {L("Thin capitalisation", "الرسملة الضعيفة")}: {L("average debt", "متوسط الديون")} {f.n(t.thinCap.avgDebt)} / {L("equity", "حقوق الملكية")} {f.n(t.thinCap.avgEquity)} = {t.thinCap.ratio ?? "—"} : 1 · {L("disallowed interest", "فوائد غير مقبولة")} {f.n(t.thinCap.disallowedInterest)}
                </p>
                {t.lossCarriedForward > 0 && <p className="small">{L("Tax loss carried forward", "خسارة ضريبية مرحلة")}: {f.money(t.lossCarriedForward)}</p>}
              </Card>
            </div>
            <div className="two-col">
              <Card title={L("Deferred tax (EAS 24 / IAS 12)", "الضريبة المؤجلة")}>
                <table>
                  <thead>
                    <tr>
                      <th />
                      <th className="num">{L("Temporary difference", "الفرق المؤقت")}</th>
                      <th className="num">{L("Deferred tax", "الضريبة المؤجلة")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{L("Fixed assets (carrying amount − tax base)", "الأصول الثابتة (القيمة الدفترية − الأساس الضريبي)")}</td>
                      <td className="num">{t.deferredTax.farAvailable ? f.n(t.deferredTax.fixedAssets.temporaryDifference) : L("load the asset register", "حمّل سجل الأصول")}</td>
                      <td className="num">{f.n(t.deferredTax.fixedAssets.amount)}</td>
                    </tr>
                    <tr>
                      <td>{L("Non-deductible provisions", "المخصصات غير القابلة للخصم")}</td>
                      <td className="num">{f.n(t.deferredTax.provisions.temporaryDifference)}</td>
                      <td className="num">{f.n(t.deferredTax.provisions.amount)}</td>
                    </tr>
                    <tr className="total">
                      <td>
                        {L("Net position", "الصافي")} <Pill kind={t.deferredTax.position === "DTL" ? "warn" : "good"}>{t.deferredTax.position}</Pill>
                      </td>
                      <td />
                      <td className="num">{f.n(t.deferredTax.net)}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
              <Card title={L("Form 41: tax withheld from suppliers", "نموذج ٤١: الضريبة المخصومة من الموردين")}>
                {ap ? (
                  <>
                    <table>
                      <thead>
                        <tr>
                          <th>{L("Quarter", "الربع")}</th>
                          <th className="num">{L("Invoices", "الفواتير")}</th>
                          <th className="num">{L("Base", "الأساس")}</th>
                          <th className="num">{L("WHT", "الضريبة")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ap.form41.map((q) => (
                          <tr key={q.quarter}>
                            <td>{q.quarter}</td>
                            <td className="num">{q.count}</td>
                            <td className="num">{f.n(q.base)}</td>
                            <td className="num">{f.n(q.wht)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="small muted">{L("Amounts the company must remit to the ETA, from the AP subledger (rates per invoice: e.g. 1% goods, 3% services, 5% professional fees).", "مبالغ واجبة السداد لمصلحة الضرائب من دفتر الموردين (النسب حسب الفاتورة: مثل ١٪ توريدات، ٣٪ خدمات، ٥٪ أتعاب مهنية).")}</p>
                    {ap.missingTaxIds > 0 && <Banner kind="warning">{L(`${ap.missingTaxIds} invoice(s) with WHT have no valid 9-digit supplier tax ID.`, `${ap.missingTaxIds} فاتورة عليها خصم بدون رقم تسجيل ضريبي صحيح.`)}</Banner>}
                  </>
                ) : (
                  <p className="muted">{L("Load the AP subledger to build the Form 41 summary.", "حمّل دفتر الموردين لإعداد ملخص نموذج ٤١.")}</p>
                )}
              </Card>
            </div>
            <Card title={L("Statutory tax depreciation pools", "مجموعات الإهلاك الضريبي")}>
              <table className="compact">
                <tbody>
                  {Object.entries(TAX_POOLS).map(([k, p]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{p.label}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>MACHINERY (new, industrial)</td>
                    <td>{L("30% initial allowance in the year of acquisition, then 25% declining balance", "خصم إضافي ٣٠٪ في سنة الشراء ثم ٢٥٪ متناقص")}</td>
                  </tr>
                </tbody>
              </table>
              {far ? (
                <p className="small">
                  {L("From the register", "من السجل")}: {L("tax depreciation", "الإهلاك الضريبي")} {f.n(far.tax.taxDepreciation)} + {L("initial allowance", "الخصم الإضافي")} {f.n(far.tax.initialAllowance)} · {L("tax base", "الأساس الضريبي")} {f.n(far.tax.taxBase)}
                  {far.unknownCategories.length > 0 && ` · ${L("unknown categories", "فئات غير معروفة")}: ${far.unknownCategories.join(", ")}`}
                </p>
              ) : (
                <p className="muted small">{L("Load the fixed asset register to compute tax depreciation by pool.", "حمّل سجل الأصول لحساب الإهلاك الضريبي.")}</p>
              )}
            </Card>
            <AiPanel module="tax" />
          </>
        )}
      </NeedsData>
    </Page>
  );
}
