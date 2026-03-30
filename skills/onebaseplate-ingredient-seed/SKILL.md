---
name: onebaseplate-ingredient-seed
description: Edits OneBasePlate household ingredient seed data in JSON fixtures and regenerates bundled seed. Use when changing fixtures/households ingredient lists, seed-data.json, H001-mcg ingredients, Ingredient.familyKeys, or bundled first-run household data.
---

# OneBasePlate — household ingredient seed

## Quick start

1. Edit **`fixtures/households/<household>.json`** — the top-level **`ingredients`** array on each household file.
2. Run **`npm run db:seed`** to regenerate **`src/seed-data.json`**.
3. Run **`npm test`** (and typecheck if you touched TS). Commit **both** the fixture file(s) and `src/seed-data.json`.

## How it fits the app

| Piece | Role |
| ----- | ---- |
| `fixtures/households/*.json` | Source of truth per household (human-edited). |
| `scripts/db-seed.ts` | Concatenates all `*.json` in that folder into one array written to `src/seed-data.json`. |
| `src/storage.ts` → `seedIfNeeded()` | On first run, loads bundled `seed-data.json` into IndexedDB. |
| `src/catalog.ts` → `MASTER_CATALOG` | **Separate** curated list for import/browse matching — not auto-synced from fixtures. |

## `Ingredient` JSON shape

Align with **`Ingredient`** in **`src/types.ts`**.

**Required on every row**

- `id` — stable string, convention `ing-{slug}` (hyphenated lowercase).
- `name` — display / match name (lowercase phrasing matches existing fixtures).
- `category` — one of: `protein`, `carb`, `veg`, `fruit`, `dairy`, `snack`, `freezer`, `pantry`.
- `tags` — string array (may be empty); common values include `staple`, `quick`, `batch-friendly`, `rescue`, `mashable`.
- `shelfLifeHint` — short human string (e.g. `long`, `3 days`, `1 week`).
- `freezerFriendly` — boolean.
- `babySafeWithAdaptation` — boolean.

**Optional**

- `aliases` — alternate import/search strings; canonical display stays `name`.
- `familyKeys` — normalized lowercase keys for planner preference grouping (F075); e.g. `cheese`, `tomato`, `sausage`, `beans` (legumes). Do **not** put legume family on green beans — that veg is distinct from tinned/dried beans.
- `imageUrl`, `catalogId`, `source`, `defaultRecipeRefs` — use when mirroring catalog-linked rows.

## Conventions (McG / H001)

- **`fixtures/households/H001-mcg.json`** — primary large demo pantry; keep ingredient **`name`** values **unique** within the household and rows sorted **alphabetically by `name`** (locale-insensitive) unless a product reason dictates otherwise.
- **Never recycle an `id`** for a different food; recipes and base meals reference **`ingredientId`** in the same file set.

## Checklist before you finish

- [ ] No duplicate `name` (case-folded) or duplicate `id` in that household’s `ingredients`.
- [ ] Every `ingredientId` in **`recipes`** / **`baseMeals`** / **`components`** in that fixture still points at an existing `ingredients[].id` (or update those references).
- [ ] `npm run db:seed` run and **`src/seed-data.json`** committed.
- [ ] If import matching should recognize new canonical foods globally, evaluate whether **`src/catalog.ts`** (`MASTER_CATALOG`) also needs an entry (separate step).

## Related tests

- Storage/seed merge: `tests/f062-storage-layer.test.ts`, `tests/f040-seed-pet.test.tsx`.
- Ingredient/family behaviour: `tests/f075-ingredient-family-groups.test.ts` (uses dedicated test data; still validates `familyKeys` semantics).

## Impact on Paprika import quality (2026-03-31)

Catalog and household ingredient coverage directly affects Paprika import review volume. With a real 100-recipe import, ~55% of ingredient lines were unmatched because neither the household library nor `MASTER_CATALOG` had entries for them. When adding new seed ingredients, consider whether common Paprika ingredients (e.g. "whole wheat pastry flour", "low-sodium soy sauce") should also get `MASTER_CATALOG` entries in `src/catalog.ts` to reduce import review friction. This is a separate step from fixture edits — see the checklist item about catalog evaluation.
