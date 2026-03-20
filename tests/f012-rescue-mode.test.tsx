import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import type { Household, BaseMeal, Ingredient, HouseholdMember } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import { generateRescueMeals } from "../src/planner";
import { householdLayoutRouteBranch } from "./householdLayoutRoutes";

const ingredients: Ingredient[] = [
  { id: "ing-pasta", name: "pasta", category: "carb", tags: ["staple"], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-chicken", name: "chicken", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "ing-fishfingers", name: "fish fingers", category: "freezer", tags: ["rescue"], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "ing-beans", name: "baked beans", category: "pantry", tags: ["rescue"], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-broccoli", name: "broccoli", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-rice", name: "rice", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-salmon", name: "salmon", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "ing-nuts", name: "nuts", category: "snack", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: false },
];

const rescueMealFast: BaseMeal = {
  id: "meal-fishfingers",
  name: "Fish fingers and beans",
  components: [
    { ingredientId: "ing-fishfingers", role: "protein", quantity: "8 pieces" },
    { ingredientId: "ing-beans", role: "veg", quantity: "1 tin" },
    { ingredientId: "ing-pasta", role: "carb", quantity: "200g" },
  ],
  defaultPrep: "Oven fish fingers, heat beans",
  estimatedTimeMinutes: 12,
  difficulty: "easy",
  rescueEligible: true,
  wasteReuseHints: [],
};

const rescueMealMedium: BaseMeal = {
  id: "meal-pasta-chicken",
  name: "Pasta with chicken",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "400g" },
    { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
  ],
  defaultPrep: "Cook pasta and chicken",
  estimatedTimeMinutes: 25,
  difficulty: "easy",
  rescueEligible: true,
  wasteReuseHints: [],
};

const nonRescueMeal: BaseMeal = {
  id: "meal-salmon-rice",
  name: "Salmon with rice and broccoli",
  components: [
    { ingredientId: "ing-salmon", role: "protein", quantity: "400g" },
    { ingredientId: "ing-rice", role: "carb", quantity: "300g" },
    { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
  ],
  defaultPrep: "Cook rice and salmon",
  estimatedTimeMinutes: 35,
  difficulty: "medium",
  rescueEligible: false,
  wasteReuseHints: [],
};

const members: HouseholdMember[] = [
  { id: "m-adult", name: "Alex", role: "adult", safeFoods: [], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" },
  { id: "m-toddler", name: "Bee", role: "toddler", safeFoods: ["pasta", "fish fingers"], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" },
];

function seedHousehold(meals: BaseMeal[] = [rescueMealFast, rescueMealMedium, nonRescueMeal]): Household {
  const household: Household = {
    id: "h-rescue",
    name: "Rescue Family",
    members,
    ingredients,
    baseMeals: meals,
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderRescueMode(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/rescue`]}>
      <Routes>{householdLayoutRouteBranch}</Routes>
    </MemoryRouter>,
  );
}

function renderHome(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/home`]}>
      <Routes>{householdLayoutRouteBranch}</Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F012: generateRescueMeals engine", () => {
  it("filters to rescue-eligible meals first", () => {
    const results = generateRescueMeals(
      [rescueMealFast, rescueMealMedium, nonRescueMeal],
      members,
      ingredients,
      "low-time",
    );
    const ids = results.map((r) => r.meal.id);
    expect(ids).not.toContain("meal-salmon-rice");
    expect(ids).toContain("meal-fishfingers");
  });

  it("falls back to all meals when no rescue-eligible meals exist", () => {
    const results = generateRescueMeals(
      [nonRescueMeal],
      members,
      ingredients,
      "low-time",
    );
    expect(results.length).toBe(1);
    expect(results[0]!.meal.id).toBe("meal-salmon-rice");
  });

  it("ranks fastest meals first in low-time scenario", () => {
    const results = generateRescueMeals(
      [rescueMealFast, rescueMealMedium],
      members,
      ingredients,
      "low-time",
    );
    expect(results[0]!.meal.id).toBe("meal-fishfingers");
  });

  it("prefers easy difficulty in low-energy scenario", () => {
    const results = generateRescueMeals(
      [rescueMealFast, rescueMealMedium],
      members,
      ingredients,
      "low-energy",
    );
    // Both are easy, but fish fingers is faster so still first
    expect(results[0]!.meal.id).toBe("meal-fishfingers");
  });

  it("prioritizes safe food coverage in everyone-melting-down scenario", () => {
    const results = generateRescueMeals(
      [rescueMealFast, rescueMealMedium],
      members,
      ingredients,
      "everyone-melting-down",
    );
    // Fish fingers has toddler safe foods (pasta + fish fingers) so should rank first
    expect(results[0]!.meal.id).toBe("meal-fishfingers");
  });

  it("favors freezer/pantry staples in scoring", () => {
    const results = generateRescueMeals(
      [rescueMealFast, rescueMealMedium],
      members,
      ingredients,
      "low-time",
    );
    // Fish fingers uses freezer + pantry ingredients — higher staple score
    expect(results[0]!.meal.id).toBe("meal-fishfingers");
  });

  it("generates assembly variants for each result", () => {
    const results = generateRescueMeals(
      [rescueMealFast],
      members,
      ingredients,
      "low-time",
    );
    expect(results[0]!.variants.length).toBe(2); // one per member
    expect(results[0]!.variants[0]!.memberId).toBe("m-adult");
    expect(results[0]!.variants[1]!.memberId).toBe("m-toddler");
  });

  it("includes prep summary and confidence label", () => {
    const results = generateRescueMeals(
      [rescueMealFast],
      members,
      ingredients,
      "low-time",
    );
    expect(results[0]!.prepSummary).toContain("12 min");
    expect(results[0]!.prepSummary).toContain("easy");
    expect(results[0]!.confidence).toBe("12-minute save");
  });

  it("returns at most 3 results", () => {
    const manyMeals = Array.from({ length: 5 }, (_, i) => ({
      ...rescueMealFast,
      id: `meal-rescue-${i}`,
      name: `Rescue meal ${i}`,
    }));
    const results = generateRescueMeals(manyMeals, members, ingredients, "low-time");
    expect(results.length).toBe(3);
  });
});

describe("F012: RescueMode page — scenario picker", () => {
  it("shows scenario picker on load", () => {
    seedHousehold();
    renderRescueMode("h-rescue");

    expect(screen.getByTestId("scenario-picker")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-low-energy")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-low-time")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-everyone-melting-down")).toBeInTheDocument();
  });

  it("uses reassuring language in header", () => {
    seedHousehold();
    renderRescueMode("h-rescue");

    expect(screen.getByText(/no guilt/i)).toBeInTheDocument();
  });

  it("shows empty state when no meals exist", () => {
    seedHousehold([]);
    renderRescueMode("h-rescue");

    expect(screen.getByText(/No meals available/)).toBeInTheDocument();
  });
});

describe("F012: RescueMode page — rescue results", () => {
  it("shows rescue meals after picking a scenario", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderRescueMode("h-rescue");

    await user.click(screen.getByTestId("scenario-low-time"));

    expect(screen.getByTestId("rescue-results")).toBeInTheDocument();
    expect(screen.getByTestId("rescue-meal-meal-fishfingers")).toBeInTheDocument();
  });

  it("shows prep summary and confidence label", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderRescueMode("h-rescue");

    await user.click(screen.getByTestId("scenario-low-time"));

    expect(screen.getByTestId("prep-summary-meal-fishfingers")).toHaveTextContent("12 min");
    expect(screen.getByTestId("confidence-meal-fishfingers")).toHaveTextContent("12-minute save");
  });

  it("shows per-person assembly variants", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderRescueMode("h-rescue");

    await user.click(screen.getByTestId("scenario-low-time"));

    const assemblies = screen.getByTestId("rescue-assemblies-meal-fishfingers");
    expect(within(assemblies).getByTestId("rescue-variant-m-adult")).toBeInTheDocument();
    expect(within(assemblies).getByTestId("rescue-variant-m-toddler")).toBeInTheDocument();
  });

  it("can change scenario after picking one", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderRescueMode("h-rescue");

    await user.click(screen.getByTestId("scenario-low-time"));
    expect(screen.getByTestId("scenario-label")).toHaveTextContent("Low time");

    await user.click(screen.getByTestId("change-scenario"));
    expect(screen.getByTestId("scenario-picker")).toBeInTheDocument();
  });

  it("feels simpler than the standard planner — fewer elements", () => {
    seedHousehold();
    renderRescueMode("h-rescue");

    // No meal card grid, no weekly calendar, no grocery preview — just scenario cards
    expect(screen.queryByTestId("meal-card-meal-fishfingers")).not.toBeInTheDocument();
    expect(screen.queryByTestId("effort-balance")).not.toBeInTheDocument();
  });
});

describe("F012: Add to tonight and add to week", () => {
  it("can add a rescue meal to tonight", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderRescueMode("h-rescue");

    await user.click(screen.getByTestId("scenario-low-time"));
    await user.click(screen.getByTestId("add-tonight-meal-fishfingers"));

    expect(screen.getByTestId("add-tonight-meal-fishfingers")).toHaveTextContent("Added!");
    const saved = loadHousehold("h-rescue");
    const latestPlan = saved!.weeklyPlans[saved!.weeklyPlans.length - 1]!;
    const tonightDay = latestPlan.days.find((d) => d.day === "Tonight");
    expect(tonightDay).toBeDefined();
    expect(tonightDay!.baseMealId).toBe("meal-fishfingers");
  });

  it("can add a rescue meal to the week", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderRescueMode("h-rescue");

    await user.click(screen.getByTestId("scenario-low-time"));
    await user.click(screen.getByTestId("add-to-week-meal-fishfingers"));

    expect(screen.getByTestId("add-to-week-meal-fishfingers")).toHaveTextContent("Added!");
    const saved = loadHousehold("h-rescue");
    expect(saved!.weeklyPlans.length).toBeGreaterThan(0);
    const latestPlan = saved!.weeklyPlans[saved!.weeklyPlans.length - 1]!;
    expect(latestPlan.days.some((d) => d.baseMealId === "meal-fishfingers")).toBe(true);
  });

  it("rescue meal includes per-person assemblies when added", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderRescueMode("h-rescue");

    await user.click(screen.getByTestId("scenario-low-time"));
    await user.click(screen.getByTestId("add-tonight-meal-fishfingers"));

    const saved = loadHousehold("h-rescue");
    const latestPlan = saved!.weeklyPlans[saved!.weeklyPlans.length - 1]!;
    const tonightDay = latestPlan.days.find((d) => d.day === "Tonight");
    expect(tonightDay!.variants.length).toBe(2);
  });
});

describe("F012: Rescue mode reachable from Home", () => {
  it("Home shows one-tap rescue mode card", () => {
    seedHousehold();
    renderHome("h-rescue");

    const rescueCard = screen.getByTestId("rescue-mode-card");
    expect(rescueCard).toBeInTheDocument();
    expect(rescueCard).toHaveAttribute("href", "/household/h-rescue/rescue");
  });
});

describe("F012: Rescue mode uses shared styling", () => {
  it("scenario cards use Card component", () => {
    seedHousehold();
    renderRescueMode("h-rescue");

    const card = screen.getByTestId("scenario-low-energy");
    expect(card.className).toContain("rounded");
    expect(card.className).toContain("shadow");
  });

  it("rescue result cards use Card component", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderRescueMode("h-rescue");

    await user.click(screen.getByTestId("scenario-low-time"));

    const resultCard = screen.getByTestId("rescue-meal-meal-fishfingers");
    expect(resultCard.className).toContain("rounded");
    expect(resultCard.className).toContain("shadow");
  });
});
