import { describe, expect, it } from 'vitest';
import type { Household } from '../src/types';
import { migrateHouseholdIngredients, normalizeIngredientName } from '../src/ingredient-migration';

describe('normalizeIngredientName', () => {
  it('normalizes casing, spacing, and trailing punctuation', () => {
    expect(normalizeIngredientName('  Red   Onion.  ')).toBe('red onion');
    expect(normalizeIngredientName('Soy Sauce')).toBe('soy sauce');
    expect(normalizeIngredientName('Garlic...')).toBe('garlic');
  });
});

describe('migrateHouseholdIngredients', () => {
  it('merges duplicate ingredients and remaps all ingredient references', () => {
    const household: Household = {
      id: 'h-migrate',
      name: 'Migration Test Home',
      members: [],
      ingredients: [
        {
          id: 'ing-1',
          name: ' Red Onion ',
          category: 'veg',
          tags: [],
          shelfLifeHint: '',
          freezerFriendly: false,
          babySafeWithAdaptation: false,
        },
        {
          id: 'ing-2',
          name: 'red   onion.',
          category: 'veg',
          tags: ['quick'],
          shelfLifeHint: '3 days',
          freezerFriendly: true,
          babySafeWithAdaptation: false,
        },
        {
          id: 'ing-3',
          name: 'Soy Sauce',
          category: 'pantry',
          tags: [],
          shelfLifeHint: '',
          freezerFriendly: false,
          babySafeWithAdaptation: false,
        },
      ],
      recipes: [
        {
          id: 'rec-1',
          name: 'Soup',
          components: [{ ingredientId: 'ing-1', role: 'veg', quantity: '1' }],
        },
      ],
      baseMeals: [
        {
          id: 'meal-1',
          name: 'Noodles',
          components: [
            {
              ingredientId: 'ing-1',
              role: 'veg',
              quantity: '1',
              alternativeIngredientIds: ['ing-2', 'ing-3'],
            },
          ],
          defaultPrep: '',
          estimatedTimeMinutes: 20,
          difficulty: 'easy',
          rescueEligible: true,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [
        {
          id: 'plan-1',
          days: [],
          selectedBaseMeals: ['meal-1'],
          generatedGroceryList: [
            {
              ingredientId: 'ing-2',
              name: 'red onion.',
              category: 'veg',
              quantity: '1',
              owned: false,
            },
          ],
          notes: '',
        },
      ],
    };

    const { household: migrated, report } = migrateHouseholdIngredients(household);

    expect(migrated.ingredients).toHaveLength(2);
    expect(migrated.ingredients.find((i) => i.id === 'ing-2')).toBeTruthy();

    const onion = migrated.ingredients.find((i) => i.id === 'ing-2');
    expect(onion?.name).toBe('red onion');
    expect(onion?.tags).toContain('quick');
    expect(onion?.freezerFriendly).toBe(true);
    expect(onion?.shelfLifeHint).toBe('3 days');

    const component = migrated.baseMeals[0]!.components[0]!;
    expect(component.ingredientId).toBe('ing-2');
    expect(component.alternativeIngredientIds).toEqual(['ing-3']);

    const recipeComp = migrated.recipes![0]!.components[0]!;
    expect(recipeComp.ingredientId).toBe('ing-2');

    const groceryItem = migrated.weeklyPlans[0]!.generatedGroceryList[0]!;
    expect(groceryItem.ingredientId).toBe('ing-2');
    expect(groceryItem.name).toBe('red onion');

    expect(report.duplicatesMerged).toBe(1);
    expect(report.remappedReferences).toBeGreaterThanOrEqual(2);
  });
});
