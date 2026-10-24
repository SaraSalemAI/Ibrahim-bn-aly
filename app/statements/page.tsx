"use client";

import { Fragment, useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, Field, LockNotice, NeedsData, NumInput, Page, Pill, Tabs } from "@/components/ui";
import { makeT } from "@/lib/i18n";
import { EQUITY_ROWS, LINE_CATEGORIES, TOTAL_LINES } from "@/lib/labels";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

type Tab = "PL" | "BS" | "EQ" | "BRIDGE";

export default function StatementsPage() {
  const { ws, company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { line } = makeT(ws.lang);
  const [tab, setTab] = useState<Tab>("PL");
  const [comparative, setComparative] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const a = computed?.analysis;

  return (
    <Page title={L("5 · Financial statements", "٥ · القوائم المالية")} subtitle={L("Balance sheet, income statement and changes in equity, with tie-out assertions and drill-down to accounts.", "قائمة المركز المالي وقائمة الدخل والتغير في حقوق الملكية مع اختبارات التوازن والتتبع حتى الحسابات.")}>
      <NeedsData>
        {a && computed && company && (
          <>
            <LockNotice />
            {Math.abs(a.current.balanceCheck) > 0.005 ? (
              <Banner kind="error">
                {L("Balance sheet does not tie: assets − (liabilities + equity) =", "قائمة المركز المالي غير متوازنة: الأصول − (الالتزامات + حقوق الملكية) =")} {f.money(a.current.balanceCheck)}
              </Banner>
            ) : (
              <Banner kind="ok">
                ✓ {L("Assets = liabilities + equity (difference 0.00).", "الأصول = الالتزامات + حقوق الملكية (الفرق ٠٫٠٠).")} {company.settings.framework === "IFRS" && computed.bridge.length > 0 && L("IFRS bridge entries applied.", "تم تطبيق تسويات المعايير الدولية.")}
              </Banner>
            )}
            <div className="actions">
              <Tabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  ["PL", L("Income statement", "قائمة الدخل")],
                  ["BS", L("Balance sheet", "المركز المالي")],
                  ["EQ", L("Changes in equity", "التغير في حقوق الملكية")],
                  ["BRIDGE", L("EAS ↔ IFRS bridge", "التسوية بين المعايير")],
                ]}
              />
              {a.hasPrior && (
                <label className="inline">
                  <input type="checkbox" checked={comparative} onChange={(e) => setComparative(e.target.checked)} /> {L("Comparative", "مقارنة")}
                </label>
              )}
            </div>

            {(tab === "PL" || tab === "BS") && (
              <Card>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{L("Line", "البند")}</th>
                        <th className="num">{company.period.currentLabel}</th>
                        {comparative && a.hasPrior && (
                          <>
                            <th className="num">{company.period.priorLabel}</th>
                            <th className="num">{L("Change", "التغير")}</th>
                            <th className="num">%</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {a.variances
                        .filter((v) => v.statement === tab && (v.key !== "unmappedHolding" || v.current !== 0 || (v.prior ?? 0) !== 0))
                        .map((v) => {
                          const cats = LINE_CATEGORIES[v.key];
                          const parts = cats ? computed.rows.filter((r) => cats.includes(r.category as never)) : [];
                          const isOpen = open === v.key;
                          return (
                            <Fragment key={v.key}>
                              <tr className={`${TOTAL_LINES.has(v.key) ? "total" : ""} ${cats ? "clickable" : ""}`} onClick={() => cats && setOpen(isOpen ? null : v.key)}>
                                <td>
                                  {cats && <span className="muted">{isOpen ? "▾ " : "▸ "}</span>}
                                  {line(v.key)} {v.material && comparative && <Pill kind="warn">{L("material", "جوهري")}</Pill>}
                                </td>
                                <td className="num">{f.n(v.current)}</td>
                                {comparative && a.hasPrior && (
                                  <>
                                    <td className="num">{f.n(v.prior)}</td>
                                    <td className={`num ${(v.change ?? 0) < 0 ? "neg" : ""}`}>{f.n(v.change)}</td>
                                    <td className="num">{f.pct(v.changePct)}</td>
                                  </>
                                )}
                              </tr>
                              {isOpen &&
                                parts.map((r) => {
                                  const sign = ["PAYABLES", "SHORT_TERM_DEBT", "OTHER_CURRENT_LIABILITY", "LONG_TERM_DEBT", "OTHER_NON_CURRENT_LIABILITY", "SHARE_CAPITAL", "LEGAL_RESERVE", "RETAINED_EARNINGS", "OTHER_EQUITY", "REVENUE", "OTHER_INCOME"].includes(r.category) ? -1 : 1;
                                  return (
                                    <tr key={r.code} className="drill">
                                      <td>
                                        ↳ {r.code} {r.name}
                                      </td>
                                      <td className="num">{f.n(sign * (r.currentDebit - r.currentCredit))}</td>
                                      {comparative && a.hasPrior && (
                                        <>
                                          <td className="num">{f.n(sign * (r.priorDebit - r.priorCredit))}</td>
                                          <td colSpan={2} className="muted small">{r.mappingRule}</td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                            </Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {tab === "EQ" && (
              <Card>
                {!computed.equity.available && <Banner kind="info">{L("Prior-period figures are needed for the full roll-forward; showing closing balances only.", "يلزم أرقام الفترة السابقة لعرض الحركة كاملة؛ يتم عرض الأرصدة الختامية فقط.")}</Banner>}
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th />
                        <th className="num">{L("Share capital", "رأس المال")}</th>
                        <th className="num">{L("Legal reserve", "الاحتياطي القانوني")}</th>
                        <th className="num">{L("Retained earnings", "الأرباح المرحلة")}</th>
                        <th className="num">{L("Other equity", "أخرى")}</th>
                        <th className="num">{L("Total", "الإجمالي")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.equity.rows.map((r) => (
                        <tr key={r.key} className={r.key === "opening" || r.key === "closing" ? "total" : ""}>
                          <td>{L(...EQUITY_ROWS[r.key])}</td>
                          <td className="num">{f.n(r.shareCapital)}</td>
                          <td className="num">{f.n(r.legalReserve)}</td>
                          <td className="num">{f.n(r.retainedEarnings)}</td>
                          <td className="num">{f.n(r.otherEquity)}</td>
                          <td className="num">{f.n(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {computed.equity.legalReserveCheck && computed.equity.legalReserveCheck.shortfall > 0 && (
                  <Banner kind="warning">
                    {L("Legal reserve transfer", "المحول للاحتياطي القانوني")} {f.money(computed.equity.legalReserveCheck.actual)} {L("is below 5% of prior-year profit", "أقل من ٥٪ من ربح العام السابق")} ({f.money(computed.equity.legalReserveCheck.required)}). {L("Rule parameter per companies law; confirm with counsel.", "معيار وفق قانون الشركات؛ يُؤكد مع المستشار القانوني.")}
                  </Banner>
                )}
                {company.settings.framework === "EAS" && (company.bridge.employeeProfitShare > 0 || company.bridge.boardRemuneration > 0) && (
                  <p className="small">
                    {L("Proposed appropriations (EAS, recognised on general-assembly approval):", "التوزيعات المقترحة (المعايير المصرية، تُثبت عند موافقة الجمعية العامة):")} {L("employees' profit share", "حصة العاملين")} {f.money(company.bridge.employeeProfitShare)} · {L("board remuneration", "مكافأة مجلس الإدارة")} {f.money(company.bridge.boardRemuneration)}
                  </p>
                )}
              </Card>
            )}

            {tab === "BRIDGE" && (
              <Card title={L("EAS ↔ IFRS framework bridge", "التسوية بين المعايير المصرية والدولية")}>
                <fieldset disabled={locked} className="grid">
                  <Field label={L("Reporting framework", "إطار التقارير")}>
                    <select value={company.settings.framework} onChange={(e) => update({ action: "framework.switch", entity: "companies" }, (c) => ({ ...c, settings: { ...c.settings, framework: e.target.value as "EAS" | "IFRS" } }))}>
                      <option value="EAS">EAS</option>
                      <option value="IFRS">IFRS</option>
                    </select>
                  </Field>
                  <Field label={L("Employees' profit share (proposed)", "حصة العاملين في الأرباح (مقترحة)")}>
                    <NumInput value={company.bridge.employeeProfitShare} onChange={(v) => update({ action: "bridge.update", entity: "framework_bridge_adjustments" }, (c) => ({ ...c, bridge: { ...c.bridge, employeeProfitShare: v ?? 0 } }))} />
                  </Field>
                  <Field label={L("Board remuneration (proposed)", "مكافأة مجلس الإدارة (مقترحة)")}>
                    <NumInput value={company.bridge.boardRemuneration} onChange={(v) => update({ action: "bridge.update", entity: "framework_bridge_adjustments" }, (c) => ({ ...c, bridge: { ...c.bridge, boardRemuneration: v ?? 0 } }))} />
                  </Field>
                </fieldset>
                <table>
                  <thead>
                    <tr>
                      <th>{L("Topic", "البند")}</th>
                      <th>EAS</th>
                      <th>IFRS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{L("Employees' profit share", "حصة العاملين في الأرباح")}</td>
                      <td>{L("Appropriation of retained earnings (equity)", "توزيع من الأرباح المرحلة (حقوق ملكية)")}</td>
                      <td>{L("Personnel expense in P&L (IAS 19)", "مصروف عاملين في قائمة الدخل (IAS 19)")}</td>
                    </tr>
                    <tr>
                      <td>{L("Board remuneration", "مكافأة مجلس الإدارة")}</td>
                      <td>{L("Appropriation of profit (equity)", "توزيع أرباح (حقوق ملكية)")}</td>
                      <td>{L("Key management compensation in P&L (IAS 24)", "مكافآت الإدارة العليا في قائمة الدخل (IAS 24)")}</td>
                    </tr>
                    <tr>
                      <td>{L("Leases", "عقود الإيجار")}</td>
                      <td>EAS 49: ROU asset & lease liability</td>
                      <td>IFRS 16: ROU asset & lease liability</td>
                    </tr>
                    <tr>
                      <td>{L("Expected credit losses", "خسائر الائتمان المتوقعة")}</td>
                      <td>EAS 47 three-stage model</td>
                      <td>IFRS 9 three-stage model</td>
                    </tr>
                  </tbody>
                </table>
                <h3>{L("Bridge entries applied", "قيود التسوية المطبقة")}</h3>
                {computed.bridge.length ? (
                  <ul>
                    {computed.bridge.map((b) => (
                      <li key={b.id}>
                        <strong>{b.standardRef}</strong>: {b.reason} — Dr {b.lines[0].name} {f.money(b.lines[0].debit)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">{L("None (EAS treats these as equity appropriations).", "لا يوجد (المعايير المصرية تعالجها كتوزيعات في حقوق الملكية).")}</p>
                )}
              </Card>
            )}
            <AiPanel module="statements" />
          </>
        )}
      </NeedsData>
    </Page>
  );
}
