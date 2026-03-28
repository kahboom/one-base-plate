import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router-dom';
import type {
  Household,
  BaseMeal,
  Ingredient,
  HouseholdMember,
  DayPlan,
  WeeklyPlan,
  AssemblyVariant,
} from '../src/types';
import { saveHousehold } from '../src/storage';
import { formatPlanForExport, generateGroceryList, generateAssemblyVariants } from '../src/planner';
import { householdLayoutRouteBranch } from './householdLayoutRoutes';

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
    id: 'ing-broccoli',
    name: 'broccoli',
    category: 'veg',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
];

const members: HouseholdMember[] = [
  {
    id: 'm-a',
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
    id: 'm-b',
    name: 'Riley',
    role: 'toddler',
    safeFoods: ['pasta'],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'soft',
    allergens: [],
    notes: '',
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
  name: 'Rice with broccoli',
  components: [
    { ingredientId: 'ing-rice', role: 'carb', quantity: '300g' },
    { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
  ],
  defaultPrep: 'Cook rice',
  estimatedTimeMinutes: 20,
  difficulty: 'easy',
  rescueEligible: false,
  wasteReuseHints: [],
};

const meals = [mealPasta, mealRice];

function makeVariants(meal: BaseMeal): AssemblyVariant[] {
  return generateAssemblyVariants(meal, members, ingredients);
}

const dayPlans: DayPlan[] = [
  { day: 'Monday', baseMealId: 'meal-pasta', variants: makeVariants(mealPasta) },
  { day: 'Tuesday', baseMealId: 'meal-rice', variants: makeVariants(mealRice) },
];

function makePlan(days: DayPlan[]): WeeklyPlan {
  return {
    id: 'plan-1',
    days,
    selectedBaseMeals: [...new Set(days.map((d) => d.baseMealId))],
    generatedGroceryList: [],
    notes: '',
  };
}

function seedHousehold(plan?: WeeklyPlan): Household {
  const household: Household = {
    id: 'h-export',
    name: 'Export Test Family',
    members,
    ingredients,
    baseMeals: meals,
    weeklyPlans: plan ? [plan] : [],
  };
  saveHousehold(household);
  return household;
}

function renderWeeklyPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/weekly`]}>
      <Routes>{householdLayoutRouteBranch}</Routes>
    </MemoryRouter>,
  );
}

function renderGroceryList(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/grocery`]}>
      <Routes>{householdLayoutRouteBranch}</Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('F020 — formatPlanForExport engine', () => {
  it('includes household name in header', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Test Family');
    expect(text).toContain('Weekly Meal Plan — Test Family');
  });

  it('includes daily meals with day labels', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Family');
    expect(text).toContain('Monday');
    expect(text).toContain('Base meal: Pasta with chicken');
    expect(text).toContain('Tuesday');
    expect(text).toContain('Base meal: Rice with broccoli');
  });

  it('includes prep time and difficulty for each meal', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Family');
    expect(text).toContain('25 min');
    expect(text).toContain('20 min');
    expect(text).toContain('easy');
  });

  it('includes per-person variants with member names and roles', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Family');
    expect(text).toContain('Alex (adult):');
    expect(text).toContain('Riley (toddler):');
  });

  it('includes assembly instructions for each variant', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Family');
    expect(text).toContain('Includes safe food: pasta');
  });

  it('includes grocery list grouped by category', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Family');
    expect(text).toContain('Grocery List');
    expect(text).toContain('Protein:');
    expect(text).toContain('chicken');
    expect(text).toContain('Carb:');
    expect(text).toContain('pasta');
    expect(text).toContain('rice');
  });

  it('includes meal linkbacks in grocery items', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Family');
    expect(text).toContain('(Pasta with chicken)');
    expect(text).toContain('(Rice with broccoli)');
  });

  it('produces readable formatting with separators', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Family');
    expect(text).toContain('====');
    expect(text).toContain('----');
  });
});

describe('F020 — WeeklyPlanner export/print buttons', () => {
  it('shows export and print buttons when plan exists', async () => {
    const plan = makePlan(dayPlans);
    seedHousehold(plan);
    renderWeeklyPlanner('h-export');

    expect(await screen.findByTestId('export-btn')).toBeInTheDocument();
    expect(screen.getByTestId('print-btn')).toBeInTheDocument();
  });

  it('does not show export/print buttons when no plan', () => {
    seedHousehold();
    renderWeeklyPlanner('h-export');
    expect(screen.queryByTestId('export-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('print-btn')).not.toBeInTheDocument();
  });

  it('triggers file download on export click', async () => {
    const plan = makePlan(dayPlans);
    seedHousehold(plan);
    renderWeeklyPlanner('h-export');

    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { click: clickSpy, href: '', download: '' } as unknown as HTMLElement;
        return el;
      }
      return document.createElement(tag);
    });

    const user = userEvent.setup();
    await user.click(await screen.findByTestId('export-btn'));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('calls window.print on print click', async () => {
    const plan = makePlan(dayPlans);
    seedHousehold(plan);
    renderWeeklyPlanner('h-export');

    const printSpy = vi.fn();
    window.print = printSpy;

    const user = userEvent.setup();
    await user.click(await screen.findByTestId('print-btn'));

    expect(printSpy).toHaveBeenCalled();
  });
});

describe('F020 — GroceryList export/print buttons', () => {
  it('shows export and print buttons when grocery list has items', async () => {
    const plan = makePlan(dayPlans);
    seedHousehold(plan);
    renderGroceryList('h-export');

    expect(await screen.findByTestId('export-grocery-btn')).toBeInTheDocument();
    expect(screen.getByTestId('print-grocery-btn')).toBeInTheDocument();
  });

  it('does not show export/print when no plan saved', () => {
    seedHousehold();
    renderGroceryList('h-export');
    expect(screen.queryByTestId('export-grocery-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('print-grocery-btn')).not.toBeInTheDocument();
  });

  it('triggers file download on grocery export click', async () => {
    const plan = makePlan(dayPlans);
    seedHousehold(plan);
    renderGroceryList('h-export');

    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { click: clickSpy, href: '', download: '' } as unknown as HTMLElement;
        return el;
      }
      return document.createElement(tag);
    });

    const user = userEvent.setup();
    await user.click(await screen.findByTestId('export-grocery-btn'));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('calls window.print on grocery print click', async () => {
    const plan = makePlan(dayPlans);
    seedHousehold(plan);
    renderGroceryList('h-export');

    const printSpy = vi.fn();
    window.print = printSpy;

    const user = userEvent.setup();
    await user.click(await screen.findByTestId('print-grocery-btn'));

    expect(printSpy).toHaveBeenCalled();
  });
});

describe('F020 — export content matches saved plan', () => {
  it('exported text matches the saved plan structure', () => {
    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'My Family');
    const lines = text.split('\n');

    // Header
    expect(lines[0]).toBe('Weekly Meal Plan — My Family');

    // Both days present
    const dayLines = lines.filter((l) =>
      l.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/),
    );
    expect(dayLines).toEqual(['Monday', 'Tuesday']);

    // Grocery section present
    expect(lines.some((l) => l.includes('Grocery List'))).toBe(true);
  });

  it('grocery list formatting remains clean for printing', () => {
    const groceryItems = generateGroceryList(dayPlans, meals, ingredients);
    expect(groceryItems.length).toBeGreaterThan(0);

    const text = formatPlanForExport(dayPlans, meals, members, ingredients, 'Family');
    const lines = text.split('\n');
    const groceryStart = lines.findIndex((l) => l.includes('Grocery List'));
    expect(groceryStart).toBeGreaterThan(0);

    const grocerySection = lines.slice(groceryStart);
    const itemLines = grocerySection.filter((l) => l.trim().startsWith('- '));
    expect(itemLines.length).toBe(groceryItems.length);
  });
});
