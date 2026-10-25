"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IS_STATIC } from "@/lib/env";
import { makeT } from "@/lib/i18n";
import { DOC_LABELS, TIE_LABELS } from "@/lib/labels";
import { autoAdvance, autoEligible, remembered, runPipeline } from "@/lib/ingest/auto";
import { ALL_CATEGORIES, batchChecks, UNLOCKS, type BatchItem } from "@/lib/ingest/checks";
import { allFields, requiredFields, type CsvCategory } from "@/lib/ingest/erp";
import { applyStaged, expandFiles, stageUnit, type Staged, type TbRole, type Unit } from "@/lib/ingest/stage";
import type { DocCategory } from "@/lib/finance/types";
import { toRun, validateCompany } from "@/lib/ingest/validate";
import { computeCompany } from "@/lib/workspace/compute";
import { uid } from "@/lib/workspace/defaults";
import { newCompany, useFormat, useL, useWorkspace } from "@/lib/workspace/store";
import type { Automation, Company, ImportRun } from "@/lib/workspace/types";
import { aiStatus } from "./AiPanel";
import { Banner, Card, Pill } from "./ui";

interface Row {
  unit: Unit;
  category: DocCategory | null;
  role: TbRole;
  month: { label: string; end: string } | null;
  staged: Staged | null;
  error: string;
  include: boolean;
  busy: boolean;
  progress: number | null;
}

const PRIOR_NAME = /(prior|previous|comparative|last[ _-]?year|\bly\b|سابق|المقارن)/i;

function defaultRoles(rows: Row[], hasCurrentTb: boolean): Row[] {
  const tbs = rows.filter((r) => r.category === "TRIAL_BALANCE");
  const dated = tbs.filter((r) => r.unit.month);
  return rows.map((r) => {
    if (r.category !== "TRIAL_BALANCE") return r;
    if (PRIOR_NAME.test(r.unit.fileName + (r.unit.sheet ?? ""))) return { ...r, role: "prior" };
    if (dated.length >= 2 && r.unit.month) return { ...r, role: "monthly", month: r.unit.month };
    if (hasCurrentTb && tbs.length === 1 && r.unit.month) return { ...r, role: "monthly", month: r.unit.month };
    return { ...r, role: "current" };
  });
}

type Phase = "reading" | "detecting" | "importing" | "mapping" | "validating" | "done";
const PHASES: Array<[Phase, string, string]> = [
  ["reading", "Reading files", "قراءة الملفات"],
  ["detecting", "Recognising and extracting", "التعرف والاستخراج"],
  ["importing", "Importing", "الاستيراد"],
  ["mapping", "Mapping accounts", "ربط الحسابات"],
  ["validating", "Validating", "التحقق"],
];

/** Applies the AI's account suggestions: confident ones are accepted, the rest wait for review. Never overrides a confirmed mapping. */
function applyAiMappings(c: Company, mappings: Array<{ code: string; category: string; confidence: number }>, threshold: number, runId: string) {
  let accepted = 0;
  let suggested = 0;
  const byCode = new Map(mappings.filter((m) => m.category !== "UNMAPPED").map((m) => [m.code, m]));
  const rows = c.rows.map((r) => {
    const m = byCode.get(r.code);
    if (!m || (r.category && !r.suggested)) return r;
    if (r.suggested && r.category && (r.confidence ?? 0) >= m.confidence) return r;
    if (m.confidence >= threshold) {
      accepted++;
      return { ...r, category: m.category as typeof r.category, suggested: false, confidence: m.confidence, mappingRule: `ai · auto-accepted ≥${threshold}%` };
    }
    suggested++;
    return { ...r, category: m.category as typeof r.category, suggested: true, confidence: m.confidence, mappingRule: "ai suggestion" };
  });
  let next: Company = { ...c, rows };
  if (next.automation.autoAdvance) next = autoAdvance(next);
  const k = computeCompany(next);
  const vrun = toRun(validateCompany(next, k), "import + AI mapping", next.tolerance, `${runId}-v`);
  const importRuns = next.importRuns.map((r) => (r.id === runId ? { ...r, autoMapped: r.autoMapped + accepted, aiSuggested: suggested, stillToMap: next.rows.filter((x) => x.suggested || !x.category).length, statusAfter: next.period.status } : r));
  const validationRuns = next.validationRuns.some((v) => v.id === vrun.id) ? next.validationRuns.map((v) => (v.id === vrun.id ? vrun : v)) : [...next.validationRuns, vrun].slice(-30);
  return { company: { ...next, importRuns, validationRuns }, accepted, suggested };
}

const name = (u: Unit) => (u.sheet ? `${u.fileName} › ${u.sheet}` : u.fileName);
const toBase64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * One drop zone for the whole close pack: every file (CSV, Excel with any number of sheets, .zip,
 * MT940/OFX bank statements, ETA JSON/XML) is recognised, previewed and checked together, then
 * imported in one step.
 */
interface Props {
  compact?: boolean;
  /** Files handed in from outside (the agent's attach button); read once each time the array changes. */
  incoming?: File[] | null;
  onIncomingDone?: () => void;
  onPipeline?: (run: ImportRun) => void;
}

export function BulkUpload(props: Props) {
  const { company, dispatch } = useWorkspace();
  const L = useL();
  const [first, setFirst] = useState<File[] | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (!company) {
    const start = (files: FileList | null) => {
      if (!files?.length) return;
      setFirst([...files]);
      dispatch({ type: "addCompany", company: newCompany(L("My company", "شركتي")) });
    };
    return (
      <Card title={L("Upload all files", "رفع كل الملفات")}>
        <div
          className={`dropzone ${drag ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            start(e.dataTransfer.files);
          }}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        >
          <strong>{L("Drop your files to start: a company is created and everything is read, mapped and checked", "اسحب ملفاتك للبدء: تُنشأ شركة وتتم قراءة كل شيء وربطه وفحصه")}</strong>
          <input ref={input} type="file" multiple hidden onChange={(e) => { start(e.target.files); e.target.value = ""; }} />
        </div>
      </Card>
    );
  }
  return (
    <BulkUploadInner
      {...props}
      incoming={first ?? props.incoming}
      onIncomingDone={() => {
        if (first) setFirst(null);
        else props.onIncomingDone?.();
      }}
    />
  );
}

function BulkUploadInner({ compact = false, incoming = null, onIncomingDone, onPipeline }: Props) {
  const { ws, company: current, update, locked } = useWorkspace();
  const company = current!;
  const L = useL();
  const f = useFormat();
  const { issue } = makeT(ws.lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [mapping, setMapping] = useState<string | null>(null);
  const [draftMap, setDraftMap] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string[] | null>(null);
  const [ocr, setOcr] = useState<{ configured: boolean } | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [lastRun, setLastRun] = useState<ImportRun | null>(null);
  const [aiNote, setAiNote] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const handled = useRef<File[] | null>(null);

  const included = useMemo(() => rows.filter((r) => r.include && r.staged && r.category), [rows]);
  const items: BatchItem[] = useMemo(() => included.map((r) => ({ id: r.unit.id, staged: r.staged!, role: r.role, month: r.month })), [included]);
  const report = useMemo(() => (company && items.length ? batchChecks(company, items) : null), [company, items]);

  const auto = company.automation.autoImport;
  const setAutomation = (p: Partial<Automation>) => update({ action: "automation.update", entity: "settings", reason: JSON.stringify(p) }, (c) => ({ ...c, automation: { ...c.automation, ...p } }), { allowWhenLocked: true });

  const patch = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.unit.id === id ? { ...r, ...p } : r)));

  const stage = async (row: Row, category: DocCategory | null, columnMap?: Record<string, string>): Promise<Staged | null> => {
    if (!category) {
      patch(row.unit.id, { category: null, staged: null, include: false });
      return null;
    }
    patch(row.unit.id, { category, busy: true, error: "", progress: category === "GENERAL_LEDGER" ? 0 : null });
    try {
      const staged = await stageUnit(row.unit, category, { columnMap: columnMap ?? company.columnMaps[category], onProgress: (p) => patch(row.unit.id, { progress: p }) });
      patch(row.unit.id, { staged, include: !staged.issues.some((i) => i.level === "error"), busy: false, progress: null });
      return staged;
    } catch (e) {
      patch(row.unit.id, { staged: null, include: false, busy: false, progress: null, error: (e as Error).message });
      return null;
    }
  };

  /** The automatic path: import what is certain, map, ask the AI about the rest, validate, report. */
  const runAuto = async (results: Array<{ row: Row; staged: Staged | null }>, extraHeld: Array<{ name: string; reason: string }>) => {
    setPhase("importing");
    const eligible: Array<{ row: Row; staged: Staged }> = [];
    const held = [...extraHeld];
    for (const { row, staged } of results) {
      const e = autoEligible(company, row.unit, staged);
      if (e.ok && staged) eligible.push({ row, staged });
      else held.push({ name: name(row.unit), reason: e.reason });
    }
    // Only one current and one prior trial balance can be used: keep the largest, hold the others.
    for (const role of ["current", "prior"] as const) {
      const tbs = eligible.filter((x) => x.staged.category === "TRIAL_BALANCE" && x.row.role === role).sort((p, q) => q.staged.rowCount - p.staged.rowCount);
      for (const extra of tbs.slice(1)) {
        eligible.splice(eligible.indexOf(extra), 1);
        held.push({ name: name(extra.row.unit), reason: `another ${role}-period trial balance (${name(tbs[0].row.unit)}) was used; choose which one to import` });
      }
    }
    if (!eligible.length) {
      setPhase(null);
      return;
    }
    const runId = uid("run");
    const at = new Date().toISOString();
    const ids = eligible.map(() => uid("doc"));
    const items = eligible.map(({ row, staged }) => ({ id: row.unit.id, staged, role: row.role, month: row.month, unit: row.unit }));
    const opts = { by: ws.profile.name, ids, runId, at };
    const local = runPipeline(company, items, held, opts);
    update({ action: "source.autoImport", entity: "source_documents", recordId: ids.join(","), reason: `${eligible.length} file(s) imported automatically, ${held.length} held` }, (c) => runPipeline(c, items, held, opts).company);
    setRows((rs) => rs.filter((r) => !eligible.some((x) => x.row.unit.id === r.unit.id)));
    let run = local.run;
    setPhase("mapping");
    const a = company.automation;
    const targets = local.company.rows.filter((r) => !r.category || r.suggested).slice(0, 200);
    if (a.aiMapping && targets.length && !IS_STATIC) {
      try {
        const st = await aiStatus();
        if (st.configured) {
          const res = await fetch("/api/map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accounts: targets.map((r) => ({ code: r.code, name: r.name, balance: r.currentDebit - r.currentCredit })) }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
          const threshold = a.autoMapThreshold;
          const after = applyAiMappings(local.company, data.mappings, threshold, runId);
          update({ action: "mapping.aiAuto", entity: "trial_balance_records", recordId: runId, reason: `AI mapping: ${after.accepted} accepted at ≥${threshold}%, ${after.suggested} left for review` }, (c) => applyAiMappings(c, data.mappings, threshold, runId).company);
          run = after.company.importRuns.find((r) => r.id === runId) ?? run;
        }
      } catch (e) {
        setAiNote((e as Error).message);
      }
    }
    setPhase("validating");
    setLastRun(run);
    setDone(run.files.map((x) => x.name));
    setPhase("done");
    onPipeline?.(run);
  };

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list?.length) return;
    setDone(null);
    setLastRun(null);
    setAiNote("");
    setPhase("reading");
    const files = await Promise.all([...list].map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
    const { units, errors: errs } = await expandFiles(files);
    setErrors(errs);
    setPhase("detecting");
    const fresh: Row[] = defaultRoles(
      units.map((u) => {
        // A file seen in an earlier month keeps the type and role it had then.
        const mem = remembered(company, u);
        return { unit: u, category: mem?.category ?? u.detection.category, role: mem?.role ?? "current", month: u.month, staged: null, error: "", include: false, busy: !!(mem?.category ?? u.detection.category), progress: null };
      }),
      company.rows.length > 0,
    ).map((r, i) => {
      const mem = remembered(company, units[i]);
      return mem?.role ? { ...r, role: mem.role, month: mem.role === "monthly" ? (r.month ?? units[i].month) : r.month } : r;
    });
    setRows((rs) => [...rs, ...fresh]);
    if (fresh.some((r) => r.unit.detection.format === "pdf" || r.unit.detection.format === "image")) aiStatus().then(setOcr);
    const results: Array<{ row: Row; staged: Staged | null }> = [];
    for (const r of fresh) if (r.category) results.push({ row: r, staged: await stage(r, r.category) });
    const unknown = fresh.filter((r) => !r.category).map((r) => ({ name: name(r.unit), reason: r.unit.detection.format === "pdf" || r.unit.detection.format === "image" ? "scanned document: choose what to read it as" : r.unit.detection.reason }));
    if (auto && !locked) await runAuto(results, unknown);
    else setPhase(null);
  };

  useEffect(() => {
    if (!incoming?.length || incoming === handled.current) return;
    handled.current = incoming;
    void Promise.resolve().then(async () => {
      await addFiles(incoming);
      onIncomingDone?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const runOcr = async (row: Row, target: DocCategory) => {
    patch(row.unit.id, { busy: true, error: "" });
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: row.unit.fileName, mediaType: row.unit.detection.format === "pdf" ? "application/pdf" : `image/${row.unit.fileName.split(".").pop()?.toLowerCase().replace("jpg", "jpeg")}`, data: toBase64(row.unit.bytes), target }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      const { units } = await expandFiles([{ name: `${row.unit.fileName.replace(/\.[a-z0-9]+$/i, "")} (OCR).csv`, bytes: new TextEncoder().encode(body.csv as string) }]);
      const u = units[0];
      const next: Row = { ...row, unit: { ...u, detection: { ...u.detection, category: target, reason: "Read from the document by AI text recognition: check every figure" } }, category: target, busy: false };
      setRows((rs) => rs.map((r) => (r.unit.id === row.unit.id ? next : r)));
      await stage(next, target);
    } catch (e) {
      patch(row.unit.id, { busy: false, error: (e as Error).message });
    }
  };

  const openMapping = (row: Row) => {
    const cat = row.category as CsvCategory;
    setMapping(row.unit.id);
    setDraftMap({ ...(company.columnMaps[cat] ?? {}) });
  };

  const saveMapping = async (row: Row) => {
    const cat = row.category as CsvCategory;
    const clean = Object.fromEntries(Object.entries(draftMap).filter(([, v]) => v));
    update({ action: "columnMap.save", entity: "column_maps", recordId: cat }, (c) => ({ ...c, columnMaps: { ...c.columnMaps, [cat]: clean } }));
    setMapping(null);
    await stage(row, cat, clean);
  };

  const importAll = () => {
    const ok = rows.filter((r) => r.include && r.staged && r.category && !r.staged.issues.some((i) => i.level === "error"));
    if (!ok.length) return;
    const ids = ok.map(() => uid("doc"));
    update({ action: "source.bulkUpload", entity: "source_documents", recordId: ids.join(",") }, (c) => ok.reduce((acc, r, i) => applyStaged(acc, r.staged!, ids[i], r.role, r.month), c));
    setDone(ok.map((r) => name(r.unit)));
    setLastRun(null);
    setRows((rs) => rs.filter((r) => !ok.includes(r)));
  };

  const setFx = (ccy: string, rate: number) => update({ action: "fx.update", entity: "fx_rates", recordId: ccy }, (c) => ({ ...c, fxRates: { ...c.fxRates, [ccy]: rate } }));

  const blocking = included.some((r) => r.staged!.issues.some((i) => i.level === "error"));
  const unrecognised = rows.filter((r) => !r.category && !r.busy);
  const t = report?.tieOuts;

  return (
    <Card
      title={L("Upload all files", "رفع كل الملفات")}
      actions={
        rows.length > 0 && (
          <>
            <button onClick={importAll} disabled={locked || !included.length || blocking}>
              {L(`Import ${included.length} file${included.length === 1 ? "" : "s"}`, `استيراد ${included.length} ملف`)}
            </button>
            <button className="ghost" onClick={() => setRows([])}>
              {L("Clear", "مسح")}
            </button>
          </>
        )
      }
    >
      <div
        className={`dropzone ${drag ? "over" : ""} ${locked ? "disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!locked) addFiles(e.dataTransfer.files);
        }}
        onClick={() => !locked && input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !locked && input.current?.click()}
      >
        <strong>{L("Drop your whole close pack here, or click to choose files", "اسحب ملفات الإقفال كلها هنا، أو اضغط لاختيار الملفات")}</strong>
        <span className="muted small">
          {L(
            "CSV, Excel .xlsx / .xls (every sheet, several tables per sheet), OpenDocument, Excel XML, HTML exports, Word tables, dBase, JSON, fixed-width text, PDF reports, .zip, MT940 / OFX bank statements, ETA JSON/XML. Arabic headers and exports from Odoo, SAP Business One, QuickBooks, Dynamics 365, ERPNext, Zoho, Sage and Oracle are recognised. UTF-8 or Windows-1256 Arabic.",
            "CSV وExcel ‎.xlsx / .xls‎ (كل الأوراق وأكثر من جدول في الورقة) وOpenDocument وجداول HTML وWord وdBase وJSON والنصوص ثابتة العرض وتقارير PDF وملفات ‎.zip‎ وكشوف MT940 / OFX وملفات منظومة الفاتورة. يتم التعرف على العناوين العربية وتصدير أودو وSAP وكويك بوكس وداينامكس وERPNext وZoho وSage وOracle.",
          )}
        </span>
        <input ref={input} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="auto-bar small">
        <label>
          <input type="checkbox" checked={auto} onChange={(e) => setAutomation({ autoImport: e.target.checked })} /> {L("Automatic: read, import, map and validate on drop", "تلقائي: قراءة واستيراد وربط وتحقق عند الرفع")}
        </label>
        {auto && <span className="muted">· {L("accept mappings at", "قبول الربط عند")} ≥{company.automation.autoMapThreshold}%</span>}
        <button className="link small" onClick={() => setShowSettings((v) => !v)}>{L("Settings", "الإعدادات")}</button>
      </div>
      {showSettings && (
        <div className="mapping-panel grid">
          <label className="field">
            <span>{L("Auto-accept mappings at or above (%)", "قبول الربط تلقائيًا عند أو فوق (٪)")}</span>
            <input type="number" min={50} max={101} defaultValue={company.automation.autoMapThreshold} onBlur={(e) => setAutomation({ autoMapThreshold: Math.min(101, Math.max(50, Number(e.target.value) || 85)) })} />
            <span className="muted small">{L("101 = never accept automatically", "١٠١ = لا قبول تلقائي")}</span>
          </label>
          <label className="field">
            <span>{L("Minimum recognition confidence to import a file (%)", "أدنى ثقة تعرف لاستيراد ملف (٪)")}</span>
            <input type="number" min={0} max={100} defaultValue={company.automation.minConfidence} onBlur={(e) => setAutomation({ minConfidence: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
          </label>
          <label className="field">
            <span>
              <input type="checkbox" checked={company.automation.aiMapping} onChange={(e) => setAutomation({ aiMapping: e.target.checked })} /> {L("Ask the AI to map the remaining accounts", "اطلب من الذكاء الاصطناعي ربط الحسابات المتبقية")}
            </span>
            {IS_STATIC && <span className="muted small">{L("Needs the full app with AI configured.", "يحتاج التطبيق الكامل مع إعداد الذكاء الاصطناعي.")}</span>}
          </label>
          <label className="field">
            <span>
              <input type="checkbox" checked={company.automation.autoAdvance} onChange={(e) => setAutomation({ autoAdvance: e.target.checked })} /> {L("Move the period to Mapped / Reconciled when every gate passes (never locks)", "نقل الفترة إلى مربوطة / مطابقة عند نجاح كل البوابات (بدون إقفال)")}
            </span>
          </label>
        </div>
      )}
      {phase && phase !== "done" && (
        <ol className="phases small">
          {PHASES.map(([p, en, ar], i) => {
            const at = PHASES.findIndex((x) => x[0] === phase);
            return (
              <li key={p} className={i < at ? "ok" : i === at ? "now" : "todo"}>
                {i < at ? "✓" : i === at ? "…" : "○"} {L(en, ar)}
              </li>
            );
          })}
        </ol>
      )}
      {lastRun && (
        <Banner kind={lastRun.held.length || lastRun.stillToMap ? "warning" : "ok"}>
          <strong>{L("Done", "تم")}:</strong> {L(`${lastRun.files.length} file(s) imported`, `استيراد ${lastRun.files.length} ملف`)}
          {lastRun.autoMapped > 0 && <> · {L(`${lastRun.autoMapped} mapping(s) accepted automatically`, `قبول ${lastRun.autoMapped} ربط تلقائيًا`)}</>}
          {lastRun.aiSuggested > 0 && <> · {L(`${lastRun.aiSuggested} AI suggestion(s) to review`, `${lastRun.aiSuggested} اقتراح ذكاء اصطناعي للمراجعة`)}</>}
          {lastRun.stillToMap > 0 && <> · <Link href="/mapping">{L(`${lastRun.stillToMap} account(s) still to map`, `${lastRun.stillToMap} حساب يحتاج ربط`)}</Link></>}
          {" "}· {L("period", "الفترة")} <Pill>{lastRun.statusAfter}</Pill>
          {lastRun.held.length > 0 && (
            <ul className="small">
              {lastRun.held.map((h) => (
                <li key={h.name}>
                  {L("Held for you", "بانتظارك")}: <strong>{h.name}</strong> — {h.reason}
                </li>
              ))}
            </ul>
          )}
          {aiNote && <div className="muted small">{L("AI mapping was skipped:", "تم تخطي الربط بالذكاء الاصطناعي:")} {aiNote}</div>}
        </Banner>
      )}
      {locked && <Banner kind="info">{L("The period is locked; reopen it to load new files.", "الفترة مقفلة؛ أعد فتحها لتحميل ملفات جديدة.")}</Banner>}
      {errors.map((e) => (
        <Banner key={e} kind="error">{e}</Banner>
      ))}
      {done && !lastRun && (
        <Banner kind="ok">
          {L("Imported", "تم استيراد")}: {done.join(", ")}. <Link href="/mapping">{L("Review mapping", "مراجعة الربط")}</Link> · <Link href="/close-review">{L("Close review", "مراجعة الإقفال")}</Link>
        </Banner>
      )}

      {rows.length > 0 && (
        <div className="scroll">
          <table className="compact upload-table">
            <thead>
              <tr>
                <th />
                <th>{L("File", "الملف")}</th>
                <th>{L("Type", "النوع")}</th>
                <th>{L("Use as", "الاستخدام")}</th>
                <th className="num">{L("Rows", "السطور")}</th>
                <th>{L("Dates", "التواريخ")}</th>
                <th>{L("Checks", "الفحوص")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const errs = r.staged?.issues.filter((i) => i.level === "error") ?? [];
                const warns = r.staged?.issues.filter((i) => i.level === "warning") ?? [];
                const missing = errs.some((i) => i.code === "missingFields" || i.code === "missingColumns");
                const visual = r.unit.detection.format === "pdf" || r.unit.detection.format === "image";
                return (
                  <tr key={r.unit.id}>
                    <td>
                      <input type="checkbox" aria-label={L("Include", "تضمين")} checked={r.include} disabled={!r.staged || errs.length > 0} onChange={(e) => patch(r.unit.id, { include: e.target.checked })} />
                    </td>
                    <td>
                      <div className="strong">{name(r.unit)}</div>
                      <div className="muted small">
                        {r.unit.detection.reason}
                        {r.staged?.erp && <> · <Pill kind="info">{r.staged.erp}</Pill></>}
                        {r.staged && r.staged.format !== "csv" && r.staged.format !== "eta" && <> · <Pill>{r.staged.format.toUpperCase()}</Pill></>}
                      </div>
                      {r.staged?.derived.length ? <div className="muted small">{r.staged.derived.join("; ")}</div> : null}
                    </td>
                    <td>
                      <select value={r.category ?? ""} onChange={(e) => stage(r, (e.target.value || null) as DocCategory | null)} disabled={r.busy || visual}>
                        <option value="">{L("— choose —", "— اختر —")}</option>
                        {ALL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{L(...DOC_LABELS[c])}</option>
                        ))}
                      </select>
                      {r.unit.detection.category && <div className="muted small">{L("confidence", "الثقة")} {r.unit.detection.confidence}%</div>}
                    </td>
                    <td>
                      {r.category === "TRIAL_BALANCE" ? (
                        <>
                          <select value={r.role} onChange={(e) => patch(r.unit.id, { role: e.target.value as TbRole })}>
                            <option value="current">{L("Current period", "الفترة الحالية")}</option>
                            <option value="prior">{L("Prior period (comparatives)", "الفترة السابقة (مقارنة)")}</option>
                            <option value="monthly">{L("One month (for trends)", "شهر واحد (للاتجاهات)")}</option>
                          </select>
                          {r.role === "monthly" && (
                            <input
                              type="month"
                              value={r.month?.label ?? ""}
                              onChange={(e) => {
                                const [y, m] = e.target.value.split("-").map(Number);
                                patch(r.unit.id, { month: e.target.value ? { label: e.target.value, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) } : null });
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td className="num">{r.busy ? (r.progress !== null ? `${Math.round(r.progress * 100)}%` : "…") : r.staged ? f.n(r.staged.rowCount) : "—"}</td>
                    <td className="small">{r.staged?.dateRange ? `${r.staged.dateRange.from} → ${r.staged.dateRange.to}` : "—"}</td>
                    <td className="small">
                      {r.error && <div className="bad">{r.error}</div>}
                      {visual && (
                        IS_STATIC || ocr?.configured === false ? (
                          <span className="muted">{IS_STATIC ? L("Scanned documents need the full app with AI configured.", "المستندات الممسوحة تحتاج التطبيق الكامل مع إعداد الذكاء الاصطناعي.") : L("AI is not configured, so scanned files cannot be read.", "الذكاء الاصطناعي غير مُعد، فلا يمكن قراءة الملفات الممسوحة.")}</span>
                        ) : (
                          <div className="actions">
                            {(["BANK_STATEMENT", "AR_SUBLEDGER", "AP_SUBLEDGER", "TRIAL_BALANCE"] as DocCategory[]).map((c) => (
                              <button key={c} className="ghost small" disabled={r.busy} onClick={() => runOcr(r, c)}>
                                {L("Read as", "اقرأ كـ")} {L(...DOC_LABELS[c])}
                              </button>
                            ))}
                          </div>
                        )
                      )}
                      {errs.slice(0, 2).map((i, k) => <div key={k} className="bad">{issue(i, f.n)}</div>)}
                      {errs.length > 2 && <div className="bad">+{errs.length - 2}</div>}
                      {warns.length > 0 && <div className="warn-text">{warns.length} {L("warnings", "تحذير")}</div>}
                      {r.staged && !errs.length && <Pill kind="good">✓</Pill>}
                      {r.category && r.category !== "ETA_INVOICE" && r.staged && (
                        <button className="link small" onClick={() => openMapping(r)}>
                          {missing ? L("Match columns", "مطابقة الأعمدة") : L("Columns", "الأعمدة")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mapping && (() => {
        const r = rows.find((x) => x.unit.id === mapping);
        if (!r?.category || r.category === "ETA_INVOICE" || !r.staged) return null;
        const cat = r.category as CsvCategory;
        const req = requiredFields(cat);
        return (
          <div className="mapping-panel">
            <h3>{L("Match columns", "مطابقة الأعمدة")} · {name(r.unit)}</h3>
            <p className="muted small">{L("Pick the column in your file for each field. The matches are saved for this company and reused next time.", "اختر العمود المقابل لكل حقل. تُحفظ المطابقة لهذه الشركة وتستخدم في المرات القادمة.")}</p>
            <div className="grid">
              {allFields(cat).map((field) => (
                <label key={field} className="field">
                  <span>
                    {field} {req.includes(field) && <span className="bad">*</span>}
                  </span>
                  <select value={draftMap[field] ?? ""} onChange={(e) => setDraftMap((m) => ({ ...m, [field]: e.target.value }))}>
                    <option value="">{L("(automatic)", "(تلقائي)")}</option>
                    {r.staged!.headers.filter(Boolean).map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="actions">
              <button onClick={() => saveMapping(r)}>{L("Save and re-read", "حفظ وإعادة القراءة")}</button>
              <button className="ghost" onClick={() => setMapping(null)}>{L("Cancel", "إلغاء")}</button>
            </div>
          </div>
        );
      })()}

      {unrecognised.length > 0 && <Banner kind="warning">{L("Choose a type for files that were not recognised.", "اختر نوع الملفات التي لم يتم التعرف عليها.")}</Banner>}

      {report && (
        <>
          <h3>{L("Before you import", "قبل الاستيراد")}</h3>
          {report.findings.length === 0 && <Banner kind="ok">{L("No duplicates, period or currency problems found.", "لا توجد تكرارات أو مشكلات في الفترة أو العملة.")}</Banner>}
          <ul className="issues">
            {report.findings.map((fd, i) => (
              <li key={i} className={fd.level === "info" ? "" : fd.level}>
                {L(...fd.text)}
                {fd.items && <div className="muted small mono">{fd.items.join(" · ")}</div>}
              </li>
            ))}
          </ul>
          {report.suggestedPeriod && (
            <Banner kind="info">
              {L("The files cover", "الملفات تغطي")} {report.suggestedPeriod.start} → {report.suggestedPeriod.end}, {L("but the company period is", "بينما فترة الشركة")} {company.period.start} → {company.period.end}.{" "}
              <button className="link" disabled={locked} onClick={() => update({ action: "period.update", entity: "financial_periods" }, (c) => ({ ...c, period: { ...c.period, ...report.suggestedPeriod! } }))}>
                {L("Use", "استخدم")} {report.suggestedPeriod.currentLabel}
              </button>
            </Banner>
          )}
          {report.currencies.length > 0 && (
            <div className="fx-row">
              <span className="small">{L("Exchange rates to", "أسعار الصرف إلى")} {company.settings.functionalCurrency}:</span>
              {report.currencies.map((ccy) => (
                <label key={ccy} className="small">
                  1 {ccy} ={" "}
                  <input type="number" min={0} step="0.0001" style={{ width: 100 }} defaultValue={company.fxRates[ccy] ?? ""} onBlur={(e) => Number(e.target.value) > 0 && setFx(ccy, Number(e.target.value))} />
                </label>
              ))}
            </div>
          )}
          {t && (
            <table className="compact">
              <thead>
                <tr>
                  <th>{L("Tie-out after import", "المطابقة بعد الاستيراد")}</th>
                  <th className="num">{L("Subledger", "الدفتر التحليلي")}</th>
                  <th className="num">{L("Trial balance", "الميزان")}</th>
                  <th className="num">{L("Difference", "الفرق")}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(t).filter(([, v]) => v).map(([k, v]) => (
                  <tr key={k}>
                    <td>{L(...TIE_LABELS[k])}</td>
                    <td className="num">{f.n(v!.subledger)}</td>
                    <td className="num">{f.n(v!.trialBalance)}</td>
                    <td className={`num ${v!.ties ? "good" : "bad"}`}>{v!.ties ? "✓" : f.n(v!.difference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {!compact && (
        <details className="missing-files" open={!rows.length && company.docs.length < 9}>
          <summary className="small">
            {L("File checklist", "قائمة الملفات")} · {ALL_CATEGORIES.filter((c) => company.docs.some((d) => d.category === c)).length}/{ALL_CATEGORIES.length} {L("loaded", "محمّل")}
          </summary>
          <ul className="checklist">
            {ALL_CATEGORIES.map((c) => {
              const have = company.docs.some((d) => d.category === c) || (report && !report.missing.includes(c));
              return (
                <li key={c} className={have ? "ok" : "todo"}>
                  {have ? "✓" : "○"} <strong>{L(...DOC_LABELS[c])}</strong> <span className="muted small">— {L(...UNLOCKS[c])}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </Card>
  );
}
