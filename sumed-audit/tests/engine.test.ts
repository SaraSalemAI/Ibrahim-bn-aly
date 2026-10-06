import { describe, it, expect } from 'vitest';
import { runAnalysis } from '../src/engine/analysis';
import { DEFAULT_SETTINGS, EMPTY_FILTERS } from '../src/engine/defaults';
import { num, isoDate, isApproved } from '../src/engine/values';
import { resolveSite } from '../src/engine/sites';
import { classify } from '../src/engine/classify';
import type { Settings } from '../src/engine/types';
import { fileFromCsv, GL_CSV, AP_CSV, CONTRACTS_CSV, PAYROLL_CSV } from './fixtures';

const run = (files = [fileFromCsv('gl.csv', GL_CSV), fileFromCsv('ap.csv', AP_CSV), fileFromCsv('contracts.csv', CONTRACTS_CSV), fileFromCsv('payroll.csv', PAYROLL_CSV)], settings: Partial<Settings> = {}, filters = EMPTY_FILTERS) =>
  runAnalysis({ files, settings: { ...DEFAULT_SETTINGS, ...settings }, filters, overrides: {}, riskMeta: {}, controlMeta: {}, actions: [], snapshots: [], today: '2025-12-31' });

const keysOf = (a: ReturnType<typeof run>, id: string) => a.resultById[id].exceptions.map((e) => e.key);

describe('value parsing', () => {
  it('parses numbers in common formats', () => {
    expect(num('1,234.50')).toBe(1234.5);
    expect(num('(500)')).toBe(-500);
    expect(num('EGP 1,000')).toBe(1000);
    expect(num('١٢٣')).toBe(123);
    expect(num('abc')).toBeNull();
  });
  it('parses dates day-first and ISO', () => {
    expect(isoDate('2025-03-07')).toBe('2025-03-07');
    expect(isoDate('07/03/2025')).toBe('2025-03-07');
    expect(isoDate('31/02/2025')).toBeNull();
  });
  it('interprets approval status without false positives', () => {
    expect(isApproved('Approved')).toBe(true);
    expect(isApproved('Approved by John')).toBe(true);
    expect(isApproved('Pending approval')).toBe(false);
    expect(isApproved('معتمد')).toBe(true);
    expect(isApproved('غير معتمد')).toBe(false);
  });
});

describe('classification', () => {
  it('classifies GL and AP by headers', () => {
    expect(classify(['Journal ID', 'Journal Date', 'Account Code', 'Debit', 'Credit'], 'export').type).toBe('gl');
    expect(classify(['Vendor', 'Invoice Number', 'Amount', 'PO Number'], 'x').type).toBe('ap');
  });
  it('resolves SUMED sites in English and Arabic', () => {
    const s = DEFAULT_SETTINGS.sites;
    expect(resolveSite('Ain Sokhna Terminal', s)).toBe('SOK');
    expect(resolveSite('السخنة', s)).toBe('SOK');
    expect(resolveSite('سيدي كرير', s)).toBe('KER');
    expect(resolveSite('Dahshour pumping station', s)).toBe('DAH');
    expect(resolveSite('المركز الرئيسى', s)).toBe('HO');
    expect(resolveSite('Somewhere', s)).toBeNull();
  });
});

describe('no-hallucination behaviour', () => {
  it('shows nothing and performs no test without data', () => {
    const a = run([]);
    expect(a.hasData).toBe(false);
    expect(a.findings).toHaveLength(0);
    expect(a.results.every((r) => r.status === 'insufficient')).toBe(true);
    expect(a.qcStatus).toBe('FAIL');
  });
  it('does not perform threshold tests without configured parameters', () => {
    const a = run();
    expect(a.resultById['GL-03'].status).toBe('insufficient'); // holidays not configured
    expect(a.resultById['AP-06'].status).toBe('insufficient'); // approval limits not configured
    expect(a.resultById['GL-06'].status).toBe('insufficient'); // large threshold / materiality not configured
    expect(a.resultById['GL-04'].status).toBe('insufficient'); // working hours
  });
  it('does not assume currency for amounts without currency', () => {
    const a = run();
    const py = a.findingById['F-PY-03'];
    expect(Object.keys(py.exposure)).toEqual(['—']);
  });
});

describe('audit tests detect injected anomalies', () => {
  const a = run();
  it('GL', () => {
    expect(keysOf(a, 'GL-01')).toEqual(['GL-01|J3']);
    expect(keysOf(a, 'GL-02')).toEqual(['GL-02|J2']); // Friday
    expect(keysOf(a, 'GL-13')).toEqual(['GL-13|J2']);
    expect(keysOf(a, 'GL-09')).toEqual(['GL-09|J3']);
    expect(a.resultById['GL-08'].status).toBe('insufficient'); // approval status column not in extract
    expect(a.resultById['GL-11'].exceptions.length).toBe(1);
  });
  it('AP', () => {
    expect(a.resultById['AP-01'].exceptions).toHaveLength(1);
    expect(a.resultById['AP-01'].exceptions[0].money).toEqual({ amount: 12000, currency: 'EGP' });
    expect(a.resultById['AP-02'].exceptions).toHaveLength(1);
    expect(a.resultById['AP-04'].exceptions).toHaveLength(1);
    expect(a.resultById['AP-08'].exceptions).toHaveLength(1);
    expect(a.resultById['AP-10'].exceptions).toHaveLength(1);
  });
  it('payroll', () => {
    expect(a.resultById['PY-02'].exceptions).toHaveLength(1);
    expect(a.resultById['PY-03'].exceptions).toHaveLength(1);
  });
  it('site payments & contracts', () => {
    expect(a.resultById['ST-01'].exceptions.map((e) => e.description.en)[0]).toContain('D-1');
    expect(a.resultById['ST-02'].exceptions).toHaveLength(1); // Kerir paid after contract end
    expect(a.resultById['ST-03'].exceptions.length).toBeGreaterThanOrEqual(1); // Delta HO vs contract Dahshour
    expect(a.resultById['CT-01'].exceptions).toHaveLength(1);
  });
});

describe('evidence chain', () => {
  const a = run();
  it('every exception row resolves to file/sheet/row and has highlighted fields', () => {
    for (const r of a.results) for (const e of r.exceptions) {
      expect(e.rows.length).toBeGreaterThan(0);
      for (const ref of e.rows) {
        const t = a.tables.find((x) => x.id === ref.tableId)!;
        expect(t).toBeTruthy();
        expect(t.rows.some((row) => row.recordId === ref.recordId)).toBe(true);
      }
      expect(e.calc.formula.length).toBeGreaterThan(0);
    }
  });
  it('findings are reproducible and flagged for validation when materiality missing', () => {
    for (const f of a.findings) {
      expect(f.evidenceChecks.find((c) => c.id === 'calc')!.pass).toBe(true);
      expect(f.evidenceStatus).toBe('validation-required');
    }
  });
  it('source rows are immutable', () => {
    const row = a.tables[0].rows[0];
    expect(Object.isFrozen(row)).toBe(true);
    expect(Object.isFrozen(row.values)).toBe(true);
  });
});

describe('filters and materiality', () => {
  it('site filter restricts AP to the selected site', () => {
    const a = run(undefined, {}, { ...EMPTY_FILTERS, site: 'SOK' });
    const ap = a.filteredTables.find((t) => t.datasetType === 'ap')!;
    expect(ap.rows).toHaveLength(1);
  });
  it('escalates rating when exposure exceeds overall materiality', () => {
    const a = run(undefined, { materiality: { overall: 10000, performance: 5000, trivial: 100 } });
    expect(a.findingById['F-AP-01'].rating).toBe('critical');
  });
});

describe('financial statement classification', () => {
  it('classifies bank loans as borrowings, not cash', async () => {
    const { classifyAccount } = await import('../src/engine/fsa');
    expect(classifyAccount('Borrowings Bank loans')).toBe('debt');
    expect(classifyAccount('Current assets - cash Bank - CIB current')).toBe('cash');
    expect(classifyAccount('Non-current assets Accumulated depreciation')).toBe('nonCurrentAssets');
    expect(classifyAccount('Depreciation Depreciation expense')).toBe('depreciation');
  });
});

describe('audit trail', () => {
  it('hash chain detects tampering', async () => {
    const { appendLog, verifyLog } = await import('../src/store/db');
    let log = await appendLog([], { user: 'u', role: 'cae', action: 'A', target: 't', detail: 'd' });
    log = await appendLog(log, { user: 'u', role: 'cae', action: 'B', target: 't', detail: 'd' });
    expect(await verifyLog(log)).toBeNull();
    const tampered = [log[0], { ...log[1], detail: 'changed' }];
    expect(await verifyLog(tampered)).toBe(2);
  });
});
