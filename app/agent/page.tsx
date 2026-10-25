"use client";

import { useEffect, useRef, useState } from "react";
import { aiStatus } from "@/components/AiPanel";
import { Markdown } from "@/components/Markdown";
import { Banner, Card, Collapsible, NeedsData, Page, Pill } from "@/components/ui";
import { AGENT_SUGGESTIONS } from "@/lib/agent/prompt";
import { IS_STATIC } from "@/lib/env";
import { answerOffline } from "@/lib/agent/offline";
import type { AgentEvent } from "@/lib/agent/tools";
import type { Category } from "@/lib/finance/types";
import { makeT } from "@/lib/i18n";
import { uid } from "@/lib/workspace/defaults";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";
import type { Company } from "@/lib/workspace/types";

interface ToolTrace {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
}
interface AjeProposal {
  type: "aje";
  reason: string;
  lines: Array<{ code: string; name: string; category: Category | ""; debit: number; credit: number; newAccount: boolean }>;
}
interface MappingProposal {
  type: "mapping";
  code: string;
  name: string;
  from: string;
  to: Category;
  rationale: string;
}
type Proposal = (AjeProposal | MappingProposal) & { status?: "applied" | "dismissed"; impact?: Record<string, { before: number; after: number } | number> };
interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: ToolTrace[];
  proposals?: Proposal[];
  error?: string;
}

const storageKey = (id: string) => `ai-cfo-agent-${id}`;

function stripForAgent(c: Company): Company {
  return { ...c, subledgers: { ...c.subledgers, gl: c.subledgers.gl.length <= 20000 ? c.subledgers.gl : [] } };
}

export default function AgentPage() {
  const { ws, company, update } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { category } = makeT(ws.lang);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const companyId = company?.id;

  useEffect(() => {
    aiStatus().then(setStatus);
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    let saved: Msg[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKey(companyId)) ?? "[]");
    } catch {
      saved = [];
    }
    setMsgs(saved);
  }, [companyId]);

  useEffect(() => {
    if (!companyId || busy) return;
    try {
      localStorage.setItem(storageKey(companyId), JSON.stringify(msgs.slice(-40)));
    } catch {
      /* storage unavailable: the conversation stays in memory */
    }
  }, [msgs, companyId, busy]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const toolLabel: Record<string, string> = {
    get_overview: L("Read overview", "قراءة الملخص"),
    get_statement: L("Read statement", "قراءة القائمة"),
    get_variances: L("Read variances", "قراءة الانحرافات"),
    get_ratios: L("Read ratios", "قراءة النسب"),
    find_accounts: L("Search accounts", "بحث في الحسابات"),
    get_subledger: L("Read subledger", "قراءة الدفتر التحليلي"),
    get_tax_computation: L("Read tax computation", "قراءة احتساب الضريبة"),
    run_forecast: L("Run forecast what-if", "تشغيل سيناريو التنبؤ"),
    run_sensitivity: L("Run sensitivity", "تشغيل الحساسية"),
    run_valuation: L("Run valuation", "تشغيل التقييم"),
    run_stress_test: L("Run stress test", "تشغيل اختبار الضغط"),
    get_budget_vs_actual: L("Read budget vs actual", "قراءة الموازنة مقابل الفعلي"),
    get_disclosures: L("Read disclosures", "قراءة الإفصاحات"),
    compare_peers: L("Compare peers", "مقارنة الشركات"),
    get_close_review: L("Close review", "مراجعة الإقفال"),
    search_gl: L("Search the general ledger", "البحث في دفتر الأستاذ"),
    get_top_counterparties: L("Top customers / suppliers", "أكبر العملاء / الموردين"),
    get_trends: L("Monthly trends", "الاتجاهات الشهرية"),
    get_consolidation: L("Group consolidation", "القوائم المجمعة"),
    get_period_history: L("Closed periods and board packs", "الفترات المقفلة وحزم المجلس"),
    propose_adjusting_entry: L("Draft adjusting entry", "اقتراح قيد تسوية"),
    propose_mapping_change: L("Draft mapping change", "اقتراح تعديل ربط"),
  };

  const send = async (text: string) => {
    if (!company || !text.trim() || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs([...history, { role: "assistant", content: "", tools: [], proposals: [] }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const patch = (fn: (m: Msg) => Msg) => setMsgs((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);
    if (status?.configured === false) {
      // No model available: answer from the built-in queries instead.
      try {
        const r = await answerOffline(text.trim(), company, ws.companies.filter((p) => p.id !== company.id), ws.groups, ws.lang);
        patch((m) => ({ ...m, content: r.text, tools: r.calls }));
      } catch (err) {
        patch((m) => ({ ...m, error: (err as Error).message }));
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          company: stripForAgent(company),
          peers: ws.companies.filter((p) => p.id !== company.id).map((p) => ({ ...p, subledgers: { ...p.subledgers, gl: [], bank: [] }, boardPacks: [], history: [] })),
          groups: ws.groups,
          messages: history.filter((m) => m.content.trim()).slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "notConfigured") setStatus((s) => ({ model: s?.model ?? "", configured: false }));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AgentEvent;
          if (e.type === "text") patch((m) => ({ ...m, content: m.content + e.text }));
          else if (e.type === "tool-call") patch((m) => ({ ...m, tools: [...(m.tools ?? []), { id: e.id, name: e.name, input: e.input }] }));
          else if (e.type === "tool-result")
            patch((m) => {
              const out = e.output as { proposal?: Proposal | null; impact?: Proposal["impact"] } | null;
              const proposals = out?.proposal ? [...(m.proposals ?? []), { ...out.proposal, impact: out.impact }] : m.proposals;
              return { ...m, proposals, tools: (m.tools ?? []).map((t) => (t.id === e.id ? { ...t, output: e.output } : t)) };
            });
          else if (e.type === "tool-error") patch((m) => ({ ...m, tools: (m.tools ?? []).map((t) => (t.id === e.id ? { ...t, error: e.error } : t)) }));
          else if (e.type === "error") patch((m) => ({ ...m, error: e.message }));
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") patch((m) => ({ ...m, error: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const setProposalStatus = (mi: number, pi: number, st: "applied" | "dismissed") =>
    setMsgs((prev) => prev.map((m, i) => (i === mi ? { ...m, proposals: m.proposals?.map((p, j) => (j === pi ? { ...p, status: st } : p)) } : m)));

  const apply = (mi: number, pi: number, p: Proposal) => {
    if (p.type === "aje") {
      const id = `AJE-AI-${uid("").slice(1, 7)}`;
      update(
        { action: "aje.post", entity: "adjusting_journal_entries", recordId: id, reason: `${p.reason} (drafted by AI agent, approved by ${ws.profile.name})` },
        (c) => ({ ...c, ajes: [...c.ajes, { id, date: c.period.end, reason: p.reason, author: `${ws.profile.name} (AI draft)`, kind: "AJE", lines: p.lines.map(({ code, name, category: cat, debit, credit }) => ({ code, name, category: cat, debit, credit })) }] }),
        { allowWhenLocked: true },
      );
    } else {
      update({ action: "mapping.override", entity: "trial_balance_records", recordId: p.code, reason: `AI agent suggestion: ${p.rationale}` }, (c) => ({
        ...c,
        rows: c.rows.map((r) => (r.code === p.code ? { ...r, category: p.to, suggested: false, mappingRule: "ai-agent-approved", confidence: 100 } : r)),
        period: { ...c.period, mappingConfirmed: false, status: "DRAFT" },
      }));
    }
    setProposalStatus(mi, pi, "applied");
  };

  return (
    <Page
      title={L("AI CFO agent", "وكيل المدير المالي الذكي")}
      subtitle={L(
        "Ask about this company's books. The agent calls the app's calculation tools for every figure, runs what-ifs without saving them, and drafts adjustments that you approve.",
        "اسأل عن دفاتر هذه الشركة. يستدعي الوكيل أدوات الحساب في التطبيق لكل رقم، ويشغل السيناريوهات دون حفظها، ويقترح تسويات توافق عليها أنت.",
      )}
      actions={
        msgs.length > 0 && (
          <button className="ghost" disabled={busy} onClick={() => setMsgs([])}>
            {L("New conversation", "محادثة جديدة")}
          </button>
        )
      }
    >
      <NeedsData>
        {status && !status.configured && (
          <Banner kind="warning">
            {IS_STATIC
              ? L("Offline mode: the AI agent runs on the server, so here your questions are answered by the same built-in queries, shown as tables without AI interpretation. Ask about customers, suppliers, journal entries (put a search term in quotes), the close review, trends, tax, ratios or the group.", "وضع بدون اتصال: الوكيل يعمل على الخادم، لذا تتم الإجابة هنا بنفس الاستعلامات المدمجة كجداول بدون تفسير. اسأل عن العملاء أو الموردين أو القيود (ضع كلمة البحث بين علامتي تنصيص) أو مراجعة الإقفال أو الاتجاهات أو الضريبة أو النسب أو المجموعة.")
              : L("AI Gateway is not configured on the server, so the agent answers in offline mode from the built-in queries. Set AI_GATEWAY_API_KEY (or deploy on Vercel with OIDC) for full answers.", "لم يتم إعداد AI Gateway، فيجيب الوكيل بوضع بدون اتصال من الاستعلامات المدمجة. اضبط AI_GATEWAY_API_KEY للإجابات الكاملة.")}
          </Banner>
        )}
        {msgs.length === 0 && (
          <Card title={L("Try asking", "جرّب أن تسأل")}>
            <div className="suggestions">
              {AGENT_SUGGESTIONS.map(([en, ar]) => (
                <button key={en} className="chip" disabled={busy} onClick={() => send(L(en, ar))}>
                  {L(en, ar)}
                </button>
              ))}
            </div>
          </Card>
        )}
        <div className="chat">
          {msgs.map((m, mi) => (
            <div key={mi} className={`msg msg-${m.role}`} dir="auto">
              {m.role === "user" ? (
                <div className="bubble">{m.content}</div>
              ) : (
                <div className="bubble">
                  {m.tools && m.tools.length > 0 && (
                    <div className="tool-trace">
                      {m.tools.map((t) => (
                        <Collapsible
                          key={t.id}
                          title={
                            <>
                              {t.error ? "⚠" : t.output !== undefined ? "✓" : "…"} {toolLabel[t.name] ?? t.name}
                            </>
                          }
                        >
                          <pre className="tool-json">{JSON.stringify({ input: t.input, ...(t.error ? { error: t.error } : { output: t.output }) }, null, 1).slice(0, 4000)}</pre>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                  {m.content ? <Markdown text={m.content} /> : busy && mi === msgs.length - 1 && <p className="muted">{L("Working…", "جارٍ العمل…")}</p>}
                  {m.proposals?.map((p, pi) => (
                    <div key={pi} className="proposal">
                      <div className="card-head">
                        <strong>{p.type === "aje" ? L("Proposed adjusting entry", "قيد تسوية مقترح") : L("Proposed mapping change", "تعديل ربط مقترح")}</strong>
                        {p.status === "applied" ? <Pill kind="good">{L("applied", "تم التطبيق")}</Pill> : p.status === "dismissed" ? <Pill>{L("dismissed", "تم التجاهل")}</Pill> : <Pill kind="warn">{L("needs your approval", "يحتاج موافقتك")}</Pill>}
                      </div>
                      {p.type === "aje" ? (
                        <>
                          <p className="small">{p.reason}</p>
                          <table className="compact">
                            <tbody>
                              {p.lines.map((l, li) => (
                                <tr key={li}>
                                  <td>
                                    {l.code} {l.name} {l.newAccount && <Pill kind="info">{L("new account", "حساب جديد")}</Pill>}
                                  </td>
                                  <td className="num">{l.debit ? `Dr ${f.n(l.debit)}` : ""}</td>
                                  <td className="num">{l.credit ? `Cr ${f.n(l.credit)}` : ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {p.impact && typeof p.impact.netProfit === "object" && (
                            <p className="small muted">
                              {L("Net profit", "صافي الربح")}: {f.n(p.impact.netProfit.before)} → {f.n(p.impact.netProfit.after)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="small">
                          {p.code} {p.name}: {p.from === "UNMAPPED" ? L("Unmapped", "غير مصنف") : category(p.from as Category)} → <strong>{category(p.to)}</strong>
                          <br />
                          <span className="muted">{p.rationale}</span>
                        </p>
                      )}
                      {!p.status && (
                        <div className="actions">
                          <button onClick={() => apply(mi, pi, p)}>{p.type === "aje" ? L("Post entry", "ترحيل القيد") : L("Apply mapping", "تطبيق الربط")}</button>
                          <button className="ghost" onClick={() => setProposalStatus(mi, pi, "dismissed")}>
                            {L("Dismiss", "تجاهل")}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {m.error && <Banner kind="error">{L("The agent request failed:", "فشل طلب الوكيل:")} {m.error}</Banner>}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            dir="auto"
            rows={2}
            value={input}
            placeholder={L("Ask the AI CFO… (Enter to send, Shift+Enter for a new line)", "اسأل المدير المالي الذكي… (Enter للإرسال)")}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          {busy ? (
            <button type="button" className="ghost" onClick={() => abort.current?.abort()}>
              {L("Stop", "إيقاف")}
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()}>
              {L("Send", "إرسال")}
            </button>
          )}
        </form>
        <p className="muted small">
          {L(
            "The agent only reads this company's data through calculation tools, never invents figures, and cannot change anything without your click. Not audit, tax or investment advice.",
            "يقرأ الوكيل بيانات الشركة فقط عبر أدوات الحساب، ولا يخترع أرقامًا، ولا يغير شيئًا دون موافقتك. ليس رأي مراجعة أو استشارة ضريبية أو استثمارية.",
          )}
          {status?.model && ` · ${L("Model", "النموذج")}: ${status.model}`}
        </p>
      </NeedsData>
    </Page>
  );
}
