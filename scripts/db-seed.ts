/**
 * Writes `src/seed-data.json`: the bundled household snapshot (including each household’s
 * `ingredients`) that `seedIfNeeded()` in `src/storage.ts` loads on first app run.
 *
 * The master ingredient list for import/browse matching is `MASTER_CATALOG` in
 * `src/catalog.ts` — separate from this file. Plain JSON cannot contain comments, so
 * that split is documented in `storage.ts` and `catalog.ts`.
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MASTER_CATALOG } from '../src/catalog';
import type { CatalogIngredient } from '../src/catalog';
import type { Ingredient } from '../src/types';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures', 'households');
const outputPath = join(import.meta.dirname, '..', 'src', 'seed-data.json');

const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
const catalogById = new Map(MASTER_CATALOG.map((item) => [item.id, item]));

function hydrateIngredient(
  raw: Ingredient & { catalogId?: string },
  catalog: CatalogIngredient,
): Ingredient {
  return {
    category: catalog.category,
    tags: [...catalog.tags],
    shelfLifeHint: '',
    freezerFriendly: catalog.freezerFriendly,
    babySafeWithAdaptation: catalog.babySafeWithAdaptation,
    id: raw.id,
    name: raw.name,
    catalogId: raw.catalogId,
    source: 'catalog',
    ...(raw.aliases ? { aliases: raw.aliases } : {}),
    ...(raw.familyKeys ? { familyKeys: raw.familyKeys } : {}),
    ...(raw.imageUrl ? { imageUrl: raw.imageUrl } : {}),
    ...(raw.tags ? { tags: raw.tags } : {}),
    ...(raw.shelfLifeHint ? { shelfLifeHint: raw.shelfLifeHint } : {}),
  };
}

const unresolvedCatalogRefs: string[] = [];

const households = files.map((f) => {
  const household = JSON.parse(readFileSync(join(fixturesDir, f), 'utf-8'));
  household.ingredients = (household.ingredients ?? []).map((ingredient: Ingredient & { catalogId?: string }) => {
    if (!ingredient.catalogId) return ingredient;
    const catalog = catalogById.get(ingredient.catalogId);
    if (!catalog) {
      unresolvedCatalogRefs.push(`${household.id}:${ingredient.id}:${ingredient.catalogId}`);
      return ingredient;
    }
    return hydrateIngredient(ingredient, catalog);
  });
  return household;
});

if (unresolvedCatalogRefs.length) {
  console.error('Unknown catalogId reference(s) in fixtures:');
  for (const ref of unresolvedCatalogRefs) console.error(`- ${ref}`);
  process.exit(1);
}

writeFileSync(outputPath, JSON.stringify(households, null, 2));
console.log(`Wrote ${households.length} household(s) to ${outputPath}`);
