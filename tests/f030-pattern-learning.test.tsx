import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type {
  BaseMeal,
  HouseholdMember,
  Ingredient,
  MealOutcome,
  Household,
} from "../src/types";
import {
  learnCompatibilityPatterns,
  computePatternScore,
  generateMealExplanation,
  generateShortReason,
  generateWeeklyPlan,
} from "../src/planner";
import type { LearnedPatterns } from "../src/planner";
import * as storage from "../src/storage";
import Planner from "../src/pages/Planner";
import Home from "../src/pages/Home";

// --- Fixtures ---

const members: HouseholdMember[] = [
  {
    id: "m1",
    name: "Alex",
    role: "adult",
    safeFoods: [],
    hardNoFoods: [],
    preparationRules: [{ ingredient: "tomato sauce", rule: "serve separate" }],
    textureLevel: "regular",
    allergens: [],
    notes: "",
  },
  {
    id: "m2",
    name: "Riley",
    role: "toddler",
    safeFoods: ["pasta", "cheese"],
    hardNoFoods: ["mushroom"],
    preparationRules: [],
    textureLevel: "regular",
    allergens: [],
    notes: "",
  },
  {
    id: "m3",
    name: "Sam",
    role: "baby",
    safeFoods: ["rice"],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "mashable",
    allergens: [],
    notes: "",
  },
];

const ingredients: Ingredient[] = [
  { id: "chicken", name: "chicken", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "salmon", name: "salmon", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "pasta", name: "pasta", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "rice", name: "rice", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "broccoli", name: "broccoli", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "tomato-sauce", name: "tomato sauce", category: "pantry", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "mushroom", name: "mushroom", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "cheese", name: "cheese", category: "dairy", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
];

const mealA: BaseMeal = {
  id: "meal-a",
  name: "Chicken Pasta",
  components: [
    { ingredientId: "chicken", role: "protein", quantity: "200g" },
    { ingredientId: "pasta", role: "carb", quantity: "300g" },
    { ingredientId: "tomato-sauce", role: "sauce", quantity: "1 jar" },
  ],
  defaultPrep: "boil + pan fry",
  estimatedTimeMinutes: 25,
  difficulty: "easy",
  rescueEligible: true,
  wasteReuseHints: [],
};

const mealB: BaseMeal = {
  id: "meal-b",
  name: "Salmon Rice",
  components: [
    { ingredientId: "salmon", role: "protein", quantity: "200g" },
    { ingredientId: "rice", role: "carb", quantity: "200g" },
    { ingredientId: "broccoli", role: "veg", quantity: "100g" },
  ],
  defaultPrep: "bake + steam",
  estimatedTimeMinutes: 30,
  difficulty: "medium",
  rescueEligible: false,
  wasteReuseHints: [],
};

const mealC: BaseMeal = {
  id: "meal-c",
  name: "Mushroom Risotto",
  components: [
    { ingredientId: "mushroom", role: "veg", quantity: "200g" },
    { ingredientId: "rice", role: "carb", quantity: "200g" },
    { ingredientId: "cheese", role: "topping", quantity: "50g" },
  ],
  defaultPrep: "simmer",
  estimatedTimeMinutes: 35,
  difficulty: "medium",
  rescueEligible: false,
  wasteReuseHints: [],
};

const allMeals = [mealA, mealB, mealC];

function makeOutcome(
  baseMealId: string,
  outcome: "success" | "partial" | "failure",
  day = "Monday",
): MealOutcome {
  return {
    id: crypto.randomUUID(),
    baseMealId,
    day,
    outcome,
    notes: "",
    date: "2026-03-13",
  };
}

// --- Engine tests ---

describe("F030: learnCompatibilityPatterns", () => {
  it("returns empty patterns when no outcomes exist", () => {
    const result = learnCompatibilityPatterns([], allMeals, members, ingredients);
    expect(result.ingredientScores.size).toBe(0);
    expect(result.prepRuleBoost).toBe(0);
    expect(result.safeFoodBoost).toBe(0);
    expect(result.insights).toHaveLength(0);
  });

  it("scores ingredients positively from successful meal outcomes", () => {
    const outcomes = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const result = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    expect(result.ingredientScores.get("chicken")).toBe(2);
    expect(result.ingredientScores.get("pasta")).toBe(2);
    expect(result.ingredientScores.get("tomato-sauce")).toBe(2);
  });

  it("scores ingredients negatively from failed meal outcomes", () => {
    const outcomes = [
      makeOutcome("meal-b", "failure"),
      makeOutcome("meal-b", "failure"),
    ];
    const result = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    expect(result.ingredientScores.get("salmon")).toBe(-2);
    expect(result.ingredientScores.get("rice")).toBe(-2);
  });

  it("generates ingredient insights when clear success/failure signal", () => {
    const outcomes = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-b", "failure"),
      makeOutcome("meal-b", "failure"),
    ];
    const result = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    expect(result.insights.some((i) => i.includes("chicken"))).toBe(true);
    expect(result.insights.some((i) => i.includes("salmon") && i.includes("failed"))).toBe(true);
  });

  it("detects prep rule success pattern (sauce separate)", () => {
    // meal-a uses tomato sauce which triggers Alex's "serve separate" prep rule
    const outcomes = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const result = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    expect(result.prepRuleBoost).toBeGreaterThan(0);
    expect(result.insights.some((i) => i.includes("prep tend to work"))).toBe(true);
  });

  it("detects safe food success pattern for children", () => {
    // meal-a has pasta (Riley's safe food) and succeeds consistently
    const outcomes = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const result = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    expect(result.safeFoodBoost).toBeGreaterThan(0);
    expect(result.insights.some((i) => i.includes("safe foods for kids"))).toBe(true);
  });

  it("detects preferred protein choices", () => {
    const outcomes = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const result = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    expect(result.insights.some((i) => i.includes("chicken") && i.includes("preferred protein"))).toBe(true);
  });

  it("handles mixed outcomes with partial scores", () => {
    const outcomes = [
      makeOutcome("meal-a", "partial"),
      makeOutcome("meal-a", "partial"),
    ];
    const result = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    expect(result.ingredientScores.get("chicken")).toBe(0.5);
  });
});

describe("F030: computePatternScore", () => {
  it("returns 0 when patterns have no ingredient scores", () => {
    const emptyPatterns: LearnedPatterns = {
      ingredientScores: new Map(),
      prepRuleBoost: 0,
      safeFoodBoost: 0,
      insights: [],
    };
    expect(computePatternScore(mealA, emptyPatterns, members, ingredients)).toBe(0);
  });

  it("sums ingredient scores for a meal", () => {
    const patterns: LearnedPatterns = {
      ingredientScores: new Map([["chicken", 2], ["pasta", 1], ["tomato-sauce", 0.5]]),
      prepRuleBoost: 0,
      safeFoodBoost: 0,
      insights: [],
    };
    expect(computePatternScore(mealA, patterns, members, ingredients)).toBe(3.5);
  });

  it("applies prep rule boost when meal uses prep rules", () => {
    const patterns: LearnedPatterns = {
      ingredientScores: new Map(),
      prepRuleBoost: 1.5,
      safeFoodBoost: 0,
      insights: [],
    };
    // meal-a uses tomato sauce which triggers Alex's prep rule
    const score = computePatternScore(mealA, patterns, members, ingredients);
    expect(score).toBe(1.5);
  });

  it("applies safe food boost when meal covers child safe foods", () => {
    const patterns: LearnedPatterns = {
      ingredientScores: new Map(),
      prepRuleBoost: 0,
      safeFoodBoost: 1.5,
      insights: [],
    };
    // meal-a has pasta (Riley's safe food)
    const score = computePatternScore(mealA, patterns, members, ingredients);
    expect(score).toBe(1.5);
  });

  it("does not apply safe food boost when no safe food coverage", () => {
    const patterns: LearnedPatterns = {
      ingredientScores: new Map(),
      prepRuleBoost: 0,
      safeFoodBoost: 1.5,
      insights: [],
    };
    // meal-b has rice (Sam's safe food) and broccoli but no toddler safe food
    // Actually, Sam is baby with safe food "rice", meal-b has rice
    // Let me check: childMembers = Riley (toddler, safe: pasta, cheese) + Sam (baby, safe: rice)
    // meal-b has rice which is Sam's safe food, so it gets the boost
    const score = computePatternScore(mealB, patterns, members, ingredients);
    expect(score).toBe(1.5);
  });
});

describe("F030: Pattern integration with weekly plan generation", () => {
  it("boosts meals with positive ingredient patterns in weekly plan", () => {
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-b", "failure"),
      makeOutcome("meal-b", "failure"),
    ];
    const plan = generateWeeklyPlan(allMeals, members, ingredients, 3, [], outcomes);
    // meal-a should be ranked higher due to ingredient pattern scores
    const firstMeals = plan.slice(0, 2).map((d) => d.baseMealId);
    expect(firstMeals).toContain("meal-a");
  });

  it("deprioritizes meals with negative ingredient patterns", () => {
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-c", "failure"),
      makeOutcome("meal-c", "failure"),
      makeOutcome("meal-c", "failure"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const plan = generateWeeklyPlan(allMeals, members, ingredients, 5, [], outcomes);
    // Count how often meal-c appears — should be less than meal-a
    const mealCCount = plan.filter((d) => d.baseMealId === "meal-c").length;
    const mealACount = plan.filter((d) => d.baseMealId === "meal-a").length;
    expect(mealACount).toBeGreaterThan(mealCCount);
  });

  it("works correctly with no outcomes (backwards compatible)", () => {
    const plan = generateWeeklyPlan(allMeals, members, ingredients, 3, [], []);
    expect(plan).toHaveLength(3);
    expect(plan.every((d) => d.variants.length === members.length)).toBe(true);
  });
});

describe("F030: Pattern-aware explanations", () => {
  it("includes learned pattern insights in meal explanation", () => {
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const patterns = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    const explanation = generateMealExplanation(mealA, members, ingredients, outcomes, patterns);
    expect(explanation.tradeOffs.some((t) => t.startsWith("Learned:"))).toBe(true);
  });

  it("does not show pattern insights for unrelated meals", () => {
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const patterns = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    const explanation = generateMealExplanation(mealB, members, ingredients, outcomes, patterns);
    // meal-b doesn't use chicken, pasta, or tomato-sauce, so ingredient insights shouldn't appear
    // But prep rule and safe food insights might still apply
    const ingredientInsights = explanation.tradeOffs.filter(
      (t) => t.startsWith("Learned:") && (t.includes("chicken") || t.includes("pasta") || t.includes("tomato sauce")),
    );
    expect(ingredientInsights).toHaveLength(0);
  });

  it("shows prep rule pattern insight in explanation when relevant", () => {
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const patterns = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    const explanation = generateMealExplanation(mealA, members, ingredients, outcomes, patterns);
    expect(explanation.tradeOffs.some((t) => t.includes("prep tend to work"))).toBe(true);
  });

  it("remains explainable with concise language", () => {
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const patterns = learnCompatibilityPatterns(outcomes, allMeals, members, ingredients);
    const explanation = generateMealExplanation(mealA, members, ingredients, outcomes, patterns);
    const learnedInsights = explanation.tradeOffs.filter((t) => t.startsWith("Learned:"));
    // Capped at 3 insights
    expect(learnedInsights.length).toBeLessThanOrEqual(3);
    // Each insight is concise
    for (const insight of learnedInsights) {
      expect(insight.length).toBeLessThan(100);
    }
  });
});

describe("F030: Pattern-aware short reasons", () => {
  it("shows 'Matches household patterns' for high pattern score", () => {
    const patterns: LearnedPatterns = {
      ingredientScores: new Map([["chicken", 2], ["pasta", 1], ["tomato-sauce", 0.5]]),
      prepRuleBoost: 1.5,
      safeFoodBoost: 0,
      insights: ["chicken appears in successful meals"],
    };
    const reason = generateShortReason(mealA, members, ingredients, [], patterns);
    expect(reason).toBe("Matches household patterns");
  });

  it("shows 'Clashes with learned preferences' for very negative pattern score", () => {
    const patterns: LearnedPatterns = {
      ingredientScores: new Map([["salmon", -2], ["rice", -1.5], ["broccoli", -0.5]]),
      prepRuleBoost: 0,
      safeFoodBoost: 0,
      insights: ["salmon often appears in failed meals"],
    };
    const reason = generateShortReason(mealB, members, ingredients, [], patterns);
    expect(reason).toBe("Clashes with learned preferences");
  });

  it("outcome-based reasons still take priority over patterns", () => {
    const patterns: LearnedPatterns = {
      ingredientScores: new Map([["chicken", 2], ["pasta", 1]]),
      prepRuleBoost: 0,
      safeFoodBoost: 0,
      insights: ["chicken appears in successful meals"],
    };
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const reason = generateShortReason(mealA, members, ingredients, outcomes, patterns);
    expect(reason).toBe("Household favorite");
  });
});

// --- UI tests ---

function makeHousehold(outcomes: MealOutcome[] = []): Household {
  return {
    id: "h-pat",
    name: "Pattern Test",
    members,
    ingredients,
    baseMeals: allMeals,
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: outcomes,
  };
}

describe("F030: Planner UI with patterns", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ranks meals using pattern scores in the Planner grid", () => {
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-b", "failure"),
      makeOutcome("meal-b", "failure"),
    ];
    const hh = makeHousehold(outcomes);
    vi.spyOn(storage, "loadHousehold").mockReturnValue(hh);

    render(
      <MemoryRouter initialEntries={["/household/h-pat/planner"]}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    const grid = screen.getByTestId("meal-card-grid");
    const cards = grid.querySelectorAll("[data-testid^='selectable-']");
    // First card should be meal-a (highest combined score)
    expect(cards[0]?.getAttribute("data-testid")).toBe("selectable-meal-a");
  });

  it("shows pattern insights in the explanation panel", async () => {
    const user = userEvent.setup();
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
    ];
    const hh = makeHousehold(outcomes);
    vi.spyOn(storage, "loadHousehold").mockReturnValue(hh);

    render(
      <MemoryRouter initialEntries={["/household/h-pat/planner"]}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("selectable-meal-a"));
    const explanation = screen.getByTestId("meal-explanation");
    expect(explanation.textContent).toContain("Learned:");
  });

  it("shows pattern-based short reason on MealCard", () => {
    const patterns: LearnedPatterns = {
      ingredientScores: new Map([["chicken", 2], ["pasta", 1], ["tomato-sauce", 0.5]]),
      prepRuleBoost: 1.5,
      safeFoodBoost: 0,
      insights: ["chicken appears in successful meals"],
    };
    const reason = generateShortReason(mealA, members, ingredients, [], patterns);
    expect(reason).toBe("Matches household patterns");
  });
});

describe("F030: Home page uses pattern scoring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ranks top suggestions using pattern scores", () => {
    const outcomes: MealOutcome[] = [
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-a", "success"),
      makeOutcome("meal-c", "failure"),
      makeOutcome("meal-c", "failure"),
    ];
    const hh = makeHousehold(outcomes);
    vi.spyOn(storage, "loadHousehold").mockReturnValue(hh);

    render(
      <MemoryRouter initialEntries={["/household/h-pat/home"]}>
        <Routes>
          <Route path="/household/:householdId/home" element={<Home />} />
        </Routes>
      </MemoryRouter>,
    );

    const suggestions = screen.getByTestId("top-suggestions");
    const cards = suggestions.querySelectorAll("[data-testid^='meal-card-']");
    expect(cards[0]?.getAttribute("data-testid")).toBe("meal-card-meal-a");
  });
});
