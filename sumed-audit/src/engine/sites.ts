import type { SiteDef, SourceRow, SourceTable } from './types';
import { accessor, norm } from './values';

/** Default SUMED sites as requested by Internal Audit. Editable in Settings; keywords are matched against source values. */
export const DEFAULT_SITES: SiteDef[] = [
  { id: 'HO', name: { en: 'Head Office', ar: 'المركز الرئيسي' }, keywords: ['head office', 'headquarters', 'hq', 'main office', 'alexandria', 'المركز الرئيسي', 'المركز الرئيسى', 'الادارة العامة', 'الإدارة العامة', 'الاسكندرية', 'الإسكندرية'] },
  { id: 'SOK', name: { en: 'Ain Sokhna', ar: 'السخنة' }, keywords: ['sokhna', 'sukhna', 'ain sokhna', 'el sokhna', 'السخنة', 'العين السخنة', 'سخنة'] },
  { id: 'KER', name: { en: 'Sidi Kerir', ar: 'سيدي كرير' }, keywords: ['kerir', 'kreir', 'sidi kerir', 'sidi krir', 'كرير', 'سيدي كرير', 'سيدى كرير'] },
  { id: 'DAH', name: { en: 'Dahshour', ar: 'دهشور' }, keywords: ['dahshour', 'dahshur', 'dahshoor', 'دهشور'] },
];

export const UNASSIGNED = '__unassigned__';

/** Resolve a raw site/location text to a configured site ID (longest keyword wins). Returns null if no match. */
const cache = new WeakMap<SiteDef[], Map<string, string | null>>();

export function resolveSite(raw: string, sites: SiteDef[]): string | null {
  let c = cache.get(sites);
  if (!c) { c = new Map(); cache.set(sites, c); }
  const hit0 = c.get(raw);
  if (hit0 !== undefined) return hit0;
  const r = resolveUncached(raw, sites);
  c.set(raw, r);
  return r;
}

function resolveUncached(raw: string, sites: SiteDef[]): string | null {
  const v = norm(raw);
  if (!v) return null;
  let best: { id: string; len: number } | null = null;
  for (const s of sites) {
    for (const k of [s.id, s.name.en, s.name.ar, ...s.keywords]) {
      const kk = norm(k);
      if (!kk) continue;
      const hit = kk.length <= 3 ? v === kk || v.split(' ').includes(kk) : v.includes(kk);
      if (hit && (!best || kk.length > best.len)) best = { id: s.id, len: kk.length };
    }
  }
  return best?.id ?? null;
}

/** Site of a row: Site field, else Location / Department / Cost center text. */
export function rowSite(t: SourceTable, r: SourceRow, sites: SiteDef[]): string | null {
  const a = accessor(t);
  for (const f of ['site', 'location', 'costCenter', 'department']) {
    if (!a.has(f)) continue;
    const id = resolveSite(a.t(r, f), sites);
    if (id) return id;
  }
  return null;
}
