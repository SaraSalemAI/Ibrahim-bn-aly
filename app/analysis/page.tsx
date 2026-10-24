"use client";

import { AiPanel } from "@/components/AiPanel";
import { Bars, Gauge, Legend } from "@/components/charts";
import { Banner, Card, NeedsData, Page, Pill } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const BENEISH: Record<string, [string, string]> = {
  DSRI: ["Days sales in receivables index", "مؤشر أيام المبيعات في العملاء"],
  GMI: ["Gross margin index", "مؤشر هامش مجمل الربح"],
  AQI: ["Asset quality index", "مؤشر جودة الأصول"],
  SGI: ["Sales growth index", "مؤشر نمو المبيعات"],
  DEPI: ["Depreciation index", "مؤشر الإهلاك"],
  SGAI: ["SG&A index", "مؤشر المصروفات البيعية والإدارية"],
  LVGI: ["Leverage index", "مؤشر الرافعة"],
  TATA: ["Total accruals to total assets", "إجمالي الاستحقاقات إلى الأصول"],
};

export default function AnalysisPage() {
  const { ws, company, computed } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { line } = makeT(ws.lang);
  const a = computed?.analysis;
  const show = (unit: string, v: number | null) => (v === null ? L("n/a", "غير متاح") : unit === "%" ? f.pct(v) : unit === "days" ? `${v.toFixed(0)} ${L("days", "يوم")}` : f.x(v));
  const node = (label: string, v: number | null, pct = false) => (
    <div className="tree-node">
      <div className="tree-label">{label}</div>
      <div className="tree-value">{v === null ? "—" : pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(2)}</div>
    </div>
  );

  return (
    <Page title={L("9 · Financial analysis & diagnostics", "٩ · التحليل المالي والتشخيص")} subtitle={L("Liquidity, profitability, efficiency and leverage, DuPont decomposition, and distress/forensic scores.", "السيولة والربحية والكفاءة والرافعة، وتحليل دوبونت، ومؤشرات التعثر والتلاعب.")}>
      <NeedsData>
        {a && computed && company && (
          <>
            <div className="ratios-grid">
              {(["liquidity", "profitability", "efficiency", "leverage"] as const).map((g) => (
                <Card key={g} title={{ liquidity: L("Liquidity", "السيولة"), profitability: L("Profitability", "الربحية"), efficiency: L("Efficiency", "الكفاءة"), leverage: L("Leverage", "الرافعة المالية") }[g]}>
                  <table>
                    <thead>
                      <tr>
                        <th />
                        <th className="num">{company.period.currentLabel}</th>
                        <th className="num">{a.hasPrior ? company.period.priorLabel : ""}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.ratios
                        .filter((r) => r.group === g)
                        .map((r) => (
                          <tr key={r.key} title={r.formula}>
                            <td>{line(r.key)}</td>
                            <td className="num strong">{show(r.unit, r.current)}</td>
                            <td className="num muted">{a.hasPrior ? show(r.unit, r.prior) : "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </Card>
              ))}
            </div>

            <Card title={L("DuPont analysis", "تحليل دوبونت")}>
              <h3>{L("3-step", "ثلاثي")}</h3>
              <div className="tree">
                {node(L("ROE", "العائد على حقوق الملكية"), computed.dupont.threeStep.roe, true)}
                <div className="tree-row">
                  {node(L("Net margin", "هامش صافي الربح"), computed.dupont.threeStep.netMargin, true)}
                  <span className="op">×</span>
                  {node(L("Asset turnover", "معدل دوران الأصول"), computed.dupont.threeStep.assetTurnover)}
                  <span className="op">×</span>
                  {node(L("Equity multiplier", "مضاعف حقوق الملكية"), computed.dupont.threeStep.equityMultiplier)}
                </div>
              </div>
              <h3>{L("5-step", "خماسي")}</h3>
              <div className="tree">
                {node(L("ROE", "العائد على حقوق الملكية"), computed.dupont.fiveStep.roe, true)}
                <div className="tree-row">
                  {node(L("Tax burden (NP/EBT)", "العبء الضريبي"), computed.dupont.fiveStep.taxBurden)}
                  <span className="op">×</span>
                  {node(L("Interest burden (EBT/EBIT)", "عبء الفوائد"), computed.dupont.fiveStep.interestBurden)}
                  <span className="op">×</span>
                  {node(L("EBIT margin", "هامش ربح التشغيل"), computed.dupont.fiveStep.ebitMargin, true)}
                  <span className="op">×</span>
                  {node(L("Asset turnover", "دوران الأصول"), computed.dupont.fiveStep.assetTurnover)}
                  <span className="op">×</span>
                  {node(L("Equity multiplier", "مضاعف حقوق الملكية"), computed.dupont.fiveStep.equityMultiplier)}
                </div>
              </div>
            </Card>

            <Card title={L("Working capital & cash conversion cycle", "رأس المال العامل ودورة التحويل النقدي")}>
              {(() => {
                const get = (k: string, p: "current" | "prior") => a.ratios.find((r) => r.key === k)?.[p] ?? null;
                const keys = ["dso", "dio", "dpo", "cashConversionCycle"];
                return (
                  <>
                    <Bars
                      format={(n) => n.toFixed(0)}
                      series={keys.map((k) => ({
                        label: { dso: "DSO", dio: "DIO", dpo: "DPO", cashConversionCycle: "CCC" }[k] ?? k,
                        values: [
                          { name: company.period.currentLabel, value: get(k, "current") },
                          ...(a.hasPrior ? [{ name: company.period.priorLabel, value: get(k, "prior") }] : []),
                        ],
                      }))}
                    />
                    <Legend names={[company.period.currentLabel, ...(a.hasPrior ? [company.period.priorLabel] : [])]} />
                    <p className="small muted">{L("CCC = DSO + DIO − DPO, on closing balances and a 365-day year.", "دورة التحويل = فترة التحصيل + فترة التخزين − فترة السداد، على الأرصدة الختامية و٣٦٥ يومًا.")}</p>
                  </>
                );
              })()}
            </Card>

            <div className="two-col">
              <Card title={L("Altman Z''-score (emerging markets)", "مؤشر ألتمان Z'' (الأسواق الناشئة)")}>
                {computed.altman.available ? (
                  <>
                    <Gauge
                      value={computed.altman.z!}
                      format={(n) => n.toFixed(2)}
                      zones={[
                        { upTo: 1.1, cls: "zone-bad", label: L("Distress", "تعثر") },
                        { upTo: 2.6, cls: "zone-warn", label: L("Grey", "رمادية") },
                        { upTo: Math.max(6, computed.altman.z! + 1), cls: "zone-good", label: L("Safe", "آمنة") },
                      ]}
                    />
                    <table className="compact">
                      <tbody>
                        <tr><td>X1 {L("working capital / total assets", "رأس المال العامل / الأصول")}</td><td className="num">{computed.altman.x1}</td></tr>
                        <tr><td>X2 {L("retained earnings / total assets", "الأرباح المحتجزة / الأصول")}</td><td className="num">{computed.altman.x2}</td></tr>
                        <tr><td>X3 {L("EBIT / total assets", "ربح التشغيل / الأصول")}</td><td className="num">{computed.altman.x3}</td></tr>
                        <tr><td>X4 {L("book equity / total liabilities", "حقوق الملكية / الالتزامات")}</td><td className="num">{computed.altman.x4}</td></tr>
                      </tbody>
                    </table>
                    <p className="small muted">Z'' = 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4 · {L("safe > 2.60, distress < 1.10", "آمن > ٢٫٦٠، تعثر < ١٫١٠")}</p>
                  </>
                ) : (
                  <Banner kind="info">{L("Not computable (zero total assets or liabilities).", "غير قابل للحساب (أصول أو التزامات صفرية).")}</Banner>
                )}
              </Card>
              <Card title={L("Beneish M-score (8 variables)", "مؤشر بينيش M (٨ متغيرات)")}>
                {computed.beneish?.available ? (
                  <>
                    <p className="stat-value">
                      {computed.beneish.m} {computed.beneish.flag ? <Pill kind="bad">{L("above −1.78: review earnings quality", "أعلى من −١٫٧٨: راجع جودة الأرباح")}</Pill> : <Pill kind="good">{L("below −1.78", "أقل من −١٫٧٨")}</Pill>}
                    </p>
                    <table className="compact">
                      <tbody>
                        {Object.entries(computed.beneish.vars).map(([k, v]) => (
                          <tr key={k}>
                            <td>
                              {k} · {L(...BENEISH[k])}
                            </td>
                            <td className="num">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="small muted">{L("A screening signal, not evidence of manipulation.", "مؤشر فحص وليس دليلًا على التلاعب.")}</p>
                  </>
                ) : (
                  <Banner kind="info">
                    {computed.beneish ? `${L("Missing inputs", "مدخلات ناقصة")}: ${computed.beneish.missing.join(", ")}` : L("Needs a prior period.", "يحتاج فترة سابقة.")}
                  </Banner>
                )}
              </Card>
            </div>
            <AiPanel module="analysis" />
          </>
        )}
      </NeedsData>
    </Page>
  );
}
