import type { TestException } from '../types';
import { weekday, dayDiff, isApproved, fmtNum, text } from '../values';
import { type TestDef, type Rec, recs, insufficient, exc, amt, groupBy, isRound, keyOf, nearLimit, normName, concentration, round2, ref } from './kit';

const base = { area: 'ap' as const, riskId: 'R-FR-02', controlId: 'C-AP-01' };
const needAP = (f: string[]) => [{ type: 'ap' as const, fields: ['vendor', 'invoiceNo', 'amount', ...f] }];
const L = (en: string, ar: string) => ({ en, ar });

export const AP_TESTS: TestDef[] = [
  {
    ...base, id: 'AP-01', severity: 'high', fraud: true, controlId: 'C-AP-02',
    name: L('Duplicate invoices', 'فواتير مكررة'),
    objective: L('Detect invoices recorded more than once.', 'كشف الفواتير المسجلة أكثر من مرة.'),
    rule: L('Same vendor + invoice number, OR same vendor + amount + invoice date with different invoice numbers', 'نفس المورد ورقم الفاتورة، أو نفس المورد والمبلغ والتاريخ بأرقام فواتير مختلفة'),
    criteria: L('Each supplier invoice is recorded and paid once.', 'تُسجل كل فاتورة مورد وتُسدد مرة واحدة.'),
    cause: L('Possible causes: re-submission by vendor, manual re-entry, weak duplicate check.', 'أسباب محتملة: إعادة تقديم الفاتورة أو إعادة الإدخال اليدوي أو ضعف فحص التكرار.'),
    effect: L('Duplicate payment and overstatement of expenses.', 'ازدواج السداد وتضخيم المصروفات.'),
    recommendation: L('Recover any duplicate payments; enable hard duplicate-invoice blocking on vendor + invoice number + amount.', 'استرداد أي مدفوعات مكررة وتفعيل المنع الآلي للفواتير المكررة على المورد ورقم الفاتورة والمبلغ.'),
    needs: needAP(['invoiceDate']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount']);
      if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      const seen = new Set<string>();
      const g1 = groupBy(list, (x) => keyOf(normName(x.a.t(x.r, 'vendor')), x.a.t(x.r, 'invoiceNo').toLowerCase().replace(/[^a-z0-9]/g, '')));
      for (const [k, items] of g1) if (items.length > 1) {
        items.forEach((i) => seen.add(i.r.recordId));
        const m = amt(items[0], 'amount', ctx.settings);
        out.push(exc(keyOf('AP-01', 'inv', k), L(`Invoice ${items[0].a.t(items[0].r, 'invoiceNo')} from ${items[0].a.t(items[0].r, 'vendor')} recorded ${items.length} times`, `الفاتورة ${items[0].a.t(items[0].r, 'invoiceNo')} من ${items[0].a.t(items[0].r, 'vendor')} مسجلة ${items.length} مرات`),
          items, ['vendor', 'invoiceNo', 'amount'], { formula: 'Count(vendor, invoice no.) > 1', inputs: [{ label: L('Vendor', 'المورد'), value: items[0].a.t(items[0].r, 'vendor') }, { label: L('Invoice', 'الفاتورة'), value: items[0].a.t(items[0].r, 'invoiceNo') }], result: items.length },
          m ? { amount: Math.abs(m.amount) * (items.length - 1), currency: m.currency } : null));
      }
      if (list[0]?.a.has('invoiceDate')) {
        const g2 = groupBy(list.filter((x) => !seen.has(x.r.recordId)), (x) => keyOf(normName(x.a.t(x.r, 'vendor')), x.a.n(x.r, 'amount'), x.a.d(x.r, 'invoiceDate')));
        for (const [k, items] of g2) if (items.length > 1 && new Set(items.map((i) => i.a.t(i.r, 'invoiceNo'))).size > 1) {
          const m = amt(items[0], 'amount', ctx.settings);
          out.push(exc(keyOf('AP-01', 'amt', k), L(`${items.length} invoices from ${items[0].a.t(items[0].r, 'vendor')} with identical amount ${fmtNum(items[0].a.n(items[0].r, 'amount'))} and date`, `${items.length} فواتير من ${items[0].a.t(items[0].r, 'vendor')} بنفس المبلغ ${fmtNum(items[0].a.n(items[0].r, 'amount'))} والتاريخ`),
            items, ['vendor', 'amount', 'invoiceDate', 'invoiceNo'], { formula: 'Count(vendor, amount, invoice date) > 1 with different invoice numbers', inputs: items.map((i) => ({ label: L('Invoice', 'الفاتورة'), value: i.a.t(i.r, 'invoiceNo'), ref: ref(i) })), result: items.length },
            m ? { amount: Math.abs(m.amount) * (items.length - 1), currency: m.currency } : null));
        }
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-02', severity: 'medium', controlId: 'C-AP-03',
    name: L('Invoices without purchase order', 'فواتير بدون أمر شراء'),
    objective: L('Confirm invoices are supported by an approved PO.', 'التحقق من استناد الفواتير إلى أمر شراء معتمد.'),
    rule: L('PO number is blank', 'رقم أمر الشراء فارغ'),
    criteria: L('Purchasing policy: no PO, no pay (subject to approved exemptions).', 'سياسة المشتريات: لا سداد بدون أمر شراء (إلا الاستثناءات المعتمدة).'),
    cause: L('Possible causes: after-the-fact purchasing, exempt categories not documented.', 'أسباب محتملة: الشراء ثم إصدار الأمر لاحقًا أو عدم توثيق الفئات المستثناة.'),
    effect: L('Spending bypasses procurement approval.', 'تجاوز الإنفاق لاعتمادات المشتريات.'),
    recommendation: L('Enforce three-way match; document approved PO exemptions.', 'تطبيق المطابقة الثلاثية وتوثيق الاستثناءات المعتمدة.'),
    needs: needAP(['poNo']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount', 'poNo']);
      if (missing.length) return insufficient(missing);
      const out = list.filter((x) => !x.a.t(x.r, 'poNo')).map((x) => exc(keyOf('AP-02', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} (${x.a.t(x.r, 'vendor')}) has no PO`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} (${x.a.t(x.r, 'vendor')}) بدون أمر شراء`), [x], ['poNo', 'invoiceNo'],
        { formula: 'PO number = blank', inputs: [{ label: L('PO number', 'رقم أمر الشراء'), value: null, ref: ref(x) }], result: 'Missing' }, amt(x, 'amount', ctx.settings)));
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-03', severity: 'medium', controlId: 'C-AP-03',
    name: L('Invoices without goods receipt', 'فواتير بدون إذن استلام'),
    objective: L('Confirm goods/services were received before invoice.', 'التحقق من استلام البضائع/الخدمات قبل الفاتورة.'),
    rule: L('GRN number is blank', 'رقم إذن الاستلام فارغ'),
    criteria: L('Three-way match: PO – GRN – Invoice.', 'المطابقة الثلاثية: أمر الشراء – إذن الاستلام – الفاتورة.'),
    cause: L('Possible causes: receiving not recorded, services without acceptance.', 'أسباب محتملة: عدم تسجيل الاستلام أو خدمات بدون محضر قبول.'),
    effect: L('Payment for goods/services not received.', 'سداد مقابل بضائع/خدمات لم تُستلم.'),
    recommendation: L('Require GRN / service acceptance before invoice approval.', 'اشتراط إذن الاستلام / محضر القبول قبل اعتماد الفاتورة.'),
    needs: needAP(['grnNo']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount', 'grnNo']);
      if (missing.length) return insufficient(missing);
      const out = list.filter((x) => !x.a.t(x.r, 'grnNo')).map((x) => exc(keyOf('AP-03', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} has no GRN`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} بدون إذن استلام`), [x], ['grnNo'],
        { formula: 'GRN = blank', inputs: [{ label: L('GRN', 'إذن الاستلام'), value: null, ref: ref(x) }], result: 'Missing' }, amt(x, 'amount', ctx.settings)));
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-04', severity: 'high', controlId: 'C-PY-01',
    name: L('Payment before invoice date', 'سداد قبل تاريخ الفاتورة'),
    objective: L('Identify payments made before the invoice existed.', 'تحديد المدفوعات التي تمت قبل وجود الفاتورة.'),
    rule: L('Payment date < Invoice date', 'تاريخ السداد < تاريخ الفاتورة'),
    criteria: L('Payments require a valid, approved invoice (unless an approved advance).', 'يتطلب السداد فاتورة سليمة معتمدة (إلا الدفعات المقدمة المعتمدة).'),
    cause: L('Possible causes: advances not recorded as such, backdated invoices.', 'أسباب محتملة: دفعات مقدمة غير مصنفة أو فواتير بتاريخ لاحق.'),
    effect: L('Unsupported payments; risk of loss.', 'مدفوعات غير مؤيدة ومخاطر خسارة.'),
    recommendation: L('Investigate each case; record advances separately with approval.', 'فحص كل حالة وتسجيل الدفعات المقدمة بشكل منفصل باعتماد.'),
    needs: needAP(['invoiceDate', 'paymentDate']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['invoiceNo', 'amount', 'invoiceDate', 'paymentDate']);
      if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const x of list) {
        const i = x.a.d(x.r, 'invoiceDate'), p = x.a.d(x.r, 'paymentDate');
        if (i && p && p < i) out.push(exc(keyOf('AP-04', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} paid ${dayDiff(p, i)} days before invoice date`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} سُددت قبل تاريخها بـ ${dayDiff(p, i)} يومًا`), [x], ['invoiceDate', 'paymentDate'],
          { formula: 'Payment date < Invoice date', inputs: [{ label: L('Invoice date', 'تاريخ الفاتورة'), value: i }, { label: L('Payment date', 'تاريخ السداد'), value: p }], result: `${dayDiff(p, i)} days early` }, amt(x, 'amount', ctx.settings)));
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-05', severity: 'low',
    name: L('Round-number invoices', 'فواتير بمبالغ مقربة'),
    objective: L('Identify invoices with round amounts.', 'تحديد الفواتير ذات المبالغ المقربة.'),
    rule: L('Amount mod Round base = 0 AND ≥ 10 × base', 'المبلغ يقبل القسمة على الأساس و≥ 10 أضعافه'),
    criteria: L('Supplier invoices normally show itemized, exact amounts.', 'تظهر فواتير الموردين عادة مبالغ تفصيلية دقيقة.'),
    cause: L('Possible causes: estimates, advance billing, fictitious invoices.', 'أسباب محتملة: تقديرات أو فواتير مقدمة أو فواتير وهمية.'),
    effect: L('Possible unsupported charges.', 'احتمال رسوم غير مؤيدة.'),
    recommendation: L('Vouch round-amount invoices to contracts and deliverables.', 'مطابقة الفواتير المقربة مع العقود والمخرجات.'),
    needs: needAP([]),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['invoiceNo', 'amount']);
      if (missing.length) return insufficient(missing);
      const b = ctx.settings.roundNumberBase;
      const out = list.filter((x) => isRound(x.a.n(x.r, 'amount') ?? 0, b)).map((x) => exc(keyOf('AP-05', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} amount ${fmtNum(x.a.n(x.r, 'amount'))}`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} بمبلغ ${fmtNum(x.a.n(x.r, 'amount'))}`), [x], ['amount'],
        { formula: `Amount mod ${b} = 0`, inputs: [{ label: L('Amount', 'المبلغ'), value: x.a.n(x.r, 'amount') }], result: 'Round' }, amt(x, 'amount', ctx.settings)));
      return { status: 'performed', missing: [], population: list.length, exceptions: out, params: { roundNumberBase: b } };
    },
  },
  {
    ...base, id: 'AP-06', severity: 'medium', fraud: true, controlId: 'C-AU-01',
    name: L('Invoices just below approval limits', 'فواتير أقل مباشرة من حدود الاعتماد'),
    objective: L('Identify amounts structured just below approval thresholds.', 'تحديد المبالغ المصممة لتكون أقل مباشرة من حدود الاعتماد.'),
    rule: L('Limit × (1 − tolerance%) ≤ Amount < Limit', 'الحد × (1 − نسبة التسامح) ≤ المبلغ < الحد'),
    criteria: L('Delegation of Authority approval limits (configured).', 'حدود جدول الصلاحيات المعتمد (من الإعدادات).'),
    cause: L('Possible causes: approval avoidance.', 'أسباب محتملة: تجنب مستوى الاعتماد الأعلى.'),
    effect: L('Higher-level approval bypassed.', 'تجاوز الاعتماد الأعلى.'),
    recommendation: L('Review clusters below limits; apply cumulative approval per vendor/period.', 'مراجعة التجمعات أسفل الحدود وتطبيق الاعتماد التراكمي لكل مورد/فترة.'),
    needs: needAP([]),
    run(ctx) {
      const lim = ctx.settings.approvalLimits;
      if (!lim.length) return insufficient(['Approval limits (Delegation of Authority) not configured (Settings)']);
      const { list, missing } = recs(ctx, 'ap', ['invoiceNo', 'amount']);
      if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const x of list) {
        const m = amt(x, 'amount', ctx.settings); if (!m || (m.currency !== ctx.settings.baseCurrency)) continue;
        const l = nearLimit(m.amount, lim, ctx.settings.nearThresholdPct);
        if (l) out.push(exc(keyOf('AP-06', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} ${fmtNum(m.amount)} is just below limit ${fmtNum(l)}`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} ${fmtNum(m.amount)} أقل مباشرة من الحد ${fmtNum(l)}`), [x], ['amount'],
          { formula: 'Limit × (1 − t%) ≤ Amount < Limit', inputs: [{ label: L('Amount', 'المبلغ'), value: m.amount }, { label: L('Limit', 'الحد'), value: l }, { label: L('Tolerance %', 'نسبة التسامح'), value: ctx.settings.nearThresholdPct }], result: `${round2((1 - m.amount / l) * 100)}% below` }, m));
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out, params: { limits: lim.join(', '), tolerancePct: ctx.settings.nearThresholdPct } };
    },
  },
  {
    ...base, id: 'AP-07', severity: 'low', controlId: 'C-PY-01',
    name: L('Weekend payments', 'مدفوعات في عطلة نهاية الأسبوع'),
    objective: L('Identify payments dated on non-working days.', 'تحديد المدفوعات المؤرخة في أيام العطلة.'),
    rule: L('Weekday(Payment date) ∈ Weekend days', 'يوم تاريخ السداد ضمن أيام العطلة'),
    criteria: L('Payments are processed on working days under supervision.', 'تتم المدفوعات في أيام العمل تحت الإشراف.'),
    cause: L('Possible causes: urgent / unsupervised payments.', 'أسباب محتملة: مدفوعات عاجلة أو دون إشراف.'),
    effect: L('Increased risk of unauthorized payment.', 'زيادة مخاطر السداد غير المصرح به.'),
    recommendation: L('Review weekend payments for approval evidence.', 'مراجعة أدلة اعتماد مدفوعات العطلات.'),
    needs: needAP(['paymentDate']),
    run(ctx) {
      if (!ctx.settings.weekendDays.length) return insufficient(['Weekend days not configured']);
      const { list, missing } = recs(ctx, 'ap', ['invoiceNo', 'amount', 'paymentDate']);
      if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const x of list) { const p = x.a.d(x.r, 'paymentDate'); if (p && ctx.settings.weekendDays.includes(weekday(p))) out.push(exc(keyOf('AP-07', x.a.t(x.r, 'invoiceNo'), p), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} paid on ${p}`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} سُددت في ${p}`), [x], ['paymentDate'], { formula: 'Weekday(Payment date) ∈ Weekend', inputs: [{ label: L('Payment date', 'تاريخ السداد'), value: p }], result: weekday(p) }, amt(x, 'amount', ctx.settings))); }
      return { status: 'performed', missing: [], population: list.filter((x) => x.a.d(x.r, 'paymentDate')).length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-08', severity: 'high', controlId: 'C-PY-01',
    name: L('Unapproved invoices paid', 'سداد فواتير غير معتمدة'),
    objective: L('Confirm only approved invoices are paid.', 'التحقق من سداد الفواتير المعتمدة فقط.'),
    rule: L('Payment date present AND Approval ≠ Approved', 'يوجد تاريخ سداد وحالة الاعتماد غير معتمد'),
    criteria: L('Invoices must be approved before payment.', 'يجب اعتماد الفواتير قبل السداد.'),
    cause: L('Possible causes: payment run not linked to approval workflow.', 'أسباب محتملة: عدم ربط دورة السداد بدورة الاعتماد.'),
    effect: L('Unauthorized disbursements.', 'صرف غير مصرح به.'),
    recommendation: L('Block payment of unapproved invoices in the ERP; review listed items.', 'منع سداد الفواتير غير المعتمدة آليًا ومراجعة البنود المرصودة.'),
    needs: needAP(['approval', 'paymentDate']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['invoiceNo', 'amount', 'approval', 'paymentDate']);
      if (missing.length) return insufficient(missing);
      const out = list.filter((x) => x.a.d(x.r, 'paymentDate') && isApproved(x.a.t(x.r, 'approval')) !== true).map((x) => exc(keyOf('AP-08', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} paid with approval status "${x.a.t(x.r, 'approval') || 'blank'}"`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} سُددت وحالة الاعتماد "${x.a.t(x.r, 'approval') || 'فارغ'}"`), [x], ['approval', 'paymentDate'],
        { formula: 'Paid AND Approval ≠ Approved', inputs: [{ label: L('Approval', 'الاعتماد'), value: x.a.t(x.r, 'approval') }, { label: L('Payment date', 'تاريخ السداد'), value: x.a.d(x.r, 'paymentDate') }], result: 'Unapproved payment' }, amt(x, 'amount', ctx.settings)));
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-09', severity: 'low', controlId: 'C-VM-01', riskId: 'R-OP-03',
    name: L('Vendor concentration', 'تركز الموردين'),
    objective: L('Identify dependency on individual vendors.', 'تحديد الاعتماد على موردين بعينهم.'),
    rule: L('Vendor share of AP value ≥ concentration threshold %', 'حصة المورد من قيمة الدائنين ≥ حد التركز'),
    criteria: L('Diversified supply base per procurement policy.', 'تنويع قاعدة الموردين وفق سياسة المشتريات.'),
    cause: L('Possible causes: sole-source arrangements, limited market.', 'أسباب محتملة: التوريد من مصدر وحيد أو محدودية السوق.'),
    effect: L('Supply and pricing dependency risk.', 'مخاطر الاعتماد في التوريد والتسعير.'),
    recommendation: L('Assess dependency and develop alternative sources where feasible.', 'تقييم الاعتماد وتطوير مصادر بديلة متى أمكن.'),
    needs: needAP([]),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['vendor', 'amount']);
      if (missing.length) return insufficient(missing);
      return concentration(ctx, list, 'vendor', 'amount', L('Vendor', 'المورد'));
    },
  },
  {
    ...base, id: 'AP-10', severity: 'high', fraud: true, controlId: 'C-VM-01', riskId: 'R-FD-02',
    name: L('Shared bank accounts between vendors', 'حسابات بنكية مشتركة بين الموردين'),
    objective: L('Detect different vendors paid into the same bank account.', 'كشف موردين مختلفين يُسدد لهم في نفس الحساب البنكي.'),
    rule: L('Count(distinct vendors per bank account) > 1', 'عدد الموردين المختلفين لنفس الحساب البنكي > 1'),
    criteria: L('Vendor master data must be unique and verified.', 'يجب أن تكون بيانات الموردين فريدة ومتحقق منها.'),
    cause: L('Possible causes: ghost vendor, master-data manipulation, group companies.', 'أسباب محتملة: مورد وهمي أو تلاعب بالبيانات الرئيسية أو شركات مجموعة.'),
    effect: L('Funds may be diverted.', 'احتمال تحويل الأموال لجهات غير مستحقة.'),
    recommendation: L('Verify bank ownership with each vendor independently; restrict vendor bank changes to dual control.', 'التحقق المستقل من ملكية الحسابات مع كل مورد وتطبيق الرقابة المزدوجة على تعديل الحسابات.'),
    needs: [{ type: 'vendors', fields: ['vendor', 'bankAccount'] }],
    run(ctx) {
      let src = recs(ctx, 'vendors', ['vendor', 'bankAccount']);
      if (src.missing.length) src = recs(ctx, 'ap', ['vendor', 'bankAccount']);
      if (src.missing.length) return insufficient(['Vendor master or AP with vendor bank account required']);
      const g = groupBy(src.list, (x) => x.a.t(x.r, 'bankAccount').replace(/\s/g, '').toUpperCase());
      const out: TestException[] = [];
      for (const [b, items] of g) {
        const vs = [...new Set(items.map((x) => normName(x.a.t(x.r, 'vendor'))))];
        if (vs.length > 1) out.push(exc(keyOf('AP-10', b), L(`${vs.length} vendors share one bank account (••••${b.slice(-4)})`, `${vs.length} موردين يشتركون في حساب بنكي واحد (••••${b.slice(-4)})`), items, ['vendor', 'bankAccount'],
          { formula: 'Count(distinct vendor | bank account) > 1', inputs: items.slice(0, 10).map((i) => ({ label: L('Vendor', 'المورد'), value: i.a.t(i.r, 'vendor'), ref: ref(i) })), result: vs.length }));
      }
      return { status: 'performed', missing: [], population: g.size, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-11', severity: 'critical', fraud: true, controlId: 'C-VM-01', riskId: 'R-FD-02',
    name: L('Vendor / employee overlap', 'تطابق بين موردين وموظفين'),
    objective: L('Detect vendors sharing bank account, national/tax ID or name with employees.', 'كشف موردين يشتركون مع موظفين في الحساب البنكي أو الرقم القومي/الضريبي أو الاسم.'),
    rule: L('Vendor bank account = Employee bank account, OR normalized vendor name = employee name', 'حساب المورد = حساب الموظف أو اسم المورد = اسم الموظف'),
    criteria: L('Conflict-of-interest policy; vendors must be independent of employees.', 'سياسة تعارض المصالح؛ استقلال الموردين عن الموظفين.'),
    cause: L('Possible causes: undisclosed interest, fictitious vendor set up by an employee.', 'أسباب محتملة: مصلحة غير مفصح عنها أو مورد وهمي أنشأه موظف.'),
    effect: L('Potential fraud and conflict of interest.', 'احتمال احتيال وتعارض مصالح.'),
    recommendation: L('Refer matches to investigation; require annual conflict-of-interest declarations.', 'إحالة التطابقات للتحقيق واشتراط إقرارات تعارض المصالح سنويًا.'),
    needs: [{ type: 'payroll', fields: ['employeeId', 'bankAccount'] }, { type: 'vendors', fields: ['vendor', 'bankAccount'] }],
    run(ctx) {
      const emp = recs(ctx, 'payroll', ['employeeId']);
      if (emp.missing.length) return insufficient(emp.missing);
      let ven = recs(ctx, 'vendors', ['vendor']);
      if (ven.missing.length) ven = recs(ctx, 'ap', ['vendor']);
      if (ven.missing.length) return insufficient(['Vendor master or AP dataset required']);
      const byBank = new Map<string, Rec>(), byName = new Map<string, Rec>(), byId = new Map<string, Rec>();
      for (const e of emp.list) {
        const b = e.a.t(e.r, 'bankAccount').replace(/\s/g, '').toUpperCase(); if (b) byBank.set(b, e);
        const n = normName(e.a.t(e.r, 'employeeName')); if (n.length > 5) byName.set(n, e);
        const id = e.a.t(e.r, 'nationalId'); if (id) byId.set(id, e);
      }
      const out: TestException[] = []; const done = new Set<string>();
      for (const v of ven.list) {
        const b = v.a.t(v.r, 'bankAccount').replace(/\s/g, '').toUpperCase();
        const n = normName(v.a.t(v.r, 'vendor'));
        const tid = v.a.t(v.r, 'taxId');
        const hit = (b && byBank.get(b)) ? { e: byBank.get(b)!, why: 'bank account', f: ['bankAccount'] } : byName.get(n) ? { e: byName.get(n)!, why: 'name', f: ['vendor'] } : (tid && byId.get(tid)) ? { e: byId.get(tid)!, why: 'ID number', f: ['taxId'] } : null;
        if (!hit) continue;
        const k = keyOf('AP-11', n, hit.e.a.t(hit.e.r, 'employeeId'));
        if (done.has(k)) continue; done.add(k);
        out.push(exc(k, L(`Vendor "${v.a.t(v.r, 'vendor')}" matches employee ${hit.e.a.t(hit.e.r, 'employeeId')} on ${hit.why}`, `المورد "${v.a.t(v.r, 'vendor')}" يطابق الموظف ${hit.e.a.t(hit.e.r, 'employeeId')} في ${hit.why === 'name' ? 'الاسم' : hit.why === 'bank account' ? 'الحساب البنكي' : 'رقم الهوية'}`),
          [v, hit.e], [hit.f, hit.why === 'name' ? ['employeeName'] : hit.why === 'bank account' ? ['bankAccount'] : ['nationalId']],
          { formula: `Vendor.${hit.why} = Employee.${hit.why}`, inputs: [{ label: L('Vendor', 'المورد'), value: v.a.t(v.r, 'vendor'), ref: ref(v) }, { label: L('Employee ID', 'رقم الموظف'), value: hit.e.a.t(hit.e.r, 'employeeId'), ref: ref(hit.e) }], result: 'Match' }));
      }
      return { status: 'performed', missing: [], population: ven.list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-12', severity: 'high', fraud: true, controlId: 'C-AU-01',
    name: L('Split invoices', 'تجزئة الفواتير'),
    objective: L('Detect invoices split to stay below approval limits.', 'كشف تجزئة الفواتير للبقاء أسفل حدود الاعتماد.'),
    rule: L('Same vendor, ≥ 2 invoices within window, each < limit, combined ≥ limit', 'نفس المورد، فاتورتان أو أكثر خلال المدة، كل منها < الحد ومجموعها ≥ الحد'),
    criteria: L('Delegation of Authority approval limits.', 'حدود جدول الصلاحيات.'),
    cause: L('Possible causes: approval avoidance.', 'أسباب محتملة: تجنب الاعتماد الأعلى.'),
    effect: L('Purchases bypass required approval level.', 'تجاوز المشتريات لمستوى الاعتماد المطلوب.'),
    recommendation: L('Apply cumulative thresholds per vendor; investigate listed clusters.', 'تطبيق حدود تراكمية لكل مورد وفحص التجمعات المرصودة.'),
    needs: needAP(['invoiceDate']),
    run(ctx) {
      const lim = ctx.settings.approvalLimits;
      if (!lim.length) return insufficient(['Approval limits not configured (Settings)']);
      const { list, missing } = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount', 'invoiceDate']);
      if (missing.length) return insufficient(missing);
      return splitTest('AP-12', ctx, list, 'vendor', 'invoiceDate', 'amount', 'invoiceNo');
    },
  },
  {
    ...base, id: 'AP-13', severity: 'high', fraud: true, controlId: 'C-VM-01',
    name: L('Invoices from inactive / blocked vendors', 'فواتير من موردين موقوفين'),
    objective: L('Detect activity on vendors marked inactive or blocked.', 'كشف نشاط على موردين موقوفين أو غير نشطين.'),
    rule: L('Vendor master status ∈ {inactive, blocked, dormant} AND invoice exists', 'حالة المورد موقوف/غير نشط مع وجود فاتورة'),
    criteria: L('Inactive vendors must not transact.', 'لا يجوز التعامل مع موردين غير نشطين.'),
    cause: L('Possible causes: master-data not enforced, reactivated vendor misuse.', 'أسباب محتملة: عدم تطبيق البيانات الرئيسية أو إساءة استخدام مورد معاد تنشيطه.'),
    effect: L('Payments to unauthorized vendors.', 'مدفوعات لموردين غير مصرح بهم.'),
    recommendation: L('Block transactions on inactive vendors at system level.', 'منع التعامل آليًا مع الموردين غير النشطين.'),
    needs: [{ type: 'vendors', fields: ['vendor', 'status'] }, { type: 'ap', fields: ['vendor', 'invoiceNo', 'amount'] }],
    run(ctx) {
      const vm = recs(ctx, 'vendors', ['vendor', 'status']); if (vm.missing.length) return insufficient(vm.missing);
      const ap = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount']); if (ap.missing.length) return insufficient(ap.missing);
      const inactive = new Map<string, Rec>();
      for (const v of vm.list) if (/inactive|block|dormant|suspend|موقوف|غير نشط/i.test(v.a.t(v.r, 'status'))) inactive.set(normName(v.a.t(v.r, 'vendor')), v);
      const out: TestException[] = [];
      for (const x of ap.list) { const v = inactive.get(normName(x.a.t(x.r, 'vendor'))); if (v) out.push(exc(keyOf('AP-13', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} from vendor with status "${v.a.t(v.r, 'status')}"`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} من مورد حالته "${v.a.t(v.r, 'status')}"`), [x, v], [['vendor', 'invoiceNo'], ['status']], { formula: 'Vendor status ∈ inactive AND invoice exists', inputs: [{ label: L('Vendor status', 'حالة المورد'), value: v.a.t(v.r, 'status'), ref: ref(v) }], result: 'Inactive vendor activity' }, amt(x, 'amount', ctx.settings))); }
      return { status: 'performed', missing: [], population: ap.list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-14', severity: 'medium', fraud: true, controlId: 'C-VM-02',
    name: L('Vendor master change shortly before payment', 'تعديل بيانات مورد قبل السداد مباشرة'),
    objective: L('Detect vendor master changes within 30 days before a payment.', 'كشف تعديل بيانات المورد خلال 30 يومًا قبل السداد.'),
    rule: L('0 ≤ Payment date − Vendor last-changed date ≤ 30', '0 ≤ تاريخ السداد − تاريخ آخر تعديل ≤ 30'),
    criteria: L('Changes to vendor bank details require independent verification.', 'يتطلب تعديل البيانات البنكية للمورد تحققًا مستقلًا.'),
    cause: L('Possible causes: bank-detail change fraud (business email compromise).', 'أسباب محتملة: احتيال تغيير البيانات البنكية (اختراق البريد).'),
    effect: L('Payments diverted to fraudulent accounts.', 'تحويل المدفوعات إلى حسابات احتيالية.'),
    recommendation: L('Call-back verification for all vendor bank changes; hold first payment after change.', 'التحقق الهاتفي من كل تعديل بنكي وتعليق أول دفعة بعد التعديل.'),
    needs: [{ type: 'vendors', fields: ['vendor', 'changedDate'] }, { type: 'ap', fields: ['vendor', 'paymentDate'] }],
    run(ctx) {
      const vm = recs(ctx, 'vendors', ['vendor', 'changedDate']); if (vm.missing.length) return insufficient(vm.missing);
      const ap = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount', 'paymentDate']); if (ap.missing.length) return insufficient(ap.missing);
      const ch = new Map<string, Rec>(); for (const v of vm.list) ch.set(normName(v.a.t(v.r, 'vendor')), v);
      const out: TestException[] = [];
      for (const x of ap.list) {
        const v = ch.get(normName(x.a.t(x.r, 'vendor'))); if (!v) continue;
        const c = v.a.d(v.r, 'changedDate'), p = x.a.d(x.r, 'paymentDate'); if (!c || !p) continue;
        const g = dayDiff(c, p);
        if (g >= 0 && g <= 30) out.push(exc(keyOf('AP-14', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Vendor ${x.a.t(x.r, 'vendor')} changed ${g} days before payment of invoice ${x.a.t(x.r, 'invoiceNo')}`, `تم تعديل المورد ${x.a.t(x.r, 'vendor')} قبل ${g} يومًا من سداد الفاتورة ${x.a.t(x.r, 'invoiceNo')}`), [x, v], [['paymentDate'], ['changedDate', 'changedBy']],
          { formula: 'Gap = Payment date − Vendor changed date', inputs: [{ label: L('Changed', 'تاريخ التعديل'), value: c, ref: ref(v) }, { label: L('Paid', 'تاريخ السداد'), value: p, ref: ref(x) }], result: g }, amt(x, 'amount', ctx.settings)));
      }
      return { status: 'performed', missing: [], population: ap.list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-15', severity: 'low', controlId: 'C-PY-01',
    name: L('Urgent payments', 'مدفوعات عاجلة'),
    objective: L('Identify payments flagged urgent for approval review.', 'تحديد المدفوعات المصنفة عاجلة لمراجعة اعتمادها.'),
    rule: L('Urgent flag = yes / urgent', 'علامة العاجل = نعم'),
    criteria: L('Urgent payments follow an exception approval route.', 'تخضع المدفوعات العاجلة لمسار اعتماد استثنائي.'),
    cause: L('Possible causes: poor planning, pressure to bypass controls.', 'أسباب محتملة: ضعف التخطيط أو الضغط لتجاوز الضوابط.'),
    effect: L('Controls may be bypassed under time pressure.', 'احتمال تجاوز الضوابط تحت ضغط الوقت.'),
    recommendation: L('Monitor urgent-payment frequency and require CFO approval.', 'متابعة تكرار المدفوعات العاجلة واشتراط اعتماد المدير المالي.'),
    needs: needAP(['urgent']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['invoiceNo', 'amount', 'urgent']);
      if (missing.length) return insufficient(missing);
      const out = list.filter((x) => /^(y|yes|true|1|urgent|high|عاجل|نعم)$/i.test(x.a.t(x.r, 'urgent'))).map((x) => exc(keyOf('AP-15', x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} paid as urgent`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} سُددت كعاجلة`), [x], ['urgent'], { formula: 'Urgent = Yes', inputs: [{ label: L('Urgent', 'عاجل'), value: x.a.t(x.r, 'urgent') }], result: 'Urgent' }, amt(x, 'amount', ctx.settings)));
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-16', severity: 'low', controlId: 'C-PY-01',
    name: L('Unusual payment timing', 'توقيت سداد غير معتاد'),
    objective: L('Identify payments made far ahead of due date.', 'تحديد المدفوعات التي تمت قبل موعد الاستحقاق بفترة طويلة.'),
    rule: L('Due date − Payment date > 30 days', 'تاريخ الاستحقاق − تاريخ السداد > 30 يومًا'),
    criteria: L('Payments are made on due date per treasury policy.', 'يتم السداد في تاريخ الاستحقاق وفق سياسة الخزانة.'),
    cause: L('Possible causes: favouritism, poor cash management.', 'أسباب محتملة: محاباة أو ضعف إدارة النقدية.'),
    effect: L('Loss of working-capital benefit; favouritism risk.', 'فقدان ميزة رأس المال العامل ومخاطر المحاباة.'),
    recommendation: L('Align payment runs to due dates; approve early payments explicitly.', 'ربط دورات السداد بتواريخ الاستحقاق واعتماد السداد المبكر صراحة.'),
    needs: needAP(['dueDate', 'paymentDate']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['invoiceNo', 'amount', 'dueDate', 'paymentDate']);
      if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const x of list) { const d = x.a.d(x.r, 'dueDate'), p = x.a.d(x.r, 'paymentDate'); if (d && p && dayDiff(p, d) > 30) out.push(exc(keyOf('AP-16', x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} paid ${dayDiff(p, d)} days before due`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} سُددت قبل استحقاقها بـ ${dayDiff(p, d)} يومًا`), [x], ['dueDate', 'paymentDate'], { formula: 'Due date − Payment date', inputs: [{ label: L('Due', 'الاستحقاق'), value: d }, { label: L('Paid', 'السداد'), value: p }], result: dayDiff(p, d) }, amt(x, 'amount', ctx.settings))); }
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'AP-17', severity: 'high', fraud: true, controlId: 'C-VM-01', riskId: 'R-FD-02',
    name: L('Vendors not in vendor master', 'موردون غير مسجلين في البيانات الرئيسية'),
    objective: L('Detect invoices from vendors absent from the approved vendor master (ghost-vendor indicator).', 'كشف فواتير من موردين غير موجودين في قائمة الموردين المعتمدة (مؤشر مورد وهمي).'),
    rule: L('Normalized AP vendor ∉ vendor master', 'المورد في الدائنين غير موجود في البيانات الرئيسية'),
    criteria: L('Only approved vendors may be paid.', 'يُسمح بالسداد للموردين المعتمدين فقط.'),
    cause: L('Possible causes: one-time vendors, data-extract mismatch, fictitious vendors.', 'أسباب محتملة: موردون لمرة واحدة أو اختلاف الاستخراج أو موردون وهميون.'),
    effect: L('Payments to unverified parties.', 'مدفوعات لجهات غير متحقق منها.'),
    recommendation: L('Validate each vendor; prohibit one-time vendor usage above a low threshold.', 'التحقق من كل مورد وحظر استخدام موردي المرة الواحدة فوق حد منخفض.'),
    needs: [{ type: 'vendors', fields: ['vendor'] }, { type: 'ap', fields: ['vendor', 'invoiceNo', 'amount'] }],
    run(ctx) {
      const vm = recs(ctx, 'vendors', ['vendor']); if (vm.missing.length) return insufficient(vm.missing);
      const ap = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount']); if (ap.missing.length) return insufficient(ap.missing);
      const known = new Set<string>();
      for (const v of vm.list) { known.add(normName(v.a.t(v.r, 'vendor'))); const id = v.a.t(v.r, 'vendorId'); if (id) known.add(normName(id)); }
      const g = groupBy(ap.list.filter((x) => !known.has(normName(x.a.t(x.r, 'vendor')))), (x) => normName(x.a.t(x.r, 'vendor')));
      const out: TestException[] = [];
      for (const [k, items] of g) {
        const ex: Record<string, number> = {};
        items.forEach((i) => { const m = amt(i, 'amount', ctx.settings); if (m) ex[m.currency] = (ex[m.currency] ?? 0) + Math.abs(m.amount); });
        const [cur, sum] = Object.entries(ex)[0] ?? ['—', 0];
        out.push(exc(keyOf('AP-17', k), L(`Vendor "${items[0].a.t(items[0].r, 'vendor')}" (${items.length} invoices) not in vendor master`, `المورد "${items[0].a.t(items[0].r, 'vendor')}" (${items.length} فواتير) غير موجود في البيانات الرئيسية`), items, ['vendor'],
          { formula: 'Vendor ∉ Vendor master', inputs: [{ label: L('Vendor', 'المورد'), value: items[0].a.t(items[0].r, 'vendor') }, { label: L('Vendor master records', 'سجلات الموردين'), value: vm.list.length }], result: 'Not found' }, { amount: sum, currency: cur }));
      }
      return { status: 'performed', missing: [], population: ap.list.length, exceptions: out };
    },
  },
];

/** Shared split-transaction detector (AP invoices / procurement POs). */
export function splitTest(id: string, ctx: Parameters<TestDef['run']>[0], list: Rec[], partyField: string, dateField: string, amountField: string, docField: string) {
  const lim = ctx.settings.approvalLimits;
  const w = ctx.settings.splitWindowDays;
  const out: TestException[] = [];
  const g = groupBy(list, (x) => normName(x.a.t(x.r, partyField)));
  for (const [, items] of g) {
    const s = items.map((x) => ({ x, d: x.a.d(x.r, dateField), m: amt(x, amountField, ctx.settings) }))
      .filter((y) => y.d && y.m && y.m.currency === ctx.settings.baseCurrency)
      .sort((a, b) => a.d!.localeCompare(b.d!));
    const used = new Set<number>();
    for (let i = 0; i < s.length; i++) {
      if (used.has(i)) continue;
      const cluster = [i];
      for (let j = i + 1; j < s.length && dayDiff(s[i].d!, s[j].d!) <= w; j++) if (!used.has(j)) cluster.push(j);
      if (cluster.length < 2) continue;
      const amts = cluster.map((c) => Math.abs(s[c].m!.amount));
      const total = amts.reduce((p, q) => p + q, 0);
      const l = lim.find((L) => amts.every((a) => a < L) && total >= L);
      if (!l) continue;
      cluster.forEach((c) => used.add(c));
      const xs = cluster.map((c) => s[c].x);
      out.push(exc(keyOf(id, ...xs.map((x) => x.a.t(x.r, docField))), { en: `${xs.length} documents from ${text(xs[0].a.raw(xs[0].r, partyField))} within ${w} days total ${fmtNum(total)} (limit ${fmtNum(l)})`, ar: `${xs.length} مستندات من ${text(xs[0].a.raw(xs[0].r, partyField))} خلال ${w} يومًا بإجمالي ${fmtNum(total)} (الحد ${fmtNum(l)})` },
        xs, [partyField, dateField, amountField, docField],
        { formula: 'Each amount < Limit AND Σ amounts (within window) ≥ Limit', inputs: [...xs.map((x) => ({ label: { en: x.a.t(x.r, docField), ar: x.a.t(x.r, docField) }, value: x.a.n(x.r, amountField), ref: ref(x) })), { label: { en: 'Limit', ar: 'الحد' }, value: l }], result: round2(total) },
        { amount: total, currency: ctx.settings.baseCurrency }));
    }
  }
  return { status: 'performed' as const, missing: [], population: list.length, exceptions: out, params: { limits: lim.join(', '), windowDays: w } };
}
