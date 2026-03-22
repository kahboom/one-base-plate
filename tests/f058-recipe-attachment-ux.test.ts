import { describe, it, expect } from "vitest";
import type {
  BaseMeal,
  Recipe,
  MealComponent,
  ComponentRecipeRef,
  Ingredient,
  DayPlan,
} from "../src/types";
import {
  resolveFullCookingRef,
  resolveComponentEffectiveRef,
  getDefaultRecipeRef,
  summarizeRecipeRef,
  countMealRecipes,
  hasBatchPrepRecipe,
  hasPrepAheadRecipe,
  findPrepAheadOpportunities,
  applySessionOverridesToMeal,
} from "../src/lib/componentRecipes";

function makeIngredient(
  overrides: Partial<Ingredient> & { id: string; name: string },
): Ingredient {
  return {
    category: "pantry",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    ...overrides,
  };
}

function makeComponent(
  overrides: Partial<MealComponent> & { ingredientId: string },
): MealComponent {
  return {
    role: "protein",
    quantity: "1",
    ...overrides,
  };
}

function makeRecipe(
  overrides: Partial<Recipe> & { id: string; name: string },
): Recipe {
  return {
    components: [],
    ...overrides,
  };
}

function makeBaseMeal(
  overrides: Partial<BaseMeal> & { id: string; name: string },
): BaseMeal {
  return {
    components: [],
    defaultPrep: "",
    estimatedTimeMinutes: 30,
    difficulty: "medium",
    rescueEligible: false,
    wasteReuseHints: [],
    ...overrides,
  };
}

function makeRef(
  overrides: Partial<ComponentRecipeRef> & { id: string },
): ComponentRecipeRef {
  return {
    componentId: "comp-1",
    sourceType: "internal-meal",
    label: "Test ref",
    ...overrides,
  };
}

describe("F058 — resolveFullCookingRef priority chain", () => {
  const chicken = makeIngredient({ id: "ing-chicken", name: "chicken" });
  const rice = makeIngredient({
    id: "ing-rice",
    name: "rice",
    defaultRecipeRefs: [{ recipeId: "recipe-rice", label: "Default rice method", role: "component" }],
  });

  const comp = makeComponent({
    id: "comp-1",
    ingredientId: "ing-chicken",
    prepNote: "Grill 200°C 25 min",
    recipeRefs: [
      makeRef({ id: "cr-1", label: "My chicken recipe", isDefault: true }),
    ],
  });

  const meal = makeBaseMeal({
    id: "meal-1",
    name: "Chicken and rice",
    components: [comp],
    recipeRefs: [{ recipeId: "recipe-whole", label: "Full dinner recipe", role: "primary" }],
    recipeLinks: [{ label: "Gousto", url: "https://gousto.co.uk/recipe/123" }],
  });

  const ingredients = [chicken, rice];

  it("returns session override as highest priority", () => {
    const sessionOverrides = new Map<string, ComponentRecipeRef>();
    sessionOverrides.set("comp-1", makeRef({ id: "tonight-1", label: "Quick stir-fry" }));

    const result = resolveFullCookingRef(comp, meal, ingredients, { sessionOverrides });
    expect(result.source).toBe("session");
    expect(result.sourceLabel).toBe("Tonight override");
    expect(result.effective?.label).toBe("Quick stir-fry");
  });

  it("returns plan override when no session override", () => {
    const planOverrides: ComponentRecipeRef[] = [
      makeRef({ id: "plan-1", componentId: "comp-1", label: "Plan override" }),
    ];

    const result = resolveFullCookingRef(comp, meal, ingredients, { planOverrides });
    expect(result.source).toBe("plan");
    expect(result.effective?.label).toBe("Plan override");
  });

  it("returns component default when no session/plan", () => {
    const result = resolveFullCookingRef(comp, meal, ingredients, {});
    expect(result.source).toBe("component");
    expect(result.sourceLabel).toBe("Component default");
    expect(result.effective?.label).toBe("My chicken recipe");
  });

  it("falls back to meal recipeRefs when no component recipe", () => {
    const bareComp = makeComponent({ id: "comp-bare", ingredientId: "ing-chicken" });
    const result = resolveFullCookingRef(bareComp, meal, ingredients, {});
    expect(result.source).toBe("meal");
    expect(result.sourceLabel).toBe("Whole-meal recipe");
    expect(result.effective?.label).toBe("Full dinner recipe");
  });

  it("falls back to ingredient defaultRecipeRefs when no meal refs", () => {
    const riceComp = makeComponent({ id: "comp-rice", ingredientId: "ing-rice" });
    const noRefMeal = makeBaseMeal({ id: "meal-2", name: "Plain rice" });
    const result = resolveFullCookingRef(riceComp, noRefMeal, ingredients, {});
    expect(result.source).toBe("ingredient");
    expect(result.sourceLabel).toBe("Ingredient default");
    expect(result.effective?.label).toBe("Default rice method");
  });

  it("falls back to prepNote when no refs at any level", () => {
    const noteComp = makeComponent({
      id: "comp-note",
      ingredientId: "ing-chicken",
      prepNote: "Grill 200°C 25 min",
    });
    const noRefMeal = makeBaseMeal({ id: "meal-3", name: "Simple chicken" });
    const result = resolveFullCookingRef(noteComp, noRefMeal, [chicken], {});
    expect(result.source).toBe("prepNote");
    expect(result.effective?.notes).toBe("Grill 200°C 25 min");
  });

  it("falls back to meal recipeLinks when nothing else", () => {
    const bareComp = makeComponent({ id: "comp-bare2", ingredientId: "ing-chicken" });
    const linkMeal = makeBaseMeal({
      id: "meal-link",
      name: "Link meal",
      recipeLinks: [{ label: "Gousto", url: "https://gousto.co.uk" }],
    });
    const result = resolveFullCookingRef(bareComp, linkMeal, [chicken], {});
    expect(result.source).toBe("prepNote");
    expect(result.sourceLabel).toBe("Recipe link");
    expect(result.effective?.url).toBe("https://gousto.co.uk");
  });

  it("returns none when no recipe info anywhere", () => {
    const bareComp = makeComponent({ id: "comp-empty", ingredientId: "ing-chicken" });
    const emptyMeal = makeBaseMeal({ id: "meal-empty", name: "Empty" });
    const result = resolveFullCookingRef(bareComp, emptyMeal, [chicken], {});
    expect(result.source).toBe("none");
    expect(result.effective).toBeUndefined();
  });
});

describe("F058 — resolveComponentEffectiveRef backwards compatibility", () => {
  it("still resolves session > plan > default > none", () => {
    const comp = makeComponent({
      id: "c1",
      ingredientId: "x",
      recipeRefs: [makeRef({ id: "def", isDefault: true, label: "Default" })],
    });

    const none = resolveComponentEffectiveRef(comp, {});
    expect(none.source).toBe("default");

    const session = new Map<string, ComponentRecipeRef>();
    session.set("c1", makeRef({ id: "s1", label: "Tonight" }));
    const sessionResult = resolveComponentEffectiveRef(comp, { sessionOverrides: session });
    expect(sessionResult.source).toBe("session");
  });
});

describe("F058 — tonight override vs saved default", () => {
  it("applySessionOverridesToMeal merges session to defaults without touching recipeRefs", () => {
    const comp = makeComponent({ id: "c1", ingredientId: "x" });
    const meal = makeBaseMeal({
      id: "m1",
      name: "Meal",
      components: [comp],
      recipeRefs: [{ recipeId: "r1", role: "primary" }],
    });
    const overrides = new Map<string, ComponentRecipeRef>();
    overrides.set("c1", makeRef({ id: "override-1", componentId: "c1", label: "Saved override" }));

    const result = applySessionOverridesToMeal(meal, overrides);
    expect(result.recipeRefs).toEqual(meal.recipeRefs);
    expect(result.components[0]!.recipeRefs![0]!.isDefault).toBe(true);
    expect(result.components[0]!.recipeRefs![0]!.label).toBe("Saved override");
  });
});

describe("F058 — countMealRecipes", () => {
  it("counts meal-level and component-level refs", () => {
    const meal = makeBaseMeal({
      id: "m1",
      name: "Test",
      recipeRefs: [{ recipeId: "r1", role: "primary" }],
      components: [
        makeComponent({
          id: "c1",
          ingredientId: "x",
          recipeRefs: [makeRef({ id: "cr1" }), makeRef({ id: "cr2", notes: "alt:y" })],
        }),
      ],
    });
    expect(countMealRecipes(meal)).toBe(2);
  });

  it("excludes alt-protein markers from count", () => {
    const meal = makeBaseMeal({
      id: "m2",
      name: "Test2",
      components: [
        makeComponent({
          id: "c1",
          ingredientId: "x",
          recipeRefs: [
            makeRef({ id: "cr1", notes: "alt:a" }),
            makeRef({ id: "cr2", notes: "alt:b" }),
          ],
        }),
      ],
    });
    expect(countMealRecipes(meal)).toBe(0);
  });

  it("returns 0 for meals with no recipes", () => {
    const meal = makeBaseMeal({ id: "m3", name: "Empty" });
    expect(countMealRecipes(meal)).toBe(0);
  });
});

describe("F058 — hasBatchPrepRecipe", () => {
  it("detects batch-prep from meal recipeRefs role", () => {
    const meal = makeBaseMeal({
      id: "m1",
      name: "Test",
      recipeRefs: [{ recipeId: "r1", role: "batch-prep" }],
    });
    expect(hasBatchPrepRecipe(meal, [])).toBe(true);
  });

  it("detects batch-prep from recipe library type", () => {
    const meal = makeBaseMeal({
      id: "m2",
      name: "Test",
      recipeRefs: [{ recipeId: "r1", role: "primary" }],
    });
    const recipes = [makeRecipe({ id: "r1", name: "Batch", recipeType: "batch-prep" })];
    expect(hasBatchPrepRecipe(meal, recipes)).toBe(true);
  });

  it("returns false for no batch-prep", () => {
    const meal = makeBaseMeal({
      id: "m3",
      name: "Test",
      recipeRefs: [{ recipeId: "r1", role: "primary" }],
    });
    const recipes = [makeRecipe({ id: "r1", name: "Normal", recipeType: "whole-meal" })];
    expect(hasBatchPrepRecipe(meal, recipes)).toBe(false);
  });
});

describe("F058 — hasPrepAheadRecipe", () => {
  it("detects prep-ahead from component recipeRefs", () => {
    const meal = makeBaseMeal({
      id: "m1",
      name: "Test",
      components: [
        makeComponent({
          id: "c1",
          ingredientId: "x",
          recipeRefs: [makeRef({ id: "cr1", recipeId: "r-batch" })],
        }),
      ],
    });
    const recipes = [makeRecipe({ id: "r-batch", name: "Batch prep", recipeType: "batch-prep" })];
    expect(hasPrepAheadRecipe(meal, recipes)).toBe(true);
  });
});

describe("F058 — findPrepAheadOpportunities", () => {
  const chicken = makeIngredient({ id: "ing-chicken", name: "chicken" });
  const rice = makeIngredient({ id: "ing-rice", name: "rice" });

  it("finds repeated ingredients with batch-prep recipes across days", () => {
    const meal1 = makeBaseMeal({
      id: "m1",
      name: "Meal A",
      components: [makeComponent({ ingredientId: "ing-chicken" })],
    });
    const meal2 = makeBaseMeal({
      id: "m2",
      name: "Meal B",
      components: [makeComponent({ ingredientId: "ing-chicken" })],
    });
    const batchRecipe = makeRecipe({
      id: "batch-chicken",
      name: "Batch chicken",
      recipeType: "batch-prep",
      components: [makeComponent({ ingredientId: "ing-chicken" })],
    });
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "m1", variants: [] },
      { day: "Wednesday", baseMealId: "m2", variants: [] },
    ];

    const opps = findPrepAheadOpportunities(days, [meal1, meal2], [batchRecipe], [chicken, rice]);
    expect(opps.length).toBe(1);
    expect(opps[0]!.ingredientId).toBe("ing-chicken");
    expect(opps[0]!.dayLabels).toContain("Monday");
    expect(opps[0]!.dayLabels).toContain("Wednesday");
    expect(opps[0]!.recipeName).toBe("Batch chicken");
  });

  it("returns empty when ingredients appear only once", () => {
    const meal1 = makeBaseMeal({
      id: "m1",
      name: "Meal A",
      components: [makeComponent({ ingredientId: "ing-chicken" })],
    });
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "m1", variants: [] },
    ];
    const opps = findPrepAheadOpportunities(days, [meal1], [], [chicken]);
    expect(opps.length).toBe(0);
  });

  it("returns empty when repeated ingredient has no batch-prep recipe", () => {
    const meal1 = makeBaseMeal({
      id: "m1",
      name: "Meal A",
      components: [makeComponent({ ingredientId: "ing-chicken" })],
    });
    const meal2 = makeBaseMeal({
      id: "m2",
      name: "Meal B",
      components: [makeComponent({ ingredientId: "ing-chicken" })],
    });
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "m1", variants: [] },
      { day: "Tuesday", baseMealId: "m2", variants: [] },
    ];
    const opps = findPrepAheadOpportunities(days, [meal1, meal2], [], [chicken]);
    expect(opps.length).toBe(0);
  });
});

describe("F058 — alternative-protein recipe handling", () => {
  it("alt-protein recipe refs use alt: prefix convention", () => {
    const comp = makeComponent({
      id: "c1",
      ingredientId: "ing-chicken",
      alternativeIngredientIds: ["ing-tofu"],
      recipeRefs: [
        makeRef({ id: "cr-default", label: "Default chicken", isDefault: true }),
        makeRef({ id: "cr-alt-tofu", label: "Tofu stir-fry", notes: "alt:ing-tofu" }),
      ],
    });

    const defaultRef = getDefaultRecipeRef(comp);
    expect(defaultRef?.label).toBe("Default chicken");

    const altRef = comp.recipeRefs!.find((r) => r.notes === "alt:ing-tofu");
    expect(altRef).toBeDefined();
    expect(altRef?.label).toBe("Tofu stir-fry");
  });

  it("alt-protein refs are excluded from countMealRecipes", () => {
    const meal = makeBaseMeal({
      id: "m1",
      name: "Meal",
      components: [
        makeComponent({
          id: "c1",
          ingredientId: "ing-chicken",
          recipeRefs: [
            makeRef({ id: "cr-1", label: "Main", isDefault: true }),
            makeRef({ id: "cr-2", label: "Alt tofu", notes: "alt:ing-tofu" }),
          ],
        }),
      ],
    });
    expect(countMealRecipes(meal)).toBe(1);
  });
});

describe("F058 — summarizeRecipeRef", () => {
  it("summarizes note refs", () => {
    expect(
      summarizeRecipeRef(makeRef({ id: "1", sourceType: "note", notes: "200°C 25 min", label: "Prep note" })),
    ).toBe("200°C 25 min");
  });

  it("summarizes URL refs", () => {
    expect(
      summarizeRecipeRef(makeRef({ id: "2", sourceType: "external-url", label: "Recipe site", url: "https://example.com" })),
    ).toBe("Recipe site");
  });

  it("summarizes linked meal refs", () => {
    expect(
      summarizeRecipeRef(
        makeRef({ id: "3", sourceType: "internal-meal", linkedBaseMealId: "m1", label: "" }),
        { linkedMealName: "Chicken tikka" },
      ),
    ).toBe("Chicken tikka");
  });

  it("falls back to label", () => {
    expect(summarizeRecipeRef(makeRef({ id: "4", label: "Custom label" }))).toBe("Custom label");
  });
});
