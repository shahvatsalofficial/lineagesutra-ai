# Test report

Recorded 2026-11-16T18:03:17.735Z on win32/x64, Node v24.15.0. Raw output: `test-results/test-run.tap`.

| Measure | Value |
|---|---|
| Tests | 157 |
| Passed | 153 |
| Failed | 0 |
| Skipped | 4 (symlink tests that Windows forbids without privileges) |

## Test areas

- Tokenizer, parser, scan, determinism, file-order independence
- Gold corpus: 54 cases, 148 expected edges, precision 100%, recall 100% (author-labelled)
- Impact, upstream, compare (DriftRadar), contract, dbt
- Property test: 200 random graphs, adding edges never shrinks confirmed impact
- Fuzz: 1,500 seeded token streams in tests; 3,000 more in the audit
- CLI: formats, exit codes, gates, audit outputs, npm-bin symlink behaviour
- MCP: unit and real stdio round trip
- Security: tamper detection, symlinks, caps, XSS, injection text

## Gold corpus detail

54 cases tagged basic, join, expr, indirect, cte, subquery, setop, wildcard, ddl, naming, postgres, tsql, mysql, dbt, adversarial, negative. Full per-case results: `test-results/gold-results.json`.

## Audit

28 passed, 0 failed, 7 not run. Open `samples/audit-report.html`.

## Performance (this machine, synthetic)

2,000 chained views: undefined ms median. 20,000-dataset impact: undefined ms median.

## Not covered

Real-world dialect corpora, third-party MCP clients, native IDE skill activation, independent review. CI results for Windows, macOS and Linux are on the GitHub Actions page.

## Reproduce

```bash
npm test
npm run proof
```
