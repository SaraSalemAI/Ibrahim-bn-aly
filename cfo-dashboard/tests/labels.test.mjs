// Label mapping on real statement wording (English IFRS / local practice, Egyptian and Gulf Arabic).
// Run: node --test cfo-dashboard/tests/labels.test.mjs   (no install needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

vm.runInThisContext(readFileSync(fileURLToPath(new URL('../js/catalog.js', import.meta.url)), 'utf8'), { filename: 'catalog.js' });
const CFO = globalThis.CFO;

const cases = [
 // English IFRS / US GAAP / local practice
 ['Revenue from contracts with customers','revenue'],['Sales revenue','revenue'],['Operating revenues','revenue'],['Turnover','revenue'],['Net sales revenue','revenue'],['Total operating revenue','revenue'],['Revenues, net','revenue'],
 ['Cost of revenues','cogs'],['Cost of goods sold','cogs'],['Cost of sales and services rendered','cogs'],['Direct cost','cogs'],['Cost of operations','cogs'],
 ['Gross profit','gross_profit'],['Gross income','gross_profit'],['Gross (loss)/profit','gross_profit'],
 ['Selling and distribution expenses','opex'],['General and administrative expenses','opex'],['Selling, general & administrative','opex'],['Operating expenses','opex'],['Administrative expenses','opex'],
 ['Depreciation and amortisation','dna'],['Depreciation of property, plant and equipment','dna'],['Depreciation expense','dna'],
 ['Operating profit','operating_income'],['Profit from operations','operating_income'],['Operating income (loss)','operating_income'],['Results from operating activities','operating_income'],['EBIT','operating_income'],
 ['Finance costs','interest'],['Finance cost','interest'],['Interest expense','interest'],['Finance expenses','interest'],['Borrowing costs','interest'],
 ['Profit before tax','pretax_income'],['Profit before income tax','pretax_income'],['Income before income taxes','pretax_income'],['Profit before zakat and income tax','pretax_income'],
 ['Income tax expense','tax'],['Income tax','tax'],['Zakat and income tax','tax'],['Tax expense','tax'],['Current income tax','tax'],
 ['Profit for the year','net_income'],['Net profit for the year','net_income'],['Net income','net_income'],['Profit for the period','net_income'],['Net profit attributable to equity holders of the parent','net_income'],['Profit after tax','net_income'],
 ['Cash and cash equivalents','cash'],['Cash and bank balances','cash'],['Cash at banks and on hand','cash'],['Cash','cash'],
 ['Trade receivables','receivables'],['Accounts receivable, net','receivables'],['Trade and other receivables','receivables'],['Customers','receivables'],['Debtors','receivables'],['Trade receivables and notes receivable','receivables'],
 ['Inventories','inventory'],['Inventory','inventory'],['Stock in trade','inventory'],
 ['Total current assets','current_assets'],['Current assets','current_assets'],
 ['Property, plant and equipment','ppe'],['Property and equipment, net','ppe'],['Fixed assets','ppe'],
 ['Total assets','total_assets'],['TOTAL ASSETS','total_assets'],
 ['Trade payables','payables'],['Accounts payable','payables'],['Trade and other payables','payables'],['Suppliers','payables'],['Creditors','payables'],
 ['Short-term borrowings','short_debt'],['Bank overdraft','short_debt'],['Current portion of long-term loans','short_debt'],['Short-term loans','short_debt'],['Banks - credit facilities','short_debt'],
 ['Total current liabilities','current_liabilities'],['Current liabilities','current_liabilities'],
 ['Long-term loans','long_debt'],['Long-term borrowings','long_debt'],['Non-current borrowings','long_debt'],['Loans and borrowings - non-current','long_debt'],
 ['Total liabilities','total_liabilities'],['TOTAL LIABILITIES','total_liabilities'],
 ['Retained earnings','retained_earnings'],['Accumulated losses','retained_earnings'],['Retained earnings / (accumulated losses)','retained_earnings'],
 ['Total equity','equity'],["Total shareholders' equity",'equity'],['Equity attributable to owners of the parent','equity'],["Total stockholders' equity",'equity'],['Net assets','equity'],
 ['Net cash generated from operating activities','cfo'],['Net cash from operating activities','cfo'],['Net cash (used in)/generated from operating activities','cfo'],['Cash generated from operations','cfo'],
 ['Purchase of property, plant and equipment','capex'],['Acquisition of property, plant and equipment','capex'],['Payments for property, plant and equipment','capex'],['Capital expenditure','capex'],
 ['Net cash used in investing activities','cfi'],['Net cash flows from investing activities','cfi'],
 ['Net cash from financing activities','cff'],['Net cash (used in)/from financing activities','cff'],
 ['Dividends paid','dividends'],['Dividends paid to shareholders','dividends'],
 // not items
 ['Total liabilities and equity',null],['Other income',null],['Earnings per share',null],['Basic and diluted earnings per share',null],['Deferred tax liabilities',null],['Right-of-use assets',null],['Change in inventories',null],['Cash and cash equivalents at the beginning of the year',null],['Share capital',null],['Statutory reserve',null],['Other comprehensive income',null],
 // Arabic (Egypt, Gulf)
 ['صافي المبيعات','revenue'],['الإيرادات','revenue'],['إيرادات النشاط','revenue'],['إيرادات من العقود مع العملاء','revenue'],['المبيعات','revenue'],['إجمالي الإيرادات','revenue'],
 ['تكلفة المبيعات','cogs'],['تكلفة الإيرادات','cogs'],['تكاليف النشاط','cogs'],
 ['مجمل الربح','gross_profit'],['مجمل الربح / (الخسارة)','gross_profit'],
 ['مصروفات بيع وتوزيع','opex'],['مصروفات عمومية وإدارية','opex'],['المصروفات الإدارية والعمومية','opex'],['مصروفات البيع والتسويق','opex'],
 ['الإهلاك والاستهلاك','dna'],['إهلاك الأصول الثابتة','dna'],
 ['الربح من التشغيل','operating_income'],['أرباح التشغيل','operating_income'],['الربح التشغيلي','operating_income'],['ربح النشاط','operating_income'],
 ['تكاليف التمويل','interest'],['مصروفات تمويلية','interest'],['فوائد مدينة','interest'],['أعباء تمويلية','interest'],
 ['صافي الربح قبل الضرائب','pretax_income'],['الربح قبل الزكاة وضريبة الدخل','pretax_income'],['صافي الأرباح قبل ضرائب الدخل','pretax_income'],
 ['ضريبة الدخل','tax'],['الزكاة وضريبة الدخل','tax'],['ضرائب الدخل','tax'],
 ['صافي ربح العام','net_income'],['صافي ربح السنة','net_income'],['صافي الربح','net_income'],['ربح الفترة','net_income'],['صافي أرباح الفترة','net_income'],['صافي الربح بعد الضرائب','net_income'],
 ['النقدية بالصندوق ولدى البنوك','cash'],['النقد وما في حكمه','cash'],['نقدية وأرصدة لدى البنوك','cash'],['النقدية وما في حكمها','cash'],
 ['العملاء وأوراق القبض','receivables'],['مدينون وأرصدة مدينة أخرى','receivables'],['ذمم مدينة تجارية','receivables'],['العملاء','receivables'],
 ['المخزون','inventory'],['مخزون','inventory'],
 ['مجموع الأصول المتداولة','current_assets'],['إجمالي الأصول المتداولة','current_assets'],['الأصول المتداولة','current_assets'],
 ['الأصول الثابتة (بالصافي)','ppe'],['ممتلكات وآلات ومعدات','ppe'],['صافي الأصول الثابتة','ppe'],
 ['إجمالي الأصول','total_assets'],['مجموع الأصول','total_assets'],['إجمالي الموجودات','total_assets'],
 ['الموردون وأوراق الدفع','payables'],['دائنون وأرصدة دائنة أخرى','payables'],['ذمم دائنة تجارية','payables'],['الموردين','payables'],
 ['بنوك - تسهيلات ائتمانية','short_debt'],['قروض قصيرة الأجل','short_debt'],['الجزء المتداول من القروض طويلة الأجل','short_debt'],['بنوك سحب على المكشوف','short_debt'],
 ['مجموع الالتزامات المتداولة','current_liabilities'],['إجمالي الالتزامات المتداولة','current_liabilities'],['الخصوم المتداولة','current_liabilities'],['المطلوبات المتداولة','current_liabilities'],
 ['قروض طويلة الأجل','long_debt'],['قروض وتسهيلات طويلة الأجل','long_debt'],
 ['إجمالي الالتزامات','total_liabilities'],['مجموع الالتزامات','total_liabilities'],['إجمالي المطلوبات','total_liabilities'],
 ['الأرباح المرحلة','retained_earnings'],['أرباح مبقاة','retained_earnings'],['الأرباح المحتجزة','retained_earnings'],['خسائر متراكمة','retained_earnings'],
 ['إجمالي حقوق الملكية','equity'],['مجموع حقوق الملكية','equity'],['حقوق المساهمين','equity'],['إجمالي حقوق المساهمين','equity'],
 ['صافي التدفقات النقدية من الأنشطة التشغيلية','cfo'],['صافي النقدية الناتجة من أنشطة التشغيل','cfo'],['صافي التدفقات النقدية الناتجة من أنشطة التشغيل','cfo'],
 ['مدفوعات لشراء أصول ثابتة','capex'],['شراء ممتلكات وآلات ومعدات','capex'],['مدفوعات لاقتناء أصول ثابتة','capex'],
 ['صافي التدفقات النقدية من الأنشطة الاستثمارية','cfi'],['صافي النقدية المستخدمة في أنشطة الاستثمار','cfi'],
 ['صافي التدفقات النقدية من الأنشطة التمويلية','cff'],['صافي النقدية من أنشطة التمويل','cff'],
 ['توزيعات أرباح مدفوعة','dividends'],['توزيعات الأرباح المدفوعة','dividends'],
 // Found in code review: must not be taken for the main item
 ['Total non-current assets',null],['Total non-current liabilities',null],['Accumulated depreciation',null],['Income tax payable',null],['مجمع الإهلاك',null],
 ['إيرادات تمويلية',null],['إجمالي الالتزامات غير المتداولة',null],['Other operating income',null],['Other receivables',null],['Prepayments and other receivables',null],
 ['Accrued expenses and other payables',null],['Non-current portion of long-term loans','long_debt'],['Cash dividends','dividends'],['Cash paid to suppliers and employees',null],
 ['Cash receipts from customers',null],['Interest payable',null],['Notes payable',null],['Lease payables',null],['Total comprehensive income for the year',null],
 ['Net income attributable to non-controlling interests',null],['Trade payables and notes payable','payables'],
 ['إجمالي الالتزامات وحقوق الملكية',null],['رأس المال المصدر والمدفوع',null],['احتياطي قانوني',null],['نصيب السهم في الأرباح',null],['التغير في المخزون',null],['النقدية في أول العام',null],['إيرادات أخرى',null],
];

test(`${cases.length} real-world labels map to the right item (or to nothing)`, () => {
  const wrong = cases.filter(([l, k]) => CFO.matchLabel(l) !== k).map(([l, k]) => `${l} -> ${CFO.matchLabel(l)} (want ${k})`);
  assert.deepEqual(wrong, []);
});
