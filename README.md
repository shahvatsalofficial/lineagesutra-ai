# LineageSutra AI

**Trace what flows. Understand what breaks.**

Offline, evidence-first **SQL data lineage and schema-change impact analysis**. Point it at a folder of SQL (or a dbt `manifest.json`) and it tells you, with file and line proof, which views, tables and columns break if you rename, drop or retype a column. No API key. No network. No database connection. No row data. Ever.

[![CI](https://github.com/shahvatsalofficial/lineagesutra-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/shahvatsalofficial/lineagesutra-ai/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/lineagesutra-ai.svg)](https://www.npmjs.com/package/lineagesutra-ai)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/lineagesutra-ai.svg)](package.json)

Created by **Vatsal Shah** ([@shahvatsalofficial](https://github.com/shahvatsalofficial)).

```bash
npx lineagesutra-ai audit --out audit-out          # independent self-audit: open audit-out/audit-report.html
```

> **What is it, in one paragraph?** LineageSutra AI is a zero-dependency Node.js command-line tool and a set of 25 portable Agent Skills that build a **column-level lineage graph** from `CREATE TABLE`, `CREATE VIEW`, CTAS and `INSERT ... SELECT` SQL, then answer *"if I change `customers.email`, what breaks?"* It separates **confirmed static impacts** (a proven column path) from **possible impacts** (filters, joins, group-bys, table-level dependents), shows the **proof path** for each, lists everything it could **not** parse instead of guessing, and seals every report with a SHA-256 hash. It runs equally well from a terminal, CI, an MCP client, Claude Code, Cursor, Codex, GitHub Copilot or Gemini CLI.

## Contents

[Quickstart](#quickstart) · [What you get](#what-you-get) · [Why trust it](#why-trust-it) · [Commands](#commands) · [What it parses](#what-it-parses) · [Sample output](#sample-output) · [Audit reports](#audit-reports-markdown--html--json) · [Use it from AI tools](#use-it-from-ai-tools) · [CI gates](#use-it-in-ci) · [Honest limits](#honest-limits) · [Legal and privacy](#legal-and-privacy) · [Documentation](#documentation) · [Contributing](#contributing)

## Quickstart

Requires Node.js 20 or newer.

```bash
npx lineagesutra-ai scan --root ./sql --out lineage.html           # graph + tables, open in a browser
npx lineagesutra-ai scan --root ./sql --out lineage.json           # sealed JSON for the next commands
npx lineagesutra-ai impact --input lineage.json --table customers --column email --change rename --out impact.html
npx lineagesutra-ai upstream --input lineage.json --table email_metrics --column address
npx lineagesutra-ai verify --input lineage.json                    # tamper check
```

Or install once: `npm install -g lineagesutra-ai` and use `lineagesutra`.

No SQL handy? Use the bundled synthetic sample (`fixtures/sample/sql`) or run `npm run demo` in a clone.

## What you get

| Capability | What it does | Status |
|---|---|---|
| **LineageGraph** | Table and column edges with `direct` / `derived` kind, source file, line and column | Implemented, tested |
| **ImpactLens** | Rename / drop / type-change rehearsal: confirmed vs possible downstream, proof paths, review checklist, regression-test ideas | Implemented, tested |
| **Upstream trace** | Walk a column back to its origin | Implemented, tested |
| **DriftRadar** | `compare` two scans, list removed columns/datasets and *who consumed them*; CI exit code 3 | Implemented, tested |
| **ContractGuard** | Check required columns, types, NOT NULL, forbidden columns against DDL; freshness is reported `not-run`, never faked | Implemented, tested |
| **dbt import** | Metadata-only `manifest.json` (nodes, sources, exposures, `depends_on`); never runs dbt | Implemented, tested on a synthetic manifest |
| **EvidenceCapsule** | Every report is sealed with SHA-256; `verify` detects edits | Implemented, tested |
| **Audit reports** | `audit` writes **Markdown, HTML and JSON** with measured accuracy, safety, performance and an explicit "not verified" list | Implemented, tested |
| **MCP server** | Read-only stdio tools scoped to one folder | Implemented, scripted-client tested (not MCP Inspector) |
| **25 Agent Skills + 20 role files** | Portable `SKILL.md` packs for six hosts | Authored; native activation in each host NOT_TESTED |
| **SQLGlot / full dialect AST** | Planned optional adapter | **Not implemented** |

Everything marked implemented is exercised by the test suite; see [docs/STATUS.md](docs/STATUS.md).

## Why trust it

Trust is earned with evidence you can re-run, not with adjectives.

- **A measured gold corpus.** 54 hand-labelled SQL cases (joins, CTEs, window functions, set operations, wildcards, quoting styles, hostile inputs). Labels were written before the parser was run. Current score: **54/54 exact, 100% precision, 100% recall on 148 expected edges** (recall and precision 95% Wilson CIs are printed in the audit). It is a regression corpus written by the author, **not** an independent benchmark. See [docs/AUDIT_REPORTS.md](docs/AUDIT_REPORTS.md).
- **Unknown stays unknown.** Ambiguous columns, wildcards over undeclared schemas, dynamic SQL, Jinja templates, `MERGE`, table functions and recursive CTEs become **warnings**, never confident edges. The audit counts them.
- **Read-only and offline, verified by code.** The audit hashes the source tree before and after a scan, statically checks that `packages/core` and `packages/reporting` import no network or subprocess modules, and fuzzes the parser with 3,000 seeded hostile token streams.
- **Reproducible.** Output is deterministic and independent of file order; the seal proves it.
- **Honest scope.** Every report ends with its own limitations. A PASS is never a certification.
- **Proof artifacts in the repo.** Test logs, CLI transcripts, benchmark numbers and a full audit report live in [`docs/proof/`](docs/proof) and are regenerated with `npm run proof`.

## Commands

| Command | Purpose |
|---|---|
| `scan --root <dir> [--out f] [--format json\|md\|html\|mmd] [--strict]` | Build the lineage graph. `--strict` exits 3 if anything was unparsed |
| `dbt --input manifest.json` | Import dbt metadata |
| `impact --input g.json --table T [--column C] [--change rename\|drop\|type\|modify] [--fail-on confirmed\|possible\|any]` | Change-impact rehearsal |
| `upstream --input g.json --table T [--column C]` | Trace sources |
| `compare --before a.json --after b.json [--fail-on-breaking]` | Drift between two scans |
| `contract --input g.json --contract c.json` | Metadata contract check |
| `verify --input report.json` | Verify the SHA-256 seal |
| `audit [--root dir] --out dir [--with-tests] [--force]` | Independent audit: MD + HTML + JSON |
| `install-skills --ide claude\|cursor\|codex\|gemini\|copilot\|opencode --project dir` | Copy the Agent Skills into a project |
| `serve --input g.json` | Loopback bearer-token JSON API (needs `LINEAGESUTRA_TOKEN`) |
| `mcp --root dir` | Read-only MCP server over stdio |
| `doctor`, `--version` | Host check, version |

The output format follows the file extension (`.json`, `.md`, `.html`, `.mmd` for Mermaid). Exit codes: `0` ok, `1` audit failed, `2` usage or input error, `3` a gate you asked for tripped.

## What it parses

Supported subset (details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- `CREATE [OR REPLACE] [MATERIALIZED|TEMP] TABLE/VIEW`, `CREATE TABLE ... AS SELECT`, `INSERT ... SELECT` (with or without a column list), view column lists
- `SELECT` with aliases, qualified names, expressions, functions, `CASE`, `CAST` and `::`, `EXTRACT`, intervals, aggregates and window functions (`OVER`)
- `JOIN` (`ON` and `USING`), self joins, comma joins, subqueries in `FROM`, correlated scalar subqueries, `IN (SELECT ...)`
- CTEs (chained, with column lists), `UNION` / `INTERSECT` / `EXCEPT`
- `*` and `t.*` expansion **when the schema is declared in the scanned files** (resolved across files, in dependency order)
- `WHERE`, `GROUP BY`, `HAVING`, `QUALIFY`, `ORDER BY`, join conditions recorded as **indirect** dependencies
- Quoting styles: `"ansi"`, `` `backtick` ``, `[bracket]`, `$$dollar$$` strings, Unicode identifiers; comments and strings never leak into lineage
- DDL types and `NOT NULL` for contract checks

Not supported (always a warning): `MERGE`, `UPDATE`, `DELETE`, stored procedures and functions, dynamic SQL, Jinja/dbt templating inside SQL, `PIVOT`/`UNPIVOT`, table functions such as `UNNEST`, recursive-CTE self reference, `ALTER TABLE` replay, `SELECT * EXCEPT`. No dialect is certified. A [SQLGlot adapter](ROADMAP.md) is planned, not built.

## Sample output

Rename `customers.email` to `customers.contact_email` and ask what is affected (`npm run demo` reproduces this):

```text
Confirmed (static, column-level proof):
  customers_public.email      direct   1 hop   01_customers_public.sql:2
  campaign_recipients.email   direct   1 hop   03_campaign_recipients.sql:2
  email_metrics.address       direct   2 hops  customers.email -> customers_public.email -> email_metrics.address
Possible (not proven at field level):
  (none in this fixture)
Checklist:
  [ ] Update the reference in `customers_public.email` (01_customers_public.sql:2), reached via 1 hop(s).
  ...
```

Ready-made samples: [`examples/reports/`](examples/reports) (JSON, Markdown, HTML, Mermaid) and a full audit in [`docs/proof/audit-report.html`](docs/proof/audit-report.html).

## Audit reports: Markdown + HTML + JSON

`lineagesutra audit --out audit-out` writes **`audit-report.md`**, **`audit-report.html`** and **`audit-report.json`**. The HTML is a self-contained, accessible, responsive page (light/dark, keyboard friendly, printable) with a scorecard, per-section PASS / FAIL / NOT_RUN badges, per-case accuracy table, environment, copy-paste reproduction commands and a "What was NOT verified" section. Add `--root ./sql` to also audit your own SQL folder, and `--with-tests` to embed a live run of the test suite. Every `scan`, `impact`, `compare`, `contract` and `upstream` result renders to the same three formats.

## Use it from AI tools

- **Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, OpenCode:** `npx lineagesutra-ai install-skills --ide claude --project .` copies the 25 `SKILL.md` packs project-locally (it refuses to overwrite and rejects symlink escapes). Native invocation inside each host is **NOT_TESTED**; the files follow the Agent Skills layout.
- **MCP:** `lineagesutra mcp --root ./sql` exposes read-only tools (`scan_repository`, `get_parser_coverage`, `downstream_impact`, `upstream_dependencies`, `generate_change_checklist`, `verify_evidence`). The folder is fixed at start-up; tools take no path arguments.
- **LLM-friendly summary:** [`llms.txt`](llms.txt).

An "agent" here is a **role contract** in Markdown, not a separately provisioned model process.

## Use it in CI

```yaml
- run: npx lineagesutra-ai scan --root sql --out lineage.json --strict
- run: npx lineagesutra-ai compare --before baseline.json --after lineage.json --fail-on-breaking --out drift.html
- run: npx lineagesutra-ai impact --input lineage.json --table customers --column email --fail-on confirmed
```

Upload the `.html` outputs as build artifacts so reviewers can read them.

## Honest limits

- Static analysis of SQL **text**. It cannot see runtime-only SQL, ORM-generated queries, or what is actually deployed.
- The built-in parser is a documented subset, not a dialect-complete SQL parser. Passing the gold corpus does not mean it is correct on your SQL; run `audit --root` to see exactly what it could not parse.
- Contract checks verify declared metadata, not production tables. Freshness is never measured.
- The SHA-256 seal detects edits; it is **not** a signature and proves nothing about who produced a report.
- The MCP server is checked with a scripted client only. IDE skill activation is untested. Windows, macOS and Linux CI results are shown by the badge above, not assumed.
- Column names like `email` produce a *name hint*, not a PII classification.

Full matrix: [docs/STATUS.md](docs/STATUS.md).

## Legal and privacy

Apache-2.0 licensed; the tool collects **no telemetry** and makes **no network calls** in `scan`, `impact`, `compare`, `contract`, `verify`, `audit` or `mcp`. It never reads table rows. It is not legal, compliance or security advice, and a passing report is not a certification. Details, third-party notices and trademark notes: [docs/LEGAL_AND_TRUST.md](docs/LEGAL_AND_TRUST.md), [NOTICE](NOTICE), [SECURITY.md](SECURITY.md).

## Documentation

Full documentation set (executive summary, functional spec, architecture, technical reference, user guide, security and privacy, evidence model, test report, operations, legal, roadmap, glossary, assurance) is generated in Markdown and designed HTML under [`documents/LineageSutra-AI`](documents/LineageSutra-AI) (open `documents/LineageSutra-AI/html/index.html`). Core references: [ARCHITECTURE](docs/ARCHITECTURE.md) · [EVIDENCE_MODEL](docs/EVIDENCE_MODEL.md) · [THREAT_MODEL](docs/THREAT_MODEL.md) · [AUDIT_REPORTS](docs/AUDIT_REPORTS.md) · [STATUS](docs/STATUS.md) · [ROADMAP](ROADMAP.md) · [CHANGELOG](CHANGELOG.md).

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) and [SUPPORT.md](SUPPORT.md). Security reports: [SECURITY.md](SECURITY.md). If you use LineageSutra AI in research or writing, cite it with [CITATION.cff](CITATION.cff).

---

*Created by Vatsal Shah. "LineageSutra AI" is a working name; no trademark clearance has been performed.*

<!-- keywords: data lineage, column-level lineage, SQL lineage, schema change impact analysis, breaking change detection, dbt manifest, data contracts, impact analysis, offline CLI, MCP server, Agent Skills, Claude Code skills, Cursor, Codex, Copilot, Gemini CLI, open source -->
