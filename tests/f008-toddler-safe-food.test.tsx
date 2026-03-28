import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, BaseMeal, Ingredient, HouseholdMember } from '../src/types';
import { saveHousehold } from '../src/storage';
import { generateAssemblyVariants } from '../src/planner';
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
    name: 'chicken breast',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: false,
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
  {
    id: 'ing-spicy-sauce',
    name: 'spicy sauce',
    category: 'pantry',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
  },
  {
    id: 'ing-cheese',
    name: 'cheese',
    category: 'dairy',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
];

const toddler: HouseholdMember = {
  id: 'm-toddler',
  name: 'Riley',
  role: 'toddler',
  safeFoods: ['pasta', 'bread', 'cheese'],
  hardNoFoods: ['spicy sauce'],
  preparationRules: [{ ingredient: 'pasta', rule: 'Must be small shapes like penne' }],
  textureLevel: 'soft',
  allergens: [],
  notes: '',
};

const adult: HouseholdMember = {
  id: 'm-adult',
  name: 'Parent',
  role: 'adult',
  safeFoods: [],
  hardNoFoods: [],
  preparationRules: [],
  textureLevel: 'regular',
  allergens: [],
  notes: '',
};

beforeEach(() => {
  localStorage.clear();
});

describe('F008: Toddler plate includes at least one safe food', () => {
  it('identifies safe food when meal contains a toddler safe food', () => {
    const meal: BaseMeal = {
      id: 'meal-1',
      name: 'Pasta with chicken',
      components: [
        { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
        { ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' },
        { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Cook pasta, grill chicken',
      estimatedTimeMinutes: 25,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [toddler], ingredients);
    const toddlerVariant = variants[0]!;

    expect(toddlerVariant.safeFoodIncluded).toBe(true);
    expect(
      toddlerVariant.instructions.some(
        (i) => i.includes('Includes safe food') && i.includes('pasta'),
      ),
    ).toBe(true);
  });

  it('identifies multiple safe foods when meal contains several', () => {
    const meal: BaseMeal = {
      id: 'meal-2',
      name: 'Cheesy pasta',
      components: [
        { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
        { ingredientId: 'ing-cheese', role: 'topping', quantity: '100g' },
        { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Cook pasta, add cheese',
      estimatedTimeMinutes: 15,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [toddler], ingredients);
    const toddlerVariant = variants[0]!;

    expect(toddlerVariant.safeFoodIncluded).toBe(true);
    expect(
      toddlerVariant.instructions.some(
        (i) => i.includes('Includes safe food') && i.includes('pasta') && i.includes('cheese'),
      ),
    ).toBe(true);
  });

  it('suggests explicit fallback when no safe food is in the meal', () => {
    const meal: BaseMeal = {
      id: 'meal-3',
      name: 'Chicken and broccoli',
      components: [
        { ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' },
        { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
      ],
      defaultPrep: 'Grill and steam',
      estimatedTimeMinutes: 20,
      difficulty: 'easy',
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [toddler], ingredients);
    const toddlerVariant = variants[0]!;

    expect(toddlerVariant.safeFoodIncluded).toBe(false);
    expect(
      toddlerVariant.instructions.some(
        (i) => i.includes('No safe food in this meal') && i.includes('add on the side'),
      ),
    ).toBe(true);
    // Should suggest specific safe foods
    expect(
      toddlerVariant.instructions.some(
        (i) => i.includes('pasta') || i.includes('bread') || i.includes('cheese'),
      ),
    ).toBe(true);
  });

  it('excludes hard-no foods and still checks safe food presence', () => {
    const meal: BaseMeal = {
      id: 'meal-4',
      name: 'Spicy chicken pasta',
      components: [
        { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
        { ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' },
        { ingredientId: 'ing-spicy-sauce', role: 'sauce', quantity: '100ml' },
      ],
      defaultPrep: 'Cook with sauce',
      estimatedTimeMinutes: 25,
      difficulty: 'easy',
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [toddler], ingredients);
    const toddlerVariant = variants[0]!;

    // Spicy sauce excluded
    expect(
      toddlerVariant.instructions.some((i) => i.includes('Exclude') && i.includes('spicy sauce')),
    ).toBe(true);
    // Pasta still identified as safe food
    expect(toddlerVariant.safeFoodIncluded).toBe(true);
    expect(
      toddlerVariant.instructions.some(
        (i) => i.includes('Includes safe food') && i.includes('pasta'),
      ),
    ).toBe(true);
  });

  it('never silently omits toddler compatibility — always has explicit message', () => {
    const mealWithSafe: BaseMeal = {
      id: 'meal-5a',
      name: 'Pasta meal',
      components: [{ ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' }],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 10,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const mealWithout: BaseMeal = {
      id: 'meal-5b',
      name: 'Chicken meal',
      components: [{ ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' }],
      defaultPrep: 'Grill',
      estimatedTimeMinutes: 15,
      difficulty: 'easy',
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const withSafe = generateAssemblyVariants(mealWithSafe, [toddler], ingredients)[0]!;
    const withoutSafe = generateAssemblyVariants(mealWithout, [toddler], ingredients)[0]!;

    // Both should have explicit safe food messaging
    expect(withSafe.instructions.some((i) => i.includes('Includes safe food'))).toBe(true);
    expect(withoutSafe.instructions.some((i) => i.includes('No safe food in this meal'))).toBe(
      true,
    );
  });

  it('does not add safe food messaging for adults', () => {
    const meal: BaseMeal = {
      id: 'meal-6',
      name: 'Simple pasta',
      components: [{ ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' }],
      defaultPrep: 'Cook',
      estimatedTimeMinutes: 10,
      difficulty: 'easy',
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [adult], ingredients);
    const adultVariant = variants[0]!;

    expect(adultVariant.instructions.some((i) => i.includes('safe food'))).toBe(false);
    expect(adultVariant.instructions.some((i) => i.includes('Includes safe food'))).toBe(false);
  });

  it('handles toddler with no safe foods defined gracefully', () => {
    const toddlerNoSafe: HouseholdMember = {
      ...toddler,
      id: 'm-toddler-nosafe',
      safeFoods: [],
    };

    const meal: BaseMeal = {
      id: 'meal-7',
      name: 'Chicken meal',
      components: [{ ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' }],
      defaultPrep: 'Grill',
      estimatedTimeMinutes: 15,
      difficulty: 'easy',
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [toddlerNoSafe], ingredients);
    const toddlerVariant = variants[0]!;

    expect(toddlerVariant.safeFoodIncluded).toBe(false);
    expect(
      toddlerVariant.instructions.some(
        (i) => i.includes('No safe food matched') && i.includes('familiar side'),
      ),
    ).toBe(true);
  });
});

describe('F008: Toddler safe food in planner UI', () => {
  it('displays toddler safe food status in planner', async () => {
    const household: Household = {
      id: 'h-toddler',
      name: 'Toddler Family',
      members: [adult, toddler],
      ingredients,
      baseMeals: [
        {
          id: 'meal-pasta',
          name: 'Simple pasta',
          components: [
            { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
            { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
          ],
          defaultPrep: 'Cook pasta, steam broccoli',
          estimatedTimeMinutes: 15,
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
      <MemoryRouter initialEntries={['/household/h-toddler/planner']}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('selectable-meal-pasta'));

    const toddlerSection = screen.getByTestId('variant-m-toddler');
    // Safe food included indicator
    expect(within(toddlerSection).getByText('Safe food included')).toBeInTheDocument();
    // Explicit instruction naming the safe food
    expect(within(toddlerSection).getByText(/Includes safe food.*pasta/)).toBeInTheDocument();
  });
});
