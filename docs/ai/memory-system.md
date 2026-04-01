# Agent memory system (layered)

OneBasePlate uses **shared durable docs** plus **per-agent memory** under `.claude/agent-memory/<agent-name>/`. No single global blob for everything.

## Layers (what goes where)

| Layer                 | Location                                     | Contents                                                         |
| --------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| **Canonical facts**   | [`canonical-state.md`](./canonical-state.md) | Stack pins, paths, sources of truth — short table, rarely edited |
| **Global rules**      | [`global-rules.md`](./global-rules.md)       | One-line numbered constraints **every** agent must follow        |
| **Decisions**         | [`decision-log.md`](./decision-log.md)       | Why we chose X (architecture/product), with date                 |
| **Workflows**         | [`workflows/`](./workflows/)                 | Reusable how-to steps (PRD slice, seed workflow pointers)        |
| **Specialist memory** | `.claude/agent-memory/<agent-name>/`         | Discoveries, hot paths, checklists for **that** role only        |

## Per-agent directory layout

```
.claude/agent-memory/<agent-name>/
  MEMORY.md          # Short curated summary — read first every session
  <agent-name>.md    # Deeper notes, links, optional findings (or findings.md)
```

Optional extra files: `patterns.md`, `checklists.md` — only when they stay maintainable.

## Routing

- **Orchestrator** decomposes work and picks specialists; it does **not** own domain detail — see [`.claude/agents/orchestrator.md`](../../.claude/agents/orchestrator.md).
- Domain agents own code areas listed in their definitions; they **read** canonical state + global rules, **write** their own `MEMORY.md` / supporting files when something is confirmed.

## What not to do

- Do **not** paste long codebase dumps into `global-rules.md`.
- Do **not** put specialist-only findings in canonical state unless they become project-wide fact.
- Do **not** let `MEMORY.md` grow into an essay — summarize; move detail to the sibling `.md` file.

## Legacy paths

- **Cursor** subagent specs remain in **`.cursor/agents/`** (editor integration).
- **Claude** subagent specs live in **`.claude/agents/`**.
- Older specialist memory (e.g. `import-performance-scaling/`) may remain until merged into `import-agent/`; import-agent’s supporting file links to it when relevant.

See [`.claude/agent-memory/README.md`](../../.claude/agent-memory/README.md) for editing conventions.
