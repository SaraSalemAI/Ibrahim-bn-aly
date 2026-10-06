import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../state';
import type { L, Severity } from '../engine/types';
import { fmtMoney, fmtNum } from '../engine/values';
import { downloadCsv } from '../exports';

export function Card({ title, hint, actions, children, id }: { title?: ReactNode; hint?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="card" id={id}>
      {(title || actions) && <h2>{title}<span className="spacer" />{actions}</h2>}
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

export function Kpi({ label, value, note, onClick, accent }: { label: ReactNode; value: ReactNode; note?: ReactNode; onClick?: () => void; accent?: boolean }) {
  const inner = <><div className="lbl">{label}</div><div className="val">{value}</div>{note && <div className="note">{note}</div>}</>;
  return onClick ? <button className={`kpi ${accent ? 'accent' : ''}`} onClick={onClick}>{inner}</button> : <div className={`kpi ${accent ? 'accent' : ''}`}>{inner}</div>;
}

export function Sev({ s }: { s: Severity | 'na' | null | undefined }) {
  const { t } = useApp();
  const k = (s ?? 'na') as Severity | 'na';
  return <span className={`badge ${k}`}><span className="dot" />{t(k)}</span>;
}

export function QC({ s }: { s: 'PASS' | 'WARNING' | 'FAIL' }) {
  const { lang } = useApp();
  const ar = { PASS: 'ناجح', WARNING: 'تحذير', FAIL: 'إخفاق' };
  const icon = s === 'PASS' ? '✓' : s === 'WARNING' ? '!' : '✕';
  return <span className={`badge ${s === 'PASS' ? 'pass' : s === 'FAIL' ? 'fail' : 'warn'}`}>{icon} {lang === 'ar' ? ar[s] : s}</span>;
}

export function Tag({ kind, children }: { kind: 'src' | 'calc' | 'ai' | 'risk' | 'rec' | 'asm'; children?: ReactNode }) {
  const { t } = useApp();
  const lbl = { src: t('sourceData'), calc: t('calculation'), ai: t('aiInterpretation'), risk: t('riskAssessment'), rec: t('recommendation'), asm: t('assumption') }[kind];
  return <span className={`tag ${kind}`}>{children ?? lbl}</span>;
}

export function Insufficient({ missing }: { missing?: string[] }) {
  const { t } = useApp();
  return <div><div className="insufficient">{t('insufficient')}</div>{missing?.length ? <ul className="small muted" style={{ margin: '4px 0 0' }}>{missing.map((m) => <li key={m}>{m}</li>)}</ul> : null}</div>;
}

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}

export function Money({ m }: { m: Record<string, number> | null | undefined }) {
  return <span className="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(m)}</span>;
}
export function Num({ v, d = 2 }: { v: number | null | undefined; d?: number }) {
  return <span className="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtNum(v ?? null, d)}</span>;
}

export interface Col<T> { key: string; label: ReactNode; render?: (r: T) => ReactNode; value?: (r: T) => string | number | null; num?: boolean; csv?: (r: T) => string | number | null }

export function DataTable<T>({ rows, cols, onRow, csvName, max = 500, searchable = true, empty }: { rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; csvName?: string; max?: number; searchable?: boolean; empty?: ReactNode }) {
  const { t, prefs, log_ } = useApp();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: string; d: 1 | -1 } | null>(null);
  const val = (c: Col<T>, r: T) => (c.value ? c.value(r) : c.csv ? c.csv(r) : ((r as Record<string, unknown>)[c.key] as string | number | null));
  const shown = useMemo(() => {
    let x = rows;
    if (q) { const qq = q.toLowerCase(); x = x.filter((r) => cols.some((c) => String(val(c, r) ?? '').toLowerCase().includes(qq))); }
    if (sort) { const c = cols.find((cc) => cc.key === sort.k)!; x = [...x].sort((a, b) => { const va = val(c, a), vb = val(c, b); return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''))) * sort.d; }); }
    return x;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, cols]);
  return (
    <div className="stack">
      {(searchable || csvName) && (
        <div className="row no-print">
          {searchable && <input className="inp" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />}
          <span className="muted small">{shown.length.toLocaleString()} / {rows.length.toLocaleString()}</span>
          <span className="spacer" />
          {csvName && prefs.role !== 'readonly' && <button className="btn sm" onClick={() => { downloadCsv(csvName, cols.map((c) => (typeof c.label === 'string' ? c.label : c.key)), shown.map((r) => cols.map((c) => (c.csv ? c.csv(r) : val(c, r))))); log_('EXPORT_CSV', csvName, `${shown.length} rows`); }}>⤓ CSV</button>}
        </div>
      )}
      {!rows.length && empty ? empty : (
        <div className="table-wrap">
          <table>
            <thead><tr>{cols.map((c) => <th key={c.key} className={c.num ? 'num' : ''} onClick={() => setSort((s) => ({ k: c.key, d: s?.k === c.key && s.d === 1 ? -1 : 1 }))} style={{ cursor: 'pointer' }}>{c.label}{sort?.k === c.key ? (sort.d === 1 ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
            <tbody>
              {shown.slice(0, max).map((r, i) => (
                <tr key={i} className={onRow ? 'click' : ''} onClick={onRow ? () => onRow(r) : undefined}>
                  {cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : String(val(c, r) ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > max && <div className="small muted" style={{ padding: 8 }}>+{(shown.length - max).toLocaleString()} more — refine search or export CSV</div>}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars (single series): label, value, tooltip via title. */
export function Bars({ data, fmt = (v) => fmtNum(v), color = 'var(--series-1)', onClick }: { data: { label: string; value: number; tip?: string; key?: string }[]; fmt?: (v: number) => string; color?: string; onClick?: (k: string) => void }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  if (!data.length) return null;
  return (
    <div role="list">
      {data.map((d) => (
        <div className="bar-row" key={d.key ?? d.label} role="listitem" title={d.tip ?? `${d.label}: ${fmt(d.value)}`} style={{ cursor: onClick ? 'pointer' : undefined }} onClick={onClick ? () => onClick(d.key ?? d.label) : undefined}>
          <span className="lbl">{d.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(Math.abs(d.value) / max) * 100}%`, background: color }} /></div>
          <span className="num small ltr">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Severity distribution as stacked bar with legend (status colors + labels). */
export function SevStack({ counts }: { counts: Record<string, number> }) {
  const { t } = useApp();
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const tot = order.reduce((s, k) => s + (counts[k] ?? 0), 0);
  if (!tot) return <div className="muted small">{t('noFindings')}</div>;
  return (
    <div className="stack">
      <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {order.filter((k) => counts[k]).map((k) => <div key={k} title={`${t(k)}: ${counts[k]}`} style={{ flex: counts[k], background: `var(--sev-${k})` }} />)}
      </div>
      <div className="row small">{order.filter((k) => counts[k]).map((k) => <span key={k} className={`badge ${k}`}><span className="dot" />{t(k)} {counts[k]}</span>)}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const { t } = useApp();
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head"><h2>{title}</h2><span className="spacer" />{actions}<button className="btn" onClick={onClose}>✕ {t('close')}</button></div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }

export const lbl = (l: L, lang: 'en' | 'ar') => l[lang] || l.en;
