import { gateway, streamText } from "ai";
import { z } from "zod";
import { analyze } from "@/lib/finance/engine";
import { CATEGORIES } from "@/lib/finance/types";
import { buildFacts, buildUserPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

const amount = z.number().finite();
const driversSchema = z.object({
  revenueGrowth: z.number().min(-1).max(10),
  grossMargin: z.number().min(-1).max(1),
  opexPctRevenue: z.number().min(0).max(5),
  financeCostChange: z.number().min(-1).max(10),
  taxRate: z.number().min(0).max(1),
});

const requestSchema = z.object({
  rows: z
    .array(
      z.object({
        code: z.string().max(64),
        name: z.string().max(256),
        category: z.union([z.enum(CATEGORIES), z.literal("")]),
        suggested: z.boolean(),
        currentDebit: amount,
        currentCredit: amount,
        priorDebit: amount,
        priorCredit: amount,
        sourceRow: z.number().int(),
      }),
    )
    .min(1)
    .max(5000),
  drivers: z.object({ base: driversSchema, bull: driversSchema, bear: driversSchema }).optional(),
  companyName: z.string().max(200).default(""),
  currency: z.string().max(8).default("EGP"),
  currentLabel: z.string().max(40).default("Current period"),
  priorLabel: z.string().max(40).default("Prior period"),
  periodDays: z.number().int().min(1).max(366).default(365),
  language: z.enum(["en", "ar"]).default("en"),
  focus: z.enum(["all", "variances", "ratios", "forecast"]).default("all"),
});

function gatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export async function GET() {
  return Response.json({ configured: gatewayConfigured(), model: process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL });
}

export async function POST(req: Request) {
  if (!gatewayConfigured()) {
    return Response.json(
      { error: "notConfigured", message: "AI Gateway is not configured. Set AI_GATEWAY_API_KEY (or deploy on Vercel with OIDC)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "badRequest", message: "Body must be JSON." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "badRequest", message: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const input = parsed.data;
  // Recompute on the server so the model only ever sees figures produced by the deterministic engine.
  const analysis = analyze(input.rows, input.drivers, input.periodDays);
  const ctx = { ...input };
  const facts = buildFacts(analysis, input.rows, ctx);

  const result = streamText({
    model: gateway(process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL),
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(facts, ctx),
    maxOutputTokens: 2000,
    abortSignal: req.signal,
  });

  // Wait for the first piece of text so gateway failures (bad key, unknown model, quota) come back
  // as a proper error status instead of an empty 200 stream.
  const parts = result.stream[Symbol.asyncIterator]();
  const first = await nextText(parts);
  if (first.kind !== "text") {
    const message = first.kind === "error" ? errorMessage(first.error) : "The model returned no text.";
    console.error("AI Gateway error:", first.kind === "error" ? first.error : message);
    return Response.json({ error: "gatewayError", message }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(first.text));
    },
    async pull(controller) {
      const next = await nextText(parts);
      if (next.kind === "text") {
        controller.enqueue(encoder.encode(next.text));
      } else {
        if (next.kind === "error") {
          console.error("AI Gateway stream error:", next.error);
          controller.enqueue(encoder.encode(`\n\n[Explanation interrupted: ${errorMessage(next.error)}]`));
        }
        controller.close();
      }
    },
    async cancel() {
      await parts.return?.();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

type Next = { kind: "text"; text: string } | { kind: "error"; error: unknown } | { kind: "done" };

async function nextText(parts: AsyncIterator<{ type: string; text?: string; error?: unknown }>): Promise<Next> {
  try {
    for (;;) {
      const { done, value } = await parts.next();
      if (done) return { kind: "done" };
      if (value.type === "text-delta" && value.text) return { kind: "text", text: value.text };
      if (value.type === "error") return { kind: "error", error: value.error };
    }
  } catch (error) {
    return { kind: "error", error };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
