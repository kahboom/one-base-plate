import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, Ingredient } from '../src/types';
import { saveHousehold } from '../src/storage';
import { catalogIngredientToHousehold, MASTER_CATALOG } from '../src/catalog';
import { getCatalogDefaultImageUrl, resolveIngredientImageUrl } from '../src/lib/ingredientImage';
import IngredientManager from '../src/pages/IngredientManager';
import RecipeImport from '../src/pages/RecipeImport';
import App from '../src/App';
import { parsePaprikaRecipes, saveImportSession } from '../src/paprika-parser';
import type { PaprikaRecipe } from '../src/paprika-parser';
import { loadAllIngredientListRows } from './incremental-load-helpers';

const catEggs = MASTER_CATALOG.find((c) => c.id === 'cat-eggs')!;
const catFlour = MASTER_CATALOG.find((c) => c.id === 'cat-flour')!;
const catLentils = MASTER_CATALOG.find((c) => c.id === 'cat-lentils')!;

function makeHousehold(ingredients: Ingredient[]): Household {
  return {
    id: 'h-f071',
    name: 'F071 Test',
    members: [
      {
        id: 'm1',
        name: 'Alex',
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
}

beforeEach(() => {
  localStorage.clear();
});

describe('F071 — resolveIngredientImageUrl', () => {
  it('returns household imageUrl when set', () => {
    const ing: Ingredient = {
      id: '1',
      name: 'eggs',
      category: 'protein',
      tags: [],
      shelfLifeHint: '',
      freezerFriendly: false,
      babySafeWithAdaptation: true,
      catalogId: 'cat-eggs',
      imageUrl: 'https://example.com/my-eggs.jpg',
    };
    expect(resolveIngredientImageUrl(ing)).toBe('https://example.com/my-eggs.jpg');
  });

  it('falls back to catalog imageUrl when catalogId links and no household imageUrl', () => {
    const ing: Ingredient = {
      id: '1',
      name: 'eggs',
      category: 'protein',
      tags: [],
      shelfLifeHint: '',
      freezerFriendly: false,
      babySafeWithAdaptation: true,
      catalogId: 'cat-eggs',
    };
    expect(resolveIngredientImageUrl(ing)).toBe(catEggs.imageUrl);
  });

  it('returns undefined when no custom or catalog image', () => {
    const ing: Ingredient = {
      id: '1',
      name: 'lentils',
      category: 'protein',
      tags: [],
      shelfLifeHint: '',
      freezerFriendly: false,
      babySafeWithAdaptation: true,
      catalogId: 'cat-lentils',
    };
    expect(catLentils.imageUrl).toBeUndefined();
    expect(resolveIngredientImageUrl(ing)).toBeUndefined();
  });

  it('getCatalogDefaultImageUrl reads catalog only', () => {
    const ing: Ingredient = {
      id: '1',
      name: 'eggs',
      category: 'protein',
      tags: [],
      shelfLifeHint: '',
      freezerFriendly: false,
      babySafeWithAdaptation: true,
      catalogId: 'cat-eggs',
      imageUrl: 'https://example.com/custom.jpg',
    };
    expect(getCatalogDefaultImageUrl(ing)).toBe(catEggs.imageUrl);
  });
});

describe('F071 — catalogIngredientToHousehold does not copy catalog imageUrl', () => {
  it('leaves household imageUrl undefined unless overrides pass it', () => {
    expect(catEggs.imageUrl).toBeDefined();
    const row = catalogIngredientToHousehold(catEggs);
    expect(row.imageUrl).toBeUndefined();
    expect(row.catalogId).toBe('cat-eggs');
    const withOverride = catalogIngredientToHousehold(catEggs, {
      imageUrl: 'https://example.com/user.png',
    });
    expect(withOverride.imageUrl).toBe('https://example.com/user.png');
  });
});

describe('F071 — Ingredient Manager list + modal', () => {
  it('shows row thumbnail from catalog fallback when household imageUrl is unset', async () => {
    const user = userEvent.setup();
    const h = makeHousehold([
      {
        id: 'i-eggs',
        name: 'eggs',
        category: 'protein',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        catalogId: 'cat-eggs',
        source: 'catalog',
      },
    ]);
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={['/household/h-f071/ingredients']}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    loadAllIngredientListRows();
    const thumb = screen.getByTestId('ingredient-list-thumb-i-eggs');
    expect(thumb).toHaveAttribute('src', catEggs.imageUrl!);
    expect(thumb).toHaveAttribute('loading', 'lazy');

    await user.click(screen.getByTestId('ingredient-row-i-eggs'));
    const modal = screen.getByTestId('ingredient-modal');
    expect(within(modal).getByTestId('ingredient-catalog-image-label')).toHaveTextContent(
      /From catalog/,
    );
    expect(within(modal).getByTestId('ingredient-catalog-image-preview')).toHaveAttribute(
      'src',
      catEggs.imageUrl!,
    );
    expect(within(modal).queryByTestId('ingredient-remove-custom-image')).not.toBeInTheDocument();
  });

  it('shows no row thumbnail when neither custom nor catalog image exists', () => {
    const h = makeHousehold([
      {
        id: 'i-lentils',
        name: 'lentils',
        category: 'protein',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        catalogId: 'cat-lentils',
        source: 'catalog',
      },
    ]);
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={['/household/h-f071/ingredients']}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    loadAllIngredientListRows();
    expect(screen.queryByTestId('ingredient-list-thumb-i-lentils')).not.toBeInTheDocument();
  });

  it('custom image overrides catalog; remove custom restores catalog preview', async () => {
    const user = userEvent.setup();
    const h = makeHousehold([
      {
        id: 'i-eggs',
        name: 'eggs',
        category: 'protein',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        catalogId: 'cat-eggs',
        source: 'catalog',
        imageUrl: 'https://example.com/override.png',
      },
    ]);
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={['/household/h-f071/ingredients']}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    loadAllIngredientListRows();
    const rowThumb = screen.getByTestId('ingredient-list-thumb-i-eggs');
    expect(rowThumb).toHaveAttribute('src', 'https://example.com/override.png');

    await user.click(screen.getByTestId('ingredient-row-i-eggs'));
    let modal = screen.getByTestId('ingredient-modal');
    expect(within(modal).getByTestId('ingredient-custom-image-label')).toBeInTheDocument();
    expect(within(modal).getByTestId('ingredient-image-preview')).toHaveAttribute(
      'src',
      'https://example.com/override.png',
    );
    await user.click(within(modal).getByTestId('ingredient-remove-custom-image'));

    modal = screen.getByTestId('ingredient-modal');
    expect(within(modal).getByTestId('ingredient-catalog-image-label')).toBeInTheDocument();
    expect(within(modal).getByTestId('ingredient-catalog-image-preview')).toHaveAttribute(
      'src',
      catEggs.imageUrl!,
    );
  });

  it('backward compatibility: explicit imageUrl without catalogId still shows preview and row thumb', async () => {
    const user = userEvent.setup();
    const h = makeHousehold([
      {
        id: 'i-legacy',
        name: 'mystery spice',
        category: 'pantry',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: false,
        source: 'manual',
        imageUrl: 'https://example.com/legacy.jpg',
      },
    ]);
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={['/household/h-f071/ingredients']}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    loadAllIngredientListRows();
    expect(screen.getByTestId('ingredient-list-thumb-i-legacy')).toHaveAttribute(
      'src',
      'https://example.com/legacy.jpg',
    );
    await user.click(screen.getByTestId('ingredient-row-i-legacy'));
    const modal = screen.getByTestId('ingredient-modal');
    expect(within(modal).getByTestId('ingredient-image-preview')).toHaveAttribute(
      'src',
      'https://example.com/legacy.jpg',
    );
  });
});

describe('F071 — Recipe import catalog suggestion thumbnail', () => {
  it('shows catalog image on suggestion without creating household ingredients', async () => {
    const user = userEvent.setup();
    const h = makeHousehold([]);
    saveHousehold(h);
    render(
      <MemoryRouter initialEntries={['/household/h-f071/import-recipe']}>
        <Routes>
          <Route path="/household/:householdId/import-recipe" element={<RecipeImport />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByTestId('import-recipe-text'), '1 cup flour');
    await user.click(screen.getByTestId('import-parse-btn'));
    expect(screen.getByTestId('import-review-step')).toBeInTheDocument();
    const thumb = screen.getByTestId('review-catalog-suggestion-thumb-0');
    expect(thumb).toHaveAttribute('src', catFlour.imageUrl!);
    expect(thumb).toHaveAttribute('loading', 'lazy');
  });
});

describe('F071 — Paprika import catalog suggestion thumbnail', () => {
  it('shows catalog image on pending catalog suggestion (no household ingredient materialized)', async () => {
    const hh = makeHousehold([]);
    saveHousehold(hh);
    const recipe: PaprikaRecipe = {
      name: 'Flour only',
      ingredients: '200g flour',
      directions: '',
      notes: '',
      source: '',
      source_url: '',
      prep_time: '',
      cook_time: '',
      total_time: '',
      difficulty: '',
      servings: '',
      categories: [],
      image_url: '',
      photo_data: null,
      uid: 'u1',
    };
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const pr = parsed[0]!;
    const adjusted = [
      {
        ...pr,
        selected: true,
        parsedLines: pr.parsedLines.map((line) =>
          line.name.toLowerCase().includes('flour')
            ? {
                ...line,
                action: 'create' as const,
                status: 'catalog' as const,
                matchedCatalog: catFlour,
                matchedIngredient: null,
                resolutionStatus: 'pending' as const,
                confidenceBand: 'low' as const,
              }
            : line,
        ),
      },
    ];
    saveImportSession({
      householdId: 'h-f071',
      parsedRecipes: adjusted,
      step: 'review',
      savedAt: new Date().toISOString(),
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-f071/import-paprika']}>
        <App />
      </MemoryRouter>,
    );
    for (const id of ['tier-confirm-toggle', 'tier-create-toggle', 'tier-check-toggle'] as const) {
      const btn = screen.queryByTestId(id);
      if (btn?.getAttribute('aria-expanded') === 'false') {
        await user.click(btn);
      }
    }
    const thumb = screen.getByTestId('review-group-catalog-suggestion-thumb-0');
    expect(thumb).toHaveAttribute('src', catFlour.imageUrl!);
    expect(thumb).toHaveAttribute('loading', 'lazy');
  });
});
