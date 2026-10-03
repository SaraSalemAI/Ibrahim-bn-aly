# CFO Lens — financial statement analysis dashboard

Drop one or more financial statements (Excel, CSV or PDF) into the page and get, instantly and entirely in your browser:

- **30 ratios** in six groups — liquidity, profitability, efficiency, leverage & solvency, cash flow, distress (Altman Z'') — each with its formula, value for every year, trend arrow, health status and a plain-language sentence explaining what the number means.
- **DuPont breakdown** of return on equity.
- **Vertical (common-size) analysis** — every line as % of revenue (income statement, cash flow) or % of total assets (balance sheet).
- **Horizontal (trend) analysis** — year-over-year change in amount and %, index vs the first year (=100), and CAGR.
- **Sector benchmarks**: pick the sector (general, trading & retail, manufacturing, services & technology, construction & real estate, food & beverage, healthcare). Ratings and red flags use that sector's limits, and the Ratios tab shows a typical sector value beside each ratio. The values are indicative rules of thumb, not published statistics; banks and insurers are not covered.
- **Red flags** (17 rules) with the evidence numbers and a recommended action, plus a list of strengths.
- **Forecast & scenarios**: 1–3 projected years from editable drivers (growth, margins, opex, depreciation, collection / stock / supplier days, capex, interest, tax, payout, new borrowing), defaulting to the company's own history. Base, upside and downside run side by side through the same ratios and red flags. The projected balance sheet balances with cash as the balancing item; a shortfall is shown as funding required.
- **CFO commentary by Claude** (on the claude.ai link): a board-style commentary in Arabic or English, or an answer to your own question, written from the computed figures only (the files themselves are not sent). It asks for your permission the first time and is marked as machine-generated in the report.
- **Financial health score** (0–100, grade A–E) and an executive summary.
- **Reports** (on the claude.ai link the viewer asks before saving a file): **PDF** (drawn from the on-screen report, so Arabic looks exactly as on screen; text is not selectable), **Word** (.docx, editable, right-to-left for Arabic), **Excel** workbook (Summary, Data, Ratios, Vertical, Horizontal, Red flags, Forecast, Claude, Mapping), HTML, and a Markdown summary to paste into email or chat.
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
- Labels are matched in English and Arabic (≈300 synonyms in `js/catalog.js`). Anything unmatched still appears in vertical/horizontal analysis, and you can map it by hand in **Data review**; the whole analysis updates immediately.

Examples in `sample/`: three English CSVs, a 3-sheet Excel workbook, an Arabic CSV, and a PDF. Harder real-world layouts used by the tests are in `tests/fixtures/`.

## How the numbers are computed

- Formulas are listed beside every ratio in the *Ratios* tab and in `js/analysis.js`.
- Turnover, ROA, ROE, DSO, DIO, DPO use the **average** of opening and closing balances when the prior year exists.
- Expenses are stored as positive costs whatever sign the file uses.
- Missing subtotals are derived from accounting identities (e.g. gross profit = revenue − cost of sales) and tagged *derived*.
- Status colours (Healthy / Watch / Weak) use **general rules of thumb**, not industry benchmarks. Edit `good`/`bad` thresholds in `RATIOS` in `js/analysis.js` for your sector. Red-flag rules are in `js/insights.js`.
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
