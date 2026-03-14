import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, Ingredient } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import { MASTER_CATALOG, searchCatalog, catalogIngredientToHousehold, getCatalogByCategory } from "../src/catalog";
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

function seedHousehold(ingredients: Ingredient[] = []): Household {
  const household: Household = {
    id: "h-catalog",
    name: "Catalog Test Family",
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

function renderPage(householdId = "h-catalog") {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/ingredients`]}>
      <Routes>
        <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        <Route path="/household/:householdId/home" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F044: Master ingredient catalog", () => {
  it("catalog contains ingredients across all 8 categories", () => {
    const categories = new Set(MASTER_CATALOG.map((i) => i.category));
    expect(categories).toContain("protein");
    expect(categories).toContain("carb");
    expect(categories).toContain("veg");
    expect(categories).toContain("fruit");
    expect(categories).toContain("dairy");
    expect(categories).toContain("snack");
    expect(categories).toContain("freezer");
    expect(categories).toContain("pantry");
    expect(MASTER_CATALOG.length).toBeGreaterThanOrEqual(50);
  });

  it("catalog is separate from household ingredients", () => {
    seedHousehold([makeIngredient({ name: "Custom item", category: "pantry" })]);
    const household = loadHousehold("h-catalog")!;
    expect(household.ingredients).toHaveLength(1);
    expect(MASTER_CATALOG.length).toBeGreaterThan(1);
    expect(MASTER_CATALOG.find((i) => i.name === "Custom item")).toBeUndefined();
  });

  it("searchCatalog finds matching items case-insensitively", () => {
    const results = searchCatalog("chick");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some((r) => r.name === "Chicken breast")).toBe(true);
    expect(results.some((r) => r.name === "Chickpeas")).toBe(true);
  });

  it("searchCatalog returns empty for blank query", () => {
    expect(searchCatalog("")).toEqual([]);
    expect(searchCatalog("   ")).toEqual([]);
  });

  it("getCatalogByCategory filters to a single category", () => {
    const proteins = getCatalogByCategory("protein");
    expect(proteins.length).toBeGreaterThanOrEqual(5);
    expect(proteins.every((p) => p.category === "protein")).toBe(true);
  });

  it("catalogIngredientToHousehold creates a valid Ingredient with unique id", () => {
    const catalogItem = MASTER_CATALOG[0]!;
    const ing = catalogIngredientToHousehold(catalogItem);
    expect(ing.id).toBeTruthy();
    expect(ing.id).not.toBe(catalogItem.id);
    expect(ing.name).toBe(catalogItem.name);
    expect(ing.category).toBe(catalogItem.category);
    expect(ing.tags).toEqual(catalogItem.tags);
    expect(ing.freezerFriendly).toBe(catalogItem.freezerFriendly);
    expect(ing.babySafeWithAdaptation).toBe(catalogItem.babySafeWithAdaptation);
    expect(ing.shelfLifeHint).toBe("");
  });

  it("catalogIngredientToHousehold supports overrides for pre-save edits", () => {
    const catalogItem = MASTER_CATALOG[0]!;
    const ing = catalogIngredientToHousehold(catalogItem, { tags: ["custom"], freezerFriendly: true });
    expect(ing.tags).toEqual(["custom"]);
    expect(ing.freezerFriendly).toBe(true);
  });
});

describe("F044: Add from catalog button and modal", () => {
  it("shows 'Add from catalog' button in the control bar", () => {
    seedHousehold();
    renderPage();
    expect(screen.getByText("Add from catalog")).toBeInTheDocument();
  });

  it("clicking 'Add from catalog' opens the catalog modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    expect(screen.getByTestId("catalog-modal")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-search")).toBeInTheDocument();
  });

  it("searching the catalog shows matching items", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    await user.type(screen.getByTestId("catalog-search"), "salmon");

    const results = screen.getByTestId("catalog-results");
    expect(within(results).getByText("Salmon")).toBeInTheDocument();
  });

  it("adding a catalog item adds it to household and opens edit modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    await user.type(screen.getByTestId("catalog-search"), "salmon");

    await user.click(screen.getByTestId("catalog-add-cat-salmon"));

    // Catalog modal closes, edit modal opens for pre-save editing
    expect(screen.queryByTestId("catalog-modal")).not.toBeInTheDocument();
    const editModal = screen.getByTestId("ingredient-modal");
    expect(within(editModal).getByTestId("modal-ingredient-name")).toHaveValue("Salmon");
    expect(within(editModal).getByTestId("modal-ingredient-category")).toHaveValue("protein");
  });

  it("added catalog ingredient appears in the browse list after closing edit modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    await user.type(screen.getByTestId("catalog-search"), "pasta");
    await user.click(screen.getByTestId("catalog-add-cat-pasta"));

    // Close edit modal
    await user.click(within(screen.getByTestId("ingredient-modal")).getByText("Done"));

    // Pasta should be in the browse list
    expect(screen.getByText("Pasta")).toBeInTheDocument();
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    expect(rows).toHaveLength(1);
  });

  it("already-added ingredients show 'Added' chip instead of add button", async () => {
    seedHousehold([makeIngredient({ name: "Pasta", category: "carb" })]);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    await user.type(screen.getByTestId("catalog-search"), "pasta");

    const results = screen.getByTestId("catalog-results");
    expect(within(results).getByText("Added")).toBeInTheDocument();
    expect(within(results).queryByTestId("catalog-add-cat-pasta")).not.toBeInTheDocument();
  });

  it("catalog modal can be closed without adding", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    expect(screen.getByTestId("catalog-modal")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Close catalog"));
    expect(screen.queryByTestId("catalog-modal")).not.toBeInTheDocument();
  });
});

describe("F044: Manual creation preserved", () => {
  it("'Add ingredient' button still creates a blank ingredient manually", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByText("Add ingredient")[0]!);

    const modal = screen.getByTestId("ingredient-modal");
    expect(within(modal).getByText("New ingredient")).toBeInTheDocument();
    expect(within(modal).getByTestId("modal-ingredient-name")).toHaveValue("");
  });
});

describe("F044: Catalog ingredients work with existing flows", () => {
  it("catalog-added ingredients persist to storage on save", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    await user.type(screen.getByTestId("catalog-search"), "eggs");
    await user.click(screen.getByTestId("catalog-add-cat-eggs"));
    await user.click(within(screen.getByTestId("ingredient-modal")).getByText("Done"));

    // Save
    await user.click(screen.getAllByText("Save ingredients")[0]!);

    const household = loadHousehold("h-catalog")!;
    expect(household.ingredients).toHaveLength(1);
    expect(household.ingredients[0]!.name).toBe("Eggs");
    expect(household.ingredients[0]!.category).toBe("protein");
    expect(household.ingredients[0]!.tags).toContain("quick");
  });

  it("catalog-added ingredient can be edited before save", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    await user.type(screen.getByTestId("catalog-search"), "rice");
    await user.click(screen.getByTestId("catalog-add-cat-rice"));

    // Edit name in the modal
    const modal = screen.getByTestId("ingredient-modal");
    await user.clear(within(modal).getByTestId("modal-ingredient-name"));
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Basmati rice");
    await user.click(within(modal).getByText("Done"));

    expect(screen.getByText("Basmati rice")).toBeInTheDocument();

    await user.click(screen.getAllByText("Save ingredients")[0]!);
    const household = loadHousehold("h-catalog")!;
    expect(household.ingredients[0]!.name).toBe("Basmati rice");
  });

  it("catalog ingredient has valid structure for planner/grocery flows", () => {
    const catalogItem = MASTER_CATALOG.find((i) => i.name === "Chicken breast")!;
    const ing = catalogIngredientToHousehold(catalogItem);

    // Verify it has all required Ingredient fields
    expect(ing.id).toBeTruthy();
    expect(typeof ing.name).toBe("string");
    expect(typeof ing.category).toBe("string");
    expect(Array.isArray(ing.tags)).toBe(true);
    expect(typeof ing.shelfLifeHint).toBe("string");
    expect(typeof ing.freezerFriendly).toBe("boolean");
    expect(typeof ing.babySafeWithAdaptation).toBe("boolean");
  });
});

describe("F044: Empty state and discoverability", () => {
  it("empty state mentions catalog and manual add", () => {
    seedHousehold();
    renderPage();
    expect(screen.getByText("No ingredients yet. Add from the catalog or create one manually.")).toBeInTheDocument();
  });

  it("catalog search shows empty state for no matches", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Add from catalog"));
    await user.type(screen.getByTestId("catalog-search"), "xyznonexistent");

    expect(screen.getByText("No catalog items match your search.")).toBeInTheDocument();
  });
});
