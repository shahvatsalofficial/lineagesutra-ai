# Repository scope boundaries

Policy: Read only explicitly allowed paths. Exclude symlinks and large binary/raw row files.

Violation result: stop or flag `BLOCKED` / `HUMAN_REVIEW_REQUIRED`; do not bypass. Maintainer: Vatsal Shah.
