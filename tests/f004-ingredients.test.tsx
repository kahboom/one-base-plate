import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import { MASTER_CATALOG } from "../src/catalog";
import IngredientManager from "../src/pages/IngredientManager";

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

    // Starts with catalog items auto-populated
    expect(screen.getByText(`Items (${CATALOG_SIZE})`)).toBeInTheDocument();

    // Add a custom ingredient via Add button
    const addButtons = screen.getAllByText("Add ingredient");
    await user.click(addButtons[0]!);

    let modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Quinoa");
    await user.selectOptions(within(modal).getByTestId("modal-ingredient-category"), "carb");
    await user.click(within(modal).getByText("Done"));

    expect(screen.getByText(`Items (${CATALOG_SIZE + 1})`)).toBeInTheDocument();

    // Save
    await user.click(screen.getAllByRole("button", { name: "Save ingredients" })[0]);

    // Verify persistence — all catalog + custom items saved
    const saved = loadHousehold("h-ing")!;
    expect(saved.ingredients.length).toBe(CATALOG_SIZE + 1);
    const quinoa = saved.ingredients.find((i) => i.name === "Quinoa");
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

    // Add common tags
    await user.click(within(modal).getByText("+quick"));
    await user.click(within(modal).getByText("+rescue"));

    // Add a custom tag
    const tagInput = within(modal).getByPlaceholderText("Custom tag");
    await user.type(tagInput, "kid-friendly");
    await user.click(within(modal).getByText("Add tag"));

    // Verify tags are displayed
    expect(within(modal).getByTestId("tag-quick")).toBeInTheDocument();
    expect(within(modal).getByTestId("tag-rescue")).toBeInTheDocument();
    expect(within(modal).getByTestId("tag-kid-friendly")).toBeInTheDocument();

    await user.click(within(modal).getByText("Done"));

    // Save and verify
    await user.click(screen.getAllByRole("button", { name: "Save ingredients" })[0]);

    const saved = loadHousehold("h-ing")!;
    const farro = saved.ingredients.find((i) => i.name === "Farro");
    expect(farro!.tags).toEqual([
      "quick",
      "rescue",
      "kid-friendly",
    ]);
  });

  it("can remove a tag", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    await user.click(screen.getAllByText("Add ingredient")[0]!);
    const modal = screen.getByTestId("ingredient-modal");

    await user.click(within(modal).getByText("+mashable"));
    expect(within(modal).getByTestId("tag-mashable")).toBeInTheDocument();

    // Remove the tag
    const tagEl = within(modal).getByTestId("tag-mashable").closest("span")!.parentElement!;
    const removeBtn = within(tagEl).getByText("x");
    await user.click(removeBtn);

    expect(within(modal).queryByTestId("tag-mashable")).not.toBeInTheDocument();
  });
});

describe("F004: Remove ingredient", () => {
  it("can remove an ingredient from the list", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    const initialCount = CATALOG_SIZE;
    expect(screen.getByText(`Items (${initialCount})`)).toBeInTheDocument();

    // Click first row to open modal, then remove
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);
    await user.click(within(screen.getByTestId("ingredient-modal")).getByText("Remove ingredient"));

    // Confirm dialog
    const dialog = screen.getByRole("dialog", { name: "Remove ingredient" });
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.getByText(`Items (${initialCount - 1})`)).toBeInTheDocument();
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

    // 2 household items + catalog items (minus duplicates: Oats and Salmon exist in catalog)
    const catalogDupes = MASTER_CATALOG.filter((ci) =>
      ["oats", "salmon"].includes(ci.name.toLowerCase())
    ).length;
    const expected = 2 + CATALOG_SIZE - catalogDupes;
    expect(screen.getByText(`Items (${expected})`)).toBeInTheDocument();

    // Browse list shows ingredient names
    expect(screen.getByText("Oats")).toBeInTheDocument();
    expect(screen.getByText("Salmon")).toBeInTheDocument();
  });
});
