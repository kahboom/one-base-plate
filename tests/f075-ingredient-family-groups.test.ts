import { describe, it, expect } from 'vitest';
import type { BaseMeal, HouseholdMember, Ingredient } from '../src/types';
import {
  computePreferenceScore,
  generateMealExplanation,
  generateShortReason,
  rankWeeklySuggestedMeals,
  generateRescueMeals,
} from '../src/planner';

// ── Shared fixtures ────────────────────────────────────────────────────────

const ingredients: Ingredient[] = [
  {
    id: 'ing-italian-sausage',
    name: 'italian sausage',
    aliases: ['mild italian sausage'],
    familyKeys: ['sausage'],
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-penne',
    name: 'penne',
    familyKeys: ['pasta'],
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-fusilli',
    name: 'fusilli',
    familyKeys: ['pasta'],
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-greek-yogurt',
    name: 'greek yogurt',
    familyKeys: ['yogurt'],
    category: 'dairy',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-strawberry-yogurt',
    name: 'strawberry yogurt',
    familyKeys: ['yogurt'],
    category: 'dairy',
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
    id: 'ing-broccoli',
    name: 'broccoli',
    category: 'veg',
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
  // Alias isolation test ingredient: has alias containing "sausage" but no sausage familyKey
  {
    id: 'ing-sausage-patty',
    name: 'veggie patty',
    aliases: ['sausage patty'],
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
];

const toddler: HouseholdMember = {
  id: 'mem-toddler',
  name: 'Indy',
  role: 'toddler',
  safeFoods: ['chicken breast'], // exact safe food
  hardNoFoods: [],
  safeFoodFamilyKeys: ['sausage', 'pasta'],
  hardNoFoodFamilyKeys: [],
  preparationRules: [],
  textureLevel: 'regular',
  allergens: [],
  notes: '',
};

const adult: HouseholdMember = {
  id: 'mem-adult',
  name: 'Alex',
  role: 'adult',
  safeFoods: [],
  hardNoFoods: [],
  safeFoodFamilyKeys: [],
  hardNoFoodFamilyKeys: ['yogurt'],
  preparationRules: [],
  textureLevel: 'regular',
  allergens: [],
  notes: '',
};

function makeMeal(id: string, name: string, ingredientIds: string[]): BaseMeal {
  return {
    id,
    name,
    components: ingredientIds.map((iid, i) => ({
      ingredientId: iid,
      role: i === 0 ? 'protein' : i === 1 ? 'carb' : 'veg',
      quantity: '1',
    })),
    defaultPrep: 'Cook',
    estimatedTimeMinutes: 20,
    difficulty: 'easy',
    rescueEligible: true,
    wasteReuseHints: [],
  };
}

const mealWithSausage = makeMeal('m-sausage', 'Sausage pasta', [
  'ing-italian-sausage',
  'ing-penne',
  'ing-broccoli',
]);

const mealWithChicken = makeMeal('m-chicken', 'Chicken rice', [
  'ing-chicken',
  'ing-rice',
  'ing-broccoli',
]);

const mealWithYogurt = makeMeal('m-yogurt', 'Yogurt bowl', [
  'ing-chicken',
  'ing-greek-yogurt',
  'ing-broccoli',
]);

const mealNoMatch = makeMeal('m-plain', 'Plain rice', ['ing-rice', 'ing-broccoli']);

const mealWithPatty = makeMeal('m-patty', 'Veggie patty meal', [
  'ing-sausage-patty',
  'ing-rice',
  'ing-broccoli',
]);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('F075 — Grouped ingredient-family preferences', () => {
  const members = [toddler, adult];

  describe('computePreferenceScore', () => {
    it('applies grouped safe-food family boost', () => {
      // Sausage meal: toddler has safeFoodFamilyKeys: ['sausage', 'pasta']
      // italian sausage has familyKeys: ['sausage'], penne has familyKeys: ['pasta']
      const result = computePreferenceScore(mealWithSausage, members, ingredients);
      expect(result.safeFoodFamilyMatches.length).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0);
    });

    it('grouped safe-food family boost is weaker than exact safe-food boost', () => {
      // mealWithChicken has toddler's exact safeFoods: 'chicken breast'
      const exactScore = computePreferenceScore(mealWithChicken, members, ingredients);
      // mealNoMatch + sausage = only family match
      const mealFamilyOnly = makeMeal('m-fam', 'Family only', [
        'ing-italian-sausage',
        'ing-broccoli',
      ]);
      const familyScore = computePreferenceScore(mealFamilyOnly, members, ingredients);

      // exact safe food boost = 5 (child), family boost = 2 (child)
      expect(exactScore.score).toBeGreaterThan(familyScore.score);
    });

    it('applies grouped hard-no family penalty', () => {
      // adult has hardNoFoodFamilyKeys: ['yogurt']
      // greek yogurt has familyKeys: ['yogurt']
      const result = computePreferenceScore(mealWithYogurt, members, ingredients);
      expect(result.hardNoFamilyConflicts.length).toBeGreaterThan(0);
      expect(result.hardNoFamilyConflicts[0]!.familyKey).toBe('yogurt');
      expect(result.hardNoFamilyConflicts[0]!.memberName).toBe('Alex');
    });

    it('grouped hard-no family penalty is weaker than exact hard-no penalty', () => {
      const adultExactHardNo: HouseholdMember = {
        ...adult,
        hardNoFoods: ['greek yogurt'],
        hardNoFoodFamilyKeys: [],
      };
      const exactResult = computePreferenceScore(
        mealWithYogurt,
        [toddler, adultExactHardNo],
        ingredients,
      );

      const familyResult = computePreferenceScore(mealWithYogurt, members, ingredients);

      // exact hard-no = -10, family hard-no = -3
      expect(exactResult.score).toBeLessThan(familyResult.score);
    });

    it('does not double-count when ingredient matches both exact and family', () => {
      const toddlerWithExact: HouseholdMember = {
        ...toddler,
        safeFoods: ['italian sausage'],
        safeFoodFamilyKeys: ['sausage'],
      };
      const result = computePreferenceScore(
        mealWithSausage,
        [toddlerWithExact, adult],
        ingredients,
      );

      // italian sausage should only be counted once (exact), not also as family
      const sausageExactMatches = result.safeFoodMatches.filter(
        (m) => m.ingredientName === 'italian sausage',
      );
      const sausageFamilyMatches = result.safeFoodFamilyMatches.filter(
        (m) => m.ingredientName === 'italian sausage',
      );
      expect(sausageExactMatches.length).toBe(1);
      expect(sausageFamilyMatches.length).toBe(0);
    });

    it('role-weighted family boost: toddler > adult', () => {
      const toddlerOnly: HouseholdMember = {
        ...toddler,
        safeFoods: [],
        safeFoodFamilyKeys: ['sausage'],
      };
      const adultSafe: HouseholdMember = {
        ...adult,
        safeFoodFamilyKeys: ['sausage'],
        hardNoFoodFamilyKeys: [],
      };

      const toddlerScore = computePreferenceScore(mealWithSausage, [toddlerOnly], ingredients);
      const adultScore = computePreferenceScore(mealWithSausage, [adultSafe], ingredients);

      // toddler family boost = 2, adult family boost = 1
      expect(toddlerScore.score).toBeGreaterThan(adultScore.score);
    });
  });

  describe('exact hard-no overrides grouped safe', () => {
    it('exact hard-no still penalizes even when another member has family safe match', () => {
      // adult has exact hardNoFoods for italian sausage
      // toddler has safeFoodFamilyKeys: ['sausage']
      const adultHardNo: HouseholdMember = {
        ...adult,
        hardNoFoods: ['italian sausage'],
        hardNoFoodFamilyKeys: [],
      };
      const result = computePreferenceScore(mealWithSausage, [toddler, adultHardNo], ingredients);

      // The exact hard-no penalty (-10) should dominate
      expect(result.hardNoConflicts.length).toBe(1);
      expect(result.hardNoConflicts[0]!.ingredientName).toBe('italian sausage');
    });

    it('grouped family hard-no does not suppress another member exact safeFoods match', () => {
      // toddler has exact safeFoods: ['chicken breast']
      // adult has hardNoFoodFamilyKeys but NOT for chicken — let's test with a
      // scenario where one member's family hard-no could conflict with another's exact safe
      const toddlerSafe: HouseholdMember = {
        ...toddler,
        safeFoods: ['italian sausage'],
        safeFoodFamilyKeys: [],
      };
      const adultFamilyHardNo: HouseholdMember = {
        ...adult,
        hardNoFoodFamilyKeys: ['sausage'],
      };

      const result = computePreferenceScore(
        mealWithSausage,
        [toddlerSafe, adultFamilyHardNo],
        ingredients,
      );

      // adult's family hard-no for 'sausage' should NOT apply to italian sausage
      // because toddler has exact safeFoods match for it
      expect(result.hardNoFamilyConflicts.length).toBe(0);
      expect(result.safeFoodMatches.length).toBe(1);
    });
  });

  describe('alias isolation', () => {
    it('alias containing family key string does not create accidental family match', () => {
      // ing-sausage-patty has alias 'sausage patty' but NO familyKeys: ['sausage']
      // toddler has safeFoodFamilyKeys: ['sausage']
      const result = computePreferenceScore(mealWithPatty, members, ingredients);

      // No family match should occur for the veggie patty
      const pattyFamilyMatches = result.safeFoodFamilyMatches.filter(
        (m) => m.ingredientName === 'veggie patty',
      );
      expect(pattyFamilyMatches.length).toBe(0);
    });
  });

  describe('no duplicate ingredient requirement', () => {
    it('can express sausage family preference without canonical sausage ingredient', () => {
      // No ingredient named "sausage" exists — only "italian sausage" with familyKeys: ['sausage']
      const sausageIngredient = ingredients.find((i) => i.name === 'sausage');
      expect(sausageIngredient).toBeUndefined();

      const result = computePreferenceScore(mealWithSausage, members, ingredients);
      expect(result.safeFoodFamilyMatches.some((m) => m.familyKey === 'sausage')).toBe(true);
    });
  });

  describe('explanation strings', () => {
    it('generateMealExplanation cites family matches distinctly from exact matches', () => {
      const explanation = generateMealExplanation(mealWithSausage, members, ingredients);

      // Should contain family match citation
      const hasFamilyMatch = explanation.tradeOffs.some(
        (t) => t.includes('sausage family via') || t.includes('pasta family via'),
      );
      expect(hasFamilyMatch).toBe(true);
    });

    it('generateMealExplanation cites grouped hard-no conflict', () => {
      const explanation = generateMealExplanation(mealWithYogurt, members, ingredients);

      const hasGroupedConflict = explanation.tradeOffs.some(
        (t) => t.includes('grouped conflict') && t.includes('yogurt family'),
      );
      expect(hasGroupedConflict).toBe(true);
    });

    it('generateShortReason surfaces family match', () => {
      // Meal with only family match (no exact safe food match for anyone)
      const membersNoExact: HouseholdMember[] = [{ ...toddler, safeFoods: [] }, adult];
      const reason = generateShortReason(mealWithSausage, membersNoExact, ingredients);
      expect(reason).toContain('sausage family');
    });
  });

  describe('surface parity', () => {
    it('rankWeeklySuggestedMeals reflects family preference score', () => {
      const membersNoExact: HouseholdMember[] = [
        { ...toddler, safeFoods: [] },
        { ...adult, hardNoFoodFamilyKeys: [] },
      ];
      const meals = [mealWithSausage, mealNoMatch];

      const rows = rankWeeklySuggestedMeals(meals, membersNoExact, ingredients, [], [], []);

      // Sausage meal should rank higher due to family boost
      expect(rows[0]!.meal.id).toBe('m-sausage');
      expect(rows[0]!.preferenceScore).toBeGreaterThan(rows[1]!.preferenceScore);
    });

    it('generateRescueMeals factors family preference score', () => {
      const membersNoExact: HouseholdMember[] = [
        { ...toddler, safeFoods: [] },
        { ...adult, hardNoFoodFamilyKeys: [] },
      ];
      const meals = [mealWithSausage, mealNoMatch];

      const rescue = generateRescueMeals(meals, membersNoExact, ingredients, 'low-energy');

      // Sausage meal should rank first due to family boost
      expect(rescue.length).toBeGreaterThan(0);
      expect(rescue[0]!.meal.id).toBe('m-sausage');
    });
  });

  describe('import/search unchanged', () => {
    it('familyKeys do not affect alias-based matching', () => {
      // Verify that aliases still exist and are separate from familyKeys
      const sausageIng = ingredients.find((i) => i.id === 'ing-italian-sausage')!;
      expect(sausageIng.aliases).toContain('mild italian sausage');
      expect(sausageIng.familyKeys).toContain('sausage');

      // familyKeys and aliases are distinct arrays
      expect(sausageIng.aliases).not.toEqual(sausageIng.familyKeys);
    });
  });
});
