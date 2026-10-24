"use client";

import { useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { Banner, Card, NeedsData, Page, Pill } from "@/components/ui";
import { MGMT, MGMT_AR, type NoteStatus } from "@/lib/finance/disclosures";
import { useFormat, useL, useWorkspace } from "@/lib/workspace/store";

const NEXT: Record<NoteStatus, NoteStatus | null> = { DRAFT: "REVIEWED", REVIEWED: "SIGNED_OFF", SIGNED_OFF: null };

export default function DisclosuresPage() {
  const { ws, company, computed, update } = useWorkspace();
  const L = useL();
  const f = useFormat();
  const [lang, setLang] = useState<"en" | "ar">(ws.lang);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (!computed?.analysis || !company) return <Page title={L("12 · Disclosure studio", "١٢ · استوديو الإفصاحات")}><NeedsData>{null}</NeedsData></Page>;
  const ctx = { ...computed.noteCtx, fmt: (n: number) => f.n(n) };
  const status = (id: string): NoteStatus => company.disclosures[id]?.status ?? "DRAFT";
  const text = (id: string, gen: string) => company.disclosures[id]?.override ?? gen;
  const counts = { DRAFT: 0, REVIEWED: 0, SIGNED_OFF: 0 } as Record<NoteStatus, number>;
  computed.notes.forEach((n) => counts[status(n.id)]++);
  const setNote = (id: string, patch: { status?: NoteStatus; override?: string | undefined }, action: string) =>
    update({ action, entity: "disclosure_notes", recordId: id }, (c) => ({ ...c, disclosures: { ...c.disclosures, [id]: { ...(c.disclosures[id] ?? { status: "DRAFT" as NoteStatus }), ...patch } } }), { allowWhenLocked: true });
  const canSign = ws.profile.role !== "ANALYST";

  return (
    <Page title={L("12 · Disclosure studio", "١٢ · استوديو الإفصاحات")} subtitle={L("Notes are triggered by the mapped balances and filled with verified figures. Qualitative facts are left as explicit placeholders, never invented.", "تُفعّل الإيضاحات حسب الأرصدة وتُملأ بأرقام محققة. المعلومات النوعية تُترك كمواضع واضحة ولا تُخترع.")}>
      <div className="actions">
        <button className={lang === "en" ? "chip active" : "chip"} onClick={() => setLang("en")}>English</button>
        <button className={lang === "ar" ? "chip active" : "chip"} onClick={() => setLang("ar")}>العربية</button>
        <span className="muted small">
          {computed.notes.length} {L("notes", "إيضاح")} · {counts.DRAFT} {L("draft", "مسودة")} · {counts.REVIEWED} {L("reviewed", "تمت المراجعة")} · {counts.SIGNED_OFF} {L("signed off", "معتمد")}
        </span>
      </div>
      {!canSign && <Banner kind="info">{L("Analysts can edit drafts; a reviewer or CFO moves notes to Reviewed and Signed off.", "المحلل يعدل المسودات؛ المراجع أو المدير المالي يعتمد الإيضاحات.")}</Banner>}
      {computed.notes.map((n, i) => {
        const gen = n.body(ctx, lang);
        const st = status(n.id);
        const body = text(n.id, gen);
        const placeholders = body.split(MGMT).length - 1 + body.split(MGMT_AR).length - 1;
        return (
          <Card
            key={n.id}
            title={
              <>
                {i + 1}. {lang === "ar" ? n.title[1] : n.title[0]} <span className="muted small">({n.standard})</span>
              </>
            }
            actions={
              <>
                <Pill kind={st === "SIGNED_OFF" ? "good" : st === "REVIEWED" ? "info" : "neutral"}>{{ DRAFT: L("Draft", "مسودة"), REVIEWED: L("Reviewed", "تمت المراجعة"), SIGNED_OFF: L("Signed off 🔒", "معتمد 🔒") }[st]}</Pill>
                {NEXT[st] && (
                  <button className="ghost" disabled={!canSign} onClick={() => setNote(n.id, { status: NEXT[st]! }, `disclosure.${NEXT[st]!.toLowerCase()}`)}>
                    {st === "DRAFT" ? L("Mark reviewed", "تمت المراجعة") : L("Sign off", "اعتماد")}
                  </button>
                )}
                {st === "SIGNED_OFF" && ws.profile.role === "CFO" && (
                  <button className="link" onClick={() => setNote(n.id, { status: "DRAFT" }, "disclosure.reopen")}>
                    {L("Reopen", "إعادة فتح")}
                  </button>
                )}
              </>
            }
          >
            {editing === n.id ? (
              <>
                <textarea rows={5} dir={lang === "ar" ? "rtl" : "ltr"} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: "100%" }} />
                <div className="actions">
                  <button onClick={() => { setNote(n.id, { override: draft }, "disclosure.edit"); setEditing(null); }}>{L("Save", "حفظ")}</button>
                  <button className="ghost" onClick={() => setEditing(null)}>{L("Cancel", "إلغاء")}</button>
                  {company.disclosures[n.id]?.override && (
                    <button className="link" onClick={() => { setNote(n.id, { override: undefined }, "disclosure.regenerate"); setEditing(null); }}>
                      {L("Regenerate from figures", "إعادة التوليد من الأرقام")}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p dir={lang === "ar" ? "rtl" : "ltr"} className="note-text">
                  {body.split(/(\[Management Disclosure Required\]|\[مطلوب إفصاح من الإدارة\])/).map((part, k) =>
                    part === MGMT || part === MGMT_AR ? <mark key={k}>{part}</mark> : <span key={k}>{part}</span>,
                  )}
                </p>
                <div className="actions">
                  {st !== "SIGNED_OFF" && (
                    <button className="link" onClick={() => { setDraft(body); setEditing(n.id); }}>
                      {L("Edit text", "تعديل النص")}
                    </button>
                  )}
                  {placeholders > 0 && <span className="small warn-text">{placeholders} {L("placeholder(s) need management input", "موضع يحتاج إدخال من الإدارة")}</span>}
                  {company.disclosures[n.id]?.override && <span className="small muted">{L("edited text — figures will not refresh automatically", "نص معدل — الأرقام لن تتحدث تلقائيًا")}</span>}
                </div>
              </>
            )}
          </Card>
        );
      })}
      <AiPanel module="disclosures" />
    </Page>
  );
}
