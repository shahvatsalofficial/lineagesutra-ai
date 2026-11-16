---
name: lineagesutra-downstream-impact
description: Trace change propagation and explain proven vs possible downstream risks.
---

# lineagesutra-downstream-impact

Trace change propagation and explain proven vs possible downstream risks.

## Workflow
1. Identify user-approved repository and data sensitivity boundaries.
2. Inspect source references, appropriate CLI capability and scoped assumptions.
3. Execute only the documented offline scanner/impact/contract checks or approved adapters.
4. Distinguish definite supported-subset edges from inferred and untested relationships.
5. Export a source-sealed JSON report and a human summary; preserve unsupported syntax warnings.

**Safety:** Never run SQL against a live database, ingest raw PII rows, modify production or invent findings. Ask before downloads, plugin installations and external calls. **Maintainer:** Vatsal Shah.
