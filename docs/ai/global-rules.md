# Global rules (agents)

Read this file at session start when working in this repo. **Append** new global rules here when the user corrects you, a pattern is rejected, or a codebase assumption was wrong — keep each rule one line.

**Format:** `N. [CATEGORY] Never/Always do X — because Y.`  
**Categories:** `[STYLE]`, `[CODE]`, `[ARCH]`, `[TOOL]`, `[PROCESS]`, `[DATA]`, `[UX]`, `[OTHER]`  
If two rules conflict, the **higher-numbered (newer)** rule wins. Do not delete old rules; add a superseding rule instead.

## Where to record what

| Kind of learning | Where |
| ---------------- | ----- |
| Short constraint every agent should follow | This file (`docs/ai/global-rules.md`) |
| Specialist / deep-dive findings for one agent | `.claude/agent-memory/<agent-name>/` (or path named in that agent’s doc) |
| Architectural or product decision with context | [`decision-log.md`](./decision-log.md) |
| Session / shipped work narrative | `agent-progress.md`, `CHANGELOG.md` |

## Rules

<!-- Append new rules below. Do not renumber existing entries. -->

1. [ARCH] Agent-specific memory belongs in `.claude/agent-memory/<agent-name>.md`, not in global rules — keeps shared context small. When a specialist agent (e.g. import-performance-scaling) produces durable findings, write them to its memory file and add a “read that file at session start” instruction in that agent’s body.
