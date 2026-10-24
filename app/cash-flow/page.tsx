"use client";

import { Fragment, useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Waterfall } from "@/components/charts";
import { Banner, Card, NeedsData, Page, Pill, Stat, Tabs } from "@/components/ui";
import { CF_LABELS } from "@/lib/labels";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

export default function CashFlowPage() {
  const { company, computed } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const [tab, setTab] = useState<"INDIRECT" | "DIRECT">(company?.settings.cashFlowMethod ?? "INDIRECT");
  const cf = computed?.analysis ? computed.cashFlow : null;
  const direct = computed?.analysis ? computed.cashFlowDirect : null;
  const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : `${Math.round(n / 1e3)}k`);

  return (
    <Page title={L("6 · Statement of cash flows", "٦ · قائمة التدفقات النقدية")} subtitle={L("Every balance-sheet movement is classified, so cash ties with zero plugs. Derived items are labelled.", "كل حركة في المركز المالي مصنفة، فتتطابق النقدية دون أي فروق موازنة. البنود المشتقة موضحة.")}>
      <NeedsData>
        {!cf || !direct ? (
          <Banner kind="info">{L("A prior period is needed to build the cash flow statement.", "يلزم وجود فترة سابقة لإعداد قائمة التدفقات النقدية.")}</Banner>
        ) : (
          <>
            {Math.abs(cf.tieOutDifference) < 0.01 ? (
              <Banner kind="ok">
                ✓ {L("Beginning cash + net cash flow = balance sheet cash", "نقدية أول المدة + صافي التدفق = النقدية بالمركز المالي")} ({f.money(cf.endingCashPerBalanceSheet)}).
              </Banner>
            ) : (
              <Banner kind="error">
                {L("Cash flow does not tie to balance sheet cash. Difference:", "التدفقات لا تطابق النقدية بالمركز المالي. الفرق:")} {f.money(cf.tieOutDifference)} — {L("check that both trial balances balance.", "تأكد من توازن الميزانين.")}
              </Banner>
            )}
            <div className="stats">
              <Stat label={L("Operating", "التشغيلية")} value={f.money(cf.operating)} tone={cf.operating >= 0 ? "good" : "bad"} />
              <Stat label={L("Investing", "الاستثمارية")} value={f.money(cf.investing)} />
              <Stat label={L("Financing", "التمويلية")} value={f.money(cf.financing)} />
              <Stat label={L("Free cash flow", "التدفق النقدي الحر")} value={f.money(cf.freeCashFlow)} tone={cf.freeCashFlow >= 0 ? "good" : "bad"} />
            </div>
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                ["INDIRECT", L("Indirect method", "الطريقة غير المباشرة")],
                ["DIRECT", L("Direct method (derived)", "الطريقة المباشرة (مشتقة)")],
              ]}
            />
            <Card>
              {tab === "INDIRECT" ? (
                <table>
                  <tbody>
                    {(["operating", "investing", "financing"] as const).map((sec) => (
                      <Fragment key={sec}>
                        <tr key={`${sec}-h`} className="group-row">
                          <td colSpan={2}>{{ operating: L("Operating activities", "الأنشطة التشغيلية"), investing: L("Investing activities", "الأنشطة الاستثمارية"), financing: L("Financing activities", "الأنشطة التمويلية") }[sec]}</td>
                        </tr>
                        {cf.lines
                          .filter((l) => l.section === sec)
                          .map((l) => (
                            <tr key={l.key}>
                              <td>
                                {L(...CF_LABELS[l.key])} {l.derived && <Pill kind="info">{L("derived", "مشتق")}</Pill>}
                              </td>
                              <td className={`num ${l.amount < 0 ? "neg" : ""}`}>{f.n(l.amount)}</td>
                            </tr>
                          ))}
                        <tr key={`${sec}-t`} className="subtotal">
                          <td>{{ operating: L("Net cash from operating activities", "صافي النقدية من الأنشطة التشغيلية"), investing: L("Net cash from investing activities", "صافي النقدية من الأنشطة الاستثمارية"), financing: L("Net cash from financing activities", "صافي النقدية من الأنشطة التمويلية") }[sec]}</td>
                          <td className="num">{f.n(cf[sec])}</td>
                        </tr>
                      </Fragment>
                    ))}
                    <tr className="total">
                      <td>{L("Net change in cash", "صافي التغير في النقدية")}</td>
                      <td className="num">{f.n(cf.netChange)}</td>
                    </tr>
                    <tr>
                      <td>{L("Beginning cash", "النقدية أول المدة")}</td>
                      <td className="num">{f.n(cf.beginningCash)}</td>
                    </tr>
                    <tr className="total">
                      <td>{L("Ending cash", "النقدية آخر المدة")}</td>
                      <td className="num">{f.n(cf.endingCashPerCashFlow)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <>
                  <Banner kind="info">
                    {L(
                      "Derived from accruals: without transaction-level cash detail, receipts and payments are reconstructed from revenue, costs and working-capital movements. The operating total equals the indirect method.",
                      "مشتقة من الاستحقاقات: في غياب تفاصيل المعاملات النقدية، يتم استنتاج المتحصلات والمدفوعات من الإيرادات والتكاليف وحركة رأس المال العامل. الإجمالي التشغيلي يساوي الطريقة غير المباشرة.",
                    )}
                  </Banner>
                  <table>
                    <tbody>
                      {direct.lines.map((l) => (
                        <tr key={l.key}>
                          <td>{L(...CF_LABELS[l.key])}</td>
                          <td className={`num ${l.amount < 0 ? "neg" : ""}`}>{f.n(l.amount)}</td>
                        </tr>
                      ))}
                      <tr className="total">
                        <td>{L("Net cash from operating activities", "صافي النقدية من الأنشطة التشغيلية")}</td>
                        <td className="num">{f.n(direct.operating)}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
            </Card>
            <Card title={L("Bridge from net profit to ending cash", "الجسر من صافي الربح إلى النقدية آخر المدة")}>
              <Waterfall
                format={compact}
                items={[
                  { label: L("Opening cash", "نقدية أول المدة"), value: cf.beginningCash, total: true },
                  { label: L("Net profit", "صافي الربح"), value: computed!.analysis!.current.netProfit },
                  { label: L("D&A", "الإهلاك"), value: computed!.analysis!.current.depreciation },
                  { label: L("Working capital", "رأس المال العامل"), value: cf.operating - computed!.analysis!.current.netProfit - computed!.analysis!.current.depreciation },
                  { label: L("Investing", "الاستثمار"), value: cf.investing },
                  { label: L("Financing", "التمويل"), value: cf.financing },
                  { label: L("Ending cash", "نقدية آخر المدة"), value: cf.endingCashPerCashFlow, total: true },
                ]}
              />
            </Card>
            <AiPanel module="cash-flow" />
          </>
        )}
      </NeedsData>
    </Page>
  );
}
