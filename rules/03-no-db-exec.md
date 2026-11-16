# No database execution

Policy: Never connect to or change live databases by default. Require scoped credentials, consent and separate sandbox for opt-in tests.

Violation result: stop or flag `BLOCKED` / `HUMAN_REVIEW_REQUIRED`; do not bypass. Maintainer: Vatsal Shah.
