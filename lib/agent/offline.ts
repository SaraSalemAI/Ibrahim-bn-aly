import type { Company, Group } from "../workspace/types";
import { buildAgentTools, type AgentTools } from "./tools";

/**
 * Offline "ask your data": when no AI model is available (the single-file HTML build, or a server
 * without AI Gateway), questions are routed by keywords to the same deterministic tools the agent
 * uses, and the results are shown as tables. Nothing is generated or guessed.
 */
type ToolName = keyof AgentTools;
interface Call {
  name: ToolName;
  input: Record<string, unknown>;
}

const has = (q: string, re: RegExp) => re.test(q);

function addDays(iso: string, d: number) {
  return new Date(Date.parse(iso) + d * 86_400_000).toISOString().slice(0, 10);
}

export function routeQuestion(question: string, periodEnd: string): Call[] {
  const q = question.toLowerCase();
  const calls: Call[] = [];
  const quoted = question.match(/["“«']([^"”»']{2,60})["”»']/)?.[1];
  const topN = Number(q.match(/\b(?:top|أكبر)\s*(\d{1,2})/)?.[1] ?? 10);

  if (has(q, /close|wrong|anomal|review|red flag|suspicious|before i lock|مراجعة|غير سليم|غير معتاد|مشبوه/)) calls.push({ name: "get_close_review", input: { severity: "all" } });
  if (has(q, /customer|client|receivable|overdue|debtor|عميل|عملاء|متأخر|مديون/)) calls.push({ name: "get_top_counterparties", input: { side: "customers", limit: Math.min(25, topN) } });
  if (has(q, /supplier|vendor|payable|creditor|مورد|موردين|دائن/)) calls.push({ name: "get_top_counterparties", input: { side: "suppliers", limit: Math.min(25, topN) } });
  if (has(q, /journal|entr(y|ies)|transaction|posting|ledger|gl\b|قيد|قيود|معامل|الأستاذ/) || quoted) {
    const input: Record<string, unknown> = { limit: 25 };
    if (quoted) input.text = quoted;
    if (has(q, /last week|آخر أسبوع/)) input.from = addDays(periodEnd, -7);
    if (has(q, /last month|آخر شهر/)) input.from = addDays(periodEnd, -31);
    const min = q.match(/(?:over|above|more than|أكثر من|فوق)\s*([\d,]+)/)?.[1];
    if (min) input.minAmount = Number(min.replace(/,/g, ""));
    else if (has(q, /big|large|largest|أكبر|كبير/)) input.minAmount = 0;
    calls.push({ name: "search_gl", input });
  }
  if (has(q, /trend|month by month|monthly|اتجاه|شهري|شهر/)) calls.push({ name: "get_trends", input: {} });
  if (has(q, /group|consolidat|subsidiar|intercompany|مجموعة|مجمع|تابعة/)) calls.push({ name: "get_consolidation", input: {} });
  if (has(q, /\btax|vat|form 41|ضريب|ضرائب/)) calls.push({ name: "get_tax_computation", input: {} });
  if (has(q, /ratio|liquidity|margin|roe|dupont|altman|نسب|سيولة|هامش/)) calls.push({ name: "get_ratios", input: { group: "all", includeScores: true } });
  if (has(q, /why|varian|chang|moved|compare|vs|versus|لماذا|تغير|مقارنة/)) calls.push({ name: "get_variances", input: { statement: "both", materialOnly: true } });
  if (has(q, /cash ?flow|تدفق/)) calls.push({ name: "get_statement", input: { statement: "cashflow" } });
  if (has(q, /budget|موازنة/)) calls.push({ name: "get_budget_vs_actual", input: {} });
  if (has(q, /upload|file|import|ملف|ملفات|رفع|استيراد/)) calls.push({ name: "get_upload_report", input: { runs: 3 } });
  if (has(q, /validat|check|rule|error|تحقق|فحص|أخطاء|خطأ/)) calls.push({ name: "get_validation_report", input: { failedOnly: true } });
  if (has(q, /13.?week|forecast|runway|cash (position|forecast)|liquidity plan|توقع|تنبؤ|١٣ أسبوع|السيولة/)) calls.push({ name: "get_cash_forecast", input: {} });
  if (has(q, /history|closed period|board pack|أرشيف|الفترات المقفلة|حزم/)) calls.push({ name: "get_period_history", input: {} });
  if (!calls.length || has(q, /health|overview|summary|ملخص|صحة|نظرة/)) calls.unshift({ name: "get_overview", input: {} });
  return calls.slice(0, 4);
}

const fmt = (v: unknown): string => {
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return Array.isArray(v) ? (v.length && typeof v[0] !== "object" ? v.join(", ") : `${v.length} items`) : "…";
  return String(v).replace(/\|/g, "/");
};

function table(rows: Record<string, unknown>[], max = 12): string {
  if (!rows.length) return "_none_";
  const cols = Object.keys(rows[0]).filter((k) => rows.some((r) => typeof r[k] !== "object" || Array.isArray(r[k]))).slice(0, 7);
  return [`| ${cols.join(" | ")} |`, `| ${cols.map(() => "---").join(" | ")} |`, ...rows.slice(0, max).map((r) => `| ${cols.map((c) => fmt(r[c])).join(" | ")} |`), rows.length > max ? `\n_${rows.length - max} more…_` : ""].join("\n");
}

/** Plain markdown for a tool result: arrays of records become tables, nested objects become sections. */
export function toMarkdown(value: unknown, depth = 0): string {
  if (Array.isArray(value)) return value.length && typeof value[0] === "object" ? table(value as Record<string, unknown>[]) : fmt(value);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if ("error" in o && Object.keys(o).length === 1) return `> ${o.error}`;
    const flat = Object.entries(o).filter(([, v]) => typeof v !== "object" || v === null || (Array.isArray(v) && (!v.length || typeof v[0] !== "object")));
    const nested = Object.entries(o).filter(([k]) => !flat.some(([f]) => f === k));
    const parts: string[] = [];
    if (flat.length) parts.push(flat.map(([k, v]) => `- **${k}**: ${fmt(v)}`).join("\n"));
    if (depth < 2) for (const [k, v] of nested) parts.push(`**${k}**\n\n${toMarkdown(v, depth + 1)}`);
    return parts.join("\n\n");
  }
  return fmt(value);
}

const TITLES: Partial<Record<ToolName, [string, string]>> = {
  get_overview: ["Overview", "نظرة عامة"],
  get_close_review: ["Close review", "مراجعة الإقفال"],
  get_top_counterparties: ["Top counterparties", "أكبر الأطراف"],
  search_gl: ["General ledger search", "بحث في دفتر الأستاذ"],
  get_trends: ["Monthly trends", "الاتجاهات الشهرية"],
  get_consolidation: ["Group consolidation", "القوائم المجمعة"],
  get_tax_computation: ["Tax computation", "احتساب الضريبة"],
  get_ratios: ["Ratios", "النسب"],
  get_variances: ["Material variances", "الفروق الجوهرية"],
  get_statement: ["Statement", "القائمة"],
  get_budget_vs_actual: ["Budget vs actual", "الموازنة مقابل الفعلي"],
  get_period_history: ["History", "السجل"],
  get_upload_report: ["Uploaded files", "الملفات المرفوعة"],
  get_validation_report: ["Validation", "التحقق"],
  get_cash_forecast: ["13-week cash forecast", "توقع النقدية لـ ١٣ أسبوعًا"],
};

export async function answerOffline(question: string, company: Company, peers: Company[], groups: Group[], lang: "en" | "ar") {
  const tools = buildAgentTools(company, peers, groups);
  if (!tools) return { text: lang === "ar" ? "حمّل ميزان المراجعة أولًا." : "Load a trial balance first.", calls: [] };
  const calls = routeQuestion(question, company.period.end);
  const results: Array<{ id: string; name: string; input: unknown; output: unknown }> = [];
  for (const [i, c] of calls.entries()) {
    const t = tools[c.name] as { execute?: (input: never, opts: never) => Promise<unknown> };
    const output = await t.execute!(c.input as never, { toolCallId: `offline-${i}`, messages: [] } as never);
    results.push({ id: `offline-${i}`, name: c.name, input: c.input, output });
  }
  const note = lang === "ar" ? "_وضع بدون ذكاء اصطناعي: هذه نتائج الاستعلامات المدمجة كما هي، بدون تفسير._" : "_Offline mode (no AI): these are the built-in queries' results as computed, without interpretation._";
  const body = results.map((r) => `### ${(TITLES[r.name as ToolName] ?? [r.name, r.name])[lang === "ar" ? 1 : 0]}\n\n${toMarkdown(r.output)}`).join("\n\n");
  return { text: `${note}\n\n${body}`, calls: results };
}
