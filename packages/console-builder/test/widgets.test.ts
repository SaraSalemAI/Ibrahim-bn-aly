// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.
import { describe, expect, it } from "vitest";
import { buildFromSpec, computeWidget, parseSpec, specFromDatasets, suggestWidgets, TEMPLATES } from "../src/index";

const rows = [
  { date: "2026-01-05", region: "Cairo", units: 10, price: 5 },
  { date: "2026-01-20", region: "Giza", units: 4, price: 7 },
  { date: "2026-02-02", region: "Cairo", units: 6, price: 5 },
];

describe("widgets", () => {
  it("computes kpi, bar, line, pie and table", () => {
    const ds = { sales: rows };
    expect(computeWidget({ type: "kpi", title: "Units", dataset: "sales", metric: "sum", field: "units", prefix: "$" }, ds)).toMatchObject({ kind: "kpi", value: 20, text: "$20" });
    expect(computeWidget({ type: "kpi", title: "Avg", dataset: "sales", metric: "avg", field: "price", decimals: 1 }, ds)).toMatchObject({ value: 17 / 3, text: "5.7" });
    expect(computeWidget({ type: "bar", title: "By region", dataset: "sales", metric: "sum", field: "units", groupBy: "region" }, ds)).toEqual({ kind: "series", points: [{ label: "Cairo", value: 16 }, { label: "Giza", value: 4 }] });
    expect(computeWidget({ type: "line", title: "Trend", dataset: "sales", metric: "sum", field: "units", dateField: "date", granularity: "month" }, ds)).toEqual({ kind: "series", points: [{ label: "2026-01", value: 14 }, { label: "2026-02", value: 6 }] });
    expect(computeWidget({ type: "table", title: "T", dataset: "sales", rowLimit: 2 }, ds)).toMatchObject({ kind: "table", rows: rows.slice(0, 2) });
    expect(computeWidget({ type: "kpi", title: "x", dataset: "nope" }, ds).kind).toBe("error");
  });

  it("suggests a valid dashboard for data and templates", () => {
    const w = suggestWidgets({ sales: rows });
    expect(w.map((x) => x.type)).toEqual(["kpi", "kpi", "bar", "pie", "line", "table"]);
    const spec = specFromDatasets({ sales: rows });
    expect(parseSpec(spec).ok).toBe(true);
    expect(spec.widgets?.length).toBe(6);
    buildFromSpec(spec);
    expect(TEMPLATES.find((t) => t.id === "sales-data")!.spec.widgets?.length).toBeGreaterThan(3);
  });
});
