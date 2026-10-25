"use client";

import { useMemo, useState } from "react";
import { Banner, Card, Page, Pill, Stat } from "@/components/ui";
import { isIntercompany } from "@/lib/finance/consolidation";
import { makeT } from "@/lib/i18n";
import { TOTAL_LINES } from "@/lib/labels";
import { uid } from "@/lib/workspace/defaults";
import { consolidatedCompany, consolidateGroup } from "@/lib/workspace/group";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";
import type { Group } from "@/lib/workspace/types";

const ELIM_LABELS: Record<string, [string, string]> = {
  intercompanyBalances: ["Intercompany receivables and payables", "أرصدة الشركات الشقيقة (مدينة ودائنة)"],
  intercompanyPnl: ["Intercompany sales, charges and interest", "المبيعات والرسوم والفوائد بين شركات المجموعة"],
  investment: ["Investment in subsidiaries against share capital", "الاستثمار في الشركات التابعة مقابل رأس المال"],
  nci: ["Non-controlling interests", "الحقوق غير المسيطرة"],
};

export default function ConsolidationPage() {
  const { ws, dispatch } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { line } = makeT(ws.lang);
  const [groupId, setGroupId] = useState<string | null>(ws.groups[0]?.id ?? null);
  const group = ws.groups.find((g) => g.id === groupId) ?? ws.groups[0] ?? null;
  const result = useMemo(() => (group ? consolidateGroup(ws.companies, group) : null), [ws.companies, group]);

  const save = (g: Group) => dispatch({ type: "setGroups", groups: ws.groups.some((x) => x.id === g.id) ? ws.groups.map((x) => (x.id === g.id ? g : x)) : [...ws.groups, g] });
  const create = () => {
    const parent = ws.companies[0];
    if (!parent) return;
    const g: Group = { id: uid("grp"), name: `${parent.settings.tradeNameEn} Group`, parentId: parent.id, members: [{ companyId: parent.id, ownership: 1 }] };
    save(g);
    setGroupId(g.id);
  };

  const a = result?.analysis;
  return (
    <Page
      title={L("Group consolidation", "القوائم المجمعة")}
      subtitle={L(
        "Combine the trial balances of a parent and its subsidiaries, eliminate intercompany balances and transactions, the investment in subsidiaries, and show non-controlling interests.",
        "تجميع موازين الشركة الأم والشركات التابعة، واستبعاد الأرصدة والمعاملات بين شركات المجموعة والاستثمار في الشركات التابعة، وعرض الحقوق غير المسيطرة.",
      )}
      actions={<button onClick={create} disabled={!ws.companies.length}>{L("New group", "مجموعة جديدة")}</button>}
    >
      {ws.companies.length < 2 && <Banner kind="info">{L("Add the parent and at least one subsidiary as companies in this workspace, each with its trial balance.", "أضف الشركة الأم وشركة تابعة واحدة على الأقل كشركات في مساحة العمل، لكل منها ميزان مراجعة.")}</Banner>}
      {!group && ws.companies.length > 0 && <Banner kind="info">{L("Create a group to start.", "أنشئ مجموعة للبدء.")}</Banner>}
      {group && (
        <>
          <Card
            title={L("Group structure", "هيكل المجموعة")}
            actions={
              ws.groups.length > 1 && (
                <select value={group.id} onChange={(e) => setGroupId(e.target.value)}>
                  {ws.groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )
            }
          >
            <div className="grid">
              <label className="field">
                {L("Group name", "اسم المجموعة")}
                <input value={group.name} onChange={(e) => save({ ...group, name: e.target.value })} />
              </label>
              <label className="field">
                {L("Parent company", "الشركة الأم")}
                <select value={group.parentId} onChange={(e) => save({ ...group, parentId: e.target.value, members: group.members.some((m) => m.companyId === e.target.value) ? group.members : [...group.members, { companyId: e.target.value, ownership: 1 }] })}>
                  {ws.companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.settings.tradeNameEn}</option>
                  ))}
                </select>
              </label>
            </div>
            <table className="compact">
              <thead>
                <tr>
                  <th>{L("Include", "تضمين")}</th>
                  <th>{L("Company", "الشركة")}</th>
                  <th className="num">{L("Ownership %", "نسبة الملكية ٪")}</th>
                  <th>{L("Intercompany accounts found", "حسابات بين شركات المجموعة")}</th>
                </tr>
              </thead>
              <tbody>
                {ws.companies.map((c) => {
                  const m = group.members.find((x) => x.companyId === c.id);
                  const ic = c.rows.filter((r) => isIntercompany(r, c.intercompanyCodes));
                  return (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!m}
                          disabled={c.id === group.parentId}
                          onChange={(e) => save({ ...group, members: e.target.checked ? [...group.members, { companyId: c.id, ownership: 1 }] : group.members.filter((x) => x.companyId !== c.id) })}
                        />
                      </td>
                      <td>
                        {c.settings.tradeNameEn} {c.id === group.parentId && <Pill kind="info">{L("parent", "الأم")}</Pill>} {!c.rows.length && <Pill kind="warn">{L("no TB", "بدون ميزان")}</Pill>}
                      </td>
                      <td className="num">
                        {m && c.id !== group.parentId ? (
                          <input type="number" min={0} max={100} step={0.1} style={{ width: 80 }} value={Math.round(m.ownership * 1000) / 10} onChange={(e) => save({ ...group, members: group.members.map((x) => (x.companyId === c.id ? { ...x, ownership: Math.min(100, Math.max(0, Number(e.target.value))) / 100 } : x)) })} />
                        ) : (
                          m && "100"
                        )}
                      </td>
                      <td className="small">{ic.length ? ic.map((r) => `${r.code} ${r.name}`).join(" · ") : <span className="muted">{L("none by name: tag codes on the mapping page", "لا يوجد بالاسم: حدد الأكواد من صفحة الربط")}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="muted small">
              {L(
                "Intercompany accounts are recognised by name (\"intercompany\", \"due from/to parent\", \"related parties\", \"أطراف ذات علاقة\", \"جاري الشركات\") or by the codes you tag. Simplification: subsidiary share capital stands in for net assets at acquisition; enter fair-value and pre-acquisition adjustments as AJEs.",
                "يتم التعرف على حسابات المجموعة بالاسم أو بالأكواد التي تحددها. تبسيط: رأس مال الشركة التابعة يمثل صافي الأصول عند الاستحواذ؛ أدخل تسويات القيمة العادلة وما قبل الاستحواذ كقيود تسوية.",
              )}
            </p>
            <button className="danger ghost" onClick={() => dispatch({ type: "setGroups", groups: ws.groups.filter((g) => g.id !== group.id) })}>
              {L("Delete group", "حذف المجموعة")}
            </button>
          </Card>

          {result && a && (
            <>
              <div className="stats">
                <Stat label={L("Group revenue", "إيرادات المجموعة")} value={f.money(a.current.revenue)} />
                <Stat label={L("Group net profit", "صافي ربح المجموعة")} value={f.money(a.current.netProfit)} tone={a.current.netProfit >= 0 ? "good" : "bad"} />
                <Stat label={L("Attributable to NCI", "نصيب الحقوق غير المسيطرة")} value={f.money(result.nci.profit)} />
                <Stat label={L("Goodwill", "الشهرة")} value={f.money(result.goodwill.current)} />
                <Stat label={L("Balance check", "توازن الميزانية")} value={Math.abs(a.current.balanceCheck) < 0.01 ? "✓" : f.n(a.current.balanceCheck)} tone={Math.abs(a.current.balanceCheck) < 0.01 ? "good" : "bad"} />
              </div>
              {(result.differences.balances.current !== 0 || result.differences.pnl.current !== 0) && (
                <Banner kind="warning">
                  {L("Intercompany items do not agree between companies", "أرصدة المجموعة غير متطابقة بين الشركات")}: {L("balances", "الأرصدة")} {f.n(result.differences.balances.current)} · {L("income/expense", "الإيرادات/المصروفات")} {f.n(result.differences.pnl.current)}. {L("They are shown on an “unreconciled” line until the companies agree them.", "تظهر في بند «غير مطابق» حتى تتم المطابقة.")}
                </Banner>
              )}
              <div className="two-col">
                <Card title={L("Eliminations", "الاستبعادات")}>
                  <table className="compact">
                    <thead>
                      <tr>
                        <th />
                        <th className="num">{L("Current", "الحالية")}</th>
                        <th className="num">{L("Prior", "السابقة")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.eliminations.map((e) => (
                        <tr key={e.type}>
                          <td>{L(...ELIM_LABELS[e.type])}</td>
                          <td className="num">{f.n(e.current)}</td>
                          <td className="num">{f.n(e.prior)}</td>
                        </tr>
                      ))}
                      {!result.eliminations.length && (
                        <tr>
                          <td colSpan={3} className="muted">{L("Nothing to eliminate was found.", "لا توجد بنود للاستبعاد.")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
                <Card title={L("By company", "حسب الشركة")}>
                  <table className="compact">
                    <thead>
                      <tr>
                        <th />
                        <th className="num">{L("Revenue", "الإيرادات")}</th>
                        <th className="num">{L("Net profit", "صافي الربح")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.entities.map((e) => {
                        const pl = e.rows;
                        const rev = -pl.filter((r) => r.category === "REVENUE").reduce((s, r) => s + r.currentDebit - r.currentCredit, 0);
                        const np = -pl.filter((r) => ["REVENUE", "OTHER_INCOME", "COGS", "SELLING_EXPENSE", "ADMIN_EXPENSE", "DEPRECIATION", "FINANCE_COST", "TAX_EXPENSE"].includes(r.category)).reduce((s, r) => s + r.currentDebit - r.currentCredit, 0);
                        return (
                          <tr key={e.id}>
                            <td>
                              {e.name} <span className="muted small">{Math.round(e.ownership * 100)}%</span>
                            </td>
                            <td className="num">{f.n(rev)}</td>
                            <td className="num">{f.n(np)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </div>
              <div className="two-col">
                {(["PL", "BS"] as const).map((st) => (
                  <Card key={st} title={st === "PL" ? L("Consolidated income statement", "قائمة الدخل المجمعة") : L("Consolidated balance sheet", "الميزانية المجمعة")}>
                    <table className="compact">
                      <tbody>
                        {a.variances
                          .filter((v) => v.statement === st && (v.current !== 0 || (v.prior ?? 0) !== 0))
                          .map((v) => (
                            <tr key={v.key} className={TOTAL_LINES.has(v.key) ? "total" : ""}>
                              <td>{line(v.key)}</td>
                              <td className="num">{f.n(v.current)}</td>
                              {a.hasPrior && <td className="num muted">{f.n(v.prior)}</td>}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </Card>
                ))}
              </div>
              <Card>
                <button
                  onClick={() => {
                    const parent = ws.companies.find((c) => c.id === group.parentId);
                    if (parent) dispatch({ type: "addCompany", company: consolidatedCompany(parent, group, result.rows) });
                  }}
                >
                  {L("Open as a company (all modules on the group)", "فتح كشركة (كل الوحدات على المجموعة)")}
                </button>
                <p className="muted small">{L("Creates a company holding the consolidated trial balance, with each elimination as a labelled line, so statements, ratios, the model, valuation and the board pack run on the group.", "ينشئ شركة بميزان المجموعة المجمع مع كل استبعاد كبند مستقل، لتعمل القوائم والنسب والنموذج والتقييم وحزمة المجلس على المجموعة.")}</p>
              </Card>
            </>
          )}
        </>
      )}
    </Page>
  );
}
