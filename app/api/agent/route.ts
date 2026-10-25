import { gateway, stepCountIs, streamText } from "ai";
import { z } from "zod";
import { buildAgentTools, MAX_AGENT_STEPS, type AgentEvent } from "@/lib/agent/tools";
import { AGENT_SYSTEM } from "@/lib/agent/prompt";
import { companySchema, errorMessage, gatewayConfigured, modelId, notConfigured, readJson } from "@/lib/ai/payload";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  company: companySchema,
  peers: z.array(companySchema).max(20).default([]),
  groups: z.array(z.object({ id: z.string(), name: z.string().max(200), parentId: z.string(), members: z.array(z.object({ companyId: z.string(), ownership: z.number().min(0).max(1) })).max(50) })).max(20).default([]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === "user", "The last message must be from the user"),
});

export async function POST(req: Request) {
  if (!gatewayConfigured()) return notConfigured();
  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = requestSchema.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "badRequest", message: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { company, peers, groups, messages } = parsed.data;
  const tools = buildAgentTools(company, peers, groups);
  if (!tools) return Response.json({ error: "badRequest", message: "Load a trial balance first." }, { status: 400 });

  const result = streamText({
    model: gateway(modelId()),
    system: AGENT_SYSTEM,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens: 2500,
    abortSignal: req.signal,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let steps = 0;
      try {
        for await (const part of result.stream) {
          switch (part.type) {
            case "text-delta":
              if (part.text) send({ type: "text", text: part.text });
              break;
            case "tool-call":
              send({ type: "tool-call", id: part.toolCallId, name: part.toolName, input: part.input });
              break;
            case "tool-result":
              send({ type: "tool-result", id: part.toolCallId, name: part.toolName, output: part.output });
              break;
            case "tool-error":
              send({ type: "tool-error", id: part.toolCallId, name: part.toolName, error: errorMessage(part.error) });
              break;
            case "finish-step":
              steps++;
              break;
            case "error":
              console.error("AI agent error:", part.error);
              send({ type: "error", message: errorMessage(part.error) });
              break;
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("AI agent stream error:", e);
          send({ type: "error", message: errorMessage(e) });
        }
      } finally {
        send({ type: "done", steps });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
