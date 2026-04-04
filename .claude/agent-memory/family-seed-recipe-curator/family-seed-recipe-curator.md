# Family seed recipe curator — supporting notes

## Key file paths

- **Fixture target:** `fixtures/households/H001-mcg.json` (primary household)
- **Standalone meals:** `fixtures/meals/`
- **Catalog / ingredient conventions:** `src/catalog.ts` (`MASTER_CATALOG`)
- **Types:** `src/types.ts` — `Recipe`, `BaseMeal`, `MealComponent`, `RecipeRef`, `ComponentRecipeRef`, `Ingredient`
- **Seed workflow:** `scripts/db-seed.ts` → `src/seed-data.json`
- **Skill:** `skills/onebaseplate-ingredient-seed/SKILL.md`

## Id prefixes (quick ref)

| Entity             | Pattern                     |
| ------------------ | --------------------------- |
| Recipe             | `rec-{slug}`                |
| Base meal          | `bm-{slug}`                 |
| Ingredient         | `ing-{slug}`                |
| MealComponent      | `mc-{parent-abbrev}-{n}`    |
| ComponentRecipeRef | `cr-{parent-abbrev}-{slug}` |

## Common pitfalls

- **Duplicate ingredients** — always check `ingredients[]` in the fixture before proposing a new `ing-*` row. Many common ingredients (olive oil, garlic, etc.) already exist.
- **Hard-no violations** — read `members[].hardNoFoods` and `hardNoFoodFamilyKeys` before proposing any recipe. Family members with ARFID-style constraints must not be ignored.
- **Role inflation** — not every recipe is `whole-meal`. Components, sauces, and batch-prep items are first-class in this app's model.
- **Stale data** — if fixture shapes don't match `src/types.ts`, stop and surface the discrepancy rather than guessing.

## Definition

- Source: [`.claude/agents/family-seed-recipe-curator.md`](../../agents/family-seed-recipe-curator.md)
