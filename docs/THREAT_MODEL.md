# Threat model

Scope: the v0.2.0 CLI, library, MCP server and loopback API. This is a design review plus tests by the author, **not** an independent penetration test or certification.

## Assets

User SQL and metadata; the integrity of reports people rely on for change decisions; the host machine; secrets that may sit near SQL files.

## Trust boundaries

Everything read from disk (SQL, manifests, contracts, report JSON, skill files) is **untrusted data**. Nothing from those files is executed, evaluated or fetched.

## Threats and controls

| Threat | Control | Test |
|---|---|---|
| Path traversal / symlink escape during discovery | Symlinks and junction-like entries skipped; realpath containment check | audit `symlinked files and directories are not followed` (skips where the OS forbids symlinks) |
| Resource exhaustion (huge file, many files, deep nesting, wide tables, token flood) | 2,000,000-byte file cap, 500-file default cap (max 5,000), 400,000-token cap, depth limit 40 in queries | audit + analysis tests (500-deep parentheses, 5,000 columns) |
| Prompt injection via SQL comments, string literals or metadata | Comments are dropped by the tokenizer and strings are opaque; reports never echo them | audit `instructions inside SQL comments are inert data` |
| Malicious SQL "executed" while parsing | The tool has no SQL engine and no database driver | static import check in audit |
| XSS through hostile dataset names in HTML reports | Every dynamic value is escaped; no inline scripts exist in reports | audit + reporting tests |
| Report tampering | SHA-256 seal; every command verifies its input seal | audit (3 mutation kinds) |
| False confidence from guessed lineage | Ambiguity -> warning, never an edge; gold corpus has negative cases | gold corpus |
| Unauthorized read via MCP | Scope fixed at start-up; tools accept no paths; no write tools | `tests/mcp.test.mjs` |
| Unauthorized read via HTTP API | Loopback only, constant-time bearer comparison, token >= 16 chars, GET only | `tests/cli.test.mjs` |
| Secret exposure in reports | Reports contain names and file paths only, never row values; repo scan for tokens | audit `no credentials...` + CI secret scan |
| Supply chain | Zero runtime dependencies; npm provenance on release | `package.json`, release workflow |

## Residual risks

- Report **authenticity** is unproven (hash only). Treat reports from untrusted sources as untrusted.
- Parser logic bugs can still produce wrong edges or miss them. The gold corpus is small and author-written.
- `serve` is for localhost use only. Do not expose it to a network.
- Skill files are instructions to AI hosts; a host with its own tool permissions may do more than this tool does. Review what your host is allowed to run.

## Reporting

See SECURITY.md.
