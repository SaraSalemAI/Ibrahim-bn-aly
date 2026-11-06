// Console builder — starter templates for any kind of console.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import type { ConsoleSpec } from "./spec";
import { MORE_TEMPLATES } from "./templates-more";
import { FIELD_AGENTS } from "./templates-agents";

export interface ConsoleTemplate {
  id: string;
  title: string;
  description: string;
  /** Group shown in the studio: Start, Business, Agents, Tools, Data, Fun. */
  category?: string;
  /** Field or industry, for agent samples (e.g. Health, Education). */
  field?: string;
  /** Easy steps: commands to run in order, shown with a Run button each. */
  steps?: string[];
  spec: ConsoleSpec;
}

export const TEMPLATES: ConsoleTemplate[] = [
  {
    id: "starter",
    category: "Start",
    steps: ["hello", "hello Sara", "help"],
    title: "Starter",
    description: "A minimal console: one greeting command with an argument.",
    spec: {
      name: "my-console",
      welcome: "Welcome! Type help to see commands. Prepared by Sara Salem © 2026.",
      prompt: "❯",
      commands: [
        {
          name: "hello",
          summary: "Say hello",
          args: [{ name: "name", type: "string", positional: true, default: "world" }],
          examples: ["hello Sara"],
          action: { type: "print", text: "Hello, {name}!", tone: "ok" },
        },
      ],
    },
  },
  {
    id: "finance",
    category: "Business",
    steps: ["loan 500000 0.18 5", "vat 1000", "margin 120 75", "grow 100000 0.12 5"],
    title: "Finance calculator",
    description: "Loan payments, VAT, margins and compound growth with saved variables.",
    spec: {
      name: "finance",
      welcome: "Finance console — try: loan 500000 0.18 5   or   vat 1000",
      vars: { vat: "0.14", ccy: "EGP" },
      groups: [{ name: "fx", summary: "Currency conversion" }],
      commands: [
        {
          name: "loan",
          summary: "Monthly payment for an amortising loan",
          args: [
            { name: "principal", type: "number", positional: true, required: true },
            { name: "rate", type: "number", positional: true, required: true, description: "Annual rate, e.g. 0.18" },
            { name: "years", type: "number", positional: true, required: true },
          ],
          action: { type: "calc", label: "Monthly payment ({$ccy})", expression: "principal * (rate/12) / (1 - (1 + rate/12) ^ (-years*12))", decimals: 2, saveAs: "payment" },
        },
        {
          name: "vat",
          summary: "Add VAT to a net amount (rate in variable vat)",
          args: [{ name: "net", type: "number", positional: true, required: true }],
          actions: [
            { type: "calc", label: "VAT", expression: "net * vat", decimals: 2 },
            { type: "calc", label: "Gross", expression: "net * (1 + vat)", decimals: 2 },
          ],
        },
        {
          name: "margin",
          summary: "Gross margin % from price and cost",
          args: [
            { name: "price", type: "number", positional: true, required: true },
            { name: "cost", type: "number", positional: true, required: true },
          ],
          action: { type: "calc", label: "Margin %", expression: "(price - cost) / price * 100", decimals: 1 },
        },
        {
          name: "grow",
          summary: "Compound growth: amount × (1 + rate)^years",
          args: [
            { name: "amount", type: "number", positional: true, required: true },
            { name: "rate", type: "number", positional: true, required: true },
            { name: "years", type: "number", positional: true, required: true },
          ],
          action: { type: "calc", label: "Future value", expression: "amount * (1 + rate) ^ years", decimals: 2 },
        },
        {
          name: "fx convert",
          summary: "Convert using a rate you set: set usd 48.5",
          args: [
            { name: "amount", type: "number", positional: true, required: true },
            { name: "rate", type: "string", positional: true, required: true, description: "Variable name or number" },
          ],
          action: { type: "calc", expression: "amount * {rate}", decimals: 2 },
        },
      ],
    },
  },
  {
    id: "devops",
    category: "Tools",
    steps: ["env use production", "env show", "runbook deploy"],
    title: "DevOps toolbox",
    description: "Environment switching, runbooks as macros, quick links and live HTTP health checks.",
    spec: {
      name: "ops",
      welcome: "Ops console — set env, check status, run runbooks.",
      vars: { env: "staging", api: "https://api.github.com" },
      groups: [{ name: "env", summary: "Environment" }, { name: "runbook", summary: "Runbooks (macros)" }],
      commands: [
        {
          name: "env use",
          summary: "Switch environment",
          args: [{ name: "name", type: "enum", choices: ["dev", "staging", "production"], positional: true, required: true }],
          actions: [
            { type: "set", name: "env", value: "{name}" },
            { type: "print", text: "Environment → {name}", tone: "ok" },
          ],
        },
        { name: "env show", summary: "Show the current environment", action: { type: "kv", pairs: [["Environment", "{$env}"], ["API", "{$api}"]] } },
        { name: "status", summary: "Live HTTP check of the API", action: { type: "http", url: "{$api}", as: "kv" } },
        {
          name: "runbook deploy",
          summary: "Pre-deploy checklist then status",
          actions: [
            { type: "print", text: "1/3 Checking environment {$env}…", tone: "muted" },
            { type: "run", commands: ["env show", "status"] },
            { type: "print", text: "Checklist complete. Deploy from your CI.", tone: "ok" },
          ],
        },
        { name: "docs", summary: "Open documentation", args: [{ name: "topic", type: "string", positional: true, default: "" }], action: { type: "open", url: "https://developer.mozilla.org/en-US/search?q={topic}" } },
        { name: "now", summary: "Current time (ISO)", action: { type: "date", format: "iso" } },
      ],
    },
  },
  {
    id: "api",
    category: "Tools",
    steps: ["help repo", "repo vercel/next.js", "releases vercel/next.js"],
    title: "API explorer",
    description: "Query any JSON API, pick fields and show results as tables.",
    spec: {
      name: "api",
      welcome: "API explorer — try: repo vercel/next.js   or   get https://api.github.com/users/octocat",
      commands: [
        {
          name: "get",
          summary: "GET any JSON URL",
          args: [
            { name: "url", type: "string", positional: true, required: true },
            { name: "pick", type: "string", description: "Dot path into the result, e.g. data.items" },
          ],
          action: { type: "http", url: "{url}", pick: "{pick}" },
        },
        {
          name: "repo",
          summary: "GitHub repository summary",
          args: [{ name: "slug", type: "string", positional: true, required: true, description: "owner/name" }],
          action: { type: "http", url: "https://api.github.com/repos/{slug}", as: "kv" },
        },
        {
          name: "releases",
          summary: "Latest releases of a GitHub repo",
          args: [{ name: "slug", type: "string", positional: true, required: true }],
          action: { type: "http", url: "https://api.github.com/repos/{slug}/releases?per_page=5", as: "table" },
        },
      ],
    },
  },
  {
    id: "game",
    category: "Fun",
    steps: ["coin", "dice", "lunch"],
    title: "Decision helper",
    description: "Random picks, coin flips and dice — choice actions and variables.",
    spec: {
      name: "decide",
      welcome: "Can't decide? Try: coin, dice, lunch",
      commands: [
        { name: "coin", summary: "Flip a coin", action: { type: "choice", options: ["Heads", "Tails"] } },
        { name: "dice", summary: "Roll a six-sided die", action: { type: "choice", options: ["⚀ 1", "⚁ 2", "⚂ 3", "⚃ 4", "⚄ 5", "⚅ 6"] } },
        { name: "lunch", summary: "Pick lunch", action: { type: "choice", options: ["Koshari", "Falafel", "Pizza", "Salad", "Shawarma"], saveAs: "lunch" } },
      ],
    },
  },
  ...MORE_TEMPLATES,
  ...FIELD_AGENTS,
];

const FIELDS: Record<string, string> = { "support-agent": "Customer service", "sales-agent": "Sales", "hr-agent": "HR", "travel-agent": "Travel", "tutor-agent": "Education", "marketing-agent": "Marketing", "pm-agent": "Projects", "coach-agent": "Health", "budget-agent": "Finance", "recruiter-agent": "HR" };
for (const t of TEMPLATES) if (!t.field && FIELDS[t.id]) t.field = FIELDS[t.id];
