import { canAdvance, computeCompany } from "../workspace/compute";
import type { Company, ImportRun } from "../workspace/types";
import type { BatchItem } from "./checks";
import type { Unit } from "./stage";
import { applyStaged } from "./stage";
import { summarise, toRun, validateCompany } from "./validate";

/**
 * The automatic pipeline behind "upload and it's done": recognised files are imported, mappings
 * the classifier is sure of are accepted, every validation runs and the period advances when every
 * gate passes. Anything uncertain is held for the analyst. Locking is never automatic.
 */

/** A file's identity across months: its name without dates, numbers or extension ("TB 2025-03.csv" → "tb"). */
export function fileKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[٠-٩0-9]+/g, " ")
    .replace(/\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?|fy|q)\b/g, " ")
    .replace(/(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)/g, " ")
    .replace(/[\s_\-.()›·]+/g, " ")
    .trim();
}

export function remembered(c: Company, u: Unit) {
  return c.fileMemory[fileKey(u.sheet ? `${u.fileName} ${u.sheet}` : u.fileName)] ?? null;
}

/** Whether a staged file can be imported without asking: recognised confidently (or remembered), readable, and not a scan. */
export function autoEligible(c: Company, u: Unit, staged: BatchItem["staged"] | null): { ok: boolean; reason: string } {
  if (!staged) return { ok: false, reason: "not read yet" };
  if (staged.issues.some((i) => i.level === "error")) return { ok: false, reason: "has rows that cannot be read" };
  const mem = remembered(c, u);
  if (mem && mem.category === staged.category) return { ok: true, reason: "remembered from an earlier upload" };
  if (u.detection.category !== staged.category) return { ok: true, reason: "type chosen by you" };
  if (u.detection.confidence < c.automation.minConfidence) return { ok: false, reason: `recognition confidence ${u.detection.confidence}% is below ${c.automation.minConfidence}%` };
  return { ok: true, reason: "recognised" };
}

/** Accepts suggested mappings at or above the threshold. Lower ones stay as suggestions for review. */
export function autoMap(c: Company, threshold: number) {
  let accepted = 0;
  const rows = c.rows.map((r) => {
    if (r.suggested && r.category && (r.confidence ?? 0) >= threshold) {
      accepted++;
      return { ...r, suggested: false, mappingRule: `${r.mappingRule ?? "keyword"} · auto-accepted ≥${threshold}%` };
    }
    return r;
  });
  const pending = rows.filter((r) => r.suggested || !r.category).length;
  return { company: accepted ? { ...c, rows } : c, accepted, pending };
}

/** Moves a draft period forward as far as its gates allow (never to LOCKED). */
export function autoAdvance(c: Company): Company {
  if (c.period.status === "LOCKED" || !c.rows.length) return c;
  let next = c;
  if (!c.rows.some((r) => r.suggested || !r.category) && !c.period.mappingConfirmed) next = { ...next, period: { ...next.period, mappingConfirmed: true } };
  const k = computeCompany(next);
  if (!k.analysis) return next;
  let status = next.period.status as "DRAFT" | "MAPPED" | "RECONCILED";
  if (canAdvance(k.checks, "MAPPED")) status = "MAPPED";
  if (canAdvance(k.checks, "RECONCILED")) status = "RECONCILED";
  return status === next.period.status ? next : { ...next, period: { ...next.period, status } };
}

export interface PipelineResult {
  company: Company;
  run: ImportRun;
}

/**
 * Imports the eligible items in one step and records the run. `held` lists the files left for review
 * with the reason. Returns the company with the import, auto-mapping, period status and a new
 * validation run applied.
 */
export function runPipeline(c: Company, items: Array<BatchItem & { unit: Unit }>, held: Array<{ name: string; reason: string }>, opts: { by: string; ids: string[]; runId: string; at?: string }): PipelineResult {
  const at = opts.at ?? new Date().toISOString();
  let next = items.reduce((acc, it, i) => applyStaged(acc, it.staged, opts.ids[i], it.role, it.month), c);
  // Remember what each file turned out to be, for next month's upload.
  const memory = { ...next.fileMemory };
  for (const it of items) memory[fileKey(it.unit.sheet ? `${it.unit.fileName} ${it.unit.sheet}` : it.unit.fileName)] = { category: it.staged.category, ...(it.staged.category === "TRIAL_BALANCE" ? { role: it.role } : {}) };
  next = { ...next, fileMemory: memory };

  const threshold = next.automation.autoMapThreshold;
  const mapped = threshold <= 100 ? autoMap(next, threshold) : { company: next, accepted: 0, pending: next.rows.filter((r) => r.suggested || !r.category).length };
  next = mapped.company;
  if (next.automation.autoAdvance) next = autoAdvance(next);

  const k = computeCompany(next);
  const checks = validateCompany(next, k);
  const vrun = toRun(checks, "import", next.tolerance, `${opts.runId}-v`, at);
  const run: ImportRun = {
    id: opts.runId,
    at,
    by: opts.by,
    files: items.map((it) => ({ name: it.unit.sheet ? `${it.unit.fileName} › ${it.unit.sheet}` : it.unit.fileName, category: it.staged.category, role: it.staged.category === "TRIAL_BALANCE" ? it.role : undefined, rows: it.staged.rowCount, erp: it.staged.erp, via: it.unit.encoding, confidence: it.unit.detection.confidence })),
    held,
    autoMapped: mapped.accepted,
    aiSuggested: 0,
    stillToMap: mapped.pending,
    statusAfter: next.period.status,
  };
  return { company: { ...next, importRuns: [...next.importRuns, run].slice(-20), validationRuns: [...next.validationRuns, vrun].slice(-30) }, run };
}

export { summarise };
