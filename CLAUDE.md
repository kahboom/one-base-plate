# OneBasePlate — Claude

**Start with [`AGENTS.md`](AGENTS.md)** (shared instructions and links).

## Claude-specific

- **Global rules / corrections:** [`docs/ai/global-rules.md`](docs/ai/global-rules.md) — append numbered rules there, not in this file.
- **Specialist memory:** Persistent notes for a named specialist live under **`.claude/agent-memory/<agent-name>/`** (e.g. import-performance-scaling). Keep that body out of global rules; point the agent definition at the memory path.
- **Subagent definitions:** Repo-local agent specs live in **`.cursor/agents/`** (markdown bodies used with Cursor/Claude-style workflows).

No other deltas unless the user adds Claude-only tooling notes here.
