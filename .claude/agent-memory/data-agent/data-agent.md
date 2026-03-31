# Data agent — supporting notes

## Fixture workflow

1. Edit `fixtures/households/<id>.json`
2. `npm run db:seed` → updates `src/seed-data.json`
3. Commit **both** fixture(s) and `src/seed-data.json`

## Skill

- `skills/onebaseplate-ingredient-seed/SKILL.md` — when doing extended seed work.

## Definition

- Source: [`.claude/agents/data-agent.md`](../../agents/data-agent.md)
