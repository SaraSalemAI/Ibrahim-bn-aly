import { gateway, streamText } from "ai";
import { z } from "zod";
import { moduleFacts, MODULES } from "@/lib/ai/facts";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { companySchema, errorMessage, gatewayConfigured, modelId, notConfigured, readJson } from "@/lib/ai/payload";
import { computeCompany } from "@/lib/workspace/compute";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  module: z.enum(MODULES).default("overview"),
  language: z.enum(["en", "ar"]).default("en"),
  company: companySchema,
  peers: z.array(companySchema).max(20).default([]),
  benchmarks: z.record(z.string(), z.number().nullable()).default({}),
  audit: z.array(z.any()).max(5000).default([]),
});

export async function GET() {
  return Response.json({ configured: gatewayConfigured(), model: modelId() });
}

export async function POST(req: Request) {
  if (!gatewayConfigured()) return notConfigured();
  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = requestSchema.safeParse(read.body);
  if (!parsed.success) {
    return Response.json({ error: "badRequest", message: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { module, language, company, peers, benchmarks, audit } = parsed.data;
  if (company.rows.length === 0) return Response.json({ error: "badRequest", message: "Load a trial balance first." }, { status: 400 });

  // Recompute on the server so the model only ever sees figures produced by the deterministic engine.
  const facts = moduleFacts(module, company, computeCompany(company), { companies: [company, ...peers], benchmarks, audit });

  const result = streamText({
    model: gateway(modelId()),
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(module, facts, language),
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
