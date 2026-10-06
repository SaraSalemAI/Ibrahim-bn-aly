# SUMED P2P — Integration API

The application is a set of deterministic engines over normalised entities (see `DATA_MODEL.md`). The same code runs in the browser and in Node (see `tests/load.js`), so it can be embedded in a server, a scheduled job, or called from ERP / bank / TMS connectors.

## Browser API — `window.SUMED.api`

| Call | Returns |
|---|---|
| `load(data, { source })` | Appends canonical records, e.g. `{ suppliers:[…], invoices:[…], payments:[…], bankTxns:[…] }`. Each record gets lineage `{file: source, sheet: entity, row}`; switches to LIVE mode; writes an audit entry. Returns the data-quality summary. |
| `kpis()` | KPI library — each KPI `{ id, label, value, unit, kind, formula, inputs, assumptions, excluded, unavailable, sources:[{file, sheet, rows}], rows:[{entity,key}] }` |
| `redFlags()` | Fraud / anomaly / control / liquidity / data-quality flags `{ id, category, severity, rule, params, rows, txn, amountBase, action }` |
| `match(invoiceNo)` | Three-way match result `{ status, flags, reasons, poAmount, grnAmount, invAmount, variance, variancePct, lines[] }` |
| `paymentProposal()` | Ranked queue `{ invoiceNo, supplierId, score, recommendation, blocks, components }` — **recommendation only** |
| `cashForecast()` | Per-currency and consolidated daily forecast, 13-week roll-up, assumptions |
| `controls()` | Control tests `{ id, domain, population, count, status, exceptions }` |
| `dataQuality()` | Data Quality & Control Report |
| `audit()` | Append-only, hash-chained audit trail |
| `exportWorkspace()` | Full workspace JSON (data + config + audit) for archiving or BI (e.g. Power BI JSON connector) |
| `run()` | Recompute everything |

## Engine functions — `window.SUMED.engine`

`prepare`, `duplicateInvoices`, `duplicatePayments`, `threeWay`, `aging`, `dpo`, `spend`, `contracts`, `supplierDocs`, `onboarding`, `performance`, `anomalies`, `supplierRisk`, `priority`, `forecastItems`, `cashForecast`, `paymentForecast`, `scenario`, `bankRecon`, `registerRecon`, `sod`, `authorityCheck`, `controlTests`, `dataQuality`, `savings`, `workingCapital`, `insights`, `actions`, `autoAlerts`, `kpis`, `requiredApprovers`, `lineage`, `sourceSummary`.

All take `(D, P, cfg, asOf, ctx)` style arguments and have no side effects; `run()` orchestrates them and stores the result in `SUMED.R`.

## Mapping to ERP / bank sources

| SUMED entity | SAP S/4HANA (typical) | Oracle EBS / Fusion (typical) | Bank / TMS |
|---|---|---|---|
| suppliers | LFA1 / LFB1 / LFBK (BP) | AP_SUPPLIERS / SITES / IBY_EXT_BANK_ACCOUNTS | — |
| pos / poLines | EKKO / EKPO | PO_HEADERS / PO_LINES | — |
| grns / grnLines | MSEG / EKBE (101) | RCV_TRANSACTIONS | — |
| invoices / invoiceLines | RBKP / RSEG, BSIK / BSAK | AP_INVOICES / AP_INVOICE_LINES | — |
| payments | REGUH / REGUP, PAYR | AP_CHECKS / AP_INVOICE_PAYMENTS | — |
| bankTxns | FEBEP (EBS) | CE_STATEMENT_LINES | MT940 / camt.053 |
| bankChanges | CDHDR / CDPOS (LFBK) | audit tables | — |
| gl | FAGLFLEXT (AP recon account) | GL_BALANCES | — |

Payment files: the batch export produces CSV plus an ISO 20022 **pain.001.001.03** template; validate against the bank's implementation guide before go-live. Bank statements in MT940 / camt.053 can be converted to the `bankTxns` shape (`txnId, accountId, date, debit/credit or amount, reference, description`).

## Production deployment notes

- Run the engines server-side (Node) behind SSO; store records and the audit log in a database with append-only permissions; enforce `S.can()` permissions on the server.
- Keep configuration (approval matrix, tolerances, tax codes, FX source, holidays) under change control — every change is already audit-logged.
- Schedule `run()` after each ERP extract and push alerts (e-mail / Teams) from `autoAlerts`.
