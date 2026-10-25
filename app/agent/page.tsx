"use client";

import { useEffect, useRef, useState } from "react";
import { aiStatus } from "@/components/AiPanel";
import { BulkUpload } from "@/components/BulkUpload";
import { ValidationReport } from "@/components/ValidationReport";
import { Markdown } from "@/components/Markdown";
import { Banner, Card, Collapsible, NeedsData, Page, Pill } from "@/components/ui";
import { AGENT_SUGGESTIONS } from "@/lib/agent/prompt";
import { IS_STATIC } from "@/lib/env";
import { answerOffline } from "@/lib/agent/offline";
import type { AgentEvent } from "@/lib/agent/tools";
import type { Category } from "@/lib/finance/types";
import { makeT } from "@/lib/i18n";
import { listInbox, markImported } from "@/lib/sync/supabase";
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
  const [tab, setTab] = useState<"files" | "chat">("files");
  const [attached, setAttached] = useState<File[] | null>(null);
  const [askAfterImport, setAskAfterImport] = useState(false);
  const [inbox, setInbox] = useState<{ busy: boolean; note: string }>({ busy: false, note: "" });
  const clip = useRef<HTMLInputElement | null>(null);
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
    get_upload_report: L("Read upload report", "قراءة تقرير الرفع"),
    get_validation_report: L("Run validation rules", "تشغيل قواعد التحقق"),
    get_cash_forecast: L("Read 13-week cash forecast", "قراءة توقع النقدية ١٣ أسبوعًا"),
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

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

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

  const checkInbox = async () => {
    const sync = ws.sync;
    if (!sync?.accessToken) return;
    setInbox({ busy: true, note: "" });
    try {
      const items = await listInbox(sync);
      if (!items.length) {
        setInbox({ busy: false, note: L("No new files in the email inbox.", "لا توجد ملفات جديدة في صندوق البريد.") });
        return;
      }
      const files = items.map((it) => {
        const bin = atob(it.content_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], it.file_name, { type: it.content_type ?? "application/octet-stream" });
      });
      await markImported(sync, items.map((it) => it.id));
      setAttached(files);
      setInbox({ busy: false, note: L(`${files.length} file(s) from email: ${[...new Set(items.map((i) => i.sender).filter(Boolean))].join(", ")}`, `${files.length} ملف من البريد: ${[...new Set(items.map((i) => i.sender).filter(Boolean))].join("، ")}`) });
    } catch (e) {
      setInbox({ busy: false, note: (e as Error).message });
    }
  };

  const reviewQuestion = L(
    "Review the files I just uploaded: what was imported, what was held back, which validation rules fail and what should I fix first?",
    "راجع الملفات التي رفعتها: ما الذي تم استيراده، وما الذي تم تعليقه، وأي قواعد تحقق فشلت، وبماذا أبدأ؟",
  );
  const onPipeline = () => {
    if (!askAfterImport) return;
    setAskAfterImport(false);
    setTab("chat");
    // Send from the latest render, once the imported company has reached the store.
    setTimeout(() => sendRef.current(reviewQuestion), 400);
  };

  return (
    <Page
      title={L("AI CFO agent", "وكيل المدير المالي الذكي")}
      subtitle={L(
        "Ask about this company's books. The agent calls the app's calculation tools for every figure, runs what-ifs without saving them, and drafts adjustments that you approve.",
        "اسأل عن دفاتر هذه الشركة. يستدعي الوكيل أدوات الحساب في التطبيق لكل رقم، ويشغل السيناريوهات دون حفظها، ويقترح تسويات توافق عليها أنت.",
      )}
      actions={
        tab === "chat" && msgs.length > 0 && (
          <button className="ghost" disabled={busy} onClick={() => setMsgs([])}>
            {L("New conversation", "محادثة جديدة")}
          </button>
        )
      }
    >
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "files"} className={tab === "files" ? "tab active" : "tab"} onClick={() => setTab("files")}>
          📎 {L("Uploaded files", "الملفات المرفوعة")}
          {company && company.importRuns.length > 0 && <span className="muted small"> ({company.docs.length})</span>}
        </button>
        <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "tab active" : "tab"} onClick={() => setTab("chat")}>
          💬 {L("Ask the agent", "اسأل الوكيل")}
        </button>
      </div>
      {tab === "files" && (
        <>
          <p className="muted small">
            {L(
              "Drop every file you have: trial balances, ledgers, subledgers, bank statements, e-invoices, Excel, CSV, PDF, Word, ZIP. The agent reads and recognises each one, imports what it is sure of, maps the accounts, runs every validation rule and tells you what needs your attention.",
              "اسحب كل ملفاتك: موازين المراجعة ودفاتر الأستاذ والدفاتر التحليلية وكشوف البنوك والفواتير الإلكترونية وExcel وCSV وPDF وWord وZIP. يقرأ الوكيل كل ملف ويتعرف عليه، ويستورد ما هو متأكد منه، ويربط الحسابات، ويشغل كل قواعد التحقق، ويخبرك بما يحتاج انتباهك.",
            )}
          </p>
          {ws.sync?.accessToken && (
            <div className="actions small">
              <button className="ghost" disabled={inbox.busy} onClick={checkInbox}>
                ✉ {inbox.busy ? L("Checking…", "جارٍ الفحص…") : L("Check email inbox", "فحص صندوق البريد")}
              </button>
              <span className="muted">
                {L("Files mailed to", "الملفات المرسلة إلى")} <code>tb+{ws.sync.workspaceKey}@…</code> {inbox.note && `· ${inbox.note}`}
              </span>
            </div>
          )}
          <BulkUpload incoming={attached} onIncomingDone={() => setAttached(null)} onPipeline={onPipeline} />
          {company && company.rows.length > 0 && (
            <div className="actions">
              <button
                onClick={() => {
                  setTab("chat");
                  send(reviewQuestion);
                }}
                disabled={busy}
              >
                {L("Ask the agent about these files", "اسأل الوكيل عن هذه الملفات")}
              </button>
            </div>
          )}
          <ValidationReport compact />
          {company && company.importRuns.length > 0 && (
            <Card title={L("Upload history", "سجل الرفع")}>
              <table className="compact">
                <thead>
                  <tr>
                    <th>{L("When", "الوقت")}</th>
                    <th>{L("By", "بواسطة")}</th>
                    <th>{L("Files", "الملفات")}</th>
                    <th className="num">{L("Auto-mapped", "ربط تلقائي")}</th>
                    <th className="num">{L("To map", "للربط")}</th>
                    <th>{L("Status", "الحالة")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...company.importRuns].reverse().map((r) => (
                    <tr key={r.id}>
                      <td className="small">{r.at.slice(0, 16).replace("T", " ")}</td>
                      <td className="small">{r.by}</td>
                      <td className="small">
                        {r.files.map((x) => x.name).join(", ")}
                        {r.held.length > 0 && <div className="warn-text">{L("held", "معلق")}: {r.held.map((h) => h.name).join(", ")}</div>}
                      </td>
                      <td className="num">{r.autoMapped}</td>
                      <td className="num">{r.stillToMap}</td>
                      <td><Pill>{r.statusAfter}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
      {tab === "chat" && (
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
          <button type="button" className="ghost" title={L("Attach files: they are read, imported and validated, then the agent reviews them", "إرفاق ملفات: تتم قراءتها واستيرادها والتحقق منها ثم يراجعها الوكيل")} aria-label={L("Attach files", "إرفاق ملفات")} disabled={busy} onClick={() => clip.current?.click()}>
            📎
          </button>
          <input
            ref={clip}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files ? [...e.target.files] : [];
              e.target.value = "";
              if (!files.length) return;
              setAskAfterImport(true);
              setAttached(files);
              setTab("files");
            }}
          />
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
      )}
    </Page>
  );
}
