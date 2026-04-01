import type { BaseMeal } from '../types';

/**
 * Resolve the display image for a meal: returns the meal's own imageUrl,
 * or undefined when none is set.
 */
export function resolveMealImageUrl(meal: BaseMeal): string | undefined {
  return meal.imageUrl;
}
