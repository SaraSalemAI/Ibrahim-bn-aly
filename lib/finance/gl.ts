import { round2 } from "./engine";
import { readTable, type FieldSpec } from "./table";
import type { TBRow } from "./types";

export interface GlLine {
  postingDate: string;
  journalId: string;
  voucher: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  costCenter: string;
  counterparty: string;
  memo: string;
  sourceRow: number;
}

const f = (aliases: string[], type: FieldSpec["type"], required = false): FieldSpec => ({ aliases, type, required });

export const GL_SPEC = {
  postingDate: f(["posting_date", "date", "التاريخ"], "date", true),
  journalId: f(["journal_id", "je_id", "entry", "رقم القيد"], "string", true),
  voucher: f(["voucher", "source_voucher", "المستند"], "string"),
  accountCode: f(["account_code", "account", "code", "رقم الحساب"], "string", true),
  accountName: f(["account_name", "name", "اسم الحساب"], "string"),
  debit: f(["debit", "dr", "مدين"], "number", true),
  credit: f(["credit", "cr", "دائن"], "number", true),
  costCenter: f(["cost_center", "مركز التكلفة"], "string"),
  counterparty: f(["counterparty", "partner", "الطرف"], "string"),
  memo: f(["memo", "narration", "description", "البيان"], "string"),
} satisfies Record<keyof Omit<GlLine, "sourceRow">, FieldSpec>;

export const parseGl = (text: string) => readTable<GlLine>(text, GL_SPEC as never);

/** Splits a large CSV into header + chunks of `size` rows so the UI can parse it incrementally. */
export function* csvChunks(text: string, size = 5000): Generator<string> {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const header = lines[0];
  for (let i = 1; i < lines.length; i += size) {
    const chunk = lines.slice(i, i + size).filter((l) => l.trim() !== "");
    if (chunk.length) yield [header, ...chunk].join("\n");
  }
}

export function unbalancedJournals(lines: GlLine[]): { journalId: string; difference: number }[] {
  const by = new Map<string, number>();
  for (const l of lines) by.set(l.journalId, (by.get(l.journalId) ?? 0) + l.debit - l.credit);
  return [...by.entries()].filter(([, d]) => Math.abs(d) > 0.005).map(([journalId, d]) => ({ journalId, difference: round2(d) }));
}

/**
 * Compares GL period activity with the trial balance movement (current closing − prior closing) per account.
 * Accounts that exist only in the GL are reported too.
 */
export function glVsTb(lines: GlLine[], rows: TBRow[]) {
  const activity = new Map<string, { debit: number; credit: number; name: string }>();
  for (const l of lines) {
    const a = activity.get(l.accountCode) ?? { debit: 0, credit: 0, name: l.accountName };
    a.debit += l.debit;
    a.credit += l.credit;
    activity.set(l.accountCode, a);
  }
  const out = rows.map((r) => {
    const tbMovement = round2(r.currentDebit - r.currentCredit - (r.priorDebit - r.priorCredit));
    const a = activity.get(r.code);
    const glMovement = a ? round2(a.debit - a.credit) : 0;
    return { code: r.code, name: r.name, tbMovement, glMovement, difference: round2(tbMovement - glMovement) };
  });
  const tbCodes = new Set(rows.map((r) => r.code));
  const glOnly = [...activity.entries()]
    .filter(([code]) => !tbCodes.has(code))
    .map(([code, a]) => ({ code, name: a.name, glMovement: round2(a.debit - a.credit) }));
  return { accounts: out, glOnly, exceptions: out.filter((o) => Math.abs(o.difference) > 0.005).length };
}

/** Book cash movements (Dr = receipt +, Cr = payment −) for bank reconciliation. */
export function cashMovements(lines: GlLine[], cashCodes: Set<string>) {
  return lines
    .filter((l) => cashCodes.has(l.accountCode))
    .map((l) => ({ date: l.postingDate, amount: round2(l.debit - l.credit), ref: l.journalId }));
}
