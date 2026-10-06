import type { TestException } from '../types';
import { weekday, dayDiff, hourOf, isApproved, fmtNum } from '../values';
import { type TestDef, type Rec, recs, insufficient, exc, amt, groupBy, isRound, keyOf, hasKeyword, round2 } from './kit';

const lineAmt = (x: Rec) => (x.a.n(x.r, 'debit') ?? 0) || (x.a.n(x.r, 'credit') ?? 0);
const glMoney = (x: Rec, s: Parameters<typeof amt>[2]) => {
  const v = lineAmt(x);
  if (x.a.has('egp') && x.a.n(x.r, 'egp') !== null) return { amount: Math.abs(x.a.n(x.r, 'egp')!), currency: 'EGP' };
  const c = x.a.t(x.r, 'currency').toUpperCase();
  return { amount: Math.abs(v), currency: c || (s.assumeBaseCurrencyWhenMissing ? s.baseCurrency : '—') };
};
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const common = { area: 'gl' as const, riskId: 'R-FR-01', controlId: 'C-JE-01' };
const needGL = (f: string[]) => [{ type: 'gl' as const, fields: ['journalId', 'date', 'account', ...f] }];

type Ctx = Parameters<TestDef['run']>[0];
type DatePred = (ctx: Ctx, x: Rec, d: string) => { en: string; ar: string; formula: string; result: string } | null;

/** Journal-level date test builder: one exception per journal whose date satisfies the predicate. */
function dateJournalTest(def: Omit<TestDef, 'run'>, pred: DatePred, guard: (ctx: Ctx) => string | null, params: (ctx: Ctx) => Record<string, string | number>): TestDef {
  return {
    ...def,
    run(ctx) {
      const g = guard(ctx); if (g) return insufficient([g]);
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'date', 'debit', 'credit']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      for (const [j, lines] of byJ) {
        const d = lines[0].a.d(lines[0].r, 'date'); if (!d) continue;
        const p = pred(ctx, lines[0], d); if (!p) continue;
        const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
        const m = glMoney(lines[0], ctx.settings);
        out.push(exc(keyOf(def.id, j), { en: `Journal ${j}: ${p.en}`, ar: `القيد ${j}: ${p.ar}` }, lines, ['journalId', 'date'],
          { formula: p.formula, inputs: [{ label: { en: 'Journal date', ar: 'تاريخ القيد' }, value: d, ref: { tableId: lines[0].a.table.id, recordId: lines[0].r.recordId }, field: 'date' }, { label: { en: 'Journal total debit', ar: 'إجمالي مدين القيد' }, value: round2(tot) }], result: p.result },
          { amount: tot, currency: m.currency }));
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out, params: params(ctx) };
    },
  };
}

export const GL_TESTS: TestDef[] = [
  {
    ...common, id: 'GL-01', severity: 'high', controlId: 'C-JE-02',
    name: { en: 'Unbalanced journals', ar: 'قيود غير متوازنة' },
    objective: { en: 'Confirm every journal balances (Σ debit = Σ credit).', ar: 'التحقق من توازن كل قيد (إجمالي المدين = إجمالي الدائن).' },
    rule: { en: 'Flag journals where |Σ Debit − Σ Credit| > 0.005', ar: 'رصد القيود التي يكون فيها |إجمالي المدين − إجمالي الدائن| > 0.005' },
    criteria: { en: 'Double-entry principle; ERP should block unbalanced postings.', ar: 'مبدأ القيد المزدوج؛ يجب أن يمنع النظام ترحيل القيود غير المتوازنة.' },
    cause: { en: 'Possible causes (auditor to confirm): incomplete extract, interface error, or system validation disabled.', ar: 'أسباب محتملة (يؤكدها المراجع): استخراج غير مكتمل، خطأ في الربط، أو تعطيل التحقق في النظام.' },
    effect: { en: 'Ledger integrity is compromised; balances may be misstated.', ar: 'سلامة الدفاتر معرضة للخطر وقد تكون الأرصدة محرفة.' },
    recommendation: { en: 'Investigate each unbalanced journal, correct the ledger and enforce a system-level balance check on posting.', ar: 'فحص كل قيد غير متوازن وتصحيح الدفاتر وتفعيل التحقق الآلي من التوازن عند الترحيل.' },
    needs: needGL(['debit', 'credit']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'debit', 'credit']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      for (const [j, lines] of byJ) {
        const d = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
        const c = lines.reduce((s, x) => s + (x.a.n(x.r, 'credit') ?? 0), 0);
        if (Math.abs(d - c) > 0.005) {
          const m = glMoney(lines[0], ctx.settings);
          out.push(exc(keyOf('GL-01', j), { en: `Journal ${j} is out of balance by ${fmtNum(d - c)}`, ar: `القيد ${j} غير متوازن بفرق ${fmtNum(d - c)}` }, lines, ['debit', 'credit', 'journalId'],
            { formula: 'Difference = Σ Debit − Σ Credit', inputs: [{ label: { en: 'Σ Debit', ar: 'إجمالي المدين' }, value: round2(d) }, { label: { en: 'Σ Credit', ar: 'إجمالي الدائن' }, value: round2(c) }], result: round2(d - c) },
            { amount: Math.abs(d - c), currency: m.currency }));
        }
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out };
    },
  },
  dateJournalTest({
    ...common, id: 'GL-02', severity: 'medium',
    name: { en: 'Weekend journals', ar: 'قيود في عطلة نهاية الأسبوع' },
    objective: { en: 'Identify journals dated on non-working days.', ar: 'تحديد القيود المؤرخة في أيام العطلة.' },
    rule: { en: 'Journal date weekday ∈ configured weekend days', ar: 'يوم تاريخ القيد ضمن أيام العطلة المحددة' },
    criteria: { en: 'Postings normally occur on working days; weekend entries warrant review.', ar: 'يتم الترحيل عادة في أيام العمل؛ قيود العطلات تستوجب المراجعة.' },
    cause: { en: 'Possible causes: system batch dates, backdating, or unsupervised postings.', ar: 'أسباب محتملة: تواريخ معالجة آلية، أو تأريخ بأثر رجعي، أو ترحيل دون إشراف.' },
    effect: { en: 'Higher risk of unauthorized or unsupervised entries.', ar: 'ارتفاع مخاطر القيود غير المصرح بها أو غير الخاضعة للإشراف.' },
    recommendation: { en: 'Review weekend journals for support and approval; restrict posting access on non-working days.', ar: 'مراجعة مستندات واعتماد قيود العطلات وتقييد صلاحيات الترحيل في أيام العطلة.' },
    needs: needGL([]),
  }, (ctx, _x, d) => {
    const w = weekday(d);
    if (!ctx.settings.weekendDays.includes(w)) return null;
    return { en: `dated ${d} (${DAYS_EN[w]})`, ar: `بتاريخ ${d} (${DAYS_AR[w]})`, formula: 'Weekday(Journal date) ∈ Weekend days', result: DAYS_EN[w] };
  }, (ctx) => (ctx.settings.weekendDays.length ? null : 'Weekend days not configured (Settings)'),
  (ctx) => ({ weekendDays: ctx.settings.weekendDays.map((x) => DAYS_EN[x]).join(', ') })),
];

GL_TESTS.push(
  dateJournalTest({
    ...common, id: 'GL-03', severity: 'medium',
    name: { en: 'Holiday journals', ar: 'قيود في العطلات الرسمية' },
    objective: { en: 'Identify journals dated on official holidays.', ar: 'تحديد القيود المؤرخة في العطلات الرسمية.' },
    rule: { en: 'Journal date ∈ company holiday calendar', ar: 'تاريخ القيد ضمن تقويم العطلات المعتمد' },
    criteria: { en: 'Company holiday calendar (configured in Settings).', ar: 'تقويم العطلات المعتمد للشركة (من الإعدادات).' },
    cause: { en: 'Possible causes: backdating or unsupervised postings.', ar: 'أسباب محتملة: تأريخ بأثر رجعي أو ترحيل دون إشراف.' },
    effect: { en: 'Risk of unauthorized entries.', ar: 'مخاطر قيود غير مصرح بها.' },
    recommendation: { en: 'Obtain support and approval for each holiday journal.', ar: 'الحصول على مستندات واعتماد كل قيد في العطلات.' },
    needs: needGL([]),
  }, (ctx, _x, d) => (ctx.settings.holidays.includes(d) ? { en: `dated on holiday ${d}`, ar: `بتاريخ عطلة رسمية ${d}`, formula: 'Journal date ∈ Holiday calendar', result: d } : null),
  (ctx) => (ctx.settings.holidays.length ? null : 'Holiday calendar not configured (Settings) — the platform does not assume holidays'),
  (ctx) => ({ holidays: ctx.settings.holidays.length })),
  {
    ...common, id: 'GL-04', severity: 'medium',
    name: { en: 'After-hours entries', ar: 'قيود خارج ساعات العمل' },
    objective: { en: 'Identify entries created outside configured working hours.', ar: 'تحديد القيود المدخلة خارج ساعات العمل المحددة.' },
    rule: { en: 'Entry hour < start or ≥ end of configured working hours', ar: 'ساعة الإدخال قبل بداية أو بعد نهاية ساعات العمل' },
    criteria: { en: 'Company working hours (configured).', ar: 'ساعات العمل المعتمدة (من الإعدادات).' },
    cause: { en: 'Possible causes: remote access, batch jobs, unsupervised activity.', ar: 'أسباب محتملة: دخول عن بعد، معالجة آلية، نشاط دون إشراف.' },
    effect: { en: 'Higher risk of unauthorized postings.', ar: 'ارتفاع مخاطر الترحيل غير المصرح به.' },
    recommendation: { en: 'Review after-hours entries and restrict ERP access windows.', ar: 'مراجعة القيود خارج ساعات العمل وتقييد أوقات الدخول للنظام.' },
    needs: needGL(['time']),
    run(ctx) {
      const { start, end } = ctx.settings.workHours;
      if (start === null || end === null) return insufficient(['Working hours not configured (Settings)']);
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'time']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      let skipped = 0;
      for (const [j, lines] of byJ) {
        const h = hourOf(lines[0].a.raw(lines[0].r, 'time'));
        if (h === null) { skipped++; continue; }
        if (h < start || h >= end) {
          const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
          out.push(exc(keyOf('GL-04', j), { en: `Journal ${j} entered at ${h}:00`, ar: `القيد ${j} أُدخل الساعة ${h}:00` }, lines, ['time', 'user'],
            { formula: 'Hour(Entry time) < Start OR ≥ End', inputs: [{ label: { en: 'Entry time', ar: 'وقت الإدخال' }, value: lines[0].a.raw(lines[0].r, 'time') }, { label: { en: 'Working hours', ar: 'ساعات العمل' }, value: `${start}:00–${end}:00` }], result: `${h}:00` },
            { amount: tot, currency: glMoney(lines[0], ctx.settings).currency }));
        }
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out, skipped, params: { workHours: `${start}-${end}` } };
    },
  },
  {
    ...common, id: 'GL-05', severity: 'low',
    name: { en: 'Round-number journals', ar: 'قيود بأرقام صحيحة مقربة' },
    objective: { en: 'Identify journal lines with round amounts, a common indicator of estimates or manipulation.', ar: 'تحديد بنود القيود ذات المبالغ المقربة كمؤشر على التقديرات أو التلاعب.' },
    rule: { en: 'Amount mod Round base = 0 AND Amount ≥ 10 × Round base', ar: 'المبلغ يقبل القسمة على الأساس المحدد وأكبر من أو يساوي 10 أضعافه' },
    criteria: { en: 'Transactions normally carry exact, supported amounts.', ar: 'تحمل المعاملات عادة مبالغ دقيقة ومؤيدة بالمستندات.' },
    cause: { en: 'Possible causes: accruals/estimates, manual adjustments.', ar: 'أسباب محتملة: استحقاقات أو تقديرات أو تسويات يدوية.' },
    effect: { en: 'Estimates may be unsupported or biased.', ar: 'قد تكون التقديرات غير مؤيدة أو متحيزة.' },
    recommendation: { en: 'Verify basis and support for round-amount entries.', ar: 'التحقق من أساس ومستندات القيود ذات المبالغ المقربة.' },
    needs: needGL(['debit', 'credit']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'debit', 'credit']);
      if (missing.length) return insufficient(missing);
      const b = ctx.settings.roundNumberBase;
      const out = list.filter((x) => isRound(lineAmt(x), b)).map((x) => exc(keyOf('GL-05', x.r.recordId), { en: `Journal ${x.a.t(x.r, 'journalId')} line amount ${fmtNum(lineAmt(x))}`, ar: `القيد ${x.a.t(x.r, 'journalId')} مبلغ البند ${fmtNum(lineAmt(x))}` }, [x], ['debit', 'credit'],
        { formula: `Amount mod ${b} = 0 AND Amount ≥ ${b * 10}`, inputs: [{ label: { en: 'Amount', ar: 'المبلغ' }, value: lineAmt(x), ref: { tableId: x.a.table.id, recordId: x.r.recordId } }], result: 'Round' }, glMoney(x, ctx.settings)));
      return { status: 'performed', missing: [], population: list.length, exceptions: out, params: { roundNumberBase: b } };
    },
  },
  {
    ...common, id: 'GL-06', severity: 'medium',
    name: { en: 'Large journals', ar: 'قيود ذات مبالغ كبيرة' },
    objective: { en: 'Identify journals at or above the large-amount threshold.', ar: 'تحديد القيود المساوية أو الأكبر من حد المبالغ الكبيرة.' },
    rule: { en: 'Σ Debit(journal) ≥ Large threshold (or Performance materiality)', ar: 'إجمالي مدين القيد ≥ حد المبالغ الكبيرة (أو الأهمية النسبية للتنفيذ)' },
    criteria: { en: 'Configured large-amount threshold / performance materiality.', ar: 'حد المبالغ الكبيرة / الأهمية النسبية للتنفيذ المحددة.' },
    cause: { en: 'Large entries carry higher misstatement risk by nature.', ar: 'القيود الكبيرة تحمل بطبيعتها مخاطر تحريف أعلى.' },
    effect: { en: 'Potential material misstatement if unsupported.', ar: 'احتمال تحريف جوهري إذا لم تكن مؤيدة.' },
    recommendation: { en: 'Vouch large journals to supporting documents and approvals.', ar: 'مطابقة القيود الكبيرة مع المستندات والاعتمادات.' },
    needs: needGL(['debit']),
    run(ctx) {
      const th = ctx.settings.largeAmount ?? ctx.settings.materiality.performance;
      if (!th) return insufficient(['Large-amount threshold and performance materiality are not configured (Settings)']);
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'debit']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      for (const [j, lines] of byJ) {
        const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
        const m = glMoney(lines[0], ctx.settings);
        if (m.currency !== ctx.settings.baseCurrency && m.currency !== 'EGP') continue;
        if (tot >= th) out.push(exc(keyOf('GL-06', j), { en: `Journal ${j} total ${fmtNum(tot)}`, ar: `القيد ${j} بإجمالي ${fmtNum(tot)}` }, lines, ['debit', 'journalId'],
          { formula: 'Σ Debit ≥ Threshold', inputs: [{ label: { en: 'Σ Debit', ar: 'إجمالي المدين' }, value: round2(tot) }, { label: { en: 'Threshold', ar: 'الحد' }, value: th }], result: 'Large' }, { amount: tot, currency: m.currency }));
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out, params: { threshold: th } };
    },
  },
  {
    ...common, id: 'GL-07', severity: 'high', fraud: true,
    name: { en: 'Duplicate journals', ar: 'قيود مكررة' },
    objective: { en: 'Detect journals posted more than once.', ar: 'كشف القيود المرحلة أكثر من مرة.' },
    rule: { en: 'Same account + date + amount + description across different Journal IDs', ar: 'نفس الحساب والتاريخ والمبلغ والبيان في قيود مختلفة' },
    criteria: { en: 'Each economic event is recorded once.', ar: 'تسجل كل عملية اقتصادية مرة واحدة فقط.' },
    cause: { en: 'Possible causes: re-keying, interface re-runs, or intentional duplication.', ar: 'أسباب محتملة: إعادة الإدخال، أو إعادة تشغيل الربط، أو تكرار متعمد.' },
    effect: { en: 'Overstatement of balances; possible duplicate payments.', ar: 'تضخيم الأرصدة واحتمال ازدواج المدفوعات.' },
    recommendation: { en: 'Reverse confirmed duplicates and add duplicate-detection controls at posting.', ar: 'عكس القيود المكررة المؤكدة وإضافة ضوابط لكشف التكرار عند الترحيل.' },
    needs: needGL(['debit', 'credit', 'description']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'date', 'account', 'debit', 'credit']);
      if (missing.length) return insufficient(missing);
      const g = groupBy(list.filter((x) => lineAmt(x) !== 0), (x) => keyOf(x.a.t(x.r, 'account'), x.a.d(x.r, 'date'), lineAmt(x), x.a.t(x.r, 'description').toLowerCase()));
      const out: TestException[] = [];
      for (const [k, items] of g) {
        const js = new Set(items.map((x) => x.a.t(x.r, 'journalId')));
        if (js.size < 2) continue;
        const m = glMoney(items[0], ctx.settings);
        out.push(exc(keyOf('GL-07', k), { en: `${js.size} journals (${[...js].slice(0, 4).join(', ')}) share account, date, amount and description`, ar: `${js.size} قيود (${[...js].slice(0, 4).join('، ')}) بنفس الحساب والتاريخ والمبلغ والبيان` }, items, ['account', 'date', 'debit', 'credit', 'description'],
          { formula: 'Count(distinct Journal ID | account, date, amount, description) ≥ 2', inputs: [{ label: { en: 'Amount', ar: 'المبلغ' }, value: lineAmt(items[0]) }, { label: { en: 'Journals', ar: 'القيود' }, value: [...js].join(', ') }], result: js.size },
          { amount: m.amount * (js.size - 1), currency: m.currency }));
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...common, id: 'GL-08', severity: 'high', controlId: 'C-JE-03',
    name: { en: 'Manual journals without approval', ar: 'قيود يدوية غير معتمدة' },
    objective: { en: 'Confirm manual journals are approved before posting.', ar: 'التحقق من اعتماد القيود اليدوية قبل الترحيل.' },
    rule: { en: 'Source indicates manual AND approval status ≠ approved', ar: 'المصدر يدوي وحالة الاعتماد غير معتمد' },
    criteria: { en: 'Manual journals require independent approval (maker-checker).', ar: 'تتطلب القيود اليدوية اعتمادًا مستقلًا (المُعِد والمراجِع).' },
    cause: { en: 'Possible causes: approval workflow not enforced in ERP.', ar: 'أسباب محتملة: عدم تفعيل دورة الاعتماد في النظام.' },
    effect: { en: 'Unauthorized adjustments may be posted.', ar: 'احتمال ترحيل تسويات غير مصرح بها.' },
    recommendation: { en: 'Enforce workflow approval for all manual journals and review unapproved items.', ar: 'تفعيل دورة الاعتماد لجميع القيود اليدوية ومراجعة غير المعتمد منها.' },
    needs: needGL(['source', 'approval']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'source', 'approval']);
      if (missing.length) return insufficient(missing);
      const manual = list.filter((x) => /manual|mje|gj|general journal|يدوي/i.test(x.a.t(x.r, 'source')));
      const byJ = groupBy(manual, (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      for (const [j, lines] of byJ) {
        const ap = isApproved(lines[0].a.t(lines[0].r, 'approval'));
        if (ap === true) continue;
        const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
        out.push(exc(keyOf('GL-08', j), { en: `Manual journal ${j} approval status "${lines[0].a.t(lines[0].r, 'approval') || 'blank'}"`, ar: `القيد اليدوي ${j} حالة الاعتماد "${lines[0].a.t(lines[0].r, 'approval') || 'فارغ'}"` }, lines, ['source', 'approval'],
          { formula: 'Source = Manual AND Approval ≠ Approved', inputs: [{ label: { en: 'Source', ar: 'المصدر' }, value: lines[0].a.t(lines[0].r, 'source') }, { label: { en: 'Approval', ar: 'الاعتماد' }, value: lines[0].a.t(lines[0].r, 'approval') }], result: 'Unapproved' },
          { amount: tot, currency: glMoney(lines[0], ctx.settings).currency }));
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out };
    },
  },
  {
    ...common, id: 'GL-09', severity: 'medium',
    name: { en: 'Backdated entries', ar: 'قيود بتاريخ سابق' },
    objective: { en: 'Identify entries posted long after their journal date.', ar: 'تحديد القيود المرحلة بعد فترة طويلة من تاريخها.' },
    rule: { en: 'Posting date − Journal date > Backdate tolerance (days)', ar: 'تاريخ الترحيل − تاريخ القيد > المهلة المسموحة (يوم)' },
    criteria: { en: 'Entries should be posted in the period they occur.', ar: 'يجب ترحيل القيود في الفترة التي تحدث فيها.' },
    cause: { en: 'Possible causes: late processing, period manipulation.', ar: 'أسباب محتملة: تأخر المعالجة أو التلاعب بالفترات.' },
    effect: { en: 'Cut-off errors; prior-period results may be altered.', ar: 'أخطاء في الفصل بين الفترات وتعديل نتائج فترات سابقة.' },
    recommendation: { en: 'Close prior periods in the ERP and require approval for backdated postings.', ar: 'إقفال الفترات السابقة في النظام واشتراط اعتماد القيود بأثر رجعي.' },
    needs: needGL(['postingDate']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'date', 'postingDate']);
      if (missing.length) return insufficient(missing);
      const tol = ctx.settings.backdateDays;
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      for (const [j, lines] of byJ) {
        const d = lines[0].a.d(lines[0].r, 'date'), p = lines[0].a.d(lines[0].r, 'postingDate');
        if (!d || !p) continue;
        const gap = dayDiff(d, p);
        if (gap > tol) {
          const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
          out.push(exc(keyOf('GL-09', j), { en: `Journal ${j} posted ${gap} days after journal date`, ar: `القيد ${j} رُحّل بعد ${gap} يومًا من تاريخه` }, lines, ['date', 'postingDate'],
            { formula: 'Gap = Posting date − Journal date', inputs: [{ label: { en: 'Journal date', ar: 'تاريخ القيد' }, value: d }, { label: { en: 'Posting date', ar: 'تاريخ الترحيل' }, value: p }, { label: { en: 'Tolerance (days)', ar: 'المهلة (يوم)' }, value: tol }], result: gap },
            { amount: tot, currency: glMoney(lines[0], ctx.settings).currency }));
        }
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out, params: { backdateDays: tol } };
    },
  },
  {
    ...common, id: 'GL-10', severity: 'medium', fraud: true,
    name: { en: 'Suspicious descriptions', ar: 'بيانات قيود مثيرة للشك' },
    objective: { en: 'Identify entries whose descriptions contain configured red-flag keywords.', ar: 'تحديد القيود التي تحتوي بياناتها على كلمات تحذيرية محددة.' },
    rule: { en: 'Description contains any configured keyword', ar: 'البيان يحتوي على إحدى الكلمات المحددة' },
    criteria: { en: 'Configured red-flag keyword list (Settings).', ar: 'قائمة الكلمات التحذيرية المحددة (الإعدادات).' },
    cause: { en: 'Possible causes: unusual or non-routine transactions.', ar: 'أسباب محتملة: معاملات غير معتادة أو غير روتينية.' },
    effect: { en: 'Potential override of controls.', ar: 'احتمال تجاوز الضوابط.' },
    recommendation: { en: 'Obtain explanations and support for flagged entries.', ar: 'الحصول على تفسيرات ومستندات للقيود المرصودة.' },
    needs: needGL(['description']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'description']);
      if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const x of list) {
        const k = hasKeyword(x.a.t(x.r, 'description'), ctx.settings.suspiciousKeywords);
        if (k) out.push(exc(keyOf('GL-10', x.r.recordId), { en: `Journal ${x.a.t(x.r, 'journalId')} description contains "${k}"`, ar: `بيان القيد ${x.a.t(x.r, 'journalId')} يحتوي على "${k}"` }, [x], ['description'],
          { formula: 'Description CONTAINS keyword', inputs: [{ label: { en: 'Description', ar: 'البيان' }, value: x.a.t(x.r, 'description') }, { label: { en: 'Keyword', ar: 'الكلمة' }, value: k }], result: 'Match' }, glMoney(x, ctx.settings)));
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out, params: { keywords: ctx.settings.suspiciousKeywords.join(', ') } };
    },
  },
  {
    ...common, id: 'GL-11', severity: 'medium', controlId: 'C-RC-02',
    name: { en: 'Suspense account postings', ar: 'ترحيلات على حسابات معلقة' },
    objective: { en: 'Identify postings to suspense / clearing accounts.', ar: 'تحديد الترحيلات على الحسابات المعلقة / الوسيطة.' },
    rule: { en: 'Account name contains a suspense keyword', ar: 'اسم الحساب يحتوي على كلمة دالة على حساب معلق' },
    criteria: { en: 'Suspense balances should be cleared promptly.', ar: 'يجب تسوية أرصدة الحسابات المعلقة فورًا.' },
    cause: { en: 'Possible causes: unidentified items, unreconciled differences.', ar: 'أسباب محتملة: بنود غير محددة أو فروق غير مسواة.' },
    effect: { en: 'Misclassification and hidden errors.', ar: 'سوء تبويب وأخطاء غير ظاهرة.' },
    recommendation: { en: 'Clear suspense items and analyse root causes monthly.', ar: 'تسوية البنود المعلقة وتحليل أسبابها شهريًا.' },
    needs: needGL(['accountName']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'accountName']);
      if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const x of list) {
        const k = hasKeyword(x.a.t(x.r, 'accountName'), ctx.settings.suspenseKeywords);
        if (k) out.push(exc(keyOf('GL-11', x.r.recordId), { en: `Posting to "${x.a.t(x.r, 'accountName')}" (journal ${x.a.t(x.r, 'journalId')})`, ar: `ترحيل على "${x.a.t(x.r, 'accountName')}" (القيد ${x.a.t(x.r, 'journalId')})` }, [x], ['account', 'accountName'],
          { formula: 'Account name CONTAINS suspense keyword', inputs: [{ label: { en: 'Account', ar: 'الحساب' }, value: x.a.t(x.r, 'accountName') }], result: k }, glMoney(x, ctx.settings)));
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...common, id: 'GL-12', severity: 'medium',
    name: { en: 'Year-end and post-closing journals', ar: 'قيود نهاية السنة وما بعد الإقفال' },
    objective: { en: 'Identify journals dated within 5 days of fiscal year-end or posted after it for that year.', ar: 'تحديد القيود المؤرخة خلال 5 أيام من نهاية السنة المالية أو المرحلة بعدها.' },
    rule: { en: '|Journal date − FYE| ≤ 5 days OR (Journal date ≤ FYE < Posting date)', ar: 'الفرق بين تاريخ القيد ونهاية السنة ≤ 5 أيام أو الترحيل بعد نهاية السنة' },
    criteria: { en: 'Year-end entries are high-risk for earnings management.', ar: 'قيود نهاية السنة عالية المخاطر لإدارة الأرباح.' },
    cause: { en: 'Possible causes: closing adjustments, cut-off manipulation.', ar: 'أسباب محتملة: تسويات الإقفال أو التلاعب بالفصل بين الفترات.' },
    effect: { en: 'Risk of misstatement in annual results.', ar: 'مخاطر تحريف النتائج السنوية.' },
    recommendation: { en: 'Review all year-end and post-closing journals with the Financial Controller.', ar: 'مراجعة جميع قيود نهاية السنة وما بعد الإقفال مع المراقب المالي.' },
    needs: needGL([]),
    run(ctx) {
      const fye = ctx.settings.fiscalYearEnd;
      if (!/^\d{2}-\d{2}$/.test(fye)) return insufficient(['Fiscal year-end not configured (Settings)']);
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'date']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      for (const [j, lines] of byJ) {
        const d = lines[0].a.d(lines[0].r, 'date'); if (!d) continue;
        const p = lines[0].a.d(lines[0].r, 'postingDate');
        const y = +d.slice(0, 4);
        const cands = [`${y - 1}-${fye}`, `${y}-${fye}`, `${y + 1}-${fye}`];
        const near = cands.find((c) => Math.abs(dayDiff(c, d)) <= 5);
        const post = cands.find((c) => d <= c && p && p > c);
        if (!near && !post) continue;
        const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
        out.push(exc(keyOf('GL-12', j), { en: `Journal ${j} dated ${d}${post ? `, posted ${p} after FYE ${post}` : ` near FYE ${near}`}`, ar: `القيد ${j} بتاريخ ${d}${post ? `، رُحّل ${p} بعد نهاية السنة ${post}` : ` قرب نهاية السنة ${near}`}` }, lines, ['date', 'postingDate'],
          { formula: '|Date − FYE| ≤ 5 OR Date ≤ FYE < Posting date', inputs: [{ label: { en: 'Journal date', ar: 'تاريخ القيد' }, value: d }, { label: { en: 'Posting date', ar: 'تاريخ الترحيل' }, value: p }, { label: { en: 'FYE', ar: 'نهاية السنة' }, value: post ?? near ?? '' }], result: post ? 'Post-closing' : 'Year-end' },
          { amount: tot, currency: glMoney(lines[0], ctx.settings).currency }));
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out, params: { fiscalYearEnd: fye } };
    },
  },
  {
    ...common, id: 'GL-13', severity: 'high', fraud: true, controlId: 'C-SD-01',
    name: { en: 'Self-approved journals', ar: 'قيود معتمدة من مُعدّها' },
    objective: { en: 'Verify segregation between preparer and approver.', ar: 'التحقق من الفصل بين المُعد والمعتمد.' },
    rule: { en: 'User = Approver', ar: 'المستخدم = المعتمد' },
    criteria: { en: 'Maker-checker / segregation of duties.', ar: 'مبدأ المُعد والمراجع / الفصل بين المهام.' },
    cause: { en: 'Possible causes: excessive ERP access rights.', ar: 'أسباب محتملة: صلاحيات زائدة في النظام.' },
    effect: { en: 'One person can record and authorize entries.', ar: 'يستطيع شخص واحد تسجيل القيود واعتمادها.' },
    recommendation: { en: 'Remove conflicting access and enforce workflow-based approval.', ar: 'إلغاء الصلاحيات المتعارضة وتفعيل الاعتماد عبر دورة العمل.' },
    needs: needGL(['user', 'approver']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'user', 'approver']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      for (const [j, lines] of byJ) {
        const u = lines[0].a.t(lines[0].r, 'user'), ap = lines[0].a.t(lines[0].r, 'approver');
        if (u && ap && u.toLowerCase() === ap.toLowerCase()) {
          const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
          out.push(exc(keyOf('GL-13', j), { en: `Journal ${j} prepared and approved by ${u}`, ar: `القيد ${j} أعده واعتمده ${u}` }, lines, ['user', 'approver'],
            { formula: 'User = Approver', inputs: [{ label: { en: 'User', ar: 'المستخدم' }, value: u }, { label: { en: 'Approver', ar: 'المعتمد' }, value: ap }], result: 'Same' },
            { amount: tot, currency: glMoney(lines[0], ctx.settings).currency }));
        }
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out };
    },
  },
  {
    ...common, id: 'GL-14', severity: 'low',
    name: { en: 'Unusual users', ar: 'مستخدمون غير معتادين' },
    objective: { en: 'Identify users who rarely post journals (possible generic or unauthorized IDs).', ar: 'تحديد المستخدمين نادري الترحيل (معرفات عامة أو غير مصرح بها).' },
    rule: { en: 'User posted ≤ 2 journals while population ≥ 50 journals', ar: 'المستخدم رحّل قيدين أو أقل من مجتمع ≥ 50 قيدًا' },
    criteria: { en: 'Postings should come from authorized finance users.', ar: 'يجب أن يتم الترحيل من مستخدمين ماليين مصرح لهم.' },
    cause: { en: 'Possible causes: generic accounts, temporary access, unauthorized users.', ar: 'أسباب محتملة: حسابات عامة أو صلاحيات مؤقتة أو مستخدمون غير مصرح لهم.' },
    effect: { en: 'Access control weaknesses.', ar: 'ضعف ضوابط الوصول.' },
    recommendation: { en: 'Confirm each rare user is authorized; review ERP user access list.', ar: 'التأكد من صلاحية كل مستخدم نادر ومراجعة قائمة صلاحيات النظام.' },
    needs: needGL(['user']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'user']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      if (byJ.size < 50) return { status: 'performed', missing: [], population: byJ.size, exceptions: [], params: { note: 'Population < 50 journals — rule not applicable' } };
      const byU = new Map<string, Set<string>>();
      for (const [j, lines] of byJ) { const u = lines[0].a.t(lines[0].r, 'user'); if (!u) continue; if (!byU.has(u)) byU.set(u, new Set()); byU.get(u)!.add(j); }
      const out: TestException[] = [];
      for (const [u, js] of byU) {
        if (js.size > 2) continue;
        const lines = [...js].flatMap((j) => byJ.get(j)!);
        out.push(exc(keyOf('GL-14', u), { en: `User "${u}" posted only ${js.size} journal(s)`, ar: `المستخدم "${u}" رحّل ${js.size} قيد فقط` }, lines, ['user'],
          { formula: 'Count(journals by user) ≤ 2', inputs: [{ label: { en: 'User', ar: 'المستخدم' }, value: u }, { label: { en: 'Population', ar: 'المجتمع' }, value: byJ.size }], result: js.size }));
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out };
    },
  },
  {
    ...common, id: 'GL-15', severity: 'low',
    name: { en: 'Repeated amounts', ar: 'مبالغ متكررة' },
    objective: { en: 'Identify the same non-trivial amount recurring across many journals.', ar: 'تحديد تكرار نفس المبلغ في عدد كبير من القيود.' },
    rule: { en: 'Same amount in ≥ 5 distinct journals (amount ≥ round base)', ar: 'نفس المبلغ في 5 قيود مختلفة أو أكثر' },
    criteria: { en: 'Unexplained recurring amounts may indicate duplicate or fictitious entries.', ar: 'المبالغ المتكررة دون تفسير قد تشير إلى قيود مكررة أو وهمية.' },
    cause: { en: 'Possible causes: recurring accruals, template entries, or manipulation.', ar: 'أسباب محتملة: استحقاقات متكررة أو قيود نمطية أو تلاعب.' },
    effect: { en: 'Possible duplicate or unsupported entries.', ar: 'احتمال قيود مكررة أو غير مؤيدة.' },
    recommendation: { en: 'Confirm recurring amounts relate to contracts or approved schedules.', ar: 'التأكد من ارتباط المبالغ المتكررة بعقود أو جداول معتمدة.' },
    needs: needGL(['debit']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'debit']);
      if (missing.length) return insufficient(missing);
      const g = groupBy(list.filter((x) => (x.a.n(x.r, 'debit') ?? 0) >= ctx.settings.roundNumberBase), (x) => String(x.a.n(x.r, 'debit')));
      const out: TestException[] = [];
      for (const [v, items] of g) {
        const js = new Set(items.map((x) => x.a.t(x.r, 'journalId')));
        if (js.size >= 5) out.push(exc(keyOf('GL-15', v), { en: `Amount ${fmtNum(+v)} appears in ${js.size} journals`, ar: `المبلغ ${fmtNum(+v)} يظهر في ${js.size} قيود` }, items.slice(0, 100), ['debit'],
          { formula: 'Count(distinct journals with amount) ≥ 5', inputs: [{ label: { en: 'Amount', ar: 'المبلغ' }, value: +v }], result: js.size }));
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...common, id: 'GL-16', severity: 'low',
    name: { en: 'Reversed journals', ar: 'قيود معكوسة' },
    objective: { en: 'Identify reversal entries for review of the original and the reason.', ar: 'تحديد قيود العكس لمراجعة القيد الأصلي وسبب العكس.' },
    rule: { en: 'Description contains reversal keyword (reversal / reverse / عكس / إلغاء)', ar: 'البيان يحتوي على كلمة دالة على العكس' },
    criteria: { en: 'Reversals should reference and explain the original entry.', ar: 'يجب أن تشير قيود العكس إلى القيد الأصلي وتوضح السبب.' },
    cause: { en: 'Possible causes: corrections, cut-off adjustments, window dressing.', ar: 'أسباب محتملة: تصحيحات أو تسويات فصل الفترات أو تجميل القوائم.' },
    effect: { en: 'Possible misstatement around period end.', ar: 'احتمال تحريف حول نهاية الفترة.' },
    recommendation: { en: 'Review reversals near period end for appropriateness.', ar: 'مراجعة قيود العكس حول نهاية الفترة للتأكد من سلامتها.' },
    needs: needGL(['description']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'description']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list.filter((x) => /revers|reverse|عكس|الغاء|إلغاء/i.test(x.a.t(x.r, 'description'))), (x) => x.a.t(x.r, 'journalId'));
      const out: TestException[] = [];
      for (const [j, lines] of byJ) {
        const tot = lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
        out.push(exc(keyOf('GL-16', j), { en: `Reversal journal ${j}`, ar: `قيد عكس ${j}` }, lines, ['description'],
          { formula: 'Description CONTAINS reversal keyword', inputs: [{ label: { en: 'Description', ar: 'البيان' }, value: lines[0].a.t(lines[0].r, 'description') }], result: 'Reversal' }, { amount: tot, currency: glMoney(lines[0], ctx.settings).currency }));
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...common, id: 'GL-17', severity: 'medium',
    name: { en: 'Dormant accounts reactivated', ar: 'حسابات خاملة أعيد تنشيطها' },
    objective: { en: 'Identify accounts with no postings for a long period that suddenly become active.', ar: 'تحديد الحسابات التي توقفت فترة طويلة ثم نشطت فجأة.' },
    rule: { en: 'Gap between consecutive postings on an account > Dormant days', ar: 'الفترة بين ترحيلين متتاليين على الحساب > أيام الخمول' },
    criteria: { en: 'Dormant accounts should be blocked or monitored.', ar: 'يجب إيقاف الحسابات الخاملة أو مراقبتها.' },
    cause: { en: 'Possible causes: misuse of inactive accounts.', ar: 'أسباب محتملة: إساءة استخدام الحسابات غير النشطة.' },
    effect: { en: 'Concealment risk.', ar: 'مخاطر الإخفاء.' },
    recommendation: { en: 'Block dormant accounts and review reactivation postings.', ar: 'إيقاف الحسابات الخاملة ومراجعة ترحيلات إعادة التنشيط.' },
    needs: needGL([]),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['account', 'date']);
      if (missing.length) return insufficient(missing);
      const g = groupBy(list, (x) => x.a.t(x.r, 'account'));
      const out: TestException[] = [];
      for (const [acct, items] of g) {
        const ds = items.map((x) => ({ x, d: x.a.d(x.r, 'date') })).filter((y) => y.d).sort((p, q) => p.d!.localeCompare(q.d!));
        for (let i = 1; i < ds.length; i++) {
          const gap = dayDiff(ds[i - 1].d!, ds[i].d!);
          if (gap > ctx.settings.dormantDays) {
            out.push(exc(keyOf('GL-17', acct, ds[i].d), { en: `Account ${acct} inactive for ${gap} days, then posted on ${ds[i].d}`, ar: `الحساب ${acct} خامل ${gap} يومًا ثم رُحّل عليه في ${ds[i].d}` }, [ds[i - 1].x, ds[i].x], ['account', 'date'],
              { formula: 'Gap = Date(n) − Date(n−1)', inputs: [{ label: { en: 'Previous posting', ar: 'الترحيل السابق' }, value: ds[i - 1].d }, { label: { en: 'Next posting', ar: 'الترحيل التالي' }, value: ds[i].d }, { label: { en: 'Dormant days', ar: 'أيام الخمول' }, value: ctx.settings.dormantDays }], result: gap }, glMoney(ds[i].x, ctx.settings)));
          }
        }
      }
      return { status: 'performed', missing: [], population: g.size, exceptions: out, params: { dormantDays: ctx.settings.dormantDays } };
    },
  },
  {
    ...common, id: 'GL-18', severity: 'low',
    name: { en: 'Unusual account combinations', ar: 'تركيبات حسابات غير معتادة' },
    objective: { en: 'Identify debit/credit account pairs that occur only once in a sizeable population.', ar: 'تحديد أزواج الحسابات المدينة/الدائنة التي تظهر مرة واحدة فقط.' },
    rule: { en: 'Pair (debit account → credit account) frequency = 1 with ≥ 100 journals', ar: 'تكرار زوج الحسابات = 1 في مجتمع ≥ 100 قيد' },
    criteria: { en: 'Routine transactions follow recurring account patterns.', ar: 'تتبع المعاملات الروتينية أنماط حسابات متكررة.' },
    cause: { en: 'Possible causes: misposting, non-routine or override entries.', ar: 'أسباب محتملة: خطأ في التوجيه أو قيود غير روتينية.' },
    effect: { en: 'Misclassification or concealment.', ar: 'سوء تبويب أو إخفاء.' },
    recommendation: { en: 'Review rare account pairings for business rationale.', ar: 'مراجعة أزواج الحسابات النادرة للتأكد من مبررها.' },
    needs: needGL(['debit', 'credit']),
    run(ctx) {
      const { list, missing } = recs(ctx, 'gl', ['journalId', 'account', 'debit', 'credit']);
      if (missing.length) return insufficient(missing);
      const byJ = groupBy(list, (x) => x.a.t(x.r, 'journalId'));
      if (byJ.size < 100) return { status: 'performed', missing: [], population: byJ.size, exceptions: [], params: { note: 'Population < 100 journals — rule not applicable' } };
      const pairs = new Map<string, { j: string; lines: Rec[] }[]>();
      for (const [j, lines] of byJ) {
        const drs = [...new Set(lines.filter((x) => (x.a.n(x.r, 'debit') ?? 0) > 0).map((x) => x.a.t(x.r, 'account')))].sort();
        const crs = [...new Set(lines.filter((x) => (x.a.n(x.r, 'credit') ?? 0) > 0).map((x) => x.a.t(x.r, 'account')))].sort();
        const k = `${drs.join('+')} → ${crs.join('+')}`;
        if (!pairs.has(k)) pairs.set(k, []);
        pairs.get(k)!.push({ j, lines });
      }
      const out: TestException[] = [];
      for (const [k, v] of pairs) if (v.length === 1) {
        const tot = v[0].lines.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0), 0);
        out.push(exc(keyOf('GL-18', k), { en: `Journal ${v[0].j}: unique combination ${k}`, ar: `القيد ${v[0].j}: تركيبة فريدة ${k}` }, v[0].lines, ['account', 'debit', 'credit'],
          { formula: 'Frequency(Dr accounts → Cr accounts) = 1', inputs: [{ label: { en: 'Combination', ar: 'التركيبة' }, value: k }, { label: { en: 'Journals in population', ar: 'عدد القيود' }, value: byJ.size }], result: 1 }, { amount: tot, currency: glMoney(v[0].lines[0], ctx.settings).currency }));
      }
      return { status: 'performed', missing: [], population: byJ.size, exceptions: out };
    },
  },
);
