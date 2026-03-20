import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import { MASTER_CATALOG } from "../src/catalog";
import IngredientManager from "../src/pages/IngredientManager";
import { loadAllIngredientListRows } from "./incremental-load-helpers";

const CATALOG_SIZE = MASTER_CATALOG.length;

function seedHousehold(): Household {
  const household: Household = {
    id: "h-ing",
    name: "Ingredient Test Family",
    members: [
      {
        id: "m1",
        name: "Parent",
        role: "adult",
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
    ],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderIngredientManager(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/ingredients`]}>
      <Routes>
        <Route
          path="/household/:householdId/ingredients"
          element={<IngredientManager />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F004: Add ingredients across categories", () => {
  it("can add ingredients with different categories and save them", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    expect(screen.getByText(`Items (${CATALOG_SIZE})`)).toBeInTheDocument();

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Quinoa");
    await user.selectOptions(within(modal).getByTestId("modal-ingredient-category"), "carb");
    await user.click(within(modal).getByText("Done"));

    expect(screen.getByText(`Items (${CATALOG_SIZE + 1})`)).toBeInTheDocument();

    const saved = loadHousehold("h-ing")!;
    const quinoa = saved.ingredients.find((i) => i.name === "quinoa");
    expect(quinoa).toBeDefined();
    expect(quinoa!.category).toBe("carb");
  });
});

describe("F004: Tag ingredients", () => {
  it("can tag ingredients with common tags and custom tags", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Farro");
    await user.click(within(modal).getByText("+quick"));
    await user.click(within(modal).getByText("+rescue"));
    const tagInput = within(modal).getByPlaceholderText("Custom tag");
    await user.type(tagInput, "kid-friendly");
    await user.click(within(modal).getByText("Add tag"));

    expect(within(modal).getByTestId("tag-quick")).toBeInTheDocument();
    expect(within(modal).getByTestId("tag-rescue")).toBeInTheDocument();
    expect(within(modal).getByTestId("tag-kid-friendly")).toBeInTheDocument();

    await user.click(within(modal).getByText("Done"));

    const saved = loadHousehold("h-ing")!;
    const farro = saved.ingredients.find((i) => i.name === "farro");
    expect(farro!.tags).toEqual(["quick", "rescue", "kid-friendly"]);
  });

  it("can remove a tag", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Test");
    await user.click(within(modal).getByText("+mashable"));
    expect(within(modal).getByTestId("tag-mashable")).toBeInTheDocument();

    const tagEl = within(modal).getByTestId("tag-mashable").closest("span")!.parentElement!;
    const removeBtn = within(tagEl).getByText("x");
    await user.click(removeBtn);

    expect(within(modal).queryByTestId("tag-mashable")).not.toBeInTheDocument();
  });
});

describe("F004: Ingredients persist across re-open", () => {
  it("re-opening the ingredient manager shows previously saved ingredients", () => {
    const household = seedHousehold();
    household.ingredients = [
      {
        id: "ing-1",
        name: "Oats",
        category: "pantry",
        tags: ["quick", "rescue"],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: true,
      },
      {
        id: "ing-2",
        name: "Salmon",
        category: "protein",
        tags: ["batch-friendly"],
        shelfLifeHint: "",
        freezerFriendly: true,
        babySafeWithAdaptation: false,
      },
    ];
    saveHousehold(household);

    renderIngredientManager("h-ing");

    const catalogDupes = MASTER_CATALOG.filter((ci) =>
      ["oats", "salmon"].includes(ci.name.toLowerCase()),
    ).length;
    const expected = 2 + CATALOG_SIZE - catalogDupes;
    expect(screen.getByText(`Items (${expected})`)).toBeInTheDocument();
    loadAllIngredientListRows();
    expect(screen.getByText("Oats")).toBeInTheDocument();
    expect(screen.getByText("Salmon")).toBeInTheDocument();
  });
});

describe("F004: Ingredient delete behavior", () => {
  it("hides delete while creating a brand new ingredient", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");

    expect(within(modal).queryByTestId("delete-ingredient-btn")).not.toBeInTheDocument();
  });

  it("shows delete for existing ingredients and removes them", async () => {
    const household = seedHousehold();
    household.ingredients = [
      {
        id: "ing-delete",
        name: "Delete Me",
        category: "pantry",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: false,
        source: "manual",
      },
    ];
    saveHousehold(household);

    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    await user.click(screen.getByTestId("ingredient-row-ing-delete"));
    const modal = screen.getByTestId("ingredient-modal");
    await user.click(within(modal).getByTestId("delete-ingredient-btn"));

    expect(screen.queryByText("Delete Me")).not.toBeInTheDocument();
    const saved = loadHousehold("h-ing")!;
    expect(saved.ingredients.some((i) => i.id === "ing-delete")).toBe(false);
  });
});
