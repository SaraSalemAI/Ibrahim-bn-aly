/* SUMED P2P — DEMO MODE synthetic data generator.
 * EVERYTHING produced here is SYNTHETIC. It is NOT SUMED data. Supplier names, IBANs (country code "XD",
 * which does not exist), amounts, FX rates and tax codes are fabricated for demonstration only and every
 * record carries _demo:true so the UI stamps it "DEMO / SYNTHETIC DATA".
 * Deterministic (seeded) so tests and screenshots are reproducible. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;

  const CATS = {
    'Pipeline Maintenance': [['PM-VLV-01', 'Gate valve 24"', 185000], ['PM-GSK-02', 'Flange gasket set', 4200], ['PM-CTG-03', 'Pipe coating (m²)', 950], ['PM-PIG-04', 'Cleaning pig unit', 76000]],
    'Marine Services': [['MS-TUG-01', 'Tug assistance (hour)', 38000], ['MS-MOR-02', 'Mooring service (call)', 64000], ['MS-HOS-03', 'Floating hose section', 410000]],
    'Safety & Environment': [['SE-PPE-01', 'PPE kit', 2600], ['SE-OSR-02', 'Oil-spill boom (m)', 7800], ['SE-GAS-03', 'Gas detector', 21500]],
    'IT & Telecom': [['IT-LIC-01', 'Software licence (user/yr)', 9800], ['IT-SRV-02', 'Server node', 265000], ['IT-SUP-03', 'Support (month)', 120000]],
    'Engineering Services': [['EN-INS-01', 'Inspection (day)', 42000], ['EN-DES-02', 'Design review (package)', 350000]],
    'Spare Parts': [['SP-PMP-01', 'Pump impeller', 98000], ['SP-SEA-02', 'Mechanical seal', 33500], ['SP-BRG-03', 'Bearing set', 12400], ['PM-GSK-02', 'Flange gasket set', 4200]],
    'Logistics': [['LG-TRK-01', 'Trucking (trip)', 18500], ['LG-CUS-02', 'Customs clearance (file)', 12500]],
    'Facilities': [['FC-CLN-01', 'Cleaning (month)', 145000], ['FC-SEC-02', 'Security (month)', 210000]],
    'Consulting': [['CN-ADV-01', 'Advisory (day)', 55000]],
  };
  const DEPTS = [['Operations', 'CC-110'], ['Marine Terminal', 'CC-120'], ['Maintenance', 'CC-130'], ['HSE', 'CC-140'], ['IT', 'CC-150'], ['Finance', 'CC-160'], ['Administration', 'CC-170']];
  const PROJECTS = ['PRJ-DEMO-01 Terminal Upgrade', 'PRJ-DEMO-02 Pipeline Integrity', 'PRJ-DEMO-03 Digital Ops', null, null];

  const SUP = [
    // id, name, nameAr, category, ccy, terms days, critical, strategic, single, country, city
    ['S001', 'Alpha Marine Services (Demo)', 'ألفا للخدمات البحرية (تجريبي)', 'Marine Services', 'USD', 30, true, true, false, 'Egypt', 'Alexandria'],
    ['S002', 'Delta Pipeline Works (Demo)', 'دلتا لأعمال خطوط الأنابيب (تجريبي)', 'Pipeline Maintenance', 'EGP', 45, true, true, true, 'Egypt', 'Alexandria'],
    ['S003', 'Nile Safety Supplies (Demo)', 'النيل لمستلزمات السلامة (تجريبي)', 'Safety & Environment', 'EGP', 30, false, false, false, 'Egypt', 'Cairo'],
    ['S004', 'Horizon IT Solutions (Demo)', 'هورايزون لحلول تقنية المعلومات (تجريبي)', 'IT & Telecom', 'EGP', 30, false, true, false, 'Egypt', 'Cairo'],
    ['S005', 'Mediterranean Engineering (Demo)', 'المتوسط للهندسة (تجريبي)', 'Engineering Services', 'EUR', 60, true, false, false, 'Italy', 'Genoa'],
    ['S006', 'Pharos Spare Parts (Demo)', 'فاروس لقطع الغيار (تجريبي)', 'Spare Parts', 'EGP', 45, false, false, false, 'Egypt', 'Alexandria'],
    ['S007', 'Canal Logistics (Demo)', 'القناة للخدمات اللوجستية (تجريبي)', 'Logistics', 'EGP', 30, false, false, false, 'Egypt', 'Suez'],
    ['S008', 'Coastal Facilities Mgmt (Demo)', 'الساحل لإدارة المرافق (تجريبي)', 'Facilities', 'EGP', 30, false, false, false, 'Egypt', 'Alexandria'],
    ['S009', 'Atlas Advisory (Demo)', 'أطلس للاستشارات (تجريبي)', 'Consulting', 'USD', 30, false, false, false, 'UAE', 'Dubai'],
    ['S010', 'Sinai Spare Parts (Demo)', 'سيناء لقطع الغيار (تجريبي)', 'Spare Parts', 'EGP', 30, false, false, false, 'Egypt', 'Cairo'],
    ['S011', 'Red Sea Marine (Demo)', 'البحر الأحمر البحرية (تجريبي)', 'Marine Services', 'USD', 45, true, false, false, 'Egypt', 'Ain Sokhna'],
    ['S012', 'Ocean Spill Response (Demo)', 'المحيط لمكافحة التسرب (تجريبي)', 'Safety & Environment', 'USD', 30, true, false, true, 'UK', 'Southampton'],
    ['S013', 'Giza Pipe Coating (Demo)', 'الجيزة لتغليف الأنابيب (تجريبي)', 'Pipeline Maintenance', 'EGP', 60, false, false, false, 'Egypt', 'Giza'],
    ['S014', 'Lotus Trading (Demo)', 'لوتس للتجارة (تجريبي)', 'Spare Parts', 'EGP', 30, false, false, false, 'Egypt', 'Alexandria'],
    ['S015', 'Lotus Trading Co (Demo)', 'لوتس للتجارة (تجريبي)', 'Spare Parts', 'EGP', 30, false, false, false, 'Egypt', 'Alexandria'],
    ['S016', 'Bright Cleaning (Demo)', 'برايت للنظافة (تجريبي)', 'Facilities', 'EGP', 30, false, false, false, 'Egypt', 'Alexandria'],
    ['S017', 'Sahara Telecom (Demo)', 'الصحراء للاتصالات (تجريبي)', 'IT & Telecom', 'EGP', 30, false, false, false, 'Egypt', 'Cairo'],
    ['S018', 'Euro Valves GmbH (Demo)', 'يورو للصمامات (تجريبي)', 'Pipeline Maintenance', 'EUR', 45, true, false, false, 'Germany', 'Hamburg'],
    ['S019', 'Dormant Supplies (Demo)', 'مورد خامل (تجريبي)', 'Spare Parts', 'EGP', 30, false, false, false, 'Egypt', 'Tanta'],
    ['S020', 'Blocked Vendor (Demo)', 'مورد موقوف (تجريبي)', 'Logistics', 'EGP', 30, false, false, false, 'Egypt', 'Cairo'],
    ['S021', 'Thames Inspection (Demo)', 'التايمز للتفتيش (تجريبي)', 'Engineering Services', 'GBP', 30, false, false, false, 'UK', 'London'],
    ['S022', 'Quick Courier (Demo)', 'كويك للشحن السريع (تجريبي)', 'Logistics', 'EGP', 15, false, false, false, 'Egypt', 'Alexandria'],
  ];

  const USERS = [
    ['u.cfo', 'Demo User — CFO', 'CFO', 'Finance'], ['u.fd', 'Demo User — Finance Director', 'Finance Director', 'Finance'],
    ['u.tm', 'Demo User — Treasury Manager', 'Treasury Manager', 'Finance'], ['u.to', 'Demo User — Treasury Officer', 'Treasury Officer', 'Finance'],
    ['u.apm', 'Demo User — AP Manager', 'AP Manager', 'Finance'], ['u.acc1', 'Demo User — Accountant 1', 'Accountant', 'Finance'],
    ['u.acc2', 'Demo User — Accountant 2', 'Accountant', 'Finance'], ['u.pm', 'Demo User — Procurement Manager', 'Procurement Manager', 'Procurement'],
    ['u.po1', 'Demo User — Procurement Officer', 'Procurement Officer', 'Procurement'], ['u.ia', 'Demo User — Internal Auditor', 'Internal Auditor', 'Internal Audit'],
    ['u.co', 'Demo User — Compliance Officer', 'Compliance Officer', 'Compliance'], ['u.dm.ops', 'Demo User — Ops Manager', 'Department Manager', 'Operations'],
    ['u.dm.mar', 'Demo User — Marine Manager', 'Department Manager', 'Marine Terminal'], ['u.dm.mnt', 'Demo User — Maintenance Manager', 'Department Manager', 'Maintenance'],
    ['u.exec', 'Demo User — Authorized Executive', 'Authorized Executive', 'Executive'], ['u.view', 'Demo User — Viewer', 'Viewer', 'Finance'],
    ['u.admin', 'Demo User — System Admin', 'System Administrator', 'IT'],
  ];

  /** Synthetic IBAN with valid mod-97 checksum and fictitious country code XD. */
  const synthIban = (seedStr) => {
    const digits = String(U.fnv(seedStr)).padStart(10, '0') + String(U.fnv(seedStr + 'x')).padStart(10, '0');
    const bban = (digits + '000000000').slice(0, 25);
    const r = (bban + 'XD00').replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let mod = 0;
    for (let i = 0; i < r.length; i += 7) mod = parseInt(String(mod) + r.slice(i, i + 7), 10) % 97;
    const ck = String(98 - mod).padStart(2, '0');
    return 'XD' + ck + bban;
  };

  S.demo = {};
  S.demo.generate = (asOfISO) => {
    const asOf = asOfISO || U.todayISO();
    const rnd = U.rng(20261006);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const between = (a, b) => a + rnd() * (b - a);
    const D = Object.fromEntries(S.entityOrder.map((k) => [k, []]));
    const rowCounter = {};
    const push = (entity, rec) => {
      rowCounter[entity] = (rowCounter[entity] || 1) + 1;
      rec._demo = true;
      rec._src = { file: 'DEMO_SYNTHETIC_' + S.schema[entity].label.replace(/[^A-Za-z]+/g, '_') + '.xlsx', sheet: entity, row: rowCounter[entity] };
      rec._key = entity + ':' + rowCounter[entity];
      D[entity].push(rec);
      return rec;
    };
    const d = (n) => U.addDays(asOf, n);

    /* Users */
    USERS.forEach(([userId, name, role, department], i) => push('users', { userId, name, role, department, email: userId + '@demo.invalid', phone: '+00-DEMO-' + String(1000 + i), active: true }));
    // related-party indicator: an employee shares a phone with supplier S022
    D.users.find((u) => u.userId === 'u.po1').phone = '+00-DEMO-7777';

    /* Tax config — DEMO ONLY */
    push('taxCodes', { code: 'VAT-STD', name: 'VAT standard (DEMO config)', type: 'VAT', ratePct: 14, source: 'DEMO / SYNTHETIC — replace with authoritative configuration' });
    push('taxCodes', { code: 'WHT-SVC', name: 'Withholding — services (DEMO config)', type: 'WHT', ratePct: 3, source: 'DEMO / SYNTHETIC' });
    push('taxCodes', { code: 'WHT-GDS', name: 'Withholding — goods (DEMO config)', type: 'WHT', ratePct: 1, source: 'DEMO / SYNTHETIC' });
    const VAT = 0.14;

    /* FX — DEMO ONLY, NOT market rates. No GBP rate on purpose. */
    const fxBase = { USD: 48.5, EUR: 53.0 };
    for (let i = -400; i <= 0; i += 7) {
      for (const c of ['USD', 'EUR']) push('fxRates', { currency: c, date: d(i), rate: U.round(fxBase[c] * (1 + 0.04 * Math.sin((i + 400) / 60) + 0.002 * (rnd() - 0.5)), 4), source: 'DEMO / SYNTHETIC — not a market rate' });
    }

    /* Company bank accounts */
    const ACC = [
      ['BA-EGP-01', 'Demo Bank A', 'EGP', 820000000, 150000000], ['BA-EGP-02', 'Demo Bank B', 'EGP', 210000000, 50000000],
      ['BA-USD-01', 'Demo Bank A', 'USD', 6400000, 1000000], ['BA-EUR-01', 'Demo Bank C', 'EUR', 330000, 300000],
    ];
    ACC.forEach(([accountId, bank, currency, bal, minCash]) => push('bankAccounts', { accountId, bank, accountNo: 'DEMO-' + accountId, iban: synthIban(accountId), currency, openingBalance: bal * 1.08, currentBalance: bal, availableBalance: bal * 0.97, minCash, asOfDate: asOf }));
    const accFor = (ccy) => (ccy === 'USD' ? 'BA-USD-01' : ccy === 'EUR' ? 'BA-EUR-01' : rnd() < 0.8 ? 'BA-EGP-01' : 'BA-EGP-02');

    /* Suppliers */
    SUP.forEach(([supplierId, name, nameAr, category, currency, terms, critical, strategic, singleSource, country, city], i) => {
      const s = push('suppliers', {
        supplierId, name, nameAr, type: country === 'Egypt' ? 'Local' : 'Foreign', category, classification: critical ? 'A' : strategic ? 'B' : 'C',
        legalEntity: 'Synthetic Co. (Demo)', country, city, address: `${10 + i} Demo Street, ${city}`,
        taxId: 'DEMO-TAX-' + (100000 + i * 37), commercialReg: 'DEMO-CR-' + (5000 + i), vatStatus: country === 'Egypt' ? 'Registered' : 'Not applicable (foreign)',
        contactPerson: 'Demo Contact ' + (i + 1), email: `contact${i + 1}@supplier.demo.invalid`, phone: '+00-DEMO-' + (5000 + i), website: `https://supplier${i + 1}.demo.invalid`,
        bankName: pick(['Demo Bank A', 'Demo Bank B', 'Demo Bank D']), bankBranch: city + ' (Demo)', bankAccount: 'DEMO-ACC-' + (70000 + i), iban: synthIban(supplierId), swift: 'DEMOXDXX',
        currency, paymentTerms: `Net ${terms}`, creditTerms: null, poRequired: true, taxTreatment: country === 'Egypt' ? 'Domestic' : 'Reverse charge (demo)',
        whtApplicable: country === 'Egypt', critical, strategic, singleSource, approvedStatus: 'Approved',
        onboardingDate: d(-900 + i * 20), lastReviewDate: d(-200 + i * 5), nextReviewDate: d(165 + i * 5),
        complianceStatus: 'Compliant', sanctionsStatus: 'Cleared', insuranceStatus: 'Valid', insuranceExpiry: d(120 + i * 9), onboardingStage: 10,
        createdBy: 'u.po1', approvedBy: 'u.pm', bankChangedOn: null,
      });
      if (['S003', 'S008', 'S016'].includes(supplierId)) s.paymentTerms = '2/10 Net 30';
    });
    const sup = (id) => D.suppliers.find((s) => s.supplierId === id);
    // Injected master-data issues
    sup('S015').iban = sup('S014').iban; // shared bank account (possible duplicate supplier)
    sup('S015').address = sup('S014').address;
    sup('S015').createdBy = 'u.pm'; sup('S015').approvedBy = 'u.pm'; // SoD: create + approve
    sup('S010').taxId = null; // missing tax ID
    sup('S012').insuranceStatus = 'Expired'; sup('S012').insuranceExpiry = d(-12);
    sup('S020').approvedStatus = 'Blocked'; sup('S020').complianceStatus = 'Non-compliant';
    sup('S019').approvedStatus = 'Approved';
    sup('S022').phone = '+00-DEMO-7777'; // same as employee u.po1
    sup('S021').sanctionsStatus = 'Pending';
    sup('S009').iban = 'XD12INVALIDIBAN000'; // checksum fails
    // Onboarding pipeline (new requests)
    [['S023', 'New Drone Inspection (Demo)', 'Engineering Services', 4], ['S024', 'New Catering Services (Demo)', 'Facilities', 7], ['S025', 'New Valve Agent (Demo)', 'Pipeline Maintenance', 2]].forEach(([id, name, cat, stage], k) => {
      push('suppliers', { supplierId: id, name, nameAr: 'مورد جديد تجريبي ' + (k + 1), type: 'Local', category: cat, country: 'Egypt', city: 'Alexandria', address: `${80 + k} Demo Road, Alexandria`, taxId: stage > 3 ? 'DEMO-TAX-9' + k : null, commercialReg: 'DEMO-CR-9' + k, currency: 'EGP', paymentTerms: 'Net 30', critical: false, strategic: false, singleSource: false, approvedStatus: 'Pending', complianceStatus: stage > 5 ? 'Under Review' : 'Not Started', sanctionsStatus: stage > 5 ? 'Cleared' : 'Pending', onboardingStage: stage, onboardingDate: d(-20 + k * 4), createdBy: 'u.po1', approvedBy: null, iban: stage > 4 ? synthIban(id) : null, bankName: stage > 4 ? 'Demo Bank B' : null, email: `new${k}@supplier.demo.invalid` });
    });

    /* Supplier documents */
    for (const s of D.suppliers.filter((x) => x.approvedStatus !== 'Pending' || x.onboardingStage > 2)) {
      S.defaultConfig().requiredDocs.forEach((docType, j) => {
        if (s.supplierId === 'S017' && j > 6) return; // missing documents
        if (s.onboardingStage < 10 && j > s.onboardingStage) return;
        let expiry = ['Insurance', 'Tax Card', 'Commercial Registration', 'Certifications'].includes(docType) ? d(30 + ((U.fnv(s.supplierId + docType) % 500))) : null;
        let status = 'Received';
        if (s.supplierId === 'S012' && docType === 'Insurance') expiry = d(-12);
        if (s.supplierId === 'S006' && docType === 'Tax Card') expiry = d(18);
        if (s.supplierId === 'S013' && docType === 'Beneficial Ownership') status = 'Pending Review';
        if (s.supplierId === 'S024' && docType === 'Bank Certificate') status = 'Rejected';
        push('supplierDocs', { supplierId: s.supplierId, docType, docNo: 'DOC-' + s.supplierId + '-' + j, issueDate: d(-400), expiryDate: expiry, status });
      });
    }

    /* Contracts */
    const CON = [
      ['C-DEMO-001', 'S001', 'Service', -500, 230, 9000000, 'USD'], ['C-DEMO-002', 'S002', 'Framework', -600, 21, 260000000, 'EGP'],
      ['C-DEMO-003', 'S004', 'Service', -300, 400, 30000000, 'EGP'], ['C-DEMO-004', 'S005', 'Service', -420, 150, 3200000, 'EUR'],
      ['C-DEMO-005', 'S008', 'Service', -365, 0, 7000000, 'EGP'], ['C-DEMO-006', 'S011', 'Framework', -700, 300, 6000000, 'USD'],
      ['C-DEMO-007', 'S012', 'Service', -400, 45, 2500000, 'USD'], ['C-DEMO-008', 'S013', 'Supply', -500, -40, 40000000, 'EGP'],
      ['C-DEMO-009', 'S018', 'Supply', -380, 330, 2900000, 'EUR'], ['C-DEMO-010', 'S016', 'Service', -200, 165, 4500000, 'EGP'],
      ['C-DEMO-011', 'S003', 'Supply', -330, 35, 12000000, 'EGP'],
    ];
    CON.forEach(([contractId, supplierId, type, s0, e0, value, currency]) => push('contracts', { contractId, supplierId, type, startDate: d(s0), endDate: d(e0), value, currency, paymentTerms: sup(supplierId).paymentTerms, renewalDate: d(e0 - 60), status: e0 < 0 ? 'Expired' : 'Active', latePenaltyPct: supplierId === 'S001' || supplierId === 'S002' ? 1.5 : null, earlyDiscount: /^2\/10/.test(sup(supplierId).paymentTerms) ? '2/10 Net 30' : null }));
    const conFor = (sid, date) => D.contracts.find((c) => c.supplierId === sid && c.startDate <= date) || null;

    /* Purchase requisitions, RFQs, POs, GRNs, invoices, payments */
    const weights = { S001: 9, S002: 14, S003: 4, S004: 4, S005: 3, S006: 4, S007: 3, S008: 3, S009: 1, S010: 3, S011: 4, S012: 2, S013: 4, S014: 2, S015: 1, S016: 2, S017: 2, S018: 2, S021: 1, S022: 2 };
    const wList = Object.entries(weights).flatMap(([k, w]) => Array(w).fill(k));
    const lateSuppliers = new Set(['S013', 'S007', 'S010']);
    const qualitySuppliers = new Set(['S010', 'S006']);
    let poN = 0, grnN = 0, invN = 0, payN = 0, txN = 0, prN = 0;
    const approverFor = (amtBase) => (amtBase < 5000000 ? pick(['u.dm.ops', 'u.dm.mar', 'u.dm.mnt']) : 'u.exec'); // budget holder approves invoice; payment approvals follow the (illustrative) matrix
    const fxAt = (ccy) => (ccy === 'EGP' ? 1 : fxBase[ccy] || 60);
    const termsDays = (s) => { const m = /net\s*(\d+)/i.exec(s.paymentTerms || ''); return m ? +m[1] : 30; };

    const mkInvoice = (o) => push('invoices', Object.assign({ status: 'Received', approvalStatus: 'Pending Approval', enteredBy: pick(['u.acc1', 'u.acc2']), approvedBy: null, approvedDate: null }, o));

    for (let k = 0; k < 150; k++) {
      const sid = pick(wList);
      const s = sup(sid);
      const poDate = d(-Math.floor(between(8, 360)));
      const [dept, cc] = pick(DEPTS);
      const items = CATS[s.category];
      const nLines = 1 + Math.floor(rnd() * Math.min(3, items.length));
      const lines = [];
      const usedItems = new Set();
      for (let l = 0; l < nLines; l++) {
        const it = pick(items);
        if (usedItems.has(it[0])) continue;
        usedItems.add(it[0]);
        const priceFactor = (s.supplierId === 'S014' || s.supplierId === 'S010') && it[0] === 'PM-GSK-02' ? 1.18 : 1 + (rnd() - 0.5) * 0.06;
        const unitPrice = U.round((it[2] / (s.currency === 'EGP' ? 1 : fxAt(s.currency))) * priceFactor, 2);
        const qty = Math.max(1, Math.round(between(1, it[2] > 100000 ? 6 : it[2] > 20000 ? 20 : 150)));
        lines.push({ itemCode: it[0], description: it[1], qty, unitPrice });
      }
      const amount = U.round(U.sum(lines, (x) => x.qty * x.unitPrice), 2);
      const tax = s.country === 'Egypt' ? U.round(amount * VAT, 2) : 0;
      const prNo = 'PR-DEMO-' + String(++prN).padStart(4, '0');
      const prDate = U.addDays(poDate, -Math.floor(between(5, 25)));
      push('prs', { prNo, date: prDate, department: dept, costCenter: cc, project: pick(PROJECTS), requester: 'u.dm.' + pick(['ops', 'mar', 'mnt']), description: lines.map((x) => x.description).join('; '), amount: U.round(amount * 0.98, 0), currency: s.currency, status: 'Converted to PO', approvedBy: 'u.dm.ops' });
      let rfqNo = null;
      if (amount * fxAt(s.currency) > 300000) {
        rfqNo = 'RFQ-DEMO-' + String(prN).padStart(4, '0');
        const rivals = D.suppliers.filter((x) => x.category === s.category && x.supplierId !== sid && x.approvedStatus === 'Approved').slice(0, 2);
        push('rfqs', { rfqNo, prNo, date: U.addDays(prDate, 3), supplierId: sid, quoteAmount: amount, currency: s.currency, selected: true });
        rivals.forEach((r) => push('rfqs', { rfqNo, prNo, date: U.addDays(prDate, 3), supplierId: r.supplierId, quoteAmount: U.round(amount * between(1.02, 1.2), 0), currency: s.currency, selected: false }));
      }
      const poNo = 'PO-DEMO-' + String(++poN).padStart(5, '0');
      const con = conFor(sid, poDate);
      const lead = Math.floor(between(7, 35));
      const requiredDate = U.addDays(poDate, lead);
      const po = push('pos', { poNo, prNo, rfqNo, supplierId: sid, department: dept, costCenter: cc, project: pick(PROJECTS), contractId: con ? con.contractId : null, category: s.category, poDate, requiredDate, currency: s.currency, amount, tax, total: U.round(amount + tax, 2), status: 'Approved', createdBy: 'u.po1', approvedBy: amount * fxAt(s.currency) > 1000000 ? 'u.cfo' : 'u.pm', emergency: rnd() < 0.05 });
      lines.forEach((ln, i) => push('poLines', { poNo, lineNo: i + 1, itemCode: ln.itemCode, description: ln.description, qty: ln.qty, unitPrice: ln.unitPrice, uom: 'EA' }));

      // Receipt
      if (U.daysBetween(requiredDate, asOf) < -3 && rnd() < 0.6) { po.status = 'Approved'; continue; } // not yet delivered
      const late = lateSuppliers.has(sid) && rnd() < 0.55 ? Math.floor(between(4, 20)) : rnd() < 0.08 ? Math.floor(between(1, 6)) : -Math.floor(between(0, 4));
      const receiptDate = U.addDays(requiredDate, late);
      if (receiptDate > asOf) { continue; }
      const grnNo = 'GRN-DEMO-' + String(++grnN).padStart(5, '0');
      const isService = /\(hour\)|\(call\)|\(day\)|\(month\)|\(trip\)|\(file\)|\(package\)|\(user\/yr\)/.test(lines[0].description);
      push('grns', { grnNo, poNo, supplierId: sid, receiptDate, type: isService ? 'Service' : 'Goods', receivedBy: 'u.dm.mnt', status: 'Posted' });
      const recLines = lines.map((ln) => {
        const partial = rnd() < 0.08 ? Math.max(1, Math.floor(ln.qty * 0.6)) : ln.qty;
        const rej = qualitySuppliers.has(sid) && rnd() < 0.3 ? Math.max(1, Math.floor(partial * 0.1)) : 0;
        push('grnLines', { grnNo, poNo, itemCode: ln.itemCode, qtyReceived: partial, qtyAccepted: partial - rej, qtyRejected: rej });
        return { ...ln, qtyRec: partial - rej };
      });
      po.status = recLines.every((r, i) => r.qtyRec >= lines[i].qty) ? 'Fully Received' : 'Partially Received';

      // Invoice
      const invoiceDate = U.addDays(receiptDate, Math.floor(between(0, 6)));
      if (invoiceDate > asOf) continue;
      const invLines = recLines.map((r) => ({ itemCode: r.itemCode, qty: r.qtyRec, unitPrice: r.unitPrice }));
      const sub = U.round(U.sum(invLines, (x) => x.qty * x.unitPrice), 2);
      const itax = s.country === 'Egypt' ? U.round(sub * VAT, 2) : 0;
      const whtRate = s.whtApplicable ? (isService ? 0.03 : 0.01) : 0;
      const invoiceNo = (s.supplierId.slice(1) + '-INV-' + String(++invN).padStart(5, '0'));
      const dueDate = U.addDays(invoiceDate, termsDays(s));
      const inv = mkInvoice({ invoiceNo, supplierId: sid, supplierName: s.name, invoiceDate, receivedDate: U.addDays(invoiceDate, 2), dueDate, poNo, grnNo, contractId: po.contractId, currency: s.currency, subtotal: sub, tax: itax, wht: U.round(sub * whtRate, 2), total: U.round(sub + itax, 2), paymentTerms: s.paymentTerms, description: lines.map((x) => x.description).join('; '), department: dept, costCenter: cc, project: po.project, category: s.category, emergency: po.emergency, bankIban: s.iban, fileHash: U.hash(invoiceNo + sid) });
      invLines.forEach((l) => push('invoiceLines', { invoiceNo, supplierId: sid, poNo, itemCode: l.itemCode, qty: l.qty, unitPrice: l.unitPrice }));
      const base = inv.total * fxAt(inv.currency);
      const age = U.daysBetween(invoiceDate, asOf);
      if (age > 4 || rnd() < 0.5) { inv.approvalStatus = 'Approved'; inv.status = 'Approved'; inv.approvedBy = approverFor(base); const ad = U.addDays(invoiceDate, Math.floor(between(2, 9))); inv.approvedDate = ad > asOf ? asOf : ad; }
      inv.approvedAmount = inv.approvalStatus === 'Approved' ? inv.total : null;
    }

    /* Injected invoice scenarios */
    const invBy = (no) => D.invoices.find((i) => i.invoiceNo === no);
    const anyOpenFor = (sid) => D.invoices.filter((i) => i.supplierId === sid);
    const cloneInv = (src, o, copyLines = true) => {
      const n = mkInvoice(Object.assign({}, src, { _key: undefined, _src: undefined, _demo: undefined }, o));
      if (copyLines) D.invoiceLines.filter((l) => l.invoiceNo === src.invoiceNo).forEach((l) => push('invoiceLines', { invoiceNo: n.invoiceNo, supplierId: l.supplierId, poNo: l.poNo, itemCode: l.itemCode, qty: l.qty, unitPrice: l.unitPrice }));
      return n;
    };
    // 1 Exact duplicate (same no, same supplier, same amount) — unpaid
    const s2 = anyOpenFor('S002').sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1))[1];
    if (s2) cloneInv(s2, { status: 'Received', approvalStatus: 'Pending Approval', approvedBy: null, receivedDate: U.addDays(s2.receivedDate, 9), enteredBy: 'u.acc2' }, false);
    // 2 High-risk duplicate: same supplier & amount, reformatted number, both paid later
    const s6 = anyOpenFor('S006').filter((i) => U.daysBetween(i.invoiceDate, asOf) > 70)[0];
    if (s6) cloneInv(s6, { invoiceNo: s6.invoiceNo.replace('-INV-', '/inv/').replace(/0+(\d)/, '$1'), fileHash: U.hash('rescan-' + s6.invoiceNo), invoiceDate: U.addDays(s6.invoiceDate, 3), dueDate: U.addDays(s6.dueDate, 3), receivedDate: U.addDays(s6.receivedDate, 4), approvalStatus: 'Approved', status: 'Approved', approvedBy: s6.approvedBy, approvedDate: U.addDays(s6.approvedDate || s6.invoiceDate, 3), _dupPaid: true, _noAutoPay: true });
    // 3 Split invoices just below 100k threshold
    const sp0 = d(-9);
    for (let j = 0; j < 3; j++) mkInvoice({ invoiceNo: '22-INV-SPL' + (j + 1), supplierId: 'S022', supplierName: sup('S022').name, invoiceDate: U.addDays(sp0, j), receivedDate: U.addDays(sp0, j + 1), dueDate: U.addDays(sp0, j + 15), poNo: null, grnNo: null, currency: 'EGP', subtotal: 85000 + j * 700, tax: U.round((85000 + j * 700) * VAT, 2), wht: U.round((85000 + j * 700) * 0.03, 2), total: U.round((85000 + j * 700) * (1 + VAT), 2), paymentTerms: 'Net 15', description: 'Urgent courier services — Marine Terminal', department: 'Marine Terminal', costCenter: 'CC-120', category: 'Logistics', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.dm.mar', approvedDate: U.addDays(sp0, j + 2), emergency: true, bankIban: sup('S022').iban });
    // 4 Round-number non-PO invoice
    mkInvoice({ invoiceNo: '09-INV-RND01', supplierId: 'S009', supplierName: sup('S009').name, invoiceDate: d(-6), receivedDate: d(-5), dueDate: d(2), poNo: null, currency: 'USD', subtotal: 50000, tax: 0, wht: 0, total: 50000, paymentTerms: 'Net 30', description: 'Advisory retainer', department: 'Finance', costCenter: 'CC-160', category: 'Consulting', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.fd', approvedDate: d(-4), bankIban: sup('S009').iban });
    mkInvoice({ invoiceNo: '02-INV-RND02', supplierId: 'S002', supplierName: sup('S002').name, invoiceDate: d(-3), receivedDate: d(-2), dueDate: d(42), poNo: null, currency: 'EGP', subtotal: 4500000, tax: 630000, wht: 45000, total: 5130000, paymentTerms: 'Net 45', description: 'Additional works — variation order', department: 'Maintenance', costCenter: 'CC-130', category: 'Pipeline Maintenance', approvalStatus: 'Pending Approval', status: 'Received', bankIban: sup('S002').iban });
    // 5 Price variance (8% above PO price)
    const pvBase = D.invoices.find((i) => i.supplierId === 'S011' && i.approvalStatus === 'Approved' && U.daysBetween(i.dueDate, asOf) < 0) || D.invoices.find((i) => i.supplierId === 'S011');
    if (pvBase) {
      const pl = D.invoiceLines.filter((l) => l.invoiceNo === pvBase.invoiceNo);
      pl.forEach((l) => (l.unitPrice = U.round(l.unitPrice * 1.08, 2)));
      pvBase.subtotal = U.round(U.sum(pl, (l) => l.qty * l.unitPrice), 2); pvBase.total = pvBase.subtotal + pvBase.tax;
    }
    // 6 Quantity variance (invoiced > received)
    const qvBase = D.invoices.find((i) => i.supplierId === 'S003' && U.daysBetween(i.dueDate, asOf) < -2);
    if (qvBase) {
      const ql = D.invoiceLines.filter((l) => l.invoiceNo === qvBase.invoiceNo)[0];
      ql.qty += 25;
      qvBase.subtotal = U.round(U.sum(D.invoiceLines.filter((l) => l.invoiceNo === qvBase.invoiceNo), (l) => l.qty * l.unitPrice), 2);
      qvBase.tax = U.round(qvBase.subtotal * VAT, 2); qvBase.total = U.round(qvBase.subtotal + qvBase.tax, 2);
    }
    // 7 PO invoice with missing GRN (open PO not received)
    const openPo = D.pos.find((p) => p.status === 'Approved' && p.supplierId === 'S004');
    if (openPo) {
      const ls = D.poLines.filter((l) => l.poNo === openPo.poNo);
      const sub = U.round(U.sum(ls, (l) => l.qty * l.unitPrice), 2);
      mkInvoice({ invoiceNo: '04-INV-NOGRN', supplierId: 'S004', supplierName: sup('S004').name, invoiceDate: d(-5), receivedDate: d(-4), dueDate: d(25), poNo: openPo.poNo, grnNo: null, contractId: openPo.contractId, currency: openPo.currency, subtotal: sub, tax: U.round(sub * VAT, 2), wht: U.round(sub * 0.03, 2), total: U.round(sub * (1 + VAT), 2), paymentTerms: 'Net 30', description: 'Licences — billed before delivery', department: 'IT', costCenter: 'CC-150', category: 'IT & Telecom', approvalStatus: 'Pending Approval', status: 'Exception' });
      ls.forEach((l) => push('invoiceLines', { invoiceNo: '04-INV-NOGRN', supplierId: 'S004', poNo: openPo.poNo, itemCode: l.itemCode, qty: l.qty, unitPrice: l.unitPrice }));
    }
    // 8 Off-contract: invoice after expired contract C-DEMO-008 (S013)
    mkInvoice({ invoiceNo: '13-INV-OFFC', supplierId: 'S013', supplierName: sup('S013').name, invoiceDate: d(-10), receivedDate: d(-9), dueDate: d(50), poNo: null, contractId: 'C-DEMO-008', currency: 'EGP', subtotal: 1250000, tax: 175000, wht: 12500, total: 1425000, paymentTerms: 'Net 60', description: 'Pipe coating — continuation after contract expiry', department: 'Maintenance', costCenter: 'CC-130', category: 'Pipeline Maintenance', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.fd', approvedDate: d(-7), bankIban: sup('S013').iban });
    // 9 Unusual tax rate (10% instead of configured 14%)
    mkInvoice({ invoiceNo: '17-INV-TAX10', supplierId: 'S017', supplierName: sup('S017').name, invoiceDate: d(-12), receivedDate: d(-11), dueDate: d(18), poNo: null, currency: 'EGP', subtotal: 640000, tax: 64000, wht: 19200, total: 704000, paymentTerms: 'Net 30', description: 'Telecom links — quarterly', department: 'IT', costCenter: 'CC-150', category: 'IT & Telecom', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.fd', approvedDate: d(-9), bankIban: sup('S017').iban });
    // 10 Data quality: missing due date, credit note (negative), zero-value, unknown supplier, GBP without FX
    mkInvoice({ invoiceNo: '07-INV-NODUE', supplierId: 'S007', supplierName: sup('S007').name, invoiceDate: d(-15), dueDate: null, poNo: null, currency: 'EGP', subtotal: 92000, tax: 12880, total: 104880, description: 'Trucking — ad hoc', category: 'Logistics', department: 'Operations', costCenter: 'CC-110' });
    mkInvoice({ invoiceNo: '06-CN-0007', supplierId: 'S006', supplierName: sup('S006').name, invoiceDate: d(-20), dueDate: d(10), currency: 'EGP', subtotal: -45000, tax: -6300, total: -51300, description: 'Credit note — returned seals', category: 'Spare Parts', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.apm' });
    mkInvoice({ invoiceNo: '16-INV-ZERO', supplierId: 'S016', supplierName: sup('S016').name, invoiceDate: d(-14), dueDate: d(16), currency: 'EGP', subtotal: 0, tax: 0, total: 0, description: 'Zero-value invoice', category: 'Facilities' });
    mkInvoice({ invoiceNo: 'X-INV-7781', supplierId: 'S099', supplierName: 'Unregistered Trader (Demo)', invoiceDate: d(-8), dueDate: d(22), currency: 'EGP', subtotal: 310000, tax: 43400, total: 353400, description: 'Supplies — supplier not in master', category: 'Spare Parts', approvalStatus: 'Pending Approval' });
    mkInvoice({ invoiceNo: '21-INV-00031', supplierId: 'S021', supplierName: 'Thames Inspection Ltd', invoiceDate: d(-18), dueDate: d(12), poNo: null, currency: 'GBP', subtotal: 38000, tax: 0, total: 38000, description: 'Third-party inspection', category: 'Engineering Services', department: 'Operations', costCenter: 'CC-110', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.fd', approvedDate: d(-15) });
    // 11 Dormant supplier suddenly active (last activity > 1 year ago)
    mkInvoice({ invoiceNo: '19-INV-00001', supplierId: 'S019', supplierName: sup('S019').name, invoiceDate: d(-500), dueDate: d(-470), currency: 'EGP', subtotal: 60000, tax: 8400, total: 68400, description: 'Bearings', category: 'Spare Parts', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.dm.mnt', approvedDate: d(-495), _histPaid: true, _noAutoPay: true });
    mkInvoice({ invoiceNo: '19-INV-00002', supplierId: 'S019', supplierName: sup('S019').name, invoiceDate: d(-4), dueDate: d(1), currency: 'EGP', subtotal: 870000, tax: 121800, total: 991800, description: 'Bearings and seals — urgent', category: 'Spare Parts', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.dm.mnt', approvedDate: d(-3), emergency: true, bankIban: sup('S019').iban });
    // 12 Blocked vendor invoice
    mkInvoice({ invoiceNo: '20-INV-00045', supplierId: 'S020', supplierName: sup('S020').name, invoiceDate: d(-30), dueDate: d(0), currency: 'EGP', subtotal: 215000, tax: 30100, total: 245100, description: 'Trucking', category: 'Logistics', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.fd', approvedDate: d(-25) });

    /* Payments */
    const mkPay = (o) => push('payments', Object.assign({ method: 'Bank Transfer', approvalStatus: 'Approved', executionStatus: 'Executed', createdBy: 'u.acc1', approvedBy: 'u.tm', executedBy: 'u.to', reconciledBy: 'u.acc2', urgent: false, manual: false }, o));
    const mkTxn = (p, o) => push('bankTxns', Object.assign({ txnId: 'TXN-DEMO-' + String(++txN).padStart(6, '0'), accountId: p.bankAccountId, date: U.addDays(p.paymentDate, rnd() < 0.85 ? 0 : 1), amount: -p.net, debit: p.net, credit: null, reference: p.reference, description: 'Transfer ' + p.supplierId, counterpartyIban: p.beneficiaryIban }, o));
    for (const inv of D.invoices.slice()) {
      if (inv.total <= 0 || inv.approvalStatus !== 'Approved' || !inv.dueDate) continue;
      if (inv.supplierId === 'S099' || inv.supplierId === 'S020' || inv._noAutoPay) continue;
      const late = rnd() < 0.15 ? Math.floor(between(3, 40)) : -Math.floor(between(0, 3));
      let payDate = U.addDays(inv.dueDate, late);
      const dpdNow = U.daysBetween(inv.dueDate, asOf);
      const overdueOpen = dpdNow > 0 && rnd() < (dpdNow < 90 ? 0.1 : 0.03); // keep some overdue unpaid
      if (payDate >= asOf || overdueOpen) continue;
      if (/^2\/10/.test(inv.paymentTerms || '') && rnd() < 0.5) payDate = U.addDays(inv.invoiceDate, 9);
      while (U.dow(payDate) === 5 || U.dow(payDate) === 6) payDate = U.addDays(payDate, 1);
      if (payDate >= asOf) continue;
      const s = sup(inv.supplierId);
      const paymentId = 'PAY-DEMO-' + String(++payN).padStart(5, '0');
      const baseAmt = inv.total * fxAt(inv.currency);
      const p = mkPay({ paymentId, supplierId: inv.supplierId, invoiceNo: inv.invoiceNo, poNo: inv.poNo, paymentDate: payDate, currency: inv.currency, gross: inv.total, wht: inv.wht || 0, net: U.round(inv.total - (inv.wht || 0), 2), bankAccountId: accFor(inv.currency), beneficiaryIban: s ? s.iban : null, reference: 'REF' + U.hash(paymentId).slice(0, 10).toUpperCase(), batchId: null, approvedBy: baseAmt >= 100000 || inv.currency !== 'EGP' ? 'u.fd' : 'u.tm' });
      mkTxn(p);
    }
    // Batches from executed payments
    const byDay = U.groupBy(D.payments, (p) => p.paymentDate + '|' + p.bankAccountId);
    let bN = 0;
    for (const [k, ps] of byDay) {
      const [date, acc] = k.split('|');
      const batchId = 'PB-DEMO-' + date.slice(0, 4) + '-' + String(++bN).padStart(3, '0');
      ps.forEach((p) => (p.batchId = batchId));
      const tot = U.sum(ps, (p) => p.net) * fxAt(ps[0].currency);
      push('batches', { batchId, createdDate: U.addDays(date, -2), paymentDate: date, bankAccountId: acc, currency: ps[0].currency, createdBy: 'u.to', treasuryApprovedBy: 'u.tm', cfoApprovedBy: tot >= 900000 || ps.some((p) => p.urgent || (D.invoices.find((i) => i.invoiceNo === p.invoiceNo) || {}).emergency) ? 'u.cfo' : null, status: 'Executed' });
    }
    const lastPay = (sid) => D.payments.filter((p) => p.supplierId === sid).sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1))[0];
    // Duplicate payment for the reformatted duplicate invoice
    if (s6) {
      const dupInv = D.invoices.find((i) => i._dupPaid);
      let orig = D.payments.find((p) => p.invoiceNo === s6.invoiceNo);
      if (!orig && dupInv) {
        orig = mkPay({ paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), supplierId: 'S006', invoiceNo: s6.invoiceNo, poNo: s6.poNo, paymentDate: U.addDays(s6.dueDate, -1), currency: 'EGP', gross: s6.total, wht: s6.wht || 0, net: U.round(s6.total - (s6.wht || 0), 2), bankAccountId: 'BA-EGP-01', beneficiaryIban: sup('S006').iban, reference: 'REF' + U.hash('orig6').slice(0, 10).toUpperCase(), approvedBy: 'u.fd' });
        mkTxn(orig);
      }
      if (dupInv && orig) {
        const p = mkPay({ paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), supplierId: 'S006', invoiceNo: dupInv.invoiceNo, poNo: dupInv.poNo, paymentDate: U.addDays(orig.paymentDate, 5), currency: 'EGP', gross: dupInv.total, wht: dupInv.wht, net: U.round(dupInv.total - (dupInv.wht || 0), 2), bankAccountId: 'BA-EGP-02', beneficiaryIban: sup('S006').iban, reference: 'REF' + U.hash('dup').slice(0, 10).toUpperCase() });
        mkTxn(p);
      }
      delete dupInv._dupPaid;
    }
    const dupInv0 = D.invoices.find((i) => i._noAutoPay && i._dupPaid !== undefined || (i._noAutoPay && !i._histPaid));
    // Historic payment to dormant supplier
    const dInv = D.invoices.find((i) => i._histPaid);
    if (dupInv0) delete dupInv0._noAutoPay;
    if (dInv) { delete dInv._noAutoPay; mkTxn(mkPay({ paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), supplierId: 'S019', invoiceNo: dInv.invoiceNo, paymentDate: d(-468), currency: 'EGP', gross: dInv.total, wht: 0, net: dInv.total, bankAccountId: 'BA-EGP-01', beneficiaryIban: sup('S019').iban, reference: 'REFHIST0001' })); delete dInv._histPaid; }
    // Bank change shortly before a large payment (S001), unverified, changed & payment approved by same person
    const p1 = lastPay('S001');
    if (p1) {
      const newIban = synthIban('S001-new');
      push('bankChanges', { supplierId: 'S001', changeDate: U.addDays(p1.paymentDate, -4), oldIban: sup('S001').iban, newIban, changedBy: 'u.tm', approvedBy: null, verified: false });
      sup('S001').bankChangedOn = U.addDays(p1.paymentDate, -4);
      sup('S001').iban = newIban;
      p1.beneficiaryIban = newIban;
      D.bankTxns.filter((t) => t.reference === p1.reference).forEach((t) => (t.counterpartyIban = newIban));
    }
    push('bankChanges', { supplierId: 'S008', changeDate: d(-200), oldIban: synthIban('S008-old'), newIban: sup('S008').iban, changedBy: 'u.acc1', approvedBy: 'u.fd', verified: true });
    // Weekend (Friday) manual urgent payment
    const wInv = D.invoices.find((i) => i.supplierId === 'S007' && i.approvalStatus === 'Approved' && !D.payments.some((p) => p.invoiceNo === i.invoiceNo) && i.total > 0);
    let fri = d(-20); while (U.dow(fri) !== 5) fri = U.addDays(fri, -1);
    if (wInv) mkTxn(mkPay({ paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), supplierId: 'S007', invoiceNo: wInv.invoiceNo, poNo: wInv.poNo, paymentDate: fri, currency: 'EGP', gross: wInv.total, wht: wInv.wht || 0, net: U.round(wInv.total - (wInv.wht || 0), 2), bankAccountId: 'BA-EGP-02', beneficiaryIban: sup('S007').iban, reference: 'REFWEEKEND01', urgent: true, manual: true, createdBy: 'u.tm', approvedBy: 'u.tm', executedBy: 'u.tm' }));
    // Same invoice paid twice (exact duplicate payment, different bank reference)
    const twice = D.payments.find((p) => p.supplierId === 'S008' && p.executionStatus === 'Executed' && p.paymentDate > d(-90));
    if (twice) mkTxn(mkPay(Object.assign({}, twice, { _key: undefined, _src: undefined, _demo: undefined, paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), paymentDate: U.addDays(twice.paymentDate, 3), reference: 'REF' + U.hash('twice').slice(0, 10).toUpperCase(), batchId: null, approvedBy: 'u.fd' })));
    // CRITICAL SoD example: same user (u.pm) created & approved supplier S015, approved its invoice and its payment
    const sodInv = mkInvoice({ invoiceNo: '15-INV-00077', supplierId: 'S015', supplierName: sup('S015').name, invoiceDate: d(-26), receivedDate: d(-25), dueDate: d(-5), poNo: null, currency: 'EGP', subtotal: 84000, tax: 11760, wht: 840, total: 95760, paymentTerms: 'Net 30', description: 'Gasket sets — spot purchase', department: 'Maintenance', costCenter: 'CC-130', category: 'Spare Parts', approvalStatus: 'Approved', status: 'Approved', approvedBy: 'u.pm', approvedDate: d(-24), bankIban: sup('S015').iban });
    mkTxn(mkPay({ paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), supplierId: 'S015', invoiceNo: sodInv.invoiceNo, paymentDate: d(-6), currency: 'EGP', gross: sodInv.total, wht: 840, net: U.round(sodInv.total - 840, 2), bankAccountId: 'BA-EGP-02', beneficiaryIban: sup('S015').iban, reference: 'REFSOD00001', approvedBy: 'u.pm' }));
    // Beneficiary IBAN differs from supplier master (no change history)
    const bm = D.payments.find((p) => p.supplierId === 'S016' && p.executionStatus === 'Executed');
    if (bm) { bm.beneficiaryIban = synthIban('S016-unknown'); D.bankTxns.filter((t) => t.reference === bm.reference).forEach((t) => (t.counterpartyIban = bm.beneficiaryIban)); }
    // Payment to blocked vendor without bank reference, approved by creator
    const bInv = invBy('20-INV-00045');
    if (bInv) mkTxn(mkPay({ paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), supplierId: 'S020', invoiceNo: bInv.invoiceNo, paymentDate: d(-2), currency: 'EGP', gross: bInv.total, wht: 0, net: bInv.total, bankAccountId: 'BA-EGP-01', beneficiaryIban: sup('S020').iban, reference: null, createdBy: 'u.acc2', approvedBy: 'u.acc2', executedBy: 'u.tm', manual: true }), { reference: 'NOREF-' + txN, description: 'Manual transfer' });
    // Payment without any approved invoice (invoice pending approval)
    const pend = D.invoices.find((i) => i.approvalStatus === 'Pending Approval' && i.supplierId === 'S010' && i.total > 0) || D.invoices.find((i) => i.approvalStatus === 'Pending Approval' && i.total > 0 && i.supplierId !== 'S099');
    if (pend) mkTxn(mkPay({ paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), supplierId: pend.supplierId, invoiceNo: pend.invoiceNo, paymentDate: d(-1), currency: pend.currency, gross: pend.total, wht: 0, net: pend.total, bankAccountId: accFor(pend.currency), beneficiaryIban: (sup(pend.supplierId) || {}).iban, reference: 'REFNOAPPR01', approvedBy: 'u.apm' }));
    // Large payment above authority: approved by FD only (> 5M tier needs CFO + Executive)
    const big = D.payments.filter((p) => p.currency === 'EGP').sort((a, b) => b.net - a.net)[0];
    if (big && big.net < 5000000) {
      const inv = invBy(big.invoiceNo);
      big.net = 5200000; big.gross = 5200000 + (big.wht || 0);
      if (inv) { inv.total = big.gross; inv.subtotal = U.round(inv.total / (1 + VAT), 2); inv.tax = U.round(inv.total - inv.subtotal, 2); inv.approvedBy = 'u.fd'; }
      D.bankTxns.filter((t) => t.reference === big.reference).forEach((t) => { t.amount = -big.net; t.debit = big.net; });
    }
    if (big) { big.approvedBy = 'u.fd'; const b = D.batches.find((x) => x.batchId === big.batchId); if (b) b.cfoApprovedBy = null; }
    // Payment register vs bank statement exceptions
    const execd = D.payments.filter((p) => p.executionStatus === 'Executed' && p.reference && p.paymentDate > d(-60));
    if (execd[0]) { const i = D.bankTxns.findIndex((t) => t.reference === execd[0].reference); if (i >= 0) D.bankTxns.splice(i, 1); } // missing in bank
    if (execd[1]) { const t = D.bankTxns.find((x) => x.reference === execd[1].reference); if (t) { t.amount -= 1500; t.debit += 1500; } } // wrong amount (bank charge)
    if (execd[2]) { const t = D.bankTxns.find((x) => x.reference === execd[2].reference); if (t) t.date = U.addDays(execd[2].paymentDate, 6); } // timing difference
    if (execd[3]) { const t = D.bankTxns.find((x) => x.reference === execd[3].reference); if (t) { push('bankTxns', Object.assign({}, t, { _key: undefined, txnId: 'TXN-DEMO-' + String(++txN).padStart(6, '0'), amount: -t.amount, debit: null, credit: t.debit, description: 'REVERSAL ' + t.reference })); execd[3].executionStatus = 'Reversed'; } }
    push('bankTxns', { txnId: 'TXN-DEMO-' + String(++txN).padStart(6, '0'), accountId: 'BA-EGP-01', date: d(-11), amount: -387500, debit: 387500, credit: null, reference: 'UNKNOWN-7731', description: 'Outgoing transfer — no payment record', counterpartyIban: synthIban('unknown') });
    // Scheduled (approved, not yet executed) payments + a draft proposal batch
    const upcoming = D.invoices.filter((i) => i.approvalStatus === 'Approved' && i.total > 0 && i.dueDate && i.dueDate >= asOf && i.dueDate <= d(10) && !D.payments.some((p) => p.invoiceNo === i.invoiceNo) && sup(i.supplierId) && sup(i.supplierId).approvedStatus === 'Approved').slice(0, 6);
    if (upcoming.length) {
      const batchId = 'PB-DEMO-' + asOf.slice(0, 4) + '-' + String(++bN).padStart(3, '0');
      push('batches', { batchId, createdDate: d(-1), paymentDate: d(3), bankAccountId: 'BA-EGP-01', currency: 'EGP', createdBy: 'u.to', treasuryApprovedBy: 'u.tm', cfoApprovedBy: null, status: 'Scheduled' });
      upcoming.filter((i) => i.currency === 'EGP').forEach((inv) => mkPay({ paymentId: 'PAY-DEMO-' + String(++payN).padStart(5, '0'), supplierId: inv.supplierId, invoiceNo: inv.invoiceNo, poNo: inv.poNo, paymentDate: d(3), currency: 'EGP', gross: inv.total, wht: inv.wht || 0, net: U.round(inv.total - (inv.wht || 0), 2), bankAccountId: 'BA-EGP-01', beneficiaryIban: sup(inv.supplierId).iban, reference: null, batchId, approvalStatus: 'Approved', executionStatus: 'Scheduled', executedBy: null, reconciledBy: null }));
    }

    /* Invoice paid/outstanding and status from payments */
    for (const inv of D.invoices) {
      const paid = U.sum(D.payments.filter((p) => p.invoiceNo === inv.invoiceNo && ['Executed', 'Reconciled'].includes(p.executionStatus)), (p) => p.gross);
      if (paid > 0 && paid >= inv.total - 1) inv.status = 'Paid';
    }

    /* Disputes */
    const disp = [
      ['DSP-DEMO-01', 'Price dispute', 'S011', pvBase && pvBase.invoiceNo, 'Unit price above PO', 'u.apm', -14, 7, 'Open', 'Supplier applied new tariff without PO amendment', null],
      ['DSP-DEMO-02', 'Quantity dispute', 'S003', qvBase && qvBase.invoiceNo, 'Invoiced qty exceeds GRN', 'u.apm', -9, 5, 'Open', null, null],
      ['DSP-DEMO-03', 'Quality dispute', 'S010', null, 'Rejected bearing sets', 'u.pm', -40, -10, 'Overdue', 'Supplier QA failure', null],
      ['DSP-DEMO-04', 'Contract dispute', 'S013', '13-INV-OFFC', 'Work billed after contract expiry', 'u.pm', -6, 20, 'Open', null, null],
      ['DSP-DEMO-05', 'Payment dispute', 'S001', null, 'Supplier claims late payment penalty', 'u.tm', -60, -30, 'Resolved', 'Payment delayed by approval bottleneck', 'Penalty waived after negotiation'],
      ['DSP-DEMO-06', 'Tax dispute', 'S017', '17-INV-TAX10', 'VAT rate on invoice differs from configured rate', 'u.acc1', -3, 12, 'Open', null, null],
    ];
    disp.forEach(([disputeId, type, supplierId, invoiceNo, issue, owner, r, t, status, rootCause, resolution]) => {
      const inv = invoiceNo ? invBy(invoiceNo) : null;
      push('disputes', { disputeId, type, supplierId, invoiceNo, amount: inv ? inv.total : null, currency: inv ? inv.currency : null, issue, owner, raisedDate: d(r), targetDate: d(t), status, rootCause, resolution });
    });

    /* Supplier evaluations (responsiveness / reliability are survey-type inputs) */
    D.suppliers.filter((s) => s.approvedStatus === 'Approved').forEach((s) => push('evaluations', { supplierId: s.supplierId, period: asOf.slice(0, 4), responsiveness: Math.round(between(55, 98)) - (lateSuppliers.has(s.supplierId) ? 15 : 0), reliability: Math.round(between(60, 98)) - (qualitySuppliers.has(s.supplierId) ? 18 : 0), quality: null }));

    /* Expected collections & other outflows (13+ weeks) */
    for (let w = 0; w < 18; w++) {
      push('collections', { date: d(w * 7 + 2), currency: 'USD', amount: Math.round(between(1.4e6, 2.1e6)), description: 'Transit revenue (DEMO)' });
      push('collections', { date: d(w * 7 + 4), currency: 'EGP', amount: Math.round(between(25e6, 40e6)), description: 'Storage & services revenue (DEMO)' });
    }
    for (let m = 0; m < 12; m++) {
      push('otherOutflows', { date: U.addDays(U.addMonths(asOf, m), 24), currency: 'EGP', amount: 96000000, description: 'Payroll (DEMO)' });
      push('otherOutflows', { date: U.addDays(U.addMonths(asOf, m), 14), currency: 'USD', amount: 1800000, description: 'Loan service (DEMO)' });
    }

    /* Budgets */
    DEPTS.forEach(([dept, cc]) => push('budgets', { costCenter: cc, year: asOf.slice(0, 4), category: null, amount: Math.round(between(60e6, 260e6) / 1e6) * 1e6, currency: 'EGP' }));

    /* GL AP summary — consistent with the sub-ledger (month-end outstanding), with one injected difference */
    const lastRate = (c) => (D.fxRates.filter((r) => r.currency === c && r.date <= asOf).slice(-1)[0] || {}).rate || null;
    for (let m = -12; m <= 0; m++) {
      const fxf = (c) => (c === 'EGP' ? 1 : m === 0 ? lastRate(c) : fxBase[c] || null);
      const me = m === 0 ? asOf : U.endOfMonth(U.addMonths(asOf, m));
      const ms = U.addMonths(asOf, m);
      let ap = 0, purch = 0;
      for (const inv of D.invoices) {
        const f = fxf(inv.currency);
        if (!f) continue;
        if (inv.invoiceDate <= me) {
          const paid = U.sum(D.payments.filter((p) => p.invoiceNo === inv.invoiceNo && ['Executed', 'Reconciled'].includes(p.executionStatus) && p.paymentDate <= me), (p) => p.gross);
          ap += (inv.total - paid) * f;
        }
        if (inv.invoiceDate >= ms && inv.invoiceDate <= me) purch += (inv.subtotal || 0) * f;
      }
      push('gl', { period: me.slice(0, 7), apBalance: Math.round(ap) + (m === 0 ? 125000 : 0), purchases: Math.round(purch), cogs: null, currency: 'EGP' });
    }

    /* Approvals register (derived from the approvedBy fields so lineage is explicit) */
    return D;
  };

  S.loadDemo = () => {
    S.resetData('demo');
    const D = S.demo.generate(S.state.config.asOfDate || U.todayISO());
    Object.assign(S.state.data, D);
    S.state.config.taxCodes = D.taxCodes.map((t) => ({ ...t }));
    S.state.sources = Object.entries(D).filter(([, v]) => v.length).map(([k, v]) => ({
      fileId: 'demo-' + k, name: v[0]._src.file, size: null, kind: 'demo', hash: null, uploadedAt: new Date().toISOString(), uploadedBy: 'DEMO GENERATOR',
      status: 'DEMO / SYNTHETIC', classifiedAs: S.schema[k].label, notes: ['Synthetic demonstration data — not SUMED data'],
      sheets: [{ name: k, entity: k, rowCount: v.length, loaded: v.length, headerRow: 1, confidence: 1 }],
    }));
    S.audit('demo.load', 'workspace', 'DEMO', { newValue: 'Synthetic dataset loaded', reason: 'No source files uploaded — demo mode' });
    S.emit('data');
  };
})(typeof window !== 'undefined' ? window : globalThis);
