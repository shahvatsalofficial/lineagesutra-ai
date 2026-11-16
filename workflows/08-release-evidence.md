# Reproducible verification and CI gate

**Owner:** LineageSutra Prime + specialist skill

**Trigger:** Explicitly scoped user request.

## Ordered steps
1. Confirm authorized workspace and no row-level data policy.
2. Replay fixtures, verify report seals, compare graph snapshots and approval gates.
3. Record source provenance, evidence of execution and uncertainties.
4. Invoke Evidence Ledger / Security Sentinel for independent review.
5. Return proposed actions for human approval; never execute SQL or production migration.

**Required evidence:** Real test outputs and explicit not-tested capabilities.

**Status:** Documented workflow. Individual CLI steps available as specified in docs/STATUS.md; full autonomous orchestration not yet implemented.
