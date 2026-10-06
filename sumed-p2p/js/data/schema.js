/* SUMED P2P — canonical data model, column synonyms (EN/AR) and file classifier.
 * Field types: s=string, n=number, d=date, b=boolean. `req` marks fields needed for the entity's core controls. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});

  const F = (key, type, syn, req) => ({ key, type, syn: syn || [], req: !!req });

  S.schema = {
    suppliers: {
      label: 'Supplier Master', labelAr: 'سجل الموردين الرئيسي', pk: 'supplierId',
      keywords: ['supplier', 'vendor', 'iban', 'swift', 'tax id', 'commercial', 'مورد', 'الموردين'],
      fields: [
        F('supplierId', 's', ['supplier id', 'vendor id', 'supplier code', 'vendor code', 'vendor no', 'supplier no', 'كود المورد', 'رقم المورد'], true),
        F('name', 's', ['supplier name', 'vendor name', 'name', 'company name', 'اسم المورد'], true),
        F('nameAr', 's', ['arabic name', 'supplier name ar', 'name ar', 'الاسم بالعربية', 'اسم المورد بالعربي']),
        F('type', 's', ['supplier type', 'vendor type', 'نوع المورد']),
        F('category', 's', ['category', 'supplier category', 'commodity', 'الفئة', 'التصنيف']),
        F('classification', 's', ['classification', 'class', 'segment']),
        F('legalEntity', 's', ['legal entity', 'legal form', 'الكيان القانوني']),
        F('country', 's', ['country', 'الدولة']),
        F('city', 's', ['city', 'المدينة']),
        F('address', 's', ['address', 'العنوان']),
        F('taxId', 's', ['tax id', 'tax registration', 'tax no', 'tin', 'tax card', 'رقم التسجيل الضريبي', 'البطاقة الضريبية'], true),
        F('commercialReg', 's', ['commercial registration', 'cr', 'cr no', 'commercial register', 'السجل التجاري']),
        F('vatStatus', 's', ['vat status', 'vat registered', 'حالة القيمة المضافة']),
        F('contactPerson', 's', ['contact person', 'contact', 'contact name', 'مسؤول الاتصال']),
        F('email', 's', ['email', 'e-mail', 'البريد الإلكتروني']),
        F('phone', 's', ['phone', 'telephone', 'mobile', 'الهاتف']),
        F('website', 's', ['website', 'web', 'الموقع']),
        F('bankName', 's', ['bank name', 'bank', 'البنك']),
        F('bankBranch', 's', ['bank branch', 'branch', 'الفرع']),
        F('bankAccount', 's', ['bank account', 'account no', 'account number', 'رقم الحساب']),
        F('iban', 's', ['iban', 'ايبان'], true),
        F('swift', 's', ['swift', 'bic', 'swift code']),
        F('currency', 's', ['currency', 'supplier currency', 'العملة']),
        F('paymentTerms', 's', ['payment terms', 'terms', 'شروط الدفع']),
        F('creditTerms', 's', ['credit terms', 'credit limit', 'الحد الائتماني']),
        F('contractStart', 'd', ['contract start', 'contract start date']),
        F('contractEnd', 'd', ['contract end', 'contract end date', 'contract expiry']),
        F('contractValue', 'n', ['contract value']),
        F('contractCurrency', 's', ['contract currency']),
        F('poRequired', 'b', ['po required', 'po requirement']),
        F('taxTreatment', 's', ['tax treatment', 'المعاملة الضريبية']),
        F('whtApplicable', 'b', ['withholding tax', 'wht', 'wht applicable', 'ضريبة الخصم']),
        F('critical', 'b', ['critical', 'critical supplier', 'مورد حرج']),
        F('strategic', 'b', ['strategic', 'strategic supplier', 'مورد استراتيجي']),
        F('singleSource', 'b', ['single source', 'sole source', 'مصدر وحيد']),
        F('approvedStatus', 's', ['status', 'supplier status', 'approved status', 'approval status', 'الحالة'], true),
        F('onboardingDate', 'd', ['onboarding date', 'registration date', 'created date', 'تاريخ التسجيل']),
        F('lastReviewDate', 'd', ['last review date', 'last review']),
        F('nextReviewDate', 'd', ['next review date', 'next review']),
        F('complianceStatus', 's', ['compliance status', 'compliance', 'حالة الامتثال']),
        F('sanctionsStatus', 's', ['sanctions', 'sanctions screening', 'sanctions status', 'فحص العقوبات']),
        F('insuranceStatus', 's', ['insurance status', 'insurance']),
        F('insuranceExpiry', 'd', ['insurance expiry', 'insurance expiry date']),
        F('onboardingStage', 'n', ['onboarding stage', 'stage']),
        F('createdBy', 's', ['created by', 'creator', 'أنشئ بواسطة']),
        F('approvedBy', 's', ['approved by', 'approver', 'اعتمد بواسطة']),
        F('bankChangedOn', 'd', ['bank changed on', 'bank change date', 'last bank change']),
      ],
    },
    supplierDocs: {
      label: 'Supplier Documents', labelAr: 'مستندات الموردين', pk: null,
      keywords: ['document type', 'doc type', 'expiry', 'نوع المستند'],
      fields: [
        F('supplierId', 's', ['supplier id', 'vendor id', 'supplier code'], true),
        F('docType', 's', ['document type', 'doc type', 'document', 'نوع المستند'], true),
        F('docNo', 's', ['document no', 'doc no', 'reference']),
        F('issueDate', 'd', ['issue date', 'تاريخ الإصدار']),
        F('expiryDate', 'd', ['expiry date', 'expiry', 'valid until', 'تاريخ الانتهاء']),
        F('status', 's', ['status', 'الحالة']),
      ],
    },
    bankChanges: {
      label: 'Supplier Bank Changes', labelAr: 'تغييرات حسابات الموردين البنكية', pk: null,
      keywords: ['old iban', 'new iban', 'change date', 'bank change'],
      fields: [
        F('supplierId', 's', ['supplier id', 'vendor id'], true),
        F('changeDate', 'd', ['change date', 'changed on', 'date'], true),
        F('oldIban', 's', ['old iban', 'previous iban', 'old account']),
        F('newIban', 's', ['new iban', 'new account'], true),
        F('changedBy', 's', ['changed by', 'user']),
        F('approvedBy', 's', ['approved by']),
        F('verified', 'b', ['verified', 'call-back verified', 'callback']),
      ],
    },
    contracts: {
      label: 'Contracts', labelAr: 'العقود', pk: 'contractId',
      keywords: ['contract', 'contract no', 'contract value', 'renewal', 'عقد'],
      fields: [
        F('contractId', 's', ['contract id', 'contract no', 'contract number', 'رقم العقد'], true),
        F('supplierId', 's', ['supplier id', 'vendor id', 'supplier code'], true),
        F('type', 's', ['contract type', 'type', 'نوع العقد']),
        F('startDate', 'd', ['start date', 'contract start', 'تاريخ البدء'], true),
        F('endDate', 'd', ['end date', 'contract end', 'expiry date', 'تاريخ الانتهاء'], true),
        F('value', 'n', ['contract value', 'value', 'amount', 'قيمة العقد'], true),
        F('currency', 's', ['currency', 'العملة'], true),
        F('paymentTerms', 's', ['payment terms', 'terms']),
        F('renewalDate', 'd', ['renewal date']),
        F('status', 's', ['status', 'الحالة']),
        F('latePenaltyPct', 'n', ['late penalty', 'late payment penalty', 'penalty %']),
        F('earlyDiscount', 's', ['early payment discount', 'discount terms']),
      ],
    },
    prs: {
      label: 'Purchase Requisitions', labelAr: 'طلبات الشراء', pk: 'prNo',
      keywords: ['requisition', 'pr no', 'requester', 'طلب شراء'],
      fields: [
        F('prNo', 's', ['pr no', 'pr number', 'requisition no', 'requisition', 'رقم طلب الشراء'], true),
        F('date', 'd', ['pr date', 'date', 'request date'], true),
        F('department', 's', ['department', 'الإدارة']),
        F('costCenter', 's', ['cost center', 'cost centre', 'مركز التكلفة']),
        F('project', 's', ['project', 'المشروع']),
        F('requester', 's', ['requester', 'requested by']),
        F('description', 's', ['description', 'الوصف']),
        F('amount', 'n', ['estimated amount', 'amount', 'value']),
        F('currency', 's', ['currency']),
        F('status', 's', ['status']),
        F('approvedBy', 's', ['approved by']),
      ],
    },
    rfqs: {
      label: 'RFQs & Quotations', labelAr: 'طلبات عروض الأسعار', pk: null,
      keywords: ['rfq', 'quotation', 'quote', 'bid', 'عرض سعر'],
      fields: [
        F('rfqNo', 's', ['rfq no', 'rfq number', 'rfq'], true),
        F('prNo', 's', ['pr no', 'requisition']),
        F('date', 'd', ['rfq date', 'date', 'quote date']),
        F('supplierId', 's', ['supplier id', 'vendor id', 'bidder'], true),
        F('itemCode', 's', ['item code', 'item']),
        F('quoteAmount', 'n', ['quote amount', 'quoted amount', 'bid amount', 'amount'], true),
        F('currency', 's', ['currency']),
        F('selected', 'b', ['selected', 'awarded', 'winner']),
      ],
    },
    pos: {
      label: 'Purchase Orders', labelAr: 'أوامر الشراء', pk: 'poNo',
      keywords: ['po number', 'po no', 'purchase order', 'required delivery', 'أمر شراء'],
      fields: [
        F('poNo', 's', ['po no', 'po number', 'purchase order', 'po', 'رقم أمر الشراء'], true),
        F('prNo', 's', ['pr no', 'requisition']),
        F('rfqNo', 's', ['rfq no']),
        F('supplierId', 's', ['supplier id', 'vendor id', 'supplier code'], true),
        F('department', 's', ['department', 'الإدارة']),
        F('costCenter', 's', ['cost center', 'cost centre', 'مركز التكلفة']),
        F('project', 's', ['project', 'المشروع']),
        F('contractId', 's', ['contract id', 'contract no', 'contract']),
        F('category', 's', ['category', 'spend category']),
        F('poDate', 'd', ['po date', 'order date', 'date', 'تاريخ أمر الشراء'], true),
        F('requiredDate', 'd', ['required delivery date', 'delivery date', 'need by', 'required date']),
        F('currency', 's', ['currency', 'العملة'], true),
        F('amount', 'n', ['po amount', 'net amount', 'subtotal', 'amount'], true),
        F('tax', 'n', ['tax', 'vat', 'tax amount']),
        F('total', 'n', ['total amount', 'total', 'gross amount']),
        F('status', 's', ['po status', 'status']),
        F('createdBy', 's', ['created by', 'buyer']),
        F('approvedBy', 's', ['approved by']),
        F('emergency', 'b', ['emergency', 'urgent']),
      ],
    },
    poLines: {
      label: 'PO Lines', labelAr: 'بنود أوامر الشراء', pk: null,
      keywords: ['po line', 'line no', 'unit price', 'item code'],
      fields: [
        F('poNo', 's', ['po no', 'po number'], true),
        F('lineNo', 'n', ['line no', 'line', 'line number']),
        F('itemCode', 's', ['item code', 'item', 'material', 'sku'], true),
        F('description', 's', ['description', 'item description']),
        F('qty', 'n', ['quantity', 'qty', 'ordered qty'], true),
        F('unitPrice', 'n', ['unit price', 'price', 'rate'], true),
        F('uom', 's', ['uom', 'unit']),
      ],
    },
    grns: {
      label: 'Goods / Service Receipts', labelAr: 'أذون الاستلام', pk: 'grnNo',
      keywords: ['grn', 'goods receipt', 'receipt no', 'received by', 'إذن استلام'],
      fields: [
        F('grnNo', 's', ['grn no', 'grn number', 'grn', 'receipt no', 'gr no', 'رقم إذن الاستلام'], true),
        F('poNo', 's', ['po no', 'po number'], true),
        F('supplierId', 's', ['supplier id', 'vendor id']),
        F('receiptDate', 'd', ['receipt date', 'grn date', 'received date', 'date'], true),
        F('type', 's', ['receipt type', 'type']),
        F('receivedBy', 's', ['received by']),
        F('status', 's', ['status']),
      ],
    },
    grnLines: {
      label: 'GRN Lines', labelAr: 'بنود أذون الاستلام', pk: null,
      keywords: ['qty received', 'accepted', 'rejected qty'],
      fields: [
        F('grnNo', 's', ['grn no', 'grn'], true),
        F('poNo', 's', ['po no', 'po number']),
        F('itemCode', 's', ['item code', 'item'], true),
        F('qtyReceived', 'n', ['qty received', 'received qty', 'quantity received', 'quantity'], true),
        F('qtyAccepted', 'n', ['qty accepted', 'accepted qty', 'accepted']),
        F('qtyRejected', 'n', ['qty rejected', 'rejected qty', 'rejected']),
      ],
    },
    invoices: {
      label: 'Invoice Register', labelAr: 'سجل الفواتير', pk: 'invoiceNo',
      keywords: ['invoice', 'invoice no', 'invoice date', 'due date', 'فاتورة'],
      fields: [
        F('invoiceNo', 's', ['invoice no', 'invoice number', 'invoice', 'inv no', 'bill no', 'رقم الفاتورة'], true),
        F('supplierId', 's', ['supplier id', 'vendor id', 'supplier code', 'vendor code'], true),
        F('supplierName', 's', ['supplier name', 'vendor name', 'supplier']),
        F('invoiceDate', 'd', ['invoice date', 'date', 'تاريخ الفاتورة'], true),
        F('receivedDate', 'd', ['received date', 'receipt date']),
        F('dueDate', 'd', ['due date', 'payment due', 'تاريخ الاستحقاق'], true),
        F('poNo', 's', ['po no', 'po number', 'purchase order']),
        F('grnNo', 's', ['grn no', 'grn']),
        F('contractId', 's', ['contract id', 'contract no']),
        F('currency', 's', ['currency', 'العملة'], true),
        F('subtotal', 'n', ['subtotal', 'net amount', 'amount before tax']),
        F('tax', 'n', ['tax', 'vat', 'tax amount', 'ضريبة القيمة المضافة']),
        F('wht', 'n', ['withholding tax', 'wht', 'ضريبة الخصم']),
        F('total', 'n', ['total', 'total amount', 'gross amount', 'invoice amount', 'الإجمالي'], true),
        F('approvedAmount', 'n', ['approved amount']),
        F('paidAmount', 'n', ['paid amount', 'amount paid']),
        F('outstanding', 'n', ['outstanding', 'balance', 'open amount', 'outstanding amount', 'الرصيد المستحق']),
        F('paymentTerms', 's', ['payment terms', 'terms']),
        F('status', 's', ['invoice status', 'status']),
        F('approvalStatus', 's', ['approval status', 'approval']),
        F('enteredBy', 's', ['entered by', 'created by', 'posted by']),
        F('approvedBy', 's', ['approved by']),
        F('approvedDate', 'd', ['approved date', 'approval date']),
        F('description', 's', ['description', 'narrative', 'الوصف']),
        F('department', 's', ['department']),
        F('costCenter', 's', ['cost center']),
        F('project', 's', ['project']),
        F('category', 's', ['category']),
        F('emergency', 'b', ['emergency', 'urgent']),
        F('bankIban', 's', ['iban on invoice', 'beneficiary iban', 'iban']),
      ],
    },
    invoiceLines: {
      label: 'Invoice Lines', labelAr: 'بنود الفواتير', pk: null,
      keywords: ['invoice line', 'invoiced qty'],
      fields: [
        F('invoiceNo', 's', ['invoice no', 'invoice number'], true),
        F('itemCode', 's', ['item code', 'item'], true),
        F('qty', 'n', ['quantity', 'qty', 'invoiced qty'], true),
        F('unitPrice', 'n', ['unit price', 'price'], true),
      ],
    },
    payments: {
      label: 'Payment Register', labelAr: 'سجل المدفوعات', pk: 'paymentId',
      keywords: ['payment', 'payment id', 'payment date', 'beneficiary', 'net payment', 'دفع'],
      fields: [
        F('paymentId', 's', ['payment id', 'payment no', 'payment number', 'voucher no', 'رقم الدفعة'], true),
        F('supplierId', 's', ['supplier id', 'vendor id', 'beneficiary id'], true),
        F('invoiceNo', 's', ['invoice no', 'invoice number', 'invoice ref']),
        F('poNo', 's', ['po no', 'po number']),
        F('paymentDate', 'd', ['payment date', 'date', 'value date', 'تاريخ الدفع'], true),
        F('currency', 's', ['currency', 'العملة'], true),
        F('gross', 'n', ['gross amount', 'gross']),
        F('wht', 'n', ['withholding tax', 'wht']),
        F('net', 'n', ['net payment', 'net amount', 'amount', 'payment amount', 'المبلغ'], true),
        F('bankAccountId', 's', ['paying account', 'bank account id', 'from account', 'company account']),
        F('beneficiaryIban', 's', ['beneficiary iban', 'iban', 'to account']),
        F('method', 's', ['payment method', 'method']),
        F('batchId', 's', ['batch', 'batch id', 'payment batch']),
        F('reference', 's', ['reference', 'bank reference', 'payment reference', 'المرجع']),
        F('approvalStatus', 's', ['approval status']),
        F('executionStatus', 's', ['execution status', 'status']),
        F('createdBy', 's', ['created by', 'prepared by']),
        F('approvedBy', 's', ['approved by']),
        F('executedBy', 's', ['executed by', 'released by']),
        F('reconciledBy', 's', ['reconciled by']),
        F('urgent', 'b', ['urgent', 'emergency']),
        F('manual', 'b', ['manual', 'manual payment']),
      ],
    },
    batches: {
      label: 'Payment Batches', labelAr: 'دفعات السداد', pk: 'batchId',
      keywords: ['batch id', 'payment batch', 'cfo approval', 'treasury approval'],
      fields: [
        F('batchId', 's', ['batch id', 'batch no', 'batch'], true),
        F('createdDate', 'd', ['created date', 'date']),
        F('paymentDate', 'd', ['payment date', 'value date']),
        F('bankAccountId', 's', ['bank account', 'paying account']),
        F('currency', 's', ['currency']),
        F('createdBy', 's', ['created by']),
        F('treasuryApprovedBy', 's', ['treasury approved by', 'treasury approval']),
        F('cfoApprovedBy', 's', ['cfo approved by', 'cfo approval']),
        F('status', 's', ['status']),
      ],
    },
    bankAccounts: {
      label: 'Company Bank Accounts', labelAr: 'حسابات الشركة البنكية', pk: 'accountId',
      keywords: ['opening balance', 'available balance', 'current balance', 'minimum cash', 'رصيد'],
      fields: [
        F('accountId', 's', ['account id', 'account code', 'gl account'], true),
        F('bank', 's', ['bank', 'bank name', 'البنك'], true),
        F('accountNo', 's', ['account no', 'account number']),
        F('iban', 's', ['iban']),
        F('currency', 's', ['currency', 'العملة'], true),
        F('openingBalance', 'n', ['opening balance', 'الرصيد الافتتاحي']),
        F('currentBalance', 'n', ['current balance', 'ledger balance', 'balance']),
        F('availableBalance', 'n', ['available balance', 'الرصيد المتاح'], true),
        F('minCash', 'n', ['minimum cash', 'min balance', 'minimum balance']),
        F('asOfDate', 'd', ['as of', 'balance date', 'date']),
      ],
    },
    bankTxns: {
      label: 'Bank Statement', labelAr: 'كشف الحساب البنكي', pk: 'txnId',
      keywords: ['statement', 'debit', 'credit', 'value date', 'narrative', 'كشف حساب'],
      fields: [
        F('txnId', 's', ['transaction id', 'txn id', 'statement ref', 'id'], true),
        F('accountId', 's', ['account id', 'account', 'account no'], true),
        F('date', 'd', ['value date', 'transaction date', 'date', 'posting date'], true),
        F('debit', 'n', ['debit', 'withdrawal', 'مدين']),
        F('credit', 'n', ['credit', 'deposit', 'دائن']),
        F('amount', 'n', ['amount']),
        F('reference', 's', ['reference', 'bank reference', 'customer reference', 'المرجع']),
        F('description', 's', ['description', 'narrative', 'details', 'البيان']),
        F('counterpartyIban', 's', ['counterparty iban', 'beneficiary iban']),
      ],
    },
    fxRates: {
      label: 'FX Rates', labelAr: 'أسعار الصرف', pk: null,
      keywords: ['exchange rate', 'fx rate', 'rate date', 'سعر الصرف'],
      fields: [
        F('currency', 's', ['currency', 'from currency', 'العملة'], true),
        F('date', 'd', ['rate date', 'date'], true),
        F('rate', 'n', ['rate', 'exchange rate', 'fx rate', 'rate to egp'], true),
        F('source', 's', ['source', 'rate source']),
      ],
    },
    taxCodes: {
      label: 'Tax Configuration', labelAr: 'إعدادات الضرائب', pk: null,
      keywords: ['tax code', 'tax rate', 'rate %'],
      fields: [
        F('code', 's', ['tax code', 'code'], true),
        F('name', 's', ['tax name', 'name', 'description']),
        F('type', 's', ['tax type', 'type'], true),
        F('ratePct', 'n', ['rate', 'rate %', 'tax rate'], true),
        F('source', 's', ['source', 'authority', 'reference']),
      ],
    },
    collections: {
      label: 'Expected Collections', labelAr: 'المتحصلات المتوقعة', pk: null,
      keywords: ['expected collection', 'receipt forecast', 'inflow', 'collection'],
      fields: [
        F('date', 'd', ['expected date', 'date'], true),
        F('currency', 's', ['currency'], true),
        F('amount', 'n', ['amount', 'expected amount'], true),
        F('description', 's', ['description', 'customer', 'source']),
      ],
    },
    otherOutflows: {
      label: 'Other Cash Outflows', labelAr: 'تدفقات نقدية خارجة أخرى', pk: null,
      keywords: ['outflow', 'payroll', 'other payments'],
      fields: [
        F('date', 'd', ['date', 'expected date'], true),
        F('currency', 's', ['currency'], true),
        F('amount', 'n', ['amount'], true),
        F('description', 's', ['description', 'type']),
      ],
    },
    gl: {
      label: 'GL / AP Ledger Summary', labelAr: 'ملخص الأستاذ العام / الدائنين', pk: null,
      keywords: ['period', 'ap balance', 'purchases', 'cogs', 'cost of sales', 'ledger'],
      fields: [
        F('period', 's', ['period', 'month', 'الفترة'], true),
        F('apBalance', 'n', ['ap balance', 'ap closing balance', 'payables balance', 'رصيد الدائنين'], true),
        F('purchases', 'n', ['purchases', 'total purchases', 'المشتريات']),
        F('cogs', 'n', ['cogs', 'cost of sales', 'تكلفة المبيعات']),
        F('currency', 's', ['currency']),
      ],
    },
    disputes: {
      label: 'Disputes', labelAr: 'النزاعات', pk: 'disputeId',
      keywords: ['dispute', 'root cause', 'resolution', 'نزاع'],
      fields: [
        F('disputeId', 's', ['dispute id', 'dispute no', 'case no'], true),
        F('type', 's', ['dispute type', 'type'], true),
        F('supplierId', 's', ['supplier id', 'vendor id'], true),
        F('invoiceNo', 's', ['invoice no']),
        F('amount', 'n', ['amount', 'disputed amount']),
        F('currency', 's', ['currency']),
        F('issue', 's', ['issue', 'description']),
        F('owner', 's', ['owner', 'assigned to']),
        F('raisedDate', 'd', ['date raised', 'raised date', 'date']),
        F('targetDate', 'd', ['resolution target', 'target date']),
        F('status', 's', ['status']),
        F('rootCause', 's', ['root cause']),
        F('resolution', 's', ['resolution']),
      ],
    },
    users: {
      label: 'Users & Roles', labelAr: 'المستخدمون والأدوار', pk: 'userId',
      keywords: ['user id', 'username', 'role', 'employee'],
      fields: [
        F('userId', 's', ['user id', 'username', 'employee id', 'login'], true),
        F('name', 's', ['name', 'full name', 'employee name'], true),
        F('role', 's', ['role', 'roles'], true),
        F('department', 's', ['department']),
        F('email', 's', ['email']),
        F('phone', 's', ['phone', 'mobile']),
        F('bankIban', 's', ['employee iban', 'iban']),
        F('active', 'b', ['active', 'enabled']),
      ],
    },
    evaluations: {
      label: 'Supplier Evaluations', labelAr: 'تقييمات الموردين', pk: null,
      keywords: ['evaluation', 'responsiveness', 'reliability', 'score'],
      fields: [
        F('supplierId', 's', ['supplier id', 'vendor id'], true),
        F('period', 's', ['period', 'evaluation period']),
        F('responsiveness', 'n', ['responsiveness']),
        F('reliability', 'n', ['service reliability', 'reliability']),
        F('quality', 'n', ['quality score']),
      ],
    },
    budgets: {
      label: 'Budget', labelAr: 'الموازنة', pk: null,
      keywords: ['budget', 'budget amount', 'الموازنة'],
      fields: [
        F('costCenter', 's', ['cost center', 'department'], true),
        F('year', 's', ['year', 'fiscal year']),
        F('category', 's', ['category']),
        F('amount', 'n', ['budget', 'budget amount', 'amount'], true),
        F('currency', 's', ['currency']),
      ],
    },
    holidays: {
      label: 'Holiday Calendar', labelAr: 'تقويم العطلات', pk: null,
      keywords: ['holiday', 'عطلة'],
      fields: [F('date', 'd', ['date', 'holiday date'], true), F('name', 's', ['holiday', 'name', 'description'])],
    },
  };

  S.entityOrder = Object.keys(S.schema);

  /** Normalise a header for synonym matching */
  const nh = (h) => String(h || '').toLowerCase().replace(/[_\-./#:()]/g, ' ').replace(/\s+/g, ' ').trim();

  /** Score how well a header row fits an entity. Returns {entity, score, mapping} */
  S.classifyHeaders = (headers, fileName = '') => {
    const H = headers.map(nh);
    const fn = nh(fileName);
    const results = [];
    for (const [entity, def] of Object.entries(S.schema)) {
      const mapping = S.autoMap(H, def);
      const mapped = Object.keys(mapping).length;
      const reqFields = def.fields.filter((f) => f.req);
      const reqHit = reqFields.filter((f) => mapping[f.key] != null).length;
      let score = mapped * 2 + reqHit * 4 - (reqFields.length - reqHit) * 3;
      if (def.keywords.some((k) => fn.includes(nh(k)))) score += 6;
      if (fn.includes(nh(def.label))) score += 8;
      results.push({ entity, score, mapping, reqHit, reqTotal: reqFields.length, mapped });
    }
    results.sort((a, b) => b.score - a.score);
    const best = results[0];
    const confidence = best.reqTotal ? best.reqHit / best.reqTotal : 0;
    return { ...best, confidence, alternatives: results.slice(1, 4) };
  };

  /** Map normalised headers to entity fields. Exact synonym > contains. Each header used once. */
  S.autoMap = (H, def) => {
    const mapping = {};
    const used = new Set();
    const pass = (exact) => {
      for (const f of def.fields) {
        if (mapping[f.key] != null) continue;
        const syns = [nh(f.key.replace(/([A-Z])/g, ' $1')), ...f.syn.map(nh)];
        for (let i = 0; i < H.length; i++) {
          if (used.has(i) || !H[i]) continue;
          const ok = exact ? syns.includes(H[i]) : syns.some((s) => s.length > 3 && (H[i] === s || H[i].startsWith(s + ' ') || H[i].endsWith(' ' + s)));
          if (ok) { mapping[f.key] = i; used.add(i); break; }
        }
      }
    };
    pass(true);
    pass(false);
    return mapping;
  };
})(typeof window !== 'undefined' ? window : globalThis);
