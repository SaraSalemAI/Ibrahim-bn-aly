"use client";

import { useState } from "react";
import { Banner, Card, Field, Page, Pill } from "@/components/ui";
import { IS_STATIC } from "@/lib/env";
import * as Sync from "@/lib/sync/supabase";
import { useL, useWorkspace } from "@/lib/workspace/store";
import type { SyncSettings } from "@/lib/workspace/types";

const DEFAULT: SyncSettings = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  email: "",
  workspaceKey: "",
  accessToken: null,
  refreshToken: null,
  remoteVersion: 0,
  lastSyncedAt: null,
  auto: false,
};

export default function TeamPage() {
  const { ws, dispatch } = useWorkspace();
  const L = useL();
  const s = ws.sync ?? DEFAULT;
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [members, setMembers] = useState<Array<{ email: string; role: string }> | null>(null);
  const [invite, setInvite] = useState({ email: "", role: "ANALYST" as "ANALYST" | "REVIEWER" | "CFO" });

  const set = (patch: Partial<SyncSettings>) => dispatch({ type: "setSync", sync: { ...s, ...patch } });
  const signedIn = !!s.accessToken;

  // Retries once with a refreshed session when the access token has expired.
  const run = async <T,>(fn: (cur: SyncSettings) => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setMsg(null);
    try {
      try {
        return await fn(s);
      } catch (e) {
        if (!/JWT|expired|401/i.test((e as Error).message) || !s.refreshToken) throw e;
        const t = await Sync.refresh(s);
        const next = { ...s, ...t };
        dispatch({ type: "setSync", sync: next });
        return await fn(next);
      }
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doPull = () =>
    run(async (cur) => {
      const remote = await Sync.pull(cur);
      if (!remote) {
        setMsg({ kind: "info", text: L("Nothing saved under this workspace key yet. Push to create it.", "لا يوجد شيء محفوظ بهذا المفتاح بعد. ارفع لإنشائه.") });
        return;
      }
      dispatch({ type: "replaceWorkspace", ws: remote.data, reason: `version ${remote.version} by ${remote.updated_email ?? "?"}` });
      dispatch({ type: "setSync", sync: { ...cur, remoteVersion: remote.version, lastSyncedAt: new Date().toISOString() } });
      setMsg({ kind: "ok", text: L(`Pulled version ${remote.version} (saved by ${remote.updated_email ?? "unknown"}).`, `تم سحب الإصدار ${remote.version} (حفظه ${remote.updated_email ?? "غير معروف"}).`) });
    });

  const doPush = () =>
    run(async (cur) => {
      const r = await Sync.push(cur, ws);
      if (!r.ok) {
        setMsg({ kind: "error", text: L("Someone saved a newer version. Pull it first, then redo your change and push.", "قام شخص آخر بحفظ إصدار أحدث. اسحبه أولًا ثم أعد تعديلك وارفع.") });
        return;
      }
      dispatch({ type: "setSync", sync: { ...cur, remoteVersion: r.version, lastSyncedAt: new Date().toISOString() } });
      setMsg({ kind: "ok", text: L(`Saved as version ${r.version}.`, `تم الحفظ كإصدار ${r.version}.`) });
    });

  return (
    <Page
      title={L("Team & sync", "الفريق والمزامنة")}
      subtitle={L(
        "Share one workspace with your team through your own Supabase project: email sign-in, members with roles, and versioned saves so nobody overwrites another's work.",
        "شارك مساحة عمل واحدة مع فريقك عبر مشروع Supabase الخاص بك: دخول بالبريد، وأعضاء بأدوار، وحفظ بإصدارات حتى لا يكتب أحد فوق عمل غيره.",
      )}
    >
      {IS_STATIC ? (
        <Banner kind="info">{L("Team sync needs the full app (this HTML page cannot reach your database). Your work here stays in this browser.", "المزامنة تحتاج التطبيق الكامل (هذه الصفحة لا تصل لقاعدة البيانات). عملك هنا يبقى في هذا المتصفح.")}</Banner>
      ) : (
        <>
          <Card title={L("1 · Connect your Supabase project", "١ · ربط مشروع Supabase")}>
            <p className="small muted">{L("Run supabase/migrations/0002_team_sync.sql in the project once, enable Email sign-in with OTP, then enter the project URL and its public anon key.", "شغّل ملف 0002_team_sync.sql مرة واحدة، وفعّل الدخول بالبريد برمز، ثم أدخل رابط المشروع والمفتاح العام.")}</p>
            <div className="grid">
              <Field label={L("Project URL", "رابط المشروع")}>
                <input value={s.url} placeholder="https://xxxx.supabase.co" onChange={(e) => set({ url: e.target.value.trim() })} />
              </Field>
              <Field label={L("Anon (public) key", "المفتاح العام")}>
                <input value={s.anonKey} onChange={(e) => set({ anonKey: e.target.value.trim() })} />
              </Field>
              <Field label={L("Shared workspace key", "مفتاح مساحة العمل المشتركة")} hint={L("Same key for everyone on the team, e.g. nile-trading-finance", "نفس المفتاح لكل الفريق")}>
                <input value={s.workspaceKey} onChange={(e) => set({ workspaceKey: e.target.value.trim(), remoteVersion: 0 })} />
              </Field>
            </div>
          </Card>

          <Card title={L("2 · Sign in", "٢ · الدخول")} actions={signedIn && <Pill kind="good">{L("signed in", "تم الدخول")} · {s.email}</Pill>}>
            {!signedIn ? (
              <div className="actions">
                <input type="email" placeholder={L("Work email", "البريد")} value={s.email} onChange={(e) => set({ email: e.target.value.trim() })} />
                <button
                  disabled={busy || !s.url || !s.anonKey || !s.email}
                  onClick={() =>
                    run(async (cur) => {
                      await Sync.sendCode(cur);
                      setCodeSent(true);
                      setMsg({ kind: "info", text: L("A sign-in code was emailed to you.", "تم إرسال رمز الدخول إلى بريدك.") });
                    })
                  }
                >
                  {L("Email me a code", "أرسل لي رمزًا")}
                </button>
                {codeSent && (
                  <>
                    <input inputMode="numeric" placeholder={L("6-digit code", "الرمز")} value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 120 }} />
                    <button
                      disabled={busy || code.trim().length < 6}
                      onClick={() =>
                        run(async (cur) => {
                          const t = await Sync.verifyCode(cur, code);
                          dispatch({ type: "setSync", sync: { ...cur, ...t } });
                          setCode("");
                          setMsg({ kind: "ok", text: L("Signed in.", "تم الدخول.") });
                        })
                      }
                    >
                      {L("Verify", "تحقق")}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button className="ghost" onClick={() => set({ accessToken: null, refreshToken: null })}>
                {L("Sign out", "خروج")}
              </button>
            )}
          </Card>

          {signedIn && s.workspaceKey && (
            <>
              <Card title={L("3 · Sync", "٣ · المزامنة")}>
                <div className="actions">
                  <button disabled={busy} onClick={doPull}>{L("Pull latest", "سحب الأحدث")}</button>
                  <button disabled={busy} onClick={doPush}>{L("Push my changes", "رفع تعديلاتي")}</button>
                </div>
                <p className="small muted">
                  {L("Version", "الإصدار")} {s.remoteVersion || "—"} · {L("last synced", "آخر مزامنة")} {s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString() : "—"}
                </p>
                <p className="small muted">{L("Pulling replaces this browser's workspace with the shared copy (your sign-in and language stay). Push after finishing a piece of work.", "السحب يستبدل مساحة العمل في هذا المتصفح بالنسخة المشتركة. ارفع بعد إنهاء كل جزء من العمل.")}</p>
              </Card>
              <Card title={L("Members", "الأعضاء")} actions={<button className="ghost" disabled={busy} onClick={() => run(async (cur) => setMembers(await Sync.listMembers(cur)))}>{L("Refresh", "تحديث")}</button>}>
                {members && (
                  <ul className="small">
                    {members.map((m) => (
                      <li key={m.email}>
                        {m.email} <Pill>{m.role}</Pill>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="actions">
                  <input type="email" placeholder={L("Colleague's email", "بريد الزميل")} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value.trim() })} />
                  <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as typeof invite.role })}>
                    <option value="ANALYST">Analyst</option>
                    <option value="REVIEWER">Reviewer</option>
                    <option value="CFO">CFO</option>
                  </select>
                  <button
                    disabled={busy || !invite.email}
                    onClick={() =>
                      run(async (cur) => {
                        await Sync.addMember(cur, invite.email, invite.role);
                        setMembers(await Sync.listMembers(cur));
                        setInvite({ ...invite, email: "" });
                      })
                    }
                  >
                    {L("Add member", "إضافة عضو")}
                  </button>
                </div>
                <p className="small muted">{L("Only the workspace's CFO can add members. A colleague must sign in once before they can be added.", "فقط المدير المالي للمساحة يضيف الأعضاء. يجب أن يدخل الزميل مرة أولًا.")}</p>
              </Card>
            </>
          )}
          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
          <p className="small muted">{L("Sign-in tokens are kept in this browser only and are never included in the shared copy.", "رموز الدخول تبقى في هذا المتصفح فقط ولا تُضمّن في النسخة المشتركة.")}</p>
        </>
      )}
    </Page>
  );
}
