# Daily Finance Control Summary -- 2026-10-09

**Company:** Cedar Ridge Supply Co. (fictional)  
**Batch:** `B-08C5978886AEBFBC` | **Run:** `example-first-run`  
**Status:** Generated from validated inputs. Draft for CFO review; no actions have been executed and no notifications have been sent by this run.

## Headline

- 8 exceptions (3 high, 3 material); gross exposure 80065.00.
- Cash: bank net movement 24434.55 vs GL 22249.55; difference 2185.00, unexplained 0.00.
- AP: 9 invoices totalling 108980.45; 8 require approval (107800.00).

## Exceptions by category

| Category | Count |
|---|---:|
| APPROVAL_AUTHORITY | 1 |
| DUPLICATE_CANDIDATE | 2 |
| MISSING_APPROVAL | 1 |
| RECONCILIATION_DIFFERENCE | 3 |
| SEGREGATION_OF_DUTIES | 1 |

## High-severity items

| ID | Rule | Amount | Description | Source | Owner |
|---|---|---:|---|---|---|
| EX-9870C4EA9B3C | DUP-FUZZY | 18900.00 | Vendor V-101 billed the same amount 18900.00 on INV-1002 and INV-1006 within 5 day(s) under different invoice numbers. | ap_invoices.csv#L3;ap_invoices.csv#L7 | ap-lead@example.com;controller@example.com |
| EX-344EF6DB8F50 | APR-MISSING | 32500.00 | INV-1005 (Delta Facilities) 32500.00 has no approval; threshold is 2500.00. | ap_invoices.csv#L6 | ap-controls@example.com;controller@example.com |
| EX-7027CEA2BA41 | SOD-SELF-APPROVAL | 12000.00 | INV-1008 was submitted and approved by the same user (u.khan). | ap_invoices.csv#L9;approvals.csv#L7 | internal-controls@example.com;controller@example.com |

## Decisions requested

- 3 material proposed action(s) await approval in `approval_queue.csv` (controller sign-off required).

## Input files (identity)

| File | Rows | Control total | SHA-256 (prefix) |
|---|---:|---:|---|
| ap_invoices.csv | 9 | 108980.45 | `3df979076defe2a2` |
| approvals.csv | 7 | 180000.00 | `ea8e3c5f794e7515` |
| bank_transactions.csv | 6 | 24434.55 | `1d6c225e5aa2988a` |
| gl_cash_entries.csv | 6 | 22249.55 | `0b2990158a310075` |

_Every figure above is recomputable from the listed files and `calculations.json`._
