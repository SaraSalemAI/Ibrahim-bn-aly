import { round2 } from "../finance/engine";
import { STANDARD_VAT } from "../finance/subledgers";
import { CREDIT_NATURAL, type Category, type TBRow } from "../finance/types";
import type { Computed } from "../workspace/compute";
import type { Company, ValidationRun } from "../workspace/types";

/**
 * Validation suite run after every import (and on demand). Each rule says what it checked, whether
 * it passed, and lists the records behind a failure. Amounts within the company's tolerance count
 * as agreed. Rules only report: nothing is changed.
 */
export type Area = "tb" | "opening" | "gl" | "ar" | "ap" | "far" | "inventory" | "payroll" | "bank" | "eta" | "tieout" | "fx" | "period";

export interface Check {
  id: string;
  area: Area;
  level: "error" | "warning" | "info";
  ok: boolean;
  title: [string, string];
  /** Shown when the check fails. */
  detail?: [string, string];
  count: number;
  items: string[];
  /** Module where the problem is fixed. */
  fix?: string;
}

const fmt = (n: number) => Math.round(n * 100) / 100 === Math.round(n) ? Math.round(n).toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const net = (r: TBRow) => r.currentDebit - r.currentCredit;
const netPrior = (r: TBRow) => r.priorDebit - r.priorCredit;
const PL: ReadonlySet<Category | ""> = new Set(["REVENUE", "COGS", "SELLING_EXPENSE", "ADMIN_EXPENSE", "DEPRECIATION", "FINANCE_COST", "OTHER_INCOME", "TAX_EXPENSE"]);

export function validateCompany(c: Company, k: Computed, today = new Date().toISOString().slice(0, 10)): Check[] {
  const tol = Math.max(0, c.tolerance ?? 1);
  const out: Check[] = [];
  const add = (x: Omit<Check, "ok" | "count" | "items"> & { items?: string[]; ok?: boolean }) => {
    const items = x.items ?? [];
    out.push({ ...x, items: items.slice(0, 25), count: items.length, ok: x.ok ?? items.length === 0 });
  };
  const { start, end } = c.period;
  const rows = c.rows;
  const sl = c.subledgers;

  // ------------------------------------------------------------ trial balance
  if (rows.length) {
    const dr = rows.reduce((a, r) => a + r.currentDebit, 0);
    const cr = rows.reduce((a, r) => a + r.currentCredit, 0);
    add({ id: "tb.balanced", area: "tb", level: "error", title: ["Trial balance debits equal credits", "مدين الميزان يساوي الدائن"], detail: [`Difference ${fmt(round2(dr - cr))}`, `الفرق ${fmt(round2(dr - cr))}`], ok: Math.abs(dr - cr) <= tol, items: Math.abs(dr - cr) > tol ? [`Dr ${fmt(dr)} − Cr ${fmt(cr)} = ${fmt(round2(dr - cr))}`] : [], fix: "/trial-balance" });
    const hasPrior = rows.some((r) => r.priorDebit || r.priorCredit);
    if (hasPrior) {
      const pd = rows.reduce((a, r) => a + r.priorDebit, 0);
      const pc = rows.reduce((a, r) => a + r.priorCredit, 0);
      add({ id: "tb.priorBalanced", area: "tb", level: "error", title: ["Prior-period column balances", "عمود الفترة السابقة متوازن"], ok: Math.abs(pd - pc) <= tol, items: Math.abs(pd - pc) > tol ? [`Dr ${fmt(pd)} − Cr ${fmt(pc)} = ${fmt(round2(pd - pc))}`] : [], fix: "/ingest" });
    }
    const seen = new Map<string, number>();
    for (const r of rows) if (r.code) seen.set(r.code, (seen.get(r.code) ?? 0) + 1);
    add({ id: "tb.duplicateCodes", area: "tb", level: "error", title: ["Account codes are unique", "أكواد الحسابات غير مكررة"], items: [...seen.entries()].filter(([, n]) => n > 1).map(([code, n]) => `${code} ×${n}`), fix: "/ingest" });
    add({ id: "tb.missingNames", area: "tb", level: "warning", title: ["Every account has a name", "كل حساب له اسم"], items: rows.filter((r) => !r.name.trim()).map((r) => r.code || `row ${r.sourceRow}`) });
    add({ id: "tb.missingCodes", area: "tb", level: "warning", title: ["Every account has a code", "كل حساب له كود"], items: rows.filter((r) => !r.code.trim()).map((r) => r.name) });
    add({ id: "tb.bothSides", area: "tb", level: "info", title: ["No account carries both a debit and a credit balance", "لا يوجد حساب برصيد مدين ودائن معًا"], items: rows.filter((r) => r.currentDebit > tol && r.currentCredit > tol).map((r) => `${r.code} ${r.name}: Dr ${fmt(r.currentDebit)} / Cr ${fmt(r.currentCredit)}`) });
    add({ id: "tb.unmapped", area: "tb", level: "error", title: ["All accounts are mapped to a statement line", "كل الحسابات مربوطة ببند في القوائم"], items: rows.filter((r) => !r.category).map((r) => `${r.code} ${r.name}`), fix: "/mapping" });
    add({ id: "tb.pendingMapping", area: "tb", level: "warning", title: ["No suggested mappings are waiting for review", "لا توجد مقترحات ربط تنتظر المراجعة"], items: rows.filter((r) => r.suggested).map((r) => `${r.code} ${r.name} → ${r.category || "?"} (${r.confidence ?? "?"}%)`), fix: "/mapping" });
    add({
      id: "tb.abnormalSign",
      area: "tb",
      level: "warning",
      title: ["Balances sit on their normal side", "الأرصدة على جانبها الطبيعي"],
      items: rows
        .filter((r) => r.category && !["ACCUM_DEPRECIATION", "RETAINED_EARNINGS", "OTHER_EQUITY"].includes(r.category) && Math.abs(net(r)) > tol)
        .filter((r) => (CREDIT_NATURAL.has(r.category as Category) ? net(r) > 0 : net(r) < 0))
        .map((r) => `${r.code} ${r.name}: ${net(r) > 0 ? "Dr" : "Cr"} ${fmt(Math.abs(net(r)))}`),
    });
    const codes = rows.map((r) => r.code).filter(Boolean);
    const numeric = codes.filter((x) => /^\d+$/.test(x)).length;
    if (codes.length && numeric && numeric !== codes.length) add({ id: "tb.codeFormat", area: "tb", level: "info", title: ["Account codes use one format", "الأكواد بصيغة واحدة"], items: codes.filter((x) => !/^\d+$/.test(x)).slice(0, 25) });
    if (k.analysis) add({ id: "tb.bsEquation", area: "tb", level: "error", title: ["Assets = liabilities + equity", "الأصول = الالتزامات + حقوق الملكية"], ok: Math.abs(k.analysis.current.balanceCheck) <= tol, items: Math.abs(k.analysis.current.balanceCheck) > tol ? [`Difference ${fmt(k.analysis.current.balanceCheck)}`] : [], fix: "/statements" });
  }

  // ------------------------------------------------------------ opening balances
  const lastClosed = c.history[c.history.length - 1];
  if (lastClosed && rows.length) {
    const closing = new Map(lastClosed.rows.map((r) => [r.code, net(r)]));
    const diffs = rows
      .filter((r) => !PL.has(r.category) && closing.has(r.code))
      .map((r) => ({ r, d: round2(netPrior(r) - closing.get(r.code)!) }))
      .filter((x) => Math.abs(x.d) > tol);
    add({ id: "opening.matchesClosed", area: "opening", level: "error", title: ["Comparatives equal the closed period's closing balances", "أرصدة المقارنة تساوي أرصدة إقفال الفترة السابقة"], detail: [`Compared with ${lastClosed.label}`, `مقارنة بـ ${lastClosed.label}`], items: diffs.map((x) => `${x.r.code} ${x.r.name}: ${fmt(netPrior(x.r))} vs ${fmt(closing.get(x.r.code)!)} (${fmt(x.d)})`) });
    const missing = lastClosed.rows.filter((r) => Math.abs(net(r)) > tol && !PL.has(r.category) && !rows.some((x) => x.code === r.code));
    add({ id: "opening.accountsCarried", area: "opening", level: "warning", title: ["Every balance-sheet account from the closed period is still in the trial balance", "كل حسابات الميزانية من الفترة المقفلة موجودة في الميزان"], items: missing.map((r) => `${r.code} ${r.name}: ${fmt(net(r))}`) });
  }
  if (c.opening && rows.length && c.subledgers.gl.length) {
    // TB closing − GL movement should give back the opening balance.
    const mov = new Map<string, number>();
    for (const l of c.subledgers.gl) mov.set(l.accountCode, (mov.get(l.accountCode) ?? 0) + l.debit - l.credit);
    const diffs = c.opening.filter((o) => {
      const r = rows.find((x) => x.code === o.code);
      return r && Math.abs(round2(net(r) - (mov.get(o.code) ?? 0) - net(o))) > tol;
    });
    add({ id: "opening.rollsToClosing", area: "opening", level: "warning", title: ["Opening balance + GL movement = closing balance", "الرصيد الافتتاحي + حركة الأستاذ = الرصيد الختامي"], items: diffs.map((o) => `${o.code} ${o.name}`) });
  }

  // ------------------------------------------------------------ general ledger
  if (sl.gl.length) {
    const gl = k.analysis ? k.subledgers.gl : null;
    if (gl) {
      add({ id: "gl.balancedJournals", area: "gl", level: "error", title: ["Every journal entry balances", "كل قيد متوازن"], items: gl.unbalanced.filter((u) => Math.abs(u.difference) > tol).map((u) => `JE ${u.journalId}: ${fmt(u.difference)}`) });
      add({ id: "gl.matchesTbByAccount", area: "gl", level: "warning", title: ["GL movement equals TB movement for every account", "حركة الأستاذ تساوي حركة الميزان لكل حساب"], items: gl.vsTb.accounts.filter((a) => Math.abs(a.difference) > tol).map((a) => `${a.code} ${a.name}: TB ${fmt(a.tbMovement)} vs GL ${fmt(a.glMovement)} (${fmt(a.difference)})`), fix: "/ingest" });
      add({ id: "gl.accountsInTb", area: "gl", level: "warning", title: ["Every GL account exists in the trial balance", "كل حسابات الأستاذ موجودة في الميزان"], items: gl.vsTb.glOnly.map((a) => `${a.code} ${a.name}: ${fmt(a.glMovement)}`) });
    }
    add({ id: "gl.inPeriod", area: "period", level: "warning", title: ["GL postings fall inside the period", "قيود الأستاذ داخل الفترة"], items: sl.gl.filter((l) => l.postingDate < start || l.postingDate > end).map((l) => `${l.postingDate} JE ${l.journalId} ${l.accountCode} ${fmt(Math.max(l.debit, l.credit))}`) });
    add({ id: "gl.noFutureDates", area: "period", level: "error", title: ["No GL postings are dated in the future", "لا قيود بتاريخ مستقبلي"], items: sl.gl.filter((l) => l.postingDate > today).map((l) => `${l.postingDate} JE ${l.journalId}`) });
    add({ id: "gl.noZeroLines", area: "gl", level: "info", title: ["No zero-amount lines", "لا توجد سطور بقيمة صفر"], items: sl.gl.filter((l) => !l.debit && !l.credit).map((l) => `JE ${l.journalId} ${l.accountCode}`) });
    add({ id: "gl.oneSided", area: "gl", level: "warning", title: ["No line has both a debit and a credit", "لا يوجد سطر به مدين ودائن معًا"], items: sl.gl.filter((l) => l.debit > 0 && l.credit > 0).map((l) => `JE ${l.journalId} ${l.accountCode}`) });
  }

  // ------------------------------------------------------------ receivables
  if (sl.ar.length) {
    add({ id: "ar.outstandingWithinAmount", area: "ar", level: "error", title: ["Outstanding never exceeds the invoice amount", "المتبقي لا يتجاوز قيمة الفاتورة"], items: sl.ar.filter((i) => i.amount > 0 && i.outstanding - i.amount > tol).map((i) => `${i.invoice} ${i.customer}: ${fmt(i.outstanding)} > ${fmt(i.amount)}`) });
    add({ id: "ar.dueAfterInvoice", area: "ar", level: "warning", title: ["Due dates are on or after invoice dates", "تاريخ الاستحقاق بعد تاريخ الفاتورة"], items: sl.ar.filter((i) => i.dueDate < i.invoiceDate).map((i) => `${i.invoice}: ${i.invoiceDate} → ${i.dueDate}`) });
    add({ id: "ar.notAfterPeriod", area: "period", level: "warning", title: ["No invoices are dated after the period end", "لا فواتير بعد نهاية الفترة"], items: sl.ar.filter((i) => i.invoiceDate > end).map((i) => `${i.invoice} ${i.invoiceDate}`) });
    const dup = new Map<string, number>();
    for (const i of sl.ar) dup.set(i.invoice, (dup.get(i.invoice) ?? 0) + 1);
    add({ id: "ar.uniqueInvoices", area: "ar", level: "warning", title: ["Invoice numbers are unique", "أرقام الفواتير غير مكررة"], items: [...dup.entries()].filter(([, n]) => n > 1).map(([inv, n]) => `${inv} ×${n}`) });
    add({ id: "ar.negative", area: "ar", level: "info", title: ["No negative balances (unapplied receipts)", "لا أرصدة سالبة"], items: sl.ar.filter((i) => i.outstanding < -tol).map((i) => `${i.invoice} ${i.customer}: ${fmt(i.outstanding)}`) });
  }

  // ------------------------------------------------------------ payables
  if (sl.ap.length) {
    add({ id: "ap.netEqualsGrossLessWht", area: "ap", level: "warning", title: ["Net payable = amount − withholding tax", "الصافي = القيمة − ضريبة الخصم"], items: sl.ap.filter((i) => Math.abs(i.amount - i.whtDeducted - i.netPayable) > tol).map((i) => `${i.supplier} ${i.invoice}: ${fmt(i.amount)} − ${fmt(i.whtDeducted)} ≠ ${fmt(i.netPayable)}`) });
    const rates = [0, 0.01, 0.03, 0.05];
    add({ id: "ap.whtRate", area: "ap", level: "warning", title: ["Withholding tax is 0%, 1%, 3% or 5% of the amount", "ضريبة الخصم ٠ أو ١ أو ٣ أو ٥٪"], items: sl.ap.filter((i) => i.amount > 0 && !rates.some((r) => Math.abs(i.whtDeducted - i.amount * r) <= Math.max(tol, i.amount * 0.001))).map((i) => `${i.supplier} ${i.invoice}: ${((i.whtDeducted / i.amount) * 100).toFixed(2)}%`) });
    add({ id: "ap.dueAfterInvoice", area: "ap", level: "warning", title: ["Due dates are on or after invoice dates", "تاريخ الاستحقاق بعد تاريخ الفاتورة"], items: sl.ap.filter((i) => i.dueDate < i.invoiceDate).map((i) => `${i.supplier} ${i.invoice}`) });
    add({ id: "ap.taxIdFormat", area: "ap", level: "info", title: ["Supplier tax registration numbers have 9 digits", "أرقام التسجيل الضريبي ٩ أرقام"], items: sl.ap.filter((i) => i.taxId && !/^\d{9}$/.test(i.taxId.replace(/[-\s]/g, ""))).map((i) => `${i.supplier}: ${i.taxId}`) });
    const dup = new Map<string, number>();
    for (const i of sl.ap) dup.set(`${i.supplier.toLowerCase()}|${i.invoice.toLowerCase()}`, (dup.get(`${i.supplier.toLowerCase()}|${i.invoice.toLowerCase()}`) ?? 0) + 1);
    add({ id: "ap.uniqueInvoices", area: "ap", level: "error", title: ["No supplier invoice is entered twice", "لا فاتورة مورد مكررة"], items: [...dup.entries()].filter(([, n]) => n > 1).map(([key]) => key.replace("|", " · ")) });
  }

  // ------------------------------------------------------------ fixed assets
  if (sl.far.length) {
    add({ id: "far.accumWithinCost", area: "far", level: "error", title: ["Accumulated depreciation never exceeds cost", "مجمع الإهلاك لا يتجاوز التكلفة"], items: sl.far.filter((a) => a.accumulatedDepreciation - a.cost > tol).map((a) => `${a.tag} ${a.name}: ${fmt(a.accumulatedDepreciation)} > ${fmt(a.cost)}`) });
    add({ id: "far.usefulLife", area: "far", level: "warning", title: ["Every asset has a useful life", "كل أصل له عمر إنتاجي"], items: sl.far.filter((a) => !(a.usefulLifeYears > 0) && !/land|أرض|اراضي/i.test(a.category + a.name)).map((a) => `${a.tag} ${a.name}`) });
    add({ id: "far.acquiredByPeriodEnd", area: "period", level: "warning", title: ["No assets acquired after the period end", "لا أصول مشتراة بعد نهاية الفترة"], items: sl.far.filter((a) => a.acquisitionDate > end).map((a) => `${a.tag} ${a.acquisitionDate}`) });
    add({ id: "far.disposedWritten", area: "far", level: "info", title: ["Disposed assets carry no remaining value", "الأصول المستبعدة بلا قيمة متبقية"], items: sl.far.filter((a) => a.disposalDate && a.disposalDate <= end && a.cost - a.accumulatedDepreciation > tol).map((a) => `${a.tag}: NBV ${fmt(a.cost - a.accumulatedDepreciation)}`) });
  }

  // ------------------------------------------------------------ inventory
  if (sl.inventory.length) {
    add({ id: "inv.nonNegative", area: "inventory", level: "error", title: ["No negative stock quantities", "لا كميات مخزون سالبة"], items: sl.inventory.filter((i) => i.endingQty < 0).map((i) => `${i.sku}: ${i.endingQty}`) });
    add({ id: "inv.quantityRollForward", area: "inventory", level: "warning", title: ["Opening + receipts − issues = counted quantity", "أول المدة + الوارد − المنصرف = الجرد الفعلي"], items: sl.inventory.filter((i) => Math.abs(i.openingQty + i.receiptsQty - i.issuesQty - i.endingQty) > 0.001).map((i) => `${i.sku} ${i.description}: book ${i.openingQty + i.receiptsQty - i.issuesQty} vs count ${i.endingQty}`) });
  }

  // ------------------------------------------------------------ payroll
  if (sl.payroll.length && k.analysis && k.subledgers.payroll) {
    const p = k.subledgers.payroll;
    add({ id: "pay.grossArithmetic", area: "payroll", level: "warning", title: ["Basic + allowances + overtime = gross", "الأساسي + البدلات + الإضافي = الإجمالي"], items: p.grossMismatchRows.map((r) => `row ${r}`) });
    add({ id: "pay.netArithmetic", area: "payroll", level: "warning", title: ["Gross − deductions = net", "الإجمالي − الاستقطاعات = الصافي"], items: p.netMismatchRows.map((r) => `row ${r}`) });
    const dup = new Map<string, number>();
    for (const l of sl.payroll) dup.set(l.employeeId, (dup.get(l.employeeId) ?? 0) + 1);
    add({ id: "pay.uniqueEmployees", area: "payroll", level: "warning", title: ["Each employee appears once", "كل موظف يظهر مرة واحدة"], items: [...dup.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id} ×${n}`) });
    add({ id: "pay.positiveNet", area: "payroll", level: "error", title: ["No negative net pay", "لا صافي مرتب سالب"], items: sl.payroll.filter((l) => l.net < 0).map((l) => `${l.employeeId}: ${fmt(l.net)}`) });
  }

  // ------------------------------------------------------------ bank
  if (sl.bank.length) {
    const breaks: string[] = [];
    for (let i = 1; i < sl.bank.length; i++) {
      const a = sl.bank[i - 1];
      const b = sl.bank[i];
      if (a.balance !== null && b.balance !== null && Math.abs(a.balance + b.amount - b.balance) > tol) breaks.push(`${b.date} ${b.description}: ${fmt(a.balance)} + ${fmt(b.amount)} ≠ ${fmt(b.balance)}`);
    }
    add({ id: "bank.runningBalance", area: "bank", level: "error", title: ["Statement running balance is continuous", "رصيد الكشف متسلسل"], items: breaks });
    if (k.analysis && k.subledgers.bank) add({ id: "bank.reconciled", area: "bank", level: "error", title: ["Bank reconciliation agrees", "التسوية البنكية متطابقة"], ok: Math.abs(k.subledgers.bank.difference) <= tol, items: Math.abs(k.subledgers.bank.difference) > tol ? [`Unexplained difference ${fmt(k.subledgers.bank.difference)}`] : [], fix: "/ingest" });
    add({ id: "bank.inPeriod", area: "period", level: "warning", title: ["Statement lines fall inside the period", "سطور الكشف داخل الفترة"], items: sl.bank.filter((b) => b.date < start || b.date > end).map((b) => `${b.date} ${b.description}`) });
  }

  // ------------------------------------------------------------ ETA
  if (sl.eta.length && k.analysis && k.subledgers.eta) {
    const e = k.subledgers.eta;
    add({ id: "eta.vatRate", area: "eta", level: "warning", title: [`VAT is ${Math.round(STANDARD_VAT * 1000) / 10}% of net sales`, `ضريبة القيمة المضافة ${Math.round(STANDARD_VAT * 1000) / 10}٪`], items: e.vatRateExceptions.map((v) => `${v.id}: ${v.rate}%`) });
    add({ id: "eta.receiverTaxId", area: "eta", level: "warning", title: ["Business receivers have a 9-digit tax ID", "العملاء الشركات لهم رقم ضريبي من ٩ أرقام"], items: [...e.invalidReceiverTaxId] });
    add({ id: "eta.uniqueUuid", area: "eta", level: "error", title: ["No e-invoice appears twice", "لا فاتورة إلكترونية مكررة"], items: [...e.duplicates] });
    add({ id: "eta.inPeriod", area: "period", level: "warning", title: ["E-invoices fall inside the period", "الفواتير الإلكترونية داخل الفترة"], items: sl.eta.filter((d) => d.dateIssued && (d.dateIssued < start || d.dateIssued > end)).map((d) => `${d.internalId || d.uuid} ${d.dateIssued}`) });
  }

  // ------------------------------------------------------------ tie-outs and FX
  if (k.analysis) {
    for (const [key, t] of Object.entries(k.tieOuts)) {
      if (!t) continue;
      add({ id: `tie.${key}`, area: "tieout", level: key === "eta" ? "warning" : "error", title: [`Subledger ties to the trial balance: ${key}`, `الدفتر التحليلي يطابق الميزان: ${key}`], ok: Math.abs(t.difference) <= tol, items: Math.abs(t.difference) > tol ? [`Subledger ${fmt(t.subledger)} vs TB ${fmt(t.trialBalance)} (${fmt(t.difference)})`] : [], fix: "/ingest" });
    }
    add({ id: "fx.ratesEntered", area: "fx", level: "warning", title: ["Exchange rates entered for every foreign currency", "أسعار صرف لكل العملات الأجنبية"], items: [...k.fx.missing] });
  }
  return out;
}

export function summarise(checks: Check[]) {
  const failed = checks.filter((c) => !c.ok);
  return {
    total: checks.length,
    passed: checks.length - failed.length,
    errors: failed.filter((c) => c.level === "error").length,
    warnings: failed.filter((c) => c.level === "warning").length,
    info: failed.filter((c) => c.level === "info").length,
  };
}

export function toRun(checks: Check[], trigger: string, tolerance: number, id: string, at = new Date().toISOString()): ValidationRun {
  return { id, at, trigger, tolerance, results: Object.fromEntries(checks.map((c) => [c.id, { level: c.level, ok: c.ok, count: c.count }])) };
}

/** What changed since the previous run: new failures, resolved ones, and counts that moved. */
export function compareRuns(prev: ValidationRun | undefined, cur: ValidationRun) {
  if (!prev) return { newFailures: [], resolved: [], changed: [] };
  const ids = new Set([...Object.keys(prev.results), ...Object.keys(cur.results)]);
  const newFailures: string[] = [];
  const resolved: string[] = [];
  const changed: Array<{ id: string; from: number; to: number }> = [];
  for (const id of ids) {
    const a = prev.results[id];
    const b = cur.results[id];
    if (b && !b.ok && (!a || a.ok)) newFailures.push(id);
    else if (a && !a.ok && (!b || b.ok)) resolved.push(id);
    else if (a && b && !a.ok && !b.ok && a.count !== b.count) changed.push({ id, from: a.count, to: b.count });
  }
  return { newFailures, resolved, changed };
}
