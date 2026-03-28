import { describe, it, expect } from 'vitest';
import type {
  BaseMeal,
  DayPlan,
  HouseholdMember,
  Ingredient,
  MealOutcome,
  WeeklyAnchor,
} from '../src/types';
import { mealMatchesWeeklyAnchor, rankWeeklySuggestedMeals } from '../src/planner';

const ingredients: Ingredient[] = [
  {
    id: 'ing-a',
    name: 'ing a',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-b',
    name: 'ing b',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-c',
    name: 'ing c',
    category: 'veg',
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
  {
    id: 'm2',
    name: 'Jordan',
    role: 'adult',
    safeFoods: [],
    hardNoFoods: ['ing c'],
    preparationRules: [],
    textureLevel: 'regular',
    allergens: [],
    notes: '',
  },
];

function meal(
  id: string,
  name: string,
  componentIds: string[],
  opts: Partial<Pick<BaseMeal, 'estimatedTimeMinutes' | 'difficulty'>> = {},
): BaseMeal {
  return {
    id,
    name,
    components: componentIds.map((ingredientId, i) => ({
      ingredientId,
      role: i === 0 ? 'protein' : 'carb',
      quantity: '1',
    })),
    defaultPrep: '',
    estimatedTimeMinutes: opts.estimatedTimeMinutes ?? 30,
    difficulty: opts.difficulty ?? 'medium',
    rescueEligible: false,
    wasteReuseHints: [],
  };
}

describe('rankWeeklySuggestedMeals', () => {
  it('orders by overlap when no outcomes or plan', () => {
    const low = meal('low', 'Low overlap', ['ing-c'], {
      estimatedTimeMinutes: 20,
      difficulty: 'easy',
    });
    const high = meal('high', 'High overlap', ['ing-a', 'ing-b'], {
      estimatedTimeMinutes: 45,
      difficulty: 'hard',
    });
    const ranked = rankWeeklySuggestedMeals([low, high], members, ingredients, [], [], []);
    expect(ranked.map((r) => r.meal.id)).toEqual(['high', 'low']);
  });

  it('deprioritizes meals only on plan when not pinned and not household favorite', () => {
    const onPlan = meal('on', 'On plan', ['ing-a']);
    const fresh = meal('fresh', 'Fresh', ['ing-b']);
    const days: DayPlan[] = [
      {
        day: 'Monday',
        baseMealId: 'on',
        variants: [],
      },
    ];
    const ranked = rankWeeklySuggestedMeals([onPlan, fresh], members, ingredients, [], [], days);
    expect(ranked[0]!.meal.id).toBe('fresh');
    expect(ranked[1]!.meal.id).toBe('on');
  });

  it('allows repeat when pinned', () => {
    const onPlan = meal('on', 'On plan', ['ing-a']);
    const fresh = meal('fresh', 'Fresh', ['ing-b']);
    const days: DayPlan[] = [{ day: 'Monday', baseMealId: 'on', variants: [] }];
    const ranked = rankWeeklySuggestedMeals(
      [onPlan, fresh],
      members,
      ingredients,
      [],
      ['on'],
      days,
    );
    // Both tier 0; fresh may still sort first by overlap — compare tiers
    expect(ranked.filter((r) => r.tier === 1)).toHaveLength(0);
  });

  it('allows repeat when successCount >= 3', () => {
    const favorite = meal('fav', 'Favorite', ['ing-a']);
    const other = meal('oth', 'Other', ['ing-b']);
    const outcomes: MealOutcome[] = Array.from({ length: 3 }, (_, i) => ({
      id: `o-${i}`,
      baseMealId: 'fav',
      day: 'Mon',
      outcome: 'success' as const,
      notes: '',
      date: '2026-01-01',
    }));
    const days: DayPlan[] = [{ day: 'Monday', baseMealId: 'fav', variants: [] }];
    const ranked = rankWeeklySuggestedMeals(
      [favorite, other],
      members,
      ingredients,
      outcomes,
      [],
      days,
    );
    expect(ranked.find((r) => r.meal.id === 'fav')!.tier).toBe(0);
  });

  it('tier 2 for failure-only history', () => {
    const bad = meal('bad', 'Bad', ['ing-a']);
    const good = meal('good', 'Good', ['ing-b']);
    const outcomes: MealOutcome[] = [
      {
        id: 'o1',
        baseMealId: 'bad',
        day: 'Mon',
        outcome: 'failure',
        notes: '',
        date: '2026-01-01',
      },
    ];
    const ranked = rankWeeklySuggestedMeals([bad, good], members, ingredients, outcomes, [], []);
    expect(ranked[0]!.meal.id).toBe('good');
    expect(ranked.find((r) => r.meal.id === 'bad')!.tier).toBe(2);
  });

  it('pinned failure-only is not tier 2; ranks above unpinned failure-only when signals match', () => {
    const badPinned = meal('bp', 'Bad pinned', ['ing-a']);
    const badFree = meal('bf', 'Bad free', ['ing-a']);
    const outcomes: MealOutcome[] = [
      {
        id: 'o1',
        baseMealId: 'bp',
        day: 'Mon',
        outcome: 'failure',
        notes: '',
        date: '2026-01-01',
      },
      {
        id: 'o2',
        baseMealId: 'bf',
        day: 'Tue',
        outcome: 'failure',
        notes: '',
        date: '2026-01-02',
      },
    ];
    const ranked = rankWeeklySuggestedMeals(
      [badFree, badPinned],
      members,
      ingredients,
      outcomes,
      ['bp'],
      [],
    );
    expect(ranked[0]!.meal.id).toBe('bp');
    expect(ranked.find((r) => r.meal.id === 'bp')!.tier).toBe(0);
    expect(ranked.find((r) => r.meal.id === 'bf')!.tier).toBe(2);
  });

  it('boosts ingredient reuse vs current plan', () => {
    const oneAdult = [members[0]!];
    const shares = meal('shares', 'Shares ing-a', ['ing-a', 'ing-b'], {
      estimatedTimeMinutes: 30,
      difficulty: 'medium',
    });
    const isolated = meal('iso', 'Only ing-c', ['ing-c'], {
      estimatedTimeMinutes: 30,
      difficulty: 'medium',
    });
    const planned = meal('planned', 'Planned', ['ing-a'], {
      estimatedTimeMinutes: 30,
      difficulty: 'medium',
    });
    const days: DayPlan[] = [{ day: 'Monday', baseMealId: 'planned', variants: [] }];
    // Include `planned` so plan-day ingredients resolve (same as WeeklyPlanner using full baseMeals).
    const ranked = rankWeeklySuggestedMeals(
      [isolated, shares, planned],
      oneAdult,
      ingredients,
      [],
      [],
      days,
    );
    expect(ranked[0]!.meal.id).toBe('shares');
    expect(ranked[0]!.ingredientReuse).toBeGreaterThan(
      ranked.find((r) => r.meal.id === 'iso')!.ingredientReuse,
    );
  });

  it('tie-break: lower prep time then easier difficulty', () => {
    const a = meal('a', 'A', ['ing-a'], { estimatedTimeMinutes: 40, difficulty: 'hard' });
    const b = meal('b', 'B', ['ing-a'], { estimatedTimeMinutes: 20, difficulty: 'easy' });
    const ranked = rankWeeklySuggestedMeals([a, b], members, ingredients, [], [], []);
    expect(ranked[0]!.meal.id).toBe('b');
  });

  it('theme anchor tie-break: matching tag ranks higher when other signals match', () => {
    const plain = meal('plain', 'Plain', ['ing-a']);
    const themed = { ...meal('themed', 'Themed', ['ing-a']), tags: ['taco'] };
    const anchor: WeeklyAnchor = {
      id: 'anch',
      weekday: 'Tuesday',
      label: 'Taco night',
      matchTags: ['taco'],
      matchStructureTypes: [],
      enabled: true,
    };
    const ranked = rankWeeklySuggestedMeals(
      [plain, themed],
      members,
      ingredients,
      [],
      [],
      [],
      anchor,
    );
    expect(ranked[0]!.meal.id).toBe('themed');
    expect(ranked[0]!.themeMatch).toBe(true);
    expect(ranked[1]!.themeMatch).toBe(false);
  });

  it('theme does not outrank a clearly better-overlap meal', () => {
    const better = meal('better', 'Better fit', ['ing-a', 'ing-b']);
    const worseThemed = { ...meal('worse', 'Worse fit', ['ing-c']), tags: ['taco'] };
    const anchor: WeeklyAnchor = {
      id: 'anch',
      weekday: 'Tuesday',
      label: 'Taco night',
      matchTags: ['taco'],
      matchStructureTypes: [],
      enabled: true,
    };
    const ranked = rankWeeklySuggestedMeals(
      [worseThemed, better],
      members,
      ingredients,
      [],
      [],
      [],
      anchor,
    );
    expect(ranked[0]!.meal.id).toBe('better');
  });

  it('mealMatchesWeeklyAnchor uses exact string equality (meal tag editor lowercases)', () => {
    const anchor: WeeklyAnchor = {
      id: 'anch',
      weekday: 'Tuesday',
      label: 'Taco night',
      matchTags: ['taco'],
      matchStructureTypes: [],
      enabled: true,
    };
    const wrongCase = { ...meal('m1', 'M', ['ing-a']), tags: ['Taco'] };
    const ok = { ...meal('m2', 'M', ['ing-a']), tags: ['taco'] };
    expect(mealMatchesWeeklyAnchor(wrongCase, anchor)).toBe(false);
    expect(mealMatchesWeeklyAnchor(ok, anchor)).toBe(true);
  });
});
