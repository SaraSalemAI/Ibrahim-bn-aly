/* SUMED P2P — default configuration.
 * EVERY threshold below is an ILLUSTRATIVE, CONFIGURABLE DEFAULT. None of them is SUMED policy.
 * Tax rates, FX rates and holidays are intentionally EMPTY: they must come from uploaded
 * company configuration or authoritative inputs (Settings → Tax / FX / Calendar). */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});

  S.defaultConfig = () => ({
    version: 1,
    baseCurrency: 'EGP',
    currencies: ['EGP', 'USD', 'EUR'],
    dateOrder: 'DMY', // ambiguous dd/mm vs mm/dd in uploads
    asOfDate: null, // null => today
    weekendDays: [5, 6], // Fri, Sat (Egyptian working week). Configurable.
    holidays: [], // [{date, name}] — must be configured; never assumed
    taxCodes: [], // [{code, name, type:'VAT'|'WHT'|'OTHER', ratePct, source}] — never assumed
    spendBasis: 'invoiced', // 'invoiced' | 'paid'

    approvalMatrix: {
      note: 'ILLUSTRATIVE DEFAULT — configure to SUMED Delegation of Authority',
      tiers: [
        { id: 't1', max: 100000, approvers: ['Department Manager'] },
        { id: 't2', max: 1000000, approvers: ['Department Manager', 'Finance Director'] },
        { id: 't3', max: 5000000, approvers: ['Finance Director', 'CFO'] },
        { id: 't4', max: null, approvers: ['Finance Director', 'CFO', 'Authorized Executive'] },
      ],
      // Escalations: add an approver when a condition holds
      rules: [
        { id: 'r1', when: 'supplierRisk', value: 'HIGH+', add: 'Compliance Officer', enabled: true },
        { id: 'r2', when: 'emergency', value: true, add: 'CFO', enabled: true },
        { id: 'r3', when: 'foreignCurrency', value: true, add: 'Treasury Manager', enabled: true },
        { id: 'r4', when: 'nonPO', value: true, add: 'Procurement Manager', enabled: true },
      ],
    },

    matching: {
      priceTolPct: 2, // unit price tolerance
      qtyTolPct: 0, // quantity tolerance
      taxTolPct: 1, // effective tax-rate tolerance (percentage points)
      amountTolAbs: 1, // rounding tolerance in document currency
    },

    duplicates: {
      possibleWindowDays: 30,
      highRiskWindowDays: 7,
      amountTolPct: 1,
      descSimilarity: 0.8,
      paymentWindowDays: 14,
    },

    risk: {
      bands: { medium: 30, high: 55, critical: 75 },
      spendShareHighPct: 10,
      spendShareCriticalPct: 20,
      contractExpiryDays: 30,
      bankChangeLookbackDays: 90,
      exceptionRateHighPct: 10,
    },

    performance: {
      weights: { otd: 20, quality: 20, price: 10, invoiceAccuracy: 15, disputes: 5, contract: 10, responsiveness: 5, reliability: 5, poCompliance: 5, grnCompliance: 3, paymentAccuracy: 2 },
      bands: { excellent: 85, good: 70, watch: 55, poor: 40 },
    },

    priority: {
      weights: { urgency: 35, criticality: 20, discount: 10, penalty: 10, operational: 10, risk: 10, liquidity: 5 },
      criticalCategories: ['Pipeline Maintenance', 'Marine Services', 'Safety & Environment'],
    },

    concentration: { top5Pct: 50, top10Pct: 70, singleSupplierPct: 20 },

    fraud: {
      roundAmountMin: 100000,
      roundAmountModulo: 10000,
      belowThresholdPct: 5,
      splitWindowDays: 3,
      dormantDays: 180,
      bankChangePayWindowDays: 14,
      priceJumpPct: 15,
      zScore: 3,
      freqPer7Days: 4,
    },

    alerts: {
      invoiceDueDays: 7,
      largePayment: 5000000,
      contractExpiryDays: 60,
      docExpiryDays: 30,
      approvalDelayDays: 5,
      poNearLimitPct: 90,
      enabled: { invoiceDue: true, invoiceOverdue: true, largePayment: true, riskIncrease: true, bankChange: true, contractExpiry: true, paymentAnomaly: true, duplicateInvoice: true, duplicatePayment: true, cashShortfall: true, approvalDelay: true, docExpiry: true, poNearLimit: true },
    },

    dpo: { targetDays: null, periodDays: 365 },

    requiredDocs: ['Commercial Registration', 'Tax Card', 'VAT Certificate', 'Bank Certificate', 'IBAN Confirmation', 'Contract', 'Insurance', 'Certifications', 'Beneficial Ownership', 'Compliance Declaration'],

    sod: {
      // incompatible duties for the SAME user on the SAME record chain
      conflicts: [
        ['supplier.create', 'supplier.approve'],
        ['invoice.create', 'invoice.approve'],
        ['payment.create', 'payment.approve'],
        ['payment.approve', 'payment.execute'],
        ['payment.execute', 'payment.reconcile'],
        ['supplier.create', 'payment.approve'],
        ['supplier.bankchange', 'payment.approve'],
        ['invoice.approve', 'payment.approve'],
      ],
    },
  });

  /** Role catalogue — configurable permissions (least privilege). */
  S.defaultRoles = () => ({
    CFO: ['view.all', 'view.sensitive', 'approve.invoice', 'approve.payment', 'approve.batch.cfo', 'approve.supplier', 'export', 'scenario', 'config.view'],
    'Finance Director': ['view.all', 'view.sensitive', 'approve.invoice', 'approve.payment', 'approve.batch.cfo', 'approve.supplier', 'export', 'scenario', 'config.view'],
    'Treasury Manager': ['view.all', 'view.sensitive', 'approve.batch.treasury', 'submit.batch', 'execute.payment', 'export', 'scenario', 'manage.banks'],
    'AP Manager': ['view.all', 'approve.invoice', 'create.invoice', 'create.batch', 'correct.ocr', 'export', 'manage.disputes'],
    'Procurement Manager': ['view.all', 'approve.supplier', 'create.supplier', 'approve.po', 'export', 'manage.disputes'],
    'Procurement Officer': ['view.procurement', 'create.supplier', 'create.po', 'upload'],
    Accountant: ['view.all', 'create.invoice', 'correct.ocr', 'upload', 'reconcile', 'create.batch'],
    'Treasury Officer': ['view.all', 'create.batch', 'execute.payment', 'reconcile', 'upload'],
    'Internal Auditor': ['view.all', 'view.audit', 'run.controls', 'export'],
    'Compliance Officer': ['view.all', 'approve.compliance', 'run.controls', 'export'],
    'Department Manager': ['view.department', 'approve.invoice'],
    Approver: ['view.all', 'approve.invoice', 'approve.payment'],
    'Authorized Executive': ['view.all', 'approve.invoice', 'approve.payment', 'approve.batch.cfo'],
    Viewer: ['view.all'],
    'System Administrator': ['view.all', 'config.edit', 'config.view', 'manage.users', 'upload', 'run.controls', 'export'],
  });
})(typeof window !== 'undefined' ? window : globalThis);
