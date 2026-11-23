# Real-world scenarios

Each scenario uses the bundled synthetic sample (`fixtures/sample/sql`) or a fixture from the test suite, and shows output the tool really produces.

## 1. "Can I rename this column on Friday?"

**Situation.** Priya owns `customers`. Marketing wants `email` renamed to `contact_email`. She needs to know who breaks before she opens a ticket.

```bash
npx lineagesutra-ai scan --root ./sql --out lineage.json
npx lineagesutra-ai impact --input lineage.json --table customers --column email --change rename --out impact.html
```

**Result.**

| Affected column | Kind | Hops | Where |
|---|---|---|---|
| `customers_public.email` | direct | 1 | `01_customers_public.sql:2` |
| `campaign_recipients.email` | direct | 1 | `03_campaign_recipients.sql:2` |
| `email_metrics.address` | direct | 2 | via `customers_public.email` |

![Blast radius](assets/blast-radius.svg)

**Outcome.** Priya pastes the generated checklist into the ticket: three views to update, one of them owned by another team. The surprise `email_metrics` dependency is found on Tuesday, not discovered by a broken dashboard on Friday night.

## 2. The pull request that quietly drops a column

**Situation.** A developer edits `00_customers.sql` and renames the column but forgets the views. Code review sees a three-line diff.

```bash
lineagesutra scan --root sql --out new.json --strict
lineagesutra compare --before baseline.json --after new.json --fail-on-breaking --out drift.html
```

**Result.** Exit code `3`. The report says `BREAKING_CHANGES_DETECTED` and lists:

```text
customers.email  ->  campaign_recipients.email, customers_public.email, email_metrics.address
```

![Drift rename](assets/drift-rename.svg)

**Outcome.** The check fails before merge. The HTML is attached to the run, so the reviewer sees every broken consumer without reading SQL.

## 3. "Where does this dashboard number come from?"

**Situation.** A new analyst sees `email_metrics.address` and needs its origin.

```bash
npx lineagesutra-ai upstream --input lineage.json --table email_metrics --column address
```

**Result.** Origin: `customers.email`, through `customers_public.email`, two hops, each with a source line.

## 4. Privacy review: where does an email flow?

**Situation.** A steward must list every place a customer email is copied.

```bash
npx lineagesutra-ai impact --input lineage.json --table customers --column email
```

**Result.** Three downstream columns, plus a `sensitivityHints` list. The hint comes from the column **name** only. The tool says so in the report: a name is not a classification, and the report is not evidence of lawful processing.

## 5. A legacy warehouse full of `SELECT *`

**Situation.** Scanning an old folder gives many warnings.

```sql
CREATE VIEW v AS SELECT * FROM ext;
```

```text
column-unknown: Wildcard over ext cannot be expanded (schema not declared in scanned sources)
```

**Fix.** Add `CREATE TABLE ext (...)` to the folder, or export your DDL into it, and re-scan. The wildcard expands and the warning disappears. The audit's repository section counts how many warnings remain, so you can track progress to zero.

## 6. A column used only in a filter

```sql
CREATE VIEW active_users AS SELECT id FROM users WHERE status = 1;
```

Changing `users.status` does not change any **column** of `active_users`, but it changes **which rows exist**. LineageSutra AI reports `active_users` as **possible (indirect, role: filter)**, never as confirmed, and any view built on `active_users` as possible at table level. That is the honest answer: the owner should look.

## 7. A dbt project

```bash
npx lineagesutra-ai dbt --input target/manifest.json --out dbt.html
```

The manifest gives model-to-model links from `depends_on`. Column-level flow is **not** claimed from a manifest. To get column lineage, scan the **compiled** SQL in `target/compiled`; Jinja left inside SQL is flagged as unsupported.

## 8. An AI coding agent that must not wander

```bash
npx lineagesutra-ai mcp --root ./sql
```

The agent can call `downstream_impact`, `upstream_dependencies`, `get_parser_coverage` and four more tools. None accepts a file path, so it cannot read outside `./sql`. None writes anything.

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"downstream_impact","arguments":{"table":"customers","column":"email","change":"rename"}}}
```

## 9. Sharing evidence with auditors

```bash
npx lineagesutra-ai audit --root ./sql --out audit-out
```

Hand over `audit-report.html`. It shows what was measured (accuracy, safety checks, speed), what was **not** verified, and the commands to reproduce it. The JSON copy is sealed; the auditor runs `lineagesutra verify` on it.

## When not to use it

- To prove production data is correct. It never reads data.
- To analyse SQL generated at runtime by an ORM.
- As a substitute for tests and review. It tells you where to look.
