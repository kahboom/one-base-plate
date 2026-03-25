import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { saveHousehold, loadHousehold } from "../src/storage";
import {
  parseIngredientLine,
  matchIngredient,
  parseRecipeText,
  guessComponentRole,
  isInstructionLine,
  stripLeadingIngredientNoise,
} from "../src/recipe-parser";
import type { Household, Ingredient } from "../src/types";

function makeHousehold(): Household {
  return {
    id: "h-import",
    name: "Import Test Family",
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
        name: "Chicken breast",
        category: "protein",
        tags: ["quick"],
        shelfLifeHint: "",
        freezerFriendly: true,
        babySafeWithAdaptation: true,
        source: "manual",
      },
      {
        id: "ing-rice",
        name: "Rice",
        category: "carb",
        tags: ["staple"],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        source: "manual",
      },
      {
        id: "ing-broccoli",
        name: "Broccoli",
        category: "veg",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: true,
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

/* ---- Parser engine tests ---- */
describe("parseIngredientLine", () => {
  it("extracts quantity and name from a line with units", () => {
    const result = parseIngredientLine("200g chicken breast");
    expect(result.quantity).toBe("200g");
    expect(result.name).toBe("chicken breast");
  });

  it("handles lines without quantity", () => {
    const result = parseIngredientLine("olive oil");
    expect(result.quantity).toBe("");
    expect(result.name).toBe("olive oil");
  });

  it("strips bullet points and dashes", () => {
    const result = parseIngredientLine("- 1 cup rice");
    expect(result.name).toBe("rice");
    expect(result.quantity).toBe("1 cup");
  });

  it("strips period-space list markers (Word / some exports)", () => {
    expect(parseIngredientLine(". cilantro").name).toBe("cilantro");
    const withQty = parseIngredientLine(". 1 cup rice");
    expect(withQty.quantity).toBe("1 cup");
    expect(withQty.name).toBe("rice");
  });

  it("does not strip decimal quantities like .5 tbsp", () => {
    const result = parseIngredientLine(".5 tbsp olive oil");
    expect(result.quantity).toBe(".5 tbsp");
    expect(result.name).toBe("olive oil");
  });

  it("stays after abbreviated units with a period (Paprika / US style)", () => {
    // Word boundary after oz leaves the period before the ingredient name
    const toasted = parseIngredientLine("12 oz. cheese ravioli");
    expect(toasted.quantity).toMatch(/^12\s+oz/i);
    expect(toasted.name).toBe("cheese ravioli");

    const thai = parseIngredientLine("3 tbsp. cilantro, chopped (optional)");
    expect(thai.quantity).toMatch(/^3\s+tbsp/i);
    expect(thai.name).toBe("cilantro");

    const mashed = parseIngredientLine("100 ml. (4 oz.) cream");
    expect(mashed.quantity).toMatch(/^100\s+ml/i);
    expect(mashed.name).toBe("cream");
  });

  it("handles numbered lists", () => {
    const result = parseIngredientLine("3. 2 tbsp soy sauce");
    expect(result.name).toBe("soy sauce");
  });

  it("returns empty for blank lines", () => {
    const result = parseIngredientLine("  ");
    expect(result.name).toBe("");
  });

  it("strips leading + and glued en-dash before quantities (Paprika)", () => {
    const plus = parseIngredientLine("+1 cup rice");
    expect(plus.quantity).toMatch(/^1\s+cup/i);
    expect(plus.name).toBe("rice");

    const enDash = parseIngredientLine("–3 tablespoons vegetable oil");
    expect(enDash.quantity).toMatch(/^3\s+tablespoons/i);
    expect(enDash.name).toBe("vegetable oil");
  });

  it("strips metric bracket prefix and normalizes lb of … to 1 lb", () => {
    const r = parseIngredientLine("[0.23 kg] lb of ñame");
    expect(r.quantity.toLowerCase()).toMatch(/^1\s+lb/);
    expect(r.name.toLowerCase()).toContain("ñame");
  });

  it("strips fullwidth metric brackets (some exports)", () => {
    const r = parseIngredientLine("［0.23 kg］ lb of yuca");
    expect(r.name.toLowerCase()).toContain("yuca");
    expect(r.quantity.toLowerCase()).toMatch(/^1\s+lb/);
  });

  it("strips Accompaniment: label prefix", () => {
    const r = parseIngredientLine("Accompaniment:Pineapple-Avocado Salsa");
    expect(r.name.toLowerCase()).toContain("pineapple");
    expect(r.name.toLowerCase()).toContain("salsa");
  });
});

describe("isInstructionLine (Paprika noise)", () => {
  it("treats +Add… as instruction after stripping +", () => {
    expect(isInstructionLine("+Add all ingredients to list")).toBe(true);
  });

  it("treats subsection titles as instructions", () => {
    expect(isInstructionLine("Adding mushrooms and spinach:")).toBe(true);
    expect(isInstructionLine("For the sauce:")).toBe(true);
  });
});

describe("stripLeadingIngredientNoise", () => {
  it("removes markers and bracket prefix", () => {
    expect(stripLeadingIngredientNoise("+ – [1.5 kg] lb of yuca")).toMatch(/^1 lb of yuca/i);
  });
});

describe("matchIngredient", () => {
  const household: Ingredient[] = [
    { id: "i1", name: "Chicken breast", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: false },
    { id: "i2", name: "Rice", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: false },
  ];

  it("matches exact household ingredient", () => {
    const { ingredient, status } = matchIngredient("Chicken breast", household);
    expect(status).toBe("matched");
    expect(ingredient?.id).toBe("i1");
  });

  it("matches case-insensitively", () => {
    const { ingredient, status } = matchIngredient("chicken breast", household);
    expect(status).toBe("matched");
    expect(ingredient?.id).toBe("i1");
  });

  it("falls back to catalog when no household match", () => {
    const { catalogItem, status } = matchIngredient("Pasta", []);
    expect(status).toBe("catalog");
    expect(catalogItem?.name).toBe("pasta");
  });

  it("returns unmatched when nothing matches", () => {
    const { status } = matchIngredient("dragon fruit compote", []);
    expect(status).toBe("unmatched");
  });

  it("prefers household over catalog", () => {
    const { ingredient, status } = matchIngredient("Rice", household);
    expect(status).toBe("matched");
    expect(ingredient?.id).toBe("i2");
  });
});

describe("parseRecipeText", () => {
  it("parses multi-line recipe text into matched lines", () => {
    const household = makeHousehold().ingredients;
    const text = "200g chicken breast\n1 cup rice\nsome mystery spice";
    const result = parseRecipeText(text, household);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]!.status).toBe("matched");
    expect(result.lines[1]!.status).toBe("matched");
    expect(result.lines[2]!.status).toBe("unmatched");
  });

  it("skips blank lines", () => {
    const result = parseRecipeText("rice\n\npasta", []);
    expect(result.lines).toHaveLength(2);
  });
});

describe("guessComponentRole", () => {
  it("maps protein category to protein role", () => {
    expect(guessComponentRole("protein")).toBe("protein");
  });

  it("maps carb category to carb role", () => {
    expect(guessComponentRole("carb")).toBe("carb");
  });

  it("maps veg/fruit to veg role", () => {
    expect(guessComponentRole("veg")).toBe("veg");
    expect(guessComponentRole("fruit")).toBe("veg");
  });

  it("maps other categories to topping", () => {
    expect(guessComponentRole("dairy")).toBe("topping");
    expect(guessComponentRole("pantry")).toBe("topping");
  });
});

/* ---- UI tests ---- */
describe("RecipeImport page", () => {
  it("renders the input step with paste textarea and parse button", () => {
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");
    expect(screen.getByText("Import Recipe")).toBeInTheDocument();
    expect(screen.getByTestId("import-recipe-text")).toBeInTheDocument();
    expect(screen.getByTestId("import-parse-btn")).toBeInTheDocument();
  });

  it("supports optional source URL field", () => {
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");
    expect(screen.getByTestId("import-source-url")).toBeInTheDocument();
  });

  it("disables parse button when no text is pasted", () => {
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");
    expect(screen.getByTestId("import-parse-btn")).toBeDisabled();
  });

  it("shows review step after parsing", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "200g chicken breast\n1 cup rice\nsome mystery spice");
    await user.click(screen.getByTestId("import-parse-btn"));

    expect(screen.getByTestId("import-review-step")).toBeInTheDocument();
    expect(screen.getByTestId("review-lines")).toBeInTheDocument();
  });

  it("shows match status chips in review step", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "200g chicken breast\nsome mystery spice");
    await user.click(screen.getByTestId("import-parse-btn"));

    expect(screen.getByText(/1 matched/)).toBeInTheDocument();
    expect(screen.getByText(/1 ignored/)).toBeInTheDocument();
  });

  it("lets user change action for a line from ignore to create", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "some mystery spice");
    await user.click(screen.getByTestId("import-parse-btn"));

    const actionSelect = screen.getByTestId("review-action-0");
    expect(actionSelect).toHaveValue("ignore");
    await user.selectOptions(actionSelect, "create");
    expect(actionSelect).toHaveValue("create");
  });

  it("builds draft with matched components", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "200g chicken breast\n1 cup rice");
    await user.click(screen.getByTestId("import-parse-btn"));
    await user.click(screen.getByTestId("import-build-draft-btn"));

    expect(screen.getByTestId("import-draft-step")).toBeInTheDocument();
    expect(screen.getByTestId("draft-components")).toBeInTheDocument();
    const components = screen.getAllByTestId(/draft-component-/);
    expect(components).toHaveLength(2);
  });

  it("attaches recipe URL to draft when provided", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-source-url"), "https://example.com/recipe");
    await user.type(screen.getByTestId("import-recipe-text"), "200g chicken breast");
    await user.click(screen.getByTestId("import-parse-btn"));
    await user.click(screen.getByTestId("import-build-draft-btn"));

    expect(screen.getByTestId("draft-recipe-link")).toHaveTextContent("https://example.com/recipe");
  });

  it("saves recipe to library and new ingredients to storage", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "200g chicken breast\npasta");
    await user.click(screen.getByTestId("import-parse-btn"));

    // Pasta should match catalog; set action to create
    const line1Action = screen.getByTestId("review-action-1");
    await user.selectOptions(line1Action, "create");

    await user.click(screen.getByTestId("import-build-draft-btn"));
    await user.type(screen.getByTestId("draft-meal-name"), "Chicken Pasta");
    await user.click(screen.getByTestId("import-save-btn"));

    const saved = loadHousehold("h-import")!;
    expect(saved.recipes ?? []).toHaveLength(1);
    expect(saved.baseMeals).toHaveLength(0);
    expect((saved.recipes ?? [])[0]!.name).toBe("Chicken Pasta");
    expect((saved.recipes ?? [])[0]!.components.length).toBeGreaterThanOrEqual(2);
  });

  it("creates ingredient from catalog match during save", async () => {
    const user = userEvent.setup();
    const hh = makeHousehold();
    // Remove pasta from household ingredients so it comes from catalog
    hh.ingredients = hh.ingredients.filter((i) => i.name !== "pasta");
    saveHousehold(hh);
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "pasta");
    await user.click(screen.getByTestId("import-parse-btn"));

    // Should find catalog match
    expect(screen.getByText(/Catalog: Pasta/)).toBeInTheDocument();

    await user.click(screen.getByTestId("import-build-draft-btn"));
    await user.type(screen.getByTestId("draft-meal-name"), "Pasta Dish");
    await user.click(screen.getByTestId("import-save-btn"));

    const saved = loadHousehold("h-import")!;
    expect(saved.recipes).toHaveLength(1);
    const pastaIng = saved.ingredients.find((i) => i.name === "pasta");
    expect(pastaIng).toBeDefined();
    expect(pastaIng!.source).toBe("catalog");
  });

  it("does not auto-save — creates draft instead", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "200g chicken breast");
    await user.click(screen.getByTestId("import-parse-btn"));
    await user.click(screen.getByTestId("import-build-draft-btn"));

    // Should be on draft step, not auto-saved
    expect(screen.getByTestId("import-draft-step")).toBeInTheDocument();
    expect(screen.getByTestId("draft-meal-name")).toBeInTheDocument();

    // Nothing saved yet
    const saved = loadHousehold("h-import")!;
    expect(saved.recipes ?? []).toHaveLength(0);
    expect(saved.baseMeals).toHaveLength(0);
  });

  it("save button is disabled when draft has no name", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "200g chicken breast");
    await user.click(screen.getByTestId("import-parse-btn"));
    await user.click(screen.getByTestId("import-build-draft-btn"));

    expect(screen.getByTestId("import-save-btn")).toBeDisabled();
  });
});

describe("Import recipe navigation", () => {
  it("BaseMealManager has Import recipe button", () => {
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/meals");
    expect(screen.getByTestId("import-recipe-btn")).toBeInTheDocument();
  });
});

describe("Imported ingredients are compatible with local-first storage", () => {
  it("imported ingredients persist through save and reload", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());
    renderAt("/household/h-import/import-recipe");

    await user.type(screen.getByTestId("import-recipe-text"), "200g chicken breast\ncouscous");
    await user.click(screen.getByTestId("import-parse-btn"));

    // couscous matches catalog - action should be "create"
    const line1Action = screen.getByTestId("review-action-1");
    await user.selectOptions(line1Action, "create");

    await user.click(screen.getByTestId("import-build-draft-btn"));
    await user.type(screen.getByTestId("draft-meal-name"), "Test Meal");
    await user.click(screen.getByTestId("import-save-btn"));

    // Reload and verify
    const saved = loadHousehold("h-import")!;
    expect(saved.recipes).toHaveLength(1);
    const libraryRecipe = saved.recipes![0]!;
    expect(libraryRecipe.components.length).toBe(2);
    // All component ingredient IDs should resolve to ingredients in the household
    for (const comp of libraryRecipe.components) {
      const ing = saved.ingredients.find((i) => i.id === comp.ingredientId);
      expect(ing).toBeDefined();
    }
  });
});
