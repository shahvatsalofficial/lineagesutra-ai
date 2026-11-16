# Evidence model

Every statement LineageSutra AI makes carries one of these statuses. Agents and reports must not upgrade a status.

| Status | Meaning |
|---|---|
| `verified` | Produced by a real command run during this session, with traceable source and provenance |
| `supported-subset` | A static rule matched inside the documented SQL subset. Not a universal SQL correctness assertion |
| `possible` | Inferred (indirect dependency or table-level link). Not proven column flow |
| `not-run` | A runtime, adapter or check was not installed, authorized or executed |
| `blocked` | Consent, scope, privacy, unsupported syntax or policy prevents proceeding |

## Edge certainty values in reports

`supported-subset` (parsed from SQL), `dbt-declared-metadata` (declared in a manifest, not parsed), `possible-indirect`, `possible-table-level`, `inferred-from-reference` (external node), `partial`, `unknown`.

## Independent dimensions

`metadata_valid`, `data_observed`, `test_executed` and `not_run` are kept separate. A contract satisfied by local SQL is **not** evidence that a production table has those columns, and a column called `created_at` is not evidence of freshness.

## The integrity seal

`integrity.hash` is SHA-256 over the canonical JSON (sorted keys, no whitespace) of the report without its `integrity` field.

- It detects accidental or malicious edits to a stored report: `lineagesutra verify`.
- It does **not** prove authorship or time. Anyone can recompute it after editing. Signed capsules (Sigstore/cosign) are on the roadmap.
- Derived reports (`impact`, `compare`, ...) store `inputIntegrity`, the seal of the graph they were computed from.

## Provenance fields

Each edge has `source.file`, `source.line`, `source.col`. Each scan lists every input file with its SHA-256 and byte size, plus detected dialect hints (hints, not certification). Parser version is recorded in `tool.parser`.

## What a reviewer should do with a report

1. Read `warnings` first; they are the parts nobody checked.
2. Treat `impacted` as the minimum set to review, `possible` as the next set.
3. Confirm with the owning team and with tests before changing anything. Nothing here modifies SQL.
