# SUMED P2P — Final validation (requirement §70)

Two automated suites:

- `npm test` → `tests/run-tests.js`: **43 checks**, Node only, no dependencies. Loads the exact browser scripts in a VM.
- `node tests/ui-smoke.js [outDir]` → **594 browser checks** (Playwright + Chromium, optional): every route and tab in English and Arabic × light and dark, untranslated-key scan, every KPI lineage modal, evidence for every red flag / insight / action / control / saving / risk / data-quality issue / duplicate, drill-down drawers for every entity, all 21 reports exported to Excel and CSV, phone-width layout (390 px) without horizontal scrolling. Fails on any page or console error.

Both pass on the current code (43/43 and 594/594).

| §70 item | How it is validated |
|---|---|
| Calculations & totals | Dashboard Total AP = Σ open-invoice outstanding (base) — recomputed independently; aging buckets and supplier rows sum to Total AP; spend by supplier / category / month sum to total spend; outstanding = total − paid for every invoice |
| Payment totals = payment register | KPI equals Σ executed/reconciled net (base) |
| AP totals = AP source totals | Sub-ledger vs GL AP balance reconciles to exactly the injected 125,000 demo difference (flagged EXCEPTION) |
| Currencies & FX | Missing FX rate (GBP demo invoice) excluded from base totals and labelled **FX RATE NOT AVAILABLE**; never estimated |
| Dates | ISO / DD-MM / MM-DD (configurable) / Excel serial / month-name parsing; invalid dates rejected and reported, never guessed |
| Duplicate detection | Exact, high-risk (normalised number, both paid) and payment duplicates detected with reasons; shared payments not double-counted |
| Matching logic | PRICE / QUANTITY VARIANCE, MISSING GRN, MISSING PO, DUPLICATE detected; variance = invoice − receipt value; no values fabricated without a PO |
| Approval logic | Matrix tiers + escalation rules; unknown FX → tier not guessed; payments above authority detected; in-app approvals enforce coverage |
| Permissions & SoD | Transactional and role-design conflicts; CRITICAL when one user performs several incompatible duties; workflows block self-approval, approver-executes, executor-reconciles (browser workflow test) |
| Filters & search | Table filters, global search, calendar filters exercised in the smoke test |
| Exports | Native .xlsx validated as an OOXML package (central directory, parts, XML escaping) and opened with openpyxl; 42 exports produced in the smoke test |
| Bilingual & RTL | 100 % Arabic key coverage with identical `{placeholders}` (test-enforced); RTL layout and no raw keys in all views |
| Dark mode | All views rendered in dark mode without errors |
| Evidence links & lineage | Every KPI has formula + sources or an "unavailable" reason; every alert's evidence rows carry file / sheet / row |
| Audit trail | Hash chain verifies; tampering detected; entries frozen; workflow edits keep old / new values |
| No-hallucination | Empty workspace produces no alerts / insights / savings; DPO unavailable with reason; tax-rate rule NOT TESTED without configured rates; holiday rule NOT TESTED without a calendar; unquantifiable savings have saving = null |
| Upload path | Synthetic sample CSV / XLSX (7 sheets) / PDF files auto-classified at 100 % required-field coverage; PDF invoice fields extracted with confidence; OCR correction audit-logged; posted invoice matched (and correctly flagged) |
| Scenarios | Labelled **SCENARIO — NOT ACTUAL**; delaying payments never lowers end cash; lower collections reduce it |
| Cash forecast | Closing = opening + Σ inflows − Σ outflows per currency |

Latest `npm test` output:

```
SUMED P2P — QA test run

Utilities
  ✔ parseNum handles separators, parentheses, Arabic digits, currency text; never returns 0 for garbage
  ✔ parseDate: ISO, DMY default (Egypt), MDY option, Excel serial, month names; rejects invalid
  ✔ Invoice-number normalisation & IBAN checksum (ISO 13616)
  ✔ CSV parser: quotes, embedded commas/newlines, semicolon delimiter, BOM
  ✔ Sensitive values are masked by default

Upload → classify → map → normalise
  ✔ Classifier recognises English and Arabic headers
  ✔ CSV ingestion keeps source lineage (file/sheet/row) and flags invalid values without inventing them
  ✔ Duplicate file upload is detected by hash and skipped
  ✔ OCR field extraction: label-anchored fields, IBAN checksum, arithmetic cross-check boosts confidence

Totals reconcile to underlying transactions
  ✔ Demo data is fully labelled synthetic
  ✔ Dashboard Total AP = Σ open invoice outstanding (base, as-of FX)
  ✔ Payment totals = payment register totals
  ✔ Spend by supplier / category / month each sum to total spend
  ✔ AP sub-ledger reconciles to GL except the injected 125,000 difference
  ✔ Invoice outstanding = total − paid (derived) and overpayments appear as supplier debit balances
  ✔ Every KPI carries lineage: formula + sources, or an explicit unavailable reason

Three-way matching
  ✔ Statuses: MATCHED majority; injected PRICE / QUANTITY / MISSING GRN / MISSING PO / DUPLICATE detected
  ✔ Variance = invoice − receipt value and % shown; nothing fabricated when PO missing

Duplicate detection
  ✔ Exact, high-risk (reformatted number, both paid) and payment duplicates are found with reasons
  ✔ Payments to the same invoice number are not double-counted across duplicate invoices

Fraud & anomaly rules (each with evidence)
  ✔ Injected scenarios detected
  ✔ Every alert has severity, category, action, and source-located evidence rows
  ✔ Holiday rule is NOT TESTED (calendar not configured) — never assumed
  ✔ Unverified bank change followed by payment is CRITICAL

Supplier risk (explainable) & performance
  ✔ Risk scores come with drivers whose points sum to the score (cap 100) and evidence
  ✔ Performance renormalises over available metrics and reports coverage

Segregation of duties & approval authority
  ✔ SoD: supplier created & approved by same user; bank change + payment approval by same user
  ✔ Approval matrix is config-driven (tiers + escalation rules)
  ✔ Payment above authority is detected

Controls
  ✔ Control tests: valid statuses; FAIL/WARNING only with exceptions; PASS only without
  ✔ Bank reconciliation finds missing, wrong amount, timing, reversal and unexplained bank debit

No-hallucination rules
  ✔ Missing FX rate → excluded from base totals and labelled, never estimated
  ✔ Empty workspace: KPIs empty/unavailable, DPO unavailable with reason, no alerts invented
  ✔ Tax rates are never assumed: without configuration the tax-rate rule is NOT TESTED
  ✔ DPO computed only from GL inputs; formula inputs disclosed
  ✔ Savings always carry a method; unquantifiable ones have saving = null

Treasury & scenarios
  ✔ Cash forecast identity per currency: closing = opening + Σin − Σout
  ✔ Scenario is labelled SCENARIO — NOT ACTUAL; delaying payments cannot lower the end cash

Audit trail
  ✔ Hash chain verifies, and tampering is detected
  ✔ Workflow edits keep old/new values in the audit trail and on the record

Exports & localisation
  ✔ XLSX writer produces a valid OOXML package (central directory, all parts, sheet XML)
  ✔ Arabic covers every UI key, with identical {placeholders}
  ✔ Rule / driver / insight texts render in both languages without raw keys

43 passed, 0 failed
```
