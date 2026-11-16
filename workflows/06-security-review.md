# Sensitive metadata and security audit

**Owner:** LineageSutra Prime + specialist skill

**Trigger:** Explicitly scoped user request.

## Ordered steps
1. Confirm authorized workspace and no row-level data policy.
2. Apply no-row-data policy, path/symlink protections, redaction and source provenance.
3. Record source provenance, evidence of execution and uncertainties.
4. Invoke Evidence Ledger / Security Sentinel for independent review.
5. Return proposed actions for human approval; never execute SQL or production migration.

**Required evidence:** Privacy evidence and review-needed flags.

**Status:** Documented workflow. Individual CLI steps available as specified in docs/STATUS.md; full autonomous orchestration not yet implemented.
