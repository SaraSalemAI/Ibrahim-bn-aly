"use client";

import { useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { exportExcel } from "@/components/exportExcel";
import { Banner, Card, NeedsData, NumInput, Page, Pill } from "@/components/ui";
import { ajeBalanced, type Aje, type AjeLine } from "@/lib/finance/adjustments";
import { categoryClass } from "@/lib/finance/classify";
import { IS_STATIC } from "@/lib/env";
import { CATEGORIES, type Category, type TBRow } from "@/lib/finance/types";
import { makeT } from "@/lib/i18n";
import { uid } from "@/lib/workspace/defaults";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const GROUPS: Array<{ key: string; en: string; ar: string; match: (c: Category | "") => boolean }> = [
  { key: "ca", en: "Current assets", ar: "الأصول المتداولة", match: (c) => ["CASH", "RECEIVABLES", "INVENTORY", "OTHER_CURRENT_ASSET"].includes(c) },
  { key: "nca", en: "Non-current assets", ar: "الأصول غير المتداولة", match: (c) => ["PPE", "ACCUM_DEPRECIATION", "OTHER_NON_CURRENT_ASSET"].includes(c) },
  { key: "cl", en: "Current liabilities", ar: "الالتزامات المتداولة", match: (c) => ["PAYABLES", "SHORT_TERM_DEBT", "OTHER_CURRENT_LIABILITY"].includes(c) },
  { key: "ncl", en: "Non-current liabilities", ar: "الالتزامات غير المتداولة", match: (c) => ["LONG_TERM_DEBT", "OTHER_NON_CURRENT_LIABILITY"].includes(c) },
  { key: "eq", en: "Equity", ar: "حقوق الملكية", match: (c) => c !== "" && categoryClass(c) === "E" },
  { key: "rev", en: "Revenue & other income", ar: "الإيرادات والإيرادات الأخرى", match: (c) => c !== "" && categoryClass(c) === "R" },
  { key: "cogs", en: "Cost of sales", ar: "تكلفة المبيعات", match: (c) => c === "COGS" },
  { key: "opex", en: "Operating expenses", ar: "المصروفات التشغيلية", match: (c) => ["SELLING_EXPENSE", "ADMIN_EXPENSE", "DEPRECIATION"].includes(c) },
  { key: "fin", en: "Finance costs & tax", ar: "التمويل والضرائب", match: (c) => ["FINANCE_COST", "TAX_EXPENSE"].includes(c) },
  { key: "unm", en: "Unmapped holding", ar: "حسابات معلقة", match: (c) => c === "" },
];

interface SixCol { od: number; oc: number; ad: number; ac: number; cd: number; cc: number }
const split = (net: number) => (net >= 0 ? [net, 0] : [0, -net]);

export default function TrialBalancePage() {
  const { ws, company, computed, update } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { category: catLabel } = makeT(ws.lang);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [drawer, setDrawer] = useState<TBRow | null>(null);
  const [exportErr, setExportErr] = useState("");
  const [reversing, setReversing] = useState<{ id: string; reason: string } | null>(null);
  const [draft, setDraft] = useState<{ reason: string; lines: AjeLine[] }>({ reason: "", lines: [] });

  const gl = company?.subledgers.gl ?? [];
  const glActivity = new Map<string, { d: number; c: number }>();
  for (const l of gl) {
    const a = glActivity.get(l.accountCode) ?? { d: 0, c: 0 };
    a.d += l.debit;
    a.c += l.credit;
    glActivity.set(l.accountCode, a);
  }
  const six = (r: TBRow): SixCol => {
    const [od, oc] = split(r.priorDebit - r.priorCredit);
    const [cd, cc] = split(r.currentDebit - r.currentCredit);
    const g = glActivity.get(r.code);
    const [ad, ac] = g ? [g.d, g.c] : split(r.currentDebit - r.currentCredit - (r.priorDebit - r.priorCredit));
    return { od, oc, ad, ac, cd, cc };
  };
  const rows = computed?.rows ?? [];
  const filtered = rows.filter((r) => (q ? `${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase()) : true));
  const sum = (rs: TBRow[]) => rs.map(six).reduce((a, s) => ({ od: a.od + s.od, oc: a.oc + s.oc, ad: a.ad + s.ad, ac: a.ac + s.ac, cd: a.cd + s.cd, cc: a.cc + s.cc }), { od: 0, oc: 0, ad: 0, ac: 0, cd: 0, cc: 0 });
  const total = sum(rows);
  const cells = (s: SixCol) => (["od", "oc", "ad", "ac", "cd", "cc"] as const).map((k) => <td key={k} className="num">{s[k] ? f.n(s[k]) : ""}</td>);
  const doc = (id?: string) => company?.docs.find((d) => d.id === id);

  const lineTotal = draft.lines.reduce((a, l) => a + l.debit - l.credit, 0);
  const draftAje: Aje = { id: "", date: company?.period.end ?? "", reason: draft.reason, author: ws.profile.name, kind: "AJE", lines: draft.lines };
  const addLine = () => setDraft((d) => ({ ...d, lines: [...d.lines, { code: "", name: "", category: "", debit: 0, credit: 0 }] }));
  const setLine = (i: number, patch: Partial<AjeLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const postAje = () => {
    const id = `AJE-${(company?.ajes.length ?? 0) + 1}-${uid("").slice(1, 6)}`;
    const lines = draft.lines.map((l) => {
      const existing = company?.rows.find((r) => r.code === l.code);
      return existing ? { ...l, name: existing.name, category: existing.category } : l;
    });
    update({ action: "aje.post", entity: "adjusting_journal_entries", recordId: id, reason: draft.reason }, (c) => ({ ...c, ajes: [...c.ajes, { ...draftAje, id, lines }] }), { allowWhenLocked: true });
    setDraft({ reason: "", lines: [] });
  };

  return (
    <Page
      title={L("4 · Interactive trial balance", "٤ · ميزان المراجعة التفاعلي")}
      subtitle={L("Six columns (opening, activity, closing), grouped with subtotals. Click any account for its lineage.", "ستة أعمدة (افتتاحي، حركة، ختامي) مجمعة بإجماليات. اضغط أي حساب لتتبع مصدره.")}
      actions={
        <button
          onClick={async () => {
            if (company) setExportErr((await exportExcel(company)) ?? "");
          }}
          disabled={!computed?.analysis || IS_STATIC}
          title={IS_STATIC ? "Excel export needs the full app" : undefined}
        >
          {L("Export Excel (live formulas)", "تصدير Excel (معادلات حية)")}
        </button>
      }
    >
      <NeedsData>
        {exportErr && <Banner kind="error">{exportErr}</Banner>}
        <Card>
          <div className="actions">
            <input placeholder={L("Search code or name…", "ابحث بالكود أو الاسم…")} value={q} onChange={(e) => setQ(e.target.value)} />
            {[{ key: "all", en: "All", ar: "الكل" }, ...GROUPS].map((g) => (
              <button key={g.key} className={group === g.key ? "chip active" : "chip"} onClick={() => setGroup(g.key)}>
                {L(g.en, g.ar)}
              </button>
            ))}
          </div>
          <p className="muted small">{gl.length ? L("Activity columns use gross GL debits and credits.", "أعمدة الحركة من إجمالي مدين ودائن الأستاذ.") : L("Activity columns show the net movement (load the GL for gross activity).", "أعمدة الحركة تعرض صافي الحركة (حمّل الأستاذ لعرض الإجمالي).")}</p>
          <div className="scroll">
            <table className="tb6">
              <thead>
                <tr>
                  <th rowSpan={2}>{L("Code", "الكود")}</th>
                  <th rowSpan={2}>{L("Account", "الحساب")}</th>
                  <th colSpan={2} className="center">{L("Opening", "افتتاحي")}</th>
                  <th colSpan={2} className="center">{L("Period activity", "حركة الفترة")}</th>
                  <th colSpan={2} className="center">{L("Closing", "ختامي")}</th>
                </tr>
                <tr>
                  {[0, 1, 2].map((i) => (
                    <th key={i} className="num" colSpan={1}>
                      {L("Dr", "مدين")}
                    </th>
                  )).flatMap((dr, i) => [dr, <th key={`c${i}`} className="num">{L("Cr", "دائن")}</th>])}
                </tr>
              </thead>
              {GROUPS.filter((g) => group === "all" || g.key === group).map((g) => {
                const rs = filtered.filter((r) => g.match(r.category));
                if (!rs.length) return null;
                return (
                  <tbody key={g.key}>
                    <tr className="group-row">
                      <td colSpan={8}>{L(g.en, g.ar)}</td>
                    </tr>
                    {rs.map((r, i) => (
                      <tr key={`${r.code}-${i}`} className="clickable" onClick={() => setDrawer(r)}>
                        <td>{r.code}</td>
                        <td>
                          {r.name} {r.mappingRule?.startsWith("aje") && <Pill kind="info">AJE</Pill>} {r.mappingRule?.startsWith("bridge") && <Pill kind="info">{L("bridge", "تسوية إطار")}</Pill>}
                        </td>
                        {cells(six(r))}
                      </tr>
                    ))}
                    <tr className="subtotal">
                      <td />
                      <td>{L("Subtotal", "الإجمالي الفرعي")}</td>
                      {cells(sum(rs))}
                    </tr>
                  </tbody>
                );
              })}
              <tfoot>
                <tr className="total">
                  <td />
                  <td>{L("Totals", "الإجمالي")}</td>
                  {cells(total)}
                </tr>
                <tr>
                  <td />
                  <td>{L("Dr − Cr", "مدين − دائن")}</td>
                  <td colSpan={2} className={`num ${Math.abs(total.od - total.oc) > 0.005 ? "bad" : "good"}`}>{f.n(total.od - total.oc)}</td>
                  <td colSpan={2} className={`num ${Math.abs(total.ad - total.ac) > 0.005 ? "bad" : "good"}`}>{f.n(total.ad - total.ac)}</td>
                  <td colSpan={2} className={`num ${Math.abs(total.cd - total.cc) > 0.005 ? "bad" : "good"}`}>{f.n(total.cd - total.cc)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card title={L("Adjusting journal entries", "قيود التسوية")}>
          <p className="muted small">{L("AJEs adjust the current period and are allowed even when the period is locked; each needs a reason and is logged.", "قيود التسوية تعدل الفترة الحالية ومسموحة حتى بعد الإقفال؛ كل قيد يتطلب سببًا ويُسجل.")}</p>
          {company?.ajes.length ? (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{L("Reason", "السبب")}</th>
                  <th>{L("Author", "المعد")}</th>
                  <th className="num">{L("Amount", "المبلغ")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {company.ajes.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.id}</td>
                    <td>{a.reason}</td>
                    <td>{a.author}</td>
                    <td className="num">{f.n(a.lines.reduce((s, l) => s + l.debit, 0))}</td>
                    <td>
                      {reversing?.id === a.id ? (
                        <span className="actions">
                          <input
                            id={`reverse-reason-${a.id}`}
                            autoFocus
                            placeholder={L("Reason for reversing", "سبب العكس")}
                            value={reversing.reason}
                            onChange={(e) => setReversing({ id: a.id, reason: e.target.value })}
                          />
                          <button
                            className="link danger"
                            disabled={!reversing.reason.trim()}
                            onClick={() => {
                              update({ action: "aje.reverse", entity: "adjusting_journal_entries", recordId: a.id, reason: reversing.reason.trim() }, (c) => ({ ...c, ajes: c.ajes.filter((x) => x.id !== a.id) }), { allowWhenLocked: true });
                              setReversing(null);
                            }}
                          >
                            {L("Confirm reversal", "تأكيد العكس")}
                          </button>
                          <button className="link" onClick={() => setReversing(null)}>
                            {L("Cancel", "إلغاء")}
                          </button>
                        </span>
                      ) : (
                        <button className="link danger" onClick={() => setReversing({ id: a.id, reason: "" })}>
                          {L("Reverse", "عكس")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted small">{L("No adjusting entries.", "لا توجد قيود تسوية.")}</p>
          )}
          <h3>{L("New entry", "قيد جديد")}</h3>
          <input placeholder={L("Reason (required)", "السبب (مطلوب)")} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} style={{ width: "100%" }} />
          <table className="compact">
            <tbody>
              {draft.lines.map((l, i) => {
                const exists = company?.rows.some((r) => r.code === l.code);
                return (
                  <tr key={i}>
                    <td>
                      <input list="tb-codes" placeholder={L("Account code", "كود الحساب")} value={l.code} onChange={(e) => setLine(i, { code: e.target.value })} style={{ width: 110 }} />
                    </td>
                    <td>
                      {exists ? (
                        <span className="small">{company?.rows.find((r) => r.code === l.code)?.name}</span>
                      ) : (
                        <>
                          <input placeholder={L("New account name", "اسم حساب جديد")} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                          <select value={l.category} onChange={(e) => setLine(i, { category: e.target.value as Category })}>
                            <option value="">—</option>
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {catLabel(c)}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </td>
                    <td>
                      {L("Dr", "مدين")} <NumInput value={l.debit} onChange={(v) => setLine(i, { debit: v ?? 0 })} width={110} />
                    </td>
                    <td>
                      {L("Cr", "دائن")} <NumInput value={l.credit} onChange={(v) => setLine(i, { credit: v ?? 0 })} width={110} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="tb-codes">
            {company?.rows.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </datalist>
          <div className="actions">
            <button className="ghost" onClick={addLine}>
              {L("Add line", "إضافة سطر")}
            </button>
            <span className={`small ${Math.abs(lineTotal) < 0.005 ? "good" : "bad"}`}>
              {L("Dr − Cr", "مدين − دائن")}: {f.n(lineTotal)}
            </span>
            <button disabled={!draft.reason.trim() || !ajeBalanced(draftAje) || draft.lines.some((l) => !l.code || (!company?.rows.some((r) => r.code === l.code) && !l.category))} onClick={postAje}>
              {L("Post entry", "ترحيل القيد")}
            </button>
          </div>
        </Card>
        <AiPanel module="trial-balance" />
      </NeedsData>

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label={L("Audit drawer", "تفاصيل المصدر")}>
            <div className="card-head">
              <h2>
                {drawer.code} · {drawer.name}
              </h2>
              <button className="link" onClick={() => setDrawer(null)}>
                ✕
              </button>
            </div>
            <dl className="kv">
              <dt>{L("Category", "التصنيف")}</dt>
              <dd>{drawer.category ? catLabel(drawer.category) : L("Unmapped", "غير مصنف")}</dd>
              <dt>{L("Mapping rule", "قاعدة الربط")}</dt>
              <dd>
                {drawer.mappingRule ?? "—"} {drawer.confidence !== undefined && `(${drawer.confidence}%)`}
              </dd>
              <dt>{L("Source file", "ملف المصدر")}</dt>
              <dd>{doc(drawer.sourceDocId)?.fileName ?? (drawer.sourceDocId ? drawer.sourceDocId : "—")}</dd>
              <dt>SHA-256</dt>
              <dd className="mono small">{doc(drawer.sourceDocId)?.sha256 ?? "—"}</dd>
              <dt>{L("Source row", "رقم السطر")}</dt>
              <dd>{drawer.sourceRow || "—"}</dd>
              <dt>{L("Raw values", "القيم الأصلية")}</dt>
              <dd>
                {(() => {
                  const raw = company?.rows.find((r) => r.code === drawer.code);
                  return raw ? `Dr ${f.n(raw.currentDebit)} / Cr ${f.n(raw.currentCredit)} · ${L("prior", "سابق")} Dr ${f.n(raw.priorDebit)} / Cr ${f.n(raw.priorCredit)}` : L("Created by an adjusting entry", "أنشئ بقيد تسوية");
                })()}
              </dd>
              <dt>{L("Adjustments", "التسويات")}</dt>
              <dd>
                {[...(company?.ajes ?? []), ...(computed?.analysis ? computed.bridge : [])]
                  .flatMap((a) => a.lines.filter((l) => l.code === drawer.code).map((l) => `${a.id}: Dr ${f.n(l.debit)} / Cr ${f.n(l.credit)}`))
                  .join(" · ") || "—"}
              </dd>
              <dt>{L("GL lines", "قيود الأستاذ")}</dt>
              <dd>{gl.filter((l) => l.accountCode === drawer.code).length}</dd>
            </dl>
          </aside>
        </div>
      )}
    </Page>
  );
}
