// AR, Treasury/Bank, Fixed Assets and Inventory tests
import type { TestException } from '../types';
import { weekday, dayDiff, fmtNum } from '../values';
import { type TestDef, type Rec, recs, insufficient, exc, amt, groupBy, isRound, keyOf, concentration, median, asOf, round2, ref, normName } from './kit';

const L = (en: string, ar: string) => ({ en, ar });
const ok = (population: number, exceptions: TestException[], params?: Record<string, string | number | null>) => ({ status: 'performed' as const, missing: [], population, exceptions, params });

// ───────────────────────────── Accounts receivable
const ar = { area: 'ar' as const, riskId: 'R-FN-02', controlId: 'C-AR-01' };
const arAmt = (x: Rec, s: Parameters<typeof amt>[2]) => amt(x, x.a.has('outstanding') ? 'outstanding' : 'amount', s);

export const AR_TESTS: TestDef[] = [
  {
    ...ar, id: 'AR-01', severity: 'medium',
    name: L('Overdue receivables', 'مديونيات متأخرة'),
    objective: L('Identify receivables overdue beyond the configured threshold.', 'تحديد المديونيات المتأخرة عن الحد المحدد.'),
    rule: L('Days past due = As-of date − Due date > Overdue days (or Aging > Overdue days)', 'أيام التأخير = تاريخ التقييم − تاريخ الاستحقاق > حد التأخير'),
    criteria: L('Credit policy and expected-credit-loss assessment.', 'سياسة الائتمان وتقييم الخسائر الائتمانية المتوقعة.'),
    cause: L('Possible causes: weak collection follow-up, customer disputes.', 'أسباب محتملة: ضعف متابعة التحصيل أو نزاعات العملاء.'),
    effect: L('Liquidity pressure; impairment may be understated.', 'ضغط على السيولة واحتمال انخفاض مخصص الاضمحلال.'),
    recommendation: L('Escalate overdue accounts; reassess impairment allowance.', 'تصعيد الحسابات المتأخرة وإعادة تقييم مخصص الاضمحلال.'),
    needs: [{ type: 'ar', fields: ['customer', 'invoiceNo', 'amount', 'dueDate'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'ar', ['customer', 'invoiceNo', 'amount']);
      if (missing.length) return insufficient(missing);
      const useAging = list[0].a.has('aging');
      if (!useAging && !list[0].a.has('dueDate')) return insufficient(['AR: Due date or Aging field required']);
      const ao = useAging ? null : asOf(list, 'invoiceDate', ctx.settings) ?? asOf(list, 'dueDate', ctx.settings);
      const out: TestException[] = [];
      for (const x of list) {
        const out$ = x.a.has('outstanding') ? x.a.n(x.r, 'outstanding') : x.a.n(x.r, 'amount');
        if (!out$ || out$ <= 0) continue;
        const days = useAging ? x.a.n(x.r, 'aging') : (x.a.d(x.r, 'dueDate') && ao ? dayDiff(x.a.d(x.r, 'dueDate')!, ao) : null);
        if (days !== null && days > ctx.settings.overdueDays) out.push(exc(keyOf('AR-01', x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} (${x.a.t(x.r, 'customer')}) overdue ${days} days`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} (${x.a.t(x.r, 'customer')}) متأخرة ${days} يومًا`), [x], useAging ? ['aging', 'outstanding'] : ['dueDate', 'outstanding'],
          { formula: useAging ? 'Aging > Overdue days' : 'As-of − Due date > Overdue days', inputs: [{ label: L('Days', 'الأيام'), value: days }, { label: L('As-of', 'تاريخ التقييم'), value: ao }, { label: L('Threshold', 'الحد'), value: ctx.settings.overdueDays }], result: days }, arAmt(x, ctx.settings)));
      }
      return ok(list.length, out, { overdueDays: ctx.settings.overdueDays, asOf: ao });
    },
  },
  {
    ...ar, id: 'AR-02', severity: 'low', riskId: 'R-FN-02',
    name: L('Customer concentration', 'تركز العملاء'),
    objective: L('Identify dependency on individual customers.', 'تحديد الاعتماد على عملاء بعينهم.'),
    rule: L('Customer share of receivables ≥ concentration threshold %', 'حصة العميل من المديونيات ≥ حد التركز'),
    criteria: L('Credit-risk concentration limits.', 'حدود تركز مخاطر الائتمان.'),
    cause: L('Business model concentration.', 'تركز نموذج الأعمال.'),
    effect: L('Credit and revenue dependency risk.', 'مخاطر الاعتماد الائتماني والإيرادي.'),
    recommendation: L('Monitor exposure and obtain guarantees for concentrated customers.', 'مراقبة التعرض والحصول على ضمانات للعملاء المركزين.'),
    needs: [{ type: 'ar', fields: ['customer', 'amount'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'ar', ['customer', 'amount']); if (missing.length) return insufficient(missing); return concentration(ctx, list, 'customer', 'amount', L('Customer', 'العميل')); },
  },
  {
    ...ar, id: 'AR-03', severity: 'medium', controlId: 'C-AR-02',
    name: L('Credit notes and write-offs', 'إشعارات دائنة وإعدامات'),
    objective: L('Identify credit notes / write-offs for authorization review.', 'تحديد الإشعارات الدائنة والإعدامات لمراجعة اعتمادها.'),
    rule: L('Document type ∈ {credit note, write-off} OR negative invoice amount', 'نوع المستند إشعار دائن/إعدام أو مبلغ سالب'),
    criteria: L('Credit notes and write-offs require separate authorization.', 'تتطلب الإشعارات الدائنة والإعدامات اعتمادًا منفصلًا.'),
    cause: L('Possible causes: disputes, pricing errors, concealment of misappropriation (lapping).', 'أسباب محتملة: نزاعات أو أخطاء تسعير أو إخفاء اختلاس.'),
    effect: L('Revenue reduction; potential concealment.', 'تخفيض الإيرادات واحتمال الإخفاء.'),
    recommendation: L('Verify approval and business reason for each credit note / write-off.', 'التحقق من اعتماد وسبب كل إشعار دائن أو إعدام.'),
    needs: [{ type: 'ar', fields: ['customer', 'invoiceNo', 'amount', 'docType'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'ar', ['customer', 'invoiceNo', 'amount']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => /credit|write|cn|اشعار دائن|اعدام/i.test(x.a.t(x.r, 'docType')) || (x.a.n(x.r, 'amount') ?? 0) < 0).map((x) => exc(keyOf('AR-03', x.a.t(x.r, 'invoiceNo')), L(`${x.a.t(x.r, 'docType') || 'Negative invoice'} ${x.a.t(x.r, 'invoiceNo')} for ${x.a.t(x.r, 'customer')}`, `${x.a.t(x.r, 'docType') || 'فاتورة سالبة'} ${x.a.t(x.r, 'invoiceNo')} للعميل ${x.a.t(x.r, 'customer')}`), [x], ['docType', 'amount'], { formula: 'Type = credit/write-off OR Amount < 0', inputs: [{ label: L('Type', 'النوع'), value: x.a.t(x.r, 'docType') }, { label: L('Amount', 'المبلغ'), value: x.a.n(x.r, 'amount') }], result: 'Flag' }, amt(x, 'amount', ctx.settings)));
      return ok(list.length, out);
    },
  },
  {
    ...ar, id: 'AR-04', severity: 'medium', controlId: 'C-AR-01',
    name: L('Duplicate customer invoices', 'فواتير عملاء مكررة'),
    objective: L('Detect invoice numbers recorded more than once.', 'كشف أرقام الفواتير المسجلة أكثر من مرة.'),
    rule: L('Count(invoice number) > 1', 'تكرار رقم الفاتورة > 1'),
    criteria: L('Invoice numbering is unique and sequential.', 'ترقيم الفواتير فريد ومتسلسل.'),
    cause: L('Possible causes: interface duplication, manual re-entry.', 'أسباب محتملة: تكرار الربط أو إعادة الإدخال اليدوي.'),
    effect: L('Revenue and receivables overstated.', 'تضخيم الإيرادات والمديونيات.'),
    recommendation: L('Correct duplicates and enforce unique invoice numbering.', 'تصحيح المكرر وفرض الترقيم الفريد.'),
    needs: [{ type: 'ar', fields: ['customer', 'invoiceNo', 'amount'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'ar', ['customer', 'invoiceNo', 'amount']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [k, items] of groupBy(list.filter((x) => !/credit|cn/i.test(x.a.t(x.r, 'docType'))), (x) => x.a.t(x.r, 'invoiceNo'))) if (items.length > 1) { const m = amt(items[0], 'amount', ctx.settings); out.push(exc(keyOf('AR-04', k), L(`Invoice ${k} appears ${items.length} times`, `الفاتورة ${k} تظهر ${items.length} مرات`), items, ['invoiceNo'], { formula: 'Count(invoice no.) > 1', inputs: [{ label: L('Invoice', 'الفاتورة'), value: k }], result: items.length }, m ? { amount: Math.abs(m.amount) * (items.length - 1), currency: m.currency } : null)); }
      return ok(list.length, out);
    },
  },
  {
    ...ar, id: 'AR-05', severity: 'low', controlId: 'C-AR-03',
    name: L('Unusual credit terms', 'شروط ائتمان غير معتادة'),
    objective: L('Identify customers granted credit terms far above the norm.', 'تحديد العملاء الممنوحين شروط ائتمان أعلى بكثير من المعتاد.'),
    rule: L('Credit terms > 2 × median credit terms', 'مدة الائتمان > ضعف الوسيط'),
    criteria: L('Credit terms per approved credit policy.', 'شروط الائتمان وفق السياسة المعتمدة.'),
    cause: L('Possible causes: unapproved concessions, related-party favouritism.', 'أسباب محتملة: تنازلات غير معتمدة أو محاباة أطراف ذات علاقة.'),
    effect: L('Increased credit risk.', 'زيادة مخاطر الائتمان.'),
    recommendation: L('Confirm approval for non-standard terms.', 'التأكد من اعتماد الشروط غير القياسية.'),
    needs: [{ type: 'ar', fields: ['customer', 'creditTerms'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'ar', ['customer', 'creditTerms']); if (missing.length) return insufficient(missing);
      const vals = list.map((x) => x.a.n(x.r, 'creditTerms')).filter((v): v is number => v !== null && v > 0);
      const med = median(vals); if (!med) return ok(list.length, []);
      const seen = new Set<string>(); const out: TestException[] = [];
      for (const x of list) { const v = x.a.n(x.r, 'creditTerms'); const c = x.a.t(x.r, 'customer'); if (v && v > 2 * med && !seen.has(c)) { seen.add(c); out.push(exc(keyOf('AR-05', c), L(`${c}: ${v} days vs median ${med}`, `${c}: ${v} يومًا مقابل وسيط ${med}`), [x], ['creditTerms'], { formula: 'Terms > 2 × Median', inputs: [{ label: L('Terms', 'المدة'), value: v }, { label: L('Median', 'الوسيط'), value: med }], result: round2(v / med) })); } }
      return ok(list.length, out, { median: med });
    },
  },
  {
    ...ar, id: 'AR-06', severity: 'medium', controlId: 'C-AR-01',
    name: L('Collections exceeding invoice / credit balances', 'تحصيل يتجاوز الفاتورة / أرصدة دائنة'),
    objective: L('Identify over-collections and negative outstanding balances.', 'تحديد التحصيل الزائد والأرصدة القائمة السالبة.'),
    rule: L('Collected > Amount OR Outstanding < 0', 'المحصل > المبلغ أو الرصيد القائم < 0'),
    criteria: L('Receipts are applied to the correct invoices.', 'تطبيق المتحصلات على الفواتير الصحيحة.'),
    cause: L('Possible causes: misapplied cash, duplicate receipts.', 'أسباب محتملة: سوء تطبيق المتحصلات أو تكرارها.'),
    effect: L('Misstated receivables; refund liability.', 'تحريف المديونيات والتزام برد المبالغ.'),
    recommendation: L('Reconcile customer accounts and correct misapplied receipts.', 'مطابقة حسابات العملاء وتصحيح المتحصلات.'),
    needs: [{ type: 'ar', fields: ['invoiceNo', 'amount', 'collected', 'outstanding'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'ar', ['invoiceNo', 'amount']); if (missing.length) return insufficient(missing);
      if (!list[0].a.has('collected') && !list[0].a.has('outstanding')) return insufficient(['AR: Collections or Outstanding field required']);
      const out: TestException[] = [];
      for (const x of list) {
        const a = x.a.n(x.r, 'amount') ?? 0, c = x.a.n(x.r, 'collected'), o = x.a.n(x.r, 'outstanding');
        if ((c !== null && a > 0 && c > a + 0.01) || (o !== null && o < -0.01)) out.push(exc(keyOf('AR-06', x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')}: amount ${fmtNum(a)}, collected ${fmtNum(c)}, outstanding ${fmtNum(o)}`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')}: المبلغ ${fmtNum(a)}، المحصل ${fmtNum(c)}، القائم ${fmtNum(o)}`), [x], ['amount', 'collected', 'outstanding'], { formula: 'Collected > Amount OR Outstanding < 0', inputs: [{ label: L('Amount', 'المبلغ'), value: a }, { label: L('Collected', 'المحصل'), value: c }, { label: L('Outstanding', 'القائم'), value: o }], result: round2((c ?? a) - a || (o ?? 0)) }, { amount: Math.abs(c !== null && c > a ? c - a : o ?? 0), currency: amt(x, 'amount', ctx.settings)?.currency ?? '—' }));
      }
      return ok(list.length, out);
    },
  },
];

// ───────────────────────────── Bank & Treasury
const tr = { area: 'treasury' as const, riskId: 'R-FN-01', controlId: 'C-TR-01' };
const bankAmt = (x: Rec) => (x.a.n(x.r, 'debit') ?? 0) || (x.a.n(x.r, 'credit') ?? 0);
const bankMoney = (x: Rec, s: Parameters<typeof amt>[2]) => { const c = x.a.t(x.r, 'currency').toUpperCase(); return { amount: Math.abs(bankAmt(x)), currency: c || (s.assumeBaseCurrencyWhenMissing ? s.baseCurrency : '—') }; };
const counterparty = (x: Rec) => x.a.t(x.r, 'beneficiary') || x.a.t(x.r, 'description');

export const TR_TESTS: TestDef[] = [
  {
    ...tr, id: 'TR-01', severity: 'high', fraud: true, riskId: 'R-FD-01', controlId: 'C-PY-02',
    name: L('Duplicate bank payments', 'مدفوعات بنكية مكررة'),
    objective: L('Detect identical outgoing payments within 3 days.', 'كشف مدفوعات صادرة متطابقة خلال 3 أيام.'),
    rule: L('Same account + debit amount + beneficiary/description within 3 days', 'نفس الحساب والمبلغ المدين والمستفيد/البيان خلال 3 أيام'),
    criteria: L('Each obligation is paid once.', 'يُسدد كل التزام مرة واحدة.'),
    cause: L('Possible causes: payment file re-sent, manual duplicate.', 'أسباب محتملة: إعادة إرسال ملف المدفوعات أو تكرار يدوي.'),
    effect: L('Cash loss.', 'خسارة نقدية.'),
    recommendation: L('Recover duplicates; enable duplicate checks in payment files.', 'استرداد المكرر وتفعيل فحص التكرار في ملفات السداد.'),
    needs: [{ type: 'bank', fields: ['bankAccount', 'date', 'debit', 'description'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'bank', ['bankAccount', 'date', 'debit']); if (missing.length) return insufficient(missing);
      const outs = list.filter((x) => (x.a.n(x.r, 'debit') ?? 0) > 0);
      const g = groupBy(outs, (x) => keyOf(x.a.t(x.r, 'bankAccount'), x.a.n(x.r, 'debit'), counterparty(x).toLowerCase()));
      const out: TestException[] = [];
      for (const [k, items] of g) {
        if (items.length < 2) continue;
        const s = items.sort((a, b) => (a.a.d(a.r, 'date') ?? '').localeCompare(b.a.d(b.r, 'date') ?? ''));
        for (let i = 1; i < s.length; i++) {
          const d1 = s[i - 1].a.d(s[i - 1].r, 'date'), d2 = s[i].a.d(s[i].r, 'date');
          if (d1 && d2 && dayDiff(d1, d2) <= 3) out.push(exc(keyOf('TR-01', k, d2), L(`Payment ${fmtNum(bankAmt(s[i]))} to "${counterparty(s[i])}" repeated within ${dayDiff(d1, d2)} days`, `دفعة ${fmtNum(bankAmt(s[i]))} إلى "${counterparty(s[i])}" تكررت خلال ${dayDiff(d1, d2)} يوم`), [s[i - 1], s[i]], ['debit', 'date', 'description', 'beneficiary'], { formula: 'Same account, amount, counterparty AND |Δdate| ≤ 3', inputs: [{ label: L('First', 'الأولى'), value: d1, ref: ref(s[i - 1]) }, { label: L('Second', 'الثانية'), value: d2, ref: ref(s[i]) }], result: dayDiff(d1, d2) }, bankMoney(s[i], ctx.settings)));
        }
      }
      return ok(outs.length, out);
    },
  },
  {
    ...tr, id: 'TR-02', severity: 'high', controlId: 'C-RC-01',
    name: L('Bank running-balance breaks', 'انقطاع تسلسل الرصيد البنكي'),
    objective: L('Verify statement integrity: prior balance + credits − debits = balance.', 'التحقق من سلامة الكشف: الرصيد السابق + الدائن − المدين = الرصيد.'),
    rule: L('|Balance(n−1) + Credit(n) − Debit(n) − Balance(n)| > 0.01', 'فرق تسلسل الرصيد > 0.01'),
    criteria: L('Bank statements must be complete and unaltered.', 'يجب أن تكون كشوف البنك كاملة وغير معدلة.'),
    cause: L('Possible causes: missing statement lines, altered statement, extract error.', 'أسباب محتملة: سطور ناقصة أو كشف معدل أو خطأ استخراج.'),
    effect: L('Cash may be misstated; possible concealment.', 'احتمال تحريف النقدية أو الإخفاء.'),
    recommendation: L('Obtain bank-certified statements directly from the bank for affected periods.', 'الحصول على كشوف معتمدة مباشرة من البنك للفترات المتأثرة.'),
    needs: [{ type: 'bank', fields: ['bankAccount', 'date', 'debit', 'credit', 'balance'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'bank', ['bankAccount', 'debit', 'credit', 'balance']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [acct, items] of groupBy(list, (x) => x.a.t(x.r, 'bankAccount'))) {
        // keep source order (statement order) within each table
        for (let i = 1; i < items.length; i++) {
          const p = items[i - 1], c = items[i];
          if (p.a.table.id !== c.a.table.id) continue;
          const pb = p.a.n(p.r, 'balance'), cb = c.a.n(c.r, 'balance'); if (pb === null || cb === null) continue;
          const exp = pb + (c.a.n(c.r, 'credit') ?? 0) - (c.a.n(c.r, 'debit') ?? 0);
          if (Math.abs(exp - cb) > 0.01) out.push(exc(keyOf('TR-02', acct, c.r.recordId), L(`Balance break on ••••${acct.slice(-4)}: expected ${fmtNum(exp)}, statement ${fmtNum(cb)}`, `انقطاع الرصيد في ••••${acct.slice(-4)}: المتوقع ${fmtNum(exp)}، الكشف ${fmtNum(cb)}`), [p, c], [['balance'], ['debit', 'credit', 'balance']], { formula: 'Expected = Prior balance + Credit − Debit; Break = Expected − Balance', inputs: [{ label: L('Prior balance', 'الرصيد السابق'), value: pb, ref: ref(p) }, { label: L('Credit', 'دائن'), value: c.a.n(c.r, 'credit') }, { label: L('Debit', 'مدين'), value: c.a.n(c.r, 'debit') }, { label: L('Statement balance', 'رصيد الكشف'), value: cb, ref: ref(c) }], result: round2(exp - cb) }, { amount: Math.abs(exp - cb), currency: bankMoney(c, ctx.settings).currency }));
        }
      }
      return ok(list.length, out);
    },
  },
  {
    ...tr, id: 'TR-03', severity: 'low', riskId: 'R-FD-01', controlId: 'C-PY-02',
    name: L('Round-number transfers', 'تحويلات بمبالغ مقربة'),
    objective: L('Identify round-amount outgoing transfers.', 'تحديد التحويلات الصادرة بمبالغ مقربة.'),
    rule: L('Debit mod Round base = 0 AND ≥ 10 × base', 'المدين يقبل القسمة على الأساس و≥ 10 أضعافه'),
    criteria: L('Payments usually match exact invoice amounts.', 'تطابق المدفوعات عادة مبالغ الفواتير بدقة.'),
    cause: L('Possible causes: advances, transfers between own accounts, unsupported payments.', 'أسباب محتملة: دفعات مقدمة أو تحويلات داخلية أو مدفوعات غير مؤيدة.'),
    effect: L('Possible unsupported payments.', 'احتمال مدفوعات غير مؤيدة.'),
    recommendation: L('Trace round transfers to approved payment vouchers.', 'تتبع التحويلات المقربة إلى أذون صرف معتمدة.'),
    needs: [{ type: 'bank', fields: ['date', 'debit'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'bank', ['date', 'debit']); if (missing.length) return insufficient(missing);
      const b = ctx.settings.roundNumberBase;
      const out = list.filter((x) => isRound(x.a.n(x.r, 'debit') ?? 0, b)).map((x) => exc(keyOf('TR-03', x.r.recordId), L(`Transfer ${fmtNum(x.a.n(x.r, 'debit'))} on ${x.a.d(x.r, 'date')}`, `تحويل ${fmtNum(x.a.n(x.r, 'debit'))} بتاريخ ${x.a.d(x.r, 'date')}`), [x], ['debit'], { formula: `Debit mod ${b} = 0`, inputs: [{ label: L('Debit', 'مدين'), value: x.a.n(x.r, 'debit') }], result: 'Round' }, bankMoney(x, ctx.settings)));
      return ok(list.length, out, { roundNumberBase: b });
    },
  },
  {
    ...tr, id: 'TR-04', severity: 'low', controlId: 'C-PY-02',
    name: L('Weekend bank transactions', 'حركات بنكية في عطلة نهاية الأسبوع'),
    objective: L('Identify outgoing payments dated on weekend days.', 'تحديد المدفوعات الصادرة المؤرخة في أيام العطلة.'),
    rule: L('Weekday(Date) ∈ Weekend days AND Debit > 0', 'يوم التاريخ ضمن العطلة والمدين > 0'),
    criteria: L('Payments are released on working days.', 'تُصرف المدفوعات في أيام العمل.'),
    cause: L('Possible causes: online banking without dual control.', 'أسباب محتملة: الخدمات البنكية الإلكترونية دون رقابة مزدوجة.'),
    effect: L('Unauthorized payment risk.', 'مخاطر السداد غير المصرح به.'),
    recommendation: L('Confirm dual authorization on e-banking.', 'التأكد من الاعتماد المزدوج في الخدمات البنكية الإلكترونية.'),
    needs: [{ type: 'bank', fields: ['date', 'debit'] }],
    run(ctx) {
      if (!ctx.settings.weekendDays.length) return insufficient(['Weekend days not configured']);
      const { list, missing } = recs(ctx, 'bank', ['date', 'debit']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => (x.a.n(x.r, 'debit') ?? 0) > 0 && x.a.d(x.r, 'date') && ctx.settings.weekendDays.includes(weekday(x.a.d(x.r, 'date')!))).map((x) => exc(keyOf('TR-04', x.r.recordId), L(`Payment ${fmtNum(x.a.n(x.r, 'debit'))} on ${x.a.d(x.r, 'date')}`, `دفعة ${fmtNum(x.a.n(x.r, 'debit'))} بتاريخ ${x.a.d(x.r, 'date')}`), [x], ['date', 'debit'], { formula: 'Weekday(Date) ∈ Weekend', inputs: [{ label: L('Date', 'التاريخ'), value: x.a.d(x.r, 'date') }], result: weekday(x.a.d(x.r, 'date')!) }, bankMoney(x, ctx.settings)));
      return ok(list.length, out);
    },
  },
  {
    ...tr, id: 'TR-05', severity: 'medium', fraud: true, riskId: 'R-FD-01', controlId: 'C-PY-02',
    name: L('Unusual one-time beneficiaries', 'مستفيدون لمرة واحدة بمبالغ غير معتادة'),
    objective: L('Identify large payments to beneficiaries paid only once.', 'تحديد مدفوعات كبيرة لمستفيدين تم السداد لهم مرة واحدة.'),
    rule: L('Beneficiary paid once AND debit ≥ 95th percentile of debits', 'مستفيد لمرة واحدة والمبلغ ≥ المئين 95'),
    criteria: L('Payees should be approved, recurring counterparties.', 'يجب أن يكون المستفيدون جهات معتمدة ومتكررة.'),
    cause: L('Possible causes: one-off settlements, unauthorized payments.', 'أسباب محتملة: تسويات لمرة واحدة أو مدفوعات غير مصرح بها.'),
    effect: L('Funds diversion risk.', 'مخاطر تحويل الأموال.'),
    recommendation: L('Vouch each payment to approval and beneficiary verification.', 'مطابقة كل دفعة مع الاعتماد والتحقق من المستفيد.'),
    needs: [{ type: 'bank', fields: ['date', 'debit', 'beneficiary'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'bank', ['date', 'debit', 'beneficiary']); if (missing.length) return insufficient(missing);
      const outs = list.filter((x) => (x.a.n(x.r, 'debit') ?? 0) > 0);
      if (outs.length < 20) return ok(outs.length, [], { note: 'Fewer than 20 payments — percentile not meaningful' });
      const s = outs.map((x) => x.a.n(x.r, 'debit')!).sort((a, b) => a - b); const p95 = s[Math.floor(s.length * 0.95)];
      const g = groupBy(outs, (x) => normName(x.a.t(x.r, 'beneficiary')));
      const out: TestException[] = [];
      for (const [, items] of g) if (items.length === 1 && items[0].a.n(items[0].r, 'debit')! >= p95) { const x = items[0]; out.push(exc(keyOf('TR-05', x.a.t(x.r, 'beneficiary')), L(`One-time payment ${fmtNum(x.a.n(x.r, 'debit'))} to "${x.a.t(x.r, 'beneficiary')}"`, `دفعة لمرة واحدة ${fmtNum(x.a.n(x.r, 'debit'))} إلى "${x.a.t(x.r, 'beneficiary')}"`), [x], ['beneficiary', 'debit'], { formula: 'Count(beneficiary) = 1 AND Debit ≥ P95', inputs: [{ label: L('Debit', 'مدين'), value: x.a.n(x.r, 'debit') }, { label: 'P95', value: p95 }], result: 'Unusual' }, bankMoney(x, ctx.settings))); }
      return ok(outs.length, out, { p95 });
    },
  },
  {
    ...tr, id: 'TR-06', severity: 'medium', controlId: 'C-TR-02',
    name: L('Unusual bank charges', 'رسوم بنكية غير معتادة'),
    objective: L('Identify bank fees significantly above the usual level.', 'تحديد الرسوم البنكية الأعلى بكثير من المعتاد.'),
    rule: L('Fee (description contains charge/fee/commission) > 3 × median fee', 'الرسم > 3 أضعاف وسيط الرسوم'),
    criteria: L('Bank tariffs agreed with banks.', 'التعريفات المتفق عليها مع البنوك.'),
    cause: L('Possible causes: tariff changes, errors, unapproved services.', 'أسباب محتملة: تغير التعريفة أو أخطاء أو خدمات غير معتمدة.'),
    effect: L('Excess cost.', 'تكلفة زائدة.'),
    recommendation: L('Reconcile charges to agreed tariffs and claim refunds.', 'مطابقة الرسوم مع التعريفات والمطالبة بالاسترداد.'),
    needs: [{ type: 'bank', fields: ['date', 'debit', 'description'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'bank', ['debit', 'description']); if (missing.length) return insufficient(missing);
      const fees = list.filter((x) => /charge|fee|commission|عمولة|مصاريف|رسوم/i.test(x.a.t(x.r, 'description')) && (x.a.n(x.r, 'debit') ?? 0) > 0);
      if (fees.length < 5) return ok(fees.length, [], { note: 'Fewer than 5 fee lines' });
      const med = median(fees.map((x) => x.a.n(x.r, 'debit')!));
      const out = fees.filter((x) => x.a.n(x.r, 'debit')! > 3 * med).map((x) => exc(keyOf('TR-06', x.r.recordId), L(`Bank charge ${fmtNum(x.a.n(x.r, 'debit'))} vs median ${fmtNum(med)}`, `رسم بنكي ${fmtNum(x.a.n(x.r, 'debit'))} مقابل وسيط ${fmtNum(med)}`), [x], ['debit', 'description'], { formula: 'Fee > 3 × Median fee', inputs: [{ label: L('Fee', 'الرسم'), value: x.a.n(x.r, 'debit') }, { label: L('Median', 'الوسيط'), value: med }], result: round2(x.a.n(x.r, 'debit')! / med) }, bankMoney(x, ctx.settings)));
      return ok(fees.length, out, { medianFee: med });
    },
  },
  {
    ...tr, id: 'TR-07', severity: 'medium', riskId: 'R-FN-01',
    name: L('Overdrawn bank balances', 'أرصدة بنكية مكشوفة'),
    objective: L('Identify negative running balances (overdrafts).', 'تحديد الأرصدة الجارية السالبة (السحب على المكشوف).'),
    rule: L('Balance < 0', 'الرصيد < 0'),
    criteria: L('Overdrafts only within approved facilities.', 'السحب على المكشوف فقط ضمن التسهيلات المعتمدة.'),
    cause: L('Possible causes: cash-flow gaps, unapproved overdraft usage.', 'أسباب محتملة: فجوات تدفق نقدي أو استخدام مكشوف غير معتمد.'),
    effect: L('Liquidity risk and interest cost.', 'مخاطر سيولة وتكلفة فوائد.'),
    recommendation: L('Improve cash forecasting; confirm overdraft facility approvals.', 'تحسين توقعات النقدية والتأكد من اعتماد تسهيلات المكشوف.'),
    needs: [{ type: 'bank', fields: ['bankAccount', 'balance'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'bank', ['bankAccount', 'balance']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => (x.a.n(x.r, 'balance') ?? 0) < 0).map((x) => exc(keyOf('TR-07', x.r.recordId), L(`Balance ${fmtNum(x.a.n(x.r, 'balance'))} on ${x.a.d(x.r, 'date') ?? ''}`, `رصيد ${fmtNum(x.a.n(x.r, 'balance'))} بتاريخ ${x.a.d(x.r, 'date') ?? ''}`), [x], ['balance'], { formula: 'Balance < 0', inputs: [{ label: L('Balance', 'الرصيد'), value: x.a.n(x.r, 'balance') }], result: 'Overdrawn' }, { amount: Math.abs(x.a.n(x.r, 'balance')!), currency: bankMoney(x, ctx.settings).currency }));
      return ok(list.length, out);
    },
  },
];

// ───────────────────────────── Fixed assets
const fa = { area: 'fa' as const, riskId: 'R-OP-04', controlId: 'C-FA-01' };
const faMoney = (x: Rec, f: string, s: Parameters<typeof amt>[2]) => amt(x, f, s);
const simpleFa = (id: string, severity: TestDef['severity'], name: [string, string], rule: [string, string], fields: string[], pred: (x: Rec) => boolean, desc: (x: Rec) => [string, string], expField: string, extra: Partial<TestDef>): TestDef => ({
  ...fa, id, severity, name: L(...name), rule: L(...rule),
  objective: extra.objective ?? L(name[0], name[1]),
  criteria: extra.criteria ?? L('Fixed asset register must be complete, accurate and verifiable.', 'يجب أن يكون سجل الأصول كاملًا ودقيقًا وقابلًا للتحقق.'),
  cause: extra.cause ?? L('Possible causes: incomplete register maintenance.', 'أسباب محتملة: عدم استكمال تحديث السجل.'),
  effect: extra.effect ?? L('Asset values and depreciation may be misstated.', 'احتمال تحريف قيم الأصول والإهلاك.'),
  recommendation: extra.recommendation ?? L('Update the register and perform a physical verification.', 'تحديث السجل وإجراء جرد فعلي.'),
  needs: [{ type: 'fa', fields: ['assetId', 'cost', ...fields] }],
  fraud: extra.fraud, controlId: extra.controlId ?? fa.controlId,
  run(ctx) {
    const { list, missing } = recs(ctx, 'fa', ['cost', ...fields]); if (missing.length) return insufficient(missing);
    const out = list.filter(pred).map((x) => { const [en, ar] = desc(x); return exc(keyOf(id, x.a.t(x.r, 'assetId') || x.r.recordId), L(en, ar), [x], fields.length ? fields : ['assetId'], { formula: rule[0], inputs: fields.map((f) => ({ label: f, value: x.a.raw(x.r, f) })), result: 'Exception' }, faMoney(x, expField, ctx.settings)); });
    return ok(list.length, out);
  },
});
const aid = (x: Rec) => x.a.t(x.r, 'assetId') || `(row ${x.r.rowNumber})`;

export const FA_TESTS: TestDef[] = [
  simpleFa('FA-01', 'high', ['Missing asset IDs', 'أصول بدون رقم تعريف'], ['Asset ID is blank', 'رقم الأصل فارغ'], ['assetId'], (x) => !x.a.t(x.r, 'assetId'), (x) => [`Asset at row ${x.r.rowNumber} has no ID`, `أصل في السطر ${x.r.rowNumber} بدون رقم`], 'cost', {}),
  {
    ...fa, id: 'FA-02', severity: 'high',
    name: L('Duplicate asset IDs', 'أرقام أصول مكررة'), objective: L('Detect duplicate asset records.', 'كشف سجلات الأصول المكررة.'),
    rule: L('Count(Asset ID) > 1', 'تكرار رقم الأصل > 1'), criteria: L('Each asset is recorded once.', 'يُسجل كل أصل مرة واحدة.'),
    cause: L('Possible causes: duplicate capitalization, migration errors.', 'أسباب محتملة: رسملة مكررة أو أخطاء ترحيل البيانات.'), effect: L('Overstated assets and depreciation.', 'تضخيم الأصول والإهلاك.'),
    recommendation: L('Remove duplicates after verification.', 'حذف المكرر بعد التحقق.'), needs: [{ type: 'fa', fields: ['assetId', 'cost'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'fa', ['assetId', 'cost']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [k, items] of groupBy(list, (x) => x.a.t(x.r, 'assetId'))) if (items.length > 1) { const m = faMoney(items[0], 'cost', ctx.settings); out.push(exc(keyOf('FA-02', k), L(`Asset ID ${k} appears ${items.length} times`, `رقم الأصل ${k} يتكرر ${items.length} مرات`), items, ['assetId'], { formula: 'Count(Asset ID) > 1', inputs: [{ label: L('Asset ID', 'رقم الأصل'), value: k }], result: items.length }, m ? { amount: Math.abs(m.amount) * (items.length - 1), currency: m.currency } : null)); }
      return ok(list.length, out);
    },
  },
  simpleFa('FA-03', 'low', ['Fully depreciated assets still in use', 'أصول مهلكة بالكامل ما زالت مستخدمة'], ['NBV ≤ Residual (or 0) AND no disposal date', 'صافي القيمة ≤ التخريدية ولا يوجد تاريخ استبعاد'], ['nbv'],
    (x) => { const n = x.a.n(x.r, 'nbv'); const r = x.a.n(x.r, 'residual') ?? 0; return n !== null && (x.a.n(x.r, 'cost') ?? 0) > 0 && n <= r && !x.a.d(x.r, 'disposalDate'); },
    (x) => [`Asset ${aid(x)} NBV ${fmtNum(x.a.n(x.r, 'nbv'))} still active`, `الأصل ${aid(x)} صافي قيمته ${fmtNum(x.a.n(x.r, 'nbv'))} وما زال نشطًا`], 'cost',
    { effect: L('Useful-life estimates may be inaccurate (IAS 16 review of useful lives).', 'قد تكون تقديرات العمر الإنتاجي غير دقيقة.'), recommendation: L('Review useful-life estimates; confirm assets physically exist and are in use.', 'مراجعة تقديرات العمر الإنتاجي والتأكد من وجود الأصول واستخدامها.') }),
  {
    ...fa, id: 'FA-04', severity: 'medium',
    name: L('Assets not depreciated', 'أصول لا يتم إهلاكها'), objective: L('Identify depreciable assets older than one year with no accumulated depreciation.', 'تحديد الأصول القابلة للإهلاك الأقدم من سنة بلا مجمع إهلاك.'),
    rule: L('Acquisition ≤ As-of − 365 days AND Useful life > 0 AND Accumulated depreciation = 0', 'تاريخ الاقتناء أقدم من سنة والعمر > 0 ومجمع الإهلاك = 0'),
    criteria: L('Depreciation starts when the asset is available for use (company policy / IAS 16).', 'يبدأ الإهلاك عند جاهزية الأصل للاستخدام (سياسة الشركة / المعيار).'),
    cause: L('Possible causes: assets not capitalized correctly, CWIP not transferred.', 'أسباب محتملة: رسملة غير صحيحة أو عدم تحويل مشروعات تحت التنفيذ.'), effect: L('Depreciation understated; profit overstated.', 'نقص الإهلاك وتضخيم الأرباح.'),
    recommendation: L('Review capitalization dates and start depreciation per policy.', 'مراجعة تواريخ الرسملة وبدء الإهلاك وفق السياسة.'),
    needs: [{ type: 'fa', fields: ['assetId', 'cost', 'acqDate', 'usefulLife', 'accDep'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'fa', ['cost', 'acqDate', 'usefulLife', 'accDep']); if (missing.length) return insufficient(missing);
      const ao = asOf(list, 'acqDate', ctx.settings);
      const out = list.filter((x) => { const d = x.a.d(x.r, 'acqDate'); return d && ao && dayDiff(d, ao) > 365 && (x.a.n(x.r, 'usefulLife') ?? 0) > 0 && (x.a.n(x.r, 'accDep') ?? 0) === 0 && !/land|ارض|أرض|cwip|under construction/i.test(x.a.t(x.r, 'category')); })
        .map((x) => exc(keyOf('FA-04', aid(x)), L(`Asset ${aid(x)} acquired ${x.a.d(x.r, 'acqDate')} has zero accumulated depreciation`, `الأصل ${aid(x)} المقتنى ${x.a.d(x.r, 'acqDate')} مجمع إهلاكه صفر`), [x], ['acqDate', 'accDep', 'usefulLife'], { formula: 'As-of − Acquisition > 365 AND AccDep = 0', inputs: [{ label: L('Acquired', 'الاقتناء'), value: x.a.d(x.r, 'acqDate') }, { label: L('As-of', 'التقييم'), value: ao }], result: dayDiff(x.a.d(x.r, 'acqDate')!, ao!) }, faMoney(x, 'cost', ctx.settings)));
      return ok(list.length, out, { asOf: ao, excluded: 'Land / CWIP categories' });
    },
  },
  simpleFa('FA-05', 'high', ['Disposed assets still depreciating or carried', 'أصول مستبعدة ما زالت تُهلك أو مسجلة'], ['Disposal date present AND (period depreciation > 0 OR NBV > 0)', 'يوجد تاريخ استبعاد وإهلاك الفترة > 0 أو صافي القيمة > 0'], ['disposalDate'],
    (x) => !!x.a.d(x.r, 'disposalDate') && ((x.a.n(x.r, 'periodDep') ?? 0) > 0 || (x.a.n(x.r, 'nbv') ?? 0) > 0),
    (x) => [`Asset ${aid(x)} disposed ${x.a.d(x.r, 'disposalDate')} but NBV ${fmtNum(x.a.n(x.r, 'nbv'))} / depreciation ${fmtNum(x.a.n(x.r, 'periodDep'))}`, `الأصل ${aid(x)} مستبعد ${x.a.d(x.r, 'disposalDate')} وصافي قيمته ${fmtNum(x.a.n(x.r, 'nbv'))}`], 'nbv',
    { effect: L('Assets and depreciation overstated; gain/loss on disposal not recognized.', 'تضخيم الأصول والإهلاك وعدم الاعتراف بأرباح/خسائر الاستبعاد.'), recommendation: L('Derecognize disposed assets and record disposal gain/loss.', 'استبعاد الأصول المستبعدة وتسجيل أرباح/خسائر الاستبعاد.') }),
  simpleFa('FA-06', 'medium', ['Assets without location', 'أصول بدون موقع'], ['Location is blank', 'الموقع فارغ'], ['location'], (x) => !x.a.t(x.r, 'location'), (x) => [`Asset ${aid(x)} has no location`, `الأصل ${aid(x)} بدون موقع`], 'cost', { controlId: 'C-FA-02' }),
  simpleFa('FA-07', 'medium', ['Assets without custodian', 'أصول بدون أمين عهدة'], ['Custodian is blank', 'أمين العهدة فارغ'], ['custodian'], (x) => !x.a.t(x.r, 'custodian'), (x) => [`Asset ${aid(x)} has no custodian`, `الأصل ${aid(x)} بدون أمين عهدة`], 'cost', { controlId: 'C-FA-02' }),
  simpleFa('FA-08', 'low', ['Assets without supporting invoice', 'أصول بدون فاتورة مؤيدة'], ['Supporting invoice reference is blank', 'مرجع الفاتورة فارغ'], ['invoiceNo'], (x) => !x.a.t(x.r, 'invoiceNo'), (x) => [`Asset ${aid(x)} has no supporting invoice reference`, `الأصل ${aid(x)} بدون مرجع فاتورة`], 'cost', {}),
  {
    ...fa, id: 'FA-09', severity: 'medium',
    name: L('Inconsistent useful lives within category', 'أعمار إنتاجية غير متسقة داخل الفئة'), objective: L('Identify useful lives deviating > 50% from the category median.', 'تحديد الأعمار الإنتاجية المنحرفة > 50% عن وسيط الفئة.'),
    rule: L('|Useful life − Category median| / Category median > 50%', 'انحراف العمر عن وسيط الفئة > 50%'),
    criteria: L('Consistent depreciation policy per asset class (company policy governs).', 'سياسة إهلاك متسقة لكل فئة (سياسة الشركة هي المرجع).'),
    cause: L('Possible causes: data entry errors, undocumented exceptions.', 'أسباب محتملة: أخطاء إدخال أو استثناءات غير موثقة.'), effect: L('Depreciation misstatement.', 'تحريف الإهلاك.'),
    recommendation: L('Validate useful lives against the approved depreciation policy.', 'مطابقة الأعمار مع سياسة الإهلاك المعتمدة.'),
    needs: [{ type: 'fa', fields: ['assetId', 'cost', 'category', 'usefulLife'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'fa', ['cost', 'category', 'usefulLife']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [cat, items] of groupBy(list, (x) => x.a.t(x.r, 'category'))) {
        const lives = items.map((x) => x.a.n(x.r, 'usefulLife')).filter((v): v is number => v !== null && v > 0);
        if (lives.length < 3) continue;
        const med = median(lives);
        for (const x of items) { const v = x.a.n(x.r, 'usefulLife'); if (v && Math.abs(v - med) / med > 0.5) out.push(exc(keyOf('FA-09', aid(x)), L(`Asset ${aid(x)} (${cat}) life ${v} vs category median ${med}`, `الأصل ${aid(x)} (${cat}) عمره ${v} مقابل وسيط ${med}`), [x], ['usefulLife', 'category'], { formula: '|Life − Median| ÷ Median', inputs: [{ label: L('Life', 'العمر'), value: v }, { label: L('Median', 'الوسيط'), value: med }], result: `${round2(Math.abs(v - med) / med * 100)}%` }, faMoney(x, 'cost', ctx.settings))); }
      }
      return ok(list.length, out);
    },
  },
  {
    ...fa, id: 'FA-10', severity: 'medium',
    name: L('Depreciation recomputation (straight-line)', 'إعادة احتساب الإهلاك (القسط الثابت)'), objective: L('Recompute accumulated depreciation for assets whose method is straight-line.', 'إعادة احتساب مجمع الإهلاك للأصول بطريقة القسط الثابت.'),
    rule: L('Expected = min(Cost − Residual, (Cost − Residual) ÷ Life × Years elapsed); flag |Expected − Recorded| > 10%', 'المتوقع = (التكلفة − التخريدية) ÷ العمر × السنوات؛ رصد الفرق > 10%'),
    criteria: L('Depreciation method stated in the register (no method is assumed).', 'طريقة الإهلاك المسجلة (لا تُفترض طريقة).'),
    cause: L('Possible causes: incorrect useful life, missed depreciation runs.', 'أسباب محتملة: عمر خاطئ أو دورات إهلاك فائتة.'), effect: L('Depreciation misstatement.', 'تحريف الإهلاك.'),
    recommendation: L('Correct depreciation calculations and review the depreciation run.', 'تصحيح احتساب الإهلاك ومراجعة دورة الإهلاك.'),
    needs: [{ type: 'fa', fields: ['assetId', 'cost', 'acqDate', 'usefulLife', 'accDep', 'method'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'fa', ['cost', 'acqDate', 'usefulLife', 'accDep', 'method']); if (missing.length) return insufficient(missing);
      const ao = asOf(list, 'acqDate', ctx.settings);
      const sl = list.filter((x) => /straight|sl|ثابت/i.test(x.a.t(x.r, 'method')) && !x.a.d(x.r, 'disposalDate'));
      const out: TestException[] = [];
      for (const x of sl) {
        const c = x.a.n(x.r, 'cost'), life = x.a.n(x.r, 'usefulLife'), d = x.a.d(x.r, 'acqDate'), rec = Math.abs(x.a.n(x.r, 'accDep') ?? 0), res = x.a.n(x.r, 'residual') ?? 0;
        if (!c || !life || !d || !ao) continue;
        const yrs = Math.max(0, dayDiff(d, ao) / 365.25);
        const exp = Math.min(c - res, ((c - res) / life) * yrs);
        if (exp > 0 && Math.abs(exp - rec) / exp > 0.1) out.push(exc(keyOf('FA-10', aid(x)), L(`Asset ${aid(x)}: expected acc. dep. ${fmtNum(exp)} vs recorded ${fmtNum(rec)}`, `الأصل ${aid(x)}: مجمع الإهلاك المتوقع ${fmtNum(exp)} مقابل المسجل ${fmtNum(rec)}`), [x], ['cost', 'acqDate', 'usefulLife', 'accDep', 'residual'],
          { formula: 'Expected = min(Cost − Residual, (Cost − Residual) ÷ Life × Years); Diff = Expected − Recorded', inputs: [{ label: L('Cost', 'التكلفة'), value: c }, { label: L('Residual', 'التخريدية'), value: res }, { label: L('Life (yrs)', 'العمر'), value: life }, { label: L('Years elapsed', 'السنوات المنقضية'), value: round2(yrs) }, { label: L('Recorded', 'المسجل'), value: rec }], result: round2(exp - rec) }, { amount: Math.abs(exp - rec), currency: faMoney(x, 'cost', ctx.settings)?.currency ?? '—' }));
      }
      return ok(sl.length, out, { asOf: ao, scope: 'Straight-line assets only' });
    },
  },
  simpleFa('FA-11', 'high', ['Potential ghost assets', 'أصول وهمية محتملة'], ['No location AND no custodian AND no supporting invoice', 'بدون موقع وبدون أمين عهدة وبدون فاتورة'], ['location', 'custodian', 'invoiceNo'],
    (x) => !x.a.t(x.r, 'location') && !x.a.t(x.r, 'custodian') && !x.a.t(x.r, 'invoiceNo'),
    (x) => [`Asset ${aid(x)} lacks location, custodian and invoice`, `الأصل ${aid(x)} بدون موقع وأمين عهدة وفاتورة`], 'nbv',
    { fraud: true, effect: L('Assets may not exist; possible misappropriation.', 'قد لا تكون الأصول موجودة؛ احتمال اختلاس.'), recommendation: L('Physically verify these assets; write off if not located.', 'التحقق الفعلي من هذه الأصول وشطب ما لم يُعثر عليه.') }),
];

// ───────────────────────────── Inventory
const inv = { area: 'inventory' as const, riskId: 'R-OP-05', controlId: 'C-IN-01' };
const invNum = (x: Rec) => x.a.n(x.r, 'totalValue') ?? ((x.a.n(x.r, 'quantity') ?? 0) * (x.a.n(x.r, 'unitCost') ?? 0));
const invVal = (x: Rec, s: Parameters<typeof amt>[2]) => ({ amount: Math.abs(invNum(x)), currency: s.assumeBaseCurrencyWhenMissing ? s.baseCurrency : '—' });
const item = (x: Rec) => x.a.t(x.r, 'itemCode') || `(row ${x.r.rowNumber})`;
const invTest = (id: string, severity: TestDef['severity'], name: [string, string], rule: [string, string], fields: string[], pred: (x: Rec, ctx: Parameters<TestDef['run']>[0], aux: Record<string, number | string | null>) => boolean, desc: (x: Rec) => [string, string], extra: Partial<TestDef> & { anyOf?: string[]; prep?: (list: Rec[], ctx: Parameters<TestDef['run']>[0]) => Record<string, number | string | null> } = {}): TestDef => ({
  ...inv, id, severity, name: L(...name), rule: L(...rule), objective: extra.objective ?? L(name[0], name[1]),
  criteria: extra.criteria ?? L('Inventory records must be accurate and supported by physical counts.', 'يجب أن تكون سجلات المخزون دقيقة ومؤيدة بالجرد الفعلي.'),
  cause: extra.cause ?? L('Possible causes: recording errors, weak stores control.', 'أسباب محتملة: أخطاء تسجيل أو ضعف الرقابة على المخازن.'),
  effect: extra.effect ?? L('Inventory may be misstated.', 'احتمال تحريف المخزون.'),
  recommendation: extra.recommendation ?? L('Investigate and correct; strengthen stores controls.', 'الفحص والتصحيح وتعزيز الرقابة على المخازن.'),
  needs: [{ type: 'inventory', fields: ['itemCode', 'quantity', ...fields] }], fraud: extra.fraud,
  run(ctx) {
    const { list, missing } = recs(ctx, 'inventory', ['itemCode', 'quantity', ...fields]); if (missing.length) return insufficient(missing);
    if (extra.anyOf && !extra.anyOf.some((f) => list[0]?.a.has(f))) return insufficient([`Inventory: one of ${extra.anyOf.join(' / ')} must be mapped`]);
    const aux = extra.prep?.(list, ctx) ?? {};
    const out = list.filter((x) => pred(x, ctx, aux)).map((x) => { const [en, ar] = desc(x); return exc(keyOf(id, item(x), x.a.t(x.r, 'location')), L(en, ar), [x], ['quantity', ...fields], { formula: rule[0], inputs: ['quantity', ...fields].map((f) => ({ label: f, value: x.a.raw(x.r, f) })), result: 'Exception' }, invVal(x, ctx.settings)); });
    return ok(list.length, out, aux);
  },
});

export const IN_TESTS: TestDef[] = [
  invTest('IN-01', 'high', ['Negative inventory', 'مخزون سالب'], ['Quantity < 0', 'الكمية < 0'], [], (x) => (x.a.n(x.r, 'quantity') ?? 0) < 0, (x) => [`Item ${item(x)} quantity ${x.a.n(x.r, 'quantity')}`, `الصنف ${item(x)} كميته ${x.a.n(x.r, 'quantity')}`]),
  invTest('IN-02', 'low', ['Zero-movement items', 'أصناف بلا حركة'], ['Receipts = 0 AND Issues = 0 AND Quantity > 0', 'الوارد = 0 والمنصرف = 0 والكمية > 0'], ['receipts', 'issues'], (x) => (x.a.n(x.r, 'receipts') ?? 0) === 0 && (x.a.n(x.r, 'issues') ?? 0) === 0 && (x.a.n(x.r, 'quantity') ?? 0) > 0, (x) => [`Item ${item(x)} had no movement`, `الصنف ${item(x)} بلا حركة`], { effect: L('Possible obsolete stock; valuation risk.', 'احتمال مخزون راكد ومخاطر تقييم.') }),
  invTest('IN-03', 'medium', ['Slow-moving inventory', 'مخزون بطيء الحركة'], ['As-of − Last movement > Slow-moving days', 'تاريخ التقييم − آخر حركة > حد بطء الحركة'], ['lastMovement'],
    (x, ctx, aux) => { const d = x.a.d(x.r, 'lastMovement'); return !!d && !!aux.asOf && (x.a.n(x.r, 'quantity') ?? 0) > 0 && dayDiff(d, aux.asOf as string) > ctx.settings.slowMovingDays; },
    (x) => [`Item ${item(x)} last moved ${x.a.d(x.r, 'lastMovement')}`, `الصنف ${item(x)} آخر حركة ${x.a.d(x.r, 'lastMovement')}`],
    { prep: (list, ctx) => ({ asOf: asOf(list, 'lastMovement', ctx.settings), slowMovingDays: ctx.settings.slowMovingDays }), effect: L('Net realizable value may be below cost (IAS 2).', 'قد تقل صافي القيمة البيعية عن التكلفة.'), recommendation: L('Assess provision for slow-moving stock.', 'تقييم مخصص المخزون بطيء الحركة.') }),
  invTest('IN-04', 'medium', ['Obsolete items carried at value', 'أصناف متقادمة مسجلة بقيمة'], ['Obsolete flag = yes AND value > 0', 'علامة التقادم = نعم والقيمة > 0'], ['obsolete'], (x) => /^(y|yes|true|1|obsolete|متقادم|راكد|نعم)$/i.test(x.a.t(x.r, 'obsolete')) && Math.abs(invNum(x)) > 0, (x) => [`Obsolete item ${item(x)} carried at ${fmtNum(invNum(x))}`, `صنف متقادم ${item(x)} بقيمة ${fmtNum(invNum(x))}`], { recommendation: L('Write down or dispose of obsolete stock per policy.', 'تخفيض قيمة المخزون المتقادم أو التخلص منه وفق السياسة.') }),
  invTest('IN-05', 'medium', ['Physical count differences', 'فروق الجرد الفعلي'], ['Physical count ≠ Book quantity', 'الجرد الفعلي ≠ الكمية الدفترية'], ['countQty'], (x) => { const c = x.a.n(x.r, 'countQty'); return c !== null && Math.abs(c - (x.a.n(x.r, 'quantity') ?? 0)) > 0.0001; }, (x) => [`Item ${item(x)}: book ${x.a.n(x.r, 'quantity')} vs count ${x.a.n(x.r, 'countQty')}`, `الصنف ${item(x)}: الدفتري ${x.a.n(x.r, 'quantity')} مقابل الفعلي ${x.a.n(x.r, 'countQty')}`], { fraud: true }),
  invTest('IN-06', 'medium', ['Valuation errors (Qty × Unit cost ≠ Value)', 'أخطاء تقييم (الكمية × التكلفة ≠ القيمة)'], ['|Quantity × Unit cost − Total value| > 1', 'الفرق > 1'], ['unitCost', 'totalValue'], (x) => Math.abs((x.a.n(x.r, 'quantity') ?? 0) * (x.a.n(x.r, 'unitCost') ?? 0) - (x.a.n(x.r, 'totalValue') ?? 0)) > 1, (x) => [`Item ${item(x)}: ${x.a.n(x.r, 'quantity')} × ${x.a.n(x.r, 'unitCost')} ≠ ${fmtNum(x.a.n(x.r, 'totalValue'))}`, `الصنف ${item(x)}: ${x.a.n(x.r, 'quantity')} × ${x.a.n(x.r, 'unitCost')} ≠ ${fmtNum(x.a.n(x.r, 'totalValue'))}`]),
  {
    ...inv, id: 'IN-07', severity: 'medium',
    name: L('Duplicate item codes', 'أكواد أصناف مكررة'), objective: L('Detect items recorded more than once at the same location.', 'كشف الأصناف المسجلة أكثر من مرة في نفس الموقع.'),
    rule: L('Count(item code, location) > 1', 'تكرار الصنف والموقع > 1'), criteria: L('Unique item master.', 'تفرد بيانات الأصناف.'),
    cause: L('Possible causes: master-data duplication.', 'أسباب محتملة: تكرار البيانات الرئيسية.'), effect: L('Inventory overstated.', 'تضخيم المخزون.'),
    recommendation: L('Merge duplicate item codes after verification.', 'دمج الأكواد المكررة بعد التحقق.'), needs: [{ type: 'inventory', fields: ['itemCode', 'quantity'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'inventory', ['itemCode', 'quantity']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [k, items] of groupBy(list, (x) => keyOf(item(x), x.a.t(x.r, 'location')))) if (items.length > 1) out.push(exc(keyOf('IN-07', k), L(`Item ${item(items[0])} recorded ${items.length} times`, `الصنف ${item(items[0])} مسجل ${items.length} مرات`), items, ['itemCode', 'location'], { formula: 'Count(item, location) > 1', inputs: [{ label: L('Item', 'الصنف'), value: item(items[0]) }], result: items.length }));
      return ok(list.length, out);
    },
  },
  invTest('IN-08', 'medium', ['Large adjustments and write-offs', 'تسويات وشطب بمبالغ كبيرة'], ['|Adjustment| > 10% of quantity OR write-off > 0', 'التسوية > 10% من الكمية أو شطب > 0'], [], (x) => { const adj = Math.abs(x.a.n(x.r, 'adjustments') ?? 0); const q = Math.abs(x.a.n(x.r, 'quantity') ?? 0); return (adj > 0 && adj > 0.1 * Math.max(q, 1)) || (x.a.n(x.r, 'writeOff') ?? 0) > 0; }, (x) => [`Item ${item(x)}: adjustment ${fmtNum(x.a.n(x.r, 'adjustments'))}, write-off ${fmtNum(x.a.n(x.r, 'writeOff'))}`, `الصنف ${item(x)}: تسوية ${fmtNum(x.a.n(x.r, 'adjustments'))}، شطب ${fmtNum(x.a.n(x.r, 'writeOff'))}`], { anyOf: ['adjustments', 'writeOff'], fraud: true, recommendation: L('Require documented approval for adjustments and write-offs.', 'اشتراط اعتماد موثق للتسويات والشطب.') }),
];

