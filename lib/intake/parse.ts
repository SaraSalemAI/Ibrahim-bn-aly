/**
 * Inbound email for file intake. Mail providers (Postmark, SendGrid, Mailgun, Cloudflare Email
 * Workers, a Zapier/Make step) post the message to /api/intake; the attachments are stored for the
 * workspace and picked up by "Check inbox" on the upload tab, where they go through the same
 * automatic pipeline as dropped files. Two JSON shapes are accepted: Postmark's and a generic one.
 */
export interface IntakeAttachment {
  fileName: string;
  contentType: string;
  base64: string;
  size: number;
}

export interface IntakeMessage {
  from: string;
  to: string;
  subject: string;
  workspaceKey: string | null;
  attachments: IntakeAttachment[];
  skipped: Array<{ fileName: string; reason: string }>;
}

export const MAX_ATTACHMENTS = 20;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const ALLOWED = /\.(csv|txt|tsv|prn|xlsx|xlsm|xls|ods|xml|json|zip|pdf|png|jpe?g|webp|docx|dbf|sta|mt940|940|ofx|qfx|htm|html)$/i;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** "Finance <tb+acme-2025@in.example.com>" → "acme-2025": the plus tag, else the local part. */
export function workspaceFromAddress(to: string): string | null {
  const addr = to.match(/<([^>]+)>/)?.[1] ?? to.split(",")[0].trim();
  const local = addr.split("@")[0] ?? "";
  const key = (local.includes("+") ? local.split("+").slice(1).join("+") : local).trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,79}$/.test(key) ? key : null;
}

export function parseInbound(body: unknown, headerKey?: string | null): IntakeMessage {
  const b = (body ?? {}) as Record<string, unknown>;
  const from = str(b.From) || str((b.FromFull as Record<string, unknown> | undefined)?.Email) || str(b.from);
  const to = str(b.OriginalRecipient) || str(b.To) || str(b.to);
  const subject = str(b.Subject) || str(b.subject);
  const raw = (Array.isArray(b.Attachments) ? b.Attachments : Array.isArray(b.attachments) ? b.attachments : []) as Array<Record<string, unknown>>;
  const attachments: IntakeAttachment[] = [];
  const skipped: IntakeMessage["skipped"] = [];
  for (const a of raw) {
    const fileName = (str(a.Name) || str(a.filename) || str(a.name) || "attachment").replace(/[\\/]/g, "_").slice(0, 200);
    const base64 = (str(a.Content) || str(a.content)).replace(/\s+/g, "");
    const contentType = str(a.ContentType) || str(a.contentType) || str(a.type) || "application/octet-stream";
    const size = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (!ALLOWED.test(fileName)) skipped.push({ fileName, reason: "file type not accepted" });
    else if (!base64 || !/^[A-Za-z0-9+/]+=*$/.test(base64)) skipped.push({ fileName, reason: "no readable content" });
    else if (size > MAX_ATTACHMENT_BYTES) skipped.push({ fileName, reason: "larger than 15 MB" });
    else if (attachments.length >= MAX_ATTACHMENTS) skipped.push({ fileName, reason: `more than ${MAX_ATTACHMENTS} attachments` });
    else attachments.push({ fileName, contentType, base64, size });
  }
  const key = headerKey?.trim().toLowerCase() || workspaceFromAddress(to);
  return { from, to, subject, workspaceKey: key && /^[a-z0-9][a-z0-9._-]{2,79}$/.test(key) ? key : null, attachments, skipped };
}

/** Constant-time comparison for the shared webhook secret. */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
