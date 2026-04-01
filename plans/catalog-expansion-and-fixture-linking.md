# Plan: Expand MASTER_CATALOG and thin household fixtures

**Status:** Ready for execution
**Scope:** `src/catalog.ts`, `scripts/db-seed.ts`, `fixtures/households/H001-mcg.json`, `fixtures/households/H002-two-adults-toddler-baby.json`, `src/seed-data.json`, `src/storage.ts`

---

## Background

The `MASTER_CATALOG` in `src/catalog.ts` currently has ~180 entries. The H001 household fixture has ~160 ingredient rows carrying full metadata (category, tags, shelfLifeHint, freezerFriendly, babySafeWithAdaptation, imageUrl). None of them have `catalogId` or `source` — they are all orphaned "manual" entries duplicating data that belongs in the catalog.

This causes two problems:
1. **Import matching suffers.** Any household that doesn't pre-seed these ingredients has to resolve them manually during Paprika import. 33 common ingredients have no catalog representation at all.
2. **Fixture bloat.** H001 is ~3,100 lines. Most of that is ingredient metadata that duplicates (or should duplicate) the catalog. Household fixtures should describe what's *specific* to the household, not repeat the entire ingredient library.

**Solution (Option A):** Expand the catalog, thin the fixtures to stubs, and have `db-seed.ts` hydrate full ingredient rows at build time by merging catalog metadata into fixture stubs.

---

## Pre-work: files to read before making changes

| File | Why |
|------|-----|
| `docs/ai/ingredient-seed.md` | Fixture/seed workflow and schema reference |
| `src/catalog.ts` | `CatalogIngredient` type, `c()` helper, `catalogIngredientToHousehold`, existing entries |
| `src/types.ts` | `Ingredient` — `catalogId`, `source`, `aliases`, `familyKeys` |
| `src/storage.ts` | `seedIfNeeded`, `backfillBundledSeedIngredientImageUrls`, `resetHouseholdIngredientsToSeed`, `countSeedIngredientsForHousehold` |
| `scripts/db-seed.ts` | Current build script — reads fixture JSON, writes `src/seed-data.json` |
| `src/recipe-parser.ts` | `REGIONAL_SYNONYM_CANONICAL` — confirm synonym consistency |
| `src/lib/ingredientSynonyms.ts` | Search-level synonym groups |
| `.cursor/agents/ingredient-ontology-steward.md` | Alias vs separate ingredient rules |

---

## Step 1: Add missing catalog entries (~29 new `c()` rows in `catalog.ts`)

For each of the 33 items below, either **add a new catalog entry** or **add an alias to an existing entry**. The decision column states which.

### New catalog entries to create

| H001 name | Catalog id | Category | Tags | Freeze | Baby-safe | Aliases | Notes |
|-----------|-----------|----------|------|--------|-----------|---------|-------|
| almond flour | `cat-almond-flour` | pantry | `['staple']` | false | false | `['ground almonds']` | |
| baguette | `cat-baguette` | carb | `['quick']` | true | true | `['french bread', 'french stick']` | |
| bratwurst | `cat-bratwurst` | protein | `['quick']` | true | false | `['brats']` | |
| brown lentils | `cat-brown-lentils` | protein | `['batch-friendly', 'staple']` | false | true | `['green lentils']` | Existing `cat-lentils` covers generic "lentils" — this is a specific variety |
| butter beans | `cat-butter-beans` | protein | `['batch-friendly', 'staple']` | false | true | `['lima beans']` | |
| chipolatas | `cat-chipolatas` | protein | `['quick']` | true | false | `['chipolata sausages']` | Distinct from `cat-sausages` |
| chorizo | `cat-chorizo` | protein | `['quick', 'batch-friendly']` | true | false | `['spanish chorizo']` | |
| cornmeal | `cat-cornmeal` | pantry | `['staple']` | false | false | `['polenta', 'corn meal']` | |
| creme fraiche | `cat-creme-fraiche` | dairy | `['quick']` | false | false | `['crème fraîche']` | |
| duck breast | `cat-duck-breast` | protein | `[]` | true | false | `['duck']` | |
| halloumi | `cat-halloumi` | dairy | `['quick']` | true | true | `['halloumi cheese']` | |
| lamb mince | `cat-lamb-mince` | protein | `['batch-friendly']` | true | false | `['ground lamb', 'minced lamb']` | |
| lasagne sheets | `cat-lasagne-sheets` | carb | `['staple']` | false | true | `['lasagna sheets', 'lasagna noodles', 'lasagne']` | |
| miso paste | `cat-miso-paste` | pantry | `['staple']` | false | false | `['miso', 'white miso', 'red miso']` | |
| mixed frozen vegetables | `cat-mixed-frozen-veg` | freezer | `['quick', 'rescue']` | true | true | `['frozen mixed vegetables', 'frozen veg']` | |
| paneer | `cat-paneer` | dairy | `['quick']` | true | true | `['paneer cheese', 'indian cottage cheese']` | |
| pecorino | `cat-pecorino` | dairy | `['quick']` | true | true | `['pecorino romano', 'pecorino cheese']` | |
| pork | `cat-pork` | protein | `['batch-friendly']` | true | false | `['pork loin', 'pork chops', 'pork tenderloin', 'pork fillet']` | Generic pork — distinct from `cat-ground-pork` |
| queso fresco | `cat-queso-fresco` | dairy | `['quick']` | false | false | `['queso blanco']` | |
| ramen noodles | `cat-ramen-noodles` | carb | `['quick']` | false | false | `['ramen', 'instant ramen', 'instant noodles']` | Distinct from generic `cat-noodles` |
| rice flour | `cat-rice-flour` | pantry | `['staple']` | false | false | `['glutinous rice flour']` | |
| sirloin steak | `cat-sirloin-steak` | protein | `['quick']` | true | false | `['sirloin', 'steak']` | |
| sourdough bread | `cat-sourdough-bread` | carb | `['staple']` | true | true | `['sourdough']` | Distinct from `cat-bread` |
| sun-dried tomatoes | `cat-sun-dried-tomatoes` | pantry | `['staple']` | false | false | `['sundried tomatoes', 'sun dried tomatoes']` | |
| tahini | `cat-tahini` | pantry | `['staple']` | false | false | `['sesame paste']` | |
| turkey breast | `cat-turkey-breast` | protein | `['quick']` | true | true | `['turkey']` | |
| white wine vinegar | `cat-white-wine-vinegar` | pantry | `['staple']` | false | false | | Don't duplicate `'white vinegar'` alias from `cat-vinegar` |
| wholemeal bread | `cat-wholemeal-bread` | carb | `['staple']` | true | true | `['whole wheat bread', 'brown bread']` | |
| wholemeal flour | `cat-wholemeal-flour` | pantry | `['staple']` | false | false | `['whole wheat flour', 'wholewheat flour']` | Remove `'whole wheat flour'` from `cat-flour` aliases to avoid double-match |

### Alias additions to existing catalog entries (not new entries)

| H001 name | Existing catalog entry | Alias to add |
|-----------|----------------------|--------------|
| romaine lettuce | `cat-lettuce` | `'romaine lettuce'` (already has `'romaine'`) |
| spring onions | `cat-green-onion` | `'spring onions'` (already has `'spring onion'` singular) |
| prawn | `cat-prawns` | `'prawn'` (catalog name is plural, singular missing) |
| turkey mince | `cat-ground-turkey` | `'turkey mince'`, `'minced turkey'` |

### Placement

Add new entries in the existing section groupings in `catalog.ts` (Proteins, Carbs, Vegetables, Dairy, Pantry, Freezer). Keep alphabetical order within each section where possible.

### Judgement calls

1. **`bread flour` vs `flour`** — Bread flour is distinct (higher protein). Create `cat-bread-flour` as a separate entry. Remove `'bread flour'` from `cat-flour` aliases if present.
2. **`wholemeal flour` vs `flour`** — Same logic. Create `cat-wholemeal-flour`. Remove `'whole wheat flour'` and `'whole wheat pastry flour'` from `cat-flour` aliases.
3. **`white wine vinegar` vs `vinegar`** — Different product. Separate entry. Don't duplicate the `'white vinegar'` alias.
4. **`brown lentils` vs `lentils`** — Different cook times. Separate entry. Keep `cat-lentils` as generic fallback.

---

## Step 2: Thin H001 fixture ingredients to stubs

Replace each full ingredient object in `fixtures/households/H001-mcg.json` with a **stub** that contains only:

- `id` (required — recipes and base meals reference this, must not change)
- `name` (required — member preferences reference by name string, must not change)
- `catalogId` (new — references the matched `cat-*` entry)
- Any **household-specific overrides** that differ from the catalog entry

A stub for a catalog-linked ingredient looks like:

```json
{
  "id": "ing-courgette",
  "name": "courgette",
  "catalogId": "cat-courgette"
}
```

A stub with household overrides (e.g. custom aliases, familyKeys, imageUrl, extra tags):

```json
{
  "id": "ing-aubergine",
  "name": "aubergine",
  "catalogId": "cat-aubergine",
  "aliases": ["eggplant"],
  "familyKeys": ["nightshade"],
  "imageUrl": "/images/seed/ing-aubergine.png"
}
```

### What counts as a household override

Include the field in the stub **only if**:
- **`aliases`** — the fixture has aliases beyond what the catalog already provides
- **`familyKeys`** — always household-specific (catalog doesn't have this field)
- **`imageUrl`** — if the fixture has a local `/images/seed/` URL (catalog entries use Unsplash URLs or no image)
- **`tags`** — only if the fixture has tags that the catalog entry does not
- **`shelfLifeHint`** — only if non-empty and the household has a specific value

### What to omit from stubs

- `category` — comes from catalog
- `freezerFriendly` — comes from catalog
- `babySafeWithAdaptation` — comes from catalog
- `tags` — if identical to catalog
- `shelfLifeHint` — if empty or generic
- `source` — will be set to `'catalog'` automatically by `db-seed.ts`

### Ingredients that stay full (no catalogId)

A few ingredients may not have a catalog match and are too niche to add. These stay as full objects without `catalogId`. Likely candidates: none from the current list (all 33 missing items are common enough for the catalog). But if the executing agent judges any to be truly household-specific, keep them full.

### Mapping reference for non-obvious name→catalog links

| H001 name | Catalog id |
|-----------|-----------|
| bread flour | `cat-bread-flour` (new) |
| cheddar | `cat-cheddar-cheese` |
| cherry tomatoes | `cat-tomatoes` |
| double cream | `cat-heavy-cream` |
| feta | `cat-feta-cheese` |
| flour tortillas | `cat-wraps` |
| fresh ginger | `cat-ginger` |
| green cabbage | `cat-cabbage` |
| mustard | `cat-mustard` |
| parmesan | `cat-parmesan-cheese` |
| plum tomatoes | `cat-tomatoes` |
| romaine lettuce | `cat-lettuce` |
| smoked paprika | `cat-paprika` |
| spring onions | `cat-green-onion` |
| tinned tuna | `cat-tuna` |
| tomato ketchup | `cat-ketchup` |
| turkey mince | `cat-ground-turkey` |

### Rules

- **DO NOT change any `id` values** — recipes and base meals use `ingredientId` references
- **DO NOT change any `name` values** — member `safeFoods` and `hardNoFoods` reference by name string
- **DO NOT remove any ingredient rows** — they must still seed into the household
- Keep ingredients sorted alphabetically by `name`

---

## Step 3: Update `scripts/db-seed.ts` to hydrate stubs from catalog

Currently `db-seed.ts` just reads fixture JSON and writes it as-is to `seed-data.json`. Change it to:

1. Import `MASTER_CATALOG` from `src/catalog.ts`
2. For each household's ingredients array, for each ingredient that has a `catalogId`:
   - Look up the matching `CatalogIngredient` from `MASTER_CATALOG`
   - Merge catalog fields as defaults, with fixture fields as overrides
   - Set `source: 'catalog'` on the hydrated row
3. Write the fully hydrated output to `seed-data.json` (same shape as today — downstream code doesn't change)

### Merge logic (pseudocode)

```typescript
function hydrateIngredient(stub: FixtureIngredient, catalog: CatalogIngredient): Ingredient {
  return {
    // Catalog defaults
    category: catalog.category,
    tags: [...catalog.tags],
    shelfLifeHint: '',
    freezerFriendly: catalog.freezerFriendly,
    babySafeWithAdaptation: catalog.babySafeWithAdaptation,
    // Fixture identity (always from fixture)
    id: stub.id,
    name: stub.name,
    catalogId: stub.catalogId,
    source: 'catalog',
    // Fixture overrides (only if present in stub)
    ...(stub.aliases && { aliases: stub.aliases }),
    ...(stub.familyKeys && { familyKeys: stub.familyKeys }),
    ...(stub.imageUrl && { imageUrl: stub.imageUrl }),
    ...(stub.tags && { tags: stub.tags }),
    ...(stub.shelfLifeHint && { shelfLifeHint: stub.shelfLifeHint }),
  };
}
```

Key points:
- `id` and `name` always come from the fixture (stability)
- `catalogId` comes from the fixture (it's the link)
- `source` is set to `'catalog'` for all linked rows
- Category, tags, freeze, baby-safe come from the catalog unless the fixture explicitly overrides
- Aliases, familyKeys, imageUrl from the fixture are additive overrides
- If a fixture ingredient has no `catalogId`, it passes through unchanged (manual ingredient)

### Import considerations

`db-seed.ts` is a `tsx` script. It currently only reads JSON files. To import from `catalog.ts`, it will need to import the TypeScript module. Since it already runs via `npx tsx`, this should work without additional configuration. Import `MASTER_CATALOG` from `../src/catalog.ts` (relative to script location).

### Validate at build time

If a fixture stub references a `catalogId` that doesn't exist in `MASTER_CATALOG`, `db-seed.ts` should print a warning and exit with a non-zero code. This prevents silent data loss.

---

## Step 4: Update H002 fixture (if applicable)

Check `fixtures/households/H002-two-adults-toddler-baby.json` for any ingredients that can also be thinned to stubs. It's a much smaller file. Apply the same stub format.

---

## Step 5: Regenerate and verify

Run these commands sequentially:

```bash
npm run db:seed
npm run typecheck
npm test
```

Expected results:
- `db:seed` writes 2 households to `src/seed-data.json` — success
- `typecheck` passes
- Tests: all pass except the pre-existing `f076-paprika-auto-resolution` failure (ignore it)

### Verification checklist

- [ ] `src/seed-data.json` ingredient count per household has not changed (same number of rows in, same number out)
- [ ] Every hydrated ingredient in `seed-data.json` has all required `Ingredient` fields (`id`, `name`, `category`, `tags`, `shelfLifeHint`, `freezerFriendly`, `babySafeWithAdaptation`)
- [ ] No `id` values changed
- [ ] No `name` values changed
- [ ] Every `catalogId` in the fixtures resolves to a real `MASTER_CATALOG` entry
- [ ] No duplicate `cat-*` ids in `MASTER_CATALOG`
- [ ] Fixture ingredients remain sorted alphabetically by `name`
- [ ] `seed-data.json` is valid JSON and matches the `Household[]` type shape
- [ ] All linked ingredients in `seed-data.json` have `"source": "catalog"` and a `"catalogId"` field

### Smoke test (manual)

After regeneration, run the app and:
1. Reset to default state (Settings → Reset)
2. Open the ingredient manager for H001
3. Confirm all ~160 ingredients appear with correct names, categories, tags, and images
4. Open the ingredient detail for "courgette" — should show "zucchini" under "Also matches"
5. Search for "zucchini" — courgette should appear
6. Browse catalog — new entries (chorizo, halloumi, etc.) should be visible

---

## What this plan does NOT change

- **No runtime code changes to `seedIfNeeded()`** — it still reads `seed-data.json` as-is. The hydration happens at build time in `db-seed.ts`.
- **No UI changes.**
- **No import logic changes.** More catalog entries = better `matchIngredient` coverage automatically.
- **No schema changes.** `Ingredient` already supports `catalogId` and `source`.
- **`seed-data.json` output shape is identical** — downstream consumers (`seedIfNeeded`, `backfillBundledSeedIngredientImageUrls`, `resetHouseholdIngredientsToSeed`, `countSeedIngredientsForHousehold`) see no difference.

## What this plan achieves

- **H001 fixture shrinks dramatically** — from ~3,100 lines to roughly ~1,500 (stubs + meals/recipes which stay unchanged)
- **MASTER_CATALOG grows to ~210 entries** — covering virtually every common cooking ingredient
- **Single source of truth for ingredient metadata** — category, tags, freeze, baby-safe live in the catalog. Fixtures only store identity + household-specific overrides
- **Import matching improves** — any new household gets better Paprika import matches from the richer catalog without needing to pre-seed ingredients
- **`db-seed.ts` validates consistency** — broken `catalogId` references fail the build instead of silently producing incomplete data
