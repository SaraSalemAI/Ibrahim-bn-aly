"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { IS_STATIC } from "@/lib/env";
import { makeT } from "@/lib/i18n";
import { DOC_LABELS, TIE_LABELS } from "@/lib/labels";
import { ALL_CATEGORIES, batchChecks, UNLOCKS, type BatchItem } from "@/lib/ingest/checks";
import { allFields, requiredFields, type CsvCategory } from "@/lib/ingest/erp";
import { applyStaged, expandFiles, stageUnit, type Staged, type TbRole, type Unit } from "@/lib/ingest/stage";
import type { DocCategory } from "@/lib/finance/types";
import { uid } from "@/lib/workspace/defaults";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";
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
export function BulkUpload({ compact = false }: { compact?: boolean }) {
  const { ws, company, update, locked } = useWorkspace();
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
  const input = useRef<HTMLInputElement>(null);

  const included = useMemo(() => rows.filter((r) => r.include && r.staged && r.category), [rows]);
  const items: BatchItem[] = useMemo(() => included.map((r) => ({ id: r.unit.id, staged: r.staged!, role: r.role, month: r.month })), [included]);
  const report = useMemo(() => (company && items.length ? batchChecks(company, items) : null), [company, items]);

  if (!company) return null;

  const patch = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.unit.id === id ? { ...r, ...p } : r)));

  const stage = async (row: Row, category: DocCategory | null, columnMap?: Record<string, string>) => {
    if (!category) return patch(row.unit.id, { category: null, staged: null, include: false });
    patch(row.unit.id, { category, busy: true, error: "", progress: category === "GENERAL_LEDGER" ? 0 : null });
    try {
      const staged = await stageUnit(row.unit, category, { columnMap: columnMap ?? company.columnMaps[category], onProgress: (p) => patch(row.unit.id, { progress: p }) });
      patch(row.unit.id, { staged, include: !staged.issues.some((i) => i.level === "error"), busy: false, progress: null });
    } catch (e) {
      patch(row.unit.id, { staged: null, include: false, busy: false, progress: null, error: (e as Error).message });
    }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setDone(null);
    const files = await Promise.all([...list].map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
    const { units, errors: errs } = expandFiles(files);
    setErrors(errs);
    const fresh: Row[] = defaultRoles(
      units.map((u) => ({ unit: u, category: u.detection.category, role: "current", month: u.month, staged: null, error: "", include: false, busy: !!u.detection.category, progress: null })),
      company.rows.length > 0,
    );
    setRows((rs) => [...rs, ...fresh]);
    if (fresh.some((r) => r.unit.detection.format === "pdf" || r.unit.detection.format === "image")) aiStatus().then(setOcr);
    for (const r of fresh) if (r.category) await stage(r, r.category);
  };

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
      const { units } = expandFiles([{ name: `${row.unit.fileName.replace(/\.[a-z0-9]+$/i, "")} (OCR).csv`, bytes: new TextEncoder().encode(body.csv as string) }]);
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
            "CSV, Excel (every sheet), .zip, MT940 / OFX bank statements, ETA JSON/XML. Exports from Odoo, SAP Business One, QuickBooks and Dynamics 365 are recognised. UTF-8 or Windows-1256 Arabic.",
            "CSV أو Excel (كل الأوراق) أو ملف ‎.zip‎ أو كشوف بنكية MT940 / OFX أو ملفات منظومة الفاتورة. يتم التعرف على تصدير أودو وSAP Business One وكويك بوكس وداينامكس ٣٦٥.",
          )}
        </span>
        <input ref={input} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {locked && <Banner kind="info">{L("The period is locked; reopen it to load new files.", "الفترة مقفلة؛ أعد فتحها لتحميل ملفات جديدة.")}</Banner>}
      {errors.map((e) => (
        <Banner key={e} kind="error">{e}</Banner>
      ))}
      {done && (
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
