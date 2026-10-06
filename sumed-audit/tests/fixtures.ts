// SYNTHETIC TEST FIXTURES — fabricated values used only to verify audit rules in unit tests.
// They are NOT SUMED data and are never loaded by the application.
import { buildTable } from '../src/engine/classify';
import { parseDelimited } from '../src/engine/parse';
import type { SourceFile } from '../src/engine/types';

export function fileFromCsv(name: string, csv: string): SourceFile {
  const id = name.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase().padEnd(10, 'x') + '-test';
  const t = buildTable(id, name, name, 0, parseDelimited(csv));
  return { id, name, ext: 'csv', size: csv.length, sha256: 'synthetic', uploadedAt: '2026-01-01T00:00:00Z', uploadedBy: 'test', periodLabel: '', status: 'parsed', tables: t ? [t] : [] };
}

export const GL_CSV = [
  'Journal ID,Journal Date,Posting Date,Account Code,Account Name,Debit,Credit,Currency,Description,User,Approver,Source Module,Cost Center',
  'J1,2025-03-02,2025-03-02,1100,Bank - CIB,1000,0,EGP,Receipt,ali,omar,AR,HO',
  'J1,2025-03-02,2025-03-02,4000,Revenue,0,1000,EGP,Receipt,ali,omar,AR,HO',
  'J2,2025-03-07,2025-03-07,6100,Maintenance expense,5000,0,EGP,Maintenance Sokhna,sara,sara,Manual,Ain Sokhna',  // Friday + self-approved + manual
  'J2,2025-03-07,2025-03-07,2100,Accounts payable,0,5000,EGP,Maintenance Sokhna,sara,sara,Manual,Ain Sokhna',
  'J3,2025-03-10,2025-05-20,6200,Suspense account,700,0,EGP,adjust per CFO,ali,omar,Manual,HO',              // backdated, suspense, keyword, unbalanced
  'J3,2025-03-10,2025-05-20,1100,Bank - CIB,0,600,EGP,adjust per CFO,ali,omar,Manual,HO',
  'J4,2025-03-11,2025-03-11,6100,Maintenance expense,5000,0,EGP,Maintenance Sokhna,ali,omar,AP,Ain Sokhna',  // duplicate of J2 lines? different date — not dup
  'J4,2025-03-11,2025-03-11,2100,Accounts payable,0,5000,EGP,Maintenance Sokhna,ali,omar,AP,Ain Sokhna',
].join('\n');

export const AP_CSV = [
  'Vendor,Invoice Number,PO Number,Invoice Date,Due Date,Amount,Currency,Payment Date,Approval Status,Site,Bank Account',
  'Delta Supplies,INV-100,PO-1,2025-02-01,2025-03-01,12000,EGP,2025-03-01,Approved,Head Office,EG001',
  'Delta Supplies,INV-100,PO-1,2025-02-01,2025-03-01,12000,EGP,2025-03-03,Approved,Head Office,EG001',     // duplicate invoice
  'Nile Tech,INV-7,,2025-02-10,2025-03-10,9800,EGP,2025-02-05,Pending,السخنة,EG002',                         // no PO, paid before invoice, unapproved
  'Kerir Services,K-1,PO-9,2025-04-01,2025-05-01,48000,EGP,2025-06-15,Approved,Sidi Kerir,EG003',            // paid after contract expiry
  'Dahshour Trading,D-1,PO-10,2025-04-02,2025-05-02,3000,EGP,2025-05-02,Approved,Somewhere,EG001',          // shared bank with Delta, site unassigned
].join('\n');

export const CONTRACTS_CSV = [
  'Contract ID,Counterparty,Start Date,End Date,Contract Value,Billed to Date,Site',
  'C-1,Kerir Services,2024-01-01,2025-05-31,100000,120000,Sidi Kerir',   // billed > value
  'C-2,Delta Supplies,2024-01-01,2026-12-31,500000,24000,Dahshour',        // AP at Head Office → cross-site
].join('\n');

export const PAYROLL_CSV = [
  'Employee ID,Employee Name,Department,Gross Salary,Deductions,Net Salary,Payroll Date,Bank Account,Employment Status',
  'E1,Ahmed Hassan,Finance,10000,1000,9000,2025-03-25,EG900,Active',
  'E2,Mona Ali,Operations,12000,1500,10500,2025-03-25,EG900,Active',      // shared bank account
  'E3,Karim Adel,Operations,8000,800,7000,2025-03-25,EG902,Terminated',   // terminated paid; arithmetic error
].join('\n');
