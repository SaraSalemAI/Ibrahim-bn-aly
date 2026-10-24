import { z } from "zod";
import { buildWorkbook } from "@/lib/finance/excel";
import { sha256 } from "@/lib/finance/hash";
import { companySchema, readJson } from "@/lib/ai/payload";
import { computeCompany } from "@/lib/workspace/compute";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const read = await readJson(req);
  if (!read.ok) return read.response;
  const parsed = z.object({ company: companySchema }).safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "badRequest", message: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const c = parsed.data.company;
  const k = computeCompany(c);
  if (!k.analysis) return Response.json({ error: "badRequest", message: "Load a trial balance first." }, { status: 400 });
  const tbDoc = c.docs.find((d) => d.category === "TRIAL_BALANCE");
  const buf = await buildWorkbook({
    companyName: c.settings.tradeNameEn,
    currency: c.settings.presentationCurrency,
    framework: c.settings.framework,
    currentLabel: c.period.currentLabel,
    priorLabel: c.period.priorLabel,
    rows: k.rows,
    current: k.analysis.current,
    form41: k.subledgers.ap?.form41,
    far: k.subledgers.far?.schedules.map((s) => ({ ...s, category: s.category })),
    sourceHash: tbDoc?.sha256 ?? sha256(JSON.stringify(c.rows)),
    generatedAt: new Date().toISOString(),
  });
  const name = `${(c.settings.tradeNameEn || "company").replace(/[^\w-]+/g, "_")}_${c.period.currentLabel}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
