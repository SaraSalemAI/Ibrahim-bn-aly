// Console builder — dashboard widgets (KPI, bar, line, pie, table) computed from console datasets.
// Inspired by the AI Console Builder app on Base44. Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { z } from "zod";

export type Row = Record<string, string | number | null>;

export const widgetSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["kpi", "bar", "line", "pie", "table"]),
  title: z.string(),
  dataset: z.string(),
  size: z.enum(["half", "full"]).optional(),
  metric: z.enum(["count", "sum", "avg", "min", "max"]).optional(),
  field: z.string().optional(),
  groupBy: z.string().optional(),
  dateField: z.string().optional(),
  granularity: z.enum(["month", "day"]).optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  decimals: z.number().int().min(0).max(6).optional(),
  columns: z.array(z.string()).optional(),
  rowLimit: z.number().int().min(1).max(500).optional(),
});
export type Widget = z.infer<typeof widgetSchema>;

export type WidgetResult =
  | { kind: "kpi"; value: number; text: string }
  | { kind: "series"; points: { label: string; value: number }[] }
  | { kind: "table"; columns: string[]; rows: Row[] }
  | { kind: "error"; message: string };

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v.replace(/,/g, "")))) return Number(v.replace(/,/g, ""));
  return null;
};

function aggregate(rows: Row[], metric: Widget["metric"] = "count", field?: string): number {
  if (metric === "count" || !field) return rows.length;
  const vals = rows.map((r) => num(r[field])).filter((v): v is number => v !== null);
  if (!vals.length) return 0;
  switch (metric) {
    case "sum": return vals.reduce((a, b) => a + b, 0);
    case "avg": return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "min": return Math.min(...vals);
    case "max": return Math.max(...vals);
  }
}

export function formatValue(w: Pick<Widget, "prefix" | "suffix" | "decimals">, v: number): string {
  const d = w.decimals ?? (Number.isInteger(v) ? 0 : 2);
  return `${w.prefix ?? ""}${v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}${w.suffix ?? ""}`;
}

/** Computes one widget's data from the console datasets. Pure: no DOM. */
export function computeWidget(w: Widget, datasets: Record<string, Row[]>): WidgetResult {
  const rows = datasets[w.dataset];
  if (!rows) return { kind: "error", message: `No dataset "${w.dataset}".` };
  if (w.type === "table") {
    const columns = w.columns?.length ? w.columns : [...new Set(rows.slice(0, 50).flatMap((r) => Object.keys(r)))].slice(0, 6);
    return { kind: "table", columns, rows: rows.slice(0, w.rowLimit ?? 8) };
  }
  if (w.type === "kpi") {
    const value = aggregate(rows, w.metric, w.field);
    return { kind: "kpi", value, text: formatValue(w, value) };
  }
  const key = (r: Row): string => {
    if (w.type === "line" && w.dateField) {
      const d = new Date(String(r[w.dateField] ?? ""));
      if (Number.isNaN(d.getTime())) return String(r[w.dateField] ?? "—");
      const iso = d.toISOString();
      return w.granularity === "day" ? iso.slice(0, 10) : iso.slice(0, 7);
    }
    return String(r[w.groupBy ?? ""] ?? "—");
  };
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = key(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  let points = [...groups].map(([label, rs]) => ({ label, value: aggregate(rs, w.metric, w.field) }));
  points = w.type === "line" ? points.sort((a, b) => a.label.localeCompare(b.label)) : points.sort((a, b) => b.value - a.value).slice(0, 12);
  return { kind: "series", points };
}

/** Suggests a starter dashboard for datasets (like Base44's auto widgets): totals, a breakdown, a trend and a table. */
export function suggestWidgets(datasets: Record<string, Row[]>): Widget[] {
  const out: Widget[] = [];
  for (const [name, rows] of Object.entries(datasets)) {
    const cols = [...new Set(rows.slice(0, 100).flatMap((r) => Object.keys(r)))];
    const numeric = cols.filter((c) => rows.slice(0, 100).some((r) => typeof r[c] === "number") && rows.slice(0, 100).every((r) => r[c] === null || typeof r[c] === "number"));
    const dateCol = cols.find((c) => /date|time|day|month|created/i.test(c) && rows.slice(0, 20).some((r) => !Number.isNaN(new Date(String(r[c] ?? "")).getTime())));
    const category = cols.find((c) => c !== dateCol && !numeric.includes(c) && new Set(rows.map((r) => r[c])).size <= Math.max(12, rows.length / 3));
    const main = numeric[0];
    out.push({ type: "kpi", title: `${name}: rows`, dataset: name, metric: "count", size: "half" });
    if (main) out.push({ type: "kpi", title: `Total ${main}`, dataset: name, metric: "sum", field: main, size: "half" });
    if (category) out.push({ type: "bar", title: main ? `${main} by ${category}` : `Rows by ${category}`, dataset: name, metric: main ? "sum" : "count", field: main, groupBy: category, size: "half" });
    if (category) out.push({ type: "pie", title: `Share by ${category}`, dataset: name, metric: "count", groupBy: category, size: "half" });
    if (dateCol) out.push({ type: "line", title: main ? `${main} over time` : "Rows over time", dataset: name, metric: main ? "sum" : "count", field: main, dateField: dateCol, granularity: "month", size: "full" });
    out.push({ type: "table", title: `${name} preview`, dataset: name, rowLimit: 8, size: "full" });
  }
  return out.map((w, i) => ({ id: `w${i + 1}`, ...w }));
}
