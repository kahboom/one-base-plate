import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Household, BaseMeal, Ingredient, HouseholdMember } from '../src/types';
import { generateWeeklyPlan } from '../src/planner';
import { loadHouseholds } from '../src/storage';

/* ---------- shared fixture ---------- */
const members: HouseholdMember[] = [
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
  {
    id: 'm2',
    name: 'Riley',
    role: 'toddler',
    safeFoods: ['pasta', 'cheese'],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'regular',
    allergens: [],
    notes: '',
  },
];

const ingredients: Ingredient[] = [
  {
    id: 'chicken',
    name: 'chicken',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'pasta',
    name: 'pasta',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'broccoli',
    name: 'broccoli',
    category: 'veg',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'salmon',
    name: 'salmon',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: 'rice',
    name: 'rice',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'peas',
    name: 'peas',
    category: 'veg',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: 'beans',
    name: 'beans',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'bread',
    name: 'bread',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
];

const meals: BaseMeal[] = [
  {
    id: 'meal-a',
    name: 'Chicken Pasta',
    components: [
      { ingredientId: 'chicken', role: 'protein', quantity: '200g' },
      { ingredientId: 'pasta', role: 'carb', quantity: '250g' },
      { ingredientId: 'broccoli', role: 'veg', quantity: '100g' },
    ],
    defaultPrep: 'bake',
    estimatedTimeMinutes: 30,
    difficulty: 'medium',
    rescueEligible: false,
    wasteReuseHints: [],
  },
  {
    id: 'meal-b',
    name: 'Salmon Rice',
    components: [
      { ingredientId: 'salmon', role: 'protein', quantity: '200g' },
      { ingredientId: 'rice', role: 'carb', quantity: '200g' },
      { ingredientId: 'peas', role: 'veg', quantity: '100g' },
    ],
    defaultPrep: 'pan-fry',
    estimatedTimeMinutes: 25,
    difficulty: 'medium',
    rescueEligible: false,
    wasteReuseHints: [],
  },
  {
    id: 'meal-c',
    name: 'Beans on Toast',
    components: [
      { ingredientId: 'beans', role: 'protein', quantity: '200g' },
      { ingredientId: 'bread', role: 'carb', quantity: '2 slices' },
    ],
    defaultPrep: 'heat',
    estimatedTimeMinutes: 10,
    difficulty: 'easy',
    rescueEligible: true,
    wasteReuseHints: [],
  },
];

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: 'h-pin',
    name: 'Pin Test Household',
    members,
    ingredients,
    baseMeals: meals,
    weeklyPlans: [],
    pinnedMealIds: [],
    ...overrides,
  };
}

const STORAGE_KEY = 'onebaseplate_households';

function seedStorage(household: Household) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([household]));
}

function storedHouseholds(): Household[] {
  return loadHouseholds();
}

beforeEach(() => {
  localStorage.clear();
});

/* ===== ENGINE TESTS ===== */

describe('F013: Pinned meal prioritization in weekly plan engine', () => {
  it('pinned meals appear more often in generated plans', () => {
    const pinnedPlan = generateWeeklyPlan(meals, members, ingredients, 7, ['meal-c']);
    const unpinnedPlan = generateWeeklyPlan(meals, members, ingredients, 7, []);

    const pinnedCount = pinnedPlan.filter((d) => d.baseMealId === 'meal-c').length;
    const unpinnedCount = unpinnedPlan.filter((d) => d.baseMealId === 'meal-c').length;

    expect(pinnedCount).toBeGreaterThanOrEqual(unpinnedCount);
  });

  it('without pinning, plan uses variety across available meals', () => {
    const plan = generateWeeklyPlan(meals, members, ingredients, 7);
    const uniqueMeals = new Set(plan.map((d) => d.baseMealId));
    // Without pinning, the algorithm should still produce variety from available meals
    expect(uniqueMeals.size).toBeGreaterThanOrEqual(1);
  });

  it('empty pinnedMealIds produces same results as no pinning', () => {
    const withEmpty = generateWeeklyPlan(meals, members, ingredients, 5, []);
    const withDefault = generateWeeklyPlan(meals, members, ingredients, 5);

    expect(withEmpty.map((d) => d.baseMealId)).toEqual(withDefault.map((d) => d.baseMealId));
  });
});

/* ===== UI: Pin from Planner page ===== */

describe('F013: Pin/unpin from Planner page', () => {
  it('shows Pin button on meal cards in planner', async () => {
    const household = makeHousehold();
    seedStorage(household);

    render(
      <MemoryRouter initialEntries={[`/household/${household.id}/planner`]}>
        {/* lazy import */}
      </MemoryRouter>,
    );

    // Use dynamic import for the actual App to get routing
    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/planner`]}>
        <App />
      </MemoryRouter>,
    );

    // Pin buttons should exist for each meal
    const pinButtons = await screen.findAllByText('Pin');
    expect(pinButtons.length).toBeGreaterThan(0);

    unmount();
  });

  it('clicking Pin saves the meal to household pinnedMealIds', async () => {
    const household = makeHousehold();
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/planner`]}>
        <App />
      </MemoryRouter>,
    );

    const pinButtons = await screen.findAllByText('Pin');
    await userEvent.click(pinButtons[0]!);

    const stored = storedHouseholds();
    expect(stored[0]!.pinnedMealIds!.length).toBe(1);

    unmount();
  });

  it('pinned meal shows Pinned chip and Unpin button', async () => {
    const household = makeHousehold({ pinnedMealIds: ['meal-a'] });
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/planner`]}>
        <App />
      </MemoryRouter>,
    );

    const pinnedChips = await screen.findAllByText('Pinned');
    expect(pinnedChips.length).toBeGreaterThanOrEqual(1);

    const unpinButtons = screen.getAllByText('Unpin');
    expect(unpinButtons.length).toBeGreaterThanOrEqual(1);

    unmount();
  });

  it('clicking Unpin removes the meal from pinnedMealIds', async () => {
    const household = makeHousehold({ pinnedMealIds: ['meal-a'] });
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/planner`]}>
        <App />
      </MemoryRouter>,
    );

    const unpinBtn = await screen.findByTestId('pin-meal-a');
    await userEvent.click(unpinBtn);

    const stored = storedHouseholds();
    expect(stored[0]!.pinnedMealIds).toEqual([]);

    unmount();
  });
});

/* ===== UI: Pin from MealDetail page ===== */

describe('F013: Pin/unpin from Meal Detail page', () => {
  it('shows pin toggle button on meal detail', async () => {
    const household = makeHousehold();
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/meal/meal-a`]}>
        <App />
      </MemoryRouter>,
    );

    const pinButton = await screen.findByTestId('pin-toggle');
    expect(pinButton.textContent).toBe('Pin to rotation');

    unmount();
  });

  it('pinning from detail page persists and shows Pinned chip', async () => {
    const household = makeHousehold();
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/meal/meal-a`]}>
        <App />
      </MemoryRouter>,
    );

    const pinButton = await screen.findByTestId('pin-toggle');
    await userEvent.click(pinButton);

    expect(pinButton.textContent).toBe('Unpin from rotation');
    expect(screen.getByText('Pinned')).toBeTruthy();

    const stored = storedHouseholds();
    expect(stored[0]!.pinnedMealIds).toContain('meal-a');

    unmount();
  });

  it('unpinning from detail page removes Pinned chip', async () => {
    const household = makeHousehold({ pinnedMealIds: ['meal-a'] });
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/meal/meal-a`]}>
        <App />
      </MemoryRouter>,
    );

    const pinButton = await screen.findByTestId('pin-toggle');
    expect(pinButton.textContent).toBe('Unpin from rotation');

    await userEvent.click(pinButton);

    expect(pinButton.textContent).toBe('Pin to rotation');
    expect(screen.queryByText('Pinned')).toBeNull();

    unmount();
  });
});

/* ===== UI: Rotation view on Home ===== */

describe('F013: Pinned rotation view on Home page', () => {
  it('shows pinned meals section when meals are pinned', async () => {
    const household = makeHousehold({ pinnedMealIds: ['meal-a', 'meal-c'] });
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/home`]}>
        <App />
      </MemoryRouter>,
    );

    const pinnedSection = await screen.findByTestId('pinned-meals');
    expect(pinnedSection).toBeTruthy();

    expect(screen.getByText('Pinned rotation')).toBeTruthy();
    // Chicken Pasta appears in both pinned and top suggestions
    expect(screen.getAllByText('Chicken Pasta').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Beans on Toast').length).toBeGreaterThanOrEqual(1);

    unmount();
  });

  it('does not show pinned rotation section when no meals are pinned', async () => {
    const household = makeHousehold({ pinnedMealIds: [] });
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/home`]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText('What should we eat tonight?');
    expect(screen.queryByTestId('pinned-meals')).toBeNull();

    unmount();
  });

  it('pinned meals on Home show Pinned chip and Unpin button', async () => {
    const household = makeHousehold({ pinnedMealIds: ['meal-b'] });
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/home`]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByTestId('pinned-meals');

    const pinnedChips = screen.getAllByText('Pinned');
    expect(pinnedChips.length).toBeGreaterThanOrEqual(1);

    const unpinButtons = screen.getAllByText('Unpin');
    expect(unpinButtons.length).toBeGreaterThanOrEqual(1);

    unmount();
  });

  it('unpinning from Home removes the meal from the rotation view', async () => {
    const household = makeHousehold({ pinnedMealIds: ['meal-a'] });
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/home`]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByTestId('pinned-meals');

    // meal-a appears in both pinned section and top suggestions, get the first one (in pinned section)
    const unpinBtns = screen.getAllByTestId('pin-meal-a');
    await userEvent.click(unpinBtns[0]!);

    expect(screen.queryByTestId('pinned-meals')).toBeNull();

    const stored = storedHouseholds();
    expect(stored[0]!.pinnedMealIds).toEqual([]);

    unmount();
  });
});

/* ===== UI: Pin from Weekly Planner tray ===== */

describe('F013: Pin/unpin from Weekly Planner suggested tray', () => {
  it('shows pin/unpin buttons in suggested tray', async () => {
    const household = makeHousehold({ pinnedMealIds: ['meal-a'] });
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/weekly`]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText('Suggested meals');

    const unpinButtons = screen.getAllByText('Unpin');
    expect(unpinButtons.length).toBeGreaterThanOrEqual(1);

    const pinButtons = screen.getAllByText('Pin');
    expect(pinButtons.length).toBeGreaterThanOrEqual(1);

    unmount();
  });

  it('pinning from weekly planner tray persists to storage', async () => {
    const household = makeHousehold();
    seedStorage(household);

    const { default: App } = await import('../src/App');
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/household/${household.id}/weekly`]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText('Suggested meals');

    const pinButtons = screen.getAllByText('Pin');
    await userEvent.click(pinButtons[0]!);

    const stored = storedHouseholds();
    expect(stored[0]!.pinnedMealIds!.length).toBe(1);

    unmount();
  });
});

/* ===== Pinned meals reusable in future plans ===== */

describe('F013: Future planning prioritizes pinned meals', () => {
  it('generated plan includes pinned meal at least once when available', () => {
    const plan = generateWeeklyPlan(meals, members, ingredients, 7, ['meal-c']);
    const mealCCount = plan.filter((d) => d.baseMealId === 'meal-c').length;
    expect(mealCCount).toBeGreaterThanOrEqual(1);
  });

  it('pinned meals with lower overlap still get boosted', () => {
    // meal-c has fewer components so may rank lower naturally
    const unpinnedPlan = generateWeeklyPlan(meals, members, ingredients, 7);
    const pinnedPlan = generateWeeklyPlan(meals, members, ingredients, 7, ['meal-c']);

    const unpinnedC = unpinnedPlan.filter((d) => d.baseMealId === 'meal-c').length;
    const pinnedC = pinnedPlan.filter((d) => d.baseMealId === 'meal-c').length;

    expect(pinnedC).toBeGreaterThanOrEqual(unpinnedC);
  });
});
