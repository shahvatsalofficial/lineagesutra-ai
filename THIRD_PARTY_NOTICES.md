# Third-party notices

## Bundled code

None. `package.json` declares no `dependencies` or `devDependencies`. Everything runs on the Node.js standard library (`node:fs`, `node:path`, `node:crypto`, `node:http`, `node:readline`, `node:test`, ...).

## Referenced standards and optional tools (not bundled, not required)

| Item | Role | Where |
|---|---|---|
| Agent Skills `SKILL.md` convention | Layout of `skills/` | docs/IDE_COMPATIBILITY.md |
| Model Context Protocol | Wire format of `lineagesutra mcp` (hand-implemented subset: initialize, ping, tools/list, tools/call) | packages/server/mcp.mjs |
| dbt manifest schema (v7-v12 exercised) | Input format of `lineagesutra dbt` | fixtures/sample/dbt-manifest.json (synthetic) |
| SQLGlot, OpenLineage, OpenMetadata, DataHub, Great Expectations, Sigstore | Planned integrations only | ROADMAP.md |
| Mermaid | Text export format only | `--format mmd` |

Each item's license and trademark belong to its owners. Review them before you add any of these to your own pipeline.
