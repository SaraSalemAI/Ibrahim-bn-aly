# Sara Salem
AI creator

## AI CFO — Trial Balance Explainer (prototype)

A Next.js app for Egyptian finance analysts, built from the *AI CFO Financial Intelligence* master prompt. You enter a trial balance and the app:

1. **Validates** it: debits = credits for each period (with the exact difference), unmapped and auto-suggested accounts, negative amounts.
2. **Maps accounts** to a canonical chart. Blank categories are suggested from English or Arabic account names (e.g. `العملاء` → Trade receivables) and flagged until you confirm them. Unmapped accounts sit in a holding line, so totals still tie while the statements are a draft.
3. **Builds statements** (income statement and balance sheet) for the current and prior period, with variances and materiality flags (≥1% of revenue or total assets and ≥10% movement).
4. **Computes key ratios** (liquidity, profitability, efficiency incl. cash conversion cycle, leverage). A ratio whose denominator is zero shows *n/a*; it is never guessed.
5. **Projects 3-year scenarios** (base / bull / bear) from editable drivers. The defaults come from your own figures; tax defaults to the 22.5% Egyptian statutory rate.
6. **Explains everything in plain English or Arabic** through **Vercel AI Gateway**. The server recomputes the analysis with the same deterministic engine and sends the model only those figures, with instructions not to invent numbers.

All calculations are deterministic TypeScript (`lib/finance/`) and run in the browser. Only step 6 calls a model.

### Run locally

```bash
npm install
cp .env.example .env.local   # add AI_GATEWAY_API_KEY
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` | AI Gateway key. Not needed on Vercel, where OIDC (`VERCEL_OIDC_TOKEN`) is used automatically. |
| `AI_GATEWAY_MODEL` | Optional model id, default `anthropic/claude-sonnet-5.5`. |

Without a key the app still works; the AI panel shows a "not configured" notice.

### Trial balance format

CSV with a header row (comma, semicolon or tab separated, UTF-8 or Windows-1256):

```
code,name,category,current_debit,current_credit,prior_debit,prior_credit
```

`category` and the prior columns are optional. Amounts accept `1,234.50`, `(500)` and Arabic-Indic digits. The trial balance is treated as **pre-closing**: profit for the period is added to equity on the balance sheet. Use **Load sample** for an illustrative (fictional) company, or **Download template**.

### Scripts

- `npm test` runs the engine and API route tests (Vitest)
- `npm run typecheck`
- `npm run build`

### Limits of this prototype

- The tax figure is indicative (22.5% × profit before tax). It is not a full tax computation with add-backs under Law 91/2005.
- Ratios use closing balances, not averages.
- The forecast covers the P&L only: depreciation and other income are held flat, and finance costs move by the driver.
- AI output is analysis support. It is not audit, tax or investment advice.

### Other files

`legacy/tour-guide.html` is the earlier static tour-guide page. It was moved here from `Index .html`, a filename with a space that no web server would serve as an index.
