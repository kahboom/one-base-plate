import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, Ingredient } from '@/types';
import { saveHousehold, loadHousehold } from '@/storage';
import { matchIngredient } from '@/recipe-parser';
import { MASTER_CATALOG, catalogIngredientToHousehold } from '@/catalog';
import IngredientManager from '@/pages/IngredientManager';
import RecipeImport from '@/pages/RecipeImport';
import {
  openIngredientAddManualFromCatalogPicker,
  pickCatalogItemInAddDialog,
} from './incremental-load-helpers';

function seedHousehold(ingredients: Ingredient[] = [], id = 'h-f070'): Household {
  const household: Household = {
    id,
    name: 'F070 Test',
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

function renderIngredients(householdId = 'h-f070') {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/ingredients`]}>
      <Routes>
        <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('F070: Ingredient Manager — no eager catalog merge', () => {
  it('shows only persisted household rows; empty storage means Items (0)', async () => {
    seedHousehold([]);
    renderIngredients();

    expect(screen.getByText('Items (0)')).toBeInTheDocument();
    await waitFor(() => expect(loadHousehold('h-f070')!.ingredients).toHaveLength(0));
  });

  it('Add ingredient opens catalog search dialog first', async () => {
    seedHousehold([]);
    const user = userEvent.setup();
    renderIngredients();

    await user.click(screen.getAllByText('Add ingredient')[0]!);
    expect(screen.getByTestId('catalog-add-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-add-search')).toBeInTheDocument();
  });

  it('picking catalog item then Done persists source=catalog and catalogId', async () => {
    seedHousehold([]);
    const user = userEvent.setup();
    renderIngredients();

    await pickCatalogItemInAddDialog(user, 'pasta', 'catalog-add-result-cat-pasta');
    const modal = screen.getByTestId('ingredient-modal');
    await user.click(within(modal).getByText('Done'));

    await waitFor(() => {
      const h = loadHousehold('h-f070')!;
      expect(h.ingredients).toHaveLength(1);
      expect(h.ingredients[0]!.source).toBe('catalog');
      expect(h.ingredients[0]!.catalogId).toBe('cat-pasta');
    });
  });

  it('Create manual pre-fills name from catalog search text', async () => {
    seedHousehold([]);
    const user = userEvent.setup();
    renderIngredients();

    await user.click(screen.getAllByText('Add ingredient')[0]!);
    await user.type(screen.getByTestId('catalog-add-search'), 'corn flour');
    await user.click(screen.getByTestId('catalog-add-create-manual'));
    const modal = screen.getByTestId('ingredient-modal');
    expect(within(modal).getByTestId('modal-ingredient-name')).toHaveValue('Corn flour');
  });

  it('Create manually path persists source=manual without catalogId', async () => {
    seedHousehold([]);
    const user = userEvent.setup();
    renderIngredients();

    await openIngredientAddManualFromCatalogPicker(user);
    const modal = screen.getByTestId('ingredient-modal');
    await user.type(within(modal).getByTestId('modal-ingredient-name'), 'rare fungus');
    await user.click(within(modal).getByText('Done'));

    await waitFor(() => {
      const h = loadHousehold('h-f070')!;
      const ing = h.ingredients.find((i) => i.name === 'rare fungus');
      expect(ing).toBeDefined();
      expect(ing!.source).toBe('manual');
      expect(ing!.catalogId).toBeUndefined();
    });
  });

  it('existing catalog-linked household data still loads and edits', async () => {
    const pasta = catalogIngredientToHousehold(
      MASTER_CATALOG.find((i: { id: string }) => i.id === 'cat-pasta')!,
    );
    seedHousehold([pasta]);
    const user = userEvent.setup();
    renderIngredients();

    expect(screen.getByText('Items (1)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Edit Pasta$/i }));
    const modal = screen.getByTestId('ingredient-modal');
    expect(within(modal).getByTestId('ingredient-source-label')).toHaveTextContent('From catalog');
  });
});

describe('F070: matchIngredient — household-first', () => {
  it('prefers household canonical over catalog when both could match strongly', () => {
    const household: Ingredient[] = [
      {
        id: 'h-tom',
        name: 'tomatoes',
        category: 'veg',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        source: 'manual',
      },
    ];
    const m = matchIngredient('tomatoes', household, MASTER_CATALOG);
    expect(m.status).toBe('matched');
    expect(m.ingredient?.id).toBe('h-tom');
    expect(m.catalogItem).toBeNull();
  });
});

describe('F070: Recipe import review labels', () => {
  it('shows catalog suggestion copy when line matches catalog only', async () => {
    seedHousehold(
      [
        {
          id: 'ing-chicken',
          name: 'chicken breast',
          category: 'protein',
          tags: [],
          shelfLifeHint: '',
          freezerFriendly: true,
          babySafeWithAdaptation: true,
          source: 'manual',
        },
      ],
      'h-imp',
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-imp/import-recipe']}>
        <Routes>
          <Route path="/household/:householdId/import-recipe" element={<RecipeImport />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByTestId('import-recipe-text'), 'pasta');
    await user.click(screen.getByTestId('import-parse-btn'));

    expect(screen.getByTestId('review-catalog-suggestion-0')).toHaveTextContent(
      /Catalog suggestion: Pasta/i,
    );
    expect(screen.getByTestId('review-catalog-suggestion-0')).toHaveTextContent(
      /Not yet in your household/i,
    );
  });

  it('ignored catalog line does not add ingredient on save', async () => {
    const hh: Household = {
      id: 'h-imp2',
      name: 'Import 2',
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
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    };
    saveHousehold(hh);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-imp2/import-recipe']}>
        <Routes>
          <Route path="/household/:householdId/import-recipe" element={<RecipeImport />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByTestId('import-recipe-text'), 'pasta');
    await user.click(screen.getByTestId('import-parse-btn'));

    await user.selectOptions(screen.getByTestId('review-action-0'), 'ignore');
    await user.click(screen.getByTestId('import-build-draft-btn'));
    await user.type(screen.getByTestId('draft-meal-name'), 'Emptyish');
    await user.click(screen.getByTestId('import-save-btn'));

    const saved = loadHousehold('h-imp2')!;
    expect(saved.ingredients.some((i) => i.name === 'pasta')).toBe(false);
  });
});
