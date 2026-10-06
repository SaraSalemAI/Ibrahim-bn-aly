import type { DatasetType, L } from './types';

export interface FieldDef {
  key: string;
  label: L;
  /** Header synonyms (normalized, lowercase, EN + AR) used for automatic mapping */
  syn: string[];
  kind: 'text' | 'number' | 'date' | 'bool';
  /** Sensitive fields are masked in the UI */
  sensitive?: boolean;
}

export interface DatasetDef {
  type: DatasetType;
  code: string;
  label: L;
  fields: FieldDef[];
  /** Minimum fields for the dataset to be usable */
  required: string[];
}

const f = (key: string, en: string, ar: string, kind: FieldDef['kind'], syn: string[], sensitive = false): FieldDef =>
  ({ key, label: { en, ar }, kind, syn, sensitive });

// Shared field definitions
const AMOUNT = f('amount', 'Amount', 'المبلغ', 'number', ['amount', 'value', 'total', 'invoice amount', 'net amount', 'gross amount', 'amt', 'المبلغ', 'القيمة', 'الاجمالي']);
const CURRENCY = f('currency', 'Currency', 'العملة', 'text', ['currency', 'curr', 'ccy', 'currency code', 'العملة']);
const EGP = f('egp', 'EGP Equivalent', 'المعادل بالجنيه', 'number', ['egp equivalent', 'egp amount', 'amount egp', 'local amount', 'base amount', 'amount lc', 'المعادل بالجنيه', 'المبلغ بالجنيه']);
const COST_CENTER = f('costCenter', 'Cost Center', 'مركز التكلفة', 'text', ['cost center', 'cost centre', 'cc', 'costcenter', 'مركز التكلفة']);
const DEPARTMENT = f('department', 'Department', 'الإدارة', 'text', ['department', 'dept', 'division', 'الادارة', 'القسم', 'الإدارة']);
const DESCRIPTION = f('description', 'Description', 'البيان', 'text', ['description', 'desc', 'narration', 'memo', 'details', 'line description', 'البيان', 'الوصف']);
const APPROVAL = f('approval', 'Approval Status', 'حالة الاعتماد', 'text', ['approval status', 'approval', 'approved', 'status approval', 'approver status', 'حالة الاعتماد', 'الاعتماد']);
const VENDOR = f('vendor', 'Vendor', 'المورد', 'text', ['vendor', 'vendor name', 'supplier', 'supplier name', 'payee', 'vendor id', 'supplier id', 'المورد', 'اسم المورد']);
const CUSTOMER = f('customer', 'Customer', 'العميل', 'text', ['customer', 'customer name', 'client', 'customer id', 'العميل', 'اسم العميل']);
const ACCOUNT = f('account', 'Account Code', 'رمز الحساب', 'text', ['account code', 'account', 'gl account', 'account no', 'account number', 'acct', 'gl code', 'رقم الحساب', 'رمز الحساب', 'الحساب']);
const ACCOUNT_NAME = f('accountName', 'Account Name', 'اسم الحساب', 'text', ['account name', 'account description', 'gl name', 'اسم الحساب']);
const SITE = f('site', 'Site', 'الموقع / الفرع', 'text', ['site', 'site name', 'location site', 'branch', 'plant', 'terminal', 'station', 'الموقع', 'الفرع', 'المحطة', 'الميناء', 'location']);
const REFERENCE = f('reference', 'Reference', 'المرجع', 'text', ['reference', 'ref', 'ref no', 'reference number', 'المرجع']);

export const DATASETS: DatasetDef[] = [
  {
    type: 'company', code: 'A', label: { en: 'Company Master', ar: 'البيانات الرئيسية للشركة' },
    required: ['entity'],
    fields: [
      f('entity', 'Legal Entity', 'الكيان القانوني', 'text', ['legal entity', 'entity', 'company', 'company name', 'الشركة', 'الكيان']),
      f('branch', 'Branch', 'الفرع', 'text', ['branch', 'location', 'site', 'الفرع', 'الموقع']),
      DEPARTMENT, COST_CENTER,
      f('profitCenter', 'Profit Center', 'مركز الربحية', 'text', ['profit center', 'profit centre', 'مركز الربحية']),
      f('businessUnit', 'Business Unit', 'وحدة الأعمال', 'text', ['business unit', 'bu', 'وحدة الاعمال']),
      f('fiscalYear', 'Fiscal Year', 'السنة المالية', 'text', ['fiscal year', 'fy', 'السنة المالية']),
      CURRENCY,
    ],
  },
  {
    type: 'coa', code: 'B', label: { en: 'Chart of Accounts', ar: 'دليل الحسابات' },
    required: ['account', 'accountName'],
    fields: [
      ACCOUNT, ACCOUNT_NAME,
      f('accountType', 'Account Type', 'نوع الحساب', 'text', ['account type', 'type', 'نوع الحساب']),
      f('parent', 'Parent Account', 'الحساب الرئيسي', 'text', ['parent account', 'parent', 'الحساب الرئيسي']),
      f('fsClass', 'FS Classification', 'تصنيف القوائم المالية', 'text', ['fs classification', 'financial statement', 'fs line', 'fs class', 'classification', 'statement line', 'تصنيف القوائم المالية', 'البند']),
      COST_CENTER, DEPARTMENT, CURRENCY,
      f('active', 'Active Status', 'حالة النشاط', 'text', ['active', 'status', 'active status', 'الحالة']),
    ],
  },
  {
    type: 'gl', code: 'C', label: { en: 'General Ledger', ar: 'دفتر الأستاذ العام' },
    required: ['journalId', 'date', 'account'],
    fields: [
      SITE,
      f('journalId', 'Journal ID', 'رقم القيد', 'text', ['journal id', 'journal', 'je id', 'je number', 'journal number', 'entry id', 'voucher', 'voucher no', 'رقم القيد', 'القيد']),
      f('date', 'Journal Date', 'تاريخ القيد', 'date', ['journal date', 'date', 'entry date', 'transaction date', 'je date', 'تاريخ القيد', 'التاريخ']),
      f('postingDate', 'Posting Date', 'تاريخ الترحيل', 'date', ['posting date', 'posted date', 'post date', 'تاريخ الترحيل']),
      f('docNo', 'Document Number', 'رقم المستند', 'text', ['document number', 'doc no', 'document no', 'doc number', 'رقم المستند']),
      ACCOUNT, ACCOUNT_NAME,
      f('debit', 'Debit', 'مدين', 'number', ['debit', 'dr', 'debit amount', 'مدين']),
      f('credit', 'Credit', 'دائن', 'number', ['credit', 'cr', 'credit amount', 'دائن']),
      CURRENCY, EGP, DESCRIPTION, COST_CENTER, DEPARTMENT,
      f('user', 'User', 'المستخدم', 'text', ['user', 'created by', 'posted by', 'entered by', 'user id', 'preparer', 'المستخدم', 'المعد']),
      f('time', 'Entry Time', 'وقت الإدخال', 'text', ['time', 'entry time', 'created time', 'posting time', 'timestamp', 'وقت الادخال']),
      APPROVAL,
      f('approver', 'Approver', 'المعتمد', 'text', ['approver', 'approved by', 'المعتمد']),
      f('source', 'Source Module', 'مصدر القيد', 'text', ['source module', 'source', 'module', 'je source', 'المصدر']),
      VENDOR, CUSTOMER, REFERENCE,
      f('batch', 'Batch Number', 'رقم الدفعة', 'text', ['batch number', 'batch', 'batch no', 'رقم الدفعة']),
    ],
  },
  {
    type: 'tb', code: 'D', label: { en: 'Trial Balance', ar: 'ميزان المراجعة' },
    required: ['account', 'closing'],
    fields: [
      ACCOUNT, ACCOUNT_NAME,
      f('opening', 'Opening Balance', 'الرصيد الافتتاحي', 'number', ['opening balance', 'opening', 'beginning balance', 'ob', 'الرصيد الافتتاحي']),
      f('debit', 'Debit', 'مدين', 'number', ['debit', 'period debit', 'dr', 'مدين', 'حركة مدينة']),
      f('credit', 'Credit', 'دائن', 'number', ['credit', 'period credit', 'cr', 'دائن', 'حركة دائنة']),
      f('closing', 'Closing Balance', 'الرصيد الختامي', 'number', ['closing balance', 'closing', 'ending balance', 'balance', 'cb', 'الرصيد الختامي', 'الرصيد']),
      f('prior', 'Prior Period Balance', 'رصيد الفترة السابقة', 'number', ['prior period', 'prior balance', 'prior year', 'py balance', 'comparative', 'رصيد الفترة السابقة', 'السنة السابقة']),
      f('fsClass', 'FS Classification', 'تصنيف القوائم المالية', 'text', ['fs classification', 'financial statement', 'fs line', 'classification', 'تصنيف القوائم المالية']),
      CURRENCY,
    ],
  },
  {
    type: 'ap', code: 'E', label: { en: 'Accounts Payable', ar: 'الحسابات الدائنة' },
    required: ['vendor', 'invoiceNo', 'amount'],
    fields: [
      SITE,
      VENDOR,
      f('invoiceNo', 'Invoice Number', 'رقم الفاتورة', 'text', ['invoice number', 'invoice no', 'invoice', 'inv no', 'invoice id', 'bill number', 'رقم الفاتورة']),
      f('poNo', 'PO Number', 'رقم أمر الشراء', 'text', ['po number', 'po', 'po no', 'purchase order', 'رقم امر الشراء']),
      f('grnNo', 'GRN Number', 'رقم إذن الاستلام', 'text', ['grn', 'grn number', 'goods receipt', 'receipt no', 'رقم اذن الاستلام']),
      f('invoiceDate', 'Invoice Date', 'تاريخ الفاتورة', 'date', ['invoice date', 'bill date', 'date', 'تاريخ الفاتورة']),
      f('dueDate', 'Due Date', 'تاريخ الاستحقاق', 'date', ['due date', 'تاريخ الاستحقاق']),
      AMOUNT,
      f('tax', 'Tax', 'الضريبة', 'number', ['tax', 'vat', 'tax amount', 'الضريبة']),
      CURRENCY, EGP,
      f('paymentDate', 'Payment Date', 'تاريخ السداد', 'date', ['payment date', 'paid date', 'تاريخ السداد', 'تاريخ الدفع']),
      f('paymentMethod', 'Payment Method', 'طريقة السداد', 'text', ['payment method', 'method', 'payment type', 'طريقة السداد']),
      f('urgent', 'Urgent Flag', 'دفعة عاجلة', 'text', ['urgent', 'priority', 'urgent payment', 'عاجل']),
      APPROVAL, COST_CENTER, DEPARTMENT,
      f('bankAccount', 'Vendor Bank Account', 'حساب المورد البنكي', 'text', ['bank account', 'vendor bank account', 'iban', 'account number', 'beneficiary account', 'الحساب البنكي'], true),
    ],
  },
  {
    type: 'vendors', code: 'E2', label: { en: 'Vendor Master', ar: 'البيانات الرئيسية للموردين' },
    required: ['vendor'],
    fields: [
      VENDOR,
      f('vendorId', 'Vendor ID', 'رقم المورد', 'text', ['vendor id', 'vendor code', 'supplier code', 'رقم المورد', 'كود المورد']),
      f('bankAccount', 'Bank Account', 'الحساب البنكي', 'text', ['bank account', 'iban', 'account number', 'bank account number', 'الحساب البنكي'], true),
      f('taxId', 'Tax ID', 'الرقم الضريبي', 'text', ['tax id', 'tax registration', 'tin', 'vat number', 'الرقم الضريبي'], true),
      f('address', 'Address', 'العنوان', 'text', ['address', 'العنوان'], true),
      f('phone', 'Phone', 'الهاتف', 'text', ['phone', 'telephone', 'mobile', 'الهاتف'], true),
      f('createdDate', 'Created Date', 'تاريخ الإنشاء', 'date', ['created date', 'creation date', 'date created', 'تاريخ الانشاء']),
      f('changedDate', 'Last Changed', 'تاريخ آخر تعديل', 'date', ['changed date', 'last changed', 'modified date', 'last modified', 'تاريخ التعديل']),
      f('changedBy', 'Changed By', 'عُدّل بواسطة', 'text', ['changed by', 'modified by', 'عدل بواسطة']),
      f('status', 'Status', 'الحالة', 'text', ['status', 'active', 'الحالة']),
      f('relatedParty', 'Related Party Flag', 'طرف ذو علاقة', 'text', ['related party', 'related', 'طرف ذو علاقة']),
    ],
  },
  {
    type: 'ar', code: 'F', label: { en: 'Accounts Receivable', ar: 'الحسابات المدينة' },
    required: ['customer', 'invoiceNo', 'amount'],
    fields: [
      SITE,
      CUSTOMER,
      f('invoiceNo', 'Invoice', 'رقم الفاتورة', 'text', ['invoice', 'invoice number', 'invoice no', 'رقم الفاتورة']),
      f('invoiceDate', 'Invoice Date', 'تاريخ الفاتورة', 'date', ['invoice date', 'date', 'تاريخ الفاتورة']),
      f('dueDate', 'Due Date', 'تاريخ الاستحقاق', 'date', ['due date', 'تاريخ الاستحقاق']),
      AMOUNT,
      f('collected', 'Collections', 'المحصل', 'number', ['collections', 'collected', 'amount collected', 'paid amount', 'receipts', 'المحصل']),
      f('outstanding', 'Outstanding Balance', 'الرصيد القائم', 'number', ['outstanding', 'outstanding balance', 'balance', 'open amount', 'الرصيد القائم', 'المتبقي']),
      f('aging', 'Aging (days)', 'أعمار الديون (يوم)', 'number', ['aging', 'age', 'days outstanding', 'aging days', 'اعمار الديون']),
      CURRENCY, EGP,
      f('creditTerms', 'Credit Terms (days)', 'شروط الائتمان (يوم)', 'number', ['credit terms', 'terms', 'payment terms', 'شروط الائتمان']),
      f('docType', 'Document Type', 'نوع المستند', 'text', ['document type', 'type', 'doc type', 'نوع المستند']),
    ],
  },
  {
    type: 'bank', code: 'G', label: { en: 'Bank Data', ar: 'البيانات البنكية' },
    required: ['date', 'bankAccount'],
    fields: [
      SITE,
      f('bank', 'Bank', 'البنك', 'text', ['bank', 'bank name', 'البنك']),
      f('bankAccount', 'Account Identifier', 'معرف الحساب', 'text', ['account identifier', 'account', 'account number', 'bank account', 'iban', 'رقم الحساب'], true),
      f('txnId', 'Transaction ID', 'رقم الحركة', 'text', ['transaction id', 'txn id', 'transaction', 'id', 'رقم الحركة']),
      f('date', 'Date', 'التاريخ', 'date', ['date', 'transaction date', 'booking date', 'posting date', 'التاريخ']),
      DESCRIPTION,
      f('debit', 'Debit', 'مدين', 'number', ['debit', 'withdrawal', 'dr', 'مدين', 'سحب']),
      f('credit', 'Credit', 'دائن', 'number', ['credit', 'deposit', 'cr', 'دائن', 'ايداع']),
      f('balance', 'Balance', 'الرصيد', 'number', ['balance', 'running balance', 'closing balance', 'الرصيد']),
      CURRENCY,
      f('valueDate', 'Value Date', 'تاريخ القيمة', 'date', ['value date', 'تاريخ القيمة']),
      REFERENCE,
      f('beneficiary', 'Beneficiary', 'المستفيد', 'text', ['beneficiary', 'counterparty', 'payee', 'المستفيد']),
      f('glAccount', 'GL Account', 'حساب الأستاذ', 'text', ['gl account', 'gl code', 'حساب الاستاذ']),
    ],
  },
  {
    type: 'fa', code: 'H', label: { en: 'Fixed Asset Register', ar: 'سجل الأصول الثابتة' },
    required: ['assetId', 'cost'],
    fields: [
      f('assetId', 'Asset ID', 'رقم الأصل', 'text', ['asset id', 'asset number', 'asset no', 'tag', 'asset tag', 'رقم الاصل', 'كود الاصل']),
      DESCRIPTION,
      f('category', 'Category', 'الفئة', 'text', ['category', 'asset class', 'class', 'الفئة', 'التصنيف']),
      f('acqDate', 'Acquisition Date', 'تاريخ الاقتناء', 'date', ['acquisition date', 'purchase date', 'capitalization date', 'in service date', 'تاريخ الاقتناء', 'تاريخ الشراء']),
      f('cost', 'Acquisition Cost', 'تكلفة الاقتناء', 'number', ['acquisition cost', 'cost', 'historical cost', 'gross value', 'تكلفة الاقتناء', 'التكلفة']),
      f('usefulLife', 'Useful Life (years)', 'العمر الإنتاجي (سنة)', 'number', ['useful life', 'life', 'useful life years', 'العمر الانتاجي']),
      f('residual', 'Residual Value', 'القيمة التخريدية', 'number', ['residual value', 'salvage value', 'residual', 'القيمة التخريدية']),
      f('method', 'Depreciation Method', 'طريقة الإهلاك', 'text', ['depreciation method', 'method', 'طريقة الاهلاك']),
      f('accDep', 'Accumulated Depreciation', 'مجمع الإهلاك', 'number', ['accumulated depreciation', 'acc dep', 'accum depreciation', 'مجمع الاهلاك']),
      f('periodDep', 'Period Depreciation', 'إهلاك الفترة', 'number', ['depreciation', 'period depreciation', 'depreciation expense', 'current depreciation', 'اهلاك الفترة']),
      f('nbv', 'Net Book Value', 'صافي القيمة الدفترية', 'number', ['net book value', 'nbv', 'book value', 'carrying amount', 'صافي القيمة الدفترية']),
      f('location', 'Location', 'الموقع', 'text', ['location', 'site', 'الموقع']),
      f('custodian', 'Custodian', 'أمين العهدة', 'text', ['custodian', 'responsible', 'holder', 'امين العهدة', 'المسؤول']),
      f('disposalDate', 'Disposal Date', 'تاريخ الاستبعاد', 'date', ['disposal date', 'retirement date', 'تاريخ الاستبعاد']),
      f('proceeds', 'Disposal Proceeds', 'متحصلات الاستبعاد', 'number', ['disposal proceeds', 'proceeds', 'sale proceeds', 'متحصلات البيع']),
      f('status', 'Status', 'الحالة', 'text', ['status', 'asset status', 'الحالة']),
      f('invoiceNo', 'Supporting Invoice', 'الفاتورة المؤيدة', 'text', ['invoice', 'invoice number', 'supporting invoice', 'po', 'رقم الفاتورة']),
      CURRENCY,
    ],
  },
  {
    type: 'inventory', code: 'I', label: { en: 'Inventory', ar: 'المخزون' },
    required: ['itemCode', 'quantity'],
    fields: [
      f('itemCode', 'Item Code', 'كود الصنف', 'text', ['item code', 'item', 'sku', 'material', 'item no', 'part number', 'كود الصنف', 'رقم الصنف']),
      DESCRIPTION,
      f('quantity', 'Quantity', 'الكمية', 'number', ['quantity', 'qty', 'on hand', 'quantity on hand', 'balance qty', 'الكمية', 'الرصيد']),
      f('unitCost', 'Unit Cost', 'تكلفة الوحدة', 'number', ['unit cost', 'unit price', 'cost per unit', 'avg cost', 'تكلفة الوحدة']),
      f('totalValue', 'Total Value', 'إجمالي القيمة', 'number', ['total value', 'value', 'inventory value', 'extended value', 'اجمالي القيمة', 'القيمة']),
      f('location', 'Location', 'الموقع', 'text', ['location', 'warehouse', 'store', 'المخزن', 'الموقع']),
      f('receipts', 'Receipts', 'الوارد', 'number', ['receipts', 'received', 'in', 'الوارد']),
      f('issues', 'Issues', 'المنصرف', 'number', ['issues', 'issued', 'out', 'المنصرف']),
      f('adjustments', 'Adjustments', 'التسويات', 'number', ['adjustments', 'adjustment', 'adj', 'التسويات']),
      f('countQty', 'Physical Count', 'الجرد الفعلي', 'number', ['count', 'physical count', 'counted qty', 'الجرد الفعلي']),
      f('lastMovement', 'Last Movement Date', 'تاريخ آخر حركة', 'date', ['last movement', 'last movement date', 'last issue date', 'last transaction', 'تاريخ اخر حركة']),
      f('obsolete', 'Obsolete Status', 'حالة التقادم', 'text', ['obsolete', 'obsolete status', 'obsolescence', 'راكد', 'متقادم']),
      f('writeOff', 'Write-off', 'الشطب', 'number', ['write off', 'write-off', 'written off', 'الشطب']),
    ],
  },
  {
    type: 'procurement', code: 'J', label: { en: 'Procurement', ar: 'المشتريات' },
    required: ['poNo', 'vendor', 'amount'],
    fields: [
      SITE,
      f('requisition', 'Requisition', 'طلب الشراء', 'text', ['requisition', 'pr', 'pr number', 'requisition no', 'طلب الشراء']),
      f('poNo', 'PO Number', 'رقم أمر الشراء', 'text', ['po', 'po number', 'po no', 'purchase order', 'رقم امر الشراء']),
      f('poDate', 'PO Date', 'تاريخ أمر الشراء', 'date', ['po date', 'order date', 'date', 'تاريخ امر الشراء']),
      VENDOR,
      f('buyer', 'Buyer', 'المشتري', 'text', ['buyer', 'purchaser', 'created by', 'المشتري']),
      DEPARTMENT,
      APPROVAL,
      f('approver', 'Approver', 'المعتمد', 'text', ['approver', 'approved by', 'المعتمد']),
      AMOUNT, CURRENCY, EGP,
      f('contract', 'Contract', 'العقد', 'text', ['contract', 'contract id', 'contract no', 'العقد']),
      f('invoiceNo', 'Invoice', 'الفاتورة', 'text', ['invoice', 'invoice number', 'الفاتورة']),
      f('payment', 'Payment', 'السداد', 'text', ['payment', 'payment ref', 'payment status', 'السداد']),
      f('item', 'Item', 'الصنف', 'text', ['item', 'item code', 'material', 'الصنف']),
      f('unitPrice', 'Unit Price', 'سعر الوحدة', 'number', ['unit price', 'price', 'سعر الوحدة']),
      f('sourcing', 'Sourcing Method', 'طريقة الشراء', 'text', ['sourcing', 'sourcing method', 'tender type', 'procurement method', 'طريقة الشراء']),
      f('capex', 'CAPEX/OPEX', 'رأسمالي/تشغيلي', 'text', ['capex', 'capex/opex', 'expense type', 'رأسمالي']),
      f('project', 'Project', 'المشروع', 'text', ['project', 'project id', 'المشروع']),
    ],
  },
  {
    type: 'payroll', code: 'K', label: { en: 'Payroll', ar: 'الرواتب' },
    required: ['employeeId', 'net'],
    fields: [
      SITE,
      f('employeeId', 'Employee ID', 'رقم الموظف', 'text', ['employee id', 'emp id', 'employee no', 'staff id', 'employee number', 'رقم الموظف', 'الرقم الوظيفي']),
      f('employeeName', 'Employee Name', 'اسم الموظف', 'text', ['employee name', 'name', 'staff name', 'اسم الموظف'], true),
      DEPARTMENT,
      f('gross', 'Gross Salary', 'إجمالي الراتب', 'number', ['gross salary', 'gross', 'gross pay', 'اجمالي الراتب']),
      f('deductions', 'Deductions', 'الاستقطاعات', 'number', ['deductions', 'total deductions', 'الاستقطاعات']),
      f('net', 'Net Salary', 'صافي الراتب', 'number', ['net salary', 'net', 'net pay', 'صافي الراتب']),
      f('allowances', 'Allowances', 'البدلات', 'number', ['allowances', 'allowance', 'البدلات']),
      f('overtime', 'Overtime', 'الإضافي', 'number', ['overtime', 'ot', 'overtime pay', 'الاضافي', 'العمل الاضافي']),
      f('bonus', 'Bonuses', 'المكافآت', 'number', ['bonus', 'bonuses', 'incentive', 'المكافات', 'الحوافز']),
      f('payDate', 'Payroll Date', 'تاريخ الرواتب', 'date', ['payroll date', 'pay date', 'period', 'payment date', 'تاريخ الصرف']),
      f('bankAccount', 'Bank Identifier', 'المعرف البنكي', 'text', ['bank identifier', 'bank account', 'iban', 'account number', 'الحساب البنكي'], true),
      f('status', 'Employment Status', 'الحالة الوظيفية', 'text', ['employment status', 'status', 'employee status', 'الحالة الوظيفية']),
      f('terminationDate', 'Termination Date', 'تاريخ إنهاء الخدمة', 'date', ['termination date', 'end date', 'exit date', 'تاريخ انهاء الخدمة']),
      f('nationalId', 'National ID', 'الرقم القومي', 'text', ['national id', 'national number', 'id number', 'الرقم القومي'], true),
      f('priorGross', 'Prior Gross Salary', 'الراتب السابق', 'number', ['prior gross', 'previous gross', 'prior salary', 'الراتب السابق']),
    ],
  },
  {
    type: 'budget', code: 'L', label: { en: 'Budget', ar: 'الموازنة' },
    required: ['actual'],
    fields: [
      SITE,
      f('year', 'Budget Year', 'سنة الموازنة', 'text', ['budget year', 'year', 'fiscal year', 'سنة الموازنة']),
      f('period', 'Period', 'الفترة', 'text', ['period', 'month', 'الفترة', 'الشهر']),
      DEPARTMENT, COST_CENTER, ACCOUNT,
      f('category', 'Category', 'الفئة', 'text', ['category', 'expense category', 'line item', 'الفئة', 'البند']),
      f('original', 'Original Budget', 'الموازنة الأصلية', 'number', ['original budget', 'budget', 'approved budget', 'الموازنة الاصلية', 'الموازنة']),
      f('revised', 'Revised Budget', 'الموازنة المعدلة', 'number', ['revised budget', 'revised', 'الموازنة المعدلة']),
      f('actual', 'Actual', 'الفعلي', 'number', ['actual', 'actuals', 'actual spend', 'الفعلي']),
      f('forecast', 'Forecast', 'المتوقع', 'number', ['forecast', 'outlook', 'المتوقع']),
      f('capex', 'CAPEX/OPEX', 'رأسمالي/تشغيلي', 'text', ['capex/opex', 'capex', 'type', 'نوع الانفاق']),
      f('project', 'Project', 'المشروع', 'text', ['project', 'project id', 'المشروع']),
      CURRENCY,
    ],
  },
  {
    type: 'tax', code: 'M', label: { en: 'Tax', ar: 'الضرائب' },
    required: ['taxType', 'taxAmount'],
    fields: [
      SITE,
      f('taxType', 'Tax Type', 'نوع الضريبة', 'text', ['tax type', 'type', 'نوع الضريبة']),
      f('period', 'Tax Period', 'الفترة الضريبية', 'text', ['period', 'tax period', 'month', 'الفترة']),
      f('taxable', 'Taxable Amount', 'الوعاء الضريبي', 'number', ['taxable amount', 'taxable', 'tax base', 'الوعاء الضريبي']),
      f('taxAmount', 'Tax Amount', 'قيمة الضريبة', 'number', ['tax amount', 'tax', 'amount', 'قيمة الضريبة']),
      f('rate', 'Tax Rate', 'سعر الضريبة', 'number', ['rate', 'tax rate', 'سعر الضريبة']),
      f('filingDate', 'Filing Date', 'تاريخ الإقرار', 'date', ['filing date', 'filed date', 'return date', 'تاريخ الاقرار']),
      f('filingDue', 'Filing Due Date', 'موعد الإقرار', 'date', ['filing due', 'due date', 'deadline', 'موعد الاقرار']),
      f('paymentDate', 'Payment Date', 'تاريخ السداد', 'date', ['payment date', 'paid date', 'تاريخ السداد']),
      REFERENCE,
      f('glBalance', 'GL Balance', 'رصيد الأستاذ', 'number', ['gl balance', 'ledger balance', 'رصيد الاستاذ']),
    ],
  },
  {
    type: 'loans', code: 'N', label: { en: 'Loans', ar: 'القروض' },
    required: ['lender', 'outstanding'],
    fields: [
      f('lender', 'Lender', 'المقرض', 'text', ['lender', 'bank', 'facility', 'المقرض', 'البنك']),
      f('principal', 'Principal', 'أصل القرض', 'number', ['principal', 'facility amount', 'loan amount', 'اصل القرض']),
      f('rate', 'Interest Rate', 'سعر الفائدة', 'number', ['interest rate', 'rate', 'سعر الفائدة']),
      f('maturity', 'Maturity', 'تاريخ الاستحقاق', 'date', ['maturity', 'maturity date', 'تاريخ الاستحقاق']),
      CURRENCY,
      f('interest', 'Interest Expense', 'مصروف الفوائد', 'number', ['interest expense', 'interest', 'مصروف الفوائد']),
      f('outstanding', 'Outstanding Balance', 'الرصيد القائم', 'number', ['outstanding balance', 'outstanding', 'balance', 'الرصيد القائم']),
      f('covenant', 'Covenants', 'التعهدات', 'text', ['covenants', 'covenant', 'التعهدات']),
      f('nextPayment', 'Next Repayment Date', 'تاريخ القسط التالي', 'date', ['next payment', 'next repayment', 'repayment date', 'تاريخ القسط']),
      f('installment', 'Installment', 'القسط', 'number', ['installment', 'repayment amount', 'القسط']),
    ],
  },
  {
    type: 'contracts', code: 'O', label: { en: 'Contracts', ar: 'العقود' },
    required: ['contractId', 'counterparty'],
    fields: [
      SITE,
      f('contractId', 'Contract ID', 'رقم العقد', 'text', ['contract id', 'contract no', 'contract number', 'contract', 'رقم العقد']),
      f('counterparty', 'Counterparty', 'الطرف المقابل', 'text', ['counterparty', 'vendor', 'customer', 'party', 'الطرف المقابل', 'المورد']),
      f('startDate', 'Start Date', 'تاريخ البدء', 'date', ['start date', 'effective date', 'تاريخ البدء']),
      f('endDate', 'End Date', 'تاريخ الانتهاء', 'date', ['end date', 'expiry date', 'expiry', 'تاريخ الانتهاء']),
      f('value', 'Contract Value', 'قيمة العقد', 'number', ['contract value', 'value', 'amount', 'قيمة العقد']),
      f('billed', 'Billed to Date', 'المفوتر حتى تاريخه', 'number', ['billed', 'billed to date', 'invoiced', 'spent', 'المفوتر']),
      f('paymentTerms', 'Payment Terms', 'شروط السداد', 'text', ['payment terms', 'terms', 'شروط السداد']),
      f('escalation', 'Escalation Clause', 'بند التصعيد', 'text', ['escalation', 'escalation clause', 'بند التصعيد']),
      f('renewal', 'Renewal', 'التجديد', 'text', ['renewal', 'auto renewal', 'التجديد']),
      f('termination', 'Termination', 'الإنهاء', 'text', ['termination', 'termination clause', 'الانهاء']),
      f('obligations', 'Obligations', 'الالتزامات', 'text', ['obligations', 'الالتزامات']),
      CURRENCY,
    ],
  },
  {
    type: 'related', code: 'P', label: { en: 'Related Parties', ar: 'الأطراف ذات العلاقة' },
    required: ['party'],
    fields: [
      SITE,
      f('party', 'Related Party', 'الطرف ذو العلاقة', 'text', ['related party', 'party', 'name', 'الطرف ذو العلاقة']),
      f('txnType', 'Transaction Type', 'نوع المعاملة', 'text', ['transaction type', 'type', 'نوع المعاملة']),
      AMOUNT,
      f('balance', 'Balance', 'الرصيد', 'number', ['balance', 'الرصيد']),
      APPROVAL,
      f('disclosure', 'Disclosure Status', 'حالة الإفصاح', 'text', ['disclosure status', 'disclosed', 'disclosure', 'حالة الافصاح']),
      CURRENCY,
    ],
  },
];

export const DATASET_BY_TYPE: Record<string, DatasetDef> = Object.fromEntries(DATASETS.map((d) => [d.type, d]));

export function fieldDef(type: DatasetType, key: string): FieldDef | undefined {
  return DATASET_BY_TYPE[type]?.fields.find((x) => x.key === key);
}

export function datasetLabel(type: DatasetType): L {
  if (type === 'policy') return { en: 'Policy / Supporting Document', ar: 'سياسة / مستند مؤيد' };
  if (type === 'unknown') return { en: 'Unclassified', ar: 'غير مصنف' };
  return DATASET_BY_TYPE[type]?.label ?? { en: type, ar: type };
}
