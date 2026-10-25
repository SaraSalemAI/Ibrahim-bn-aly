import { round2 } from "../finance/engine";

/** Bank lines in the shape the bank-statement CSV importer reads: date, description, signed amount, running balance. */
export interface RawBankLine {
  date: string;
  description: string;
  amount: number;
  balance: number | null;
}

export const isMt940 = (text: string) => /(^|\n):20:/.test(text) && /(^|\n):61:/.test(text);
export const isOfx = (text: string) => /OFXHEADER|<OFX>/i.test(text.slice(0, 2000));

const mtAmount = (s: string) => Number(s.replace(",", "."));

function yymmdd(s: string): string {
  const yy = Number(s.slice(0, 2));
  return `${yy < 70 ? 2000 + yy : 1900 + yy}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
}

/**
 * SWIFT MT940 statement. :60F:/:60M: opening, :61: statement lines with a following :86: narrative,
 * :62F:/:62M: closing. Running balances are rebuilt from the opening balance.
 */
export function parseMt940(text: string): { lines: RawBankLine[]; opening: number | null; closing: number | null; currency: string | null } {
  const fields: Array<{ tag: string; value: string }> = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const m = raw.match(/^:(\d{2}[A-Z]?):(.*)$/);
    if (m) fields.push({ tag: m[1], value: m[2] });
    else if (fields.length && raw.trim() && !/^-}?$/.test(raw.trim())) fields[fields.length - 1].value += " " + raw.trim();
  }
  let opening: number | null = null;
  let closing: number | null = null;
  let currency: string | null = null;
  const lines: RawBankLine[] = [];
  const bal = (v: string) => {
    const m = v.match(/^([CD])(\d{6})([A-Z]{3})([\d,]+)/);
    if (!m) return null;
    currency = m[3];
    return (m[1] === "D" ? -1 : 1) * mtAmount(m[4]);
  };
  for (const f of fields) {
    if (f.tag.startsWith("60")) opening = opening ?? bal(f.value);
    else if (f.tag.startsWith("62")) closing = bal(f.value);
    else if (f.tag === "61") {
      // YYMMDD [MMDD] (R)C|D [funds code] amount N... reference
      const m = f.value.match(/^(\d{6})(\d{4})?(RC|RD|C|D)[A-Z]?([\d,]+)N?([A-Z0-9]{3})?(.*)$/);
      if (!m) continue;
      const sign = m[3] === "C" || m[3] === "RD" ? 1 : -1;
      lines.push({ date: yymmdd(m[1]), description: (m[6] ?? "").replace(/^\/\//, "").trim(), amount: round2(sign * mtAmount(m[4])), balance: null });
    } else if (f.tag === "86" && lines.length) {
      lines[lines.length - 1].description = f.value.replace(/\?\d{2}/g, " ").replace(/\s+/g, " ").trim() || lines[lines.length - 1].description;
    }
  }
  if (opening !== null) {
    let run = opening;
    for (const l of lines) {
      run = round2(run + l.amount);
      l.balance = run;
    }
  } else if (closing !== null && lines.length) lines[lines.length - 1].balance = closing;
  return { lines, opening, closing, currency };
}

/** OFX / QFX statement (SGML 1.x or XML 2.x): one <STMTTRN> per line, <LEDGERBAL> for the closing balance. */
export function parseOfx(text: string): { lines: RawBankLine[]; closing: number | null; currency: string | null } {
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>\\s*([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  const date = (s: string) => (/^\d{8}/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : "");
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)].map((m) => m[1]);
  const lines = blocks
    .map((b) => ({
      date: date(tag(b, "DTPOSTED")),
      description: [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" — ") || tag(b, "TRNTYPE"),
      amount: round2(Number(tag(b, "TRNAMT")) || 0),
      balance: null as number | null,
    }))
    .filter((l) => l.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const ledger = text.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|$)/i)?.[1] ?? "";
  const closingRaw = tag(ledger, "BALAMT");
  const closing = closingRaw ? Number(closingRaw) : null;
  if (closing !== null && lines.length) {
    let run = closing;
    for (let i = lines.length - 1; i >= 0; i--) {
      lines[i].balance = round2(run);
      run -= lines[i].amount;
    }
  }
  return { lines, closing, currency: tag(text, "CURDEF") || null };
}

export function bankLinesToCsv(lines: RawBankLine[]): string {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["date,description,amount,balance", ...lines.map((l) => [l.date, cell(l.description), l.amount, l.balance ?? ""].join(","))].join("\n") + "\n";
}
