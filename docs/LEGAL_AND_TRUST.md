# Legal and trust notes

This page describes how the project is designed to limit legal and privacy exposure. It is **not legal advice**. Ask your own counsel about your obligations.

## License and attribution

Apache License 2.0 (see LICENSE and NOTICE). Original work by Vatsal Shah. The project has **no runtime dependencies**, so there are no bundled third-party code licenses to carry; see THIRD_PARTY_NOTICES.md for referenced standards and optional tools (referenced, not bundled).

## Privacy design

- The tool reads SQL text and JSON metadata you point it at. It never reads table rows and never connects to a database.
- No telemetry, no analytics, no update checks, no network calls in scanning, analysis, reporting, audit or MCP. The core and reporting packages are statically checked for network/subprocess imports on every audit.
- Reports contain dataset and column names and file paths. If those names are sensitive, treat the reports as sensitive and review before sharing.
- Column-name hints (`email`, `ssn`, ...) are heuristics, not data classification, and not evidence of lawful or unlawful processing under GDPR, CCPA or similar laws.

## What the tool is not

- Not a compliance, audit or certification tool. A PASS means the listed checks passed, nothing more.
- Not a substitute for tests, code review, change management or a data-protection assessment.
- Not warranted: the license disclaims warranty and liability. Verify results before changing production systems.

## Third-party names

dbt, Snowflake, BigQuery, PostgreSQL, Claude Code, Cursor, Codex, Gemini, Copilot, OpenLineage, SQLGlot, OpenMetadata, DataHub and others are trademarks of their owners and are used only to describe compatibility or planned integration. No affiliation or endorsement is implied. SQLGlot is a planned optional integration and is not bundled.

## Name

"LineageSutra AI" is a working name. No trademark search or clearance has been done; do not assume the name is unique or reserved. The npm package name is `lineagesutra-ai`.

## Test data

Fixtures are synthetic and written for this project. No real customer data, no copied vendor schemas.

## Responsible use

Use it on SQL you are authorized to read. Do not use the AI-agent skills to bypass access controls. Do not feed it SQL containing secrets you would not paste into your terminal.

## Reporting problems

Security: SECURITY.md. Everything else: GitHub issues.
