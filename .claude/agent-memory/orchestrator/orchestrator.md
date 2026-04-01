# Orchestrator — supporting notes

## Routing quick map

| Signal in task                                  | Agent        |
| ----------------------------------------------- | ------------ |
| Paprika, parse, matchIngredient, import review  | import-agent |
| Screens, components, uiSpec, layout, a11y       | ux-agent     |
| types.ts, storage, fixtures, seed, catalog rows | data-agent   |
| sync engine, Supabase, queue, offline flush     | sync-agent   |

## Definition

- Source: [`.claude/agents/orchestrator.md`](../../agents/orchestrator.md)
