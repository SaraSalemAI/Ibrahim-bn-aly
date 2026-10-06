/* SUMED P2P — i18n core. S.t(key, englishDefault, params). Arabic lives in i18n-ar.js.
 * Dynamic keys (statuses, rules, drivers…) have their English text in S.i18n.en below. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  S.i18n = S.i18n || { en: {}, ar: {} };

  const interp = (s, p) => (p ? String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] == null ? '—' : p[k])) : String(s));
  S.lang = () => (S.state && S.state.prefs.lang) || 'en';
  S.isAr = () => S.lang() === 'ar';
  S.t = (key, def, params) => {
    if (def && typeof def === 'object') { params = def; def = undefined; }
    const lang = S.lang();
    let s = lang === 'ar' ? S.i18n.ar[key] : undefined;
    if (s == null) s = S.i18n.en[key] != null ? S.i18n.en[key] : def;
    if (s == null) s = S.i18n.en[key] != null ? S.i18n.en[key] : key.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    return interp(s, params);
  };
  S.missing = () => S.t('common.na', 'Not Available in Source Data');

  /* ---------- Formatting (Latin digits in both languages for financial tables) ---------- */
  const loc = () => (S.isAr() ? 'ar-EG-u-nu-latn' : 'en-GB');
  S.fmt = {
    num(v, d = 0) { return v == null || isNaN(v) ? null : new Intl.NumberFormat(loc(), { maximumFractionDigits: d, minimumFractionDigits: d }).format(v); },
    money(v, ccy, opts = {}) {
      if (v == null || isNaN(v)) return null;
      const c = ccy || S.state.config.baseCurrency;
      if (opts.compact) {
        const a = Math.abs(v);
        const [div, suf] = a >= 1e9 ? [1e9, S.t('u.bn', 'bn')] : a >= 1e6 ? [1e6, S.t('u.m', 'M')] : a >= 1e3 ? [1e3, S.t('u.k', 'K')] : [1, ''];
        const n = S.fmt.num(v / div, div === 1 ? 0 : a / div >= 100 ? 0 : 1) + suf;
        return S.isAr() ? `${n} ${c}` : `${c} ${n}`;
      }
      const n = S.fmt.num(v, opts.d != null ? opts.d : 2);
      return S.isAr() ? `${n} ${c}` : `${c} ${n}`;
    },
    pct(v, d = 1) { return v == null || isNaN(v) ? null : S.fmt.num(v, d) + '%'; },
    date(iso) {
      if (!iso) return null;
      try { return new Intl.DateTimeFormat(loc(), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(U.toUTC(iso))); } catch (e) { return iso; }
    },
    days(v) { return v == null ? null : S.t('u.days', '{n} days', { n: S.fmt.num(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) }); },
    ts(iso) { if (!iso) return null; const d = new Date(iso); return new Intl.DateTimeFormat(loc(), { dateStyle: 'medium', timeStyle: 'medium' }).format(d); },
  };

  /* ---------- English text for dynamic keys ---------- */
  Object.assign(S.i18n.en, {
    /* severities / statuses */
    'sev.LOW': 'Low', 'sev.MEDIUM': 'Medium', 'sev.HIGH': 'High', 'sev.CRITICAL': 'Critical',
    'ctl.PASS': 'Pass', 'ctl.WARNING': 'Warning', 'ctl.FAIL': 'Fail', 'ctl.NOT TESTED': 'Not tested',
    'm.MATCHED': 'Matched', 'm.PARTIALLY MATCHED': 'Partially matched', 'm.PRICE VARIANCE': 'Price variance', 'm.QUANTITY VARIANCE': 'Quantity variance', 'm.TAX VARIANCE': 'Tax variance', 'm.MISSING GRN': 'Missing GRN', 'm.MISSING PO': 'Missing PO', 'm.DUPLICATE': 'Duplicate', 'm.EXCEPTION': 'Exception',
    'dup.EXACT DUPLICATE': 'Exact duplicate', 'dup.HIGH-RISK DUPLICATE': 'High-risk duplicate', 'dup.POSSIBLE DUPLICATE': 'Possible duplicate',
    'rc.MATCHED': 'Matched', 'rc.UNMATCHED': 'Unmatched', 'rc.PARTIAL': 'Partial', 'rc.EXCEPTION': 'Exception', 'rc.NOT TESTED': 'Not tested',
    'band.Excellent': 'Excellent', 'band.Good': 'Good', 'band.Watch': 'Watch', 'band.Poor': 'Poor', 'band.Critical': 'Critical',
    'doc.Complete': 'Complete', 'doc.Incomplete': 'Incomplete', 'doc.Expired': 'Expired', 'doc.Missing': 'Missing', 'doc.Pending Review': 'Pending review', 'doc.Rejected': 'Rejected',
    'rec.HOLD': 'Hold', 'rec.PAY NOW': 'Pay now', 'rec.PAY EARLY — DISCOUNT': 'Pay early — discount', 'rec.PAY AFTER REVIEW': 'Pay after review', 'rec.SCHEDULE AT DUE DATE': 'Schedule at due date',
    'hz.overdue': 'Overdue', 'hz.today': 'Due today', 'hz.d3': 'Due ≤ 3 days', 'hz.d7': 'Due ≤ 7 days', 'hz.d30': 'Due ≤ 30 days', 'hz.later': 'Due > 30 days', 'hz.noDue': 'No due date',
    'bk.current': 'Current', 'bk.b1_30': '1–30 days', 'bk.b31_60': '31–60 days', 'bk.b61_90': '61–90 days', 'bk.b91_180': '91–180 days', 'bk.b180p': '180+ days', 'bk.noDue': 'No due date',
    'kind.SOURCE VALUE': 'Source value', 'kind.DERIVED': 'Derived', 'kind.ASSUMPTION': 'Assumption', 'kind.UNAVAILABLE': 'Unavailable',
    'conf.High': 'High', 'conf.Medium': 'Medium', 'conf.Low': 'Low',
    'mode.demo': 'DEMO MODE', 'mode.live': 'LIVE DATA', 'mode.empty': 'NO DATA',
    'ftype.scheduled': 'Scheduled payment', 'ftype.approvedInvoice': 'Approved invoice', 'ftype.pendingInvoice': 'Pending-approval invoice', 'ftype.poCommitment': 'Open PO commitment',
    'area.cfo': 'CFO', 'area.treasury': 'Treasury', 'area.ap': 'Accounts Payable', 'area.procurement': 'Procurement', 'area.supplier': 'Supplier', 'area.audit': 'Audit', 'area.fraud': 'Fraud', 'area.cost': 'Cost reduction',
    'bucket.today': 'Urgent today', 'bucket.week': 'This week', 'bucket.month': 'This month',
    'cat.PAYMENT': 'Payment', 'cat.SUPPLIER': 'Supplier', 'cat.PROCUREMENT': 'Procurement', 'cat.CONTRACT': 'Contract', 'cat.TAX': 'Tax', 'cat.BANK': 'Bank', 'cat.FRAUD': 'Fraud', 'cat.COMPLIANCE': 'Compliance', 'cat.LIQUIDITY': 'Liquidity', 'cat.CONTROL': 'Control', 'cat.DATA QUALITY': 'Data quality',
    'dom.supplier': 'Supplier master controls', 'dom.invoice': 'Invoice controls', 'dom.po': 'PO controls', 'dom.grn': 'GRN controls', 'dom.payment': 'Payment controls', 'dom.bank': 'Bank controls', 'dom.approval': 'Approval controls', 'dom.sod': 'Segregation of duties', 'dom.contract': 'Contract controls', 'dom.tax': 'Tax controls', 'dom.duplicate': 'Duplicate controls', 'dom.fraud': 'Fraud controls', 'dom.audit': 'Audit trail controls',

    /* onboarding stages */
    'ob.request': 'Supplier request', 'ob.screening': 'Initial screening', 'ob.documentation': 'Documentation', 'ob.tax': 'Tax validation', 'ob.bank': 'Bank validation', 'ob.compliance': 'Compliance review', 'ob.procurement': 'Procurement review', 'ob.finance': 'Finance review', 'ob.approval': 'Approval', 'ob.activation': 'Activation',

    /* fraud / anomaly rules: reason text */
    'rule.duplicateInvoice': '{level}: invoice {b} vs {a}. Signals: {reasons}',
    'rule.duplicatePayment': '{level}: payment {b} vs {a}. Signals: {reasons}',
    'rule.roundAmount': 'Round-number invoice {ccy} {amount} (multiple of {modulo}){nonPO}',
    'rule.unusualAmount': 'Amount is an outlier for this supplier (robust z = {z}; median {median}; {n} invoices)',
    'rule.weekendPayment': 'Payment dated on a configured weekend day ({date})',
    'rule.holidayPayment': 'Payment dated on holiday "{name}" ({date})',
    'rule.urgentManualPayment': 'Urgent / manual payment outside the standard run',
    'rule.paymentAfterBankChange': 'Payment {days} day(s) after a supplier bank-account change (verified: {verified}; changed by {changedBy})',
    'rule.recentBankChange': 'Supplier bank account changed on {date} (verified: {verified})',
    'rule.beneficiaryMismatch': 'Paid to {paid} but supplier master IBAN is {master}',
    'rule.masterChangeBeforePayment': 'Supplier master field "{field}" changed by {by} on {at}, before a payment',
    'rule.belowThreshold': 'Invoice is {pct}% below the approval threshold {threshold}',
    'rule.splitInvoices': '{n} invoices within {days} days total {total}, each below threshold {threshold}',
    'rule.dormantReactivated': 'Supplier inactive for {gap} days (last invoice {last}) suddenly invoicing',
    'rule.paymentUnknownSupplier': 'Payment to a supplier that is not in the supplier master',
    'rule.inactiveSupplierPaid': 'Payment to a supplier with status "{status}"',
    'rule.paymentNoInvoice': 'Payment without a matching invoice (reference {ref})',
    'rule.paymentUnapprovedInvoice': 'Payment against invoice {inv} whose approval status is "{status}"',
    'rule.paymentNoPO': 'Payment for non-PO invoice {inv}',
    'rule.paymentNoGRN': 'Payment for PO {po} with no goods/service receipt',
    'rule.paymentNoApproval': 'Executed payment without approval (status "{status}")',
    'rule.paymentNoReference': 'Executed payment without a bank reference',
    'rule.paymentFrequency': '{n} payments to the same supplier within 7 days',
    'rule.sharedBankAccount': 'Suppliers {names} share bank account {iban}',
    'rule.sharedAddress': 'Suppliers {names} share the same address',
    'rule.duplicateSupplier': 'Possible duplicate supplier records: {names}',
    'rule.relatedParty': 'Supplier shares {fields} with employee/user {user} (related-party indicator)',
    'rule.priceJump': 'Unit price of {item} rose {pct}% ({from} → {to}) versus the previous PO',
    'rule.unusualQuantity': 'Invoiced quantity {qty} of {item} is > 3× the median ({median})',
    'rule.unusualTax': 'Effective VAT rate {rate}% does not match configured rate(s) {configured}%',
    'rule.missingTax': 'Invoice has no tax information',
    'rule.contractExceeded': 'Contract {contract} utilisation {util}% — value exceeded',
    'rule.offContract': '{n} invoice(s) dated outside contract {contract} (ended {end})',
    'rule.invalidIban': 'Supplier IBAN {iban} fails the ISO 13616 checksum',
    'rule.liquidityGap': '{ccy} projected below minimum cash for {days} day(s); lowest on {date}',
    'rule.controlFail': 'Control test {id} failed with {n} exception(s)',
    'rule.dq_duplicateInvoices': 'Exact duplicate invoices in the register ({n})', 'rule.dq_unknownSupplier': 'Invoices for suppliers not in the master ({n})', 'rule.dq_unknownSupplierPayment': 'Payments to suppliers not in the master ({n})', 'rule.dq_missingField': 'Required field "{field}" missing ({n})', 'rule.dq_invalidValues': 'Unparseable values ({n})', 'rule.dq_paymentWithoutApprovedInvoice': 'Payments without an approved invoice ({n})', 'rule.dq_paymentWithoutBankRef': 'Executed payments without bank reference ({n})', 'rule.dq_invoiceWithoutGRN': 'PO invoices without GRN ({n})', 'rule.dq_missingSupplierTaxId': 'Active suppliers missing tax ID ({n})', 'rule.dq_missingBankInfo': 'Active suppliers missing bank details ({n})', 'rule.dq_invalidIban': 'Invalid IBANs ({n})', 'rule.dq_fxMissing': 'Transactions without FX rate ({n})', 'rule.dq_duplicateKey': 'Duplicate primary keys "{field}" ({n})', 'rule.dq_possibleDuplicateInvoices': 'Possible duplicate invoices ({n})', 'rule.dq_duplicatePaymentRefs': 'Duplicate payment references ({n})', 'rule.dq_invoicePONotFound': 'Invoice PO not found in PO register ({n})', 'rule.dq_negativePayments': 'Negative payments ({n})',

    /* recommended actions */
    'act.recoverDuplicate': 'Stop / recover the duplicate amount from the supplier; block the second document.',
    'act.holdDuplicate': 'Put the later invoice on hold; confirm with the supplier before approval.',
    'act.verifySupport': 'Obtain and verify supporting documents before approval/payment.',
    'act.confirmAuthorisation': 'Confirm the authorisation and business reason; document the exception.',
    'act.callbackVerify': 'Independent call-back to the supplier on master-file contact; hold payments until verified.',
    'act.reviewSplit': 'Review for threshold avoidance; re-route through the correct approval tier.',
    'act.blockPayment': 'Block further payments; investigate and recover if unsupported.',
    'act.obtainGRN': 'Obtain goods/service receipt before further payments.',
    'act.reconcile': 'Obtain bank reference and reconcile against the bank statement.',
    'act.investigateSupplier': 'Investigate supplier identity and relationships; block until cleared.',
    'act.mergeSuppliers': 'Confirm whether records are the same entity; merge and block the duplicate.',
    'act.renegotiate': 'Challenge the price increase; renegotiate or re-tender.',
    'act.taxReview': 'Tax review against configured rates and supplier tax registration.',
    'act.contractAmend': 'Stop new orders; amend/renew the contract or re-tender.',
    'act.arrangeFunding': 'Re-sequence payments or arrange funding / FX conversion before the gap date.',
    'act.remediateControl': 'Assign control owner; remediate exceptions and re-test.',
    'act.fixData': 'Correct the source data and re-upload.',
    'act.payOrSchedule': 'Approve for the next payment run.',
    'act.reviewBeforePay': 'Compliance/procurement review before releasing payment.',
    'act.expediteApproval': 'Escalate approvals to avoid late payment.',
    'act.renewOrRetender': 'Start renewal or re-tender; confirm continuity of supply.',
    'act.obtainDocuments': 'Request updated documents; suspend new POs if not received.',

    /* risk drivers */
    'drv.spendShare': '{pct}% of 12-month supplier spend is with this supplier',
    'drv.apExposure': '{pct}% of total outstanding AP',
    'drv.overdueBalance': 'Overdue balance outstanding: {amount}',
    'drv.critical': 'Flagged as critical supplier',
    'drv.singleSource': 'Single-source dependency',
    'drv.contractExpiredOpenPO': 'Contract {contract} expired {days} days ago with open POs',
    'drv.contractExpiring': 'Contract {contract} expires in {days} days',
    'drv.lateDeliveries': '{count} late deliveries',
    'drv.qualityIssues': '{qty} units rejected at receipt',
    'drv.performanceLow': 'Performance score {score}/100',
    'drv.exceptionRate': 'Invoice exception rate {pct}% ({n}/{total})',
    'drv.pricingAnomaly': '{n} invoice(s) with price variance vs PO',
    'drv.bankChanged': '{n} bank-detail change(s) in the last {days} days ({unverified} unverified)',
    'drv.taxIdMissing': 'Tax ID missing in supplier master',
    'drv.sanctionsNotCleared': 'Sanctions screening status: {status}',
    'drv.nonCompliant': 'Compliance status: {status}',
    'drv.docsExpired': 'Expired documents: {docs}',
    'drv.docsMissing': 'Missing documents: {docs}',
    'drv.insuranceExpired': 'Insurance expired ({date})',
    'drv.blocked': 'Supplier status: {status}',
    'drv.anomalies': '{n} open medium+ anomaly alert(s)',

    /* match reasons */
    'mr.invoiceClosed': 'Invoice is {0}', 'mr.duplicateOf': 'Duplicate of {0} ({1})', 'mr.creditNote': 'Credit note — match manually against the original invoice', 'mr.noPOReference': 'No PO reference on invoice', 'mr.poNotInRegister': 'PO {0} not found in PO register', 'mr.supplierMismatch': 'PO belongs to supplier {0}', 'mr.currencyMismatch': 'Currency mismatch {0}', 'mr.poStatus': 'PO status is {0}', 'mr.noReceiptForPO': 'No goods/service receipt for the PO', 'mr.lateDelivery': 'Delivered {0} day(s) after required date', 'mr.itemNotOnPO': 'Item {0} not on PO', 'mr.priceVariance': 'Item {0}: unit price {1}% above PO', 'mr.qtyVariance': 'Item {0}: invoiced {1} more than received & not yet invoiced', 'mr.cumulativeInvoicedExceeds': 'Cumulative invoiced value exceeds {0} value', 'mr.headerOnlyNoLineData': 'Header-level match only (line data unavailable)', 'mr.taxRate': 'Tax rate {0}',

    /* priority blocks / warnings */
    'blk.notApproved': 'Invoice not approved', 'blk.match': 'Match status: {0}', 'blk.supplierNotInMaster': 'Supplier not in master', 'blk.supplierStatus': 'Supplier status: {0}', 'blk.openDispute': 'Open dispute', 'blk.alreadyScheduled': 'Already in a payment batch', 'blk.noDueDate': 'Due date missing', 'blk.nonPO': 'Non-PO invoice', 'blk.taxVariance': 'Tax variance', 'blk.supplierRisk': 'Supplier risk {0}', 'blk.fxMissing': 'FX rate not available',

    /* duplicate signals */
    'sig.sameSupplier': 'same supplier', 'sig.sameInvoiceNo': 'same invoice number', 'sig.normalisedInvoiceNo': 'same number after normalisation', 'sig.sameAmount': 'same amount', 'sig.similarAmount': 'amount within tolerance', 'sig.dateWithin': 'dates {0} day(s) apart', 'sig.samePO': 'same PO', 'sig.sameFileHash': 'identical file hash', 'sig.similarDescription': 'description {0}% similar', 'sig.sameBankAccount': 'same bank account', 'sig.identicalLines': 'identical line items', 'sig.bothPaid': 'BOTH PAID', 'sig.sameBankReference': 'same bank reference', 'sig.sameInvoicePaidTwice': 'same invoice paid twice', 'sig.invoicesAreDuplicates': 'underlying invoices flagged {0}',

    /* data-quality checks */
    'dq.invalidValues': 'Invalid / unparseable values', 'dq.missingField': 'Missing required field: {0}', 'dq.duplicateRecords': 'Duplicate records (identical rows)', 'dq.duplicateKey': 'Duplicate key: {0}', 'dq.duplicateInvoices': 'Duplicate invoices (exact)', 'dq.possibleDuplicateInvoices': 'Possible / high-risk duplicate invoices', 'dq.duplicatePaymentRefs': 'Duplicate payment references', 'dq.invalidInvoiceNo': 'Invalid invoice numbers', 'dq.unknownSupplier': 'Invoices for unknown suppliers', 'dq.unknownSupplierPayment': 'Payments to unknown suppliers', 'dq.inconsistentSupplierName': 'Inconsistent supplier names', 'dq.similarSupplierNames': 'Near-identical supplier names', 'dq.invoiceWithoutPO': 'Invoices without PO', 'dq.invoiceWithoutGRN': 'Invoices without GRN', 'dq.invoicePONotFound': 'Invoice PO not in PO register', 'dq.poWithoutInvoice': 'Received POs without invoices (> 60 days)', 'dq.invoiceWithoutApproval': 'Invoices awaiting approval beyond SLA', 'dq.paymentWithoutApprovedInvoice': 'Payments without approved invoices', 'dq.paymentWithoutBankRef': 'Payments without bank reference', 'dq.negativeValues': 'Negative invoice values', 'dq.negativePayments': 'Negative payments', 'dq.zeroValue': 'Zero-value invoices', 'dq.zeroPayments': 'Zero-value payments', 'dq.missingTaxInvoice': 'Invoices missing tax information', 'dq.missingSupplierTaxId': 'Active suppliers missing tax ID', 'dq.missingBankInfo': 'Active suppliers missing bank information', 'dq.invalidIban': 'Invalid IBAN checksum', 'dq.fxMissing': 'FX RATE NOT AVAILABLE', 'dq.futureDated': 'Future-dated invoices', 'dq.dueBeforeInvoice': 'Due date before invoice date', 'dq.unusualAmounts': 'Unusual / round amounts',

    /* control tests */
    'ct.SM-01': 'Duplicate suppliers / shared bank accounts', 'ct.SM-02': 'Active suppliers without tax ID', 'ct.SM-03': 'Active suppliers without bank details', 'ct.SM-04': 'Supplier IBAN checksum', 'ct.SM-05': 'Expired supplier documents', 'ct.SM-06': 'Sanctions screening not cleared', 'ct.SM-07': 'Supplier created and approved by same user',
    'ct.IN-01': 'Invoices without PO', 'ct.IN-02': 'Invoices without GRN', 'ct.IN-03': 'Duplicate invoices', 'ct.IN-04': 'Invoices awaiting approval beyond SLA', 'ct.IN-05': 'Three-way match exceptions',
    'ct.PO-01': 'Retrospective POs (PO after invoice)', 'ct.PO-02': 'POs without approval', 'ct.PO-03': 'POs outside contract period',
    'ct.GR-01': 'Receipts dated before PO', 'ct.GR-02': 'Received quantity above PO quantity',
    'ct.PY-01': 'Payments without approval', 'ct.PY-02': 'Payments above approval authority', 'ct.PY-03': 'Duplicate payments', 'ct.PY-04': 'Payments to inactive / unknown suppliers', 'ct.PY-05': 'Manual / emergency payments', 'ct.PY-06': 'Payments without approved invoice', 'ct.PY-07': 'Payments before invoice date',
    'ct.BK-01': 'Payments shortly after bank change', 'ct.BK-02': 'Unverified / self-approved bank changes', 'ct.BK-03': 'Unreconciled payments', 'ct.BK-04': 'Beneficiary ≠ supplier master IBAN',
    'ct.AP-01': 'Threshold avoidance (just below limit)', 'ct.AP-02': 'Split transactions', 'ct.AP-03': 'Batches without required CFO approval',
    'ct.SD-01': 'Transactional segregation-of-duties conflicts', 'ct.SD-02': 'Role design conflicts',
    'ct.CT-01': 'Expired contracts with open invoices', 'ct.CT-02': 'Contracts exceeded', 'ct.CT-03': 'Invoices outside contract period',
    'ct.TX-01': 'Unusual tax rates', 'ct.TX-02': 'Missing tax information',
    'ct.FR-01': 'Shared supplier bank accounts', 'ct.FR-02': 'Related-party indicators', 'ct.FR-03': 'Weekend payments', 'ct.FR-04': 'Holiday payments', 'ct.FR-05': 'Dormant suppliers reactivated',
    'ct.AU-01': 'Audit trail hash-chain integrity',

    /* SoD duties */
    'duty.supplier.create': 'Create supplier', 'duty.supplier.approve': 'Approve supplier', 'duty.supplier.bankchange': 'Change supplier bank', 'duty.invoice.create': 'Create invoice', 'duty.invoice.approve': 'Approve invoice', 'duty.payment.create': 'Create payment', 'duty.payment.approve': 'Approve payment', 'duty.payment.execute': 'Execute payment', 'duty.payment.reconcile': 'Reconcile payment',

    /* insights */
    'ins.concentration.o': '{pct}% of 12-month spend is concentrated with {name}.', 'ins.concentration.w': 'Single-supplier dependency increases price, continuity and negotiation risk.', 'ins.concentration.a': 'Develop alternative sources; lock in contract terms; monitor supplier financial health.',
    'ins.top5.o': 'Top-5 suppliers account for {pct}% of spend (threshold {th}%).', 'ins.top5.w': 'High concentration reduces competitive tension.', 'ins.top5.a': 'Review category strategies for the top-5 suppliers.',
    'ins.belowMin.o': '{ccy} cash is projected below the minimum requirement for {days} day(s); lowest {min} on {date}.', 'ins.belowMin.w': 'Risk of missing obligations or breaching treasury policy.', 'ins.belowMin.a': 'Re-sequence payments, convert FX, or arrange funding before the gap date.',
    'ins.idleCash.o': '{ccy} {amount} stays above minimum cash throughout the forecast horizon.', 'ins.idleCash.w': 'Idle balances may be invested or used to capture early-payment discounts.', 'ins.idleCash.a': 'Assess short-term placement subject to treasury policy.',
    'ins.largeUpcoming.o': '{n} large payment(s) due within {days} days.', 'ins.largeUpcoming.w': 'Large outflows concentrate liquidity and approval risk.', 'ins.largeUpcoming.a': 'Confirm funding and approvals now.',
    'ins.overdue.o': '{pct}% of AP ({n} invoices) is overdue.', 'ins.overdue.w': 'Overdue balances create penalty, relationship and supply-continuity risk.', 'ins.overdue.a': 'Clear approvals/exceptions on overdue invoices; prioritise critical suppliers.',
    'ins.approvalBacklog.o': '{n} invoice(s) awaiting approval for more than {days} days.', 'ins.approvalBacklog.w': 'Approval delays drive late payments and lost discounts.', 'ins.approvalBacklog.a': 'Escalate to approvers; review delegation of authority.',
    'ins.matchExceptions.o': '{n} invoice(s) ({pct}%) have three-way match exceptions.', 'ins.matchExceptions.w': 'Exceptions indicate over-billing, missing receipts or non-PO buying.', 'ins.matchExceptions.a': 'Resolve exceptions before payment; address root causes with procurement.',
    'ins.nonPO.o': 'Non-PO spend is {pct}% of total spend.', 'ins.nonPO.w': 'Bypassing POs weakens budget and price control.', 'ins.nonPO.a': 'Enforce "no PO, no pay" with documented exemptions.',
    'ins.contractExpiring.o': 'Contract {id} with {name} expires in {days} days.', 'ins.contractExpiring.w': 'Expiry without renewal risks off-contract spend and supply disruption.', 'ins.contractExpiring.a': 'Start renewal / re-tender.',
    'ins.supplierRisk.o': '{name} risk is {rating} ({score}/100).', 'ins.supplierRisk.w': 'Risk drivers are evidence-based (see drivers).', 'ins.supplierRisk.a': 'Review drivers; apply enhanced payment controls until mitigated.',
    'ins.controlFails.o': '{n} control test(s) failed: {ids}.', 'ins.controlFails.w': 'Failed controls expose the company to loss and audit findings.', 'ins.controlFails.a': 'Assign owners; remediate and re-test.',
    'ins.sod.o': '{n} segregation-of-duties conflict(s) by {users} user(s).', 'ins.sod.w': 'The same person controlling incompatible steps can commit and conceal errors or fraud.', 'ins.sod.a': 'Enforce SoD in workflow; review the affected transactions.',
    'ins.criticalAlerts.o': '{n} critical fraud/anomaly alert(s): {rules}.', 'ins.criticalAlerts.w': 'Critical alerts may represent direct financial loss.', 'ins.criticalAlerts.a': 'Investigate today; hold related payments.',
    'ins.saving_earlyDiscount.o': '{n} invoice(s) can still capture an early-payment discount.', 'ins.saving_missedDiscount.o': '{n} historic payment(s) missed an available early-payment discount.', 'ins.saving_duplicateRecovery.o': '{n} duplicate payment(s) recoverable.', 'ins.saving_priceVariance.o': '{n} invoice line(s) billed above PO price.', 'ins.saving_consolidation.o': '{n} item(s) bought from several suppliers at different prices.', 'ins.saving_latePenalty.o': '{n} overdue invoice(s) under contracts with late-payment penalties.',
    'ins.saving.w': 'Quantified with a transparent calculation (see method).', 'ins.saving.a': 'Validate and action with the responsible function.',

    /* root causes */
    'rcz.singleSourceDependency': 'Single-source dependency', 'rcz.supplierBaseNarrow': 'Narrow supplier base', 'rcz.outflowsExceedInflows': 'Scheduled outflows exceed inflows', 'rcz.cashAboveRequirement': 'Cash above requirement', 'rcz.scheduledObligations': 'Scheduled obligations', 'rcz.approvalOrExceptionDelay': 'Approval or exception delays', 'rcz.approvalBottleneck': 'Approval bottleneck', 'rcz.p2pComplianceGaps': 'P2P compliance gaps', 'rcz.poBypass': 'PO process bypassed', 'rcz.renewalNotStarted': 'Renewal not started', 'rcz.controlDesignOrOperation': 'Control design or operating failure', 'rcz.sodNotEnforced': 'SoD not enforced in workflow', 'rcz.preventiveControlGap': 'Preventive control gap',

    /* action center */
    'ac.criticalDue': '{n} invoice(s) of critical supplier {name} due/overdue ({inv}) — max {dpd} days overdue', 'ac.alert_duplicatePayment': 'Potential duplicate payment {txn} ({name})', 'ac.alert_duplicateInvoice': 'Duplicate invoice {txn} ({name})', 'ac.alert_paymentAfterBankChange': 'Payment {txn} right after bank-detail change ({name})', 'ac.alert_beneficiaryMismatch': 'Beneficiary mismatch on {txn} ({name})', 'ac.alert_sharedBankAccount': 'Suppliers sharing a bank account ({txn})', 'ac.alert_inactiveSupplierPaid': 'Payment {txn} to inactive/blocked supplier {name}', 'ac.liquidityGap': '{ccy} liquidity gap from {date}', 'ac.riskyPayment': '{n} payment(s) due ≤ 7 days to high-risk supplier {name} ({score}/100)', 'ac.approvalBottleneck': '{n} invoice(s) due ≤ 7 days still unapproved', 'ac.contractExpiring': 'Contract {id} ({name}) expires in {days} days', 'ac.docsMissing': '{name}: documents missing/expired ({docs}) with open AP', 'ac.bankUnverified': 'Unverified bank change for {name} on {date}', 'ac.controlFail': 'Control {id} failed ({n} exceptions)',

    /* savings */
    'sv.earlyDiscount': 'Early-payment discounts available', 'sv.missedDiscount': 'Missed early-payment discounts (history)', 'sv.duplicateRecovery': 'Duplicate payment recovery', 'sv.priceVariance': 'Price-variance recovery', 'sv.consolidation': 'Best-price benchmark / supplier consolidation', 'sv.unusedPO': 'Unused PO commitments (release)', 'sv.latePenalty': 'Late-payment penalty avoidance', 'sv.maverick': 'Maverick spend reduction', 'sv.competition': 'Competitive sourcing (no RFQ)',

    /* auto alerts */
    'aa.invoiceDue': 'Invoices due within {days} days', 'aa.invoiceOverdue': 'Invoices overdue', 'aa.largePayment': 'Large payments ≥ {amount}', 'aa.riskIncrease': 'Suppliers at HIGH/CRITICAL risk', 'aa.bankChange': 'Recent supplier bank changes', 'aa.contractExpiry': 'Contracts expiring within {days} days', 'aa.paymentAnomaly': 'Payment anomalies', 'aa.duplicateInvoice': 'Duplicate invoices', 'aa.duplicatePayment': 'Duplicate payments', 'aa.cashShortfall': 'Cash below minimum', 'aa.approvalDelay': 'Approvals delayed > {days} days', 'aa.docExpiry': 'Supplier documents expiring within {days} days', 'aa.poNearLimit': 'POs invoiced ≥ {pct}%',

    /* bank recon types */
    'br.matched': 'Matched', 'br.missingInBank': 'Missing in bank statement', 'br.uncleared': 'Uncleared (in transit)', 'br.wrongAmount': 'Wrong amount', 'br.wrongReference': 'Wrong reference', 'br.timingDifference': 'Timing difference', 'br.reversed': 'Reversed payment', 'br.duplicateBankDebit': 'Duplicate bank debit', 'br.bankWithoutPayment': 'Bank debit without payment record',

    /* contract alerts */
    'ca.expired': 'Expired', 'ca.expiring': 'Expiring', 'ca.exceeded': 'Value exceeded', 'ca.nearlyExhausted': 'Nearly exhausted', 'ca.invoiceOutside': 'Invoice outside contract', 'ca.poOutside': 'PO outside contract',

    /* perf metrics */
    'pm.otd': 'On-time delivery', 'pm.quality': 'Quality (accepted qty)', 'pm.price': 'Price competitiveness', 'pm.invoiceAccuracy': 'Invoice accuracy', 'pm.disputes': 'Dispute-free', 'pm.contract': 'Contract compliance', 'pm.responsiveness': 'Responsiveness', 'pm.reliability': 'Service reliability', 'pm.poCompliance': 'PO compliance', 'pm.grnCompliance': 'GRN compliance', 'pm.paymentAccuracy': 'Payment accuracy',

    /* priority components */
    'pc.urgency': 'Due-date urgency', 'pc.criticality': 'Supplier criticality', 'pc.discount': 'Discount opportunity', 'pc.penalty': 'Late-penalty risk', 'pc.operational': 'Operational impact', 'pc.risk': 'Supplier risk (inverse)', 'pc.liquidity': 'Liquidity impact',

    /* not tested reasons */
    'nt.holidayCalendarNotConfigured': 'Holiday calendar not configured', 'nt.noBankChangeLog': 'No bank-change log uploaded', 'nt.noUserDirectory': 'No user directory uploaded', 'nt.taxRatesNotConfigured': 'Tax rates not configured',
  });
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------- Supplementary English keys for dynamic families (so coverage can be verified) ---------- */
(function (root) {
  'use strict';
  const S = root.SUMED;
  const en = S.i18n.en;
  const add = (o) => Object.entries(o).forEach(([k, v]) => { if (en[k] == null) en[k] = v; });
  ['CFO', 'Finance Director', 'Treasury Manager', 'AP Manager', 'Procurement Manager', 'Procurement Officer', 'Accountant', 'Treasury Officer', 'Internal Auditor', 'Compliance Officer', 'Department Manager', 'Approver', 'Authorized Executive', 'Viewer', 'System Administrator'].forEach((r) => add({ ['role.' + r]: r }));
  add({
    'kpi.totalAP': 'Total Outstanding AP', 'kpi.overdueAP': 'Overdue AP', 'kpi.currentAP': 'Current (not yet due) AP', 'kpi.avgPayDays': 'Average payment days', 'kpi.onTimeRate': 'On-time payment rate', 'kpi.apConcentration': 'Largest supplier share of AP',
    'kpi.totalSpend': 'Total supplier spend (12 months)', 'kpi.nonPOSpend': 'Non-PO spend', 'kpi.offContractSpend': 'Off-contract spend', 'kpi.maverickSpend': 'Maverick spend', 'kpi.emergencySpend': 'Emergency spend', 'kpi.contractSpend': 'Contract spend', 'kpi.top5': 'Top-5 supplier concentration', 'kpi.dpo': 'DPO',
    'kpi.supplierCount': 'Suppliers in master', 'kpi.activeSuppliers': 'Active / approved suppliers', 'kpi.criticalSuppliers': 'Critical suppliers', 'kpi.highRiskSuppliers': 'High / critical-risk suppliers', 'kpi.paymentsDue': 'Payments due ≤ 7 days (incl. overdue)', 'kpi.payToday': 'Due today or overdue', 'kpi.paymentsScheduled': 'Payments scheduled (not executed)', 'kpi.paymentsExecuted': 'Payments executed (30 days)', 'kpi.paymentRegisterTotal': 'Payment register total', 'kpi.cashRequired': 'Cash required — 13 weeks',
    'kpi.invoiceExceptions': 'Invoice exceptions (3-way match)', 'kpi.duplicateRisk': 'Duplicate invoice risk (exposure)', 'kpi.fraudAlerts': 'High / critical fraud & anomaly alerts', 'kpi.contractExposure': 'Remaining contract value (active)', 'kpi.avgProcessing': 'Average invoice processing time', 'kpi.paymentCycle': 'Average payment cycle (invoice → payment)', 'kpi.poCompliance': 'PO compliance', 'kpi.threeWayRate': 'Three-way match rate', 'kpi.invoiceMatchRate': 'Invoice match rate', 'kpi.exceptionRate': 'Exception rate', 'kpi.duplicateRate': 'Duplicate rate', 'kpi.latePaymentRate': 'Late payment rate', 'kpi.contractCompliance': 'Contract compliance', 'kpi.avgRiskScore': 'Average supplier risk score', 'kpi.discountCapture': 'Discount capture rate', 'kpi.potentialSavings': 'Potential savings (quantified)', 'kpi.controlFailures': 'Control failures', 'kpi.paymentForecast30': 'Payment forecast — 30 days',
    'docname.Commercial Registration': 'Commercial Registration', 'docname.Tax Card': 'Tax Card', 'docname.VAT Certificate': 'VAT Certificate', 'docname.Bank Certificate': 'Bank Certificate', 'docname.IBAN Confirmation': 'IBAN Confirmation', 'docname.Contract': 'Contract', 'docname.Insurance': 'Insurance', 'docname.Certifications': 'Certifications', 'docname.Beneficial Ownership': 'Beneficial Ownership', 'docname.Compliance Declaration': 'Compliance Declaration',
    'dsp.Invoice dispute': 'Invoice dispute', 'dsp.Supplier dispute': 'Supplier dispute', 'dsp.Price dispute': 'Price dispute', 'dsp.Quantity dispute': 'Quantity dispute', 'dsp.Quality dispute': 'Quality dispute', 'dsp.Contract dispute': 'Contract dispute', 'dsp.Tax dispute': 'Tax dispute', 'dsp.Payment dispute': 'Payment dispute',
    'p2p.PR': 'PR', 'p2p.RFQ': 'RFQ', 'p2p.PO': 'PO', 'p2p.GRN': 'GRN', 'p2p.Invoice': 'Invoice', 'p2p.Approval': 'Approval', 'p2p.Payment': 'Payment',
    'pf.d7': 'Next 7 days', 'pf.d30': 'Next 30 days', 'pf.d60': 'Next 60 days', 'pf.d90': 'Next 90 days', 'pf.w13': '13 weeks', 'pf.m12': '12 months',
    'pf.d.supplier': 'Supplier', 'pf.d.category': 'Category', 'pf.d.department': 'Department', 'pf.d.project': 'Project', 'pf.d.currency': 'Currency', 'pf.d.bank': 'Bank', 'pf.d.type': 'Payment type',
    'spend.d.supplier': 'Supplier', 'spend.d.category': 'Category', 'spend.d.department': 'Department', 'spend.d.costCenter': 'Cost center', 'spend.d.project': 'Project', 'spend.d.contract': 'Contract', 'spend.d.currency': 'Currency', 'spend.d.month': 'Month', 'spend.d.quarter': 'Quarter', 'spend.d.year': 'Year',
    'cal.day': 'Day', 'cal.week': 'Week', 'cal.month': 'Month', 'cal.quarter': 'Quarter',
    'sum.s1': 'Top financial issues', 'sum.s2': 'Top payment risks', 'sum.s3': 'Top supplier risks', 'sum.s4': 'Top control failures', 'sum.s5': 'Liquidity concerns', 'sum.s6': 'Cost-saving opportunities', 'sum.s7': 'Immediate actions', 'sum.s8': 'Upcoming critical payments',
    'fs.Open': 'Open', 'fs.Investigating': 'Investigating', 'fs.Escalated': 'Escalated', 'fs.Closed — false positive': 'Closed — false positive', 'fs.Closed — confirmed & remediated': 'Closed — confirmed & remediated',
    'auth.rule.supplierRisk': 'Supplier risk HIGH or CRITICAL', 'auth.rule.emergency': 'Emergency / urgent payment', 'auth.rule.foreignCurrency': 'Foreign-currency payment', 'auth.rule.nonPO': 'Non-PO invoice',
    'm.basis.line': 'Line level', 'm.basis.header': 'Header level',
    'step.upload': 'UPLOAD', 'step.validate': 'VALIDATE', 'step.extract': 'EXTRACT', 'step.reconcile': 'RECONCILE', 'step.analyze': 'ANALYZE', 'step.dashboard': 'DASHBOARD', 'step.report': 'REPORT',
    'rep.exec': 'Management Executive Summary', 'rep.cfoSupplier': 'CFO Supplier Report', 'rep.cfoPayment': 'CFO Payment Report', 'rep.aging': 'AP Aging Report', 'rep.perf': 'Supplier Performance Report', 'rep.risk': 'Supplier Risk Report', 'rep.spend': 'Spend Analysis Report', 'rep.payForecast': 'Payment Forecast Report', 'rep.cash': 'Cash Impact Report', 'rep.contracts': 'Contract Exposure Report', 'rep.invExceptions': 'Invoice Exception Report', 'rep.duplicates': 'Duplicate Invoice Report', 'rep.fraud': 'Fraud & Anomaly Report', 'rep.controls': 'Internal Control Report', 'rep.sod': 'SoD Report', 'rep.audit': 'Audit Trail Report', 'rep.tax': 'Tax Report', 'rep.fx': 'FX Exposure Report', 'rep.procurement': 'Procurement Performance Report', 'rep.wc': 'Working Capital Report', 'rep.dq': 'Data Quality & Control Report',
    'rep.d.exec': 'What the CFO needs to know today, evidence-linked.', 'rep.d.cfoSupplier': 'Supplier base, risk, spend and exposure.', 'rep.d.cfoPayment': 'Priority queue, due payments and payment register.', 'rep.d.aging': 'Buckets, supplier matrix and open items.', 'rep.d.perf': 'Weighted scorecards and metric coverage.', 'rep.d.risk': 'Explainable risk scores with drivers.', 'rep.d.spend': 'Spend by supplier, category, department and month.', 'rep.d.payForecast': 'Requirements by horizon and forecast items.', 'rep.d.cash': '13-week forecast and per-currency liquidity.', 'rep.d.contracts': 'Utilisation, expiry and leakage.', 'rep.d.invExceptions': 'Three-way match exceptions with variances.', 'rep.d.duplicates': 'Duplicate invoice and payment pairs.', 'rep.d.fraud': 'All red flags with evidence locations.', 'rep.d.controls': 'Control tests: population, exceptions, status.', 'rep.d.sod': 'User duty profiles and conflicts.', 'rep.d.audit': 'Full hash-chained audit log.', 'rep.d.tax': 'Gross, tax, withholding and net per invoice.', 'rep.d.fx': 'FX rates and foreign-currency exposure.', 'rep.d.procurement': 'PO received / invoiced / paid / remaining.', 'rep.d.wc': 'Savings, early payments and DPO.', 'rep.d.dq': 'Validation findings by severity.',
    'ch.spendTrend': 'Supplier spend trend', 'ch.aging': 'AP aging', 'ch.cash': '13-week cash projection',
    'kind.EDITED': 'Edited',
  });
  ['Investigating', 'Escalated', 'Open', 'Resolved', 'Overdue', 'Approved', 'Pending', 'Pending Approval', 'Partially Approved', 'Paid', 'Scheduled', 'Executed', 'Reconciled', 'Rejected', 'Failed', 'Reversed', 'Submitted to Bank', 'Received', 'Validated', 'Exception', 'Cancelled', 'Closed', 'Draft', 'Active', 'Expired', 'Blocked', 'Inactive', 'Posted', 'Pending Review', 'Parsed', 'Unsupported', 'Parser unavailable', 'DEMO / SYNTHETIC', 'Duplicate file (skipped)', 'Fully Received', 'Partially Received', 'Converted to PO', 'Valid', 'Invalid', 'Verified', 'Unverified', 'Yes', 'OK', 'Complete', 'Compliant', 'Non-compliant', 'Under Review', 'Not Started', 'Cleared', 'Approved by', 'OCR Processing', 'Closed — false positive', 'Closed — confirmed & remediated', 'High', 'Medium', 'Low']
    .forEach((s) => add({ ['st.' + s]: s }));
  ['Draft', 'Pending Approval', 'Approved', 'Partially Received', 'Fully Received', 'Partially Invoiced', 'Fully Invoiced', 'Partially Paid', 'Fully Paid', 'Closed', 'Cancelled', 'Expired'].forEach((s) => add({ ['pos.' + s]: s }));
  ['Received', 'OCR Processing', 'Validated', 'Exception', 'Pending Approval', 'Approved', 'Scheduled', 'Paid', 'Rejected', 'Cancelled'].forEach((s) => add({ ['is.' + s]: s }));
  ['spendShare', 'apExposure', 'overdueBalance', 'critical', 'singleSource', 'contractExpiredOpenPO', 'contractExpiring', 'lateDeliveries', 'qualityIssues', 'performanceLow', 'exceptionRate', 'pricingAnomaly', 'bankChanged', 'taxIdMissing', 'sanctionsNotCleared', 'nonCompliant', 'docsExpired', 'docsMissing', 'insuranceExpired', 'blocked', 'anomalies']
    .forEach((k) => add({ ['drv.' + k + '.short']: k.replace(/([A-Z])/g, ' $1').toLowerCase() }));
  // Field labels from the canonical schema (first synonym, title-cased)
  if (S.schema) Object.values(S.schema).forEach((def) => def.fields.forEach((f) => { const syn = f.syn.find((x) => /^[a-z0-9 %\-]+$/i.test(x)) || f.key.replace(/([A-Z])/g, ' $1'); add({ ['f.' + f.key]: syn.replace(/\b(id|po|pr|rfq|grn|vat|iban|swift|wht|ap|gl|cogs)\b/gi, (m) => m.toUpperCase()).replace(/\b[a-z]/g, (c) => c.toUpperCase()) }); }));
})(typeof window !== 'undefined' ? window : globalThis);
