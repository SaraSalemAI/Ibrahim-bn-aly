// Console builder — build consoles from uploaded files and from a text prompt.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { parseSpec, type ConsoleSpec, type Row } from "./spec";

export type { Row };

/** Parses CSV or TSV (quoted fields, escaped quotes, CRLF). The first row is the header. */
export function parseDelimited(text: string, delimiter?: string): Row[] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const d = delimiter ?? ([",", "\t", ";", "|"].map((c) => [c, firstLine.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0]);
  const records: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"' && cur === "") q = true;
    else if (ch === d) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c !== "")) records.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== "")) records.push(row);
  if (!records.length) return [];
  const seen = new Map<string, number>();
  const header = records[0].map((h, i) => {
    const base = h.trim() || `column${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}_${n + 1}` : base;
  });
  return records.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, coerce(r[i] ?? "")])));
}

function coerce(v: string): string | number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(/,/g, ""));
  return /^-?[\d,]*\.?\d+(e[+-]?\d+)?$/i.test(t) && Number.isFinite(n) ? n : t;
}

/** A dataset name made from a file name: "Q3 Sales (final).csv" → "q3_sales_final". */
export function datasetName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(base) ? base : `data_${base || "1"}`;
}

const flat = (v: unknown): string | number | null => (v === null || v === undefined ? null : typeof v === "number" ? v : typeof v === "object" ? JSON.stringify(v) : String(v));

export type LoadedFile = { kind: "spec"; name: string; spec: ConsoleSpec } | { kind: "data"; name: string; dataset: string; rows: Row[] };

/** Turns one uploaded file into either a console spec or a dataset. */
export function loadFile(fileName: string, text: string): LoadedFile {
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? "";
  if (ext === "json" || /^\s*[[{]/.test(text)) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`${fileName} is not valid JSON: ${(e as Error).message}`);
    }
    if (parseSpec(json).ok) return { kind: "spec", name: fileName, spec: json as ConsoleSpec };
    const arr = Array.isArray(json) ? json : Object.values(json as object).find(Array.isArray);
    if (!arr) throw new Error(`${fileName} is JSON but has no list of records to load.`);
    const rows = arr.map((r) => (r && typeof r === "object" && !Array.isArray(r) ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, flat(v)])) : { value: flat(r) }));
    return { kind: "data", name: fileName, dataset: datasetName(fileName), rows };
  }
  if (["csv", "tsv", "tab"].includes(ext)) return { kind: "data", name: fileName, dataset: datasetName(fileName), rows: parseDelimited(text, ext === "csv" ? undefined : "\t") };
  // Any other text: one row per non-empty line, searchable.
  const rows = text
    .split(/\r?\n/)
    .map((line, i) => ({ line: i + 1, text: line.trimEnd() }))
    .filter((r) => r.text.trim() !== "");
  return { kind: "data", name: fileName, dataset: datasetName(fileName), rows };
}

const columnsOf = (rows: Row[]) => [...new Set(rows.slice(0, 200).flatMap((r) => Object.keys(r)))];
const numericCols = (rows: Row[]) => columnsOf(rows).filter((c) => rows.slice(0, 200).every((r) => r[c] === null || typeof r[c] === "number") && rows.some((r) => typeof r[c] === "number"));

/** Builds a ready-to-use data console from datasets: browse, search, filter, sort, stats. No AI needed. */
export function specFromDatasets(datasets: Record<string, Row[]>, name = "data"): ConsoleSpec {
  const names = Object.keys(datasets);
  const commands: ConsoleSpec["commands"] = [];
  for (const ds of names) {
    const rows = datasets[ds];
    const cols = columnsOf(rows);
    const nums = numericCols(rows);
    const prefix = names.length > 1 ? `${ds} ` : "";
    const first = nums[0] ?? cols[0] ?? "column";
    commands.push(
      { name: `${prefix}rows`, summary: `Show rows of ${ds} (${rows.length} rows)`, args: [{ name: "limit", alias: "n", type: "number", default: 20, description: "How many rows" }], action: { type: "query", dataset: ds, limit: "{limit}" } },
      {
        name: `${prefix}find`,
        summary: `Search ${ds} for text in any column`,
        args: [{ name: "text", type: "string", positional: true, required: true, rest: true }],
        examples: [`${prefix}find ${String(rows.find((r) => typeof r[cols[0]] === "string")?.[cols[0]] ?? "text").split(" ")[0]}`],
        action: { type: "query", dataset: ds, search: "{text}", limit: 50 },
      },
      {
        name: `${prefix}where`,
        summary: `Filter ${ds}: column=value, column>10, column~text (join with "and")`,
        args: [{ name: "filter", type: "string", positional: true, required: true, rest: true }],
        examples: nums.length ? [`${prefix}where ${nums[0]}>0`] : [],
        action: { type: "query", dataset: ds, where: "{filter}", limit: 50 },
      },
      {
        name: `${prefix}top`,
        summary: `Rows of ${ds} sorted by a column, largest first (--no-desc for smallest)`,
        args: [
          { name: "column", type: "enum", choices: cols, positional: true, required: true },
          { name: "limit", alias: "n", type: "number", default: 10 },
          { name: "desc", type: "boolean", default: true, description: "Largest first" },
        ],
        examples: [`${prefix}top ${first}`],
        action: { type: "query", dataset: ds, sortBy: "{column}", desc: "{desc}", limit: "{limit}" },
      },
      { name: `${prefix}stats`, summary: `Count, sum, average, min and max of a column in ${ds}`, args: [{ name: "column", type: "enum", choices: cols, positional: true, required: true }], examples: [`${prefix}stats ${first}`], action: { type: "stats", dataset: ds, column: "{column}" } },
      { name: `${prefix}columns`, summary: `Columns of ${ds} with their type`, action: { type: "columns", dataset: ds } },
    );
  }
  return {
    name,
    welcome: `${names.map((n) => `${n}: ${datasets[n].length} rows`).join(" · ")}. Try ${names.length > 1 ? names[0] + " " : ""}rows, find, where, top, stats or columns.`,
    datasets,
    commands,
  };
}

/** Text that teaches Claude the spec format. Kept compact: it is sent with every prompt build. */
export const SPEC_GUIDE = `A console spec is JSON:
{
  "name": "short-kebab-name",
  "welcome": "one line shown on start",
  "prompt": "❯",
  "theme": {"background": "#0e1513", "foreground": "#d5e2dc", "accent": "#6fd6b4"},
  "vars": {"name": "string value"},
  "groups": [{"name": "word", "summary": "text"}],
  "commands": [{
    "name": "one or more words, e.g. 'loan' or 'env use'",
    "summary": "what it does",
    "aliases": ["short"],
    "args": [{"name": "x", "type": "string|number|boolean|enum", "positional": true, "required": true, "rest": false, "alias": "x", "choices": ["only for enum"], "default": 1, "description": "text"}],
    "examples": ["loan 500000 0.18 5"],
    "action": {...} or "actions": [{...}, ...]
  }]
}
Templating in action strings: {argName} for arguments, {$varName} for variables.
Actions:
- {"type":"print","text":"Hello {name}","tone":"ok|info|warn|error|muted"}
- {"type":"table","columns":["A","B"],"rows":[["x",1]]}
- {"type":"kv","pairs":[["Label","value or {arg}"]]}
- {"type":"calc","expression":"principal * rate / 12","label":"Payment","decimals":2,"saveAs":"var"}  (arithmetic only: + - * / % ^ ( ), round sqrt min max pow log ln exp abs floor ceil, pi, e; argument and variable names usable directly)
- {"type":"set","name":"var","value":"{arg}"}
- {"type":"http","url":"https://...{arg}","method":"GET","pick":"data.items","as":"table|kv|json|text"}
- {"type":"open","url":"https://..."}
- {"type":"run","commands":["other command {arg}"]}  (macro)
- {"type":"choice","options":["a","b"],"saveAs":"var"}
- {"type":"date","format":"iso|local|date|time"}
- {"type":"query","dataset":"name","search":"{text}","where":"col>10 and other=x","sortBy":"{column}","desc":true,"limit":20,"columns":["a","b"]}
- {"type":"stats","dataset":"name","column":"{column}"}
- {"type":"columns","dataset":"name"}
Built-in commands already exist: help, clear, echo, set, unset, vars, calc, history. Do not redefine them.
Rules: command and argument names are lowercase words; every command has a summary; prefer 5-12 useful commands; give most commands an example; numbers must be computed with calc, never invented.`;

export interface DatasetSummary {
  name: string;
  rows: number;
  columns: string[];
  sample: Row[];
}

export function summarizeDatasets(datasets: Record<string, Row[]>): DatasetSummary[] {
  return Object.entries(datasets).map(([name, rows]) => ({ name, rows: rows.length, columns: columnsOf(rows), sample: rows.slice(0, 5) }));
}

/** The prompt sent to Claude to design a console. Datasets are described, never copied in full. */
export function buildPrompt(request: string, datasets: Record<string, Row[]> = {}, notes = ""): string {
  const ds = summarizeDatasets(datasets);
  return [
    "Design a command console from the request below. Reply with ONLY the JSON spec, no prose and no code fences.",
    SPEC_GUIDE,
    ds.length
      ? `These datasets are already loaded and will be attached to the spec automatically. Use them by name in query/stats/columns actions; do NOT include a "datasets" field:\n${ds.map((d) => `- ${d.name} (${d.rows} rows), columns: ${d.columns.join(", ")}; first rows: ${JSON.stringify(d.sample)}`).join("\n")}`
      : "",
    notes ? `Reference text the user uploaded (use it for content, names and numbers):\n"""\n${notes.slice(0, 12000)}\n"""` : "",
    `Request:\n"""\n${request.trim()}\n"""`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pulls the first JSON object out of a model reply (tolerates code fences and stray prose). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The answer did not contain a JSON spec.");
  return JSON.parse(body.slice(start, end + 1));
}
