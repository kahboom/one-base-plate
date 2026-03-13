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

    // Add three ingredients
    const addButton = screen.getByText("Add ingredient");
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    expect(screen.getByText("Items (3)")).toBeInTheDocument();

    const cards = screen.getAllByText("Ingredient").map((el) => el.closest("[data-testid^='ingredient-']") as HTMLElement);
    expect(cards).toHaveLength(3);

    // Fill in first ingredient: pantry item
    const name0 = within(cards[0]!).getByPlaceholderText("Ingredient name");
    await user.type(name0, "Rice");
    await user.selectOptions(
      within(cards[0]!).getByDisplayValue("pantry"),
      "pantry",
    );

    // Fill in second ingredient: protein (freezer)
    const name1 = within(cards[1]!).getByPlaceholderText("Ingredient name");
    await user.type(name1, "Chicken breast");
    await user.selectOptions(
      within(cards[1]!).getByDisplayValue("pantry"),
      "protein",
    );
    await user.click(within(cards[1]!).getByLabelText("Freezer friendly"));

    // Fill in third ingredient: veg
    const name2 = within(cards[2]!).getByPlaceholderText("Ingredient name");
    await user.type(name2, "Carrots");
    await user.selectOptions(
      within(cards[2]!).getByDisplayValue("pantry"),
      "veg",
    );
    await user.click(
      within(cards[2]!).getByLabelText("Baby safe with adaptation"),
    );

    // Save
    await user.click(screen.getByText("Save ingredients"));

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

    await user.click(screen.getByText("Add ingredient"));

    const card = screen.getByText("Ingredient").closest("[data-testid^='ingredient-']") as HTMLElement;
    const nameInput = within(card).getByPlaceholderText("Ingredient name");
    await user.type(nameInput, "Pasta");

    // Add a common tag
    await user.click(within(card).getByText("+quick"));
    await user.click(within(card).getByText("+rescue"));

    // Add a custom tag
    const tagInput = within(card).getByPlaceholderText("Custom tag");
    await user.type(tagInput, "kid-friendly");
    await user.click(within(card).getByText("Add tag"));

    // Verify tags are displayed
    expect(within(card).getByTestId("tag-quick")).toBeInTheDocument();
    expect(within(card).getByTestId("tag-rescue")).toBeInTheDocument();
    expect(
      within(card).getByTestId("tag-kid-friendly"),
    ).toBeInTheDocument();

    // Save and verify
    await user.click(screen.getByText("Save ingredients"));

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

    await user.click(screen.getByText("Add ingredient"));
    const card = screen.getByText("Ingredient").closest("[data-testid^='ingredient-']") as HTMLElement;

    await user.click(within(card).getByText("+mashable"));
    expect(within(card).getByTestId("tag-mashable")).toBeInTheDocument();

    // Remove the tag
    const removeBtn = within(
      within(card).getByTestId("tag-mashable"),
    ).getByText("x");
    await user.click(removeBtn);

    expect(
      within(card).queryByTestId("tag-mashable"),
    ).not.toBeInTheDocument();
  });
});

describe("F004: Remove ingredient", () => {
  it("can remove an ingredient from the list", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderIngredientManager("h-ing");

    await user.click(screen.getByText("Add ingredient"));
    await user.click(screen.getByText("Add ingredient"));
    expect(screen.getByText("Items (2)")).toBeInTheDocument();

    const removeButtons = screen.getAllByText("Remove ingredient");
    await user.click(removeButtons[0]!);

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
    expect(screen.getByDisplayValue("Oats")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Salmon")).toBeInTheDocument();

    // Verify tags loaded
    expect(screen.getByTestId("tag-quick")).toBeInTheDocument();
    expect(screen.getByTestId("tag-rescue")).toBeInTheDocument();
    expect(screen.getByTestId("tag-batch-friendly")).toBeInTheDocument();
  });
});
