import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, Ingredient } from "../src/types";
import { saveHousehold } from "../src/storage";
import { MASTER_CATALOG } from "../src/catalog";
import IngredientManager from "../src/pages/IngredientManager";
import { showAllIngredientRows } from "./incremental-load-helpers";

const CATALOG_SIZE = MASTER_CATALOG.length;

function makeIngredient(overrides: Partial<Ingredient> & { name: string }): Ingredient {
  return {
    id: `ing-${overrides.name.toLowerCase().replace(/\s+/g, "-")}`,
    category: "pantry",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    ...overrides,
  };
}

function seedWithIngredients(ingredients: Ingredient[]): Household {
  const household: Household = {
    id: "h-browse",
    name: "Browse Test Family",
    members: [
      { id: "m1", name: "Parent", role: "adult", safeFoods: [], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" },
    ],
    ingredients,
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function catalogOverlap(ingredients: Ingredient[]): number {
  const names = new Set(ingredients.map((i) => i.name.toLowerCase()));
  return MASTER_CATALOG.filter((ci) => names.has(ci.name.toLowerCase())).length;
}

function expectedTotal(ingredients: Ingredient[]): number {
  return ingredients.length + CATALOG_SIZE - catalogOverlap(ingredients);
}

function renderPage(householdId = "h-browse") {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/ingredients`]}>
      <Routes>
        <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F043: Browse-first compact list", () => {
  it("renders ingredients as compact rows including catalog items", async () => {
    const ingredients = [
      makeIngredient({ name: "Chicken", category: "protein", tags: ["quick"], freezerFriendly: true }),
      makeIngredient({ name: "Rice", category: "carb", tags: ["staple"] }),
      makeIngredient({ name: "Broccoli", category: "veg", babySafeWithAdaptation: true }),
    ];
    seedWithIngredients(ingredients);
    const user = userEvent.setup();
    renderPage();
    showAllIngredientRows();

    const total = expectedTotal(ingredients);
    expect(screen.getByText(`Items (${total})`)).toBeInTheDocument();

    // Paginated: page 1 shows up to 100 items; verify seeded items via search
    await user.type(screen.getByTestId("ingredient-search"), "Chicken");
    expect(screen.getByText("Chicken")).toBeInTheDocument();
    await user.clear(screen.getByTestId("ingredient-search"));
    await user.type(screen.getByTestId("ingredient-search"), "Rice");
    expect(screen.getByText("Rice")).toBeInTheDocument();
    await user.clear(screen.getByTestId("ingredient-search"));
    await user.type(screen.getByTestId("ingredient-search"), "Broccoli");
    expect(screen.getByText("Broccoli")).toBeInTheDocument();
  });

  it("shows freezer-friendly and baby-safe flags on rows", () => {
    const ingredients = [
      makeIngredient({ name: "Chicken", category: "protein", freezerFriendly: true }),
      makeIngredient({ name: "Carrots", category: "veg", babySafeWithAdaptation: true }),
      makeIngredient({ name: "Rice", category: "carb" }),
    ];
    seedWithIngredients(ingredients);
    renderPage();
    showAllIngredientRows();

    const chickenRow = screen.getByTestId("ingredient-row-ing-chicken");
    expect(within(chickenRow).getByTitle("Freezer friendly")).toBeInTheDocument();

    const carrotRow = screen.getByTestId("ingredient-row-ing-carrots");
    expect(within(carrotRow).getByTitle("Baby safe")).toBeInTheDocument();

    const riceRow = screen.getByTestId("ingredient-row-ing-rice");
    expect(within(riceRow).queryByTitle("Freezer friendly")).not.toBeInTheDocument();
    expect(within(riceRow).queryByTitle("Baby safe")).not.toBeInTheDocument();
  });

  it("page does not show expanded form fields until modal is opened", () => {
    seedWithIngredients([makeIngredient({ name: "Pasta", category: "carb" })]);
    renderPage();

    // No expanded form inputs visible on the browse view
    expect(screen.queryByPlaceholderText("Ingredient name")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Custom tag")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ingredient-modal")).not.toBeInTheDocument();
  });
});

describe("F043: Search and filter controls", () => {
  it("has a search input, category filter, and tag filter in a control bar", () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein", tags: ["quick"] }),
    ]);
    renderPage();

    expect(screen.getByTestId("ingredient-control-bar")).toBeInTheDocument();
    expect(screen.getByTestId("ingredient-search")).toBeInTheDocument();
    expect(screen.getByTestId("ingredient-category-filter")).toBeInTheDocument();
    expect(screen.getByTestId("ingredient-tag-filter")).toBeInTheDocument();
  });

  it("search filters ingredients by name", async () => {
    const ingredients = [
      makeIngredient({ name: "Chicken breast", category: "protein" }),
      makeIngredient({ name: "Rice", category: "carb" }),
      makeIngredient({ name: "Chickpeas", category: "pantry" }),
    ];
    seedWithIngredients(ingredients);
    const user = userEvent.setup();
    renderPage();

    // Search for a unique custom name not in catalog
    await user.type(screen.getByTestId("ingredient-search"), "Chicken breast");

    const rows = screen.getAllByTestId(/^ingredient-row-/);
    // Should find our custom "Chicken breast" (and catalog "Chicken breast" is deduplicated)
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    // Rice should be filtered out
    expect(screen.queryByTestId("ingredient-row-ing-rice")).not.toBeInTheDocument();
  });

  it("category filter shows only matching category", async () => {
    const ingredients = [
      makeIngredient({ name: "Chicken", category: "protein" }),
      makeIngredient({ name: "Rice", category: "carb" }),
      makeIngredient({ name: "Salmon", category: "protein" }),
    ];
    seedWithIngredients(ingredients);
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByTestId("ingredient-category-filter"), "protein");

    const rows = screen.getAllByTestId(/^ingredient-row-/);
    // All shown items should be protein (custom + catalog proteins)
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Chicken")).toBeInTheDocument();
    expect(screen.getByText("Salmon")).toBeInTheDocument();
    // Rice (carb) should not be shown
    expect(screen.queryByTestId("ingredient-row-ing-rice")).not.toBeInTheDocument();
  });

  it("tag filter shows only matching tagged ingredients", async () => {
    const ingredients = [
      makeIngredient({ name: "Chicken", category: "protein", tags: ["quick", "rescue"] }),
      makeIngredient({ name: "Rice", category: "carb", tags: ["staple"] }),
      makeIngredient({ name: "Pasta", category: "carb", tags: ["quick", "staple"] }),
    ];
    seedWithIngredients(ingredients);
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByTestId("ingredient-tag-filter"), "rescue");

    const rows = screen.getAllByTestId(/^ingredient-row-/);
    // Our custom "Chicken" has rescue, plus catalog items with rescue tag
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Chicken")).toBeInTheDocument();
  });

  it("shows filter count when filters narrow the list", async () => {
    const ingredients = [
      makeIngredient({ name: "Chicken", category: "protein" }),
      makeIngredient({ name: "Rice", category: "carb" }),
      makeIngredient({ name: "Salmon", category: "protein" }),
    ];
    seedWithIngredients(ingredients);
    const user = userEvent.setup();
    renderPage();

    const total = expectedTotal(ingredients);
    expect(screen.getByText(`Items (${total})`)).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("ingredient-category-filter"), "protein");

    expect(screen.getByTestId("ingredient-list-summary")).toHaveTextContent(/match/);
  });
});

describe("F043: Modal editing", () => {
  it("clicking a row opens the edit modal with ingredient details", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein", tags: ["quick"], freezerFriendly: true }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("ingredient-row-ing-chicken"));

    const modal = screen.getByTestId("ingredient-modal");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByTestId("modal-ingredient-name")).toHaveValue("Chicken");
    expect(within(modal).getByTestId("modal-ingredient-category")).toHaveValue("protein");
    expect(within(modal).getByLabelText("Freezer friendly")).toBeChecked();
    expect(within(modal).getByTestId("tag-quick")).toBeInTheDocument();
  });

  it("editing in the modal updates the browse list after closing", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("ingredient-row-ing-chicken"));
    const modal = screen.getByTestId("ingredient-modal");

    await user.clear(within(modal).getByTestId("modal-ingredient-name"));
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Aardvark roast");
    await user.click(within(modal).getByText("Done"));

    expect(screen.queryByTestId("ingredient-modal")).not.toBeInTheDocument();
    // Search for renamed item (may have moved pages due to sort)
    await user.type(screen.getByTestId("ingredient-search"), "Aardvark roast");
    expect(screen.getByText("Aardvark roast")).toBeInTheDocument();
  });

  it("does not show a remove ingredient action in browse or modal", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    // No remove button visible on browse list
    expect(screen.queryByText("Remove ingredient")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("ingredient-row-ing-chicken"));
    const modal = screen.getByTestId("ingredient-modal");
    expect(within(modal).queryByText("Remove ingredient")).not.toBeInTheDocument();
  });

  it("add ingredient opens modal immediately for the new ingredient", async () => {
    seedWithIngredients([]);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByText("Add ingredient")[0]!);

    const modal = screen.getByTestId("ingredient-modal");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText("New ingredient")).toBeInTheDocument();
    expect(within(modal).getByTestId("modal-ingredient-name")).toHaveValue("");
  });
});

describe("F043: Comfortable with many ingredients", () => {
  it("handles many ingredients (catalog + custom) without rendering expanded forms", () => {
    seedWithIngredients([]);
    renderPage();

    // Catalog items auto-populated
    expect(screen.getByText(`Items (${CATALOG_SIZE})`)).toBeInTheDocument();

    // Paginated — only one page of rows visible, not the full list
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    expect(rows.length).toBeLessThanOrEqual(100);
    expect(rows.length).toBeGreaterThan(0);

    // No expanded form inputs visible
    expect(screen.queryByPlaceholderText("Ingredient name")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Custom tag")).not.toBeInTheDocument();
  });

  it("compact rows are clickable buttons with proper touch targets", () => {
    seedWithIngredients([makeIngredient({ name: "Chicken", category: "protein" })]);
    renderPage();

    const row = screen.getByTestId("ingredient-row-ing-chicken");
    expect(row.tagName).toBe("BUTTON");
    expect(row.className).toContain("min-h-[48px]");
    expect(row).toHaveAttribute("aria-label", "Edit Chicken");
  });
});

describe("F043: Auto-populated catalog", () => {
  it("auto-populates catalog items on load for empty households", async () => {
    seedWithIngredients([]);
    const user = userEvent.setup();
    renderPage();

    // Should see all catalog items in total count
    expect(screen.getByText(`Items (${CATALOG_SIZE})`)).toBeInTheDocument();
    // Search for specific catalog items to verify population
    await user.type(screen.getByTestId("ingredient-search"), "Chicken breast");
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    await user.clear(screen.getByTestId("ingredient-search"));
    await user.type(screen.getByTestId("ingredient-search"), "Broccoli");
    expect(screen.getByText("Broccoli")).toBeInTheDocument();
  });

  it("does not duplicate existing household ingredients that match catalog names", async () => {
    const ingredients = [
      makeIngredient({ name: "Pasta", category: "carb", tags: ["custom-tag"] }),
    ];
    seedWithIngredients(ingredients);
    const user = userEvent.setup();
    renderPage();

    const total = expectedTotal(ingredients);
    expect(screen.getByText(`Items (${total})`)).toBeInTheDocument();

    // Search for Pasta specifically
    await user.type(screen.getByTestId("ingredient-search"), "Pasta");
    // Should have exactly one Pasta (the household version, not duplicated)
    const pastaRows = screen.getAllByText("Pasta");
    expect(pastaRows).toHaveLength(1);
  });
});

describe("F043: Filter empty state", () => {
  it("shows filter empty state when filters match nothing", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("ingredient-search"), "xyznonexistent");

    expect(screen.getByText("No ingredients match your filters.")).toBeInTheDocument();
  });
});
