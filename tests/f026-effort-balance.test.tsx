import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, BaseMeal, Ingredient, HouseholdMember, DayPlan } from '../src/types';
import { saveHousehold } from '../src/storage';
import { computeWeekEffortBalance } from '../src/planner';
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
    id: 'ing-steak',
    name: 'steak',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: false,
  },
];

const mealEasy: BaseMeal = {
  id: 'meal-easy',
  name: 'Quick Pasta',
  components: [
    { ingredientId: 'ing-pasta', role: 'carb', quantity: '400g' },
    { ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' },
  ],
  defaultPrep: 'Cook pasta',
  estimatedTimeMinutes: 15,
  difficulty: 'easy',
  rescueEligible: true,
  wasteReuseHints: [],
};

const mealMedium: BaseMeal = {
  id: 'meal-medium',
  name: 'Rice Bowl',
  components: [
    { ingredientId: 'ing-rice', role: 'carb', quantity: '300g' },
    { ingredientId: 'ing-salmon', role: 'protein', quantity: '400g' },
  ],
  defaultPrep: 'Cook rice and salmon',
  estimatedTimeMinutes: 35,
  difficulty: 'medium',
  rescueEligible: false,
  wasteReuseHints: [],
};

const mealHard: BaseMeal = {
  id: 'meal-hard',
  name: 'Steak Dinner',
  components: [
    { ingredientId: 'ing-steak', role: 'protein', quantity: '500g' },
    { ingredientId: 'ing-rice', role: 'carb', quantity: '300g' },
  ],
  defaultPrep: 'Grill steak, cook rice',
  estimatedTimeMinutes: 60,
  difficulty: 'hard',
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

function seedHousehold(meals: BaseMeal[] = [mealEasy, mealMedium, mealHard]): Household {
  const household: Household = {
    id: 'h-effort',
    name: 'Effort Test Family',
    members,
    ingredients,
    baseMeals: meals,
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
});

describe('F026: computeWeekEffortBalance engine', () => {
  it('counts effort levels correctly', () => {
    const days: DayPlan[] = [
      { day: 'Monday', baseMealId: 'meal-easy', variants: [] },
      { day: 'Tuesday', baseMealId: 'meal-medium', variants: [] },
      { day: 'Wednesday', baseMealId: 'meal-hard', variants: [] },
      { day: 'Thursday', baseMealId: 'meal-easy', variants: [] },
    ];
    const balance = computeWeekEffortBalance(days, [mealEasy, mealMedium, mealHard]);
    expect(balance.effortCounts).toEqual({ easy: 2, medium: 1, hard: 1 });
  });

  it('sums total prep time', () => {
    const days: DayPlan[] = [
      { day: 'Monday', baseMealId: 'meal-easy', variants: [] },
      { day: 'Tuesday', baseMealId: 'meal-hard', variants: [] },
    ];
    const balance = computeWeekEffortBalance(days, [mealEasy, mealHard]);
    expect(balance.totalPrepMinutes).toBe(75); // 15 + 60
  });

  it('identifies high-effort days', () => {
    const days: DayPlan[] = [
      { day: 'Monday', baseMealId: 'meal-easy', variants: [] },
      { day: 'Wednesday', baseMealId: 'meal-hard', variants: [] },
      { day: 'Friday', baseMealId: 'meal-hard', variants: [] },
    ];
    const balance = computeWeekEffortBalance(days, [mealEasy, mealHard]);
    expect(balance.highEffortDays).toEqual(['Wednesday', 'Friday']);
  });

  it('returns empty high-effort days when all meals are easy', () => {
    const days: DayPlan[] = [
      { day: 'Monday', baseMealId: 'meal-easy', variants: [] },
      { day: 'Tuesday', baseMealId: 'meal-easy', variants: [] },
    ];
    const balance = computeWeekEffortBalance(days, [mealEasy]);
    expect(balance.highEffortDays).toEqual([]);
    expect(balance.effortCounts.hard).toBe(0);
  });
});

describe('F026: Effort balance summary bar in WeeklyPlanner', () => {
  it('shows effort balance bar after generating a plan', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-effort');

    await user.click(screen.getByTestId('generate-btn'));

    expect(screen.getByTestId('effort-balance')).toBeInTheDocument();
    expect(screen.getByTestId('total-prep-time')).toBeInTheDocument();
    expect(screen.getByText(/min total/)).toBeInTheDocument();
  });

  it('does not show effort balance when no plan exists', () => {
    seedHousehold();
    renderWeeklyPlanner('h-effort');

    expect(screen.queryByTestId('effort-balance')).not.toBeInTheDocument();
  });

  it('displays effort count chips', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-effort');

    await user.click(screen.getByTestId('generate-btn'));

    const balanceBar = screen.getByTestId('effort-balance');
    // At least one effort chip should be present
    const hasChip =
      within(balanceBar).queryByTestId('effort-easy') ||
      within(balanceBar).queryByTestId('effort-medium') ||
      within(balanceBar).queryByTestId('effort-hard');
    expect(hasChip).toBeTruthy();
  });
});

describe('F026: Day cards show effort labels and prep time', () => {
  it('shows effort chip on assigned day cards', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-effort');

    await user.click(screen.getByTestId('generate-btn'));

    const monday = screen.getByTestId('day-monday');
    const effortChip = within(monday).queryByTestId('effort-monday');
    expect(effortChip).toBeInTheDocument();
    // Should contain one of the effort labels
    const text = effortChip!.textContent!;
    expect(['Low effort', 'Medium effort', 'Higher effort']).toContain(text);
  });

  it('shows prep time on assigned day cards', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-effort');

    await user.click(screen.getByTestId('generate-btn'));

    const monday = screen.getByTestId('day-monday');
    const prepTime = within(monday).queryByTestId('prep-time-monday');
    expect(prepTime).toBeInTheDocument();
    expect(prepTime!.textContent).toMatch(/\d+ min/);
  });
});

describe('F026: High-effort day highlighting', () => {
  it('warns about high-effort days in the balance bar', async () => {
    seedHousehold([mealHard]);
    const user = userEvent.setup();
    renderWeeklyPlanner('h-effort');

    await user.click(screen.getByTestId('generate-btn'));

    const warning = screen.queryByTestId('high-effort-warning');
    expect(warning).toBeInTheDocument();
    expect(warning!.textContent).toMatch(/Higher effort:/);
  });
});

describe('F026: Rebalancing from Weekly Planner', () => {
  it('users can clear a high-effort day and reassign from tray', async () => {
    seedHousehold([mealEasy, mealHard]);
    const user = userEvent.setup();
    renderWeeklyPlanner('h-effort');

    // Assign hard meal to Monday via tap-to-assign
    const tray = screen.getByTestId('suggested-tray');
    // Find the hard meal's assign button
    const hardCard = within(tray).getByTestId('meal-card-meal-hard');
    const assignBtn = within(hardCard).getByText('Assign');
    await user.click(assignBtn);
    const monday = screen.getByTestId('day-monday');
    await user.click(monday);

    // Monday should have the hard meal
    expect(within(monday).getByText('Steak Dinner')).toBeInTheDocument();

    // Clear Monday
    await user.click(screen.getByTestId('clear-monday'));

    // Monday should now be empty
    expect(within(monday).queryByText('Steak Dinner')).not.toBeInTheDocument();

    // Reassign easy meal to Monday
    const easyCard = within(tray).getByTestId('meal-card-meal-easy');
    const easyAssignBtn = within(easyCard).getByText('Assign');
    await user.click(easyAssignBtn);
    await user.click(monday);

    // Monday should now have the easy meal
    expect(within(monday).getByText('Quick Pasta')).toBeInTheDocument();
    const effortChip = within(monday).getByTestId('effort-monday');
    expect(effortChip).toHaveTextContent('Low effort');
  });

  it('effort balance updates when meals are swapped', async () => {
    seedHousehold([mealEasy, mealHard]);
    const user = userEvent.setup();
    renderWeeklyPlanner('h-effort');

    // Assign hard meal to Monday
    const tray = screen.getByTestId('suggested-tray');
    const hardCard = within(tray).getByTestId('meal-card-meal-hard');
    await user.click(within(hardCard).getByText('Assign'));
    await user.click(screen.getByTestId('day-monday'));

    // Should have effort balance with hard
    let balanceBar = screen.getByTestId('effort-balance');
    expect(within(balanceBar).getByTestId('effort-hard')).toHaveTextContent('1 hard');

    // Now swap Monday to easy via tap-assign
    const easyCard = within(tray).getByTestId('meal-card-meal-easy');
    await user.click(within(easyCard).getByText('Assign'));
    await user.click(screen.getByTestId('day-monday'));

    // Balance should now show easy, not hard
    balanceBar = screen.getByTestId('effort-balance');
    expect(within(balanceBar).getByTestId('effort-easy')).toHaveTextContent('1 easy');
    expect(within(balanceBar).queryByTestId('effort-hard')).not.toBeInTheDocument();
  });
});
