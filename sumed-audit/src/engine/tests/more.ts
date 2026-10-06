// Procurement, Payroll, Budget/CAPEX/OPEX, Tax, Loans, Contracts, Related-party tests
import type { TestException } from '../types';
import { dayDiff, fmtNum, isApproved } from '../values';
import { type TestDef, type Rec, recs, insufficient, exc, amt, groupBy, keyOf, nearLimit, normName, concentration, median, asOf, round2, ref } from './kit';
import { splitTest } from './ap';

const L = (en: string, ar: string) => ({ en, ar });
const ok = (population: number, exceptions: TestException[], params?: Record<string, string | number | null>) => ({ status: 'performed' as const, missing: [], population, exceptions, params });
type Ctx = Parameters<TestDef['run']>[0];

// ───────────────────────────── Procurement
const pr = { area: 'procurement' as const, riskId: 'R-OP-02', controlId: 'C-PR-01' };
const po = (x: Rec) => x.a.t(x.r, 'poNo') || `(row ${x.r.rowNumber})`;

export const PR_TESTS: TestDef[] = [
  {
    ...pr, id: 'PR-01', severity: 'high',
    name: L('Purchase orders without approval', 'أوامر شراء غير معتمدة'), objective: L('Confirm all POs are approved.', 'التحقق من اعتماد جميع أوامر الشراء.'),
    rule: L('Approval status ≠ approved', 'حالة الاعتماد غير معتمد'), criteria: L('Procurement policy / Delegation of Authority.', 'سياسة المشتريات / جدول الصلاحيات.'),
    cause: L('Possible causes: workflow bypass, emergency purchases.', 'أسباب محتملة: تجاوز دورة العمل أو مشتريات طارئة.'), effect: L('Unauthorized commitments.', 'التزامات غير مصرح بها.'),
    recommendation: L('Enforce system approval before PO release.', 'فرض الاعتماد الآلي قبل إصدار أمر الشراء.'),
    needs: [{ type: 'procurement', fields: ['poNo', 'vendor', 'amount', 'approval'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'procurement', ['poNo', 'amount', 'approval']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => isApproved(x.a.t(x.r, 'approval')) !== true).map((x) => exc(keyOf('PR-01', po(x)), L(`PO ${po(x)} approval status "${x.a.t(x.r, 'approval') || 'blank'}"`, `أمر الشراء ${po(x)} حالة اعتماده "${x.a.t(x.r, 'approval') || 'فارغ'}"`), [x], ['approval'], { formula: 'Approval ≠ Approved', inputs: [{ label: L('Approval', 'الاعتماد'), value: x.a.t(x.r, 'approval') }], result: 'Unapproved' }, amt(x, 'amount', ctx.settings)));
      return ok(list.length, out);
    },
  },
  {
    ...pr, id: 'PR-02', severity: 'medium', fraud: true, controlId: 'C-AU-01',
    name: L('POs just below approval limits', 'أوامر شراء أقل مباشرة من حدود الاعتماد'), objective: L('Identify POs structured below thresholds.', 'تحديد أوامر الشراء المصممة أسفل الحدود.'),
    rule: L('Limit × (1 − t%) ≤ Amount < Limit', 'الحد × (1 − ن%) ≤ المبلغ < الحد'), criteria: L('Delegation of Authority.', 'جدول الصلاحيات.'),
    cause: L('Possible causes: approval avoidance.', 'أسباب محتملة: تجنب الاعتماد الأعلى.'), effect: L('Higher-level approval bypassed.', 'تجاوز الاعتماد الأعلى.'),
    recommendation: L('Review clusters; apply cumulative approval.', 'مراجعة التجمعات وتطبيق الاعتماد التراكمي.'),
    needs: [{ type: 'procurement', fields: ['poNo', 'amount'] }],
    run(ctx) {
      const lim = ctx.settings.approvalLimits; if (!lim.length) return insufficient(['Approval limits not configured (Settings)']);
      const { list, missing } = recs(ctx, 'procurement', ['poNo', 'amount']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const x of list) { const m = amt(x, 'amount', ctx.settings); if (!m || m.currency !== ctx.settings.baseCurrency) continue; const l = nearLimit(m.amount, lim, ctx.settings.nearThresholdPct); if (l) out.push(exc(keyOf('PR-02', po(x)), L(`PO ${po(x)} ${fmtNum(m.amount)} just below ${fmtNum(l)}`, `أمر الشراء ${po(x)} ${fmtNum(m.amount)} أقل مباشرة من ${fmtNum(l)}`), [x], ['amount'], { formula: 'Limit × (1 − t%) ≤ Amount < Limit', inputs: [{ label: L('Amount', 'المبلغ'), value: m.amount }, { label: L('Limit', 'الحد'), value: l }], result: 'Near limit' }, m)); }
      return ok(list.length, out, { limits: lim.join(', ') });
    },
  },
  {
    ...pr, id: 'PR-03', severity: 'high', fraud: true, controlId: 'C-AU-01',
    name: L('Split purchase orders', 'تجزئة أوامر الشراء'), objective: L('Detect POs split to avoid approval or tender thresholds.', 'كشف تجزئة أوامر الشراء لتجنب حدود الاعتماد أو المناقصة.'),
    rule: L('Same vendor, ≥ 2 POs within window, each < limit, combined ≥ limit', 'نفس المورد، أمرا شراء أو أكثر خلال المدة، كل منها < الحد ومجموعها ≥ الحد'), criteria: L('Delegation of Authority and tender regulations.', 'جدول الصلاحيات ولوائح المناقصات.'),
    cause: L('Possible causes: approval avoidance, tender avoidance.', 'أسباب محتملة: تجنب الاعتماد أو المناقصة.'), effect: L('Non-competitive purchasing; DoA bypass.', 'شراء غير تنافسي وتجاوز الصلاحيات.'),
    recommendation: L('Investigate clusters; enforce cumulative vendor thresholds.', 'فحص التجمعات وتطبيق حدود تراكمية للمورد.'),
    needs: [{ type: 'procurement', fields: ['poNo', 'vendor', 'amount', 'poDate'] }],
    run(ctx) {
      if (!ctx.settings.approvalLimits.length) return insufficient(['Approval limits not configured (Settings)']);
      const { list, missing } = recs(ctx, 'procurement', ['poNo', 'vendor', 'amount', 'poDate']); if (missing.length) return insufficient(missing);
      return splitTest('PR-03', ctx, list, 'vendor', 'poDate', 'amount', 'poNo');
    },
  },
  {
    ...pr, id: 'PR-04', severity: 'medium', controlId: 'C-PR-02',
    name: L('Direct / sole-source awards', 'إسناد مباشر / مصدر وحيد'), objective: L('Identify non-competitive awards for justification review.', 'تحديد الإسناد غير التنافسي لمراجعة مبرراته.'),
    rule: L('Sourcing method contains direct / sole / single / emergency', 'طريقة الشراء: مباشر / مصدر وحيد / طارئ'), criteria: L('Competitive tendering unless justified and approved.', 'المناقصة التنافسية ما لم يوجد مبرر معتمد.'),
    cause: L('Possible causes: urgency, specialized supply, favouritism.', 'أسباب محتملة: الاستعجال أو التخصص أو المحاباة.'), effect: L('Value-for-money risk.', 'مخاطر عدم تحقيق أفضل قيمة.'),
    recommendation: L('Verify documented justification and approval for each award.', 'التحقق من المبرر والاعتماد الموثق لكل إسناد.'),
    needs: [{ type: 'procurement', fields: ['poNo', 'amount', 'sourcing'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'procurement', ['poNo', 'amount', 'sourcing']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => /direct|sole|single|emergency|مباشر|وحيد|طارئ/i.test(x.a.t(x.r, 'sourcing'))).map((x) => exc(keyOf('PR-04', po(x)), L(`PO ${po(x)} sourced "${x.a.t(x.r, 'sourcing')}"`, `أمر الشراء ${po(x)} بطريقة "${x.a.t(x.r, 'sourcing')}"`), [x], ['sourcing'], { formula: 'Sourcing ∈ {direct, sole, single, emergency}', inputs: [{ label: L('Sourcing', 'الطريقة'), value: x.a.t(x.r, 'sourcing') }], result: 'Non-competitive' }, amt(x, 'amount', ctx.settings)));
      return ok(list.length, out);
    },
  },
  {
    ...pr, id: 'PR-05', severity: 'low', riskId: 'R-OP-03', controlId: 'C-PR-02',
    name: L('Procurement vendor concentration', 'تركز موردي المشتريات'), objective: L('Identify spend concentration with single vendors.', 'تحديد تركز الإنفاق مع موردين منفردين.'),
    rule: L('Vendor share of PO value ≥ threshold %', 'حصة المورد من قيمة أوامر الشراء ≥ الحد'), criteria: L('Diversified supplier base.', 'قاعدة موردين متنوعة.'),
    cause: L('Possible causes: sole-source, framework agreements.', 'أسباب محتملة: مصدر وحيد أو اتفاقيات إطارية.'), effect: L('Dependency and pricing risk.', 'مخاطر الاعتماد والتسعير.'),
    recommendation: L('Review dependency and alternative sourcing.', 'مراجعة الاعتماد ومصادر التوريد البديلة.'),
    needs: [{ type: 'procurement', fields: ['vendor', 'amount'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'procurement', ['vendor', 'amount']); if (missing.length) return insufficient(missing); return concentration(ctx, list, 'vendor', 'amount', L('Vendor', 'المورد')); },
  },
  {
    ...pr, id: 'PR-06', severity: 'medium', fraud: true, controlId: 'C-PR-02',
    name: L('Price anomalies', 'تشوهات الأسعار'), objective: L('Identify unit prices deviating > 25% from the item median.', 'تحديد أسعار الوحدات المنحرفة > 25% عن وسيط الصنف.'),
    rule: L('|Unit price − Item median| ÷ Item median > 25% (items with ≥ 3 purchases)', 'انحراف سعر الوحدة عن وسيط الصنف > 25%'), criteria: L('Consistent, competitive pricing.', 'تسعير متسق وتنافسي.'),
    cause: L('Possible causes: price inflation, kickbacks, specification changes.', 'أسباب محتملة: تضخيم الأسعار أو عمولات أو تغير المواصفات.'), effect: L('Overpayment.', 'سداد بأكثر من المستحق.'),
    recommendation: L('Benchmark prices and recover overcharges where confirmed.', 'مقارنة الأسعار واسترداد الزيادات المؤكدة.'),
    needs: [{ type: 'procurement', fields: ['poNo', 'item', 'unitPrice'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'procurement', ['poNo', 'item', 'unitPrice']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [it, items] of groupBy(list, (x) => x.a.t(x.r, 'item'))) {
        const ps = items.map((x) => x.a.n(x.r, 'unitPrice')).filter((v): v is number => v !== null && v > 0); if (ps.length < 3) continue;
        const med = median(ps);
        for (const x of items) { const p = x.a.n(x.r, 'unitPrice'); if (p && Math.abs(p - med) / med > 0.25) out.push(exc(keyOf('PR-06', po(x), it), L(`PO ${po(x)} item ${it}: price ${fmtNum(p)} vs median ${fmtNum(med)}`, `أمر الشراء ${po(x)} الصنف ${it}: السعر ${fmtNum(p)} مقابل الوسيط ${fmtNum(med)}`), [x], ['item', 'unitPrice'], { formula: '|Price − Median| ÷ Median', inputs: [{ label: L('Price', 'السعر'), value: p }, { label: L('Median', 'الوسيط'), value: med }], result: `${round2((p - med) / med * 100)}%` }, p > med && x.a.n(x.r, 'amount') ? { amount: (p - med) / p * Math.abs(x.a.n(x.r, 'amount')!), currency: amt(x, 'amount', ctx.settings)?.currency ?? '—' } : null)); }
      }
      return ok(list.length, out);
    },
  },
  {
    ...pr, id: 'PR-07', severity: 'high', fraud: true,
    name: L('Duplicate purchase orders', 'أوامر شراء مكررة'), objective: L('Detect duplicate POs.', 'كشف أوامر الشراء المكررة.'),
    rule: L('Same vendor + amount + PO date with different PO numbers, or same PO number repeated', 'نفس المورد والمبلغ والتاريخ بأرقام مختلفة أو تكرار رقم أمر الشراء'), criteria: L('Each requirement is ordered once.', 'يُطلب كل احتياج مرة واحدة.'),
    cause: L('Possible causes: re-keying, duplicated requisitions.', 'أسباب محتملة: إعادة الإدخال أو تكرار الطلبات.'), effect: L('Duplicate commitments and payments.', 'التزامات ومدفوعات مكررة.'),
    recommendation: L('Cancel duplicates; add duplicate checks.', 'إلغاء المكرر وإضافة فحوص التكرار.'),
    needs: [{ type: 'procurement', fields: ['poNo', 'vendor', 'amount', 'poDate'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'procurement', ['poNo', 'vendor', 'amount']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      const byPo = groupBy(list, (x) => x.a.t(x.r, 'poNo'));
      for (const [k, items] of byPo) if (items.length > 1 && !items[0].a.has('item')) out.push(exc(keyOf('PR-07', 'po', k), L(`PO ${k} appears ${items.length} times`, `أمر الشراء ${k} يتكرر ${items.length} مرات`), items, ['poNo'], { formula: 'Count(PO no.) > 1', inputs: [{ label: 'PO', value: k }], result: items.length }));
      if (list[0].a.has('poDate')) for (const [k, items] of groupBy(list, (x) => keyOf(normName(x.a.t(x.r, 'vendor')), x.a.n(x.r, 'amount'), x.a.d(x.r, 'poDate')))) {
        const pos = new Set(items.map(po)); if (pos.size < 2) continue;
        const m = amt(items[0], 'amount', ctx.settings);
        out.push(exc(keyOf('PR-07', 'amt', k), L(`${pos.size} POs to ${items[0].a.t(items[0].r, 'vendor')} with same amount and date`, `${pos.size} أوامر شراء لـ ${items[0].a.t(items[0].r, 'vendor')} بنفس المبلغ والتاريخ`), items, ['vendor', 'amount', 'poDate'], { formula: 'Count(distinct PO | vendor, amount, date) ≥ 2', inputs: [...pos].map((p) => ({ label: 'PO', value: p })), result: pos.size }, m ? { amount: Math.abs(m.amount) * (pos.size - 1), currency: m.currency } : null));
      }
      return ok(list.length, out);
    },
  },
  {
    ...pr, id: 'PR-08', severity: 'medium', controlId: 'C-PR-03', riskId: 'R-CP-03',
    name: L('Contract leakage', 'تسرب العقود'), objective: L('Identify POs to contracted vendors that do not reference the contract.', 'تحديد أوامر الشراء لموردين متعاقدين دون الإشارة للعقد.'),
    rule: L('Vendor has a contract AND PO contract reference is blank', 'للمورد عقد وأمر الشراء بدون مرجع العقد'), criteria: L('Purchases from contracted vendors should use contract terms.', 'يجب أن تتم المشتريات من الموردين المتعاقدين وفق شروط العقد.'),
    cause: L('Possible causes: off-contract buying.', 'أسباب محتملة: الشراء خارج العقد.'), effect: L('Loss of negotiated pricing and terms.', 'فقدان الأسعار والشروط المتفاوض عليها.'),
    recommendation: L('Link POs to contracts in the ERP; review off-contract spend.', 'ربط أوامر الشراء بالعقود في النظام ومراجعة الإنفاق خارج العقود.'),
    needs: [{ type: 'contracts', fields: ['contractId', 'counterparty'] }, { type: 'procurement', fields: ['poNo', 'vendor', 'contract'] }],
    run(ctx) {
      const c = recs(ctx, 'contracts', ['contractId', 'counterparty']); if (c.missing.length) return insufficient(c.missing);
      const p = recs(ctx, 'procurement', ['poNo', 'vendor', 'amount', 'contract']); if (p.missing.length) return insufficient(p.missing);
      const contracted = new Map<string, Rec>(); for (const x of c.list) contracted.set(normName(x.a.t(x.r, 'counterparty')), x);
      const out: TestException[] = [];
      for (const x of p.list) { const k = contracted.get(normName(x.a.t(x.r, 'vendor'))); if (k && !x.a.t(x.r, 'contract')) out.push(exc(keyOf('PR-08', po(x)), L(`PO ${po(x)} to contracted vendor ${x.a.t(x.r, 'vendor')} without contract reference (contract ${k.a.t(k.r, 'contractId')})`, `أمر الشراء ${po(x)} لمورد متعاقد ${x.a.t(x.r, 'vendor')} بدون مرجع العقد (${k.a.t(k.r, 'contractId')})`), [x, k], [['vendor', 'contract'], ['contractId', 'counterparty']], { formula: 'Vendor ∈ Contracts AND PO.contract = blank', inputs: [{ label: L('Contract', 'العقد'), value: k.a.t(k.r, 'contractId'), ref: ref(k) }], result: 'Off-contract' }, amt(x, 'amount', ctx.settings))); }
      return ok(p.list.length, out);
    },
  },
  {
    ...pr, id: 'PR-09', severity: 'high', fraud: true, controlId: 'C-SD-01',
    name: L('Self-approved purchase orders', 'أوامر شراء معتمدة من منشئها'), objective: L('Verify segregation between buyer and approver.', 'التحقق من الفصل بين المشتري والمعتمد.'),
    rule: L('Buyer = Approver', 'المشتري = المعتمد'), criteria: L('Segregation of duties.', 'الفصل بين المهام.'),
    cause: L('Possible causes: conflicting ERP roles.', 'أسباب محتملة: أدوار متعارضة في النظام.'), effect: L('One person can create and approve commitments.', 'يستطيع شخص واحد إنشاء الالتزامات واعتمادها.'),
    recommendation: L('Remove conflicting roles; enforce workflow approvals.', 'إلغاء الأدوار المتعارضة وفرض الاعتماد عبر دورة العمل.'),
    needs: [{ type: 'procurement', fields: ['poNo', 'buyer', 'approver'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'procurement', ['poNo', 'buyer', 'approver']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => { const b = x.a.t(x.r, 'buyer').toLowerCase(), a = x.a.t(x.r, 'approver').toLowerCase(); return b && a && b === a; }).map((x) => exc(keyOf('PR-09', po(x)), L(`PO ${po(x)} created and approved by ${x.a.t(x.r, 'buyer')}`, `أمر الشراء ${po(x)} أنشأه واعتمده ${x.a.t(x.r, 'buyer')}`), [x], ['buyer', 'approver'], { formula: 'Buyer = Approver', inputs: [{ label: L('Buyer', 'المشتري'), value: x.a.t(x.r, 'buyer') }, { label: L('Approver', 'المعتمد'), value: x.a.t(x.r, 'approver') }], result: 'Same' }, amt(x, 'amount', ctx.settings)));
      return ok(list.length, out);
    },
  },
];

// ───────────────────────────── Payroll
const py = { area: 'payroll' as const, riskId: 'R-FD-03', controlId: 'C-PR-10' };
const emp = (x: Rec) => x.a.t(x.r, 'employeeId');
const pyMoney = (x: Rec, f: string, s: Ctx['settings']) => { const v = x.a.n(x.r, f); return v === null ? null : { amount: Math.abs(v), currency: s.assumeBaseCurrencyWhenMissing ? s.baseCurrency : '—' }; };
const period = (x: Rec) => (x.a.d(x.r, 'payDate') ?? x.a.t(x.r, 'payDate')).slice(0, 7);
function outlierTest(id: string, field: string, name: [string, string], ctx: Ctx): ReturnType<TestDef['run']> {
  const { list, missing } = recs(ctx, 'payroll', ['employeeId', 'net', field]); if (missing.length) return insufficient(missing);
  const vals = list.map((x) => x.a.n(x.r, field)).filter((v): v is number => v !== null && v > 0);
  if (vals.length < 5) return ok(list.length, [], { note: 'Fewer than 5 non-zero values' });
  const med = median(vals);
  const out = list.filter((x) => (x.a.n(x.r, field) ?? 0) > 3 * med).map((x) => exc(keyOf(id, emp(x), period(x)), L(`Employee ${emp(x)} ${name[0].toLowerCase()} ${fmtNum(x.a.n(x.r, field))} vs median ${fmtNum(med)}`, `الموظف ${emp(x)} ${name[1]} ${fmtNum(x.a.n(x.r, field))} مقابل الوسيط ${fmtNum(med)}`), [x], [field], { formula: `${name[0]} > 3 × Median`, inputs: [{ label: L(name[0], name[1]), value: x.a.n(x.r, field) }, { label: L('Median', 'الوسيط'), value: med }], result: round2(x.a.n(x.r, field)! / med) }, pyMoney(x, field, ctx.settings)));
  return ok(list.length, out, { median: med });
}
const pyDef = (id: string, severity: TestDef['severity'], name: [string, string], rule: [string, string], fields: string[], extra: Partial<TestDef>) => ({
  ...py, id, severity, name: L(...name), rule: L(...rule), objective: extra.objective ?? L(name[0], name[1]),
  criteria: extra.criteria ?? L('Payroll must reflect valid employees, approved rates and authorized changes.', 'يجب أن تعكس الرواتب موظفين فعليين ومعدلات معتمدة وتغييرات مصرح بها.'),
  cause: extra.cause ?? L('Possible causes: HR/payroll master-data errors or manipulation.', 'أسباب محتملة: أخطاء أو تلاعب في بيانات الموارد البشرية والرواتب.'),
  effect: extra.effect ?? L('Overpayment of payroll.', 'سداد رواتب بأكثر من المستحق.'),
  recommendation: extra.recommendation ?? L('Investigate and recover overpayments; strengthen HR–payroll reconciliation.', 'الفحص واسترداد المبالغ الزائدة وتعزيز المطابقة بين الموارد البشرية والرواتب.'),
  needs: [{ type: 'payroll' as const, fields: ['employeeId', 'net', ...fields] }], fraud: extra.fraud,
});

export const PY_TESTS: TestDef[] = [
  { ...pyDef('PY-01', 'high', ['Duplicate employees in a pay period', 'موظفون مكررون في نفس فترة الرواتب'], ['Count(Employee ID, pay period) > 1', 'تكرار رقم الموظف في نفس الفترة > 1'], ['payDate'], { fraud: true }),
    run(ctx) {
      const { list, missing } = recs(ctx, 'payroll', ['employeeId', 'net']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [k, items] of groupBy(list, (x) => keyOf(emp(x), period(x)))) if (items.length > 1) out.push(exc(keyOf('PY-01', k), L(`Employee ${emp(items[0])} paid ${items.length} times in period ${period(items[0]) || '(no date)'}`, `الموظف ${emp(items[0])} صُرف له ${items.length} مرات في الفترة ${period(items[0])}`), items, ['employeeId', 'payDate'], { formula: 'Count(Employee ID, period) > 1', inputs: items.map((i) => ({ label: L('Net', 'الصافي'), value: i.a.n(i.r, 'net'), ref: ref(i) })), result: items.length }, { amount: items.slice(1).reduce((s, i) => s + Math.abs(i.a.n(i.r, 'net') ?? 0), 0), currency: ctx.settings.assumeBaseCurrencyWhenMissing ? ctx.settings.baseCurrency : '—' }));
      return ok(list.length, out);
    } },
  { ...pyDef('PY-02', 'high', ['Shared bank accounts among employees', 'حسابات بنكية مشتركة بين الموظفين'], ['Count(distinct employees per bank account) > 1', 'عدد الموظفين لنفس الحساب > 1'], ['bankAccount'], { fraud: true, effect: L('Ghost-employee indicator; salary diversion.', 'مؤشر موظف وهمي وتحويل رواتب.') }),
    run(ctx) {
      const { list, missing } = recs(ctx, 'payroll', ['employeeId', 'bankAccount']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [b, items] of groupBy(list, (x) => x.a.t(x.r, 'bankAccount').replace(/\s/g, '').toUpperCase())) { const es = [...new Set(items.map(emp))]; if (es.length > 1) out.push(exc(keyOf('PY-02', b), L(`${es.length} employees (${es.slice(0, 5).join(', ')}) share bank account ••••${b.slice(-4)}`, `${es.length} موظفين (${es.slice(0, 5).join('، ')}) يشتركون في الحساب ••••${b.slice(-4)}`), items, ['employeeId', 'bankAccount'], { formula: 'Count(distinct Employee ID | bank account) > 1', inputs: es.slice(0, 10).map((e) => ({ label: L('Employee', 'الموظف'), value: e })), result: es.length })); }
      return ok(list.length, out);
    } },
  { ...pyDef('PY-03', 'critical', ['Terminated employees paid', 'صرف رواتب لموظفين منتهية خدمتهم'], ['Status = terminated/resigned OR Pay date > Termination date', 'الحالة منتهي/مستقيل أو تاريخ الصرف > تاريخ إنهاء الخدمة'], [], { fraud: true, effect: L('Salary paid to non-employees.', 'صرف رواتب لغير الموظفين.'), recommendation: L('Stop payments, recover amounts, and link HR exits to payroll automatically.', 'إيقاف الصرف واسترداد المبالغ وربط إنهاء الخدمة بالرواتب آليًا.') }),
    run(ctx) {
      const { list, missing } = recs(ctx, 'payroll', ['employeeId', 'net']); if (missing.length) return insufficient(missing);
      if (!list[0].a.has('status') && !list[0].a.has('terminationDate')) return insufficient(['Payroll: Employment status or Termination date must be mapped']);
      const out: TestException[] = [];
      for (const x of list) {
        const st = x.a.t(x.r, 'status'), td = x.a.d(x.r, 'terminationDate'), pd = x.a.d(x.r, 'payDate');
        const byStatus = /terminat|resign|left|exit|inactive|منتهي|مستقيل|مفصول/i.test(st);
        const byDate = td && pd && pd > td;
        if ((byStatus && (x.a.n(x.r, 'net') ?? 0) > 0) || byDate) out.push(exc(keyOf('PY-03', emp(x), period(x)), L(`Employee ${emp(x)} (${st || 'terminated ' + td}) paid ${fmtNum(x.a.n(x.r, 'net'))}${pd ? ' on ' + pd : ''}`, `الموظف ${emp(x)} (${st || 'انتهت خدمته ' + td}) صُرف له ${fmtNum(x.a.n(x.r, 'net'))}`), [x], ['status', 'terminationDate', 'payDate', 'net'], { formula: 'Status = terminated OR Pay date > Termination date', inputs: [{ label: L('Status', 'الحالة'), value: st }, { label: L('Termination', 'إنهاء الخدمة'), value: td }, { label: L('Pay date', 'تاريخ الصرف'), value: pd }], result: 'Paid after exit' }, pyMoney(x, 'net', ctx.settings)));
      }
      return ok(list.length, out);
    } },
  { ...pyDef('PY-04', 'medium', ['Unusual overtime', 'عمل إضافي غير معتاد'], ['Overtime > 3 × median overtime', 'الإضافي > 3 أضعاف الوسيط'], ['overtime'], {}), run: (ctx: Ctx) => outlierTest('PY-04', 'overtime', ['Overtime', 'الإضافي'], ctx) },
  { ...pyDef('PY-05', 'medium', ['Unusual bonuses', 'مكافآت غير معتادة'], ['Bonus > 3 × median bonus', 'المكافأة > 3 أضعاف الوسيط'], ['bonus'], {}), run: (ctx: Ctx) => outlierTest('PY-05', 'bonus', ['Bonus', 'المكافأة'], ctx) },
  { ...pyDef('PY-06', 'medium', ['Unusual salary increases', 'زيادات رواتب غير معتادة'], ['(Gross − Prior gross) ÷ Prior gross > 25%', 'نسبة الزيادة > 25%'], ['gross', 'priorGross'], {}),
    run(ctx) {
      const { list, missing } = recs(ctx, 'payroll', ['employeeId', 'gross', 'priorGross']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => { const g = x.a.n(x.r, 'gross'), p = x.a.n(x.r, 'priorGross'); return g !== null && p && p > 0 && (g - p) / p > 0.25; }).map((x) => { const g = x.a.n(x.r, 'gross')!, p = x.a.n(x.r, 'priorGross')!; return exc(keyOf('PY-06', emp(x), period(x)), L(`Employee ${emp(x)} gross up ${round2((g - p) / p * 100)}%`, `الموظف ${emp(x)} زاد راتبه ${round2((g - p) / p * 100)}%`), [x], ['gross', 'priorGross'], { formula: '(Gross − Prior) ÷ Prior', inputs: [{ label: L('Gross', 'الإجمالي'), value: g }, { label: L('Prior', 'السابق'), value: p }], result: `${round2((g - p) / p * 100)}%` }, { amount: g - p, currency: ctx.settings.assumeBaseCurrencyWhenMissing ? ctx.settings.baseCurrency : '—' }); });
      return ok(list.length, out);
    } },
  { ...pyDef('PY-07', 'high', ['Payroll arithmetic errors', 'أخطاء حسابية في الرواتب'], ['|Gross − Deductions − Net| > 1', 'الإجمالي − الاستقطاعات ≠ الصافي'], ['gross', 'deductions'], {}),
    run(ctx) {
      const { list, missing } = recs(ctx, 'payroll', ['employeeId', 'gross', 'deductions', 'net']); if (missing.length) return insufficient(missing);
      const out = list.filter((x) => Math.abs((x.a.n(x.r, 'gross') ?? 0) - Math.abs(x.a.n(x.r, 'deductions') ?? 0) - (x.a.n(x.r, 'net') ?? 0)) > 1).map((x) => { const d = (x.a.n(x.r, 'gross') ?? 0) - Math.abs(x.a.n(x.r, 'deductions') ?? 0) - (x.a.n(x.r, 'net') ?? 0); return exc(keyOf('PY-07', emp(x), period(x)), L(`Employee ${emp(x)}: gross − deductions − net = ${fmtNum(d)}`, `الموظف ${emp(x)}: الإجمالي − الاستقطاعات − الصافي = ${fmtNum(d)}`), [x], ['gross', 'deductions', 'net'], { formula: 'Difference = Gross − Deductions − Net', inputs: [{ label: L('Gross', 'الإجمالي'), value: x.a.n(x.r, 'gross') }, { label: L('Deductions', 'الاستقطاعات'), value: x.a.n(x.r, 'deductions') }, { label: L('Net', 'الصافي'), value: x.a.n(x.r, 'net') }], result: round2(d) }, { amount: Math.abs(d), currency: ctx.settings.assumeBaseCurrencyWhenMissing ? ctx.settings.baseCurrency : '—' }); });
      return ok(list.length, out);
    } },
  { ...pyDef('PY-08', 'high', ['Duplicate national IDs', 'أرقام قومية مكررة'], ['Count(distinct Employee ID per National ID) > 1', 'عدد أرقام الموظفين لنفس الرقم القومي > 1'], ['nationalId'], { fraud: true }),
    run(ctx) {
      const { list, missing } = recs(ctx, 'payroll', ['employeeId', 'nationalId']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [n, items] of groupBy(list, (x) => x.a.t(x.r, 'nationalId'))) { const es = [...new Set(items.map(emp))]; if (es.length > 1) out.push(exc(keyOf('PY-08', n), L(`National ID ••••${n.slice(-4)} used by employees ${es.join(', ')}`, `الرقم القومي ••••${n.slice(-4)} مستخدم للموظفين ${es.join('، ')}`), items, ['employeeId', 'nationalId'], { formula: 'Count(distinct Employee ID | National ID) > 1', inputs: es.map((e) => ({ label: L('Employee', 'الموظف'), value: e })), result: es.length })); }
      return ok(list.length, out);
    } },
];

// ───────────────────────────── Budget, CAPEX, OPEX
const bu = { area: 'budget' as const, riskId: 'R-FN-05', controlId: 'C-BU-01' };
const budgetOf = (x: Rec) => x.a.n(x.r, 'revised') ?? x.a.n(x.r, 'original');
const isCapex = (x: Rec) => /capex|capital|رأسمالي|راسمالي/i.test(x.a.t(x.r, 'capex'));
const lineName = (x: Rec) => [x.a.t(x.r, 'department'), x.a.t(x.r, 'costCenter'), x.a.t(x.r, 'account'), x.a.t(x.r, 'category'), x.a.t(x.r, 'project')].filter(Boolean).join(' / ') || `row ${x.r.rowNumber}`;
const bMoney = (v: number, x: Rec, s: Ctx['settings']) => ({ amount: Math.abs(v), currency: x.a.t(x.r, 'currency').toUpperCase() || (s.assumeBaseCurrencyWhenMissing ? s.baseCurrency : '—') });
function overrun(id: string, ctx: Ctx, filter: (x: Rec) => boolean) {
  const { list, missing } = recs(ctx, 'budget', ['actual']); if (missing.length) return insufficient(missing);
  if (!list[0].a.has('original') && !list[0].a.has('revised')) return insufficient(['Budget: Original or Revised budget must be mapped']);
  const scope = list.filter(filter);
  const out: TestException[] = [];
  for (const x of scope) {
    const b = budgetOf(x), a = x.a.n(x.r, 'actual'); if (b === null || a === null || b <= 0) continue;
    const pct = (a - b) / b * 100;
    if (pct > ctx.settings.budgetVariancePct) out.push(exc(keyOf(id, lineName(x), x.a.t(x.r, 'period'), x.a.t(x.r, 'year')), L(`${lineName(x)}: actual ${fmtNum(a)} vs budget ${fmtNum(b)} (+${round2(pct)}%)`, `${lineName(x)}: الفعلي ${fmtNum(a)} مقابل الموازنة ${fmtNum(b)} (+${round2(pct)}%)`), [x], ['actual', x.a.has('revised') ? 'revised' : 'original'], { formula: 'Variance % = (Actual − Budget) ÷ Budget × 100', inputs: [{ label: L('Actual', 'الفعلي'), value: a }, { label: L('Budget', 'الموازنة'), value: b }, { label: L('Threshold %', 'الحد %'), value: ctx.settings.budgetVariancePct }], result: `${round2(pct)}%` }, bMoney(a - b, x, ctx.settings)));
  }
  return ok(scope.length, out, { budgetVariancePct: ctx.settings.budgetVariancePct });
}

export const BU_TESTS: TestDef[] = [
  {
    ...bu, id: 'BU-01', severity: 'medium', area: 'opex',
    name: L('OPEX budget overruns', 'تجاوزات موازنة النفقات التشغيلية'), objective: L('Identify operating budget lines overspent beyond tolerance.', 'تحديد بنود الموازنة التشغيلية المتجاوزة للحد المسموح.'),
    rule: L('(Actual − Budget) ÷ Budget > Variance tolerance %', 'نسبة الانحراف > الحد المسموح'), criteria: L('Approved annual budget; overspend requires approval.', 'الموازنة السنوية المعتمدة؛ التجاوز يتطلب اعتمادًا.'),
    cause: L('Possible causes: weak budget monitoring, unplanned spend.', 'أسباب محتملة: ضعف متابعة الموازنة أو إنفاق غير مخطط.'), effect: L('Cost overruns and reduced profitability.', 'تجاوز التكاليف وانخفاض الربحية.'),
    recommendation: L('Require documented approval for overruns; implement budget commitment checks.', 'اشتراط اعتماد موثق للتجاوزات وتطبيق رقابة الالتزام بالموازنة.'),
    needs: [{ type: 'budget', fields: ['actual', 'original'] }],
    run: (ctx) => overrun('BU-01', ctx, (x) => !isCapex(x)),
  },
  {
    ...bu, id: 'CX-01', severity: 'high', area: 'capex', riskId: 'R-FN-06', controlId: 'C-CX-01',
    name: L('CAPEX budget overruns', 'تجاوزات موازنة النفقات الرأسمالية'), objective: L('Identify capital projects exceeding approved budget.', 'تحديد المشروعات الرأسمالية المتجاوزة للموازنة المعتمدة.'),
    rule: L('(Actual − Budget) ÷ Budget > Variance tolerance % for CAPEX lines', 'نسبة الانحراف > الحد لبنود النفقات الرأسمالية'), criteria: L('Board-approved CAPEX budget.', 'موازنة النفقات الرأسمالية المعتمدة من مجلس الإدارة.'),
    cause: L('Possible causes: scope changes, poor estimation, weak project control.', 'أسباب محتملة: تغير النطاق أو ضعف التقدير أو ضعف الرقابة على المشروعات.'), effect: L('Capital overruns; funding pressure.', 'تجاوز رأسمالي وضغط تمويلي.'),
    recommendation: L('Require supplementary approval for overruns; strengthen project cost control.', 'اشتراط اعتماد تكميلي للتجاوزات وتعزيز الرقابة على تكاليف المشروعات.'),
    needs: [{ type: 'budget', fields: ['actual', 'original', 'capex'] }],
    run: (ctx) => { const r = recs(ctx, 'budget', ['actual', 'capex']); if (r.missing.length) return insufficient(r.missing); return overrun('CX-01', ctx, isCapex); },
  },
  {
    ...bu, id: 'CX-02', severity: 'high', area: 'capex', riskId: 'R-FN-06', controlId: 'C-CX-01',
    name: L('Spending without budget', 'إنفاق بدون موازنة'), objective: L('Identify actual spend on lines with no approved budget.', 'تحديد الإنفاق الفعلي على بنود بلا موازنة معتمدة.'),
    rule: L('Actual > 0 AND Budget = 0 or blank', 'الفعلي > 0 والموازنة = 0 أو فارغة'), criteria: L('No spend without approved budget.', 'لا إنفاق بدون موازنة معتمدة.'),
    cause: L('Possible causes: unbudgeted projects, misclassification.', 'أسباب محتملة: مشروعات غير مدرجة أو سوء تبويب.'), effect: L('Unauthorized expenditure.', 'إنفاق غير مصرح به.'),
    recommendation: L('Obtain retrospective approval and correct classification.', 'الحصول على اعتماد لاحق وتصحيح التبويب.'),
    needs: [{ type: 'budget', fields: ['actual', 'original'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'budget', ['actual']); if (missing.length) return insufficient(missing);
      if (!list[0].a.has('original') && !list[0].a.has('revised')) return insufficient(['Budget: Original or Revised budget must be mapped']);
      const out = list.filter((x) => (x.a.n(x.r, 'actual') ?? 0) > 0 && !(budgetOf(x) ?? 0)).map((x) => exc(keyOf('CX-02', lineName(x), x.a.t(x.r, 'period')), L(`${lineName(x)}: actual ${fmtNum(x.a.n(x.r, 'actual'))} with no budget`, `${lineName(x)}: فعلي ${fmtNum(x.a.n(x.r, 'actual'))} بدون موازنة`), [x], ['actual', 'original', 'revised'], { formula: 'Actual > 0 AND Budget = 0', inputs: [{ label: L('Actual', 'الفعلي'), value: x.a.n(x.r, 'actual') }, { label: L('Budget', 'الموازنة'), value: budgetOf(x) }], result: 'Unbudgeted' }, bMoney(x.a.n(x.r, 'actual')!, x, ctx.settings)));
      return ok(list.length, out);
    },
  },
  {
    ...bu, id: 'OX-01', severity: 'medium', area: 'opex', riskId: 'R-FN-05',
    name: L('Cost spikes by cost center', 'قفزات التكاليف حسب مركز التكلفة'), objective: L('Identify periods where spend exceeds the multiple of the average of other periods.', 'تحديد الفترات التي يتجاوز فيها الإنفاق مضاعف متوسط الفترات الأخرى.'),
    rule: L('Actual(period) > Spike multiple × Average(other periods) for the same line', 'الفعلي للفترة > المضاعف × متوسط الفترات الأخرى'), criteria: L('Stable cost behaviour unless explained.', 'سلوك تكلفة مستقر ما لم يوجد تفسير.'),
    cause: L('Possible causes: one-off expenses, misallocation, duplicate charges.', 'أسباب محتملة: مصروفات لمرة واحدة أو سوء توزيع أو تكرار.'), effect: L('Unexplained cost increases.', 'زيادات تكاليف غير مفسرة.'),
    recommendation: L('Obtain explanations from cost-center owners.', 'الحصول على تفسيرات من مسؤولي مراكز التكلفة.'),
    needs: [{ type: 'budget', fields: ['actual', 'period', 'costCenter'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'budget', ['actual', 'period']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      const m = ctx.settings.spikeMultiple;
      for (const [k, items] of groupBy(list, (x) => keyOf(x.a.t(x.r, 'costCenter'), x.a.t(x.r, 'department'), x.a.t(x.r, 'account'), x.a.t(x.r, 'category')))) {
        if (items.length < 4) continue;
        for (const x of items) {
          const a = x.a.n(x.r, 'actual'); if (!a || a <= 0) continue;
          const others = items.filter((y) => y !== x).map((y) => y.a.n(y.r, 'actual') ?? 0);
          const avg = others.reduce((s, v) => s + v, 0) / others.length;
          if (avg > 0 && a > m * avg) out.push(exc(keyOf('OX-01', k, x.a.t(x.r, 'period')), L(`${lineName(x)} period ${x.a.t(x.r, 'period')}: ${fmtNum(a)} vs avg ${fmtNum(avg)}`, `${lineName(x)} الفترة ${x.a.t(x.r, 'period')}: ${fmtNum(a)} مقابل متوسط ${fmtNum(avg)}`), [x], ['actual', 'period'], { formula: 'Actual(period) ÷ Average(other periods)', inputs: [{ label: L('Actual', 'الفعلي'), value: a }, { label: L('Average others', 'متوسط الفترات الأخرى'), value: round2(avg) }, { label: L('Multiple', 'المضاعف'), value: m }], result: round2(a / avg) }, bMoney(a - avg, x, ctx.settings)));
        }
      }
      return ok(list.length, out, { spikeMultiple: m });
    },
  },
];

// ───────────────────────────── Tax
const tx = { area: 'tax' as const, riskId: 'R-CP-01', controlId: 'C-TX-01' };
const tMoney = (x: Rec, s: Ctx['settings']) => { const v = x.a.n(x.r, 'taxAmount'); return v === null ? null : { amount: Math.abs(v), currency: s.assumeBaseCurrencyWhenMissing ? s.baseCurrency : '—' }; };
const tname = (x: Rec) => `${x.a.t(x.r, 'taxType')} ${x.a.t(x.r, 'period')}`.trim();
const taxBase = { criteria: L('Filing and payment deadlines per the applicable tax law (to be provided and verified) or the configured due date.', 'مواعيد الإقرار والسداد وفق القانون الضريبي المطبق (يتم تقديمه والتحقق منه) أو تاريخ الاستحقاق المسجل.'), cause: L('Possible causes: weak tax calendar monitoring.', 'أسباب محتملة: ضعف متابعة التقويم الضريبي.'), effect: L('Potential penalties and interest (no legal conclusion is made).', 'احتمال غرامات وفوائد (دون استنتاج قانوني).'), recommendation: L('Maintain a tax compliance calendar with owner sign-off.', 'إعداد تقويم الالتزام الضريبي مع توقيع المسؤول.') };

export const TX_TESTS: TestDef[] = [
  { ...tx, ...taxBase, id: 'TX-01', severity: 'high', name: L('Late tax filings', 'تأخر الإقرارات الضريبية'), objective: L('Identify returns filed after the due date.', 'تحديد الإقرارات المقدمة بعد الموعد.'), rule: L('Filing date > Filing due date', 'تاريخ الإقرار > الموعد'), needs: [{ type: 'tax', fields: ['taxType', 'taxAmount', 'filingDate', 'filingDue'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'tax', ['taxType', 'taxAmount', 'filingDate', 'filingDue']); if (missing.length) return insufficient(missing); const out = list.filter((x) => { const f = x.a.d(x.r, 'filingDate'), d = x.a.d(x.r, 'filingDue'); return f && d && f > d; }).map((x) => exc(keyOf('TX-01', tname(x)), L(`${tname(x)} filed ${dayDiff(x.a.d(x.r, 'filingDue')!, x.a.d(x.r, 'filingDate')!)} days late`, `${tname(x)} قُدم متأخرًا ${dayDiff(x.a.d(x.r, 'filingDue')!, x.a.d(x.r, 'filingDate')!)} يومًا`), [x], ['filingDate', 'filingDue'], { formula: 'Filing date − Due date', inputs: [{ label: L('Filed', 'تاريخ الإقرار'), value: x.a.d(x.r, 'filingDate') }, { label: L('Due', 'الموعد'), value: x.a.d(x.r, 'filingDue') }], result: dayDiff(x.a.d(x.r, 'filingDue')!, x.a.d(x.r, 'filingDate')!) }, tMoney(x, ctx.settings))); return ok(list.length, out); } },
  { ...tx, ...taxBase, id: 'TX-02', severity: 'high', name: L('Late tax payments', 'تأخر سداد الضرائب'), objective: L('Identify tax paid after the due date.', 'تحديد الضرائب المسددة بعد الموعد.'), rule: L('Payment date > Due date', 'تاريخ السداد > الموعد'), needs: [{ type: 'tax', fields: ['taxType', 'taxAmount', 'paymentDate', 'filingDue'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'tax', ['taxType', 'taxAmount', 'paymentDate', 'filingDue']); if (missing.length) return insufficient(missing); const out = list.filter((x) => { const p = x.a.d(x.r, 'paymentDate'), d = x.a.d(x.r, 'filingDue'); return p && d && p > d; }).map((x) => exc(keyOf('TX-02', tname(x)), L(`${tname(x)} paid ${dayDiff(x.a.d(x.r, 'filingDue')!, x.a.d(x.r, 'paymentDate')!)} days late`, `${tname(x)} سُدد متأخرًا ${dayDiff(x.a.d(x.r, 'filingDue')!, x.a.d(x.r, 'paymentDate')!)} يومًا`), [x], ['paymentDate', 'filingDue'], { formula: 'Payment date − Due date', inputs: [{ label: L('Paid', 'السداد'), value: x.a.d(x.r, 'paymentDate') }, { label: L('Due', 'الموعد'), value: x.a.d(x.r, 'filingDue') }], result: dayDiff(x.a.d(x.r, 'filingDue')!, x.a.d(x.r, 'paymentDate')!) }, tMoney(x, ctx.settings))); return ok(list.length, out); } },
  { ...tx, ...taxBase, id: 'TX-03', severity: 'medium', name: L('Missing tax filings / payments', 'إقرارات أو مدفوعات ضريبية مفقودة'), objective: L('Identify obligations past due with no filing or payment date.', 'تحديد الالتزامات المستحقة بلا تاريخ إقرار أو سداد.'), rule: L('Due date < As-of AND (Filing date blank OR Payment date blank)', 'الموعد < تاريخ التقييم وتاريخ الإقرار أو السداد فارغ'), needs: [{ type: 'tax', fields: ['taxType', 'taxAmount', 'filingDue'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'tax', ['taxType', 'taxAmount', 'filingDue']); if (missing.length) return insufficient(missing); const ao = asOf(list, 'filingDue', ctx.settings); const out = list.filter((x) => { const d = x.a.d(x.r, 'filingDue'); return d && ao && d < ao && ((x.a.has('filingDate') && !x.a.d(x.r, 'filingDate')) || (x.a.has('paymentDate') && !x.a.d(x.r, 'paymentDate'))); }).map((x) => exc(keyOf('TX-03', tname(x)), L(`${tname(x)} due ${x.a.d(x.r, 'filingDue')} has no filing/payment date`, `${tname(x)} المستحق ${x.a.d(x.r, 'filingDue')} بلا تاريخ إقرار/سداد`), [x], ['filingDue', 'filingDate', 'paymentDate'], { formula: 'Due < As-of AND (Filed blank OR Paid blank)', inputs: [{ label: L('Due', 'الموعد'), value: x.a.d(x.r, 'filingDue') }, { label: L('As-of', 'التقييم'), value: ao }], result: 'Missing' }, tMoney(x, ctx.settings))); return ok(list.length, out, { asOf: ao }); } },
  { ...tx, id: 'TX-04', severity: 'medium', name: L('Tax recomputation differences', 'فروق إعادة احتساب الضريبة'), objective: L('Recompute tax = taxable × rate using the rate recorded in the source.', 'إعادة احتساب الضريبة = الوعاء × السعر المسجل بالمصدر.'), rule: L('|Taxable × Rate − Tax amount| > 1', 'الفرق > 1'),
    criteria: L('Rate as recorded in the uploaded tax data (no statutory rate is assumed).', 'السعر المسجل في البيانات الضريبية (لا يُفترض سعر قانوني).'), cause: L('Possible causes: wrong rate, base errors.', 'أسباب محتملة: سعر خاطئ أو خطأ في الوعاء.'), effect: L('Tax misstatement.', 'تحريف الضريبة.'), recommendation: L('Correct calculations and review tax configuration in ERP.', 'تصحيح الاحتساب ومراجعة إعدادات الضريبة في النظام.'),
    needs: [{ type: 'tax', fields: ['taxType', 'taxable', 'rate', 'taxAmount'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'tax', ['taxType', 'taxable', 'rate', 'taxAmount']); if (missing.length) return insufficient(missing); const out: TestException[] = []; for (const x of list) { const b = x.a.n(x.r, 'taxable'), r0 = x.a.n(x.r, 'rate'), t = x.a.n(x.r, 'taxAmount'); if (b === null || r0 === null || t === null) continue; const r = r0 > 1 ? r0 / 100 : r0; const e = b * r; if (Math.abs(e - t) > 1) out.push(exc(keyOf('TX-04', tname(x)), L(`${tname(x)}: expected ${fmtNum(e)} vs recorded ${fmtNum(t)}`, `${tname(x)}: المتوقع ${fmtNum(e)} مقابل المسجل ${fmtNum(t)}`), [x], ['taxable', 'rate', 'taxAmount'], { formula: 'Expected = Taxable × Rate; Diff = Expected − Recorded', inputs: [{ label: L('Taxable', 'الوعاء'), value: b }, { label: L('Rate', 'السعر'), value: r0 }, { label: L('Recorded', 'المسجل'), value: t }], result: round2(e - t) }, { amount: Math.abs(e - t), currency: ctx.settings.assumeBaseCurrencyWhenMissing ? ctx.settings.baseCurrency : '—' })); } return ok(list.length, out); } },
];

// ───────────────────────────── Loans
const ln = { area: 'loans' as const, riskId: 'R-FN-01', controlId: 'C-TR-03' };
export const LN_TESTS: TestDef[] = [
  { ...ln, id: 'LN-01', severity: 'medium', name: L('Debt maturing within 12 months', 'ديون تستحق خلال 12 شهرًا'), objective: L('Identify refinancing / liquidity exposure.', 'تحديد التعرض لمخاطر إعادة التمويل والسيولة.'), rule: L('0 ≤ Maturity − As-of ≤ 365 days', 'الاستحقاق خلال 365 يومًا'),
    criteria: L('Liquidity planning and current/non-current classification.', 'تخطيط السيولة والتبويب المتداول/غير المتداول.'), cause: L('Contractual maturity profile.', 'هيكل الاستحقاقات التعاقدي.'), effect: L('Refinancing and liquidity risk; classification as current liability.', 'مخاطر إعادة التمويل والسيولة والتبويب كالتزام متداول.'), recommendation: L('Confirm refinancing plan and current-liability classification.', 'التأكد من خطة إعادة التمويل والتبويب كالتزام متداول.'),
    needs: [{ type: 'loans', fields: ['lender', 'outstanding', 'maturity'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'loans', ['lender', 'outstanding', 'maturity']); if (missing.length) return insufficient(missing); const ao = ctx.settings.asOfDate || new Date().toISOString().slice(0, 10); const out = list.filter((x) => { const m = x.a.d(x.r, 'maturity'); return m && dayDiff(ao, m) >= 0 && dayDiff(ao, m) <= 365; }).map((x) => exc(keyOf('LN-01', x.a.t(x.r, 'lender'), x.a.d(x.r, 'maturity')), L(`${x.a.t(x.r, 'lender')} matures ${x.a.d(x.r, 'maturity')} (${fmtNum(x.a.n(x.r, 'outstanding'))} outstanding)`, `${x.a.t(x.r, 'lender')} يستحق ${x.a.d(x.r, 'maturity')} (رصيد ${fmtNum(x.a.n(x.r, 'outstanding'))})`), [x], ['maturity', 'outstanding'], { formula: 'Maturity − As-of ≤ 365', inputs: [{ label: L('Maturity', 'الاستحقاق'), value: x.a.d(x.r, 'maturity') }, { label: L('As-of', 'التقييم'), value: ao }], result: dayDiff(ao, x.a.d(x.r, 'maturity')!) }, amt(x, 'outstanding', ctx.settings))); return ok(list.length, out, { asOf: ao }); } },
  { ...ln, id: 'LN-02', severity: 'medium', name: L('Interest expense reasonableness', 'معقولية مصروف الفوائد'), objective: L('Compare recorded interest with Outstanding × Rate (annual).', 'مقارنة الفوائد المسجلة مع الرصيد × السعر (سنويًا).'), rule: L('|Recorded − Outstanding × Rate| ÷ Expected > 10%', 'الانحراف > 10%'),
    criteria: L('Loan agreements (rates as recorded in loan schedule).', 'اتفاقيات القروض (الأسعار كما في جدول القروض).'), cause: L('Possible causes: rate changes, accrual errors, partial-year balances.', 'أسباب محتملة: تغير الأسعار أو أخطاء الاستحقاق أو أرصدة جزئية.'), effect: L('Finance cost misstatement.', 'تحريف تكلفة التمويل.'), recommendation: L('Reconcile interest to bank statements and loan agreements.', 'مطابقة الفوائد مع كشوف البنك والاتفاقيات.'),
    needs: [{ type: 'loans', fields: ['lender', 'outstanding', 'rate', 'interest'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'loans', ['lender', 'outstanding', 'rate', 'interest']); if (missing.length) return insufficient(missing); const out: TestException[] = []; for (const x of list) { const o = x.a.n(x.r, 'outstanding'), r0 = x.a.n(x.r, 'rate'), i = x.a.n(x.r, 'interest'); if (!o || r0 === null || i === null) continue; const e = o * (r0 > 1 ? r0 / 100 : r0); if (e > 0 && Math.abs(e - i) / e > 0.1) out.push(exc(keyOf('LN-02', x.a.t(x.r, 'lender')), L(`${x.a.t(x.r, 'lender')}: interest ${fmtNum(i)} vs expected ${fmtNum(e)}`, `${x.a.t(x.r, 'lender')}: الفائدة ${fmtNum(i)} مقابل المتوقع ${fmtNum(e)}`), [x], ['outstanding', 'rate', 'interest'], { formula: 'Expected = Outstanding × Rate; Diff % = |Recorded − Expected| ÷ Expected', inputs: [{ label: L('Outstanding', 'الرصيد'), value: o }, { label: L('Rate', 'السعر'), value: r0 }, { label: L('Recorded', 'المسجل'), value: i }], result: `${round2(Math.abs(e - i) / e * 100)}%` }, { amount: Math.abs(e - i), currency: x.a.t(x.r, 'currency').toUpperCase() || '—' })); } return ok(list.length, out, { note: 'Annual rate × closing balance — approximation; flagged items require recalculation on actual drawdown schedule' }); } },
  { ...ln, id: 'LN-03', severity: 'high', name: L('Covenant breaches / waivers', 'خرق التعهدات / الإعفاءات'), objective: L('Identify loans with reported covenant breaches or waivers.', 'تحديد القروض المسجل بها خرق للتعهدات أو إعفاءات.'), rule: L('Covenant field contains breach / waiver / default', 'حقل التعهدات يحتوي على خرق / إعفاء / تعثر'),
    criteria: L('Loan covenants per agreements.', 'تعهدات القروض وفق الاتفاقيات.'), cause: L('Financial performance or reporting failures.', 'ضعف الأداء المالي أو إخفاقات الإفصاح.'), effect: L('Debt may become callable; reclassification to current.', 'قد يصبح الدين مستحق الطلب ويُعاد تبويبه كمتداول.'), recommendation: L('Obtain waivers in writing and assess classification and disclosure.', 'الحصول على إعفاءات مكتوبة وتقييم التبويب والإفصاح.'),
    needs: [{ type: 'loans', fields: ['lender', 'outstanding', 'covenant'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'loans', ['lender', 'outstanding', 'covenant']); if (missing.length) return insufficient(missing); const out = list.filter((x) => /breach|waiver|default|violat|خرق|اعفاء|تعثر/i.test(x.a.t(x.r, 'covenant'))).map((x) => exc(keyOf('LN-03', x.a.t(x.r, 'lender')), L(`${x.a.t(x.r, 'lender')}: "${x.a.t(x.r, 'covenant')}"`, `${x.a.t(x.r, 'lender')}: "${x.a.t(x.r, 'covenant')}"`), [x], ['covenant'], { formula: 'Covenant CONTAINS breach/waiver/default', inputs: [{ label: L('Covenant', 'التعهد'), value: x.a.t(x.r, 'covenant') }], result: 'Breach' }, amt(x, 'outstanding', ctx.settings))); return ok(list.length, out); } },
];

// ───────────────────────────── Contracts & related parties
const ct = { area: 'contracts' as const, riskId: 'R-CP-03', controlId: 'C-PR-03' };
export const CT_TESTS: TestDef[] = [
  { ...ct, id: 'CT-01', severity: 'high', name: L('Billing exceeds contract value', 'الفوترة تتجاوز قيمة العقد'), objective: L('Identify contracts billed beyond their approved value.', 'تحديد العقود المفوترة بأكثر من قيمتها المعتمدة.'), rule: L('Billed to date > Contract value', 'المفوتر حتى تاريخه > قيمة العقد'),
    criteria: L('Contract value and approved variations.', 'قيمة العقد والأوامر التغييرية المعتمدة.'), cause: L('Possible causes: unapproved variations.', 'أسباب محتملة: أوامر تغييرية غير معتمدة.'), effect: L('Overpayment / unauthorized scope.', 'سداد زائد أو نطاق غير مصرح به.'), recommendation: L('Obtain approved variation orders or recover excess.', 'الحصول على أوامر تغييرية معتمدة أو استرداد الزيادة.'),
    needs: [{ type: 'contracts', fields: ['contractId', 'counterparty', 'value', 'billed'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'contracts', ['contractId', 'value', 'billed']); if (missing.length) return insufficient(missing); const out = list.filter((x) => (x.a.n(x.r, 'billed') ?? 0) > (x.a.n(x.r, 'value') ?? Infinity) + 0.01).map((x) => { const d = x.a.n(x.r, 'billed')! - x.a.n(x.r, 'value')!; return exc(keyOf('CT-01', x.a.t(x.r, 'contractId')), L(`Contract ${x.a.t(x.r, 'contractId')} billed ${fmtNum(x.a.n(x.r, 'billed'))} vs value ${fmtNum(x.a.n(x.r, 'value'))}`, `العقد ${x.a.t(x.r, 'contractId')} مفوتر ${fmtNum(x.a.n(x.r, 'billed'))} مقابل قيمة ${fmtNum(x.a.n(x.r, 'value'))}`), [x], ['value', 'billed'], { formula: 'Excess = Billed − Contract value', inputs: [{ label: L('Billed', 'المفوتر'), value: x.a.n(x.r, 'billed') }, { label: L('Value', 'القيمة'), value: x.a.n(x.r, 'value') }], result: round2(d) }, { amount: d, currency: x.a.t(x.r, 'currency').toUpperCase() || '—' }); }); return ok(list.length, out); } },
  { ...ct, id: 'CT-02', severity: 'medium', name: L('POs issued after contract expiry', 'أوامر شراء بعد انتهاء العقد'), objective: L('Identify POs referencing expired contracts.', 'تحديد أوامر الشراء المرتبطة بعقود منتهية.'), rule: L('PO date > Contract end date', 'تاريخ أمر الشراء > تاريخ انتهاء العقد'),
    criteria: L('Purchases require a valid contract.', 'تتطلب المشتريات عقدًا ساريًا.'), cause: L('Possible causes: renewal not processed.', 'أسباب محتملة: عدم تجديد العقد.'), effect: L('Purchases without contractual protection.', 'مشتريات بدون حماية تعاقدية.'), recommendation: L('Renew or re-tender expired contracts before further orders.', 'تجديد العقود المنتهية أو إعادة طرحها قبل أي طلبات جديدة.'),
    needs: [{ type: 'contracts', fields: ['contractId', 'endDate'] }, { type: 'procurement', fields: ['poNo', 'contract', 'poDate'] }],
    run(ctx) { const c = recs(ctx, 'contracts', ['contractId', 'endDate']); if (c.missing.length) return insufficient(c.missing); const p = recs(ctx, 'procurement', ['poNo', 'contract', 'poDate']); if (p.missing.length) return insufficient(p.missing); const byId = new Map<string, Rec>(); c.list.forEach((x) => byId.set(x.a.t(x.r, 'contractId'), x)); const out: TestException[] = []; for (const x of p.list) { const k = byId.get(x.a.t(x.r, 'contract')); if (!k) continue; const e = k.a.d(k.r, 'endDate'), d = x.a.d(x.r, 'poDate'); if (e && d && d > e) out.push(exc(keyOf('CT-02', po(x)), L(`PO ${po(x)} dated ${d} on contract ${k.a.t(k.r, 'contractId')} expired ${e}`, `أمر الشراء ${po(x)} بتاريخ ${d} على عقد ${k.a.t(k.r, 'contractId')} منتهٍ ${e}`), [x, k], [['poDate', 'contract'], ['endDate']], { formula: 'PO date > Contract end date', inputs: [{ label: L('PO date', 'تاريخ الأمر'), value: d, ref: ref(x) }, { label: L('Contract end', 'انتهاء العقد'), value: e, ref: ref(k) }], result: dayDiff(e, d) }, amt(x, 'amount', ctx.settings))); } return ok(p.list.length, out); } },
  { ...ct, id: 'CT-03', severity: 'low', name: L('Contracts expiring within 90 days', 'عقود تنتهي خلال 90 يومًا'), objective: L('Flag upcoming expiries for renewal planning.', 'رصد العقود قرب الانتهاء لتخطيط التجديد.'), rule: L('0 ≤ End date − As-of ≤ 90', 'الانتهاء خلال 90 يومًا'),
    criteria: L('Continuity of supply and services.', 'استمرارية التوريد والخدمات.'), cause: L('Contract lifecycle.', 'دورة حياة العقد.'), effect: L('Service interruption or off-contract buying.', 'انقطاع الخدمة أو الشراء خارج العقود.'), recommendation: L('Initiate renewal / tender in time.', 'بدء التجديد أو الطرح في الوقت المناسب.'),
    needs: [{ type: 'contracts', fields: ['contractId', 'endDate'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'contracts', ['contractId', 'endDate']); if (missing.length) return insufficient(missing); const ao = ctx.settings.asOfDate || new Date().toISOString().slice(0, 10); const out = list.filter((x) => { const e = x.a.d(x.r, 'endDate'); return e && dayDiff(ao, e) >= 0 && dayDiff(ao, e) <= 90; }).map((x) => exc(keyOf('CT-03', x.a.t(x.r, 'contractId')), L(`Contract ${x.a.t(x.r, 'contractId')} (${x.a.t(x.r, 'counterparty')}) ends ${x.a.d(x.r, 'endDate')}`, `العقد ${x.a.t(x.r, 'contractId')} (${x.a.t(x.r, 'counterparty')}) ينتهي ${x.a.d(x.r, 'endDate')}`), [x], ['endDate'], { formula: 'End date − As-of ≤ 90', inputs: [{ label: L('End', 'الانتهاء'), value: x.a.d(x.r, 'endDate') }, { label: L('As-of', 'التقييم'), value: ao }], result: dayDiff(ao, x.a.d(x.r, 'endDate')!) })); return ok(list.length, out, { asOf: ao }); } },
];

const rp = { area: 'related' as const, riskId: 'R-CP-04', controlId: 'C-RP-01' };
export const RP_TESTS: TestDef[] = [
  { ...rp, id: 'RP-01', severity: 'high', name: L('Unapproved related-party transactions', 'معاملات أطراف ذات علاقة غير معتمدة'), objective: L('Confirm related-party transactions are approved.', 'التحقق من اعتماد معاملات الأطراف ذات العلاقة.'), rule: L('Approval ≠ approved', 'الاعتماد غير معتمد'),
    criteria: L('Board / General Assembly approval requirements (as per governing documents provided).', 'متطلبات اعتماد مجلس الإدارة / الجمعية العامة (وفق المستندات الحاكمة المقدمة).'), cause: L('Possible causes: governance process not followed.', 'أسباب محتملة: عدم اتباع إجراءات الحوكمة.'), effect: L('Governance and disclosure risk.', 'مخاطر الحوكمة والإفصاح.'), recommendation: L('Obtain required approvals and register all related-party transactions.', 'الحصول على الاعتمادات المطلوبة وتسجيل جميع معاملات الأطراف ذات العلاقة.'),
    needs: [{ type: 'related', fields: ['party', 'amount', 'approval'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'related', ['party', 'approval']); if (missing.length) return insufficient(missing); const out = list.filter((x) => isApproved(x.a.t(x.r, 'approval')) !== true).map((x) => exc(keyOf('RP-01', x.a.t(x.r, 'party'), x.r.recordId), L(`${x.a.t(x.r, 'party')} ${x.a.t(x.r, 'txnType')} approval "${x.a.t(x.r, 'approval') || 'blank'}"`, `${x.a.t(x.r, 'party')} ${x.a.t(x.r, 'txnType')} الاعتماد "${x.a.t(x.r, 'approval') || 'فارغ'}"`), [x], ['approval'], { formula: 'Approval ≠ Approved', inputs: [{ label: L('Approval', 'الاعتماد'), value: x.a.t(x.r, 'approval') }], result: 'Unapproved' }, amt(x, 'amount', ctx.settings))); return ok(list.length, out); } },
  { ...rp, id: 'RP-02', severity: 'high', name: L('Undisclosed related-party transactions', 'معاملات أطراف ذات علاقة غير مفصح عنها'), objective: L('Confirm related-party transactions are disclosed.', 'التحقق من الإفصاح عن معاملات الأطراف ذات العلاقة.'), rule: L('Disclosure status ≠ disclosed', 'حالة الإفصاح غير مفصح'),
    criteria: L('Related-party disclosure requirements of the applicable framework (EAS / IFRS — to be confirmed).', 'متطلبات الإفصاح وفق الإطار المطبق (يتم تأكيده).'), cause: L('Possible causes: incomplete RP register.', 'أسباب محتملة: سجل أطراف غير مكتمل.'), effect: L('Financial statement disclosure deficiency.', 'قصور في الإفصاح بالقوائم المالية.'), recommendation: L('Complete the RP register and disclosure note.', 'استكمال سجل الأطراف وإيضاح الإفصاح.'),
    needs: [{ type: 'related', fields: ['party', 'disclosure'] }],
    run(ctx) { const { list, missing } = recs(ctx, 'related', ['party', 'disclosure']); if (missing.length) return insufficient(missing); const out = list.filter((x) => !/^(y|yes|disclosed|true|1|مفصح|نعم)/i.test(x.a.t(x.r, 'disclosure'))).map((x) => exc(keyOf('RP-02', x.a.t(x.r, 'party'), x.r.recordId), L(`${x.a.t(x.r, 'party')} disclosure "${x.a.t(x.r, 'disclosure') || 'blank'}"`, `${x.a.t(x.r, 'party')} الإفصاح "${x.a.t(x.r, 'disclosure') || 'فارغ'}"`), [x], ['disclosure'], { formula: 'Disclosure ≠ Disclosed', inputs: [{ label: L('Disclosure', 'الإفصاح'), value: x.a.t(x.r, 'disclosure') }], result: 'Undisclosed' }, amt(x, 'amount', ctx.settings))); return ok(list.length, out); } },
  { ...rp, id: 'RP-03', severity: 'medium', fraud: true, name: L('Related parties transacting as vendors', 'أطراف ذات علاقة تتعامل كموردين'), objective: L('Identify AP vendors matching the related-party register.', 'تحديد الموردين المطابقين لسجل الأطراف ذات العلاقة.'), rule: L('Normalized vendor name = related-party name', 'اسم المورد = اسم الطرف ذي العلاقة'),
    criteria: L('Related-party transactions must be identified, approved and at arm\'s length.', 'يجب تحديد معاملات الأطراف ذات العلاقة واعتمادها وأن تتم بشروط السوق.'), cause: L('Business relationships with affiliated entities.', 'علاقات تجارية مع جهات تابعة.'), effect: L('Pricing and governance risk if not managed.', 'مخاطر التسعير والحوكمة إن لم تُدر.'), recommendation: L('Confirm approval and arm\'s-length pricing for these vendors.', 'التأكد من الاعتماد وتسعير السوق لهؤلاء الموردين.'),
    needs: [{ type: 'related', fields: ['party'] }, { type: 'ap', fields: ['vendor', 'amount'] }],
    run(ctx) { const r = recs(ctx, 'related', ['party']); if (r.missing.length) return insufficient(r.missing); const ap = recs(ctx, 'ap', ['vendor', 'amount']); if (ap.missing.length) return insufficient(ap.missing); const parties = new Map<string, Rec>(); r.list.forEach((x) => parties.set(normName(x.a.t(x.r, 'party')), x)); const out: TestException[] = []; for (const [k, items] of groupBy(ap.list, (x) => normName(x.a.t(x.r, 'vendor')))) { const p = parties.get(k); if (!p) continue; const tot = items.reduce((s, i) => s + Math.abs(i.a.n(i.r, 'amount') ?? 0), 0); out.push(exc(keyOf('RP-03', k), L(`Vendor ${items[0].a.t(items[0].r, 'vendor')} is a registered related party (${items.length} invoices)`, `المورد ${items[0].a.t(items[0].r, 'vendor')} طرف ذو علاقة مسجل (${items.length} فواتير)`), [...items.slice(0, 50), p], [...items.slice(0, 50).map(() => ['vendor']), ['party']], { formula: 'Vendor = Related party', inputs: [{ label: L('Related party', 'الطرف'), value: p.a.t(p.r, 'party'), ref: ref(p) }, { label: L('AP invoices total', 'إجمالي الفواتير'), value: round2(tot) }], result: 'Match' })); } return ok(ap.list.length, out); } },
];
