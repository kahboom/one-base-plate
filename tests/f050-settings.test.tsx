import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { BaseMeal, Household, Recipe } from '../src/types';
import {
  loadHouseholds,
  saveHousehold,
  loadDefaultHouseholdId,
  saveDefaultHouseholdId,
  countSeedIngredientsForHousehold,
} from '../src/storage';
import { saveImportSession, loadImportSession } from '../src/paprika-parser';
import { applyThemeToDocument, loadThemePreference } from '../src/theme';
import { householdLayoutRouteBranch } from './householdLayoutRoutes';

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: 'h-settings',
    name: 'Settings Test',
    members: [],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  applyThemeToDocument(loadThemePreference());
});

function renderSettings(initialPath = '/household/h-settings/settings') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {householdLayoutRouteBranch}
        <Route path="/households" element={<div data-testid="households-page">Households</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('F050 — Settings page', () => {
  it('saves appearance theme to localStorage and document', async () => {
    saveHousehold(makeHousehold());
    renderSettings();

    await userEvent.click(screen.getByTestId('settings-theme-dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('onebaseplate-theme')).toBe('dark');

    await userEvent.click(screen.getByTestId('settings-theme-system'));
    expect(document.documentElement.dataset.theme).toBe('system');
    expect(localStorage.getItem('onebaseplate-theme')).toBe('system');
  });

  it('shows data actions and Paprika import', () => {
    saveHousehold(makeHousehold());
    renderSettings();

    expect(screen.getByTestId('settings-export-btn')).toBeInTheDocument();
    expect(screen.getByTestId('settings-import-btn')).toBeInTheDocument();
    expect(screen.getByTestId('settings-clear-base-meals-btn')).toBeInTheDocument();
    expect(screen.getByTestId('settings-clear-recipes-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-restore-seed-recipes-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-reset-seed-ingredients-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-clear-all-btn')).toBeInTheDocument();
    expect(screen.getByTestId('import-paprika-btn')).toBeInTheDocument();
  });

  it('clears households, default household id, and Paprika session after confirm', async () => {
    saveHousehold(makeHousehold());
    saveDefaultHouseholdId('h-settings');
    saveImportSession({
      householdId: 'h-settings',
      parsedRecipes: [],
      step: 'upload',
      savedAt: new Date().toISOString(),
    });

    renderSettings();

    await userEvent.click(screen.getByTestId('settings-clear-all-btn'));
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(loadHouseholds()).toEqual([]);
    expect(loadDefaultHouseholdId()).toBeNull();
    expect(loadImportSession('h-settings')).toBeNull();
    expect(screen.getByTestId('households-page')).toBeInTheDocument();
  });

  it('clears only base meals and plans for this household after confirm', async () => {
    const meal: BaseMeal = {
      id: 'm1',
      name: 'Test meal',
      components: [],
      defaultPrep: '',
      estimatedTimeMinutes: 30,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };
    const recipe: Recipe = { id: 'r1', name: 'Kept recipe', components: [] };
    saveHousehold(
      makeHousehold({
        recipes: [recipe],
        ingredients: [
          {
            id: 'i1',
            name: 'salt',
            category: 'pantry',
            tags: [],
            shelfLifeHint: '',
            freezerFriendly: false,
            babySafeWithAdaptation: true,
          },
        ],
        baseMeals: [meal],
        weeklyPlans: [
          {
            id: 'wp1',
            days: [{ day: 'Mon', baseMealId: 'm1', variants: [] }],
            selectedBaseMeals: ['m1'],
            generatedGroceryList: [],
            notes: '',
          },
        ],
        pinnedMealIds: ['m1'],
        mealOutcomes: [
          {
            id: 'o1',
            baseMealId: 'm1',
            day: 'Mon',
            outcome: 'success',
            notes: '',
            date: '2025-01-01',
          },
        ],
      }),
    );

    renderSettings();

    await userEvent.click(screen.getByTestId('settings-clear-base-meals-btn'));
    await userEvent.click(screen.getByRole('button', { name: 'Remove base meals' }));

    const h = loadHouseholds()[0]!;
    expect(h.baseMeals).toEqual([]);
    expect(h.weeklyPlans).toEqual([]);
    expect(h.pinnedMealIds).toEqual([]);
    expect(h.mealOutcomes).toEqual([]);
    expect(h.recipes).toEqual([recipe]);
    expect(h.ingredients).toHaveLength(1);
    expect(h.ingredients[0]!.name).toBe('salt');
  });

  it('clears only the recipe library after confirm', async () => {
    const recipe: Recipe = { id: 'r1', name: 'Gone recipe', components: [] };
    const meal: BaseMeal = {
      id: 'm1',
      name: 'Test meal',
      sourceRecipeId: 'r1',
      recipeRefs: [{ recipeId: 'r1', role: 'primary' }],
      components: [],
      defaultPrep: '',
      estimatedTimeMinutes: 30,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };
    saveHousehold(
      makeHousehold({
        recipes: [recipe],
        baseMeals: [meal],
        weeklyPlans: [],
      }),
    );

    renderSettings();

    await userEvent.click(screen.getByTestId('settings-clear-recipes-btn'));
    await userEvent.click(screen.getByRole('button', { name: 'Remove recipes' }));

    const h = loadHouseholds()[0]!;
    expect(h.recipes).toEqual([]);
    expect(h.baseMeals).toHaveLength(1);
    expect(h.baseMeals[0]!.id).toBe('m1');
    expect(h.baseMeals[0]!.name).toBe('Test meal');
    expect(h.baseMeals[0]!.sourceRecipeId).toBeUndefined();
    expect(h.baseMeals[0]!.recipeRefs).toBeUndefined();
  });

  it('shows restore seed recipes for household ids that ship with bundled seed recipes', () => {
    saveHousehold(makeHousehold({ id: 'H001', name: 'McG' }));
    renderSettings('/household/H001/settings');
    expect(screen.getByTestId('settings-restore-seed-recipes-btn')).toBeInTheDocument();
  });

  it('shows reset seed ingredients for household ids that ship with bundled seed ingredients', () => {
    saveHousehold(makeHousehold({ id: 'H001', name: 'McG' }));
    renderSettings('/household/H001/settings');
    expect(screen.getByTestId('settings-reset-seed-ingredients-btn')).toBeInTheDocument();
  });

  it('replaces ingredients with bundled defaults after confirm', async () => {
    const custom = {
      id: 'ing-custom-only',
      name: 'custom spice',
      category: 'pantry' as const,
      tags: [] as string[],
      shelfLifeHint: '',
      freezerFriendly: false,
      babySafeWithAdaptation: true,
    };
    saveHousehold(makeHousehold({ id: 'H001', name: 'McG', ingredients: [custom] }));
    renderSettings('/household/H001/settings');

    await userEvent.click(screen.getByTestId('settings-reset-seed-ingredients-btn'));
    await userEvent.click(screen.getByRole('button', { name: 'Reset ingredients' }));

    const h = loadHouseholds().find((x) => x.id === 'H001')!;
    expect(h.ingredients.some((i) => i.id === 'ing-custom-only')).toBe(false);
    expect(h.ingredients.some((i) => i.id === 'ing-pasta')).toBe(true);
    expect(h.ingredients).toHaveLength(countSeedIngredientsForHousehold('H001'));
  });
});
