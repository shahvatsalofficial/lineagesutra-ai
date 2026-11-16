# User guide

## 1. First graph in under a minute

```bash
npx lineagesutra-ai scan --root ./sql --out lineage.html
```

Open `lineage.html`. Read **Unresolved or unsupported SQL** first.

## 2. Ask what a change breaks

```bash
npx lineagesutra-ai scan --root ./sql --out lineage.json
npx lineagesutra-ai impact --input lineage.json --table customers --column email --change rename --out impact.html
```

- **Confirmed**: a parsed column path exists. Review every one.
- **Possible**: the column is used in a filter/join/group, or a downstream table exists. Check with the owner.
- **Checklist**: paste into the pull request.

## 3. Trace where a column comes from

```bash
npx lineagesutra-ai upstream --input lineage.json --table email_metrics --column address
```

## 4. Catch breaking changes in CI

```bash
lineagesutra scan --root sql --out new.json --strict
lineagesutra compare --before baseline.json --after new.json --fail-on-breaking --out drift.html
```

Exit code 3 fails the job. Publish the HTML as an artifact.

## 5. Make unknowns disappear

Most warnings are `column-unknown`: a `SELECT *` or unqualified column over a table whose `CREATE TABLE` is not in the scanned folder. Add the DDL to the folder and re-scan.

## 6. Audit

```bash
npx lineagesutra-ai audit --root ./sql --out audit-out
```

Open `audit-out/audit-report.html`. Share the `.md` in a pull request.

## 7. Use with AI tools

```bash
npx lineagesutra-ai install-skills --ide claude --project .
npx lineagesutra-ai mcp --root ./sql
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `--root is required` | Pass the folder with `.sql` files |
| `TARGET_NOT_FOUND` | Table name not in the graph; check case and schema prefix |
| Many `unsupported` warnings | Templated or dynamic SQL; compile dbt models first and scan the compiled folder |
| `integrity invalid` | Report was edited; re-run the scan |
| Exit 3 | A gate you requested tripped; read the report |
