import { describe, it, expect } from 'vitest';
import type { BaseMeal, HouseholdMember, Ingredient } from '../src/types';
import {
  computePreferenceScore,
  computeMealOverlap,
  generateMealExplanation,
  generateShortReason,
  rankWeeklySuggestedMeals,
  generateRescueMeals,
} from '../src/planner';

// ── Shared fixtures ────────────────────────────────────────────────────────

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
    id: 'ing-rice',
    name: 'rice',
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
    id: 'ing-sausage',
    name: 'sausages',
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
    freezerFriendly: true,
    babySafeWithAdaptation: true,
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
    id: 'ing-sweet-potato',
    name: 'sweet potato',
    category: 'veg',
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

const adult: HouseholdMember = {
  id: 'm-adult',
  name: 'Alex',
  role: 'adult',
  safeFoods: ['chicken breast', 'broccoli'],
  hardNoFoods: ['mushrooms'],
  preparationRules: [],
  textureLevel: 'regular',
  allergens: [],
  notes: '',
};

const toddler: HouseholdMember = {
  id: 'm-toddler',
  name: 'Indy',
  role: 'toddler',
  safeFoods: ['sausages', 'pasta'],
  hardNoFoods: [],
  preparationRules: [],
  textureLevel: 'regular',
  allergens: [],
  notes: '',
};

/** Meal A: contains adult safe food (chicken, broccoli) */
const mealA: BaseMeal = {
  id: 'meal-a',
  name: 'Chicken Broccoli Rice',
  components: [
    { ingredientId: 'ing-chicken', role: 'protein', quantity: '500g' },
    { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
    { ingredientId: 'ing-rice', role: 'carb', quantity: '300g' },
  ],
  defaultPrep: 'grill chicken, steam broccoli, cook rice',
  estimatedTimeMinutes: 30,
  difficulty: 'easy',
  rescueEligible: true,
  wasteReuseHints: [],
};

/** Meal B: contains toddler safe food (sausages, pasta) */
const mealB: BaseMeal = {
  id: 'meal-b',
  name: 'Sausage Pasta',
  components: [
    { ingredientId: 'ing-sausage', role: 'protein', quantity: '400g' },
    { ingredientId: 'ing-pasta', role: 'carb', quantity: '300g' },
    { ingredientId: 'ing-broccoli', role: 'veg', quantity: '200g' },
  ],
  defaultPrep: 'cook sausages, boil pasta, steam broccoli',
  estimatedTimeMinutes: 25,
  difficulty: 'easy',
  rescueEligible: true,
  wasteReuseHints: [],
};

/** Meal C: contains adult hard-no (mushrooms) */
const mealC: BaseMeal = {
  id: 'meal-c',
  name: 'Mushroom Risotto',
  components: [
    { ingredientId: 'ing-mushrooms', role: 'veg', quantity: '200g' },
    { ingredientId: 'ing-rice', role: 'carb', quantity: '300g' },
  ],
  defaultPrep: 'sauté mushrooms, cook risotto',
  estimatedTimeMinutes: 35,
  difficulty: 'medium',
  rescueEligible: false,
  wasteReuseHints: [],
};

/** Meal D: no safe food matches for anyone */
const mealD: BaseMeal = {
  id: 'meal-d',
  name: 'Salmon Dinner',
  components: [
    { ingredientId: 'ing-salmon', role: 'protein', quantity: '400g' },
    { ingredientId: 'ing-sweet-potato', role: 'veg', quantity: '300g' },
  ],
  defaultPrep: 'bake salmon with sweet potato',
  estimatedTimeMinutes: 40,
  difficulty: 'medium',
  rescueEligible: false,
  wasteReuseHints: [],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('F074: computePreferenceScore', () => {
  it('gives positive score when meal contains a member safe food', () => {
    const result = computePreferenceScore(mealA, [adult], ingredients);
    expect(result.score).toBeGreaterThan(0);
    expect(result.safeFoodMatches.length).toBeGreaterThan(0);
    expect(result.safeFoodMatches.some((m) => m.ingredientName === 'chicken breast')).toBe(true);
  });

  it('gives negative score when meal contains a member hard-no', () => {
    const result = computePreferenceScore(mealC, [adult], ingredients);
    expect(result.score).toBeLessThan(0);
    expect(result.hardNoConflicts.length).toBe(1);
    expect(result.hardNoConflicts[0]!.ingredientName).toBe('mushrooms');
  });

  it('returns zero when no safe foods or hard-nos match', () => {
    const neutralMember: HouseholdMember = {
      ...adult,
      safeFoods: [],
      hardNoFoods: [],
    };
    const result = computePreferenceScore(mealA, [neutralMember], ingredients);
    expect(result.score).toBe(0);
    expect(result.safeFoodMatches).toHaveLength(0);
    expect(result.hardNoConflicts).toHaveLength(0);
  });
});

describe('F074: safe food meal ranks higher', () => {
  it('meal with safe food ingredient scores higher than meal without when overlap equal', () => {
    // mealA has adult safe foods (chicken, broccoli), mealD has none for adult
    const scoreA = computePreferenceScore(mealA, [adult], ingredients);
    const scoreD = computePreferenceScore(mealD, [adult], ingredients);
    expect(scoreA.score).toBeGreaterThan(scoreD.score);
  });

  it('meal with toddler safe food scores higher than equivalent adult-only safe food', () => {
    // mealB has toddler safe foods (sausages, pasta), mealA has adult safe foods (chicken, broccoli)
    // Both have broccoli (adult safe food), but mealB also has toddler safe foods
    const scoreBToddler = computePreferenceScore(mealB, [toddler], ingredients);
    const scoreAAdult = computePreferenceScore(mealA, [adult], ingredients);
    // Toddler boost (5) per match > adult boost (2) per match, so with same match count
    // toddler influence should be stronger
    expect(scoreBToddler.score).toBeGreaterThan(scoreAAdult.score);
  });
});

describe('F074: hard-no meal is excluded or deprioritised', () => {
  it('hard-no ingredient creates strong negative preference score', () => {
    const result = computePreferenceScore(mealC, [adult], ingredients);
    expect(result.score).toBeLessThanOrEqual(-10);
    expect(result.hardNoConflicts[0]!.memberName).toBe('Alex');
  });

  it('overlap marks hard-no as conflict', () => {
    const overlap = computeMealOverlap(mealC, [adult], ingredients);
    const detail = overlap.memberDetails.find((d) => d.memberId === 'm-adult');
    expect(detail!.compatibility).toBe('conflict');
    expect(detail!.conflicts.some((c) => c.includes('mushrooms'))).toBe(true);
  });
});

describe('F074: role weighting — toddler boost stronger than adult', () => {
  it('toddler safe food boost outweighs adult safe food boost for same ingredient count', () => {
    // 2 toddler safe food matches (sausages, pasta) at 5 each = 10
    const toddlerScore = computePreferenceScore(mealB, [toddler], ingredients);
    // 2 adult safe food matches (chicken, broccoli) at 2 each = 4
    const adultScore = computePreferenceScore(mealA, [adult], ingredients);
    expect(toddlerScore.score).toBeGreaterThan(adultScore.score);
  });
});

describe('F074: explanation strings cite ledger reasons', () => {
  it('explanation trade-offs mention member-safe ingredient', () => {
    const explanation = generateMealExplanation(mealB, [adult, toddler], ingredients);
    const safeRef = explanation.tradeOffs.find((t) => t.includes('Indy-safe'));
    expect(safeRef).toBeDefined();
    expect(safeRef).toContain('sausages');
  });

  it('explanation trade-offs surface toddler gap with fallback foods', () => {
    // mealD has no toddler safe food
    const explanation = generateMealExplanation(mealD, [toddler], ingredients);
    const gap = explanation.tradeOffs.find((t) => t.includes('no safe food'));
    expect(gap).toBeDefined();
    expect(gap).toContain('sausages');
  });

  it('short reason surfaces safe food match', () => {
    const reason = generateShortReason(mealA, [adult], ingredients);
    expect(reason).toContain('Alex-safe');
  });

  it('short reason surfaces hard-no detail when zero overlap', () => {
    const reason = generateShortReason(mealC, [adult], ingredients);
    expect(reason).toContain('hard-no');
    expect(reason).toContain('mushrooms');
  });
});

describe('F074: surface parity across ranking surfaces', () => {
  const allMembers = [adult, toddler];
  const allMeals = [mealA, mealB, mealC, mealD];

  it('rankWeeklySuggestedMeals includes preferenceScore field', () => {
    const rows = rankWeeklySuggestedMeals(allMeals, allMembers, ingredients, [], [], []);
    expect(rows[0]!.preferenceScore).toBeDefined();
    // Meal with hard-no should have negative preference score
    const mushroom = rows.find((r) => r.meal.id === 'meal-c');
    expect(mushroom!.preferenceScore).toBeLessThan(0);
  });

  it('rankWeeklySuggestedMeals ranks safe-food meal above no-match meal', () => {
    const rows = rankWeeklySuggestedMeals(allMeals, allMembers, ingredients, [], [], []);
    const idxB = rows.findIndex((r) => r.meal.id === 'meal-b');
    const idxD = rows.findIndex((r) => r.meal.id === 'meal-d');
    expect(idxB).toBeLessThan(idxD);
  });

  it('rescue mode factors preference score', () => {
    const rescueMeals = [
      { ...mealA, rescueEligible: true } as BaseMeal,
      { ...mealD, rescueEligible: true, estimatedTimeMinutes: 30, difficulty: 'easy' as const },
    ];
    const results = generateRescueMeals(rescueMeals, allMembers, ingredients, 'everyone-melting-down');
    // mealA has safe food matches, should rank first
    expect(results[0]!.meal.id).toBe('meal-a');
  });
});
