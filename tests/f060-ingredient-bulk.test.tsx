import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, Ingredient, BaseMeal, Recipe, WeeklyPlan } from '../src/types';
import { saveHousehold, loadHousehold } from '../src/storage';
import IngredientManager from '../src/pages/IngredientManager';
import { DEFAULT_PAGE_SIZE } from '../src/hooks/usePaginatedList';
import { findIngredientReferences } from '../src/lib/ingredientRefs';

function makeIngredient(overrides: Partial<Ingredient> & { name: string }): Ingredient {
  return {
    id: `ing-${overrides.name.toLowerCase().replace(/\s+/g, '-')}`,
    category: 'pantry',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
    ...overrides,
  };
}

function makeMeal(
  overrides: Partial<BaseMeal> & { name: string; ingredientIds?: string[] },
): BaseMeal {
  const { name, ingredientIds, ...rest } = overrides;
  return {
    id: `meal-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    components: (ingredientIds ?? []).map((id) => ({
      id: crypto.randomUUID(),
      ingredientId: id,
      role: 'protein' as const,
      quantity: '1',
    })),
    defaultPrep: 'cook',
    estimatedTimeMinutes: 30,
    difficulty: 'easy',
    rescueEligible: false,
    wasteReuseHints: [],
    ...rest,
  };
}

function seedHousehold(
  opts: {
    ingredients?: Ingredient[];
    baseMeals?: BaseMeal[];
    recipes?: Recipe[];
    weeklyPlans?: WeeklyPlan[];
  } = {},
): Household {
  const household: Household = {
    id: 'h-bulk',
    name: 'Bulk Test Family',
    members: [
      {
        id: 'm1',
        name: 'Parent',
        role: 'adult',
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: 'regular',
        allergens: [],
        notes: '',
      },
    ],
    ingredients: opts.ingredients ?? [],
    baseMeals: opts.baseMeals ?? [],
    weeklyPlans: opts.weeklyPlans ?? [],
    recipes: opts.recipes ?? [],
  };
  saveHousehold(household);
  return household;
}

function renderPage(householdId = 'h-bulk') {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/ingredients`]}>
      <Routes>
        <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
      </Routes>
    </MemoryRouter>,
  );
}

function manyIngredients(count: number): Ingredient[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bulk-${i}`,
    name: `ingredient ${String(i).padStart(4, '0')}`,
    category: 'pantry' as const,
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual' as const,
  }));
}

/** Filter to source=manual when the household mixes manual and catalog-sourced rows */
async function filterToManual(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByTestId('ingredient-source-filter'), 'manual');
}

beforeEach(() => {
  localStorage.clear();
});

/* ------------------------------------------------------------------ */
/*  Pagination                                                         */
/* ------------------------------------------------------------------ */

describe('F060: Paginated rendering', () => {
  it('renders only one page of items, no load-more or infinite scroll', async () => {
    seedHousehold({ ingredients: manyIngredients(40) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const list = screen.getByTestId('ingredient-list');
    const rows = within(list).getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(DEFAULT_PAGE_SIZE);

    expect(screen.queryByTestId('ingredient-list-load-more')).not.toBeInTheDocument();
    expect(screen.getByTestId('pagination-controls')).toBeInTheDocument();
  });

  it('shows pagination controls with correct page count', async () => {
    seedHousehold({ ingredients: manyIngredients(60) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 1 of 3');
  });

  it('does not show pagination controls when items fit on one page', async () => {
    seedHousehold({ ingredients: manyIngredients(10) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    expect(screen.queryByTestId('pagination-controls')).not.toBeInTheDocument();
  });

  it('navigates to next and previous pages', async () => {
    seedHousehold({ ingredients: manyIngredients(60) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 1 of 3');

    await user.click(screen.getByTestId('pagination-next'));
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 2 of 3');

    await user.click(screen.getByTestId('pagination-prev'));
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 1 of 3');
  });

  it('navigates to first and last pages', async () => {
    seedHousehold({ ingredients: manyIngredients(60) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('pagination-last'));
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 3 of 3');

    await user.click(screen.getByTestId('pagination-first'));
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 1 of 3');
  });

  it('shows a wider page window and jump-to-page for long lists', async () => {
    seedHousehold({ ingredients: manyIngredients(300) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 1 of 12');
    expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-page-2')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-page-3')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-page-12')).toBeInTheDocument();

    const goTo = screen.getByTestId('pagination-go-to-input');
    await user.clear(goTo);
    await user.type(goTo, '8');
    await user.click(screen.getByTestId('pagination-go-to-submit'));
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 8 of 12');

    await user.clear(goTo);
    await user.type(goTo, '999');
    await user.click(screen.getByTestId('pagination-go-to-submit'));
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 12 of 12');
  });
});

describe('F060: Page size changes', () => {
  it('changing page size resets to page 1', async () => {
    seedHousehold({ ingredients: manyIngredients(60) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('pagination-next'));
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 2');

    await user.selectOptions(screen.getByTestId('ingredient-page-size'), '50');
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 1 of 2');

    const list = screen.getByTestId('ingredient-list');
    const rows = within(list).getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(50);
  });

  it('page size 100 shows up to 100 items per page', async () => {
    seedHousehold({ ingredients: manyIngredients(120) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.selectOptions(screen.getByTestId('ingredient-page-size'), '100');
    const list = screen.getByTestId('ingredient-list');
    const rows = within(list).getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(100);
  });
});

/* ------------------------------------------------------------------ */
/*  Selection                                                          */
/* ------------------------------------------------------------------ */

describe('F060: Row selection', () => {
  it('clicking checkbox selects a row without opening modal', async () => {
    const ingredients = [makeIngredient({ name: 'Alpha' }), makeIngredient({ name: 'Beta' })];
    seedHousehold({ ingredients });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('ingredient-select-ing-alpha'));

    expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('1 selected');
    expect(screen.queryByTestId('ingredient-modal')).not.toBeInTheDocument();
  });

  it('clicking row body still opens modal edit', async () => {
    seedHousehold({ ingredients: [makeIngredient({ name: 'Apple' })] });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId('ingredient-search'), 'Apple');
    await user.click(screen.getByTestId('ingredient-row-ing-apple'));

    expect(screen.getByTestId('ingredient-modal')).toBeInTheDocument();
  });

  it('select-all-on-page checkbox selects all items on current page', async () => {
    seedHousehold({ ingredients: manyIngredients(40) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('select-all-page-checkbox'));

    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent(
      `${DEFAULT_PAGE_SIZE} selected`,
    );
  });

  it('select-all-on-page toggles off when all are selected', async () => {
    seedHousehold({ ingredients: manyIngredients(10) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('10 selected');

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
  });

  it('select all filtered results selects across pages', async () => {
    seedHousehold({ ingredients: manyIngredients(60) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    // First select page to show bulk bar
    await user.click(screen.getByTestId('select-all-page-checkbox'));
    await user.click(screen.getByTestId('bulk-select-all-filtered'));
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('60 selected');
  });

  it('clear selection removes all selections', async () => {
    seedHousehold({ ingredients: manyIngredients(10) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('10 selected');

    await user.click(screen.getByTestId('bulk-clear-selection'));
    expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
  });
});

describe('F060: Selection persists across pagination', () => {
  it('selection persists when navigating pages', async () => {
    seedHousehold({ ingredients: manyIngredients(60) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent(
      `${DEFAULT_PAGE_SIZE} selected`,
    );

    await user.click(screen.getByTestId('pagination-next'));
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent(
      `${DEFAULT_PAGE_SIZE} selected`,
    );

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent(
      `${DEFAULT_PAGE_SIZE * 2} selected`,
    );
  });

  it('selection persists when applying filters', async () => {
    const ingredients = [
      makeIngredient({ name: 'Alpha', category: 'protein' }),
      makeIngredient({ name: 'Beta', category: 'carb' }),
      makeIngredient({ name: 'Gamma', category: 'protein' }),
    ];
    seedHousehold({ ingredients });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('ingredient-select-ing-alpha'));
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('1 selected');

    await user.selectOptions(screen.getByTestId('ingredient-category-filter'), 'carb');
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('1 selected');
  });
});

/* ------------------------------------------------------------------ */
/*  Source filter                                                      */
/* ------------------------------------------------------------------ */

describe('F060: Source filter', () => {
  it('filters by source type', async () => {
    const ingredients = [
      makeIngredient({ name: 'Custom Item', source: 'manual' }),
      makeIngredient({ name: 'Catalog Item', source: 'catalog' }),
      makeIngredient({ name: 'Imported Item', source: 'pending-import' }),
    ];
    seedHousehold({ ingredients });
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByTestId('ingredient-source-filter'), 'manual');
    expect(screen.getByText('Custom item')).toBeInTheDocument();
    expect(screen.queryByText('Imported item')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('ingredient-source-filter'), 'pending-import');
    expect(screen.getByText('Imported item')).toBeInTheDocument();
    expect(screen.queryByText('Custom item')).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Bulk delete confirmation                                           */
/* ------------------------------------------------------------------ */

describe('F060: Bulk delete confirmation', () => {
  it('opens bulk delete dialog with count and sample names', async () => {
    const ingredients = [
      makeIngredient({ name: 'Alpha' }),
      makeIngredient({ name: 'Beta' }),
      makeIngredient({ name: 'Gamma' }),
    ];
    seedHousehold({ ingredients });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('ingredient-select-ing-alpha'));
    await user.click(screen.getByTestId('ingredient-select-ing-beta'));
    await user.click(screen.getByTestId('bulk-delete-btn'));

    const dialog = screen.getByTestId('bulk-delete-dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Delete 2 selected ingredients');

    const sampleNames = screen.getByTestId('bulk-delete-sample-names');
    expect(sampleNames).toHaveTextContent('Alpha');
    expect(sampleNames).toHaveTextContent('Beta');
  });

  it('deletes unreferenced ingredients and removes them from storage', async () => {
    const ingredients = [
      makeIngredient({ name: 'Alpha' }),
      makeIngredient({ name: 'Beta' }),
      makeIngredient({ name: 'Gamma' }),
    ];
    seedHousehold({ ingredients });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('ingredient-select-ing-alpha'));
    await user.click(screen.getByTestId('ingredient-select-ing-beta'));
    await user.click(screen.getByTestId('bulk-delete-btn'));
    await user.click(screen.getByTestId('bulk-delete-confirm-btn'));

    expect(screen.queryByTestId('bulk-delete-dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();

    const saved = loadHousehold('h-bulk')!;
    expect(saved.ingredients.find((i) => i.name === 'alpha')).toBeUndefined();
    expect(saved.ingredients.find((i) => i.name === 'beta')).toBeUndefined();
    expect(saved.ingredients.find((i) => i.name === 'gamma')).toBeDefined();
  });

  it('clears deleted items from selection after bulk delete', async () => {
    const ingredients = [makeIngredient({ name: 'Alpha' }), makeIngredient({ name: 'Beta' })];
    seedHousehold({ ingredients });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    await user.click(screen.getByTestId('bulk-delete-btn'));
    await user.click(screen.getByTestId('bulk-delete-confirm-btn'));

    expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Protected / referenced ingredient handling                         */
/* ------------------------------------------------------------------ */

describe('F060: Protected ingredient detection', () => {
  it('shows protected warning for ingredients referenced by meals', async () => {
    const ingredients = [makeIngredient({ name: 'Protected' }), makeIngredient({ name: 'Free' })];
    const meals = [makeMeal({ name: 'Test Meal', ingredientIds: ['ing-protected'] })];
    seedHousehold({ ingredients, baseMeals: meals });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    await user.click(screen.getByTestId('bulk-delete-btn'));

    const dialog = screen.getByTestId('bulk-delete-dialog');
    const warning = within(dialog).getByTestId('bulk-delete-protected-warning');
    expect(warning).toHaveTextContent('Protected');
    expect(warning).toHaveTextContent('Test Meal');
  });

  it('offers to delete only unreferenced items when mix exists', async () => {
    const ingredients = [makeIngredient({ name: 'Protected' }), makeIngredient({ name: 'Free' })];
    const meals = [makeMeal({ name: 'Test Meal', ingredientIds: ['ing-protected'] })];
    seedHousehold({ ingredients, baseMeals: meals });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    await user.click(screen.getByTestId('bulk-delete-btn'));

    const confirmBtn = screen.getByTestId('bulk-delete-confirm-btn');
    expect(confirmBtn).toHaveTextContent('Delete 1 unreferenced');

    await user.click(confirmBtn);

    expect(screen.queryByText('Free')).not.toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('shows only close button when all selected are referenced', async () => {
    const ingredients = [makeIngredient({ name: 'Protected' })];
    const meals = [makeMeal({ name: 'Test Meal', ingredientIds: ['ing-protected'] })];
    seedHousehold({ ingredients, baseMeals: meals });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('ingredient-select-ing-protected'));
    await user.click(screen.getByTestId('bulk-delete-btn'));

    expect(screen.queryByTestId('bulk-delete-confirm-btn')).not.toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});

describe('F060: findIngredientReferences utility', () => {
  it('detects references in baseMeal components', () => {
    const household: Household = {
      id: 'h-test',
      name: 'Test',
      members: [],
      ingredients: [makeIngredient({ name: 'A' })],
      baseMeals: [makeMeal({ name: 'Meal 1', ingredientIds: ['ing-a'] })],
      weeklyPlans: [],
    };
    const refs = findIngredientReferences(new Set(['ing-a']), household);
    expect(refs.has('ing-a')).toBe(true);
    expect(refs.get('ing-a')![0]!.type).toBe('baseMeal');
    expect(refs.get('ing-a')![0]!.entityName).toBe('Meal 1');
  });

  it('detects references in recipe components', () => {
    const household: Household = {
      id: 'h-test',
      name: 'Test',
      members: [],
      ingredients: [makeIngredient({ name: 'B' })],
      baseMeals: [],
      weeklyPlans: [],
      recipes: [
        {
          id: 'r1',
          name: 'Recipe 1',
          components: [{ ingredientId: 'ing-b', role: 'protein', quantity: '1' }],
        },
      ],
    };
    const refs = findIngredientReferences(new Set(['ing-b']), household);
    expect(refs.has('ing-b')).toBe(true);
    expect(refs.get('ing-b')![0]!.type).toBe('recipe');
  });

  it('detects references in weekly plan grocery lists', () => {
    const household: Household = {
      id: 'h-test',
      name: 'Test',
      members: [],
      ingredients: [makeIngredient({ name: 'C' })],
      baseMeals: [],
      weeklyPlans: [
        {
          id: 'wp1',
          days: [],
          selectedBaseMeals: [],
          notes: '',
          generatedGroceryList: [
            { ingredientId: 'ing-c', name: 'C', category: 'pantry', quantity: '1', owned: false },
          ],
        },
      ],
    };
    const refs = findIngredientReferences(new Set(['ing-c']), household);
    expect(refs.has('ing-c')).toBe(true);
    expect(refs.get('ing-c')![0]!.type).toBe('weeklyPlan');
  });

  it('returns empty map for unreferenced ingredients', () => {
    const household: Household = {
      id: 'h-test',
      name: 'Test',
      members: [],
      ingredients: [makeIngredient({ name: 'D' })],
      baseMeals: [],
      weeklyPlans: [],
    };
    const refs = findIngredientReferences(new Set(['ing-d']), household);
    expect(refs.size).toBe(0);
  });

  it('detects alternative ingredient references', () => {
    const household: Household = {
      id: 'h-test',
      name: 'Test',
      members: [],
      ingredients: [makeIngredient({ name: 'Alt' })],
      baseMeals: [
        {
          id: 'm1',
          name: 'Meal',
          components: [
            {
              ingredientId: 'other',
              alternativeIngredientIds: ['ing-alt'],
              role: 'protein',
              quantity: '1',
            },
          ],
          defaultPrep: '',
          estimatedTimeMinutes: 30,
          difficulty: 'easy',
          rescueEligible: false,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [],
    };
    const refs = findIngredientReferences(new Set(['ing-alt']), household);
    expect(refs.has('ing-alt')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Recovery after bulk delete                                         */
/* ------------------------------------------------------------------ */

describe('F060: Recovery after bulk delete', () => {
  it('recovers page when bulk delete empties last page', async () => {
    seedHousehold({ ingredients: manyIngredients(30) });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    // Go to page 2 (items 25-29)
    await user.click(screen.getByTestId('pagination-next'));
    expect(screen.getByTestId('ingredient-list-summary')).toHaveTextContent('page 2 of 2');

    await user.click(screen.getByTestId('select-all-page-checkbox'));
    await user.click(screen.getByTestId('bulk-delete-btn'));
    await user.click(screen.getByTestId('bulk-delete-confirm-btn'));

    // Should recover — remaining items fit on one page, so no pagination shown
    const list = screen.getByTestId('ingredient-list');
    const rows = within(list).getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(screen.queryByTestId('pagination-controls')).not.toBeInTheDocument();
  });

  it('shows empty state when all manual items are deleted', async () => {
    seedHousehold({ ingredients: [makeIngredient({ name: 'Only one' })] });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('ingredient-select-ing-only-one'));
    await user.click(screen.getByTestId('bulk-delete-btn'));
    await user.click(screen.getByTestId('bulk-delete-confirm-btn'));

    expect(screen.getByText(/No household ingredients yet/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Row click still opens modal                                        */
/* ------------------------------------------------------------------ */

describe('F060: Modal editing from rows', () => {
  it('row click opens modal with ingredient details', async () => {
    seedHousehold({ ingredients: [makeIngredient({ name: 'Apple', category: 'fruit' })] });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId('ingredient-search'), 'Apple');
    await user.click(screen.getByTestId('ingredient-row-ing-apple'));

    const modal = screen.getByTestId('ingredient-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByTestId('modal-ingredient-name')).toHaveValue('apple');
    expect(within(modal).getByTestId('modal-ingredient-category')).toHaveValue('fruit');
  });
});

/* ------------------------------------------------------------------ */
/*  Mobile layout                                                      */
/* ------------------------------------------------------------------ */

describe('F060: Mobile stacked layout', () => {
  it('renders category and tags inline below name on mobile (hidden desktop columns)', () => {
    seedHousehold({
      ingredients: [makeIngredient({ name: 'Apple', category: 'fruit', tags: ['quick'] })],
    });
    renderPage();

    // Search to find the item
    fireEvent.change(screen.getByTestId('ingredient-search'), { target: { value: 'Apple' } });

    const row = screen.getByTestId('ingredient-row-ing-apple');
    const chips = within(row).getAllByText('fruit');
    expect(chips.length).toBeGreaterThanOrEqual(1);
  });

  it('bulk selection works with checkbox tap target', async () => {
    seedHousehold({ ingredients: [makeIngredient({ name: 'Apple' })] });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    await user.click(screen.getByTestId('ingredient-select-ing-apple'));
    expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument();

    await user.click(screen.getByTestId('bulk-delete-btn'));
    expect(screen.getByTestId('bulk-delete-dialog')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  No infinite scroll                                                 */
/* ------------------------------------------------------------------ */

describe('F060: No infinite scroll behavior', () => {
  it('does not render a load-more button', () => {
    seedHousehold({ ingredients: manyIngredients(60) });
    renderPage();

    expect(screen.queryByTestId('ingredient-list-load-more')).not.toBeInTheDocument();
    expect(screen.queryByText('Load more ingredients')).not.toBeInTheDocument();
  });

  it('does not render an intersection observer sentinel', () => {
    seedHousehold({ ingredients: manyIngredients(60) });
    const { container } = renderPage();

    const sentinels = container.querySelectorAll('[aria-hidden="true"].h-px');
    expect(sentinels).toHaveLength(0);
  });
});
