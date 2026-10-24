import { round2, STATEMENT_LINES, type PeriodFigures } from "./engine";

export function commonSize(f: PeriodFigures) {
  return STATEMENT_LINES.map(({ key, statement }) => {
    const base = statement === "PL" ? f.revenue : f.totalAssets;
    return { key, statement, value: f[key], pct: base ? round2((f[key] / base) * 100) : null };
  });
}

export const BENCHMARK_KPIS = ["grossMargin", "ebitdaMargin", "netMargin", "roe", "currentRatio", "debtToEquity", "dso", "dio", "dpo", "interestCoverage"] as const;
export type BenchmarkKpi = (typeof BENCHMARK_KPIS)[number];

export function medianOf(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return round2(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2);
}
