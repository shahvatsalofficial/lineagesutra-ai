# LineageSutra AI — Optional plugins, tools and MCP catalog

Created by Vatsal Shah. These integrations are recommendations, **not installed or implemented by the v0.1 offline starter** unless explicitly marked otherwise. Review current versions, licenses, requested permissions and security advisories before installing.

| Candidate | Purpose | Proposed priority | Current state | Official documentation |
|---|---|---|---|---|
| Node.js 20+ | Offline core | Working | Verified on Node 22/Linux | https://nodejs.org/ |
| SQLGlot | Dialect-aware SQL AST, qualification and column lineage | P0 | Not installed | https://sqlglot.com/sqlglot/lineage.html |
| Python uv | Isolated pinned optional Python bridge | P0 for SQLGlot adapter | Not installed by starter | https://docs.astral.sh/uv/ |
| dbt manifest | Declarations and dependencies | Partial | Metadata-only importer tested on synthetic fixture | https://schemas.getdbt.com/ |
| OpenLineage | Run/job/dataset facet lineage interchange | P1 | Planned | https://openlineage.io/ |
| DuckDB | Isolated SQL test and local catalog | P1 | Planned | https://duckdb.org/ |
| OpenMetadata | Catalog metadata and owners | P2 | Planned | https://open-metadata.org/ |
| DataHub | Optional enterprise metadata catalog | P2 | Planned | https://datahubproject.io/ |
| Great Expectations | Approved data contract/test execution | P2 | Planned | https://greatexpectations.io/ |
| Ajv / JSON Schema | Versioned input/output schema validation | P1 | Minimal manually checked contracts | https://ajv.js.org/ |
| MCP official SDK and Inspector | Portable permissioned read-only tool server | P2 | Planned | https://modelcontextprotocol.io/ |
| GitHub Actions | Cross-platform test CI | P0 | Workflow declared, hosted runs not tested | https://docs.github.com/en/actions |
| OpenTelemetry | Optional diagnostic traces | P3 | Planned | https://opentelemetry.io/ |
| Gitleaks | Secrets scanning | P1 | Not installed | https://github.com/gitleaks/gitleaks |
| OSV-Scanner | Dependency vulnerability scan | P1 | Not installed | https://github.com/google/osv-scanner |
| Cosign/Sigstore | Signed release/capsules | P2 | Planned | https://docs.sigstore.dev/ |
| Docker/Testcontainers | Permissioned isolated SQL tests | P2 | Planned | https://testcontainers.com/ |
| Mermaid | Graph visualization | Partial | Mermaid text exporter working | https://mermaid.js.org/ |
| Playwright | Optional accessible UI browser testing | P3 | Planned | https://playwright.dev/ |
| Claude Code | Native Agent Skills and subagent role files | P0 | Skill files authored, native invocation not tested | https://code.claude.com/docs/en/skills |
| Cursor | Project-local Agent Skills adapter | P1 | File-copy tested, native invocation not tested | https://cursor.com/ |
| OpenAI Codex | Agent Skills file distribution | P1 | File-copy tested, native invocation not tested | https://developers.openai.com/codex/ |
| Gemini CLI | Agent Skills file distribution | P1 | File-copy tested, native invocation not tested | https://geminicli.com/ |
| GitHub Copilot | Project-local skill/instruction conventions | P1 | File-copy tested, native invocation not tested | https://docs.github.com/en/copilot |
| OpenCode | Project-local skills | P2 | File-copy tested, native invocation not tested | https://opencode.ai/ |

### Installation policy
No automatic global plugins. Ask for consent before network, package downloads, model providers, environment setup, SQL database access, large artifact uploads, cloud credentials or production changes. Prefer pinned project-local adapters, reviewed CI, and a meaningful offline baseline. Test compatibility with the host actually installed, and report unsupported versions honestly.

### Third-party references
SQLGlot source: https://sqlglot.com/sqlglot/lineage.html  
OpenLineage spec: https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md  
dbt schema versions: https://schemas.getdbt.com/  
These upstream materials can change; revalidate during implementation.
