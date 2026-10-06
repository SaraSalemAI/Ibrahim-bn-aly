import { GL_TESTS } from './gl';
import { AP_TESTS } from './ap';
import { AR_TESTS, TR_TESTS, FA_TESTS, IN_TESTS } from './ops';
import { PR_TESTS, PY_TESTS, BU_TESTS, TX_TESTS, LN_TESTS, CT_TESTS, RP_TESTS } from './more';
import { RECON_TESTS } from './recon';
import { SITE_TESTS } from './sites';
import type { TestDef } from './kit';

// Risk re-mapping for tests that primarily address segregation-of-duties or procurement manipulation risks
const RISK_OVERRIDE: Record<string, string> = {
  'GL-13': 'R-IT-01', 'PR-09': 'R-IT-01', 'GL-14': 'R-IT-01',
  'AP-06': 'R-FD-04', 'AP-12': 'R-FD-04', 'PR-02': 'R-FD-04', 'PR-03': 'R-FD-04', 'PR-06': 'R-FD-04',
  'AP-14': 'R-FD-05', 'GL-07': 'R-FD-01', 'AP-01': 'R-FD-01',
};

export const TEST_LIBRARY: TestDef[] = [
  ...GL_TESTS, ...AP_TESTS, ...AR_TESTS, ...TR_TESTS, ...FA_TESTS, ...IN_TESTS,
  ...PR_TESTS, ...PY_TESTS, ...BU_TESTS, ...TX_TESTS, ...LN_TESTS, ...CT_TESTS, ...RP_TESTS,
  ...SITE_TESTS, ...RECON_TESTS,
].map((t) => (RISK_OVERRIDE[t.id] ? { ...t, riskId: RISK_OVERRIDE[t.id] } : t));

export const TEST_BY_ID: Record<string, TestDef> = Object.fromEntries(TEST_LIBRARY.map((t) => [t.id, t]));
export type { TestDef };
