import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, BaseMeal, Ingredient, HouseholdMember } from '../src/types';
import { saveHousehold } from '../src/storage';
import { generateMealExplanation } from '../src/planner';
import Planner from '../src/pages/Planner';

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
    babySafeWithAdaptation: false,
  },
  {
    id: 'ing-mushrooms',
    name: 'mushrooms',
    category: 'veg',
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
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
];

const members: HouseholdMember[] = [
  {
    id: 'm-alex',
    name: 'Alex',
    role: 'adult',
    safeFoods: [],
    hardNoFoods: ['mushrooms'],
    preparationRules: [],
    textureLevel: 'regular',
    allergens: [],
    notes: '',
  },
  {
    id: 'm-jordan',
    name: 'Jordan',
    role: 'adult',
    safeFoods: [],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'regular',
    allergens: [],
    notes: '',
  },
  {
    id: 'm-kid',
    name: 'Riley',
    role: 'toddler',
    safeFoods: ['pasta', 'cheese'],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'soft',
    allergens: [],
    notes: '',
  },
];

beforeEach(() => {
  localStorage.clear();
});

describe('F018: Meal explanation engine', () => {
  it('explains when a meal works for everyone without modification', () => {
    const meal: BaseMeal = {
      id: 'meal-1',
      name: 'Simple pasta',
      components: [{ ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' }],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 10,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const twoAdults = members.slice(0, 2); // Alex and Jordan only
    const result = generateMealExplanation(meal, twoAdults, ingredients);
    expect(result.summary).toContain('Works for everyone');
    expect(result.summary).toContain('no modifications needed');
    expect(result.tradeOffs).toHaveLength(0);
  });

  it('explains when a meal works for everyone with adaptations', () => {
    const meal: BaseMeal = {
      id: 'meal-2',
      name: 'Pasta with broccoli',
      components: [
        { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
        { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 15,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const result = generateMealExplanation(meal, members, ingredients);
    expect(result.summary).toContain('Works for everyone');
    expect(result.summary).toContain('adaptation');
  });

  it('explains conflicts with member names', () => {
    const meal: BaseMeal = {
      id: 'meal-3',
      name: 'Mushroom pasta',
      components: [
        { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
        { ingredientId: 'ing-mushrooms', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 15,
      difficulty: 'easy',
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const result = generateMealExplanation(meal, members, ingredients);
    expect(result.summary).toContain('2/3');
    expect(result.summary).toContain('Alex');
    expect(result.summary).toContain('conflict');
  });

  it('lists conflict details as trade-offs', () => {
    const meal: BaseMeal = {
      id: 'meal-4',
      name: 'Mushroom pasta',
      components: [
        { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
        { ingredientId: 'ing-mushrooms', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 15,
      difficulty: 'easy',
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const result = generateMealExplanation(meal, members, ingredients);
    expect(result.tradeOffs.some((t) => t.includes('Alex') && t.includes('mushrooms'))).toBe(true);
  });

  it('notes extra prep needed as trade-off', () => {
    const meal: BaseMeal = {
      id: 'meal-5',
      name: 'Pasta broccoli',
      components: [
        { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
        { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 15,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const result = generateMealExplanation(meal, members, ingredients);
    expect(result.tradeOffs.some((t) => t.includes('Extra prep') && t.includes('Riley'))).toBe(
      true,
    );
  });

  it('flags toddler missing safe food as trade-off', () => {
    const meal: BaseMeal = {
      id: 'meal-6',
      name: 'Chicken broccoli',
      components: [
        { ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' },
        { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 20,
      difficulty: 'easy',
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const result = generateMealExplanation(meal, members, ingredients);
    expect(result.tradeOffs.some((t) => t.includes('Riley') && t.includes('no safe food'))).toBe(
      true,
    );
  });

  it('does not flag safe food trade-off when toddler safe food is present', () => {
    const meal: BaseMeal = {
      id: 'meal-7',
      name: 'Pasta broccoli',
      components: [
        { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
        { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 15,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const result = generateMealExplanation(meal, members, ingredients);
    expect(result.tradeOffs.some((t) => t.includes('Riley') && t.includes('no safe food'))).toBe(
      false,
    );
  });

  it('handles zero-member case gracefully', () => {
    const meal: BaseMeal = {
      id: 'meal-8',
      name: 'Pasta',
      components: [{ ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' }],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 10,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const result = generateMealExplanation(meal, [], ingredients);
    expect(result.summary).toBeDefined();
    expect(result.tradeOffs).toHaveLength(0);
  });
});

describe('F018: Explanation panel in planner UI', () => {
  it('shows explanation with summary and trade-offs when meal is selected', async () => {
    const household: Household = {
      id: 'h-explain',
      name: 'Explanation Family',
      members,
      ingredients,
      baseMeals: [
        {
          id: 'meal-1',
          name: 'Mushroom pasta',
          components: [
            { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
            { ingredientId: 'ing-mushrooms', role: 'veg', quantity: '200g' },
          ],
          defaultPrep: 'Cook',
          estimatedTimeMinutes: 15,
          difficulty: 'easy',
          rescueEligible: false,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [],
    };
    saveHousehold(household);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-explain/planner']}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('selectable-meal-1'));

    const explanation = screen.getByTestId('meal-explanation');
    expect(within(explanation).getByText('Why this meal?')).toBeInTheDocument();
    expect(within(explanation).getByText(/2\/3/)).toBeInTheDocument();
    expect(within(explanation).getByText('Trade-offs')).toBeInTheDocument();
    expect(within(explanation).getByText(/Alex.*mushrooms/)).toBeInTheDocument();
  });

  it('shows no trade-offs section when meal is universally accepted', async () => {
    const household: Household = {
      id: 'h-explain2',
      name: 'Simple Family',
      members: members.slice(0, 2), // Two adults only
      ingredients,
      baseMeals: [
        {
          id: 'meal-2',
          name: 'Simple pasta',
          components: [{ ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' }],
          defaultPrep: 'Cook',
          estimatedTimeMinutes: 10,
          difficulty: 'easy',
          rescueEligible: true,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [],
    };
    saveHousehold(household);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-explain2/planner']}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('selectable-meal-2'));

    const explanation = screen.getByTestId('meal-explanation');
    expect(within(explanation).getByText(/Works for everyone/)).toBeInTheDocument();
    expect(within(explanation).queryByText('Trade-offs')).not.toBeInTheDocument();
  });
});
