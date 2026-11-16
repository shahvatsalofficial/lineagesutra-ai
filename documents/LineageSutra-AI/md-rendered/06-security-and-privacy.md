# Security and privacy

## Posture

Offline, read-only, no telemetry, zero runtime dependencies. This is a self-review backed by tests, **not** an independent penetration test.

## Data handled

SQL text, dbt manifests, contract JSON, previously generated reports. Never table rows, credentials or connection strings.

## Threats and controls

| Threat | Control |
|---|---|
| Symlink / path escape | Symlinks skipped; realpath containment |
| Resource exhaustion | File size, file count, token and nesting caps |
| Prompt injection in SQL comments/strings | Tokenizer drops comments; strings opaque; never echoed |
| SQL "executed" during parsing | No SQL engine or driver exists in the tool |
| XSS in HTML reports | Every dynamic value escaped; no inline scripts |
| Report tampering | SHA-256 seal verified by every command |
| Wrong confident lineage | Ambiguity becomes a warning; negative gold cases |
| MCP scope widening | Root fixed at start-up; no path arguments; no write tools |
| HTTP exposure | Loopback only; constant-time bearer check; GET only |
| Secrets in repo | CI token scan; audit credential scan |

## Residual risks

Report authenticity is unproven; parser bugs can still mis-resolve; `serve` must stay on localhost; AI hosts may have more privileges than this tool.

## Privacy

No network calls in scan, analysis, audit or MCP (statically checked). Reports contain names and paths: handle them as you would the SQL itself. Column-name hints are not PII classification.

## Reporting

GitHub private vulnerability reporting; see SECURITY.md.
