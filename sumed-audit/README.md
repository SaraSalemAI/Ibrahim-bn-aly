# SUMED AI Internal Audit, Risk & Continuous Controls Monitoring Platform

Evidence-driven Internal Audit platform for **Arab Petroleum Pipelines Company (SUMED), Alexandria**. Bilingual (English ↔ العربية, LTR ↔ RTL), light/dark, role-based.

It is not pre-loaded with any figures. **Uploaded data is the only source of truth.** With no data, the app shows *UPLOAD YOUR DATA TO START THE AUDIT* and the list of required datasets.

## Run

```bash
cd sumed-audit
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (vitest)
npm run build      # static build in dist/ (can be hosted on any static web server)
```

## What it does

| Area | Implementation |
|---|---|
| Upload | Drag & drop of multiple files, sheets and periods: `.xlsx`, `.csv/.tsv`, text-based `.pdf` (table extraction), `.docx`/`.txt` (stored as policy evidence). History is kept. |
| Ingestion & data quality | Header detection, dataset classification (17 types), EN/AR field mapping (editable), duplicates, blanks, invalid types, date anomalies, currency issues, unbalanced journals, unmapped accounts, totals checks, outliers, and a Data Quality Score. |
| Audit tests | 117 deterministic tests: GL/journals, AP, AR, bank/treasury, fixed assets, inventory, procurement, payroll, CAPEX/OPEX/budget, tax, loans, contracts, related parties, **site payments & contracts**, and 11 reconciliations (GL↔TB, AP/AR/FA/inventory/loans/bank↔GL, bank↔GL transaction matching with ageing, tax, payroll, intercompany). |
| Site review | Payments and contracts by **Head Office (المركز الرئيسي), Ain Sokhna (السخنة), Sidi Kerir (كرير), Dahshour (دهشور)**. Sites are configurable and matched by EN/AR keywords. Tests: unallocated payments, payments after contract expiry, cross-site contract use, significant spend without a contract, contracts without a site. A site filter applies across the whole platform. |
| Findings | Condition / Criteria / Cause / Effect, a rating based on materiality, exposure by currency, 9-point evidence validation, AI confidence, and a status workflow (draft → review → validated → official; making a finding official requires a Senior Auditor/CAE and QC ≠ FAIL). |
| SHOW EVIDENCE | Finding → Risk → Control → Audit test → Calculation (formula + actual inputs) → Transaction → Source record → File (SHA-256) → Sheet → Row, with highlighted source fields and original/translated values. |
| Risk & control | Risk register (22 risks), Impact × Likelihood heatmap with drill-down, control library (37 controls) with an effectiveness score, audit universe with CAE-editable weights, risk-based audit plan. |
| Follow-up | Recommendations (Top 10, Immediate / Short / Medium / Long), management action tracker with automatic overdue flags and IA validation before closure, change monitor (new / repeat / resolved exceptions, new entities) against saved cycle snapshots. |
| Dashboards | Executive overview, CFO, Audit Committee, Platform Quality Check (PASS / WARNING / FAIL gate) and the Executive Insight Engine (Top-10 lists). |
| Copilot | Deterministic and evidence-grounded. It answers from computed results only and cites findings/risks/controls/tests. |
| Reports & exports | 24 reports (on screen, PDF via the print engine, CSV), a 26-sheet Excel workbook, and evidence packages (Excel/CSV/PDF). All in EN or AR. |
| Audit trail | Append-only, SHA-256 hash-chained log (uploads, mapping changes, evidence views, status changes, exports, settings), with an integrity check. |

## No-hallucination design

- No amounts, ratios, thresholds or policies are invented. Tests that need company facts (materiality, approval limits, holidays, working hours, fiscal year-end) report **INSUFFICIENT DATA — TEST NOT PERFORMED** until those facts are configured.
- Amounts keep their source currency. Nothing is FX-converted or assumed unless the user ticks an explicit, labelled assumption.
- Results are tagged SOURCE DATA / CALCULATION / AI INTERPRETATION / RISK ASSESSMENT / RECOMMENDATION / ASSUMPTION.
- Fraud items are labelled *Fraud Risk Indicator — Requires Investigation*.
- Source rows are frozen and files are hashed. Mapping changes are metadata only and are logged.

## Current limitations (honest scope)

- **Client-side application.** Data is stored in the browser (IndexedDB) of the machine that uploads it. Role-based access is enforced in the UI only. Production use needs a backend with authentication, server-side authorization and central storage. The engine (`src/engine`) is UI-independent and ready to move server-side or to connect to the ERP.
- Scanned PDFs need OCR and are flagged rather than read. Legacy `.xls` must be re-saved as `.xlsx`/CSV.
- The copilot uses intent matching over the computed results, not a generative model. This is intentional, so it cannot produce unsupported statements.
- Financial-statement classification uses the TB *FS Classification* column, or account-name keywords when that column is missing (shown as the classification basis).
- Standards (EAS, IFRS, COSO, IIA, Egyptian tax) are referenced structurally. No compliance is claimed.

## Structure

```
src/engine/   parsing, classification, data quality, tests/, findings, risk/control scoring, FS analytics, copilot, insights
src/store/    IndexedDB persistence + hash-chained audit trail
src/i18n/     bilingual dictionary + audit terminology glossary
src/pages/    UI modules
tests/        unit tests (synthetic fixtures only — not SUMED data)
```
