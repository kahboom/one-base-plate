import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, Ingredient, BaseMeal } from "../src/types";
import {
  saveHousehold,
  loadHousehold,
  saveHouseholds,
  loadHouseholds,
  normalizeIngredientName,
  toSentenceCase,
  migrateHouseholdIngredients,
  runMigrationIfNeeded,
} from "../src/storage";
import IngredientManager from "../src/pages/IngredientManager";
import { loadAllIngredientListRows } from "./incremental-load-helpers";

function makeIngredient(overrides: Partial<Ingredient> & { id: string; name: string }): Ingredient {
  return {
    category: "pantry",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h-f047",
    name: "F047 Test Family",
    members: [
      { id: "m1", name: "Parent", role: "adult", safeFoods: [], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" },
    ],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

/* ========== normalizeIngredientName ========== */
describe("normalizeIngredientName", () => {
  it("lowercases names", () => {
    expect(normalizeIngredientName("Chicken Breast")).toBe("chicken breast");
  });

  it("trims whitespace", () => {
    expect(normalizeIngredientName("  pasta  ")).toBe("pasta");
  });

  it("collapses internal spaces", () => {
    expect(normalizeIngredientName("sweet   potato")).toBe("sweet potato");
  });

  it("strips trailing punctuation", () => {
    expect(normalizeIngredientName("tomatoes.")).toBe("tomatoes");
    expect(normalizeIngredientName("rice,")).toBe("rice");
    expect(normalizeIngredientName("bread;")).toBe("bread");
    expect(normalizeIngredientName("peas!")).toBe("peas");
  });

  it("handles combined issues", () => {
    expect(normalizeIngredientName("  Chicken   Breast. ")).toBe("chicken breast");
  });
});

/* ========== toSentenceCase ========== */
describe("toSentenceCase", () => {
  it("capitalizes first letter", () => {
    expect(toSentenceCase("chicken breast")).toBe("Chicken breast");
  });

  it("returns empty string for empty input", () => {
    expect(toSentenceCase("")).toBe("");
  });

  it("preserves rest of string", () => {
    expect(toSentenceCase("baked beans")).toBe("Baked beans");
  });
});

/* ========== migrateHouseholdIngredients ========== */
describe("migrateHouseholdIngredients", () => {
  it("normalizes ingredient names to lowercase", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Chicken Breast", category: "protein" }),
        makeIngredient({ id: "i2", name: "Sweet Potato", category: "veg" }),
      ],
    });
    const result = migrateHouseholdIngredients(household);
    expect(result.normalized).toBe(2);
    expect(household.ingredients[0]!.name).toBe("chicken breast");
    expect(household.ingredients[1]!.name).toBe("sweet potato");
  });

  it("trims and collapses spaces during normalization", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "  baked   beans.  " }),
      ],
    });
    migrateHouseholdIngredients(household);
    expect(household.ingredients[0]!.name).toBe("baked beans");
  });

  it("detects and merges duplicate ingredients after normalization", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Pasta", category: "carb", tags: ["staple"] }),
        makeIngredient({ id: "i2", name: "pasta", category: "carb", tags: ["quick"] }),
        makeIngredient({ id: "i3", name: "  PASTA  ", category: "carb" }),
      ],
    });
    const result = migrateHouseholdIngredients(household);
    expect(result.duplicatesMerged).toBe(2);
    expect(household.ingredients.length).toBe(1);
    expect(household.ingredients[0]!.tags).toContain("staple");
    expect(household.ingredients[0]!.tags).toContain("quick");
  });

  it("picks the most complete ingredient as survivor", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "cheese", category: "dairy" }),
        makeIngredient({ id: "i2", name: "Cheese", category: "dairy", tags: ["rescue"], imageUrl: "img.png", catalogId: "cat-cheese", source: "catalog" }),
      ],
    });
    migrateHouseholdIngredients(household);
    expect(household.ingredients.length).toBe(1);
    expect(household.ingredients[0]!.id).toBe("i2");
    expect(household.ingredients[0]!.imageUrl).toBe("img.png");
  });

  it("reassigns meal component references from duplicate to survivor", () => {
    const meal: BaseMeal = {
      id: "bm1",
      name: "Test meal",
      components: [
        { ingredientId: "i1", role: "carb", quantity: "200g" },
        { ingredientId: "i2", role: "protein", quantity: "300g" },
      ],
      defaultPrep: "",
      estimatedTimeMinutes: 20,
      difficulty: "easy",
      rescueEligible: false,
      wasteReuseHints: [],
    };
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Pasta", category: "carb", tags: ["staple"] }),
        makeIngredient({ id: "i2", name: "pasta", category: "carb" }),
        makeIngredient({ id: "i3", name: "Chicken", category: "protein" }),
      ],
      baseMeals: [meal],
    });
    const result = migrateHouseholdIngredients(household);
    expect(result.referencesUpdated).toBeGreaterThan(0);
    for (const comp of meal.components) {
      expect(household.ingredients.some((i) => i.id === comp.ingredientId)).toBe(true);
    }
  });

  it("reassigns alternative ingredient IDs from duplicate to survivor", () => {
    const meal: BaseMeal = {
      id: "bm1",
      name: "Test meal",
      components: [
        { ingredientId: "i3", alternativeIngredientIds: ["i1", "i2"], role: "protein", quantity: "300g" },
      ],
      defaultPrep: "",
      estimatedTimeMinutes: 20,
      difficulty: "easy",
      rescueEligible: false,
      wasteReuseHints: [],
    };
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Salmon", category: "protein" }),
        makeIngredient({ id: "i2", name: "salmon", category: "protein" }),
        makeIngredient({ id: "i3", name: "Chicken", category: "protein" }),
      ],
      baseMeals: [meal],
    });
    migrateHouseholdIngredients(household);
    const comp = meal.components[0]!;
    expect(comp.alternativeIngredientIds!.length).toBe(1);
    expect(comp.alternativeIngredientIds![0]).not.toBe(comp.ingredientId);
  });

  it("reassigns grocery list references in weekly plans", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Rice", category: "carb", tags: ["staple"] }),
        makeIngredient({ id: "i2", name: "rice", category: "carb" }),
      ],
      weeklyPlans: [
        {
          id: "wp1",
          days: [],
          selectedBaseMeals: [],
          generatedGroceryList: [
            { ingredientId: "i2", name: "rice", category: "carb", quantity: "1", owned: false },
          ],
          notes: "",
        },
      ],
    });
    const result = migrateHouseholdIngredients(household);
    const survivorId = household.ingredients[0]!.id;
    expect(household.weeklyPlans[0]!.generatedGroceryList[0]!.ingredientId).toBe(survivorId);
    expect(result.referencesUpdated).toBeGreaterThan(0);
  });

  it("is idempotent — running twice produces same result", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Chicken Breast", category: "protein" }),
        makeIngredient({ id: "i2", name: "chicken breast", category: "protein", tags: ["quick"] }),
      ],
    });
    migrateHouseholdIngredients(household);
    const afterFirst = JSON.stringify(household);
    const result2 = migrateHouseholdIngredients(household);
    expect(JSON.stringify(household)).toBe(afterFirst);
    expect(result2.normalized).toBe(0);
    expect(result2.duplicatesMerged).toBe(0);
  });

  it("preserves non-duplicate ingredients unchanged", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "pasta", category: "carb" }),
        makeIngredient({ id: "i2", name: "rice", category: "carb" }),
        makeIngredient({ id: "i3", name: "chicken", category: "protein" }),
      ],
    });
    const result = migrateHouseholdIngredients(household);
    expect(result.duplicatesMerged).toBe(0);
    expect(household.ingredients.length).toBe(3);
  });

  it("merges metadata from duplicates into survivor", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Broccoli", category: "veg", freezerFriendly: false }),
        makeIngredient({ id: "i2", name: "broccoli", category: "veg", freezerFriendly: true, babySafeWithAdaptation: true, shelfLifeHint: "5 days" }),
      ],
    });
    migrateHouseholdIngredients(household);
    expect(household.ingredients.length).toBe(1);
    expect(household.ingredients[0]!.freezerFriendly).toBe(true);
    expect(household.ingredients[0]!.babySafeWithAdaptation).toBe(true);
    expect(household.ingredients[0]!.shelfLifeHint).toBe("5 days");
  });
});

/* ========== runMigrationIfNeeded ========== */
describe("runMigrationIfNeeded", () => {
  it("migrates all households and sets migration flag", () => {
    const h1 = makeHousehold({
      id: "h1",
      ingredients: [
        makeIngredient({ id: "i1", name: "Pasta", category: "carb" }),
        makeIngredient({ id: "i2", name: "pasta", category: "carb" }),
      ],
    });
    saveHouseholds([h1]);
    const result = runMigrationIfNeeded();
    expect(result.duplicatesMerged).toBe(1);
    expect(localStorage.getItem("onebaseplate_migrated_v1")).toBe("1");
    const migrated = loadHouseholds();
    expect(migrated[0]!.ingredients.length).toBe(1);
  });

  it("does not re-migrate after flag is set", () => {
    const h1 = makeHousehold({
      id: "h1",
      ingredients: [
        makeIngredient({ id: "i1", name: "Pasta", category: "carb" }),
      ],
    });
    saveHouseholds([h1]);
    runMigrationIfNeeded();
    h1.ingredients.push(makeIngredient({ id: "i2", name: "pasta", category: "carb" }));
    saveHouseholds([h1]);
    const result2 = runMigrationIfNeeded();
    expect(result2.duplicatesMerged).toBe(0);
    expect(loadHouseholds()[0]!.ingredients.length).toBe(2);
  });

  it("handles empty storage gracefully", () => {
    const result = runMigrationIfNeeded();
    expect(result.normalized).toBe(0);
    expect(result.duplicatesMerged).toBe(0);
  });
});

/* ========== End-to-end: ingredient lists still work after migration ========== */
describe("Post-migration end-to-end", () => {
  it("ingredient list renders with sentence-case display after migration", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "chicken breast", category: "protein" }),
        makeIngredient({ id: "i2", name: "sweet potato", category: "veg" }),
      ],
    });
    saveHousehold(household);

    render(
      <MemoryRouter initialEntries={[`/household/h-f047/ingredients`]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );

    loadAllIngredientListRows();

    const loaded = loadHousehold("h-f047")!;
    expect(loaded.ingredients[0]!.name).toBe("chicken breast");
    expect(screen.getByText("Chicken breast")).toBeTruthy();
    expect(screen.getByText("Sweet potato")).toBeTruthy();
  });

  it("meal associations remain valid after migration with duplicates", () => {
    const meal: BaseMeal = {
      id: "bm1",
      name: "Test meal",
      components: [
        { ingredientId: "i1", role: "carb", quantity: "200g" },
        { ingredientId: "i2", role: "protein", quantity: "300g" },
      ],
      defaultPrep: "",
      estimatedTimeMinutes: 20,
      difficulty: "easy",
      rescueEligible: false,
      wasteReuseHints: [],
    };
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Pasta", category: "carb" }),
        makeIngredient({ id: "i2", name: "Chicken", category: "protein" }),
        makeIngredient({ id: "i3", name: "pasta", category: "carb", tags: ["quick"] }),
      ],
      baseMeals: [meal],
    });
    saveHousehold(household);
    migrateHouseholdIngredients(household);
    saveHousehold(household);

    const migrated = loadHousehold("h-f047")!;
    for (const comp of migrated.baseMeals[0]!.components) {
      expect(migrated.ingredients.some((i) => i.id === comp.ingredientId)).toBe(true);
    }
  });

  it("catalog links remain intact after migration", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Chicken Breast", category: "protein", catalogId: "cat-chicken-breast", source: "catalog" }),
      ],
    });
    migrateHouseholdIngredients(household);
    expect(household.ingredients[0]!.catalogId).toBe("cat-chicken-breast");
    expect(household.ingredients[0]!.source).toBe("catalog");
    expect(household.ingredients[0]!.name).toBe("chicken breast");
  });

  it("no orphaned ingredient references remain after migration", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Rice", category: "carb" }),
        makeIngredient({ id: "i2", name: "rice", category: "carb" }),
        makeIngredient({ id: "i3", name: "  RICE  ", category: "carb" }),
      ],
      baseMeals: [
        {
          id: "bm1",
          name: "Test",
          components: [
            { ingredientId: "i1", role: "carb", quantity: "1" },
            { ingredientId: "i2", alternativeIngredientIds: ["i3"], role: "carb", quantity: "1" },
          ],
          defaultPrep: "",
          estimatedTimeMinutes: 10,
          difficulty: "easy",
          rescueEligible: false,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [
        {
          id: "wp1",
          days: [],
          selectedBaseMeals: [],
          generatedGroceryList: [
            { ingredientId: "i3", name: "RICE", category: "carb", quantity: "1", owned: false },
          ],
          notes: "",
        },
      ],
    });

    migrateHouseholdIngredients(household);

    const ingredientIds = new Set(household.ingredients.map((i) => i.id));
    for (const meal of household.baseMeals) {
      for (const comp of meal.components) {
        expect(ingredientIds.has(comp.ingredientId)).toBe(true);
        for (const altId of comp.alternativeIngredientIds ?? []) {
          expect(ingredientIds.has(altId)).toBe(true);
        }
      }
    }
    for (const plan of household.weeklyPlans) {
      for (const item of plan.generatedGroceryList) {
        expect(ingredientIds.has(item.ingredientId)).toBe(true);
      }
    }
  });

  it("ingredient names stored lowercase while UI displays sentence case", () => {
    const household = makeHousehold({
      ingredients: [
        makeIngredient({ id: "i1", name: "Baked Beans", category: "pantry" }),
      ],
    });
    migrateHouseholdIngredients(household);
    expect(household.ingredients[0]!.name).toBe("baked beans");
    expect(toSentenceCase(household.ingredients[0]!.name)).toBe("Baked beans");
  });
});
