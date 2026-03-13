import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, BaseMeal, Ingredient, HouseholdMember } from "../src/types";
import { saveHousehold } from "../src/storage";
import Planner from "../src/pages/Planner";

const ingredients: Ingredient[] = [
  { id: "ing-pasta", name: "pasta", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-chicken", name: "chicken breast", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "ing-mushrooms", name: "mushrooms", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: false },
  { id: "ing-broccoli", name: "broccoli", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
];

const members: HouseholdMember[] = [
  {
    id: "m-alex",
    name: "Alex",
    role: "adult",
    safeFoods: ["pasta"],
    hardNoFoods: ["mushrooms"],
    preparationRules: [{ ingredient: "chicken breast", rule: "Must be sliced thin" }],
    textureLevel: "regular",
    allergens: [],
    notes: "",
  },
  {
    id: "m-riley",
    name: "Riley",
    role: "toddler",
    safeFoods: ["pasta", "bread"],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "soft",
    allergens: [],
    notes: "",
  },
];

const mealHigh: BaseMeal = {
  id: "meal-high",
  name: "Pasta with chicken",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "400g" },
    { ingredientId: "ing-chicken", role: "protein", quantity: "500g" },
  ],
  defaultPrep: "Cook pasta and chicken",
  estimatedTimeMinutes: 30,
  difficulty: "easy",
  rescueEligible: true,
  wasteReuseHints: [],
};

const mealConflict: BaseMeal = {
  id: "meal-conflict",
  name: "Mushroom pasta",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "400g" },
    { ingredientId: "ing-mushrooms", role: "veg", quantity: "200g" },
  ],
  defaultPrep: "Cook pasta with mushrooms",
  estimatedTimeMinutes: 20,
  difficulty: "easy",
  rescueEligible: false,
  wasteReuseHints: [],
};

function seedHousehold(meals: BaseMeal[] = [mealHigh, mealConflict]): Household {
  const household: Household = {
    id: "h-f024",
    name: "Indicator Family",
    members,
    ingredients,
    baseMeals: meals,
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/planner`]}>
      <Routes>
        <Route path="/household/:householdId/planner" element={<Planner />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F024: Meal cards show visual overlap indicators in planner", () => {
  it("displays MealCard grid with compatibility chips for each meal", () => {
    seedHousehold();
    renderPlanner("h-f024");

    const grid = screen.getByTestId("meal-card-grid");
    expect(grid).toBeInTheDocument();

    // Both meals should have cards
    expect(within(grid).getByTestId("meal-card-meal-high")).toBeInTheDocument();
    expect(within(grid).getByTestId("meal-card-meal-conflict")).toBeInTheDocument();

    // High-overlap meal card should have compatibility chips
    const highCard = within(grid).getByTestId("meal-card-meal-high");
    expect(within(highCard).getByTestId("compatibility-chips")).toBeInTheDocument();
    expect(within(highCard).getByTestId("chip-m-alex")).toBeInTheDocument();
    expect(within(highCard).getByTestId("chip-m-riley")).toBeInTheDocument();
  });

  it("highlights meals with high overlap via state chips", () => {
    seedHousehold();
    renderPlanner("h-f024");

    const highCard = screen.getByTestId("meal-card-meal-high");
    expect(within(highCard).getByText("High overlap")).toBeInTheDocument();

    // Conflict meal should not show high overlap
    const conflictCard = screen.getByTestId("meal-card-meal-conflict");
    expect(within(conflictCard).queryByText("High overlap")).not.toBeInTheDocument();
  });

  it("flags meals requiring extra preparation", () => {
    seedHousehold();
    renderPlanner("h-f024");

    // High meal has Alex's prep rule (chicken sliced thin) and Riley soft texture
    const highCard = screen.getByTestId("meal-card-meal-high");
    expect(within(highCard).getByText("Needs extra prep")).toBeInTheDocument();
  });

  it("shows overlap indicators as colored chips when meal is selected", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPlanner("h-f024");

    await user.click(screen.getByTestId("selectable-meal-conflict"));

    const indicators = screen.getByTestId("overlap-indicators");
    expect(indicators).toBeInTheDocument();

    // Alex should show conflict
    const alexChip = within(indicators).getByTestId("overlap-m-alex");
    expect(alexChip.textContent).toContain("conflict");

    // Riley should show needs adaptation (soft texture)
    const rileyChip = within(indicators).getByTestId("overlap-m-riley");
    expect(rileyChip.textContent).toContain("needs adaptation");
  });

  it("shows trade-offs as visual chips when meal is selected", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPlanner("h-f024");

    await user.click(screen.getByTestId("selectable-meal-conflict"));

    const tradeOffs = screen.getByTestId("trade-offs");
    expect(tradeOffs).toBeInTheDocument();

    // Should have trade-off chips
    const chips = within(tradeOffs).getAllByTestId(/^trade-off-/);
    expect(chips.length).toBeGreaterThan(0);

    // Alex conflict should mention mushrooms
    const hasMushroomTradeOff = chips.some((c) => c.textContent?.includes("mushrooms"));
    expect(hasMushroomTradeOff).toBe(true);
  });

  it("high-overlap meals are ranked first in the grid", () => {
    seedHousehold();
    renderPlanner("h-f024");

    const grid = screen.getByTestId("meal-card-grid");
    const cards = within(grid).getAllByTestId(/^meal-card-/);

    // High overlap first
    expect(cards[0]!.textContent).toContain("Pasta with chicken");
    expect(cards[1]!.textContent).toContain("Mushroom pasta");
  });

  it("indicators are clear without needing to open details", () => {
    seedHousehold();
    renderPlanner("h-f024");

    // Can see short reason without clicking
    const highCard = screen.getByTestId("meal-card-meal-high");
    const reason = within(highCard).getByTestId("short-reason");
    expect(reason.textContent!.length).toBeGreaterThan(0);

    // Can see overlap score without clicking
    const overlap = within(highCard).getByTestId("overlap-score");
    expect(overlap.textContent).toContain("2/2");
  });
});
