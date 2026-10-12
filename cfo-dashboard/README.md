# CFO Lens — financial statement analysis dashboard

Drop one or more financial statements (Excel, CSV or PDF), or paste the cells from Excel, and the **Full analysis** opens by itself: every analysis below on one page, in English or Arabic (switch at the top), ready to download as one **HTML file that carries both languages** with its own English / العربية and light / dark switches and needs no internet. An example made from the sample company is in `sample/example-full-analysis.html`.

Everything is computed instantly and entirely in your browser:

- **63 ratios** in eight groups — liquidity, profitability (incl. ROIC, NOPAT margin), efficiency (turnovers and days), leverage & solvency (debt/capital, debt/EBITDA, cash flow/debt…), cash flow, growth (revenue, EBITDA, net income, equity, sustainable growth), earnings quality (accruals, retention, Piotroski F-score) and distress (Altman Z'') — each with its formula, value for every year, sector typical value, trend arrow, health status and a plain-language sentence explaining what the number means.
- **14 key figures (KPIs)**: revenue, gross profit, EBITDA, net income, operating cash flow, free cash flow, cash, total debt, working capital, revenue growth, current ratio, debt/equity, ROE, ROIC — with sparkline and change on the prior year.
- **DuPont breakdown** of return on equity, 3-step and 5-step (tax burden × interest burden × EBIT margin × asset turnover × equity multiplier).
- **Vertical (common-size) analysis** — every line as % of revenue (income statement, cash flow) or % of total assets (balance sheet).
- **Horizontal (trend) analysis** — year-over-year change in amount and %, index vs the first year (=100), and CAGR.
- **Sector benchmarks**: pick the sector (general, trading & retail, manufacturing, services & technology, construction & real estate, food & beverage, healthcare). Ratings and red flags use that sector's limits, and the Ratios tab shows a typical sector value beside each ratio. The values are indicative rules of thumb, not published statistics; banks and insurers are not covered.
- **Red flags** (17 rules) with the evidence numbers and a recommended action, plus a list of strengths.
- **Forecast & scenarios**: 1–3 projected years from editable drivers (growth, margins, opex, depreciation, collection / stock / supplier days, capex, interest, tax, payout, new borrowing), defaulting to the company's own history. Base, upside and downside run side by side through the same ratios and red flags. The projected balance sheet balances with cash as the balancing item; a shortfall is shown as funding required.
- **Valuation (DCF)**: free cash flow to the firm from the forecast (growth fading to the long-run rate over 3–10 years), WACC from CAPM and the after-tax cost of debt, terminal value by the value-driver formula NOPAT × (1 − g ÷ RONIC) ÷ (WACC − g), enterprise value → equity value (→ per share and upside vs price when you enter shares and price), implied multiples, a 5 × 5 WACC × growth sensitivity grid, equity value under each scenario, and **EVA** (NOPAT − WACC × invested capital) for every year. Market inputs (risk-free rate, equity risk premium, beta) depend on the country and currency, so they are editable placeholders; cost of debt, tax rate and debt weight default to the company's own figures.
- **Action plan**: every recommendation in one prioritised table — red flags, returns below the cost of capital, and weak or watch ratios — with urgency (0–3, 3–6, 6–12 months), owner (treasury, sales, procurement, operations, finance, management, board), the KPI to track, its current value and the target. **Value levers** rank six operational changes (growth, gross margin, opex, collection days, stock days, capex) by the equity value each adds. These are proposals: nothing is sent, paid or posted.
- **Statement checks**: assets = liabilities + equity, net income = profit before tax − tax, gross profit = revenue − cost of sales, and operating + investing + financing cash flow = change in cash, each year, with the difference shown. A check that does not tie is the first item of the action plan, because it usually means a line was misread.
- **Cash-flow analysis**: indirect-method bridge from net income to the change in cash (with the "other" items the statements show), sources and uses of cash, free cash flow to the firm and to equity, cash-flow adequacy, FCF dividend cover and cash interest cover.
- **Break-even and cost analysis**: contribution margin, break-even and cash break-even revenue, margin of safety, operating / financial / combined leverage, revenue needed for a target profit, the high–low method across years and a cost-volume-profit chart. The variable share of cost of sales and operating expenses is editable.
- **Peer comparison** (Compare & value tab): type competitors' key figures or drop their statements; the company is ranked against the peer median and quartiles on growth, margins, returns, turnover, leverage and market multiples, with charts and a growth-vs-margin map. Peer figures stay in your browser. Ratios in the bottom quartile join the action plan.
- **Valuation by method**: DCF, EV/EBITDA, EV/revenue and P/E multiples (peer quartiles or values you type), dividend discount model and book value, shown as a football field with an editable weighted value range.
- **Budget vs actual**: add a budget file or paste it; every line shows actual, budget, variance, % and favourable/adverse (lower costs are favourable), plus a net income walk (volume, margin, operating costs, depreciation, interest, tax). Without a budget the latest year is compared with the prior year. Adverse variances above 10% join the action plan.
- **CFO commentary by Claude** (on the claude.ai link): a board-style commentary in Arabic or English, or an answer to your own question, written from the computed figures only (the files themselves are not sent). It asks for your permission the first time and is marked as machine-generated in the report.
- **Financial health score** (0–100, grade A–E) and an executive summary.
- **Reports** (on the claude.ai link the viewer asks before saving a file): **full-analysis HTML** (English + Arabic in one file, inline charts, works offline), **PDF** (drawn from the on-screen report, so Arabic looks exactly as on screen; text is not selectable), **Word** (.docx, editable, right-to-left for Arabic), **Excel** workbook (Summary, Data, Ratios, Vertical, Horizontal, Red flags, Forecast, Action plan, Valuation, Cash flow, Peers & methods, Variance, Claude, Mapping), HTML, and a Markdown summary to paste into email or chat.
- **English / Arabic** (full right-to-left layout), light / dark theme, works on phones.

No data leaves your computer: there is no server and no upload.

## Use it

Open the single-file build `dist/cfo-lens.html` in a browser (double-click works, also offline: the libraries are bundled inside), or `index.html` (loads the libraries from cdnjs). It opens with a fictional example company; add your own files to replace it in any of three ways:

- drag them onto the page,
- click the drop card (or **Choose files**),
- copy the files in your file manager and paste them into the page (Ctrl+V / ⌘V).
- or **paste cells from Excel**: select the statement (labels + year columns, with the year row), copy, and paste into the "Paste from Excel" box (or anywhere on the page). This works even where file access is blocked.

If something does not work, open **Data review → Diagnostics** and press **Copy diagnostics**: it lists the browser, the libraries, what the page received and which lines it recognised (labels only unless you tick "Include figures"). When key items are missing, the Overview names them, and the health score is shown only when at least three areas can be rated.

After reading, a line under the drop card says what was found in each file (tables, lines, how many matched standard items). If a file cannot be used, a red message says why and the example stays on screen.

**Several files at once** are merged: e.g. income statement + balance sheet + cash flow as separate files, or one file per year. If two files disagree on the same item and year, the first is kept and the conflict is listed under *Data review*.

### What the files should look like

One row per line item, one column per year:

| Line item | 2023 | 2024 |
|---|---:|---:|
| Revenue | 58,000 | 61,000 |
| Cost of sales | (35,960) | (39,650) |
| … | | |

- Year headers can be `2024`, `FY2024`, `31/12/2024`, `٢٠٢٤`, `2024م`, a date-formatted Excel cell, or `Current year / Prior year` (`السنة الحالية / السنة السابقة`). Columns may be newest-first, and labels may sit left or right of the numbers.
- Numbers can use thousands separators (`1,234`, `1.234,56`, `1 234`), parentheses or a minus for negatives, Arabic-Indic digits, currency labels. A "Note / إيضاح" column is ignored.
- Title blocks, units rows and several statements stacked in one sheet are fine: each statement's own year header is used.
- CSV files may use commas, semicolons or tabs, and be saved as UTF-8, UTF-16 ("Unicode text") or Windows-1256 (Excel on Arabic Windows).
- PDFs: the year columns carry over to continuation pages, labels wrapped over two lines are joined, and prose and page footers are skipped.
- Each sheet of an Excel workbook is read separately. PDFs must contain real text (exported from accounting software), not a scan.
- Labels are matched in English and Arabic in three stages: exact synonyms (≈300 in `js/catalog.js`), ordered keyword rules covering IFRS, Egyptian and Gulf wording (cash-flow totals before cash, depreciation before PP&E, "before tax" before tax…), then partial synonyms; 240 real-world labels are checked in `tests/labels.test.mjs`. "Other …", non-current, accumulated, payable-to-tax and similar lines are never taken for the main item. Items split over several lines (selling + administrative expenses; short-term loans + overdraft + current portion) are added up unless the file shows their total. Anything unmatched still appears in vertical/horizontal analysis, and you can map it by hand in **Data review**.
- **Years**: read from headers such as `2024`, `31 December 2024`, `٢٠٢٤م`, `FY 2023/24` (named by the year it ends), long Arabic headers, or date cells. Data review → **Years** shows the years found per file; correct them, or type them when a file has none (the page tells you when that is needed).

Examples in `sample/`: three English CSVs, a 3-sheet Excel workbook, an Arabic CSV, and a PDF. Harder real-world layouts used by the tests are in `tests/fixtures/`.

## How the numbers are computed

- Formulas are listed beside every ratio in the *Ratios* tab and in `js/analysis.js`.
- Turnover, ROA, ROE, DSO, DIO, DPO use the **average** of opening and closing balances when the prior year exists.
- Expenses are stored as positive costs whatever sign the file uses.
- Missing subtotals are derived from accounting identities (e.g. gross profit = revenue − cost of sales) and tagged *derived*.
- Status colours (Healthy / Watch / Weak) use the selected sector's limits in `js/benchmarks.js` (rules of thumb, not market statistics), falling back to the `good`/`bad` thresholds in `RATIOS` in `js/analysis.js`.
- Growth ratios compare each year with the one before; ROIC uses average debt + equity; the Piotroski F-score runs the tests the statements allow (share issuance is not read) and scales the result to 9.
- DCF: end-of-year discounting; the return on new investment in the terminal value is the higher of the latest ROIC and WACC; WACC must exceed terminal growth by at least 0.5 points. Red-flag rules are in `js/insights.js`.
- Altman Z'' is the non-manufacturing / emerging-market version: 6.56·WC/TA + 3.26·RE/TA + 6.72·EBIT/TA + 1.05·Equity/TL.

## Project layout

```
index.html            page shell
css/styles.css        design tokens, layout, RTL, dark mode, print
js/catalog.js         standard line items + EN/AR synonyms, label matching
js/parsers.js         Excel (SheetJS), CSV (PapaParse), PDF (pdf.js) readers
js/mapper.js          merge files, derive subtotals, data checks
js/analysis.js        ratios, DuPont, Altman, vertical, horizontal, health score
js/benchmarks.js      sector limits and typical values
js/forecast.js        driver-based forecast and scenarios
js/valuation.js       DCF, WACC, sensitivity, EVA, value levers, action plan
js/cashflow.js        statement checks, cash-flow bridge, sources and uses, break-even
js/peers.js           peer comparison, multiples, dividend discount, football field
js/variance.js        budget vs actual and the net income walk
js/ai.js              Claude commentary (claude.ai viewer only)
js/i18n.js            UI text, ratio names and meanings (EN/AR), formatting
js/insights.js        red-flag rules, strengths, executive summary
js/charts.js          Chart.js charts and KPI sparklines
js/report.js          report model and PDF / Word / Excel / HTML / Markdown exports
js/app.js             UI state and rendering
sample/               example input files
tests/                node tests
tools/build-single.mjs  bundle into dist/cfo-lens.html
package.json          pinned library versions for the build
```

## Develop

```
node --test cfo-dashboard/tests/analysis.test.mjs   # unit tests (no install needed)
npm install --prefix cfo-dashboard                  # once: fetch the pinned libraries
npm test --prefix cfo-dashboard                     # unit tests + real-world fixtures (tests/fixtures/)
node cfo-dashboard/tools/build-single.mjs          # single-file build with libraries inlined
```

Libraries (pinned): SheetJS 0.18.5, PapaParse 5.4.1, pdf.js 3.11.174, Chart.js 4.4.1, html2canvas 1.4.1, jsPDF 2.5.1, docx 8.5.0. `index.html` loads them from cdnjs / jsDelivr; `dist/cfo-lens.html` has them inlined. pdf.js runs on the page's main thread (its worker script is loaded as a normal script), so it also works where web workers are blocked. If a library fails to load, the page names it in a red banner.

## Limits

- Scanned PDFs (images) are not read; export the statements to Excel/CSV.
- Quarterly columns are kept separate (`2024 Q1`), but annualised ratios (DSO, ROE…) assume each column is a full year.
- Not a substitute for an audit: check the *Data review* tab and the "Items for human review" in the report before acting on the results.
