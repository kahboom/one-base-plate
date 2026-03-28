import { describe, expect, it } from 'vitest';
import { applyImportMappingEdit, componentIndexForMapping } from '../src/import-mapping-edit';
import type { BaseMeal, Ingredient } from '../src/types';

const ingChicken: Ingredient = {
  id: 'ing-chicken',
  name: 'Chicken',
  category: 'protein',
  tags: [],
  shelfLifeHint: '',
  freezerFriendly: false,
  babySafeWithAdaptation: false,
};

const ingRice: Ingredient = {
  id: 'ing-rice',
  name: 'Rice',
  category: 'carb',
  tags: [],
  shelfLifeHint: '',
  freezerFriendly: false,
  babySafeWithAdaptation: false,
};

function baseMeal(overrides: Partial<BaseMeal> = {}): BaseMeal {
  return {
    id: 'm1',
    name: 'Test',
    components: [],
    defaultPrep: '',
    estimatedTimeMinutes: 30,
    difficulty: 'easy',
    rescueEligible: false,
    wasteReuseHints: [],
    ...overrides,
  };
}

describe('componentIndexForMapping', () => {
  it('maps non-ignore indices to component positions', () => {
    const mappings = [
      { originalLine: 'a', parsedName: 'a', action: 'use' as const },
      { originalLine: 'b', parsedName: 'b', action: 'ignore' as const },
      { originalLine: 'c', parsedName: 'c', action: 'create' as const },
    ];
    expect(componentIndexForMapping(0, mappings)).toBe(0);
    expect(componentIndexForMapping(1, mappings)).toBeNull();
    expect(componentIndexForMapping(2, mappings)).toBe(1);
  });
});

describe('applyImportMappingEdit', () => {
  it('ignore removes component at aligned index', () => {
    const meal = baseMeal({
      components: [
        {
          ingredientId: 'ing-chicken',
          role: 'protein',
          quantity: '200g',
          originalSourceLine: '200g chicken',
        },
      ],
      importMappings: [
        {
          originalLine: '200g chicken',
          parsedName: 'chicken',
          action: 'use',
          ingredientId: 'ing-chicken',
          matchType: 'existing',
        },
      ],
    });
    const { meal: next } = applyImportMappingEdit(meal, 0, { kind: 'ignore' }, [ingChicken]);
    expect(next.components).toHaveLength(0);
    expect(next.importMappings![0]!.action).toBe('ignore');
  });

  it('ignore → use inserts component in recipe order', () => {
    const meal = baseMeal({
      components: [
        {
          ingredientId: 'ing-rice',
          role: 'carb',
          quantity: '1 cup',
          originalSourceLine: '1 cup rice',
        },
      ],
      importMappings: [
        {
          originalLine: 'chicken (skipped)',
          parsedName: 'chicken',
          action: 'ignore',
          matchType: 'ignored',
        },
        {
          originalLine: '1 cup rice',
          parsedName: 'rice',
          action: 'use',
          ingredientId: 'ing-rice',
          matchType: 'existing',
        },
      ],
    });
    const { meal: next } = applyImportMappingEdit(
      meal,
      0,
      { kind: 'use', ingredientId: 'ing-chicken' },
      [ingChicken, ingRice],
    );
    expect(next.components).toHaveLength(2);
    expect(next.components[0]!.ingredientId).toBe('ing-chicken');
    expect(next.components[1]!.ingredientId).toBe('ing-rice');
    expect(next.importMappings![0]!.action).toBe('use');
  });

  it('use swaps ingredient on existing line', () => {
    const meal = baseMeal({
      components: [
        {
          ingredientId: 'ing-chicken',
          role: 'protein',
          quantity: '200g',
          originalSourceLine: '200g chicken',
        },
      ],
      importMappings: [
        {
          originalLine: '200g chicken',
          parsedName: 'chicken',
          action: 'use',
          ingredientId: 'ing-chicken',
          matchType: 'existing',
        },
      ],
    });
    const { meal: next } = applyImportMappingEdit(
      meal,
      0,
      { kind: 'use', ingredientId: 'ing-rice' },
      [ingChicken, ingRice],
    );
    expect(next.components).toHaveLength(1);
    expect(next.components[0]!.ingredientId).toBe('ing-rice');
    expect(next.importMappings![0]!.ingredientId).toBe('ing-rice');
  });

  it('create adds new ingredient and component', () => {
    const meal = baseMeal({
      components: [],
      importMappings: [
        {
          originalLine: '2 tbsp mystery',
          parsedName: 'mystery',
          action: 'ignore',
          matchType: 'ignored',
        },
      ],
    });
    const { meal: next, newIngredients } = applyImportMappingEdit(
      meal,
      0,
      { kind: 'create', category: 'pantry', name: 'Mystery spice' },
      [],
    );
    expect(newIngredients).toHaveLength(1);
    expect(newIngredients[0]!.name).toBe('mystery spice');
    expect(next.components).toHaveLength(1);
    expect(next.components[0]!.ingredientId).toBe(newIngredients[0]!.id);
    expect(next.importMappings![0]!.action).toBe('create');
  });
});
