# Cheat sheet

## Commands

| I want to | Command |
|---|---|
| See the lineage map | `lineagesutra scan --root ./sql --out lineage.html` |
| Save it for later commands | `lineagesutra scan --root ./sql --out lineage.json` |
| Know what breaks | `lineagesutra impact --input lineage.json --table T --column C --change rename` |
| Know where a column comes from | `lineagesutra upstream --input lineage.json --table T --column C` |
| Compare two versions | `lineagesutra compare --before a.json --after b.json --fail-on-breaking` |
| Check declared rules | `lineagesutra contract --input lineage.json --contract contracts.json` |
| Import dbt metadata | `lineagesutra dbt --input manifest.json` |
| Check a report was not edited | `lineagesutra verify --input report.json` |
| Audit the tool or my SQL | `lineagesutra audit --root ./sql --out audit-out` |
| Give an AI agent safe tools | `lineagesutra mcp --root ./sql` |
| Install skills for my IDE | `lineagesutra install-skills --ide claude --project .` |

Output format follows the file extension: `.json`, `.md`, `.html`, `.mmd` (Mermaid).

## Reading the symbols

| You see | Means |
|---|---|
| `direct` | Plain copy of a column |
| `derived` | Computed from a column |
| `indirect` | Column only decides which rows exist |
| `supported-subset` | Parsed from SQL inside the documented subset |
| `possible-indirect` / `possible-table-level` | Not proven at column level |
| `external` | Referenced but never declared in scanned SQL |
| `partial` / `unknown` | The parser could not read everything |

## Turn warnings into zero

1. Add the `CREATE TABLE` statements the views read from.
2. Replace `SELECT *` over undeclared tables, or declare them.
3. Compile dbt models and scan the compiled folder.
4. Re-run `scan --strict`.

## Limits at a glance

Static SQL text only. Documented subset, no dialect certified. Contract checks use declared DDL, not production. The seal detects edits; it does not prove authorship. `serve` is for localhost only.
