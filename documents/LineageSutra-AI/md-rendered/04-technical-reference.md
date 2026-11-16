# Technical reference

## Report: `lineagesutra.scan.v1`

| Field | Meaning |
|---|---|
| `tool` | name, version, parser id (`lineagesutra-sql-subset/2`) |
| `summary` | counts, per-type edge counts, `coverage` (supported-subset / partial / unknown) |
| `sources[]` | path, `sha256`, bytes, dialect hints |
| `nodes[]` | `id`, `kind`, `columns`, `columnTypes`, `notNull`, `sensitivityHints`, `source`, `certainty` |
| `edges[]` | `from`, `to`, `type`, `kind`, `role`, `certainty`, `source{file,line,col}` |
| `warnings[]` | `file`, `line`, `kind`, `detail` |
| `limits[]` | what this report does not claim |
| `integrity` | `sha256` over canonical JSON |

Warning kinds: `column-unknown`, `unsupported`, `parse`, `duplicate`, `duplicate-column`, `cycle`, `dependency-ambiguous`, `schema-version` (dbt), `missing-reference` (dbt).

## Other formats

`lineagesutra.impact.v1`, `.upstream.v1`, `.contract.v1`, `.compare.v1`, `.audit.v1`. Each stores `inputIntegrity` of its source graph and its own seal.

## CLI

```bash
lineagesutra scan --root <dir> [--out f] [--format json|md|html|mmd] [--strict] [--max-files N]
lineagesutra impact --input g.json --table T [--column C] [--change rename|drop|type|modify] [--fail-on confirmed|possible|any]
lineagesutra upstream --input g.json --table T [--column C]
lineagesutra compare --before a.json --after b.json [--fail-on-breaking]
lineagesutra contract --input g.json --contract c.json
lineagesutra dbt --input manifest.json
lineagesutra verify --input report.json
lineagesutra audit [--root dir] --out dir [--with-tests] [--force] [--quiet]
lineagesutra install-skills --ide claude --project .
lineagesutra serve --input g.json [--port 8787]
lineagesutra mcp --root dir
```

Exit codes: 0 ok, 1 audit failed, 2 usage/input error, 3 gate tripped.

## Node API

```js
import {scan, impact, upstream, compare, contractsCheck, verify} from 'lineagesutra-ai';
const g = scan('./sql');
const r = impact(g, {table: 'customers', column: 'email', change: 'rename'});
```

## Contract file

```json
{"datasets":[{"name":"customers","requiredColumns":["id",{"name":"email","type":"text","nullable":false}],"forbiddenColumns":["ssn"],"owner":"data-team","freshnessSla":"PT1H"}]}
```

## MCP tools

`scan_repository`, `get_parser_coverage`, `downstream_impact`, `upstream_dependencies`, `generate_change_checklist`, `verify_evidence`. Protocols 2025-06-18, 2025-03-26, 2024-11-05. No tool accepts a path.

## HTTP API

`GET /health`, `/report`, `/impact?table=&column=&change=`; `Authorization: Bearer $LINEAGESUTRA_TOKEN` (min 16 chars); 127.0.0.1 only.

## Limits

2,000,000 bytes per SQL file; 500 files default (max 5,000); 400,000 tokens; query nesting 40; manifest 8 MB / 3,000 nodes.
