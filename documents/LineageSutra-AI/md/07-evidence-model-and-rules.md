# Evidence model and rules

## Statuses

| Status | Meaning |
|---|---|
| `verified` | Produced by a real command with traceable provenance |
| `supported-subset` | Static rule match inside the documented subset |
| `possible` | Inferred, not proven column flow |
| `not-run` | Not installed, authorized or executed |
| `blocked` | Policy, consent or unsupported syntax stops it |

## Edge certainty

`supported-subset`, `dbt-declared-metadata`, `possible-indirect`, `possible-table-level`, `inferred-from-reference`, `partial`, `unknown`.

## Independent dimensions

`metadata_valid`, `data_observed`, `test_executed`, `not_run` never merge. A contract met by SQL is not evidence about a production table.

## Seal

SHA-256 of canonical JSON without `integrity`. Detects edits. Does not prove author or time.

## The ten rules (`rules/`)

1. Authorized scope only. 2. Zero data rows. 3. No database execution. 4. Evidence first. 5. No automatic fixes. 6. Secret redaction. 7. Prompt-injection resistance. 8. Release gate. 9. Host portability. 10. Versioned output.

## Reviewer routine

Read warnings; review `impacted`; check `possible`; confirm with owners and tests; never auto-apply.
