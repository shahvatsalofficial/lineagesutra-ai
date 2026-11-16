# Cross-IDE and agent runtime support

| Host | Project-local skill-copy destination | Tested in this starter | Native invocation |
| --- | --- | --- | --- |
| Claude Code | `.claude/skills/` | Copy command tested on Linux | NOT_TESTED |
| Cursor | `.cursor/skills/` | Copy command tested on Linux | NOT_TESTED |
| Codex | `.agents/skills/` | Copy command tested on Linux | NOT_TESTED |
| Gemini CLI | `.gemini/skills/` | Copy command tested on Linux | NOT_TESTED |
| GitHub Copilot | `.github/skills/` | Copy command tested on Linux | NOT_TESTED |
| OpenCode | `.opencode/skills/` | Copy command tested on Linux | NOT_TESTED |

The canonical `skills/<skill-name>/SKILL.md` folders are host-independent instruction packages. Check your exact IDE/version and supported discovery paths; copying files does not verify automatic skill loading, model availability, tool permissions, or agent orchestration. Claude agent definitions are separately under `.claude/agents/`. Additional VS Code, Windsurf, Kiro, Antigravity, Aider, Roo/Cline and agent frameworks require appropriate tested adapters—not universal claims.
