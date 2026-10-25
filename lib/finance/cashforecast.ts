import { round2 } from "./engine";
import type { ApInvoice, ArInvoice, PayrollLine } from "./subledgers";

/**
 * 13-week direct cash forecast from what is actually open at the period end: customer invoices by
 * due date (plus the analyst's collection lag), supplier invoices by due date, payroll and its
 * deductions, and recurring or one-off items the analyst adds. Overdue balances are spread over
 * the first weeks at the expected collection / payment rate. Nothing is guessed: weeks only hold
 * the items listed.
 */
export interface ForecastInputs {
  startDate: string;
  openingCash: number;
  weeks: number;
  overdueCollectionRate: number;
  overdueWeeks: number;
  collectionLagDays: number;
  overduePayableWeeks: number;
  includePayroll: boolean;
  minimumCash: number | null;
  items: Array<{ id: string; name: string; amount: number; every: "once" | "week" | "month"; week: number }>;
  ar: ArInvoice[];
  ap: ApInvoice[];
  payroll: PayrollLine[];
  payrollPeriodsPerYear: number;
}

export interface ForecastWeek {
  week: number;
  start: string;
  end: string;
  opening: number;
  collections: number;
  overdueCollections: number;
  supplierPayments: number;
  payroll: number;
  payrollTaxes: number;
  other: number;
  net: number;
  closing: number;
  belowMinimum: boolean;
}

const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
const isPaid = (s: string) => /^(paid|مدفوع|مسدد)/i.test(s.trim());

export function cashForecast(x: ForecastInputs) {
  const weeks = Math.max(1, Math.min(52, Math.round(x.weeks)));
  const rows: ForecastWeek[] = Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    start: addDays(x.startDate, i * 7),
    end: addDays(x.startDate, i * 7 + 6),
    opening: 0,
    collections: 0,
    overdueCollections: 0,
    supplierPayments: 0,
    payroll: 0,
    payrollTaxes: 0,
    other: 0,
    net: 0,
    closing: 0,
    belowMinimum: false,
  }));
  const weekOf = (date: string) => rows.findIndex((w) => date >= w.start && date <= w.end);
  const horizonEnd = rows[rows.length - 1].end;
  const spread = (total: number, n: number, set: (w: ForecastWeek, v: number) => void) => {
    const k = Math.max(1, Math.min(n, weeks));
    for (let i = 0; i < k; i++) set(rows[i], total / k);
  };

  // Receivables.
  let overdueAr = 0;
  let beyondAr = 0;
  for (const inv of x.ar) {
    if (inv.outstanding <= 0) continue;
    const expected = addDays(inv.dueDate, x.collectionLagDays);
    if (expected < x.startDate) overdueAr += inv.outstanding;
    else if (expected > horizonEnd) beyondAr += inv.outstanding;
    else rows[weekOf(expected)].collections += inv.outstanding;
  }
  spread(overdueAr * x.overdueCollectionRate, x.overdueWeeks, (w, v) => (w.overdueCollections += v));

  // Payables.
  let overdueAp = 0;
  let beyondAp = 0;
  for (const inv of x.ap) {
    if (isPaid(inv.status) || inv.netPayable <= 0) continue;
    if (inv.dueDate < x.startDate) overdueAp += inv.netPayable;
    else if (inv.dueDate > horizonEnd) beyondAp += inv.netPayable;
    else rows[weekOf(inv.dueDate)].supplierPayments -= inv.netPayable;
  }
  spread(overdueAp, x.overduePayableWeeks, (w, v) => (w.supplierPayments -= v));

  // Payroll: the register is one pay period; net pay goes out at each month end, social insurance and
  // salary tax by the 15th of the following month.
  if (x.includePayroll && x.payroll.length) {
    const toMonth = Math.max(1, x.payrollPeriodsPerYear) / 12;
    const net = x.payroll.reduce((a, l) => a + l.net, 0) * toMonth;
    const taxes = x.payroll.reduce((a, l) => a + l.employeeSocialInsurance + l.companySocialInsurance + l.incomeTax, 0) * toMonth;
    for (const w of rows) {
      const monthEnd = new Date(Date.UTC(Number(w.end.slice(0, 4)), Number(w.end.slice(5, 7)), 0)).toISOString().slice(0, 10);
      if (monthEnd >= w.start && monthEnd <= w.end) w.payroll -= net;
      const fifteenth = `${w.start.slice(0, 7)}-15`;
      const fifteenth2 = `${w.end.slice(0, 7)}-15`;
      if ((fifteenth >= w.start && fifteenth <= w.end) || (fifteenth2 !== fifteenth && fifteenth2 >= w.start && fifteenth2 <= w.end)) w.payrollTaxes -= taxes;
    }
  }

  // Analyst items: + receipts, − payments.
  for (const it of x.items) {
    const first = Math.max(1, Math.round(it.week)) - 1;
    if (it.every === "once") {
      if (rows[first]) rows[first].other += it.amount;
    } else if (it.every === "week") {
      for (let i = first; i < weeks; i++) rows[i].other += it.amount;
    } else {
      // Monthly: the starting week, then every 52/12 weeks.
      for (let n = 0; ; n++) {
        const i = first + Math.round((n * 52) / 12);
        if (i >= weeks) break;
        rows[i].other += it.amount;
      }
    }
  }

  let cash = x.openingCash;
  for (const w of rows) {
    w.opening = round2(cash);
    w.collections = round2(w.collections);
    w.overdueCollections = round2(w.overdueCollections);
    w.supplierPayments = round2(w.supplierPayments);
    w.payroll = round2(w.payroll);
    w.payrollTaxes = round2(w.payrollTaxes);
    w.other = round2(w.other);
    w.net = round2(w.collections + w.overdueCollections + w.supplierPayments + w.payroll + w.payrollTaxes + w.other);
    cash += w.net;
    w.closing = round2(cash);
    w.belowMinimum = x.minimumCash !== null && w.closing < x.minimumCash;
  }
  const lowest = rows.reduce((a, w) => (w.closing < a.closing ? w : a), rows[0]);
  return {
    weeks: rows,
    totals: {
      inflows: round2(rows.reduce((a, w) => a + w.collections + w.overdueCollections + Math.max(0, w.other), 0)),
      outflows: round2(rows.reduce((a, w) => a + w.supplierPayments + w.payroll + w.payrollTaxes + Math.min(0, w.other), 0)),
      closing: rows[rows.length - 1].closing,
    },
    lowest: { week: lowest.week, start: lowest.start, closing: lowest.closing },
    weeksBelowMinimum: rows.filter((w) => w.belowMinimum).map((w) => w.week),
    beyondHorizon: { receivables: round2(beyondAr), payables: round2(beyondAp) },
    overdue: { receivables: round2(overdueAr), expectedCollected: round2(overdueAr * x.overdueCollectionRate), payables: round2(overdueAp) },
  };
}
