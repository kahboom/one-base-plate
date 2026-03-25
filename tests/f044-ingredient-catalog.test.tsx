import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, Ingredient } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import { MASTER_CATALOG, searchCatalog, catalogIngredientToHousehold, getCatalogByCategory } from "../src/catalog";
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
    expect(CATALOG_SIZE).toBeGreaterThanOrEqual(50);
  });

  it("catalog is separate from household ingredients in storage", () => {
    seedHousehold([makeIngredient({ name: "Custom item", category: "pantry" })]);
    const household = loadHousehold("h-catalog")!;
    expect(household.ingredients).toHaveLength(1);
    expect(MASTER_CATALOG.length).toBeGreaterThan(1);
    expect(MASTER_CATALOG.find((i) => i.name === "Custom item")).toBeUndefined();
  });

  it("searchCatalog finds matching items case-insensitively", () => {
    const results = searchCatalog("chick");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some((r) => r.name === "chicken breast")).toBe(true);
    expect(results.some((r) => r.name === "chickpeas")).toBe(true);
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

describe("F044: Catalog auto-populates on the ingredient page", () => {
  it("ingredient list auto-populates with all catalog items for empty household", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();
    showAllIngredientRows();

    expect(screen.getByText(`Items (${CATALOG_SIZE})`)).toBeInTheDocument();
    // Spot-check specific items via search since list is paginated
    await user.type(screen.getByTestId("ingredient-search"), "Chicken breast");
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    await user.clear(screen.getByTestId("ingredient-search"));
    await user.type(screen.getByTestId("ingredient-search"), "Cheese");
    expect(screen.getByText("Cheese")).toBeInTheDocument();
  });

  it("does not duplicate household items that match catalog names", async () => {
    seedHousehold([makeIngredient({ name: "Pasta", category: "carb" })]);
    const user = userEvent.setup();
    renderPage();

    // Total = household(1) + catalog - overlap(1)
    expect(screen.getByText(`Items (${CATALOG_SIZE})`)).toBeInTheDocument();

    // Search for Pasta — should exist only once
    await user.type(screen.getByTestId("ingredient-search"), "Pasta");
    const pastaMatches = screen.getAllByText("Pasta");
    expect(pastaMatches).toHaveLength(1);
  });

  it("household items appear alongside catalog items", async () => {
    seedHousehold([makeIngredient({ name: "Unicorn meat", category: "protein" })]);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(`Items (${CATALOG_SIZE + 1})`)).toBeInTheDocument();
    // Search for custom item to verify
    await user.type(screen.getByTestId("ingredient-search"), "Unicorn meat");
    expect(screen.getByText("Unicorn meat")).toBeInTheDocument();
    // Search for a catalog item to verify it's present
    await user.clear(screen.getByTestId("ingredient-search"));
    await user.type(screen.getByTestId("ingredient-search"), "Chicken breast");
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
  });

  it("there is no 'Add from catalog' button", () => {
    seedHousehold();
    renderPage();

    expect(screen.queryByText("Add from catalog")).not.toBeInTheDocument();
  });
});

describe("F044: Manual creation preserved", () => {
  it("'Add ingredient' button creates a blank ingredient and opens modal", async () => {
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
  it("catalog-populated ingredients persist to storage on save", async () => {
    seedHousehold();
    renderPage();

    // Auto-save persists catalog items on load; verify
    const household = loadHousehold("h-catalog")!;
    expect(household.ingredients.length).toBe(CATALOG_SIZE);
    const eggs = household.ingredients.find((i) => i.name === "eggs");
    expect(eggs).toBeDefined();
    expect(eggs!.category).toBe("protein");
    expect(eggs!.tags).toContain("quick");
  });

  it("catalog-populated ingredient can be edited via modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    // Find and click a catalog item (Pasta)
    // Use search to narrow down
    await user.type(screen.getByTestId("ingredient-search"), "Pasta");
    const rows = screen.getAllByTestId((id) => id.startsWith("ingredient-row-"));
    await user.click(rows[0]!);

    const modal = screen.getByTestId("ingredient-modal");
    expect(within(modal).getByTestId("modal-ingredient-name")).toHaveValue("pasta");

    // Edit it
    await user.clear(within(modal).getByTestId("modal-ingredient-name"));
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Fusilli pasta");
    await user.click(within(modal).getByText("Done"));

    expect(screen.getByText("Fusilli pasta")).toBeInTheDocument();
  });

  it("catalog ingredient has valid structure for planner/grocery flows", () => {
    const catalogItem = MASTER_CATALOG.find((i) => i.name === "chicken breast")!;
    const ing = catalogIngredientToHousehold(catalogItem);

    expect(ing.id).toBeTruthy();
    expect(typeof ing.name).toBe("string");
    expect(typeof ing.category).toBe("string");
    expect(Array.isArray(ing.tags)).toBe(true);
    expect(typeof ing.shelfLifeHint).toBe("string");
    expect(typeof ing.freezerFriendly).toBe("boolean");
    expect(typeof ing.babySafeWithAdaptation).toBe("boolean");
  });

  it("search and filter work on auto-populated catalog items", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    // Search for a catalog item
    await user.type(screen.getByTestId("ingredient-search"), "salmon");
    expect(screen.getByText("Salmon")).toBeInTheDocument();

    // Clear search and use category filter
    await user.clear(screen.getByTestId("ingredient-search"));
    await user.selectOptions(screen.getByTestId("ingredient-category-filter"), "fruit");

    const rows = screen.getAllByTestId((id) => id.startsWith("ingredient-row-"));
    const catalogFruits = MASTER_CATALOG.filter((i) => i.category === "fruit").length;
    expect(rows).toHaveLength(catalogFruits);
  });

  it("deleting a catalog ingredient suppresses re-population on revisit", async () => {
    seedHousehold();
    const user = userEvent.setup();
    const view = renderPage();

    await user.type(screen.getByTestId("ingredient-search"), "tortillas");
    await user.click(screen.getByRole("button", { name: /^Edit Tortillas$/i }));
    const modal = screen.getByTestId("ingredient-modal");
    await user.click(within(modal).getByTestId("delete-ingredient-btn"));
    const deleteConfirm = screen.getByRole("dialog", { name: "Delete ingredient" });
    await user.click(within(deleteConfirm).getByRole("button", { name: "Delete" }));

    const saved = loadHousehold("h-catalog")!;
    expect(saved.suppressedCatalogIds).toContain("cat-wraps");

    view.unmount();
    renderPage();
    await user.type(screen.getByTestId("ingredient-search"), "tortillas");
    expect(screen.queryByRole("button", { name: /^Edit Tortillas$/i })).not.toBeInTheDocument();
  });
});
