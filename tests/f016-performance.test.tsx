/**
 * F016 – App loads quickly and supports same-session editing without noticeable lag.
 * Verifies: fast render with fixture data, navigation across all core screens,
 * inline editing + plan regeneration, and no crashes during normal flows.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold } from "../src/storage";
import {
  generateAssemblyVariants,
  generateWeeklyPlan,
  generateRescueMeals,
  generateGroceryList,
  computeMealOverlap,
} from "../src/planner";

import HouseholdList from "../src/pages/HouseholdList";

import fixtureH002 from "../fixtures/households/H002-two-adults-toddler-baby.json";
import { householdLayoutRouteBranch } from "./householdLayoutRoutes";

function loadFixture(): Household {
  const h = fixtureH002 as Household;
  saveHousehold(h);
  return h;
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HouseholdList />} />
        {householdLayoutRouteBranch}
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F016: App loads and renders with representative fixture", () => {
  it("renders household list without errors", () => {
    loadFixture();
    renderRoute("/");
    expect(screen.getByText("Two adults, toddler, and baby")).toBeInTheDocument();
  });

  it("renders Home screen with fixture household immediately", () => {
    loadFixture();
    renderRoute("/household/H002/home");
    expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    expect(screen.getByTestId("top-suggestions")).toBeInTheDocument();
  });

  it("renders Household Setup with all four members", () => {
    loadFixture();
    renderRoute("/household/H002");
    expect(screen.getByDisplayValue("Two adults, toddler, and baby")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Jordan")).toBeInTheDocument();
    expect(screen.getByText("Riley")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
  });

  it("renders Planner with meal cards ranked by overlap", () => {
    loadFixture();
    renderRoute("/household/H002/planner");
    expect(screen.getByText("Meal Planner")).toBeInTheDocument();
    expect(screen.getByTestId("meal-card-grid")).toBeInTheDocument();
    const grid = screen.getByTestId("meal-card-grid");
    expect(within(grid).getAllByText(/overlap/i).length).toBeGreaterThan(0);
  });

  it("renders WeeklyPlanner with day cards and suggested tray", () => {
    loadFixture();
    renderRoute("/household/H002/weekly");
    expect(screen.getByText("Weekly Planner")).toBeInTheDocument();
    expect(screen.getByTestId("day-cards")).toBeInTheDocument();
    expect(screen.getByTestId("suggested-tray")).toBeInTheDocument();
  });
});

describe("F016: Navigation across setup, planning, and grocery screens", () => {
  it("navigates from HouseholdSetup to MemberProfile and back without errors", async () => {
    const user = userEvent.setup();
    loadFixture();
    renderRoute("/household/H002");
    const firstMemberCard = screen.getAllByTestId(/^member-/)[0]!;
    await user.click(within(firstMemberCard).getByRole("button", { name: "Edit" }));
    const editLinks = screen.getAllByText(/Edit profile details/i);
    expect(editLinks.length).toBeGreaterThan(0);
  });

  it("renders IngredientManager with fixture ingredients", () => {
    loadFixture();
    renderRoute("/household/H002/ingredients");
    expect(screen.getByRole("heading", { name: /ingredients/i })).toBeInTheDocument();
  });

  it("renders BaseMealManager with fixture meals", () => {
    loadFixture();
    renderRoute("/household/H002/meals");
    expect(screen.getByRole("heading", { name: /base meals/i })).toBeInTheDocument();
  });

  it("renders GroceryList empty state when no plan saved", () => {
    loadFixture();
    renderRoute("/household/H002/grocery");
    expect(screen.getByText(/no weekly plan saved/i)).toBeInTheDocument();
  });

  it("renders GroceryList with items after saving a plan", () => {
    const h = loadFixture();
    const days = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 5);
    h.weeklyPlans = [{
      id: "test-plan",
      days,
      selectedBaseMeals: [...new Set(days.map(d => d.baseMealId))],
      generatedGroceryList: [],
      notes: "",
    }];
    saveHousehold(h);
    renderRoute("/household/H002/grocery");
    expect(screen.getByTestId("grocery-categories")).toBeInTheDocument();
  });

  it("renders RescueMode with scenario picker", () => {
    loadFixture();
    renderRoute("/household/H002/rescue");
    expect(screen.getByRole("heading", { name: /rescue mode/i })).toBeInTheDocument();
    expect(screen.getByText(/low energy/i)).toBeInTheDocument();
    expect(screen.getByText(/low time/i)).toBeInTheDocument();
  });
});

describe("F016: Editing constraints and regenerating plan", () => {
  it("selects a meal in Planner and shows variants without lag", async () => {
    const user = userEvent.setup();
    loadFixture();
    renderRoute("/household/H002/planner");

    const firstMealCard = screen.getByTestId("meal-card-grid").querySelector("[data-testid]");
    expect(firstMealCard).toBeTruthy();
    await user.click(firstMealCard!);

    expect(screen.getByTestId("meal-plan")).toBeInTheDocument();
    expect(screen.getByTestId("overlap-summary")).toBeInTheDocument();
  });

  it("generates a weekly plan and displays day cards with meals", async () => {
    const user = userEvent.setup();
    loadFixture();
    renderRoute("/household/H002/weekly");

    await user.click(screen.getByTestId("generate-btn"));

    const dayCards = screen.getByTestId("day-cards");
    const mondayCard = within(dayCards).getByTestId("day-monday");
    expect(within(mondayCard).queryByText(/No meal planned/)).toBeNull();
  });

  it("assigns a meal via tap-to-assign and plan updates immediately", async () => {
    const user = userEvent.setup();
    loadFixture();
    renderRoute("/household/H002/weekly");

    const tray = screen.getByTestId("suggested-tray");
    const assignBtns = within(tray).getAllByText("Assign");
    expect(assignBtns.length).toBeGreaterThan(0);

    await user.click(assignBtns[0]!);
    expect(screen.getByTestId("assign-prompt")).toBeInTheDocument();

    const monday = screen.getByTestId("day-monday");
    await user.click(monday);

    expect(within(monday).queryByText(/No meal planned/)).toBeNull();
  });

  it("selects a rescue scenario and gets results without errors", async () => {
    const user = userEvent.setup();
    loadFixture();
    renderRoute("/household/H002/rescue");

    await user.click(screen.getByText(/low time/i));

    expect(screen.getAllByText(/min/).length).toBeGreaterThan(0);
  });
});

describe("F016: Engine performance with fixture data", () => {
  it("computes assembly variants for all 3 meals × 4 members quickly", () => {
    const h = loadFixture();
    const start = performance.now();
    for (const meal of h.baseMeals) {
      generateAssemblyVariants(meal, h.members, h.ingredients);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("generates a 7-day weekly plan from fixture data quickly", () => {
    const h = loadFixture();
    const start = performance.now();
    const days = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 7);
    const elapsed = performance.now() - start;
    expect(days.length).toBe(7);
    expect(elapsed).toBeLessThan(100);
  });

  it("computes overlap for all meals quickly", () => {
    const h = loadFixture();
    const start = performance.now();
    for (const meal of h.baseMeals) {
      computeMealOverlap(meal, h.members, h.ingredients);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("generates grocery list from a full week plan quickly", () => {
    const h = loadFixture();
    const days = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 7);
    const start = performance.now();
    const items = generateGroceryList(days, h.baseMeals, h.ingredients);
    const elapsed = performance.now() - start;
    expect(items.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });

  it("generates rescue meals for all scenarios quickly", () => {
    const h = loadFixture();
    const scenarios = ["low-energy", "low-time", "everyone-melting-down"] as const;
    const start = performance.now();
    for (const scenario of scenarios) {
      generateRescueMeals(h.baseMeals, h.members, h.ingredients, scenario);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

describe("F016: No crashes during normal flows", () => {
  it("handles empty household without crashing", () => {
    const empty: Household = {
      id: "H-empty",
      name: "Empty household",
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    };
    saveHousehold(empty);
    renderRoute("/household/H-empty/home");
    expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
  });

  it("handles household with members but no meals without crashing", () => {
    const h = loadFixture();
    h.baseMeals = [];
    saveHousehold(h);
    renderRoute("/household/H002/planner");
    expect(screen.getByText(/no base meals/i)).toBeInTheDocument();
  });

  it("handles weekly planner with no meals without crashing", () => {
    const h = loadFixture();
    h.baseMeals = [];
    saveHousehold(h);
    renderRoute("/household/H002/weekly");
    expect(screen.getByText(/no base meals/i)).toBeInTheDocument();
  });

  it("handles rescue mode with no meals without crashing", () => {
    const h = loadFixture();
    h.baseMeals = [];
    saveHousehold(h);
    renderRoute("/household/H002/rescue");
    expect(screen.getByText(/no meals/i)).toBeInTheDocument();
  });
});
