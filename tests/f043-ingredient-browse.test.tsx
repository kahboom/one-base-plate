import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, Ingredient } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import IngredientManager from "../src/pages/IngredientManager";

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
  it("renders ingredients as compact rows instead of expanded cards", () => {
    const ingredients = [
      makeIngredient({ name: "Chicken", category: "protein", tags: ["quick"], freezerFriendly: true }),
      makeIngredient({ name: "Rice", category: "carb", tags: ["staple"] }),
      makeIngredient({ name: "Broccoli", category: "veg", babySafeWithAdaptation: true }),
    ];
    seedWithIngredients(ingredients);
    renderPage();

    const list = screen.getByTestId("ingredient-list");
    const rows = within(list).getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(3);

    // Each row shows name, category chip, and tags inline
    const chickenRow = screen.getByTestId("ingredient-row-ing-chicken");
    expect(within(chickenRow).getByText("Chicken")).toBeInTheDocument();
    expect(within(chickenRow).getByText("protein")).toBeInTheDocument();
    expect(within(chickenRow).getByText("quick")).toBeInTheDocument();

    const riceRow = screen.getByTestId("ingredient-row-ing-rice");
    expect(within(riceRow).getByText("Rice")).toBeInTheDocument();
    expect(within(riceRow).getByText("carb")).toBeInTheDocument();
    expect(within(riceRow).getByText("staple")).toBeInTheDocument();

    const broccoliRow = screen.getByTestId("ingredient-row-ing-broccoli");
    expect(within(broccoliRow).getByText("Broccoli")).toBeInTheDocument();
    expect(within(broccoliRow).getByText("veg")).toBeInTheDocument();
  });

  it("shows freezer-friendly and baby-safe flags on rows", () => {
    const ingredients = [
      makeIngredient({ name: "Chicken", category: "protein", freezerFriendly: true }),
      makeIngredient({ name: "Carrots", category: "veg", babySafeWithAdaptation: true }),
      makeIngredient({ name: "Rice", category: "carb" }),
    ];
    seedWithIngredients(ingredients);
    renderPage();

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
    seedWithIngredients([
      makeIngredient({ name: "Chicken breast", category: "protein" }),
      makeIngredient({ name: "Rice", category: "carb" }),
      makeIngredient({ name: "Chickpeas", category: "pantry" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getAllByTestId(/^ingredient-row-/)).toHaveLength(3);

    await user.type(screen.getByTestId("ingredient-search"), "chick");

    const rows = screen.getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    expect(screen.getByText("Chickpeas")).toBeInTheDocument();
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();
  });

  it("category filter shows only matching category", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein" }),
      makeIngredient({ name: "Rice", category: "carb" }),
      makeIngredient({ name: "Salmon", category: "protein" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByTestId("ingredient-category-filter"), "protein");

    const rows = screen.getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Chicken")).toBeInTheDocument();
    expect(screen.getByText("Salmon")).toBeInTheDocument();
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();
  });

  it("tag filter shows only matching tagged ingredients", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein", tags: ["quick", "rescue"] }),
      makeIngredient({ name: "Rice", category: "carb", tags: ["staple"] }),
      makeIngredient({ name: "Pasta", category: "carb", tags: ["quick", "staple"] }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByTestId("ingredient-tag-filter"), "rescue");

    const rows = screen.getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(1);
    expect(screen.getByText("Chicken")).toBeInTheDocument();
  });

  it("shows filter count when filters narrow the list", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein" }),
      makeIngredient({ name: "Rice", category: "carb" }),
      makeIngredient({ name: "Salmon", category: "protein" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText("Items (3)")).toBeInTheDocument();
    expect(screen.queryByText(/showing/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("ingredient-category-filter"), "protein");

    expect(screen.getByText(/showing 2/)).toBeInTheDocument();
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
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Turkey");
    await user.click(within(modal).getByText("Done"));

    expect(screen.queryByTestId("ingredient-modal")).not.toBeInTheDocument();
    expect(screen.getByText("Turkey")).toBeInTheDocument();
    expect(screen.queryByText("Chicken")).not.toBeInTheDocument();
  });

  it("delete action is inside the modal, not on the browse row", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    // No remove button visible on browse list
    expect(screen.queryByText("Remove ingredient")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("ingredient-row-ing-chicken"));
    const modal = screen.getByTestId("ingredient-modal");
    expect(within(modal).getByText("Remove ingredient")).toBeInTheDocument();
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
  it("handles 30 ingredients without rendering expanded forms", () => {
    const manyIngredients = Array.from({ length: 30 }, (_, i) =>
      makeIngredient({ name: `Ingredient ${i + 1}`, id: `ing-${i}`, category: "pantry" }),
    );
    seedWithIngredients(manyIngredients);
    renderPage();

    expect(screen.getByText("Items (30)")).toBeInTheDocument();

    const rows = screen.getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(30);

    // No expanded form inputs visible
    expect(screen.queryByPlaceholderText("Ingredient name")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Custom tag")).not.toBeInTheDocument();
  });

  it("compact rows are clickable buttons with proper touch targets", () => {
    seedWithIngredients([makeIngredient({ name: "Chicken", category: "protein" })]);
    renderPage();

    const row = screen.getByTestId("ingredient-row-ing-chicken");
    expect(row.tagName).toBe("BUTTON");
    const style = window.getComputedStyle(row);
    expect(row.className).toContain("min-h-[48px]");
    expect(row).toHaveAttribute("aria-label", "Edit Chicken");
  });
});

describe("F043: Empty and filter empty states", () => {
  it("shows empty state when no ingredients exist", () => {
    seedWithIngredients([]);
    renderPage();

    expect(screen.getByText("No ingredients yet. Add from the catalog or create one manually.")).toBeInTheDocument();
  });

  it("shows filter empty state when filters match nothing", async () => {
    seedWithIngredients([
      makeIngredient({ name: "Chicken", category: "protein" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("ingredient-search"), "xyz");

    expect(screen.getByText("No ingredients match your filters.")).toBeInTheDocument();
  });
});
