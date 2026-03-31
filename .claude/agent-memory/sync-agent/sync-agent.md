# Sync agent — supporting notes

## Focus areas

- Incremental queue, debounce, user switch / sign-out clearing queue, mid-flush abort, payload warnings.
- Tests under `tests/` matching sync PRD slices (see `agent-progress.md` for F062–F068 narrative).

## Coordination

- **data-agent:** Dexie schema and `saveHouseholds` local-only vs queue hooks — know the boundary before changing storage entry points.

## Definition

- Source: [`.claude/agents/sync-agent.md`](../../agents/sync-agent.md)
