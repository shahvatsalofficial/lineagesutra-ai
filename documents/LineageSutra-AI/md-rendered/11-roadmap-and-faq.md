# Roadmap and FAQ

## Roadmap

| Step | Item | State |
|---|---|---|
| M1 | SQLGlot bridge (isolated, pinned, optional) and dialect fixtures | Planned |
| M2 | MERGE, UPDATE, PIVOT, table functions | Planned |
| M3 | OpenLineage import, dbt version validation, compiled SQL | Planned |
| M4 | Git-aware schema diff, SARIF | Planned |
| M5 | MCP Inspector validation, native IDE checks | Planned |
| M6 | Signed evidence, SBOM, Scorecard | Planned |
| M7 | Hosted dashboard with auth and RBAC | Not started |

## FAQ

**Does it connect to my database?** No, never.

**Does it send my SQL anywhere?** No network calls exist in the core.

**Is the lineage guaranteed correct?** No. It is evidence for review inside a documented subset; unknowns are listed.

**Why is something "possible" rather than "confirmed"?** The column is used in a filter, join or group, or only a table-level dependency was found.

**Can it read dbt projects?** Manifest metadata, yes. Compiled SQL scanning works on compiled files. Jinja inside SQL is flagged.

**Is the audit independent?** It is a self-audit. It prints its limits and how to reproduce it.

**What is the 100% gold score?** Author-labelled regression corpus of 54 cases. Not a claim about your SQL; run `audit --root`.

**Does an AI agent run the tool for me?** Skills instruct a host agent; whether your host runs them natively is untested.

**Package name?** `lineagesutra-ai`; commands `lineagesutra` and `lineagesutra-ai`.
