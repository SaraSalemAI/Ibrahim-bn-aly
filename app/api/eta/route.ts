import { z } from "zod";
import { errorMessage, readJson } from "@/lib/ai/payload";
import { etaConfig, searchIssued } from "@/lib/eta/client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const cfg = etaConfig();
  return Response.json({ configured: !!cfg, env: cfg?.env ?? null });
}

const requestSchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Pulls the company's issued, valid e-invoices for the period from the ETA portal (read-only). */
export async function POST(req: Request) {
  const cfg = etaConfig();
  if (!cfg) return Response.json({ error: "notConfigured", message: "ETA API credentials are not set. Add ETA_CLIENT_ID, ETA_CLIENT_SECRET and ETA_ENV (preprod or prod) to the server environment." }, { status: 503 });
  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = requestSchema.safeParse(read.body);
  if (!parsed.success || parsed.data.from > parsed.data.to) return Response.json({ error: "badRequest", message: "Give a from/to date range (YYYY-MM-DD)." }, { status: 400 });
  try {
    return Response.json(await searchIssued(cfg, parsed.data.from, parsed.data.to));
  } catch (e) {
    console.error("ETA pull error:", e);
    return Response.json({ error: "etaError", message: errorMessage(e) }, { status: 502 });
  }
}
