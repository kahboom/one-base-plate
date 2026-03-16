import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold } from "../src/storage";
import HouseholdList from "../src/pages/HouseholdList";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import BaseMealManager from "../src/pages/BaseMealManager";
import Planner from "../src/pages/Planner";
import WeeklyPlanner from "../src/pages/WeeklyPlanner";
import Home from "../src/pages/Home";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-mobile",
    name: "Mobile Test Family",
    members: [
      {
        id: "m1",
        name: "Alice",
        role: "adult",
        safeFoods: ["pasta"],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
      {
        id: "m2",
        name: "Baby Bee",
        role: "baby",
        safeFoods: ["rice"],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "pureed",
        allergens: [],
        notes: "",
      },
    ],
    ingredients: [
      { id: "ing-pasta", name: "Pasta", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
      { id: "ing-sauce", name: "Tomato Sauce", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
    ],
    baseMeals: [
      {
        id: "meal-pasta",
        name: "Simple Pasta",
        components: [
          { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
          { ingredientId: "ing-sauce", role: "sauce", quantity: "200g" },
        ],
        defaultPrep: "boil",
        estimatedTimeMinutes: 15,
        difficulty: "easy",
        rescueEligible: true,
        wasteReuseHints: [],
      },
    ],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

beforeEach(() => {
  localStorage.clear();
});

describe("F033: Touch-friendly tap targets", () => {
  it("buttons have minimum 36px height for touch targets", () => {
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    const button = screen.getByText("Create Household");
    expect(button.className).toContain("min-h-[44px]");
  });

  it("inputs have minimum 44px height for touch targets", () => {
    render(
      <MemoryRouter initialEntries={["/household/new"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );
    const input = screen.getByPlaceholderText("Household name");
    expect(input.className).toContain("min-h-[44px]");
  });

  it("small buttons have touch-friendly 36px minimum height", async () => {
    seedHousehold();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/household/h-mobile/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("meal-row-meal-pasta"));
    const modal = screen.getByTestId("meal-modal");
    const removeBtn = within(modal).getByText("Remove meal");
    expect(removeBtn.className).toContain("min-h-[36px]");
  });
});

describe("F033: Responsive page header", () => {
  it("page header uses responsive text sizing", () => {
    render(
      <MemoryRouter initialEntries={["/household/new"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );
    const heading = screen.getByText("Create Household");
    expect(heading.className).toContain("text-2xl");
    expect(heading.className).toContain("sm:text-3xl");
  });
});

describe("F033: Mobile-friendly card layouts", () => {
  it("household rows use compact touch-friendly browse list", () => {
    const household: Household = {
      id: "h1",
      name: "Test Family",
      members: [{ id: "m1", name: "A", role: "adult", safeFoods: [], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" }],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    };
    saveHousehold(household);
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    const row = screen.getByTestId("household-row-h1");
    expect(row.tagName).toBe("BUTTON");
    expect(row.className).toContain("min-h-[48px]");
  });

  it("meal planner uses responsive grid for meal cards", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-mobile/planner"]}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );
    const grid = screen.getByTestId("meal-card-grid");
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("sm:grid-cols-2");
  });

  it("weekly planner day cards use responsive grid", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-mobile/weekly"]}>
        <Routes>
          <Route path="/household/:householdId/weekly" element={<WeeklyPlanner />} />
        </Routes>
      </MemoryRouter>,
    );
    const dayCards = screen.getByTestId("day-cards");
    expect(dayCards.className).toContain("grid");
    expect(dayCards.className).toContain("grid-cols-1");
    expect(dayCards.className).toContain("sm:grid-cols-2");
  });
});

describe("F033: NavBar mobile-friendly wrapping", () => {
  it("NavBar does not use pipe separators", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-mobile/home"]}>
        <Routes>
          <Route path="/household/:householdId/home" element={<Home />} />
        </Routes>
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation");
    expect(nav.textContent).not.toContain("|");
  });

  it("household setup NavBar does not use pipe separators", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-mobile"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation");
    expect(nav.textContent).not.toContain("|");
  });
});

describe("F033: ActionGroup and FormRow stack on mobile", () => {
  it("household control bar uses responsive flex direction", () => {
    saveHousehold({
      id: "h-control",
      name: "Control Family",
      members: [{ id: "m1", name: "A", role: "adult", safeFoods: [], hardNoFoods: [], preparationRules: [], textureLevel: "regular", allergens: [], notes: "" }],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    });
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    const controlBar = screen.getByTestId("household-control-bar");
    const row = controlBar.querySelector("div.flex") as HTMLElement;
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("sm:flex-row");
  });
});

describe("F033: Weekly strip horizontal scroll on Home", () => {
  it("weekly strip supports horizontal scroll with overflow", () => {
    const household = seedHousehold();
    household.weeklyPlans = [{
      id: "wp1",
      days: [{ day: "Monday", baseMealId: "meal-pasta", variants: [] }],
      selectedBaseMeals: ["meal-pasta"],
      generatedGroceryList: [],
      notes: "",
    }];
    saveHousehold(household);

    render(
      <MemoryRouter initialEntries={["/household/h-mobile/home"]}>
        <Routes>
          <Route path="/household/:householdId/home" element={<Home />} />
        </Routes>
      </MemoryRouter>,
    );
    const strip = screen.getByTestId("weekly-strip");
    const scrollContainer = strip.querySelector("[class*='overflow-x-auto']") as HTMLElement;
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer.className).toContain("overflow-x-auto");
  });
});

describe("F033: Planner interactions work with tap", () => {
  it("tapping a meal card selects it and shows the plan", async () => {
    seedHousehold();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/household/h-mobile/planner"]}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );
    const selectableCard = screen.getByTestId("selectable-meal-pasta");
    await user.click(selectableCard);
    expect(screen.getByTestId("meal-plan")).toBeInTheDocument();
    const mealPlan = screen.getByTestId("meal-plan");
    expect(within(mealPlan).getByText("Simple Pasta")).toBeInTheDocument();
  });
});

describe("F033: Viewport meta tag", () => {
  it("index.html includes viewport meta for mobile scaling", async () => {
    const fs = await import("fs");
    const html = fs.readFileSync("index.html", "utf-8");
    expect(html).toContain('name="viewport"');
    expect(html).toContain("width=device-width");
  });
});
