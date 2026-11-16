# Glossary

| Term | Meaning |
|---|---|
| Lineage | Which inputs a dataset or column is built from |
| Column-level lineage | Lineage per column, not just per table |
| Direct edge | Output column is a plain copy of an input column |
| Derived edge | Output is an expression, aggregate, window or subquery over the input |
| Indirect edge | Input only decides which rows exist or how they group/order |
| Confirmed (static) | A parsed column path exists; not a database test |
| Possible | Not proven at field level |
| Proof path | The edge list that justifies a finding, with `file:line:col` |
| External node | Dataset referenced but not declared in scanned SQL |
| Gold corpus | Hand-labelled SQL cases with expected edges |
| Wilson interval | 95% confidence interval for a proportion |
| Seal | SHA-256 over canonical JSON; tamper evidence |
| Evidence capsule | A sealed report with sources and hashes |
| DriftRadar | `compare` between two scans |
| ContractGuard | Metadata contract checks |
| Agent Skill | A `SKILL.md` instruction pack for an AI host |
| MCP | Model Context Protocol; tool interface for AI clients |
| Subset parser | Parser covering documented constructs; reports the rest |
| Warning | A thing the parser refused to guess |
