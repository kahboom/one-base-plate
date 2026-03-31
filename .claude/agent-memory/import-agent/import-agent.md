# Import agent — supporting notes

## Key code areas

- `src/paprika-parser.ts`, `src/recipe-parser.ts`, `src/lib/paprikaCategoryMap.ts`
- Import flows: `RecipeImport`, grouped review, draft build paths (see PRD + tests `f067`, `f073`, etc.)

## Legacy performance deep-dive

Confirmed hot paths and scaling notes for large Paprika libraries:

- **`.claude/agent-memory/import-performance-scaling/import-performance-scaling.md`**

Prefer linking here over duplicating; merge summaries into this file when stable.

## Definition

- Source: [`.claude/agents/import-agent.md`](../../agents/import-agent.md)
