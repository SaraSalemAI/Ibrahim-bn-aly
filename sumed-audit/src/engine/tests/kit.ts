import { fieldDef, datasetLabel } from '../schema';
import type { AuditArea, Calculation, DatasetType, L, Money, RowRef, Settings, Severity, SourceRow, SourceTable, TestException, TestOutput } from '../types';
import { accessor, type Accessor, money } from '../values';

export interface Rec { a: Accessor; r: SourceRow }

export interface Ctx {
  tables: SourceTable[];
  settings: Settings;
}

export interface TestDef {
  id: string;
  area: AuditArea;
  name: L;
  objective: L;
  rule: L;
  controlId: string;
  riskId: string;
  severity: Severity;
  fraud?: boolean;
  criteria: L;
  cause: L;
  effect: L;
  recommendation: L;
  /** Datasets/fields the test needs, for the requirements center */
  needs: { type: DatasetType; fields: string[] }[];
  run(ctx: Ctx): TestOutput;
}

export const ref = (x: Rec): RowRef => ({ tableId: x.a.table.id, recordId: x.r.recordId });

/** Gather records of a dataset type from tables that have all required fields mapped. */
export function recs(ctx: Ctx, type: DatasetType, fields: string[]): { list: Rec[]; missing: string[] } {
  const tables = ctx.tables.filter((t) => t.datasetType === type);
  const lbl = datasetLabel(type).en;
  if (!tables.length) return { list: [], missing: [`${lbl} dataset not uploaded`] };
  const usable = tables.filter((t) => fields.every((f) => t.mapping[f]));
  if (!usable.length) {
    const t = tables[0];
    const miss = fields.filter((f) => !t.mapping[f]).map((f) => fieldDef(type, f)?.label.en ?? f);
    return { list: [], missing: [`${lbl}: required field(s) not mapped — ${miss.join(', ')}`] };
  }
  const list: Rec[] = [];
  for (const t of usable) { const a = accessor(t); for (const r of t.rows) list.push({ a, r }); }
  return { list, missing: [] };
}

export const insufficient = (missing: string[]): TestOutput => ({ status: 'insufficient', missing, population: 0, exceptions: [] });

export function exc(
  key: string,
  description: L,
  items: Rec[],
  fields: string[] | string[][],
  calc: Calculation,
  m?: Money | null,
): TestException {
  const highlight: Record<string, string[]> = {};
  items.forEach((it, i) => {
    const fl = Array.isArray(fields[0]) ? (fields as string[][])[i] ?? (fields as string[][])[0] : (fields as string[]);
    highlight[it.r.recordId] = fl.filter((f) => it.a.has(f));
  });
  return { key, description, rows: items.map(ref), highlight, calc, money: m ?? undefined };
}

export const amt = (x: Rec, field: string, s: Settings) => money(x.a, x.r, field, s);

/** Latest date across records for a field — used as the default as-of date (displayed as a parameter). */
export function asOf(list: Rec[], field: string, s: Settings): string | null {
  if (s.asOfDate) return s.asOfDate;
  let max: string | null = null;
  for (const x of list) { const d = x.a.d(x.r, field); if (d && (!max || d > max)) max = d; }
  return max;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function groupBy<T>(xs: T[], k: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const key = k(x); if (!key) continue; const g = m.get(key); if (g) g.push(x); else m.set(key, [x]); }
  return m;
}

export const normName = (s: string) => s.toLowerCase().replace(/\b(co|company|ltd|llc|inc|corp|sae|s a e|est|for|and|the)\b/g, '').replace(/[^\p{L}\p{N}]/gu, '');

export function isRound(v: number, base: number): boolean {
  return base > 0 && Math.abs(v) >= base * 10 && Math.abs(v) % base === 0;
}

export function nearLimit(v: number, limits: number[], pct: number): number | null {
  for (const l of limits) if (v < l && v >= l * (1 - pct / 100)) return l;
  return null;
}

export const keyOf = (...parts: (string | number | null | undefined)[]) => parts.map((p) => String(p ?? '')).join('|');

/** Simple "matches any keyword" (case-insensitive). */
export function hasKeyword(s: string, kws: string[]): string | null {
  const l = s.toLowerCase();
  for (const k of kws) if (k && l.includes(k.toLowerCase())) return k;
  return null;
}

export function concentration(
  ctx: Ctx, list: Rec[], keyField: string, amountField: string, label: L,
): TestOutput {
  const tot: Record<string, number> = {};
  const by = new Map<string, { items: Rec[]; sum: number; cur: string }>();
  for (const x of list) {
    const k = x.a.t(x.r, keyField); const m = amt(x, amountField, ctx.settings);
    if (!k || !m) continue;
    tot[m.currency] = (tot[m.currency] ?? 0) + Math.abs(m.amount);
    const g = by.get(k + '|' + m.currency) ?? { items: [], sum: 0, cur: m.currency };
    g.items.push(x); g.sum += Math.abs(m.amount); by.set(k + '|' + m.currency, g);
  }
  const out: TestException[] = [];
  for (const [k, g] of by) {
    const total = tot[g.cur];
    const share = total ? (g.sum / total) * 100 : 0;
    if (by.size > 1 && share >= ctx.settings.concentrationPct) {
      const name = k.split('|')[0];
      out.push(exc(keyOf('conc', k), { en: `${label.en} "${name}" represents ${share.toFixed(1)}% of total (${g.cur})`, ar: `${label.ar} "${name}" يمثل ${share.toFixed(1)}% من الإجمالي (${g.cur})` },
        g.items.slice(0, 200), [keyField, amountField],
        { formula: 'Share % = Σ amount(party) ÷ Σ amount(all parties) × 100', inputs: [{ label: { en: 'Σ party', ar: 'إجمالي الطرف' }, value: round2(g.sum) }, { label: { en: 'Σ all', ar: 'الإجمالي' }, value: round2(total) }, { label: { en: 'Threshold %', ar: 'الحد %' }, value: ctx.settings.concentrationPct }], result: `${share.toFixed(2)}%` }));
        // Concentration is a risk indicator, not a misstatement — no financial exposure is attributed.
    }
  }
  return { status: 'performed', missing: [], population: list.length, exceptions: out, params: { concentrationPct: ctx.settings.concentrationPct } };
}

export const round2 = (x: number) => Math.round(x * 100) / 100;
