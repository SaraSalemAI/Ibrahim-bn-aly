"use client";

import { useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, download, LockNotice, Page, Pill } from "@/components/ui";
import { csvChunks, GL_SPEC, parseGl, type GlLine } from "@/lib/finance/gl";
import { sha256Bytes } from "@/lib/finance/hash";
import { makeT } from "@/lib/i18n";
import { IS_STATIC } from "@/lib/env";
import { DOC_LABELS, TIE_LABELS } from "@/lib/labels";
import { parseCsv, parseTrialBalance, TEMPLATE_HEADER } from "@/lib/finance/parse";
import * as SL from "@/lib/finance/subledgers";
import type { DocCategory, Issue } from "@/lib/finance/types";
import { uid } from "@/lib/workspace/defaults";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";
import type { Company } from "@/lib/workspace/types";

const header = (spec: Record<string, { aliases: string[] }>) => Object.values(spec).map((s) => s.aliases[0]).join(",") + "\n";
const TEMPLATES: Record<DocCategory, { file: string; text: string }> = {
  TRIAL_BALANCE: { file: "trial-balance-template.csv", text: TEMPLATE_HEADER + ",currency\n" },
  GENERAL_LEDGER: { file: "general-ledger-template.csv", text: header(GL_SPEC) },
  AR_SUBLEDGER: { file: "ar-aging-template.csv", text: header(SL.AR_SPEC) },
  AP_SUBLEDGER: { file: "ap-ledger-template.csv", text: header(SL.AP_SPEC) },
  FIXED_ASSETS: { file: "fixed-asset-register-template.csv", text: header(SL.FAR_SPEC) },
  INVENTORY: { file: "inventory-template.csv", text: header(SL.INVENTORY_SPEC) },
  PAYROLL: { file: "payroll-template.csv", text: header(SL.PAYROLL_SPEC) },
  BANK_STATEMENT: { file: "bank-statement-template.csv", text: header(SL.BANK_SPEC) },
  ETA_INVOICE: {
    file: "eta-export-example.json",
    text: JSON.stringify({ documents: [{ uuid: "", internalId: "", issuer: { id: "" }, receiver: { id: "", type: "B" }, documentType: "I", dateTimeIssued: "2025-01-31T00:00:00Z", netAmount: 0, taxTotals: [{ taxType: "T1", amount: 0 }], total: 0 }] }, null, 2),
  },
};

interface Staged {
  category: DocCategory;
  fileName: string;
  sha256: string;
  encoding: string;
  rowCount: number;
  issues: Issue[];
  preview: string[][];
  apply: (c: Company, docId: string) => Company;
}

async function readText(file: File): Promise<{ text: string; bytes: Uint8Array; encoding: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.xlsx$/i.test(file.name)) {
    if (IS_STATIC) throw new Error("Excel files need the full app. In this HTML version, save the sheet as CSV and upload that.");
    const res = await fetch("/api/xlsx", { method: "POST", body: bytes });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Could not read the workbook");
    return { text: await res.text(), bytes, encoding: "xlsx" };
  }
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  // Arabic exports from older Windows ERPs are often Windows-1256 rather than UTF-8.
  if (utf8.includes("�")) return { text: new TextDecoder("windows-1256").decode(bytes), bytes, encoding: "windows-1256" };
  return { text: utf8, bytes, encoding: "utf-8" };
}

async function stage(category: DocCategory, file: File, onProgress: (p: number) => void): Promise<Staged> {
  const { text, bytes, encoding } = await readText(file);
  const base = { category, fileName: file.name, sha256: sha256Bytes(bytes), encoding };
  const csvPreview = () => parseCsv(text.split(/\r?\n/).slice(0, 26).join("\n"));
  switch (category) {
    case "TRIAL_BALANCE": {
      const r = parseTrialBalance(text);
      return { ...base, rowCount: r.rows.length, issues: r.issues, preview: csvPreview(), apply: (c, id) => ({ ...c, rows: r.rows.map((x) => ({ ...x, sourceDocId: id })), period: { ...c.period, mappingConfirmed: false, status: "DRAFT" } }) };
    }
    case "GENERAL_LEDGER": {
      // Large GL dumps are parsed in 5,000-row chunks, yielding to the browser between chunks.
      const lines: GlLine[] = [];
      const issues: Issue[] = [];
      const total = Math.max(1, text.split("\n").length - 1);
      let done = 0;
      for (const chunk of csvChunks(text, 5000)) {
        const r = parseGl(chunk);
        lines.push(...r.records.map((l) => ({ ...l, sourceRow: l.sourceRow + done })));
        issues.push(...r.issues.map((i) => ({ ...i, params: { ...i.params, row: Number(i.params?.row ?? 0) + done } })));
        done += chunk.split("\n").length - 1;
        onProgress(Math.min(1, done / total));
        await new Promise((res) => setTimeout(res, 0));
      }
      return { ...base, rowCount: lines.length, issues: issues.slice(0, 50), preview: csvPreview(), apply: (c) => ({ ...c, subledgers: { ...c.subledgers, gl: lines } }) };
    }
    case "ETA_INVOICE": {
      const r = SL.parseEta(text);
      return {
        ...base,
        rowCount: r.documents.length,
        issues: r.error ? [{ level: "error", code: r.error }] : [],
        preview: [["uuid", "internalId", "type", "date", "netAmount", "vat"], ...r.documents.slice(0, 25).map((d) => [d.uuid, d.internalId, d.type, d.dateIssued, String(d.netAmount), String(d.vat)])],
        apply: (c) => ({ ...c, subledgers: { ...c.subledgers, eta: r.documents } }),
      };
    }
    default: {
      const parsers = { AR_SUBLEDGER: [SL.parseAr, "ar"], AP_SUBLEDGER: [SL.parseAp, "ap"], FIXED_ASSETS: [SL.parseFar, "far"], INVENTORY: [SL.parseInventory, "inventory"], PAYROLL: [SL.parsePayroll, "payroll"], BANK_STATEMENT: [SL.parseBank, "bank"] } as const;
      const [parse, key] = parsers[category];
      const r = parse(text);
      return { ...base, rowCount: r.records.length, issues: r.issues, preview: r.preview, apply: (c) => ({ ...c, subledgers: { ...c.subledgers, [key]: r.records } }) };
    }
  }
}

const ORDER: DocCategory[] = ["TRIAL_BALANCE", "GENERAL_LEDGER", "AR_SUBLEDGER", "AP_SUBLEDGER", "FIXED_ASSETS", "INVENTORY", "PAYROLL", "BANK_STATEMENT", "ETA_INVOICE"];

export default function IngestPage() {
  const { ws, company, computed, update, locked } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { issue } = makeT(ws.lang);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState("");

  if (!company) return <Page title={L("2 · Ingestion center", "٢ · مركز إدخال البيانات")}><Banner kind="info">{L("Create a company first.", "أنشئ شركة أولًا.")}</Banner></Page>;

  const onFile = async (category: DocCategory, file?: File) => {
    if (!file) return;
    setErr("");
    setProgress(category === "GENERAL_LEDGER" ? 0 : null);
    try {
      setStaged(await stage(category, file, setProgress));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const commit = () => {
    if (!staged) return;
    const id = uid("doc");
    update({ action: "source.upload", entity: "source_documents", recordId: id }, (c) => {
      const next = staged.apply(c, id);
      const docs = [...c.docs.filter((d) => d.category !== staged.category), { id, fileName: staged.fileName, sha256: staged.sha256, category: staged.category, rowCount: staged.rowCount, encoding: staged.encoding, uploadedAt: new Date().toISOString() }];
      return { ...next, docs };
    });
    setStaged(null);
  };

  const hasErrors = staged?.issues.some((i) => i.level === "error");
  const t = computed?.analysis ? computed.tieOuts : null;
  const sl = computed?.analysis ? computed.subledgers : null;

  return (
    <Page title={L("2 · Ingestion center", "٢ · مركز إدخال البيانات")} subtitle={L("Trial balance, general ledger, subledgers, bank statements and ETA e-invoices. CSV or Excel; UTF-8 or Windows-1256 Arabic.", "ميزان المراجعة ودفتر الأستاذ والدفاتر التحليلية وكشوف البنوك والفواتير الإلكترونية. CSV أو Excel؛ ترميز UTF-8 أو Windows-1256.")}>
      <LockNotice />
      {err && <Banner kind="error">{err}</Banner>}
      <div className="ingest-grid">
        {ORDER.map((cat) => {
          const doc = company.docs.find((d) => d.category === cat);
          return (
            <Card key={cat} title={L(...DOC_LABELS[cat])} className="ingest-card">
              {doc ? (
                <p className="small">
                  <Pill kind="good">✓</Pill> {doc.fileName} · {doc.rowCount} {L("rows", "سطر")}
                  <br />
                  <span className="muted mono" title={doc.sha256}>SHA-256 {doc.sha256.slice(0, 16)}…</span> · <span className="muted">{doc.encoding}</span>
                </p>
              ) : (
                <p className="muted small">{L("Not loaded", "لم يتم التحميل")}</p>
              )}
              <div className="actions">
                <label className={`button ${locked ? "disabled" : ""}`}>
                  {L("Upload", "رفع")}
                  <input type="file" hidden disabled={locked} accept={cat === "ETA_INVOICE" ? ".json,.xml" : ".csv,.txt,.xlsx"} onChange={(e) => onFile(cat, e.target.files?.[0])} />
                </label>
                {!IS_STATIC && (
                  <button className="ghost" onClick={() => download(TEMPLATES[cat].file, "\uFEFF" + TEMPLATES[cat].text, cat === "ETA_INVOICE" ? "application/json" : undefined)}>
                    {L("Template", "نموذج")}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {progress !== null && (
        <Card title={L("Parsing general ledger…", "جارٍ قراءة دفتر الأستاذ…")}>
          <progress value={progress} max={1} style={{ width: "100%" }} />
        </Card>
      )}

      {staged && (
        <Card
          title={`${L("Preview", "معاينة")}: ${staged.fileName}`}
          actions={
            <>
              <button onClick={commit} disabled={hasErrors}>
                {L("Accept and load", "قبول وتحميل")}
              </button>
              <button className="ghost" onClick={() => setStaged(null)}>
                {L("Discard", "تجاهل")}
              </button>
            </>
          }
        >
          <p className="small">
            {L(...DOC_LABELS[staged.category])} · {staged.rowCount} {L("rows", "سطر")} · {staged.encoding} · <span className="mono">SHA-256 {staged.sha256}</span>
          </p>
          {staged.issues.length > 0 && (
            <ul className="issues">
              {staged.issues.map((i, k) => (
                <li key={k} className={i.level}>
                  {issue(i, f.n)}
                </li>
              ))}
            </ul>
          )}
          <div className="scroll">
            <table className="compact">
              <tbody>
                {staged.preview.map((r, i) => (
                  <tr key={i} className={i === 0 ? "head-row" : ""}>
                    {r.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">{L("Showing the first 25 rows.", "عرض أول ٢٥ سطرًا.")}</p>
        </Card>
      )}

      {t && sl && (
        <Card title={L("Cross-reconciliation", "المطابقة بين المصادر")}>
          <table>
            <thead>
              <tr>
                <th>{L("Check", "الفحص")}</th>
                <th className="num">{L("Subledger", "الدفتر التحليلي")}</th>
                <th className="num">{L("Trial balance", "الميزان")}</th>
                <th className="num">{L("Difference", "الفرق")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Object.entries(t).map(([k, v]) => (
                <tr key={k}>
                  <td>{L(...TIE_LABELS[k])}</td>
                  {v ? (
                    <>
                      <td className="num">{f.n(v.subledger)}</td>
                      <td className="num">{f.n(v.trialBalance)}</td>
                      <td className={`num ${v.ties ? "good" : "bad"}`}>{f.n(v.difference)}</td>
                      <td>{v.ties ? <Pill kind="good">{L("ties", "مطابق")}</Pill> : <Pill kind="bad">{L("break", "فرق")}</Pill>}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="muted">{L("Not loaded", "لم يتم التحميل")}</td>
                  )}
                </tr>
              ))}
              <tr>
                <td>{L("GL activity vs TB movement", "حركة الأستاذ مقابل حركة الميزان")}</td>
                {sl.gl ? (
                  <td colSpan={4}>
                    {sl.gl.lines} {L("lines", "سطر")} · {sl.gl.vsTb.exceptions} {L("account differences", "فروق حسابات")} · {sl.gl.unbalanced.length} {L("unbalanced journals", "قيود غير متوازنة")} · {sl.gl.vsTb.glOnly.length} {L("GL-only accounts", "حسابات في الأستاذ فقط")}
                  </td>
                ) : (
                  <td colSpan={4} className="muted">{L("Not loaded", "لم يتم التحميل")}</td>
                )}
              </tr>
              <tr>
                <td>{L("Bank reconciliation", "التسوية البنكية")}</td>
                {sl.bank ? (
                  <td colSpan={4}>
                    {L("Statement", "الكشف")} {f.n(sl.bank.statementBalance)} · {L("book", "الدفاتر")} {f.n(sl.bank.bookBalance)} · {L("unpresented cheques", "شيكات لم تُصرف")} {f.n(sl.bank.unpresentedCheques)} · {L("deposits in transit", "إيداعات بالطريق")} {f.n(sl.bank.depositsInTransit)} · {L("bank items not in books", "بنود بنكية غير مسجلة")} {f.n(sl.bank.bankItemsNotInBooks)} ·{" "}
                    <strong className={sl.bank.difference === 0 ? "good" : "bad"}>
                      {L("difference", "الفرق")} {f.n(sl.bank.difference)}
                    </strong>
                    {!sl.gl && <span className="muted"> ({L("load the GL to match book entries", "حمّل الأستاذ لمطابقة القيود")})</span>}
                  </td>
                ) : (
                  <td colSpan={4} className="muted">{L("Not loaded", "لم يتم التحميل")}</td>
                )}
              </tr>
            </tbody>
          </table>
          {sl.eta && (
            <Banner kind={sl.eta.difference === 0 ? "ok" : "warning"}>
              {L("ETA", "منظومة الفاتورة")}: {sl.eta.count} {L("documents", "مستند")}, {L("net sales", "صافي المبيعات")} {f.n(sl.eta.netSales)}, VAT {f.n(sl.eta.vat)}. {L("GL revenue exceeds ETA submissions by", "الإيرادات بالدفاتر تزيد عن المقدم للمنظومة بمقدار")} {f.n(sl.eta.difference)} — {L("check for unsubmitted invoices or unrecorded sales.", "راجع الفواتير غير المقدمة أو المبيعات غير المسجلة.")}
              {sl.eta.vatRateExceptions.length > 0 && ` ${L("VAT rate exceptions", "استثناءات سعر الضريبة")}: ${sl.eta.vatRateExceptions.map((v) => `${v.id} (${v.rate}%)`).join(", ")}.`}
              {sl.eta.invalidReceiverTaxId.length > 0 && ` ${L("Invalid receiver tax IDs", "أرقام ضريبية غير صحيحة")}: ${sl.eta.invalidReceiverTaxId.join(", ")}.`}
              {sl.eta.duplicates.length > 0 && ` ${L("Duplicate UUIDs", "معرفات مكررة")}: ${sl.eta.duplicates.join(", ")}.`}
            </Banner>
          )}
          <p className="muted small">
            {L(
              "Direct ETA API submission needs an e-token (USB/HSM) signing adapter and API credentials; it is not configured here. Offline ETA exports are fully supported.",
              "الربط المباشر مع واجهة منظومة الفاتورة يتطلب توقيعًا بالتوكن (USB/HSM) وبيانات اعتماد؛ غير مُعد هنا. ملفات التصدير من المنظومة مدعومة بالكامل.",
            )}
          </p>
        </Card>
      )}
      <AiPanel module="ingest" />
    </Page>
  );
}
