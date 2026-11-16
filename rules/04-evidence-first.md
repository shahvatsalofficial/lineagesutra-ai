# Evidence correctness

Policy: Every edge links to the observed SQL source; unparsed SQL stays unknown, never treated as complete.

Violation result: stop or flag `BLOCKED` / `HUMAN_REVIEW_REQUIRED`; do not bypass. Maintainer: Vatsal Shah.
