# Functional specification

## Users and jobs

| Persona | Job |
|---|---|
| Analytics engineer | "I want to rename `customers.email`. Which models break?" |
| Data platform owner | Gate pull requests that break consumers (`--fail-on`, `--fail-on-breaking`) |
| Data steward | Check contracts and see which columns look sensitive by name |
| Security / privacy reviewer | Confirm the tool is offline and never reads rows (audit) |
| AI-coding-agent user | Give Claude Code, Cursor, Codex, Copilot or Gemini CLI a safe, evidence-bound lineage skill |

## Capabilities

| ID | Capability | Input | Output |
|---|---|---|---|
| F1 | Scan | folder of `.sql` | sealed graph: datasets, edges (`direct`/`derived`/`indirect`), warnings |
| F2 | dbt import | `manifest.json` | dataset graph from `depends_on` (metadata only) |
| F3 | Impact | graph, table, optional column, change type | confirmed, possible, proof paths, checklist, test ideas |
| F4 | Upstream | graph, table, column | sources and origins |
| F5 | Compare | two graphs | added/removed edges, column changes, breaking consumers |
| F6 | Contract | graph, contract JSON | findings; freshness/owner `not-run` |
| F7 | Verify | any report | seal valid or not |
| F8 | Audit | optional SQL folder | MD + HTML + JSON audit |
| F9 | Skills install | host, project | project-local `SKILL.md` copies |
| F10 | MCP / HTTP | folder or report | read-only tools / JSON |

## Edge semantics

- `direct`: the output column is a plain copy of one input column.
- `derived`: expression, function, aggregate, window or subquery over the input.
- `indirect`: the input decides which rows exist (WHERE, JOIN, GROUP, HAVING, ORDER). Points at a dataset.

## Acceptance behaviours

1. Renaming `customers.email` in the sample shows three confirmed consumers, one at two hops.
2. An ambiguous unqualified column over two joined tables yields a warning, not an edge.
3. A column used only in a WHERE clause is **possible**, never confirmed.
4. Text inside comments and strings never creates lineage.
5. `scan` of unchanged files produces an identical seal regardless of file order.
6. Editing any byte of a report makes `verify` fail.
7. Unknown table in `impact` returns `TARGET_NOT_FOUND`, not an empty success.
8. Gates: exit 3 when `--fail-on`, `--strict` or `--fail-on-breaking` trips.

## Non-goals

Executing SQL, connecting to databases, modifying SQL or migrations, measuring freshness, classifying PII, certifying any dialect, replacing tests or review.
