// Centralized bilingual dictionary (UI) and professional audit terminology glossary.
import type { L } from '../engine/types';

export const GLOSSARY: [string, string][] = [
  ['Internal Audit', 'المراجعة الداخلية'], ['Audit Finding', 'ملاحظة مراجعة'], ['Risk', 'مخاطر'], ['Control', 'رقابة'],
  ['Control Weakness', 'ضعف الرقابة'], ['Critical', 'حرج'], ['High', 'مرتفع'], ['Medium', 'متوسط'], ['Low', 'منخفض'],
  ['Informational', 'معلوماتي'], ['Financial Exposure', 'التعرض المالي'], ['Fraud Risk', 'مخاطر الاحتيال'], ['Fraud Risk Indicator', 'مؤشر مخاطر احتيال'],
  ['Recommendation', 'التوصية'], ['Management Action', 'إجراء الإدارة'], ['Audit Evidence', 'أدلة المراجعة'], ['Audit Trail', 'مسار المراجعة'],
  ['General Ledger', 'دفتر الأستاذ العام'], ['Trial Balance', 'ميزان المراجعة'], ['Accounts Payable', 'الحسابات الدائنة'], ['Accounts Receivable', 'الحسابات المدينة'],
  ['Fixed Assets', 'الأصول الثابتة'], ['Inventory', 'المخزون'], ['Treasury', 'الخزانة'], ['Bank Reconciliation', 'التسوية البنكية'],
  ['Budget Variance', 'انحراف الموازنة'], ['CAPEX', 'النفقات الرأسمالية'], ['OPEX', 'النفقات التشغيلية'], ['Materiality', 'الأهمية النسبية'],
  ['Performance Materiality', 'الأهمية النسبية للتنفيذ'], ['Clearly Trivial', 'الحد التافه بوضوح'], ['Segregation of Duties', 'الفصل بين المهام'],
  ['Three-way Match', 'المطابقة الثلاثية'], ['Delegation of Authority', 'جدول الصلاحيات'], ['Inherent Risk', 'المخاطر الكامنة'], ['Residual Risk', 'المخاطر المتبقية'],
  ['Likelihood', 'الاحتمالية'], ['Impact', 'الأثر'], ['Condition', 'الوضع القائم'], ['Criteria', 'المعيار'], ['Cause', 'السبب'], ['Effect', 'الأثر المترتب'],
  ['Head Office', 'المركز الرئيسي'], ['Ain Sokhna', 'السخنة'], ['Sidi Kerir', 'سيدي كرير'], ['Dahshour', 'دهشور'],
  ['Journal Entry', 'قيد يومية'], ['Vendor', 'المورد'], ['Customer', 'العميل'], ['Purchase Order', 'أمر شراء'], ['Goods Receipt Note', 'إذن استلام'],
  ['Write-off', 'إعدام / شطب'], ['Credit Note', 'إشعار دائن'], ['Depreciation', 'الإهلاك'], ['Net Book Value', 'صافي القيمة الدفترية'],
  ['Working Capital', 'رأس المال العامل'], ['Liquidity', 'السيولة'], ['Related Party', 'طرف ذو علاقة'], ['Continuous Auditing', 'المراجعة المستمرة'],
];

const D = {
  appName: ['SUMED Internal Audit Platform', 'منصة المراجعة الداخلية - سوميد'],
  company: ['Arab Petroleum Pipelines Company (SUMED) · Alexandria', 'الشركة العربية لأنابيب البترول (سوميد) · الإسكندرية'],
  // navigation
  navGroupData: ['Data', 'البيانات'], navGroupDash: ['Dashboards', 'لوحات المعلومات'], navGroupAudit: ['Audit Work', 'أعمال المراجعة'], navGroupRisk: ['Risk & Control', 'المخاطر والرقابة'], navGroupOut: ['Follow-up & Reporting', 'المتابعة والتقارير'], navGroupAdmin: ['Administration', 'الإدارة'],
  upload: ['Upload Data', 'رفع البيانات'], requirements: ['Data Requirements Center', 'مركز متطلبات البيانات'], quality: ['Data Quality', 'جودة البيانات'],
  overview: ['Executive Overview', 'النظرة التنفيذية'], cfo: ['CFO Dashboard', 'لوحة المدير المالي'], committee: ['Audit Committee', 'لجنة المراجعة'],
  findings: ['Findings', 'الملاحظات'], tests: ['Audit Testing Engine', 'محرك اختبارات المراجعة'], sites: ['Site Payments & Contracts', 'مدفوعات وعقود المواقع'], recon: ['Reconciliations', 'المطابقات'], fs: ['Financial Statements', 'القوائم المالية'], fraud: ['Fraud Risk Analytics', 'تحليلات مخاطر الاحتيال'],
  risks: ['Risk Register & Heatmap', 'سجل المخاطر والخريطة الحرارية'], controls: ['Control Library', 'مكتبة الضوابط الرقابية'], universe: ['Audit Universe & Plan', 'نطاق المراجعة والخطة'],
  recommendations: ['Recommendations', 'التوصيات'], actions: ['Management Actions', 'إجراءات الإدارة'], change: ['Audit Change Monitor', 'مراقب تغيرات المراجعة'], copilot: ['AI Audit Copilot', 'المساعد الذكي للمراجعة'], reports: ['Reports & Exports', 'التقارير والتصدير'],
  trail: ['Audit Trail', 'مسار المراجعة'], settings: ['Settings & Methodology', 'الإعدادات والمنهجية'], qc: ['Platform Quality Check', 'فحص جودة المنصة'],
  // common
  uploadToStart: ['UPLOAD YOUR DATA TO START THE AUDIT', 'ارفع بياناتك لبدء المراجعة'],
  insufficient: ['INSUFFICIENT DATA — TEST NOT PERFORMED', 'بيانات غير كافية — لم يتم تنفيذ الاختبار'],
  insufficientEvidence: ['INSUFFICIENT EVIDENCE — AUDITOR REVIEW REQUIRED', 'أدلة غير كافية — تتطلب مراجعة المراجع'],
  validationRequired: ['EVIDENCE VALIDATION REQUIRED', 'يتطلب التحقق من الأدلة'], validated: ['Evidence validated', 'تم التحقق من الأدلة'],
  showEvidence: ['SHOW EVIDENCE', 'عرض الأدلة'], review: ['REVIEW', 'مراجعة'], validate: ['VALIDATE', 'اعتماد'], assignAction: ['ASSIGN ACTION', 'تكليف بإجراء'], exportEvidence: ['EXPORT EVIDENCE', 'تصدير الأدلة'],
  viewControls: ['VIEW CONTROLS', 'عرض الضوابط'], viewFindings: ['VIEW FINDINGS', 'عرض الملاحظات'], viewEvidence: ['VIEW EVIDENCE', 'عرض الأدلة'],
  assignOwner: ['ASSIGN OWNER', 'تحديد المسؤول'], setDeadline: ['SET DEADLINE', 'تحديد الموعد'], track: ['TRACK', 'متابعة'],
  close: ['Close', 'إغلاق'], save: ['Save', 'حفظ'], cancel: ['Cancel', 'إلغاء'], delete: ['Delete', 'حذف'], search: ['Search…', 'بحث…'], all: ['All', 'الكل'], none: ['None', 'لا يوجد'], yes: ['Yes', 'نعم'], no: ['No', 'لا'],
  filters: ['Filters', 'المرشحات'], clearFilters: ['Clear filters', 'مسح المرشحات'], dateFrom: ['From', 'من'], dateTo: ['To', 'إلى'], department: ['Department', 'الإدارة'], costCenter: ['Cost center', 'مركز التكلفة'], site: ['Site', 'الموقع'], currency: ['Currency', 'العملة'], party: ['Vendor / customer', 'المورد / العميل'], account: ['Account', 'الحساب'], area: ['Audit area', 'مجال المراجعة'], riskLevel: ['Risk level', 'مستوى المخاطر'], status: ['Status', 'الحالة'],
  role: ['Role', 'الدور'], user: ['User', 'المستخدم'], theme: ['Theme', 'المظهر'], light: ['Light', 'فاتح'], dark: ['Dark', 'داكن'],
  critical: ['Critical', 'حرج'], high: ['High', 'مرتفع'], medium: ['Medium', 'متوسط'], low: ['Low', 'منخفض'], info: ['Informational', 'معلوماتي'], na: ['Not assessed', 'لم يُقيّم'],
  // KPI & dashboards
  dqScore: ['Data Quality Score', 'مؤشر جودة البيانات'], completeness: ['Completeness', 'الاكتمال'], duplicates: ['Duplicates', 'التكرار'], invalidRecords: ['Invalid records', 'سجلات غير صالحة'], missingFields: ['Missing fields', 'حقول مفقودة'], unmappedAccounts: ['Unmapped accounts', 'حسابات غير مرتبطة'], unbalancedJournals: ['Unbalanced journals', 'قيود غير متوازنة'], currencyIssues: ['Currency inconsistencies', 'عدم اتساق العملات'], dateAnomalies: ['Date anomalies', 'تواريخ غير منطقية'], negativeBalances: ['Negative balances', 'أرصدة سالبة'], outliers: ['Outliers', 'قيم شاذة'],
  overallRisk: ['Overall risk', 'المخاطر الإجمالية'], criticalFindings: ['Critical findings', 'ملاحظات حرجة'], highFindings: ['High findings', 'ملاحظات مرتفعة'], openFindings: ['Open findings', 'ملاحظات مفتوحة'], exposure: ['Financial exposure', 'التعرض المالي'], fraudIndicators: ['Fraud risk indicators', 'مؤشرات مخاطر الاحتيال'], controlEffectiveness: ['Control effectiveness', 'فعالية الرقابة'], overdueActions: ['Overdue actions', 'إجراءات متأخرة'], testsPerformed: ['Tests performed', 'الاختبارات المنفذة'], planProgress: ['Audit plan progress', 'تقدم خطة المراجعة'], emergingRisks: ['Emerging risks', 'المخاطر الناشئة'],
  topRisks: ['TOP 10 RISKS', 'أهم 10 مخاطر'], topFindings: ['TOP 10 FINDINGS', 'أهم 10 ملاحظات'], topRecs: ['TOP 10 RECOMMENDATIONS', 'أهم 10 توصيات'], topCfoActions: ['TOP 10 CFO ACTIONS', 'أهم 10 إجراءات للمدير المالي'], auditPriorities: ['TOP 10 AUDIT PRIORITIES', 'أهم 10 أولويات للمراجعة'], topExposures: ['TOP FINANCIAL EXPOSURES', 'أكبر التعرضات المالية'], controlWeaknesses: ['TOP CONTROL WEAKNESSES', 'أكبر نقاط ضعف الرقابة'], topFraud: ['TOP FRAUD RISK INDICATORS', 'أهم مؤشرات مخاطر الاحتيال'],
  cfoRisks: ['TOP CFO RISKS', 'أهم مخاطر المدير المالي'], cfoExceptions: ['TOP FINANCIAL EXCEPTIONS', 'أهم الاستثناءات المالية'],
  cash: ['Cash', 'النقدية'], liquidity: ['Liquidity', 'السيولة'], workingCapital: ['Working capital', 'رأس المال العامل'], ar: ['Receivables', 'المدينون'], ap: ['Payables', 'الدائنون'], debt: ['Debt', 'الديون'], fxExposure: ['FX exposure', 'التعرض لأسعار الصرف'], capex: ['CAPEX', 'النفقات الرأسمالية'], opex: ['OPEX', 'النفقات التشغيلية'], budgetVariance: ['Budget variance', 'انحراف الموازنة'], financialRisk: ['Financial risk', 'المخاطر المالية'], controlFailures: ['Control failures', 'إخفاقات الرقابة'],
  heatmap: ['Impact × Likelihood Risk Heatmap', 'خريطة المخاطر (الأثر × الاحتمالية)'], likelihood: ['Likelihood', 'الاحتمالية'], impact: ['Impact', 'الأثر'],
  // finding fields
  findingId: ['Finding ID', 'رقم الملاحظة'], condition: ['Condition', 'الوضع القائم'], criteria: ['Criteria', 'المعيار'], cause: ['Cause', 'السبب'], effect: ['Effect', 'الأثر المترتب'], rating: ['Risk rating', 'تصنيف المخاطر'], financialImpact: ['Financial impact', 'الأثر المالي'], controlImpact: ['Control impact', 'الأثر الرقابي'], evidence: ['Evidence', 'الأدلة'], recommendation: ['Recommendation', 'التوصية'], managementAction: ['Management action', 'إجراء الإدارة'], owner: ['Owner', 'المسؤول'], dueDate: ['Due date', 'تاريخ الاستحقاق'], confidence: ['AI confidence', 'ثقة الذكاء الاصطناعي'], exceptions: ['Exceptions', 'الاستثناءات'], population: ['Population', 'المجتمع'],
  sourceData: ['SOURCE DATA', 'بيانات المصدر'], calculation: ['CALCULATION', 'الاحتساب'], aiInterpretation: ['AI INTERPRETATION', 'تفسير الذكاء الاصطناعي'], riskAssessment: ['RISK ASSESSMENT', 'تقييم المخاطر'], assumption: ['ASSUMPTION', 'افتراض'], whyFlagged: ['WHY THIS WAS FLAGGED', 'سبب الرصد'], source: ['SOURCE', 'المصدر'],
  // evidence chain
  chainFinding: ['Finding', 'الملاحظة'], chainTest: ['Audit test / rule', 'اختبار / قاعدة المراجعة'], chainCalc: ['Calculation', 'الاحتساب'], chainTxn: ['Transaction', 'المعاملة'], chainRecord: ['Source record', 'السجل المصدري'], chainFile: ['Source file', 'الملف المصدر'], chainSheet: ['Sheet / table', 'الورقة / الجدول'], chainRow: ['Source row', 'السطر المصدري'],
  evidenceViewer: ['Evidence Traceability Panel', 'لوحة تتبع الأدلة'], originalValue: ['Original value', 'القيمة الأصلية'], translatedValue: ['Translated value', 'القيمة المترجمة'], highlighted: ['Highlighted fields caused the alert', 'الحقول المظللة هي سبب التنبيه'], fileHash: ['SHA-256 of uploaded file', 'بصمة SHA-256 للملف'], evidenceChecks: ['Evidence validation', 'التحقق من الأدلة'], auditorNotes: ['Auditor notes', 'ملاحظات المراجع'], exceptionOf: ['Exception', 'استثناء'],
  // upload
  dropHere: ['Drag & drop files here, or click to browse', 'اسحب الملفات وأفلتها هنا أو انقر للاختيار'], supported: ['Excel (.xlsx), CSV, PDF (text-based), Word (.docx), TXT — multiple files, sheets and periods. Historical uploads are kept.', 'إكسل و CSV و PDF (نصي) و Word و TXT — ملفات وأوراق وفترات متعددة. يتم الاحتفاظ بالبيانات السابقة.'], periodLabel: ['Period label (optional)', 'وصف الفترة (اختياري)'], processing: ['Processing…', 'جارٍ المعالجة…'], files: ['Uploaded files', 'الملفات المرفوعة'], sheets: ['Sheets / tables', 'الأوراق / الجداول'], rows: ['Rows', 'السطور'], classification: ['Classification', 'التصنيف'], mapping: ['Field mapping', 'ربط الحقول'], headerRow: ['Header row', 'سطر العناوين'], unmapped: ['— not mapped —', '— غير مرتبط —'], removeFile: ['Remove file', 'إزالة الملف'], textOnly: ['Text document — stored as supporting / policy evidence', 'مستند نصي — محفوظ كدليل مؤيد / سياسة'],
  // misc
  notConfigured: ['Not configured', 'غير محدد'], unassigned: ['Unassigned', 'غير محدد'], noFindings: ['No findings from the uploaded data.', 'لا توجد ملاحظات من البيانات المرفوعة.'], qcBlock: ['Official audit conclusions are withheld: the Platform Quality Check reports FAIL.', 'تم حجب استنتاجات المراجعة الرسمية: فحص جودة المنصة = إخفاق.'],
  readOnly: ['Read-only access for this role', 'صلاحية قراءة فقط لهذا الدور'], noAccess: ['Your role does not have access to this module.', 'دورك لا يملك صلاحية الوصول لهذه الوحدة.'],
  masked: ['Sensitive values are masked', 'القيم الحساسة مخفية'], unmask: ['Unmask (logged)', 'إظهار (يُسجل)'],
  exportPdf: ['PDF', 'PDF'], exportXlsx: ['Excel', 'Excel'], exportCsv: ['CSV', 'CSV'], workbook: ['Full audit workbook (26 sheets)', 'مصنف المراجعة الكامل (26 ورقة)'],
  ask: ['Ask', 'اسأل'], askPlaceholder: ['Ask a question about the audit results…', 'اطرح سؤالًا عن نتائج المراجعة…'],
} satisfies Record<string, [string, string]>;

export type DictKey = keyof typeof D;
export const DICT: Record<DictKey, L> = Object.fromEntries(Object.entries(D).map(([k, [en, ar]]) => [k, { en, ar }])) as Record<DictKey, L>;

// Known source-value translations (status words etc.). Free text is never machine-translated; original is always shown.
const VALUE_TR: Record<string, string> = {
  approved: 'معتمد', pending: 'قيد الاعتماد', rejected: 'مرفوض', active: 'نشط', inactive: 'غير نشط', terminated: 'منتهي الخدمة', resigned: 'مستقيل', blocked: 'موقوف', paid: 'مسدد', unpaid: 'غير مسدد', open: 'مفتوح', closed: 'مغلق', manual: 'يدوي', draft: 'مسودة', posted: 'مرحّل', yes: 'نعم', no: 'لا', urgent: 'عاجل', obsolete: 'متقادم', disclosed: 'مفصح عنه', 'not disclosed': 'غير مفصح عنه',
  'head office': 'المركز الرئيسي', 'ain sokhna': 'السخنة', sokhna: 'السخنة', 'sidi kerir': 'سيدي كرير', kerir: 'كرير', dahshour: 'دهشور', 'straight line': 'القسط الثابت', 'credit note': 'إشعار دائن', invoice: 'فاتورة', 'write-off': 'إعدام',
};
export function translateValue(v: string, lang: 'en' | 'ar'): string | null {
  if (lang !== 'ar' || !v) return null;
  const k = v.trim().toLowerCase();
  return VALUE_TR[k] ?? null;
}

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة', 'under-review': 'قيد المراجعة', validated: 'معتمدة من المراجع', official: 'رسمية', closed: 'مغلقة', dismissed: 'مستبعدة',
  open: 'مفتوح', 'in-progress': 'قيد التنفيذ', implemented: 'تم التنفيذ', 'pending-validation': 'بانتظار التحقق', overdue: 'متأخر',
  monitored: 'تحت المراقبة', mitigating: 'قيد المعالجة', accepted: 'مقبولة', 'not-assessed': 'لم تُقيّم', 'not-assigned': 'غير مسند',
  immediate: 'فوري', short: 'قصير الأجل', medium: 'متوسط الأجل', long: 'طويل الأجل', high: 'مرتفعة', low: 'منخفضة',
  Low: 'منخفض', Medium: 'متوسط', High: 'مرتفع', 'Tested': 'تم الاختبار', 'Partially tested': 'مختبر جزئيًا', 'Awaiting data': 'بانتظار البيانات',
  Planned: 'مخطط', Fieldwork: 'العمل الميداني', Reporting: 'إعداد التقرير', Completed: 'مكتمل', Deferred: 'مؤجل',
};
const STATUS_EN: Record<string, string> = { immediate: 'Immediate', short: 'Short-term', medium: 'Medium-term', long: 'Long-term', 'not-assigned': 'Not assigned' };
/** Display label for workflow statuses and priorities (stored values stay in English). */
export function statusLabel(s: string, lang: 'en' | 'ar'): string {
  if (!s) return s;
  return lang === 'ar' ? STATUS_AR[s] ?? s : STATUS_EN[s] ?? s;
}
