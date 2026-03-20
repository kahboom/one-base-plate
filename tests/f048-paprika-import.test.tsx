import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { saveHousehold, loadHousehold } from "../src/storage";
import {
  parseRecipeIngredients,
  detectDuplicateMeal,
  parsePaprikaRecipes,
  buildDraftMeal,
} from "../src/paprika-parser";
import type { PaprikaRecipe, PaprikaReviewLine } from "../src/paprika-parser";
import type { Household, BaseMeal } from "../src/types";

function makeHousehold(): Household {
  return {
    id: "h-paprika",
    name: "Paprika Test Family",
    members: [
      {
        id: "m1",
        name: "Pat",
        role: "adult",
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
    ],
    ingredients: [
      {
        id: "ing-chicken",
        name: "chicken breast",
        category: "protein",
        tags: ["quick"],
        shelfLifeHint: "",
        freezerFriendly: true,
        babySafeWithAdaptation: true,
        source: "manual",
      },
      {
        id: "ing-rice",
        name: "rice",
        category: "carb",
        tags: ["staple"],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        source: "manual",
      },
    ],
    baseMeals: [],
    weeklyPlans: [],
  };
}

function makePaprikaRecipe(overrides: Partial<PaprikaRecipe> = {}): PaprikaRecipe {
  return {
    name: "Test Chicken Rice",
    ingredients: "200g chicken breast\n1 cup rice\n1 tbsp soy sauce",
    directions: "Cook it all.",
    notes: "Family favorite",
    source: "Gousto",
    source_url: "https://example.com/recipe",
    prep_time: "10 min",
    cook_time: "20 min",
    total_time: "30 min",
    difficulty: "Easy",
    servings: "4",
    categories: ["Dinner", "Quick"],
    image_url: "https://example.com/photo.jpg",
    photo_data: null,
    uid: "paprika-uid-001",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("F048 - Paprika parser engine", () => {
  describe("parseRecipeIngredients", () => {
    it("matches household ingredients from Paprika recipe text", () => {
      const h = makeHousehold();
      const recipe = makePaprikaRecipe();
      const lines = parseRecipeIngredients(recipe, h.ingredients);

      expect(lines.length).toBe(3);
      expect(lines[0]!.status).toBe("matched");
      expect(lines[0]!.matchedIngredient?.id).toBe("ing-chicken");
      expect(lines[1]!.status).toBe("matched");
      expect(lines[1]!.matchedIngredient?.id).toBe("ing-rice");
    });

    it("detects unmatched ingredients", () => {
      const h = makeHousehold();
      const recipe = makePaprikaRecipe({ ingredients: "1 tbsp soy sauce" });
      const lines = parseRecipeIngredients(recipe, h.ingredients);

      const soyLine = lines.find((l) => l.name.toLowerCase().includes("soy"));
      expect(soyLine).toBeTruthy();
      // Either unmatched or catalog match depending on catalog contents
      expect(["unmatched", "catalog"]).toContain(soyLine!.status);
    });

    it("handles empty ingredient text", () => {
      const h = makeHousehold();
      const recipe = makePaprikaRecipe({ ingredients: "" });
      const lines = parseRecipeIngredients(recipe, h.ingredients);
      expect(lines.length).toBe(0);
    });

    it("extracts quantities from Paprika lines", () => {
      const h = makeHousehold();
      const recipe = makePaprikaRecipe({ ingredients: "200g chicken breast" });
      const lines = parseRecipeIngredients(recipe, h.ingredients);
      expect(lines[0]!.quantity).toMatch(/200/);
    });

    it("sets default actions based on match status", () => {
      const h = makeHousehold();
      const recipe = makePaprikaRecipe();
      const lines = parseRecipeIngredients(recipe, h.ingredients);

      const matched = lines.find((l) => l.status === "matched");
      expect(matched?.action).toBe("use");
    });
  });

  describe("detectDuplicateMeal", () => {
    it("detects duplicate by normalized name", () => {
      const meals: BaseMeal[] = [
        {
          id: "m1",
          name: "Test Chicken Rice",
          components: [],
          defaultPrep: "",
          estimatedTimeMinutes: 30,
          difficulty: "easy",
          rescueEligible: false,
          wasteReuseHints: [],
        },
      ];
      const result = detectDuplicateMeal("test chicken rice", meals);
      expect(result.isDuplicate).toBe(true);
      expect(result.existingMealId).toBe("m1");
    });

    it("returns no duplicate when name differs", () => {
      const meals: BaseMeal[] = [
        {
          id: "m1",
          name: "Pasta Bolognese",
          components: [],
          defaultPrep: "",
          estimatedTimeMinutes: 30,
          difficulty: "easy",
          rescueEligible: false,
          wasteReuseHints: [],
        },
      ];
      const result = detectDuplicateMeal("Chicken Rice", meals);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe("parsePaprikaRecipes", () => {
    it("parses multiple recipes and detects duplicates", () => {
      const h = makeHousehold();
      const existingMeal: BaseMeal = {
        id: "existing-1",
        name: "Test Chicken Rice",
        components: [],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
      };

      const recipes = [
        makePaprikaRecipe(),
        makePaprikaRecipe({ name: "New Pasta Dish", ingredients: "200g pasta" }),
      ];

      const parsed = parsePaprikaRecipes(recipes, h.ingredients, [existingMeal]);

      expect(parsed.length).toBe(2);
      expect(parsed[0]!.isDuplicate).toBe(true);
      expect(parsed[0]!.existingMealId).toBe("existing-1");
      expect(parsed[0]!.selected).toBe(false); // duplicates unselected by default
      expect(parsed[1]!.isDuplicate).toBe(false);
      expect(parsed[1]!.selected).toBe(true);
    });
  });

  describe("buildDraftMeal", () => {
    it("creates a draft meal with provenance", () => {
      const h = makeHousehold();
      const recipe = makePaprikaRecipe();
      const lines = parseRecipeIngredients(recipe, h.ingredients);
      const reviewLines = lines as PaprikaReviewLine[];

      const { meal } = buildDraftMeal(recipe, reviewLines);

      expect(meal.name).toBe("Test Chicken Rice");
      expect(meal.provenance).toBeDefined();
      expect(meal.provenance!.sourceSystem).toBe("paprika");
      expect(meal.provenance!.externalId).toBe("paprika-uid-001");
      expect(meal.provenance!.sourceUrl).toBe("https://example.com/recipe");
      expect(meal.provenance!.importTimestamp).toBeTruthy();
    });

    it("maps Paprika total time to estimatedTimeMinutes", () => {
      const recipe = makePaprikaRecipe({ total_time: "45 min" });
      const lines = parseRecipeIngredients(recipe, []);
      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);
      expect(meal.estimatedTimeMinutes).toBe(45);
    });

    it("preserves separate prep and cook times", () => {
      const recipe = makePaprikaRecipe({
        prep_time: "15 min",
        cook_time: "25 min",
        total_time: "40 min",
      });
      const lines = parseRecipeIngredients(recipe, []);
      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);
      expect(meal.prepTimeMinutes).toBe(15);
      expect(meal.cookTimeMinutes).toBe(25);
      expect(meal.estimatedTimeMinutes).toBe(40);
    });

    it("maps difficulty level", () => {
      const recipe = makePaprikaRecipe({ difficulty: "Hard" });
      const lines = parseRecipeIngredients(recipe, []);
      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);
      expect(meal.difficulty).toBe("hard");
    });

    it("preserves servings", () => {
      const recipe = makePaprikaRecipe({ servings: "6" });
      const lines = parseRecipeIngredients(recipe, []);
      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);
      expect(meal.servings).toBe("6");
    });

    it("creates recipe links from source URL", () => {
      const recipe = makePaprikaRecipe({
        source: "Gousto",
        source_url: "https://gousto.co.uk/recipe/123",
      });
      const lines = parseRecipeIngredients(recipe, []);
      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);
      expect(meal.recipeLinks).toHaveLength(1);
      expect(meal.recipeLinks![0]!.label).toBe("Gousto");
      expect(meal.recipeLinks![0]!.url).toBe("https://gousto.co.uk/recipe/123");
    });

    it("preserves notes", () => {
      const recipe = makePaprikaRecipe({ notes: "Blend toddler sauce smooth" });
      const lines = parseRecipeIngredients(recipe, []);
      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);
      expect(meal.notes).toBe("Blend toddler sauce smooth");
    });

    it("stores import mappings for each ingredient line", () => {
      const h = makeHousehold();
      const recipe = makePaprikaRecipe();
      const lines = parseRecipeIngredients(recipe, h.ingredients);

      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);

      expect(meal.importMappings).toBeDefined();
      expect(meal.importMappings!.length).toBe(3);
      const usedMapping = meal.importMappings!.find((m) => m.action === "use");
      expect(usedMapping).toBeTruthy();
      expect(usedMapping!.originalLine).toBeTruthy();
      expect(usedMapping!.matchType).toBe("existing");
    });

    it("stores component-level metadata on matched components", () => {
      const h = makeHousehold();
      const recipe = makePaprikaRecipe({ ingredients: "200g chicken breast" });
      const lines = parseRecipeIngredients(recipe, h.ingredients);

      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);

      expect(meal.components.length).toBe(1);
      expect(meal.components[0]!.originalSourceLine).toBe("200g chicken breast");
      expect(meal.components[0]!.matchType).toBe("existing");
      expect(meal.components[0]!.ingredientId).toBe("ing-chicken");
    });

    it("creates new ingredients for catalog matches", () => {
      const recipe = makePaprikaRecipe({ ingredients: "200g pasta" });
      const lines = parseRecipeIngredients(recipe, []);
      // Force the catalog match to "create"
      const reviewLines = lines.map((l) => ({
        ...l,
        action: l.status === "catalog" ? ("create" as const) : l.action,
        newCategory: l.matchedCatalog?.category ?? ("pantry" as const),
      })) as PaprikaReviewLine[];

      const { meal, newIngredients } = buildDraftMeal(recipe, reviewLines);

      if (reviewLines[0]!.status === "catalog") {
        expect(newIngredients.length).toBe(1);
        expect(meal.components.length).toBe(1);
        expect(meal.components[0]!.matchType).toBe("new");
      }
    });

    it("falls back to 30 min when no time is provided", () => {
      const recipe = makePaprikaRecipe({
        total_time: "",
        prep_time: "",
        cook_time: "",
      });
      const lines = parseRecipeIngredients(recipe, []);
      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);
      expect(meal.estimatedTimeMinutes).toBe(30);
    });

    it("parses time with hours", () => {
      const recipe = makePaprikaRecipe({ total_time: "1h 30m" });
      const lines = parseRecipeIngredients(recipe, []);
      const { meal } = buildDraftMeal(recipe, lines as PaprikaReviewLine[]);
      expect(meal.estimatedTimeMinutes).toBe(90);
    });
  });
});

describe("F048 - Paprika import UI", () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
  }

  it("renders upload step with file input", () => {
    saveHousehold(makeHousehold());
    renderAt("/household/h-paprika/import-paprika");

    expect(screen.getByTestId("paprika-upload-step")).toBeInTheDocument();
    expect(screen.getByTestId("paprika-file-input")).toBeInTheDocument();
  });

  it("shows error when file parsing fails", async () => {
    saveHousehold(makeHousehold());
    renderAt("/household/h-paprika/import-paprika");

    const input = screen.getByTestId("paprika-file-input") as HTMLInputElement;
    const badFile = new File(["not a zip"], "bad.paprikarecipes", {
      type: "application/octet-stream",
    });

    await userEvent.upload(input, badFile);

    expect(screen.getByTestId("paprika-error")).toBeInTheDocument();
  });

  it("Import Paprika button exists on Settings", () => {
    const h = makeHousehold();
    saveHousehold(h);
    renderAt("/household/h-paprika/settings");

    expect(screen.getByTestId("import-paprika-btn")).toBeInTheDocument();
  });
});

describe("F048 - Provenance on MealDetail", () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
  }

  it("shows provenance section on imported meal detail", () => {
    const h = makeHousehold();
    h.baseMeals = [
      {
        id: "m-imported",
        name: "Imported Meal",
        components: [],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
        provenance: {
          sourceSystem: "paprika",
          externalId: "uid-123",
          sourceUrl: "https://example.com/recipe",
          importTimestamp: "2026-03-15T10:00:00Z",
        },
        prepTimeMinutes: 10,
        cookTimeMinutes: 20,
        servings: "4",
      },
    ];
    saveHousehold(h);
    renderAt("/household/h-paprika/meal/m-imported");

    const provenance = screen.getByTestId("meal-provenance");
    expect(provenance).toBeInTheDocument();
    expect(provenance.textContent).toContain("paprika");
    expect(provenance.textContent).toContain("Prep: 10 min");
    expect(provenance.textContent).toContain("Cook: 20 min");
    expect(provenance.textContent).toContain("Servings: 4");
  });

  it("does not show provenance on non-imported meals", () => {
    const h = makeHousehold();
    h.baseMeals = [
      {
        id: "m-manual",
        name: "Manual Meal",
        components: [],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ];
    saveHousehold(h);
    renderAt("/household/h-paprika/meal/m-manual");

    expect(screen.queryByTestId("meal-provenance")).not.toBeInTheDocument();
  });

  it("shows import mappings on imported meal detail", () => {
    const h = makeHousehold();
    h.baseMeals = [
      {
        id: "m-mapped",
        name: "Mapped Meal",
        components: [],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
        provenance: {
          sourceSystem: "paprika",
          importTimestamp: "2026-03-15T10:00:00Z",
        },
        importMappings: [
          {
            originalLine: "200g chicken breast",
            parsedName: "chicken breast",
            action: "use",
            ingredientId: "ing-chicken",
            matchType: "existing",
          },
          {
            originalLine: "1 tbsp soy sauce",
            parsedName: "soy sauce",
            action: "ignore",
            matchType: "ignored",
          },
        ],
      },
    ];
    saveHousehold(h);
    renderAt("/household/h-paprika/meal/m-mapped");

    const mappings = screen.getByTestId("import-mappings");
    expect(mappings).toBeInTheDocument();
    expect(mappings.textContent).toContain("200g chicken breast");
    expect(mappings.textContent).toContain("1 tbsp soy sauce");
    expect(screen.getByText("Adjust ingredient links")).toBeInTheDocument();
    expect(screen.getByTestId("import-mapping-adjust")).toBeInTheDocument();
  });

  it("does not show post-import adjust when meal has mappings but no provenance", () => {
    const h = makeHousehold();
    h.baseMeals = [
      {
        id: "m-map-no-prov",
        name: "Mapped no provenance",
        components: [],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
        importMappings: [
          {
            originalLine: "1 tsp salt",
            parsedName: "salt",
            action: "ignore",
            matchType: "ignored",
          },
        ],
      },
    ];
    saveHousehold(h);
    renderAt("/household/h-paprika/meal/m-map-no-prov");

    expect(screen.queryByTestId("import-mapping-adjust")).not.toBeInTheDocument();
  });

  it("does not show import mappings when none exist", () => {
    const h = makeHousehold();
    h.baseMeals = [
      {
        id: "m-no-map",
        name: "No Map Meal",
        components: [],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ];
    saveHousehold(h);
    renderAt("/household/h-paprika/meal/m-no-map");

    expect(screen.queryByTestId("import-mappings")).not.toBeInTheDocument();
  });
});

describe("F048 - Compatibility with planner and grocery list", () => {
  it("imported meals with provenance work with planner overlap scoring", async () => {
    const { computeMealOverlap } = await import("../src/planner");
    const h = makeHousehold();
    const meal: BaseMeal = {
      id: "m-compat",
      name: "Compatible Meal",
      components: [
        { ingredientId: "ing-chicken", role: "protein", quantity: "200g", originalSourceLine: "200g chicken", matchType: "existing" },
        { ingredientId: "ing-rice", role: "carb", quantity: "1 cup", originalSourceLine: "1 cup rice", matchType: "existing" },
      ],
      defaultPrep: "",
      estimatedTimeMinutes: 30,
      difficulty: "easy",
      rescueEligible: false,
      wasteReuseHints: [],
      provenance: {
        sourceSystem: "paprika",
        importTimestamp: "2026-03-15T10:00:00Z",
      },
    };

    const overlap = computeMealOverlap(meal, h.members, h.ingredients);
    expect(overlap.score).toBeGreaterThan(0);
    expect(overlap.total).toBe(1); // 1 human member
  });

  it("imported meals with extra fields persist through save/load", () => {
    const h = makeHousehold();
    h.baseMeals = [
      {
        id: "m-persist",
        name: "Persist Test",
        components: [
          {
            ingredientId: "ing-chicken",
            role: "protein",
            quantity: "200g",
            originalSourceLine: "200g chicken breast",
            matchType: "existing",
          },
        ],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
        provenance: {
          sourceSystem: "paprika",
          externalId: "uid-persist",
          sourceUrl: "https://example.com",
          importTimestamp: "2026-03-15T10:00:00Z",
        },
        prepTimeMinutes: 10,
        cookTimeMinutes: 20,
        servings: "4",
        importMappings: [
          {
            originalLine: "200g chicken breast",
            parsedName: "chicken breast",
            action: "use",
            ingredientId: "ing-chicken",
            matchType: "existing",
          },
        ],
      },
    ];
    saveHousehold(h);

    const loaded = loadHousehold("h-paprika")!;
    const meal = loaded.baseMeals[0]!;
    expect(meal.provenance?.sourceSystem).toBe("paprika");
    expect(meal.provenance?.externalId).toBe("uid-persist");
    expect(meal.prepTimeMinutes).toBe(10);
    expect(meal.cookTimeMinutes).toBe(20);
    expect(meal.servings).toBe("4");
    expect(meal.importMappings).toHaveLength(1);
    expect(meal.components[0]!.originalSourceLine).toBe("200g chicken breast");
    expect(meal.components[0]!.matchType).toBe("existing");
  });

  it("imported meals without optional fields work with existing code", () => {
    const h = makeHousehold();
    h.baseMeals = [
      {
        id: "m-minimal",
        name: "Minimal Meal",
        components: [],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ];
    saveHousehold(h);

    const loaded = loadHousehold("h-paprika")!;
    const meal = loaded.baseMeals[0]!;
    expect(meal.provenance).toBeUndefined();
    expect(meal.importMappings).toBeUndefined();
    expect(meal.prepTimeMinutes).toBeUndefined();
  });
});

describe("F048 - Duplicate detection", () => {
  it("detects duplicate imported meals by normalized name", () => {
    const meals: BaseMeal[] = [
      {
        id: "m1",
        name: "Chicken Pasta Bake",
        components: [],
        defaultPrep: "",
        estimatedTimeMinutes: 30,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ];

    const recipes = [
      makePaprikaRecipe({ name: "Chicken Pasta Bake" }),
      makePaprikaRecipe({ name: "New Recipe" }),
    ];

    const parsed = parsePaprikaRecipes(recipes, [], meals);
    expect(parsed[0]!.isDuplicate).toBe(true);
    expect(parsed[0]!.selected).toBe(false);
    expect(parsed[1]!.isDuplicate).toBe(false);
    expect(parsed[1]!.selected).toBe(true);
  });

  it("detects duplicate ingredient matches using normalized lowercase", () => {
    const h = makeHousehold();
    const recipe = makePaprikaRecipe({ ingredients: "Chicken Breast\nchicken breast" });
    const lines = parseRecipeIngredients(recipe, h.ingredients);

    const matched = lines.filter((l) => l.status === "matched");
    expect(matched.length).toBe(2);
    expect(matched[0]!.matchedIngredient?.id).toBe("ing-chicken");
    expect(matched[1]!.matchedIngredient?.id).toBe("ing-chicken");
  });
});
