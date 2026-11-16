# Security policy

## Supported versions

Only the latest published `0.x` release receives fixes.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository (Security tab -> Report a vulnerability). Do not open a public issue for an exploitable bug. Include the version, a minimal sanitized SQL or JSON input, and the observed impact. Expect an acknowledgement within a few days; this is a volunteer project, so no SLA is promised.

## In scope

Path traversal or symlink escape in discovery, crashes or hangs on crafted SQL/JSON, report tampering that `verify` fails to detect, injection in HTML or Markdown output, MCP or HTTP scope escape, secrets leaking into reports.

## Out of scope

Wrong lineage on SQL outside the documented subset (open a normal issue), denial of service by running the loopback server on a public interface, anything requiring a malicious local user who can already edit the installed package.

## Design stance

Offline, read-only, no telemetry, no network in the core, zero runtime dependencies. See docs/THREAT_MODEL.md for the controls, tests and residual risks. This project has **not** had an independent security review.

## Credentials

Never put tokens in SQL, issues or reports. CI scans for committed tokens. Publishing uses npm trusted publishing (OIDC) so no long-lived npm token is stored in the repository.
