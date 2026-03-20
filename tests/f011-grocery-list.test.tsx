import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { householdLayoutRouteBranch } from "./householdLayoutRoutes";
import type { Household, BaseMeal, Ingredient, HouseholdMember, DayPlan, WeeklyPlan } from "../src/types";
import { saveHousehold } from "../src/storage";
import { generateGroceryList } from "../src/planner";
import GroceryList from "../src/pages/GroceryList";

const ingredients: Ingredient[] = [
  { id: "ing-pasta", name: "pasta", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-chicken", name: "chicken", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "ing-rice", name: "rice", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-salmon", name: "salmon", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "ing-broccoli", name: "broccoli", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-cheese", name: "cheese", category: "dairy", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
];

const mealPasta: BaseMeal = {
  id: "meal-pasta",
  name: "Pasta with chicken",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "400g" },
    { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
    { ingredientId: "ing-cheese", role: "topping", quantity: "50g" },
  ],
  defaultPrep: "Cook pasta and chicken",
  estimatedTimeMinutes: 25,
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
    { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
  ],
  defaultPrep: "Cook rice and salmon",
  estimatedTimeMinutes: 35,
  difficulty: "medium",
  rescueEligible: false,
  wasteReuseHints: [],
};

const members: HouseholdMember[] = [
  { id: "m-a", name: "Alex", role: "adult", safeFoods: [], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" },
];

function makePlan(days: DayPlan[]): WeeklyPlan {
  return {
    id: "plan-1",
    days,
    selectedBaseMeals: [...new Set(days.map((d) => d.baseMealId))],
    generatedGroceryList: [],
    notes: "",
  };
}

function seedHousehold(plan?: WeeklyPlan): Household {
  const household: Household = {
    id: "h-grocery",
    name: "Grocery Test Family",
    members,
    ingredients,
    baseMeals: [mealPasta, mealRice],
    weeklyPlans: plan ? [plan] : [],
  };
  saveHousehold(household);
  return household;
}

function renderGroceryList(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/grocery`]}>
      <Routes>
        <Route path="/household/:householdId/grocery" element={<GroceryList />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F011: generateGroceryList engine", () => {
  it("consolidates repeated ingredients into one entry", () => {
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
      { day: "Tuesday", baseMealId: "meal-pasta", variants: [] },
    ];
    const list = generateGroceryList(days, [mealPasta], ingredients);
    // pasta, chicken, cheese — each appears once, with quantity ×2
    expect(list.length).toBe(3);
    const pasta = list.find((i) => i.name === "pasta");
    expect(pasta!.quantity).toBe("×2");
  });

  it("merges ingredients across different meals", () => {
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
      { day: "Tuesday", baseMealId: "meal-rice", variants: [] },
    ];
    const list = generateGroceryList(days, [mealPasta, mealRice], ingredients);
    // pasta, chicken, cheese, rice, salmon, broccoli = 6 unique
    expect(list.length).toBe(6);
  });

  it("groups by category and sorts alphabetically within category", () => {
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
      { day: "Tuesday", baseMealId: "meal-rice", variants: [] },
    ];
    const list = generateGroceryList(days, [mealPasta, mealRice], ingredients);
    // protein should come before carb, carb before veg, veg before dairy
    const categories = list.map((i) => i.category);
    const proteinIdx = categories.indexOf("protein");
    const carbIdx = categories.indexOf("carb");
    const vegIdx = categories.indexOf("veg");
    const dairyIdx = categories.indexOf("dairy");
    expect(proteinIdx).toBeLessThan(carbIdx);
    expect(carbIdx).toBeLessThan(vegIdx);
    expect(vegIdx).toBeLessThan(dairyIdx);
  });

  it("tracks which meals use each ingredient", () => {
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
      { day: "Tuesday", baseMealId: "meal-rice", variants: [] },
    ];
    const list = generateGroceryList(days, [mealPasta, mealRice], ingredients);
    const chicken = list.find((i) => i.name === "chicken");
    expect(chicken!.usedInMeals).toEqual([{ id: "meal-pasta", name: "Pasta with chicken" }]);
    const rice = list.find((i) => i.name === "rice");
    expect(rice!.usedInMeals).toEqual([{ id: "meal-rice", name: "Rice with salmon" }]);
  });

  it("shows no quantity label for single-use ingredients", () => {
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ];
    const list = generateGroceryList(days, [mealPasta], ingredients);
    const pasta = list.find((i) => i.name === "pasta");
    expect(pasta!.quantity).toBe("");
  });

  it("ignores empty ingredient IDs in components", () => {
    const mealWithInvalidComponent: BaseMeal = {
      ...mealPasta,
      id: "meal-invalid",
      components: [
        { ingredientId: "", role: "protein", quantity: "1" },
        { ingredientId: "   ", role: "veg", quantity: "1" },
        { ingredientId: "ing-pasta", role: "carb", quantity: "200g" },
      ],
    };
    const days: DayPlan[] = [
      { day: "Monday", baseMealId: "meal-invalid", variants: [] },
    ];
    const list = generateGroceryList(days, [mealWithInvalidComponent], ingredients);
    expect(list).toHaveLength(1);
    expect(list[0]!.ingredientId).toBe("ing-pasta");
    expect(list[0]!.name).toBe("pasta");
  });
});

describe("F011: GroceryList page renders grouped list", () => {
  it("shows grouped categories with ingredient items", () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
      { day: "Tuesday", baseMealId: "meal-rice", variants: [] },
    ]);
    seedHousehold(plan);
    renderGroceryList("h-grocery");

    expect(screen.getByTestId("grocery-categories")).toBeInTheDocument();
    expect(screen.getByTestId("category-protein")).toBeInTheDocument();
    expect(screen.getByTestId("category-carb")).toBeInTheDocument();
    expect(screen.getByTestId("category-veg")).toBeInTheDocument();
    expect(screen.getByTestId("category-dairy")).toBeInTheDocument();
  });

  it("shows individual ingredient items", () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    renderGroceryList("h-grocery");

    expect(screen.getByTestId("grocery-item-ing-pasta")).toBeInTheDocument();
    expect(screen.getByTestId("grocery-item-ing-chicken")).toBeInTheDocument();
    expect(screen.getByTestId("grocery-item-ing-cheese")).toBeInTheDocument();
  });

  it("shows consolidated quantity for repeated ingredients", () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
      { day: "Tuesday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    renderGroceryList("h-grocery");

    const pastaItem = screen.getByTestId("grocery-item-ing-pasta");
    expect(within(pastaItem).getByText("×2")).toBeInTheDocument();
  });

  it("shows meal links for each ingredient", () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    renderGroceryList("h-grocery");

    const chickenItem = screen.getByTestId("grocery-item-ing-chicken");
    const mealLink = within(chickenItem).getByTestId("meal-link-ing-chicken-meal-pasta");
    expect(mealLink).toHaveTextContent("Pasta with chicken");
    expect(mealLink).toHaveAttribute("href", "/household/h-grocery/meal/meal-pasta");
  });

  it("navigates to meal detail when recipe link is clicked", async () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/household/h-grocery/grocery"]}>
        <Routes>{householdLayoutRouteBranch}</Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("grocery-categories");
    await user.click(screen.getByTestId("meal-link-ing-chicken-meal-pasta"));

    expect(await screen.findByRole("heading", { name: "Pasta with chicken" })).toBeInTheDocument();
  });
});

describe("F011: Already-have toggle", () => {
  it("can mark an ingredient as already owned", async () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    const user = userEvent.setup();
    renderGroceryList("h-grocery");

    const toggleBtn = screen.getByTestId("toggle-owned-ing-pasta");
    await user.click(toggleBtn);

    const pastaItem = screen.getByTestId("grocery-item-ing-pasta");
    expect(pastaItem.className).toContain("opacity-50");
  });

  it("updates summary count when items are toggled", async () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    const user = userEvent.setup();
    renderGroceryList("h-grocery");

    expect(screen.getByTestId("grocery-summary")).toHaveTextContent("3 to buy");

    await user.click(screen.getByTestId("toggle-owned-ing-pasta"));

    expect(screen.getByTestId("grocery-summary")).toHaveTextContent("2 to buy");
    expect(screen.getByTestId("grocery-summary")).toHaveTextContent("1 already have");
  });

  it("can unmark an owned ingredient", async () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    const user = userEvent.setup();
    renderGroceryList("h-grocery");

    await user.click(screen.getByTestId("toggle-owned-ing-pasta"));
    expect(screen.getByTestId("grocery-summary")).toHaveTextContent("2 to buy");

    await user.click(screen.getByTestId("toggle-owned-ing-pasta"));
    expect(screen.getByTestId("grocery-summary")).toHaveTextContent("3 to buy");
  });

  it("show all button clears owned state", async () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    const user = userEvent.setup();
    renderGroceryList("h-grocery");

    await user.click(screen.getByTestId("toggle-owned-ing-pasta"));
    await user.click(screen.getByTestId("toggle-owned-ing-chicken"));

    expect(screen.getByTestId("grocery-summary")).toHaveTextContent("1 to buy");
    expect(screen.getByTestId("clear-owned-btn")).toBeInTheDocument();

    await user.click(screen.getByTestId("clear-owned-btn"));

    expect(screen.getByTestId("grocery-summary")).toHaveTextContent("3 to buy");
  });
});

describe("F011: Empty state", () => {
  it("shows empty state when no plan exists", () => {
    seedHousehold();
    renderGroceryList("h-grocery");

    expect(screen.getByText(/No weekly plan saved yet/)).toBeInTheDocument();
  });
});

describe("F011: Mobile-friendly and shared styling", () => {
  it("uses Card component for category groups", () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    renderGroceryList("h-grocery");

    const proteinCategory = screen.getByTestId("category-protein");
    expect(proteinCategory.className).toContain("rounded");
    expect(proteinCategory.className).toContain("shadow");
  });

  it("grocery items stack vertically on mobile via flex-col class", () => {
    const plan = makePlan([
      { day: "Monday", baseMealId: "meal-pasta", variants: [] },
    ]);
    seedHousehold(plan);
    renderGroceryList("h-grocery");

    const item = screen.getByTestId("grocery-item-ing-pasta");
    expect(item.className).toContain("flex-col");
  });
});
