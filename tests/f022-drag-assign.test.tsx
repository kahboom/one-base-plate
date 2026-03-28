import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, BaseMeal, Ingredient, HouseholdMember } from '../src/types';
import { saveHousehold } from '../src/storage';
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
    name: 'chicken breast',
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
];

const mealPasta: BaseMeal = {
  id: 'meal-pasta',
  name: 'Pasta with chicken',
  components: [
    { ingredientId: 'ing-pasta', role: 'carb', quantity: '400g' },
    { ingredientId: 'ing-chicken', role: 'protein', quantity: '500g' },
  ],
  defaultPrep: 'Cook pasta and chicken',
  estimatedTimeMinutes: 30,
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
  ],
  defaultPrep: 'Cook rice and salmon',
  estimatedTimeMinutes: 25,
  difficulty: 'easy',
  rescueEligible: false,
  wasteReuseHints: [],
};

const members: HouseholdMember[] = [
  {
    id: 'm-alex',
    name: 'Alex',
    role: 'adult',
    safeFoods: ['pasta'],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'regular',
    allergens: [],
    notes: '',
  },
  {
    id: 'm-riley',
    name: 'Riley',
    role: 'toddler',
    safeFoods: ['pasta', 'rice'],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'soft',
    allergens: [],
    notes: '',
  },
];

function seedHousehold(): Household {
  const household: Household = {
    id: 'h-drag',
    name: 'Drag Test Family',
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
});

describe('F022: Suggested tray shows meal cards with assign buttons', () => {
  it('displays suggested meal cards in tray', () => {
    seedHousehold();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    expect(within(tray).getByText('Pasta with chicken')).toBeInTheDocument();
    expect(within(tray).getByText('Rice with salmon')).toBeInTheDocument();
  });

  it('meal cards in tray have Assign buttons', () => {
    seedHousehold();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    expect(assignButtons.length).toBe(2);
  });

  it('meal cards in tray are draggable', () => {
    seedHousehold();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    const pastaCard = within(tray).getByTestId('meal-card-meal-pasta');
    expect(pastaCard).toHaveAttribute('draggable', 'true');
  });
});

describe('F022: Tap-to-assign flow', () => {
  it('clicking Assign on a meal shows assign prompt', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    await user.click(assignButtons[0]!);

    expect(screen.getByTestId('assign-prompt')).toBeInTheDocument();
    expect(screen.getByTestId('assign-prompt')).toHaveTextContent(/Tap a day to assign/);
  });

  it('tapping a day card assigns the selected meal', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    await user.click(assignButtons[0]!);

    const monday = screen.getByTestId('day-monday');
    await user.click(monday);

    // Monday should now show the assigned meal
    expect(within(monday).queryByTestId('empty-monday')).not.toBeInTheDocument();
    // The first meal (sorted by overlap) should be assigned
    const hasMeal =
      within(monday).queryByText('Pasta with chicken') ||
      within(monday).queryByText('Rice with salmon');
    expect(hasMeal).toBeTruthy();
  });

  it('assign prompt disappears after assignment', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    await user.click(assignButtons[0]!);
    expect(screen.getByTestId('assign-prompt')).toBeInTheDocument();

    const monday = screen.getByTestId('day-monday');
    await user.click(monday);

    expect(screen.queryByTestId('assign-prompt')).not.toBeInTheDocument();
  });

  it('cancel button clears selection', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    await user.click(assignButtons[0]!);
    expect(screen.getByTestId('assign-prompt')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('assign-prompt')).not.toBeInTheDocument();
  });

  it('assigns meal to an already-filled day (swap)', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    // Generate a plan first
    await user.click(screen.getByTestId('generate-btn'));

    const monday = screen.getByTestId('day-monday');
    // Now tap-assign the other meal to Monday
    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    // Click the second meal's assign button
    await user.click(assignButtons[1]!);
    await user.click(monday);

    // Monday should still have a meal (potentially swapped)
    expect(within(monday).queryByTestId('empty-monday')).not.toBeInTheDocument();
  });
});

describe('F022: Drag and drop', () => {
  it('dragging a meal card onto a day assigns it', () => {
    seedHousehold();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    const pastaCard = within(tray).getByTestId('meal-card-meal-pasta');
    const monday = screen.getByTestId('day-monday');

    // Simulate drag and drop
    fireEvent.dragStart(pastaCard, {
      dataTransfer: { setData: () => {}, effectAllowed: 'move' },
    });

    const dataTransfer = {
      getData: () => 'meal-pasta',
      dropEffect: 'move',
    };

    fireEvent.dragOver(monday, { dataTransfer });
    fireEvent.drop(monday, { dataTransfer });

    // Monday should now show Pasta with chicken
    expect(within(monday).getByText('Pasta with chicken')).toBeInTheDocument();
    expect(within(monday).queryByTestId('empty-monday')).not.toBeInTheDocument();
  });

  it('dropping on an already-filled day replaces the meal', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    // Generate plan so days are filled
    await user.click(screen.getByTestId('generate-btn'));

    const monday = screen.getByTestId('day-monday');

    // Drop rice meal onto Monday
    const dataTransfer = {
      getData: () => 'meal-rice',
      dropEffect: 'move',
    };

    fireEvent.dragOver(monday, { dataTransfer });
    fireEvent.drop(monday, { dataTransfer });

    expect(within(monday).getByText('Rice with salmon')).toBeInTheDocument();
  });
});

describe('F022: Plan updates immediately', () => {
  it('assigned meal generates per-person variants', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    // Tap-assign a meal to Monday
    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    await user.click(assignButtons[0]!);

    const monday = screen.getByTestId('day-monday');
    await user.click(monday);

    // Expand to see variants
    await user.click(screen.getByTestId('toggle-monday'));

    const details = screen.getByTestId('details-monday');
    expect(within(details).getByText(/Alex/)).toBeInTheDocument();
    expect(within(details).getByText(/Riley/)).toBeInTheDocument();
  });

  it('save button appears after assignment', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    // No save button initially
    expect(screen.queryByTestId('save-plan-btn')).not.toBeInTheDocument();

    // Tap-assign a meal
    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    await user.click(assignButtons[0]!);

    const monday = screen.getByTestId('day-monday');
    await user.click(monday);

    // Save button should appear
    expect(screen.getByTestId('save-plan-btn')).toBeInTheDocument();
  });

  it('day cards show assign-target styling when a meal is selected', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner('h-drag');

    const tray = screen.getByTestId('suggested-tray');
    const assignButtons = within(tray).getAllByText('Assign');
    await user.click(assignButtons[0]!);

    const monday = screen.getByTestId('day-monday');
    expect(monday).toHaveAttribute('role', 'button');
  });
});
