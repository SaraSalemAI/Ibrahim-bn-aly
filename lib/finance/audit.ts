import { sha256 } from "./hash";

export interface AuditEntry {
  seq: number;
  timestamp: string;
  userId: string;
  role: string;
  companyId: string;
  action: string;
  entity: string;
  recordId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  /** Not available in local mode: the browser cannot see its own public IP. */
  ip: string | null;
  prevHash: string;
  hash: string;
}

const body = (e: Omit<AuditEntry, "hash">) => JSON.stringify([e.seq, e.timestamp, e.userId, e.role, e.companyId, e.action, e.entity, e.recordId ?? null, e.reason ?? null, e.before ?? null, e.after ?? null, e.ip, e.prevHash]);

/** Append-only, hash-chained log: each entry commits to the previous hash, so any edit breaks verification. */
export function appendAudit(log: AuditEntry[], e: Omit<AuditEntry, "seq" | "prevHash" | "hash" | "timestamp" | "ip"> & { timestamp?: string }): AuditEntry[] {
  const prev = log[log.length - 1];
  const entry: Omit<AuditEntry, "hash"> = {
    ...e,
    seq: (prev?.seq ?? 0) + 1,
    timestamp: e.timestamp ?? new Date().toISOString(),
    ip: null,
    prevHash: prev?.hash ?? "GENESIS",
  };
  return [...log, { ...entry, hash: sha256(body(entry)) }];
}

export function verifyAudit(log: AuditEntry[]): { valid: boolean; brokenAt: number | null } {
  let prev = "GENESIS";
  for (const e of log) {
    const { hash, ...rest } = e;
    if (e.prevHash !== prev || sha256(body(rest)) !== hash) return { valid: false, brokenAt: e.seq };
    prev = hash;
  }
  return { valid: true, brokenAt: null };
}

/** Keeps audit payloads small: large arrays are summarised rather than stored whole. */
export function summarise(v: unknown): unknown {
  if (Array.isArray(v)) return v.length > 20 ? { items: v.length } : v;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) && x.length > 20 ? { items: x.length } : x]));
  return v;
}
