# Architecture

```text
SQL files / dbt manifest
   -> discover (no symlinks, caps, realpath containment)
   -> tokenizer (comments dropped, strings opaque, Jinja -> tmpl)
   -> parser (statements, queries, column resolution)
   -> scan (multi-pass, producers before consumers) -> sealed graph
   -> analysis: impact | upstream | compare | contract
   -> reporting: JSON | Markdown | HTML | Mermaid
   -> audit + gold corpus
   -> hosts: CLI | Node API | MCP stdio | loopback HTTP | Agent Skills
```

## Modules (`packages/`)

| Path | Role |
|---|---|
| `core/tokenizer.mjs` | Lexer with a 400,000-token cap |
| `core/parser.mjs` | Recursive-descent subset parser; statement-level try/catch |
| `core/scan.mjs` | Discovery, cross-file schema registry, duplicates, cycles, external nodes, sealing |
| `core/analysis.mjs` | Impact, upstream, compare, contract |
| `core/dbt.mjs` | Manifest import |
| `core/util.mjs` | Canonical JSON, seal, verify, containment |
| `core/gold.mjs`, `core/audit.mjs` | Accuracy and self-audit |
| `reporting/index.mjs` | All renderers, shared design system |
| `server/` | `mcp.mjs` and loopback `index.mjs` |
| `cli/index.mjs` | Commands, exit codes |

## Column resolution

Each source in scope is `yes` / `maybe` / `no` for a column. One `yes` and no `maybe`: resolved. One `maybe`: resolved but unverified. Otherwise: warning.

## Impact algorithm

1. BFS over column edges: confirmed, with the edge list as proof.
2. Indirect edges from reached columns: possible-indirect datasets.
3. Table descendants of the start table and of indirect datasets: possible-table-level.
Cycle safe. Linear in edges.

## Cross-file schemas

Files are parsed with a carried registry, then re-ordered so producers precede consumers using the edges just found, and repeated until the schema signature stops changing (max 6 passes, warning if not).

## Decisions

Hand-written parser (structural comment safety); unknown as a first-class result; zero dependencies; seal over canonical JSON; file-order independence; MCP tools without path arguments.

## Layers

A core (done), B adapters (dbt done; SQLGlot planned), C skills (authored), D hosts (CLI, API, MCP, HTTP done), E hosted dashboard (not started).
