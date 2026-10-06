import type { Cell, SourceRow, SourceTable, Settings, Money } from './types';

/** Parse a numeric cell. Handles "1,234.50", "(500)", "EGP 1,000", Arabic-Indic digits. Returns null when not numeric. */
export function num(v: Cell | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return null;
  let s = String(v).trim();
  s = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g, '.').replace(/٬/g, ',');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[A-Za-z؀-ۿ$£€\s]/g, '').replace(/,/g, '');
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (!/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Parse a date cell into an ISO date (YYYY-MM-DD). Returns null when not a valid date. */
export function isoDate(v: Cell | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    // Excel serial date (1900 system); accept a plausible range only
    if (v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return d.toISOString().slice(0, 10);
    }
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    // Day-first is the Egyptian convention; if the first part > 12 it is unambiguous anyway.
    const a = +m[1], b = +m[2];
    if (a > 12) return mk(+m[3], b, a);
    if (b > 12) return mk(+m[3], a, b);
    return mk(+m[3], b, a);
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t) && /[a-z]/i.test(s)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function mk(y: number, mo: number, d: number): string | null {
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/** Extract hour (0-23) from a time or datetime cell. */
export function hourOf(v: Cell | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v >= 0 && v < 1) return Math.floor(v * 24);
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = +m[1];
  if (/pm/i.test(String(v)) && h < 12) h += 12;
  if (/am/i.test(String(v)) && h === 12) h = 0;
  return h >= 0 && h < 24 ? h : null;
}

export function text(v: Cell | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const weekday = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay();

/** Field accessor bound to a table's canonical mapping. */
export interface Accessor {
  table: SourceTable;
  has(field: string): boolean;
  raw(row: SourceRow, field: string): Cell;
  t(row: SourceRow, field: string): string;
  n(row: SourceRow, field: string): number | null;
  d(row: SourceRow, field: string): string | null;
}

export function accessor(table: SourceTable): Accessor {
  const m = table.mapping;
  return {
    table,
    has: (f) => !!m[f],
    raw: (r, f) => (m[f] ? r.values[m[f]] ?? null : null),
    t: (r, f) => (m[f] ? text(r.values[m[f]]) : ''),
    n: (r, f) => (m[f] ? num(r.values[m[f]]) : null),
    d: (r, f) => (m[f] ? isoDate(r.values[m[f]]) : null),
  };
}

/** Resolve a row amount into money with an explicit currency. Never assumes a currency unless the setting allows it. */
export function money(a: Accessor, r: SourceRow, amountField: string, s: Settings): Money | null {
  const egp = a.n(r, 'egp');
  if (egp !== null && a.has('egp')) return { amount: egp, currency: 'EGP' };
  const amt = a.n(r, amountField);
  if (amt === null) return null;
  const cur = a.t(r, 'currency').toUpperCase();
  if (cur) return { amount: amt, currency: cur };
  return { amount: amt, currency: s.assumeBaseCurrencyWhenMissing ? s.baseCurrency : '—' };
}

export function addExposure(acc: Record<string, number>, m: Money | undefined | null) {
  if (!m) return;
  acc[m.currency] = (acc[m.currency] ?? 0) + Math.abs(m.amount);
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function fmtMoney(m: Record<string, number> | Money | null | undefined): string {
  if (!m) return '—';
  if ('amount' in m && 'currency' in m && typeof (m as Money).amount === 'number') {
    const mm = m as Money;
    return `${fmtNum(mm.amount)} ${mm.currency}`;
  }
  const entries = Object.entries(m as Record<string, number>).filter(([, v]) => v);
  if (!entries.length) return '—';
  return entries.map(([c, v]) => `${fmtNum(v)} ${c}`).join(' + ');
}

/** Mask sensitive identifiers: keep last 4 characters. */
export function mask(v: string): string {
  if (!v) return v;
  if (v.length <= 4) return '••••';
  return '•'.repeat(Math.min(8, v.length - 4)) + v.slice(-4);
}

export function isApproved(s: string): boolean | null {
  const v = norm(s);
  if (!v) return null;
  if (/(not approved|unapproved|pending|rejected|draft|awaiting|غير معتمد|مرفوض|قيد الاعتماد|معلق)/.test(v)) return false;
  if (['no', 'n', 'false', '0', 'open', 'لا'].includes(v)) return false;
  if (['yes', 'y', 'true', '1', 'نعم'].includes(v)) return true;
  if (/(^| )(approved|posted|authorised|authorized|released)( |$)|معتمد|تم الاعتماد/.test(v)) return true;
  return null;
}

export async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Text(s: string): Promise<string> {
  return sha256(new TextEncoder().encode(s).buffer as ArrayBuffer);
}

/** Lowercase, strip Arabic diacritics and normalize alef/ya/ta-marbuta variants for search matching. */
export function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
}
