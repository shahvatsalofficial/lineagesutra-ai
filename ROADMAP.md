# Roadmap

Honest ordering. Nothing below is implemented unless CHANGELOG says so.

| Milestone | Item | State |
|---|---|---|
| M0 | Baseline confirmation, tests, demo | Done in 0.2.0 |
| M1 | **SQLGlot bridge**: optional pinned Python (`uv`) process, versioned JSON stdio contract, dialect fixtures (PostgreSQL, Snowflake, BigQuery, Spark, Redshift, T-SQL, Oracle, MySQL, DuckDB). Core stays dependency-free | Planned |
| M2 | Verified column lineage on real dialect fixtures; `MERGE`, `UPDATE`, `PIVOT`, table functions | Planned |
| M3 | OpenLineage import (run/job/dataset facets); dbt manifest version-specific validation; compiled-SQL parsing; public fixture | Planned |
| M4 | Schema-revision diff from git (`--base main`), SARIF output, PR comment helper | Planned |
| M5 | MCP Inspector validation, native activation checks in one IDE at a time | Planned |
| M6 | Signed evidence capsules (Sigstore), SBOM, OpenSSF Scorecard | Planned |
| M7 | Optional hosted dashboard: auth, RBAC, audit log, isolation | Not started; only after the offline core is mature |

Principles: unknown stays unknown; no database access by default; every new claim needs a fixture and a test; changelog tells the truth.

Want something? Open an issue with a **sanitized** SQL sample that the tool mishandles.
