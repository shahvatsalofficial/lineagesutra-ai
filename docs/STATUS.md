# Implementation status - LineageSutra AI v0.2.0

Created by Vatsal Shah. States below are claims the test suite or the audit exercises; anything else is labelled planned or NOT_TESTED. Re-run `npm test` and `npx lineagesutra-ai audit --out audit-out` to re-measure.

| Capability | State | Evidence |
|---|---|---|
| Tokenizer (comments, strings, `$$`, quoting styles, Jinja markers, token cap) | Implemented, tested | `tests/analysis.test.mjs` |
| SQL subset parser: CREATE TABLE/VIEW, CTAS, INSERT..SELECT, CTE, subqueries, JOIN, set ops, windows, expressions | Implemented, tested | gold corpus (54 cases) + unit tests |
| Wildcard expansion across files with declared schemas | Implemented, tested | `wildcard-*` gold cases |
| Direct / derived / indirect column edges with file, line, column | Implemented, tested | gold corpus |
| Table dependency graph, cycle detection, external (undeclared) nodes | Implemented, tested | analysis tests |
| Impact analysis: confirmed vs possible, proof paths, checklist, `--fail-on` | Implemented, tested | analysis + CLI tests |
| Upstream trace | Implemented, tested | analysis tests |
| Compare / DriftRadar with breaking-consumer detection | Implemented, tested | analysis + CLI tests |
| Contract check: columns, types, NOT NULL, forbidden columns; freshness `not-run` | Implemented, tested | analysis tests |
| dbt manifest import (nodes, sources, exposures, depends_on) | Implemented, tested on a synthetic manifest | core tests |
| SHA-256 seal, verify, deterministic output independent of file order | Implemented, tested | core + audit |
| Reports: JSON, Markdown, self-contained accessible HTML, Mermaid | Implemented, tested | cli/reporting tests |
| Audit command: MD + HTML + JSON, accuracy, safety, fuzz, performance, packaging | Implemented, tested | `tests/cli-extra.test.mjs`, `docs/proof` |
| Read-only MCP server (stdio) | Implemented; scripted-client tested; **not** validated with MCP Inspector | `tests/mcp.test.mjs` |
| Loopback bearer-token JSON API | Implemented, tested (not a production API) | `tests/cli.test.mjs` |
| Skill installer for six hosts (file copy, symlink-safe, no overwrite) | Implemented, tested | `tests/cli.test.mjs` |
| 25 Agent Skills, 20 role files, 8 workflows, 10 rules | Authored; structure verified by the audit; **host activation NOT_TESTED** | audit `package` section |
| Cross-platform CI | Configured (Ubuntu/Windows/macOS, Node 20/22/24); results are on the GitHub Actions page | `.github/workflows/ci.yml` |
| SQLGlot / dialect-complete AST adapter | **Planned, not implemented** | ROADMAP |
| OpenLineage import, Great Expectations, OpenMetadata, DataHub | **Planned, not implemented** | ROADMAP |
| Live database metadata, freshness measurement, data tests | **Prohibited by default, never implemented** | rules/03 |
| Hosted multi-tenant server and dashboard | **Not implemented** | ROADMAP |
| Independent third-party security review | **Not performed** | SECURITY |

## Known false negatives (by design)

Constructs the parser reports instead of analysing: `MERGE`, `UPDATE`, `DELETE`, stored routines, dynamic SQL, Jinja templating, `PIVOT`/`UNPIVOT`, table functions (`UNNEST`, `FLATTEN`, ...), recursive CTE self references, `ALTER TABLE` replay, `SELECT * EXCEPT/EXCLUDE/REPLACE`, lateral flattening, `CROSS/OUTER APPLY`. Impact results can therefore miss consumers that use these constructs; the warnings list them.

## Known false-positive risks

- Unqualified column resolution picks the only source that *might* contain a column when schemas are unknown; the edge is marked `supported-subset` but the owner is unverified. Declare schemas (CREATE TABLE) in the scanned files to remove the ambiguity.
- Dataset names are folded to lower case; two datasets differing only by case would be merged.
