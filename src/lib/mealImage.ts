import type { BaseMeal, Recipe } from "../types";

/**
 * Resolve the display image for a meal: own image first, then fall back to
 * the primary whole-meal recipe's image when one is attached.
 */
export function resolveMealImageUrl(
  meal: BaseMeal,
  recipes: Recipe[],
): string | undefined {
  if (meal.imageUrl) return meal.imageUrl;

  const refs = meal.recipeRefs ?? [];
  if (refs.length === 0) return undefined;

  const primary = refs.find((r) => r.role === "primary") ?? refs[0]!;
  const recipe = recipes.find((r) => r.id === primary.recipeId);
  return recipe?.imageUrl;
}
