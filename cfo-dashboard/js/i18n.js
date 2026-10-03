/* English / Arabic strings, number formatting, and the plain-language meaning of every ratio. */
(function (CFO) {
  const UI = {
    en: {
      appName: 'CFO Lens', tagline: 'Financial statement analysis',
      drop: 'Drop financial statements here', dropHint: 'Excel, CSV or PDF · several files at once. Drag them here, click to choose, or copy the files and paste (Ctrl+V / ⌘V).',
      readOk: (name, sheets, lines, matched) => `Read ${name}: ${sheets} ${sheets === 1 ? 'table' : 'tables'}, ${lines} lines, ${matched} matched to standard items.`,
      readNoMatch: name => `${name}: lines were read but none matched a standard item. Open Data review and map them by hand.`,
      libMissing: libs => `These libraries did not load, so some files cannot be read: ${libs}. Check your internet connection and reload.`,
      unexpected: msg => `Something went wrong: ${msg}. Reload the page; if it happens again, try a CSV or Excel export of the statements.`,
      keptExample: 'None of the files could be used, so the example data is still shown.',
      browse: 'Choose files', exampleTag: 'Example', vs: 'vs', pts: 'pts', sampleNotice: 'Example data (fictional company, EGP thousands). Drop your own files to replace it.',
      loadSample: 'Reload example', clear: 'Clear', filesLoaded: 'Files', reading: 'Reading files…',
      tabs: { overview: 'Overview', ratios: 'Ratios', vertical: 'Vertical', horizontal: 'Horizontal', flags: 'Red flags', review: 'Data review', report: 'Report' },
      period: 'Year', latest: 'Latest year', health: 'Financial health', healthOf: 'out of 100',
      kpi: { revenue: 'Revenue', net_income: 'Net income', fcf: 'Free cash flow', current_ratio: 'Current ratio', debt_to_equity: 'Debt / equity', roe: 'Return on equity' },
      groups: { liquidity: 'Liquidity', profitability: 'Profitability', efficiency: 'Efficiency', leverage: 'Leverage & solvency', cashflow: 'Cash flow', distress: 'Distress risk' },
      st: { IS: 'Income statement', BS: 'Balance sheet', CF: 'Cash flow' },
      status: { good: 'Healthy', warn: 'Watch', bad: 'Weak', na: 'N/A', info: 'Info' },
      sev: { high: 'High', med: 'Medium', low: 'Low' },
      formula: 'Formula', meaning: 'What it means', needs: 'Needs', avgNote: 'uses average of opening and closing balance',
      notAvail: 'Not available: the statements do not show',
      item: 'Line item', ofRevenue: '% of revenue', ofAssets: '% of total assets', yoy: 'YoY change', index: 'Index (base = 100)', cagr: 'CAGR', amount: 'Amount',
      showPct: 'Percent', showAbs: 'Amount', showIdx: 'Index',
      flagsTitle: 'Red flags', strengths: 'Strengths', recs: 'Recommendations', noFlags: 'No red flags triggered by the rules.',
      evidence: 'Evidence', action: 'Recommended action',
      reviewTitle: 'How your lines were read', reviewHint: 'Check each mapping. Change a dropdown to correct it; the whole analysis updates.',
      source: 'Source', rawLabel: 'Label in file', mappedTo: 'Mapped to', ignore: '— not used —', values: 'Values',
      derived: 'derived', derivedNote: 'Computed from other lines (accounting identity), not read from a file.',
      issues: 'Data checks', noIssues: 'All checks passed.',
      issue: {
        conflict: (i, n) => `${n(i.key)} ${i.period}: two different values (${i.kept} from ${i.keptFrom}, ${i.ignored} from ${i.ignoredFrom}). The first one is used.`,
        unbalanced: i => `Balance sheet ${i.period} does not balance: assets − liabilities − equity = ${i.gap}.`,
        gp_mismatch: i => `${i.period}: revenue − cost of sales differs from gross profit by ${i.gap}.`,
        missing: (i, n) => `${n(i.key)} was not found in any file. Ratios that need it show N/A.`,
        unmapped: i => `${i.count} lines were not matched to a standard item. They still appear in vertical and horizontal analysis.`,
      },
      reportTitle: 'Financial analysis report', execSummary: 'Executive summary', keyRatios: 'Key ratios', assumptions: 'Assumptions and limits',
      needsReview: 'Items for human review', nextSteps: 'Next steps',
      exportXlsx: 'Download Excel workbook', exportHtml: 'Download report (HTML, printable to PDF)', copyMd: 'Copy summary', saveStatus: { saved: 'Saved', declined: 'Not saved', unavailable: 'Saving files is not available here. Use Copy summary, or open dist/cfo-lens.html on your computer.' }, copied: 'Copied', copyFail: 'Copy blocked: select the text below and copy it.',
      dupont: 'DuPont breakdown of ROE', dupontHint: 'Return on equity = net margin × asset turnover × equity multiplier (closing balances).',
      zZones: 'Safe > 2.6 · Grey 1.1–2.6 · Distress < 1.1',
      errUnsupported: ext => `“.${ext}” files are not supported. Use .xlsx, .xls, .csv or .pdf.`,
      errRead: name => `Could not read ${name}. If it is a scanned PDF, export the statements to Excel or CSV instead.`,
      errNoLines: name => `${name}: no line items with year columns were found.`,
      theme: 'Theme', lang: 'العربية',
      chart: { revenueProfit: 'Revenue and profit', margins: 'Margins', structure: 'Balance-sheet structure', cash: 'Cash flow' },
      assumptionList: [
        'Status colours use general rules of thumb, not your industry\'s benchmarks. Margins and turnover vary widely by sector.',
        'Turnover, ROA and ROE use the average of opening and closing balances when the prior year is present.',
        'Expenses are treated as positive costs whatever sign the file uses.',
        'Total debt = short-term + long-term borrowings; leases are included only if the file reports them inside borrowings.',
        "Altman Z'' is the non-manufacturing / emerging-market version (book equity).",
        'Missing subtotals are computed from accounting identities and marked “derived”.',
      ],
      nextList: [
        'Confirm the line mappings in Data review, especially for PDF files.',
        'Compare the flagged ratios with 3–5 peers in the same industry.',
        'Turn the high-severity recommendations into owners and deadlines.',
      ],
      days: 'days', score: 'score',
    },
    ar: {
      appName: 'عدسة المدير المالي', tagline: 'تحليل القوائم المالية',
      drop: 'أسقط القوائم المالية هنا', dropHint: 'Excel أو CSV أو PDF · عدة ملفات معاً. اسحبها هنا، أو اضغط للاختيار، أو انسخ الملفات والصقها (Ctrl+V / ⌘V).',
      readOk: (name, sheets, lines, matched) => `تمت قراءة ${name}: ${sheets} جدول، ${lines} بند، ${matched} مربوط ببنود قياسية.`,
      readNoMatch: name => `${name}: قُرئت البنود لكن لم يُربط أي منها ببند قياسي. افتح مراجعة البيانات واربطها يدوياً.`,
      libMissing: libs => `لم تُحمّل هذه المكتبات لذا قد تتعذر قراءة بعض الملفات: ${libs}. تحقق من الاتصال بالإنترنت وأعد تحميل الصفحة.`,
      unexpected: msg => `حدث خطأ: ${msg}. أعد تحميل الصفحة؛ وإن تكرر جرّب تصدير القوائم إلى CSV أو Excel.`,
      keptExample: 'تعذر استخدام أي من الملفات، لذا ما زالت البيانات التجريبية معروضة.',
      browse: 'اختر الملفات', exampleTag: 'مثال', vs: 'مقابل', pts: 'نقطة', sampleNotice: 'بيانات تجريبية (شركة افتراضية، بالألف جنيه). أسقط ملفاتك لاستبدالها.',
      loadSample: 'إعادة البيانات التجريبية', clear: 'مسح', filesLoaded: 'الملفات', reading: 'جارٍ قراءة الملفات…',
      tabs: { overview: 'نظرة عامة', ratios: 'النسب المالية', vertical: 'التحليل الرأسي', horizontal: 'التحليل الأفقي', flags: 'إشارات الخطر', review: 'مراجعة البيانات', report: 'التقرير' },
      period: 'السنة', latest: 'آخر سنة', health: 'الصحة المالية', healthOf: 'من 100',
      kpi: { revenue: 'الإيرادات', net_income: 'صافي الربح', fcf: 'التدفق النقدي الحر', current_ratio: 'نسبة التداول', debt_to_equity: 'الديون / حقوق الملكية', roe: 'العائد على حقوق الملكية' },
      groups: { liquidity: 'السيولة', profitability: 'الربحية', efficiency: 'الكفاءة', leverage: 'الرفع المالي والملاءة', cashflow: 'التدفقات النقدية', distress: 'مخاطر التعثر' },
      st: { IS: 'قائمة الدخل', BS: 'الميزانية', CF: 'التدفقات النقدية' },
      status: { good: 'جيد', warn: 'للمتابعة', bad: 'ضعيف', na: 'غير متاح', info: 'معلوماتي' },
      sev: { high: 'مرتفعة', med: 'متوسطة', low: 'منخفضة' },
      formula: 'المعادلة', meaning: 'ماذا يعني', needs: 'يحتاج', avgNote: 'يستخدم متوسط رصيد أول وآخر المدة',
      notAvail: 'غير متاح: القوائم لا تتضمن',
      item: 'البند', ofRevenue: '% من الإيرادات', ofAssets: '% من إجمالي الأصول', yoy: 'التغير السنوي', index: 'الرقم القياسي (الأساس = 100)', cagr: 'معدل النمو المركب', amount: 'القيمة',
      showPct: 'نسبة', showAbs: 'قيمة', showIdx: 'رقم قياسي',
      flagsTitle: 'إشارات الخطر', strengths: 'نقاط القوة', recs: 'التوصيات', noFlags: 'لم تُطلق القواعد أي إشارة خطر.',
      evidence: 'الدليل', action: 'الإجراء المقترح',
      reviewTitle: 'كيف قُرئت بنود ملفاتك', reviewHint: 'راجع كل ربط. غيّر القائمة لتصحيحه وسيتحدث التحليل بالكامل.',
      source: 'المصدر', rawLabel: 'البند في الملف', mappedTo: 'مرتبط بـ', ignore: '— غير مستخدم —', values: 'القيم',
      derived: 'محسوب', derivedNote: 'محسوب من بنود أخرى (معادلة محاسبية) وليس مقروءاً من ملف.',
      issues: 'فحوصات البيانات', noIssues: 'اجتازت البيانات كل الفحوصات.',
      issue: {
        conflict: (i, n) => `${n(i.key)} ${i.period}: قيمتان مختلفتان (${i.kept} من ${i.keptFrom}، ${i.ignored} من ${i.ignoredFrom}). استُخدمت الأولى.`,
        unbalanced: i => `ميزانية ${i.period} غير متوازنة: الأصول − الالتزامات − حقوق الملكية = ${i.gap}.`,
        gp_mismatch: i => `${i.period}: الإيرادات − تكلفة المبيعات لا تساوي مجمل الربح، الفرق ${i.gap}.`,
        missing: (i, n) => `لم يُعثر على ${n(i.key)} في أي ملف. النسب التي تحتاجه تظهر غير متاحة.`,
        unmapped: i => `${i.count} بنود لم تُربط ببند قياسي. ما زالت تظهر في التحليل الرأسي والأفقي.`,
      },
      reportTitle: 'تقرير التحليل المالي', execSummary: 'الملخص التنفيذي', keyRatios: 'أهم النسب', assumptions: 'الافتراضات والحدود',
      needsReview: 'بنود تحتاج مراجعة بشرية', nextSteps: 'الخطوات التالية',
      exportXlsx: 'تنزيل ملف Excel', exportHtml: 'تنزيل التقرير (HTML قابل للطباعة PDF)', copyMd: 'نسخ الملخص', saveStatus: { saved: 'تم الحفظ', declined: 'لم يتم الحفظ', unavailable: 'حفظ الملفات غير متاح هنا. استخدم نسخ الملخص، أو افتح dist/cfo-lens.html على جهازك.' }, copied: 'تم النسخ', copyFail: 'النسخ ممنوع: حدد النص بالأسفل وانسخه.',
      dupont: 'تحليل ديبونت للعائد على حقوق الملكية', dupontHint: 'العائد على حقوق الملكية = هامش صافي الربح × دوران الأصول × مضاعف حقوق الملكية (أرصدة آخر المدة).',
      zZones: 'آمن > 2.6 · رمادي 1.1–2.6 · تعثر < 1.1',
      errUnsupported: ext => `ملفات “.${ext}” غير مدعومة. استخدم xlsx أو xls أو csv أو pdf.`,
      errRead: name => `تعذرت قراءة ${name}. إن كان PDF ممسوحاً ضوئياً فصدّر القوائم إلى Excel أو CSV.`,
      errNoLines: name => `${name}: لم يُعثر على بنود بأعمدة سنوات.`,
      theme: 'المظهر', lang: 'English',
      chart: { revenueProfit: 'الإيرادات والأرباح', margins: 'الهوامش', structure: 'هيكل الميزانية', cash: 'التدفقات النقدية' },
      assumptionList: [
        'ألوان الحالة مبنية على قواعد عامة وليست معايير قطاعك. الهوامش ومعدلات الدوران تختلف كثيراً بين القطاعات.',
        'معدلات الدوران والعائد على الأصول وحقوق الملكية تستخدم متوسط رصيد أول وآخر المدة عند توفر السنة السابقة.',
        'تُعامل المصروفات كتكاليف موجبة أياً كانت إشارتها في الملف.',
        'إجمالي الديون = القروض قصيرة الأجل + طويلة الأجل؛ عقود الإيجار تُحتسب فقط إن ظهرت ضمن القروض.',
        'مؤشر ألتمان Z\'\' هو نسخة الشركات غير الصناعية / الأسواق الناشئة (حقوق الملكية الدفترية).',
        'الإجماليات الناقصة تُحسب من المعادلات المحاسبية وتُعلَّم بـ «محسوب».',
      ],
      nextList: [
        'أكّد ربط البنود في تبويب مراجعة البيانات، خاصة لملفات PDF.',
        'قارن النسب المُنبَّه عليها بـ 3–5 شركات منافسة في نفس القطاع.',
        'حوّل التوصيات عالية الخطورة إلى مسؤولين ومواعيد تنفيذ.',
      ],
      days: 'يوم', score: 'درجة',
    },
  };

  const NAMES = {
    current_ratio: ['Current ratio', 'نسبة التداول'], quick_ratio: ['Quick ratio', 'النسبة السريعة'], cash_ratio: ['Cash ratio', 'نسبة النقدية'],
    ocf_ratio: ['Operating cash-flow ratio', 'نسبة التدفق النقدي التشغيلي'], working_capital: ['Working capital', 'رأس المال العامل'],
    gross_margin: ['Gross margin', 'هامش مجمل الربح'], ebitda_margin: ['EBITDA margin', 'هامش EBITDA'], operating_margin: ['Operating margin', 'هامش الربح التشغيلي'],
    net_margin: ['Net margin', 'هامش صافي الربح'], roa: ['Return on assets (ROA)', 'العائد على الأصول'], roe: ['Return on equity (ROE)', 'العائد على حقوق الملكية'],
    roce: ['Return on capital employed (ROCE)', 'العائد على رأس المال المستخدم'], tax_rate: ['Effective tax rate', 'معدل الضريبة الفعلي'],
    asset_turnover: ['Asset turnover', 'معدل دوران الأصول'], fixed_asset_turnover: ['Fixed-asset turnover', 'معدل دوران الأصول الثابتة'],
    dso: ['Days sales outstanding (DSO)', 'فترة التحصيل (أيام)'], dio: ['Days inventory outstanding (DIO)', 'فترة بقاء المخزون (أيام)'],
    dpo: ['Days payables outstanding (DPO)', 'فترة السداد للموردين (أيام)'], ccc: ['Cash conversion cycle', 'دورة التحويل النقدي'],
    debt_to_equity: ['Debt to equity', 'الديون إلى حقوق الملكية'], debt_ratio: ['Debt ratio (liabilities / assets)', 'نسبة الالتزامات إلى الأصول'],
    equity_multiplier: ['Equity multiplier', 'مضاعف حقوق الملكية'], interest_coverage: ['Interest coverage', 'تغطية الفوائد'],
    net_debt_to_ebitda: ['Net debt / EBITDA', 'صافي الدين / EBITDA'], fcf: ['Free cash flow', 'التدفق النقدي الحر'], fcf_margin: ['FCF margin', 'هامش التدفق النقدي الحر'],
    cash_conversion: ['Cash conversion (CFO / net income)', 'جودة الأرباح (التدفق التشغيلي / صافي الربح)'], capex_to_dna: ['Capex / depreciation', 'الإنفاق الرأسمالي / الإهلاك'],
    payout_ratio: ['Dividend payout', 'نسبة توزيع الأرباح'], altman_z: ["Altman Z''-score", "مؤشر ألتمان Z''"],
  };

  /* Meaning templates: v = formatted value, raw = number. Kept to one or two plain sentences. */
  const MEANING = {
    current_ratio: { en: v => `For every 1 the company owes within a year, it holds ${v} in current assets.`, ar: v => `مقابل كل 1 مستحق خلال سنة، تملك الشركة ${v} من الأصول المتداولة.` },
    quick_ratio: { en: v => `Without selling any inventory, the company can cover ${v} of each 1 of short-term obligations.`, ar: v => `دون بيع أي مخزون، تغطي الشركة ${v} من كل 1 من التزاماتها قصيرة الأجل.` },
    cash_ratio: { en: v => `Cash on hand alone covers ${v} of each 1 of current liabilities.`, ar: v => `النقدية وحدها تغطي ${v} من كل 1 من الالتزامات المتداولة.` },
    ocf_ratio: { en: v => `One year of operating cash flow would repay ${v} of current liabilities.`, ar: v => `تدفق نقدي تشغيلي لسنة واحدة يسدد ${v} من الالتزامات المتداولة.` },
    working_capital: { en: (v, r) => r >= 0 ? `Current assets exceed current liabilities by ${v}: a buffer for day-to-day operations.` : `Current liabilities exceed current assets by ${v}: short-term funding gap.`, ar: (v, r) => r >= 0 ? `الأصول المتداولة تزيد عن الالتزامات المتداولة بمقدار ${v}: هامش أمان للتشغيل اليومي.` : `الالتزامات المتداولة تزيد عن الأصول المتداولة بمقدار ${v}: فجوة تمويل قصيرة الأجل.` },
    gross_margin: { en: v => `After direct costs, ${v} of each sale is left to pay overheads, interest, tax and profit.`, ar: v => `بعد التكاليف المباشرة يتبقى ${v} من كل عملية بيع لتغطية المصروفات والفوائد والضرائب والربح.` },
    ebitda_margin: { en: v => `Operations generate ${v} of revenue before depreciation, interest and tax: a proxy for cash earnings.`, ar: v => `يولّد التشغيل ${v} من الإيرادات قبل الإهلاك والفوائد والضرائب: مؤشر تقريبي للأرباح النقدية.` },
    operating_margin: { en: v => `The core business keeps ${v} of revenue as operating profit.`, ar: v => `يحتفظ النشاط الأساسي بـ ${v} من الإيرادات كربح تشغيلي.` },
    net_margin: { en: v => `${v} of every sale ends up as profit for shareholders.`, ar: v => `${v} من كل عملية بيع تتحول إلى ربح للمساهمين.` },
    roa: { en: v => `Each 100 invested in assets earns ${v.replace('%', '')} of net profit a year.`, ar: v => `كل 100 مستثمرة في الأصول تحقق ${v.replace('%', '')} صافي ربح سنوياً.` },
    roe: { en: v => `Shareholders earn ${v} a year on the equity they have in the business.`, ar: v => `يحقق المساهمون ${v} سنوياً على حقوقهم في الشركة.` },
    roce: { en: v => `Long-term capital (debt + equity) earns ${v} in operating profit.`, ar: v => `رأس المال طويل الأجل (ديون + حقوق ملكية) يحقق ${v} ربحاً تشغيلياً.` },
    tax_rate: { en: v => `The company pays ${v} of pre-tax profit in income tax.`, ar: v => `تدفع الشركة ${v} من الربح قبل الضريبة كضريبة دخل.` },
    asset_turnover: { en: v => `Each 1 of assets generates ${v} of revenue a year.`, ar: v => `كل 1 من الأصول يولّد ${v} من الإيرادات سنوياً.` },
    fixed_asset_turnover: { en: v => `Each 1 of property and equipment generates ${v} of revenue.`, ar: v => `كل 1 من الأصول الثابتة يولّد ${v} من الإيرادات.` },
    dso: { en: v => `Customers take about ${v} on average to pay.`, ar: v => `يستغرق العملاء حوالي ${v} في المتوسط للسداد.` },
    dio: { en: v => `Inventory sits for about ${v} before it is sold.`, ar: v => `يبقى المخزون حوالي ${v} قبل بيعه.` },
    dpo: { en: v => `The company takes about ${v} to pay its suppliers.`, ar: v => `تستغرق الشركة حوالي ${v} لسداد مورديها.` },
    ccc: { en: v => `Cash is tied up for about ${v} between paying suppliers and collecting from customers.`, ar: v => `تظل النقدية محتجزة حوالي ${v} بين الدفع للموردين والتحصيل من العملاء.` },
    debt_to_equity: { en: v => `Lenders have put in ${v} for every 1 shareholders have.`, ar: v => `قدّم المقرضون ${v} مقابل كل 1 من المساهمين.` },
    debt_ratio: { en: v => `${v} of the assets are financed by liabilities rather than equity.`, ar: v => `${v} من الأصول ممولة بالتزامات وليس بحقوق ملكية.` },
    equity_multiplier: { en: v => `Assets are ${v} the size of equity: higher means more borrowed money at work.`, ar: v => `الأصول تعادل ${v} حقوق الملكية: كلما ارتفع زاد الاعتماد على الاقتراض.` },
    interest_coverage: { en: v => `Operating profit covers the interest bill ${v}.`, ar: v => `الربح التشغيلي يغطي الفوائد ${v}.` },
    net_debt_to_ebitda: { en: v => `It would take about ${v.replace('×', '')} years of EBITDA to repay net debt.`, ar: v => `يحتاج سداد صافي الدين حوالي ${v.replace('×', '')} سنوات من EBITDA.` },
    fcf: { en: (v, r) => r >= 0 ? `After investing in assets, operations left ${v} of cash for debt repayment, dividends or reserves.` : `Operations did not fund investment: a ${v} shortfall had to come from cash or new financing.`, ar: (v, r) => r >= 0 ? `بعد الاستثمار في الأصول تبقى ${v} نقداً لسداد الديون أو التوزيعات أو الاحتياطي.` : `التشغيل لم يموّل الاستثمار: عجز ${v} مُوّل من النقدية أو تمويل جديد.` },
    fcf_margin: { en: v => `${v} of revenue turns into free cash.`, ar: v => `${v} من الإيرادات تتحول إلى نقد حر.` },
    cash_conversion: { en: v => `Each 1 of reported profit brought in ${v} of operating cash. Below 1 means profit is not turning into cash.`, ar: v => `كل 1 من الربح المحاسبي جلب ${v} نقداً تشغيلياً. أقل من 1 يعني أن الأرباح لا تتحول إلى نقد.` },
    capex_to_dna: { en: v => `The company reinvests ${v} its depreciation: above 1 means it is growing its asset base.`, ar: v => `تعيد الشركة استثمار ${v} قيمة الإهلاك: أكثر من 1 يعني توسيع قاعدة الأصول.` },
    payout_ratio: { en: v => `${v} of net income was paid out as dividends.`, ar: v => `وُزّع ${v} من صافي الربح كأرباح نقدية.` },
    altman_z: { en: (v, r) => `Score ${v}: ${r > 2.6 ? 'safe zone, low near-term distress risk' : r >= 1.1 ? 'grey zone, monitor closely' : 'distress zone, elevated risk of financial difficulty'}.`, ar: (v, r) => `الدرجة ${v}: ${r > 2.6 ? 'منطقة آمنة، خطر تعثر منخفض' : r >= 1.1 ? 'منطقة رمادية، تحتاج متابعة' : 'منطقة تعثر، خطر صعوبات مالية مرتفع'}.` },
  };

  function fmtNum(v, digits = 0, lang = 'en') {
    if (v == null || !isFinite(v)) return '—';
    const s = Math.abs(v).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return v < 0 ? `(${s})` : s;
  }
  function fmtVal(unit, v, lang = 'en') {
    if (v == null || !isFinite(v)) return '—';
    const L = UI[lang];
    switch (unit) {
      case '%': return `${(v * 100).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
      case 'x': return `${v.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;
      case 'days': return `${Math.round(v).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')} ${L.days}`;
      case 'money': return fmtNum(v, 0, lang);
      default: return v.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  const fmtPct = (v, lang) => fmtVal('%', v, lang);

  const ratioName = (id, lang) => (NAMES[id] || [id, id])[lang === 'ar' ? 1 : 0];
  const itemName = (key, lang) => CFO.ITEM[key] ? CFO.ITEM[key][lang === 'ar' ? 'ar' : 'en'] : key;
  function meaning(id, v, lang) {
    const m = MEANING[id]; if (!m || v == null) return '';
    return m[lang](fmtVal(CFO.RATIO[id].unit, v, lang), v);
  }

  CFO.UI = UI;
  CFO.fmtNum = fmtNum; CFO.fmtVal = fmtVal; CFO.fmtPct = fmtPct;
  CFO.ratioName = ratioName; CFO.itemName = itemName; CFO.meaning = meaning;
})(globalThis.CFO = globalThis.CFO || {});
