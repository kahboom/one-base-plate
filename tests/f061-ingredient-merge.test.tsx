import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, Ingredient, BaseMeal, Recipe, WeeklyPlan } from "../src/types";
import { saveHousehold, loadHousehold, mergeDuplicateMetadata, remapIngredientReferences } from "../src/storage";
import IngredientManager from "../src/pages/IngredientManager";

function makeIngredient(overrides: Partial<Ingredient> & { name: string }): Ingredient {
  return {
    id: `ing-${overrides.name.toLowerCase().replace(/\s+/g, "-")}`,
    category: "pantry",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: "manual",
    ...overrides,
  };
}

function makeMeal(overrides: Partial<BaseMeal> & { name: string; ingredientIds?: string[] }): BaseMeal {
  const { name, ingredientIds, ...rest } = overrides;
  return {
    id: `meal-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    components: (ingredientIds ?? []).map((id) => ({
      id: crypto.randomUUID(),
      ingredientId: id,
      role: "protein" as const,
      quantity: "1",
    })),
    defaultPrep: "cook",
    estimatedTimeMinutes: 30,
    difficulty: "easy",
    rescueEligible: false,
    wasteReuseHints: [],
    ...rest,
  };
}

function seedHousehold(opts: {
  ingredients?: Ingredient[];
  baseMeals?: BaseMeal[];
  recipes?: Recipe[];
  weeklyPlans?: WeeklyPlan[];
} = {}): Household {
  const household: Household = {
    id: "h-merge",
    name: "Merge Test Family",
    members: [
      { id: "m1", name: "Parent", role: "adult", safeFoods: [], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" },
    ],
    ingredients: opts.ingredients ?? [],
    baseMeals: opts.baseMeals ?? [],
    weeklyPlans: opts.weeklyPlans ?? [],
    recipes: opts.recipes ?? [],
  };
  saveHousehold(household);
  return household;
}

function renderPage(householdId = "h-merge") {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/ingredients`]}>
      <Routes>
        <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function filterToManual(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByTestId("ingredient-source-filter"), "manual");
}

async function openIngredientModal(user: ReturnType<typeof userEvent.setup>, ingredientId: string) {
  await user.click(screen.getByTestId(`ingredient-row-${ingredientId}`));
  return screen.getByTestId("ingredient-modal");
}

beforeEach(() => {
  localStorage.clear();
});

/* ------------------------------------------------------------------ */
/*  Unit tests: mergeDuplicateMetadata                                 */
/* ------------------------------------------------------------------ */

describe("mergeDuplicateMetadata", () => {
  it("combines tags from both ingredients", () => {
    const survivor = makeIngredient({ name: "Chicken", tags: ["quick"] });
    const absorbed = makeIngredient({ name: "Chicken alt", tags: ["batch-friendly", "quick"] });
    const result = mergeDuplicateMetadata(survivor, [absorbed]);
    expect(result.tags).toContain("quick");
    expect(result.tags).toContain("batch-friendly");
    expect(result.tags).toHaveLength(2);
  });

  it("inherits imageUrl from absorbed when survivor has none", () => {
    const survivor = makeIngredient({ name: "Chicken" });
    const absorbed = makeIngredient({ name: "Chicken alt", imageUrl: "http://img.jpg" });
    const result = mergeDuplicateMetadata(survivor, [absorbed]);
    expect(result.imageUrl).toBe("http://img.jpg");
  });

  it("keeps survivor imageUrl when both have one", () => {
    const survivor = makeIngredient({ name: "Chicken", imageUrl: "http://survivor.jpg" });
    const absorbed = makeIngredient({ name: "Chicken alt", imageUrl: "http://absorbed.jpg" });
    const result = mergeDuplicateMetadata(survivor, [absorbed]);
    expect(result.imageUrl).toBe("http://survivor.jpg");
  });

  it("ORs boolean flags", () => {
    const survivor = makeIngredient({ name: "Chicken", freezerFriendly: false, babySafeWithAdaptation: true });
    const absorbed = makeIngredient({ name: "Chicken alt", freezerFriendly: true, babySafeWithAdaptation: false });
    const result = mergeDuplicateMetadata(survivor, [absorbed]);
    expect(result.freezerFriendly).toBe(true);
    expect(result.babySafeWithAdaptation).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Unit tests: remapIngredientReferences                              */
/* ------------------------------------------------------------------ */

describe("remapIngredientReferences", () => {
  it("remaps ingredientId on base meal components", () => {
    const household: Household = {
      id: "h-test", name: "Test", members: [],
      ingredients: [makeIngredient({ name: "Survivor", id: "surv" })],
      baseMeals: [makeMeal({ name: "Dinner", ingredientIds: ["absorbed-id"] })],
      weeklyPlans: [],
    };
    const count = remapIngredientReferences(household, new Map([["absorbed-id", "surv"]]));
    expect(count).toBe(1);
    expect(household.baseMeals[0]!.components[0]!.ingredientId).toBe("surv");
  });

  it("remaps alternativeIngredientIds and deduplicates", () => {
    const household: Household = {
      id: "h-test", name: "Test", members: [],
      ingredients: [],
      baseMeals: [{
        id: "m1", name: "Meal",
        components: [{
          ingredientId: "surv",
          alternativeIngredientIds: ["absorbed-id", "other"],
          role: "protein", quantity: "1",
        }],
        defaultPrep: "", estimatedTimeMinutes: 30, difficulty: "easy",
        rescueEligible: false, wasteReuseHints: [],
      }],
      weeklyPlans: [],
    };
    remapIngredientReferences(household, new Map([["absorbed-id", "surv"]]));
    const comp = household.baseMeals[0]!.components[0]!;
    expect(comp.alternativeIngredientIds).toEqual(["other"]);
  });

  it("remaps recipe components", () => {
    const household: Household = {
      id: "h-test", name: "Test", members: [],
      ingredients: [],
      baseMeals: [],
      recipes: [{
        id: "r1", name: "Recipe",
        components: [{ ingredientId: "absorbed-id", role: "protein", quantity: "1" }],
      }],
      weeklyPlans: [],
    };
    remapIngredientReferences(household, new Map([["absorbed-id", "surv"]]));
    expect(household.recipes![0]!.components[0]!.ingredientId).toBe("surv");
  });

  it("remaps weekly plan grocery list", () => {
    const household: Household = {
      id: "h-test", name: "Test", members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [{
        id: "wp1", days: [], selectedBaseMeals: [], notes: "",
        generatedGroceryList: [
          { ingredientId: "absorbed-id", name: "test", category: "pantry", quantity: "1", owned: false },
        ],
      }],
    };
    remapIngredientReferences(household, new Map([["absorbed-id", "surv"]]));
    expect(household.weeklyPlans[0]!.generatedGroceryList[0]!.ingredientId).toBe("surv");
  });

  it("returns 0 for empty remap", () => {
    const household: Household = {
      id: "h-test", name: "Test", members: [],
      ingredients: [], baseMeals: [], weeklyPlans: [],
    };
    expect(remapIngredientReferences(household, new Map())).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  UI: Merge button visibility                                        */
/* ------------------------------------------------------------------ */

describe("F061: Merge button visibility", () => {
  it("shows merge button for existing ingredients", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Rice" }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    expect(within(modal).getByTestId("merge-open-btn")).toBeInTheDocument();
  });

  it("hides merge button for new (unsaved) ingredients", async () => {
    seedHousehold({ ingredients: [] });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    expect(within(modal).queryByTestId("merge-open-btn")).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  UI: Merge search flow                                              */
/* ------------------------------------------------------------------ */

describe("F061: Merge search", () => {
  it("opens search panel when merge button clicked", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Rice" }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    expect(within(modal).getByTestId("merge-search-panel")).toBeInTheDocument();
    expect(within(modal).getByTestId("merge-search-input")).toBeInTheDocument();
  });

  it("filters results and excludes the current ingredient", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Zylotron alpha" }),
        makeIngredient({ name: "Zylotron beta" }),
        makeIngredient({ name: "Rice" }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-zylotron-alpha");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "Zylotron");

    const results = within(modal).getByTestId("merge-search-results");
    const items = within(results).getAllByRole("button");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Zylotron beta");
  });

  it("shows no-results message when search has no matches", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Rice" }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "zzzzz");

    expect(within(modal).getByText("No matching ingredients found.")).toBeInTheDocument();
  });

  it("can cancel merge search", async () => {
    seedHousehold({
      ingredients: [makeIngredient({ name: "Chicken" }), makeIngredient({ name: "Rice" })],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    expect(within(modal).getByTestId("merge-search-panel")).toBeInTheDocument();

    await user.click(within(modal).getByTestId("merge-search-cancel"));
    expect(within(modal).queryByTestId("merge-search-panel")).not.toBeInTheDocument();
    expect(within(modal).getByTestId("merge-open-btn")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  UI: Merge confirmation                                             */
/* ------------------------------------------------------------------ */

describe("F061: Merge confirmation", () => {
  it("shows confirmation view when a merge target is selected", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Chicken thighs", tags: ["quick"] }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");

    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    const confirm = within(modal).getByTestId("merge-confirm-view");
    expect(confirm).toBeInTheDocument();
    expect(confirm).toHaveTextContent("Chicken thighs");
    expect(confirm).toHaveTextContent("Chicken");
    expect(within(modal).getByTestId("merge-confirm-btn")).toBeInTheDocument();
    expect(within(modal).getByTestId("merge-cancel-btn")).toBeInTheDocument();
  });

  it("shows tags to be added in confirmation", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken", tags: ["staple"] }),
        makeIngredient({ name: "Chicken thighs", tags: ["quick", "staple"] }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    const confirm = within(modal).getByTestId("merge-confirm-view");
    expect(confirm).toHaveTextContent("Tags added: quick");
  });

  it("can cancel confirmation and go back to search", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Rice" }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "Rice");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    expect(within(modal).getByTestId("merge-confirm-view")).toBeInTheDocument();
    await user.click(within(modal).getByTestId("merge-cancel-btn"));

    expect(within(modal).queryByTestId("merge-confirm-view")).not.toBeInTheDocument();
    expect(within(modal).getByTestId("merge-search-panel")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  UI: Survivor selection                                             */
/* ------------------------------------------------------------------ */

describe("F061: Survivor selection", () => {
  it("shows survivor picker with both ingredients as radio options", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Chicken thighs" }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    const picker = within(modal).getByTestId("merge-survivor-picker");
    expect(picker).toBeInTheDocument();
    expect(within(picker).getByTestId("merge-survivor-radio-ing-chicken")).toBeChecked();
    expect(within(picker).getByTestId("merge-survivor-radio-ing-chicken-thighs")).not.toBeChecked();
  });

  it("defaults the currently-edited ingredient as survivor", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Rice" }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "Rice");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    const confirm = within(modal).getByTestId("merge-confirm-view");
    expect(confirm).toHaveTextContent(/Merge\s.*Rice.*\s+into\s.*Chicken/);
  });

  it("swaps survivor and absorbed when user selects the other radio", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken", tags: ["staple"] }),
        makeIngredient({ name: "Chicken thighs", tags: ["quick"] }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    const confirm = within(modal).getByTestId("merge-confirm-view");
    expect(confirm).toHaveTextContent(/Merge\s.*Chicken thighs.*\s+into\s.*Chicken/);

    await user.click(within(modal).getByTestId("merge-survivor-radio-ing-chicken-thighs"));
    expect(confirm).toHaveTextContent(/Merge\s.*Chicken.*\s+into\s.*Chicken thighs/);
    expect(confirm).toHaveTextContent("Tags added: staple");
  });

  it("executes merge with the swapped survivor when confirmed", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken", tags: ["staple"] }),
        makeIngredient({ name: "Chicken thighs", tags: ["quick"], freezerFriendly: true }),
      ],
      baseMeals: [makeMeal({ name: "Dinner", ingredientIds: ["ing-chicken"] })],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    await user.click(within(modal).getByTestId("merge-survivor-radio-ing-chicken-thighs"));
    await user.click(within(modal).getByTestId("merge-confirm-btn"));

    const saved = loadHousehold("h-merge")!;
    expect(saved.ingredients.find((i) => i.id === "ing-chicken")).toBeUndefined();
    const survivor = saved.ingredients.find((i) => i.id === "ing-chicken-thighs");
    expect(survivor).toBeDefined();
    expect(survivor!.tags).toContain("staple");
    expect(survivor!.tags).toContain("quick");
    expect(survivor!.freezerFriendly).toBe(true);
    expect(saved.baseMeals[0]!.components[0]!.ingredientId).toBe("ing-chicken-thighs");
  });

  it("updates reference count when survivor is swapped", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Chicken thighs" }),
      ],
      baseMeals: [
        makeMeal({ name: "Dinner A", ingredientIds: ["ing-chicken-thighs"] }),
        makeMeal({ name: "Dinner B", ingredientIds: ["ing-chicken-thighs"] }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    const confirm = within(modal).getByTestId("merge-confirm-view");
    expect(confirm).toHaveTextContent("2 references will be remapped");

    await user.click(within(modal).getByTestId("merge-survivor-radio-ing-chicken-thighs"));
    expect(confirm).toHaveTextContent("No additional metadata to merge");
  });
});

/* ------------------------------------------------------------------ */
/*  UI: Merge execution                                                */
/* ------------------------------------------------------------------ */

describe("F061: Merge execution", () => {
  it("merges absorbed ingredient into survivor and removes it from the list", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken", tags: ["staple"] }),
        makeIngredient({ name: "Chicken thighs", tags: ["quick"], freezerFriendly: true }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);
    await user.click(within(modal).getByTestId("merge-confirm-btn"));

    const saved = loadHousehold("h-merge")!;
    expect(saved.ingredients.find((i) => i.id === "ing-chicken-thighs")).toBeUndefined();
    const survivor = saved.ingredients.find((i) => i.id === "ing-chicken");
    expect(survivor).toBeDefined();
    expect(survivor!.tags).toContain("staple");
    expect(survivor!.tags).toContain("quick");
    expect(survivor!.freezerFriendly).toBe(true);
  });

  it("remaps references from absorbed to survivor in storage", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Chicken thighs" }),
      ],
      baseMeals: [makeMeal({ name: "Dinner", ingredientIds: ["ing-chicken-thighs"] })],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);
    await user.click(within(modal).getByTestId("merge-confirm-btn"));

    const saved = loadHousehold("h-merge")!;
    expect(saved.baseMeals[0]!.components[0]!.ingredientId).toBe("ing-chicken");
  });

  it("keeps the modal open on the survivor after merge", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Rice" }),
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "Rice");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);
    await user.click(within(modal).getByTestId("merge-confirm-btn"));

    expect(screen.getByTestId("ingredient-modal")).toBeInTheDocument();
  });

  it("shows reference count in confirmation when absorbed has references", async () => {
    seedHousehold({
      ingredients: [
        makeIngredient({ name: "Chicken" }),
        makeIngredient({ name: "Chicken thighs" }),
      ],
      baseMeals: [makeMeal({ name: "Dinner", ingredientIds: ["ing-chicken-thighs"] })],
    });
    const user = userEvent.setup();
    renderPage();
    await filterToManual(user);

    const modal = await openIngredientModal(user, "ing-chicken");
    await user.click(within(modal).getByTestId("merge-open-btn"));
    await user.type(within(modal).getByTestId("merge-search-input"), "thighs");
    const results = within(modal).getByTestId("merge-search-results");
    await user.click(within(results).getAllByRole("button")[0]!);

    const confirm = within(modal).getByTestId("merge-confirm-view");
    expect(confirm).toHaveTextContent("1 reference will be remapped");
  });
});
