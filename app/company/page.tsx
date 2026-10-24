"use client";

import { useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, Field, LockNotice, Page } from "@/components/ui";
import { sampleCompany } from "@/lib/workspace/sampleCompany";
import { newCompany, useL, useWorkspace } from "@/lib/workspace/store";
import type { CompanySettings, Role } from "@/lib/workspace/types";

const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP"];

export default function CompanyPage() {
  const { ws, company, dispatch, update, locked } = useWorkspace();
  const L = useL();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) =>
    update({ action: "company.settings", entity: "companies", recordId: company?.id }, (c) => ({ ...c, settings: { ...c.settings, [k]: v } }));
  const setPeriod = (k: "start" | "end" | "currentLabel" | "priorLabel", v: string) =>
    update({ action: "period.update", entity: "financial_periods" }, (c) => ({ ...c, period: { ...c.period, [k]: v } }));
  const s = company?.settings;
  const taxOk = !s?.taxCardNumber || /^\d{9}$/.test(s.taxCardNumber.replace(/[\s-]/g, ""));

  return (
    <Page title={L("1 · Workspace & company registration", "١ · مساحة العمل وتسجيل الشركة")} subtitle={L("Companies, reporting settings, period and your role.", "الشركات وإعدادات التقارير والفترة ودورك.")}>
      <Card title={L("Your profile", "ملفك")}>
        <div className="grid">
          <Field label={L("Name", "الاسم")}>
            <input value={ws.profile.name} onChange={(e) => dispatch({ type: "setProfile", name: e.target.value, role: ws.profile.role })} />
          </Field>
          <Field label={L("Role", "الدور")} hint={L("Only a CFO can lock or reopen a period.", "المدير المالي فقط يمكنه إقفال الفترة أو إعادة فتحها.")}>
            <select value={ws.profile.role} onChange={(e) => dispatch({ type: "setProfile", name: ws.profile.name, role: e.target.value as Role })}>
              <option value="ANALYST">{L("Analyst", "محلل")}</option>
              <option value="REVIEWER">{L("Reviewer", "مراجع")}</option>
              <option value="CFO">{L("CFO", "المدير المالي")}</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title={L("Companies in this workspace", "الشركات في مساحة العمل")}
        actions={
          <>
            <button onClick={() => dispatch({ type: "addCompany", company: newCompany(L("New company", "شركة جديدة")) })}>{L("Add company", "إضافة شركة")}</button>
            <button className="ghost" onClick={() => dispatch({ type: "addCompany", company: sampleCompany() })}>
              {L("Add sample company", "إضافة شركة نموذجية")}
            </button>
          </>
        }
      >
        <table>
          <thead>
            <tr>
              <th>{L("Company", "الشركة")}</th>
              <th>{L("Framework", "الإطار")}</th>
              <th>{L("Period", "الفترة")}</th>
              <th>{L("Accounts", "الحسابات")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ws.companies.map((c) => (
              <tr key={c.id} className={c.id === ws.activeCompanyId ? "selected" : ""}>
                <td>
                  {c.settings.tradeNameEn} {c.settings.tradeNameAr && <span className="muted">· {c.settings.tradeNameAr}</span>}
                </td>
                <td>{c.settings.framework}</td>
                <td>
                  {c.period.currentLabel} · {c.period.status}
                </td>
                <td className="num">{c.rows.length}</td>
                <td>
                  <button className="link" onClick={() => dispatch({ type: "selectCompany", id: c.id })}>
                    {L("Open", "فتح")}
                  </button>
                  {confirmDelete === c.id ? (
                    <>
                      <button className="link danger" onClick={() => { dispatch({ type: "deleteCompany", id: c.id }); setConfirmDelete(null); }}>
                        {L("Delete company and all its data", "حذف الشركة وكل بياناتها")}
                      </button>
                      <button className="link" onClick={() => setConfirmDelete(null)}>
                        {L("Keep", "إبقاء")}
                      </button>
                    </>
                  ) : (
                    <button className="link danger" onClick={() => setConfirmDelete(c.id)}>
                      {L("Delete", "حذف")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          {L(
            "Data is stored in this browser (IndexedDB) and never leaves it except when you ask for an AI explanation or an Excel export. Multi-user tenancy with row-level security needs the Supabase backend described in supabase/migrations.",
            "تُحفظ البيانات في هذا المتصفح (IndexedDB) ولا تغادره إلا عند طلب شرح بالذكاء الاصطناعي أو تصدير Excel. تعدد المستخدمين مع أمان على مستوى الصفوف يتطلب خادم Supabase الموصوف في supabase/migrations.",
          )}
        </p>
      </Card>

      {company && s && (
        <>
          <LockNotice />
          <Card title={L("Company registration", "تسجيل الشركة")}>
            <fieldset disabled={locked} className="grid">
              <Field label={L("Trade name (English)", "الاسم التجاري (إنجليزي)")}>
                <input value={s.tradeNameEn} onChange={(e) => set("tradeNameEn", e.target.value)} />
              </Field>
              <Field label={L("Trade name (Arabic)", "الاسم التجاري (عربي)")}>
                <input dir="rtl" value={s.tradeNameAr} onChange={(e) => set("tradeNameAr", e.target.value)} />
              </Field>
              <Field label={L("Legal structure", "الشكل القانوني")}>
                <select value={s.legalType} onChange={(e) => set("legalType", e.target.value as CompanySettings["legalType"])}>
                  <option value="SAE">{L("Joint stock company (SAE)", "شركة مساهمة مصرية")}</option>
                  <option value="LLC">{L("Limited liability company (LLC)", "شركة ذات مسؤولية محدودة")}</option>
                  <option value="BRANCH">{L("Branch of a foreign company", "فرع شركة أجنبية")}</option>
                  <option value="ONE_PERSON">{L("One-person company", "شركة الشخص الواحد")}</option>
                </select>
              </Field>
              <Field label={L("Tax card number (9 digits)", "رقم البطاقة الضريبية (٩ أرقام)")} hint={taxOk ? undefined : L("Must be 9 digits.", "يجب أن يكون ٩ أرقام.")}>
                <input inputMode="numeric" className={taxOk ? "" : "invalid"} value={s.taxCardNumber} onChange={(e) => set("taxCardNumber", e.target.value)} />
              </Field>
              <Field label={L("Commercial registry", "السجل التجاري")}>
                <input value={s.commercialRegistry} onChange={(e) => set("commercialRegistry", e.target.value)} />
              </Field>
              <Field label={L("Industry sector", "القطاع")}>
                <input value={s.industry} onChange={(e) => set("industry", e.target.value)} />
              </Field>
            </fieldset>
          </Card>
          <Card title={L("Financial settings", "الإعدادات المالية")}>
            <fieldset disabled={locked} className="grid">
              <Field label={L("Functional currency", "العملة الوظيفية")}>
                <select value={s.functionalCurrency} onChange={(e) => set("functionalCurrency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={L("Presentation currency", "عملة العرض")}>
                <select value={s.presentationCurrency} onChange={(e) => set("presentationCurrency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={L("Reporting framework", "إطار التقارير")}>
                <select value={s.framework} onChange={(e) => set("framework", e.target.value as "EAS" | "IFRS")}>
                  <option value="EAS">{L("Egyptian Accounting Standards (EAS)", "معايير المحاسبة المصرية")}</option>
                  <option value="IFRS">IFRS</option>
                </select>
              </Field>
              <Field label={L("Fiscal year end", "نهاية السنة المالية")}>
                <select value={s.fiscalYearEnd} onChange={(e) => set("fiscalYearEnd", e.target.value as "12-31" | "06-30")}>
                  <option value="12-31">{L("31 December", "٣١ ديسمبر")}</option>
                  <option value="06-30">{L("30 June", "٣٠ يونيو")}</option>
                </select>
              </Field>
              <Field label={L("Cash flow default", "طريقة التدفقات النقدية")}>
                <select value={s.cashFlowMethod} onChange={(e) => set("cashFlowMethod", e.target.value as "INDIRECT" | "DIRECT")}>
                  <option value="INDIRECT">{L("Indirect", "غير مباشرة")}</option>
                  <option value="DIRECT">{L("Direct (derived)", "مباشرة (مشتقة)")}</option>
                </select>
              </Field>
            </fieldset>
            {s.presentationCurrency !== s.functionalCurrency && (
              <Banner kind="warning">
                {L(
                  "Presentation differs from functional currency. The app does not translate balances: load the trial balance already in the presentation currency.",
                  "عملة العرض تختلف عن العملة الوظيفية. التطبيق لا يترجم الأرصدة: حمّل الميزان بعملة العرض.",
                )}
              </Banner>
            )}
          </Card>
          <Card title={L("Reporting period", "الفترة المالية")}>
            <fieldset disabled={locked} className="grid">
              <Field label={L("Start date", "تاريخ البداية")}>
                <input type="date" value={company.period.start} onChange={(e) => setPeriod("start", e.target.value)} />
              </Field>
              <Field label={L("End date", "تاريخ النهاية")}>
                <input type="date" value={company.period.end} onChange={(e) => setPeriod("end", e.target.value)} />
              </Field>
              <Field label={L("Current period label", "اسم الفترة الحالية")}>
                <input value={company.period.currentLabel} onChange={(e) => setPeriod("currentLabel", e.target.value)} />
              </Field>
              <Field label={L("Prior period label", "اسم الفترة السابقة")}>
                <input value={company.period.priorLabel} onChange={(e) => setPeriod("priorLabel", e.target.value)} />
              </Field>
            </fieldset>
          </Card>
          <AiPanel module="company" />
        </>
      )}
    </Page>
  );
}
