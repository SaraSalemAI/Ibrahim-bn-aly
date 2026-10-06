import { useState } from 'react';
import { useApp, ROLES, ROLE_PAGES, type Page } from './state';
import type { DictKey } from './i18n/dict';
import type { Role } from './engine/types';
import { EMPTY_FILTERS } from './engine/defaults';
import { AREAS } from './engine/library';
import { Field } from './ui/kit';
import { EvidencePanel } from './pages/Evidence';
import { FindingDetail } from './pages/Findings';
import { pages } from './pages';

const NAV: { group: DictKey; items: { page: Page; icon: string }[] }[] = [
  { group: 'navGroupData', items: [{ page: 'upload', icon: '⇪' }, { page: 'requirements', icon: '☰' }, { page: 'quality', icon: '◎' }] },
  { group: 'navGroupDash', items: [{ page: 'overview', icon: '◧' }, { page: 'cfo', icon: '₤' }, { page: 'committee', icon: '◈' }] },
  { group: 'navGroupAudit', items: [{ page: 'findings', icon: '⚑' }, { page: 'tests', icon: '✓' }, { page: 'sites', icon: '⌂' }, { page: 'recon', icon: '⇄' }, { page: 'fs', icon: '▤' }, { page: 'fraud', icon: '⚠' }, { page: 'copilot', icon: '✦' }] },
  { group: 'navGroupRisk', items: [{ page: 'risks', icon: '▦' }, { page: 'controls', icon: '⛨' }, { page: 'universe', icon: '◍' }] },
  { group: 'navGroupOut', items: [{ page: 'recommendations', icon: '➜' }, { page: 'actions', icon: '☑' }, { page: 'change', icon: '↻' }, { page: 'reports', icon: '⎙' }] },
  { group: 'navGroupAdmin', items: [{ page: 'qc', icon: '✔' }, { page: 'trail', icon: '⛓' }, { page: 'settings', icon: '⚙' }] },
];

function Filters() {
  const { filters, setFilters, t, tl, settings, analysis } = useApp();
  const opts = (field: string) => {
    const s = new Set<string>();
    for (const tb of analysis.tables) { const h = tb.mapping[field]; if (!h) continue; for (const r of tb.rows) { const v = r.values[h]; if (v !== null && v !== '') s.add(String(v)); if (s.size > 300) break; } }
    return [...s].sort();
  };
  const set = (k: keyof typeof filters, v: string) => setFilters({ ...filters, [k]: v });
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="card no-print" style={{ padding: 12 }}>
      <div className="filters">
        <Field label={t('dateFrom')}><input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} /></Field>
        <Field label={t('dateTo')}><input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)} /></Field>
        <Field label={t('site')}><select value={filters.site} onChange={(e) => set('site', e.target.value)}><option value="">{t('all')}</option>{settings.sites.map((s) => <option key={s.id} value={s.id}>{tl(s.name)}</option>)}</select></Field>
        <Field label={t('department')}><select value={filters.department} onChange={(e) => set('department', e.target.value)}><option value="">{t('all')}</option>{opts('department').map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label={t('costCenter')}><select value={filters.costCenter} onChange={(e) => set('costCenter', e.target.value)}><option value="">{t('all')}</option>{opts('costCenter').map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label={t('currency')}><select value={filters.currency} onChange={(e) => set('currency', e.target.value)}><option value="">{t('all')}</option>{opts('currency').map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label={t('party')}><input value={filters.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
        <Field label={t('account')}><input value={filters.account} onChange={(e) => set('account', e.target.value)} /></Field>
        <Field label={t('area')}><select value={filters.area} onChange={(e) => set('area', e.target.value)}><option value="">{t('all')}</option>{AREAS.map((a) => <option key={a.id} value={a.id}>{tl(a.label)}</option>)}</select></Field>
        <Field label={t('riskLevel')}><select value={filters.risk} onChange={(e) => set('risk', e.target.value)}><option value="">{t('all')}</option>{(['critical', 'high', 'medium', 'low', 'info'] as const).map((k) => <option key={k} value={k}>{t(k)}</option>)}</select></Field>
        <Field label={t('status')}><select value={filters.status} onChange={(e) => set('status', e.target.value)}><option value="">{t('all')}</option>{['draft', 'under-review', 'validated', 'official', 'closed', 'dismissed'].map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
        {active && <button className="btn" onClick={() => setFilters(EMPTY_FILTERS)}>✕ {t('clearFilters')}</button>}
      </div>
      {analysis.filterNotes.length > 0 && <details className="small muted" style={{ marginTop: 6 }}><summary>{analysis.filterNotes.length} note(s)</summary><ul>{analysis.filterNotes.map((n) => <li key={n}>{n}</li>)}</ul></details>}
    </div>
  );
}

export default function App() {
  const app = useApp();
  const { t, tl, prefs, setPrefs, nav, go, analysis, loaded, filters } = app;
  const [menu, setMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  if (!loaded) return <div style={{ padding: 40 }}>…</div>;
  const allowed = ROLE_PAGES[prefs.role];
  const page = allowed.includes(nav.page) ? nav.page : allowed[0];
  const Comp = pages[page];
  const counts: Partial<Record<Page, number>> = { findings: analysis.findings.length, actions: app.actions.filter((a) => a.status !== 'closed' && a.dueDate && a.dueDate < analysis.today).length || undefined, upload: app.files.length || undefined };
  const activeFilters = Object.values(filters).filter(Boolean).length;
  return (
    <div className="app">
      <aside className={`side ${menu ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><svg width="22" height="22" viewBox="0 0 32 32" aria-hidden><path d="M5 23l7-14 5 9 3-5 7 10" stroke="#f28c28" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <div><b>{t('appName')}</b><small>{t('company')}</small></div>
        </div>
        {NAV.map((g) => {
          const items = g.items.filter((i) => allowed.includes(i.page));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <div className="nav-group">{t(g.group)}</div>
              {items.map((i) => (
                <button key={i.page} className={`nav-btn ${page === i.page ? 'active' : ''}`} onClick={() => { go(i.page); setMenu(false); }}>
                  <span aria-hidden style={{ width: 16, textAlign: 'center' }}>{i.icon}</span>{t(i.page as DictKey)}
                  {counts[i.page] ? <span className="count">{counts[i.page]}</span> : null}
                </button>
              ))}
            </div>
          );
        })}
      </aside>
      <div className="main">
        <header className="top">
          <button className="btn menu-toggle" onClick={() => setMenu((m) => !m)} aria-label="menu">☰</button>
          <div>
            <h1>{t(page as DictKey)}</h1>
            <div className="sub">{analysis.hasData ? <>{app.files.length} {tl({ en: 'file(s)', ar: 'ملف' })} · <span className="ltr">{analysis.tables.reduce((s, x) => s + x.rows.length, 0).toLocaleString()}</span> {t('rows')} · {t('qc')}: {tl({ en: analysis.qcStatus, ar: { PASS: 'ناجح', WARNING: 'تحذير', FAIL: 'إخفاق' }[analysis.qcStatus] })}</> : t('uploadToStart')}</div>
          </div>
          <span className="spacer" />
          <button className={`btn ${activeFilters ? 'accent' : ''}`} onClick={() => setShowFilters((x) => !x)}>⚲ {t('filters')}{activeFilters ? ` (${activeFilters})` : ''}</button>
          <div className="seg" role="group" aria-label="language">
            <button className={prefs.lang === 'en' ? 'on' : ''} onClick={() => setPrefs({ lang: 'en' })}>EN</button>
            <button className={prefs.lang === 'ar' ? 'on' : ''} onClick={() => setPrefs({ lang: 'ar' })}>AR</button>
          </div>
          <div className="seg" role="group" aria-label={t('theme')}>
            <button className={prefs.theme === 'light' ? 'on' : ''} onClick={() => setPrefs({ theme: 'light' })} title={t('light')}>☀</button>
            <button className={prefs.theme === 'dark' ? 'on' : ''} onClick={() => setPrefs({ theme: 'dark' })} title={t('dark')}>☾</button>
          </div>
          <select className="inp" value={prefs.role} onChange={(e) => setPrefs({ role: e.target.value as Role, user: tl(ROLES.find((r) => r.id === e.target.value)!.label) })} aria-label={t('role')} title={t('role')}>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{tl(r.label)}</option>)}
          </select>
          <input className="inp" style={{ width: 150 }} value={prefs.user} onChange={(e) => setPrefs({ user: e.target.value })} aria-label={t('user')} title={t('user')} />
        </header>
        <main className="content">
          {showFilters && <Filters />}
          <Comp />
        </main>
      </div>
      {nav.findingId && <FindingDetail id={nav.findingId} />}
      {nav.evidence && <EvidencePanel findingId={nav.evidence.findingId} index={nav.evidence.index} />}
    </div>
  );
}
