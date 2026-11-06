// Console builder — more templates and ready-made agent samples, each with easy steps.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import type { ConsoleTemplate } from "./templates";

export const num = (name: string, description?: string) => ({ name, type: "number" as const, positional: true, required: true, ...(description ? { description } : {}) });
export const text = (name: string, description?: string) => ({ name, type: "string" as const, positional: true, required: true, rest: true, ...(description ? { description } : {}) });
export const pick = (name: string, choices: string[]) => ({ name, type: "enum" as const, choices, positional: true, required: true });
export const say = (t: string, tone: "ok" | "info" | "warn" | "muted" = "info") => ({ type: "print" as const, text: t, tone });

/** An agent sample: a `start` command that explains the steps, then one command per step. */
export function agent(id: string, title: string, description: string, intro: string, steps: string[], commands: ConsoleTemplate["spec"]["commands"], vars?: Record<string, string>): ConsoleTemplate {
  return {
    id,
    title,
    description,
    category: "Agents",
    steps: ["start", ...steps],
    spec: {
      name: id,
      welcome: `${title} — type start for the steps. Copyright © Sara Salem 2026.`,
      prompt: "❯",
      ...(vars ? { vars } : {}),
      commands: [
        {
          name: "start",
          summary: "Show what this agent does and the steps to follow",
          actions: [say(intro, "ok"), { type: "table", columns: ["Step", "Type this"], rows: steps.map((s, i) => [i + 1, s]) }],
        },
        ...commands,
      ],
    },
  };
}

const sampleSales = [
  { date: "2026-01-05", region: "Cairo", product: "Cake", units: 42, price: 180 },
  { date: "2026-01-05", region: "Giza", product: "Cookies", units: 120, price: 35 },
  { date: "2026-01-06", region: "Alexandria", product: "Cake", units: 30, price: 185 },
  { date: "2026-01-06", region: "Cairo", product: "Bread", units: 210, price: 12 },
  { date: "2026-01-07", region: "Giza", product: "Cake", units: 25, price: 180 },
  { date: "2026-01-07", region: "Alexandria", product: "Cookies", units: 95, price: 35 },
  { date: "2026-01-08", region: "Cairo", product: "Cookies", units: 140, price: 34 },
  { date: "2026-01-08", region: "Giza", product: "Bread", units: 180, price: 12 },
];
const sampleTeam = [
  { name: "Mona Adel", role: "Designer", team: "Product", city: "Cairo", years: 4 },
  { name: "Omar Hany", role: "Engineer", team: "Platform", city: "Giza", years: 6 },
  { name: "Laila Samir", role: "Sales lead", team: "Sales", city: "Alexandria", years: 8 },
  { name: "Karim Fathy", role: "Engineer", team: "Product", city: "Cairo", years: 2 },
  { name: "Nour Ali", role: "Support", team: "Customer", city: "Cairo", years: 3 },
  { name: "Youssef Nabil", role: "Accountant", team: "Finance", city: "Giza", years: 5 },
];

export const MORE_TEMPLATES: ConsoleTemplate[] = [
  /* ------------------------------ Agents ------------------------------ */
  agent(
    "support-agent",
    "Customer support agent",
    "Triage a ticket, pick a priority, draft a reply and close it — step by step.",
    "I help you handle a support ticket in 4 steps.",
    ["ticket Order arrived late", "priority high", "reply", "close"],
    [
      { name: "ticket", summary: "Step 1: log the customer's problem", args: [text("issue")], examples: ["ticket Order arrived late"], actions: [{ type: "set", name: "issue", value: "{issue}" }, say("Ticket logged: {issue}", "ok"), say("Next: priority low|normal|high", "muted")] },
      { name: "priority", summary: "Step 2: set the priority", args: [pick("level", ["low", "normal", "high"])], examples: ["priority high"], actions: [{ type: "set", name: "level", value: "{level}" }, say("Priority → {level}. Next: reply", "ok")] },
      { name: "reply", summary: "Step 3: draft a reply to the customer", actions: [say("Hello, thank you for contacting us about \"{$issue}\". We are sorry for the trouble. Your ticket is marked {$level} and our team will update you within 24 hours.", "info"), say("Next: close", "muted")] },
      { name: "close", summary: "Step 4: close the ticket with a summary", action: { type: "kv", pairs: [["Issue", "{$issue}"], ["Priority", "{$level}"], ["Status", "Closed ✓"]] } },
    ],
    { issue: "(none yet)", level: "normal" },
  ),
  agent(
    "sales-agent",
    "Sales agent",
    "Qualify a lead, score it, estimate the deal value and get the next action.",
    "I qualify a sales lead in 4 steps.",
    ["lead Nile Foods", "score 8 7 6", "deal 50 1200", "next"],
    [
      { name: "lead", summary: "Step 1: name the lead (company)", args: [text("company")], examples: ["lead Nile Foods"], actions: [{ type: "set", name: "company", value: "{company}" }, say("Lead: {company}. Next: score budget need timing (each 1-10)", "ok")] },
      { name: "score", summary: "Step 2: score budget, need and timing (1-10 each)", args: [num("budget"), num("need"), num("timing")], examples: ["score 8 7 6"], action: { type: "calc", expression: "round((budget + need + timing) / 30 * 100)", label: "Lead score %", saveAs: "leadscore", decimals: 0 } },
      { name: "deal", summary: "Step 3: estimate deal value from seats and price", args: [num("seats"), num("price")], examples: ["deal 50 1200"], action: { type: "calc", expression: "seats * price", label: "Deal value", saveAs: "dealvalue", decimals: 0 } },
      { name: "next", summary: "Step 4: summary and suggested next action", actions: [{ type: "kv", pairs: [["Company", "{$company}"], ["Score %", "{$leadscore}"], ["Deal value", "{$dealvalue}"]] }, { type: "choice", options: ["Book a demo call", "Send a proposal", "Share a case study", "Follow up next week"] }] },
    ],
    { company: "(none)", leadscore: "0", dealvalue: "0" },
  ),
  agent(
    "hr-agent",
    "HR onboarding agent",
    "Welcome a new hire with a 5-step checklist and an equipment plan.",
    "I onboard a new employee in 4 steps.",
    ["hire Mona Designer", "checklist", "salary 25000", "welcome"],
    [
      { name: "hire", summary: "Step 1: name and role of the new hire", args: [{ name: "name", type: "string", positional: true, required: true }, text("role")], examples: ["hire Mona Designer"], actions: [{ type: "set", name: "who", value: "{name}" }, { type: "set", name: "role", value: "{role}" }, say("New hire: {name}, {role}. Next: checklist", "ok")] },
      { name: "checklist", summary: "Step 2: first-week checklist", action: { type: "table", columns: ["Day", "Task"], rows: [["1", "Laptop, email and accounts"], ["1", "Meet the team"], ["2", "Policies and benefits"], ["3", "First small task"], ["5", "Check-in with manager"]] } },
      { name: "salary", summary: "Step 3: monthly net from gross (simple 15% deduction)", args: [num("gross")], examples: ["salary 25000"], action: { type: "calc", expression: "gross * (1 - 0.15)", label: "Monthly net", decimals: 0 } },
      { name: "welcome", summary: "Step 4: welcome message", action: say("Welcome to the team, {$who}! We are happy to have you as our {$role}. Your first-week plan is ready.", "ok") },
    ],
    { who: "(none)", role: "(none)" },
  ),
  agent(
    "travel-agent",
    "Travel planner agent",
    "Plan a trip: destination, daily budget, total cost and a packing list.",
    "I plan a trip in 4 steps.",
    ["trip Luxor", "budget 7 1500", "pack", "summary"],
    [
      { name: "trip", summary: "Step 1: choose the destination", args: [text("place")], examples: ["trip Luxor"], actions: [{ type: "set", name: "place", value: "{place}" }, say("Destination: {place}. Next: budget days per-day", "ok")] },
      { name: "budget", summary: "Step 2: total cost from days and cost per day", args: [num("days"), num("perday")], examples: ["budget 7 1500"], actions: [{ type: "set", name: "days", value: "{days}" }, { type: "calc", expression: "days * perday * 1.1", label: "Total with 10% buffer", saveAs: "tripcost", decimals: 0 }] },
      { name: "pack", summary: "Step 3: packing list", action: { type: "table", columns: ["Item", "Why"], rows: [["Passport / ID", "Travel"], ["Sunscreen and hat", "Sun"], ["Charger and power bank", "Phone"], ["Comfortable shoes", "Walking"], ["Small first-aid kit", "Safety"]] } },
      { name: "summary", summary: "Step 4: trip summary", action: { type: "kv", pairs: [["Destination", "{$place}"], ["Days", "{$days}"], ["Total budget", "{$tripcost}"]] } },
    ],
    { place: "(none)", days: "0", tripcost: "0" },
  ),
  agent(
    "tutor-agent",
    "Study tutor agent",
    "Pick a subject, plan study time, get a quiz question and check your grade.",
    "I help you study in 4 steps.",
    ["subject Math", "plan 10 5", "quiz", "grade 42 50"],
    [
      { name: "subject", summary: "Step 1: choose a subject", args: [text("name")], examples: ["subject Math"], actions: [{ type: "set", name: "subject", value: "{name}" }, say("Subject: {name}. Next: plan hours days", "ok")] },
      { name: "plan", summary: "Step 2: minutes per day from total hours and days", args: [num("hours"), num("days")], examples: ["plan 10 5"], action: { type: "calc", expression: "hours * 60 / days", label: "Minutes per day", decimals: 0 } },
      { name: "quiz", summary: "Step 3: a random practice question", action: { type: "choice", options: ["Explain the main idea in one sentence.", "Write 3 key terms and define them.", "Solve one example without notes.", "Teach the topic to a friend in 2 minutes.", "List one mistake you made and fix it."] } },
      { name: "grade", summary: "Step 4: score as a percentage", args: [num("score"), num("total")], examples: ["grade 42 50"], action: { type: "calc", expression: "score / total * 100", label: "Grade %", decimals: 1 } },
    ],
    { subject: "(none)" },
  ),
  agent(
    "marketing-agent",
    "Marketing agent",
    "Set a campaign, measure ROI and cost per lead, and get a post idea.",
    "I run a marketing campaign check in 4 steps.",
    ["campaign Ramadan offer", "roi 20000 65000", "cpl 20000 400", "idea"],
    [
      { name: "campaign", summary: "Step 1: name the campaign", args: [text("name")], examples: ["campaign Ramadan offer"], actions: [{ type: "set", name: "campaign", value: "{name}" }, say("Campaign: {name}. Next: roi spend revenue", "ok")] },
      { name: "roi", summary: "Step 2: return on investment", args: [num("spend"), num("revenue")], examples: ["roi 20000 65000"], action: { type: "calc", expression: "(revenue - spend) / spend * 100", label: "ROI %", decimals: 1 } },
      { name: "cpl", summary: "Step 3: cost per lead", args: [num("spend"), num("leads")], examples: ["cpl 20000 400"], action: { type: "calc", expression: "spend / leads", label: "Cost per lead", decimals: 2 } },
      { name: "idea", summary: "Step 4: a social post idea", action: { type: "choice", options: ["Behind-the-scenes photo of the team", "Customer story with a quote", "Short tip video (30 seconds)", "Limited-time offer countdown", "Poll: which product do you love most?"] } },
    ],
    { campaign: "(none)" },
  ),
  agent(
    "pm-agent",
    "Project manager agent",
    "Plan a project: name, estimate with buffer, risk check and status report.",
    "I plan a project in 4 steps.",
    ["project New website", "estimate 40 3", "risk", "report"],
    [
      { name: "project", summary: "Step 1: name the project", args: [text("name")], examples: ["project New website"], actions: [{ type: "set", name: "project", value: "{name}" }, say("Project: {name}. Next: estimate tasks hours-per-task", "ok")] },
      { name: "estimate", summary: "Step 2: total hours with a 20% buffer", args: [num("tasks"), num("hours")], examples: ["estimate 40 3"], action: { type: "calc", expression: "tasks * hours * 1.2", label: "Hours with buffer", saveAs: "hours", decimals: 0 } },
      { name: "risk", summary: "Step 3: common risks to watch", action: { type: "table", columns: ["Risk", "Plan"], rows: [["Scope creep", "Agree scope in writing"], ["Late feedback", "Weekly review meeting"], ["Key person away", "Share notes and access"], ["Budget overrun", "Track hours weekly"]] } },
      { name: "report", summary: "Step 4: status report", actions: [{ type: "kv", pairs: [["Project", "{$project}"], ["Estimated hours", "{$hours}"], ["Status", "Planned"]] }, { type: "date", format: "date" }] },
    ],
    { project: "(none)", hours: "0" },
  ),
  agent(
    "coach-agent",
    "Health coach agent",
    "BMI, daily water, step goal and a random workout — a simple wellness check.",
    "I do a quick wellness check in 4 steps.",
    ["bmi 70 1.72", "water 70", "steps 4000", "workout"],
    [
      { name: "bmi", summary: "Step 1: body mass index from kg and metres", args: [num("kg"), num("m")], examples: ["bmi 70 1.72"], action: { type: "calc", expression: "kg / (m * m)", label: "BMI", decimals: 1 } },
      { name: "water", summary: "Step 2: daily water in litres (0.033 L per kg)", args: [num("kg")], examples: ["water 70"], action: { type: "calc", expression: "kg * 0.033", label: "Litres per day", decimals: 1 } },
      { name: "steps", summary: "Step 3: steps left to reach 10,000", args: [num("done")], examples: ["steps 4000"], action: { type: "calc", expression: "max(0, 10000 - done)", label: "Steps left", decimals: 0 } },
      { name: "workout", summary: "Step 4: pick a 15-minute workout", action: { type: "choice", options: ["Brisk walk", "Bodyweight circuit", "Stretching and yoga", "Stairs climb", "Dance session"] } },
    ],
  ),
  agent(
    "budget-agent",
    "Personal budget agent",
    "Split income with the 50/30/20 rule, plan savings and check a purchase.",
    "I plan a monthly budget in 4 steps.",
    ["income 20000", "split", "save 100000 4000", "afford 3500"],
    [
      { name: "income", summary: "Step 1: monthly income", args: [num("amount")], examples: ["income 20000"], actions: [{ type: "set", name: "income", value: "{amount}" }, say("Income saved. Next: split", "ok")] },
      { name: "split", summary: "Step 2: 50% needs, 30% wants, 20% savings", actions: [{ type: "calc", expression: "income * 0.5", label: "Needs", decimals: 0 }, { type: "calc", expression: "income * 0.3", label: "Wants", decimals: 0 }, { type: "calc", expression: "income * 0.2", label: "Savings", decimals: 0 }] },
      { name: "save", summary: "Step 3: months to reach a goal", args: [num("goal"), num("monthly")], examples: ["save 100000 4000"], action: { type: "calc", expression: "ceil(goal / monthly)", label: "Months", decimals: 0 } },
      { name: "afford", summary: "Step 4: share of your wants budget a purchase uses", args: [num("price")], examples: ["afford 3500"], action: { type: "calc", expression: "price / (income * 0.3) * 100", label: "% of wants budget", decimals: 0 } },
    ],
    { income: "0" },
  ),
  agent(
    "recruiter-agent",
    "Recruiter agent",
    "Score a candidate on skills, experience and interview, then decide.",
    "I evaluate a candidate in 4 steps.",
    ["candidate Omar Hany", "rate 8 7 9", "offer 18000 15", "decision"],
    [
      { name: "candidate", summary: "Step 1: candidate name", args: [text("name")], examples: ["candidate Omar Hany"], actions: [{ type: "set", name: "candidate", value: "{name}" }, say("Candidate: {name}. Next: rate skills experience interview", "ok")] },
      { name: "rate", summary: "Step 2: weighted score (skills 40%, experience 30%, interview 30%)", args: [num("skills"), num("experience"), num("interview")], examples: ["rate 8 7 9"], action: { type: "calc", expression: "skills * 0.4 + experience * 0.3 + interview * 0.3", label: "Score / 10", saveAs: "cscore", decimals: 1 } },
      { name: "offer", summary: "Step 3: offer from current salary plus a raise %", args: [num("current"), num("raise")], examples: ["offer 18000 15"], action: { type: "calc", expression: "current * (1 + raise / 100)", label: "Offer", decimals: 0 } },
      { name: "decision", summary: "Step 4: summary", action: { type: "kv", pairs: [["Candidate", "{$candidate}"], ["Score / 10", "{$cscore}"], ["Rule", "7 or more → offer, 5-7 → second interview, below 5 → thank you note"]] } },
    ],
    { candidate: "(none)", cscore: "0" },
  ),

  /* ----------------------------- Business ----------------------------- */
  {
    id: "invoice",
    title: "Invoice maker",
    description: "Line totals, discount, VAT and the final amount due.",
    category: "Business",
    steps: ["line 3 450", "discount 1350 10", "total 1215", "terms"],
    spec: {
      name: "invoice",
      welcome: "Invoice maker — try: line 3 450, then total 1350",
      vars: { vat: "0.14" },
      commands: [
        { name: "line", summary: "Line total from quantity and unit price", args: [num("qty"), num("price")], examples: ["line 3 450"], action: { type: "calc", expression: "qty * price", label: "Line total", decimals: 2 } },
        { name: "discount", summary: "Amount after a percent discount", args: [num("amount"), num("percent")], examples: ["discount 1350 10"], action: { type: "calc", expression: "amount * (1 - percent / 100)", label: "After discount", decimals: 2 } },
        { name: "total", summary: "Add VAT to a subtotal", args: [num("subtotal")], examples: ["total 1215"], actions: [{ type: "calc", expression: "subtotal * vat", label: "VAT", decimals: 2 }, { type: "calc", expression: "subtotal * (1 + vat)", label: "Amount due", decimals: 2 }] },
        { name: "terms", summary: "Standard payment terms", action: { type: "kv", pairs: [["Due", "within 30 days"], ["Late fee", "2% per month"], ["Bank transfer", "preferred"]] } },
      ],
    },
  },
  {
    id: "shop",
    title: "Shop pricing",
    description: "Selling price from cost and markup, sale price, profit and break-even.",
    category: "Business",
    steps: ["price 80 50", "sale 120 25", "profit 120 80 300", "breakeven 15000 120 80"],
    spec: {
      name: "shop",
      welcome: "Shop pricing — try: price 80 50",
      commands: [
        { name: "price", summary: "Selling price from cost and markup %", args: [num("cost"), num("markup")], examples: ["price 80 50"], action: { type: "calc", expression: "cost * (1 + markup / 100)", label: "Selling price", decimals: 2 } },
        { name: "sale", summary: "Sale price after percent off", args: [num("price"), num("off")], examples: ["sale 120 25"], action: { type: "calc", expression: "price * (1 - off / 100)", label: "Sale price", decimals: 2 } },
        { name: "profit", summary: "Total profit from price, cost and units", args: [num("price"), num("cost"), num("units")], examples: ["profit 120 80 300"], action: { type: "calc", expression: "(price - cost) * units", label: "Profit", decimals: 2 } },
        { name: "breakeven", summary: "Units needed to cover fixed costs", args: [num("fixed"), num("price"), num("cost")], examples: ["breakeven 15000 120 80"], action: { type: "calc", expression: "ceil(fixed / (price - cost))", label: "Units to break even", decimals: 0 } },
      ],
    },
  },
  {
    id: "restaurant",
    title: "Restaurant helper",
    description: "Bill with service, split between people, tip and today's special.",
    category: "Business",
    steps: ["bill 950", "split 1083 4", "tip 950 10", "special"],
    spec: {
      name: "restaurant",
      welcome: "Restaurant helper — try: bill 950",
      vars: { service: "0.14" },
      commands: [
        { name: "bill", summary: "Bill with service charge", args: [num("amount")], examples: ["bill 950"], action: { type: "calc", expression: "amount * (1 + service)", label: "Total", decimals: 2 } },
        { name: "split", summary: "Split a total between people", args: [num("total"), num("people")], examples: ["split 1083 4"], action: { type: "calc", expression: "total / people", label: "Each pays", decimals: 2 } },
        { name: "tip", summary: "Tip from a percent", args: [num("amount"), num("percent")], examples: ["tip 950 10"], action: { type: "calc", expression: "amount * percent / 100", label: "Tip", decimals: 2 } },
        { name: "special", summary: "Pick today's special", action: { type: "choice", options: ["Grilled fish", "Molokhia with chicken", "Mixed grill", "Stuffed vine leaves", "Fattah"] } },
      ],
    },
  },
  {
    id: "realestate",
    title: "Real estate calculator",
    description: "Mortgage payment, rental yield, price per metre and down payment.",
    category: "Business",
    steps: ["mortgage 2000000 0.2 20", "yield 2000000 15000", "permeter 2000000 140", "down 2000000 20"],
    spec: {
      name: "realestate",
      welcome: "Real estate — try: mortgage 2000000 0.2 20",
      commands: [
        { name: "mortgage", summary: "Monthly payment from price, annual rate and years", args: [num("price"), num("rate", "Annual rate, e.g. 0.2"), num("years")], examples: ["mortgage 2000000 0.2 20"], action: { type: "calc", expression: "price * (rate/12) / (1 - (1 + rate/12) ^ (-years*12))", label: "Monthly payment", decimals: 2 } },
        { name: "yield", summary: "Rental yield % from price and monthly rent", args: [num("price"), num("rent")], examples: ["yield 2000000 15000"], action: { type: "calc", expression: "rent * 12 / price * 100", label: "Yield %", decimals: 2 } },
        { name: "permeter", summary: "Price per square metre", args: [num("price"), num("area")], examples: ["permeter 2000000 140"], action: { type: "calc", expression: "price / area", label: "Price per m²", decimals: 0 } },
        { name: "down", summary: "Down payment from a percent", args: [num("price"), num("percent")], examples: ["down 2000000 20"], action: { type: "calc", expression: "price * percent / 100", label: "Down payment", decimals: 0 } },
      ],
    },
  },

  /* ------------------------------ Tools ------------------------------- */
  {
    id: "units",
    title: "Unit converter",
    description: "Kilometres, kilograms, Celsius and feet — quick conversions.",
    category: "Tools",
    steps: ["km 10", "kg 70", "celsius 37", "feet 6"],
    spec: {
      name: "units",
      welcome: "Unit converter — try: km 10",
      commands: [
        { name: "km", summary: "Kilometres to miles", args: [num("value")], examples: ["km 10"], action: { type: "calc", expression: "value * 0.621371", label: "Miles", decimals: 2 } },
        { name: "kg", summary: "Kilograms to pounds", args: [num("value")], examples: ["kg 70"], action: { type: "calc", expression: "value * 2.20462", label: "Pounds", decimals: 1 } },
        { name: "celsius", summary: "Celsius to Fahrenheit", args: [num("value")], examples: ["celsius 37"], action: { type: "calc", expression: "value * 9 / 5 + 32", label: "°F", decimals: 1 } },
        { name: "feet", summary: "Feet to metres", args: [num("value")], examples: ["feet 6"], action: { type: "calc", expression: "value * 0.3048", label: "Metres", decimals: 2 } },
      ],
    },
  },
  {
    id: "daily",
    title: "Daily helper",
    description: "Notes in variables, today's date, a percent calculator and a reminder.",
    category: "Tools",
    steps: ["note Call the bank", "today", "percent 15 240", "remind"],
    spec: {
      name: "daily",
      welcome: "Daily helper — try: note Call the bank",
      vars: { note: "(empty)" },
      commands: [
        { name: "note", summary: "Save a short note", args: [text("text")], examples: ["note Call the bank"], actions: [{ type: "set", name: "note", value: "{text}" }, say("Saved: {text}", "ok")] },
        { name: "today", summary: "Today's date and time", actions: [{ type: "date", format: "date" }, { type: "date", format: "time" }] },
        { name: "percent", summary: "What is X% of Y", args: [num("x"), num("y")], examples: ["percent 15 240"], action: { type: "calc", expression: "x / 100 * y", label: "Result", decimals: 2 } },
        { name: "remind", summary: "Show your saved note", action: say("Reminder: {$note}", "warn") },
      ],
    },
  },

  /* ------------------------------- Data ------------------------------- */
  {
    id: "sales-data",
    title: "Sales data (sample)",
    description: "A sample sales table you can search, filter, sort and total — no upload needed.",
    category: "Data",
    steps: ["rows", "find Cake", "where region=Cairo", "top units", "stats units"],
    spec: {
      name: "sales",
      welcome: "Sample sales data — try: rows, find Cake, where units>100, top units, stats price",
      datasets: { sales: sampleSales },
      commands: [
        { name: "rows", summary: "Show sales rows", args: [{ name: "limit", alias: "n", type: "number", default: 20 }], action: { type: "query", dataset: "sales", limit: "{limit}" } },
        { name: "find", summary: "Search any column", args: [text("text")], examples: ["find Cake"], action: { type: "query", dataset: "sales", search: "{text}" } },
        { name: "where", summary: "Filter: column=value, column>10 (join with and)", args: [text("filter")], examples: ["where region=Cairo"], action: { type: "query", dataset: "sales", where: "{filter}" } },
        { name: "top", summary: "Sort by a column, largest first", args: [pick("column", ["units", "price", "date"])], examples: ["top units"], action: { type: "query", dataset: "sales", sortBy: "{column}", desc: true, limit: 5 } },
        { name: "stats", summary: "Count, sum, average, min, max", args: [pick("column", ["units", "price"])], examples: ["stats units"], action: { type: "stats", dataset: "sales", column: "{column}" } },
      ],
    },
  },
  {
    id: "team-data",
    title: "Team directory (sample)",
    description: "A sample staff list: look people up by name, team or city.",
    category: "Data",
    steps: ["people", "find Engineer", "where city=Cairo", "stats years"],
    spec: {
      name: "team",
      welcome: "Team directory — try: people, find Engineer, where team=Product",
      datasets: { team: sampleTeam },
      commands: [
        { name: "people", summary: "Everyone in the team", action: { type: "query", dataset: "team" } },
        { name: "find", summary: "Search by any word", args: [text("text")], examples: ["find Engineer"], action: { type: "query", dataset: "team", search: "{text}" } },
        { name: "where", summary: "Filter: team=Product, years>3", args: [text("filter")], examples: ["where city=Cairo"], action: { type: "query", dataset: "team", where: "{filter}" } },
        { name: "stats", summary: "Statistics of a number column", args: [pick("column", ["years"])], examples: ["stats years"], action: { type: "stats", dataset: "team", column: "{column}" } },
      ],
    },
  },

  /* ------------------------------- Fun -------------------------------- */
  {
    id: "quiz",
    title: "Quiz night",
    description: "Random questions, a score keeper and a winner picker.",
    category: "Fun",
    steps: ["question", "answer", "score 7 10", "winner"],
    spec: {
      name: "quiz",
      welcome: "Quiz night — type question",
      commands: [
        { name: "question", summary: "A random question", action: { type: "choice", options: ["What is the longest river in Africa?", "How many continents are there?", "Which planet is known as the red planet?", "What is 12 × 12?", "In which city are the Pyramids of Giza?"], saveAs: "q" } },
        { name: "answer", summary: "Answers to all questions", action: { type: "table", columns: ["Question", "Answer"], rows: [["Longest river in Africa", "The Nile"], ["Continents", "7"], ["Red planet", "Mars"], ["12 × 12", "144"], ["Pyramids of Giza", "Giza, near Cairo"]] } },
        { name: "score", summary: "Score as a percentage", args: [num("right"), num("total")], examples: ["score 7 10"], action: { type: "calc", expression: "right / total * 100", label: "Score %", decimals: 0 } },
        { name: "winner", summary: "Pick a random winner", action: { type: "choice", options: ["Team Red", "Team Blue", "Team Green", "Team Gold"] } },
      ],
    },
  },
];
