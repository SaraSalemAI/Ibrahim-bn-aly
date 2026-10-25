# Sara Salem
AI creator

## AI CFO — Financial Intelligence Platform

A bilingual (English / Arabic, RTL) Next.js app for Egyptian finance teams, built from the *AI CFO Financial Intelligence Master Prompt* (v3/v4). It covers all 17 modules of the specification. Every number is produced by deterministic, tested TypeScript; AI (through **Vercel AI Gateway**) only explains figures the server has recomputed, and suggests account mappings for the analyst to confirm.

Try it: **Load complete sample company** on the home page loads a fictional Egyptian trading company with a trial balance, general ledger and every subledger, so each module can be explored immediately.

### Upload everything at once

The **Uploaded files** tab is the first thing on the AI CFO agent page (the same drop zone is on the dashboard and the ingestion center). Drop any mix of files and the app reads, recognises, imports, maps and validates them automatically:

1. **Read**: every file is opened in the browser (formats below). Sheets holding several tables separated by blank rows are split into one file per table.
2. **Recognise**: each table is scored on its headers and file name. Files seen in an earlier month (same name without dates or numbers) keep the type and role they had.
3. **Import**: files recognised with at least the minimum confidence (60% by default) and with no unreadable rows are imported at once. Everything else is **held** with the reason: unrecognised, low confidence, read errors, a scanned document, or a second current/prior trial balance.
4. **Map**: suggested account mappings at or above the threshold (85% by default) are accepted; in the full app the AI is asked about the rest, and its confident answers are accepted the same way. Lower ones wait for review on the mapping page.
5. **Validate and advance**: every validation rule runs and the result is saved; the period moves to Mapped / Reconciled when every gate passes. It is never locked automatically.

The run is recorded (files, held files and why, mappings accepted, accounts still to map, period status) and **Ask the agent about these files** sends the agent to review it. The 📎 button in the chat does all of this for files attached there. Automatic mode, the thresholds, AI mapping and auto-advance are switched under **Settings** next to the drop zone.

- **Formats**: CSV/TSV, Excel `.xlsx` and legacy `.xls` (Excel 97-2003, read in the browser), HTML tables and Excel 2003 XML saved as `.xls` by ERPs, OpenDocument `.ods`, Word `.docx` tables, dBase `.dbf`, JSON record arrays, pipe-separated and fixed-width text reports (`.prn`, printed trial balances), digital **PDF** reports (text layer read in the browser), `.zip` archives (folders and one nested zip level), SWIFT **MT940** and **OFX/QFX** bank statements, ETA e-invoice JSON/XML, UTF-8 or Windows-1256 Arabic. `.xlsb` and Excel 5/95 files are refused with a message to re-save them.
- **Headers**: Arabic and English synonyms for every field (spelling variants of alef, yaa and taa marbuta are treated as the same), two-row headers (Opening / Movement / Closing over Debit / Credit) merged into one.
- **Detection**: each file is scored on its column headers and file name, with a confidence level; months are read from names such as `TB 2025-03.csv` or `ميزان مارس ٢٠٢٥`. You can change the type before importing.
- **ERP presets**: exports from **Odoo, SAP Business One, QuickBooks, Dynamics 365, ERPNext, Zoho Books, Sage, Oracle** and Arabic-language ERPs are recognised: report titles above the header are skipped, combined `1010 · Cash` account columns are split, a signed balance or amount becomes debit/credit, and dates or entry numbers given only on the first line of a journal are carried down.
- **Column matching**: when a column is not recognised, you match it once and the match is saved for that company.
- **Before importing**: duplicate files and duplicate rows, entries outside the period (with a one-click fix when the files agree on another year), files covering different periods, foreign currencies without an exchange rate, and the subledger tie-out the import will produce.
- **Trial balance roles**: current period, prior period (comparatives merged by account code) or one month for trends.
- **Scanned PDFs and photos** (full app with AI): read into a bank statement, AR, AP or TB table that you review like any other file.
- **Email intake** (full app with Supabase): attachments mailed to `tb+<workspace key>@<your inbound domain>` are stored by the `/api/intake` webhook (Postmark or a generic JSON body; needs `INTAKE_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `supabase/migrations/0003_email_intake.sql`). **Check email inbox** on the upload tab imports them through the same pipeline. Not tested against a live mail provider or Supabase project.
- **ETA portal** (full app with `ETA_CLIENT_ID` / `ETA_CLIENT_SECRET`): pulls the company's issued, valid e-invoices for the period, read-only. Signing and submitting still needs the company's e-seal and is not done here. Not yet tested against the live portal.

### Close, group and team

| Page | What it does |
|---|---|
| Close review (`/close-review`) | Readiness gates, tie-outs and rule-based anomaly flags with the rows behind them: weekend and out-of-period postings, large round amounts, material period-end entries, entries without a description, revenue debited against unusual accounts, possible duplicate postings, Benford first-digit test, balances on the unusual side, suspense accounts, large swings, AR credit balances and old debts, customer concentration, duplicate supplier invoices, missing supplier tax IDs, negative stock, staff without social insurance, bank differences. AI explains the flags; it adds none. |
| Validation (upload tab and close review) | 50+ rules grouped by area: trial balance (balanced, prior balanced, duplicate or missing codes and names, both sides on one line, unmapped and pending mappings, balances on the unusual side, code format, balance-sheet equation), opening balances (prior column equals the last closed period, accounts carried, opening + GL movement = closing), general ledger (journals balance, GL movement per account equals the TB, accounts exist, in period, no future dates, zero or two-sided lines), AR, AP (net = gross − WHT, WHT rates, tax-ID format, duplicates), fixed assets, inventory roll-forward, payroll arithmetic, bank running balance, ETA (VAT rate, receiver tax ID, duplicate UUIDs), tie-outs and FX rates. A rounding tolerance applies to every rule and to the period gates. Saved runs show what broke and what was fixed since the last one. |
| 13-week cash forecast (`/cash-forecast`) | Week-by-week receipts from open customer invoices (by due date plus a collection delay), supplier payments by due date, payroll at month end with insurance and salary tax on the 15th, overdue amounts spread over the first weeks at the rate you choose, and your own one-off, weekly or monthly items. Shows the lowest week and weeks below a minimum cash level. |
| Monthly trends (`/trends`) | Monthly TBs (year-to-date P&L differenced automatically) as charts and a month-by-month table with margins and receivable days. |
| Group consolidation (`/consolidation`) | Parent and subsidiaries with ownership %, intercompany balances and income/expense eliminated (recognised by name or tagged on the mapping page), unreconciled differences shown on their own line, investment against subsidiary share capital with goodwill, non-controlling interests; open the result as a company so every module runs on the group. Simplified: share capital stands in for net assets at acquisition. |
| Period roll-forward (Audit page) | Locking a period freezes a hashed board pack (reopen it later from the Audit page). "Start next period" archives the period and carries closing balances forward (P&L closed to retained earnings at a year end) as opening balances and comparatives; the new TB can then be built from opening balances plus the GL. |
| Team & sync (`/team`) | Optional: share a workspace through your own Supabase project with email one-time-code sign-in, members with roles (CFO adds members) and versioned saves that refuse to overwrite a newer copy. Run `supabase/migrations/0002_team_sync.sql` first. Not tested against a live Supabase project here. |

### AI CFO agent

The **AI CFO agent** page (`/agent`) is a chat assistant that works on the selected company's books. It answers in English or Arabic and gets every figure by calling the app's calculation engines as tools; it never computes figures from memory.

| Tool | What it does |
|---|---|
| `get_overview`, `get_statement`, `get_variances`, `get_ratios` | Headline figures, validation, statements, variances, ratios, DuPont, Altman, Beneish |
| `find_accounts`, `get_subledger` | Account search (EN/AR) with lineage; AR, AP, fixed assets, inventory, payroll, bank, ETA and GL analysis with tie-outs |
| `get_tax_computation`, `get_budget_vs_actual`, `get_disclosures`, `compare_peers` | Tax schedule, budget vs actual, note status, peer KPIs |
| `run_forecast`, `run_sensitivity`, `run_valuation`, `run_stress_test` | What-if runs of the 3-statement model, sensitivity grid, DCF and FX/rate stress. Nothing is saved |
| `get_close_review`, `search_gl`, `get_top_counterparties` | Ask your data: anomaly flags and readiness, a search over GL lines (text, account, dates, amounts), largest customers and suppliers |
| `get_trends`, `get_consolidation`, `get_period_history` | Monthly trends, the group this company belongs to, closed periods and frozen board packs |
| `get_upload_report`, `get_validation_report`, `get_cash_forecast` | What the last uploads imported and held, every validation rule with changes since the last run, the 13-week cash forecast |
| `propose_adjusting_entry`, `propose_mapping_change` | Drafts only, with an impact preview. Nothing changes until you click **Post entry** / **Apply mapping**, and the approval is written to the audit log |

Without AI (the HTML build, or a server with no AI Gateway key) the agent page switches to an offline mode: questions are routed by keywords to the same tools and the results are shown as tables, with no interpretation.

The server (`/api/agent`) recomputes everything from the submitted company, runs the tool loop through AI Gateway (up to 8 steps) and streams tool activity and text to the page. Conversations are kept per company in the browser.

### Modules

| # | Module | What it does |
|---|---|---|
| 1 | Workspace & company | Multiple companies per workspace, EN/AR names, legal form, 9-digit tax card check, currency, EAS/IFRS, fiscal year end, period dates, user role (Analyst / Reviewer / CFO). |
| 2 | Ingestion center | Trial balance, general ledger (parsed in 5,000-row chunks), AR, AP, fixed assets, inventory, payroll, bank statement, ETA e-invoices (JSON/XML). CSV or .xlsx, UTF-8 or Windows-1256 Arabic, SHA-256 per file, 25-row preview, downloadable templates, cross-reconciliation of every subledger to the TB, GL-vs-TB, bank reconciliation, ETA sales and VAT checks. |
| 3 | Validation & mapping | Debit = credit gate with the exact difference, confidence-scored suggestions (EN/AR keywords + chart-of-accounts prefix), search and confidence filters, bulk prefix rules (`110*` → Cash), unmapped holding class, AI-assisted mapping (suggestions only), confirm & lock. |
| 4 | Trial balance | 6-column TB (opening, activity, closing) grouped with subtotals, search and filters, click-to-source drawer (file, hash, row, rule, raw values, adjustments), adjusting journal entries, Excel export. |
| 5 | Financial statements | Balance sheet, income statement, changes in equity, comparative view with materiality flags, drill-down to accounts, assets = liabilities + equity assertion, EAS ↔ IFRS bridge (employee profit share and board remuneration). |
| 6 | Cash flows | Indirect method that classifies every balance-sheet movement (ties with zero plugs), derived direct method, waterfall from opening to ending cash. |
| 7 | Budgeting & BVA | Budget versions with approval, product lines, headcount, opex, working-capital targets and capex; budgeted P&L and cash; budget vs actual; price / mix / quantity revenue variance. |
| 8 | 3-statement model | Linked P&L, balance sheet and cash flow (3 years or 12 months), PP&E roll-forward, revolver and term loan with minimum cash and cash sweep, interest circularity solved by a bounded Gauss-Seidel loop (≤ 10 iterations) or beginning balances. |
| 9 | Analysis & diagnostics | Liquidity, profitability, efficiency (DSO/DIO/DPO/CCC) and leverage ratios, DuPont 3- and 5-step tree, Altman Z'' (emerging markets), Beneish M-score. |
| 10 | Scenarios & sensitivity | Base / bull / bear overrides on the model, 5×5 heatmap that reruns the model per cell, bank covenant monitor with breach flags. |
| 11 | Egyptian tax (TCS) | Book-to-tax schedule: depreciation add-back, provisions, fines, unsupported expenses over the allowance, thin capitalisation (4:1), statutory tax depreciation pools from the asset register (incl. 30% initial allowance), losses, WHT credits and advances, Form 41 summary from AP, deferred tax. |
| 12 | Disclosure studio | Notes triggered by balances (EAS / IAS references), filled with verified figures in EN or AR, `[Management Disclosure Required]` placeholders for facts the data cannot supply, Draft → Reviewed → Signed off workflow. |
| 13 | Benchmarking | Common-size statements and a KPI matrix across workspace companies, workspace median, analyst-entered industry benchmarks. |
| 14 | Valuation lab | WACC (CAPM + country risk premium slider), UFCF from the model, Gordon and exit-multiple terminal values, EV → equity bridge, trading comps, football field. |
| 15 | FX & stress tests | Currency tagging of monetary balances, exchange-rate shock slider, translation gain/loss, FX debt service, imported-COGS margin hit with pass-through, policy-rate shock on floating debt, stressed profit, solvency and cash runway. |
| 16 | Board pack & export | Excel workbook whose statements, cash flow and ratios are **live formulas** over the TB sheet (verified by recalculating in LibreOffice), and a printable bilingual board pack with optional AI executive commentary. |
| 17 | Audit trail & lineage | SHA-256 hash-chained, append-only log of every change with before/after values and chain verification; lineage explorer from statement line to source file hash; period state machine Draft → Mapped → Reconciled → Locked (CFO only), where a locked period accepts only adjusting entries with a logged reason. |

### Principles carried over from the specification

- **No fabricated data.** Market inputs (risk-free rate, ERP, peer multiples, FX rates, benchmarks) start empty and block their calculations until the analyst enters them. Only the fictional sample company is pre-filled, and it is labelled as such.
- **Calculation separate from narrative.** The `/api/explain` route recomputes the selected module on the server from the submitted data and sends the model only those figures, with instructions not to invent numbers. Account names are treated as data, never as instructions.
- **Traceability.** Every TB row keeps its source file, hash, row number and mapping rule; adjustments and framework bridge entries are separate, labelled rows.
- **Rules are parameters.** Tax rates, allowances, the thin-capitalisation ratio, tax depreciation pools, the legal-reserve rule and the employee profit-share percentage follow the specification and are shown as editable parameters to confirm with a tax or legal adviser.

### Run locally

```bash
npm install
cp .env.example .env.local   # add AI_GATEWAY_API_KEY to enable AI explanations
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key. Not needed on Vercel, where OIDC (`VERCEL_OIDC_TOKEN`) is used automatically. |
| `AI_GATEWAY_MODEL` | Optional model id, default `anthropic/claude-sonnet-5.5`. |
| `ETA_CLIENT_ID`, `ETA_CLIENT_SECRET`, `ETA_ENV` | Optional ETA e-invoicing API credentials (`ETA_ENV` = `preprod` or `prod`) for pulling issued invoices. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional defaults for the Team & sync page. |

Without a key everything except the AI panels works, and the panels say so.

### Data and storage

The workspace is saved in the browser (IndexedDB). Data leaves the browser only when you ask for an AI explanation or AI mapping suggestions (sent to the app's own API, then AI Gateway), convert an .xlsx file, or export Excel. For a multi-user deployment, `supabase/migrations/0001_ai_cfo_schema.sql` provides the schema from the specification with workspace-scoped row-level security, an append-only audit table and a trigger that rejects edits to locked periods; the store is not yet wired to it.

### Not included (needs credentials or infrastructure)

- ETA e-invoice signing and submission (needs an e-token / HSM signing adapter). Pulling issued invoices and offline JSON/XML exports are supported.
- Server-side workers for GL files beyond what a browser can hold; very large GLs are parsed in chunks in the browser.
- Real-time co-editing: team sync saves and pulls whole workspace versions.

### Scripts

- `npm test` — 129 Vitest tests, including the .xls/.ods/.docx/.dbf/HTML/SpreadsheetML/PDF/fixed-width readers, Arabic and two-row headers, validation rules, the cash forecast, the automatic pipeline and email intake parsing: engines, subledgers, model balancing and solver convergence, tax, valuation, stress, audit chain, Excel formulas, agent tools and offline mode, API routes, file detection, ERP presets, xlsx/zip/MT940/OFX readers, batch checks, consolidation, roll-forward, trends, anomaly rules, ETA client and team sync (mocked servers)
- `npm run lint` — ESLint with the Next.js core-web-vitals and TypeScript rules
- `npm run typecheck`
- `npm run build`
- `npm run build:html` — single-file `dist/ai-cfo.html` that runs every module in the browser with no server (in-page router, workspace in IndexedDB). Everything in "Upload everything at once" works there except scanned-document reading and the ETA pull; AI explanations (the agent runs in offline mode), Excel export, file downloads and team sync need the full app.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on every push and pull request.

### Other files

`legacy/tour-guide.html` is the earlier static tour-guide page, moved from `Index .html` (a filename with a space that web servers would not serve as an index).
