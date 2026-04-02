# Family seed recipe curator — memory (short)

- **Owns:** Seed fixture recipe/base-meal generation and append; wiring `recipeRefs` and `ComponentRecipeRef`; extending ingredient rows in fixtures only.
- **Append-only by default** — never rewrite or rename existing fixture records without explicit instruction.
- **Canonical:** [`docs/ai/ingredient-seed.md`](../../../docs/ai/ingredient-seed.md), [`skills/onebaseplate-ingredient-seed/SKILL.md`](../../../skills/onebaseplate-ingredient-seed/SKILL.md).
- **After appending fixtures:** run `npm run db:seed` → regenerates `src/seed-data.json`; commit both files together.
- **Coordinate:** ingredient ontology questions → `.cursor/agents/ingredient-ontology-steward.md`; type/schema changes → data-agent.

_Last updated: 2026-04-02 (agent moved from .cursor/agents to .claude/agents)._
