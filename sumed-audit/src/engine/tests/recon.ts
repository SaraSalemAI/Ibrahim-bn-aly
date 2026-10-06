// Reconciliation engine — each reconciliation is an audit test so differences become evidence-backed findings.
import type { TestException, TestOutput } from '../types';
import { dayDiff, fmtNum } from '../values';
import { type TestDef, type Rec, type Ctx, recs, insufficient, exc, groupBy, keyOf, round2, ref } from './kit';

const L = (en: string, ar: string) => ({ en, ar });
const TOL = 1;

/** Identify control accounts by account name (or FS classification) pattern. Returns GL/TB records on those accounts. */
function controlAccounts(ctx: Ctx, re: RegExp): { source: 'tb' | 'gl' | null; list: Rec[]; accounts: string[]; balance: number } {
  const tb = recs(ctx, 'tb', ['account', 'closing']);
  const match = (x: Rec) => re.test(`${x.a.t(x.r, 'accountName')} ${x.a.t(x.r, 'fsClass')}`);
  if (!tb.missing.length) {
    const l = tb.list.filter(match);
    if (l.length) return { source: 'tb', list: l, accounts: [...new Set(l.map((x) => `${x.a.t(x.r, 'account')} ${x.a.t(x.r, 'accountName')}`.trim()))], balance: l.reduce((s, x) => s + (x.a.n(x.r, 'closing') ?? 0), 0) };
  }
  const gl = recs(ctx, 'gl', ['account', 'debit', 'credit']);
  if (!gl.missing.length) {
    const l = gl.list.filter(match);
    if (l.length) return { source: 'gl', list: l, accounts: [...new Set(l.map((x) => `${x.a.t(x.r, 'account')} ${x.a.t(x.r, 'accountName')}`.trim()))], balance: l.reduce((s, x) => s + (x.a.n(x.r, 'debit') ?? 0) - (x.a.n(x.r, 'credit') ?? 0), 0) };
  }
  return { source: null, list: [], accounts: [], balance: 0 };
}

interface SubTotal { list: Rec[]; total: number; missing: string[]; label: string }

function controlRecon(id: string, name: [string, string], re: RegExp, reLabel: string, sub: (ctx: Ctx) => SubTotal, extra: { riskId: string; controlId: string; severity: TestDef['severity'] }): TestDef {
  return {
    id, area: 'recon', ...extra, name: L(...name),
    objective: L(`Reconcile the ${name[0].split(' vs ')[0]} sub-ledger to the general ledger / trial balance.`, `مطابقة ${name[1]} مع دفتر الأستاذ / ميزان المراجعة.`),
    rule: L(`|Sub-ledger total| − |Control account balance| within ±${TOL}`, `الفرق بين الدفتر المساعد وحساب المراقبة ضمن ±${TOL}`),
    criteria: L('Sub-ledgers must agree to control accounts at period end.', 'يجب أن تتطابق الدفاتر المساعدة مع حسابات المراقبة في نهاية الفترة.'),
    cause: L('Possible causes: unposted items, cut-off differences, manual GL adjustments, extract timing.', 'أسباب محتملة: بنود غير مرحلة أو فروق فصل الفترات أو تسويات يدوية أو اختلاف توقيت الاستخراج.'),
    effect: L('Balances may be misstated; differences may conceal errors.', 'احتمال تحريف الأرصدة وإخفاء أخطاء في الفروق.'),
    recommendation: L('Prepare and review a monthly reconciliation with ageing of reconciling items; clear unexplained differences.', 'إعداد ومراجعة مطابقة شهرية مع أعمار البنود وتسوية الفروق غير المفسرة.'),
    needs: [{ type: 'tb', fields: ['account', 'accountName', 'closing'] }],
    run(ctx): TestOutput {
      const s = sub(ctx);
      if (s.missing.length) return insufficient(s.missing);
      const c = controlAccounts(ctx, re);
      if (!c.source) return insufficient([`No GL/TB control account found matching ${reLabel} (account name or FS classification). Map Account Name / FS Classification or upload a TB.`]);
      const diff = Math.abs(s.total) - Math.abs(c.balance);
      const params = { subLedger: round2(s.total), control: round2(c.balance), controlSource: c.source.toUpperCase(), controlAccounts: c.accounts.slice(0, 8).join('; '), difference: round2(diff), status: Math.abs(diff) <= TOL ? 'Matched' : 'Unmatched' };
      const out: TestException[] = [];
      if (Math.abs(diff) > TOL) {
        out.push(exc(keyOf(id, round2(s.total), round2(c.balance)), L(`${name[0]}: sub-ledger ${fmtNum(s.total)} vs control ${fmtNum(c.balance)} — difference ${fmtNum(diff)}`, `${name[1]}: الدفتر المساعد ${fmtNum(s.total)} مقابل حساب المراقبة ${fmtNum(c.balance)} — الفرق ${fmtNum(diff)}`),
          [...c.list.slice(0, 100), ...s.list.slice(0, 100)], [...c.list.slice(0, 100).map(() => (c.source === 'tb' ? ['account', 'closing'] : ['account', 'debit', 'credit'])), ...s.list.slice(0, 100).map(() => [])],
          { formula: 'Difference = |Σ Sub-ledger| − |Control account balance|', inputs: [{ label: L(`Σ ${s.label}`, 'إجمالي الدفتر المساعد'), value: round2(s.total) }, { label: L(`Control (${c.source.toUpperCase()})`, 'حساب المراقبة'), value: round2(c.balance) }, { label: L('Accounts used', 'الحسابات المستخدمة'), value: c.accounts.slice(0, 5).join('; ') }], result: round2(diff) },
          { amount: Math.abs(diff), currency: ctx.settings.assumeBaseCurrencyWhenMissing ? ctx.settings.baseCurrency : '—' }));
      }
      return { status: 'performed', missing: [], population: s.list.length, exceptions: out, params };
    },
  };
}

const sumField = (list: Rec[], f: string) => list.reduce((s, x) => s + (x.a.n(x.r, f) ?? 0), 0);

export const RECON_TESTS: TestDef[] = [
  {
    id: 'REC-01', area: 'recon', riskId: 'R-FR-01', controlId: 'C-RC-02', severity: 'high',
    name: L('GL vs Trial Balance', 'دفتر الأستاذ مقابل ميزان المراجعة'),
    objective: L('Agree GL net movement per account to TB movement.', 'مطابقة صافي حركة الحسابات في الأستاذ مع الميزان.'),
    rule: L('Per account: |(Σ GL Dr − Σ GL Cr) − (TB Dr − TB Cr)| ≤ 1; accounts in one source only = Missing', 'لكل حساب: الفرق ≤ 1؛ الحسابات في مصدر واحد فقط = مفقود'),
    criteria: L('TB is derived from the GL.', 'الميزان مشتق من دفتر الأستاذ.'),
    cause: L('Possible causes: incomplete GL extract, different periods, unposted entries.', 'أسباب محتملة: استخراج غير مكتمل أو فترات مختلفة أو قيود غير مرحلة.'),
    effect: L('Data completeness cannot be relied on.', 'لا يمكن الاعتماد على اكتمال البيانات.'),
    recommendation: L('Re-extract GL and TB for the same period and investigate differences.', 'إعادة استخراج الأستاذ والميزان لنفس الفترة وفحص الفروق.'),
    needs: [{ type: 'gl', fields: ['account', 'debit', 'credit'] }, { type: 'tb', fields: ['account', 'debit', 'credit'] }],
    run(ctx) {
      const gl = recs(ctx, 'gl', ['account', 'debit', 'credit']); if (gl.missing.length) return insufficient(gl.missing);
      const tb = recs(ctx, 'tb', ['account', 'debit', 'credit']); if (tb.missing.length) return insufficient(tb.missing);
      const g = groupBy(gl.list, (x) => x.a.t(x.r, 'account'));
      const t = groupBy(tb.list, (x) => x.a.t(x.r, 'account'));
      const out: TestException[] = [];
      let matched = 0, unmatched = 0, missingN = 0;
      for (const acct of new Set([...g.keys(), ...t.keys()])) {
        const gi = g.get(acct) ?? [], ti = t.get(acct) ?? [];
        const gv = sumField(gi, 'debit') - sumField(gi, 'credit'), tv = sumField(ti, 'debit') - sumField(ti, 'credit');
        if (!gi.length || !ti.length) {
          if (Math.abs(gv) + Math.abs(tv) < TOL) { matched++; continue; }
          missingN++;
          out.push(exc(keyOf('REC-01', acct, 'missing'), L(`Account ${acct} only in ${gi.length ? 'GL' : 'TB'} (net ${fmtNum(gv || tv)})`, `الحساب ${acct} موجود فقط في ${gi.length ? 'الأستاذ' : 'الميزان'} (الصافي ${fmtNum(gv || tv)})`), [...gi, ...ti].slice(0, 100), ['account'],
            { formula: 'Account ∈ one source only', inputs: [{ label: 'GL net', value: round2(gv) }, { label: 'TB net', value: round2(tv) }], result: 'Missing' }, { amount: Math.abs(gv || tv), currency: '—' }));
        } else if (Math.abs(gv - tv) > TOL) {
          unmatched++;
          out.push(exc(keyOf('REC-01', acct), L(`Account ${acct}: GL net ${fmtNum(gv)} vs TB net ${fmtNum(tv)}`, `الحساب ${acct}: صافي الأستاذ ${fmtNum(gv)} مقابل الميزان ${fmtNum(tv)}`), [...ti, ...gi.slice(0, 100)], [...ti.map(() => ['debit', 'credit']), ...gi.slice(0, 100).map(() => ['debit', 'credit'])],
            { formula: 'Difference = (Σ GL Dr − Σ GL Cr) − (TB Dr − TB Cr)', inputs: [{ label: 'Σ GL Dr', value: round2(sumField(gi, 'debit')) }, { label: 'Σ GL Cr', value: round2(sumField(gi, 'credit')) }, { label: 'TB Dr', value: round2(sumField(ti, 'debit')) }, { label: 'TB Cr', value: round2(sumField(ti, 'credit')) }], result: round2(gv - tv) }, { amount: Math.abs(gv - tv), currency: '—' }));
        } else matched++;
      }
      return { status: 'performed', missing: [], population: g.size + t.size, exceptions: out, params: { matched, unmatched, missing: missingN, status: out.length ? 'Unmatched' : 'Matched' } };
    },
  },
  controlRecon('REC-02', ['AP sub-ledger vs GL', 'الحسابات الدائنة مقابل الأستاذ'], /payable|creditor|supplier|موردين|دائنون|دائنين/i, '"payable/creditors/suppliers"', (ctx) => {
    const r = recs(ctx, 'ap', ['vendor', 'amount']);
    if (r.missing.length) return { list: [], total: 0, missing: r.missing, label: 'AP' };
    const open = r.list.filter((x) => !x.a.has('paymentDate') || !x.a.d(x.r, 'paymentDate'));
    return { list: open, total: sumField(open, 'amount'), missing: [], label: 'unpaid AP invoices' };
  }, { riskId: 'R-FR-01', controlId: 'C-RC-02', severity: 'medium' }),
  controlRecon('REC-03', ['AR sub-ledger vs GL', 'الحسابات المدينة مقابل الأستاذ'], /receivable|debtor|customer|عملاء|مدينون|مدينين/i, '"receivable/debtors/customers"', (ctx) => {
    const r = recs(ctx, 'ar', ['customer', 'amount']);
    if (r.missing.length) return { list: [], total: 0, missing: r.missing, label: 'AR' };
    const tot = r.list.reduce((s, x) => s + (x.a.has('outstanding') ? x.a.n(x.r, 'outstanding') ?? 0 : (x.a.n(x.r, 'amount') ?? 0) - (x.a.n(x.r, 'collected') ?? 0)), 0);
    return { list: r.list, total: tot, missing: [], label: 'AR outstanding' };
  }, { riskId: 'R-FR-01', controlId: 'C-RC-02', severity: 'medium' }),
  controlRecon('REC-04', ['Fixed Asset Register vs GL', 'سجل الأصول الثابتة مقابل الأستاذ'], /fixed asset|property|plant|equipment|accumulated depreciation|اصول ثابتة|أصول ثابتة|مجمع اهلاك|مجمع الإهلاك/i, '"fixed assets/PPE/accumulated depreciation"', (ctx) => {
    const r = recs(ctx, 'fa', ['cost']);
    if (r.missing.length) return { list: [], total: 0, missing: r.missing, label: 'FAR' };
    const active = r.list.filter((x) => !x.a.d(x.r, 'disposalDate'));
    const tot = active[0]?.a.has('nbv') ? sumField(active, 'nbv') : sumField(active, 'cost') - Math.abs(sumField(active, 'accDep'));
    return { list: active, total: tot, missing: [], label: 'FAR net book value' };
  }, { riskId: 'R-FR-01', controlId: 'C-FA-01', severity: 'medium' }),
  controlRecon('REC-05', ['Inventory vs GL', 'المخزون مقابل الأستاذ'], /inventory|stock|stores|مخزون|المخازن/i, '"inventory/stock/stores"', (ctx) => {
    const r = recs(ctx, 'inventory', ['itemCode', 'quantity']);
    if (r.missing.length) return { list: [], total: 0, missing: r.missing, label: 'Inventory' };
    if (!r.list[0].a.has('totalValue') && !r.list[0].a.has('unitCost')) return { list: [], total: 0, missing: ['Inventory: Total value or Unit cost must be mapped'], label: '' };
    return { list: r.list, total: r.list.reduce((s, x) => s + (x.a.n(x.r, 'totalValue') ?? (x.a.n(x.r, 'quantity') ?? 0) * (x.a.n(x.r, 'unitCost') ?? 0)), 0), missing: [], label: 'inventory value' };
  }, { riskId: 'R-FR-01', controlId: 'C-IN-01', severity: 'medium' }),
  controlRecon('REC-06', ['Loans schedule vs GL', 'جدول القروض مقابل الأستاذ'], /loan|borrowing|facility|قرض|قروض|تسهيلات/i, '"loan/borrowings/facility"', (ctx) => {
    const r = recs(ctx, 'loans', ['lender', 'outstanding']);
    if (r.missing.length) return { list: [], total: 0, missing: r.missing, label: '' };
    return { list: r.list, total: sumField(r.list, 'outstanding'), missing: [], label: 'loans outstanding' };
  }, { riskId: 'R-FN-01', controlId: 'C-TR-03', severity: 'medium' }),
  controlRecon('REC-07', ['Bank closing balances vs GL', 'أرصدة البنوك الختامية مقابل الأستاذ'], /bank|cash|نقدية|بنك|البنوك/i, '"bank/cash"', (ctx) => {
    const r = recs(ctx, 'bank', ['bankAccount', 'date', 'balance']);
    if (r.missing.length) return { list: [], total: 0, missing: r.missing, label: '' };
    const last: Rec[] = [];
    for (const [, items] of groupBy(r.list, (x) => x.a.t(x.r, 'bankAccount'))) {
      const s = [...items].sort((a, b) => (a.a.d(a.r, 'date') ?? '').localeCompare(b.a.d(b.r, 'date') ?? '') || a.r.rowNumber - b.r.rowNumber);
      last.push(s[s.length - 1]);
    }
    return { list: last, total: sumField(last, 'balance'), missing: [], label: 'latest bank balances' };
  }, { riskId: 'R-FN-01', controlId: 'C-RC-01', severity: 'high' }),
  {
    id: 'REC-08', area: 'recon', riskId: 'R-FN-01', controlId: 'C-RC-01', severity: 'high',
    name: L('Bank vs GL transaction matching', 'مطابقة حركات البنك مع الأستاذ'),
    objective: L('Match each bank transaction to a GL cash/bank posting and age unmatched items.', 'مطابقة كل حركة بنكية مع قيد نقدية/بنك في الأستاذ وتحديد أعمار البنود غير المطابقة.'),
    rule: L('Match on amount (exact) and date ±3 days = Matched; amount match with 4–10 days = Partially matched; else Unmatched', 'تطابق المبلغ والتاريخ ±3 أيام = مطابق؛ 4–10 أيام = مطابق جزئيًا؛ غير ذلك = غير مطابق'),
    criteria: L('Bank reconciliation prepared and reviewed monthly.', 'إعداد ومراجعة التسوية البنكية شهريًا.'),
    cause: L('Possible causes: timing items, unrecorded bank charges/receipts, unauthorized transfers.', 'أسباب محتملة: بنود توقيت أو رسوم/متحصلات غير مسجلة أو تحويلات غير مصرح بها.'),
    effect: L('Cash misstatement; unrecorded or unauthorized transactions.', 'تحريف النقدية ومعاملات غير مسجلة أو غير مصرح بها.'),
    recommendation: L('Investigate unmatched items older than 30 days and record or recover as appropriate.', 'فحص البنود غير المطابقة الأقدم من 30 يومًا وتسجيلها أو استردادها.'),
    needs: [{ type: 'bank', fields: ['date', 'debit', 'credit'] }, { type: 'gl', fields: ['date', 'account', 'accountName', 'debit', 'credit'] }],
    run(ctx) {
      const bank = recs(ctx, 'bank', ['date', 'debit', 'credit']); if (bank.missing.length) return insufficient(bank.missing);
      const gl = recs(ctx, 'gl', ['date', 'account', 'debit', 'credit']); if (gl.missing.length) return insufficient(gl.missing);
      const bankGlAccts = new Set(bank.list.map((x) => x.a.t(x.r, 'glAccount')).filter(Boolean));
      const glCash = gl.list.filter((x) => bankGlAccts.size ? bankGlAccts.has(x.a.t(x.r, 'account')) : /bank|cash|نقدية|بنك/i.test(x.a.t(x.r, 'accountName')));
      if (!glCash.length) return insufficient(['No GL bank/cash postings identified (map Bank → GL Account, or GL Account Name containing "bank"/"cash")']);
      // Bank debit (outflow) ↔ GL credit to bank; bank credit (inflow) ↔ GL debit to bank
      const pool = new Map<string, { x: Rec; d: string; used: boolean }[]>();
      for (const x of glCash) {
        const d = x.a.d(x.r, 'date'); if (!d) continue;
        const dr = x.a.n(x.r, 'debit') ?? 0, cr = x.a.n(x.r, 'credit') ?? 0;
        const k = dr ? `in|${round2(dr)}` : `out|${round2(cr)}`;
        if (!pool.has(k)) pool.set(k, []);
        pool.get(k)!.push({ x, d, used: false });
      }
      const asOf = ctx.settings.asOfDate || bank.list.reduce((m, x) => { const d = x.a.d(x.r, 'date'); return d && d > m ? d : m; }, '');
      const out: TestException[] = [];
      let matched = 0, partial = 0;
      const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      for (const b of bank.list) {
        const d = b.a.d(b.r, 'date'); if (!d) continue;
        const dr = b.a.n(b.r, 'debit') ?? 0, cr = b.a.n(b.r, 'credit') ?? 0; if (!dr && !cr) continue;
        const k = dr ? `out|${round2(dr)}` : `in|${round2(cr)}`;
        const cands = (pool.get(k) ?? []).filter((c) => !c.used).map((c) => ({ c, gap: Math.abs(dayDiff(c.d, d)) })).sort((p, q) => p.gap - q.gap);
        const best = cands[0];
        if (best && best.gap <= 3) { best.c.used = true; matched++; continue; }
        if (best && best.gap <= 10) {
          best.c.used = true; partial++;
          out.push(exc(keyOf('REC-08', 'partial', b.r.recordId), L(`Bank ${dr ? 'payment' : 'receipt'} ${fmtNum(dr || cr)} on ${d} matched to GL ${best.c.d} (${best.gap} days apart)`, `حركة بنكية ${fmtNum(dr || cr)} في ${d} طوبقت مع قيد ${best.c.d} (فرق ${best.gap} يوم)`), [b, best.c.x], [['date', dr ? 'debit' : 'credit'], ['date', dr ? 'credit' : 'debit']],
            { formula: 'Amount equal AND 3 < |Δdate| ≤ 10 → Partially matched', inputs: [{ label: L('Bank date', 'تاريخ البنك'), value: d, ref: ref(b) }, { label: L('GL date', 'تاريخ القيد'), value: best.c.d, ref: ref(best.c.x) }], result: 'Partially matched' }));
          continue;
        }
        const age = asOf ? dayDiff(d, asOf) : 0;
        aging[age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+']++;
        out.push(exc(keyOf('REC-08', 'bank', b.r.recordId), L(`Unmatched bank ${dr ? 'payment' : 'receipt'} ${fmtNum(dr || cr)} on ${d} (${age} days) — ${b.a.t(b.r, 'description')}`, `حركة بنكية غير مطابقة ${fmtNum(dr || cr)} في ${d} (${age} يوم) — ${b.a.t(b.r, 'description')}`), [b], ['date', dr ? 'debit' : 'credit', 'description'],
          { formula: 'No GL bank posting with equal amount within ±10 days', inputs: [{ label: L('Amount', 'المبلغ'), value: dr || cr }, { label: L('Date', 'التاريخ'), value: d }, { label: L('Age (days)', 'العمر (يوم)'), value: age }], result: 'Unmatched' }, { amount: dr || cr, currency: b.a.t(b.r, 'currency').toUpperCase() || '—' }));
      }
      let glUn = 0;
      for (const [, cs] of pool) for (const c of cs) if (!c.used) {
        glUn++;
        const v = (c.x.a.n(c.x.r, 'debit') ?? 0) || (c.x.a.n(c.x.r, 'credit') ?? 0);
        out.push(exc(keyOf('REC-08', 'gl', c.x.r.recordId), L(`GL bank posting ${fmtNum(v)} on ${c.d} not found in bank (journal ${c.x.a.t(c.x.r, 'journalId')})`, `قيد بنك ${fmtNum(v)} في ${c.d} غير موجود بكشف البنك (القيد ${c.x.a.t(c.x.r, 'journalId')})`), [c.x], ['date', 'debit', 'credit'],
          { formula: 'No bank line with equal amount within ±10 days', inputs: [{ label: L('Amount', 'المبلغ'), value: v }, { label: L('Date', 'التاريخ'), value: c.d }], result: 'Unmatched (GL)' }, { amount: Math.abs(v), currency: c.x.a.t(c.x.r, 'currency').toUpperCase() || '—' }));
      }
      return { status: 'performed', missing: [], population: bank.list.length, exceptions: out, params: { matched, partial, unmatchedBank: bank.list.length - matched - partial, unmatchedGL: glUn, aging0_30: aging['0-30'], aging31_60: aging['31-60'], aging61_90: aging['61-90'], aging90plus: aging['90+'], asOf, status: out.length ? (matched ? 'Partially matched' : 'Unmatched') : 'Matched' } };
    },
  },
  {
    id: 'REC-09', area: 'recon', riskId: 'R-CP-01', controlId: 'C-TX-01', severity: 'medium',
    name: L('Tax ledger vs GL balance', 'سجل الضرائب مقابل رصيد الأستاذ'),
    objective: L('Agree tax computed per tax type to the GL balance recorded in the tax file.', 'مطابقة الضريبة المحتسبة لكل نوع مع رصيد الأستاذ المسجل.'),
    rule: L('Per tax type & period: |Σ Tax amount − GL balance| ≤ 1', 'لكل نوع وفترة: الفرق ≤ 1'),
    criteria: L('Tax ledger agrees to the general ledger.', 'تطابق سجل الضرائب مع دفتر الأستاذ.'),
    cause: L('Possible causes: unrecorded tax, misposting.', 'أسباب محتملة: ضرائب غير مسجلة أو خطأ توجيه.'), effect: L('Tax balances misstated.', 'تحريف الأرصدة الضريبية.'),
    recommendation: L('Reconcile tax accounts monthly with review sign-off.', 'مطابقة حسابات الضرائب شهريًا مع توقيع المراجعة.'),
    needs: [{ type: 'tax', fields: ['taxType', 'taxAmount', 'glBalance'] }],
    run(ctx) {
      const { list, missing } = recs(ctx, 'tax', ['taxType', 'taxAmount', 'glBalance']); if (missing.length) return insufficient(missing);
      const out: TestException[] = [];
      for (const [k, items] of groupBy(list, (x) => keyOf(x.a.t(x.r, 'taxType'), x.a.t(x.r, 'period')))) {
        const t = sumField(items, 'taxAmount'), g = items[0].a.n(items[0].r, 'glBalance') ?? 0;
        if (Math.abs(Math.abs(t) - Math.abs(g)) > TOL) out.push(exc(keyOf('REC-09', k), L(`${k.replace('|', ' ')}: tax ${fmtNum(t)} vs GL ${fmtNum(g)}`, `${k.replace('|', ' ')}: الضريبة ${fmtNum(t)} مقابل الأستاذ ${fmtNum(g)}`), items, ['taxAmount', 'glBalance'], { formula: 'Difference = |Σ Tax| − |GL balance|', inputs: [{ label: L('Σ Tax', 'إجمالي الضريبة'), value: round2(t) }, { label: L('GL', 'الأستاذ'), value: g }], result: round2(Math.abs(t) - Math.abs(g)) }, { amount: Math.abs(Math.abs(t) - Math.abs(g)), currency: '—' }));
      }
      return { status: 'performed', missing: [], population: list.length, exceptions: out, params: { status: out.length ? 'Unmatched' : 'Matched' } };
    },
  },
  {
    id: 'REC-10', area: 'recon', riskId: 'R-FR-01', controlId: 'C-RC-02', severity: 'medium',
    name: L('Payroll register vs GL salary expense', 'سجل الرواتب مقابل مصروف الرواتب بالأستاذ'),
    objective: L('Agree total gross payroll to GL salary/wage expense.', 'مطابقة إجمالي الرواتب مع مصروف الرواتب والأجور في الأستاذ.'),
    rule: L('|Σ Gross payroll − Σ GL salary expense (Dr − Cr)| ≤ 1', 'الفرق ≤ 1'),
    criteria: L('Payroll postings agree to the payroll register.', 'تطابق قيود الرواتب مع سجل الرواتب.'),
    cause: L('Possible causes: off-payroll payments, different periods, accrual timing.', 'أسباب محتملة: مدفوعات خارج الرواتب أو اختلاف الفترات أو توقيت الاستحقاق.'), effect: L('Payroll cost misstated or unrecorded payments.', 'تحريف تكلفة الرواتب أو مدفوعات غير مسجلة.'),
    recommendation: L('Reconcile payroll register to GL each payroll cycle.', 'مطابقة سجل الرواتب مع الأستاذ في كل دورة رواتب.'),
    needs: [{ type: 'payroll', fields: ['employeeId', 'gross'] }, { type: 'gl', fields: ['accountName', 'debit', 'credit'] }],
    run(ctx) {
      const p = recs(ctx, 'payroll', ['employeeId', 'gross']); if (p.missing.length) return insufficient(p.missing);
      const gl = recs(ctx, 'gl', ['accountName', 'debit', 'credit']); if (gl.missing.length) return insufficient(gl.missing);
      const sal = gl.list.filter((x) => /salar|wage|payroll|رواتب|اجور|أجور|مرتبات/i.test(x.a.t(x.r, 'accountName')) && !/payable|مستحق/i.test(x.a.t(x.r, 'accountName')));
      if (!sal.length) return insufficient(['No GL salary/wage expense accounts identified by account name']);
      const pt = sumField(p.list, 'gross'), gt = sumField(sal, 'debit') - sumField(sal, 'credit');
      const out: TestException[] = [];
      if (Math.abs(pt - gt) > TOL) out.push(exc(keyOf('REC-10', round2(pt), round2(gt)), L(`Payroll gross ${fmtNum(pt)} vs GL salary expense ${fmtNum(gt)}`, `إجمالي الرواتب ${fmtNum(pt)} مقابل مصروف الأستاذ ${fmtNum(gt)}`), sal.slice(0, 100), ['accountName', 'debit', 'credit'], { formula: 'Difference = Σ Gross − Σ GL salary (Dr − Cr)', inputs: [{ label: L('Σ Gross', 'إجمالي الرواتب'), value: round2(pt) }, { label: L('GL salary', 'مصروف الأستاذ'), value: round2(gt) }], result: round2(pt - gt) }, { amount: Math.abs(pt - gt), currency: '—' }));
      return { status: 'performed', missing: [], population: p.list.length, exceptions: out, params: { payroll: round2(pt), gl: round2(gt), status: out.length ? 'Unmatched' : 'Matched' } };
    },
  },
  {
    id: 'REC-11', area: 'recon', riskId: 'R-FR-01', controlId: 'C-RC-03', severity: 'medium',
    name: L('Intercompany balances', 'الأرصدة بين شركات المجموعة'),
    objective: L('Agree reciprocal intercompany balances between group entities.', 'مطابقة الأرصدة المتبادلة بين شركات المجموعة.'),
    rule: L('Σ intercompany balances by counterparty pair nets to zero', 'صافي الأرصدة المتبادلة لكل زوج = صفر'),
    criteria: L('Intercompany balances agree before consolidation.', 'تطابق الأرصدة بين الشركات قبل التجميع.'),
    cause: L('Timing, FX, or unrecorded charges.', 'التوقيت أو فروق العملة أو رسوم غير مسجلة.'), effect: L('Consolidation errors.', 'أخطاء في التجميع.'),
    recommendation: L('Implement monthly intercompany confirmation.', 'تطبيق مصادقات شهرية بين الشركات.'),
    needs: [{ type: 'tb', fields: ['account', 'accountName', 'closing'] }],
    run(ctx) {
      const tb = recs(ctx, 'tb', ['account', 'accountName', 'closing']); if (tb.missing.length) return insufficient(tb.missing);
      const ic = tb.list.filter((x) => /intercompany|inter-company|due (to|from)|related compan|بين الشركات|مستحق (من|الى|إلى)/i.test(x.a.t(x.r, 'accountName')));
      if (!ic.length) return insufficient(['No intercompany accounts identified in TB (account names containing "intercompany" / "due to" / "due from")']);
      const net = sumField(ic, 'closing');
      const out: TestException[] = [];
      if (Math.abs(net) > TOL) out.push(exc(keyOf('REC-11', round2(net)), L(`Intercompany accounts net to ${fmtNum(net)} (should be zero when all entities are included)`, `صافي الحسابات بين الشركات ${fmtNum(net)} (يجب أن يكون صفرًا عند إدراج جميع الشركات)`), ic, ['accountName', 'closing'], { formula: 'Σ intercompany closing balances', inputs: ic.slice(0, 10).map((x) => ({ label: x.a.t(x.r, 'accountName'), value: x.a.n(x.r, 'closing'), ref: ref(x) })), result: round2(net) }, { amount: Math.abs(net), currency: '—' }));
      return { status: 'performed', missing: [], population: ic.length, exceptions: out, params: { net: round2(net), note: 'Single-entity TB: a non-zero net is expected unless counterpart entity TBs are uploaded', status: out.length ? 'Unexplained difference' : 'Matched' } };
    },
  },
];
