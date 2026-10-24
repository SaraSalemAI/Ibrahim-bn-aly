import { z } from "zod";
import { CATEGORIES } from "../finance/types";
import { migrateCompany } from "../workspace/defaults";
import type { Company } from "../workspace/types";

const amount = z.number().finite();

export const rowSchema = z.object({
  code: z.string().max(64),
  name: z.string().max(256),
  category: z.union([z.enum(CATEGORIES), z.literal("")]),
  suggested: z.boolean(),
  currentDebit: amount,
  currentCredit: amount,
  priorDebit: amount,
  priorCredit: amount,
  sourceRow: z.number().int(),
  sourceDocId: z.string().max(64).optional(),
  currency: z.string().max(8).optional(),
  mappingRule: z.string().max(128).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

/** The rows are validated strictly; the rest of the company is normalised through the same migration used on load. */
export const companySchema = z
  .object({ id: z.string().max(64), rows: z.array(rowSchema).max(20000) })
  .passthrough()
  .transform((c) => migrateCompany(c as unknown as Partial<Company>));

export const MAX_BODY_BYTES = 8 * 1024 * 1024;

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return { ok: false, response: Response.json({ error: "tooLarge", message: "Request body is too large." }, { status: 413 }) };
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, response: Response.json({ error: "badRequest", message: "Body must be JSON." }, { status: 400 }) };
  }
}

export function gatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";
export const modelId = () => process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL;

export const notConfigured = () =>
  Response.json({ error: "notConfigured", message: "AI Gateway is not configured. Set AI_GATEWAY_API_KEY (or deploy on Vercel with OIDC)." }, { status: 503 });

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
