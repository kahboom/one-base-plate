import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { BaseMeal, Household, Ingredient, MealComponent, Recipe } from '../src/types';
import { saveHousehold, loadHousehold } from '../src/storage';
import RecipeLibrary from '../src/pages/RecipeLibrary';
import BaseMealManager from '../src/pages/BaseMealManager';

const ingChicken: Ingredient = {
  id: 'ing-chicken',
  name: 'Chicken',
  category: 'protein',
  tags: [],
  shelfLifeHint: '',
  freezerFriendly: false,
  babySafeWithAdaptation: false,
};

const recipeComponent: MealComponent = {
  id: 'comp-1',
  ingredientId: 'ing-chicken',
  role: 'protein',
  quantity: '400g',
};

function makeRecipe(overrides: Partial<Recipe> & { id: string; name: string }): Recipe {
  return {
    components: [],
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: 'h-f072',
    name: 'F072 Test',
    members: [
      {
        id: 'm1',
        name: 'A',
        role: 'adult',
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: 'regular',
        allergens: [],
        notes: '',
      },
    ],
    ingredients: [ingChicken],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('F072: Recipe modal vs Base Meal Editor separation', () => {
  it('recipe modal does not show base-meal structure-authoring controls', async () => {
    const user = userEvent.setup();
    saveHousehold(
      makeHousehold({
        recipes: [
          makeRecipe({
            id: 'r1',
            name: 'Soup',
            components: [recipeComponent],
          }),
        ],
      }),
    );

    render(
      <MemoryRouter initialEntries={['/household/h-f072/recipes']}>
        <Routes>
          <Route path="/household/:householdId/recipes" element={<RecipeLibrary />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('recipe-row-r1'));
    const modal = screen.getByTestId('recipe-modal');

    expect(within(modal).getByText('3. Ingredients')).toBeInTheDocument();
    expect(within(modal).getByTestId('recipe-add-ingredient-btn')).toHaveTextContent(
      'Add ingredient',
    );
    expect(within(modal).queryByText('Add component')).not.toBeInTheDocument();
    expect(within(modal).queryByText('Add mapping')).not.toBeInTheDocument();
    expect(within(modal).queryByText('Mapped ingredients')).not.toBeInTheDocument();

    await user.click(within(modal).getByTestId('recipe-ingredient-toggle-0'));

    expect(within(modal).queryByText('How to make this component')).not.toBeInTheDocument();
    expect(within(modal).queryByText('Attach recipe')).not.toBeInTheDocument();
    expect(within(modal).queryByText('Add alternative')).not.toBeInTheDocument();
    expect(within(modal).queryByTestId('component-recipe-actions-0')).not.toBeInTheDocument();
    expect(within(modal).queryByTestId('alternatives-list-0')).not.toBeInTheDocument();
    expect(within(modal).getByTestId('recipe-remove-ingredient-0')).toHaveTextContent(
      'Remove ingredient',
    );

    expect(within(modal).queryByTestId('component-card-0')).not.toBeInTheDocument();
    expect(within(modal).getByTestId('recipe-ingredient-row-0')).toBeInTheDocument();
  });

  it('recipe modal still supports core recipe editing and promote', async () => {
    const user = userEvent.setup();
    saveHousehold(
      makeHousehold({
        recipes: [makeRecipe({ id: 'r2', name: 'Pasta', components: [], tags: [] })],
      }),
    );

    render(
      <MemoryRouter initialEntries={['/household/h-f072/recipes']}>
        <Routes>
          <Route path="/household/:householdId/recipes" element={<RecipeLibrary />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('recipe-row-r2'));
    const modal = screen.getByTestId('recipe-modal');

    await user.type(within(modal).getByTestId('modal-recipe-name'), ' sauce');
    expect(within(modal).getByTestId('recipe-organization-section')).toBeInTheDocument();
    await user.click(within(modal).getByText('Recipe links'));
    expect(within(modal).getByTestId('recipe-links-editor')).toBeInTheDocument();
    const notesDisclosure = within(modal)
      .getAllByText('Notes')
      .find((el) => el.tagName === 'SUMMARY');
    expect(notesDisclosure).toBeTruthy();
    await user.click(notesDisclosure!);
    expect(within(modal).getByTestId('recipe-notes')).toBeInTheDocument();

    await user.click(within(modal).getByTestId('recipe-add-ingredient-btn'));
    expect(within(modal).getByTestId('recipe-ingredient-row-0')).toBeInTheDocument();

    await user.click(within(modal).getByTestId('recipe-promote-btn'));
    expect(screen.getByText('Create base meal')).toBeInTheDocument();
  });

  it('Base Meal Editor still exposes full structure and planning controls', async () => {
    const user = userEvent.setup();
    const meal: BaseMeal = {
      id: 'bm1',
      name: 'Taco night',
      components: [
        {
          id: 'mc1',
          ingredientId: 'ing-chicken',
          role: 'protein',
          quantity: '1 lb',
        },
      ],
      defaultPrep: 'grill',
      estimatedTimeMinutes: 30,
      difficulty: 'medium',
      rescueEligible: false,
      wasteReuseHints: [],
    };
    saveHousehold(makeHousehold({ baseMeals: [meal] }));

    render(
      <MemoryRouter initialEntries={['/household/h-f072/meals']}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('meal-row-bm1'));
    const modal = screen.getByTestId('meal-modal');

    expect(within(modal).getByText('Add component')).toBeInTheDocument();
    expect(within(modal).getByTestId('meal-planning-section')).toBeInTheDocument();
    expect(within(modal).getByPlaceholderText('e.g. stir-fry, roast')).toBeInTheDocument();

    await user.click(within(modal).getByTestId('component-toggle-0'));
    expect(within(modal).getByText('How to make this component')).toBeInTheDocument();
    expect(within(modal).getByTestId('attach-recipe-0')).toHaveTextContent('Attach recipe');
    expect(within(modal).getByText('Add alternative')).toBeInTheDocument();
  });

  it('promoteRecipeToBaseMeal path still persists linked base meal', async () => {
    const user = userEvent.setup();
    saveHousehold(
      makeHousehold({
        recipes: [
          makeRecipe({
            id: 'r-promo',
            name: 'Promote me',
            components: [recipeComponent],
          }),
        ],
      }),
    );

    render(
      <MemoryRouter initialEntries={['/household/h-f072/recipes']}>
        <Routes>
          <Route path="/household/:householdId/recipes" element={<RecipeLibrary />} />
          <Route path="/household/:householdId/meal/:mealId" element={<div>Meal detail</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('recipe-row-r-promo'));
    const modal = screen.getByTestId('recipe-modal');
    await user.click(within(modal).getByTestId('recipe-promote-btn'));
    await user.click(screen.getByTestId('promote-confirm-btn'));

    const h = loadHousehold('h-f072')!;
    expect(h.baseMeals).toHaveLength(1);
    expect(h.baseMeals[0]!.sourceRecipeId).toBe('r-promo');
    expect(h.baseMeals[0]!.components).toHaveLength(1);
    expect(h.baseMeals[0]!.components[0]!.ingredientId).toBe('ing-chicken');
  });
});
