import { round2, type Analysis } from "./engine";
import type { GlLine } from "./gl";
import type { ApInvoice, ArInvoice, InventoryItem, PayrollLine } from "./subledgers";
import { CREDIT_NATURAL, type Category, type TBRow } from "./types";

/**
 * Deterministic close review: rules that flag entries and balances an auditor would ask about.
 * Every flag carries the rows behind it. The AI close review only explains these results.
 */
export interface Anomaly {
  id: string;
  area: "gl" | "tb" | "ar" | "ap" | "inventory" | "payroll" | "bank";
  severity: "high" | "medium" | "low";
  title: [string, string];
  detail: [string, string];
  count: number;
  /** A few example rows, already formatted for display. */
  examples: string[];
}

const PL_DEBIT: ReadonlySet<Category | ""> = new Set(["COGS", "SELLING_EXPENSE", "ADMIN_EXPENSE", "DEPRECIATION", "FINANCE_COST", "TAX_EXPENSE"]);
const CONTRA: ReadonlySet<Category | ""> = new Set(["ACCUM_DEPRECIATION", "RETAINED_EARNINGS", "OTHER_EQUITY"]);
const SUSPENSE = /suspense|clearing|unallocated|unidentified|temporary|transit|معلق|وسيط|تحت التسوية|غير مخصص/i;

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Egypt's weekend is Friday and Saturday. */
const weekend = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 5 || d === 6;
};

/** Mean absolute deviation of first digits from Benford's law (Nigrini: above 0.015 is nonconformity). */
export function benfordMad(amounts: number[]): { mad: number | null; n: number; observed: number[]; expected: number[] } {
  const firsts = amounts.map((a) => Math.abs(a)).filter((a) => a >= 10).map((a) => Number(String(Math.floor(a))[0]));
  const expected = Array.from({ length: 9 }, (_, i) => Math.log10(1 + 1 / (i + 1)));
  if (firsts.length < 300) return { mad: null, n: firsts.length, observed: [], expected };
  const counts = Array(9).fill(0);
  for (const d of firsts) counts[d - 1]++;
  const observed = counts.map((c) => c / firsts.length);
  const mad = observed.reduce((s, o, i) => s + Math.abs(o - expected[i]), 0) / 9;
  return { mad: round2(mad * 1000) / 1000, n: firsts.length, observed, expected };
}

export interface AnomalyInput {
  rows: TBRow[];
  analysis: Analysis;
  period: { start: string; end: string };
  gl: GlLine[];
  ar: ArInvoice[];
  ap: ApInvoice[];
  inventory: InventoryItem[];
  payroll: PayrollLine[];
  bankDifference: number | null;
}

export function scanAnomalies(x: AnomalyInput): Anomaly[] {
  const out: Anomaly[] = [];
  const cur = x.analysis.current;
  const materiality = Math.max(1000, Math.abs(cur.revenue) * 0.01, Math.abs(cur.totalAssets) * 0.005);
  const push = (a: Omit<Anomaly, "count" | "examples">, items: string[]) => {
    if (items.length) out.push({ ...a, count: items.length, examples: items.slice(0, 6) });
  };

  // ---------------------------------------------------------------- general ledger
  if (x.gl.length) {
    const gl = x.gl;
    const amt = (l: GlLine) => Math.max(l.debit, l.credit);
    const line = (l: GlLine) => `${l.postingDate} · JE ${l.journalId} · ${l.accountCode} ${l.accountName} · ${fmt(amt(l))}${l.memo ? ` · ${l.memo}` : ""}`;

    push({ id: "glWeekend", area: "gl", severity: "low", title: ["Postings on a Friday or Saturday", "قيود يوم جمعة أو سبت"], detail: ["Entries dated on the Egyptian weekend. Usually fine for automated postings; worth a look for manual ones.", "قيود بتاريخ عطلة نهاية الأسبوع. عادة طبيعية للقيود الآلية؛ تستحق المراجعة للقيود اليدوية."] }, [...new Set(gl.filter((l) => weekend(l.postingDate)).map((l) => l.journalId))].map((j) => line(gl.find((l) => l.journalId === j)!)));

    push({ id: "glOutside", area: "gl", severity: "high", title: ["Postings outside the period", "قيود خارج الفترة"], detail: [`Dated before ${x.period.start} or after ${x.period.end}: cut-off error or the wrong file.`, `بتاريخ قبل ${x.period.start} أو بعد ${x.period.end}: خطأ في الفصل بين الفترات أو ملف خاطئ.`] }, gl.filter((l) => l.postingDate < x.period.start || l.postingDate > x.period.end).map(line));

    const roundThreshold = Math.max(10000, materiality / 2);
    push({ id: "glRound", area: "gl", severity: "medium", title: ["Large round-amount entries", "قيود كبيرة بمبالغ مقربة"], detail: [`Amounts of ${fmt(roundThreshold)} or more that are exact multiples of 10,000: often estimates or manual adjustments.`, `مبالغ ${fmt(roundThreshold)} فأكثر من مضاعفات ١٠٬٠٠٠ تمامًا: غالبًا تقديرات أو تسويات يدوية.`] }, gl.filter((l) => amt(l) >= roundThreshold && amt(l) % 10000 === 0).sort((a, b) => amt(b) - amt(a)).map(line));

    const lastDays = new Date(Date.parse(x.period.end) - 3 * 86_400_000).toISOString().slice(0, 10);
    push({ id: "glPeriodEnd", area: "gl", severity: "medium", title: ["Material entries in the last days of the period", "قيود جوهرية في آخر أيام الفترة"], detail: [`Lines of ${fmt(materiality)} or more posted after ${lastDays}. Check cut-off and support.`, `قيود ${fmt(materiality)} فأكثر بعد ${lastDays}. راجع الفصل بين الفترات والمستندات.`] }, gl.filter((l) => l.postingDate > lastDays && l.postingDate <= x.period.end && amt(l) >= materiality).sort((a, b) => amt(b) - amt(a)).map(line));

    push({ id: "glNoMemo", area: "gl", severity: "low", title: ["Entries without a description", "قيود بدون بيان"], detail: ["Journal lines with no memo or narration make the audit trail hard to follow.", "قيود بدون بيان تجعل مسار المراجعة صعب التتبع."] }, gl.filter((l) => !l.memo && amt(l) >= materiality / 10).map(line));

    const cats = new Map(x.rows.map((r) => [r.code, r.category]));
    const byJe = new Map<string, GlLine[]>();
    for (const l of gl) byJe.set(l.journalId, [...(byJe.get(l.journalId) ?? []), l]);
    const revenueDebits: string[] = [];
    for (const [, ls] of byJe) {
      const revDr = ls.filter((l) => cats.get(l.accountCode) === "REVENUE" && l.debit > 0);
      const other = ls.filter((l) => l.credit > 0 && !["RECEIVABLES", "CASH", "REVENUE"].includes(cats.get(l.accountCode) ?? ""));
      if (revDr.length && other.length) revenueDebits.push(...revDr.map(line));
    }
    push({ id: "glRevenueDebit", area: "gl", severity: "high", title: ["Revenue debited against unusual accounts", "إيرادات مدينة مقابل حسابات غير معتادة"], detail: ["Revenue reduced by an entry whose other side is not receivables or cash: reclassification or possible revenue management.", "تخفيض الإيرادات بقيد طرفه الآخر ليس العملاء أو النقدية: إعادة تبويب أو احتمال إدارة للإيرادات."] }, revenueDebits);

    const seen = new Map<string, GlLine>();
    const dup: string[] = [];
    for (const l of gl) {
      const k = `${l.accountCode}|${l.debit}|${l.credit}|${l.postingDate}`;
      const prev = seen.get(k);
      if (prev && prev.journalId !== l.journalId && amt(l) >= materiality / 10) dup.push(`${line(l)} (also JE ${prev.journalId})`);
      else seen.set(k, l);
    }
    push({ id: "glDuplicate", area: "gl", severity: "medium", title: ["Possible duplicate postings", "قيود مكررة محتملة"], detail: ["Same account, amount and date in different journal entries.", "نفس الحساب والمبلغ والتاريخ في قيود مختلفة."] }, dup);

    const b = benfordMad(gl.map(amt));
    if (b.mad !== null && b.mad > 0.015) {
      const worst = b.observed.map((o, i) => ({ d: i + 1, gap: o - b.expected[i] })).sort((p, q) => Math.abs(q.gap) - Math.abs(p.gap)).slice(0, 3);
      out.push({ id: "glBenford", area: "gl", severity: "medium", title: ["First digits do not follow Benford's law", "الأرقام الأولى لا تتبع قانون بنفورد"], detail: [`Mean absolute deviation ${b.mad} on ${b.n} amounts (above 0.015 is nonconformity). Can signal invented or rounded figures, or just an unusual business.`, `متوسط الانحراف ${b.mad} على ${b.n} مبلغ (أعلى من ٠٫٠١٥ عدم توافق). قد يشير لأرقام مختلقة أو مقربة، أو لطبيعة نشاط غير معتادة.`], count: b.n, examples: worst.map((w) => `digit ${w.d}: ${(w.gap * 100).toFixed(1)} pts ${w.gap > 0 ? "over" : "under"}`) });
    }
  }

  // ---------------------------------------------------------------- trial balance
  const net = (r: TBRow) => r.currentDebit - r.currentCredit;
  push(
    { id: "tbAbnormal", area: "tb", severity: "medium", title: ["Balances on the unusual side", "أرصدة على الجانب غير المعتاد"], detail: ["Assets or expenses with credit balances, liabilities or income with debit balances.", "أصول أو مصروفات برصيد دائن، أو التزامات أو إيرادات برصيد مدين."] },
    x.rows
      .filter((r) => r.category && !CONTRA.has(r.category) && Math.abs(net(r)) >= 1)
      .filter((r) => (CREDIT_NATURAL.has(r.category as Category) ? net(r) > 0 : net(r) < 0))
      .map((r) => `${r.code} ${r.name}: ${net(r) > 0 ? "Dr" : "Cr"} ${fmt(Math.abs(net(r)))}`),
  );
  push({ id: "tbSuspense", area: "tb", severity: "high", title: ["Suspense or clearing accounts with a balance", "حسابات معلقة أو وسيطة بها رصيد"], detail: ["These should be cleared to zero before the period is closed.", "يجب تصفيتها قبل إقفال الفترة."] }, x.rows.filter((r) => SUSPENSE.test(r.name) && Math.abs(net(r)) >= 1).map((r) => `${r.code} ${r.name}: ${fmt(net(r))}`));
  push({ id: "tbUnmapped", area: "tb", severity: "high", title: ["Unmapped accounts", "حسابات غير مربوطة"], detail: ["Accounts in the holding class are left out of the statement lines.", "الحسابات في التصنيف المؤقت لا تظهر في بنود القوائم."] }, x.rows.filter((r) => !r.category).map((r) => `${r.code} ${r.name}: ${fmt(net(r))}`));
  push(
    { id: "tbSwing", area: "tb", severity: "medium", title: ["Large movements against the prior period", "تغيرات كبيرة عن الفترة السابقة"], detail: ["Material statement lines that moved by more than 50%.", "بنود جوهرية تغيرت بأكثر من ٥٠٪."] },
    x.analysis.variances.filter((v) => v.material && v.changePct !== null && Math.abs(v.changePct) > 50).map((v) => `${v.key}: ${fmt(v.prior ?? 0)} → ${fmt(v.current)} (${v.changePct}%)`),
  );
  push({ id: "tbExpenseCredit", area: "tb", severity: "low", title: ["Expense accounts with credit balances", "حسابات مصروفات برصيد دائن"], detail: ["Often a reversal posted to the wrong period or a misclassified income item.", "غالبًا عكس قيد في فترة خاطئة أو إيراد مبوب خطأ."] }, x.rows.filter((r) => PL_DEBIT.has(r.category) && net(r) < -1).map((r) => `${r.code} ${r.name}: Cr ${fmt(-net(r))}`));

  // ---------------------------------------------------------------- subledgers
  if (x.ar.length) {
    push({ id: "arCredit", area: "ar", severity: "low", title: ["Customers with credit balances", "عملاء بأرصدة دائنة"], detail: ["Advances or unapplied receipts: reclassify to liabilities if material.", "دفعات مقدمة أو تحصيلات غير مخصصة: يعاد تبويبها كالتزامات إن كانت جوهرية."] }, x.ar.filter((i) => i.outstanding < 0).map((i) => `${i.customer} · ${i.invoice}: ${fmt(i.outstanding)}`));
    const old = x.ar.filter((i) => i.outstanding > 0 && Date.parse(x.period.end) - Date.parse(i.dueDate) > 365 * 86_400_000);
    push({ id: "arOld", area: "ar", severity: "medium", title: ["Receivables overdue for more than a year", "مديونيات متأخرة أكثر من سنة"], detail: ["Check recoverability and whether a full provision or write-off is needed.", "راجع إمكانية التحصيل والحاجة لمخصص كامل أو إعدام."] }, old.map((i) => `${i.customer} · ${i.invoice} · due ${i.dueDate}: ${fmt(i.outstanding)}`));
    const total = x.ar.reduce((a, i) => a + Math.max(0, i.outstanding), 0);
    const byCust = new Map<string, number>();
    for (const i of x.ar) byCust.set(i.customer, (byCust.get(i.customer) ?? 0) + Math.max(0, i.outstanding));
    const top = [...byCust.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && total > 0 && top[1] / total > 0.3) out.push({ id: "arConcentration", area: "ar", severity: "low", title: ["Customer concentration", "تركز العملاء"], detail: [`${top[0]} holds ${((top[1] / total) * 100).toFixed(0)}% of receivables.`, `${top[0]} يمثل ${((top[1] / total) * 100).toFixed(0)}٪ من المديونيات.`], count: 1, examples: [`${top[0]}: ${fmt(top[1])}`] });
  }
  if (x.ap.length) {
    const seen = new Map<string, ApInvoice>();
    const dup: string[] = [];
    for (const i of x.ap) {
      const k = `${i.supplier.toLowerCase()}|${i.invoice.toLowerCase()}`;
      if (seen.has(k)) dup.push(`${i.supplier} · ${i.invoice}: ${fmt(i.amount)}`);
      else seen.set(k, i);
    }
    push({ id: "apDuplicate", area: "ap", severity: "high", title: ["Supplier invoice entered twice", "فاتورة مورد مسجلة مرتين"], detail: ["Same supplier and invoice number: risk of double payment.", "نفس المورد ورقم الفاتورة: خطر السداد مرتين."] }, dup);
    push({ id: "apDebit", area: "ap", severity: "low", title: ["Suppliers with debit balances", "موردون بأرصدة مدينة"], detail: ["Advance payments or overpayments to suppliers.", "دفعات مقدمة أو مدفوعات زائدة للموردين."] }, x.ap.filter((i) => i.netPayable < 0).map((i) => `${i.supplier} · ${i.invoice}: ${fmt(i.netPayable)}`));
    push({ id: "apNoTaxId", area: "ap", severity: "low", title: ["Supplier invoices without a tax registration number", "فواتير موردين بدون رقم تسجيل ضريبي"], detail: ["Withholding tax (Form 41) and input VAT need the supplier's tax ID.", "ضريبة الخصم (نموذج ٤١) وضريبة المدخلات تتطلب الرقم الضريبي للمورد."] }, x.ap.filter((i) => !i.taxId && i.amount >= materiality / 10).map((i) => `${i.supplier} · ${i.invoice}: ${fmt(i.amount)}`));
  }
  if (x.inventory.length) push({ id: "invNegative", area: "inventory", severity: "high", title: ["Negative stock quantities", "كميات مخزون سالبة"], detail: ["Issues recorded before receipts, or a count error.", "صرف قبل الاستلام أو خطأ في الجرد."] }, x.inventory.filter((i) => i.endingQty < 0).map((i) => `${i.sku} ${i.description}: ${i.endingQty}`));
  if (x.payroll.length) push({ id: "payNoSi", area: "payroll", severity: "low", title: ["Employees without social insurance", "عاملون بدون تأمينات اجتماعية"], detail: ["No employee or company social insurance on a paid salary.", "لا توجد تأمينات للعامل أو الشركة على راتب مدفوع."] }, x.payroll.filter((p) => p.gross > 0 && !p.employeeSocialInsurance && !p.companySocialInsurance).map((p) => `${p.employeeId} · ${p.department}: ${fmt(p.gross)}`));
  if (x.bankDifference !== null && Math.abs(x.bankDifference) >= 1) out.push({ id: "bankDiff", area: "bank", severity: "high", title: ["Bank reconciliation does not agree", "التسوية البنكية غير متطابقة"], detail: [`Unexplained difference of ${fmt(x.bankDifference)} after reconciling items.`, `فرق غير مفسر ${fmt(x.bankDifference)} بعد بنود التسوية.`], count: 1, examples: [] });

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
