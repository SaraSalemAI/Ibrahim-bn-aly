import type { EtaDocument } from "../finance/subledgers";

/**
 * Read-only client for the Egyptian Tax Authority e-invoicing API (identity service + document search).
 * It pulls documents the company has issued for reconciliation; it does not sign or submit invoices,
 * which needs the company's e-seal (USB token / HSM).
 */
const HOSTS = {
  prod: { id: "https://id.eta.gov.eg", api: "https://api.invoicing.eta.gov.eg" },
  preprod: { id: "https://id.preprod.eta.gov.eg", api: "https://api.preprod.invoicing.eta.gov.eg" },
} as const;

export type EtaEnv = keyof typeof HOSTS;
export type EtaConfig = { clientId: string; clientSecret: string; env: EtaEnv };

export function etaConfig(): EtaConfig | null {
  const clientId = process.env.ETA_CLIENT_ID;
  const clientSecret = process.env.ETA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, env: process.env.ETA_ENV === "prod" ? "prod" : "preprod" };
}

type Fetch = typeof fetch;

export async function etaToken(cfg: EtaConfig, f: Fetch = fetch): Promise<string> {
  const res = await f(`${HOSTS[cfg.env].id}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: "InvoicingAPI" }),
  });
  if (!res.ok) throw new Error(`ETA sign-in failed (HTTP ${res.status}). Check ETA_CLIENT_ID / ETA_CLIENT_SECRET and ETA_ENV.`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("ETA sign-in returned no access token.");
  return body.access_token;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** Search results carry totals but no tax breakdown; VAT is taken as total − net amount. */
export function fromSearchResult(o: Record<string, unknown>): EtaDocument {
  const net = num(o.netAmount ?? o.totalSales);
  const total = num(o.total);
  const t = String(o.typeName ?? o.documentType ?? "i").toLowerCase();
  return {
    uuid: String(o.uuid ?? ""),
    internalId: String(o.internalId ?? ""),
    issuerId: String(o.issuerId ?? ""),
    receiverId: String(o.receiverId ?? ""),
    receiverType: String(o.receiverType ?? ""),
    type: t.startsWith("c") ? "C" : t.startsWith("d") ? "D" : "I",
    dateIssued: String(o.dateTimeIssued ?? o.dateTimeReceived ?? "").slice(0, 10),
    netAmount: net,
    vat: Math.max(0, Math.round((total - net) * 100) / 100),
    wht: 0,
    total,
  };
}

/** 30-day windows: the search endpoint limits the range of one query. */
export function windows(from: string, to: string, days = 30): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let s = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T23:59:59Z`);
  while (s <= end) {
    const e = Math.min(end, s + days * 86_400_000 - 1000);
    out.push([new Date(s).toISOString().replace(".000", ""), new Date(e).toISOString().replace(".000", "")]);
    s = e + 1000;
  }
  return out;
}

export async function searchIssued(cfg: EtaConfig, from: string, to: string, f: Fetch = fetch) {
  const token = await etaToken(cfg, f);
  const docs: EtaDocument[] = [];
  let calls = 0;
  for (const [a, b] of windows(from, to)) {
    let continuation = "";
    do {
      const q = new URLSearchParams({ submissionDateFrom: a, submissionDateTo: b, direction: "Sent", status: "Valid", pageSize: "100" });
      if (continuation) q.set("continuationToken", continuation);
      const res = await f(`${HOSTS[cfg.env].api}/api/v1.0/documents/search?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      calls++;
      if (!res.ok) throw new Error(`ETA document search failed (HTTP ${res.status}).`);
      const body = (await res.json()) as { result?: Record<string, unknown>[]; metadata?: { continuationToken?: string } };
      docs.push(...(body.result ?? []).map(fromSearchResult));
      const next = body.metadata?.continuationToken;
      continuation = next && next !== "EndofResultSet" ? next : "";
    } while (continuation && calls < 500);
  }
  const seen = new Set<string>();
  const documents = docs.filter((d) => {
    if (seen.has(d.uuid)) return false;
    seen.add(d.uuid);
    return true;
  });
  return { documents, calls, env: cfg.env };
}
