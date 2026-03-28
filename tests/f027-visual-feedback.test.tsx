import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, BaseMeal, Ingredient, HouseholdMember, DayPlan } from '../src/types';
import { saveHousehold } from '../src/storage';
import { computeGroceryPreview } from '../src/planner';
import WeeklyPlanner from '../src/pages/WeeklyPlanner';

const ingredients: Ingredient[] = [
  {
    id: 'ing-pasta',
    name: 'pasta',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-chicken',
    name: 'chicken',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-rice',
    name: 'rice',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-salmon',
    name: 'salmon',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-broccoli',
    name: 'broccoli',
    category: 'veg',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
];

const mealPasta: BaseMeal = {
  id: 'meal-pasta',
  name: 'Pasta with chicken',
  components: [
    { ingredientId: 'ing-pasta', role: 'carb', quantity: '400g' },
    { ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' },
  ],
  defaultPrep: 'Cook pasta and chicken',
  estimatedTimeMinutes: 25,
  difficulty: 'easy',
  rescueEligible: true,
  wasteReuseHints: [],
};

const mealRice: BaseMeal = {
  id: 'meal-rice',
  name: 'Rice with salmon',
  components: [
    { ingredientId: 'ing-rice', role: 'carb', quantity: '300g' },
    { ingredientId: 'ing-salmon', role: 'protein', quantity: '400g' },
    { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
  ],
  defaultPrep: 'Cook rice and salmon',
  estimatedTimeMinutes: 35,
  difficulty: 'medium',
  rescueEligible: false,
  wasteReuseHints: [],
};

const members: HouseholdMember[] = [
  {
    id: 'm-a',
    name: 'Alex',
    role: 'adult',
    safeFoods: ['pasta'],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'regular',
    allergens: [],
    notes: '',
  },
];

function seedHousehold(): Household {
  const household: Household = {
    id: 'h-feedback',
    name: 'Feedback Test Family',
    members,
    ingredients,
    baseMeals: [mealPasta, mealRice],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderWeeklyPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/weekly`]}>
      <Routes>
        <Route path="/household/:householdId/weekly" element={<WeeklyPlanner />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe('F027: computeGroceryPreview engine', () => {
  it('counts unique ingredients across the week', () => {
    const days: DayPlan[] = [
      { day: 'Monday', baseMealId: 'meal-pasta', variants: [] },
      { day: 'Tuesday', baseMealId: 'meal-rice', variants: [] },
    ];
    const preview = computeGroceryPreview(days, [mealPasta, mealRice], ingredients);
    // pasta, chicken, rice, salmon, broccoli = 5
    expect(preview.uniqueIngredientCount).toBe(5);
  });

  it('does not double-count shared ingredients', () => {
    const days: DayPlan[] = [
      { day: 'Monday', baseMealId: 'meal-pasta', variants: [] },
      { day: 'Tuesday', baseMealId: 'meal-pasta', variants: [] },
    ];
    const preview = computeGroceryPreview(days, [mealPasta], ingredients);
    // pasta, chicken = 2 (not 4)
    expect(preview.uniqueIngredientCount).toBe(2);
  });

  it('breaks down by category', () => {
    const days: DayPlan[] = [
      { day: 'Monday', baseMealId: 'meal-pasta', variants: [] },
      { day: 'Tuesday', baseMealId: 'meal-rice', variants: [] },
    ];
    const preview = computeGroceryPreview(days, [mealPasta, mealRice], ingredients);
    expect(preview.categoryBreakdown.carb).toBe(2);
    expect(preview.categoryBreakdown.protein).toBe(2);
    expect(preview.categoryBreakdown.veg).toBe(1);
  });
});

describe('F027: Confirmation animation on assignment', () => {
  it('shows confirmation overlay on tap-to-assign', async () => {
    vi.useRealTimers();
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-feedback');

    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    await user.click(assignButtons[0]!);

    const monday = screen.getByTestId('day-monday');
    await user.click(monday);

    // Confirmation should appear briefly
    expect(screen.getByTestId('confirm-monday')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-monday')).toHaveTextContent('Meal added');
  });

  it('shows confirmation overlay on drag-and-drop', () => {
    seedHousehold();
    renderWeeklyPlanner('h-feedback');

    const monday = screen.getByTestId('day-monday');
    const dataTransfer = { getData: () => 'meal-pasta', dropEffect: 'move' };

    fireEvent.dragOver(monday, { dataTransfer });
    fireEvent.drop(monday, { dataTransfer });

    expect(screen.getByTestId('confirm-monday')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-monday')).toHaveTextContent('Meal added');
  });

  it('confirmation disappears after animation completes', async () => {
    seedHousehold();
    renderWeeklyPlanner('h-feedback');

    const monday = screen.getByTestId('day-monday');
    const dataTransfer = { getData: () => 'meal-pasta', dropEffect: 'move' };

    fireEvent.dragOver(monday, { dataTransfer });
    fireEvent.drop(monday, { dataTransfer });

    expect(screen.getByTestId('confirm-monday')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(screen.queryByTestId('confirm-monday')).not.toBeInTheDocument();
  });

  it('day card has the animate-meal-assigned CSS class during confirmation', () => {
    seedHousehold();
    renderWeeklyPlanner('h-feedback');

    const monday = screen.getByTestId('day-monday');
    const dataTransfer = { getData: () => 'meal-pasta', dropEffect: 'move' };

    fireEvent.dragOver(monday, { dataTransfer });
    fireEvent.drop(monday, { dataTransfer });

    const confirm = screen.getByTestId('confirm-monday');
    expect(confirm.className).toContain('animate-meal-assigned');
  });
});

describe('F027: Grocery preview updates on plan changes', () => {
  it('shows grocery preview after generating a plan', async () => {
    vi.useRealTimers();
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-feedback');

    await user.click(screen.getByTestId('generate-btn'));

    expect(screen.getByTestId('grocery-preview')).toBeInTheDocument();
    expect(screen.getByTestId('grocery-count')).toBeInTheDocument();
    expect(screen.getByTestId('grocery-count').textContent).toMatch(/\d+ ingredients?/);
  });

  it('no grocery preview when no plan exists', () => {
    seedHousehold();
    renderWeeklyPlanner('h-feedback');

    expect(screen.queryByTestId('grocery-preview')).not.toBeInTheDocument();
  });

  it('grocery preview updates when a meal is assigned', async () => {
    vi.useRealTimers();
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-feedback');

    // Assign pasta to Monday (2 ingredients)
    const tray = screen.getByTestId('suggested-tray');
    const pastaCard = within(tray).getByTestId('meal-card-meal-pasta');
    await user.click(within(pastaCard).getByText('Assign'));
    await user.click(screen.getByTestId('day-monday'));

    const count1 = screen.getByTestId('grocery-count').textContent;
    expect(count1).toBe('2 ingredients');

    // Now assign rice meal to Tuesday (adds 3 new ingredients: rice, salmon, broccoli)
    const riceCard = within(tray).getByTestId('meal-card-meal-rice');
    await user.click(within(riceCard).getByText('Assign'));
    await user.click(screen.getByTestId('day-tuesday'));

    const count2 = screen.getByTestId('grocery-count').textContent;
    expect(count2).toBe('5 ingredients');
  });

  it('grocery preview shows category breakdown chips', async () => {
    vi.useRealTimers();
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-feedback');

    await user.click(screen.getByTestId('generate-btn'));

    const preview = screen.getByTestId('grocery-preview');
    // Should have at least one category chip
    const hasCategoryChip =
      within(preview).queryByTestId('grocery-cat-carb') ||
      within(preview).queryByTestId('grocery-cat-protein');
    expect(hasCategoryChip).toBeTruthy();
  });
});

describe('F027: Feedback is subtle and responsive', () => {
  it('day card uses scale transition during justAssigned state', () => {
    seedHousehold();
    renderWeeklyPlanner('h-feedback');

    const monday = screen.getByTestId('day-monday');
    const dataTransfer = { getData: () => 'meal-pasta', dropEffect: 'move' };

    fireEvent.dragOver(monday, { dataTransfer });
    fireEvent.drop(monday, { dataTransfer });

    // During justAssigned, card should have the brand highlight and scale
    expect(monday.className).toContain('border-brand');
    expect(monday.className).toContain('scale-');
  });

  it('justAssigned styling reverts after timeout', () => {
    seedHousehold();
    renderWeeklyPlanner('h-feedback');

    const monday = screen.getByTestId('day-monday');
    const dataTransfer = { getData: () => 'meal-pasta', dropEffect: 'move' };

    fireEvent.dragOver(monday, { dataTransfer });
    fireEvent.drop(monday, { dataTransfer });

    expect(monday.className).toContain('scale-');

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(monday.className).not.toContain('scale-');
  });
});
