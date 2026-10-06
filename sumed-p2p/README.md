# SUMED Supplier & Payments Management System

**SUMED — Arab Petroleum Pipelines Company · Alexandria, Egypt**
**سوميد — منظومة الموردين والمدفوعات**

An evidence-first Supplier-to-Payment / Procure-to-Pay control platform: supplier governance, procurement control, accounts payable, payment management, treasury, risk, fraud detection, internal control, audit and CFO decision support — bilingual (English / العربية, full RTL), light / dark, role-based.

> **No invented data.** Every figure is computed from files you upload. Missing inputs show **"Not Available in Source Data"**, calculations that cannot be performed say why, assumptions are labelled **ASSUMPTION**, calculated values **DERIVED**, raw values **SOURCE VALUE**. Without uploads you can start **DEMO MODE**, where every record is stamped **DEMO / SYNTHETIC DATA** and is not SUMED data.

---

## Run it

No build step and no runtime dependencies.

| Option | How |
|---|---|
| Open directly | Open `sumed-p2p/index.html` in Chrome / Edge / Firefox (works from `file://`). |
| Local server | `npm start` (or `node tools/serve.js 8080`) → http://localhost:8080 |
| Tests | `npm test` — 43 automated QA checks (see `docs/QA.md`) |
| Sample files | `npm run samples` → `samples/` (synthetic CSV, Excel and PDF files to try the upload path) |
| Docs | `npm run docs` regenerates `docs/DATA_MODEL.md` and `docs/RULES.md` from the code |

Excel, PDF, Word and ZIP parsers are bundled in `vendor/` (offline-capable; CDN fallback). OCR of **scanned** PDFs / images loads Tesseract on demand from `cdn.jsdelivr.net`, so it needs internet access; everything else runs locally in the browser. Files are not uploaded to any server.

## The workflow

**UPLOAD → VALIDATE → EXTRACT → RECONCILE → ANALYZE → DASHBOARD → REPORT**

1. **Upload** many files at once (drag & drop): Excel (multi-sheet), CSV, PDF, scanned PDF, images, Word, ZIP, JSON.
2. **Classify & map** — each sheet is classified (Supplier Master, Invoice Register, POs, GRNs, Contracts, Payment Register, Bank Statement, FX, Tax, GL, Budget, …) and columns are mapped from English or Arabic headers. Classification and mapping are shown for review and can be corrected before loading.
3. **Validate** — the *Data Quality & Control Report* (counts, currencies, date ranges, duplicates, missing/invalid values, invoices without PO/GRN/approval, payments without approved invoice or bank reference, FX not available, …) with LOW / MEDIUM / HIGH / CRITICAL severity.
4. **Extract** — invoice PDFs / images are text-extracted (OCR when scanned) with a confidence score per field, page and evidence snippet; users correct fields (every correction is audit-logged) and post to the invoice register.
5. **Reconcile / analyze** — three-way matching, duplicates, aging, risk, fraud rules, controls, bank and register reconciliations, forecasts.
6. **Dashboards & reports** — every KPI opens its lineage (**SOURCE → CALCULATION → RESULT**) and every finding has **Show evidence** (finding → calculation → transaction → file · sheet · row / page).

## Requirement coverage

| # | Requirement | Where |
|---|---|---|
| 1–2 | Design principles, upload-first, classification | Upload & Validate; `js/data/ingest.js`, `js/data/schema.js` |
| 3 | Data validation engine & report | Data Quality; `E.dataQuality` |
| 4–6 | Supplier master (masked bank data), onboarding (10 stages, document checklist), explainable risk | Suppliers, Supplier 360°, Onboarding, Risk & Compliance |
| 7–8 | P2P visibility PR → RFQ → PO → GRN → Invoice → Approval → Payment; PO register with derived balances & statuses | Procurement, Purchase Orders, record drawer chain |
| 9 | Three-way matching with variance amount / % | Three-Way Matching; `E.threeWay` |
| 10–12 | Invoice lifecycle, OCR with field confidence & logged corrections, duplicate detection with reasons | Invoices, Upload (OCR review), Duplicate Detection |
| 13–16 | Payments, AI-assisted proposal & priority queue (never auto-executes), batches, configurable approval matrix | Payments (queue / proposal / batches / register) |
| 17 | Segregation of duties (transactional + role design) | Controls → SoD; enforced in every workflow |
| 18–20 | Multi-bank, cash & liquidity (daily / weekly / monthly / 13-week), payment forecast by dimension | Banks, Treasury |
| 21–22 | AP aging buckets, DPO (only when GL inputs exist) | AP Aging |
| 23–25 | Performance scorecards (configurable weights), spend analytics, concentration (Top 5/10/20, HHI) | Supplier Performance, Spend Analytics |
| 26–28 | Contracts & alerts, tax (rates never assumed), FX (rates never invented) | Contracts, Tax & FX |
| 29–31 | Fraud & anomaly engine, Red Flags Center (11 categories), evidence-first | Fraud & Anomalies |
| 32–34 | Insights (observation · why · impact · evidence · root cause · action · priority · owner), cost reduction with transparent method, working capital | AI Insights, Cost Reduction & WC |
| 35–41 | CFO / Treasury / AP / Procurement / Supplier dashboards, payment calendar, priority queue | Dashboard (incl. the 16 CFO questions), module pages |
| 42–45 | Disputes, immutable audit trail (hash-chained), Finance Control Center, 44 automated control tests | Disputes, Audit Trail, Controls |
| 46–47, 66 | 21 management reports (Excel / PDF / CSV), management summary "What does the CFO need to know today?" | Reports, Management Summary |
| 48–49 | Drill-down everywhere; lineage for every KPI | KPI tiles, tables, record drawer |
| 50 | Scenario analysis labelled **SCENARIO — NOT ACTUAL** | Treasury → Scenario analysis |
| 51–52 | Role-based access (15 roles, least privilege), masking with logged reveal | Header role selector, Settings → Users & roles |
| 53–55 | Bilingual EN/AR with RTL, light/dark, enterprise finance design | Header toggles; `js/core/i18n-ar.js` (100 % coverage enforced by tests) |
| 56–57 | Navigation, global search (`/`), filters | Sidebar, header search, table filters |
| 58–59 | Register and bank reconciliation | Reconciliation, Banks |
| 60–65 | KPI library, explainability, no-hallucination labels, confidence, action center, configurable alerts | KPI tiles, Action Center, Settings → alerts |
| 67 | Demo mode with synthetic, labelled data | "Start Demo Mode" |
| 68–69 | Normalised data model (26 entities), API & ERP-integration readiness | `docs/DATA_MODEL.md`, `docs/API.md`, `window.SUMED.api` |
| 70 | Final validation / QA | `npm test`, `docs/QA.md` |

## Architecture

```
index.html                  shell + script order (classic scripts → works on file://)
css/app.css                 tokens, light/dark, RTL (logical properties), responsive, print
js/core/                    util (parsing, dates, hashing, IBAN, CSV), config (illustrative defaults),
                            store (state, permissions, masking, hash-chained audit, persistence), i18n (+ Arabic)
js/data/                    schema (26 entities, EN/AR synonyms, classifier), ingest (parsers, mapping,
                            OCR extraction), demo (seeded synthetic generator with injected control failures)
js/engines/                 pure functions over normalised data:
  core.js                   preparation, FX lookup, lineage objects, approval matrix
  matching.js               duplicate invoices & payments, three-way match
  finance.js                aging, DPO, priority queue, forecast items, cash forecast, scenarios
  supplier.js               documents, onboarding, spend & concentration, contracts, performance, risk
  fraud.js                  anomaly & fraud rules (each with evidence)
  controls.js               data quality, bank & register reconciliation, SoD, authority, control tests
  insights.js               savings, working capital, insights, action center, alerts, KPI library, run()
js/ui/                      components (KPI tiles, tables, drawer, evidence & lineage modals), SVG charts
js/views/                   one module per page group
js/reports.js               report definitions; native .xlsx writer (no library); PDF via print
js/app.js                   router, header, events, workflows (approvals, batches, onboarding, bank change), API
vendor/                     SheetJS, pdf.js, JSZip, mammoth (licenses in vendor/licenses)
tests/                      Node QA suite (loads the same browser scripts in a VM)
tools/                      sample generator, docs generator, i18n coverage checker, static server
```

Performance: a full recompute over ~10,000 invoices, 7,400 payments and 1,500 suppliers takes about 4–5 s in Node on a laptop-class CPU (browser similar). The engines are deterministic and side-effect free (`S.engine.run()` recomputes everything from `S.state.data` + `S.state.config`), which makes them testable in Node and portable to a server.

## Controls built into the workflows

- **Invoice approval**: required approvers come from the configurable matrix (amount tier + escalation rules: supplier risk, emergency, foreign currency, non-PO); multi-level approvals accumulate until covered; the person who entered an invoice cannot approve it; approving an invoice with a match exception requires a documented override reason.
- **Payment batches**: created only from unblocked, approved invoices; one batch per currency; Treasury approval always, CFO approval when the matrix requires it; creator ≠ approver ≠ executor ≠ reconciler; an invoice approver cannot approve its payment; modifying a batch resets approvals; the bank file (CSV + ISO 20022 pain.001 template) exports masked IBANs unless the role may view sensitive data. **The system never executes a payment** — "Record bank execution" only records what the bank did.
- **Supplier bank changes** are stored as UNVERIFIED and flagged until an independent call-back is recorded by a different user.
- Every change writes an append-only, hash-chained audit entry (user, role, session, timestamp, old/new value, reason).

## Honest limitations (read before production use)

- **Client-side application.** Data, settings and the audit trail live in the browser (localStorage, ~5 MB) and can be exported/imported as JSON. The role selector simulates sign-in so role-based access and SoD can be exercised; for production, put the engines behind a server with SSO (e.g. Azure AD), a database and server-side permission enforcement. The audit log is immutable from the UI and tamper-evident (hash chain), not tamper-proof against someone with file-system access.
- **"AI" is deterministic and explainable**: rule-based detection, robust statistics and heuristic OCR field extraction — no language model and no estimates. Confidence scores for OCR are heuristic.
- The client cannot see its public **IP address**; the audit field says so. A server deployment would fill it in.
- Approval thresholds, tolerances, risk bands and weights are **illustrative defaults** — configure them to SUMED's Delegation of Authority. Tax rates, FX rates and the holiday calendar are **empty by default** and must come from authoritative inputs.
- PDF reports use the browser's print-to-PDF. The pain.001 file is a template to validate against your bank's implementation guide.
- AR ledger and inventory are not modelled yet, so DSO / DIO / cash-conversion cycle show as unavailable.

## Third-party libraries (bundled, unmodified)

SheetJS Community Edition 0.18.5 (Apache-2.0), pdf.js 3.11.174 (Apache-2.0), JSZip 3.10.1 (MIT/GPLv3), mammoth 1.6.0 (BSD-2-Clause); Tesseract.js 5 loaded from CDN for OCR (Apache-2.0). Fonts: IBM Plex Sans / IBM Plex Sans Arabic via Google Fonts (OFL) with system fallbacks. Chart colours use a CVD-validated categorical palette.
