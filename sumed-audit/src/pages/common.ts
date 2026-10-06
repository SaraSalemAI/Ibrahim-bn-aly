import { useApp, CAN, ROLE_AREAS } from '../state';
import type { Finding } from '../engine/types';

/** Findings visible under the global filters (area / risk level / status) and the role's area scope. */
export function useFindings(): Finding[] {
  const { analysis, filters, prefs } = useApp();
  const scope = CAN.financeAreasOnly(prefs.role) ? ROLE_AREAS[prefs.role] : null;
  return analysis.findings.filter((f) =>
    (!filters.area || f.area === filters.area) && (!filters.risk || f.rating === filters.risk) && (!filters.status || f.status === filters.status) && (!filters.owner || f.owner.toLowerCase().includes(filters.owner.toLowerCase())) && (!scope || scope.includes(f.area)));
}

export function printNow(modal = false) {
  if (modal) document.body.classList.add('print-modal');
  setTimeout(() => { window.print(); document.body.classList.remove('print-modal'); }, 50);
}
