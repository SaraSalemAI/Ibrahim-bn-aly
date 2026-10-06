// Site payments & contracts review — Head Office, Ain Sokhna, Sidi Kerir, Dahshour (configurable)
import type { TestException } from '../types';
import { fmtNum, dayDiff } from '../values';
import { rowSite } from '../sites';
import { type TestDef, type Rec, recs, insufficient, exc, amt, groupBy, keyOf, normName, ref } from './kit';

const L = (en: string, ar: string) => ({ en, ar });
const base = { area: 'contracts' as const, riskId: 'R-CP-03', controlId: 'C-ST-01' };
const siteOf = (x: Rec, ctx: Parameters<TestDef['run']>[0]) => rowSite(x.a.table, x.r, ctx.settings.sites);
const siteName = (id: string | null, ctx: Parameters<TestDef['run']>[0]) => ctx.settings.sites.find((s) => s.id === id)?.name ?? L('Unassigned', 'غير محدد');

function contractIndex(list: Rec[]) {
  const m = new Map<string, Rec[]>();
  for (const c of list) { const k = normName(c.a.t(c.r, 'counterparty')); if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); }
  return m;
}

export const SITE_TESTS: TestDef[] = [
  {
    ...base, id: 'ST-01', severity: 'medium', area: 'ap',
    name: L('Payments not allocated to a site', 'مدفوعات غير مخصصة لموقع'),
    objective: L('Confirm every payment is allocated to Head Office or an operating site.', 'التحقق من تخصيص كل دفعة للمركز الرئيسي أو أحد المواقع.'),
    rule: L('Site / location / cost center does not resolve to a configured site', 'الموقع / مركز التكلفة لا يطابق أي موقع محدد'),
    criteria: L('Costs are attributed to the responsible site for budget and accountability.', 'تُحمل التكاليف على الموقع المسؤول لأغراض الموازنة والمساءلة.'),
    cause: L('Possible causes: missing site coding at invoice entry.', 'أسباب محتملة: عدم ترميز الموقع عند إدخال الفاتورة.'),
    effect: L('Site costs and budgets cannot be monitored reliably.', 'تعذر متابعة تكاليف وموازنات المواقع بدقة.'),
    recommendation: L('Make site a mandatory field on invoices and payments; reallocate unassigned items.', 'جعل الموقع حقلًا إلزاميًا في الفواتير والمدفوعات وإعادة تخصيص البنود غير المحددة.'),
    needs: [{ type: 'ap', fields: ['vendor', 'invoiceNo', 'amount', 'site'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount']); if (missing.length) return insufficient(missing);
      const t = list[0].a;
      if (!['site', 'costCenter', 'department'].some((f) => t.has(f))) return insufficient(['AP: Site, Cost center or Department must be mapped to allocate payments to sites']);
      const out: TestException[] = list.filter((x) => !siteOf(x, ctx)).map((x) => exc(keyOf('ST-01', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} (${x.a.t(x.r, 'vendor')}) site "${x.a.t(x.r, 'site') || x.a.t(x.r, 'costCenter') || 'blank'}" not recognised`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} (${x.a.t(x.r, 'vendor')}) الموقع "${x.a.t(x.r, 'site') || x.a.t(x.r, 'costCenter') || 'فارغ'}" غير معروف`), [x], ['site', 'costCenter', 'department'],
        { formula: 'Resolve(Site | Cost center | Department) ∉ configured sites', inputs: [{ label: L('Site value', 'قيمة الموقع'), value: x.a.t(x.r, 'site') || x.a.t(x.r, 'costCenter') || null }, { label: L('Configured sites', 'المواقع المحددة'), value: ctx.settings.sites.map((s) => s.name.en).join(', ') }], result: 'Unassigned' }, amt(x, 'amount', ctx.settings)));
      return { status: 'performed', missing: [], population: list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'ST-02', severity: 'high',
    name: L('Payments after contract expiry', 'مدفوعات بعد انتهاء العقد'),
    objective: L('Identify payments to contracted vendors made after all their contracts ended.', 'تحديد المدفوعات لموردين متعاقدين بعد انتهاء جميع عقودهم.'),
    rule: L('Payment date > latest contract end date for the vendor', 'تاريخ السداد > آخر تاريخ انتهاء لعقود المورد'),
    criteria: L('Payments require a valid contract (or approved extension).', 'يتطلب السداد عقدًا ساريًا (أو تمديدًا معتمدًا).'),
    cause: L('Possible causes: expired contracts not renewed, work continued without extension.', 'أسباب محتملة: عدم تجديد العقود المنتهية أو استمرار العمل دون تمديد.'),
    effect: L('Payments without contractual basis; pricing and liability exposure.', 'مدفوعات بدون أساس تعاقدي وتعرض في الأسعار والمسؤولية.'),
    recommendation: L('Regularize by approved extensions or re-tender; block payment against expired contracts.', 'التسوية بتمديدات معتمدة أو إعادة الطرح ومنع السداد على عقود منتهية.'),
    needs: [{ type: 'contracts', fields: ['contractId', 'counterparty', 'endDate'] }, { type: 'ap', fields: ['vendor', 'invoiceNo', 'amount', 'paymentDate'] }],
    run(ctx) {
      const c = recs(ctx, 'contracts', ['contractId', 'counterparty', 'endDate']); if (c.missing.length) return insufficient(c.missing);
      const ap = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount', 'paymentDate']); if (ap.missing.length) return insufficient(ap.missing);
      const idx = contractIndex(c.list);
      const out: TestException[] = [];
      for (const x of ap.list) {
        const cs = idx.get(normName(x.a.t(x.r, 'vendor'))); if (!cs) continue;
        const p = x.a.d(x.r, 'paymentDate'); if (!p) continue;
        const latest = cs.reduce<Rec | null>((m, k) => { const e = k.a.d(k.r, 'endDate'); return e && (!m || e > (m.a.d(m.r, 'endDate') ?? '')) ? k : m; }, null);
        const e = latest?.a.d(latest.r, 'endDate'); if (!latest || !e || p <= e) continue;
        out.push(exc(keyOf('ST-02', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} paid ${p}, ${dayDiff(e, p)} days after contract ${latest.a.t(latest.r, 'contractId')} ended (${siteName(siteOf(x, ctx), ctx).en})`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} سُددت ${p} بعد ${dayDiff(e, p)} يومًا من انتهاء العقد ${latest.a.t(latest.r, 'contractId')} (${siteName(siteOf(x, ctx), ctx).ar})`), [x, latest], [['paymentDate', 'vendor'], ['endDate', 'contractId']],
          { formula: 'Payment date > max(Contract end date | vendor)', inputs: [{ label: L('Payment date', 'تاريخ السداد'), value: p, ref: ref(x) }, { label: L('Contract end', 'انتهاء العقد'), value: e, ref: ref(latest) }], result: dayDiff(e, p) }, amt(x, 'amount', ctx.settings)));
      }
      return { status: 'performed', missing: [], population: ap.list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'ST-03', severity: 'medium',
    name: L('Cross-site contract usage', 'استخدام عقود موقع لموقع آخر'),
    objective: L('Identify payments charged to a site different from the site of the vendor\'s contract.', 'تحديد المدفوعات المحملة على موقع يختلف عن موقع عقد المورد.'),
    rule: L('Site(payment) ≠ Site(contract) for the same vendor, and the vendor has no contract for the payment site', 'موقع الدفعة ≠ موقع العقد ولا يوجد للمورد عقد للموقع'),
    criteria: L('Site contracts are used only for the site they were awarded for (unless a group/framework contract).', 'تُستخدم عقود المواقع للموقع المسند له فقط (ما لم تكن عقودًا إطارية).'),
    cause: L('Possible causes: framework contracts not flagged, mis-coding, scope extension without approval.', 'أسباب محتملة: عقود إطارية غير مميزة أو خطأ ترميز أو توسيع النطاق دون اعتماد.'),
    effect: L('Spend outside contract scope; site budgets misstated.', 'إنفاق خارج نطاق العقد وتحريف موازنات المواقع.'),
    recommendation: L('Confirm contract scope covers the paying site or obtain a variation.', 'التأكد من شمول نطاق العقد للموقع أو الحصول على أمر تغييري.'),
    needs: [{ type: 'contracts', fields: ['contractId', 'counterparty', 'site'] }, { type: 'ap', fields: ['vendor', 'invoiceNo', 'amount', 'site'] }],
    run(ctx) {
      const c = recs(ctx, 'contracts', ['contractId', 'counterparty', 'site']); if (c.missing.length) return insufficient(c.missing);
      const ap = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount']); if (ap.missing.length) return insufficient(ap.missing);
      const idx = contractIndex(c.list);
      const out: TestException[] = [];
      for (const x of ap.list) {
        const cs = idx.get(normName(x.a.t(x.r, 'vendor'))); if (!cs) continue;
        const ps = siteOf(x, ctx); if (!ps) continue;
        const csites = cs.map((k) => siteOf(k, ctx)).filter(Boolean) as string[];
        if (!csites.length || csites.includes(ps)) continue;
        out.push(exc(keyOf('ST-03', x.a.t(x.r, 'vendor'), x.a.t(x.r, 'invoiceNo')), L(`Invoice ${x.a.t(x.r, 'invoiceNo')} charged to ${siteName(ps, ctx).en}; vendor contract(s) for ${[...new Set(csites)].map((s) => siteName(s, ctx).en).join(', ')}`, `الفاتورة ${x.a.t(x.r, 'invoiceNo')} محملة على ${siteName(ps, ctx).ar}؛ عقود المورد لـ ${[...new Set(csites)].map((s) => siteName(s, ctx).ar).join('، ')}`), [x, cs[0]], [['site', 'vendor'], ['site', 'contractId']],
          { formula: 'Site(payment) ∉ {Site(contracts of vendor)}', inputs: [{ label: L('Payment site', 'موقع الدفعة'), value: siteName(ps, ctx).en, ref: ref(x) }, { label: L('Contract site(s)', 'موقع العقد'), value: [...new Set(csites)].join(', '), ref: ref(cs[0]) }], result: 'Mismatch' }, amt(x, 'amount', ctx.settings)));
      }
      return { status: 'performed', missing: [], population: ap.list.length, exceptions: out };
    },
  },
  {
    ...base, id: 'ST-04', severity: 'medium',
    name: L('Significant payments without contract coverage', 'مدفوعات جوهرية بدون تغطية تعاقدية'),
    objective: L('Identify vendors paid above the large-amount threshold in total with no contract on file.', 'تحديد الموردين المسدد لهم إجمالًا فوق حد المبالغ الكبيرة دون عقد مسجل.'),
    rule: L('Σ payments(vendor, site) ≥ Large threshold AND vendor ∉ Contracts', 'إجمالي المدفوعات للمورد والموقع ≥ الحد والمورد غير متعاقد'),
    criteria: L('Recurring or significant procurement is covered by a contract.', 'تغطية المشتريات المتكررة أو الجوهرية بعقد.'),
    cause: L('Possible causes: purchases by PO only, missing contract records.', 'أسباب محتملة: الشراء بأوامر شراء فقط أو نقص سجلات العقود.'),
    effect: L('Weak legal protection; non-competitive spend.', 'ضعف الحماية القانونية وإنفاق غير تنافسي.'),
    recommendation: L('Put significant recurring vendors under contract via competitive process.', 'إبرام عقود مع الموردين الجوهريين عبر إجراءات تنافسية.'),
    needs: [{ type: 'contracts', fields: ['contractId', 'counterparty'] }, { type: 'ap', fields: ['vendor', 'invoiceNo', 'amount'] }],
    run(ctx) {
      const th = ctx.settings.largeAmount ?? ctx.settings.materiality.performance;
      if (!th) return insufficient(['Large-amount threshold or performance materiality not configured (Settings)']);
      const c = recs(ctx, 'contracts', ['contractId', 'counterparty']); if (c.missing.length) return insufficient(c.missing);
      const ap = recs(ctx, 'ap', ['vendor', 'invoiceNo', 'amount']); if (ap.missing.length) return insufficient(ap.missing);
      const idx = contractIndex(c.list);
      const out: TestException[] = [];
      for (const [k, items] of groupBy(ap.list.filter((x) => !idx.has(normName(x.a.t(x.r, 'vendor')))), (x) => keyOf(normName(x.a.t(x.r, 'vendor')), siteOf(x, ctx)))) {
        let sum = 0; for (const i of items) { const m = amt(i, 'amount', ctx.settings); if (m && m.currency === ctx.settings.baseCurrency) sum += Math.abs(m.amount); }
        if (sum < th) continue;
        const s = siteName(siteOf(items[0], ctx), ctx);
        out.push(exc(keyOf('ST-04', k), L(`${items[0].a.t(items[0].r, 'vendor')} (${s.en}): ${items.length} invoices totalling ${fmtNum(sum)} with no contract`, `${items[0].a.t(items[0].r, 'vendor')} (${s.ar}): ${items.length} فواتير بإجمالي ${fmtNum(sum)} بدون عقد`), items.slice(0, 100), ['vendor', 'amount', 'site'],
          { formula: 'Σ amount(vendor, site) ≥ Threshold AND vendor ∉ Contracts', inputs: [{ label: L('Σ payments', 'إجمالي المدفوعات'), value: sum }, { label: L('Threshold', 'الحد'), value: th }], result: 'No contract' }, { amount: sum, currency: ctx.settings.baseCurrency }));
      }
      return { status: 'performed', missing: [], population: ap.list.length, exceptions: out, params: { threshold: th } };
    },
  },
  {
    ...base, id: 'ST-05', severity: 'low',
    name: L('Contracts not allocated to a site', 'عقود غير مخصصة لموقع'),
    objective: L('Confirm each contract is assigned to Head Office or a site.', 'التحقق من تخصيص كل عقد للمركز الرئيسي أو أحد المواقع.'),
    rule: L('Contract site does not resolve to a configured site', 'موقع العقد لا يطابق أي موقع محدد'),
    criteria: L('Contract ownership is assigned to a responsible site.', 'تحديد الموقع المسؤول عن كل عقد.'),
    cause: L('Possible causes: incomplete contract register.', 'أسباب محتملة: سجل عقود غير مكتمل.'),
    effect: L('Contract monitoring gaps by site.', 'فجوات في متابعة العقود حسب الموقع.'),
    recommendation: L('Complete site ownership in the contract register.', 'استكمال تحديد الموقع المسؤول في سجل العقود.'),
    needs: [{ type: 'contracts', fields: ['contractId', 'counterparty', 'site'] }],
    run(ctx) {
      const c = recs(ctx, 'contracts', ['contractId', 'counterparty', 'site']); if (c.missing.length) return insufficient(c.missing);
      const out = c.list.filter((x) => !siteOf(x, ctx)).map((x) => exc(keyOf('ST-05', x.a.t(x.r, 'contractId')), L(`Contract ${x.a.t(x.r, 'contractId')} (${x.a.t(x.r, 'counterparty')}) site "${x.a.t(x.r, 'site') || 'blank'}"`, `العقد ${x.a.t(x.r, 'contractId')} (${x.a.t(x.r, 'counterparty')}) الموقع "${x.a.t(x.r, 'site') || 'فارغ'}"`), [x], ['site'],
        { formula: 'Resolve(Site) ∉ configured sites', inputs: [{ label: L('Site value', 'قيمة الموقع'), value: x.a.t(x.r, 'site') || null }], result: 'Unassigned' }, amt(x, 'value', ctx.settings)));
      return { status: 'performed', missing: [], population: c.list.length, exceptions: out };
    },
  },
];
