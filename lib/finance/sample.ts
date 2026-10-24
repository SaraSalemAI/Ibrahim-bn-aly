import { TEMPLATE_HEADER } from "./parse";

/** Illustrative trial balance for a fictional Egyptian trading company (EGP). Not real data. */
export const SAMPLE_TB_CSV = `${TEMPLATE_HEADER}
1101,Cash at banks - النقدية بالبنوك,CASH,4200000,0,5081500,0
1201,Trade receivables - العملاء,RECEIVABLES,6800000,0,5200000,0
1301,Inventory - المخزون,INVENTORY,5400000,0,4900000,0
1401,Prepayments and other debit balances - مصروفات مدفوعة مقدما,OTHER_CURRENT_ASSET,900000,0,750000,0
1501,"Property, plant and equipment - الأصول الثابتة",PPE,12000000,0,10500000,0
1502,Accumulated depreciation - مجمع الإهلاك,ACCUM_DEPRECIATION,0,3600000,0,2700000
2101,Trade payables - الموردون,PAYABLES,0,4100000,0,3600000
2201,Short-term bank facilities - تسهيلات بنكية قصيرة الأجل,SHORT_TERM_DEBT,0,2500000,0,2000000
2301,Accrued expenses and tax payable - مصروفات مستحقة,OTHER_CURRENT_LIABILITY,0,1150000,0,900000
2401,Long-term loans - قروض طويلة الأجل,LONG_TERM_DEBT,0,5000000,0,5500000
3101,Share capital - رأس المال,SHARE_CAPITAL,0,8000000,0,8000000
3201,Legal reserve - الاحتياطي القانوني,LEGAL_RESERVE,0,600000,0,450000
3301,Retained earnings - الأرباح المرحلة,RETAINED_EARNINGS,0,1482500,0,600000
4101,Revenue - المبيعات,REVENUE,0,38000000,0,31000000
5101,Cost of sales - تكلفة المبيعات,COGS,26600000,0,21080000,0
6101,Selling and distribution expenses - مصروفات بيع وتوزيع,SELLING_EXPENSE,3040000,0,2480000,0
6201,General and administrative expenses - مصروفات عمومية وإدارية,ADMIN_EXPENSE,2660000,0,2325000,0
6301,Depreciation expense - الإهلاك,DEPRECIATION,900000,0,800000,0
7101,Finance costs - مصروفات تمويلية,FINANCE_COST,1250000,0,980000,0
7201,Other income - إيرادات أخرى,OTHER_INCOME,0,150000,0,125000
8101,Income tax expense - ضريبة الدخل,TAX_EXPENSE,832500,0,778500,0
`;
