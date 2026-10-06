// Additional tests: month-end journals, TB balance anomalies, duplicate vendors, POs without invoice,
// post-period reversals, cash concentration, FX rate anomalies, delayed capitalization.
import type { TestException } from '../types';
import { dayDiff, fmtNum, isApproved } from '../values';
import { classifyAccount, type FsCat } from '../fsa';
import { type TestDef, type Rec, recs, insufficient, exc, amt, groupBy, keyOf, normName, median, asOf, round2, ref } from './kit';

const L = (en: string, ar: string) => ({ en, ar });
const ok = (population: number, exceptions: TestException[], params?: Record<string, string | number | null>) => ({ status: 'performed' as const, missing: [], population, exceptions, params });
const ASSET: FsCat[] = ['cash', 'receivables', 'inventory', 'otherCurrentAssets'];
const CREDIT_NATURE: FsCat[] = ['currentLiabilities', 'debt', 'otherLiabilities', 'equity', 'revenue', 'otherIncome'];
const tbCat = (x: Rec) => classifyAccount(`${x.a.t(x.r, 'fsClass')} ${x.a.t(x.r, 'accountName')}`);

export const EXTRA_TESTS: TestDef[] = [
  {
    id: 'GL-19', area: 'gl', riskId: 'R-FR-01', controlId: 'C-JE-01', severity: 'low',
    name: L('Month-end manual journals', 'قيود يدوية في نهاية الشهر'),
    objective: L('Identify manual journals dated in the last 3 days of a month.', 'تحديد القيود اليدوية المؤرخة في آخر 3 أيام من الشهر.'),
    rule: L('Source = manual AND day(Journal date) ≥ last day of month − 2', 'المصدر يدوي ويوم القيد ضمن آخر 3 أيام من الشهر'),
    criteria: L('Period-end adjustments require review and support.', 'تتطلب تسويات نهاية الفترة مراجعة ومستندات.'),
    cause: L('Possible causes: closing adjustments, accruals, results management.', 'أسباب محتملة: تسويات الإقفال أو الاستحقاقات أو إدارة النتائج.'),
    effect: L('Period-end results may be misstated.', 'احتمال تحريف نتائج نهاية الفترة.'),
    recommendation: L('Review month-end manual journals with the Financial Controller before close.', 'مراجعة القيود اليدوية لنهاية الشهر مع المراقب المالي قبل الإقفال.'),
    needs: [{ type: 'gl', fields: ['journalId', 'date', 'source', 'debit'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'date', 'source', 'debit']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [j, lines] of groupBy(list.filter((x) => /manual|mje|gj|general journal|يدوي/i.test(x.a.t(x.r, 'source'))), (x) => x.a.t(x.r, 'journalId'))) {
        const d = lines[0].a.d(lines[0].r, 'date'); if (!d) continue;
        const last = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate();
        if (+d.slice(8, 10) < last - 2) continue;
        const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
        out.push(exc(keyOf('GL-19', j), L(`Manual journal ${j} dated ${d} (month-end)`, `قيد يدوي ${j} بتاريخ ${d} (نهاية الشهر)`), lines, ['date', 'source'],
          { formula: 'Source = manual AND Day(date) ≥ DaysInMonth − 2', inputs: [{ label: L('Date', 'التاريخ'), value: d }, { label: L('Days in month', 'أيام الشهر'), value: last }], result: 'Month-end' },
          { amount: tot, currency: lines[0].a.t(lines[0].r, 'currency').toUpperCase() || (ctx.settings.assumeBaseCurrencyWhenMissing ? ctx.settings.baseCurrency : '—') }));
      }
      return ok(list.length, out);
    },
  },
  {
    id: 'GL-20', area: 'gl', riskId: 'R-FR-01', controlId: 'C-RC-02', severity: 'low',
    name: L('Old / unmoved balances', 'أرصدة قديمة بلا حركة'),
    objective: L('Identify TB accounts carrying a balance with no movement in the period.', 'تحديد حسابات الميزان التي لها رصيد بلا حركة خلال الفترة.'),
    rule: L('Closing ≠ 0 AND Debit = 0 AND Credit = 0', 'الرصيد الختامي ≠ 0 والحركة المدينة = الدائنة = 0'),
    criteria: L('Balances are reviewed and substantiated each period.', 'تتم مراجعة الأرصدة وتأييدها كل فترة.'),
    cause: L('Possible causes: stale items not cleared, obsolete accounts.', 'أسباب محتملة: بنود قديمة لم تُسوَّ أو حسابات متقادمة.'),
    effect: L('Balances may not exist or be recoverable.', 'قد لا تكون الأرصدة موجودة أو قابلة للاسترداد.'),
    recommendation: L('Substantiate or clear unmoved balances; close dormant accounts.', 'تأييد أو تسوية الأرصدة الراكدة وإغلاق الحسابات الخاملة.'),
    needs: [{ type: 'tb', fields: ['account', 'debit', 'credit', 'closing'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'tb', ['account', 'debit', 'credit', 'closing']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => Math.abs(x.a.n(x.r, 'closing') ?? 0) > 0.005 && !(x.a.n(x.r, 'debit') ?? 0) && !(x.a.n(x.r, 'credit') ?? 0)).map((x) => exc(keyOf('GL-20', x.a.t(x.r, 'account')), L(`Account ${x.a.t(x.r, 'account')} ${x.a.t(x.r, 'accountName')}: balance ${fmtNum(x.a.n(x.r, 'closing'))} with no movement`, `الحساب ${x.a.t(x.r, 'account')} ${x.a.t(x.r, 'accountName')}: رصيد ${fmtNum(x.a.n(x.r, 'closing'))} بلا حركة`), [x], ['closing', 'debit', 'credit'],
        { formula: 'Closing ≠ 0 AND Debit = 0 AND Credit = 0', inputs: [{ label: L('Closing', 'الختامي'), value: x.a.n(x.r, 'closing') }, { label: L('Debit', 'مدين'), value: x.a.n(x.r, 'debit') }, { label: L('Credit', 'دائن'), value: x.a.n(x.r, 'credit') }], result: 'Unmoved' }, { amount: Math.abs(x.a.n(x.r, 'closing')!), currency: x.a.t(x.r, 'currency').toUpperCase() || '—' }));
      return ok(list.length, out);
    },
  },
  {
    id: 'GL-21', area: 'gl', riskId: 'R-FR-01', controlId: 'C-FR-01', severity: 'medium',
    name: L('Balances against their normal side', 'أرصدة عكس طبيعتها'),
    objective: L('Identify asset accounts with credit balances and liability/equity/revenue accounts with debit balances.', 'تحديد حسابات الأصول ذات الأرصدة الدائنة وحسابات الالتزامات/حقوق الملكية/الإيرادات ذات الأرصدة المدينة.'),
    rule: L('Asset closing < 0, or credit-nature closing > 0 (debit-positive sign convention, detected from the TB)', 'أصل برصيد < 0 أو حساب دائن الطبيعة برصيد > 0 (اتجاه الإشارة يُستنتج من الميزان)'),
    criteria: L('Accounts normally carry balances on their natural side.', 'تحمل الحسابات عادة أرصدة وفق طبيعتها.'),
    cause: L('Possible causes: misposting, overpayments, unrecorded items.', 'أسباب محتملة: خطأ توجيه أو سداد زائد أو بنود غير مسجلة.'),
    effect: L('Misclassification in the financial statements.', 'سوء تبويب في القوائم المالية.'),
    recommendation: L('Investigate and reclassify abnormal balances before reporting.', 'فحص وإعادة تبويب الأرصدة غير الطبيعية قبل إعداد التقارير.'),
    needs: [{ type: 'tb', fields: ['account', 'accountName', 'closing', 'fsClass'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'tb', ['account', 'closing']); if (missing.length) return insufficient(missing);
      if (!list[0].a.has('accountName') && !list[0].a.has('fsClass')) return insufficient(['TB: Account Name or FS Classification required to determine normal balance side']);
      const assets = list.filter((x) => ASSET.includes(tbCat(x)) || (tbCat(x) === 'nonCurrentAssets' && !/accumulated|مجمع/i.test(x.a.t(x.r, 'accountName'))));
      const pos = assets.filter((x) => (x.a.n(x.r, 'closing') ?? 0) > 0).length;
      if (assets.length < 3 || pos / assets.length < 0.7) return insufficient(['Sign convention could not be determined from the TB (fewer than 70% of asset accounts are debit-positive)']);
      const out: TestException[] = [];
      for (const x of list) {
        const c = tbCat(x), v = x.a.n(x.r, 'closing') ?? 0;
        const isAsset = ASSET.includes(c) || (c === 'nonCurrentAssets' && !/accumulated|مجمع/i.test(x.a.t(x.r, 'accountName')));
        const bad = (isAsset && v < -0.005) || (CREDIT_NATURE.includes(c) && v > 0.005);
        if (bad) out.push(exc(keyOf('GL-21', x.a.t(x.r, 'account')), L(`Account ${x.a.t(x.r, 'account')} ${x.a.t(x.r, 'accountName')} (${c}) closing ${fmtNum(v)}`, `الحساب ${x.a.t(x.r, 'account')} ${x.a.t(x.r, 'accountName')} رصيده ${fmtNum(v)} عكس طبيعته`), [x], ['closing', 'accountName', 'fsClass'],
          { formula: isAsset ? 'Asset AND Closing < 0' : 'Credit-nature AND Closing > 0', inputs: [{ label: L('Category', 'الفئة'), value: c }, { label: L('Closing', 'الختامي'), value: v }], result: 'Abnormal side' }, { amount: Math.abs(v), currency: x.a.t(x.r, 'currency').toUpperCase() || '—' }));
      }
      return ok(list.length, out, { signConvention: `Debit-positive (${pos}/${assets.length} asset accounts positive)` });
    },
  },
  {
    id: 'AP-18', area: 'ap', riskId: 'R-FD-02', controlId: 'C-VM-01', severity: 'medium', fraud: true,
    name: L('Duplicate vendors in vendor master', 'موردون مكررون في البيانات الرئيسية'),
    objective: L('Detect vendors registered more than once (same normalized name, tax ID or phone under different vendor IDs).', 'كشف الموردين المسجلين أكثر من مرة (نفس الاسم أو الرقم الضريبي أو الهاتف بأرقام مختلفة).'),
    rule: L('Count(distinct Vendor ID | normalized name OR tax ID OR phone) > 1', 'عدد أرقام الموردين لنفس الاسم أو الرقم الضريبي أو الهاتف > 1'),
    criteria: L('Unique vendor master records.', 'تفرد سجلات الموردين.'),
    cause: L('Possible causes: weak onboarding checks, intentional duplicates to bypass controls.', 'أسباب محتملة: ضعف فحوص التسجيل أو تكرار متعمد لتجاوز الضوابط.'),
    effect: L('Duplicate payments; circumvention of vendor limits.', 'مدفوعات مكررة وتجاوز حدود الموردين.'),
    recommendation: L('Merge or block duplicates after verification; add duplicate checks at onboarding.', 'دمج أو إيقاف المكرر بعد التحقق وإضافة فحص التكرار عند التسجيل.'),
    needs: [{ type: 'vendors', fields: ['vendor', 'vendorId', 'taxId', 'phone'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'vendors', ['vendor']); if (missing.length) return insufficient(missing);
      const out: TestException[] = []; const seen = new Set<string>();
      const idOf = (x: Rec) => x.a.t(x.r, 'vendorId') || x.r.recordId;
      for (const [field, keyFn] of [['vendor', (x: Rec) => normName(x.a.t(x.r, 'vendor'))], ['taxId', (x: Rec) => x.a.t(x.r, 'taxId').replace(/\D/g, '')], ['phone', (x: Rec) => x.a.t(x.r, 'phone').replace(/\D/g, '').slice(-9)]] as const) {
        if (field !== 'vendor' && !list[0].a.has(field)) continue;
        for (const [k, items] of groupBy(list, keyFn)) {
          if (k.length < 4) continue;
          const ids = [...new Set(items.map(idOf))]; if (ids.length < 2) continue;
          const sig = ids.sort().join('|'); if (seen.has(sig)) continue; seen.add(sig);
          out.push(exc(keyOf('AP-18', field, k), L(`${ids.length} vendor records share the same ${field === 'vendor' ? 'name' : field}: ${items.map((i) => i.a.t(i.r, 'vendor')).join(' / ')}`, `${ids.length} سجلات موردين بنفس ${field === 'vendor' ? 'الاسم' : field === 'taxId' ? 'الرقم الضريبي' : 'الهاتف'}: ${items.map((i) => i.a.t(i.r, 'vendor')).join(' / ')}`), items, [field, 'vendorId'],
            { formula: `Count(distinct Vendor ID | ${field}) > 1`, inputs: items.map((i) => ({ label: L('Vendor ID', 'رقم المورد'), value: idOf(i), ref: ref(i) })), result: ids.length }));
        }
      }
      return ok(list.length, out);
    },
  },
  {
    id: 'PR-10', area: 'procurement', riskId: 'R-OP-02', controlId: 'C-AP-03', severity: 'low',
    name: L('Purchase orders without invoice', 'أوامر شراء بدون فواتير'),
    objective: L('Identify approved POs older than 90 days with no matching AP invoice.', 'تحديد أوامر الشراء المعتمدة الأقدم من 90 يومًا بلا فاتورة مطابقة.'),
    rule: L('PO date < As-of − 90 days AND PO number ∉ AP invoices', 'تاريخ الأمر أقدم من 90 يومًا ورقم الأمر غير موجود بالفواتير'),
    criteria: L('Open commitments are reviewed and closed when no longer required.', 'مراجعة الالتزامات المفتوحة وإغلاقها عند انتفاء الحاجة.'),
    cause: L('Possible causes: unreceived goods, unrecorded liabilities, stale commitments.', 'أسباب محتملة: بضائع لم تُستلم أو التزامات غير مسجلة أو التزامات قديمة.'),
    effect: L('Unrecorded liabilities or overstated commitments.', 'التزامات غير مسجلة أو تضخيم الارتباطات.'),
    recommendation: L('Review open POs; accrue received goods and close stale POs.', 'مراجعة أوامر الشراء المفتوحة وتسجيل استحقاق المستلم وإغلاق القديم.'),
    needs: [{ type: 'procurement', fields: ['poNo', 'poDate', 'amount'] }, { type: 'ap', fields: ['poNo'] }],
    run(ctx) {
      const p = recs(ctx, 'procurement', ['poNo', 'poDate', 'amount']); if (p.missing.length) return insufficient(p.missing);
      const ap = recs(ctx, 'ap', ['poNo']); if (ap.missing.length) return insufficient(ap.missing);
      const invoiced = new Set(ap.list.map((x) => x.a.t(x.r, 'poNo').toUpperCase()).filter(Boolean));
      const ao = asOf(p.list, 'poDate', ctx.settings);
      const out = p.list.filter((x) => { const d = x.a.d(x.r, 'poDate'); return d && ao && dayDiff(d, ao) > 90 && isApproved(x.a.t(x.r, 'approval')) !== false && !invoiced.has(x.a.t(x.r, 'poNo').toUpperCase()); })
        .map((x) => exc(keyOf('PR-10', x.a.t(x.r, 'poNo')), L(`PO ${x.a.t(x.r, 'poNo')} dated ${x.a.d(x.r, 'poDate')} has no invoice`, `أمر الشراء ${x.a.t(x.r, 'poNo')} بتاريخ ${x.a.d(x.r, 'poDate')} بلا فاتورة`), [x], ['poNo', 'poDate'],
          { formula: 'As-of − PO date > 90 AND PO ∉ AP.PO', inputs: [{ label: L('PO date', 'تاريخ الأمر'), value: x.a.d(x.r, 'poDate') }, { label: L('As-of', 'التقييم'), value: ao }], result: dayDiff(x.a.d(x.r, 'poDate')!, ao!) }, amt(x, 'amount', ctx.settings)));
      return ok(p.list.length, out, { asOf: ao });
    },
  },
  {
    id: 'AR-07', area: 'ar', riskId: 'R-FR-01', controlId: 'C-AR-02', severity: 'high',
    name: L('Post-period reversals (revenue cut-off)', 'عكس بعد نهاية الفترة (الفصل بين الفترات للإيراد)'),
    objective: L('Identify invoices issued in the last 10 days before year-end that are reversed by credit notes within 30 days after year-end.', 'تحديد الفواتير الصادرة في آخر 10 أيام قبل نهاية السنة والمعكوسة بإشعارات دائنة خلال 30 يومًا بعدها.'),
    rule: L('Invoice date ∈ [FYE−10, FYE] AND credit note for same customer and amount ∈ (FYE, FYE+30]', 'فاتورة قبل نهاية السنة بـ10 أيام يقابلها إشعار دائن لنفس العميل والمبلغ خلال 30 يومًا بعدها'),
    criteria: L('Revenue is recognized in the correct period.', 'الاعتراف بالإيراد في الفترة الصحيحة.'),
    cause: L('Possible causes: premature revenue recognition, window dressing.', 'أسباب محتملة: الاعتراف المبكر بالإيراد أو تجميل القوائم.'),
    effect: L('Revenue and receivables overstated at year-end.', 'تضخيم الإيرادات والمديونيات في نهاية السنة.'),
    recommendation: L('Reverse cut-off errors and tighten year-end invoicing review.', 'تصحيح أخطاء الفصل وتشديد مراجعة فوترة نهاية السنة.'),
    needs: [{ type: 'ar', fields: ['customer', 'invoiceNo', 'amount', 'invoiceDate', 'docType'] }],
    run(ctx) {
      const fye = ctx.settings.fiscalYearEnd; if (!/^\d{2}-\d{2}$/.test(fye)) return insufficient(['Fiscal year-end not configured (Settings)']);
      const { list, missing } = recs(ctx, 'ar', ['customer', 'invoiceNo', 'amount', 'invoiceDate']); if (missing.length) return insufficient(missing);
      const isCN = (x: Rec) => /credit|cn|اشعار دائن|إشعار دائن/i.test(x.a.t(x.r, 'docType')) || (x.a.n(x.r, 'amount') ?? 0) < 0;
      const cns = list.filter(isCN), invs = list.filter((x) => !isCN(x));
      const out: TestException[] = [];
      for (const inv of invs) {
        const d = inv.a.d(inv.r, 'invoiceDate'); if (!d) continue;
        const end = `${d.slice(0, 4)}-${fye}`; const g = dayDiff(d, end);
        if (g < 0 || g > 10) continue;
        const a = Math.abs(inv.a.n(inv.r, 'amount') ?? 0);
        const cn = cns.find((c) => { const cd = c.a.d(c.r, 'invoiceDate'); return cd && normName(c.a.t(c.r, 'customer')) === normName(inv.a.t(inv.r, 'customer')) && Math.abs(Math.abs(c.a.n(c.r, 'amount') ?? 0) - a) < 0.01 && dayDiff(end, cd) > 0 && dayDiff(end, cd) <= 30; });
        if (cn) out.push(exc(keyOf('AR-07', inv.a.t(inv.r, 'invoiceNo')), L(`Invoice ${inv.a.t(inv.r, 'invoiceNo')} (${d}) reversed by ${cn.a.t(cn.r, 'invoiceNo')} (${cn.a.d(cn.r, 'invoiceDate')}) after year-end ${end}`, `الفاتورة ${inv.a.t(inv.r, 'invoiceNo')} (${d}) عُكست بـ ${cn.a.t(cn.r, 'invoiceNo')} بعد نهاية السنة ${end}`), [inv, cn], [['invoiceDate', 'amount'], ['invoiceDate', 'amount', 'docType']],
          { formula: 'FYE − 10 ≤ Invoice date ≤ FYE AND FYE < CN date ≤ FYE + 30 AND |CN| = Invoice', inputs: [{ label: L('Invoice', 'الفاتورة'), value: d, ref: ref(inv) }, { label: L('Credit note', 'الإشعار'), value: cn.a.d(cn.r, 'invoiceDate'), ref: ref(cn) }, { label: L('Amount', 'المبلغ'), value: a }], result: 'Post-period reversal' }, amt(inv, 'amount', ctx.settings)));
      }
      return ok(invs.length, out, { fiscalYearEnd: fye });
    },
  },
  {
    id: 'TR-08', area: 'treasury', riskId: 'R-FN-01', controlId: 'C-TR-01', severity: 'low',
    name: L('Excess cash concentration', 'تركز النقدية'),
    objective: L('Identify bank accounts holding a disproportionate share of cash (counterparty / idle-cash exposure).', 'تحديد الحسابات البنكية التي تحتفظ بحصة كبيرة من النقدية (تعرض للطرف المقابل / نقدية عاطلة).'),
    rule: L('Latest balance(account) ÷ Σ latest balances (same currency) ≥ concentration threshold %, with ≥ 2 accounts', 'رصيد الحساب ÷ إجمالي الأرصدة ≥ حد التركز مع وجود حسابين على الأقل'),
    criteria: L('Treasury policy on bank counterparty limits (to be provided).', 'سياسة الخزانة لحدود البنوك (يتم تقديمها).'),
    cause: L('Cash placement decisions.', 'قرارات توظيف النقدية.'), effect: L('Counterparty risk; lost investment income.', 'مخاطر الطرف المقابل وفقدان عائد الاستثمار.'),
    recommendation: L('Review bank exposure against approved counterparty limits and investment policy.', 'مراجعة التعرض للبنوك مقابل الحدود المعتمدة وسياسة الاستثمار.'),
    needs: [{ type: 'bank', fields: ['bankAccount', 'date', 'balance'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'bank', ['bankAccount', 'balance']); if (missing.length) return insufficient(missing);
      const last: Rec[] = [];
      for (const [, items] of groupBy(list, (x) => x.a.t(x.r, 'bankAccount'))) last.push([...items].sort((a, b) => (a.a.d(a.r, 'date') ?? '').localeCompare(b.a.d(b.r, 'date') ?? '') || a.r.rowNumber - b.r.rowNumber).pop()!);
      const out: TestException[] = [];
      for (const [cur, items] of groupBy(last, (x) => x.a.t(x.r, 'currency').toUpperCase() || '—')) {
        if (items.length < 2) continue;
        const tot = items.reduce((s, x) => s + Math.max(0, x.a.n(x.r, 'balance') ?? 0), 0); if (!tot) continue;
        for (const x of items) { const v = Math.max(0, x.a.n(x.r, 'balance') ?? 0); const sh = v / tot * 100; if (sh >= ctx.settings.concentrationPct) out.push(exc(keyOf('TR-08', x.a.t(x.r, 'bankAccount')), L(`Account ••••${x.a.t(x.r, 'bankAccount').slice(-4)} (${x.a.t(x.r, 'bank')}) holds ${sh.toFixed(1)}% of ${cur} cash`, `الحساب ••••${x.a.t(x.r, 'bankAccount').slice(-4)} يحتفظ بـ ${sh.toFixed(1)}% من النقدية (${cur})`), [x], ['balance', 'bankAccount'], { formula: 'Share = Balance ÷ Σ balances', inputs: [{ label: L('Balance', 'الرصيد'), value: v }, { label: L('Total', 'الإجمالي'), value: round2(tot) }], result: `${sh.toFixed(2)}%` })); }
      }
      return ok(last.length, out, { accounts: last.length, concentrationPct: ctx.settings.concentrationPct });
    },
  },
  {
    id: 'TR-09', area: 'treasury', riskId: 'R-FN-03', controlId: 'C-TR-01', severity: 'medium',
    name: L('FX rate anomalies', 'تشوهات أسعار الصرف'),
    objective: L('Identify foreign-currency invoices whose implied EGP rate deviates > 10% from the median rate for that currency and month.', 'تحديد فواتير العملات الأجنبية التي ينحرف سعر صرفها الضمني > 10% عن وسيط العملة والشهر.'),
    rule: L('Implied rate = EGP equivalent ÷ Amount; |rate − median(currency, month)| ÷ median > 10%', 'السعر الضمني = المعادل ÷ المبلغ؛ الانحراف عن الوسيط > 10%'),
    criteria: L('Consistent, authorized exchange rates (rates are derived only from uploaded data).', 'أسعار صرف متسقة ومعتمدة (تُستنتج من البيانات المرفوعة فقط).'),
    cause: L('Possible causes: wrong rate entry, manipulation of translation.', 'أسباب محتملة: إدخال سعر خاطئ أو تلاعب في التحويل.'), effect: L('FX gains/losses misstated.', 'تحريف أرباح/خسائر فروق العملة.'),
    recommendation: L('Validate rates against the official source used by Treasury; lock rate tables in the ERP.', 'مطابقة الأسعار مع المصدر الرسمي للخزانة وتأمين جداول الأسعار في النظام.'),
    needs: [{ type: 'ap', fields: ['invoiceNo', 'amount', 'currency', 'egp', 'invoiceDate'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['invoiceNo', 'amount', 'currency', 'egp', 'invoiceDate']); if (missing.length) return insufficient(missing);
      const fx = list.map((x) => ({ x, c: x.a.t(x.r, 'currency').toUpperCase(), m: (x.a.d(x.r, 'invoiceDate') ?? '').slice(0, 7), r: (x.a.n(x.r, 'egp') ?? 0) / (x.a.n(x.r, 'amount') || NaN) })).filter((y) => y.c && y.c !== 'EGP' && Number.isFinite(y.r) && y.r > 0);
      const out: TestException[] = [];
      for (const [, g] of groupBy(fx, (y) => `${y.c}|${y.m}`)) {
        if (g.length < 3) continue;
        const med = median(g.map((y) => y.r));
        for (const y of g) if (Math.abs(y.r - med) / med > 0.1) out.push(exc(keyOf('TR-09', y.x.a.t(y.x.r, 'invoiceNo')), L(`Invoice ${y.x.a.t(y.x.r, 'invoiceNo')} ${y.c} rate ${y.r.toFixed(4)} vs median ${med.toFixed(4)} (${y.m})`, `الفاتورة ${y.x.a.t(y.x.r, 'invoiceNo')} سعر ${y.r.toFixed(4)} مقابل وسيط ${med.toFixed(4)}`), [y.x], ['amount', 'egp', 'currency'],
          { formula: 'Rate = EGP equivalent ÷ Amount; Deviation = |Rate − Median| ÷ Median', inputs: [{ label: L('Amount', 'المبلغ'), value: y.x.a.n(y.x.r, 'amount') }, { label: L('EGP equivalent', 'المعادل'), value: y.x.a.n(y.x.r, 'egp') }, { label: L('Median rate', 'الوسيط'), value: round2(med * 10000) / 10000 }], result: `${round2(Math.abs(y.r - med) / med * 100)}%` }, { amount: Math.abs((y.r - med) * (y.x.a.n(y.x.r, 'amount') ?? 0)), currency: 'EGP' }));
      }
      return ok(fx.length, out);
    },
  },
  {
    id: 'CX-03', area: 'capex', riskId: 'R-FN-06', controlId: 'C-CX-01', severity: 'medium',
    name: L('Delayed capitalization (CWIP aging)', 'تأخر الرسملة (أعمار المشروعات تحت التنفيذ)'),
    objective: L('Identify projects under construction older than 12 months that may be complete, delayed or abandoned.', 'تحديد المشروعات تحت التنفيذ الأقدم من 12 شهرًا التي قد تكون مكتملة أو متأخرة أو متوقفة.'),
    rule: L('Category ∈ CWIP / under construction AND As-of − Acquisition date > 365', 'الفئة مشروعات تحت التنفيذ وعمرها > 365 يومًا'),
    criteria: L('Assets are capitalized and depreciated when available for use; abandoned projects are impaired.', 'رسملة الأصول وإهلاكها عند الجاهزية والاعتراف باضمحلال المشروعات المتوقفة.'),
    cause: L('Possible causes: delayed project close-out, abandoned projects.', 'أسباب محتملة: تأخر إقفال المشروعات أو توقفها.'), effect: L('Depreciation understated; impairment not recognized.', 'نقص الإهلاك وعدم الاعتراف بالاضمحلال.'),
    recommendation: L('Review CWIP status with project owners; capitalize completed assets and impair abandoned ones.', 'مراجعة حالة المشروعات مع مسؤوليها ورسملة المكتمل والاعتراف باضمحلال المتوقف.'),
    needs: [{ type: 'fa', fields: ['assetId', 'cost', 'category', 'acqDate'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'fa', ['cost', 'category', 'acqDate']); if (missing.length) return insufficient(missing);
      const ao = asOf(list, 'acqDate', ctx.settings);
      const cw = list.filter((x) => /cwip|work in progress|under construction|مشروعات تحت التنفيذ|تحت الانشاء|تحت الإنشاء/i.test(x.a.t(x.r, 'category')));
      const out = cw.filter((x) => { const d = x.a.d(x.r, 'acqDate'); return d && ao && dayDiff(d, ao) > 365; }).map((x) => exc(keyOf('CX-03', x.a.t(x.r, 'assetId') || x.r.recordId), L(`CWIP ${x.a.t(x.r, 'assetId')} ${x.a.t(x.r, 'description')} open since ${x.a.d(x.r, 'acqDate')}`, `مشروع تحت التنفيذ ${x.a.t(x.r, 'assetId')} مفتوح منذ ${x.a.d(x.r, 'acqDate')}`), [x], ['category', 'acqDate'],
        { formula: 'As-of − Start date > 365', inputs: [{ label: L('Start', 'البداية'), value: x.a.d(x.r, 'acqDate') }, { label: L('As-of', 'التقييم'), value: ao }], result: dayDiff(x.a.d(x.r, 'acqDate')!, ao!) }, amt(x, 'cost', ctx.settings)));
      return ok(cw.length, out, { asOf: ao });
    },
  },
];
