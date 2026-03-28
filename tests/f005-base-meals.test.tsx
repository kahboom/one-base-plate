import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household } from '../src/types';
import { saveHousehold, loadHousehold } from '../src/storage';
import BaseMealManager from '../src/pages/BaseMealManager';

function seedHousehold(): Household {
  const household: Household = {
    id: 'h-meals',
    name: 'Meal Test Family',
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
    ingredients: [
      {
        id: 'ing-chicken',
        name: 'Chicken',
        category: 'protein',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: true,
        babySafeWithAdaptation: false,
      },
      {
        id: 'ing-rice',
        name: 'Rice',
        category: 'carb',
        tags: ['quick'],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
      },
      {
        id: 'ing-broccoli',
        name: 'Broccoli',
        category: 'veg',
        tags: ['mashable'],
        shelfLifeHint: '',
        freezerFriendly: true,
        babySafeWithAdaptation: true,
      },
    ],
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderBaseMealManager(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/meals`]}>
      <Routes>
        <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
      </Routes>
    </MemoryRouter>,
  );
}

function getMealModal() {
  return screen.getByTestId('meal-modal');
}

async function expandComponent(
  user: ReturnType<typeof userEvent.setup>,
  modal: HTMLElement,
  index: number,
) {
  const toggle = within(modal).getByTestId(`component-toggle-${index}`);
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    await user.click(toggle);
  }
}

async function addMeal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Add meal'));
  return getMealModal();
}

beforeEach(() => {
  localStorage.clear();
});

describe('F005: Create a base meal from components', () => {
  it('can create a meal with components from household ingredients', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');

    expect(screen.getByText('Meals (0)')).toBeInTheDocument();

    const modal = await addMeal(user);
    expect(screen.getByText('Meals (1)')).toBeInTheDocument();

    // Set meal name
    const nameInput = within(modal).getByPlaceholderText('Meal name');
    await user.type(nameInput, 'Chicken Rice Bowl');

    // Set default prep
    const prepInput = within(modal).getByPlaceholderText('e.g. stir-fry, roast');
    await user.type(prepInput, 'stir-fry');

    // Add components
    await user.click(within(modal).getByText('Add component'));
    await user.click(within(modal).getByText('Add component'));
    await user.click(within(modal).getByText('Add component'));

    expect(within(modal).getAllByTestId(/component-card-/)).toHaveLength(3);

    // Select ingredients for each component
    await expandComponent(user, modal, 0);
    await user.selectOptions(
      within(modal).getByTestId('component-card-0').querySelector('select')!,
      'ing-chicken',
    );
    await expandComponent(user, modal, 1);
    await user.selectOptions(
      within(modal).getByTestId('component-card-1').querySelector('select')!,
      'ing-rice',
    );
    await expandComponent(user, modal, 2);
    await user.selectOptions(
      within(modal).getByTestId('component-card-2').querySelector('select')!,
      'ing-broccoli',
    );

    // Set roles for components (second → carb, third → veg)
    await user.selectOptions(
      within(modal).getByTestId('component-card-1').querySelectorAll('select')[1]!,
      'carb',
    );
    await user.selectOptions(
      within(modal).getByTestId('component-card-2').querySelectorAll('select')[1]!,
      'veg',
    );

    // Auto-save persists; verify
    const saved = loadHousehold('h-meals')!;
    expect(saved.baseMeals).toHaveLength(1);
    const meal = saved.baseMeals[0]!;
    expect(meal.name).toBe('Chicken Rice Bowl');
    expect(meal.defaultPrep).toBe('stir-fry');
    expect(meal.components).toHaveLength(3);
    expect(meal.components[0]!.ingredientId).toBe('ing-chicken');
    expect(meal.components[0]!.role).toBe('protein');
    expect(meal.components[1]!.ingredientId).toBe('ing-rice');
    expect(meal.components[1]!.role).toBe('carb');
    expect(meal.components[2]!.ingredientId).toBe('ing-broccoli');
    expect(meal.components[2]!.role).toBe('veg');
  });
});

describe('F005: Set time and rescue eligibility metadata', () => {
  it('can set estimated time, difficulty, and rescue eligibility', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');

    const modal = await addMeal(user);

    const nameInput = within(modal).getByPlaceholderText('Meal name');
    await user.type(nameInput, 'Quick Pasta');

    // Set time
    const timeInput = within(modal).getByDisplayValue('30');
    await user.clear(timeInput);
    await user.type(timeInput, '15');

    // Set difficulty
    await user.selectOptions(within(modal).getByDisplayValue('easy'), 'medium');

    // Set rescue eligible
    await user.click(within(modal).getByLabelText('Rescue eligible'));

    // Auto-save persists; verify
    const saved = loadHousehold('h-meals')!;
    const meal = saved.baseMeals[0]!;
    expect(meal.name).toBe('Quick Pasta');
    expect(meal.estimatedTimeMinutes).toBe(15);
    expect(meal.difficulty).toBe('medium');
    expect(meal.rescueEligible).toBe(true);
  });
});

describe('F005: Remove meal and components', () => {
  it('can remove a meal', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');

    await addMeal(user);
    await user.click(within(getMealModal()).getByText('Save meal'));
    await addMeal(user);
    await user.click(within(getMealModal()).getByText('Save meal'));
    expect(screen.getByText('Meals (2)')).toBeInTheDocument();

    await user.click(screen.getAllByTestId(/^meal-row-/)[0]!);
    await user.click(within(getMealModal()).getByText('Remove meal'));

    const dialog = screen.getByRole('dialog', { name: 'Remove meal' });
    await user.click(within(dialog).getByText('Remove'));

    expect(screen.getByText('Meals (1)')).toBeInTheDocument();
  });

  it('can remove a component from a meal', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');

    const modal = await addMeal(user);

    await user.click(within(modal).getByText('Add component'));
    await user.click(within(modal).getByText('Add component'));
    expect(within(modal).getAllByTestId(/component-card-/)).toHaveLength(2);

    await expandComponent(user, modal, 0);
    const firstCard = within(modal).getByTestId('component-card-0');
    await user.click(within(firstCard).getByText('Remove component'));

    expect(within(modal).getAllByTestId(/component-card-/)).toHaveLength(1);
  });
});

describe('F005: Meals persist across re-open', () => {
  it('re-opening shows previously saved meals', async () => {
    const household = seedHousehold();
    household.baseMeals = [
      {
        id: 'meal-1',
        name: 'Roast Chicken Dinner',
        components: [
          { ingredientId: 'ing-chicken', role: 'protein', quantity: '500g' },
          { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
        ],
        defaultPrep: 'roast',
        estimatedTimeMinutes: 45,
        difficulty: 'medium',
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ];
    saveHousehold(household);

    renderBaseMealManager('h-meals');

    expect(screen.getByText('Meals (1)')).toBeInTheDocument();
    expect(screen.getByText('Roast Chicken Dinner')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTestId('meal-row-meal-1'));
    const modal = getMealModal();
    expect(within(modal).getByDisplayValue('Roast Chicken Dinner')).toBeInTheDocument();
    expect(within(modal).getByDisplayValue('roast')).toBeInTheDocument();
    expect(within(modal).getByDisplayValue('45')).toBeInTheDocument();
  });
});

describe('S007 UX refactor: editor flow hierarchy and actions', () => {
  it('renders core sections in the new hierarchy', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');

    const modal = await addMeal(user);
    const identity = within(modal).getByTestId('meal-identity-section');
    const structure = within(modal).getByTestId('meal-structure-section');
    const planning = within(modal).getByTestId('meal-planning-section');
    const secondary = within(modal).getByTestId('meal-secondary-section');

    const getPos = (el: HTMLElement) => Array.from(modal.querySelectorAll('*')).indexOf(el);

    expect(getPos(identity)).toBeLessThan(getPos(structure));
    expect(getPos(structure)).toBeLessThan(getPos(planning));
    expect(getPos(planning)).toBeLessThan(getPos(secondary));
  });

  it('keeps components collapsed by default and expandable', async () => {
    const household = seedHousehold();
    household.baseMeals = [
      {
        id: 'meal-collapsed',
        name: 'Collapsed test',
        components: [{ ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' }],
        defaultPrep: 'roast',
        estimatedTimeMinutes: 25,
        difficulty: 'easy',
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ];
    saveHousehold(household);

    const user = userEvent.setup();
    renderBaseMealManager('h-meals');
    await user.click(screen.getByTestId('meal-row-meal-collapsed'));

    const modal = getMealModal();
    const toggle = within(modal).getByTestId('component-toggle-0');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(modal).getByTestId('add-ingredient-inline')).toBeInTheDocument();
  });

  it('uses explicit save action text and closes modal', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');

    const modal = await addMeal(user);
    expect(within(modal).getByText('Save meal')).toBeInTheDocument();
    await user.click(within(modal).getByText('Save meal'));
    expect(screen.queryByTestId('meal-modal')).not.toBeInTheDocument();
  });

  it('closes meal modal when clicking the backdrop', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');
    await addMeal(user);
    expect(screen.getByTestId('meal-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('dialog', { name: /edit meal/i }));
    expect(screen.queryByTestId('meal-modal')).not.toBeInTheDocument();
  });
});

describe('Base meal theme tags (weekly anchor matching)', () => {
  it('shows tag editor in planning metadata with helper copy', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');
    const modal = await addMeal(user);
    const planning = within(modal).getByTestId('meal-planning-section');
    expect(within(planning).getByTestId('meal-tag-input')).toBeInTheDocument();
    expect(within(planning).getByText(/weekly theme nights/i)).toBeInTheDocument();
  });

  it('adds tags trimmed and lowercased; shows header theme chips', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');
    const modal = await addMeal(user);
    const input = within(modal).getByTestId('meal-tag-input');
    await user.type(input, '  TACO  ');
    await user.click(within(modal).getByTestId('meal-tag-add'));
    expect(within(modal).getByTestId('meal-tag-chip-taco')).toBeInTheDocument();
    expect(within(modal).getByTestId('meal-theme-tag-chips')).toBeInTheDocument();
  });

  it('persists normalized tags after Save meal', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');
    const modal = await addMeal(user);
    await user.type(within(modal).getByTestId('meal-tag-input'), 'Pizza');
    await user.click(within(modal).getByTestId('meal-tag-add'));
    await user.click(within(modal).getByText('Save meal'));
    const h = loadHousehold('h-meals');
    expect(h).toBeDefined();
    expect(h!.baseMeals[0]!.tags).toEqual(['pizza']);
  });

  it('does not add duplicate tags', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');
    const modal = await addMeal(user);
    const input = within(modal).getByTestId('meal-tag-input');
    await user.type(input, 'taco');
    await user.click(within(modal).getByTestId('meal-tag-add'));
    await user.clear(input);
    await user.type(input, 'TACO');
    await user.click(within(modal).getByTestId('meal-tag-add'));
    expect(within(modal).getAllByTestId('meal-tag-chip-taco')).toHaveLength(1);
  });

  it('removes a tag via chip control', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager('h-meals');
    const modal = await addMeal(user);
    await user.type(within(modal).getByTestId('meal-tag-input'), 'bowl');
    await user.click(within(modal).getByTestId('meal-tag-add'));
    await user.click(within(modal).getByTestId('meal-tag-remove-bowl'));
    expect(within(modal).queryByTestId('meal-tag-chip-bowl')).not.toBeInTheDocument();
    expect(within(modal).queryByTestId('meal-theme-tag-chips')).not.toBeInTheDocument();
  });
});
