import { computePeriod, round2, type PeriodFigures } from "./engine";
import type { TBRow } from "./types";

export const TREND_KEYS = ["revenue", "grossProfit", "ebitda", "netProfit", "cash", "receivables", "inventory", "payables", "totalEquity"] as const;
export type TrendKey = (typeof TREND_KEYS)[number];
const PL_KEYS: ReadonlySet<TrendKey> = new Set(["revenue", "grossProfit", "ebitda", "netProfit"]);

export interface TrendPoint {
  label: string;
  values: Record<TrendKey, number>;
  grossMargin: number | null;
  netMargin: number | null;
  /** Receivable days on the month's revenue, annualised. */
  dso: number | null;
}

/**
 * Month-by-month figures from monthly trial balances. When the files show year-to-date P&L, each
 * month's P&L is the difference from the previous month of the same fiscal year; balance sheet
 * figures are always the month-end balances.
 */
export function monthlyTrend(months: Array<{ label: string; rows: TBRow[] }>, ytd: boolean, fiscalYearStartMonth = 1): TrendPoint[] {
  const sorted = [...months].sort((a, b) => a.label.localeCompare(b.label));
  const figs = sorted.map((m) => ({ label: m.label, f: computePeriod(m.rows, "current") }));
  const fyOf = (label: string) => {
    const [y, mo] = label.split("-").map(Number);
    return mo >= fiscalYearStartMonth ? y : y - 1;
  };
  return figs.map((m, i) => {
    const prev = i > 0 && fyOf(figs[i - 1].label) === fyOf(m.label) ? figs[i - 1].f : null;
    const values = Object.fromEntries(
      TREND_KEYS.map((k) => {
        const v = m.f[k as keyof PeriodFigures] as number;
        return [k, round2(PL_KEYS.has(k) && ytd && prev ? v - (prev[k as keyof PeriodFigures] as number) : v)];
      }),
    ) as Record<TrendKey, number>;
    const rev = values.revenue;
    return {
      label: m.label,
      values,
      grossMargin: rev ? round2((values.grossProfit / rev) * 100) : null,
      netMargin: rev ? round2((values.netProfit / rev) * 100) : null,
      dso: rev > 0 ? round2((values.receivables / (rev * 12)) * 365) : null,
    };
  });
}

/** Simple outlook: average of the last three months and the month-on-month change of the latest month. */
export function trendSummary(points: TrendPoint[]) {
  if (!points.length) return null;
  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  const last3 = points.slice(-3);
  return Object.fromEntries(
    TREND_KEYS.map((k) => [
      k,
      {
        latest: last.values[k],
        momChange: prev ? round2(last.values[k] - prev.values[k]) : null,
        momPct: prev && prev.values[k] ? round2(((last.values[k] - prev.values[k]) / Math.abs(prev.values[k])) * 100) : null,
        avg3: round2(last3.reduce((a, p) => a + p.values[k], 0) / last3.length),
      },
    ]),
  ) as Record<TrendKey, { latest: number; momChange: number | null; momPct: number | null; avg3: number }>;
}
