"use client";

import { useEffect, useRef, useState } from "react";
import type { ModuleId } from "@/lib/ai/facts";
import { useL, useWorkspace } from "@/lib/workspace/store";
import type { Company } from "@/lib/workspace/types";
import { Banner, Card } from "./ui";
import { Markdown } from "./Markdown";

let statusCache: Promise<{ configured: boolean; model: string }> | null = null;
export function aiStatus() {
  statusCache ??= fetch("/api/explain")
    .then((r) => r.json())
    .catch(() => ({ configured: false, model: "" }));
  return statusCache;
}

const GL_LIMIT = 20000;

/** Strips bulky raw data the facts for this module do not need, keeping the request small. */
export function payloadCompany(c: Company, module: ModuleId): Company {
  const keepGl = module === "ingest" && c.subledgers.gl.length <= GL_LIMIT;
  return { ...c, subledgers: { ...c.subledgers, gl: keepGl ? c.subledgers.gl : [], bank: module === "ingest" ? c.subledgers.bank : [] } };
}

export function AiPanel({ module, title }: { module: ModuleId; title?: string }) {
  const { ws, company } = useWorkspace();
  const L = useL();
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    aiStatus().then(setStatus);
    return () => abort.current?.abort();
  }, []);

  if (!company || company.rows.length === 0) return null;

  const run = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setText("");
    setError("");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          module,
          language: ws.lang,
          company: payloadCompany(company, module),
          peers: module === "benchmarking" ? ws.companies.filter((p) => p.id !== company.id).map((p) => ({ ...p, subledgers: { ...p.subledgers, gl: [], bank: [] } })) : [],
          benchmarks: module === "benchmarking" ? ws.benchmarks : {},
          audit: module === "audit" ? ws.audit.slice(-5000) : [],
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "notConfigured") setStatus((s) => ({ model: s?.model ?? "", configured: false }));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={title ?? L("AI explanation", "الشرح بالذكاء الاصطناعي")} className="ai-card">
      {status && !status.configured && (
        <Banner kind="warning">
          {L(
            "AI Gateway is not configured on the server. Set AI_GATEWAY_API_KEY (or deploy on Vercel with OIDC). Every calculation in the app works without it.",
            "لم يتم إعداد AI Gateway على الخادم. اضبط AI_GATEWAY_API_KEY (أو انشر على Vercel مع OIDC). كل الحسابات تعمل بدونه.",
          )}
        </Banner>
      )}
      <div className="actions">
        <button onClick={run} disabled={busy || status?.configured === false}>
          {busy ? L("Explaining…", "جارٍ الشرح…") : L("Explain in plain language", "اشرح بلغة مبسطة")}
        </button>
        {busy && (
          <button className="ghost" onClick={() => abort.current?.abort()}>
            {L("Stop", "إيقاف")}
          </button>
        )}
        {status?.model && <span className="muted small">{L("Model", "النموذج")}: {status.model}</span>}
      </div>
      {error && <Banner kind="error">{L("The AI request failed:", "فشل طلب الذكاء الاصطناعي:")} {error}</Banner>}
      {text && (
        <div className="ai-output" dir={ws.lang === "ar" ? "rtl" : "ltr"}>
          <Markdown text={text} />
        </div>
      )}
      <p className="muted small">
        {L(
          "The server recomputes this module from your data and sends the model only those figures, with instructions not to invent numbers. Review before sharing; this is not audit, tax or investment advice.",
          "يعيد الخادم حساب هذه الوحدة من بياناتك ويرسل للنموذج هذه الأرقام فقط مع تعليمات بعدم اختراع أي رقم. راجع النص قبل مشاركته؛ هذا ليس رأي مراجعة أو استشارة ضريبية أو استثمارية.",
        )}
      </p>
    </Card>
  );
}
