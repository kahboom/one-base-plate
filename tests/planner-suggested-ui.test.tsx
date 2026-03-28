import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { BaseMeal, Household, HouseholdMember, Ingredient } from '../src/types';
import { saveHousehold } from '../src/storage';
import Planner from '../src/pages/Planner';

const ingredients: Ingredient[] = [
  {
    id: 'ing-x',
    name: 'protein x',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
];

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
];

function makeMeal(i: number): BaseMeal {
  return {
    id: `meal-${i}`,
    name: `Meal ${i}`,
    components: [{ ingredientId: 'ing-x', role: 'protein', quantity: '1' }],
    defaultPrep: '',
    estimatedTimeMinutes: 20 + (i % 40),
    difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
    rescueEligible: false,
    wasteReuseHints: [],
  };
}

function seedLargeHousehold(mealCount: number): Household {
  const h: Household = {
    id: 'h-planner-many',
    name: 'Large library',
    members,
    ingredients,
    baseMeals: Array.from({ length: mealCount }, (_, i) => makeMeal(i)),
    weeklyPlans: [],
  };
  saveHousehold(h);
  return h;
}

function renderPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/planner`]}>
      <Routes>
        <Route path="/household/:householdId/planner" element={<Planner />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockTrayViewport(variant: 'mobile' | 'tablet' | 'desktop') {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches:
      variant === 'desktop'
        ? query === '(min-width: 1024px)' || query === '(min-width: 640px)'
        : variant === 'tablet'
          ? query === '(min-width: 640px)'
          : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  mockTrayViewport('desktop');
});

describe('Meal Planner suggested tray (capped + browse)', () => {
  it('renders at most 8 cards in meal-card-grid on desktop for large libraries', () => {
    seedLargeHousehold(80);
    renderPlanner('h-planner-many');
    const grid = screen.getByTestId('meal-card-grid');
    const cards = within(grid).queryAllByTestId(/^meal-card-/);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(8);
    expect(screen.getByTestId('meal-planner-tray-summary')).toHaveTextContent(/Top \d+ of 80/);
  });

  it('opens browse all, loads more incrementally, and selecting from browse updates the plan panel', async () => {
    const user = userEvent.setup();
    seedLargeHousehold(50);
    renderPlanner('h-planner-many');
    await user.click(screen.getByTestId('meal-planner-browse-all-btn'));
    const modal = screen.getByTestId('browse-meals-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByTestId('browse-meals-load-more')).toBeEnabled();
    await user.click(within(modal).getByTestId('browse-meals-load-more'));
    const grid = within(modal).getByTestId('browse-meals-grid');
    const firstId = within(grid)
      .getAllByTestId(/^meal-card-/)[0]
      ?.getAttribute('data-testid');
    expect(firstId).toMatch(/^meal-card-/);
    const mealId = firstId!.replace('meal-card-', '');
    await user.click(screen.getByTestId(`browse-selectable-${mealId}`));
    expect(screen.getByTestId('meal-plan')).toBeInTheDocument();
  });

  it('filters browse list by effort', async () => {
    const user = userEvent.setup();
    seedLargeHousehold(30);
    renderPlanner('h-planner-many');
    await user.click(screen.getByTestId('meal-planner-browse-all-btn'));
    const modal = screen.getByTestId('browse-meals-modal');
    const before = within(modal).getByTestId('browse-meals-count').textContent ?? '';
    await user.selectOptions(within(modal).getByTestId('browse-meals-effort-filter'), 'easy');
    const after = within(modal).getByTestId('browse-meals-count').textContent ?? '';
    expect(after).not.toBe(before);
  });

  it('filters browse list by search', async () => {
    const user = userEvent.setup();
    const h = seedLargeHousehold(20);
    h.baseMeals[7] = { ...h.baseMeals[7]!, name: 'UniquePlannerBrowseMeal' };
    saveHousehold(h);
    renderPlanner('h-planner-many');
    await user.click(screen.getByTestId('meal-planner-browse-all-btn'));
    const modal = screen.getByTestId('browse-meals-modal');
    await user.type(within(modal).getByTestId('browse-meals-search'), 'UniquePlannerBrowseMeal');
    const grid = within(modal).getByTestId('browse-meals-grid');
    expect(within(grid).getAllByTestId(/^meal-card-/).length).toBe(1);
  });
});
