# Architecture

LineageSutra AI is five composable layers. Only A, B (partly), C and D are implemented in v0.2.0.

```text
SQL files / dbt manifest
        |  discover (symlinks skipped, size/count caps, realpath containment)
        v
  tokenizer.mjs ---> parser.mjs ---> scan.mjs ----> sealed report (lineagesutra.scan.v1)
  (comments dropped,  (statements,    (multi-pass,        |
   strings opaque,     queries,        cross-file         +--> analysis.mjs: impact, upstream, compare, contract
   Jinja -> tmpl)      resolution)     schema registry)   +--> reporting: JSON / Markdown / HTML / Mermaid
                                                          +--> audit.mjs + gold.mjs: self-audit
                                                          +--> server: MCP (stdio), loopback HTTP
                                                          +--> skills + role files for IDE agents
```

## Layer A - trusted local core (`packages/core`)

| Module | Responsibility |
|---|---|
| `tokenizer.mjs` | Dependency-free lexer. Drops comments; turns strings into opaque `str` tokens; understands `"x"`, `` `x` ``, `[x]`, `$$...$$`, Unicode identifiers; turns `{{ }}`/`{% %}` into `tmpl` tokens. Hard token cap |
| `parser.mjs` | Recursive-descent subset parser. Produces nodes, edges and warnings. Never throws on bad SQL; every statement is isolated in try/catch |
| `scan.mjs` | File discovery, multi-pass cross-file schema resolution (producers before consumers), duplicate/cycle/external-node handling, sealing |
| `analysis.mjs` | `impact`, `upstream`, `compare`, `contractsCheck` over a verified report |
| `dbt.mjs` | Metadata-only manifest import |
| `util.mjs` | Canonical JSON, SHA-256 seal/verify, normalization, path containment |
| `gold.mjs`, `audit.mjs` | Measured accuracy and the self-audit |

### Data model

Node: `{id, kind: table|view|materialized_view|external|source|model|exposure, columns, columnTypes?, notNull?, sensitivityHints?, source:{file,line}, certainty}`.

Edge: `{from, to, type: table|column|indirect, kind?: direct|derived, role?: window|subquery|filter|join|group|having|order, certainty, source:{file,line,col}}`.

- `direct`: the output column is a plain copy of one input column.
- `derived`: the output is an expression, aggregate, window or subquery over the input.
- `indirect`: the input only decides which rows exist or how they are grouped or ordered (an `indirect` edge points at the dataset, not a column).

Identity policy: names are unquoted and lower-cased; schema qualifiers are kept (`dbo.t`); an unqualified reference resolves to a declared dataset when exactly one declared name ends with it (`t` -> `s.t`), and a `dependency-ambiguous` warning is raised when several match. Datasets referenced but never declared become explicit `external` nodes.

### Column resolution

For each reference the parser classifies every source in scope as `yes` (declared column), `maybe` (schema unknown or incomplete) or `no`. Exactly one `yes` and no `maybe` resolves. A single `maybe` resolves but is unverified. Anything else is ambiguous and becomes a `column-unknown` warning instead of an edge.

### Impact algorithm

1. Breadth-first over `column` edges from `table.column` -> **confirmed** (proof path = edge list, with source lines).
2. From every reached column, `indirect` edges mark datasets as **possible-indirect** (a filter/join/group dependency).
3. Table-level descendants of the start table and of indirect datasets, excluding confirmed ones, are **possible-table-level**.
4. Cycles are safe (visited set). Complexity is linear in edges (20,000 datasets: see the audit).

## Layer B - adapters

Implemented: dbt manifest importer. Planned: SQLGlot bridge (isolated Python process with a versioned JSON stdio contract), OpenLineage events, catalog connectors. See ROADMAP.

## Layer C - Agent Skills (`skills/`, `agents/manifest.json`, `.claude/agents/`)

Twenty role contracts plus five capability skills, each a `SKILL.md` with frontmatter. They instruct a host agent to call the CLI, respect the evidence statuses and stop for human approval. A role file is not evidence of a separately running model.

## Layer D - hosts

CLI (all commands), Node API (`import {scan, impact} from 'lineagesutra-ai'`), MCP stdio server, loopback HTTP report reader, skill installer for Claude Code, Cursor, Codex, Copilot, Gemini CLI and OpenCode.

## Layer E - hosted server and dashboard

Not implemented. Requirements are in the threat model.

## Design decisions

| Decision | Why |
|---|---|
| Hand-written tokenizer and parser instead of regexes | Regexes mis-handle nesting, comments and strings; a token stream makes "comment text never leaks" a structural property |
| Unknown is a first-class outcome | A wrong confident edge is worse for a change-review tool than a visible gap |
| Zero runtime dependencies | No supply-chain surface; `npx` starts fast; the offline claim is easy to audit |
| Seal = SHA-256 of canonical JSON | Cheap tamper evidence; honestly not a signature |
| Output independent of file order | Reproducible reports; verified in the audit |
| MCP tools take no paths | A model cannot widen its own read scope |
