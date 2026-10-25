import { parseInbound, sameSecret } from "@/lib/intake/parse";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Inbound-email webhook: stores the attachments of a message for the workspace named in the
 * recipient address (tb+<workspace>@your-inbound-domain) or the x-workspace-key header. Needs
 * INTAKE_SECRET (sent by the mail provider as x-intake-secret or ?secret=), SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY. The files are not read here: the analyst imports them from the app.
 */
export async function POST(req: Request) {
  const secret = process.env.INTAKE_SECRET ?? "";
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !service) return Response.json({ error: "notConfigured", message: "Email intake needs INTAKE_SECRET, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 501 });
  const given = req.headers.get("x-intake-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (!sameSecret(given, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > 60 * 1024 * 1024) return Response.json({ error: "tooLarge" }, { status: 413 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "badRequest", message: "Send the message as JSON." }, { status: 400 });
  }
  const msg = parseInbound(body, req.headers.get("x-workspace-key"));
  if (!msg.workspaceKey) return Response.json({ error: "badRequest", message: "No workspace key in the recipient address or x-workspace-key header." }, { status: 400 });
  if (!msg.attachments.length) return Response.json({ stored: 0, skipped: msg.skipped });
  const rows = msg.attachments.map((a) => ({ workspace_key: msg.workspaceKey, sender: msg.from.slice(0, 320), subject: msg.subject.slice(0, 500), file_name: a.fileName, content_type: a.contentType, size: a.size, content_base64: a.base64 }));
  const res = await fetch(`${url}/rest/v1/intake_files`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error("Intake store failed:", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "storeFailed", message: res.status === 409 || res.status === 400 ? "Unknown workspace key." : `HTTP ${res.status}` }, { status: 502 });
  }
  return Response.json({ stored: rows.length, skipped: msg.skipped });
}
