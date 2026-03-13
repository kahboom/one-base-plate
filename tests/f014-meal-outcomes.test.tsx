import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Household, BaseMeal, Ingredient, HouseholdMember, WeeklyPlan, MealOutcome } from "../src/types";
import { generateAssemblyVariants } from "../src/planner";

/* ---------- shared fixture ---------- */
const members: HouseholdMember[] = [
  {
    id: "m1", name: "Alex", role: "adult",
    safeFoods: [], hardNoFoods: [], preparationRules: [],
    textureLevel: "regular", allergens: [], notes: "",
  },
  {
    id: "m2", name: "Riley", role: "toddler",
    safeFoods: ["pasta", "cheese"], hardNoFoods: [], preparationRules: [],
    textureLevel: "regular", allergens: [], notes: "",
  },
];

const ingredients: Ingredient[] = [
  { id: "chicken", name: "chicken", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "pasta", name: "pasta", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "broccoli", name: "broccoli", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
];

const meals: BaseMeal[] = [
  {
    id: "meal-a", name: "Chicken Pasta", components: [
      { ingredientId: "chicken", role: "protein", quantity: "200g" },
      { ingredientId: "pasta", role: "carb", quantity: "250g" },
      { ingredientId: "broccoli", role: "veg", quantity: "100g" },
    ],
    defaultPrep: "bake", estimatedTimeMinutes: 30, difficulty: "medium",
    rescueEligible: false, wasteReuseHints: [],
  },
];

function makePlanWithMeal(): WeeklyPlan {
  const variants = generateAssemblyVariants(meals[0]!, members, ingredients);
  return {
    id: "plan-1",
    days: [
      { day: "Monday", baseMealId: "meal-a", variants },
    ],
    selectedBaseMeals: ["meal-a"],
    generatedGroceryList: [],
    notes: "",
  };
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h-outcome",
    name: "Outcome Test Household",
    members,
    ingredients,
    baseMeals: meals,
    weeklyPlans: [makePlanWithMeal()],
    pinnedMealIds: [],
    mealOutcomes: [],
    ...overrides,
  };
}

const STORAGE_KEY = "onebaseplate_households";

function seedStorage(household: Household) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([household]));
}

function loadFromStorage(): Household {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0];
}

beforeEach(() => {
  localStorage.clear();
});

/* ===== WEEKLY PLANNER: OUTCOME RECORDING ===== */

describe("F014: Record outcome from weekly planner", () => {
  it("shows 'Record outcome' button when day card is expanded", async () => {
    const user = userEvent.setup();
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    const toggle = await screen.findByTestId("toggle-monday");
    await user.click(toggle);

    expect(screen.getByTestId("record-outcome-monday")).toBeInTheDocument();
  });

  it("opens outcome form when Record outcome is clicked", async () => {
    const user = userEvent.setup();
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTestId("toggle-monday"));
    await user.click(screen.getByTestId("record-outcome-monday"));

    expect(screen.getByTestId("outcome-form-monday")).toBeInTheDocument();
    expect(screen.getByTestId("outcome-btn-success")).toBeInTheDocument();
    expect(screen.getByTestId("outcome-btn-partial")).toBeInTheDocument();
    expect(screen.getByTestId("outcome-btn-failure")).toBeInTheDocument();
  });

  it("records a success outcome with notes and persists to storage", async () => {
    const user = userEvent.setup();
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTestId("toggle-monday"));
    await user.click(screen.getByTestId("record-outcome-monday"));
    await user.click(screen.getByTestId("outcome-btn-success"));
    await user.type(screen.getByTestId("outcome-notes-monday"), "Kids loved it");
    await user.click(screen.getByTestId("save-outcome-monday"));

    // Outcome chip should appear
    const outcomeDisplay = screen.getByTestId("outcome-monday");
    expect(outcomeDisplay).toBeInTheDocument();
    expect(within(outcomeDisplay).getByText("Worked well")).toBeInTheDocument();
    expect(within(outcomeDisplay).getByText("Kids loved it")).toBeInTheDocument();

    // Record outcome button should be gone
    expect(screen.queryByTestId("record-outcome-monday")).not.toBeInTheDocument();

    // Persisted to storage
    const stored = loadFromStorage();
    expect(stored.mealOutcomes).toHaveLength(1);
    expect(stored.mealOutcomes![0]!.outcome).toBe("success");
    expect(stored.mealOutcomes![0]!.notes).toBe("Kids loved it");
    expect(stored.mealOutcomes![0]!.baseMealId).toBe("meal-a");
    expect(stored.mealOutcomes![0]!.day).toBe("Monday");
  });

  it("records a failure outcome without notes", async () => {
    const user = userEvent.setup();
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTestId("toggle-monday"));
    await user.click(screen.getByTestId("record-outcome-monday"));
    await user.click(screen.getByTestId("outcome-btn-failure"));
    await user.click(screen.getByTestId("save-outcome-monday"));

    const outcomeDisplay = screen.getByTestId("outcome-monday");
    expect(within(outcomeDisplay).getByText("Didn't work")).toBeInTheDocument();

    const stored = loadFromStorage();
    expect(stored.mealOutcomes![0]!.outcome).toBe("failure");
    expect(stored.mealOutcomes![0]!.notes).toBe("");
  });

  it("records a partial success outcome", async () => {
    const user = userEvent.setup();
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTestId("toggle-monday"));
    await user.click(screen.getByTestId("record-outcome-monday"));
    await user.click(screen.getByTestId("outcome-btn-partial"));
    await user.type(screen.getByTestId("outcome-notes-monday"), "Toddler only ate pasta");
    await user.click(screen.getByTestId("save-outcome-monday"));

    const outcomeDisplay = screen.getByTestId("outcome-monday");
    expect(within(outcomeDisplay).getByText("Partly worked")).toBeInTheDocument();
    expect(within(outcomeDisplay).getByText("Toddler only ate pasta")).toBeInTheDocument();
  });

  it("shows existing outcome instead of Record button when outcome already recorded", async () => {
    const user = userEvent.setup();
    const outcome: MealOutcome = {
      id: "out-1",
      baseMealId: "meal-a",
      day: "Monday",
      outcome: "success",
      notes: "Great dinner",
      date: "2026-03-13",
    };
    seedStorage(makeHousehold({ mealOutcomes: [outcome] }));
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTestId("toggle-monday"));

    expect(screen.getByTestId("outcome-monday")).toBeInTheDocument();
    expect(screen.getByText("Worked well")).toBeInTheDocument();
    expect(screen.getByText("Great dinner")).toBeInTheDocument();
    expect(screen.queryByTestId("record-outcome-monday")).not.toBeInTheDocument();
  });

  it("cancel button closes the outcome form", async () => {
    const user = userEvent.setup();
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTestId("toggle-monday"));
    await user.click(screen.getByTestId("record-outcome-monday"));
    expect(screen.getByTestId("outcome-form-monday")).toBeInTheDocument();

    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("outcome-form-monday")).not.toBeInTheDocument();
    expect(screen.getByTestId("record-outcome-monday")).toBeInTheDocument();
  });

  it("save button is disabled until an outcome is selected", async () => {
    const user = userEvent.setup();
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTestId("toggle-monday"));
    await user.click(screen.getByTestId("record-outcome-monday"));

    const saveBtn = screen.getByTestId("save-outcome-monday");
    expect(saveBtn).toBeDisabled();

    await user.click(screen.getByTestId("outcome-btn-success"));
    expect(saveBtn).not.toBeDisabled();
  });
});

/* ===== MEAL HISTORY PAGE ===== */

describe("F014: Meal history page", () => {
  it("shows empty state when no outcomes recorded", async () => {
    seedStorage(makeHousehold({ mealOutcomes: [] }));
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/history"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/no meal outcomes recorded/i)).toBeInTheDocument();
  });

  it("displays recorded outcomes with meal name, result chip, and notes", async () => {
    const outcomes: MealOutcome[] = [
      { id: "out-1", baseMealId: "meal-a", day: "Monday", outcome: "success", notes: "Everyone ate it", date: "2026-03-10" },
      { id: "out-2", baseMealId: "meal-a", day: "Wednesday", outcome: "failure", notes: "Toddler refused", date: "2026-03-12" },
    ];
    seedStorage(makeHousehold({ mealOutcomes: outcomes }));
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/history"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    const list = await screen.findByTestId("outcome-list");
    expect(list).toBeInTheDocument();

    // Most recent first
    const cards = within(list).getAllByText("Chicken Pasta");
    expect(cards).toHaveLength(2);

    expect(screen.getByText("Worked well")).toBeInTheDocument();
    expect(screen.getByText("Didn't work")).toBeInTheDocument();
    expect(screen.getByText("Everyone ate it")).toBeInTheDocument();
    expect(screen.getByText("Toddler refused")).toBeInTheDocument();
  });

  it("shows date and day for each outcome", async () => {
    const outcomes: MealOutcome[] = [
      { id: "out-1", baseMealId: "meal-a", day: "Tuesday", outcome: "partial", notes: "", date: "2026-03-11" },
    ];
    seedStorage(makeHousehold({ mealOutcomes: outcomes }));
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/history"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tuesday")).toBeInTheDocument();
    expect(screen.getByText("2026-03-11")).toBeInTheDocument();
    expect(screen.getByText("Partly worked")).toBeInTheDocument();
  });

  it("links back to weekly planner and home", async () => {
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/history"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Weekly planner")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });
});

/* ===== NAVIGATION ===== */

describe("F014: Navigation links to meal history", () => {
  it("weekly planner has link to meal history", async () => {
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/weekly"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Meal history")).toBeInTheDocument();
  });

  it("home page has link to meal history", async () => {
    seedStorage(makeHousehold());
    render(
      <MemoryRouter initialEntries={["/household/h-outcome/home"]}>
        <MemoryRouterApp />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Meal history")).toBeInTheDocument();
  });
});

/* ---------- helper: render App with routes ---------- */
import App from "../src/App";

function MemoryRouterApp() {
  return <App />;
}
