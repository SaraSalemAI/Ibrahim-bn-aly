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
  /* Keyword rules, tried after an exact synonym and before partial synonym matches. Order matters: the most
   * specific come first (cash-flow totals before "cash", depreciation and capex before PP&E, "before tax"
   * before tax). Labels are normalised first (lower case, Arabic letter variants unified, brackets removed). */
  const CASHFLOW = /\b(cash|cash flows?)\b|نقد|تدفق/;
  const RULES = [
    ['cfo', n => /\b(operating|operations)\b|تشغيل|التشغيليه/.test(n) && CASHFLOW.test(n)],
    ['cfi', n => /\binvesting\b|استثمار/.test(n) && CASHFLOW.test(n)],
    ['cff', n => /\bfinancing\b|تمويليه|التمويل|تمويل/.test(n) && CASHFLOW.test(n)],
    ['capex', n => /\b(purchases?|acquisitions?|payments? for|additions? to|paid for)\b|مدفوعات|شراء|اقتناء|اضافات/.test(n) && /\b(property|plant|equipment|fixed assets?)\b|ممتلكات|اصول ثابته|الاصول الثابته|الالات والمعدات/.test(n)],
    ['pretax_income', n => /\bbefore\b.*\b(tax|taxes|taxation|zakat)\b|قبل.*(ضريب|ضرائب|زكا)/.test(n)],
    ['interest', n => /\b(finance|financing|interest|borrowing) (costs?|expenses?|charges?)\b|\binterest expense|فوائد|تكاليف التمويل|تكلفه التمويل|مصروفات تمويليه|مصروفات التمويل|اعباء تمويليه/.test(n)],
    ['dna', n => /\b(depreciation|amorti[sz]ation)\b|اهلاك|استهلاك/.test(n) && !/\baccumulated\b|مجمع/.test(n)],
    ['tax', n => /\b(income tax|taxation|tax expense|zakat)\b|ضريب|ضرائب|زكا/.test(n) && !/\b(payable|deferred|receivable|asset|liabilit|net|after|before)|مستحق|مؤجل|مدين|صافي|بعد|قبل/.test(n)],
    ['short_debt', n => !/\bnon ?current\b|غير المتداول|غير متداول/.test(n) && /\bcurrent portion\b|الجزء المتداول|\boverdrafts?\b|المكشوف|credit facilit|تسهيلات ائتمانيه|\bshort.?term (loans?|borrowings?|debt|financ)|قروض قصيره|\bcurrent (borrowings|loans)\b/.test(n)],
    ['long_debt', n => /\b(long.?term|non.?current)\b.*\b(loans?|borrowings?|debt|financ)|\b(loans?|borrowings?)\b.*\b(long.?term|non.?current)\b|قروض.*طويله|طويله الاجل.*(قروض|تمويل)|\bbonds\b|سندات/.test(n)],
    ['retained_earnings', n => /\bretained\b|accumulated (losses|deficit|profits)|ارباح مرحله|الارباح المرحله|ارباح مبقاه|الارباح المبقاه|محتجزه|خسائر متراكمه|الخسائر المتراكمه/.test(n)],
    ['cogs', n => /\bcost of (sales|revenues?|goods|operations|services)\b|\bdirect costs?\b|تكلفه (المبيعات|الايرادات|البضاعه|النشاط)|تكاليف (النشاط|التشغيل|الايرادات)|التكاليف المباشره/.test(n)],
    ['gross_profit', n => /\bgross (profit|income|margin|loss)\b|مجمل (الربح|ربح|الخساره)/.test(n)],
    ['operating_income', n => /\b(operating|operations) (profit|income|result)|\b(profit|income|results?) from (operations|operating)\b|(ربح|ارباح|الربح|الارباح) (من )?(التشغيل|النشاط)|(الربح|الارباح) التشغيليه?|الربح التشغيلي/.test(n)],
    ['net_income', n => (/\bnet (profit|income|earnings|loss)\b|\b(profit|loss|income|earnings) (for|of) the (year|period)\b|\bprofit after tax\b|صافي (ربح|الربح|ارباح|الارباح|الدخل|الخساره)|(ربح|ارباح|الربح) (العام|السنه|الفتره)/.test(n)) && !/\bbefore\b|قبل|\bper share\b|للسهم|\bcomprehensive\b|non ?controlling|\bminority\b|الشامل|غير المسيطره|حقوق الاقليه/.test(n)],
    ['opex', n => /\b(selling|distribution|marketing|general|administrative|admin|operating) (and [a-z ]+ )?(expenses?|costs?)\b|\bsg ?& ?a\b|\bselling general\b|مصروفات.*(بيع|توزيع|تسويق|عموميه|اداريه|تشغيليه)|المصاريف.*(اداريه|عموميه|بيعيه)|(البيعيه|التسويقيه)/.test(n) && !/\bother\b|اخري/.test(n)],
    ['revenue', n => /\b(revenues?|sales|turnover)\b|ايرادات|الايرادات|المبيعات|مبيعات/.test(n) && !/\b(cost|other|deferred|unearned|finance|interest|investment)\b|تكلف|تكاليف|اخري|مؤجل|تمويل|استثمار|فوائد/.test(n)],
    ['current_assets', n => /\bcurrent assets\b|اصول متداوله|الاصول المتداوله|موجودات متداوله|الموجودات المتداوله/.test(n) && !/\bnon.?current\b|غير المتداوله|غير متداوله|\bother\b|اخري/.test(n)],
    ['current_liabilities', n => /\bcurrent liabilities\b|(التزامات|الالتزامات|خصوم|الخصوم|مطلوبات|المطلوبات) متداوله|(الالتزامات|الخصوم|المطلوبات) المتداوله/.test(n) && !/\bnon.?current\b|غير المتداوله|غير متداوله|\bother\b|اخري/.test(n)],
    ['cash', n => (/^cash( and (cash equivalents|equivalents|bank|banks|bank balances|deposits)| at banks?| on hand| in hand| balances?)?\b/.test(n) || /^(النقديه|النقد|نقديه|نقد)(\s|$)/.test(n))
      && !/\b(paid|payments?|receipts?|received|dividends?|flows?|generated|used)\b|مدفوع|محصل|متحصل|توزيع|تدفق/.test(n)],
    ['receivables', n => /\breceivables?\b|\bdebtors\b|^customers\b|عملاء|العملاء|مدينون|المدينون|ذمم مدينه|اوراق القبض/.test(n) && !/\b(tax|zakat|related part)|ضريب|ضرائب|زكا|اطراف ذات علاقه/.test(n)],
    ['payables', n => /\bpayables?\b|\bcreditors\b|^suppliers\b|موردون|الموردون|موردين|الموردين|دائنون|الدائنون|ذمم دائنه|اوراق الدفع/.test(n) && !/\b(tax|zakat|dividends?|related part|interest|lease|loans?)|ضريب|ضرائب|زكا|توزيعات|اطراف ذات علاقه|فوائد|ايجار|قروض/.test(n)
      && !(/\bnotes? payable\b/.test(n) && !/\btrade\b|\bsuppliers\b/.test(n))],
    ['inventory', n => /\binventor(y|ies)\b|\bstock in trade\b|مخزون|المخزون/.test(n)],
    ['ppe', n => /\b(property|plant) (and|&) equipment|\bproperty and equipment\b|\bfixed assets\b|ممتلكات|اصول ثابته|الاصول الثابته/.test(n) && !/\bright.of.use\b|حق الاستخدام/.test(n)],
    ['dividends', n => /\bdividends?\b|توزيعات/.test(n) && !/\b(payable|declared|received|income)\b|مستحق|مقبوضه|محصله/.test(n)],
    ['equity', n => /\b(shareholders?|stockholders?|owners?)'?s? equity\b|\bequity attributable\b|^total equity\b|حقوق (الملكيه|المساهمين)/.test(n)],
  ];
  // Words that mean the line is a movement, a per-share figure or an opening balance, not the item itself.
  const NOT_THE_ITEM = /\b(change|changes|increase|decrease|movement|gain on|loss on|proceeds|repayments?|deferred|unearned|beginning|opening|per share|ratio|provision for|impairment|reversal)\b|التغير|الزياده|النقص|متحصلات|سداد|مؤجل|مقدما|اول المده|اول الفتره|اول العام|اول السنه|للسهم|مخصص|اضمحلال|رد /;

  /* Checks every non-exact match must pass, whichever stage found it. */
  const NON_CURRENT = /\bnon ?current\b|غير المتداول|غير متداول/;
  const GUARDS = {
    current_assets: n => !NON_CURRENT.test(n), current_liabilities: n => !NON_CURRENT.test(n),
    short_debt: n => !NON_CURRENT.test(n),
    total_assets: n => !NON_CURRENT.test(n) && !/\bcurrent\b|متداول/.test(n),
    total_liabilities: n => !NON_CURRENT.test(n) && !/\bcurrent\b|متداول/.test(n),
    dna: n => !/\baccumulated\b|مجمع/.test(n),
    tax: n => !/\b(payable|deferred|receivable|asset|liabilit|net|after|before)|مستحق|مؤجل|مدين|صافي|بعد|قبل/.test(n),
    revenue: n => !/\b(cost|deferred|unearned|finance|interest|investment)\b|تكلف|تكاليف|مؤجل|تمويل|استثمار|فوائد/.test(n),
    // A cash balance, not a cash movement ("cash paid to suppliers", "cash receipts", "cash dividends").
    cash: n => !/\b(paid|payments?|receipts?|received|dividends?|flows?|generated|used|from|to)\b|مدفوع|محصل|متحصل|توزيع|تدفق/.test(n),
    payables: n => !/\b(tax|zakat|dividends?|related part|interest|lease|loans?)|ضريب|ضرائب|زكا|توزيعات|اطراف ذات علاقه|فوائد|ايجار|قروض/.test(n)
      && !(/\bnotes? payable\b/.test(n) && !/\btrade\b|\bsuppliers\b/.test(n)),
    net_income: n => !/\bbefore\b|قبل|\bper share\b|للسهم|\bcomprehensive\b|non ?controlling|\bminority\b|الشامل|غير المسيطره|حقوق الاقليه/.test(n),
  };
  // "Other ..." is a separate line, except the usual "trade and other receivables / payables", "debtors and other debit balances".
  const OTHER = /\bother\b|اخري/;
  const OTHER_OK = n => /\btrade\b|^(debtors|creditors)\b|^(مدينون|دائنون|المدينون|الدائنون)/.test(n);
  const accept = (key, n) => (!GUARDS[key] || GUARDS[key](n)) && (!OTHER.test(n) || (['receivables', 'payables'].includes(key) && OTHER_OK(n)));

  function matchLabel(label) {
    const n = normalize(label);
    if (!n) return null;
    // 1. An exact synonym always wins.
    for (const { it, syn } of NORM_SYN) if (syn.includes(n)) return it.key;
    // "Total liabilities and equity" is a check total, not an item.
    if (/liabilit/.test(n) && /equity/.test(n) || /(الالتزامات|الخصوم|المطلوبات)/.test(n) && /حقوق/.test(n)) return null;
    if (NOT_THE_ITEM.test(n)) return null;
    // 2. Keyword rules, most specific first.
    for (const [key, test] of RULES) if (test(n)) return accept(key, n) ? key : null;
    // 3. Longest synonym contained in the label; words outside it must not mark a sub-line ("other ...").
    let best = null, bestLen = 0, bestSyn = '';
    for (const { it, syn } of NORM_SYN) for (const sy of syn) {
      if (sy.length >= 4 && sy.length > bestLen && (' ' + n + ' ').includes(' ' + sy + ' ')) { best = it.key; bestLen = sy.length; bestSyn = sy; }
    }
    if (!best) return null;
    // Words outside the matched synonym decide whether this is really the item ("trade and other receivables" keeps its own "other").
    const rest = (' ' + n + ' ').replace(' ' + bestSyn + ' ', ' ');
    if (OTHER.test(rest) && !(['receivables', 'payables'].includes(best) && OTHER_OK(n))) return null;
    return GUARDS[best] && !GUARDS[best](n) ? null : best;
  }


  CFO.ITEMS = ITEMS;
  CFO.ITEM = Object.fromEntries(ITEMS.map(i => [i.key, i]));
  CFO.DERIVED = DERIVED;
  CFO.normalize = normalize;
  CFO.matchLabel = matchLabel;
})(globalThis.CFO = globalThis.CFO || {});
