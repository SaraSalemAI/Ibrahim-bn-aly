/* Standard line-item catalogue.
 * Every raw line from an uploaded statement is matched against these synonyms
 * (English + Arabic). Labels are normalised before matching (see normalize()).
 * kind: 'flow' = income/cash-flow item (period amount), 'stock' = balance-sheet item.
 * expense: true means the value is stored as a positive cost even if the file shows it negative.
 */
(function (CFO) {
  const ITEMS = [
    // ---- Income statement ----
    { key: 'revenue', st: 'IS', kind: 'flow', en: 'Revenue', ar: 'الإيرادات',
      syn: ['revenue', 'revenues', 'total revenue', 'total revenues', 'net revenue', 'net revenues', 'sales', 'net sales', 'total sales', 'turnover', 'total income from operations', 'operating revenue',
            'الايرادات', 'ايرادات', 'اجمالي الايرادات', 'صافي الايرادات', 'المبيعات', 'صافي المبيعات', 'ايرادات النشاط', 'اجمالي المبيعات'] },
    { key: 'cogs', st: 'IS', kind: 'flow', expense: true, en: 'Cost of sales', ar: 'تكلفة المبيعات',
      syn: ['cost of sales', 'cost of goods sold', 'cogs', 'cost of revenue', 'cost of revenues', 'cost of sales and services', 'direct costs',
            'تكلفه المبيعات', 'تكلفه الايرادات', 'تكلفه البضاعه المباعه', 'تكاليف النشاط', 'التكاليف المباشره'] },
    { key: 'gross_profit', st: 'IS', kind: 'flow', en: 'Gross profit', ar: 'مجمل الربح',
      syn: ['gross profit', 'gross margin', 'gross income', 'مجمل الربح', 'اجمالي الربح', 'مجمل الربح الاجمالي', 'مجمل ربح'] },
    { key: 'opex', st: 'IS', kind: 'flow', expense: true, en: 'Operating expenses (SG&A)', ar: 'المصروفات التشغيلية',
      syn: ['operating expenses', 'total operating expenses', 'selling general and administrative', 'selling general and administrative expenses', 'sg&a', 'sga', 'general and administrative expenses', 'selling and distribution expenses', 'administrative expenses',
            'المصروفات التشغيليه', 'مصروفات تشغيليه', 'المصروفات العموميه والاداريه', 'مصروفات عموميه واداريه', 'مصروفات بيع وتوزيع', 'المصروفات البيعيه والتسويقيه', 'المصاريف الاداريه والعموميه'] },
    { key: 'dna', st: 'IS', kind: 'flow', expense: true, en: 'Depreciation & amortisation', ar: 'الإهلاك والاستهلاك',
      syn: ['depreciation and amortization', 'depreciation & amortization', 'depreciation and amortisation', 'depreciation & amortisation', 'depreciation', 'd&a', 'amortization',
            'الاهلاك والاستهلاك', 'الاهلاك', 'اهلاك', 'الاستهلاك', 'اهلاكات', 'الاهلاكات والاستهلاكات'] },
    { key: 'operating_income', st: 'IS', kind: 'flow', en: 'Operating income (EBIT)', ar: 'الربح التشغيلي',
      syn: ['operating income', 'operating profit', 'income from operations', 'profit from operations', 'ebit', 'operating profit loss',
            'الربح التشغيلي', 'ربح التشغيل', 'الارباح التشغيليه', 'ربح النشاط', 'صافي ربح التشغيل', 'الدخل التشغيلي'] },
    { key: 'interest', st: 'IS', kind: 'flow', expense: true, en: 'Interest expense', ar: 'مصروف الفوائد',
      syn: ['interest expense', 'finance costs', 'finance cost', 'financing costs', 'interest expenses', 'net interest expense', 'interest paid',
            'مصروف الفوائد', 'مصروفات الفوائد', 'فوائد مدينه', 'تكاليف التمويل', 'تكلفه التمويل', 'مصروفات تمويليه', 'اعباء تمويليه'] },
    { key: 'pretax_income', st: 'IS', kind: 'flow', en: 'Profit before tax', ar: 'الربح قبل الضريبة',
      syn: ['profit before tax', 'income before tax', 'income before taxes', 'pretax income', 'pre-tax income', 'earnings before tax', 'profit before income tax', 'income before income taxes',
            'الربح قبل الضريبه', 'صافي الربح قبل الضريبه', 'الربح قبل الضرائب', 'صافي الربح قبل الضرائب', 'الدخل قبل الضريبه'] },
    { key: 'tax', st: 'IS', kind: 'flow', expense: true, en: 'Income tax', ar: 'ضريبة الدخل',
      syn: ['income tax', 'income tax expense', 'tax expense', 'income taxes', 'provision for income taxes', 'taxation',
            'ضريبه الدخل', 'الضريبه', 'مصروف الضريبه', 'ضرائب الدخل', 'الضرائب'] },
    { key: 'net_income', st: 'IS', kind: 'flow', en: 'Net income', ar: 'صافي الربح',
      syn: ['net income', 'net profit', 'profit for the year', 'profit for the period', 'net earnings', 'net income loss', 'net profit loss', 'profit after tax', 'net income attributable to shareholders',
            'صافي الربح', 'صافي الدخل', 'صافي ربح العام', 'ربح العام', 'ربح الفتره', 'صافي الربح بعد الضريبه', 'الربح بعد الضريبه'] },

    // ---- Balance sheet ----
    { key: 'cash', st: 'BS', kind: 'stock', en: 'Cash & equivalents', ar: 'النقدية وما في حكمها',
      syn: ['cash', 'cash and cash equivalents', 'cash & cash equivalents', 'cash and equivalents', 'cash and bank balances', 'cash at bank',
            'النقديه', 'النقديه وما في حكمها', 'النقد وما في حكمه', 'النقديه بالصندوق والبنوك', 'النقد لدي البنوك'] },
    { key: 'receivables', st: 'BS', kind: 'stock', en: 'Accounts receivable', ar: 'الذمم المدينة',
      syn: ['accounts receivable', 'trade receivables', 'receivables', 'trade and other receivables', 'accounts receivable net', 'debtors', 'trade debtors',
            'الذمم المدينه', 'العملاء', 'المدينون', 'ذمم مدينه', 'العملاء واوراق القبض', 'ذمم مدينه تجاريه'] },
    { key: 'inventory', st: 'BS', kind: 'stock', en: 'Inventory', ar: 'المخزون',
      syn: ['inventory', 'inventories', 'merchandise inventory', 'المخزون', 'مخزون', 'البضاعه'] },
    { key: 'current_assets', st: 'BS', kind: 'stock', en: 'Total current assets', ar: 'إجمالي الأصول المتداولة',
      syn: ['total current assets', 'current assets', 'اجمالي الاصول المتداوله', 'الاصول المتداوله', 'مجموع الاصول المتداوله', 'اجمالي الموجودات المتداوله', 'الموجودات المتداوله'] },
    { key: 'ppe', st: 'BS', kind: 'stock', en: 'Property, plant & equipment', ar: 'الأصول الثابتة',
      syn: ['property plant and equipment', 'property plant & equipment', 'property plant and equipment net', 'ppe', 'pp&e', 'fixed assets', 'net fixed assets',
            'الاصول الثابته', 'اصول ثابته', 'صافي الاصول الثابته', 'الممتلكات والالات والمعدات', 'ممتلكات والات ومعدات', 'العقارات والالات والمعدات'] },
    { key: 'total_assets', st: 'BS', kind: 'stock', en: 'Total assets', ar: 'إجمالي الأصول',
      syn: ['total assets', 'assets total', 'اجمالي الاصول', 'مجموع الاصول', 'اجمالي الموجودات', 'مجموع الموجودات'] },
    { key: 'payables', st: 'BS', kind: 'stock', en: 'Accounts payable', ar: 'الذمم الدائنة',
      syn: ['accounts payable', 'trade payables', 'payables', 'trade and other payables', 'creditors', 'trade creditors',
            'الذمم الدائنه', 'الموردون', 'الموردين', 'الدائنون', 'ذمم دائنه', 'الموردون واوراق الدفع', 'ذمم دائنه تجاريه'] },
    { key: 'short_debt', st: 'BS', kind: 'stock', en: 'Short-term debt', ar: 'القروض قصيرة الأجل',
      syn: ['short-term debt', 'short term debt', 'short-term borrowings', 'short term borrowings', 'current portion of long-term debt', 'bank overdraft', 'short-term loans', 'short term loans', 'current borrowings',
            'القروض قصيره الاجل', 'قروض قصيره الاجل', 'بنوك سحب علي المكشوف', 'تسهيلات ائتمانيه', 'الجزء المتداول من القروض طويله الاجل', 'قروض قصيره'] },
    { key: 'current_liabilities', st: 'BS', kind: 'stock', en: 'Total current liabilities', ar: 'إجمالي الالتزامات المتداولة',
      syn: ['total current liabilities', 'current liabilities', 'اجمالي الالتزامات المتداوله', 'الالتزامات المتداوله', 'الخصوم المتداوله', 'اجمالي الخصوم المتداوله', 'المطلوبات المتداوله', 'مجموع الالتزامات المتداوله'] },
    { key: 'long_debt', st: 'BS', kind: 'stock', en: 'Long-term debt', ar: 'القروض طويلة الأجل',
      syn: ['long-term debt', 'long term debt', 'long-term borrowings', 'long term borrowings', 'long-term loans', 'long term loans', 'non-current borrowings', 'bonds payable',
            'القروض طويله الاجل', 'قروض طويله الاجل', 'قروض طويله'] },
    { key: 'total_liabilities', st: 'BS', kind: 'stock', en: 'Total liabilities', ar: 'إجمالي الالتزامات',
      syn: ['total liabilities', 'liabilities total', 'اجمالي الالتزامات', 'مجموع الالتزامات', 'اجمالي الخصوم', 'مجموع الخصوم', 'اجمالي المطلوبات', 'مجموع المطلوبات'] },
    { key: 'retained_earnings', st: 'BS', kind: 'stock', en: 'Retained earnings', ar: 'الأرباح المحتجزة',
      syn: ['retained earnings', 'accumulated profits', 'retained profits', 'accumulated deficit', 'الارباح المحتجزه', 'ارباح مرحله', 'الارباح المرحله', 'الارباح المبقاه'] },
    { key: 'equity', st: 'BS', kind: 'stock', en: "Total equity", ar: 'إجمالي حقوق الملكية',
      syn: ['total equity', "total shareholders' equity", 'total shareholders equity', "total stockholders' equity", 'total stockholders equity', 'shareholders equity', "shareholders' equity", 'equity', 'net assets', 'total equity attributable to owners',
            'اجمالي حقوق الملكيه', 'حقوق الملكيه', 'حقوق المساهمين', 'اجمالي حقوق المساهمين', 'مجموع حقوق الملكيه'] },

    // ---- Cash-flow statement ----
    { key: 'cfo', st: 'CF', kind: 'flow', en: 'Cash from operations', ar: 'التدفق النقدي التشغيلي',
      syn: ['net cash from operating activities', 'net cash provided by operating activities', 'cash flow from operating activities', 'cash flows from operating activities', 'net cash generated from operating activities', 'operating cash flow', 'net cash from operations', 'cash from operations', 'net cash used in operating activities', 'net cash provided by used in operating activities',
            'صافي التدفقات النقديه من الانشطه التشغيليه', 'صافي النقديه من الانشطه التشغيليه', 'التدفقات النقديه من الانشطه التشغيليه', 'صافي التدفق النقدي التشغيلي', 'التدفق النقدي التشغيلي'] },
    { key: 'capex', st: 'CF', kind: 'flow', expense: true, en: 'Capital expenditure', ar: 'الإنفاق الرأسمالي',
      syn: ['capital expenditure', 'capital expenditures', 'capex', 'purchase of property plant and equipment', 'purchases of property plant and equipment', 'purchase of fixed assets', 'acquisition of property plant and equipment', 'additions to property plant and equipment',
            'الانفاق الراسمالي', 'شراء اصول ثابته', 'مدفوعات لشراء اصول ثابته', 'اقتناء ممتلكات والات ومعدات', 'شراء ممتلكات والات ومعدات'] },
    { key: 'cfi', st: 'CF', kind: 'flow', en: 'Cash from investing', ar: 'التدفق النقدي الاستثماري',
      syn: ['net cash from investing activities', 'net cash used in investing activities', 'cash flow from investing activities', 'cash flows from investing activities', 'net cash provided by used in investing activities',
            'صافي التدفقات النقديه من الانشطه الاستثماريه', 'صافي النقديه من الانشطه الاستثماريه', 'التدفقات النقديه من الانشطه الاستثماريه'] },
    { key: 'cff', st: 'CF', kind: 'flow', en: 'Cash from financing', ar: 'التدفق النقدي التمويلي',
      syn: ['net cash from financing activities', 'net cash used in financing activities', 'cash flow from financing activities', 'cash flows from financing activities', 'net cash provided by used in financing activities',
            'صافي التدفقات النقديه من الانشطه التمويليه', 'صافي النقديه من الانشطه التمويليه', 'التدفقات النقديه من الانشطه التمويليه'] },
    { key: 'dividends', st: 'CF', kind: 'flow', expense: true, en: 'Dividends paid', ar: 'توزيعات الأرباح المدفوعة',
      syn: ['dividends paid', 'dividends', 'dividend paid', 'cash dividends paid', 'payment of dividends', 'توزيعات الارباح', 'توزيعات ارباح مدفوعه', 'توزيعات الارباح المدفوعه', 'ارباح موزعه'] },
  ];

  // Items computed from others when a file does not show them (key: [formula, inputs]).
  const DERIVED = {
    gross_profit: d => sub(d.revenue, d.cogs),
    cogs: d => sub(d.revenue, d.gross_profit),
    total_liabilities: d => sub(d.total_assets, d.equity),
    equity: d => sub(d.total_assets, d.total_liabilities),
    total_assets: d => add(d.total_liabilities, d.equity),
    operating_income: d => (d.pretax_income != null && d.interest != null) ? d.pretax_income + d.interest : null,
    pretax_income: d => (d.net_income != null && d.tax != null) ? d.net_income + d.tax : null,
  };
  function sub(a, b) { return a != null && b != null ? a - b : null; }
  function add(a, b) { return a != null && b != null ? a + b : null; }

  // Arabic-aware, punctuation-insensitive label normalisation.
  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[ً-ْـ]/g, '')       // tashkeel + tatweel
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/\(.*?\)/g, ' ')                    // "(note 5)", "(net)"
      .replace(/&/g, ' & ')
      .replace(/[^a-z0-9&؀-ۿ]+/g, ' ')
      .replace(/\b(note|notes)\s*\d+\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  const NORM_SYN = ITEMS.map(it => ({ it, syn: it.syn.map(normalize) }));

  /** Best catalogue match for a raw label, or null. Exact match beats containment; longer synonym wins. */
  function matchLabel(label) {
    const n = normalize(label);
    if (!n) return null;
    let best = null, bestScore = 0, bestSyn = '';
    for (const { it, syn } of NORM_SYN) {
      for (const s of syn) {
        let score = 0;
        if (n === s) score = 1000 + s.length;
        else if (s.length >= 4 && (' ' + n + ' ').includes(' ' + s + ' ')) score = s.length;
        if (score > bestScore) { bestScore = score; best = it.key; bestSyn = s; }
      }
    }
    // "Total liabilities and equity" is a check total, not an item.
    if (/liabilit/.test(n) && /equity/.test(n) || /(الالتزامات|الخصوم|المطلوبات)/.test(n) && /حقوق/.test(n)) return null;
    // A partial match on a line describing a movement or a sub-line ("change in inventory",
    // "deferred revenue", "cash at beginning of year") is not the item itself.
    if (best && bestScore < 1000) {
      // Only the words outside the matched synonym count: "trade and other receivables net" is still receivables.
      const rest = (' ' + n + ' ').replace(' ' + bestSyn + ' ', ' ');
      const notTheItem = /\b(change|changes|increase|decrease|movement|gain|loss on|proceeds|repayment|deferred|unearned|other|beginning|opening|per share|ratio)\b|التغير|الزياده|النقص|متحصلات|سداد|مؤجل|مقدما|اخري|اول المده|اول الفتره|اول العام|للسهم/;
      if (notTheItem.test(rest)) return null;
    }
    return best;
  }

  CFO.ITEMS = ITEMS;
  CFO.ITEM = Object.fromEntries(ITEMS.map(i => [i.key, i]));
  CFO.DERIVED = DERIVED;
  CFO.normalize = normalize;
  CFO.matchLabel = matchLabel;
})(globalThis.CFO = globalThis.CFO || {});
