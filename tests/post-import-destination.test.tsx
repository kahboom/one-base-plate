import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { saveHousehold, loadHousehold } from '../src/storage';
import type { BaseMeal, Household, Ingredient } from '../src/types';

function makeIngredient(
  overrides: Partial<Ingredient> & { id: string; name: string; category: Ingredient['category'] },
): Ingredient {
  return {
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
    ...overrides,
  };
}

function makeMeal(overrides: Partial<BaseMeal> & { id: string; name: string }): BaseMeal {
  return {
    components: [],
    defaultPrep: '',
    estimatedTimeMinutes: 30,
    difficulty: 'medium',
    rescueEligible: false,
    wasteReuseHints: [],
    ...overrides,
  };
}

function makeHousehold(overrides?: Partial<Household>): Household {
  return {
    id: 'h-dest',
    name: 'Destination Test Family',
    members: [
      {
        id: 'm1',
        name: 'Pat',
        role: 'adult',
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: 'regular',
        allergens: [],
        notes: '',
      },
    ],
    ingredients: [
      makeIngredient({ id: 'ing-chicken', name: 'Chicken breast', category: 'protein' }),
      makeIngredient({ id: 'ing-rice', name: 'Rice', category: 'carb' }),
      makeIngredient({ id: 'ing-broccoli', name: 'Broccoli', category: 'veg' }),
    ],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: [],
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function importRecipeToDestinationStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('import-recipe-text'), '200g chicken breast\n1 cup rice');
  await user.click(screen.getByTestId('import-parse-btn'));
  await user.click(screen.getByTestId('import-build-draft-btn'));
  await user.type(screen.getByTestId('draft-meal-name'), 'Test Recipe');
  await user.click(screen.getByTestId('import-save-btn'));
}

beforeEach(() => {
  localStorage.clear();
});

describe('PostImportDestination — manual recipe import', () => {
  it('shows destination choice after saving a recipe', async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);

    expect(screen.getByTestId('post-import-destination')).toBeInTheDocument();
    expect(screen.getByTestId('destination-choose')).toBeInTheDocument();
    expect(screen.getByTestId('dest-recipe-only')).toBeInTheDocument();
    expect(screen.getByTestId('dest-new-base-meal')).toBeInTheDocument();
    expect(screen.getByTestId('dest-attach-meal')).toBeInTheDocument();
    expect(screen.getByTestId('dest-component-recipe')).toBeInTheDocument();
  });

  it('recipe is already saved before destination choice appears', async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);

    const saved = loadHousehold('h-dest')!;
    expect(saved.recipes ?? []).toHaveLength(1);
    expect((saved.recipes ?? [])[0]!.name).toBe('Test Recipe');
  });

  it('provenance is preserved on the saved recipe', async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);

    const saved = loadHousehold('h-dest')!;
    const recipe = (saved.recipes ?? [])[0]!;
    expect(recipe.provenance).toBeDefined();
    expect(recipe.provenance!.sourceSystem).toBe('manual-text');
    expect(recipe.provenance!.importTimestamp).toBeTruthy();
  });

  it("recipe-only path: clicking 'Keep as recipe only' does not create a BaseMeal", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-recipe-only'));

    const saved = loadHousehold('h-dest')!;
    expect(saved.recipes ?? []).toHaveLength(1);
    expect(saved.baseMeals).toHaveLength(0);
  });

  it('promote path: creates a new BaseMeal from the recipe', async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-new-base-meal'));

    expect(screen.getByTestId('destination-promote')).toBeInTheDocument();

    await user.click(screen.getByTestId('promote-confirm-btn'));

    const saved = loadHousehold('h-dest')!;
    expect(saved.recipes ?? []).toHaveLength(1);
    expect(saved.baseMeals).toHaveLength(1);

    const meal = saved.baseMeals[0]!;
    expect(meal.sourceRecipeId).toBe((saved.recipes ?? [])[0]!.id);
    expect(meal.name).toBe('Test Recipe');
    expect(meal.recipeRefs).toBeDefined();
    expect(meal.recipeRefs!.some((r) => r.recipeId === (saved.recipes ?? [])[0]!.id)).toBe(true);
  });

  it('promote path: difficulty and time are configurable', async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-new-base-meal'));

    await user.selectOptions(screen.getByTestId('promote-difficulty'), 'hard');
    const timeInput = screen.getByTestId('promote-time');
    await user.clear(timeInput);
    await user.type(timeInput, '60');
    await user.click(screen.getByTestId('promote-rescue'));

    await user.click(screen.getByTestId('promote-confirm-btn'));

    const saved = loadHousehold('h-dest')!;
    const meal = saved.baseMeals[0]!;
    expect(meal.difficulty).toBe('hard');
    expect(meal.estimatedTimeMinutes).toBe(60);
    expect(meal.rescueEligible).toBe(true);
  });

  it('attach-to-meal path: attaches recipe to an existing BaseMeal', async () => {
    const user = userEvent.setup();
    const existingMeal = makeMeal({
      id: 'meal-tacos',
      name: 'Tacos',
      components: [{ id: 'c1', ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' }],
    });
    saveHousehold(makeHousehold({ baseMeals: [existingMeal] }));
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-attach-meal'));

    expect(screen.getByTestId('destination-attach-meal')).toBeInTheDocument();

    await user.click(screen.getByTestId('attach-meal-option-meal-tacos'));
    await user.click(screen.getByTestId('attach-meal-confirm'));

    const saved = loadHousehold('h-dest')!;
    const meal = saved.baseMeals.find((m) => m.id === 'meal-tacos')!;
    expect(meal.recipeRefs).toBeDefined();
    expect(meal.recipeRefs!.length).toBe(1);
    expect(meal.recipeRefs![0]!.recipeId).toBe((saved.recipes ?? [])[0]!.id);
    expect(meal.recipeRefs![0]!.role).toBe('primary');
  });

  it('attach-to-meal path: search filters meals', async () => {
    const user = userEvent.setup();
    const meals = [
      makeMeal({ id: 'meal-tacos', name: 'Tacos' }),
      makeMeal({ id: 'meal-curry', name: 'Curry' }),
      makeMeal({ id: 'meal-pasta', name: 'Pasta Night' }),
    ];
    saveHousehold(makeHousehold({ baseMeals: meals }));
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-attach-meal'));

    const list = screen.getByTestId('attach-meal-list');
    expect(within(list).getAllByRole('button')).toHaveLength(3);

    await user.type(screen.getByTestId('attach-meal-search'), 'Curry');
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    expect(within(list).getByText('Curry')).toBeInTheDocument();
  });

  it('component-recipe path: assigns recipe to a component slot', async () => {
    const user = userEvent.setup();
    const existingMeal = makeMeal({
      id: 'meal-stir-fry',
      name: 'Stir Fry',
      components: [
        { id: 'comp-protein', ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' },
        { id: 'comp-veg', ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
      ],
    });
    saveHousehold(makeHousehold({ baseMeals: [existingMeal] }));
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-component-recipe'));

    expect(screen.getByTestId('destination-component-meal-pick')).toBeInTheDocument();

    await user.click(screen.getByTestId('component-meal-option-meal-stir-fry'));

    expect(screen.getByTestId('destination-component-slot-pick')).toBeInTheDocument();
    expect(screen.getByTestId('component-slot-comp-protein')).toBeInTheDocument();
    expect(screen.getByTestId('component-slot-comp-veg')).toBeInTheDocument();

    await user.click(screen.getByTestId('component-slot-comp-protein'));
    await user.click(screen.getByTestId('component-attach-confirm'));

    const saved = loadHousehold('h-dest')!;
    const meal = saved.baseMeals.find((m) => m.id === 'meal-stir-fry')!;
    const comp = meal.components.find((c) => c.id === 'comp-protein')!;
    expect(comp.recipeRefs).toBeDefined();
    expect(comp.recipeRefs!.length).toBe(1);
    expect(comp.recipeRefs![0]!.recipeId).toBe((saved.recipes ?? [])[0]!.id);
    expect(comp.recipeRefs![0]!.sourceType).toBe('imported-recipe');
    expect(comp.recipeRefs![0]!.isDefault).toBe(true);
  });

  it('promote path has a back button returning to destination choice', async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-new-base-meal'));
    expect(screen.getByTestId('destination-promote')).toBeInTheDocument();

    await user.click(screen.getByText('Back'));
    expect(screen.getByTestId('destination-choose')).toBeInTheDocument();
  });
});

describe('PostImportDestination — no BaseMeals available', () => {
  it('attach-meal shows empty state when no meals exist', async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold({ baseMeals: [] }));
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-attach-meal'));

    expect(screen.getByText('No meals found.')).toBeInTheDocument();
    expect(screen.getByTestId('attach-meal-confirm')).toBeDisabled();
  });
});

describe('PostImportDestination — preserves import data integrity', () => {
  it('recipe components and ingredients are persisted correctly after promote', async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-new-base-meal'));
    await user.click(screen.getByTestId('promote-confirm-btn'));

    const saved = loadHousehold('h-dest')!;
    const recipe = (saved.recipes ?? [])[0]!;
    const meal = saved.baseMeals[0]!;

    expect(recipe.components.length).toBeGreaterThanOrEqual(1);
    expect(meal.components.length).toBe(recipe.components.length);

    for (const comp of meal.components) {
      const ing = saved.ingredients.find((i) => i.id === comp.ingredientId);
      expect(ing).toBeDefined();
    }
  });

  it('existing baseMeals are not mutated during promote', async () => {
    const user = userEvent.setup();
    const existingMeal = makeMeal({
      id: 'meal-existing',
      name: 'Existing Meal',
      components: [{ id: 'c1', ingredientId: 'ing-chicken', role: 'protein', quantity: '200g' }],
    });
    saveHousehold(makeHousehold({ baseMeals: [existingMeal] }));
    renderAt('/household/h-dest/import-recipe');

    await importRecipeToDestinationStep(user);
    await user.click(screen.getByTestId('dest-new-base-meal'));
    await user.click(screen.getByTestId('promote-confirm-btn'));

    const saved = loadHousehold('h-dest')!;
    expect(saved.baseMeals).toHaveLength(2);
    const original = saved.baseMeals.find((m) => m.id === 'meal-existing')!;
    expect(original.name).toBe('Existing Meal');
    expect(original.components).toHaveLength(1);
  });
});
