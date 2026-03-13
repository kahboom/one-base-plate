import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import BaseMealManager from "../src/pages/BaseMealManager";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-meals",
    name: "Meal Test Family",
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
    ingredients: [
      {
        id: "ing-chicken",
        name: "Chicken",
        category: "protein",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: true,
        babySafeWithAdaptation: false,
      },
      {
        id: "ing-rice",
        name: "Rice",
        category: "carb",
        tags: ["quick"],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: true,
      },
      {
        id: "ing-broccoli",
        name: "Broccoli",
        category: "veg",
        tags: ["mashable"],
        shelfLifeHint: "",
        freezerFriendly: true,
        babySafeWithAdaptation: true,
      },
    ],
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderBaseMealManager(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/meals`]}>
      <Routes>
        <Route
          path="/household/:householdId/meals"
          element={<BaseMealManager />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F005: Create a base meal from components", () => {
  it("can create a meal with components from household ingredients", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager("h-meals");

    expect(screen.getByText("Meals (0)")).toBeInTheDocument();

    await user.click(screen.getByText("Add meal"));
    expect(screen.getByText("Meals (1)")).toBeInTheDocument();

    const card = screen.getByText("Base Meal").closest("[data-testid^='meal-']") as HTMLElement;

    // Set meal name
    const nameInput = within(card).getByPlaceholderText("Meal name");
    await user.type(nameInput, "Chicken Rice Bowl");

    // Set default prep
    const prepInput = within(card).getByPlaceholderText(
      "e.g. stir-fry, roast",
    );
    await user.type(prepInput, "stir-fry");

    // Add components
    await user.click(within(card).getByText("Add component"));
    await user.click(within(card).getByText("Add component"));
    await user.click(within(card).getByText("Add component"));

    expect(
      within(card).getByText("Components (3)"),
    ).toBeInTheDocument();

    // Select ingredients for each component
    const ingredientSelects = within(card).getAllByDisplayValue(
      "Select ingredient",
    );

    await user.selectOptions(ingredientSelects[0]!, "ing-chicken");
    await user.selectOptions(ingredientSelects[1]!, "ing-rice");
    await user.selectOptions(ingredientSelects[2]!, "ing-broccoli");

    // Set roles for components (second → carb, third → veg)
    const roleSelects = within(card).getAllByDisplayValue("protein");
    // roleSelects[0] is already protein, change others
    await user.selectOptions(roleSelects[1]!, "carb");
    await user.selectOptions(roleSelects[2]!, "veg");

    // Save
    await user.click(screen.getByText("Save meals"));

    const saved = loadHousehold("h-meals")!;
    expect(saved.baseMeals).toHaveLength(1);
    const meal = saved.baseMeals[0]!;
    expect(meal.name).toBe("Chicken Rice Bowl");
    expect(meal.defaultPrep).toBe("stir-fry");
    expect(meal.components).toHaveLength(3);
    expect(meal.components[0]!.ingredientId).toBe("ing-chicken");
    expect(meal.components[0]!.role).toBe("protein");
    expect(meal.components[1]!.ingredientId).toBe("ing-rice");
    expect(meal.components[1]!.role).toBe("carb");
    expect(meal.components[2]!.ingredientId).toBe("ing-broccoli");
    expect(meal.components[2]!.role).toBe("veg");
  });
});

describe("F005: Set time and rescue eligibility metadata", () => {
  it("can set estimated time, difficulty, and rescue eligibility", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager("h-meals");

    await user.click(screen.getByText("Add meal"));
    const card = screen.getByText("Base Meal").closest("[data-testid^='meal-']") as HTMLElement;

    const nameInput = within(card).getByPlaceholderText("Meal name");
    await user.type(nameInput, "Quick Pasta");

    // Set time
    const timeInput = within(card).getByDisplayValue("30");
    await user.clear(timeInput);
    await user.type(timeInput, "15");

    // Set difficulty
    await user.selectOptions(within(card).getByDisplayValue("easy"), "medium");

    // Set rescue eligible
    await user.click(within(card).getByLabelText("Rescue eligible"));

    await user.click(screen.getByText("Save meals"));

    const saved = loadHousehold("h-meals")!;
    const meal = saved.baseMeals[0]!;
    expect(meal.name).toBe("Quick Pasta");
    expect(meal.estimatedTimeMinutes).toBe(15);
    expect(meal.difficulty).toBe("medium");
    expect(meal.rescueEligible).toBe(true);
  });
});

describe("F005: Remove meal and components", () => {
  it("can remove a meal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager("h-meals");

    await user.click(screen.getByText("Add meal"));
    await user.click(screen.getByText("Add meal"));
    expect(screen.getByText("Meals (2)")).toBeInTheDocument();

    const removeButtons = screen.getAllByText("Remove meal");
    await user.click(removeButtons[0]!);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.getByText("Meals (1)")).toBeInTheDocument();
  });

  it("can remove a component from a meal", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderBaseMealManager("h-meals");

    await user.click(screen.getByText("Add meal"));
    const card = screen.getByText("Base Meal").closest("[data-testid^='meal-']") as HTMLElement;

    await user.click(within(card).getByText("Add component"));
    await user.click(within(card).getByText("Add component"));
    expect(within(card).getByText("Components (2)")).toBeInTheDocument();

    const removeButtons = within(card).getAllByText("Remove component");
    await user.click(removeButtons[0]!);

    expect(within(card).getByText("Components (1)")).toBeInTheDocument();
  });
});

describe("F005: Meals persist across re-open", () => {
  it("re-opening shows previously saved meals", () => {
    const household = seedHousehold();
    household.baseMeals = [
      {
        id: "meal-1",
        name: "Roast Chicken Dinner",
        components: [
          { ingredientId: "ing-chicken", role: "protein", quantity: "500g" },
          { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
        ],
        defaultPrep: "roast",
        estimatedTimeMinutes: 45,
        difficulty: "medium",
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ];
    saveHousehold(household);

    renderBaseMealManager("h-meals");

    expect(screen.getByText("Meals (1)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Roast Chicken Dinner")).toBeInTheDocument();
    expect(screen.getByDisplayValue("roast")).toBeInTheDocument();
    expect(screen.getByDisplayValue("45")).toBeInTheDocument();
  });
});
