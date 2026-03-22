import { describe, it, expect, beforeEach } from "vitest";
import type {
  Household,
  Ingredient,
  BaseMeal,
  Recipe,
  MealComponent,
  ComponentRecipeRef,
  RecipeRef,
} from "../src/types";
import {
  saveHousehold,
  loadHousehold,
  normalizeHousehold,
  migrateHouseholdRecipeRefs,
  runRecipeRefMigrationIfNeeded,
} from "../src/storage";
import { promoteRecipeToBaseMeal } from "../src/lib/promoteRecipe";
import {
  resolveComponentEffectiveRef,
  createComponentRecipeRef,
} from "../src/lib/componentRecipes";
import { sortRecipes } from "../src/lib/listSort";

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

function makeComponent(overrides: Partial<MealComponent> & { ingredientId: string }): MealComponent {
  return {
    role: "protein",
    quantity: "1",
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<Recipe> & { id: string; name: string }): Recipe {
  return {
    components: [],
    ...overrides,
  };
}

function makeBaseMeal(overrides: Partial<BaseMeal> & { id: string; name: string }): BaseMeal {
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

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h-f057",
    name: "F057 Test Family",
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

/* ========== Recipe entity persistence ========== */
describe("F057: Recipe entity persistence", () => {
  it("round-trips a recipe with all new fields through save/load", () => {
    const recipe = makeRecipe({
      id: "rec-1",
      name: "Tomato Sauce",
      recipeType: "sauce",
      parentRecipeId: "rec-parent",
      tags: ["italian", "base-sauce"],
      directions: "Simmer tomatoes with garlic for 30 minutes.",
      components: [makeComponent({ id: "c1", ingredientId: "ing-1" })],
      provenance: {
        sourceSystem: "paprika",
        externalId: "pap-001",
        importTimestamp: "2026-01-01T00:00:00.000Z",
      },
    });
    const h = makeHousehold({
      ingredients: [makeIngredient({ id: "ing-1", name: "tomato" })],
      recipes: [recipe],
    });
    saveHousehold(h);
    const loaded = loadHousehold("h-f057")!;
    expect(loaded.recipes).toHaveLength(1);
    const r = loaded.recipes![0]!;
    expect(r.recipeType).toBe("sauce");
    expect(r.parentRecipeId).toBe("rec-parent");
    expect(r.tags).toEqual(["italian", "base-sauce"]);
    expect(r.directions).toBe("Simmer tomatoes with garlic for 30 minutes.");
    expect(r.provenance?.sourceSystem).toBe("paprika");
  });

  it("round-trips a batch-prep recipe", () => {
    const recipe = makeRecipe({
      id: "rec-batch",
      name: "Weekly Rice Prep",
      recipeType: "batch-prep",
      directions: "Cook 4 cups of rice.",
    });
    const h = makeHousehold({ recipes: [recipe] });
    saveHousehold(h);
    const loaded = loadHousehold("h-f057")!;
    expect(loaded.recipes![0]!.recipeType).toBe("batch-prep");
  });

  it("persists recipes without new fields (backward compat shape)", () => {
    const recipe = makeRecipe({ id: "rec-old", name: "Old Recipe" });
    const h = makeHousehold({ recipes: [recipe] });
    saveHousehold(h);
    const loaded = loadHousehold("h-f057")!;
    const r = loaded.recipes![0]!;
    expect(r.recipeType).toBeUndefined();
    expect(r.parentRecipeId).toBeUndefined();
    expect(r.directions).toBeUndefined();
    expect(r.tags).toBeUndefined();
  });
});

/* ========== Backward compatibility ========== */
describe("F057: Backward compatibility", () => {
  it("normalizeHousehold handles old data without recipeRefs or recipeType", () => {
    const raw: Household = {
      id: "h-old",
      name: "Legacy Household",
      members: [],
      ingredients: [makeIngredient({ id: "ing-1", name: "rice" })],
      baseMeals: [
        makeBaseMeal({
          id: "meal-1",
          name: "Rice Bowl",
          sourceRecipeId: "rec-1",
          recipeLinks: [{ label: "Recipe Link", url: "https://example.com" }],
        }),
      ],
      weeklyPlans: [],
    };
    const normalized = normalizeHousehold(raw);
    expect(normalized.recipes).toEqual([]);
    expect(normalized.baseMeals[0]!.recipeLinks).toHaveLength(1);
    expect(normalized.baseMeals[0]!.recipeRefs).toBeUndefined();
    expect(normalized.baseMeals[0]!.sourceRecipeId).toBe("rec-1");
  });

  it("preserves existing BaseMeal.recipeLinks after migration", () => {
    const recipe = makeRecipe({ id: "rec-1", name: "Curry Recipe" });
    const h = makeHousehold({
      recipes: [recipe],
      baseMeals: [
        makeBaseMeal({
          id: "meal-1",
          name: "Curry",
          sourceRecipeId: "rec-1",
          recipeLinks: [{ label: "Original", url: "https://example.com/curry" }],
        }),
      ],
    });
    migrateHouseholdRecipeRefs(h);
    expect(h.baseMeals[0]!.recipeLinks).toHaveLength(1);
    expect(h.baseMeals[0]!.recipeLinks![0]!.label).toBe("Original");
  });

  it("old ingredients without defaultRecipeRefs load cleanly", () => {
    const h = makeHousehold({
      ingredients: [makeIngredient({ id: "ing-1", name: "chicken" })],
    });
    saveHousehold(h);
    const loaded = loadHousehold("h-f057")!;
    expect(loaded.ingredients[0]!.defaultRecipeRefs).toBeUndefined();
  });
});

/* ========== Migration safety ========== */
describe("F057: Migration safety (migrateHouseholdRecipeRefs)", () => {
  it("backfills recipeRefs on BaseMeal from sourceRecipeId", () => {
    const h = makeHousehold({
      recipes: [makeRecipe({ id: "rec-1", name: "Curry" })],
      baseMeals: [
        makeBaseMeal({ id: "meal-1", name: "Curry Meal", sourceRecipeId: "rec-1" }),
      ],
    });
    const result = migrateHouseholdRecipeRefs(h);
    expect(result.recipeRefsBackfilled).toBe(1);
    expect(h.baseMeals[0]!.recipeRefs).toHaveLength(1);
    expect(h.baseMeals[0]!.recipeRefs![0]!.recipeId).toBe("rec-1");
    expect(h.baseMeals[0]!.recipeRefs![0]!.role).toBe("primary");
  });

  it("does not duplicate recipeRefs on repeated migration", () => {
    const h = makeHousehold({
      recipes: [makeRecipe({ id: "rec-1", name: "Curry" })],
      baseMeals: [
        makeBaseMeal({ id: "meal-1", name: "Curry Meal", sourceRecipeId: "rec-1" }),
      ],
    });
    migrateHouseholdRecipeRefs(h);
    const result2 = migrateHouseholdRecipeRefs(h);
    expect(result2.recipeRefsBackfilled).toBe(0);
    expect(h.baseMeals[0]!.recipeRefs).toHaveLength(1);
  });

  it("skips backfill when sourceRecipeId points to nonexistent recipe", () => {
    const h = makeHousehold({
      recipes: [],
      baseMeals: [
        makeBaseMeal({ id: "meal-1", name: "Orphan Meal", sourceRecipeId: "rec-gone" }),
      ],
    });
    const result = migrateHouseholdRecipeRefs(h);
    expect(result.recipeRefsBackfilled).toBe(0);
    expect(h.baseMeals[0]!.recipeRefs).toBeUndefined();
  });

  it("copies importedRecipeSourceId to recipeId on ComponentRecipeRef", () => {
    const cRef: ComponentRecipeRef = {
      id: "cref-1",
      componentId: "comp-1",
      sourceType: "imported-recipe",
      importedRecipeSourceId: "rec-2",
      label: "Imported Sauce",
    };
    const h = makeHousehold({
      baseMeals: [
        makeBaseMeal({
          id: "meal-1",
          name: "Meal with ref",
          components: [
            makeComponent({ id: "comp-1", ingredientId: "ing-1", recipeRefs: [cRef] }),
          ],
        }),
      ],
    });
    const result = migrateHouseholdRecipeRefs(h);
    expect(result.componentRecipeIdsSet).toBe(1);
    expect(h.baseMeals[0]!.components[0]!.recipeRefs![0]!.recipeId).toBe("rec-2");
  });

  it("does not overwrite existing recipeId on ComponentRecipeRef", () => {
    const cRef: ComponentRecipeRef = {
      id: "cref-1",
      componentId: "comp-1",
      sourceType: "imported-recipe",
      importedRecipeSourceId: "rec-old",
      recipeId: "rec-already-set",
      label: "Already set",
    };
    const h = makeHousehold({
      baseMeals: [
        makeBaseMeal({
          id: "meal-1",
          name: "Meal",
          components: [
            makeComponent({ id: "comp-1", ingredientId: "ing-1", recipeRefs: [cRef] }),
          ],
        }),
      ],
    });
    const result = migrateHouseholdRecipeRefs(h);
    expect(result.componentRecipeIdsSet).toBe(0);
    expect(h.baseMeals[0]!.components[0]!.recipeRefs![0]!.recipeId).toBe("rec-already-set");
  });

  it("infers recipeType as whole-meal for recipes with provenance", () => {
    const h = makeHousehold({
      recipes: [
        makeRecipe({
          id: "rec-1",
          name: "Imported",
          provenance: {
            sourceSystem: "paprika",
            importTimestamp: "2026-01-01T00:00:00.000Z",
          },
        }),
      ],
    });
    const result = migrateHouseholdRecipeRefs(h);
    expect(result.recipeTypesInferred).toBe(1);
    expect(h.recipes![0]!.recipeType).toBe("whole-meal");
  });

  it("does not overwrite existing recipeType during migration", () => {
    const h = makeHousehold({
      recipes: [
        makeRecipe({
          id: "rec-1",
          name: "Sauce",
          recipeType: "sauce",
          provenance: {
            sourceSystem: "manual",
            importTimestamp: "2026-01-01T00:00:00.000Z",
          },
        }),
      ],
    });
    const result = migrateHouseholdRecipeRefs(h);
    expect(result.recipeTypesInferred).toBe(0);
    expect(h.recipes![0]!.recipeType).toBe("sauce");
  });

  it("also migrates ComponentRecipeRefs on recipe components", () => {
    const cRef: ComponentRecipeRef = {
      id: "cref-1",
      componentId: "comp-1",
      sourceType: "imported-recipe",
      importedRecipeSourceId: "rec-sub",
      label: "Sub sauce",
    };
    const h = makeHousehold({
      recipes: [
        makeRecipe({
          id: "rec-main",
          name: "Main Recipe",
          components: [
            makeComponent({ id: "comp-1", ingredientId: "ing-1", recipeRefs: [cRef] }),
          ],
        }),
      ],
    });
    const result = migrateHouseholdRecipeRefs(h);
    expect(result.componentRecipeIdsSet).toBe(1);
    expect(h.recipes![0]!.components[0]!.recipeRefs![0]!.recipeId).toBe("rec-sub");
  });
});

describe("F057: runRecipeRefMigrationIfNeeded", () => {
  it("runs migration once and sets flag", () => {
    const h = makeHousehold({
      recipes: [makeRecipe({ id: "rec-1", name: "Curry" })],
      baseMeals: [
        makeBaseMeal({ id: "meal-1", name: "Curry Meal", sourceRecipeId: "rec-1" }),
      ],
    });
    saveHousehold(h);
    const result = runRecipeRefMigrationIfNeeded();
    expect(result.recipeRefsBackfilled).toBe(1);
    const result2 = runRecipeRefMigrationIfNeeded();
    expect(result2.recipeRefsBackfilled).toBe(0);
  });

  it("does not break empty household list", () => {
    const result = runRecipeRefMigrationIfNeeded();
    expect(result.recipeRefsBackfilled).toBe(0);
    expect(result.componentRecipeIdsSet).toBe(0);
    expect(result.recipeTypesInferred).toBe(0);
  });
});

/* ========== Component recipe refs with recipeId ========== */
describe("F057: ComponentRecipeRef with recipeId", () => {
  it("resolves effective ref when recipeId is set", () => {
    const cRef: ComponentRecipeRef = {
      id: "cref-1",
      componentId: "comp-1",
      sourceType: "imported-recipe",
      recipeId: "rec-1",
      label: "Curry Recipe",
      isDefault: true,
    };
    const component = makeComponent({
      id: "comp-1",
      ingredientId: "ing-1",
      recipeRefs: [cRef],
    });
    const { effective, source } = resolveComponentEffectiveRef(component, {});
    expect(source).toBe("default");
    expect(effective?.recipeId).toBe("rec-1");
    expect(effective?.label).toBe("Curry Recipe");
  });

  it("createComponentRecipeRef accepts recipeId", () => {
    const ref = createComponentRecipeRef({
      componentId: "comp-1",
      sourceType: "imported-recipe",
      recipeId: "rec-1",
      label: "Test",
    });
    expect(ref.id).toBeTruthy();
    expect(ref.recipeId).toBe("rec-1");
  });
});

/* ========== Imported recipe provenance ========== */
describe("F057: Imported recipe provenance persistence", () => {
  it("preserves provenance through save/load cycle", () => {
    const recipe = makeRecipe({
      id: "rec-imp",
      name: "Paprika Chicken",
      recipeType: "whole-meal",
      directions: "Bake at 350F for 40 minutes.",
      provenance: {
        sourceSystem: "paprika",
        externalId: "pap-uid-123",
        sourceUrl: "https://example.com/chicken",
        importTimestamp: "2026-03-01T12:00:00.000Z",
      },
    });
    const h = makeHousehold({ recipes: [recipe] });
    saveHousehold(h);
    const loaded = loadHousehold("h-f057")!;
    const r = loaded.recipes![0]!;
    expect(r.provenance?.sourceSystem).toBe("paprika");
    expect(r.provenance?.externalId).toBe("pap-uid-123");
    expect(r.provenance?.sourceUrl).toBe("https://example.com/chicken");
    expect(r.directions).toBe("Bake at 350F for 40 minutes.");
    expect(r.recipeType).toBe("whole-meal");
  });
});

/* ========== promoteRecipeToBaseMeal with recipeRefs ========== */
describe("F057: promoteRecipeToBaseMeal populates recipeRefs", () => {
  it("adds a primary recipeRef pointing to the source recipe", () => {
    const recipe = makeRecipe({
      id: "rec-promote",
      name: "Stir Fry",
      recipeType: "whole-meal",
      directions: "Stir fry everything.",
      components: [makeComponent({ id: "c1", ingredientId: "ing-1" })],
    });
    const meal = promoteRecipeToBaseMeal(recipe);
    expect(meal.sourceRecipeId).toBe("rec-promote");
    expect(meal.recipeRefs).toHaveLength(1);
    expect(meal.recipeRefs![0]!.recipeId).toBe("rec-promote");
    expect(meal.recipeRefs![0]!.role).toBe("primary");
  });

  it("preserves existing recipeLinks alongside new recipeRefs", () => {
    const recipe = makeRecipe({
      id: "rec-with-links",
      name: "Pasta",
      recipeLinks: [{ label: "Original", url: "https://example.com" }],
    });
    const meal = promoteRecipeToBaseMeal(recipe);
    expect(meal.recipeLinks).toHaveLength(1);
    expect(meal.recipeRefs).toHaveLength(1);
    expect(meal.recipeLinks![0]!.label).toBe("Original");
    expect(meal.recipeRefs![0]!.recipeId).toBe("rec-with-links");
  });
});

/* ========== RecipeRef on BaseMeal ========== */
describe("F057: BaseMeal.recipeRefs persistence", () => {
  it("persists recipeRefs through save/load cycle", () => {
    const refs: RecipeRef[] = [
      { recipeId: "rec-1", role: "primary" },
      { recipeId: "rec-2", role: "assembly", label: "Assembly guide" },
    ];
    const h = makeHousehold({
      baseMeals: [
        makeBaseMeal({ id: "meal-1", name: "Complex Meal", recipeRefs: refs }),
      ],
    });
    saveHousehold(h);
    const loaded = loadHousehold("h-f057")!;
    expect(loaded.baseMeals[0]!.recipeRefs).toHaveLength(2);
    expect(loaded.baseMeals[0]!.recipeRefs![0]!.recipeId).toBe("rec-1");
    expect(loaded.baseMeals[0]!.recipeRefs![1]!.role).toBe("assembly");
    expect(loaded.baseMeals[0]!.recipeRefs![1]!.label).toBe("Assembly guide");
  });
});

/* ========== Ingredient.defaultRecipeRefs ========== */
describe("F057: Ingredient.defaultRecipeRefs", () => {
  it("persists defaultRecipeRefs on ingredients", () => {
    const ing = makeIngredient({
      id: "ing-rice",
      name: "rice",
      defaultRecipeRefs: [{ recipeId: "rec-rice-prep", role: "batch-prep" }],
    });
    const h = makeHousehold({ ingredients: [ing] });
    saveHousehold(h);
    const loaded = loadHousehold("h-f057")!;
    expect(loaded.ingredients[0]!.defaultRecipeRefs).toHaveLength(1);
    expect(loaded.ingredients[0]!.defaultRecipeRefs![0]!.recipeId).toBe("rec-rice-prep");
    expect(loaded.ingredients[0]!.defaultRecipeRefs![0]!.role).toBe("batch-prep");
  });
});

/* ========== Recipe sorting with recipeType ========== */
describe("F057: sortRecipes by recipeType", () => {
  it("sorts recipes by recipeType ascending", () => {
    const recipes = [
      makeRecipe({ id: "r1", name: "B", recipeType: "sauce" }),
      makeRecipe({ id: "r2", name: "A", recipeType: "batch-prep" }),
      makeRecipe({ id: "r3", name: "C", recipeType: "whole-meal" }),
    ];
    const sorted = sortRecipes(recipes, "recipeType", "asc");
    expect(sorted[0]!.recipeType).toBe("batch-prep");
    expect(sorted[1]!.recipeType).toBe("sauce");
    expect(sorted[2]!.recipeType).toBe("whole-meal");
  });
});
