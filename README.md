# Sara Salem
AI creator

## AI CFO — Financial Intelligence Platform

A bilingual (English / Arabic, RTL) Next.js app for Egyptian finance teams, built from the *AI CFO Financial Intelligence Master Prompt* (v3/v4). It covers all 17 modules of the specification. Every number is produced by deterministic, tested TypeScript; AI (through **Vercel AI Gateway**) only explains figures the server has recomputed, and suggests account mappings for the analyst to confirm.

Try it: **Load complete sample company** on the home page loads a fictional Egyptian trading company with a trial balance, general ledger and every subledger, so each module can be explored immediately.

### AI CFO agent

The **AI CFO agent** page (`/agent`) is a chat assistant that works on the selected company's books. It answers in English or Arabic and gets every figure by calling the app's calculation engines as tools; it never computes figures from memory.

| Tool | What it does |
|---|---|
| `get_overview`, `get_statement`, `get_variances`, `get_ratios` | Headline figures, validation, statements, variances, ratios, DuPont, Altman, Beneish |
| `find_accounts`, `get_subledger` | Account search (EN/AR) with lineage; AR, AP, fixed assets, inventory, payroll, bank, ETA and GL analysis with tie-outs |
| `get_tax_computation`, `get_budget_vs_actual`, `get_disclosures`, `compare_peers` | Tax schedule, budget vs actual, note status, peer KPIs |
| `run_forecast`, `run_sensitivity`, `run_valuation`, `run_stress_test` | What-if runs of the 3-statement model, sensitivity grid, DCF and FX/rate stress. Nothing is saved |
| `propose_adjusting_entry`, `propose_mapping_change` | Drafts only, with an impact preview. Nothing changes until you click **Post entry** / **Apply mapping**, and the approval is written to the audit log |

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

Without a key everything except the AI panels works, and the panels say so.

### Data and storage

The workspace is saved in the browser (IndexedDB). Data leaves the browser only when you ask for an AI explanation or AI mapping suggestions (sent to the app's own API, then AI Gateway), convert an .xlsx file, or export Excel. For a multi-user deployment, `supabase/migrations/0001_ai_cfo_schema.sql` provides the schema from the specification with workspace-scoped row-level security, an append-only audit table and a trigger that rejects edits to locked periods; the store is not yet wired to it.

### Not included (needs credentials or infrastructure)

- Direct ETA e-invoicing API submission (needs an e-token / HSM signing adapter and API credentials). Offline ETA JSON/XML exports are supported.
- MT940 / OFX bank formats (CSV bank exports are supported).
- Server-side workers for GL files beyond what a browser can hold; very large GLs are parsed in chunks in the browser.
- Multi-user authentication (see the Supabase migration above).

### Scripts

- `npm test` — 73 Vitest tests: engines, subledgers, model balancing and solver convergence, tax, valuation, stress, audit chain, Excel formulas, agent tools, API routes
- `npm run lint` — ESLint with the Next.js core-web-vitals and TypeScript rules
- `npm run typecheck`
- `npm run build`

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on every push and pull request.

### Other files

`legacy/tour-guide.html` is the earlier static tour-guide page, moved from `Index .html` (a filename with a space that web servers would not serve as an index).
