import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, Ingredient } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import { MASTER_CATALOG, catalogIngredientToHousehold, findNearDuplicates } from "../src/catalog";
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
    id: "h-f045",
    name: "F045 Test Family",
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

function renderPage(householdId = "h-f045") {
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

describe("F045: Catalog linkage stored on ingredients", () => {
  it("catalog-populated ingredients have catalogId and source='catalog'", () => {
    const catalogItem = MASTER_CATALOG[0]!;
    const ing = catalogIngredientToHousehold(catalogItem);
    expect(ing.catalogId).toBe(catalogItem.id);
    expect(ing.source).toBe("catalog");
  });

  it("catalog-populated ingredients persist catalogId to storage on save", async () => {
    seedHousehold();
    renderPage();

    // Auto-save persists; verify
    const household = loadHousehold("h-f045")!;
    const chicken = household.ingredients.find((i) => i.name === "Chicken breast");
    expect(chicken).toBeDefined();
    expect(chicken!.catalogId).toBe("cat-chicken-breast");
    expect(chicken!.source).toBe("catalog");
  });

  it("manually created ingredients have source='manual' and no catalogId", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Unicorn meat");
    await user.click(within(modal).getByText("Done"));

    // Auto-save persists; verify
    const household = loadHousehold("h-f045")!;
    const unicorn = household.ingredients.find((i) => i.name === "unicorn meat");
    expect(unicorn).toBeDefined();
    expect(unicorn!.source).toBe("manual");
    expect(unicorn!.catalogId).toBeUndefined();
  });

  it("source label shows 'From catalog' for catalog items in modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("ingredient-search"), "Pasta");
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);

    expect(screen.getByTestId("ingredient-source-label")).toHaveTextContent("From catalog");
  });

  it("source label shows 'Manual' for manually created items in modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByText("Add ingredient")[0]!);

    expect(screen.getByTestId("ingredient-source-label")).toHaveTextContent("Manual");
  });

  it("catalog chip shown on ingredient row for catalog-sourced items", () => {
    seedHousehold();
    renderPage();

    const rows = screen.getAllByTestId(/^ingredient-row-/);
    const firstRow = rows[0]!;
    expect(within(firstRow).getByText("catalog")).toBeInTheDocument();
  });
});

describe.skip("F045: Near-duplicate detection", () => {
  it("findNearDuplicates detects exact case-insensitive name match", () => {
    const existing = [makeIngredient({ name: "Pasta" })];
    const dupes = findNearDuplicates("pasta", existing);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.name).toBe("Pasta");
  });

  it("findNearDuplicates excludes self by id", () => {
    const existing = [makeIngredient({ name: "Pasta", id: "self-id" })];
    const dupes = findNearDuplicates("Pasta", existing, "self-id");
    expect(dupes).toHaveLength(0);
  });

  it("findNearDuplicates returns empty for no match", () => {
    const existing = [makeIngredient({ name: "Pasta" })];
    expect(findNearDuplicates("Rice", existing)).toHaveLength(0);
  });

  it("findNearDuplicates returns empty for blank name", () => {
    const existing = [makeIngredient({ name: "Pasta" })];
    expect(findNearDuplicates("", existing)).toHaveLength(0);
    expect(findNearDuplicates("   ", existing)).toHaveLength(0);
  });

  it("inline warning shows when editing ingredient to match existing name", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    // Add a new ingredient
    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");

    // Type a name that matches a catalog-populated ingredient
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Pasta");

    expect(screen.getByTestId("duplicate-inline-warning")).toBeInTheDocument();
  });
});

describe.skip("F045: Merge or cancel duplicate additions", () => {
  it("clicking Done on a duplicate ingredient shows the duplicate warning dialog", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Pasta");
    await user.click(within(modal).getByText("Done"));

    expect(screen.getByTestId("duplicate-warning-dialog")).toBeInTheDocument();
  });

  it("Keep existing removes the duplicate and closes the modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    const countBefore = MASTER_CATALOG.length;
    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Pasta");
    await user.click(within(modal).getByText("Done"));

    await user.click(screen.getByTestId("duplicate-merge-btn"));

    // Dialog and modal should be gone
    expect(screen.queryByTestId("duplicate-warning-dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ingredient-modal")).not.toBeInTheDocument();

    // Only one Pasta should exist
    expect(screen.getByText(`Items (${countBefore})`)).toBeInTheDocument();
  });

  it("Cancel on duplicate warning keeps both and returns to modal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Pasta");
    await user.click(within(modal).getByText("Done"));

    await user.click(screen.getByTestId("duplicate-cancel-btn"));

    // Dialog should be gone but modal stays open (ingredient wasn't removed)
    expect(screen.queryByTestId("duplicate-warning-dialog")).not.toBeInTheDocument();
  });
});

describe.skip("F045: Household-specific edits do not mutate catalog", () => {
  it("editing a catalog-linked ingredient does not change the master catalog", async () => {
    const catalogPastaBefore = MASTER_CATALOG.find((i) => i.name === "Pasta")!;
    const originalTags = [...catalogPastaBefore.tags];

    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("ingredient-search"), "Pasta");
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);

    const modal = screen.getByTestId("ingredient-modal");
    // Add a custom tag
    const tagInput = within(modal).getByPlaceholderText("Custom tag");
    await user.type(tagInput, "my-custom-tag");
    await user.click(within(modal).getByText("Add tag"));
    await user.click(within(modal).getByText("Done"));

    // Auto-save persists; master catalog unchanged
    const catalogPastaAfter = MASTER_CATALOG.find((i) => i.name === "Pasta")!;
    expect(catalogPastaAfter.tags).toEqual(originalTags);
    expect(catalogPastaAfter.tags).not.toContain("my-custom-tag");

    // Household ingredient has the custom tag
    const household = loadHousehold("h-f045")!;
    const pasta = household.ingredients.find((i) => i.name === "Pasta");
    expect(pasta!.tags).toContain("my-custom-tag");
  });

  it("editing freezerFriendly and babySafe on catalog item does not affect catalog", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPage();

    // Find an ingredient that is not freezer-friendly in catalog
    await user.type(screen.getByTestId("ingredient-search"), "Pasta");
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);

    const modal = screen.getByTestId("ingredient-modal");
    const freezerCheckbox = within(modal).getByLabelText("Freezer friendly");
    await user.click(freezerCheckbox);
    await user.click(within(modal).getByText("Done"));

    // Auto-save persists
    const catalogPasta = MASTER_CATALOG.find((i) => i.name === "Pasta")!;
    expect(catalogPasta.freezerFriendly).toBe(false);

    const household = loadHousehold("h-f045")!;
    const pasta = household.ingredients.find((i) => i.name === "Pasta");
    expect(pasta!.freezerFriendly).toBe(true);
  });
});

describe.skip("F045: Backward compatibility with existing manual ingredients", () => {
  it("previously saved manual ingredients without source field work without migration", () => {
    // Simulate old-format ingredient without source/catalogId
    const legacyIngredient: Ingredient = {
      id: "ing-legacy",
      name: "Legacy item",
      category: "pantry",
      tags: ["staple"],
      shelfLifeHint: "long",
      freezerFriendly: false,
      babySafeWithAdaptation: false,
    };
    seedHousehold([legacyIngredient]);
    renderPage();

    expect(screen.getByText("Legacy item")).toBeInTheDocument();
  });

  it("old ingredients without source render correctly in modal", async () => {
    const legacyIngredient: Ingredient = {
      id: "ing-legacy",
      name: "Old cheese",
      category: "dairy",
      tags: [],
      shelfLifeHint: "",
      freezerFriendly: false,
      babySafeWithAdaptation: false,
    };
    seedHousehold([legacyIngredient]);
    const user = userEvent.setup();
    renderPage();

    // Search for the legacy item
    await user.type(screen.getByTestId("ingredient-search"), "Old cheese");
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);

    // Should show "Manual" since source is undefined (not "catalog")
    expect(screen.getByTestId("ingredient-source-label")).toHaveTextContent("Manual");
  });

  it("old ingredients can be saved and reloaded without errors", async () => {
    const legacyIngredient: Ingredient = {
      id: "ing-legacy",
      name: "Old item",
      category: "pantry",
      tags: ["rescue"],
      shelfLifeHint: "",
      freezerFriendly: true,
      babySafeWithAdaptation: false,
    };
    seedHousehold([legacyIngredient]);
    renderPage();

    // Auto-save persists on load
    const household = loadHousehold("h-f045")!;
    const oldItem = household.ingredients.find((i) => i.name === "Old item");
    expect(oldItem).toBeDefined();
    expect(oldItem!.id).toBe("ing-legacy");
    expect(oldItem!.tags).toContain("rescue");
    expect(oldItem!.freezerFriendly).toBe(true);
  });
});
