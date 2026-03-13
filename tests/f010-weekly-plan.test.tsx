import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, BaseMeal, Ingredient, HouseholdMember } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import { generateWeeklyPlan } from "../src/planner";
import WeeklyPlanner from "../src/pages/WeeklyPlanner";

const ingredients: Ingredient[] = [
  {
    id: "ing-pasta",
    name: "pasta",
    category: "carb",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-chicken",
    name: "chicken breast",
    category: "protein",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-rice",
    name: "rice",
    category: "carb",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-broccoli",
    name: "broccoli",
    category: "veg",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-salmon",
    name: "salmon",
    category: "protein",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-peas",
    name: "peas",
    category: "veg",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
];

const mealPasta: BaseMeal = {
  id: "meal-pasta",
  name: "Pasta with chicken",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "400g" },
    { ingredientId: "ing-chicken", role: "protein", quantity: "500g" },
    { ingredientId: "ing-broccoli", role: "veg", quantity: "1 head" },
  ],
  defaultPrep: "Cook pasta and chicken",
  estimatedTimeMinutes: 30,
  difficulty: "easy",
  rescueEligible: true,
  wasteReuseHints: [],
};

const mealRice: BaseMeal = {
  id: "meal-rice",
  name: "Rice with salmon",
  components: [
    { ingredientId: "ing-rice", role: "carb", quantity: "300g" },
    { ingredientId: "ing-salmon", role: "protein", quantity: "400g" },
    { ingredientId: "ing-peas", role: "veg", quantity: "200g" },
  ],
  defaultPrep: "Cook rice and salmon",
  estimatedTimeMinutes: 25,
  difficulty: "easy",
  rescueEligible: false,
  wasteReuseHints: [],
};

const mealPastaRice: BaseMeal = {
  id: "meal-pasta-rice",
  name: "Pasta rice combo",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "200g" },
    { ingredientId: "ing-rice", role: "carb", quantity: "200g" },
    { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
  ],
  defaultPrep: "Cook both carbs with chicken",
  estimatedTimeMinutes: 35,
  difficulty: "medium",
  rescueEligible: false,
  wasteReuseHints: [],
};

const members: HouseholdMember[] = [
  {
    id: "m-alex",
    name: "Alex",
    role: "adult",
    safeFoods: ["pasta", "chicken breast"],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "regular",
    allergens: [],
    notes: "",
  },
  {
    id: "m-riley",
    name: "Riley",
    role: "toddler",
    safeFoods: ["pasta", "rice", "peas"],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "soft",
    allergens: [],
    notes: "",
  },
];

function seedHousehold(meals: BaseMeal[] = [mealPasta, mealRice]): Household {
  const household: Household = {
    id: "h-weekly",
    name: "Weekly Test Family",
    members,
    ingredients,
    baseMeals: meals,
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderWeeklyPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/weekly`]}>
      <Routes>
        <Route
          path="/household/:householdId/weekly"
          element={<WeeklyPlanner />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F010: Weekly plan generation engine", () => {
  it("generates the requested number of days", () => {
    const days = generateWeeklyPlan(
      [mealPasta, mealRice],
      members,
      ingredients,
      5,
    );
    expect(days).toHaveLength(5);
  });

  it("generates 7-day plan by default", () => {
    const days = generateWeeklyPlan(
      [mealPasta, mealRice],
      members,
      ingredients,
    );
    expect(days).toHaveLength(7);
  });

  it("each day contains a base meal and per-person variants", () => {
    const days = generateWeeklyPlan(
      [mealPasta, mealRice],
      members,
      ingredients,
      3,
    );
    for (const day of days) {
      expect(day.baseMealId).toBeTruthy();
      expect(day.variants).toHaveLength(members.length);
      for (const variant of day.variants) {
        expect(variant.instructions.length).toBeGreaterThan(0);
      }
    }
  });

  it("avoids repeating the same meal on consecutive days when alternatives exist", () => {
    const days = generateWeeklyPlan(
      [mealPasta, mealRice],
      members,
      ingredients,
      4,
    );
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!.baseMealId).not.toBe(days[i - 1]!.baseMealId);
    }
  });

  it("reuses ingredients across the week intentionally", () => {
    const days = generateWeeklyPlan(
      [mealPasta, mealRice, mealPastaRice],
      members,
      ingredients,
      5,
    );
    // Collect all ingredient IDs used
    const usedIds = new Set<string>();
    let totalComponents = 0;
    for (const day of days) {
      const meal = [mealPasta, mealRice, mealPastaRice].find(
        (m) => m.id === day.baseMealId,
      )!;
      for (const c of meal.components) {
        usedIds.add(c.ingredientId);
        totalComponents++;
      }
    }
    // With 5 days and 3 meals (6 unique ingredients), we expect ingredient reuse
    expect(totalComponents).toBeGreaterThan(usedIds.size);
  });

  it("returns empty array when no meals available", () => {
    const days = generateWeeklyPlan([], members, ingredients, 7);
    expect(days).toHaveLength(0);
  });

  it("works with a single meal", () => {
    const days = generateWeeklyPlan([mealPasta], members, ingredients, 3);
    expect(days).toHaveLength(3);
    for (const day of days) {
      expect(day.baseMealId).toBe("meal-pasta");
    }
  });

  it("uses day labels Monday through Sunday", () => {
    const days = generateWeeklyPlan(
      [mealPasta, mealRice],
      members,
      ingredients,
      7,
    );
    const labels = days.map((d) => d.day);
    expect(labels).toEqual([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ]);
  });
});

describe("F010: Weekly Planner page", () => {
  it("shows generate controls and generates a plan", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner("h-weekly");

    expect(screen.getByText("Weekly Planner")).toBeInTheDocument();
    expect(screen.getByText(/Weekly Test Family/)).toBeInTheDocument();

    await user.click(screen.getByTestId("generate-btn"));

    const planSection = screen.getByTestId("weekly-plan");
    expect(planSection).toBeInTheDocument();

    // 7 day cards by default
    expect(screen.getByTestId("day-monday")).toBeInTheDocument();
    expect(screen.getByTestId("day-sunday")).toBeInTheDocument();
  });

  it("generates a 5-day plan when selected", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner("h-weekly");

    await user.selectOptions(screen.getByTestId("days-select"), "5");
    await user.click(screen.getByTestId("generate-btn"));

    expect(screen.getByTestId("day-monday")).toBeInTheDocument();
    expect(screen.getByTestId("day-friday")).toBeInTheDocument();
    expect(screen.queryByTestId("day-saturday")).not.toBeInTheDocument();
  });

  it("day cards show meal names and overlap scores", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner("h-weekly");

    await user.click(screen.getByTestId("generate-btn"));

    const monday = screen.getByTestId("day-monday");
    // Should show one of the meal names
    const hasMealName =
      within(monday).queryByText(/Pasta with chicken/) ||
      within(monday).queryByText(/Rice with salmon/);
    expect(hasMealName).toBeTruthy();

    // Should show overlap label
    expect(within(monday).getByText(/Overlap:/)).toBeInTheDocument();
  });

  it("shows per-person variants when expanding a day card", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner("h-weekly");

    await user.click(screen.getByTestId("generate-btn"));
    await user.click(screen.getByTestId("toggle-monday"));

    const details = screen.getByTestId("details-monday");
    expect(within(details).getByText(/Alex/)).toBeInTheDocument();
    expect(within(details).getByText(/Riley/)).toBeInTheDocument();
  });

  it("saves and re-opens a plan", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner("h-weekly");

    await user.click(screen.getByTestId("generate-btn"));
    await user.click(screen.getByTestId("save-plan-btn"));

    // Verify saved to storage
    const saved = loadHousehold("h-weekly");
    expect(saved?.weeklyPlans).toHaveLength(1);
    expect(saved?.weeklyPlans[0]?.days.length).toBe(7);

    // Re-render and verify plan loads
    renderWeeklyPlanner("h-weekly");
    expect(screen.getAllByTestId("day-monday").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no meals exist", () => {
    const household: Household = {
      id: "h-empty-weekly",
      name: "Empty Family",
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    };
    saveHousehold(household);
    renderWeeklyPlanner("h-empty-weekly");

    expect(
      screen.getByText("No base meals available. Add meals before generating a plan."),
    ).toBeInTheDocument();
  });
});
