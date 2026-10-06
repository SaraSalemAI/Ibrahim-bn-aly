import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActionItem, AuditLogEntry, Filters, L, Lang, Role, Settings, Snapshot, SourceFile } from './engine/types';
import { runAnalysis, type Analysis, type FindingOverride, type RiskMeta } from './engine/analysis';
import { DEFAULT_SETTINGS, EMPTY_FILTERS } from './engine/defaults';
import { store, appendLog } from './store/db';
import { DICT, type DictKey } from './i18n/dict';

export type Page =
  | 'upload' | 'requirements' | 'quality' | 'overview' | 'cfo' | 'committee' | 'findings' | 'tests' | 'sites' | 'recon' | 'fs' | 'fraud'
  | 'risks' | 'controls' | 'universe' | 'recommendations' | 'actions' | 'change' | 'copilot' | 'reports' | 'trail' | 'settings' | 'qc';

export const ROLES: { id: Role; label: L }[] = [
  { id: 'cae', label: { en: 'Chief Audit Executive', ar: 'رئيس المراجعة الداخلية' } },
  { id: 'senior', label: { en: 'Senior Auditor', ar: 'مراجع أول' } },
  { id: 'auditor', label: { en: 'Internal Auditor', ar: 'مراجع داخلي' } },
  { id: 'cfo', label: { en: 'CFO', ar: 'المدير المالي' } },
  { id: 'finance', label: { en: 'Finance Manager', ar: 'مدير الحسابات' } },
  { id: 'treasury', label: { en: 'Treasury Manager', ar: 'مدير الخزانة' } },
  { id: 'risk', label: { en: 'Risk Manager', ar: 'مدير المخاطر' } },
  { id: 'compliance', label: { en: 'Compliance', ar: 'الالتزام' } },
  { id: 'management', label: { en: 'Management (action owner)', ar: 'الإدارة (مسؤول الإجراء)' } },
  { id: 'committee', label: { en: 'Audit Committee', ar: 'لجنة المراجعة' } },
  { id: 'readonly', label: { en: 'Read-only Executive', ar: 'تنفيذي (قراءة فقط)' } },
];

const ALL: Page[] = ['upload', 'requirements', 'quality', 'overview', 'cfo', 'committee', 'findings', 'tests', 'sites', 'recon', 'fs', 'fraud', 'risks', 'controls', 'universe', 'recommendations', 'actions', 'change', 'copilot', 'reports', 'trail', 'settings', 'qc'];
export const ROLE_PAGES: Record<Role, Page[]> = {
  cae: ALL,
  senior: ALL,
  auditor: ALL.filter((p) => p !== 'trail'),
  cfo: ['overview', 'cfo', 'committee', 'findings', 'sites', 'recon', 'fs', 'fraud', 'risks', 'recommendations', 'actions', 'copilot', 'reports', 'qc', 'quality', 'requirements'],
  finance: ['cfo', 'findings', 'sites', 'recon', 'fs', 'recommendations', 'actions', 'reports', 'requirements', 'quality'],
  treasury: ['cfo', 'findings', 'recon', 'fs', 'actions', 'reports'],
  risk: ['overview', 'risks', 'controls', 'universe', 'findings', 'fraud', 'recommendations', 'reports', 'copilot'],
  compliance: ['findings', 'sites', 'risks', 'controls', 'recommendations', 'actions', 'reports'],
  management: ['actions', 'findings', 'recommendations'],
  committee: ['committee', 'overview', 'findings', 'risks', 'qc'],
  readonly: ['committee', 'overview'],
};
/** Capabilities */
export const CAN = {
  upload: (r: Role) => ['cae', 'senior', 'auditor'].includes(r),
  deleteFile: (r: Role) => r === 'cae',
  editMethodology: (r: Role) => r === 'cae',
  editParameters: (r: Role) => ['cae', 'senior'].includes(r),
  review: (r: Role) => ['cae', 'senior', 'auditor'].includes(r),
  validate: (r: Role) => ['cae', 'senior'].includes(r),
  assign: (r: Role) => ['cae', 'senior', 'auditor'].includes(r),
  updateAction: (r: Role) => ['cae', 'senior', 'auditor', 'management', 'finance', 'treasury', 'cfo', 'compliance'].includes(r),
  unmask: (r: Role) => ['cae', 'senior', 'auditor'].includes(r),
  export: (r: Role) => r !== 'readonly',
  viewEvidence: (r: Role) => r !== 'readonly',
  financeAreasOnly: (r: Role) => ['finance', 'treasury', 'compliance', 'management'].includes(r),
};
export const ROLE_AREAS: Partial<Record<Role, string[]>> = {
  finance: ['gl', 'ap', 'ar', 'recon', 'opex', 'capex', 'budget', 'tax', 'fa', 'inventory', 'contracts'],
  treasury: ['treasury', 'loans', 'recon'],
  compliance: ['tax', 'related', 'contracts', 'procurement'],
};

interface Prefs { lang: Lang; theme: 'light' | 'dark'; role: Role; user: string; unmask: boolean }
interface Nav { page: Page; findingId: string | null; evidence: { findingId: string; index: number } | null; riskId: string | null; testId: string | null; controlId: string | null }

interface Ctx {
  loaded: boolean;
  files: SourceFile[];
  settings: Settings;
  filters: Filters;
  overrides: Record<string, FindingOverride>;
  riskMeta: Record<string, RiskMeta>;
  controlMeta: Record<string, { owner?: string }>;
  actions: ActionItem[];
  snapshots: Snapshot[];
  log: AuditLogEntry[];
  prefs: Prefs;
  nav: Nav;
  analysis: Analysis;
  t: (k: DictKey) => string;
  tl: (l: L | string | undefined | null) => string;
  lang: Lang;
  go: (p: Page, extra?: Partial<Omit<Nav, 'page'>>) => void;
  setNav: (n: Partial<Nav>) => void;
  addFiles: (f: SourceFile[]) => Promise<void>;
  updateFile: (f: SourceFile, why: string) => void;
  removeFile: (id: string) => void;
  setSettings: (s: Settings, why: string) => void;
  setFilters: (f: Filters) => void;
  setOverride: (id: string, o: FindingOverride, why: string) => void;
  setRiskMeta: (id: string, m: RiskMeta) => void;
  setControlMeta: (id: string, m: { owner?: string }) => void;
  upsertAction: (a: ActionItem, why: string) => void;
  addSnapshot: (s: Snapshot) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  log_: (action: string, target: string, detail?: string) => void;
  resetAll: () => Promise<void>;
}

const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error('no ctx'); return c; };

function readPrefs(): Prefs {
  const d: Prefs = { lang: 'en', theme: 'light', role: 'cae', user: 'Chief Audit Executive', unmask: false };
  try { const v = JSON.parse(localStorage.getItem('sumed-prefs') ?? '{}'); return { ...d, ...v, unmask: false }; } catch { return d; }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [settings, setSettingsS] = useState<Settings>(DEFAULT_SETTINGS);
  const [filters, setFiltersS] = useState<Filters>(EMPTY_FILTERS);
  const [overrides, setOverrides] = useState<Record<string, FindingOverride>>({});
  const [riskMeta, setRiskMetaS] = useState<Record<string, RiskMeta>>({});
  const [controlMeta, setControlMetaS] = useState<Record<string, { owner?: string }>>({});
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [prefs, setPrefsS] = useState<Prefs>(readPrefs);
  const [nav, setNavS] = useState<Nav>({ page: 'upload', findingId: null, evidence: null, riskId: null, testId: null, controlId: null });
  const logRef = useRef<AuditLogEntry[]>([]);
  const logQueue = useRef(Promise.resolve());

  useEffect(() => {
    (async () => {
      const [f, s, fl, o, rm, cm, a, sn, lg, nv] = await Promise.all([
        store.allFiles(), store.get('settings', DEFAULT_SETTINGS), store.get('filters', EMPTY_FILTERS), store.get('overrides', {}), store.get('riskMeta', {}), store.get('controlMeta', {}),
        store.get<ActionItem[]>('actions', []), store.get<Snapshot[]>('snapshots', []), store.get<AuditLogEntry[]>('log', []), store.get<Partial<Nav>>('nav', {}),
      ]);
      setFiles(f); setSettingsS({ ...DEFAULT_SETTINGS, ...s }); setFiltersS({ ...EMPTY_FILTERS, ...fl }); setOverrides(o); setRiskMetaS(rm); setControlMetaS(cm); setActions(a); setSnapshots(sn); setLog(lg); logRef.current = lg;
      setNavS((n) => ({ ...n, ...nv, page: nv.page ?? (f.length ? 'overview' : 'upload') }));
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const h = document.documentElement;
    h.lang = prefs.lang; h.dir = prefs.lang === 'ar' ? 'rtl' : 'ltr'; h.dataset.theme = prefs.theme;
    try { localStorage.setItem('sumed-prefs', JSON.stringify({ lang: prefs.lang, theme: prefs.theme, role: prefs.role, user: prefs.user })); } catch { /* storage unavailable */ }
  }, [prefs]);

  useEffect(() => { if (loaded) store.set('nav', nav); }, [nav, loaded]);

  const log_ = useCallback((action: string, target: string, detail = '') => {
    logQueue.current = logQueue.current.then(async () => {
      const next = await appendLog(logRef.current, { user: prefs.user, role: prefs.role, action, target, detail });
      logRef.current = next; setLog(next); await store.set('log', next);
    });
  }, [prefs.user, prefs.role]);

  const analysis = useMemo(() => runAnalysis({ files, settings, filters, overrides, riskMeta, controlMeta, actions, snapshots }), [files, settings, filters, overrides, riskMeta, controlMeta, actions, snapshots]);

  const t = useCallback((k: DictKey) => DICT[k]?.[prefs.lang] ?? String(k), [prefs.lang]);
  const tl = useCallback((l: L | string | undefined | null) => (l == null ? '' : typeof l === 'string' ? l : l[prefs.lang] || l.en), [prefs.lang]);

  const value: Ctx = {
    loaded, files, settings, filters, overrides, riskMeta, controlMeta, actions, snapshots, log, prefs, nav, analysis, t, tl, lang: prefs.lang,
    go: (page, extra = {}) => setNavS((n) => ({ ...n, ...extra, page })),
    setNav: (x) => setNavS((n) => ({ ...n, ...x })),
    addFiles: async (fs) => { for (const f of fs) { await store.putFile(f); log_('UPLOAD', f.name, `sha256=${f.sha256}; status=${f.status}; tables=${f.tables.length}; rows=${f.tables.reduce((s, x) => s + x.rows.length, 0)}`); } setFiles((p) => [...p, ...fs]); },
    updateFile: (f, why) => { store.putFile(f); setFiles((p) => p.map((x) => (x.id === f.id ? f : x))); log_('MAPPING_CHANGE', f.name, why); },
    removeFile: (id) => { const f = files.find((x) => x.id === id); store.deleteFile(id); setFiles((p) => p.filter((x) => x.id !== id)); log_('FILE_REMOVED', f?.name ?? id, `sha256=${f?.sha256}`); },
    setSettings: (s, why) => { setSettingsS(s); store.set('settings', s); log_('SETTINGS_CHANGE', 'settings', why); },
    setFilters: (f) => { setFiltersS(f); store.set('filters', f); },
    setOverride: (id, o, why) => { setOverrides((p) => { const n = { ...p, [id]: { ...p[id], ...o } }; store.set('overrides', n); return n; }); log_('FINDING_UPDATE', id, why); },
    setRiskMeta: (id, m) => { setRiskMetaS((p) => { const n = { ...p, [id]: { ...p[id], ...m } }; store.set('riskMeta', n); return n; }); log_('RISK_UPDATE', id, JSON.stringify(m)); },
    setControlMeta: (id, m) => { setControlMetaS((p) => { const n = { ...p, [id]: { ...p[id], ...m } }; store.set('controlMeta', n); return n; }); log_('CONTROL_UPDATE', id, JSON.stringify(m)); },
    upsertAction: (a, why) => { setActions((p) => { const n = p.some((x) => x.id === a.id) ? p.map((x) => (x.id === a.id ? a : x)) : [...p, a]; store.set('actions', n); return n; }); log_('ACTION_UPDATE', a.id, why); },
    addSnapshot: (s) => { setSnapshots((p) => { const n = [...p, s]; store.set('snapshots', n); return n; }); log_('SNAPSHOT', s.id, s.label); },
    setPrefs: (p) => {
      if (p.role && p.role !== prefs.role) log_('ROLE_SWITCH', p.role, `from ${prefs.role}`);
      if (p.unmask) log_('UNMASK_SENSITIVE', 'session', 'Sensitive values unmasked');
      setPrefsS((x) => ({ ...x, ...p }));
    },
    log_,
    resetAll: async () => {
      // The audit trail survives a workspace reset (never silently erased); the reset itself is logged.
      await logQueue.current;
      const next = await appendLog(logRef.current, { user: prefs.user, role: prefs.role, action: 'WORKSPACE_RESET', target: 'workspace', detail: `${files.length} file(s) removed` });
      await store.clearAll(); await store.set('log', next); location.reload();
    },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
