# Changelog

Format follows Keep a Changelog; versions follow SemVer.

## 0.2.0 - 2026-11-16

First public release.

### Added
- Real tokenizer and recursive-descent SQL subset parser (CTEs, subqueries, joins incl. `USING`, set operations, window functions, `CAST`/`::`, wildcard expansion with declared schemas, CTAS, `INSERT ... SELECT`, view column lists, DDL types and `NOT NULL`).
- Edge kinds `direct`, `derived`, `indirect` with roles (`window`, `subquery`, `filter`, `join`, `group`, `having`, `order`) and `line:col` provenance.
- Cross-file schema resolution in dependency order; explicit `external` nodes for undeclared references; cycle detection; sensitivity name hints.
- `impact` proof paths, `--change rename|drop|type|modify` checklists and regression-test ideas, `--fail-on` gates; `upstream`; `compare` with breaking-consumer detection and `--fail-on-breaking`; richer `contract` (types, NOT NULL, forbidden columns, `not-run` freshness).
- `audit` command writing Markdown, HTML and JSON: gold-corpus accuracy with Wilson intervals, safety/adversarial checks, fuzzing, performance, package integrity, optional repository and test-suite sections.
- Accessible, responsive, self-contained HTML reports (light/dark, SVG dependency graph).
- Read-only MCP server (`lineagesutra mcp`), `/impact` route on the loopback API.
- 54-case hand-labelled gold corpus, `npm run proof`, `docs/proof/`.
- CI on Ubuntu/Windows/macOS for Node 20/22/24, npm-pack smoke test, secret scan, trusted-publishing release workflow.
- `llms.txt`, NOTICE, THIRD_PARTY_NOTICES, CITATION.cff, legal/trust, status, threat and evidence docs, full `documents/` set.

### Changed
- Package renamed to `lineagesutra-ai` (unscoped), `private` removed, bins `lineagesutra` and `lineagesutra-ai`.
- CTE, UNION and DISTINCT are now parsed (previously flagged unsupported). Function expressions are now `derived` edges (previously unknown). WHERE/JOIN/GROUP dependencies are now `indirect` edges (previously a warning).
- Canonical JSON uses code-point key order (previously locale-dependent). Seals from 0.1 are not comparable.

### Fixed
- CLI did nothing on Windows and when run through an npm bin shim (broken main-module check). 9 CLI tests failed on Windows; all pass.
- `npm test` globbing failed on Windows with Node 20 (replaced by `scripts/run-tests.mjs`).
- Output depended on file order in some cases; now identical.

### Security
- Added token, nesting and file caps; XSS-safe HTML; instruction-in-comment inertness check; static no-network check in the audit.

## 0.1.0

Internal starter: minimal CREATE TABLE/VIEW scanner, dbt metadata import, seal/verify, JSON/MD/HTML reports.
