import type { Ingredient } from '../types';
import { normalizeIngredientName } from '../storage';

/** Matches `InlineIngredientForm` / BaseMealManager defaults for manually added ingredients. */
export function buildManualIngredient(rawName: string): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: normalizeIngredientName(rawName),
    category: 'pantry',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
  };
}
