import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, Ingredient } from '../src/types';
import { saveHousehold, loadHousehold } from '../src/storage';
import {
  MASTER_CATALOG,
  searchCatalog,
  catalogIngredientToHousehold,
  getCatalogByCategory,
} from '../src/catalog';
import IngredientManager from '../src/pages/IngredientManager';
import {
  pickCatalogItemInAddDialog,
  openIngredientAddManualFromCatalogPicker,
} from './incremental-load-helpers';

function makeIngredient(overrides: Partial<Ingredient> & { name: string }): Ingredient {
  return {
    id: `ing-${overrides.name.toLowerCase().replace(/\s+/g, '-')}`,
    category: 'pantry',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    ...overrides,
  };
}

function seedHousehold(ingredients: Ingredient[] = []): Household {
  const household: Household = {
    id: 'h-catalog',
    name: 'Catalog Test Family',
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
    ingredients,
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderPage(householdId = 'h-catalog') {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/ingredients`]}>
      <Routes>
        <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        <Route path="/household/:householdId/home" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('F044: Master ingredient catalog', () => {
  it('catalog contains ingredients across all 8 categories', () => {
    const categories = new Set(MASTER_CATALOG.map((i) => i.category));
    expect(categories).toContain('protein');
    expect(categories).toContain('carb');
    expect(categories).toContain('veg');
    expect(categories).toContain('fruit');
    expect(categories).toContain('dairy');
    expect(categories).toContain('snack');
    expect(categories).toContain('freezer');
    expect(categories).toContain('pantry');
    expect(MASTER_CATALOG.length).toBeGreaterThanOrEqual(50);
  });

  it('catalog is separate from household ingredients in storage', () => {
    seedHousehold([makeIngredient({ name: 'Custom item', category: 'pantry' })]);
    const household = loadHousehold('h-catalog')!;
    expect(household.ingredients).toHaveLength(1);
    expect(MASTER_CATALOG.length).toBeGreaterThan(1);
    expect(MASTER_CATALOG.find((i) => i.name === 'Custom item')).toBeUndefined();
  });

  it('searchCatalog finds matching items case-insensitively', () => {
    const results = searchCatalog('chick');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some((r) => r.name === 'chicken breast')).toBe(true);
    expect(results.some((r) => r.name === 'chickpeas')).toBe(true);
  });

  it('searchCatalog returns empty for blank query', () => {
    expect(searchCatalog('')).toEqual([]);
    expect(searchCatalog('   ')).toEqual([]);
  });

  it('getCatalogByCategory filters to a single category', () => {
    const proteins = getCatalogByCategory('protein');
    expect(proteins.length).toBeGreaterThanOrEqual(5);
    expect(proteins.every((p) => p.category === 'protein')).toBe(true);
  });

  it('catalogIngredientToHousehold creates a valid Ingredient with unique id', () => {
    const catalogItem = MASTER_CATALOG[0]!;
    const ing = catalogIngredientToHousehold(catalogItem);
    expect(ing.id).toBeTruthy();
    expect(ing.id).not.toBe(catalogItem.id);
    expect(ing.name).toBe(catalogItem.name);
    expect(ing.category).toBe(catalogItem.category);
    expect(ing.tags).toEqual(catalogItem.tags);
    expect(ing.freezerFriendly).toBe(catalogItem.freezerFriendly);
    expect(ing.babySafeWithAdaptation).toBe(catalogItem.babySafeWithAdaptation);
    expect(ing.shelfLifeHint).toBe('');
  });

  it('catalogIngredientToHousehold supports overrides for pre-save edits', () => {
    const catalogItem = MASTER_CATALOG[0]!;
    const ing = catalogIngredientToHousehold(catalogItem, {
      tags: ['custom'],
      freezerFriendly: true,
    });
    expect(ing.tags).toEqual(['custom']);
    expect(ing.freezerFriendly).toBe(true);
  });
});

describe('F044: Household list excludes master catalog until explicit add', () => {
  it('empty household shows zero items; catalog is not merged into the list', async () => {
    seedHousehold();
    renderPage();

    expect(screen.getByText('Items (0)')).toBeInTheDocument();
    await waitFor(() => {
      expect(loadHousehold('h-catalog')!.ingredients).toHaveLength(0);
    });
  });

  it('does not duplicate household items that match catalog names', async () => {
    seedHousehold([makeIngredient({ name: 'Pasta', category: 'carb' })]);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Items (1)')).toBeInTheDocument();

    await user.type(screen.getByTestId('ingredient-search'), 'Pasta');
    const pastaMatches = screen.getAllByText('Pasta');
    expect(pastaMatches).toHaveLength(1);
  });

  it('custom household items are listed without auto-adding catalog entries', async () => {
    seedHousehold([makeIngredient({ name: 'Unicorn meat', category: 'protein' })]);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Items (1)')).toBeInTheDocument();
    await user.type(screen.getByTestId('ingredient-search'), 'Unicorn meat');
    expect(screen.getByText('Unicorn meat')).toBeInTheDocument();
    await user.clear(screen.getByTestId('ingredient-search'));
    await user.type(screen.getByTestId('ingredient-search'), 'Chicken breast');
    expect(screen.queryByText('Chicken breast')).not.toBeInTheDocument();
  });
});

describe('F044: Manual creation preserved', () => {
  it("'Add ingredient' opens catalog search; manual path opens blank modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByText('Add ingredient')[0]!);
    expect(screen.getByTestId('catalog-add-dialog')).toBeInTheDocument();

    await openIngredientAddManualFromCatalogPicker(user);

    const modal = screen.getByTestId('ingredient-modal');
    expect(within(modal).getByText('New ingredient')).toBeInTheDocument();
    expect(within(modal).getByTestId('modal-ingredient-name')).toHaveValue('');
  });
});

describe('F044: Catalog ingredients work with existing flows', () => {
  it('explicit catalog pick then Done persists a catalog-linked household row', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(loadHousehold('h-catalog')!.ingredients).toHaveLength(0);
    });

    await pickCatalogItemInAddDialog(user, 'eggs', 'catalog-add-result-cat-eggs');
    const modal = screen.getByTestId('ingredient-modal');
    await user.click(within(modal).getByText('Done'));

    await waitFor(() => {
      const household = loadHousehold('h-catalog')!;
      expect(household.ingredients.length).toBeGreaterThanOrEqual(1);
      const eggs = household.ingredients.find((i) => i.name === 'eggs');
      expect(eggs).toBeDefined();
      expect(eggs!.category).toBe('protein');
      expect(eggs!.tags).toContain('quick');
      expect(eggs!.source).toBe('catalog');
    });
  });

  it('catalog-backed row can be edited via modal', async () => {
    seedHousehold([catalogIngredientToHousehold(MASTER_CATALOG.find((i) => i.name === 'pasta')!)]);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId('ingredient-search'), 'Pasta');
    const rows = screen.getAllByTestId((id) => id.startsWith('ingredient-row-'));
    await user.click(rows[0]!);

    const modal = screen.getByTestId('ingredient-modal');
    expect(within(modal).getByTestId('modal-ingredient-name')).toHaveValue('pasta');

    await user.clear(within(modal).getByTestId('modal-ingredient-name'));
    await user.type(within(modal).getByTestId('modal-ingredient-name'), 'Fusilli pasta');
    await user.click(within(modal).getByText('Done'));

    expect(screen.getByText('Fusilli pasta')).toBeInTheDocument();
  });

  it('catalog ingredient has valid structure for planner/grocery flows', () => {
    const catalogItem = MASTER_CATALOG.find((i) => i.name === 'chicken breast')!;
    const ing = catalogIngredientToHousehold(catalogItem);

    expect(ing.id).toBeTruthy();
    expect(typeof ing.name).toBe('string');
    expect(typeof ing.category).toBe('string');
    expect(Array.isArray(ing.tags)).toBe(true);
    expect(typeof ing.shelfLifeHint).toBe('string');
    expect(typeof ing.freezerFriendly).toBe('boolean');
    expect(typeof ing.babySafeWithAdaptation).toBe('boolean');
  });

  it('search and category filter work on persisted household ingredients', async () => {
    const salmon = catalogIngredientToHousehold(MASTER_CATALOG.find((i) => i.name === 'salmon')!);
    const apple = catalogIngredientToHousehold(MASTER_CATALOG.find((i) => i.name === 'apple')!);
    seedHousehold([salmon, apple]);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId('ingredient-search'), 'salmon');
    expect(screen.getByText('Salmon')).toBeInTheDocument();

    await user.clear(screen.getByTestId('ingredient-search'));
    await user.selectOptions(screen.getByTestId('ingredient-category-filter'), 'fruit');

    const rows = screen.getAllByTestId((id) => id.startsWith('ingredient-row-'));
    expect(rows).toHaveLength(1);
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('deleting a catalog-sourced ingredient removes it and it stays gone on revisit', async () => {
    const tortillas = catalogIngredientToHousehold(
      MASTER_CATALOG.find((i) => i.id === 'cat-wraps')!,
    );
    seedHousehold([tortillas]);
    const user = userEvent.setup();
    const view = renderPage();

    await user.type(screen.getByTestId('ingredient-search'), 'tortillas');
    await user.click(screen.getByRole('button', { name: /^Edit Tortillas$/i }));
    const modal = screen.getByTestId('ingredient-modal');
    await user.click(within(modal).getByTestId('delete-ingredient-btn'));
    const deleteConfirm = screen.getByRole('dialog', { name: 'Delete ingredient' });
    await user.click(within(deleteConfirm).getByRole('button', { name: 'Delete' }));

    const saved = loadHousehold('h-catalog')!;
    expect(saved.ingredients).toHaveLength(0);

    view.unmount();
    renderPage();
    expect(screen.getByText('Items (0)')).toBeInTheDocument();
    await user.type(screen.getByTestId('ingredient-search'), 'tortillas');
    expect(screen.queryByRole('button', { name: /^Edit Tortillas$/i })).not.toBeInTheDocument();
  });
});
