import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { BaseMeal, Household, HouseholdMember, Ingredient } from "../src/types";
import { saveHousehold } from "../src/storage";
import WeeklyPlanner from "../src/pages/WeeklyPlanner";

const ingredients: Ingredient[] = [
  {
    id: "ing-x",
    name: "protein x",
    category: "protein",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
];

const members: HouseholdMember[] = [
  {
    id: "m1",
    name: "Alex",
    role: "adult",
    safeFoods: [],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "regular",
    allergens: [],
    notes: "",
  },
];

function makeMeal(i: number): BaseMeal {
  return {
    id: `meal-${i}`,
    name: `Meal ${i}`,
    components: [{ ingredientId: "ing-x", role: "protein", quantity: "1" }],
    defaultPrep: "",
    estimatedTimeMinutes: 20 + (i % 40),
    difficulty: i % 3 === 0 ? "easy" : i % 3 === 1 ? "medium" : "hard",
    rescueEligible: false,
    wasteReuseHints: [],
  };
}

function seedLargeHousehold(mealCount: number): Household {
  const h: Household = {
    id: "h-many",
    name: "Large library",
    members,
    ingredients,
    baseMeals: Array.from({ length: mealCount }, (_, i) => makeMeal(i)),
    weeklyPlans: [],
  };
  saveHousehold(h);
  return h;
}

function renderWeeklyPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/weekly`]}>
      <Routes>
        <Route path="/household/:householdId/weekly" element={<WeeklyPlanner />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockTrayViewport(
  variant: "mobile" | "tablet" | "desktop",
) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches:
      variant === "desktop"
        ? query === "(min-width: 1024px)" || query === "(min-width: 640px)"
        : variant === "tablet"
          ? query === "(min-width: 640px)"
          : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  mockTrayViewport("desktop");
});

describe("Weekly Planner suggested tray (capped + browse)", () => {
  it("renders at most 8 meal cards in the default tray on desktop for large libraries", () => {
    seedLargeHousehold(80);
    renderWeeklyPlanner("h-many");
    const tray = screen.getByTestId("suggested-tray");
    const strip = within(tray).getByTestId("suggested-tray-default");
    const cards = within(strip).queryAllByTestId(/^meal-card-/);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(8);
    expect(within(tray).getByTestId("suggested-tray-summary")).toHaveTextContent(/Top \d+ of 80/);
  });

  it("renders at most 6 meal cards on tablet viewport", () => {
    mockTrayViewport("tablet");
    seedLargeHousehold(80);
    renderWeeklyPlanner("h-many");
    const strip = screen.getByTestId("suggested-tray-default");
    const cards = within(strip).queryAllByTestId(/^meal-card-/);
    expect(cards.length).toBeLessThanOrEqual(6);
  });

  it("renders at most 4 meal cards on mobile viewport", () => {
    mockTrayViewport("mobile");
    seedLargeHousehold(80);
    renderWeeklyPlanner("h-many");
    const strip = screen.getByTestId("suggested-tray-default");
    const cards = within(strip).queryAllByTestId(/^meal-card-/);
    expect(cards.length).toBeLessThanOrEqual(4);
  });

  it("opens browse modal and incrementally loads the full ranked list", async () => {
    const user = userEvent.setup();
    seedLargeHousehold(50);
    renderWeeklyPlanner("h-many");
    await user.click(screen.getByTestId("browse-all-meals-btn"));
    const modal = screen.getByTestId("browse-meals-modal");
    expect(modal).toBeInTheDocument();
    const grid = within(modal).getByTestId("browse-meals-grid");
    const visible = within(grid).queryAllByTestId(/^meal-card-/);
    expect(visible.length).toBeLessThanOrEqual(48);
    expect(within(modal).getByTestId("browse-meals-load-more")).toBeEnabled();
    await user.click(within(modal).getByTestId("browse-meals-load-more"));
    const after = within(grid).queryAllByTestId(/^meal-card-/);
    expect(after.length).toBe(50);
    expect(within(modal).queryByTestId("browse-meals-load-more")).toBeNull();
  });

  it("filters browse list by effort level", async () => {
    const user = userEvent.setup();
    seedLargeHousehold(30);
    renderWeeklyPlanner("h-many");
    await user.click(screen.getByTestId("browse-all-meals-btn"));
    const modal = screen.getByTestId("browse-meals-modal");
    const before = within(modal).getByTestId("browse-meals-count").textContent ?? "";
    await user.selectOptions(within(modal).getByTestId("browse-meals-effort-filter"), "hard");
    const after = within(modal).getByTestId("browse-meals-count").textContent ?? "";
    expect(after).not.toBe(before);
    expect(after).toMatch(/\d+ meal/);
  });

  it("filters browse list by search query", async () => {
    const user = userEvent.setup();
    const h = seedLargeHousehold(20);
    h.baseMeals[7] = { ...h.baseMeals[7]!, name: "ZestyUniqueBrowseTestMeal" };
    saveHousehold(h);
    renderWeeklyPlanner("h-many");
    await user.click(screen.getByTestId("browse-all-meals-btn"));
    const modal = screen.getByTestId("browse-meals-modal");
    await user.type(within(modal).getByTestId("browse-meals-search"), "ZestyUniqueBrowseTestMeal");
    const grid = within(modal).getByTestId("browse-meals-grid");
    expect(within(grid).getAllByTestId(/^meal-card-/).length).toBe(1);
  });

  it("default suggested strip includes horizontal scroll classes for narrow layout", () => {
    mockTrayViewport("mobile");
    seedLargeHousehold(5);
    renderWeeklyPlanner("h-many");
    const strip = screen.getByTestId("suggested-tray-default");
    expect(strip.className).toContain("overflow-x-auto");
  });
});
