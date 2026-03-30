import type { Ingredient } from '../types';
import type { CatalogIngredient } from '../catalog';
import { MASTER_CATALOG } from '../catalog';

/**
 * Effective display image: explicit household `imageUrl` first, then linked catalog
 * entry `imageUrl` when `catalogId` is set. Does not mutate stored household data.
 */
export function getCatalogDefaultImageUrl(
  ingredient: Pick<Ingredient, 'catalogId'>,
  catalog?: readonly CatalogIngredient[],
): string | undefined {
  if (!ingredient.catalogId) return undefined;
  const items = catalog ?? MASTER_CATALOG;
  return items.find((ci) => ci.id === ingredient.catalogId)?.imageUrl;
}

export function resolveIngredientImageUrl(
  ingredient: Ingredient,
  catalog?: readonly CatalogIngredient[],
): string | undefined {
  if (ingredient.imageUrl) return ingredient.imageUrl;
  return getCatalogDefaultImageUrl(ingredient, catalog);
}
