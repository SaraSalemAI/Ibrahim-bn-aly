"use client";

import { useMemo, useState } from "react";
import { AiPanel, aiStatus } from "@/components/AiPanel";
import { Banner, Card, LockNotice, NeedsData, Page, Pill } from "@/components/ui";
import { applyPrefixRule, confidenceBand } from "@/lib/finance/classify";
import { CATEGORIES, type Category } from "@/lib/finance/types";
import { makeT } from "@/lib/i18n";
import { isIntercompany } from "@/lib/finance/consolidation";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

type AiSuggestion = { code: string; category: Category | "UNMAPPED"; confidence: number; rationale: string };

export default function MappingPage() {
  const { ws, company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { category: catLabel, issue } = makeT(ws.lang);
  const [q, setQ] = useState("");
  const [band, setBand] = useState<"all" | "unmapped" | "low" | "medium" | "high">("all");
  const [prefix, setPrefix] = useState("");
  const [ruleCat, setRuleCat] = useState<Category | "">("CASH");
  const [ruleMsg, setRuleMsg] = useState("");
  const [ai, setAi] = useState<AiSuggestion[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");

  const rows = useMemo(() => company?.rows ?? [], [company]);
  const shown = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (q ? `${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase()) : true))
    .filter(({ r }) => {
      if (band === "all") return true;
      if (band === "unmapped") return r.category === "";
      return r.suggested && confidenceBand(r.confidence) === band;
    });

  const setCat = (i: number, category: Category | "", rule = "manual-override", confidence = 100) =>
    update({ action: "mapping.override", entity: "trial_balance_records", recordId: rows[i]?.code }, (c) => ({
      ...c,
      rows: c.rows.map((r, j) => (j === i ? { ...r, category, suggested: false, mappingRule: rule, confidence } : r)),
      period: { ...c.period, mappingConfirmed: false, status: "DRAFT" },
    }));

  const askAi = async () => {
    setAiBusy(true);
    setAiErr("");
    try {
      const status = await aiStatus();
      if (!status.configured) throw new Error(L("AI mapping needs the full app with AI Gateway configured.", "الربط بالذكاء الاصطناعي يتطلب التطبيق الكامل مع إعداد AI Gateway."));
      const targets = rows.filter((r) => r.category === "" || (r.suggested && (r.confidence ?? 100) <= 90)).slice(0, 200);
      if (!targets.length) throw new Error(L("No unmapped or low-confidence accounts.", "لا توجد حسابات غير مصنفة أو منخفضة الثقة."));
      const res = await fetch("/api/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: targets.map((r) => ({ code: r.code, name: r.name, balance: r.currentDebit - r.currentCredit })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setAi(data.mappings);
    } catch (e) {
      setAiErr((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const balanceIssues = computed?.analysis?.issues.filter((i) => i.code === "unbalanced") ?? [];
  const pending = rows.filter((r) => r.suggested).length;
  const unmapped = rows.filter((r) => r.category === "").length;

  return (
    <Page title={L("3 · Validation & smart mapping", "٣ · التحقق والربط الذكي للحسابات")} subtitle={L("Balancing gate, confidence-scored suggestions, bulk rules and an unmapped holding class.", "بوابة التوازن، اقتراحات بدرجات ثقة، قواعد جماعية، وحساب معلق لغير المصنف.")}>
      <NeedsData>
        <LockNotice />
        {balanceIssues.map((i, k) => (
          <Banner key={k} kind="error">
            ⛔ {issue(i, f.n)}
          </Banner>
        ))}
        {unmapped > 0 && <Banner kind="warning">{L(`${unmapped} account(s) in the Unmapped holding class: totals still tie, but the period stays "Draft – mapping incomplete".`, `${unmapped} حساب في الحساب المعلق: الإجماليات متوازنة لكن الفترة تبقى "مسودة – الربط غير مكتمل".`)}</Banner>}

        <Card
          title={L("Mapping grid", "جدول الربط")}
          actions={
            <>
              <button
                disabled={locked || pending === 0}
                className="ghost"
                onClick={() => update({ action: "mapping.confirmSuggestions", entity: "trial_balance_records" }, (c) => ({ ...c, rows: c.rows.map((r) => (r.suggested ? { ...r, suggested: false } : r)) }))}
              >
                {L(`Accept ${pending} suggestion(s)`, `قبول ${pending} اقتراح`)}
              </button>
              <button
                disabled={locked || unmapped > 0 || pending > 0 || balanceIssues.length > 0 || company?.period.mappingConfirmed}
                onClick={() =>
                  update({ action: "mapping.confirmAndLock", entity: "financial_periods" }, (c) => ({ ...c, period: { ...c.period, mappingConfirmed: true, status: c.period.status === "DRAFT" ? "MAPPED" : c.period.status } }))
                }
              >
                {company?.period.mappingConfirmed ? L("Mapping confirmed ✓", "تم تأكيد الربط ✓") : L("Confirm & lock mapping", "تأكيد وقفل الربط")}
              </button>
            </>
          }
        >
          <div className="actions">
            <input placeholder={L("Search code or name…", "ابحث بالكود أو الاسم…")} value={q} onChange={(e) => setQ(e.target.value)} />
            {(["all", "unmapped", "low", "medium", "high"] as const).map((b) => (
              <button key={b} className={band === b ? "chip active" : "chip"} onClick={() => setBand(b)}>
                {{ all: L("All", "الكل"), unmapped: L("Unmapped", "غير مصنف"), low: L("Low <60%", "منخفض"), medium: L("Medium 60–90%", "متوسط"), high: L("High >90%", "مرتفع") }[b]}
              </button>
            ))}
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>{L("Code", "الكود")}</th>
                  <th>{L("Source title", "اسم الحساب")}</th>
                  <th className="num">{L("Ending balance (Dr−Cr)", "الرصيد الختامي")}</th>
                  <th>{L("Target line item", "البند المستهدف")}</th>
                  <th>{L("Confidence", "الثقة")}</th>
                  <th>{L("Rule", "القاعدة")}</th>
                  <th title={L("Balance with another group company, eliminated on consolidation", "رصيد مع شركة أخرى في المجموعة، يستبعد عند التجميع")}>{L("Intercompany", "بين شركات المجموعة")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ r, i }) => {
                  const s = ai.find((a) => a.code === r.code);
                  const bnd = confidenceBand(r.confidence);
                  return (
                    <tr key={`${r.code}-${i}`} className={r.category === "" ? "unmapped" : ""}>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td className="num">{f.n(r.currentDebit - r.currentCredit)}</td>
                      <td>
                        <select disabled={locked} value={r.category} onChange={(e) => setCat(i, e.target.value as Category | "")}>
                          <option value="">{L("— Unmapped (holding) —", "— غير مصنف (معلق) —")}</option>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {catLabel(c)}
                            </option>
                          ))}
                        </select>
                        {s && s.category !== "UNMAPPED" && s.category !== r.category && (
                          <button className="tag" disabled={locked} title={s.rationale} onClick={() => setCat(i, s.category as Category, "ai-suggested-confirmed", s.confidence)}>
                            AI: {catLabel(s.category as Category)} ({s.confidence}%) ✓
                          </button>
                        )}
                      </td>
                      <td>
                        {r.suggested ? (
                          <Pill kind={bnd === "high" ? "good" : bnd === "medium" ? "warn" : "bad"}>
                            {r.confidence ?? "—"}% {L("suggested", "مقترح")}
                          </Pill>
                        ) : r.category ? (
                          <Pill kind="good">{L("confirmed", "مؤكد")}</Pill>
                        ) : (
                          <Pill kind="bad">{L("unmapped", "غير مصنف")}</Pill>
                        )}
                      </td>
                      <td className="muted small">{r.mappingRule ?? "—"}</td>
                      <td className="center">
                        <input
                          type="checkbox"
                          aria-label={L("Intercompany", "بين شركات المجموعة")}
                          checked={isIntercompany(r, company?.intercompanyCodes ?? [])}
                          disabled={locked || (!company?.intercompanyCodes.includes(r.code) && isIntercompany(r, []))}
                          title={isIntercompany(r, []) ? L("Recognised from the account name", "تم التعرف عليه من اسم الحساب") : undefined}
                          onChange={(e) => update({ action: "intercompany.tag", entity: "accounts", recordId: r.code }, (c) => ({ ...c, intercompanyCodes: e.target.checked ? [...new Set([...c.intercompanyCodes, r.code])] : c.intercompanyCodes.filter((x) => x !== r.code) }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="two-col">
          <Card title={L("Bulk mapping rule", "قاعدة ربط جماعية")}>
            <p className="muted small">{L("Map every account whose code starts with a prefix, e.g. 110* → Cash.", "ربط كل الحسابات التي يبدأ كودها ببادئة، مثل 110* ← النقدية.")}</p>
            <div className="actions">
              <input placeholder="110*" value={prefix} onChange={(e) => setPrefix(e.target.value)} style={{ width: 90 }} />
              <select value={ruleCat} onChange={(e) => setRuleCat(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {catLabel(c)}
                  </option>
                ))}
              </select>
              <button
                disabled={locked || !prefix.trim()}
                onClick={() => {
                  const { changed } = applyPrefixRule(rows, prefix, ruleCat);
                  update({ action: "mapping.bulkRule", entity: "trial_balance_records", reason: `${prefix} → ${ruleCat}` }, (c) => ({ ...c, rows: applyPrefixRule(c.rows, prefix, ruleCat).rows, period: { ...c.period, mappingConfirmed: false, status: "DRAFT" } }));
                  setRuleMsg(L(`${changed} account(s) mapped.`, `تم ربط ${changed} حساب.`));
                }}
              >
                {L("Apply rule", "تطبيق القاعدة")}
              </button>
            </div>
            {ruleMsg && <p className="small">{ruleMsg}</p>}
          </Card>
          <Card title={L("AI-assisted mapping", "الربط بمساعدة الذكاء الاصطناعي")}>
            <p className="muted small">
              {L(
                "Sends only account codes, names and balances for unmapped or low-confidence accounts. Suggestions appear beside each row and are applied only when you click them.",
                "يرسل فقط أكواد وأسماء وأرصدة الحسابات غير المصنفة أو منخفضة الثقة. تظهر الاقتراحات بجوار كل سطر ولا تُطبق إلا عند الضغط عليها.",
              )}
            </p>
            <button disabled={locked || aiBusy} onClick={askAi}>
              {aiBusy ? L("Asking…", "جارٍ الطلب…") : L("Suggest mappings with AI", "اقترح الربط بالذكاء الاصطناعي")}
            </button>
            {aiErr && <Banner kind="error">{aiErr}</Banner>}
            {ai.length > 0 && <p className="small">{L(`${ai.length} suggestion(s) received.`, `تم استلام ${ai.length} اقتراح.`)}</p>}
          </Card>
        </div>
        <AiPanel module="mapping" />
      </NeedsData>
    </Page>
  );
}
