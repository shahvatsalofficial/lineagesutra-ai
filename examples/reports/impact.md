# LineageSutra AI - Change impact

**Format:** `lineagesutra.impact.v1`  
**Review status:** HUMAN_REVIEW_REQUIRED  
**Tool:** lineagesutra-ai 0.2.0 (created by Vatsal Shah)

- confirmed: 3
- possible: 0
- sensitiveNameHints: 4

**Change target:** `customers.email` (rename)

## Directly evidenced impacts (confirmed, static)

| Node | Kind | Hops | Source | Proof path |
| --- | --- | --- | --- | --- |
| `campaign_recipients.email` | direct | 1 | 03_campaign_recipients.sql:2 | customers.email -> campaign_recipients.email |
| `customers_public.email` | direct | 1 | 01_customers_public.sql:2 | customers.email -> customers_public.email |
| `email_metrics.address` | direct | 2 | 02_email_metrics.sql:2 | customers.email -> customers_public.email ; customers_public.email -> email_metrics.address |

## Possible impacts (not proven at field level)

_None._

## Review checklist

- [ ] Update the reference in `campaign_recipients.email` (03_campaign_recipients.sql:2), reached via 1 hop(s).
- [ ] Update the reference in `customers_public.email` (01_customers_public.sql:2), reached via 1 hop(s).
- [ ] Update the reference in `email_metrics.address` (02_email_metrics.sql:2), reached via 2 hop(s).

## Regression test ideas (suggestions only)

- In a non-production copy, compare row counts and column checksums of `campaign_recipients` before and after the change. (Suggestion only; nothing was executed.)
- In a non-production copy, compare row counts and column checksums of `customers_public` before and after the change. (Suggestion only; nothing was executed.)
- In a non-production copy, compare row counts and column checksums of `email_metrics` before and after the change. (Suggestion only; nothing was executed.)

## Limitations

- Confirmed findings are exact supported-subset column edges (static SQL evidence), not a database test.
- Possible findings are indirect (filter/join/group) or dataset-level; they are not proof of field-level use.
- Unsupported SQL, dynamic SQL and templates may hide additional downstream impacts. Column-name sensitivity hints are not classifications.

Integrity: SHA-256 `27463e098b081ccf59dd3a4796f8de78feb57ab22874e1c5188f67ce4dc1047f` (tamper evidence, not a signature)
