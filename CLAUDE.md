# OneBasePlate — Claude

**Start with [`AGENTS.md`](AGENTS.md)** (shared instructions and links).

## Claude-specific

- **Layered memory:** [`docs/ai/memory-system.md`](docs/ai/memory-system.md) — canonical facts, global rules, decisions, workflows vs per-agent memory.
- **Global rules / corrections:** [`docs/ai/global-rules.md`](docs/ai/global-rules.md) — append numbered rules there, not in this file.
- **Claude subagents (focused set):** [`.claude/agents/`](.claude/agents/) — orchestrator, import-agent, ux-agent, data-agent, sync-agent (each points at `MEMORY.md` under [`.claude/agent-memory/<agent-name>/`](.claude/agent-memory/README.md)).
- **Cursor editor subagents:** [`.cursor/agents/`](.cursor/agents/) — broader list for Cursor workflows; prefer `.claude/agents/` for Claude Code routing when scopes overlap.

No other deltas unless the user adds Claude-only tooling notes here.
