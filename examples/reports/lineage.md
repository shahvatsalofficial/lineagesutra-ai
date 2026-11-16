# LineageSutra AI - Lineage scan

**Format:** `lineagesutra.scan.v1`  
**Review status:** SUPPORTED_SUBSET_ONLY  
**Tool:** lineagesutra-ai 0.2.0 (created by Vatsal Shah)

- sqlFiles: 4
- datasets: 4
- declaredDatasets: 4
- externalDatasets: 0
- dependencies: 7
- tableEdges: 3
- columnEdges: 4
- indirectEdges: 0
- warnings: 0

- coverage: supported-subset 4, partial 0, unknown 0

## Datasets

| Dataset | Kind | Certainty | Source | Columns |
| --- | --- | --- | --- | --- |
| `campaign_recipients` | view | supported-subset | 03_campaign_recipients.sql:1 | email |
| `customers` | table | supported-subset | 00_customers.sql:1 | id, email, created_at |
| `customers_public` | view | supported-subset | 01_customers_public.sql:1 | id, email |
| `email_metrics` | view | supported-subset | 02_email_metrics.sql:1 | address |

## Relationships

| From | To | Type | Kind | Role | Certainty | Source |
| --- | --- | --- | --- | --- | --- | --- |
| `customers.email` | `campaign_recipients.email` | column | direct |  | supported-subset | 03_campaign_recipients.sql:2 |
| `customers.email` | `customers_public.email` | column | direct |  | supported-subset | 01_customers_public.sql:2 |
| `customers.id` | `customers_public.id` | column | direct |  | supported-subset | 01_customers_public.sql:2 |
| `customers_public.email` | `email_metrics.address` | column | direct |  | supported-subset | 02_email_metrics.sql:2 |
| `customers_public` | `email_metrics` | table |  |  | supported-subset | 02_email_metrics.sql:2 |
| `customers` | `campaign_recipients` | table |  |  | supported-subset | 03_campaign_recipients.sql:2 |
| `customers` | `customers_public` | table |  |  | supported-subset | 01_customers_public.sql:2 |

## Limitations

- Supported subset: CREATE TABLE/VIEW [AS SELECT], CTAS, INSERT ... SELECT, CTEs, subqueries, JOINs, set operations, expressions, window functions and wildcard expansion where schemas are declared in the scanned sources. This does not certify any SQL dialect.
- Edges are static observations of SQL text. Column edges are marked direct (plain copy) or derived (expression); WHERE/JOIN/GROUP/HAVING/ORDER dependencies are marked indirect.
- Dynamic SQL, dbt/Jinja templates, stored procedures, MERGE/UPDATE, table functions, PIVOT and recursive CTEs are reported as warnings, never as confident edges.
- No database connection, row data, query execution, freshness measurement or production verification is performed. The SHA-256 seal is tamper evidence, not a signature.

Integrity: SHA-256 `1034fe6e71bbb108944fe04e0c332db161f976c8f8aa5ba408ac68157f123a0c` (tamper evidence, not a signature)
