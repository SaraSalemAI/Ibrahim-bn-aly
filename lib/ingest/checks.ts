import type { DocCategory } from "../finance/types";
import { computeCompany } from "../workspace/compute";
import type { Company } from "../workspace/types";
import { applyStaged, type Staged, type TbRole } from "./stage";

export interface BatchItem {
  id: string;
  staged: Staged;
  role: TbRole;
  month: { label: string; end: string } | null;
}

export type Bilingual = [string, string];

export interface Finding {
  level: "error" | "warning" | "info";
  code: string;
  text: Bilingual;
  items?: string[];
}

export const ALL_CATEGORIES: DocCategory[] = ["TRIAL_BALANCE", "GENERAL_LEDGER", "AR_SUBLEDGER", "AP_SUBLEDGER", "FIXED_ASSETS", "INVENTORY", "PAYROLL", "BANK_STATEMENT", "ETA_INVOICE"];

/** What each file type unlocks, for the missing-files checklist. */
export const UNLOCKS: Record<DocCategory, Bilingual> = {
  TRIAL_BALANCE: ["Statements, ratios, model, tax, valuation: every module", "القوائم والنسب والنموذج والضريبة والتقييم: كل الوحدات"],
  GENERAL_LEDGER: ["GL-vs-TB check, bank matching to book entries, journal anomaly scan, ask-your-data search", "مطابقة الأستاذ بالميزان، ومطابقة البنك بالقيود، وفحص القيود غير المعتادة، والبحث في البيانات"],
  AR_SUBLEDGER: ["AR aging, expected credit loss, receivables tie-out", "أعمار الديون والخسائر الائتمانية المتوقعة ومطابقة العملاء"],
  AP_SUBLEDGER: ["Supplier aging, Form 41 withholding tax, payables tie-out", "أعمار الموردين ونموذج ٤١ ومطابقة الموردين"],
  FIXED_ASSETS: ["Tax depreciation pools, PP&E roll-forward and tie-out", "الإهلاك الضريبي وحركة الأصول الثابتة ومطابقتها"],
  INVENTORY: ["Inventory valuation, NRV write-down, inventory tie-out", "تقييم المخزون والانخفاض لصافي القيمة البيعية ومطابقته"],
  PAYROLL: ["Payroll cost, social insurance, employee profit share", "تكلفة الرواتب والتأمينات وحصة العاملين في الأرباح"],
  BANK_STATEMENT: ["Bank reconciliation", "التسوية البنكية"],
  ETA_INVOICE: ["E-invoices vs revenue and VAT check", "مطابقة الفواتير الإلكترونية بالإيرادات وضريبة القيمة المضافة"],
};

function datesOf(s: Staged): string[] {
  const d = s.data;
  if (d.kind === "gl") return d.lines.map((l) => l.postingDate);
  if (d.kind === "eta") return d.docs.map((x) => x.dateIssued);
  if (d.kind === "sub") {
    const f = { ar: "invoiceDate", ap: "invoiceDate", bank: "date" }[d.key as string];
    return f ? d.records.map((r) => (r as unknown as Record<string, string>)[f]) : [];
  }
  return [];
}

const label = (s: Staged) => (s.sheet ? `${s.fileName} › ${s.sheet}` : s.fileName);

/** Pre-import checks across the whole batch: duplicates, period coverage, currencies, missing files and the combined tie-out. */
export function batchChecks(company: Company, items: BatchItem[]) {
  const findings: Finding[] = [];
  const { start, end } = company.period;

  // Duplicate files: the same content twice in the batch, or already loaded.
  const bySha = new Map<string, string[]>();
  for (const it of items) bySha.set(it.staged.sha256, [...(bySha.get(it.staged.sha256) ?? []), label(it.staged)]);
  for (const names of bySha.values()) if (names.length > 1) findings.push({ level: "warning", code: "duplicateFile", text: ["The same file appears more than once in this batch", "نفس الملف مكرر في هذه الدفعة"], items: names });
  const loaded = new Map(company.docs.map((d) => [d.sha256, d.fileName]));
  for (const it of items) if (loaded.has(it.staged.sha256)) findings.push({ level: "info", code: "alreadyLoaded", text: ["Already loaded earlier (identical content)", "تم تحميله سابقًا (نفس المحتوى)"], items: [label(it.staged)] });

  // Two files competing for the same slot.
  const slots = new Map<string, string[]>();
  for (const it of items) {
    const key = it.staged.category === "TRIAL_BALANCE" ? `${it.staged.category}:${it.role}:${it.role === "monthly" ? it.month?.label : ""}` : it.staged.category;
    slots.set(key, [...(slots.get(key) ?? []), label(it.staged)]);
  }
  for (const [k, names] of slots) if (names.length > 1) findings.push({ level: "warning", code: "sameSlot", text: [`Several files for ${k.split(":")[0].replace(/_/g, " ").toLowerCase()}: the last one replaces the others`, `أكثر من ملف لنفس النوع: آخر ملف يحل محل الباقي`], items: names });

  // Duplicate rows inside a file.
  for (const it of items) {
    const n = it.staged.duplicateKeys.length;
    if (n) findings.push({ level: "warning", code: "duplicateRows", text: [`${n} repeated ${it.staged.category === "BANK_STATEMENT" ? "statement lines" : "records"} in ${label(it.staged)}`, `${n} سجل مكرر في ${label(it.staged)}`], items: it.staged.duplicateKeys.slice(0, 8) });
  }

  // Period coverage.
  const dated = items.filter((it) => ["GENERAL_LEDGER", "BANK_STATEMENT", "ETA_INVOICE"].includes(it.staged.category));
  for (const it of dated) {
    const outside = datesOf(it.staged).filter((d) => d && (d < start || d > end)).length;
    if (outside) findings.push({ level: "warning", code: "outsidePeriod", text: [`${outside} entries in ${label(it.staged)} fall outside the period ${start} to ${end}`, `${outside} سجل في ${label(it.staged)} خارج الفترة من ${start} إلى ${end}`] });
  }
  for (const it of items.filter((x) => ["AR_SUBLEDGER", "AP_SUBLEDGER"].includes(x.staged.category))) {
    const after = datesOf(it.staged).filter((d) => d && d > end).length;
    if (after) findings.push({ level: "warning", code: "afterPeriod", text: [`${after} invoices in ${label(it.staged)} are dated after the period end ${end}`, `${after} فاتورة في ${label(it.staged)} بتاريخ بعد نهاية الفترة ${end}`] });
  }
  const ranges = dated.map((it) => ({ name: label(it.staged), r: it.staged.dateRange })).filter((x): x is { name: string; r: { from: string; to: string } } => !!x.r);
  for (let i = 0; i < ranges.length; i++)
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i].r;
      const b = ranges[j].r;
      if (a.to < b.from || b.to < a.from) findings.push({ level: "warning", code: "noOverlap", text: ["These files cover different periods", "هذه الملفات تغطي فترات مختلفة"], items: [`${ranges[i].name}: ${a.from} → ${a.to}`, `${ranges[j].name}: ${b.from} → ${b.to}`] });
    }

  // A period the files agree on, when it differs from the company's.
  let suggestedPeriod: { start: string; end: string; currentLabel: string; priorLabel: string } | null = null;
  const years = ranges.flatMap((x) => [x.r.from.slice(0, 4), x.r.to.slice(0, 4)]);
  if (years.length && years.every((y) => y === years[0])) {
    const y = Number(years[0]);
    const fyJune = company.settings.fiscalYearEnd === "06-30";
    const s = fyJune ? `${y - 1}-07-01` : `${y}-01-01`;
    const e = fyJune ? `${y}-06-30` : `${y}-12-31`;
    if (s !== start || e !== end) suggestedPeriod = { start: s, end: e, currentLabel: `FY${y}`, priorLabel: `FY${y - 1}` };
  }

  // Currencies other than the functional currency.
  const fn = company.settings.functionalCurrency;
  const currencies = [...new Set([...items.flatMap((it) => it.staged.currencies), ...company.rows.map((r) => r.currency).filter((x): x is string => !!x)])].filter((c) => c && c !== fn);
  const missingFx = currencies.filter((c) => !company.fxRates[c]);
  if (missingFx.length) findings.push({ level: "warning", code: "fxMissing", text: [`Balances in ${missingFx.join(", ")}: enter exchange rates to ${fn}`, `أرصدة بعملات ${missingFx.join("، ")}: أدخل أسعار الصرف مقابل ${fn}`] });

  // Parsing errors.
  for (const it of items) {
    const errs = it.staged.issues.filter((i) => i.level === "error").length;
    if (errs) findings.push({ level: "error", code: "parseErrors", text: [`${label(it.staged)} has ${errs} rows that cannot be read`, `${label(it.staged)} به ${errs} سطر لا يمكن قراءته`] });
  }

  // Simulated import: what the combined tie-out will look like.
  const ready = items.filter((it) => !it.staged.issues.some((i) => i.level === "error"));
  const preview = ready.reduce((c, it, i) => applyStaged(c, it.staged, `preview_${i}`, it.role, it.month), company);
  const k = computeCompany(preview);
  const tieOuts = k.analysis ? k.tieOuts : null;
  const missing = ALL_CATEGORIES.filter((cat) => !preview.docs.some((d) => d.category === cat));
  return { findings, suggestedPeriod, currencies, missing, tieOuts, previewCompany: preview, previewComputed: k };
}
