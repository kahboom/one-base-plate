import { describe, it, expect } from 'vitest';
import { promoteRecipeToBaseMeal } from '../src/lib/promoteRecipe';
import type { Recipe } from '../src/types';

describe('promoteRecipeToBaseMeal', () => {
  it('creates a base meal linked to the library recipe', () => {
    const recipe: Recipe = {
      id: 'rec-1',
      name: 'Curry',
      components: [{ id: 'c1', ingredientId: 'ing-1', role: 'protein', quantity: '200g' }],
    };
    const meal = promoteRecipeToBaseMeal(recipe, {
      difficulty: 'easy',
      rescueEligible: true,
      estimatedTimeMinutes: 45,
    });
    expect(meal.id).not.toBe(recipe.id);
    expect(meal.sourceRecipeId).toBe('rec-1');
    expect(meal.name).toBe('Curry');
    expect(meal.difficulty).toBe('easy');
    expect(meal.rescueEligible).toBe(true);
    expect(meal.estimatedTimeMinutes).toBe(45);
    expect(meal.components).toHaveLength(1);
    expect(meal.components[0]!.ingredientId).toBe('ing-1');
  });
});
