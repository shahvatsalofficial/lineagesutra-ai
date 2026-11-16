# Source and permissions discovery

**Owner:** LineageSutra Prime + specialist skill

**Trigger:** Explicitly scoped user request.

## Ordered steps
1. Confirm authorized workspace and no row-level data policy.
2. Determine authorized root, SQL files and metadata/PII restrictions.
3. Record source provenance, evidence of execution and uncertainties.
4. Invoke Evidence Ledger / Security Sentinel for independent review.
5. Return proposed actions for human approval; never execute SQL or production migration.

**Required evidence:** Inventory with source hashes; no database connections.

**Status:** Documented workflow. Individual CLI steps available as specified in docs/STATUS.md; full autonomous orchestration not yet implemented.
