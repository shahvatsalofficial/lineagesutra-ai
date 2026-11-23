# CI recipes

![Breaking-change gate in a pull request](assets/ci-gate.svg)

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | `audit` failed |
| 2 | Usage or input error |
| 3 | A gate you asked for tripped (`--strict`, `--fail-on`, `--fail-on-breaking`) |

## Recipe 1: fail on unparsed SQL

```yaml
- run: npx lineagesutra-ai scan --root sql --out lineage.json --strict
```

## Recipe 2: block breaking changes

Keep a baseline graph from `main` (for example as a build artifact) and compare every pull request against it.

```yaml
name: lineage
on: pull_request
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}
      - uses: actions/setup-node@v4
        with: {node-version: 22}
      - name: Baseline from main
        run: |
          git worktree add ../base origin/main
          npx lineagesutra-ai scan --root ../base/sql --out baseline.json
      - name: Scan this PR
        run: npx lineagesutra-ai scan --root sql --out new.json
      - name: Compare
        run: npx lineagesutra-ai compare --before baseline.json --after new.json --fail-on-breaking --out drift.html
      - uses: actions/upload-artifact@v4
        if: always()
        with: {name: lineage-drift, path: drift.html}
```

## Recipe 3: guard a specific column

```yaml
- run: npx lineagesutra-ai impact --input new.json --table customers --column email --fail-on confirmed --out impact.html
```

Exit 3 whenever something downstream depends on that column. Use it on a column you have promised never to change silently.

## Recipe 4: attach the audit

```yaml
- run: npx lineagesutra-ai audit --root sql --out audit-out
- uses: actions/upload-artifact@v4
  with: {name: audit-report, path: audit-out}
```

## Recipe 5: verify a stored report

```bash
npx lineagesutra-ai verify --input lineage.json
```

Fails with exit 2 if anyone edited the file.

## Tips

- Commit `baseline.json` only if your SQL folder is not sensitive; reports contain table and column names.
- Pin the version (`lineagesutra-ai@0.2.0`) in CI for reproducible results.
- Read warnings first. A gate that ignores them gives false comfort.
