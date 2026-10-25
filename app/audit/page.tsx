"use client";

import { useMemo, useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, NeedsData, Page, Pill } from "@/components/ui";
import { verifyAudit } from "@/lib/finance/audit";
import { makeT } from "@/lib/i18n";
import { CHECK_LABELS, LINE_CATEGORIES } from "@/lib/labels";
import { canAdvance, computeCompany } from "@/lib/workspace/compute";
import { rollForwardCompany, snapshotPack } from "@/lib/workspace/period";
import { nextPeriod } from "@/lib/finance/rollforward";
import Link from "next/link";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";
import type { PeriodStatus } from "@/lib/workspace/types";

const ORDER: PeriodStatus[] = ["DRAFT", "MAPPED", "RECONCILED", "LOCKED"];

export default function AuditPage() {
  const { ws, company, computed, update } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const { line, category } = makeT(ws.lang);
  const [lineKey, setLineKey] = useState("receivables");
  const [filter, setFilter] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const chain = useMemo(() => verifyAudit(ws.audit), [ws.audit]);
  const entries = ws.audit.filter((e) => !company || e.companyId === company.id || e.companyId === "-").filter((e) => (filter ? `${e.action} ${e.entity} ${e.recordId ?? ""} ${e.reason ?? ""}`.toLowerCase().includes(filter.toLowerCase()) : true));
  const isCfo = ws.profile.role === "CFO";

  const setStatus = (to: PeriodStatus, reason?: string) =>
    update(
      { action: `period.${to.toLowerCase()}`, entity: "financial_periods", reason },
      (c) => {
        const next = { ...c, period: { ...c.period, status: to, lockedAt: to === "LOCKED" ? new Date().toISOString() : null, lockedBy: to === "LOCKED" ? ws.profile.name : null, mappingConfirmed: to === "DRAFT" ? false : c.period.mappingConfirmed } };
        // Locking freezes the board pack: the exact state it was produced from, hashed for evidence.
        return to === "LOCKED" ? { ...next, boardPacks: [...c.boardPacks, snapshotPack(next, ws.profile.name)] } : next;
      },
      { allowWhenLocked: true },
    );

  const roll = () =>
    update(
      { action: "period.rollForward", entity: "financial_periods", reason: `${company?.period.currentLabel} closed` },
      (c) => rollForwardCompany(c, computeCompany(c).rows),
      { allowWhenLocked: true },
    );

  const current = company?.period.status ?? "DRAFT";
  const next = ORDER[ORDER.indexOf(current) + 1];

  return (
    <Page title={L("17 · Audit trail, lineage & period lock", "١٧ · سجل التدقيق والتتبع وإقفال الفترة")} subtitle={L("Hash-chained log of every change, a lineage explorer from statement line to source file, and the period state machine.", "سجل متسلسل بالبصمات لكل تعديل، ومستكشف تتبع من بند القائمة حتى ملف المصدر، ومراحل حالة الفترة.")}>
      <NeedsData>
        {company && computed?.analysis && (
          <>
            <Card title={L("Period state machine", "مراحل حالة الفترة")}>
              <div className="steps">
                {ORDER.map((s) => (
                  <span key={s} className={`step ${s === current ? "active" : ORDER.indexOf(s) < ORDER.indexOf(current) ? "done" : ""}`}>
                    {s}
                  </span>
                ))}
              </div>
              <ul className="checklist">
                {computed.checks.map((ch) => (
                  <li key={ch.key} className={ch.ok ? "ok" : "todo"}>
                    {ch.ok ? "✓" : "○"} {L(...CHECK_LABELS[ch.key])} <span className="muted small">({L("needed for", "مطلوب لـ")} {ch.requiredFor})</span>
                  </li>
                ))}
              </ul>
              <div className="actions">
                {next && (
                  <button disabled={(next === "LOCKED" && !isCfo) || !canAdvance(computed.checks, next)} onClick={() => setStatus(next)}>
                    {next === "LOCKED" ? L("Lock period", "إقفال الفترة") : `${L("Advance to", "الانتقال إلى")} ${next}`}
                  </button>
                )}
                {current !== "DRAFT" && (
                  <>
                    <input
                      id="reopen-reason"
                      placeholder={L("Reason for reopening (logged)", "سبب إعادة الفتح (يُسجل)")}
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      disabled={current === "LOCKED" && !isCfo}
                    />
                    <button
                      className="ghost"
                      disabled={(current === "LOCKED" && !isCfo) || !reopenReason.trim()}
                      onClick={() => {
                        setStatus("DRAFT", reopenReason.trim());
                        setReopenReason("");
                      }}
                    >
                      {current === "LOCKED" ? L("Authorised reopening", "إعادة فتح معتمدة") : L("Back to draft", "العودة للمسودة")}
                    </button>
                  </>
                )}
              </div>
              {next === "LOCKED" && !isCfo && <p className="small muted">{L("Only the CFO role can lock or reopen.", "فقط دور المدير المالي يمكنه الإقفال أو إعادة الفتح.")}</p>}
              {company.period.lockedAt && (
                <p className="small">
                  🔒 {L("Locked", "مقفلة")} {new Date(company.period.lockedAt).toLocaleString()} · {company.period.lockedBy}
                </p>
              )}
              {current === "LOCKED" && (
                <div className="actions">
                  <button disabled={!isCfo} onClick={roll}>
                    {L("Start next period", "بدء الفترة التالية")}: {nextPeriod(company.period).currentLabel}
                  </button>
                  <span className="muted small">{L("Archives this period, carries closing balances forward as opening balances (P&L closed to retained earnings at year end) and keeps them as comparatives.", "يؤرشف الفترة ويرحّل الأرصدة الختامية كأرصدة افتتاحية (مع إقفال قائمة الدخل في الأرباح المرحلة في نهاية السنة) ويحتفظ بها للمقارنة.")}</span>
                </div>
              )}
            </Card>

            <Card title={L("Board packs and closed periods", "حزم المجلس والفترات المقفلة")}>
              {!company.boardPacks.length && !company.history.length && <p className="muted small">{L("A board pack is saved automatically each time a period is locked.", "تُحفظ حزمة المجلس تلقائيًا عند كل إقفال للفترة.")}</p>}
              <ul className="small">
                {company.boardPacks.map((p) => (
                  <li key={p.id}>
                    <Link href={`/board-pack?pack=${p.id}`}>{p.periodLabel}</Link> · {new Date(p.createdAt).toLocaleString()} · {p.createdBy} · <span className="mono muted">{p.hash.slice(0, 12)}</span>
                  </li>
                ))}
                {company.history.map((h) => (
                  <li key={h.id}>
                    {L("Closed period", "فترة مقفلة")} {h.label} ({h.start} → {h.end}) · {h.rows.length} {L("accounts", "حساب")} · {L("archived", "أُرشفت")} {new Date(h.archivedAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title={L("Lineage explorer", "مستكشف التتبع")}>
              <select value={lineKey} onChange={(e) => setLineKey(e.target.value)}>
                {Object.keys(LINE_CATEGORIES).map((k) => (
                  <option key={k} value={k}>
                    {line(k)}
                  </option>
                ))}
              </select>
              <div className="lineage">
                <div className="lnode">
                  <div className="muted small">{L("Statement line", "بند القائمة")}</div>
                  <strong>{line(lineKey)}</strong>
                  <div>{f.n(computed.analysis.current[lineKey as keyof typeof computed.analysis.current] as number)}</div>
                </div>
                <div className="larrow">→</div>
                <div className="lnode">
                  <div className="muted small">{L("Canonical category", "التصنيف الموحد")}</div>
                  {LINE_CATEGORIES[lineKey].map((c) => (
                    <strong key={c}>{category(c)}</strong>
                  ))}
                </div>
                <div className="larrow">→</div>
                <div className="lcol">
                  {computed.rows
                    .filter((r) => LINE_CATEGORIES[lineKey].includes(r.category as never))
                    .map((r) => {
                      const doc = company.docs.find((d) => d.id === r.sourceDocId);
                      return (
                        <div key={r.code} className="lpath">
                          <div className="lnode">
                            <div className="muted small">{L("TB account · rule", "حساب الميزان · القاعدة")}</div>
                            {r.code} {r.name}
                            <div className="small">{r.mappingRule}</div>
                            <div>{f.n(r.currentDebit - r.currentCredit)}</div>
                          </div>
                          <div className="larrow">→</div>
                          <div className="lnode">
                            <div className="muted small">{L("Source", "المصدر")}</div>
                            {doc ? (
                              <>
                                {doc.fileName} · {L("row", "سطر")} {r.sourceRow}
                                <div className="mono small">{doc.sha256.slice(0, 24)}…</div>
                              </>
                            ) : (
                              <span className="small">{r.sourceDocId ?? L("adjusting entry", "قيد تسوية")}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </Card>
          </>
        )}
      </NeedsData>

      <Card
        title={L("Immutable audit log", "سجل التدقيق غير القابل للتعديل")}
        actions={chain.valid ? <Pill kind="good">✓ {L("hash chain verified", "تم التحقق من التسلسل")}</Pill> : <Pill kind="bad">{L("chain broken at", "انقطع التسلسل عند")} #{chain.brokenAt}</Pill>}
      >
        <input placeholder={L("Filter by action, entity, reason…", "تصفية بالإجراء أو الكيان أو السبب…")} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="scroll">
          <table className="compact">
            <thead>
              <tr>
                <th>#</th>
                <th>{L("Time", "الوقت")}</th>
                <th>{L("User", "المستخدم")}</th>
                <th>{L("Action", "الإجراء")}</th>
                <th>{L("Entity", "الكيان")}</th>
                <th>{L("Reason", "السبب")}</th>
                <th>{L("Before → after", "قبل ← بعد")}</th>
                <th>IP</th>
                <th>{L("Hash", "البصمة")}</th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().slice(0, 300).map((e) => (
                <tr key={e.seq}>
                  <td>{e.seq}</td>
                  <td className="small">{new Date(e.timestamp).toLocaleString()}</td>
                  <td>{e.userId} <span className="muted small">{e.role}</span></td>
                  <td>{e.action}</td>
                  <td>{e.entity} {e.recordId && <span className="muted small">{e.recordId}</span>}</td>
                  <td className="small">{e.reason ?? ""}</td>
                  <td className="small mono diff">{e.before !== undefined || e.after !== undefined ? `${JSON.stringify(e.before ?? null).slice(0, 80)} → ${JSON.stringify(e.after ?? null).slice(0, 80)}` : ""}</td>
                  <td className="muted small">{e.ip ?? L("n/a (local)", "غير متاح")}</td>
                  <td className="mono small">{e.hash.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ws.audit.length && <Banner kind="info">{L("No actions recorded yet.", "لا توجد إجراءات مسجلة بعد.")}</Banner>}
        <p className="muted small">{L("Each entry stores the SHA-256 of its content plus the previous entry's hash; editing any past entry breaks verification. The browser cannot see its public IP, so IP is recorded only in a server deployment.", "كل سجل يحفظ بصمة SHA-256 لمحتواه مع بصمة السجل السابق؛ تعديل أي سجل سابق يكسر التحقق. المتصفح لا يرى عنوان IP العام، لذا يُسجل فقط في النشر على خادم.")}</p>
      </Card>
      <AiPanel module="audit" />
    </Page>
  );
}
