# Change impact / schema rename

**Owner:** LineageSutra Prime + specialist skill

**Trigger:** Explicitly scoped user request.

## Ordered steps
1. Confirm authorized workspace and no row-level data policy.
2. Compute transitive dependencies and field impacts for the proposed change.
3. Record source provenance, evidence of execution and uncertainties.
4. Invoke Evidence Ledger / Security Sentinel for independent review.
5. Return proposed actions for human approval; never execute SQL or production migration.

**Required evidence:** Definite field paths plus possible table dependents.

**Status:** Documented workflow. Individual CLI steps available as specified in docs/STATUS.md; full autonomous orchestration not yet implemented.
