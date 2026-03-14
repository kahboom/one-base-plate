import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import IngredientManager from "../src/pages/IngredientManager";

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

    expect(screen.getByText("Items (0)")).toBeInTheDocument();

    // Add three ingredients via Add button (opens modal each time)
    const addButtons = screen.getAllByText("Add ingredient");
    await user.click(addButtons[0]!);

    // Modal opens — fill in first ingredient
    let modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Rice");
    await user.click(within(modal).getByText("Done"));

    await user.click(addButtons[0]!);
    modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Chicken breast");
    await user.selectOptions(within(modal).getByTestId("modal-ingredient-category"), "protein");
    await user.click(within(modal).getByLabelText("Freezer friendly"));
    await user.click(within(modal).getByText("Done"));

    await user.click(addButtons[0]!);
    modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Carrots");
    await user.selectOptions(within(modal).getByTestId("modal-ingredient-category"), "veg");
    await user.click(within(modal).getByLabelText("Baby safe with adaptation"));
    await user.click(within(modal).getByText("Done"));

    expect(screen.getByText("Items (3)")).toBeInTheDocument();

    // Save
    await user.click(screen.getAllByRole("button", { name: "Save ingredients" })[0]);

    // Verify persistence
    const saved = loadHousehold("h-ing")!;
    expect(saved.ingredients).toHaveLength(3);
    expect(saved.ingredients[0]!.name).toBe("Rice");
    expect(saved.ingredients[0]!.category).toBe("pantry");
    expect(saved.ingredients[1]!.name).toBe("Chicken breast");
    expect(saved.ingredients[1]!.category).toBe("protein");
    expect(saved.ingredients[1]!.freezerFriendly).toBe(true);
    expect(saved.ingredients[2]!.name).toBe("Carrots");
    expect(saved.ingredients[2]!.category).toBe("veg");
    expect(saved.ingredients[2]!.babySafeWithAdaptation).toBe(true);
  });
});

describe("F004: Tag ingredients", () => {
  it("can tag ingredients with common tags and custom tags", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    await user.click(screen.getAllByText("Add ingredient")[0]!);

    const modal = screen.getByTestId("ingredient-modal");
    await user.type(within(modal).getByTestId("modal-ingredient-name"), "Pasta");

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
    expect(saved.ingredients[0]!.tags).toEqual([
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

    // Add two ingredients
    await user.click(screen.getAllByText("Add ingredient")[0]!);
    await user.click(within(screen.getByTestId("ingredient-modal")).getByText("Done"));
    await user.click(screen.getAllByText("Add ingredient")[0]!);
    await user.click(within(screen.getByTestId("ingredient-modal")).getByText("Done"));
    expect(screen.getByText("Items (2)")).toBeInTheDocument();

    // Click first row to open modal, then remove
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);
    await user.click(within(screen.getByTestId("ingredient-modal")).getByText("Remove ingredient"));

    // Confirm dialog
    const dialog = screen.getByRole("dialog", { name: "Remove ingredient" });
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.getByText("Items (1)")).toBeInTheDocument();
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

    expect(screen.getByText("Items (2)")).toBeInTheDocument();

    // Browse list shows ingredient names
    expect(screen.getByText("Oats")).toBeInTheDocument();
    expect(screen.getByText("Salmon")).toBeInTheDocument();
  });
});
