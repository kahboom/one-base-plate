import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, BaseMeal, Ingredient, HouseholdMember, WeeklyPlan } from "../src/types";
import { saveHousehold } from "../src/storage";
import { generateWeeklyPlan } from "../src/planner";
import WeeklyPlanner from "../src/pages/WeeklyPlanner";
import Home from "../src/pages/Home";

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
    id: "ing-salmon",
    name: "salmon",
    category: "protein",
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
  ],
  defaultPrep: "Cook rice and salmon",
  estimatedTimeMinutes: 25,
  difficulty: "easy",
  rescueEligible: false,
  wasteReuseHints: [],
};

const members: HouseholdMember[] = [
  {
    id: "m-alex",
    name: "Alex",
    role: "adult",
    safeFoods: ["pasta"],
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
    safeFoods: ["pasta", "rice"],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "soft",
    allergens: [],
    notes: "",
  },
];

function seedHousehold(opts?: {
  meals?: BaseMeal[];
  weeklyPlans?: WeeklyPlan[];
}): Household {
  const household: Household = {
    id: "h-cal",
    name: "Calendar Test Family",
    members,
    ingredients,
    baseMeals: opts?.meals ?? [mealPasta, mealRice],
    weeklyPlans: opts?.weeklyPlans ?? [],
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

function renderHome(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/home`]}>
      <Routes>
        <Route
          path="/household/:householdId/home"
          element={<Home />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function dismissTourIfPresent(user: ReturnType<typeof userEvent.setup>) {
  const skipTour = screen.queryByTestId("tour-skip");
  if (skipTour) {
    await user.click(skipTour);
  }
}

beforeEach(() => {
  localStorage.clear();
});

describe("F021: Weekly Planner always shows day cards", () => {
  it("displays 7 empty day cards before generation", () => {
    seedHousehold();
    renderWeeklyPlanner("h-cal");

    expect(screen.getByTestId("day-cards")).toBeInTheDocument();
    expect(screen.getByTestId("day-monday")).toBeInTheDocument();
    expect(screen.getByTestId("day-tuesday")).toBeInTheDocument();
    expect(screen.getByTestId("day-wednesday")).toBeInTheDocument();
    expect(screen.getByTestId("day-thursday")).toBeInTheDocument();
    expect(screen.getByTestId("day-friday")).toBeInTheDocument();
    expect(screen.getByTestId("day-saturday")).toBeInTheDocument();
    expect(screen.getByTestId("day-sunday")).toBeInTheDocument();
  });

  it("empty days show suggested meals", () => {
    seedHousehold();
    renderWeeklyPlanner("h-cal");

    const monday = screen.getByTestId("day-monday");
    const emptyState = within(monday).getByTestId("empty-monday");
    expect(within(emptyState).getByText(/Suggested:/)).toBeInTheDocument();
  });

  it("shows 5 day cards when 5 days selected", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner("h-cal");

    await user.selectOptions(screen.getByTestId("days-select"), "5");

    expect(screen.getByTestId("day-monday")).toBeInTheDocument();
    expect(screen.getByTestId("day-friday")).toBeInTheDocument();
    expect(screen.queryByTestId("day-saturday")).not.toBeInTheDocument();
  });

  it("fills day cards after generation", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner("h-cal");

    await user.click(screen.getByTestId("generate-btn"));

    const monday = screen.getByTestId("day-monday");
    expect(within(monday).queryByTestId("empty-monday")).not.toBeInTheDocument();
    const hasMeal =
      within(monday).queryByText(/Pasta with chicken/) ||
      within(monday).queryByText(/Rice with salmon/);
    expect(hasMeal).toBeTruthy();
  });

  it("can clear a day to show empty state with suggestion", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderWeeklyPlanner("h-cal");

    await user.click(screen.getByTestId("generate-btn"));

    // Monday should be filled
    const monday = screen.getByTestId("day-monday");
    expect(within(monday).queryByTestId("empty-monday")).not.toBeInTheDocument();

    // Clear Monday
    await user.click(screen.getByTestId("clear-monday"));

    // Monday should now show empty state with suggestion
    const mondayAfter = screen.getByTestId("day-monday");
    expect(within(mondayAfter).getByTestId("empty-monday")).toBeInTheDocument();
    expect(within(mondayAfter).getByText(/Suggested:/)).toBeInTheDocument();
  });
});

describe("F021: Suggested meal tray", () => {
  it("shows suggested meals below the week grid", () => {
    seedHousehold();
    renderWeeklyPlanner("h-cal");

    const tray = screen.getByTestId("suggested-tray");
    expect(tray).toBeInTheDocument();
    expect(within(tray).getByText("Pasta with chicken")).toBeInTheDocument();
    expect(within(tray).getByText("Rice with salmon")).toBeInTheDocument();
  });
});

describe("F021: Home screen with compact weekly strip", () => {
  it("shows headline and weekly planner link", () => {
    seedHousehold();
    renderHome("h-cal");

    expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    expect(screen.getByText("Weekly planner")).toBeInTheDocument();
  });

  it("shows mini weekly strip when a plan exists", () => {
    const days = generateWeeklyPlan([mealPasta, mealRice], members, ingredients, 7);
    const plan: WeeklyPlan = {
      id: "wp-1",
      days,
      selectedBaseMeals: [...new Set(days.map((d) => d.baseMealId))],
      generatedGroceryList: [],
      notes: "",
    };
    seedHousehold({ weeklyPlans: [plan] });
    renderHome("h-cal");

    const strip = screen.getByTestId("weekly-strip");
    expect(strip).toBeInTheDocument();
    expect(screen.getByTestId("strip-mon")).toBeInTheDocument();
    expect(screen.getByTestId("strip-sun")).toBeInTheDocument();
    expect(screen.getByText("View full plan")).toBeInTheDocument();
  });

  it("shows start planning prompt when no plan exists", () => {
    seedHousehold();
    renderHome("h-cal");

    expect(screen.getByTestId("no-plan-prompt")).toBeInTheDocument();
    expect(screen.getByText("Start planning")).toBeInTheDocument();
  });

  it("shows top 3 meal suggestions", () => {
    seedHousehold();
    renderHome("h-cal");

    const suggestions = screen.getByTestId("top-suggestions");
    expect(within(suggestions).getByText("Pasta with chicken")).toBeInTheDocument();
    expect(within(suggestions).getByText("Rice with salmon")).toBeInTheDocument();
  });

  it("strip day cards show meal names from plan", () => {
    const days = generateWeeklyPlan([mealPasta, mealRice], members, ingredients, 7);
    const plan: WeeklyPlan = {
      id: "wp-2",
      days,
      selectedBaseMeals: [...new Set(days.map((d) => d.baseMealId))],
      generatedGroceryList: [],
      notes: "",
    };
    seedHousehold({ weeklyPlans: [plan] });
    renderHome("h-cal");

    const monStrip = screen.getByTestId("strip-mon");
    const hasMeal =
      within(monStrip).queryByText(/Pasta with chicken/) ||
      within(monStrip).queryByText(/Rice with salmon/);
    expect(hasMeal).toBeTruthy();
  });

  it("opens and closes day details modal from strip card", async () => {
    const user = userEvent.setup();
    const days = generateWeeklyPlan([mealPasta, mealRice], members, ingredients, 7);
    const plan: WeeklyPlan = {
      id: "wp-3",
      days,
      selectedBaseMeals: [...new Set(days.map((d) => d.baseMealId))],
      generatedGroceryList: [],
      notes: "",
    };
    seedHousehold({ weeklyPlans: [plan] });
    renderHome("h-cal");
    await dismissTourIfPresent(user);

    await user.click(screen.getByTestId("strip-mon"));
    const modal = screen.getByRole("dialog", { name: "Day details" });
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId("day-details-modal")).toBeInTheDocument();

    await user.click(modal);
    expect(screen.queryByTestId("day-details-modal")).not.toBeInTheDocument();
  });

  it("opens and closes meal details modal from Details button", async () => {
    const user = userEvent.setup();
    seedHousehold();
    renderHome("h-cal");
    await dismissTourIfPresent(user);

    await user.click(screen.getByTestId("detail-link-meal-pasta"));
    const modal = screen.getByRole("dialog", { name: "Meal details" });
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId("meal-details-modal")).toBeInTheDocument();

    await user.click(modal);
    expect(screen.queryByTestId("meal-details-modal")).not.toBeInTheDocument();
  });
});
