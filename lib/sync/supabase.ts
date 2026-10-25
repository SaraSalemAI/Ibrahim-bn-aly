import type { SyncSettings, Workspace } from "../workspace/types";

/**
 * Team sync through Supabase, without the supabase-js dependency: email one-time-code sign-in
 * (GoTrue) and one row per shared workspace (PostgREST), guarded by row-level security so only
 * members can read or write it. Writes carry the version they were based on, so two people saving
 * at once cannot silently overwrite each other: the second save is refused and must pull first.
 */
export interface RemoteSnapshot {
  workspace_key: string;
  data: Workspace;
  version: number;
  updated_email: string | null;
  updated_at: string;
}

type Fetch = typeof fetch;

const base = (s: Pick<SyncSettings, "url">) => s.url.replace(/\/+$/, "");
const headers = (s: Pick<SyncSettings, "anonKey" | "accessToken">, extra: Record<string, string> = {}) => ({
  apikey: s.anonKey,
  Authorization: `Bearer ${s.accessToken ?? s.anonKey}`,
  "Content-Type": "application/json",
  ...extra,
});

async function fail(res: Response, what: string): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string; error_description?: string };
  throw new Error(`${what}: ${body.msg ?? body.message ?? body.error_description ?? `HTTP ${res.status}`}`);
}

export async function sendCode(s: Pick<SyncSettings, "url" | "anonKey" | "email">, f: Fetch = fetch) {
  const res = await f(`${base(s)}/auth/v1/otp`, { method: "POST", headers: headers({ anonKey: s.anonKey, accessToken: null }), body: JSON.stringify({ email: s.email, create_user: true }) });
  if (!res.ok) await fail(res, "Could not send the sign-in code");
}

export async function verifyCode(s: Pick<SyncSettings, "url" | "anonKey" | "email">, code: string, f: Fetch = fetch) {
  const res = await f(`${base(s)}/auth/v1/verify`, { method: "POST", headers: headers({ anonKey: s.anonKey, accessToken: null }), body: JSON.stringify({ type: "email", email: s.email, token: code.trim() }) });
  if (!res.ok) await fail(res, "The code was not accepted");
  const body = (await res.json()) as { access_token: string; refresh_token: string };
  return { accessToken: body.access_token, refreshToken: body.refresh_token };
}

export async function refresh(s: SyncSettings, f: Fetch = fetch) {
  if (!s.refreshToken) throw new Error("Signed out: sign in again.");
  const res = await f(`${base(s)}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: headers({ anonKey: s.anonKey, accessToken: null }), body: JSON.stringify({ refresh_token: s.refreshToken }) });
  if (!res.ok) await fail(res, "Session expired: sign in again");
  const body = (await res.json()) as { access_token: string; refresh_token: string };
  return { accessToken: body.access_token, refreshToken: body.refresh_token };
}

/** Everything except this device's sign-in. */
export function payload(ws: Workspace): Workspace {
  return { ...ws, sync: null };
}

export async function pull(s: SyncSettings, f: Fetch = fetch): Promise<RemoteSnapshot | null> {
  const res = await f(`${base(s)}/rest/v1/workspace_snapshots?workspace_key=eq.${encodeURIComponent(s.workspaceKey)}&select=*`, { headers: headers(s) });
  if (!res.ok) await fail(res, "Could not read the shared workspace");
  const rows = (await res.json()) as RemoteSnapshot[];
  return rows[0] ?? null;
}

/**
 * Saves the workspace. The first save creates the shared row (and makes the caller its owner);
 * later saves only succeed if nobody else saved since `s.remoteVersion`.
 */
export async function push(s: SyncSettings, ws: Workspace, f: Fetch = fetch): Promise<{ ok: true; version: number } | { ok: false; conflict: true }> {
  const data = payload(ws);
  if (s.remoteVersion === 0) {
    const res = await f(`${base(s)}/rest/v1/workspace_snapshots`, { method: "POST", headers: headers(s, { Prefer: "return=representation" }), body: JSON.stringify({ workspace_key: s.workspaceKey, data, version: 1, updated_email: s.email }) });
    if (res.status === 409) return { ok: false, conflict: true };
    if (!res.ok) await fail(res, "Could not create the shared workspace");
    return { ok: true, version: 1 };
  }
  const url = `${base(s)}/rest/v1/workspace_snapshots?workspace_key=eq.${encodeURIComponent(s.workspaceKey)}&version=eq.${s.remoteVersion}`;
  const res = await f(url, { method: "PATCH", headers: headers(s, { Prefer: "return=representation" }), body: JSON.stringify({ data, version: s.remoteVersion + 1, updated_email: s.email, updated_at: new Date().toISOString() }) });
  if (!res.ok) await fail(res, "Could not save to the shared workspace");
  const rows = (await res.json()) as RemoteSnapshot[];
  return rows.length ? { ok: true, version: rows[0].version } : { ok: false, conflict: true };
}

export async function addMember(s: SyncSettings, email: string, role: "ANALYST" | "REVIEWER" | "CFO", f: Fetch = fetch) {
  const res = await f(`${base(s)}/rest/v1/rpc/add_workspace_member`, { method: "POST", headers: headers(s), body: JSON.stringify({ p_workspace_key: s.workspaceKey, p_email: email, p_role: role }) });
  if (!res.ok) await fail(res, "Could not add the member");
}

export async function listMembers(s: SyncSettings, f: Fetch = fetch): Promise<Array<{ email: string; role: string }>> {
  const res = await f(`${base(s)}/rest/v1/rpc/list_workspace_members`, { method: "POST", headers: headers(s), body: JSON.stringify({ p_workspace_key: s.workspaceKey }) });
  if (!res.ok) await fail(res, "Could not list members");
  return res.json();
}
