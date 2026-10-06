#!/usr/bin/env node
/* SUMED P2P — automated QA (no dependencies). Run: node tests/run-tests.js
 * Covers: utilities, classification & ingestion, three-way matching, duplicates, aging/totals reconciliation,
 * risk explainability, fraud rules, SoD & authority, controls, no-hallucination rules, FX/tax, scenarios,
 * audit-chain integrity, XLSX writer, and Arabic coverage. */
'use strict';
const load = require('./load.js');
const EXTRA = ['js/core/i18n.js', 'js/core/i18n-ar.js', 'js/reports.js'];
let pass = 0, fail = 0;
const results = [];
const test = (name, fn) => {
  try { fn(); pass++; results.push('  ✔ ' + name); }
  catch (e) { fail++; results.push('  ✖ ' + name + '\n      ' + (e && e.message)); }
};
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const near = (a, b, tol, m) => { if (!(Math.abs(a - b) <= tol)) throw new Error((m || '') + ` expected ≈${b} got ${a}`); };
const section = (t) => results.push('\n' + t);

const fresh = () => { const S = load(EXTRA); S.state.config.asOfDate = '2026-10-06'; return S; };
const demo = () => { const S = fresh(); S.loadDemo(); const R = S.engine.run(); return { S, R, D: S.state.data, U: S.util }; };

/* ---------------- Utilities ---------------- */
section('Utilities');
test('parseNum handles separators, parentheses, Arabic digits, currency text; never returns 0 for garbage', () => {
  const U = fresh().util;
  eq(U.parseNum('1,234,567.89'), 1234567.89); eq(U.parseNum('1.234.567,89'), 1234567.89); eq(U.parseNum('(1,500)'), -1500);
  eq(U.parseNum('EGP 2,450,000'), 2450000); eq(U.parseNum('٢٤٥٠٠٠٠'), 2450000); eq(U.parseNum('abc'), null); eq(U.parseNum(''), null);
});
test('parseDate: ISO, DMY default (Egypt), MDY option, Excel serial, month names; rejects invalid', () => {
  const U = fresh().util;
  eq(U.parseDate('2026-03-05'), '2026-03-05'); eq(U.parseDate('05/03/2026'), '2026-03-05'); eq(U.parseDate('05/03/2026', 'MDY'), '2026-05-03');
  eq(U.parseDate('31/12/2026'), '2026-12-31'); eq(U.parseDate(46000), '2025-12-09'); eq(U.parseDate('12-Mar-2026'), '2026-03-12'); eq(U.parseDate('31/02/2026'), null);
});
test('Invoice-number normalisation & IBAN checksum (ISO 13616)', () => {
  const U = fresh().util;
  eq(U.normInvNo('INV-000452'), U.normInvNo('452')); eq(U.normInvNo('006-INV-00006'), U.normInvNo('6/inv/00006'));
  eq(U.ibanValid('GB82 WEST 1234 5698 7654 32'), true); eq(U.ibanValid('GB82 WEST 1234 5698 7654 33'), false); eq(U.ibanValid(''), null);
});
test('CSV parser: quotes, embedded commas/newlines, semicolon delimiter, BOM', () => {
  const U = fresh().util;
  const r = U.parseCSV('﻿a,b,c\n1,"x, y","multi\nline"\n');
  eq(r.length, 2); eq(r[1][1], 'x, y'); eq(r[1][2], 'multi\nline');
  eq(U.parseCSV('a;b\n1;2')[1][1], '2');
});
test('Sensitive values are masked by default', () => {
  const S = fresh(); const m = S.util.maskAccount('EG380019000500000000263180002');
  ok(m.startsWith('EG38') && m.endsWith('0002') && m.includes('••••'));
  eq(S.sensitive('EG380019000500000000263180002', 'k').includes('••••'), true);
});

/* ---------------- Classification & ingestion ---------------- */
section('Upload → classify → map → normalise');
test('Classifier recognises English and Arabic headers', () => {
  const S = fresh();
  eq(S.classifyHeaders(['Invoice No', 'Supplier ID', 'Invoice Date', 'Due Date', 'Currency', 'Total Amount'], 'register.xlsx').entity, 'invoices');
  eq(S.classifyHeaders(['كود المورد', 'اسم المورد', 'IBAN', 'Tax ID', 'Status'], 'موردين.xlsx').entity, 'suppliers');
  eq(S.classifyHeaders(['Transaction ID', 'Account', 'Value Date', 'Debit', 'Credit', 'Reference', 'Narrative'], 'statement.csv').entity, 'bankTxns');
  eq(S.classifyHeaders(['PO Number', 'Supplier ID', 'PO Date', 'Currency', 'PO Amount', 'Required Delivery Date'], 'po.csv').entity, 'pos');
});
test('CSV ingestion keeps source lineage (file/sheet/row) and flags invalid values without inventing them', () => {
  const S = fresh();
  const csv = 'Supplier ID,Supplier Name,IBAN,Tax ID,Status\nV1,Acme Trading,GB82WEST12345698765432,TX-1,Approved\nV2,Beta Co,,,Approved\n';
  const sh = S.ingest.sheetFromRows('Vendors.csv', 'CSV', S.util.parseCSV(csv));
  eq(sh.entity, 'suppliers');
  const inv = S.ingest.sheetFromRows('Invoices.csv', 'CSV', S.util.parseCSV('Invoice No,Supplier ID,Invoice Date,Due Date,Currency,Total\nA-1,V1,05/09/2026,05/10/2026,EGP,"1,000.00"\nA-2,V2,not a date,,EGP,abc\n'));
  S.ingest.commit([{ fileId: 'f1', name: 'Vendors.csv', sheets: [sh], docs: [], notes: [], status: 'Parsed', hash: 'h1' }, { fileId: 'f2', name: 'Invoices.csv', sheets: [inv], docs: [], notes: [], status: 'Parsed', hash: 'h2' }]);
  const D = S.state.data;
  eq(D.suppliers.length, 2); eq(D.invoices[0]._src.row, 2); eq(D.invoices[0]._src.file, 'Invoices.csv');
  eq(D.invoices[0].invoiceDate, '2026-09-05'); eq(D.invoices[0].total, 1000);
  eq(D.invoices[1].invoiceDate, null); eq(D.invoices[1].total, null);
  ok(D.invoices[1]._issues.some((i) => i.field === 'total' && i.issue === 'invalidNumber'));
  const R = S.engine.run();
  ok(R.dq.issues.some((i) => i.check === 'invalidValues'));
  ok(R.dq.issues.some((i) => i.check === 'missingBankInfo'));
  eq(S.state.mode, 'live');
});
test('Duplicate file upload is detected by hash and skipped', () => {
  const S = fresh();
  const sh = () => S.ingest.sheetFromRows('a.csv', 'CSV', S.util.parseCSV('Supplier ID,Supplier Name,Status\nV1,A,Approved\n'));
  S.ingest.commit([{ fileId: 'a', name: 'a.csv', sheets: [sh()], docs: [], notes: [], status: 'Parsed', hash: 'same' }]);
  S.ingest.commit([{ fileId: 'b', name: 'a-copy.csv', sheets: [sh()], docs: [], notes: [], status: 'Parsed', hash: 'same' }]);
  eq(S.state.data.suppliers.length, 1);
});
test('OCR field extraction: label-anchored fields, IBAN checksum, arithmetic cross-check boosts confidence', () => {
  const S = fresh();
  const text = 'Alpha Marine Services\nTAX INVOICE\nInvoice No: INV-2026-0042\nInvoice Date: 15/09/2026\nDue Date: 15/10/2026\nPO No: PO-DEMO-00012\nSubtotal: EGP 100,000.00\nVAT (14%): 14,000.00\nGrand Total: EGP 114,000.00\nIBAN: GB82 WEST 1234 5698 7654 32\nPayment Terms: Net 30';
  const f = S.ingest.extractInvoiceFields([{ page: 1, text, conf: 1 }], [{ supplierId: 'S001', name: 'Alpha Marine Services' }]);
  eq(f.invoiceNo.value, 'INV-2026-0042'); eq(f.invoiceDate.value, '2026-09-15'); eq(f.dueDate.value, '2026-10-15');
  eq(f.total.value, 114000); eq(f.subtotal.value, 100000); eq(f.tax.value, 14000); eq(f.currency.value, 'EGP');
  eq(f.supplier.value, 'S001'); ok(f.total.confidence >= 0.98); ok(f._arithmetic.ok);
  ok(f.iban.confidence >= 0.95, 'valid IBAN high confidence');
  ok(!f.discount, 'no invented discount');
});

/* ---------------- Demo integrity & reconciliations ---------------- */
section('Totals reconcile to underlying transactions');
const { S, R, D, U } = demo();
test('Demo data is fully labelled synthetic', () => { ok(Object.values(D).every((a) => a.every((r) => r._demo === true))); eq(S.state.mode, 'demo'); });
test('Dashboard Total AP = Σ open invoice outstanding (base, as-of FX)', () => {
  const manual = U.sum(D.invoices.filter((i) => !['Rejected', 'Cancelled'].includes(i.status) && i._outBase != null && Math.abs(i._out) > 0.005), (i) => i._outBase);
  near(R.kpis.totalAP.value, manual, 0.01);
  near(U.sum(R.aging.buckets, (b) => b.amount), R.aging.total, 0.01, 'buckets sum');
  near(U.sum(R.aging.bySup, (s) => s.total), R.aging.total, 0.01, 'by supplier sum');
});
test('Payment totals = payment register totals', () => {
  near(R.kpis.paymentRegisterTotal.value, U.sum(D.payments.filter((p) => ['Executed', 'Reconciled'].includes(p.executionStatus)), (p) => p._netBase), 0.01);
});
test('Spend by supplier / category / month each sum to total spend', () => {
  near(U.sum(R.spend.bySupplier, (x) => x.amount), R.spend.total, 0.01);
  near(U.sum(R.spend.byCategory, (x) => x.amount), R.spend.total, 0.01);
  near(U.sum(R.spend.byMonth, (x) => x.amount), R.spend.total, 0.01);
});
test('AP sub-ledger reconciles to GL except the injected 125,000 difference', () => { near(R.recon.gl.diff, 125000, 1); eq(R.recon.gl.status, 'EXCEPTION'); });
test('Invoice outstanding = total − paid (derived) and overpayments appear as supplier debit balances', () => {
  for (const i of D.invoices.filter((x) => x.total != null)) near(i._out, i.total - i._paid, 0.01, i.invoiceNo);
  ok(D.invoices.some((i) => i._debitBalance), 'debit balance present');
});
test('Every KPI carries lineage: formula + sources, or an explicit unavailable reason', () => {
  for (const k of Object.values(R.kpis)) { ok(k.formula, k.id + ' formula'); ok(k.value == null ? !!k.unavailable : true, k.id + ' unavailable reason'); ok(['DERIVED', 'SOURCE VALUE', 'ASSUMPTION'].includes(k.kind)); }
  ok(R.kpis.totalAP.sources.length > 0 && R.kpis.totalAP.sources[0].rows);
});

section('Three-way matching');
const st = (no) => { const i = D.invoices.find((x) => x.invoiceNo === no); return i && R.match.get(i._key); };
test('Statuses: MATCHED majority; injected PRICE / QUANTITY / MISSING GRN / MISSING PO / DUPLICATE detected', () => {
  const by = {}; for (const m of R.match.values()) by[m.status] = (by[m.status] || 0) + 1;
  ok(by.MATCHED > 100); ok(by['PRICE VARIANCE'] >= 1); ok(by['QUANTITY VARIANCE'] >= 1); ok(by['MISSING GRN'] >= 1); ok(by['MISSING PO'] >= 5); ok(by.DUPLICATE >= 1);
  eq(st('04-INV-NOGRN').status, 'MISSING GRN'); eq(st('09-INV-RND01').status, 'MISSING PO');
});
test('Variance = invoice − receipt value and % shown; nothing fabricated when PO missing', () => {
  const pv = [...R.match.values()].find((m) => m.status === 'PRICE VARIANCE');
  ok(pv.variance > 0 && pv.variancePct > 0); near(pv.variance, pv.invAmount - pv.expectedValue, 0.01);
  const np = st('09-INV-RND01'); eq(np.poAmount, null); eq(np.grnAmount, null); eq(np.variance, null);
});

section('Duplicate detection');
test('Exact, high-risk (reformatted number, both paid) and payment duplicates are found with reasons', () => {
  ok(R.dupInv.list.some((d) => d.level === 'EXACT DUPLICATE' && d.reasons.includes('sameInvoiceNo')));
  const hr = R.dupInv.list.find((d) => d.level === 'HIGH-RISK DUPLICATE');
  ok(hr && hr.reasons.includes('normalisedInvoiceNo') && hr.paidBoth);
  ok(R.dupPay.some((d) => d.level === 'EXACT DUPLICATE' && d.reasons.includes('sameInvoicePaidTwice')));
  ok(R.dupPay.some((d) => d.level === 'HIGH-RISK DUPLICATE'));
});
test('Payments to the same invoice number are not double-counted across duplicate invoices', () => {
  const pair = D.invoices.filter((i) => i.invoiceNo === R.dupInv.list.find((d) => d.level === 'EXACT DUPLICATE').aNo);
  eq(pair.length, 2); ok(pair.filter((i) => i._paid > 0).length <= 1, 'only one of the pair absorbs the payment');
});

section('Fraud & anomaly rules (each with evidence)');
const rules = new Set(R.alerts.list.map((a) => a.rule));
test('Injected scenarios detected', () => {
  ['splitInvoices', 'paymentAfterBankChange', 'beneficiaryMismatch', 'sharedBankAccount', 'sharedAddress', 'relatedParty', 'weekendPayment', 'roundAmount', 'unusualTax', 'offContract', 'dormantReactivated', 'inactiveSupplierPaid', 'paymentNoReference', 'paymentUnapprovedInvoice', 'invalidIban', 'duplicateSupplier', 'belowThreshold', 'priceJump']
    .forEach((r) => ok(rules.has(r), 'missing rule ' + r));
});
test('Every alert has severity, category, action, and source-located evidence rows', () => {
  for (const a of R.alerts.list) { ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(a.severity)); ok(a.category && a.action); ok(a.rows.length && a.rows.every((r) => r._src && r._src.file), a.rule + ' evidence'); }
});
test('Holiday rule is NOT TESTED (calendar not configured) — never assumed', () => ok(R.alerts.notTested.some((n) => n.rule === 'holidayPayment')));
test('Unverified bank change followed by payment is CRITICAL', () => ok(R.alerts.list.some((a) => a.rule === 'paymentAfterBankChange' && a.severity === 'CRITICAL')));

section('Supplier risk (explainable) & performance');
test('Risk scores come with drivers whose points sum to the score (cap 100) and evidence', () => {
  for (const [, r] of R.risk) { eq(r.score, Math.min(100, U.sum(r.drivers, (d) => d.points))); ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(r.rating)); }
  const s1 = R.risk.get('S001'); ok(s1.drivers.some((d) => d.key === 'bankChanged')); ok(s1.drivers.some((d) => d.key === 'spendShare'));
});
test('Performance renormalises over available metrics and reports coverage', () => {
  const p = R.perf.get('S002'); ok(p.score >= 0 && p.score <= 100); ok(p.coverage > 0 && p.coverage <= 100); ok(Array.isArray(p.unavailable));
});

section('Segregation of duties & approval authority');
test('SoD: supplier created & approved by same user; bank change + payment approval by same user', () => {
  ok(R.sod.tx.some((x) => x.duties.join('+') === 'supplier.create+supplier.approve'));
  ok(R.sod.tx.some((x) => x.duties.includes('supplier.bankchange')));
  ok(R.sod.users.some((u) => u.severity === 'CRITICAL'));
});
test('Approval matrix is config-driven (tiers + escalation rules)', () => {
  const c = S.state.config;
  eq(S.engine.requiredApprovers(50000, {}, c).roles.join('|'), 'Department Manager');
  eq(S.engine.requiredApprovers(2e6, {}, c).roles.join('|'), 'Finance Director|CFO');
  ok(S.engine.requiredApprovers(50000, { currency: 'USD' }, c).roles.includes('Treasury Manager'));
  ok(S.engine.requiredApprovers(null, {}, c).roles.length === 0, 'no FX → tier unknown, not guessed');
});
test('Payment above authority is detected', () => ok(R.authority.exceptions.some((x) => x.missing.includes('CFO'))));

section('Controls');
test('Control tests: valid statuses; FAIL/WARNING only with exceptions; PASS only without', () => {
  for (const t of R.controls.tests) {
    ok(['PASS', 'WARNING', 'FAIL', 'NOT TESTED'].includes(t.status));
    if (t.status === 'PASS') eq(t.count, 0, t.id); if (t.status === 'FAIL' || t.status === 'WARNING') ok(t.count > 0, t.id);
  }
  eq(R.controls.tests.find((t) => t.id === 'FR-04').status, 'NOT TESTED');
  eq(R.controls.tests.find((t) => t.id === 'AU-01').status, 'PASS');
});
test('Bank reconciliation finds missing, wrong amount, timing, reversal and unexplained bank debit', () => {
  const types = new Set(R.bank.items.map((x) => x.type));
  ['missingInBank', 'wrongAmount', 'timingDifference', 'reversed', 'bankWithoutPayment'].forEach((t) => ok(types.has(t), t));
});

section('No-hallucination rules');
test('Missing FX rate → excluded from base totals and labelled, never estimated', () => {
  const g = D.invoices.find((i) => i.currency === 'GBP');
  eq(g._outBase, null); eq(g._fxMissing, true);
  ok(R.kpis.totalAP.excluded.some((e) => e.reason === 'FX RATE NOT AVAILABLE'));
});
test('Empty workspace: KPIs empty/unavailable, DPO unavailable with reason, no alerts invented', () => {
  const E = fresh(); const r = E.engine.run();
  eq(r.kpis.totalAP.value, 0); eq(r.dpo.value, null); ok(/missing/i.test(r.dpo.lineage.unavailable));
  eq(r.alerts.list.length, 0); eq(r.insights.length, 0); eq(r.savings.length, 0);
});
test('Tax rates are never assumed: without configuration the tax-rate rule is NOT TESTED', () => {
  const E = fresh(); E.loadDemo(); E.state.config.taxCodes = []; E.state.data.taxCodes = [];
  const r = E.engine.run();
  ok(r.alerts.notTested.some((n) => n.rule === 'unusualTax')); eq(r.controls.tests.find((t) => t.id === 'TX-01').status, 'NOT TESTED');
});
test('DPO computed only from GL inputs; formula inputs disclosed', () => { ok(R.dpo.value > 0); eq(R.dpo.lineage.inputs.length, 4); });
test('Savings always carry a method; unquantifiable ones have saving = null', () => {
  for (const s of R.savings) { ok(s.method && s.confidence); if (['maverick', 'competition', 'unusedPO'].includes(s.type)) eq(s.saving, null, s.type); }
});

section('Treasury & scenarios');
test('Cash forecast identity per currency: closing = opening + Σin − Σout', () => {
  for (const c of Object.values(R.cash.currencies).filter((x) => x.opening != null)) {
    const last = c.series[c.series.length - 1].closing;
    near(last, c.opening + c.totals.inflow - c.totals.scheduled - c.totals.approved - c.totals.other, 0.01, c.currency);
  }
  ok(Object.values(R.cash.currencies).some((c) => c.belowMinDays > 0), 'EUR liquidity gap detected');
});
test('Scenario is labelled SCENARIO — NOT ACTUAL; delaying payments cannot lower the end cash', () => {
  const sc = S.engine.scenario(D, R.P, S.state.config, R.asOf, R.items, { delayDays: 7 });
  eq(sc.label, 'SCENARIO — NOT ACTUAL'); ok(sc.impact.endCashDelta >= -0.01);
  const sc2 = S.engine.scenario(D, R.P, S.state.config, R.asOf, R.items, { collectionsPct: 20 });
  ok(sc2.impact.endCashDelta < 0, 'lower collections reduce cash');
});

section('Audit trail');
test('Hash chain verifies, and tampering is detected', () => {
  const E = fresh(); E.audit('a', 'x', '1'); E.audit('b', 'x', '2', { oldValue: 1, newValue: 2 });
  ok(E.verifyAudit().ok);
  ok(Object.isFrozen(E.state.audit[0]), 'entries frozen');
  const copy = E.state.audit.map((e) => Object.assign({}, e)); copy[0].newValue = 'tampered';
  E.state.audit = copy; eq(E.verifyAudit().ok, false);
});
test('Workflow edits keep old/new values in the audit trail and on the record', () => {
  const E = fresh(); E.loadDemo(); E.engine.run();
  const inv = E.state.data.invoices[0]; const before = E.state.audit.length;
  E.updateRecord('invoices', inv, 'approvalStatus', 'Rejected', 'test', 'invoice.reject');
  const last = E.state.audit[E.state.audit.length - 1];
  eq(E.state.audit.length, before + 1); eq(last.newValue, 'Rejected'); ok(inv._edits.approvalStatus);
});

section('Exports & localisation');
test('XLSX writer produces a valid OOXML package (central directory, all parts, sheet XML)', () => {
  const E = fresh();
  E.reports.xlsxParts = true;
  const parts = E.reports.xlsx([{ name: 'Summary', rows: [['A', 'B'], [1, 'x & <y>']] }, { name: 'KPIs', rows: [['k'], [2]] }], false);
  const buf = Buffer.concat(parts.map((p) => Buffer.from(p)));
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  ok(eocd > 0, 'EOCD present');
  const entries = buf.readUInt16LE(eocd + 10), cdSize = buf.readUInt32LE(eocd + 12), cdOff = buf.readUInt32LE(eocd + 16);
  eq(entries, 7); eq(cdOff + cdSize, eocd, 'central directory placement');
  const names = []; let p = cdOff;
  for (let i = 0; i < entries; i++) { const n = buf.readUInt16LE(p + 28), x = buf.readUInt16LE(p + 30), c = buf.readUInt16LE(p + 32); names.push(buf.slice(p + 46, p + 46 + n).toString()); p += 46 + n + x + c; }
  ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/styles.xml'].forEach((n) => ok(names.includes(n), n));
  ok(buf.toString().includes('x &amp; &lt;y&gt;'), 'XML escaped');
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'sumed-test.xlsx'), buf);
});
test('Arabic covers every UI key, with identical {placeholders}', () => {
  const { keys, S: X } = require('../tools/extract-i18n.js');
  const missing = [...keys.keys()].filter((k) => X.i18n.ar[k] == null);
  eq(missing.length, 0, 'missing: ' + missing.slice(0, 5).join(', '));
  const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
  const bad = [...keys.entries()].filter(([k, en]) => ph(en) !== ph(X.i18n.ar[k]));
  eq(bad.length, 0, 'placeholder mismatch: ' + bad.slice(0, 5).map((b) => b[0]).join(', '));
});
test('Rule / driver / insight texts render in both languages without raw keys', () => {
  const t = (k, p) => S.t(k, p);
  for (const lang of ['en', 'ar']) {
    S.state.prefs.lang = lang;
    for (const a of R.alerts.list) ok(!/^rule\./.test(t('rule.' + a.rule, a.params)));
    for (const [, r] of R.risk) for (const d of r.drivers) ok(!/^drv\./.test(t('drv.' + d.key, d.params)));
  }
  S.state.prefs.lang = 'en';
});

console.log('SUMED P2P — QA test run');
console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
