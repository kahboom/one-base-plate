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

## Cursor / Claude placement guide

| Agent belongs in `.claude/agents/` when...            | Agent belongs in `.cursor/agents/` when...         |
| ----------------------------------------------------- | -------------------------------------------------- |
| It can complete work autonomously (no human needed)   | It reviews, advises, or assists a human in the IDE |
| It makes commits or edits files as its primary output | It is read-only or advisory by default             |
| It has a narrow scope safe to run unattended          | It needs interactive back-and-forth to be useful   |

## Cursor to Claude write-back convention

Cursor agents (`.cursor/agents/`) are advisory and run alongside a human in the IDE. They do not have `MEMORY.md` files of their own. When a Cursor agent surfaces a significant finding — a new ontology rule, a confirmed scaling issue, a product decision — that insight should flow back into the shared system via one of:

- **`agent-progress.md`** — append a tagged entry, e.g. `[ontology-steward] Confirmed that "whole wheat pastry flour" needs its own catalog row.` Claude agents will see this in the next session.
- **`docs/ai/decision-log.md`** — for architectural or product decisions that need a dated record.
- **The relevant Claude agent's supporting `.md` file** — for specialist findings that should persist across Claude sessions.

Do not accumulate growing "known issues" sections inside Cursor agent files themselves — those are invisible to Claude agents.

## Legacy paths

- **Cursor** subagent specs remain in **`.cursor/agents/`** (editor integration).
- **Claude** subagent specs live in **`.claude/agents/`**.
- The `import-performance-scaling/` orphan memory folder was consolidated into `import-agent/import-agent.md` (2026-04-02).

See [`.claude/agent-memory/README.md`](../../.claude/agent-memory/README.md) for editing conventions.
