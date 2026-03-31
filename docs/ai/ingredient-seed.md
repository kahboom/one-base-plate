# Ingredient seed data (household fixtures)

- **Where:** Each household is **`fixtures/households/<id>.json`**. The top-level **`ingredients`** array is that household’s seed ingredient library (loaded on first run via **`seedIfNeeded()`** in **`src/storage.ts`**).
- **Bundled output:** **`npm run db:seed`** (**`scripts/db-seed.ts`**) merges every JSON file in **`fixtures/households/`** into **`src/seed-data.json`**. Edit fixtures first, regenerate, then commit **both** the fixture(s) and **`src/seed-data.json`**.
- **Schema:** **`Ingredient`** in **`src/types.ts`** — required: `id`, `name`, `category` (`protein` \| `carb` \| `veg` \| `fruit` \| `dairy` \| `snack` \| `freezer` \| `pantry`), `tags`, `shelfLifeHint`, `freezerFriendly`, `babySafeWithAdaptation`. Optional: `aliases`, **`familyKeys`** (planner grouping / F075), `imageUrl`, `catalogId`, `source`, `defaultRecipeRefs`.
- **Stable ids:** Recipes and base meals use **`ingredientId`** pointing at these rows. Do not reuse an `id` for a different food; add new ids for new ingredients. Removing or renaming ids breaks fixture recipes unless every reference is updated.
- **McG (H001):** **`fixtures/households/H001-mcg.json`** holds the large demo list — keep **`name`** unique per household and rows sorted **alphabetically by `name`** for maintainability.
- **Catalog vs household:** Import/browse matching uses **`MASTER_CATALOG`** in **`src/catalog.ts`** — separate from household seed ingredients. Fixture changes do not update the master catalog unless **`catalog.ts`** is edited too.

Workflows and checklists: **`skills/onebaseplate-ingredient-seed/SKILL.md`**.
