# Assurance and evidence

What a skeptical reader can check themselves.

| Claim | Evidence | How to re-check |
|---|---|---|
| Tests pass | `test-results/test-run.tap` (153 pass, 0 fail) | `npm test` |
| Lineage matches labels | `test-results/gold-results.json` (54/54) | `npm run proof` |
| Read-only | audit: tree hash identical before/after | `lineagesutra audit --out x` |
| Offline | audit: core/reporting import no network or subprocess modules | open `packages/core` |
| Deterministic | audit: same seal, any file order | audit |
| Tamper-evident | audit: three mutation kinds fail `verify` | `lineagesutra verify` |
| Robust | audit: 3,000 seeded fuzz inputs, 500-deep nesting, 5,000 columns | audit |
| Fast | audit: undefined ms / undefined ms | audit |
| Package integrity | audit: 25 skills, 20 roles, schemas, no tokens | audit |

## Sample artifacts

- `samples/audit-report.html`, `.md`, `.json`
- `samples/cli-*.txt` real command transcripts
- `test-results/environment.json`

## What is not evidenced

Independent review, third-party MCP client runs, native IDE activation, real-world dialect accuracy, signed provenance. These are listed as NOT_RUN in every audit.

## Verdict scale

PASS = all executed checks passed. Not a certification.
