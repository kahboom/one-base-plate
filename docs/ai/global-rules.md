# Global rules (agents)

Read this file at session start when working in this repo. **Append** new global rules here when the user corrects you, a pattern is rejected, or a codebase assumption was wrong — keep each rule one line.

**Format:** `N. [CATEGORY] Never/Always do X — because Y.`  
**Categories:** `[STYLE]`, `[CODE]`, `[ARCH]`, `[TOOL]`, `[PROCESS]`, `[DATA]`, `[UX]`, `[OTHER]`  
If two rules conflict, the **higher-numbered (newer)** rule wins. Do not delete old rules; add a superseding rule instead.

## Where to record what

| Kind of learning | Where |
| ---------------- | ----- |
| Stable shared facts (stack, paths) | [`canonical-state.md`](./canonical-state.md) |
| Short constraint every agent should follow | This file (`docs/ai/global-rules.md`) |
| Specialist / deep-dive findings for one agent | `.claude/agent-memory/<agent-name>/` (`MEMORY.md` + supporting files; see [`memory-system.md`](./memory-system.md)) |
| Repeatable multi-step procedures | [`workflows/`](./workflows/) |
| Architectural or product decision with context | [`decision-log.md`](./decision-log.md) |
| Session / shipped work narrative | `agent-progress.md`, `CHANGELOG.md` |

## Rules

<!-- Append new rules below. Do not renumber existing entries. -->

1. [ARCH] Agent-specific memory belongs under `.claude/agent-memory/<agent-name>/` (short `MEMORY.md` + supporting `.md` files), not in global rules. Specialist definitions in `.claude/agents/` should point at that folder’s `MEMORY.md`.
