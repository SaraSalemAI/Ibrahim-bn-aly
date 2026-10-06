// Financial statement analytics from the uploaded Trial Balance (and GL for period length).
import type { L, RowRef, Settings, SourceTable } from './types';
import { accessor, dayDiff } from './values';

export type FsCat = 'cash' | 'receivables' | 'inventory' | 'otherCurrentAssets' | 'nonCurrentAssets' | 'currentLiabilities' | 'debt' | 'otherLiabilities' | 'equity' | 'revenue' | 'cogs' | 'opex' | 'depreciation' | 'interest' | 'taxExpense' | 'otherIncome' | 'unclassified';

const RULES: [FsCat, RegExp][] = [
  ['nonCurrentAssets', /accumulated (depreciation|amortization)|مجمع (ال)?[إا]هلاك/i],
  ['depreciation', /depreciation expense|amortization expense|مصروف (ال)?[إا]هلاك|(^| )depreciation( |$)/i],
  ['nonCurrentAssets', /accumulated depreciation|مجمع (ال)?[إا]هلاك|fixed asset|property|plant|equipment|intangible|non.?current asset|long.?term investment|projects under|cwip|اصول ثابتة|أصول ثابتة|اصول غير متداولة|أصول غير متداولة|مشروعات تحت التنفيذ/i],
  ['debt', /loan|borrowing|overdraft|facility|قرض|قروض|سحب على المكشوف|تسهيلات/i],
  ['cash', /cash|bank|treasury bill|نقدية|بنوك|بنك|الصندوق/i],
  ['receivables', /receivable|debtor|customers|مدينون|عملاء|اوراق قبض|أوراق قبض/i],
  ['inventory', /inventory|stock|stores|spare parts|مخزون|المخازن|قطع غيار/i],
  ['currentLiabilities', /payable|creditor|accrued|accrual|current liabilit|provision|tax payable|دائنون|موردين|مستحق|مخصص|التزامات متداولة|خصوم متداولة/i],
  ['otherLiabilities', /liabilit|deferred|التزامات|خصوم/i],
  ['equity', /equity|share capital|capital|reserve|retained|حقوق الملكية|راس المال|رأس المال|احتياطي|أرباح مرحلة|ارباح مرحلة/i],
  ['cogs', /cost of (sales|revenue|goods|services)|direct cost|تكلفة (المبيعات|الايرادات|الإيرادات|النشاط)/i],
  ['interest', /interest expense|finance cost|bank interest|فوائد مدينة|تكاليف تمويل|مصروف فوائد/i],
  ['taxExpense', /income tax expense|tax expense|ضريبة الدخل/i],
  ['otherIncome', /interest income|other income|investment income|فوائد دائنة|ايرادات اخرى|إيرادات أخرى/i],
  ['revenue', /revenue|sales|transport(ation)? (fees|income)|throughput|storage income|ايراد|إيراد|مبيعات/i],
  ['opex', /expense|salar|wage|rent|utilit|maintenance|insurance|مصروف|مصاريف|رواتب|اجور|أجور|صيانة/i],
  ['otherCurrentAssets', /prepaid|advance|deposit|current asset|other receivable|مقدم|سلف|تأمينات|اصول متداولة|أصول متداولة/i],
];

export function classifyAccount(text: string): FsCat {
  for (const [c, re] of RULES) if (re.test(text)) return c;
  return 'unclassified';
}

export const CAT_LABEL: Record<FsCat, L> = {
  cash: { en: 'Cash & bank', ar: 'النقدية والبنوك' }, receivables: { en: 'Receivables', ar: 'المدينون' }, inventory: { en: 'Inventory', ar: 'المخزون' },
  otherCurrentAssets: { en: 'Other current assets', ar: 'أصول متداولة أخرى' }, nonCurrentAssets: { en: 'Non-current assets', ar: 'الأصول غير المتداولة' },
  currentLiabilities: { en: 'Current liabilities', ar: 'الالتزامات المتداولة' }, debt: { en: 'Borrowings', ar: 'القروض' }, otherLiabilities: { en: 'Other liabilities', ar: 'التزامات أخرى' },
  equity: { en: 'Equity', ar: 'حقوق الملكية' }, revenue: { en: 'Revenue', ar: 'الإيرادات' }, cogs: { en: 'Cost of revenue', ar: 'تكلفة الإيرادات' }, opex: { en: 'Operating expenses', ar: 'المصروفات التشغيلية' },
  depreciation: { en: 'Depreciation', ar: 'الإهلاك' }, interest: { en: 'Finance cost', ar: 'تكاليف التمويل' }, taxExpense: { en: 'Income tax', ar: 'ضريبة الدخل' }, otherIncome: { en: 'Other income', ar: 'إيرادات أخرى' },
  unclassified: { en: 'Unclassified', ar: 'غير مصنف' },
};

export interface FsLine { account: string; name: string; cat: FsCat; current: number; prior: number | null; ref: RowRef }
export interface Ratio { id: string; name: L; formula: string; value: number | null; unit: '%' | 'x' | 'days' | 'EGP'; inputs: { label: string; value: number | null }[]; missing: string | null }
export interface MovementAlert { account: string; name: string; cat: FsCat; current: number; prior: number; change: number; pct: number | null; materiality: string; risk: L; explanation: L; implication: L; ref: RowRef }
export interface FsaResult {
  available: boolean;
  reason: string | null;
  classificationBasis: string;
  totals: Record<FsCat, { current: number; prior: number | null; accounts: number }>;
  lines: FsLine[];
  ratios: Ratio[];
  alerts: MovementAlert[];
  periodDays: number | null;
  periodBasis: string;
  hasPrior: boolean;
}

const CAT_RISK: Partial<Record<FsCat, L>> = {
  revenue: { en: 'Revenue recognition / cut-off', ar: 'الاعتراف بالإيراد / الفصل بين الفترات' },
  receivables: { en: 'Recoverability (credit risk)', ar: 'قابلية التحصيل (مخاطر الائتمان)' },
  cash: { en: 'Existence / liquidity', ar: 'الوجود / السيولة' },
  inventory: { en: 'Valuation / existence', ar: 'التقييم / الوجود' },
  nonCurrentAssets: { en: 'Capitalization / impairment', ar: 'الرسملة / الاضمحلال' },
  debt: { en: 'Completeness of liabilities / covenants', ar: 'اكتمال الالتزامات / التعهدات' },
  currentLiabilities: { en: 'Completeness of liabilities', ar: 'اكتمال الالتزامات' },
  opex: { en: 'Occurrence / classification of expenses', ar: 'حدوث وتبويب المصروفات' },
  cogs: { en: 'Cost accuracy / cut-off', ar: 'دقة التكلفة / الفصل' },
};

export function analyseFS(tables: SourceTable[], s: Settings): FsaResult {
  const tbs = tables.filter((t) => t.datasetType === 'tb' && t.mapping.account && t.mapping.closing);
  const empty = Object.fromEntries(Object.keys(CAT_LABEL).map((k) => [k, { current: 0, prior: null, accounts: 0 }])) as FsaResult['totals'];
  if (!tbs.length) return { available: false, reason: 'Trial Balance with Account and Closing Balance not uploaded', classificationBasis: '', totals: empty, lines: [], ratios: [], alerts: [], periodDays: null, periodBasis: '', hasPrior: false };
  const lines: FsLine[] = [];
  let basisFs = 0;
  for (const t of tbs) {
    const a = accessor(t);
    for (const r of t.rows) {
      const acct = a.t(r, 'account'); if (!acct) continue;
      const fs = a.t(r, 'fsClass');
      if (fs) basisFs++;
      const cat = classifyAccount(`${fs} ${a.t(r, 'accountName')}`);
      lines.push({ account: acct, name: a.t(r, 'accountName'), cat, current: a.n(r, 'closing') ?? 0, prior: a.has('prior') ? a.n(r, 'prior') : null, ref: { tableId: t.id, recordId: r.recordId } });
    }
  }
  const hasPrior = lines.some((l) => l.prior !== null);
  const totals = empty;
  for (const l of lines) {
    const tt = totals[l.cat];
    tt.current += l.current; tt.accounts++;
    if (l.prior !== null) tt.prior = (tt.prior ?? 0) + l.prior;
  }
  const A = (c: FsCat) => Math.abs(totals[c].current);
  const has = (c: FsCat) => totals[c].accounts > 0;

  // Period length: from GL date range, else annual if fiscal year-end configured
  let periodDays: number | null = null, periodBasis = '';
  const gl = tables.filter((t) => t.datasetType === 'gl' && t.mapping.date);
  let min = '', max = '';
  for (const t of gl) { const a = accessor(t); for (const r of t.rows) { const d = a.d(r, 'date'); if (!d) continue; if (!min || d < min) min = d; if (!max || d > max) max = d; } }
  if (min && max) { periodDays = dayDiff(min, max) + 1; periodBasis = `GL date range ${min} → ${max}`; }
  else if (s.fiscalYearEnd) { periodDays = 365; periodBasis = 'ASSUMPTION: annual TB (fiscal year-end configured)'; }

  const ca = A('cash') + A('receivables') + A('inventory') + A('otherCurrentAssets');
  const ta = ca + Math.abs(totals.nonCurrentAssets.current);
  const cl = A('currentLiabilities');
  const ebit = A('revenue') + A('otherIncome') - A('cogs') - A('opex') - A('depreciation');
  const ebitda = ebit + A('depreciation');
  const ni = ebit - A('interest') - A('taxExpense');
  const R = (id: string, en: string, ar: string, formula: string, unit: Ratio['unit'], need: FsCat[], calc: () => number, inputs: [string, number][], extraMissing?: string | null): Ratio => {
    const miss = need.filter((c) => !has(c));
    const m = extraMissing ?? (miss.length ? `INSUFFICIENT DATA — no accounts classified as ${miss.map((c) => CAT_LABEL[c].en).join(', ')}` : null);
    let v: number | null = null;
    if (!m) { const x = calc(); v = Number.isFinite(x) ? Math.round(x * 100) / 100 : null; }
    return { id, name: { en, ar }, formula, unit, value: v, inputs: inputs.map(([label, value]) => ({ label, value: m ? null : Math.round(value * 100) / 100 })), missing: m ?? (v === null ? 'Division by zero' : null) };
  };
  const pd = periodDays;
  const noPeriod = pd ? null : 'INSUFFICIENT DATA — period length unknown (upload GL or configure fiscal year-end)';
  const ratios: Ratio[] = [
    R('current', 'Current Ratio', 'نسبة التداول', 'Current assets ÷ Current liabilities', 'x', ['currentLiabilities'], () => ca / cl, [['Current assets', ca], ['Current liabilities', cl]]),
    R('quick', 'Quick Ratio', 'نسبة السيولة السريعة', '(Current assets − Inventory) ÷ Current liabilities', 'x', ['currentLiabilities'], () => (ca - A('inventory')) / cl, [['Current assets', ca], ['Inventory', A('inventory')], ['Current liabilities', cl]]),
    R('cashr', 'Cash Ratio', 'نسبة النقدية', 'Cash ÷ Current liabilities', 'x', ['cash', 'currentLiabilities'], () => A('cash') / cl, [['Cash', A('cash')], ['Current liabilities', cl]]),
    R('wc', 'Working Capital', 'رأس المال العامل', 'Current assets − Current liabilities', 'EGP', ['currentLiabilities'], () => ca - cl, [['Current assets', ca], ['Current liabilities', cl]]),
    R('dso', 'DSO', 'متوسط فترة التحصيل', 'Receivables ÷ Revenue × Period days', 'days', ['receivables', 'revenue'], () => A('receivables') / A('revenue') * pd!, [['Receivables', A('receivables')], ['Revenue', A('revenue')], ['Period days', pd ?? 0]], noPeriod),
    R('dpo', 'DPO', 'متوسط فترة السداد', 'Payables ÷ (Cost of revenue + Opex) × Period days', 'days', ['currentLiabilities'], () => cl / (A('cogs') + A('opex')) * pd!, [['Payables (current liabilities)', cl], ['Cost of revenue + Opex', A('cogs') + A('opex')], ['Period days', pd ?? 0]], noPeriod),
    R('dio', 'DIO', 'متوسط فترة التخزين', 'Inventory ÷ Cost of revenue × Period days', 'days', ['inventory', 'cogs'], () => A('inventory') / A('cogs') * pd!, [['Inventory', A('inventory')], ['Cost of revenue', A('cogs')], ['Period days', pd ?? 0]], noPeriod),
    R('gm', 'Gross Margin', 'هامش الربح الإجمالي', '(Revenue − Cost of revenue) ÷ Revenue', '%', ['revenue', 'cogs'], () => (A('revenue') - A('cogs')) / A('revenue') * 100, [['Revenue', A('revenue')], ['Cost of revenue', A('cogs')]]),
    R('om', 'Operating Margin', 'هامش التشغيل', 'EBIT ÷ Revenue', '%', ['revenue'], () => ebit / A('revenue') * 100, [['EBIT', ebit], ['Revenue', A('revenue')]]),
    R('nm', 'Net Margin', 'هامش صافي الربح', 'Net income ÷ Revenue', '%', ['revenue'], () => ni / A('revenue') * 100, [['Net income', ni], ['Revenue', A('revenue')]]),
    R('roa', 'ROA', 'العائد على الأصول', 'Net income ÷ Total assets', '%', ['revenue', 'nonCurrentAssets'], () => ni / ta * 100, [['Net income', ni], ['Total assets', ta]]),
    R('roe', 'ROE', 'العائد على حقوق الملكية', 'Net income ÷ Equity', '%', ['revenue', 'equity'], () => ni / A('equity') * 100, [['Net income', ni], ['Equity', A('equity')]]),
    R('de', 'Debt / Equity', 'الديون إلى حقوق الملكية', 'Borrowings ÷ Equity', 'x', ['debt', 'equity'], () => A('debt') / A('equity'), [['Borrowings', A('debt')], ['Equity', A('equity')]]),
    R('debitda', 'Debt / EBITDA', 'الديون إلى الأرباح قبل الفوائد والضرائب والإهلاك', 'Borrowings ÷ EBITDA', 'x', ['debt', 'revenue'], () => A('debt') / ebitda, [['Borrowings', A('debt')], ['EBITDA', ebitda]]),
    R('ic', 'Interest Coverage', 'تغطية الفوائد', 'EBIT ÷ Finance cost', 'x', ['interest', 'revenue'], () => ebit / A('interest'), [['EBIT', ebit], ['Finance cost', A('interest')]]),
  ];
  const ccc = ['dso', 'dio', 'dpo'].map((id) => ratios.find((r) => r.id === id)!);
  ratios.splice(7, 0, { id: 'ccc', name: { en: 'Cash Conversion Cycle', ar: 'دورة التحويل النقدي' }, formula: 'DSO + DIO − DPO', unit: 'days', value: ccc.every((r) => r.value !== null) ? Math.round((ccc[0].value! + ccc[1].value! - ccc[2].value!) * 100) / 100 : null, inputs: ccc.map((r) => ({ label: r.name.en, value: r.value })), missing: ccc.find((r) => r.missing)?.missing ?? null });

  // Movement alerts (horizontal analysis)
  const alerts: MovementAlert[] = [];
  if (hasPrior) {
    const pm = s.materiality.performance, tr = s.materiality.trivial;
    for (const l of lines) {
      if (l.prior === null) continue;
      const ch = l.current - l.prior;
      const pct = l.prior !== 0 ? (ch / Math.abs(l.prior)) * 100 : null;
      const big = pm ? Math.abs(ch) >= pm : false;
      const pctFlag = (pct === null ? l.current !== 0 : Math.abs(pct) >= 25) && (tr ? Math.abs(ch) > tr : true);
      if (!(big || pctFlag) || Math.abs(ch) < 0.01) continue;
      alerts.push({
        account: l.account, name: l.name, cat: l.cat, current: l.current, prior: l.prior, change: ch, pct: pct === null ? null : Math.round(pct * 10) / 10,
        materiality: pm ? (Math.abs(ch) >= pm ? `≥ performance materiality (${pm})` : `< performance materiality (${pm})`) : 'Materiality not configured — % threshold (25%) applied',
        risk: CAT_RISK[l.cat] ?? { en: 'Accuracy / classification', ar: 'الدقة / التبويب' },
        explanation: { en: 'AI INTERPRETATION: movement exceeds the analytical threshold. The cause cannot be determined from the uploaded data — obtain management\'s explanation and corroborate.', ar: 'تفسير الذكاء الاصطناعي: الحركة تتجاوز الحد التحليلي. لا يمكن تحديد السبب من البيانات المرفوعة — يجب الحصول على تفسير الإدارة وتأييده.' },
        implication: { en: big ? 'Perform substantive procedures: vouch significant postings in the movement to source documents.' : 'Perform analytical follow-up and confirm classification.', ar: big ? 'تنفيذ إجراءات تفصيلية: مطابقة القيود الجوهرية مع المستندات.' : 'متابعة تحليلية والتأكد من التبويب.' },
        ref: l.ref,
      });
    }
    alerts.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }
  return {
    available: true, reason: null,
    classificationBasis: basisFs ? `FS Classification column (${basisFs} of ${lines.length} accounts); remaining by account name keywords` : 'Account-name keywords (no FS classification column mapped) — verify classification',
    totals, lines, ratios, alerts, periodDays, periodBasis, hasPrior,
  };
}
