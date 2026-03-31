# Decision log

Use this for **architectural or product decisions** that need a dated, human-readable record (not one-line global rules).

**Format (copy per entry):**

```markdown
### YYYY-MM-DD — Short title

- **Context:** …
- **Decision:** …
- **Consequences:** …
- **Links:** PR/issue/PRD if any
```

### 2026-03-31 — Layered agent memory + Claude subagents

- **Context:** Need clear split between shared canonical docs, global rules, and per-specialist memory without one giant file.
- **Decision:** Shared facts in `docs/ai/canonical-state.md`; workflows in `docs/ai/workflows/`; specialist trees under `.claude/agent-memory/<agent>/` with short `MEMORY.md`; Claude definitions in `.claude/agents/` (orchestrator, import, ux, data, sync).
- **Consequences:** Cursor may keep a wider `.cursor/agents/` set; Claude uses the focused five for routing. Legacy `import-performance-scaling` memory remains until merged into `import-agent/`.
- **Links:** [`docs/ai/memory-system.md`](./memory-system.md), [`CHANGELOG.md`](../CHANGELOG.md)

