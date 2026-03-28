import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, BaseMeal, Ingredient, HouseholdMember, MealOutcome } from '../src/types';
import {
  computeOutcomeScore,
  generateWeeklyPlan,
  generateMealExplanation,
  generateShortReason,
} from '../src/planner';
import { saveHousehold } from '../src/storage';

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
    id: 'i1',
    name: 'Chicken',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'i2',
    name: 'Pasta',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'i3',
    name: 'Broccoli',
    category: 'veg',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'i4',
    name: 'Salmon',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: 'i5',
    name: 'Rice',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'i6',
    name: 'Peas',
    category: 'veg',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
];

const mealA: BaseMeal = {
  id: 'meal-a',
  name: 'Chicken Pasta',
  components: [
    { ingredientId: 'i1', role: 'protein', quantity: '200g' },
    { ingredientId: 'i2', role: 'carb', quantity: '300g' },
    { ingredientId: 'i3', role: 'veg', quantity: '150g' },
  ],
  defaultPrep: 'boil',
  estimatedTimeMinutes: 25,
  difficulty: 'easy',
  rescueEligible: false,
  wasteReuseHints: [],
};

const mealB: BaseMeal = {
  id: 'meal-b',
  name: 'Salmon Rice',
  components: [
    { ingredientId: 'i4', role: 'protein', quantity: '200g' },
    { ingredientId: 'i5', role: 'carb', quantity: '300g' },
    { ingredientId: 'i6', role: 'veg', quantity: '150g' },
  ],
  defaultPrep: 'bake',
  estimatedTimeMinutes: 30,
  difficulty: 'medium',
  rescueEligible: false,
  wasteReuseHints: [],
};

const meals = [mealA, mealB];

function makeOutcome(
  mealId: string,
  outcome: 'success' | 'partial' | 'failure',
  index = 0,
): MealOutcome {
  return {
    id: `outcome-${mealId}-${index}`,
    baseMealId: mealId,
    day: 'Monday',
    outcome,
    notes: '',
    date: '2026-03-10',
  };
}

/* ---------- Engine: computeOutcomeScore ---------- */
describe('F015: computeOutcomeScore', () => {
  it('returns zero score for meals with no outcomes', () => {
    const result = computeOutcomeScore('meal-a', []);
    expect(result.score).toBe(0);
    expect(result.total).toBe(0);
    expect(result.label).toBe('');
  });

  it('scores successes positively', () => {
    const outcomes = [makeOutcome('meal-a', 'success', 0), makeOutcome('meal-a', 'success', 1)];
    const result = computeOutcomeScore('meal-a', outcomes);
    expect(result.score).toBe(4); // 2 * 2
    expect(result.successCount).toBe(2);
    expect(result.label).toBe('reliable choice');
  });

  it('scores failures negatively', () => {
    const outcomes = [makeOutcome('meal-a', 'failure', 0), makeOutcome('meal-a', 'failure', 1)];
    const result = computeOutcomeScore('meal-a', outcomes);
    expect(result.score).toBe(-6); // -3 * 2
    expect(result.failureCount).toBe(2);
    expect(result.label).toBe('repeated failures');
  });

  it('labels meal as household favorite with 3+ successes', () => {
    const outcomes = [
      makeOutcome('meal-a', 'success', 0),
      makeOutcome('meal-a', 'success', 1),
      makeOutcome('meal-a', 'success', 2),
    ];
    const result = computeOutcomeScore('meal-a', outcomes);
    expect(result.label).toBe('household favorite');
  });

  it('scores partial outcomes as small positive', () => {
    const outcomes = [makeOutcome('meal-a', 'partial', 0)];
    const result = computeOutcomeScore('meal-a', outcomes);
    expect(result.score).toBe(0.5);
    expect(result.partialCount).toBe(1);
  });

  it('only counts outcomes for the specified meal', () => {
    const outcomes = [makeOutcome('meal-a', 'success', 0), makeOutcome('meal-b', 'failure', 0)];
    const resultA = computeOutcomeScore('meal-a', outcomes);
    const resultB = computeOutcomeScore('meal-b', outcomes);
    expect(resultA.score).toBe(2);
    expect(resultB.score).toBe(-3);
  });

  it('labels mixed results correctly', () => {
    const outcomes = [makeOutcome('meal-a', 'success', 0), makeOutcome('meal-a', 'failure', 1)];
    const result = computeOutcomeScore('meal-a', outcomes);
    expect(result.label).toBe('mixed results');
  });
});

/* ---------- Engine: generateWeeklyPlan with outcomes ---------- */
describe('F015: Weekly plan uses outcome scores', () => {
  it('ranks successful meals higher in plan generation', () => {
    const outcomes = [
      makeOutcome('meal-b', 'success', 0),
      makeOutcome('meal-b', 'success', 1),
      makeOutcome('meal-b', 'success', 2),
      makeOutcome('meal-a', 'failure', 0),
      makeOutcome('meal-a', 'failure', 1),
    ];

    const plan = generateWeeklyPlan(meals, members, ingredients, 3, [], outcomes);
    // meal-b should appear more often due to better outcome score
    const mealBCount = plan.filter((d) => d.baseMealId === 'meal-b').length;
    const mealACount = plan.filter((d) => d.baseMealId === 'meal-a').length;
    expect(mealBCount).toBeGreaterThan(mealACount);
  });

  it('deprioritizes repeated-failure meals', () => {
    const outcomes = [
      makeOutcome('meal-a', 'failure', 0),
      makeOutcome('meal-a', 'failure', 1),
      makeOutcome('meal-a', 'failure', 2),
    ];

    // meal-a has higher overlap (pasta is Riley's safe food) but many failures
    const plan = generateWeeklyPlan(meals, members, ingredients, 5, [], outcomes);
    // With -9 penalty from failures, meal-b should appear in more slots
    const mealBCount = plan.filter((d) => d.baseMealId === 'meal-b').length;
    expect(mealBCount).toBeGreaterThanOrEqual(2);
  });

  it('works without outcomes (backwards compatible)', () => {
    const plan = generateWeeklyPlan(meals, members, ingredients, 3);
    expect(plan).toHaveLength(3);
    expect(plan.every((d) => d.baseMealId)).toBe(true);
  });
});

/* ---------- Engine: explanation includes outcome info ---------- */
describe('F015: Meal explanation includes outcome insights', () => {
  it('includes outcome label in trade-offs when outcomes exist', () => {
    const outcomes = [
      makeOutcome('meal-a', 'success', 0),
      makeOutcome('meal-a', 'success', 1),
      makeOutcome('meal-a', 'success', 2),
    ];
    const explanation = generateMealExplanation(mealA, members, ingredients, outcomes);
    const outcomeTradeOff = explanation.tradeOffs.find((t) => t.includes('Past results'));
    expect(outcomeTradeOff).toBeDefined();
    expect(outcomeTradeOff).toContain('household favorite');
    expect(outcomeTradeOff).toContain('3 success');
  });

  it('shows failure info in trade-offs', () => {
    const outcomes = [makeOutcome('meal-a', 'failure', 0), makeOutcome('meal-a', 'failure', 1)];
    const explanation = generateMealExplanation(mealA, members, ingredients, outcomes);
    const outcomeTradeOff = explanation.tradeOffs.find((t) => t.includes('Past results'));
    expect(outcomeTradeOff).toContain('repeated failures');
    expect(outcomeTradeOff).toContain('2 failure');
  });

  it('omits outcome info when no outcomes recorded', () => {
    const explanation = generateMealExplanation(mealA, members, ingredients, []);
    const outcomeTradeOff = explanation.tradeOffs.find((t) => t.includes('Past results'));
    expect(outcomeTradeOff).toBeUndefined();
  });
});

/* ---------- Engine: short reason includes outcome info ---------- */
describe('F015: Short reason reflects outcome history', () => {
  it("returns 'Household favorite' for 3+ successes", () => {
    const outcomes = [
      makeOutcome('meal-a', 'success', 0),
      makeOutcome('meal-a', 'success', 1),
      makeOutcome('meal-a', 'success', 2),
    ];
    const reason = generateShortReason(mealA, members, ingredients, outcomes);
    expect(reason).toBe('Household favorite');
  });

  it("returns 'Often doesn't work' for failures with no successes", () => {
    const outcomes = [makeOutcome('meal-a', 'failure', 0)];
    const reason = generateShortReason(mealA, members, ingredients, outcomes);
    expect(reason).toBe("Often doesn't work");
  });

  it('returns normal reason when no outcomes', () => {
    const reason = generateShortReason(mealA, members, ingredients, []);
    // Should fall through to regular logic
    expect(reason.length).toBeGreaterThan(0);
    expect(reason).not.toBe('Household favorite');
    expect(reason).not.toBe("Often doesn't work");
  });
});

/* ---------- UI: Planner ranking reflects outcomes ---------- */
describe('F015: Planner UI reflects outcome-based ranking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows outcome-based short reason on meal cards', async () => {
    const household: Household = {
      id: 'h-outcome',
      name: 'Outcome Test',
      members,
      ingredients,
      baseMeals: meals,
      weeklyPlans: [],
      pinnedMealIds: [],
      mealOutcomes: [
        makeOutcome('meal-a', 'success', 0),
        makeOutcome('meal-a', 'success', 1),
        makeOutcome('meal-a', 'success', 2),
      ],
    };
    saveHousehold(household);

    const Planner = (await import('../src/pages/Planner')).default;
    render(
      <MemoryRouter initialEntries={['/household/h-outcome/planner']}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    const mealCardA = await screen.findByTestId('meal-card-meal-a');
    expect(mealCardA.textContent).toContain('Household favorite');
  });

  it('ranks successful meals higher in Planner card grid', async () => {
    const household: Household = {
      id: 'h-rank',
      name: 'Rank Test',
      members,
      ingredients,
      baseMeals: meals,
      weeklyPlans: [],
      pinnedMealIds: [],
      mealOutcomes: [
        makeOutcome('meal-b', 'success', 0),
        makeOutcome('meal-b', 'success', 1),
        makeOutcome('meal-b', 'success', 2),
        makeOutcome('meal-b', 'success', 3),
        makeOutcome('meal-a', 'failure', 0),
        makeOutcome('meal-a', 'failure', 1),
      ],
    };
    saveHousehold(household);

    const Planner = (await import('../src/pages/Planner')).default;
    render(
      <MemoryRouter initialEntries={['/household/h-rank/planner']}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    const grid = await screen.findByTestId('meal-card-grid');
    expect(grid).toBeDefined();

    const mealCardB = screen.getByTestId('meal-card-meal-b');
    expect(mealCardB.textContent).toContain('Household favorite');

    const mealCardA = screen.getByTestId('meal-card-meal-a');
    expect(mealCardA.textContent).toContain("Often doesn't work");
  });

  it('shows outcome trade-off in explanation panel', async () => {
    const household: Household = {
      id: 'h-expl',
      name: 'Explanation Test',
      members,
      ingredients,
      baseMeals: [mealA],
      weeklyPlans: [],
      pinnedMealIds: [],
      mealOutcomes: [makeOutcome('meal-a', 'success', 0), makeOutcome('meal-a', 'failure', 1)],
    };
    saveHousehold(household);

    const user = userEvent.setup();
    const Planner = (await import('../src/pages/Planner')).default;
    render(
      <MemoryRouter initialEntries={['/household/h-expl/planner']}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    const card = await screen.findByTestId('selectable-meal-a');
    await user.click(card);

    const explanation = await screen.findByTestId('meal-explanation');
    expect(explanation.textContent).toContain('Past results');
    expect(explanation.textContent).toContain('mixed results');
  });
});

/* ---------- Ranking is explainable ---------- */
describe('F015: Ranking remains explainable', () => {
  it('outcome labels are human-readable', () => {
    const labels = [
      computeOutcomeScore('x', [
        makeOutcome('x', 'success', 0),
        makeOutcome('x', 'success', 1),
        makeOutcome('x', 'success', 2),
      ]).label,
      computeOutcomeScore('x', [makeOutcome('x', 'failure', 0)]).label,
      computeOutcomeScore('x', [makeOutcome('x', 'success', 0)]).label,
      computeOutcomeScore('x', [makeOutcome('x', 'success', 0), makeOutcome('x', 'failure', 1)])
        .label,
      computeOutcomeScore('x', [
        makeOutcome('x', 'failure', 0),
        makeOutcome('x', 'failure', 1),
        makeOutcome('x', 'success', 2),
      ]).label,
    ];

    expect(labels[0]).toBe('household favorite');
    expect(labels[1]).toBe('repeated failures');
    expect(labels[2]).toBe('reliable choice');
    expect(labels[3]).toBe('mixed results');
    expect(labels[4]).toBe("often doesn't work");
  });

  it('explanation text contains counts for transparency', () => {
    const outcomes = [
      makeOutcome('meal-a', 'success', 0),
      makeOutcome('meal-a', 'partial', 1),
      makeOutcome('meal-a', 'failure', 2),
    ];
    const explanation = generateMealExplanation(mealA, members, ingredients, outcomes);
    const outcomeTradeOff = explanation.tradeOffs.find((t) => t.includes('Past results'));
    expect(outcomeTradeOff).toContain('1 success');
    expect(outcomeTradeOff).toContain('1 failure');
  });
});
