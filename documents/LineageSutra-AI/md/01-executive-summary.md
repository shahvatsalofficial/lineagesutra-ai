# Executive summary

**LineageSutra AI {{VERSION}}** answers one question before a schema change reaches production: *if I change this column, what breaks, and where is the proof?*

## The problem

Analytics and data-platform teams rename and drop columns every week. Today the "impact analysis" is a grep, a meeting, or a catalog that is out of date. Mistakes surface as broken dashboards, failed jobs and silent wrong numbers.

## The product

An offline command-line tool and 25 portable AI-agent skills. It reads SQL files (or a dbt manifest), builds a column-level lineage graph, and returns:

- **Confirmed static impacts**, each with a proof path and `file:line`.
- **Possible impacts** (filters, joins, group-bys, table-level dependents), clearly labelled as not proven.
- **Warnings** for everything it could not parse. It never guesses.
- A **review checklist**, regression-test ideas and a sealed Markdown / HTML / JSON report.

## Why it is different

| Typical tool | LineageSutra AI |
|---|---|
| Needs a warehouse connection or SaaS account | Reads local files; no network, no credentials, no rows |
| Shows a graph, hides uncertainty | Separates confirmed from possible and lists unparsed SQL |
| Claims accuracy | Publishes a gold corpus, its labels, and its limits |
| Opaque output | Deterministic, SHA-256-sealed, reproducible reports |

## Proof, today

- {{TESTS}} automated tests: {{PASS}} pass, {{FAIL}} fail, {{SKIPPED}} skipped (recorded {{RECORDED}} on {{PLATFORM}}, Node {{NODE}}).
- Gold corpus: {{GOLD_PASSED}}/{{GOLD_CASES}} cases exact, {{GOLD_EDGES}} expected edges, 0 false edges, 0 missed edges. Author-labelled regression corpus, not an independent benchmark.
- Self-audit: {{CHECKS_PASSED}} checks passed, {{CHECKS_FAILED}} failed, {{CHECKS_NOTRUN}} explicitly not run.
- 2,000-view scan median {{SCAN_MS}} ms; impact over a 20,000-dataset graph median {{IMPACT_MS}} ms (this machine, synthetic data).

## Honest limits

A documented SQL subset, not a certified dialect parser. Static text analysis only. No live-database verification. No independent security review. The SHA-256 seal is tamper evidence, not a signature.

## Where it goes next

SQLGlot bridge for dialect depth, OpenLineage import, git-aware schema diffs and signed evidence. See the roadmap.
