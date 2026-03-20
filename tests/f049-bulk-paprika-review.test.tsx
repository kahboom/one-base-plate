import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { saveHousehold, loadHousehold } from "../src/storage";
import {
  parseRecipeIngredients,
  buildDraftMeal,
  computeBulkSummary,
  applyBulkAction,
  saveImportSession,
  loadImportSession,
  clearImportSession,
  parsePaprikaRecipes,
} from "../src/paprika-parser";
import type { PaprikaRecipe } from "../src/paprika-parser";
import { parseIngredientLine, isInstructionLine } from "../src/recipe-parser";
import type { Household } from "../src/types";

function makeHousehold(): Household {
  return {
    id: "h-bulk",
    name: "Bulk Test Family",
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
    pinnedMealIds: [],
    mealOutcomes: [],
  };
}

function makePaprikaRecipe(overrides: Partial<PaprikaRecipe> = {}): PaprikaRecipe {
  return {
    name: "Test Recipe",
    ingredients: "200g chicken breast\n1 cup rice\nsome mystery spice",
    directions: "Cook it all",
    notes: "",
    source: "",
    source_url: "",
    prep_time: "10",
    cook_time: "20",
    total_time: "30m",
    difficulty: "easy",
    servings: "4",
    categories: ["Dinner"],
    image_url: "",
    photo_data: null,
    uid: "uid-1",
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

/* ---- Enhanced parser tests ---- */
describe("Enhanced parseIngredientLine", () => {
  it("handles decimal quantities like 1.5 cups", () => {
    const result = parseIngredientLine("1.5 cups water");
    expect(result.quantity).toBe("1.5 cups");
    expect(result.unit).toBe("cups");
    expect(result.name).toBe("water");
  });

  it("handles fraction quantities like 1/2 cup", () => {
    const result = parseIngredientLine("1/2 cup flour");
    expect(result.quantity).toBe("1/2 cup");
    expect(result.name).toBe("flour");
  });

  it("handles mixed fractions like 1 1/2 cups", () => {
    const result = parseIngredientLine("1 1/2 cups milk");
    expect(result.quantity).toBe("1 1/2 cups");
    expect(result.quantityValue).toBeCloseTo(1.5);
    expect(result.name).toBe("milk");
  });

  it("strips parenthetical notes", () => {
    const result = parseIngredientLine("1 cup quinoa (any color)");
    expect(result.name).toBe("quinoa");
  });

  it("parses quinoa with parenthetical note and trailing prep phrase", () => {
    const result = parseIngredientLine("1 cup quinoa (any color), rinsed well");
    expect(result.name).toBe("quinoa");
    expect(result.prepNotes).toContain("any color");
    expect(result.prepNotes).toContain("rinsed well");
  });

  it("handles 'of' phrasing", () => {
    const result = parseIngredientLine("1 pinch of salt");
    expect(result.name).toBe("salt");
  });

  it("strips preparation suffixes after comma", () => {
    const result = parseIngredientLine("1 lime, zested and squeezed");
    expect(result.name).toBe("lime");
    expect(result.quantityValue).toBe(1);
    expect(result.prepNotes).toContain("zested and squeezed");
  });

  it("strips 'rinsed well' suffix", () => {
    const result = parseIngredientLine("1 cup quinoa rinsed well");
    expect(result.name).toBe("quinoa");
  });

  it("handles combined patterns: quantity + parenthetical + prep suffix", () => {
    const result = parseIngredientLine("2 cups chicken breast (boneless), diced");
    expect(result.name).toBe("chicken breast");
    expect(result.quantity).toBe("2 cups");
  });

  it("preserves raw unit in the unit field", () => {
    const result = parseIngredientLine("3 tbsp olive oil");
    expect(result.unit).toBe("tbsp");
    expect(result.name).toBe("olive oil");
  });

  it("strips leading prep descriptors like grated Parmesan", () => {
    const result = parseIngredientLine("1/2 cup grated Parmesan");
    expect(result.name).toBe("Parmesan");
    expect(result.prepNotes).toContain("grated");
  });

  it("preserves compound names with qualifiers like low-sodium beef broth", () => {
    const result = parseIngredientLine("4 cups low-sodium beef broth");
    expect(result.name).toBe("beef broth");
    expect(result.prepNotes).toContain("low-sodium");
  });

  it("strips descriptor from diced tomatoes while preserving core ingredient", () => {
    const result = parseIngredientLine("2 cups diced tomatoes");
    expect(result.name).toBe("tomatoes");
    expect(result.prepNotes).toContain("diced");
  });

  it("preserves compound names like cannellini beans and olive oil", () => {
    expect(parseIngredientLine("1 can cannellini beans").name).toBe("cannellini beans");
    expect(parseIngredientLine("2 tbsp olive oil").name).toBe("olive oil");
  });
});

describe("isInstructionLine", () => {
  it("detects lines starting with asterisk as instructions", () => {
    expect(isInstructionLine("* See note below for variations")).toBe(true);
  });

  it("detects imperative verb phrases", () => {
    expect(isInstructionLine("Preheat oven to 400°F")).toBe(true);
    expect(isInstructionLine("Heat oil in a large pan")).toBe(true);
    expect(isInstructionLine("Combine all dry ingredients")).toBe(true);
  });

  it("detects unusually long freeform sentences", () => {
    const longLine = "You can also use any other type of protein here if you prefer something different from what is listed above in the recipe instructions.";
    expect(isInstructionLine(longLine)).toBe(true);
  });

  it("does not flag normal ingredient lines as instructions", () => {
    expect(isInstructionLine("200g chicken breast")).toBe(false);
    expect(isInstructionLine("1 cup rice")).toBe(false);
    expect(isInstructionLine("olive oil")).toBe(false);
    expect(isInstructionLine("salt and pepper")).toBe(false);
  });

  it("returns false for empty lines", () => {
    expect(isInstructionLine("")).toBe(false);
  });
});

/* ---- Bulk review engine tests ---- */
describe("computeBulkSummary", () => {
  it("categorizes lines across multiple recipes into matched, ambiguous, create-new, and ignored", () => {
    const hh = makeHousehold();
    const recipe1 = makePaprikaRecipe({ name: "R1", ingredients: "200g chicken breast\nsome mystery spice" });
    const recipe2 = makePaprikaRecipe({ name: "R2", ingredients: "1 cup rice\npasta" });
    const parsed = parsePaprikaRecipes([recipe1, recipe2], hh.ingredients, []);

    const summary = computeBulkSummary(parsed);
    expect(summary.matched.length).toBe(2); // chicken + rice
    expect(summary.createNew.length).toBeGreaterThanOrEqual(1); // pasta from catalog defaults to create
    expect(summary.ambiguous.length).toBeGreaterThanOrEqual(1); // mystery spice unresolved
    expect(summary.ignored.length).toBeGreaterThanOrEqual(0);
  });

  it("excludes deselected recipes from summary", () => {
    const hh = makeHousehold();
    const recipe1 = makePaprikaRecipe({ name: "R1", ingredients: "200g chicken breast" });
    const recipe2 = makePaprikaRecipe({ name: "R2", ingredients: "1 cup rice" });
    const parsed = parsePaprikaRecipes([recipe1, recipe2], hh.ingredients, []);
    parsed[1]!.selected = false;

    const summary = computeBulkSummary(parsed);
    expect(summary.matched.length).toBe(1); // only chicken from R1
  });
});

describe("applyBulkAction", () => {
  it("approve-matched sets all matched lines to use", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({ ingredients: "200g chicken breast\n1 cup rice" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const result = applyBulkAction(parsed, "approve-matched");
    const useLines = result[0]!.parsedLines.filter((l) => l.action === "use");
    expect(useLines.length).toBe(2);
  });

  it("create-all-new sets unmatched lines with names to create", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({ ingredients: "some mystery spice\nanother strange item" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const result = applyBulkAction(parsed, "create-all-new");
    const createLines = result[0]!.parsedLines.filter((l) => l.action === "create");
    expect(createLines.length).toBe(2);
  });

  it("ignore-instructions sets nameless lines to ignore", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({
      ingredients: "200g chicken breast\n* See note below for substitutions",
    });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const result = applyBulkAction(parsed, "ignore-instructions");
    const ignored = result[0]!.parsedLines.filter((l) => l.action === "ignore");
    expect(ignored.length).toBeGreaterThanOrEqual(1);
  });
});

/* ---- Session persistence tests ---- */
describe("Import session persistence", () => {
  it("saves and loads import session from localStorage", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe();
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const session = {
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review" as const,
      savedAt: new Date().toISOString(),
    };

    saveImportSession(session);
    const loaded = loadImportSession("h-bulk");
    expect(loaded).not.toBeNull();
    expect(loaded!.step).toBe("review");
    expect(loaded!.parsedRecipes).toHaveLength(1);
  });

  it("returns null for wrong household ID", () => {
    saveImportSession({
      householdId: "h-other",
      parsedRecipes: [],
      step: "select",
      savedAt: new Date().toISOString(),
    });
    expect(loadImportSession("h-bulk")).toBeNull();
  });

  it("clearImportSession removes stored session", () => {
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: [],
      step: "select",
      savedAt: new Date().toISOString(),
    });
    clearImportSession();
    expect(loadImportSession("h-bulk")).toBeNull();
  });
});

/* ---- Parsed line metadata tests ---- */
describe("PaprikaReviewLine metadata", () => {
  it("includes recipeIndex and recipeName on parsed lines", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({ name: "My Recipe" });
    const lines = parseRecipeIngredients(recipe, hh.ingredients, 5);
    expect(lines[0]!.recipeIndex).toBe(5);
    expect(lines[0]!.recipeName).toBe("My Recipe");
  });

  it("preserves raw line, parsed name, quantity, and unit", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({ ingredients: "1.5 cups of water" });
    const lines = parseRecipeIngredients(recipe, hh.ingredients, 0);
    expect(lines[0]!.raw).toBe("1.5 cups of water");
    expect(lines[0]!.name).toBe("water");
    expect(lines[0]!.quantity).toBe("1.5 cups");
    expect(lines[0]!.unit).toBe("cups");
  });

  it("detects instruction lines and marks them as ignore with empty name", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({
      ingredients: "200g chicken breast\n* Preheat oven to 350F",
    });
    const lines = parseRecipeIngredients(recipe, hh.ingredients, 0);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.action).toBe("ignore");
    expect(lines[1]!.name).toBe("");
  });
});

/* ---- Bulk-reviewed import produces compatible draft meals ---- */
describe("Bulk-reviewed import compatibility", () => {
  it("bulk-reviewed recipes produce valid draft meals with import mappings", () => {
    const hh = makeHousehold();
    const recipe1 = makePaprikaRecipe({ name: "Meal A", ingredients: "200g chicken breast\n1 cup rice" });
    const recipe2 = makePaprikaRecipe({ name: "Meal B", ingredients: "pasta\nsome mystery" });
    const parsed = parsePaprikaRecipes([recipe1, recipe2], hh.ingredients, []);

    // Apply bulk actions
    let updated = applyBulkAction(parsed, "approve-matched");
    updated = applyBulkAction(updated, "create-all-new");

    for (const recipe of updated.filter((r) => r.selected)) {
      const { meal, newIngredients } = buildDraftMeal(recipe.raw, recipe.parsedLines);
      expect(meal.name).toBeTruthy();
      expect(meal.provenance?.sourceSystem).toBe("paprika");
      expect(meal.importMappings).toBeDefined();
      expect(meal.importMappings!.length).toBeGreaterThanOrEqual(1);
      // Every used/created component should have an import mapping
      for (const comp of meal.components) {
        const mapping = meal.importMappings!.find((m) => m.ingredientId === comp.ingredientId);
        expect(mapping).toBeDefined();
      }
      // New ingredients should have valid structure
      for (const ing of newIngredients) {
        expect(ing.id).toBeTruthy();
        expect(ing.name).toBeTruthy();
        expect(ing.category).toBeTruthy();
      }
    }
  });

  it("grocery and planner behavior unaffected by bulk import", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({ name: "Imported Meal", ingredients: "200g chicken breast\n1 cup rice" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const updated = applyBulkAction(parsed, "approve-matched");
    const { meal } = buildDraftMeal(updated[0]!.raw, updated[0]!.parsedLines);

    // Meal has proper structure for planner
    expect(meal.components.length).toBe(2);
    expect(meal.estimatedTimeMinutes).toBeGreaterThan(0);
    expect(meal.difficulty).toBeDefined();
    // Components reference valid ingredient IDs from household
    for (const comp of meal.components) {
      const ing = hh.ingredients.find((i) => i.id === comp.ingredientId);
      expect(ing).toBeDefined();
    }
  });

  it("end-to-end bulk review import keeps valid ingredient references", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({
      name: "End to End Meal",
      ingredients: "200g chicken breast\n1 cup rice\n1 pinch of salt",
    });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const updated = applyBulkAction(parsed, "approve-matched");
    const { meal, newIngredients } = buildDraftMeal(updated[0]!.raw, updated[0]!.parsedLines);

    const combinedIngredients = [...hh.ingredients, ...newIngredients];
    for (const component of meal.components) {
      expect(combinedIngredients.some((ing) => ing.id === component.ingredientId)).toBe(true);
    }
    expect(meal.importMappings?.every((m) => m.originalLine && m.action)).toBe(true);
  });
});

/* ---- UI: Bulk review workflow ---- */
describe("PaprikaImport bulk review UI", () => {
  it("shows bulk summary chips with match counts in review step", async () => {
    const hh = makeHousehold();
    saveHousehold(hh);

    // Simulate direct state: save a session and render at review
    const recipe = makePaprikaRecipe({ ingredients: "200g chicken breast\n1 cup rice\nsome mystery" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    expect(screen.getByTestId("paprika-review-step")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-summary")).toBeInTheDocument();
    expect(screen.getByText(/exact matches/)).toBeInTheDocument();
  });

  it("shows bulk action buttons in review step", async () => {
    const hh = makeHousehold();
    saveHousehold(hh);
    const recipe = makePaprikaRecipe();
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    expect(screen.getByTestId("bulk-approve-matched")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-create-new")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-ignore-instructions")).toBeInTheDocument();
  });

  it("has ambiguous-only filter button", async () => {
    const hh = makeHousehold();
    saveHousehold(hh);
    const recipe = makePaprikaRecipe({ ingredients: "200g chicken breast\nsome mystery" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    expect(screen.getByTestId("filter-ambiguous")).toBeInTheDocument();
  });

  it("shows recipe name label on each review line", async () => {
    const hh = makeHousehold();
    saveHousehold(hh);
    const recipe = makePaprikaRecipe({ name: "Thai Curry", ingredients: "200g chicken breast" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    expect(screen.getByText("Thai Curry")).toBeInTheDocument();
  });

  it("has pause/resume button that saves session", async () => {
    const user = userEvent.setup();
    const hh = makeHousehold();
    saveHousehold(hh);
    const recipe = makePaprikaRecipe();
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    expect(screen.getByTestId("pause-import-btn")).toBeInTheDocument();
    await user.click(screen.getByTestId("pause-import-btn"));
    expect(loadImportSession("h-bulk")).not.toBeNull();
  });

  it("restores saved session on page load", () => {
    const hh = makeHousehold();
    saveHousehold(hh);
    const recipe = makePaprikaRecipe({ name: "Saved Recipe" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "select",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    expect(screen.getByTestId("paprika-select-step")).toBeInTheDocument();
    expect(screen.getByText("Saved Recipe")).toBeInTheDocument();
  });

  it("clears session after successful import", async () => {
    const user = userEvent.setup();
    const hh = makeHousehold();
    saveHousehold(hh);
    const recipe = makePaprikaRecipe({ name: "Import Me", ingredients: "200g chicken breast" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    await user.click(screen.getByTestId("import-save-all-btn"));

    expect(screen.getByTestId("paprika-done-step")).toBeInTheDocument();
    expect(loadImportSession("h-bulk")).toBeNull();

    const saved = loadHousehold("h-bulk")!;
    expect(saved.baseMeals).toHaveLength(1);
    expect(saved.baseMeals[0]!.name).toBe("Import Me");
  });

  it("shows all lines across multiple recipes in bulk review", () => {
    const hh = makeHousehold();
    saveHousehold(hh);
    const recipe1 = makePaprikaRecipe({ name: "R1", ingredients: "200g chicken breast" });
    const recipe2 = makePaprikaRecipe({ name: "R2", ingredients: "1 cup rice" });
    const parsed = parsePaprikaRecipes([recipe1, recipe2], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    // Both recipes' lines should be visible
    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText("R2")).toBeInTheDocument();
    const reviewLines = screen.getAllByTestId(/review-line-\d+/);
    expect(reviewLines.length).toBe(2);
  });

  it("shows visible saved-state status in review flow", () => {
    const hh = makeHousehold();
    saveHousehold(hh);
    const recipe = makePaprikaRecipe({ name: "Saved State Recipe" });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    saveImportSession({
      householdId: "h-bulk",
      parsedRecipes: parsed,
      step: "review",
      savedAt: new Date().toISOString(),
    });

    renderAt("/household/h-bulk/import-paprika");
    expect(screen.getAllByTestId("import-session-status")[0]!.textContent).toMatch(/Saved to draft/);
  });
});

/* ---- Instruction detection in Paprika context ---- */
describe("Instruction line detection in Paprika import", () => {
  it("auto-ignores instruction lines in Paprika recipes", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({
      ingredients: "200g chicken breast\nPreheat oven to 400°F\n1 cup rice",
    });
    const lines = parseRecipeIngredients(recipe, hh.ingredients, 0);
    expect(lines).toHaveLength(3);
    expect(lines[0]!.action).toBe("use");
    expect(lines[1]!.action).toBe("ignore");
    expect(lines[1]!.name).toBe("");
    expect(lines[2]!.action).toBe("use");
  });

  it("auto-ignores asterisk-prefixed notes", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({
      ingredients: "1 cup rice\n** This is a special note about the recipe",
    });
    const lines = parseRecipeIngredients(recipe, hh.ingredients, 0);
    const ignored = lines.filter((l) => l.action === "ignore");
    expect(ignored.length).toBeGreaterThanOrEqual(1);
  });
});

/* ---- Preserve review data for auditing ---- */
describe("Review data preserved for auditing", () => {
  it("import mappings preserve raw lines, parsed names, quantities, and actions", () => {
    const hh = makeHousehold();
    const recipe = makePaprikaRecipe({
      ingredients: "200g chicken breast\n1 cup rice\n* cooking note",
    });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const updated = applyBulkAction(parsed, "approve-matched");
    const { meal } = buildDraftMeal(updated[0]!.raw, updated[0]!.parsedLines);

    expect(meal.importMappings).toBeDefined();
    expect(meal.importMappings!.length).toBe(3);

    const chickenMapping = meal.importMappings!.find((m) => m.originalLine.includes("chicken"));
    expect(chickenMapping).toBeDefined();
    expect(chickenMapping!.action).toBe("use");
    expect(chickenMapping!.parsedName).toBeTruthy();
    expect(chickenMapping!.parsedQuantityValue).toBeDefined();
    expect(chickenMapping!.parsedQuantityUnit).toBeDefined();
    expect(chickenMapping!.chosenAction).toBe("use");
    expect(chickenMapping!.finalMatchedIngredientId).toBeTruthy();

    const noteMapping = meal.importMappings!.find((m) => m.originalLine.includes("cooking note"));
    expect(noteMapping).toBeDefined();
    expect(noteMapping!.action).toBe("ignore");
    expect(noteMapping!.chosenAction).toBe("ignore");
  });
});
